import { NextResponse } from "next/server";
import { judgeConfigFromEnv } from "@/lib/receipts/judge";
import { reviewWeek } from "@/lib/receipts/review";
import { writeJson } from "@/lib/receipts/store";
import { currentSource, getDataset, weekView } from "@/lib/server/data";
import { rejectCrossSite } from "@/lib/server/guard";

export const maxDuration = 120;

// Ask the private judge (0G) for a review of one week.
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const { week } = (await req.json()) as { week: string };
  const cfg = judgeConfigFromEnv();
  if (cfg.engine === "heuristic" || (cfg.engine === "0g" && !cfg.apiKey)) {
    return NextResponse.json({ ok: false, error: "The private judge is not set up. Add ZG_API_KEY (from pc.0g.ai) to web/.env.local and restart the app." }, { status: 400 });
  }
  const source = await currentSource();
  const d = getDataset(source);
  if (!d) return NextResponse.json({ ok: false, error: "No data" }, { status: 404 });
  try {
    const wv = weekView(d, week);
    const review = await reviewWeek(cfg, d, wv);
    writeJson("local", `reviews/${source}-${wv.id}.json`, review);
    return NextResponse.json({ ok: true, requestId: review.judge.requestId, verified: review.judge.verified });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
