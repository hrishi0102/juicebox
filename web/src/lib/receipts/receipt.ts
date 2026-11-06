// Signed weekly receipts (EIP-712), version 3: "what I got done this week", and how efficiently, signed.
// Version 3 adds the efficiency numbers (timeline medians, PR funnel, waste by reason, where the money
// went). Version 2 receipts (already shared on Arkiv) still verify with their own types.
//
// The signed message holds the week's numbers (spend, sessions, things done, items and spend per
// category, merged PRs, spend per AI tool) plus three Merkle roots:
//   itemsRoot     one leaf per item of the list (category, title, cost, linked PRs). The owner can
//                 reveal every item, or only some, each with a proof; the counts stay signed.
//   evidenceRoot  one leaf per pull request or commit (title, link, state, cost).
//   judgeRoot     one leaf per session the private AI read (category, difficulty, model, 0G request
//                 id, hashes of exactly what was sent and answered). Prompts are never in a leaf.
//
// The domain has no chainId on purpose: a receipt is not tied to one chain, and wallets refuse to
// sign typed data whose chainId differs from the connected chain.

import { encodeAbiParameters, hashTypedData, keccak256, recoverTypedDataAddress, stringToHex, type Address, type Hex, type TypedDataDefinition } from "viem";
import { headline } from "./score";
import { countLine } from "./story";
import { SPEND, STAGES, WASTE, type Efficiency, type Stage, type WasteKind } from "./efficiency";
import { CATEGORIES, type Category, type Judgement, type PeriodSummary, type Task, type WeekItem } from "./types";

export const RECEIPT_DOMAIN = { name: "Receipts", version: "3" } as const;
const RECEIPT_DOMAIN_V2 = { name: "Receipts", version: "2" } as const;

const V2_FIELDS = [
    { name: "owner", type: "address" },
    { name: "author", type: "string" }, // GitHub login when signed in, else ""
    { name: "period", type: "string" },
    { name: "periodStart", type: "uint64" },
    { name: "periodEnd", type: "uint64" },
    { name: "sessions", type: "uint32" },
    { name: "spendCents", type: "uint64" },
    { name: "done", type: "uint32" }, // items that were not Wasted
    { name: "categories", type: "uint32[7]" }, // items per category: Built, Fixed, Figured out, Researched, Wrote, Planned, Wasted
    { name: "categorySpendCents", type: "uint64[7]" }, // spend per category, same order
    { name: "mergedPrs", type: "uint32" },
    { name: "tools", type: "string[]" }, // AI tools used this period, e.g. ["claude-code","codex"]
    { name: "toolSpendCents", type: "uint64[]" }, // spend per tool, same order
    { name: "itemsRoot", type: "bytes32" },
    { name: "evidenceRoot", type: "bytes32" },
    { name: "judgeRoot", type: "bytes32" },
    { name: "judge", type: "string" },
] as const;

const RECEIPT_TYPES_V2 = { Receipt: V2_FIELDS } as const;

export const RECEIPT_TYPES = {
  Receipt: [
    ...V2_FIELDS,
    { name: "stageMinutes", type: "uint32[5]" }, // medians: idea to code, code to commit, commit to PR, PR to merge, idea to merged (4294967295 = none)
    { name: "stageCounts", type: "uint16[5]" }, // how many items each median is over
    { name: "brainstormMinutes", type: "uint32" }, // time with the AI before the first code edit
    { name: "prCounts", type: "uint16[5]" }, // opened, merged, open, closed, reverted
    { name: "wasteCounts", type: "uint16[5]" }, // plans nobody acted on, left on the AI's question, loops, never shipped, stopped answers
    { name: "wasteCents", type: "uint64[5]" }, // dollars for the same reasons
    { name: "spendSplitCents", type: "uint64[4]" }, // shipped, learning, in progress, wasted
  ],
} as const;

const NONE = 4294967295;

type Seven<T> = readonly [T, T, T, T, T, T, T];
type Five<T> = readonly [T, T, T, T, T];
type Four<T> = readonly [T, T, T, T];

