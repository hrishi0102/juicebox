import { NextResponse } from "next/server";
import { fetchReceiptByKey, type ArkivMeta } from "@/lib/receipts/arkiv";
import { verifyReceipt, type SignedReceipt } from "@/lib/receipts/receipt";
import { rejectCrossSite } from "@/lib/server/guard";
import { keyProofFor } from "@/lib/server/key-proofs";
import { DEMO_ORG } from "@/lib/receipts/demo";

// Verify a receipt from pasted JSON, or load it from Arkiv by entity key and verify it.
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const body = (await req.json()) as { receipt?: SignedReceipt; entityKey?: string };
  try {
    let receipt = body.receipt;
    let arkiv: ArkivMeta | undefined;
    if (!receipt && body.entityKey) {
      const r = await fetchReceiptByKey(body.entityKey.trim());
      if (!r) return NextResponse.json({ ok: false, error: "No entity with that key on Arkiv (it may have expired)." }, { status: 404 });
      receipt = r;
      arkiv = r.arkiv;
    }
    if (!receipt) return NextResponse.json({ ok: false, error: "Paste a receipt JSON or an Arkiv entity key." }, { status: 400 });
    const v = await verifyReceipt(receipt);
    // Not part of the signature check: whether a public gist proves the key belongs to the GitHub login.
    const login = receipt.message.author;
    const github = !login ? undefined : receipt.share?.org === DEMO_ORG.id ? { login, status: "demo" } : { login, ...(await keyProofFor(login, receipt.message.owner)) };
    return NextResponse.json({ ok: v.ok, checks: v.checks, signer: v.signer, headline: receipt.headline, period: receipt.message.period, judge: receipt.message.judge, arkiv, github, evidence: receipt.evidence.length, judges: receipt.judges.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
