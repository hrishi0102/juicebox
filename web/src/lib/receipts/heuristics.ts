// Offline judge. Gives every session a label and difficulty from log signals and GitHub outcomes.
// It is the fallback when the private AI judge (0G) is not configured, and the AI judge sees
// these signals too.

import { sessionUsd } from "./pricing";
import type { Change, ChangeKind, Judgement, Session, SessionLabel, SessionMatch } from "./types";

const DAY = 86400_000;
// What a small (difficulty 1 or 2) task usually costs in Claude Code at API prices. Only used when
// there are too few shipped small tasks in the data to measure it.
const SMALL_TASK_USD = 5;

export type Linked = { change: Change; confidence: number };

export function linkedChanges(session: Session, matches: SessionMatch[], changes: Map<string, Change>): Linked[] {
  return matches
    .filter((m) => m.sessionId === session.id)
    .map((m) => ({ change: changes.get(m.changeKey)!, confidence: m.confidence }))
    .filter((l) => l.change);
}

export function loopScore(s: Session) {
  const g = s.signals;
  let score = 0;
  if (g.maxErrorStreak >= 5) score += 2;
  else if (g.maxErrorStreak >= 3) score += 1;
  if (g.repeatedCommands >= 3) score += 1;
  if (g.maxEditsSameFile >= 15) score += 1;
  if (g.toolCalls >= 20 && g.toolErrors / g.toolCalls > 0.3) score += 1;
  if (g.interruptions >= 3) score += 1;
  if (g.apiErrors >= 5) score += 1;
  return score;
}

export function sizeToDifficulty(size: number, files: number): 1 | 2 | 3 | 4 | 5 {
  let d = size < 15 ? 1 : size < 80 ? 2 : size < 300 ? 3 : size < 1200 ? 4 : 5;
  if (files >= 15) d += 1;
  if (files <= 1 && size < 40) d = Math.min(d, 1);
  return Math.max(1, Math.min(5, d)) as 1 | 2 | 3 | 4 | 5;
}

/** Difficulty of a change (PR or commit) from its size. Used for tasks. */
export function changeDifficulty(c: Pick<Change, "additions" | "deletions" | "files">) {
  return sizeToDifficulty(c.additions + c.deletions, c.files.length);
}

/**
 * Difficulty of the session's own work. A session that only opened a big PR did small work,
 * so we look at what the session itself edited, or at its effort when it edited nothing.
 */
export function estimateDifficulty(s: Session, _linked: Linked[] = []): 1 | 2 | 3 | 4 | 5 {
  void _linked;
  if (s.filesEdited.length) return sizeToDifficulty(s.linesAdded + s.linesRemoved, s.filesEdited.length);
  const m = s.activeMinutes;
  return (m < 15 ? 1 : m < 45 ? 2 : m < 120 ? 3 : 4) as 1 | 2 | 3 | 4;
}

export function pickKind(linked: Linked[]): ChangeKind {
  const sorted = [...linked].sort((a, b) => b.confidence - a.confidence);
  return sorted[0]?.change.kind ?? "other";
}

/** First pass: everything except Overkill, which needs the whole dataset. */
export function heuristicLabel(s: Session, linked: Linked[], now = Date.now()): { label: SessionLabel; reason: string; confidence: number } {
  const merged = linked.filter((l) => (l.change.state === "merged" || l.change.state === "direct") && !l.change.reverted);
  const open = linked.filter((l) => l.change.state === "open");
  const dead = linked.filter((l) => l.change.state === "closed" || l.change.reverted);
  const loops = loopScore(s);
  const edits = s.filesEdited.length > 0 || s.linesAdded > 0;

  if (merged.length) {
    if (loops >= 3) return { label: "Looped", reason: `Shipped ${merged.length} change(s), but spent a lot of the session retrying (loop score ${loops}).`, confidence: 0.6 };
    return { label: "Shipped", reason: `Linked to ${merged.length} merged change(s).`, confidence: 0.75 };
  }
  if (open.length) return { label: "Pending", reason: `Linked PR still open.`, confidence: 0.6 };
  if (loops >= 3) return { label: "Looped", reason: `Repeated failing steps (loop score ${loops}) and nothing shipped.`, confidence: 0.6 };
  if (dead.length) return { label: "Abandoned", reason: `Linked change was closed or reverted.`, confidence: 0.7 };
  if (edits) {
    if (now - Date.parse(s.endedAt) < 3 * DAY) return { label: "Pending", reason: "Fresh edits, not linked to a PR yet.", confidence: 0.4 };
    // Without a known repo we could not check GitHub, so we do not call it abandoned.
    if (!s.repos.length) return { label: "Pending", reason: "Edited code in a folder with no GitHub repo we could find, so it is not judged.", confidence: 0.3 };
    return { label: "Abandoned", reason: "Edited code, but no PR or commit in the repo shipped it.", confidence: 0.5 };
  }
  return { label: "Learned", reason: "Mostly reading and questions, no code changes.", confidence: 0.55 };
}

/** Full heuristic judge over a dataset (adds Overkill by comparing against similar shipped work). */
export function judgeAllHeuristic(sessions: Session[], matches: SessionMatch[], changes: Change[], now = Date.now()) {
  const byKey = new Map(changes.map((c) => [c.key, c]));
  const first = sessions.map((s) => {
    const linked = linkedChanges(s, matches, byKey);
    const l = heuristicLabel(s, linked, now);
    return { s, linked, ...l, difficulty: estimateDifficulty(s, linked), kind: pickKind(linked) };
  });

  // Overkill only makes sense for small work: a sledgehammer for a small nail. The yardstick is the
  // median cost of other shipped sessions whose linked work was also small (difficulty 1 or 2).
  // With few samples the outliers themselves would set the bar, so fall back to a fixed yardstick.
  const small = first.filter((f) => f.label === "Shipped" && f.difficulty <= 2).map((f) => sessionUsd(f.s));
  const smallMedian = small.length >= 5 ? median(small) : SMALL_TASK_USD;
  const overkillAt = Math.max(15, 4 * smallMedian);

  return first.map((f): Judgement => {
    let label = f.label;
    let reason = f.reason;
    const usd = sessionUsd(f.s);
    if (label === "Shipped" && f.difficulty <= 2 && usd > overkillAt) {
      label = "Overkill";
      reason = `Shipped small work (difficulty ${f.difficulty}) for $${usd.toFixed(2)}; similar small tasks cost about $${smallMedian.toFixed(2)}.`;
    }
    return {
      sessionId: f.s.id,
      label,
      difficulty: f.difficulty,
      kind: f.kind,
      confidence: f.confidence,
      reason,
      judge: { engine: "heuristic", at: new Date(now).toISOString() },
    };
  });
}

export function medianShippedCost(rows: { label: string; difficulty: number; usd: number }[]) {
  const by: Record<number, number[]> = {};
  for (const r of rows) if (r.label === "Shipped" || r.label === "Overkill") (by[r.difficulty] ??= []).push(r.usd);
  const out: Record<number, number> = {};
  for (const [d, list] of Object.entries(by)) out[Number(d)] = median(list);
  return out;
}

export function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
