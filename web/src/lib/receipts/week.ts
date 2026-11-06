// Writes "what you got done this week" with the private AI, on demand (a button or the CLI).
// Nothing here runs in the background.
//
//   1. Sessions in the week that only have rule-based labels go to the private AI one by one
//      (0G TEE, prompts and the AI's last answers in a private digest). Each gets a category + title.
//   2. One more call merges those lines (titles only, no prompts) into a short list and a sentence.
//
// The story is saved to ~/.receipts/weeks/<week>.json. Demo stories go to ~/.receipts/demo-weeks/,
// with a committed copy in fixtures/demo/weeks/ so the hosted demo has one too.

import { keccak256, stringToHex, type Hex } from "viem";
import { chat, judgeConfigFromEnv, judgeInfoFor, judgementFromAnswer, judgeSessions, needsAi, selfVerifyTee, sessionPrompt, type JudgeConfig } from "./judge";
import { parseWeekAnswer, weekMessage, SESSION_SYSTEM, WEEK_SYSTEM, type ChatReply } from "./judge-core";
import { judgeAllHeuristic, loopScore } from "./heuristics";
import { loadDataset, saveDataset, type Dataset } from "./pipeline";
import { buildTasks, weekOf } from "./score";
import { countLine, itemsFromAnswer, ruleStory, sessionLines, sessionsHash, type StoryInput } from "./story";
import { readJson, writeJson, type Source } from "./store";
import type { JudgeInfo, Session, WeekStory } from "./types";

export type WeekProgress = (stage: "sessions" | "week" | "done", detail: string) => void;

function storyPath(source: Source, week: string) {
  return source === "demo" ? `demo-weeks/${week}.json` : `weeks/${week}.json`;
}

export function loadWeekStory(source: Source, week: string): WeekStory | undefined {
  // Both live in ~/.receipts ("local" is that folder); the demo also has a committed copy.
  const saved = readJson<WeekStory | null>("local", storyPath(source, week), null);
  if (saved) return saved;
  return source === "demo" ? (readJson<WeekStory | null>("demo", `weeks/${week}.json`, null) ?? undefined) : undefined;
}

export function sessionsInWeek(d: Dataset, week: string): Session[] {
  return d.sessions.filter((s) => weekOf(new Date(s.startedAt)).id === week);
}

export type WriteResult = { story: WeekStory; judged: number; failed: number; error?: string };

