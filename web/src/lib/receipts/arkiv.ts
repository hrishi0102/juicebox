// Shared receipts on Arkiv (testnet "Rabdi").
//
// When someone shares a receipt with their team, we write one Arkiv entity:
//   indexed attributes  team, period, signer, level (totals | full), numbers for filtering
//   payload (bytes)     the signed receipt JSON (totals-only or with evidence)
// Never stored: prompts, session ids, file names. Arkiv data is public, so "full" sharing only
// adds PR links and per-task numbers that the owner chose to reveal.
//
// The team view reads these entities back with a query, and every receipt's EIP-712 signature is
// checked again on read, so anyone can write to the schema but only signed receipts count.

import { createPublicClient, createWalletClient, ExpirationTime } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { and, desc, eq } from "@arkiv-network/sdk/query";
import { bytes, defineSchema, i32, str, u64 } from "@arkiv-network/sdk/schema";
import { hexToString, http, stringToBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { verifyReceipt, type SignedReceipt } from "./receipt";

export const ARKIV_SCHEMA_NAME = "receipts-ethglobal-mumbai.receipt.v1";
export const ARKIV_CHAIN_ID = 7794095;
export const ARKIV_EXPLORER = "https://rabdi.explorer.arkiv.network";

export const ReceiptSchema = defineSchema(ARKIV_SCHEMA_NAME, {
  type: str().indexed(), // always "receipt"
  team: str().indexed(),
  period: str().indexed(), // ISO week, e.g. 2026-W45
  signer: str().indexed(), // lowercased address that signed the receipt (EIP-712)
  level: str().indexed(), // totals | full
  spendCents: u64().indexed(),
  shipped: i32().indexed(),
  survivalBps: i32().indexed(), // 65535 = unknown
  wasteBps: i32().indexed(),
  digest: str(), // EIP-712 digest of the receipt
  payload: bytes(), // the signed receipt JSON
});

function chain() {
  return rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" });
}

export function arkivPublic() {
  return createPublicClient({ chain: chain(), transport: http(process.env.ARKIV_RPC_URL || undefined) });
}

export function arkivWriterAddress(): string | undefined {
  const key = process.env.ARKIV_PRIVATE_KEY as Hex | undefined;
  return key ? privateKeyToAccount(key).address : undefined;
}

/** Publish (share) a signed receipt. Returns the entity key and tx hash. */
export async function publishReceipt(r: SignedReceipt, opts: { team: string; level: "totals" | "full"; days?: number }) {
  const key = process.env.ARKIV_PRIVATE_KEY as Hex | undefined;
  if (!key) throw new Error("ARKIV_PRIVATE_KEY is not set. Add a funded Rabdi testnet key to web/.env.local.");
  if (!r.signature) throw new Error("Sign the receipt before sharing it.");
  const check = await verifyReceipt(r);
  if (!check.ok) throw new Error("Receipt failed verification; not publishing.");
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ chain: chain(), transport: http(process.env.ARKIV_RPC_URL || undefined), account });
  const shared: SignedReceipt = { ...r, share: { level: opts.level, team: opts.team, publishedAt: new Date().toISOString() } };
  if (opts.level === "totals") {
    shared.evidence = [];
    shared.judges = [];
  }
  const m = r.message;
  const { entityKey, txHash } = await wallet.createEntity(
    ReceiptSchema,
    {
      type: "receipt",
      team: opts.team,
      period: m.period,
      signer: m.owner.toLowerCase(),
      level: opts.level,
      spendCents: u64(BigInt(m.spendCents)),
      shipped: m.shippedTasks,
      survivalBps: m.survivalBps,
      wasteBps: m.wasteBps,
      digest: r.digest,
      payload: stringToBytes(JSON.stringify(shared)),
    },
    { expiration: ExpirationTime.fromDays(opts.days ?? 120) },
  );
  return { entityKey: entityKey as string, txHash: txHash as string, writer: account.address };
}

export type TeamReceipt = SignedReceipt & { arkiv: { key: string; owner?: string; expiresAt?: string }; verified: boolean };

/** Read every shared receipt for a team (optionally one period) and re-verify each signature. */
export async function fetchTeamReceipts(team: string, period?: string): Promise<TeamReceipt[]> {
  const client = arkivPublic();
  const where = period ? and(eq("type", "receipt"), eq("team", team), eq("period", period)) : and(eq("type", "receipt"), eq("team", team));
  const { entities } = await client
    .select({ $key: true, $owner: true, $expiresAt: true, payload: true })
    .from(ReceiptSchema)
    .where(where)
    .orderBy(desc("spendCents"))
    .limit(100)
    .fetch();
  const out: TeamReceipt[] = [];
  for (const e of entities as any[]) {
    try {
      const raw = e.payload?.value ?? e.payload;
      const r = JSON.parse(typeof raw === "string" && raw.startsWith("0x") ? hexToString(raw as Hex) : String(raw)) as SignedReceipt;
      const v = await verifyReceipt(r);
      out.push({ ...r, arkiv: { key: String(e.$key?.value ?? e.$key), owner: String(e.$owner?.value ?? e.$owner ?? ""), expiresAt: String(e.$expiresAt?.value ?? e.$expiresAt ?? "") }, verified: v.ok });
    } catch {
      // not a valid receipt payload; ignore
    }
  }
  return out;
}

/** Load one shared receipt by its Arkiv entity key. */
export async function fetchReceiptByKey(entityKey: string): Promise<TeamReceipt | undefined> {
  const client = arkivPublic();
  const e: any = await client.getEntity(entityKey as Hex, ReceiptSchema);
  if (!e) return undefined;
  const raw = e.payload?.value ?? e.payload;
  const r = JSON.parse(typeof raw === "string" && raw.startsWith("0x") ? hexToString(raw as Hex) : String(raw)) as SignedReceipt;
  const v = await verifyReceipt(r);
  return { ...r, arkiv: { key: entityKey, owner: String(e.$owner?.value ?? e.$owner ?? "") }, verified: v.ok };
}

/** A query judges can paste (raw Arkiv query language). */
export function exampleQuery(team: string) {
  return `arkiv.schema = str('${ARKIV_SCHEMA_NAME}') AND type = str('receipt') AND team = str('${team}')`;
}
