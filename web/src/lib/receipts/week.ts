// Writes "what you got done this week" with the private AI, on demand (a button or the CLI).
// Nothing here runs in the background.
//
//   1. Sessions in the week that only have rule-based labels go to the private AI one by one
//      (0G TEE, prompts and the AI's last answers in a private digest). Each gets a category + title.
//   2. One more call merges those lines (titles only, no prompts) into a short list and a sentence.
//
// The story is saved to ~/.receipts/weeks/<week>.json. Demo stories go to ~/.receipts/demo-weeks/,
// with a committed copy in fixtures/demo/weeks/ so the hosted demo has one too.

import { chat, judgeConfigFromEnv, judgeInfoFor, judgeSessions, needsAi, type JudgeConfig } from "./judge";
import { parseWeekAnswer, weekMessage, WEEK_SYSTEM } from "./judge-core";
import { loadDataset, saveDataset, type Dataset } from "./pipeline";
import { buildTasks, weekOf } from "./score";
import { countLine, itemsFromAnswer, ruleStory, sessionLines, sessionsHash, type StoryInput } from "./story";
import { readJson, writeJson, type Source } from "./store";
import type { Session, WeekStory } from "./types";

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
