import { NextResponse } from "next/server";
import { publishReceipt, ARKIV_EXPLORER } from "@/lib/receipts/arkiv";
import { currentSource, getDemoOrg, shareTarget } from "@/lib/server/data";
import { loadSavedReceipt, saveReceipt } from "@/lib/server/receipts-store";
import { rejectCrossSite } from "@/lib/server/guard";

export const maxDuration = 120;

// Publish a signed receipt to Arkiv so the team view can read it.
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  // Company policy: the PR list is shared with the org. "totals" is only used if explicitly asked for.
  const { week, level = "full" } = (await req.json()) as { week: string; level?: "totals" | "full" };
  const source = await currentSource();
  const r = loadSavedReceipt(source, week);
  if (!r?.signature) return NextResponse.json({ ok: false, error: "Sign this week's receipt first." }, { status: 400 });
  const demo = source === "demo" ? getDemoOrg() : undefined;
  const target = demo ? undefined : await shareTarget();
  const team = demo ? (demo.members.find((m) => m.you)?.team ?? demo.teams[0].id) : target!.team;
  const org = demo ? demo.id : target!.org;
  try {
    const out = await publishReceipt(r, { team, org, level: level === "full" ? "full" : "totals" });
    r.share = { level: out.swarm ? "sealed" : level === "full" ? "full" : "totals", team, org, arkivKey: out.entityKey, arkivTx: out.txHash, publishedAt: new Date().toISOString(), swarm: out.swarm };
    saveReceipt(source, r);
    return NextResponse.json({ ok: true, ...out, explorer: `${ARKIV_EXPLORER}/tx/${out.txHash}` });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
