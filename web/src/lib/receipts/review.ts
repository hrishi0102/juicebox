// Private weekly review: the 0G judge looks at the whole week (one line per session, plus the first
// ask of each session, trimmed) and writes a short review with the three most useful changes.
// The answer is kept; what was sent is only kept as a hash.

import { keccak256, stringToHex } from "viem";
import { z } from "zod";
import { chat, selfVerifyTee, type JudgeConfig } from "./judge";
import { buildPrivateDigest, DEFAULT_LOG_ROOT } from "./parse";
import { sessionUsd } from "./pricing";
import type { Dataset } from "./pipeline";
import type { JudgeInfo } from "./types";

export type WeeklyReview = {
  week: string;
  source: "local" | "demo";
  summary: string;
  tips: string[];
  judge: JudgeInfo;
  createdAt: string;
};

export const REVIEW_SYSTEM = `You are a private coach for one engineer. You see one week of their AI coding sessions: one line per session with its label, cost, difficulty, how it went, what happened on GitHub, and the first thing they asked (trimmed).

Write:
- "summary": two sentences on what the week's spend bought and where it leaked.
- "tips": the three most useful, concrete changes to waste less next week, each under 25 words.

Rules:
- Never quote or repeat prompts, file names, repo names, people or company names.
- Plain, simple English. No em dashes.
- Reply with JSON only: {"summary":"...","tips":["...","...","..."]}`;

const Answer = z.object({ summary: z.string().max(800), tips: z.array(z.string().max(300)).max(5) });

export async function buildWeekDigest(d: Dataset, weekStart: string, weekEnd: string) {
  const judgeBy = new Map(d.judgements.map((j) => [j.sessionId, j]));
  const changeBy = new Map(d.changes.map((c) => [c.key, c]));
  const sessions = d.sessions
    .filter((s) => Date.parse(s.startedAt) >= Date.parse(weekStart) && Date.parse(s.startedAt) < Date.parse(weekEnd))
    .sort((a, b) => sessionUsd(b) - sessionUsd(a))
    .slice(0, 25);
  const lines: string[] = [];
  for (const s of sessions) {
    const j = judgeBy.get(s.id);
    const g = s.signals;
    const outcome = d.matches
      .filter((m) => m.sessionId === s.id)
      .map((m) => changeBy.get(m.changeKey))
      .filter(Boolean)
      .map((c) => `${c!.reverted ? "reverted" : c!.state} (+${c!.additions} lines${c!.survival ? `, ${Math.round(c!.survival.ratio * 100)}% alive` : ""})`)
      .join(", ");
    let firstAsk = s.title ?? "";
    if (d.source === "local") {
      const digest = await buildPrivateDigest(s, d.meta.logRoot ?? DEFAULT_LOG_ROOT);
      firstAsk = digest.prompts[0]?.slice(0, 160) ?? firstAsk;
    }
    lines.push(
      `- [${j?.label ?? "Open"}] $${sessionUsd(s).toFixed(2)}, difficulty ${j?.difficulty ?? "?"}, ${s.activeMinutes} min, ${g.userPrompts} prompts, ` +
        `${g.toolErrors} tool errors (longest streak ${g.maxErrorStreak}), ${g.repeatedCommands} repeated commands, ${g.testRuns} test runs; ` +
        `outcome: ${outcome || "nothing linked"}; first ask: "${firstAsk.replace(/"/g, "'")}"`,
    );
  }
  return lines.join("\n");
}

export async function reviewWeek(cfg: JudgeConfig, d: Dataset, week: { id: string; start: string; end: string }): Promise<WeeklyReview> {
  const digest = await buildWeekDigest(d, week.start, week.end);
  if (!digest) throw new Error("No sessions in this week.");
  const user = `WEEK ${week.id}\n${digest}`;
  const r = await chat(cfg, REVIEW_SYSTEM, user);
  const cleaned = r.content.replace(/<think>[\s\S]*?<\/think>/g, "");
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("The review answer had no JSON.");
  const a = Answer.parse(JSON.parse(m[0]));
  const selfVerified = cfg.engine === "0g" && cfg.selfVerify && r.provider && r.chatId ? await selfVerifyTee(r.provider, r.chatId) : undefined;
  return {
    week: week.id,
    source: d.source,
    summary: a.summary,
    tips: a.tips.slice(0, 3),
    judge: {
      engine: cfg.engine === "0g" ? "0g-tee" : "openai-compatible",
      model: r.model,
      provider: r.provider,
      requestId: r.requestId,
      chatId: r.chatId,
      trustMode: cfg.engine === "0g" ? (cfg.trustMode ?? "private") : undefined,
      sealed: r.sealed,
      teeVerified: r.teeVerified,
      selfVerified,
      verified: !!(r.teeVerified || selfVerified),
      requestHash: keccak256(stringToHex(REVIEW_SYSTEM + "\n" + user)),
      responseHash: keccak256(stringToHex(r.content)),
      at: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  };
}
