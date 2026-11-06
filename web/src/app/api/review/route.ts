import { NextResponse } from "next/server";
import { z } from "zod";
import { reviewFromAnswer, reviewPlan } from "@/lib/receipts/review";
import { browserJudgeInfo } from "@/lib/receipts/week";
import { writeJson } from "@/lib/receipts/store";
import { currentSource, getDataset, weekView } from "@/lib/server/data";
import { rejectCrossSite } from "@/lib/server/guard";
import { Payer, WeekId, ZgAnswer } from "@/lib/server/zerog-answer";

export const maxDuration = 120;

// A private review of one week, paid from the person's own 0G account. Two steps: "plan" builds the
// message here (it reads the logs), the browser sends it to 0G with its 0G session, and "save"
// keeps the answer. Only the answer is kept; what was sent is kept as a hash.
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("plan"), week: WeekId }),
  z.object({ action: z.literal("save"), week: WeekId, payer: Payer, answer: ZgAnswer }),
]);

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  const b = parsed.data;
  const source = await currentSource();
  const d = getDataset(source);
  if (!d) return NextResponse.json({ ok: false, error: "No data yet. Read your logs first." }, { status: 404 });
  try {
    const wv = weekView(d, b.week);
    if (b.action === "plan") return NextResponse.json({ ok: true, ...(await reviewPlan(d, wv)) });
    const judge = await browserJudgeInfo(b.answer as never, b.payer);
    const review = reviewFromAnswer(wv.id, source, b.answer.content, judge);
    writeJson("local", `reviews/${source}-${wv.id}.json`, review);
    return NextResponse.json({ ok: true, requestId: review.judge.requestId, verified: review.judge.verified });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
