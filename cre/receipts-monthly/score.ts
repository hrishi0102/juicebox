// The monthly check itself, kept free of the CRE SDK so the same code runs on every DON node (through
// main.ts) and in Node against live data (check-live.ts).
//
//   1. Read the team's receipts straight from Arkiv (`arkiv_query` JSON-RPC, in pages of 30).
//   2. Keep the weeks that ended inside the window, written by a trusted writer.
//   3. Check every receipt's EIP-712 signature against the person it is about. Only signed receipts
//      count, one per person per week (the one written last).
//   4. Add up the signed numbers: spend, things done, spend on Wasted items, merged PRs.
//   5. Re-check on GitHub that everything a receipt claims as shipped still is: each merged pull
//      request is still merged, and each commit pushed straight to main is still in main's history.

import { hashTypedData, hexToString, keccak256, type Hex } from "viem";
import { secp256k1 } from "@noble/curves/secp256k1";

export type CheckConfig = {
  teamId: string; // Arkiv `team` attribute, e.g. "acme-payments"
  arkivRpcUrl: string; // https://rpc.rabdi.db-chain.testnet.arkiv.network
  schemaName: string; // receipts-ethglobal-mumbai.receipt.v2
  trustedWriters: string[]; // Arkiv creators whose entities count ([] = any)
  windowDays: number; // weeks that ended in the last N days
  maxPrChecks: number; // GitHub calls per run, at most what is left of CRE's 15 HTTP calls after Arkiv
};

/** One HTTP call, answered synchronously (CRE's node mode, or curl in the local check). */
export type Fetch = (req: { url: string; method: "GET" | "POST"; body?: string; headers: Record<string, string> }) => { status: number; body: string };

/** What each node reports. Consensus takes the median of every field. */
export type TeamScore = {
  receipts: number; // signed weeks counted
  people: number; // different people among them
  rejected: number; // receipts dropped because the signature did not check out
  spendCents: number;
  done: number; // things done (items that were not Wasted)
  wastedCents: number; // spend on Wasted items
  mergedPrs: number; // merged PRs, as signed by each person
  prsChecked: number; // shipped changes this run asked GitHub about: merged PRs and pushes to main
  prsStillMerged: number; // of those, still merged (PRs) or still in main's history (pushes)
};

// ---------- the signed receipt (same EIP-712 types as web/src/lib/receipts/receipt.ts) ----------

const V2_FIELDS = [
  { name: "owner", type: "address" },
  { name: "author", type: "string" },
  { name: "period", type: "string" },
  { name: "periodStart", type: "uint64" },
  { name: "periodEnd", type: "uint64" },
  { name: "sessions", type: "uint32" },
  { name: "spendCents", type: "uint64" },
  { name: "done", type: "uint32" },
  { name: "categories", type: "uint32[7]" },
  { name: "categorySpendCents", type: "uint64[7]" },
  { name: "mergedPrs", type: "uint32" },
  { name: "tools", type: "string[]" },
  { name: "toolSpendCents", type: "uint64[]" },
  { name: "itemsRoot", type: "bytes32" },
  { name: "evidenceRoot", type: "bytes32" },
  { name: "judgeRoot", type: "bytes32" },
  { name: "judge", type: "string" },
] as const;
const V3_FIELDS = [
  ...V2_FIELDS,
  { name: "stageMinutes", type: "uint32[5]" },
  { name: "stageCounts", type: "uint16[5]" },
  { name: "brainstormMinutes", type: "uint32" },
  { name: "prCounts", type: "uint16[5]" },
  { name: "wasteCounts", type: "uint16[5]" },
  { name: "wasteCents", type: "uint64[5]" },
  { name: "spendSplitCents", type: "uint64[4]" },
] as const;
const WASTED = 6; // Built, Fixed, Figured out, Researched, Wrote, Planned, Wasted

type JsonMessage = Record<string, unknown> & {
  owner: string;
  period: string;
  periodEnd: string;
  spendCents: string;
  done: number;
  categorySpendCents: string[];
  mergedPrs: number;
};
type Receipt = {
  kind: "receipts.v3" | "receipts.v2";
  message: JsonMessage;
  signature: Hex;
  evidence?: { url: string; state: string; reverted: boolean }[];
};

