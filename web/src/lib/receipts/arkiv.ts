/* eslint-disable @typescript-eslint/no-explicit-any -- query rows come back with SDK-generated shapes */
// Shared receipts on Arkiv (testnet "Rabdi").
//
// When someone shares a receipt with their company, one transaction does two things:
//   1. creates a READ-ONLY entity: indexed attributes (org, team, period, signer, author, numbers
//      for filtering) and the signed receipt JSON as the payload. Read-only means nobody, not the
//      company and not us, can edit it later.
//   2. hands ownership of that entity to the person who signed it (their laptop key). The company
//      wallet only pays the gas; the record belongs to the employee.
// Never stored: prompts, session ids, file names. Arkiv data is public, so a shared receipt holds
// only the list, the PRs and the numbers the owner signed.
//
// Company and team views read these entities back with a query, and every receipt's EIP-712
// signature is checked again on read, so anyone can write to the schema but only signed receipts count.

import { createPublicClient, createWalletClient, ExpirationTime } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { and, desc, eq } from "@arkiv-network/sdk/query";
import { bytes, defineSchema, i32, str, u64 } from "@arkiv-network/sdk/schema";
import { hexToString, http, stringToBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { envPrivateKey } from "./keys";
import { totalsOnly, verifyReceipt, type SignedReceipt } from "./receipt";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, decryptBlob, encryptBlob, hexToBytes, openPointer, publicKeyOf, sealPointer } from "./seal";
import { downloadBytes, swarmReady, uploadBytes } from "./swarm";

export const ARKIV_SCHEMA_NAME = "receipts-ethglobal-mumbai.receipt.v2";
export const ARKIV_CHAIN_ID = 7794095;
export const ARKIV_EXPLORER = "https://rabdi.explorer.arkiv.network";

export const ReceiptSchema = defineSchema(ARKIV_SCHEMA_NAME, {
  type: str().indexed(), // always "receipt"
  org: str().indexed(), // company id, so one query reads every team
  team: str().indexed(),
  period: str().indexed(), // ISO week, e.g. 2026-W45
  signer: str().indexed(), // lowercased address that signed the receipt (EIP-712)
  author: str().indexed(), // GitHub login inside the signed receipt, or ""
  level: str().indexed(), // totals | full
  spendCents: u64().indexed(),
  done: i32().indexed(), // things done (items that were not wasted)
  merged: i32().indexed(), // merged pull requests
  wasteCents: u64().indexed(),
  digest: str(), // EIP-712 digest of the receipt
  payload: bytes(), // the signed receipt JSON (totals only when the list is on Swarm)
  swarm: str().optional(), // Swarm reference of the encrypted full week (64 hex)
  sealed: bytes().optional(), // where it is, its key, SHA-256 and size, sealed to the company's public key
});

/** The company key opens sealed weeks. Defaults to the company wallet that pays for Arkiv. */
export function companyPrivateKey() {
  return envPrivateKey("COMPANY_PRIVATE_KEY") ?? envPrivateKey("ARKIV_PRIVATE_KEY");
}

/** What employees encrypt to: COMPANY_PUBLIC_KEY, or derived from the company key. */
export function companyPublicKey(): string | undefined {
  const pub = process.env.COMPANY_PUBLIC_KEY?.trim();
  if (pub) return pub.replace(/^0x/, "");
  const key = companyPrivateKey();
  return key ? publicKeyOf(key) : undefined;
}

function chain() {
  return rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" });
}

export function arkivPublic() {
  return createPublicClient({ chain: chain(), transport: http(process.env.ARKIV_RPC_URL || undefined) });
}

export function arkivWriterAddress(): string | undefined {
  const key = envPrivateKey("ARKIV_PRIVATE_KEY");
  return key ? privateKeyToAccount(key).address : undefined;
}

