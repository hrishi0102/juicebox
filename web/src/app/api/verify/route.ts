import { NextResponse } from "next/server";
import { fetchReceiptByKey } from "@/lib/receipts/arkiv";
import { verifyReceipt, type SignedReceipt } from "@/lib/receipts/receipt";
import { rejectCrossSite } from "@/lib/server/guard";

// Verify a receipt from pasted JSON, or load it from Arkiv by entity key and verify it.
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const body = (await req.json()) as { receipt?: SignedReceipt; entityKey?: string };
  try {
    let receipt = body.receipt;
    let arkiv: { key: string; owner?: string } | undefined;
    if (!receipt && body.entityKey) {
      const r = await fetchReceiptByKey(body.entityKey.trim());
      if (!r) return NextResponse.json({ ok: false, error: "No entity with that key on Arkiv (it may have expired)." }, { status: 404 });
      receipt = r;
      arkiv = r.arkiv;
    }
    if (!receipt) return NextResponse.json({ ok: false, error: "Paste a receipt JSON or an Arkiv entity key." }, { status: 400 });
    const v = await verifyReceipt(receipt);
    return NextResponse.json({ ok: v.ok, checks: v.checks, signer: v.signer, headline: receipt.headline, period: receipt.message.period, judge: receipt.message.judge, arkiv, evidence: receipt.evidence.length, judges: receipt.judges.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