const UINT64 = new Set(["uint64", "uint64[7]", "uint64[5]", "uint64[4]", "uint64[]"]);

/** The address that signed this receipt, or undefined if the signature does not parse. */
export function receiptSigner(r: Receipt): string | undefined {
  const fields = r.kind === "receipts.v2" ? V2_FIELDS : V3_FIELDS;
  const message: Record<string, unknown> = {};
  const defaults: Record<string, unknown> = { author: "", tools: [], toolSpendCents: [] };
  for (const f of fields) {
    const v = r.message[f.name] ?? defaults[f.name];
    if (v === undefined) return undefined;
    message[f.name] = !UINT64.has(f.type) ? v : Array.isArray(v) ? v.map((x) => BigInt(x as string)) : BigInt(v as string);
  }
  const digest = hashTypedData({
    domain: { name: "Receipts", version: r.kind === "receipts.v2" ? "2" : "3" },
    types: { Receipt: fields as unknown as { name: string; type: string }[] },
    primaryType: "Receipt",
    message,
  });
  const sig = r.signature?.replace(/^0x/, "");
  if (!sig || sig.length !== 130) return undefined;
  const v = parseInt(sig.slice(128, 130), 16);
  const bit = v >= 27 ? v - 27 : v;
  if (bit !== 0 && bit !== 1) return undefined;
  try {
    const point = secp256k1.Signature.fromCompact(sig.slice(0, 128)).addRecoveryBit(bit).recoverPublicKey(digest.slice(2));
    const pub = point.toRawBytes(false).slice(1);
    return `0x${keccak256(pub).slice(-40)}`;
  } catch {
    return undefined;
  }
}

// ---------- the check ----------

const PAGE = 30; // receipts per Arkiv call
const MAX_PAGES = 4;
const HTTP_BUDGET = 14; // CRE allows 15 HTTP calls per run; one is kept spare

type RpcEntity = { key: string; owner?: string; creator?: string; createdAt?: string; attributes?: { name: string; type: string; value: string }[] };