export type ReceiptMessage = {
  owner: Address;
  author: string;
  period: string;
  periodStart: bigint;
  periodEnd: bigint;
  sessions: number;
  spendCents: bigint;
  done: number;
  categories: Seven<number>;
  categorySpendCents: Seven<bigint>;
  mergedPrs: number;
  tools: readonly string[];
  toolSpendCents: readonly bigint[];
  itemsRoot: Hex;
  evidenceRoot: Hex;
  judgeRoot: Hex;
  judge: string;
  // Version 3
  stageMinutes?: Five<number>;
  stageCounts?: Five<number>;
  brainstormMinutes?: number;
  prCounts?: Five<number>;
  wasteCounts?: Five<number>;
  wasteCents?: Five<bigint>;
  spendSplitCents?: Four<bigint>;
};

export type ItemLeaf = {
  category: Category;
  title: string;
  costCents: number;
  prs: string[]; // change keys, e.g. "acme/app#12"
  inProgress: boolean;
  leaf: Hex;
  proof?: Hex[]; // present when only some items are revealed
};

export type EvidenceLeaf = {
  changeKey: string;
  title: string; // PR or commit title, so the company can see what the work was
  url: string;
  state: string;
  reverted: boolean;
  survivalBps: number; // 10000 = 100%, 65535 = unknown
  costCents: number;
  difficulty: number;
  leaf: Hex;
};

export type JudgeLeaf = {
  sessionHash: Hex; // keccak256 of the session id, so leaves don't expose local ids
  category: string;
  difficulty: number;
  engine: string;
  model: string;
  provider: string;
  requestId: string;
  requestHash: Hex;
  responseHash: Hex;
  verified: boolean;
  leaf: Hex;
};

type JsonMessage = Omit<
  ReceiptMessage,
  "periodStart" | "periodEnd" | "spendCents" | "categorySpendCents" | "toolSpendCents" | "categories" | "stageMinutes" | "stageCounts" | "prCounts" | "wasteCounts" | "wasteCents" | "spendSplitCents"
> & {
  periodStart: string;
  periodEnd: string;
  spendCents: string;
  categories: number[];
  categorySpendCents: string[];
  toolSpendCents: string[];
  stageMinutes?: number[];
  stageCounts?: number[];
  prCounts?: number[];
  wasteCounts?: number[];
  wasteCents?: string[];
  spendSplitCents?: string[];
};

// JSON-friendly form (bigints as strings). This is what gets saved, shared and published.
export type SignedReceipt = {
  kind: "receipts.v3" | "receipts.v2";
  headline: string;
  oneLiner: string; // the AI's sentence about the week (not signed; the items are)
  message: JsonMessage;
  digest: Hex;
  signature?: Hex;
  signedAt?: string;
  items: ItemLeaf[];
  evidence: EvidenceLeaf[];
  judges: JudgeLeaf[];
  summary: { buckets: PeriodSummary["buckets"]; writtenBy: string; model?: string };
  // sealed = signed totals in public, the full week on Swarm encrypted for the company
  // `hidden` (local copy only): how many lines the owner kept private when sending; they still count in the totals
  share?: { level: "totals" | "full" | "sealed"; team: string; org?: string; arkivKey?: string; arkivTx?: string; publishedAt?: string; swarm?: string; hidden?: number };
};

const ZERO = ("0x" + "0".repeat(64)) as Hex;
const cents = (x: number) => BigInt(Math.round(x * 100));

export function itemLeaf(i: Pick<WeekItem, "category" | "title" | "costUsd" | "inProgress"> & { prs: { key: string }[] | string[] }): ItemLeaf {
  const prs = (i.prs as (string | { key: string })[]).map((p) => (typeof p === "string" ? p : p.key)).sort();
  const costCents = Math.round(i.costUsd * 100);
  const leaf = keccak256(
    encodeAbiParameters(
      [{ type: "string" }, { type: "string" }, { type: "uint64" }, { type: "string" }, { type: "bool" }],
      [i.category, i.title, BigInt(costCents), prs.join(","), i.inProgress],
    ),
  );
  return { category: i.category, title: i.title, costCents, prs, inProgress: i.inProgress, leaf };
}

