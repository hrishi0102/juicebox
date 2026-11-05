// Signed weekly receipts (EIP-712).
//
// The receipt holds headline numbers plus two Merkle roots:
//   evidenceRoot  one leaf per task (PR URL, state, survival, cost). The owner can later reveal
//                 single tasks with a proof, without showing the rest.
//   judgeRoot     one leaf per judged session (label, difficulty, hash of what the judge saw, hash of
//                 its answer, 0G provider and request id). Prompts are never part of a leaf.
//
// The domain has no chainId on purpose: a receipt is not tied to one chain, and wallets refuse to
// sign typed data whose chainId differs from the connected chain.

import { encodeAbiParameters, hashTypedData, keccak256, recoverTypedDataAddress, stringToHex, type Address, type Hex } from "viem";
import { headline } from "./score";
import type { Judgement, PeriodSummary, Task } from "./types";

export const RECEIPT_DOMAIN = { name: "Receipts", version: "1" } as const;

export const RECEIPT_TYPES = {
  Receipt: [
    { name: "owner", type: "address" },
    { name: "period", type: "string" },
    { name: "periodStart", type: "uint64" },
    { name: "periodEnd", type: "uint64" },
    { name: "sessions", type: "uint32" },
    { name: "spendCents", type: "uint64" },
    { name: "shippedTasks", type: "uint32" },
    { name: "survivalBps", type: "uint16" },
    { name: "keptWorkMilli", type: "uint32" },
    { name: "wasteBps", type: "uint16" },
    { name: "labels", type: "uint32[6]" }, // Shipped, Learned, Looped, Abandoned, Overkill, Pending
    { name: "labelSpendCents", type: "uint64[6]" }, // spend per label, same order
    { name: "evidenceRoot", type: "bytes32" },
    { name: "judgeRoot", type: "bytes32" },
    { name: "judge", type: "string" },
  ],
} as const;

export type ReceiptMessage = {
  owner: Address;
  period: string;
  periodStart: bigint;
  periodEnd: bigint;
  sessions: number;
  spendCents: bigint;
  shippedTasks: number;
  survivalBps: number;
  keptWorkMilli: number;
  wasteBps: number;
  labels: readonly [number, number, number, number, number, number];
  labelSpendCents: readonly [bigint, bigint, bigint, bigint, bigint, bigint];
  evidenceRoot: Hex;
  judgeRoot: Hex;
  judge: string;
};

export type EvidenceLeaf = {
  changeKey: string;
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
  label: string;
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

// JSON-friendly form (bigints as strings). This is what gets saved, shared and published.
export type SignedReceipt = {
  kind: "receipts.v1";
  headline: string;
  message: Omit<ReceiptMessage, "periodStart" | "periodEnd" | "spendCents" | "labelSpendCents"> & {
    periodStart: string;
    periodEnd: string;
    spendCents: string;
    labelSpendCents: string[];
  };
  digest: Hex;
  signature?: Hex;
  signedAt?: string;
  evidence: EvidenceLeaf[];
  judges: JudgeLeaf[];
  summary: {
    spendUsd: number;
    shippedTasks: number;
    survivalPct: number | null;
    keptWork: number;
    keptWorkPer100Usd: number | null;
    wastePct: number;
    buckets: PeriodSummary["buckets"];
  };
  share?: { level: "totals" | "full"; team: string; arkivKey?: string; arkivTx?: string; publishedAt?: string };
};

const ZERO = ("0x" + "0".repeat(64)) as Hex;

export function evidenceLeaf(t: Task): EvidenceLeaf {
  const survivalBps = t.survival === null ? 65535 : Math.round(t.survival * 10000);
  const costCents = Math.round(t.costUsd * 100);
  const leaf = keccak256(
    encodeAbiParameters(
      [{ type: "string" }, { type: "string" }, { type: "string" }, { type: "bool" }, { type: "uint16" }, { type: "uint64" }, { type: "uint8" }],
      [t.changeKey, t.url, t.state, t.reverted, survivalBps, BigInt(costCents), t.difficulty],
    ),
  );
  return { changeKey: t.changeKey, url: t.url, state: t.state, reverted: t.reverted, survivalBps, costCents, difficulty: t.difficulty, leaf };
}

export function judgeLeaf(j: Judgement): JudgeLeaf {
  const sessionHash = keccak256(stringToHex(j.sessionId));
  const base = {
    sessionHash,
    label: j.label,
    difficulty: j.difficulty,
    engine: j.judge.engine,
    model: j.judge.model ?? "",
    provider: j.judge.provider ?? "",
    requestId: j.judge.requestId ?? j.judge.chatId ?? "",
    requestHash: (j.judge.requestHash as Hex) ?? ZERO,
    responseHash: (j.judge.responseHash as Hex) ?? ZERO,
    verified: !!j.judge.verified,
  };
  const leaf = keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "string" }, { type: "uint8" }, { type: "string" }, { type: "string" }, { type: "string" }, { type: "string" }, { type: "bytes32" }, { type: "bytes32" }, { type: "bool" }],
      [base.sessionHash, base.label, base.difficulty, base.engine, base.model, base.provider, base.requestId, base.requestHash, base.responseHash, base.verified],
    ),
  );
  return { ...base, leaf };
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

