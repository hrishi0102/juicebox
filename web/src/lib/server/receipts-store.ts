// Saving, building and signing weekly receipts (server only).
import type { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { demoKey } from "@/lib/receipts/demo";
import { githubLogin, laptopAccount } from "@/lib/receipts/identity";
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
  // Receipts from before version 2 are simply signed again.
  return r?.kind === "receipts.v2" ? r : undefined;
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
  const key = process.env.RECEIPTS_SIGNER_KEY as Hex | undefined;
  if (key) return privateKeyToAccount(key).address;
  return laptopAccount(false)?.address;
}

function signingAccount(source: Source) {
  if (source === "demo") return privateKeyToAccount(demoKey("You"));
  const key = process.env.RECEIPTS_SIGNER_KEY as Hex | undefined;
  return key ? privateKeyToAccount(key) : laptopAccount(true)!;
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
