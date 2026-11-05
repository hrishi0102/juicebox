import { NextResponse } from "next/server";
import type { Address } from "viem";
import { currentSource, getDataset } from "@/lib/server/data";
import { buildWeekReceipt, loadSavedReceipt, saveReceipt } from "@/lib/server/receipts-store";
import { verifyReceipt, type SignedReceipt } from "@/lib/receipts/receipt";
import { rejectCrossSite } from "@/lib/server/guard";

// GET: build the unsigned receipt for a week (the browser wallet signs it).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const week = url.searchParams.get("week") ?? "";
  const owner = url.searchParams.get("owner") as Address | null;
  const source = await currentSource();
  const d = getDataset(source);
  if (!d) return NextResponse.json({ error: "No data" }, { status: 404 });
  if (!owner) return NextResponse.json({ saved: loadSavedReceipt(source, week) ?? null });
  return NextResponse.json({ receipt: buildWeekReceipt(d, week, owner) });
}

// POST: save a receipt signed in the browser, after checking the signature.
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const { receipt } = (await req.json()) as { receipt: SignedReceipt };
  const v = await verifyReceipt(receipt);
  if (!v.ok) return NextResponse.json({ ok: false, error: "Signature or digest check failed", checks: v.checks }, { status: 400 });
  const source = await currentSource();
  receipt.signedAt = new Date().toISOString();
  saveReceipt(source, receipt);
  return NextResponse.json({ ok: true, digest: receipt.digest });
}
