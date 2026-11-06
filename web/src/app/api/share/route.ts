import { NextResponse } from "next/server";
import { z } from "zod";
import { publishReceipt, ARKIV_EXPLORER } from "@/lib/receipts/arkiv";
import { revealItems } from "@/lib/receipts/receipt";
import { currentSource, getDemoOrg, shareTarget } from "@/lib/server/data";
import { loadSavedReceipt, saveReceipt } from "@/lib/server/receipts-store";
import { rejectCrossSite } from "@/lib/server/guard";
import { WeekId } from "@/lib/server/zerog-answer";

export const maxDuration = 120;

// Send a signed receipt to the company: one read-only Arkiv record owned by the signer, with the
// full week sealed for the company on Swarm. `hide` lists lines (by position) the owner keeps
// private; they leave the list but still count in the signed totals.
const Body = z.object({ week: WeekId, level: z.enum(["totals", "full"]).optional(), hide: z.array(z.number().int().min(0).max(999)).max(200).optional() });

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  // Company policy: the list and its PRs go to the company. "totals" is only used if explicitly asked for.
  const { week, level = "full", hide = [] } = parsed.data;
  const source = await currentSource();
  const r = loadSavedReceipt(source, week);
  if (!r?.signature) return NextResponse.json({ ok: false, error: "Sign this week's receipt first." }, { status: 400 });
  const demo = source === "demo" ? getDemoOrg() : undefined;
  const target = demo ? undefined : await shareTarget();
  if (target?.from === "default") return NextResponse.json({ ok: false, error: "Join your company first (My week, Setup)." }, { status: 400 });
  const team = demo ? (demo.members.find((m) => m.you)?.team ?? demo.teams[0].id) : target!.team;
  const org = demo ? demo.id : target!.org;
  const hidden = new Set(hide);
  const toSend = hidden.size ? revealItems(r, (_, i) => !hidden.has(i)) : r;
  try {
    const out = await publishReceipt(toSend, { team, org, level });
    r.share = {
      level: out.swarm ? "sealed" : level,
      team,
      org,
      arkivKey: out.entityKey,
      arkivTx: out.txHash,
      publishedAt: new Date().toISOString(),
      swarm: out.swarm,
      hidden: r.items.length - toSend.items.length,
    };
    saveReceipt(source, r);
    return NextResponse.json({ ok: true, ...out, explorer: `${ARKIV_EXPLORER}/tx/${out.txHash}` });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
