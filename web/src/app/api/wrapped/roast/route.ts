import { NextResponse } from "next/server";
import { z } from "zod";
import { keccak256, stringToHex } from "viem";
import { rejectCrossSite } from "@/lib/server/guard";
import { WrappedCardInput } from "@/lib/server/wrapped-card";
import { chat, judgeConfigFromEnv } from "@/lib/receipts/judge";
import { extractJson } from "@/lib/receipts/judge-core";
import { readJson, writeJson } from "@/lib/receipts/store";
import { DAY_NAMES, PERSONAS, SEGMENT_COPY, hourLabel, minutesLabel } from "@/lib/receipts/wrapped";

export const maxDuration = 60;

// "Roast me": the private AI on 0G writes one playful line about the Wrapped. It gets the numbers
// only (persona, minutes, counts), never a message or a word the person typed. Answers are kept
// in ~/.receipts so the same numbers never cost twice, and new calls are capped per hour.

const int = z.number().int().min(0).max(1e9);
const Body = z.object({
  card: WrappedCardInput.omit({ r: true }),
  extra: z.object({ conversations: int, words: int, manners: int, questions: int, whys: int, avalanches: int, activeDays: int, peakDay: z.number().int().min(0).max(6) }),
});

export const ROAST_SYSTEM = `You write one playful line for someone's "AI Wrapped", a yearly-recap style summary of how they talk to AI. You only get numbers.

Rules:
- One or two short sentences, 30 words at most.
- Teasing but kind, like a friend. Nothing about looks, identity, health, money or intelligence.
- Use one or two of the numbers.
- Plain, simple English. No em dashes, no emoji, no hashtags, no quotes around the line.
- Reply with JSON only: {"line":"..."}`;

const LIMIT_PER_HOUR = 30;
const recent: number[] = [];
type Saved = { line: string; model?: string; verified?: boolean; requestId?: string; costUsd?: number; at: string };

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  const { card: c, extra: x } = parsed.data;

  const p = PERSONAS[c.p];
  const user = [
    `Persona: ${p.name} (${p.line})`,
    c.t.length ? `Runner-up traits: ${c.t.map((t) => PERSONAS[t].name).join(", ")}` : "",
    `Period: ${c.l}`,
    `Time with AI: ${minutesLabel(c.m)} over ${x.conversations} conversations, ${c.n} messages, ${x.words} words, on ${x.activeDays} days (longest streak ${c.st} days)`,
    `Top segments (messages, minutes): ${c.s.map(([k, n, m]) => `${SEGMENT_COPY[k].label} ${n}, ${m}`).join("; ")}`,
    `After midnight: ${c.ns}% of messages. Busiest hour: ${hourLabel(c.ph)}. Busiest day: ${DAY_NAMES[x.peakDay]}.`,
    `Please, thanks or sorry: ${x.manners}. Asked "why": ${x.whys}. Messages with three or more questions: ${x.avalanches}. Questions: ${x.questions}.`,
  ]
    .filter(Boolean)
    .join("\n");

  const key = keccak256(stringToHex(ROAST_SYSTEM + "\n" + user));
  const saved = readJson<Record<string, Saved>>("local", "wrapped-roasts.json", {});
  if (saved[key]) return NextResponse.json({ ok: true, cached: true, ...saved[key] });

  const cfg = judgeConfigFromEnv();
  if (cfg.engine !== "0g") return NextResponse.json({ ok: false, error: "Add a 0G key (ZG_API_KEY) to use the private AI." }, { status: 400 });
  const now = Date.now();
  while (recent.length && now - recent[0] > 3600_000) recent.shift();
  if (recent.length >= LIMIT_PER_HOUR) return NextResponse.json({ ok: false, error: "That is enough roasting for this hour. Try again later." }, { status: 429 });
  recent.push(now);

  try {
    const r = await chat(cfg, ROAST_SYSTEM, user, 160);
    let line: string;
    try {
      line = String(extractJson(r.content, "line").line ?? "");
    } catch {
      line = r.content.replace(/<think>[\s\S]*?<\/think>/g, "");
    }
    line = line.replace(/\s*[—–]\s*/g, ", ").replace(/^["'\s]+|["'\s]+$/g, "").replace(/\s+/g, " ").slice(0, 220);
    if (!line) throw new Error("The private AI gave an empty answer.");
    const out: Saved = { line, model: r.model, verified: !!r.teeVerified, requestId: r.requestId, costUsd: r.costUsd, at: new Date().toISOString() };
    writeJson("local", "wrapped-roasts.json", { ...saved, [key]: out });
    return NextResponse.json({ ok: true, cached: false, ...out });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