export async function writeWeekStory(source: Source, week: string, opts: { cfg?: JudgeConfig; progress?: WeekProgress } = {}): Promise<WriteResult> {
  const cfg = opts.cfg ?? judgeConfigFromEnv();
  const progress = opts.progress ?? (() => {});
  const d = loadDataset(source);
  if (!d) throw new Error("No data yet. Read your logs first.");
  const sessions = sessionsInWeek(d, week);
  if (!sessions.length) throw new Error(`No sessions in ${week}.`);
  const ai = cfg.engine !== "heuristic";

  // 1. Sessions still on rule-based labels go to the private AI. The demo has no transcripts.
  let judged = 0;
  let failed = 0;
  if (ai && source === "local") {
    const judgeBy = new Map(d.judgements.map((j) => [j.sessionId, j]));
    const need = new Set(sessions.filter((s) => needsAi(judgeBy.get(s.id))).map((s) => s.id));
    if (need.size) {
      progress("sessions", `Asking the private AI about ${need.size} session${need.size === 1 ? "" : "s"}`);
      const fresh = await judgeSessions(d.sessions, d.matches, d.changes, cfg, {
        logRoot: d.meta.logRoot,
        only: need,
        concurrency: 6,
        onProgress: (n, t) => progress("sessions", `${n}/${t} sessions`),
      });
      for (const j of fresh) {
        if (!need.has(j.sessionId)) continue;
        if (j.judge.engine === "heuristic") failed++;
        else judged++;
        judgeBy.set(j.sessionId, j);
      }
      d.judgements = [...judgeBy.values()];
      d.tasks = buildTasks(d.sessions, d.matches, d.changes, d.judgements);
      saveDataset(d);
    }
  }

  const input: StoryInput = { sessions, judgements: d.judgements, tasks: d.tasks };
  let story = ruleStory(week, source, input);
  let error: string | undefined;

  // 2. One call turns the session lines into the weekly list. It sees titles only, never prompts.
  if (ai) {
    try {
      progress("week", "Writing your week");
      const lines = sessionLines(input);
      const msg = weekMessage(week, lines);
      const r = await chat(cfg, WEEK_SYSTEM, msg, 1800);
      const answer = parseWeekAnswer(r.content);
      const items = itemsFromAnswer(answer.items, lines, input);
      const info = await judgeInfoFor(cfg, r, WEEK_SYSTEM + "\n" + msg);
      const ids = new Set(sessions.map((s) => s.id));
      const sessionCalls = d.judgements.filter((j) => ids.has(j.sessionId) && j.judge.engine !== "heuristic");
      story = {
        week,
        source,
        items,
        oneLiner: answer.summary || countLine(items),
        engine: info.engine === "0g-tee" ? "0g-tee" : "openai-compatible",
        model: info.model,
        requestIds: [info.requestId, ...sessionCalls.map((j) => j.judge.requestId)].filter((x): x is string => !!x),
        verified: !!info.verified && sessionCalls.every((j) => j.judge.verified),
        payer: "app key",
        sessionsHash: sessionsHash(sessions),
        createdAt: new Date().toISOString(),
      };
    } catch (e) {
      error = `The private AI could not write the week, so this list comes from simple rules. ${String(e).slice(0, 200)}`;
    }
  }

  writeJson("local", storyPath(source, week), story);
  progress("done", `${story.items.length} items`);
  return { story, judged, failed, error };
}

// ---- Paying with your own 0G credits ("Sign in with 0G") ----
// This is how the web app pays for every private AI call. The browser makes the call with the
// person's 0G session, so the cost lands on their own 0G account (their daily credits). This server
// still builds every message and keeps the results, in three steps. The app's own key
// (ZG_API_KEY) is only used by the command line (`npm run receipts -- write`).

export type PlanItem = { sessionId: string; user: string; hash: Hex };
export type BrowserAnswer = { sessionId?: string; content: string; hash: Hex; reply: ChatReply };

function mustLoad(source: Source) {
  const d = loadDataset(source);
  if (!d) throw new Error("No data yet. Read your logs first.");
  return d;
}

/** Step 1: the private message for each session that still needs the AI (local logs only). */
export async function browserPlan(source: Source, week: string): Promise<{ system: string; sessions: PlanItem[]; next?: ReturnType<typeof weekPlan> }> {
  const d = mustLoad(source);
  const sessions = sessionsInWeek(d, week);
  if (source !== "local") return { system: SESSION_SYSTEM, sessions: [], next: weekPlan(d, week) };
  const base = new Map(judgeAllHeuristic(d.sessions, d.matches, d.changes).map((j) => [j.sessionId, j]));
  const judgeBy = new Map(d.judgements.map((j) => [j.sessionId, j]));
  const out: PlanItem[] = [];
  for (const s of sessions.filter((x) => needsAi(judgeBy.get(x.id)))) {
    const p = await sessionPrompt(s, base.get(s.id)!, d.matches, d.changes, d.meta.logRoot);
    out.push({ sessionId: s.id, user: p.user, hash: keccak256(stringToHex(p.sent)) });
  }
  return { system: SESSION_SYSTEM, sessions: out, next: out.length ? undefined : weekPlan(d, week) };
}

/** The private message for chosen sessions, asked again even if the AI already wrote their line. */
export async function browserPlanSessions(source: Source, sessionIds: string[]): Promise<{ system: string; sessions: PlanItem[] }> {
  const d = mustLoad(source);
  if (source !== "local") return { system: SESSION_SYSTEM, sessions: [] };
  const want = new Set(sessionIds);
  const base = new Map(judgeAllHeuristic(d.sessions, d.matches, d.changes).map((j) => [j.sessionId, j]));
  const out: PlanItem[] = [];
  for (const s of d.sessions.filter((x) => want.has(x.id))) {
    const p = await sessionPrompt(s, base.get(s.id)!, d.matches, d.changes, d.meta.logRoot);
    out.push({ sessionId: s.id, user: p.user, hash: keccak256(stringToHex(p.sent)) });
  }
  return { system: SESSION_SYSTEM, sessions: out };
}

