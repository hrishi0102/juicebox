// How efficiently AI time turned into merged work, from timestamps only (logs and GitHub), so no AI
// call is needed and the numbers can be signed. Pure functions.
//
//   Timeline per item:  idea (first prompt) -> first code edit -> first commit -> PR opened -> merged
//   Waste per week:     plans nobody acted on, sessions left on the AI's question, stopped answers,
//                       loops, and code that never shipped
//   Where money went:   shipped, learning, still in progress, wasted

import { median } from "./heuristics";
import { sessionUsd } from "./pricing";
import type { Change, Judgement, Session, Task, WeekItem } from "./types";

export const STAGES = ["ideaToCode", "codeToCommit", "commitToPr", "prToMerge", "ideaToMerge"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = {
  ideaToCode: "Idea to code",
  codeToCommit: "Code to commit",
  commitToPr: "Commit to PR",
  prToMerge: "PR to merge",
  ideaToMerge: "Idea to merged",
};

export type ItemTimeline = {
  ideaAt?: string;
  firstEditAt?: string;
  firstCommitAt?: string;
  prOpenedAt?: string;
  mergedAt?: string;
} & Partial<Record<Stage, number>>; // minutes

export const WASTE = ["abandonedPlans", "leftHanging", "loops", "neverShipped", "stoppedAnswers"] as const;
export type WasteKind = (typeof WASTE)[number];
export const WASTE_LABEL: Record<WasteKind, string> = {
  abandonedPlans: "Plans nobody acted on",
  leftHanging: "Left on the AI's question",
  loops: "Went in circles",
  neverShipped: "Code that never shipped",
  stoppedAnswers: "Answers stopped midway",
};

export const SPEND = ["shipped", "learning", "inProgress", "wasted"] as const;
export type SpendKind = (typeof SPEND)[number];

export type Efficiency = {
  stages: Record<Stage, { medianMin: number | null; n: number }>;
  brainstormMinutes: number; // time with the AI before the first code edit
  prs: { opened: number; merged: number; open: number; closed: number; reverted: number };
  waste: Record<WasteKind, { count: number; usd: number; sessions: string[] }>;
  spend: Record<SpendKind, number>;
  costPerMergedPr: number | null;
  items: Record<string, ItemTimeline>;
};

const HOUR = 3600_000;
// A plan or an open question counts as dropped only after a day with no follow-up in the same place.
const PICKUP_MS = 24 * HOUR;
const LEARNING = new Set(["Figured out", "Researched", "Wrote", "Planned"]);

const t = (iso?: string) => (iso ? Date.parse(iso) : NaN);
const minutesBetween = (a?: string, b?: string) => {
  const d = (t(b) - t(a)) / 60000;
  return Number.isFinite(d) && d >= 0 ? Math.round(d) : undefined;
};
const minIso = (xs: (string | undefined)[]) => {
  const ns = xs.map(t).filter((n) => Number.isFinite(n));
  return ns.length ? new Date(Math.min(...ns)).toISOString() : undefined;
};

function sameWorkspace(a: Session, b: Session) {
  if (a.cwd && b.cwd && a.cwd.replace(/\/$/, "") === b.cwd.replace(/\/$/, "")) return true;
  return a.repos.some((r) => b.repos.includes(r));
}

/** Did any later session in the same workspace pick the work up within a day (with edits if `edits`)? */
function pickedUp(s: Session, all: Session[], edits: boolean) {
  const end = t(s.endedAt);
  return all.some((o) => {
    if (o.id === s.id) return false;
    const start = t(o.startedAt);
    if (!(start > end && start - end <= PICKUP_MS) || !sameWorkspace(s, o)) return false;
    return !edits || o.filesEdited.length > 0 || o.linesAdded > 0;
  });
}

export function itemTimeline(item: Pick<WeekItem, "sessions" | "prs">, sessionsById: Map<string, Session>, changeBy: Map<string, Change>): ItemTimeline {
  const ss = item.sessions.map((id) => sessionsById.get(id)).filter((s): s is Session => !!s);
  const prs = item.prs.map((p) => changeBy.get(p.key)).filter((c): c is Change => !!c);
  const merged = prs.filter((c) => c.mergedAt && !c.reverted);
  const tl: ItemTimeline = {
    ideaAt: minIso(ss.map((s) => s.timeline?.firstPromptAt ?? s.startedAt)),
    firstEditAt: minIso(ss.map((s) => s.timeline?.firstEditAt)),
    firstCommitAt: minIso([...ss.map((s) => s.timeline?.firstCommitAt), ...ss.flatMap((s) => s.git.commits.map((c) => c.at))]),
    prOpenedAt: minIso([...prs.filter((c) => c.type === "pr").map((c) => c.createdAt), ...ss.map((s) => s.timeline?.firstPrAt)]),
    mergedAt: minIso(merged.map((c) => c.mergedAt)),
  };
  tl.ideaToCode = minutesBetween(tl.ideaAt, tl.firstEditAt);
  tl.codeToCommit = minutesBetween(tl.firstEditAt, tl.firstCommitAt);
  tl.commitToPr = minutesBetween(tl.firstCommitAt, tl.prOpenedAt);
  tl.prToMerge = minutesBetween(tl.prOpenedAt, tl.mergedAt);
  tl.ideaToMerge = minutesBetween(tl.ideaAt, tl.mergedAt);
  return tl;
}

export function computeEfficiency(opts: {
  sessions: Session[]; // in the period
  allSessions: Session[]; // everything we know, to see whether work was picked up later
  judgements: Judgement[];
  tasks: Task[]; // in the period, costed for the period
  changes: Change[];
  items: WeekItem[];
  now?: number;
}): Efficiency {
  const now = opts.now ?? Date.now();
  const judgeBy = new Map(opts.judgements.map((j) => [j.sessionId, j]));
  const sessionsById = new Map(opts.allSessions.map((s) => [s.id, s]));
  const changeBy = new Map(opts.changes.map((c) => [c.key, c]));

  // Timelines per item, then the medians of each stage.
  const items: Record<string, ItemTimeline> = {};
  for (const i of opts.items) items[i.id] = itemTimeline(i, sessionsById, changeBy);
  const stages = Object.fromEntries(
    STAGES.map((st) => {
      const vals = Object.values(items)
        .map((tl) => tl[st])
        .filter((v): v is number => v !== undefined);
      return [st, { medianMin: vals.length ? Math.round(median(vals)) : null, n: vals.length }];
    }),
  ) as Efficiency["stages"];

  // Brainstorm time: active time before the first code edit (all of it when nothing was edited).
  let brainstormMinutes = 0;
  for (const s of opts.sessions) {
    const before = minutesBetween(s.timeline?.firstPromptAt ?? s.startedAt, s.timeline?.firstEditAt);
    brainstormMinutes += before === undefined ? s.activeMinutes : Math.min(s.activeMinutes, before);
  }

  // Waste, one reason per session (the first that applies), so dollars are never counted twice.
  const waste = Object.fromEntries(WASTE.map((w) => [w, { count: 0, usd: 0, sessions: [] as string[] }])) as Efficiency["waste"];
  const wasted = new Set<string>();
  const add = (w: WasteKind, s: Session, usd: number) => {
    waste[w].count++;
    waste[w].usd = Math.round((waste[w].usd + usd) * 100) / 100;
    waste[w].sessions.push(s.id);
  };
  for (const s of opts.sessions) {
    const j = judgeBy.get(s.id);
    const tl = s.timeline;
    const settled = now - t(s.endedAt) > PICKUP_MS; // too early to call it dropped otherwise
    const usd = sessionUsd(s);
    if (j?.label === "Looped") {
      add("loops", s, usd);
      wasted.add(s.id);
      continue;
    }
    if (j?.label === "Abandoned") {
      add("neverShipped", s, usd);
      wasted.add(s.id);
      continue;
    }
    const planned = !!tl?.planAt || j?.category === "Planned";
    const actedInSession = !!tl?.planAt && !!tl.lastEditAt && t(tl.lastEditAt) > t(tl.planAt);
    if (planned && !actedInSession && settled && !pickedUp(s, opts.allSessions, true)) {
      add("abandonedPlans", s, usd);
      wasted.add(s.id);
      continue;
    }
    // An open question costs little on its own, so it is counted but not charged.
    if (tl?.endsOnQuestion && settled && !pickedUp(s, opts.allSessions, false)) add("leftHanging", s, 0);
  }
  for (const s of opts.sessions) {
    if (s.signals.interruptions > 0) {
      waste.stoppedAnswers.count += s.signals.interruptions;
      if (!waste.stoppedAnswers.sessions.includes(s.id)) waste.stoppedAnswers.sessions.push(s.id);
    }
  }

  // Pull requests linked to this period's work.
  const prTasks = opts.tasks.filter((x) => x.changeKey.includes("#"));
  const isMerged = (x: Task) => (x.state === "merged" || x.state === "direct") && !x.reverted;
  const prs = {
    opened: prTasks.length,
    merged: prTasks.filter(isMerged).length,
    open: prTasks.filter((x) => x.state === "open").length,
    closed: prTasks.filter((x) => x.state === "closed").length,
    reverted: prTasks.filter((x) => x.reverted).length,
  };
  const mergedCost = opts.tasks.filter(isMerged).reduce((a, x) => a + x.costUsd, 0);
  const mergedCount = opts.tasks.filter(isMerged).length;

  // Where each session's money went (one bucket per session).
  const shippedSessions = new Set(opts.tasks.filter(isMerged).flatMap((x) => x.sessions));
  const spend = { shipped: 0, learning: 0, inProgress: 0, wasted: 0 } as Record<SpendKind, number>;
  for (const s of opts.sessions) {
    const j = judgeBy.get(s.id);
    const k: SpendKind = wasted.has(s.id) ? "wasted" : shippedSessions.has(s.id) ? "shipped" : j?.category && LEARNING.has(j.category) ? "learning" : "inProgress";
    spend[k] = Math.round((spend[k] + sessionUsd(s)) * 100) / 100;
  }

  return {
    stages,
    brainstormMinutes,
    prs,
    waste,
    spend,
    costPerMergedPr: mergedCount ? Math.round((mergedCost / mergedCount) * 100) / 100 : null,
    items,
  };
}

/** "45m", "3h", "2d 4h" */
export function formatMinutes(m: number | null | undefined) {
  if (m === null || m === undefined) return "n/a";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d${h % 24 ? ` ${h % 24}h` : ""}`;
}