/** Publish (share) a signed receipt. Returns the entity key and tx hash. */
export async function publishReceipt(r: SignedReceipt, opts: { team: string; org?: string; level: "totals" | "full"; days?: number; keepOwnership?: boolean; swarm?: boolean }) {
  const key = envPrivateKey("ARKIV_PRIVATE_KEY");
  if (!key) throw new Error("ARKIV_PRIVATE_KEY is not set. Add a funded Rabdi testnet key to web/.env.local.");
  if (!r.signature) throw new Error("Sign the receipt before sharing it.");
  const check = await verifyReceipt(r);
  if (!check.ok) throw new Error("Receipt failed verification; not publishing.");
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ chain: chain(), transport: http(process.env.ARKIV_RPC_URL || undefined), account });
  const org = opts.org ?? r.share?.org ?? "";
  const base = opts.level === "totals" ? totalsOnly(r) : r;
  let shared: SignedReceipt = { ...base, share: { level: opts.level, team: opts.team, org, publishedAt: new Date().toISOString() } };
  const m = r.message;

  // With Swarm: the full week goes to Swarm encrypted, the key is sealed to the company, and the
  // public Arkiv record keeps only the signed totals. Without it, the full week is the payload.
  let swarmRef: string | undefined;
  let sealed: string | undefined;
  const companyPub = companyPublicKey();
  if (opts.level === "full" && opts.swarm !== false && swarmReady() && companyPub) {
    const { key: aes, blob } = encryptBlob(new TextEncoder().encode(JSON.stringify(shared)));
    swarmRef = await uploadBytes(blob);
    sealed = sealPointer(companyPub, { ref: swarmRef, key: bytesToHex(aes), sha256: bytesToHex(sha256(blob)), size: blob.length });
    shared = { ...totalsOnly(r), share: { level: "sealed", team: opts.team, org, publishedAt: shared.share!.publishedAt, swarm: swarmRef } };
  }
  const values = {
    type: "receipt",
    org,
    team: opts.team,
    period: m.period,
    signer: m.owner.toLowerCase(),
    author: m.author ?? "",
    level: sealed ? "sealed" : opts.level,
    spendCents: u64(BigInt(m.spendCents)),
    done: m.done,
    merged: m.mergedPrs,
    wasteCents: u64(BigInt(m.categorySpendCents[6] ?? "0")),
    digest: r.digest,
    payload: stringToBytes(JSON.stringify(shared)),
    ...(swarmRef && sealed ? { swarm: swarmRef, sealed: hexToBytes(sealed) } : {}),
  };
  const expiration = ExpirationTime.fromDays(opts.days ?? 120);
  const handOver = !opts.keepOwnership && m.owner.toLowerCase() !== account.address.toLowerCase();
  try {
    if (!handOver) {
      const { entityKey, txHash } = await wallet.createEntity(ReceiptSchema, values, { expiration, flags: { readonly: true } });
      return { entityKey: entityKey as string, txHash: txHash as string, writer: account.address, owner: account.address, swarm: swarmRef };
    }
    // Predict the new entity's key so the same transaction can hand it to the signer.
    const [next] = await arkivPublic().predictEntityKeys({ owner: account.address, count: 1 });
    const out = await wallet.executeBatch({
      creates: [{ schema: ReceiptSchema, values, expiration, flags: { readonly: true }, salt: next.salt }],
      ownershipChanges: [{ entityKey: next.key, newOwner: m.owner }],
    });
    return { entityKey: (out.createdEntities[0] ?? next.key) as string, txHash: out.txHash as string, writer: account.address, owner: m.owner, swarm: swarmRef };
  } catch (e) {
    throw new Error(explainArkivError(e, account.address));
  }
}

/** The SDK wraps the real cause (often an empty wallet) in a vague message; dig it out. */
export function explainArkivError(e: unknown, writer: string): string {
  const parts: string[] = [];
  let c: any = e;
  for (let i = 0; c && i < 8; i++, c = c.cause) parts.push(String(c.details ?? ""), String(c.shortMessage ?? c.message ?? ""));
  const text = parts.join(" ");
  if (/insufficient funds/i.test(text)) return `The Arkiv writer wallet ${writer} has no tGLM for gas. Claim some at https://hub.arkiv.network/faucet and try again.`;
  if (/rate limit|429/i.test(text)) return "The public Arkiv endpoint is rate limited. Add ARKIV_ACCESS_KEY (https://hub.arkiv.network/access-keys) and try again.";
  return `Arkiv write failed: ${(parts.find((p) => p && p !== "undefined") ?? "unknown error").slice(0, 200)}`;
}

export type TeamReceipt = SignedReceipt & {
  arkiv: { key: string; owner?: string; expiresAt?: string };
  verified: boolean;
  swarm?: { ref: string; opened: boolean; error?: string };
};

type Row = { $key?: unknown; $owner?: unknown; $expiresAt?: unknown; payload?: unknown; swarm?: unknown; sealed?: unknown };
const val = (x: unknown) => (x && typeof x === "object" && "value" in (x as object) ? (x as { value: unknown }).value : x);

