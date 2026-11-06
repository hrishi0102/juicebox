import { NextResponse } from "next/server";
import { z } from "zod";
import { browserPlan, browserSessions, browserWeek } from "@/lib/receipts/week";
import { rejectCrossSite } from "@/lib/server/guard";
import { currentSource } from "@/lib/server/data";

export const maxDuration = 300;

// "Write my week" paid from your own 0G credits: the browser calls 0G, this route builds the
// messages and keeps the answers. Prompts only travel between this laptop's server, its browser
// tab and the 0G enclave.

const Reply = z.object({
  content: z.string().max(20000),
  model: z.string().max(100).optional(),
  requestId: z.string().max(200).optional(),
  chatId: z.string().max(200).optional(),
  provider: z.string().max(100).optional(),
  sealed: z.boolean().optional(),
  teeVerified: z.boolean().optional(),
  costUsd: z.number().optional(),
});
const Answer = z.object({ sessionId: z.string().max(100).optional(), content: z.string().max(20000), hash: z.string().regex(/^0x[0-9a-f]{64}$/), reply: Reply });
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("plan"), week: z.string().regex(/^\d{4}-W\d{2}$/) }),
  z.object({ action: z.literal("sessions"), week: z.string().regex(/^\d{4}-W\d{2}$/), payer: z.string().max(80), answers: z.array(Answer).max(500) }),
  z.object({ action: z.literal("week"), week: z.string().regex(/^\d{4}-W\d{2}$/), payer: z.string().max(80), answer: Answer }),
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
    if (b.action === "sessions") return NextResponse.json({ ok: true, ...(await browserSessions(source, b.week, b.answers as never, b.payer)) });
    const story = await browserWeek(source, b.week, b.answer as never, b.payer);
    return NextResponse.json({ ok: true, items: story.items.length, requestIds: story.requestIds, verified: story.verified });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
