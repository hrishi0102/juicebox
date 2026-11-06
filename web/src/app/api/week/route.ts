import { NextResponse } from "next/server";
import { judgeConfigFromEnv } from "@/lib/receipts/judge";
import { writeWeekStory } from "@/lib/receipts/week";
import { rejectCrossSite } from "@/lib/server/guard";
import { currentSource } from "@/lib/server/data";

export const maxDuration = 300;

// "Write my week": runs only when the person clicks the button. Sessions without an AI line go to
// the private AI (0G TEE) one by one, then one call writes the weekly list from those lines.
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const body = (await req.json().catch(() => ({}))) as { week?: string };
  if (!body.week || !/^\d{4}-W\d{2}$/.test(body.week)) return NextResponse.json({ ok: false, error: "Which week? Expected something like 2026-W45." }, { status: 400 });
  const cfg = judgeConfigFromEnv();
  const source = await currentSource();
  try {
    const r = await writeWeekStory(source, body.week, { cfg });
    return NextResponse.json({
      ok: true,
      engine: r.story.engine,
      model: r.story.model,
      items: r.story.items.length,
      judged: r.judged,
      failed: r.failed,
      requestIds: r.story.requestIds,
      verified: r.story.verified,
      warning: r.error ?? (cfg.engine === "heuristic" ? "No private AI is set up (add ZG_API_KEY to web/.env.local), so this list comes from simple rules." : undefined),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
