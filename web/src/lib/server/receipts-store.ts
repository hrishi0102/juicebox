// Saving, building and signing weekly receipts (server only).
import type { Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { demoKey } from "@/lib/receipts/demo";
import { githubLogin, laptopAccount } from "@/lib/receipts/identity";
import { envPrivateKey } from "@/lib/receipts/keys";
import type { Dataset } from "@/lib/receipts/pipeline";
import { buildReceipt, typedDataFor, verifyReceipt, type SignedReceipt } from "@/lib/receipts/receipt";
import { readJson, writeJson, type Source } from "@/lib/receipts/store";
import { weekView } from "./data";

// Signed receipts always live in ~/.receipts. Demo receipts get their own folder there,
// so signing in demo mode never touches files in the repo.
function receiptFile(source: Source, weekId: string) {
  return `${source === "demo" ? "demo-receipts" : "receipts"}/${weekId}.json`;
}

export function loadSavedReceipt(source: Source, weekId: string): SignedReceipt | undefined {
  const r = readJson<SignedReceipt | null>("local", receiptFile(source, weekId), null);
  // Receipts from before version 3 are simply signed again.
  return r?.kind === "receipts.v3" ? r : undefined;
}

export function saveReceipt(source: Source, r: SignedReceipt) {
  return writeJson("local", receiptFile(source, r.message.period), r);
}

export function buildWeekReceipt(d: Dataset, weekId: string, owner: Address, author = ""): SignedReceipt {
  const wv = weekView(d, weekId);
  return buildReceipt({ owner, author, periodId: wv.id, summary: { ...wv.summary, owner }, judgements: wv.judgements });
}

/** Address that signs on this laptop, if one exists yet (demo: the "You" persona). */
export function signerAddress(source: Source): Address | undefined {
  if (source === "demo") return privateKeyToAccount(demoKey("You")).address;
  const key = envPrivateKey("RECEIPTS_SIGNER_KEY");
  if (key) return privateKeyToAccount(key).address;
  return laptopAccount(false)?.address;
}

/** The signing address, making the laptop key if this is the first time. */
export function ensureSignerAddress(source: Source): Address {
  return signingAccount(source).address;
}

function signingAccount(source: Source) {
  if (source === "demo") return privateKeyToAccount(demoKey("You"));
  const key = envPrivateKey("RECEIPTS_SIGNER_KEY");
  return key ? privateKeyToAccount(key) : laptopAccount(true)!;
}

/** Sign a plain message (EIP-191) with the key that signs your receipts, for the GitHub key proof. */
export async function signWithReceiptKey(source: Source, message: string) {
  const account = signingAccount(source);
  return { address: account.address, signature: await account.signMessage({ message }) };
}

/** The name inside the signed receipt: your GitHub login (demo: a made-up handle). */
export async function authorFor(source: Source) {
  if (source === "demo") return "you";
  return (await githubLogin())?.login ?? "";
}

export async function signWithLocalKey(source: Source, d: Dataset, weekId: string) {
  const account = signingAccount(source);
  const r = buildWeekReceipt(d, weekId, account.address, await authorFor(source));
  r.signature = await account.signTypedData(typedDataFor(r));
  r.signedAt = new Date().toISOString();
  const v = await verifyReceipt(r);
  if (!v.ok) throw new Error("Signed receipt failed verification");
  saveReceipt(source, r);
  return r;
}
