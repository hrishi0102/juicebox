// Receipts monthly scoring job (Chainlink CRE).
//
// Once a month (the simulator runs it right away):
//   1. Read the team's shared receipts straight from Arkiv (JSON-RPC `arkiv_query`). No Receipts server.
//   2. Keep receipts written by a trusted writer (the team's relayer) inside the scoring window.
//   3. Re-check the evidence on GitHub: every evidence PR must still be merged.
//   4. Every DON node does this independently; consensus takes the median of each number.
//   5. Write the verified monthly team score on-chain to the TeamScoreboard consumer contract.
//
// Signature checks: the web app and the team page re-verify EIP-712 signatures on read. Doing the
// same inside the DON is the next step (see README): it needs a synchronous secp256k1 recover.

import {
  bytesToHex,
  ConsensusAggregationByFields,
  CronCapability,
  type CronPayload,
  EVMClient,
  getNetwork,
  handler,
  hexToBase64,
  HTTPClient,
  type HTTPSendRequester,
  json,
  median,
  ok,
  prepareReportRequest,
  Runner,
  type Runtime,
  TxStatus,
} from "@chainlink/cre-sdk";
import { encodeAbiParameters, hexToString, keccak256, parseAbiParameters, stringToHex, type Hex } from "viem";
import { z } from "zod";

const configSchema = z.object({
  schedule: z.string(), // "0 0 0 1 * *" = 00:00 UTC on the 1st of each month
  teamId: z.string(), // e.g. "acme-payments"
  arkivRpcUrl: z.string(), // https://rpc.rabdi.db-chain.testnet.arkiv.network
  schemaName: z.string(), // receipts-ethglobal-mumbai.receipt.v1
  trustedWriters: z.array(z.string()), // Arkiv writer addresses whose entities count ([] = any)
  windowDays: z.number(), // receipts whose week ended in the last N days
  maxPrChecks: z.number(), // GitHub calls per run (CRE allows 15 HTTP calls in total)
  chainSelectorName: z.string(), // "arc-testnet" or "ethereum-testnet-sepolia"
  consumerAddress: z.string(), // TeamScoreboard
  gasLimit: z.string(),
});
type Config = z.infer<typeof configSchema>;

// What each node observes. Consensus runs per field (median).
type TeamScore = {
  receipts: number;
  spendCents: number;
  shippedTasks: number;
  keptWorkMilli: number;
  survivalBps: number; // weighted by shipped tasks
  wasteBps: number; // weighted by spend
  prsChecked: number;
  prsStillMerged: number;
};

type RpcAttribute = { name: string; type: string; value: string };
type RpcEntity = { key: string; owner?: string; attributes?: RpcAttribute[] };
type SharedReceipt = {
  digest: string;
  message: {
    owner: string;
    period: string;
    periodEnd: string;
    spendCents: string;
    shippedTasks: number;
    survivalBps: number;
    keptWorkMilli: number;
    wasteBps: number;
  };
  evidence: { url: string; state: string; reverted: boolean }[];
};

const NO_SURVIVAL = 65535;