/** Turn one Arkiv row into a checked receipt; open the Swarm copy when allowed and possible. */
async function decodeRow(e: Row, open: boolean): Promise<TeamReceipt> {
  const raw = val(e.payload);
  const r = JSON.parse(typeof raw === "string" && raw.startsWith("0x") ? hexToString(raw as Hex) : String(raw)) as SignedReceipt;
  const arkiv = { key: String(val(e.$key)), owner: String(val(e.$owner) ?? ""), expiresAt: String(val(e.$expiresAt) ?? "") };
  const ref = val(e.swarm) ? String(val(e.swarm)) : undefined;
  const sealedRaw = val(e.sealed);
  const sealed = sealedRaw instanceof Uint8Array ? bytesToHex(sealedRaw) : sealedRaw ? String(sealedRaw).replace(/^0x/, "") : undefined;
  const companyKey = companyPrivateKey();
  if (ref && sealed && open && companyKey) {
    try {
      const p = openPointer(companyKey, sealed);
      if (p.ref !== ref) throw new Error("The sealed pointer names a different Swarm reference");
      const blob = await downloadBytes(p.ref);
      // Check the bytes before trusting them (Arkiv's hybrid-pointer pattern): size and SHA-256.
      if ((p.size !== undefined && blob.length !== p.size) || (p.sha256 && bytesToHex(sha256(blob)) !== p.sha256)) throw new Error("The Swarm copy failed its SHA-256 check");
      const full = JSON.parse(new TextDecoder().decode(decryptBlob(hexToBytes(p.key), blob))) as SignedReceipt;
      // The Swarm copy must be the same signed receipt as the public record.
      if (full.digest !== r.digest) throw new Error("Swarm copy does not match the signed record");
      const v = await verifyReceipt(full);
      return { ...full, share: { ...(full.share ?? r.share!), level: "full" }, arkiv, verified: v.ok, swarm: { ref, opened: true } };
    } catch (err) {
      const v = await verifyReceipt(r);
      return { ...r, arkiv, verified: v.ok, swarm: { ref, opened: false, error: err instanceof Error ? err.message : String(err) } };
    }
  }
  const v = await verifyReceipt(r);
  return { ...r, arkiv, verified: v.ok, ...(ref ? { swarm: { ref, opened: false } } : {}) };
}

/** Read every shared receipt for a team (optionally one period) and re-verify each signature. */
export async function fetchTeamReceipts(team: string, period?: string, open = true): Promise<TeamReceipt[]> {
  const client = arkivPublic();
  const where = period ? and(eq("type", "receipt"), eq("team", team), eq("period", period)) : and(eq("type", "receipt"), eq("team", team));
  const { entities } = await client
    .select({ $key: true, $owner: true, $expiresAt: true, payload: true, swarm: true, sealed: true })
    .from(ReceiptSchema)
    .where(where)
    .orderBy(desc("spendCents"))
    .limit(100)
    .fetch();
  const out: TeamReceipt[] = [];
  for (const e of entities as any[]) {
    try {
      out.push(await decodeRow(e, open));
    } catch {
      // not a valid receipt payload; ignore
    }
  }
  return out;
}

/** Every shared receipt of a company, across all its teams, re-verified. */
export async function fetchOrgReceipts(org: string, period?: string, open = true): Promise<TeamReceipt[]> {
  const client = arkivPublic();
  const where = period ? and(eq("type", "receipt"), eq("org", org), eq("period", period)) : and(eq("type", "receipt"), eq("org", org));
  const out: TeamReceipt[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const { entities } = await client
      .select({ $key: true, $owner: true, $expiresAt: true, payload: true, swarm: true, sealed: true })
      .from(ReceiptSchema)
      .where(where)
      .orderBy(desc("spendCents"))
      .limit(100)
      .offset(offset)
      .fetch();
    const decoded = await Promise.all((entities as any[]).map((e) => decodeRow(e, open).catch(() => undefined)));
    for (const r of decoded) if (r) out.push(r);
    if (entities.length < 100) break;
  }
  return out;
}

/** Load one shared receipt by its Arkiv entity key. */
export async function fetchReceiptByKey(entityKey: string, open = false): Promise<TeamReceipt | undefined> {
  const client = arkivPublic();
  const e: any = await client.getEntity(entityKey as Hex, ReceiptSchema);
  if (!e) return undefined;
  return decodeRow({ ...e, $key: entityKey }, open);
}

/** A query judges can paste (raw Arkiv query language). */
export function exampleQuery(team: string) {
  return `arkiv.schema = str('${ARKIV_SCHEMA_NAME}') AND type = str('receipt') AND team = str('${team}')`;
}