export function evidenceLeaf(t: Pick<Task, "changeKey" | "title" | "url" | "state" | "reverted" | "survival" | "costUsd" | "difficulty">): EvidenceLeaf {
  const survivalBps = t.survival === null ? 65535 : Math.round(t.survival * 10000);
  const costCents = Math.round(t.costUsd * 100);
  const title = t.title ?? "";
  const leaf = keccak256(
    encodeAbiParameters(
      [{ type: "string" }, { type: "string" }, { type: "string" }, { type: "string" }, { type: "bool" }, { type: "uint16" }, { type: "uint64" }, { type: "uint8" }],
      [t.changeKey, title, t.url, t.state, t.reverted, survivalBps, BigInt(costCents), t.difficulty],
    ),
  );
  return { changeKey: t.changeKey, title, url: t.url, state: t.state, reverted: t.reverted, survivalBps, costCents, difficulty: t.difficulty, leaf };
}

export function judgeLeaf(j: Judgement): JudgeLeaf {
  const base = {
    sessionHash: keccak256(stringToHex(j.sessionId)),
    category: j.category ?? j.label,
    difficulty: j.difficulty,
    engine: j.judge.engine,
    model: j.judge.model ?? "",
    provider: j.judge.provider ?? "",
    requestId: j.judge.requestId ?? j.judge.chatId ?? "",
    requestHash: (j.judge.requestHash as Hex) ?? ZERO,
    responseHash: (j.judge.responseHash as Hex) ?? ZERO,
    verified: !!j.judge.verified,
  };
  return { ...base, leaf: judgeLeafHash(base) };
}

function judgeLeafHash(b: Omit<JudgeLeaf, "leaf">): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "string" }, { type: "uint8" }, { type: "string" }, { type: "string" }, { type: "string" }, { type: "string" }, { type: "bytes32" }, { type: "bytes32" }, { type: "bool" }],
      [b.sessionHash, b.category, b.difficulty, b.engine, b.model, b.provider, b.requestId, b.requestHash, b.responseHash, b.verified],
    ),
  );
}

/** Sorted-pair Merkle tree (same rule as OpenZeppelin MerkleProof). */
export function merkleRoot(leaves: Hex[]): Hex {
  if (!leaves.length) return ZERO;
  let level = [...leaves].sort();
  while (level.length > 1) {
    const next: Hex[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? hashPair(level[i], level[i + 1]) : level[i]);
    level = next;
  }
  return level[0];
}

export function merkleProof(leaves: Hex[], leaf: Hex): Hex[] {
  let level = [...leaves].sort();
  let idx = level.indexOf(leaf);
  if (idx < 0) return [];
  const proof: Hex[] = [];
  while (level.length > 1) {
    const sib = idx ^ 1;
    if (sib < level.length) proof.push(level[sib]);
    const next: Hex[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? hashPair(level[i], level[i + 1]) : level[i]);
    idx = Math.floor(idx / 2);
    level = next;
  }
  return proof;
}

export function verifyProof(root: Hex, leaf: Hex, proof: Hex[]) {
  let h = leaf;
  for (const p of proof) h = hashPair(h, p);
  return h === root;
}

function hashPair(a: Hex, b: Hex): Hex {
  return a.toLowerCase() < b.toLowerCase() ? keccak256(((a as string) + (b as string).slice(2)) as Hex) : keccak256(((b as string) + (a as string).slice(2)) as Hex);
}

/** Short description of who wrote the list, signed into the receipt. */
export function judgeLabel(judgements: Judgement[], story: PeriodSummary["story"]) {
  const ai = judgements.filter((j) => j.judge.engine === "0g-tee");
  if (story.engine === "0g-tee" || ai.length) return `0g-private-computer:${story.model ?? ai[0]?.judge.model ?? ""}:${ai.length}/${judgements.length}`;
  if (story.engine === "openai-compatible") return `openai-compatible:${story.model ?? ""}`;
  return "rules";
}