// ---------- node mode: runs on every DON node ----------
export const scoreTeam = (send: HTTPSendRequester, cfg: Config, githubToken: string, nowSec: number): TeamScore => {
  // 1. Shared receipts from Arkiv
  const query = `arkiv.schema = str('${cfg.schemaName}') AND type = str('receipt') AND team = str('${cfg.teamId}')`;
  const rpcBody = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "arkiv_query",
    params: [query, { select: { key: true, owner: true, attributes: { payload: true } }, limit: "0x64" }],
  });
  const arkiv = send
    .sendRequest({
      url: cfg.arkivRpcUrl,
      method: "POST",
      body: hexToBase64(stringToHex(rpcBody)),
      multiHeaders: { "Content-Type": { values: ["application/json"] } },
    })
    .result();
  if (!ok(arkiv)) throw new Error(`Arkiv query failed: ${arkiv.statusCode}`);
  const rows = ((json(arkiv) as { result?: { data?: RpcEntity[] } }).result?.data ?? []) as RpcEntity[];

  // 2. Decode, filter by writer and window, keep one receipt per person per week (the latest write).
  const trusted = cfg.trustedWriters.map((a) => a.toLowerCase());
  const from = nowSec - cfg.windowDays * 86400;
  const byPersonWeek: Record<string, SharedReceipt> = {};
  for (const row of rows) {
    if (trusted.length && !trusted.includes(String(row.owner ?? "").toLowerCase())) continue;
    const payload = row.attributes?.find((a) => a.name === "payload")?.value;
    if (!payload) continue;
    let r: SharedReceipt;
    try {
      r = JSON.parse(hexToString(payload as Hex)) as SharedReceipt;
    } catch {
      continue;
    }
    const end = Number(r.message?.periodEnd ?? 0);
    if (end < from || end > nowSec + 7 * 86400) continue;
    byPersonWeek[`${r.message.owner.toLowerCase()}|${r.message.period}`] = r;
  }
  const keys = Object.keys(byPersonWeek).sort(); // sorted for determinism across nodes
  const receipts = keys.map((k) => byPersonWeek[k]);

  // 3. Totals from the signed fields only.
  let spendCents = 0;
  let shippedTasks = 0;
  let keptWorkMilli = 0;
  let survivalWeighted = 0;
  let survivalWeight = 0;
  let wasteCents = 0;
  for (const r of receipts) {
    const spend = Number(r.message.spendCents);
    spendCents += spend;
    shippedTasks += r.message.shippedTasks;
    keptWorkMilli += r.message.keptWorkMilli;
    wasteCents += (spend * r.message.wasteBps) / 10000;
    if (r.message.survivalBps !== NO_SURVIVAL) {
      const w = Math.max(1, r.message.shippedTasks);
      survivalWeighted += r.message.survivalBps * w;
      survivalWeight += w;
    }
  }

  // 4. Re-check evidence on GitHub: is each claimed merged PR still merged?
  const prs: { repo: string; number: string }[] = [];
  for (const r of receipts) {
    for (const e of r.evidence ?? []) {
      if (e.state !== "merged" || e.reverted) continue;
      const m = e.url.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
      if (m) prs.push({ repo: m[1], number: m[2] });
    }
  }
  const gh = {
    Accept: { values: ["application/vnd.github+json"] },
    Authorization: { values: [`Bearer ${githubToken}`] },
    "X-GitHub-Api-Version": { values: ["2022-11-28"] },
    "User-Agent": { values: ["receipts-cre-monthly"] },
  };
  let prsChecked = 0;
  let prsStillMerged = 0;
  for (const pr of prs.slice(0, Math.min(cfg.maxPrChecks, 13))) {
    const res = send.sendRequest({ url: `https://api.github.com/repos/${pr.repo}/pulls/${pr.number}`, method: "GET", multiHeaders: gh }).result();
    prsChecked++;
    if (!ok(res)) continue; // private repo without access, or deleted: not confirmed
    const body = json(res) as { merged_at?: string | null };
    if (body.merged_at) prsStillMerged++;
  }

  return {
    receipts: receipts.length,
    spendCents: Math.round(spendCents),
    shippedTasks,
    keptWorkMilli,
    survivalBps: survivalWeight ? Math.round(survivalWeighted / survivalWeight) : NO_SURVIVAL,
    wasteBps: spendCents ? Math.round((wasteCents / spendCents) * 10000) : 0,
    prsChecked,
    prsStillMerged,
  };
};

// ---------- DON mode: trigger callback ----------
const onCron = (runtime: Runtime<Config>, payload: CronPayload): string => {
  const cfg = runtime.config;
  const githubToken = runtime.getSecret({ id: "GITHUB_TOKEN" }).result().value;
  const nowSec = Number(payload.scheduledExecutionTime?.seconds ?? BigInt(Math.floor(runtime.now().getTime() / 1000)));

  const s = new HTTPClient()
    .sendRequest(
      runtime,
      scoreTeam,
      ConsensusAggregationByFields<TeamScore>({
        receipts: median,
        spendCents: median,
        shippedTasks: median,
        keptWorkMilli: median,
        survivalBps: median,
        wasteBps: median,
        prsChecked: median,
        prsStillMerged: median,
      }),
    )(cfg, githubToken, nowSec)
    .result();

  runtime.log(`team=${cfg.teamId} score=${JSON.stringify(s)}`);

  // Report layout must match TeamScoreboard._processReport.
  const periodDay = Math.floor(nowSec / 86400);
  const encoded = encodeAbiParameters(
    parseAbiParameters(
      "bytes32 teamId, uint32 periodDay, uint32 receipts, uint64 spendCents, uint32 shippedTasks, uint32 keptWorkMilli, uint16 survivalBps, uint16 wasteBps, uint16 prsChecked, uint16 prsStillMerged",
    ),
    [
      keccak256(stringToHex(cfg.teamId)),
      periodDay,
      s.receipts,
      BigInt(s.spendCents),
      s.shippedTasks,
      s.keptWorkMilli,
      s.survivalBps,
      s.wasteBps,
      s.prsChecked,
      s.prsStillMerged,
    ],
  );
  const report = runtime.report(prepareReportRequest(encoded)).result();

  const network = getNetwork({ chainFamily: "evm", chainSelectorName: cfg.chainSelectorName, isTestnet: true });
  if (!network) throw new Error(`Unknown chain: ${cfg.chainSelectorName}`);
  const res = new EVMClient(network.chainSelector.selector)
    .writeReport(runtime, { receiver: cfg.consumerAddress, report, gasConfig: { gasLimit: cfg.gasLimit } })
    .result();
  if (res.txStatus !== TxStatus.SUCCESS) throw new Error(`writeReport failed: ${res.errorMessage ?? res.txStatus}`);
  const txHash = bytesToHex(res.txHash ?? new Uint8Array(32));
  runtime.log(`TeamScoreboard updated, tx ${txHash}`);
  return txHash;
};

const initWorkflow = (config: Config) => [handler(new CronCapability().trigger({ schedule: config.schedule }), onCron)];

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(initWorkflow);
}