export function checkTeam(fetch: Fetch, cfg: CheckConfig, secrets: { arkivAccessKey?: string; githubToken?: string }, nowSec: number): TeamScore {
  // 1. The team's receipts, from Arkiv. The access key is the last part of the RPC address.
  // Sorted by key, so the pages line up (without an order, the node's own order can repeat or skip rows).
  const query = `arkiv.schema = str('${cfg.schemaName}') AND type = str('receipt') AND team = str('${cfg.teamId}') ORDER BY $key:key ASC`;
  const url = secrets.arkivAccessKey ? `${cfg.arkivRpcUrl.replace(/\/$/, "")}/${encodeURIComponent(secrets.arkivAccessKey)}` : cfg.arkivRpcUrl;
  // In pages: CRE caps one HTTP response at 250 KB, and a receipt's payload is about 6 KB.
  const rows: RpcEntity[] = [];
  let calls = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = fetch({
      url,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "arkiv_query",
        params: [
          query,
          { select: { key: true, owner: true, creator: true, createdAt: true, attributes: { payload: true } }, limit: `0x${PAGE.toString(16)}`, offset: `0x${(page * PAGE).toString(16)}` },
        ],
      }),
    });
    calls++;
    if (res.status < 200 || res.status > 299) throw new Error(`Arkiv answered ${res.status}`);
    const answer = JSON.parse(res.body) as { result?: { data?: RpcEntity[] }; error?: { message?: string } };
    if (answer.error) throw new Error(`Arkiv refused the query: ${answer.error.message ?? "unknown error"}`);
    const data = answer.result?.data ?? [];
    rows.push(...data);
    if (data.length < PAGE) break;
  }

  // 2 and 3. Window, writer, signature; one receipt per person per week, the one written last.
  const trusted = cfg.trustedWriters.map((a) => a.toLowerCase());
  const from = nowSec - cfg.windowDays * 86400;
  const best: Record<string, { r: Receipt; createdAt: number }> = {};
  let rejected = 0;
  for (const row of rows) {
    if (trusted.length && !trusted.includes(String(row.creator ?? "").toLowerCase())) continue;
    const payload = row.attributes?.find((a) => a.name === "payload")?.value;
    if (!payload) continue;
    let r: Receipt;
    try {
      r = JSON.parse(hexToString(payload as Hex)) as Receipt;
    } catch {
      continue;
    }
    const end = Number(r.message?.periodEnd ?? 0);
    if (end < from || end > nowSec + 7 * 86400) continue;
    const signer = receiptSigner(r);
    if (!signer || signer !== String(r.message.owner).toLowerCase()) {
      rejected++;
      continue;
    }
    const key = `${signer}|${r.message.period}`;
    const createdAt = Number(row.createdAt ?? 0);
    if (!best[key] || createdAt > best[key].createdAt) best[key] = { r, createdAt };
  }
  const keys = Object.keys(best).sort(); // the same order on every node
  const receipts = keys.map((k) => best[k].r);

  // 4. Totals, from signed fields only.
  let spendCents = 0;
  let done = 0;
  let wastedCents = 0;
  let mergedPrs = 0;
  const people: Record<string, true> = {};
  for (const r of receipts) {
    people[r.message.owner.toLowerCase()] = true;
    spendCents += Number(r.message.spendCents);
    done += Number(r.message.done);
    wastedCents += Number(r.message.categorySpendCents?.[WASTED] ?? 0);
    mergedPrs += Number(r.message.mergedPrs);
  }

  // 5. Is everything a receipt claims as shipped still shipped? Work ships two ways: a merged PR, or
  // a commit pushed straight to main with no PR. (Full receipts only: a sealed week's PRs and
  // commits are encrypted on Swarm for the company.)
  const shipped: string[] = []; // "pr owner/repo 12" or "commit owner/repo sha"
  for (const r of receipts) {
    for (const e of r.evidence ?? []) {
      if (e.reverted) continue;
      const pr = e.state === "merged" && e.url.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
      const commit = e.state === "direct" && e.url.match(/github\.com\/([^/]+\/[^/]+)\/commit\/([0-9a-f]{7,40})/);
      const key = pr ? `pr ${pr[1]} ${pr[2]}` : commit ? `commit ${commit[1]} ${commit[2]}` : undefined;
      if (key && !shipped.includes(key)) shipped.push(key);
    }
  }
  shipped.sort();
  let prsChecked = 0;
  let prsStillMerged = 0;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "receipts-cre-monthly" };
  if (secrets.githubToken) headers.Authorization = `Bearer ${secrets.githubToken}`;
  for (const item of shipped.slice(0, Math.max(0, Math.min(cfg.maxPrChecks, HTTP_BUDGET - calls)))) {
    const [type, repo, id] = item.split(" ");
    // A PR: is it still merged? A push to main: is the commit still in the default branch's history?
    // (Compare HEAD...sha: "behind" or "identical" means the default branch contains it. One commit
    // per page keeps the answer small.)
    const url = type === "pr" ? `https://api.github.com/repos/${repo}/pulls/${id}` : `https://api.github.com/repos/${repo}/compare/HEAD...${id}?per_page=1`;
    const gh = fetch({ url, method: "GET", headers });
    prsChecked++;
    if (gh.status < 200 || gh.status > 299) continue; // gone, private or made up: not confirmed
    const body = JSON.parse(gh.body) as { merged_at?: string | null; status?: string };
    if (type === "pr" ? !!body.merged_at : body.status === "behind" || body.status === "identical") prsStillMerged++;
  }

  return { receipts: receipts.length, people: Object.keys(people).length, rejected, spendCents, done, wastedCents, mergedPrs, prsChecked, prsStillMerged };
}

/** The report TeamScoreboard decodes (see contracts/src/TeamScoreboard.sol). */
export const REPORT_ABI =
  "bytes32 teamId, uint32 periodDay, uint32 receipts, uint32 people, uint32 rejected, uint64 spendCents, uint32 done, uint64 wastedCents, uint32 mergedPrs, uint16 prsChecked, uint16 prsStillMerged";