/** `judgements` must be the judgements for the sessions inside the period. */
export function buildReceipt(opts: { owner: Address; author?: string; periodId: string; summary: PeriodSummary; judgements: Judgement[] }): SignedReceipt {
  const { summary: s } = opts;
  const items = s.items.map(itemLeaf);
  const evidence = s.tasks.map(evidenceLeaf);
  const judges = opts.judgements.filter((j) => j.judge.engine !== "heuristic").map(judgeLeaf);
  const tools = Object.keys(s.toolSpend ?? {}).sort();
  const message: ReceiptMessage = {
    owner: opts.owner,
    author: opts.author ?? "",
    period: opts.periodId,
    periodStart: BigInt(Math.floor(Date.parse(s.periodStart) / 1000)),
    periodEnd: BigInt(Math.floor(Date.parse(s.periodEnd) / 1000)),
    sessions: s.sessions,
    spendCents: cents(s.spendUsd),
    done: s.items.filter((i) => i.category !== "Wasted").length,
    categories: CATEGORIES.map((c) => s.categoryCounts[c] ?? 0) as unknown as Seven<number>,
    categorySpendCents: CATEGORIES.map((c) => cents(s.categorySpend[c] ?? 0)) as unknown as Seven<bigint>,
    mergedPrs: s.tasks.filter((t) => (t.state === "merged" || t.state === "direct") && !t.reverted).length,
    tools,
    toolSpendCents: tools.map((t) => cents(s.toolSpend[t])),
    itemsRoot: merkleRoot(items.map((i) => i.leaf)),
    evidenceRoot: merkleRoot(evidence.map((e) => e.leaf)),
    judgeRoot: merkleRoot(judges.map((j) => j.leaf)),
    judge: judgeLabel(opts.judgements, s.story),
    ...efficiencyFields(s),
  };
  return {
    kind: "receipts.v3",
    headline: headline(s),
    oneLiner: s.oneLiner,
    message: toJsonMessage(message),
    digest: receiptDigest(message),
    items,
    evidence,
    judges,
    summary: {
      buckets: s.buckets,
      writtenBy: s.story.engine === "0g-tee" ? `0G private AI${s.story.verified ? ", TEE verified" : ""}` : s.story.engine === "openai-compatible" ? "local AI model" : "simple rules",
      model: s.story.model,
    },
  };
}

/** The efficiency numbers, as signed fields. */
function efficiencyFields(s: PeriodSummary) {
  const e = s.efficiency;
  const st = (k: Stage) => e?.stages[k];
  return {
    stageMinutes: STAGES.map((k) => (st(k)?.medianMin ?? null) === null ? NONE : Math.min(NONE - 1, st(k)!.medianMin!)) as unknown as Five<number>,
    stageCounts: STAGES.map((k) => Math.min(65535, st(k)?.n ?? 0)) as unknown as Five<number>,
    brainstormMinutes: Math.min(NONE - 1, Math.round(e?.brainstormMinutes ?? 0)),
    prCounts: [e?.prs.opened ?? 0, e?.prs.merged ?? 0, e?.prs.open ?? 0, e?.prs.closed ?? 0, e?.prs.reverted ?? 0].map((n) => Math.min(65535, n)) as unknown as Five<number>,
    wasteCounts: WASTE.map((k) => Math.min(65535, e?.waste[k].count ?? 0)) as unknown as Five<number>,
    wasteCents: WASTE.map((k) => cents(e?.waste[k].usd ?? 0)) as unknown as Five<bigint>,
    spendSplitCents: SPEND.map((k) => cents(e?.spend[k] ?? 0)) as unknown as Four<bigint>,
  };
}

export function toJsonMessage(full: ReceiptMessage): JsonMessage {
  const { stageMinutes, stageCounts, prCounts, wasteCounts, wasteCents, spendSplitCents, ...m } = full;
  return {
    ...m,
    periodStart: m.periodStart.toString(),
    periodEnd: m.periodEnd.toString(),
    spendCents: m.spendCents.toString(),
    categories: [...m.categories],
    categorySpendCents: m.categorySpendCents.map((x) => x.toString()),
    toolSpendCents: m.toolSpendCents.map((x) => x.toString()),
    ...(stageMinutes
      ? {
          stageMinutes: [...stageMinutes],
          stageCounts: [...stageCounts!],
          prCounts: [...prCounts!],
          wasteCounts: [...wasteCounts!],
          wasteCents: wasteCents!.map((x) => x.toString()),
          spendSplitCents: spendSplitCents!.map((x) => x.toString()),
        }
      : {}),
  };
}