export function judgeLabel(judgements: Judgement[]) {
  const engines = new Set(judgements.map((j) => j.judge.engine));
  if (engines.has("0g-tee")) {
    const model = judgements.find((j) => j.judge.engine === "0g-tee")?.judge.model ?? "";
    const n = judgements.filter((j) => j.judge.engine === "0g-tee").length;
    return `0g-private-computer:${model}:${n}/${judgements.length}`;
  }
  if (engines.has("openai-compatible")) return `openai-compatible:${judgements[0]?.judge.model ?? ""}`;
  return "heuristic";
}

/** `judgements` must be the judgements for the sessions inside the period. */
export function buildReceipt(opts: { owner: Address; periodId: string; summary: PeriodSummary; judgements: Judgement[] }): SignedReceipt {
  const { summary } = opts;
  const evidence = summary.tasks.map(evidenceLeaf);
  const judged = opts.judgements;
  const judges = judged.map(judgeLeaf);
  const lc = summary.labelCounts;
  const ls = summary.labelSpend;
  const cents = (x: number) => BigInt(Math.round(x * 100));
  const message: ReceiptMessage = {
    owner: opts.owner,
    period: opts.periodId,
    periodStart: BigInt(Math.floor(Date.parse(summary.periodStart) / 1000)),
    periodEnd: BigInt(Math.floor(Date.parse(summary.periodEnd) / 1000)),
    sessions: summary.sessions,
    spendCents: BigInt(Math.round(summary.spendUsd * 100)),
    shippedTasks: summary.shippedTasks,
    survivalBps: summary.survivalPct === null ? 65535 : Math.round(summary.survivalPct * 100),
    keptWorkMilli: Math.round(summary.keptWork * 1000),
    wasteBps: Math.round(summary.wastePct * 100),
    labels: [lc.Shipped, lc.Learned, lc.Looped, lc.Abandoned, lc.Overkill, lc.Pending] as const,
    labelSpendCents: [cents(ls.Shipped), cents(ls.Learned), cents(ls.Looped), cents(ls.Abandoned), cents(ls.Overkill), cents(ls.Pending)] as const,
    evidenceRoot: merkleRoot(evidence.map((e) => e.leaf)),
    judgeRoot: merkleRoot(judges.map((j) => j.leaf)),
    judge: judgeLabel(judged),
  };
  return {
    kind: "receipts.v1",
    headline: headline(summary),
    message: toJsonMessage(message),
    digest: receiptDigest(message),
    evidence,
    judges,
    summary: {
      spendUsd: summary.spendUsd,
      shippedTasks: summary.shippedTasks,
      survivalPct: summary.survivalPct,
      keptWork: summary.keptWork,
      keptWorkPer100Usd: summary.keptWorkPer100Usd,
      wastePct: summary.wastePct,
      buckets: summary.buckets,
    },
  };
}

