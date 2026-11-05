import { NextResponse } from "next/server";
import { publishReceipt, ARKIV_EXPLORER } from "@/lib/receipts/arkiv";
import { currentSource, getLocalTeamConfig } from "@/lib/server/data";
import { loadSavedReceipt, saveReceipt } from "@/lib/server/receipts-store";

export const maxDuration = 120;

// Publish a signed receipt to Arkiv so the team view can read it.
export async function POST(req: Request) {
  const { week, level } = (await req.json()) as { week: string; level: "totals" | "full" };
  const source = await currentSource();
  const r = loadSavedReceipt(source, week);
  if (!r?.signature) return NextResponse.json({ ok: false, error: "Sign this week's receipt first." }, { status: 400 });
  const team = source === "demo" ? "acme-payments" : getLocalTeamConfig().id;
  try {
    const out = await publishReceipt(r, { team, level: level === "full" ? "full" : "totals" });
    r.share = { level: level === "full" ? "full" : "totals", team, arkivKey: out.entityKey, arkivTx: out.txHash, publishedAt: new Date().toISOString() };
    saveReceipt(source, r);
    return NextResponse.json({ ok: true, ...out, explorer: `${ARKIV_EXPLORER}/tx/${out.txHash}` });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