export function fromJsonMessage(m: JsonMessage): ReceiptMessage {
  return {
    ...m,
    author: m.author ?? "",
    periodStart: BigInt(m.periodStart),
    periodEnd: BigInt(m.periodEnd),
    spendCents: BigInt(m.spendCents),
    categories: [...m.categories] as unknown as Seven<number>,
    categorySpendCents: m.categorySpendCents.map((x) => BigInt(x)) as unknown as Seven<bigint>,
    tools: m.tools ?? [],
    toolSpendCents: (m.toolSpendCents ?? []).map((x) => BigInt(x)),
    stageMinutes: m.stageMinutes as unknown as Five<number> | undefined,
    stageCounts: m.stageCounts as unknown as Five<number> | undefined,
    prCounts: m.prCounts as unknown as Five<number> | undefined,
    wasteCounts: m.wasteCounts as unknown as Five<number> | undefined,
    wasteCents: m.wasteCents?.map((x) => BigInt(x)) as unknown as Five<bigint> | undefined,
    spendSplitCents: m.spendSplitCents?.map((x) => BigInt(x)) as unknown as Four<bigint> | undefined,
  };
}

/** The v2 fields only, for verifying receipts made before version 3. */
function v2Message(m: ReceiptMessage): ReceiptMessage {
  const out: Record<string, unknown> = {};
  for (const f of V2_FIELDS) out[f.name] = (m as unknown as Record<string, unknown>)[f.name];
  return out as unknown as ReceiptMessage;
}

/** Numbers taken only from the signed message (the `summary` block is not signed). */
export function signedNumbers(r: SignedReceipt) {
  const m = r.message;
  const spendUsd = Number(m.spendCents) / 100;
  const categoryCounts = Object.fromEntries(CATEGORIES.map((c, i) => [c, m.categories[i] ?? 0])) as Record<Category, number>;
  const categorySpend = Object.fromEntries(CATEGORIES.map((c, i) => [c, Number(m.categorySpendCents[i] ?? 0) / 100])) as Record<Category, number>;
  return {
    spendUsd,
    sessions: m.sessions,
    done: m.done,
    mergedPrs: m.mergedPrs,
    categoryCounts,
    categorySpend,
    wasteUsd: categorySpend.Wasted,
    toolSpend: Object.fromEntries((m.tools ?? []).map((t, i) => [t, Number(m.toolSpendCents?.[i] ?? 0) / 100])) as Record<string, number>,
    author: m.author,
    efficiency: signedEfficiency(m),
  };
}

export type EfficiencyView = Pick<Efficiency, "stages" | "brainstormMinutes" | "prs" | "spend" | "costPerMergedPr"> & {
  waste: Record<WasteKind, { count: number; usd: number }>;
};

/** Efficiency numbers from a signed v3 message (undefined for v2 receipts). */
function signedEfficiency(m: JsonMessage): EfficiencyView | undefined {
  if (!m.stageMinutes || !m.stageCounts || !m.prCounts || !m.wasteCounts || !m.wasteCents || !m.spendSplitCents) return undefined;
  const stages = Object.fromEntries(STAGES.map((k, i) => [k, { medianMin: m.stageMinutes![i] === NONE ? null : m.stageMinutes![i], n: m.stageCounts![i] }])) as Efficiency["stages"];
  const waste = Object.fromEntries(WASTE.map((k, i) => [k, { count: m.wasteCounts![i], usd: Number(m.wasteCents![i]) / 100 }])) as EfficiencyView["waste"];
  const spend = Object.fromEntries(SPEND.map((k, i) => [k, Number(m.spendSplitCents![i]) / 100])) as Efficiency["spend"];
  const [opened, merged, open, closed, reverted] = m.prCounts;
  return { stages, brainstormMinutes: m.brainstormMinutes ?? 0, prs: { opened, merged, open, closed, reverted }, waste, spend, costPerMergedPr: merged ? Math.round((spend.shipped / merged) * 100) / 100 : null };
}