function weekPlan(d: Dataset, week: string) {
  const input: StoryInput = { sessions: sessionsInWeek(d, week), judgements: d.judgements, tasks: d.tasks };
  const user = weekMessage(week, sessionLines(input));
  return { system: WEEK_SYSTEM, user, hash: keccak256(stringToHex(WEEK_SYSTEM + "\n" + user)) };
}

/** The record kept for one answer the browser got from 0G: model, request id, TEE checks, payer. */
export async function browserJudgeInfo(a: BrowserAnswer, payer: string): Promise<JudgeInfo> {
  const r = a.reply;
  const selfVerified = r.provider && r.chatId && process.env.ZG_SELF_VERIFY !== "0" ? await selfVerifyTee(r.provider, r.chatId) : undefined;
  return {
    engine: "0g-tee",
    model: r.model,
    provider: r.provider,
    requestId: r.requestId,
    chatId: r.chatId,
    trustMode: "private",
    sealed: r.sealed,
    teeVerified: r.teeVerified,
    selfVerified,
    verified: !!(r.teeVerified || selfVerified),
    requestHash: a.hash,
    responseHash: keccak256(stringToHex(a.content)),
    costUsd: r.costUsd,
    payer,
    at: new Date().toISOString(),
  };
}

/** Step 2: the AI's answers (from the browser) become judgements. With a week, returns its weekly message. */
export async function browserSessions(source: Source, week: string | undefined, answers: BrowserAnswer[], payer: string) {
  const d = mustLoad(source);
  const base = new Map(judgeAllHeuristic(d.sessions, d.matches, d.changes).map((j) => [j.sessionId, j]));
  const judgeBy = new Map(d.judgements.map((j) => [j.sessionId, j]));
  let judged = 0;
  let failed = 0;
  for (const a of answers) {
    const s = d.sessions.find((x) => x.id === a.sessionId);
    if (!s) continue;
    try {
      judgeBy.set(s.id, judgementFromAnswer(s, base.get(s.id)!, loopScore(s), a.content, await browserJudgeInfo(a, payer)));
      judged++;
    } catch {
      failed++;
    }
  }
  d.judgements = [...judgeBy.values()];
  d.tasks = buildTasks(d.sessions, d.matches, d.changes, d.judgements);
  saveDataset(d);
  return { judged, failed, next: week ? weekPlan(d, week) : undefined };
}

/** Step 3: the weekly answer (from the browser) becomes the saved list. */
export async function browserWeek(source: Source, week: string, answer: BrowserAnswer, payer: string): Promise<WeekStory> {
  const d = mustLoad(source);
  const sessions = sessionsInWeek(d, week);
  const input: StoryInput = { sessions, judgements: d.judgements, tasks: d.tasks };
  const parsed = parseWeekAnswer(answer.content);
  const items = itemsFromAnswer(parsed.items, sessionLines(input), input);
  const info = await browserJudgeInfo(answer, payer);
  const ids = new Set(sessions.map((s) => s.id));
  const sessionCalls = d.judgements.filter((j) => ids.has(j.sessionId) && j.judge.engine !== "heuristic");
  const story: WeekStory = {
    week,
    source,
    items,
    oneLiner: parsed.summary || countLine(items),
    engine: "0g-tee",
    model: info.model,
    requestIds: [info.requestId, ...sessionCalls.map((j) => j.judge.requestId)].filter((x): x is string => !!x),
    verified: !!info.verified && sessionCalls.every((j) => j.judge.verified),
    payer,
    sessionsHash: sessionsHash(sessions),
    createdAt: new Date().toISOString(),
  };
  writeJson("local", storyPath(source, week), story);
  return story;
}
