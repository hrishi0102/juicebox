// Receipts monthly check (Chainlink CRE).
//
// Once a month (the simulator runs it right away), every DON node on its own:
//   1. reads the team's receipts straight from Arkiv (JSON-RPC `arkiv_query`; no Receipts server),
//   2. checks each receipt's EIP-712 signature against the person it is about,
//   3. adds up the signed numbers, one receipt per person per week,
//   4. asks GitHub whether each PR a receipt claims as merged is still merged.
// Consensus takes the median of every number, and the result is written to TeamScoreboard on
// Ethereum Sepolia through the CRE forwarder, so no person can post or change a team's score.
//
// The check itself is in score.ts, so `node check-live.ts` runs the same code against live data.

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
  median,
  prepareReportRequest,
  Runner,
  type Runtime,
  text,
  TxStatus,
} from "@chainlink/cre-sdk";
import { encodeAbiParameters, keccak256, parseAbiParameters, stringToHex, zeroAddress } from "viem";
import { z } from "zod";
import { checkTeam, REPORT_ABI, type Fetch, type TeamScore } from "./score";

const configSchema = z.object({
  schedule: z.string(), // "0 0 0 1 * *" = 00:00 UTC on the 1st of each month
  teamId: z.string(), // e.g. "acme-payments"
  arkivRpcUrl: z.string(), // https://rpc.rabdi.db-chain.testnet.arkiv.network
  schemaName: z.string(), // receipts-ethglobal-mumbai.receipt.v2
  trustedWriters: z.array(z.string()), // Arkiv creators whose entities count ([] = any)
  windowDays: z.number(), // weeks that ended in the last N days
  maxPrChecks: z.number(), // GitHub calls per run (CRE allows 15 HTTP calls; Arkiv uses one)
  chainSelectorName: z.string(), // "ethereum-testnet-sepolia"
  consumerAddress: z.string(), // TeamScoreboard; the zero address skips the write
  gasLimit: z.string(),
});
type Config = z.infer<typeof configSchema>;

// ---------- node mode: runs on every DON node ----------
const onNode = (send: HTTPSendRequester, cfg: Config, secrets: { arkivAccessKey?: string; githubToken?: string }, nowSec: number): TeamScore => {
  const fetch: Fetch = (req) => {
    const multiHeaders = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, { values: [v] }]));
    // A GET has no body field at all: CRE refuses one that is present but empty.
    const request = req.body
      ? { url: req.url, method: req.method, body: hexToBase64(stringToHex(req.body)), multiHeaders }
      : { url: req.url, method: req.method, multiHeaders };
    const res = send.sendRequest(request).result();
    return { status: res.statusCode, body: text(res) };
  };
  return checkTeam(fetch, cfg, secrets, nowSec);
};

const secret = (runtime: Runtime<Config>, id: string) => {
  try {
    return runtime.getSecret({ id }).result().value || undefined;
  } catch {
    return undefined; // not set: GitHub without a token, or Arkiv's public endpoint
  }
};

// ---------- DON mode: the cron trigger ----------
const onCron = (runtime: Runtime<Config>, payload: CronPayload): string => {
  const cfg = runtime.config;
  const secrets = { arkivAccessKey: secret(runtime, "ARKIV_ACCESS_KEY"), githubToken: secret(runtime, "GITHUB_TOKEN") };
  // The DON's own clock, which every node agrees on. (The cron fires on the 1st, so on the network this
  // is the scheduled time; the simulator would otherwise report the next scheduled run, not today.)
  void payload;
  const nowSec = Math.floor(runtime.now().getTime() / 1000);

  const s = new HTTPClient()
    .sendRequest(
      runtime,
      onNode,
      ConsensusAggregationByFields<TeamScore>({
        receipts: median,
        people: median,
        rejected: median,
        spendCents: median,
        done: median,
        wastedCents: median,
        mergedPrs: median,
        prsChecked: median,
        prsStillMerged: median,
      }),
    )(cfg, secrets, nowSec)
    .result();

  runtime.log(`team=${cfg.teamId} asOf=${new Date(nowSec * 1000).toISOString()} score=${JSON.stringify(s)}`);

  // Report layout must match TeamScoreboard.onReport.
  const encoded = encodeAbiParameters(parseAbiParameters(REPORT_ABI), [
    keccak256(stringToHex(cfg.teamId)),
    Math.floor(nowSec / 86400),
    s.receipts,
    s.people,
    s.rejected,
    BigInt(s.spendCents),
    s.done,
    BigInt(s.wastedCents),
    s.mergedPrs,
    s.prsChecked,
    s.prsStillMerged,
  ]);

  if (cfg.consumerAddress.toLowerCase() === zeroAddress) {
    runtime.log("No TeamScoreboard address in the config: the score was checked but not written.");
    return encoded;
  }

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
