import { NextResponse } from "next/server";
import { z } from "zod";
import { keccak256, stringToHex } from "viem";
import { rejectCrossSite } from "@/lib/server/guard";
import { WrappedCardInput } from "@/lib/receipts/wrapped-schema";
import { extractJson } from "@/lib/receipts/judge-core";
import { browserJudgeInfo } from "@/lib/receipts/week";
import { readJson, writeJson } from "@/lib/receipts/store";
import { DAY_NAMES, PERSONAS, SEGMENT_COPY, hourLabel, minutesLabel } from "@/lib/receipts/wrapped";
import { Payer, ZgAnswer } from "@/lib/server/zerog-answer";

export const maxDuration = 60;

// "Roast me": the private AI on 0G writes one playful line about the Wrapped, paid from the
// person's own 0G account (Sign in with 0G). It gets the numbers only (persona, minutes, counts),
// never a message or a word the person typed. "plan" builds the message (or returns the line kept
// for the same numbers, so they never cost twice); the browser asks 0G; "save" keeps the line.

const int = z.number().int().min(0).max(1e9);
const Numbers = z.object({
  card: WrappedCardInput.omit({ r: true }),
  extra: z.object({ conversations: int, words: int, manners: int, questions: int, whys: int, avalanches: int, activeDays: int, peakDay: z.number().int().min(0).max(6) }),
});
const Body = z.discriminatedUnion("action", [Numbers.extend({ action: z.literal("plan") }), Numbers.extend({ action: z.literal("save"), payer: Payer, answer: ZgAnswer })]);

export const ROAST_SYSTEM = `You write one playful line for someone's "AI Wrapped", a yearly-recap style summary of how they talk to AI. You only get numbers.

Rules:
- One or two short sentences, 30 words at most.
- Teasing but kind, like a friend. Nothing about looks, identity, health, money or intelligence.
- Use one or two of the numbers.
- Plain, simple English. No em dashes, no emoji, no hashtags, no quotes around the line.
- Reply with JSON only: {"line":"..."}`;

type Saved = { line: string; model?: string; verified?: boolean; requestId?: string; costUsd?: number; payer?: string; at: string };

function message({ card: c, extra: x }: z.infer<typeof Numbers>) {
  const p = PERSONAS[c.p];
  return [
    `Persona: ${p.name} (${p.line})`,
    c.t.length ? `Runner-up traits: ${c.t.map((t) => PERSONAS[t].name).join(", ")}` : "",
    `Period: ${c.l}`,
    `Total time with AI, all messages together: ${minutesLabel(c.m)} over ${x.conversations} conversations, ${c.n} messages, ${x.words} words, on ${x.activeDays} days (longest streak ${c.st} days)`,
    `Biggest parts of that time: ${c.s.map(([k, n, m]) => `${SEGMENT_COPY[k].label}: ${n} messages, ${minutesLabel(m)}`).join("; ")}`,
    `After midnight: ${c.ns}% of messages. Busiest hour: ${hourLabel(c.ph)}. Busiest day: ${DAY_NAMES[x.peakDay]}.`,
    `Please, thanks or sorry: ${x.manners}. Asked "why": ${x.whys}. Messages with three or more questions: ${x.avalanches}. Questions: ${x.questions}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function tidy(content: string) {
  let line: string;
  try {
    line = String(extractJson(content, "line").line ?? "");
  } catch {
    line = content.replace(/<think>[\s\S]*?<\/think>/g, "");
  }
  return line
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 220);
}

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  const b = parsed.data;
  const user = message(b);
  const hash = keccak256(stringToHex(ROAST_SYSTEM + "\n" + user));
  const saved = readJson<Record<string, Saved>>("local", "wrapped-roasts.json", {});

  if (b.action === "plan") {
    if (saved[hash]) return NextResponse.json({ ok: true, cached: true, ...saved[hash] });
    return NextResponse.json({ ok: true, cached: false, system: ROAST_SYSTEM, user, hash });
  }

  if (b.answer.hash !== hash) return NextResponse.json({ ok: false, error: "That answer is for different numbers." }, { status: 400 });
  const line = tidy(b.answer.content);
  if (!line) return NextResponse.json({ ok: false, error: "The private AI gave an empty answer." }, { status: 502 });
  const info = await browserJudgeInfo(b.answer as never, b.payer);
  const out: Saved = { line, model: info.model, verified: info.verified, requestId: info.requestId, costUsd: info.costUsd, payer: b.payer, at: new Date().toISOString() };
  writeJson("local", "wrapped-roasts.json", { ...saved, [hash]: out });
  return NextResponse.json({ ok: true, cached: false, ...out });
}
