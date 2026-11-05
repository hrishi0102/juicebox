// Saving and building weekly receipts (server only).
import type { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { demoKey } from "@/lib/receipts/demo";
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
  return readJson<SignedReceipt | null>("local", receiptFile(source, weekId), null) ?? undefined;
}

export function saveReceipt(source: Source, r: SignedReceipt) {
  return writeJson("local", receiptFile(source, r.message.period), r);
}

export function buildWeekReceipt(d: Dataset, weekId: string, owner: Address): SignedReceipt {
  const wv = weekView(d, weekId);
  return buildReceipt({ owner, periodId: wv.id, summary: { ...wv.summary, owner }, judgements: wv.judgements });
}

/** The key used for one-click signing: the demo persona's key in demo mode, RECEIPTS_SIGNER_KEY otherwise. */
export function localSigner(source: Source) {
  if (source === "demo") return privateKeyToAccount(demoKey("You"));
  const key = process.env.RECEIPTS_SIGNER_KEY as Hex | undefined;
  return key ? privateKeyToAccount(key) : undefined;
}

export async function signWithLocalKey(source: Source, d: Dataset, weekId: string) {
  const account = localSigner(source);
  if (!account) throw new Error("No local signing key. Connect a wallet, or set RECEIPTS_SIGNER_KEY in web/.env.local.");
  const r = buildWeekReceipt(d, weekId, account.address);
  r.signature = await account.signTypedData(typedDataFor(r));
  r.signedAt = new Date().toISOString();
  const v = await verifyReceipt(r);
  if (!v.ok) throw new Error("Signed receipt failed verification");
  saveReceipt(source, r);
  return r;
}