/** Items as the week list shows them, from the revealed (and checked) item leaves. */
export function receiptItems(r: SignedReceipt): WeekItem[] {
  const byKey = new Map(r.evidence.map((e) => [e.changeKey, e]));
  return r.items.map((i, n) => ({
    id: `i-${n}`,
    category: i.category,
    title: i.title,
    inProgress: i.inProgress,
    sessions: [],
    costUsd: i.costCents / 100,
    prs: i.prs.map((k) => {
      const e = byKey.get(k);
      return { key: k, url: e?.url ?? "", title: e?.title ?? k, state: e?.state ?? "", reverted: !!e?.reverted };
    }),
    tools: [],
  }));
}

/** A period summary for pages, built only from signed fields and revealed items. */
export function summaryFromReceipt(r: SignedReceipt): PeriodSummary {
  const n = signedNumbers(r);
  const items = receiptItems(r);
  const labelZero = { Shipped: 0, Learned: 0, Looped: 0, Abandoned: 0, Overkill: 0, Pending: 0 };
  return {
    owner: r.message.owner,
    periodStart: new Date(Number(r.message.periodStart) * 1000).toISOString(),
    periodEnd: new Date(Number(r.message.periodEnd) * 1000).toISOString(),
    sessions: n.sessions,
    spendUsd: n.spendUsd,
    shippedTasks: n.mergedPrs,
    survivalPct: null,
    keptWork: 0,
    keptWorkPer100Usd: null,
    labelCounts: labelZero,
    labelSpend: { ...labelZero },
    wasteUsd: n.wasteUsd,
    wastePct: n.spendUsd > 0 ? (n.wasteUsd / n.spendUsd) * 100 : 0,
    toolSpend: n.toolSpend,
    toolSessions: {},
    items,
    categoryCounts: n.categoryCounts,
    categorySpend: n.categorySpend,
    oneLiner: r.oneLiner || countLine(items),
    countLine: countLine(items),
    story: { engine: r.message.judge.startsWith("0g") ? "0g-tee" : r.message.judge.startsWith("openai") ? "openai-compatible" : "rules", model: r.summary.model, requestIds: r.judges.map((j) => j.requestId).filter(Boolean), stale: false, newSessions: 0 },
    efficiency: n.efficiency ? { ...n.efficiency, waste: Object.fromEntries(WASTE.map((k) => [k, { ...n.efficiency!.waste[k], sessions: [] as string[] }])) as unknown as Efficiency["waste"], items: {} } : undefined,
    buckets: r.summary.buckets,
    tasks: r.evidence.map((e) => ({
      changeKey: e.changeKey,
      repo: e.changeKey.split(/[#@]/)[0],
      url: e.url,
      title: e.title,
      kind: "other",
      difficulty: e.difficulty,
      state: e.state as Task["state"],
      reverted: e.reverted,
      survival: e.survivalBps === 65535 ? null : e.survivalBps / 10000,
      survivalMatured: false,
      costUsd: e.costCents / 100,
      totalCostUsd: e.costCents / 100,
      costBySession: {},
      sessions: [],
      keptWork: 0,
    })),
    tips: [],
  };
}

export function receiptDigest(m: ReceiptMessage, kind: SignedReceipt["kind"] = "receipts.v3"): Hex {
  if (kind === "receipts.v2") return hashTypedData({ domain: RECEIPT_DOMAIN_V2, types: RECEIPT_TYPES_V2, primaryType: "Receipt", message: v2Message(m) });
  return hashTypedData({ domain: RECEIPT_DOMAIN, types: RECEIPT_TYPES, primaryType: "Receipt", message: m as Required<ReceiptMessage> });
}

export function typedDataFor(r: SignedReceipt): TypedDataDefinition {
  const m = fromJsonMessage(r.message);
  if (r.kind === "receipts.v2") return { domain: RECEIPT_DOMAIN_V2, types: RECEIPT_TYPES_V2, primaryType: "Receipt", message: v2Message(m) } as unknown as TypedDataDefinition;
  return { domain: RECEIPT_DOMAIN, types: RECEIPT_TYPES, primaryType: "Receipt", message: m } as unknown as TypedDataDefinition;
}

export type VerifyResult = {
  ok: boolean;
  signer?: Address;
  checks: { name: string; ok: boolean; detail?: string }[];
};

/** Check the signature, the digest, and every Merkle root of a receipt. */
export async function verifyReceipt(r: SignedReceipt): Promise<VerifyResult> {
  const checks: VerifyResult["checks"] = [];
  if (r.kind !== "receipts.v3" && r.kind !== "receipts.v2") return { ok: false, checks: [{ name: "Receipt format", ok: false, detail: `Unknown format ${String(r.kind)}` }] };
  let m: ReceiptMessage;
  let digest: Hex;
  try {
    m = fromJsonMessage(r.message);
    if (r.kind === "receipts.v3" && !m.stageMinutes) throw new Error("Version 3 receipt without its efficiency fields");
    digest = receiptDigest(m, r.kind);
  } catch (e) {
    // Malformed or out-of-range fields: not a valid receipt, never a crash.
    return { ok: false, checks: [{ name: "Receipt fields are well formed", ok: false, detail: String(e instanceof Error ? e.message : e).slice(0, 160) }] };
  }
  checks.push({ name: "Digest matches the receipt fields", ok: digest === r.digest });
  let signer: Address | undefined;
  if (r.signature) {
    try {
      signer = await recoverTypedDataAddress({ ...typedDataFor(r), signature: r.signature });
      checks.push({ name: "Signed by the owner", ok: signer.toLowerCase() === m.owner.toLowerCase(), detail: signer });
    } catch (e) {
      checks.push({ name: "Signed by the owner", ok: false, detail: String(e).slice(0, 120) });
    }
  } else checks.push({ name: "Signed by the owner", ok: false, detail: "No signature" });

  // Items: recompute every revealed leaf. All revealed: rebuild the root. Some hidden: check proofs.
  const total = m.categories.reduce((a, b) => a + b, 0);
  const leavesOk = r.items.every((i) => itemLeaf({ category: i.category, title: i.title, costUsd: i.costCents / 100, inProgress: i.inProgress, prs: i.prs }).leaf === i.leaf);
  if (r.items.length === total) {
    checks.push({ name: "Every item matches the signed list", ok: leavesOk && merkleRoot(r.items.map((i) => i.leaf)) === m.itemsRoot });
  } else {
    const proofsOk = r.items.every((i) => !!i.proof && verifyProof(m.itemsRoot, i.leaf, i.proof));
    checks.push({ name: "Shown items are in the signed list", ok: leavesOk && proofsOk, detail: `${r.items.length} of ${total} items shown` });
  }

  if (r.evidence.length) {
    const evOk = r.evidence.every((e) => evidenceLeaf({ ...e, survival: e.survivalBps === 65535 ? null : e.survivalBps / 10000, costUsd: e.costCents / 100, state: e.state as Task["state"] }).leaf === e.leaf);
    checks.push({ name: "Pull requests match the signed list", ok: evOk && merkleRoot(r.evidence.map((e) => e.leaf)) === m.evidenceRoot });
  } else if (m.evidenceRoot !== ZERO)
    checks.push({ name: "Pull requests match the signed list", ok: true, detail: r.share?.level === "sealed" ? "Pull requests are in the encrypted copy on Swarm" : "Pull requests not shared (totals only)" });
  if (r.judges.length) {
    const jOk = r.judges.every((j) => judgeLeafHash(j) === j.leaf);
    checks.push({ name: "Private AI records match their Merkle root", ok: jOk && merkleRoot(r.judges.map((j) => j.leaf)) === m.judgeRoot });
  }
  return { ok: checks.every((c) => c.ok), signer, checks };
}

/** Keep only some items, each with a proof against the signed root. Counts and spend stay signed. */
export function revealItems(r: SignedReceipt, keep: (i: ItemLeaf, index: number) => boolean): SignedReceipt {
  const all = r.items.map((i) => i.leaf);
  const shown = r.items.filter(keep);
  if (shown.length === r.items.length) return r;
  return { ...r, items: shown.map((i) => ({ ...i, proof: merkleProof(all, i.leaf) })) };
}

/** What gets published when the owner shares "totals only": no items, no PRs, no AI records. */
export function totalsOnly(r: SignedReceipt): SignedReceipt {
  return { ...revealItems(r, () => false), evidence: [], judges: [] };
}
