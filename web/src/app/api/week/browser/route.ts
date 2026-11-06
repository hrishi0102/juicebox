import { NextResponse } from "next/server";
import { z } from "zod";
import { browserPlan, browserPlanSessions, browserSessions, browserWeek } from "@/lib/receipts/week";
import { rejectCrossSite } from "@/lib/server/guard";
import { currentSource } from "@/lib/server/data";
import { Payer, WeekId, ZgAnswer } from "@/lib/server/zerog-answer";

export const maxDuration = 300;

// "Write my week", paid from your own 0G credits: the browser calls 0G with your 0G session, this
// route builds the messages and keeps the answers. Prompts only travel between this laptop's
// server, its browser tab and 0G (its router, then the model in a TEE).
//
//   plan           the private message for each session of the week that still needs the AI
//   plan-sessions  the same for chosen sessions, asked again (one session's page)
//   sessions       the AI's answers become that session's line; with a week, returns the weekly message
//   week           the weekly answer becomes the saved list
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("plan"), week: WeekId }),
  z.object({ action: z.literal("plan-sessions"), sessionIds: z.array(z.string().max(100)).min(1).max(50) }),
  z.object({ action: z.literal("sessions"), week: WeekId.optional(), payer: Payer, answers: z.array(ZgAnswer).max(500) }),
  z.object({ action: z.literal("week"), week: WeekId, payer: Payer, answer: ZgAnswer }),
]);

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  const b = parsed.data;
  const source = await currentSource();
  try {
    if (b.action === "plan") return NextResponse.json({ ok: true, ...(await browserPlan(source, b.week)) });
    if (b.action === "plan-sessions") return NextResponse.json({ ok: true, ...(await browserPlanSessions(source, b.sessionIds)) });
    if (b.action === "sessions") return NextResponse.json({ ok: true, ...(await browserSessions(source, b.week, b.answers as never, b.payer)) });
    const story = await browserWeek(source, b.week, b.answer as never, b.payer);
    return NextResponse.json({ ok: true, items: story.items.length, requestIds: story.requestIds, verified: story.verified });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
