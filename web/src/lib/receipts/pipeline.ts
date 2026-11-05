// End-to-end pipeline: scan logs -> match to GitHub -> outcomes -> judge -> save.
// All output goes to ~/.receipts (never into the repo).

import { GitHub } from "./github";
import { judgeConfigFromEnv, judgeSessions, type JudgeConfig } from "./judge";
import { matchSessions, pool } from "./match";
import { detectReverts, measureSurvival } from "./outcomes";
import { scanSessions } from "./parse";
import { buildTasks } from "./score";
import { readJson, writeJson, type Source } from "./store";
import type { Change, Judgement, Session, SessionMatch, Task } from "./types";

export type Dataset = {
  generatedAt: string;
  source: Source;
  owner?: string;
  sessions: Session[];
  changes: Change[];
  matches: SessionMatch[];
  judgements: Judgement[];
  tasks: Task[];
  meta: { days: number; githubCalls?: number; judge: JudgeConfig["engine"]; logRoot?: string };
};

export type Progress = (stage: string, detail?: string) => void;

export async function runPipeline(opts: { days?: number; judge?: JudgeConfig; skipJudge?: boolean; skipSurvival?: boolean; logRoot?: string; progress?: Progress } = {}): Promise<Dataset> {
  const days = opts.days ?? 30;
  const progress = opts.progress ?? (() => {});
  const since = new Date(Date.now() - days * 86400_000);

  progress("scan", `Reading Claude Code logs from the last ${days} days`);
  const sessions = await scanSessions({ since, root: opts.logRoot, onProgress: (d, t) => d % 10 === 0 && progress("scan", `${d}/${t} files`) });
  progress("scan", `${sessions.length} sessions`);

  const gh = new GitHub();
  let changes: Change[] = [];
  let matches: SessionMatch[] = [];
  if (gh.authed) {
    progress("match", "Linking sessions to pull requests");
    ({ changes, matches } = await matchSessions(gh, sessions, (m) => progress("match", m)));
    progress("match", `${matches.length} links to ${changes.length} changes`);

    progress("outcomes", "Checking for reverts");
    await detectReverts(gh, changes);
    if (!opts.skipSurvival) {
      const merged = changes.filter((c) => c.mergedAt && !c.reverted);
      let n = 0;
      await pool(merged, 4, async (c) => {
        try {
          c.survival = await measureSurvival(gh, c);
        } catch (e) {
          progress("outcomes", `survival failed for ${c.key}: ${String(e).slice(0, 80)}`);
        }
        n++;
        if (n % 5 === 0) progress("outcomes", `survival ${n}/${merged.length}`);
      });
    }
  } else {
    progress("match", "No GitHub token (set GITHUB_TOKEN or run `gh auth login`). Skipping outcomes.");
  }

  // AI judgements cost money and time. Keep earlier ones for sessions that have not changed since
  // (same end time and same number of model calls); only new or changed sessions get judged again.
  // The outcome must not have changed either (an open PR that merged since needs a new verdict).
  const previous = loadDataset("local");
  const prevSession = new Map((previous?.sessions ?? []).map((s) => [s.id, s]));
  const outcomeKey = (id: string, ms: SessionMatch[], cs: Change[]) => {
    const byKey = new Map(cs.map((c) => [c.key, c]));
    return ms
      .filter((m) => m.sessionId === id)
      .map((m) => `${m.changeKey}:${byKey.get(m.changeKey)?.state}:${byKey.get(m.changeKey)?.reverted}`)
      .sort()
      .join("|");
  };
  const keepAi = new Map(
    (previous?.judgements ?? [])
      .filter((j) => j.judge.engine !== "heuristic")
      .filter((j) => {
        const before = prevSession.get(j.sessionId);
        const now = sessions.find((s) => s.id === j.sessionId);
        return (
          before &&
          now &&
          before.endedAt === now.endedAt &&
          before.signals.assistantTurns === now.signals.assistantTurns &&
          outcomeKey(j.sessionId, previous!.matches, previous!.changes) === outcomeKey(j.sessionId, matches, changes)
        );
      })
      .map((j) => [j.sessionId, j]),
  );

  const cfg = opts.skipJudge ? ({ engine: "heuristic" } as JudgeConfig) : (opts.judge ?? judgeConfigFromEnv());
  progress("judge", cfg.engine === "heuristic" ? "Labeling sessions with offline rules" : `Labeling sessions privately with ${cfg.engine} (${cfg.model})`);
  const toJudge = cfg.engine === "heuristic" ? undefined : new Set(sessions.filter((s) => !keepAi.has(s.id)).map((s) => s.id));
  const fresh = await judgeSessions(sessions, matches, changes, cfg, {
    logRoot: opts.logRoot,
    only: toJudge,
    onProgress: (d, t) => progress("judge", `${d}/${t}`),
  });
  const judgements = fresh.map((j) => keepAi.get(j.sessionId) ?? j);
  if (keepAi.size) progress("judge", `kept ${keepAi.size} earlier private judgements for unchanged sessions`);

  const tasks = buildTasks(sessions, matches, changes, judgements);
  const data: Dataset = {
    generatedAt: new Date().toISOString(),
    source: "local",
    owner: process.env.RECEIPTS_OWNER,
    sessions,
    changes,
    matches,
    judgements,
    tasks,
    meta: { days, githubCalls: gh.calls, judge: cfg.engine, logRoot: opts.logRoot },
  };
  saveDataset(data);
  progress("done", `Saved to ~/.receipts`);
  return data;
}

export function saveDataset(d: Dataset) {
  writeJson(d.source, "dataset.json", d);
  writeJson(d.source, "sessions.json", { count: d.sessions.length, generatedAt: d.generatedAt });
}

export function loadDataset(source: Source): Dataset | undefined {
  const d = readJson<Dataset | null>(source, "dataset.json", null);
  return d ?? undefined;
}

/** Re-judge (for example with 0G) without rescanning. */
export async function rejudge(source: Source, cfg: JudgeConfig, only?: Set<string>, progress?: Progress) {
  const d = loadDataset(source);
  if (!d) throw new Error("No dataset yet. Run a scan first.");
  const fresh = await judgeSessions(d.sessions, d.matches, d.changes, cfg, { logRoot: d.meta.logRoot, only, onProgress: (a, b) => progress?.("judge", `${a}/${b}`) });
  const keep = new Map(d.judgements.map((j) => [j.sessionId, j]));
  for (const j of fresh) if (!only || only.has(j.sessionId)) keep.set(j.sessionId, j);
  d.judgements = [...keep.values()];
  d.tasks = buildTasks(d.sessions, d.matches, d.changes, d.judgements);
  d.meta.judge = cfg.engine;
  saveDataset(d);
  return d;
}