export function toJsonMessage(m: ReceiptMessage): SignedReceipt["message"] {
  return {
    ...m,
    periodStart: m.periodStart.toString(),
    periodEnd: m.periodEnd.toString(),
    spendCents: m.spendCents.toString(),
    labelSpendCents: m.labelSpendCents.map((x) => x.toString()),
  };
}

export function fromJsonMessage(m: SignedReceipt["message"]): ReceiptMessage {
  return {
    ...m,
    periodStart: BigInt(m.periodStart),
    periodEnd: BigInt(m.periodEnd),
    spendCents: BigInt(m.spendCents),
    labels: [...m.labels] as unknown as ReceiptMessage["labels"],
    labelSpendCents: (m.labelSpendCents ?? ["0", "0", "0", "0", "0", "0"]).map((x) => BigInt(x)) as unknown as ReceiptMessage["labelSpendCents"],
  };
}

/** Headline numbers taken only from the signed message (the `summary` block is not signed). */
export function signedNumbers(r: SignedReceipt) {
  const m = r.message;
  const spendUsd = Number(m.spendCents) / 100;
  const order = ["Shipped", "Learned", "Looped", "Abandoned", "Overkill", "Pending"] as const;
  return {
    spendUsd,
    sessions: m.sessions,
    shippedTasks: m.shippedTasks,
    survivalPct: m.survivalBps === 65535 ? null : m.survivalBps / 100,
    keptWork: m.keptWorkMilli / 1000,
    wastePct: m.wasteBps / 100,
    wasteUsd: (spendUsd * m.wasteBps) / 10000,
    labelCounts: Object.fromEntries(order.map((l, i) => [l, m.labels[i] ?? 0])) as Record<(typeof order)[number], number>,
    labelSpend: Object.fromEntries(order.map((l, i) => [l, Number(m.labelSpendCents?.[i] ?? 0) / 100])) as Record<(typeof order)[number], number>,
  };
}

export function receiptDigest(m: ReceiptMessage): Hex {
  return hashTypedData({ domain: RECEIPT_DOMAIN, types: RECEIPT_TYPES, primaryType: "Receipt", message: m });
}

export function typedDataFor(r: SignedReceipt) {
  return { domain: RECEIPT_DOMAIN, types: RECEIPT_TYPES, primaryType: "Receipt" as const, message: fromJsonMessage(r.message) };
}

export type VerifyResult = {
  ok: boolean;
  signer?: Address;
  checks: { name: string; ok: boolean; detail?: string }[];
};

/** Check the signature, the digest, and both Merkle roots of a receipt. */
export async function verifyReceipt(r: SignedReceipt): Promise<VerifyResult> {
  const checks: VerifyResult["checks"] = [];
  const m = fromJsonMessage(r.message);
  const digest = receiptDigest(m);
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
  if (r.evidence.length) {
    const leavesOk = r.evidence.every((e) => evidenceLeaf({ changeKey: e.changeKey, url: e.url, state: e.state as Task["state"], reverted: e.reverted, survival: e.survivalBps === 65535 ? null : e.survivalBps / 10000, costUsd: e.costCents / 100, difficulty: e.difficulty } as Task).leaf === e.leaf);
    checks.push({ name: "Evidence matches its Merkle root", ok: leavesOk && merkleRoot(r.evidence.map((e) => e.leaf)) === m.evidenceRoot });
  } else checks.push({ name: "Evidence matches its Merkle root", ok: true, detail: "Evidence not shared (totals only)" });
  if (r.judges.length) {
    checks.push({ name: "Judge records match their Merkle root", ok: merkleRoot(r.judges.map((j) => j.leaf)) === m.judgeRoot });
  }
  return { ok: checks.every((c) => c.ok), signer, checks };
}

/** What gets published when the owner shares "totals only": no evidence, no judge leaves. */
export function totalsOnly(r: SignedReceipt): SignedReceipt {
  return { ...r, evidence: [], judges: [], summary: { ...r.summary, buckets: r.summary.buckets } };
}
