// Turn sessions + judgements + outcomes into tasks and a period summary.
// Kept Work: a shipped task counts as its survival ratio (a task that is 91% alive counts 0.91).
// Reverted, closed or unmerged work counts 0. Comparisons only happen inside a difficulty bucket.

import { attributeCost } from "./match";
import { sessionUsd } from "./pricing";
import { changeDifficulty, median } from "./heuristics";
import { applyStory, categoryTotals, countLine, ruleItems, sessionsHash } from "./story";
import { toolOf, type BucketStat, type Change, type Judgement, type PeriodSummary, type Session, type SessionLabel, type SessionMatch, type Task, type WeekStory } from "./types";

const ALL_LABELS: SessionLabel[] = ["Shipped", "Learned", "Looped", "Abandoned", "Overkill", "Pending"];

export function buildTasks(sessions: Session[], matches: SessionMatch[], changes: Change[], judgements: Judgement[]): Task[] {
  const costByChange = attributeCost(sessions.map((s) => ({ id: s.id, usd: sessionUsd(s) })), matches);
  const judgeBy = new Map(judgements.map((j) => [j.sessionId, j]));
  const sessionsByChange = new Map<string, string[]>();
  for (const m of matches) sessionsByChange.set(m.changeKey, [...(sessionsByChange.get(m.changeKey) ?? []), m.sessionId]);
  const ids = new Set(sessions.map((s) => s.id));

  return changes
    .filter((c) => (sessionsByChange.get(c.key) ?? []).some((id) => ids.has(id)))
    .map((c) => {
      const sids = (sessionsByChange.get(c.key) ?? []).filter((id) => ids.has(id));
      // Task difficulty comes from the change itself; an AI judge's rating wins when there is one.
      const aiDiffs = sids.map((id) => judgeBy.get(id)).filter((j) => j && j.judge.engine !== "heuristic").map((j) => j!.difficulty);
      const difficulty = aiDiffs.length ? Math.max(...aiDiffs) : changeDifficulty(c);
      const shipped = (c.state === "merged" || c.state === "direct") && !c.reverted;
      const survival = c.survival ? c.survival.ratio : null;
      return {
        changeKey: c.key,
        repo: c.repo,
        url: c.url,
        title: c.title,
        kind: judgeBy.get(sids[0])?.kind && judgeBy.get(sids[0])!.kind !== "other" ? judgeBy.get(sids[0])!.kind : c.kind,
        difficulty,
        state: c.state,
        reverted: c.reverted,
        survival,
        survivalMatured: !!c.survival?.matured,
        costUsd: round2(sumValues(costByChange.get(c.key))),
        totalCostUsd: round2(sumValues(costByChange.get(c.key))),
        costBySession: Object.fromEntries([...(costByChange.get(c.key) ?? new Map<string, number>())].map(([k, v]) => [k, round2(v)])),
        sessions: sids,
        keptWork: shipped ? (survival ?? 1) : 0,
        mergedAt: c.mergedAt,
      };
    })
    .sort((a, b) => b.costUsd - a.costUsd);
}

export function summarize(opts: {
  periodStart: string;
  periodEnd: string;
  sessions: Session[];
  judgements: Judgement[];
  tasks: Task[];
  changes: Change[];
  owner?: string;
  story?: WeekStory; // the saved write-up for this week, if there is one
}): PeriodSummary {
  const start = Date.parse(opts.periodStart);
  const end = Date.parse(opts.periodEnd);
  const inPeriod = opts.sessions.filter((s) => {
    const t = Date.parse(s.startedAt);
    return t >= start && t < end;
  });
  const ids = new Set(inPeriod.map((s) => s.id));
  const judgeBy = new Map(opts.judgements.map((j) => [j.sessionId, j]));
  // A task counts in the period when one of its sessions does, at the cost spent in the period.
  const tasks = opts.tasks
    .filter((t) => t.sessions.some((id) => ids.has(id)))
    .map((t) => ({
      ...t,
      costUsd: round2(Object.entries(t.costBySession ?? {}).reduce((a, [sid, v]) => a + (ids.has(sid) ? v : 0), 0)),
    }))
    .sort((a, b) => b.costUsd - a.costUsd);
  const changeBy = new Map(opts.changes.map((c) => [c.key, c]));

  const labelCounts = Object.fromEntries(ALL_LABELS.map((l) => [l, 0])) as Record<SessionLabel, number>;
  const labelSpend = Object.fromEntries(ALL_LABELS.map((l) => [l, 0])) as Record<SessionLabel, number>;
  let spend = 0;
  const toolSpend: Record<string, number> = {};
  const toolSessions: Record<string, number> = {};
  for (const s of inPeriod) {
    const usd = sessionUsd(s);
    spend += usd;
    toolSpend[toolOf(s)] = (toolSpend[toolOf(s)] ?? 0) + usd;
    toolSessions[toolOf(s)] = (toolSessions[toolOf(s)] ?? 0) + 1;
    const label = judgeBy.get(s.id)?.label ?? "Pending";
    labelCounts[label]++;
    labelSpend[label] += usd;
  }

  // "Shipped" = merged (or pushed to main). A shipped task that was later reverted still counts as
  // shipped, but as 0% alive, so the survival number shows it.
  const shipped = tasks.filter((t) => t.state === "merged" || t.state === "direct");
  let added = 0;
  let alive = 0;
  for (const t of shipped) {
    const c = changeBy.get(t.changeKey);
    if (!c) continue;
    if (t.reverted) {
      added += Math.max(1, c.additions);
      continue;
    }
    const sv = c.survival;
    if (sv && sv.linesAdded > 0) {
      added += sv.linesAdded;
      alive += sv.linesAlive;
    }
  }
  const survivalPct = added ? round2((alive / added) * 100) : shipped.length ? 100 : null;
  const keptWork = round2(shipped.reduce((a, t) => a + t.keptWork, 0));

  // What you got: the saved write-up's grouping and titles when there is one, else the rules.
  const input = { sessions: inPeriod, judgements: opts.judgements, tasks: opts.tasks };
  const applied = opts.story ? applyStory(opts.story, input) : { items: ruleItems(input), newSessions: 0 };
  const items = applied.items;
  const totals = categoryTotals(items);
  const counts = countLine(items);
  const stale = !!opts.story && (applied.newSessions > 0 || opts.story.sessionsHash !== sessionsHash(inPeriod));

  // Waste = what went to items that went in circles or produced nothing usable.
  const wasteUsd = totals.spend.Wasted;
  const overkillExcess = labelSpend.Overkill;

  const buckets: BucketStat[] = [1, 2, 3, 4, 5].map((d) => {
    const ts = tasks.filter((t) => t.difficulty === d);
    const kept = ts.reduce((a, t) => a + t.keptWork, 0);
    const cost = ts.reduce((a, t) => a + t.costUsd, 0);
    return { difficulty: d, tasks: ts.length, keptWork: round2(kept), costUsd: round2(cost), costPerKept: kept > 0 ? round2(cost / kept) : null };
  });

  return {
    owner: opts.owner,
    periodStart: opts.periodStart,
    periodEnd: opts.periodEnd,
    sessions: inPeriod.length,
    spendUsd: round2(spend),
    shippedTasks: shipped.length,
    survivalPct,
    keptWork,
    keptWorkPer100Usd: spend > 0 ? round2((keptWork / spend) * 100) : null,
    labelCounts,
    labelSpend: Object.fromEntries(Object.entries(labelSpend).map(([k, v]) => [k, round2(v)])) as Record<SessionLabel, number>,
    wasteUsd: round2(wasteUsd),
    wastePct: spend > 0 ? round2((wasteUsd / spend) * 100) : 0,
    toolSpend: Object.fromEntries(Object.entries(toolSpend).map(([k, v]) => [k, round2(v)])),
    toolSessions,
    items,
    categoryCounts: totals.counts,
    categorySpend: totals.spend,
    oneLiner: opts.story && opts.story.engine !== "rules" && opts.story.oneLiner ? opts.story.oneLiner : counts,
    countLine: counts,
    story: {
      engine: opts.story?.engine ?? "rules",
      model: opts.story?.model,
      requestIds: opts.story?.requestIds ?? [],
      verified: opts.story?.verified,
      stale,
      newSessions: applied.newSessions,
      createdAt: opts.story?.createdAt,
      payer: opts.story?.payer,
    },
    buckets,
    tasks,
    tips: tipsFor(inPeriod, opts.judgements, spend, labelSpend, overkillExcess),
  };
}

function tipsFor(sessions: Session[], judgements: Judgement[], spend: number, labelSpend: Record<SessionLabel, number>, overkillExcess: number): string[] {
  const tips: string[] = [];
  if (spend <= 0) return tips;
  const pct = (x: number) => Math.round((x / spend) * 100);
  const judgeBy = new Map(judgements.map((j) => [j.sessionId, j]));

  if (labelSpend.Looped / spend > 0.1) {
    const looped = sessions.filter((s) => judgeBy.get(s.id)?.label === "Looped");
    const streaky = looped.filter((s) => s.signals.maxErrorStreak >= 3 || s.signals.repeatedCommands >= 3).length;
    tips.push(
      `${pct(labelSpend.Looped)}% of spend went to sessions that looped. ${streaky} of ${looped.length} had runs of failing commands. ` +
        `After 3 identical failures, stop and re-plan, or fix the environment first.`,
    );
  }
  if (labelSpend.Abandoned / spend > 0.1) {
    tips.push(`${pct(labelSpend.Abandoned)}% of spend wrote code that never shipped. Smaller asks and earlier PRs make work easier to land or drop.`);
  }
  if (overkillExcess / spend > 0.1) {
    tips.push(`About $${overkillExcess.toFixed(0)} went to small tasks that cost far more than usual. Small fixes rarely need the top model at high effort.`);
  }
  const tok = sessions.reduce(
    (a, s) => {
      const t = s.cost.tokens;
      a.all += t.input + t.output + t.cacheRead + t.cacheWrite5m + t.cacheWrite1h;
      a.read += t.cacheRead;
      return a;
    },
    { all: 0, read: 0 },
  );
  const long = sessions.filter((s) => s.cost.tokens.cacheRead > 50_000_000);
  if (tok.all && tok.read / tok.all > 0.95 && long.length) {
    tips.push(
      `${Math.round((tok.read / tok.all) * 100)}% of tokens were cache reads. ${long.length} very long session(s) kept re-reading a huge context. ` +
        `Starting a fresh session per task keeps that cheap.`,
    );
  }
  const costs = sessions.map((s) => sessionUsd(s));
  const med = median(costs);
  const top = [...sessions].sort((a, b) => sessionUsd(b) - sessionUsd(a))[0];
  if (top && med > 0 && sessionUsd(top) > 10 * med && sessionUsd(top) / spend > 0.25) {
    tips.push(`One session cost ${pct(sessionUsd(top))}% of the period ($${sessionUsd(top).toFixed(0)}). Check whether it bought something big or just ran long.`);
  }
  if (!tips.length) tips.push("No obvious waste this period. Most spend landed in shipped work.");
  return tips;
}

export function headline(p: Pick<PeriodSummary, "spendUsd" | "items">) {
  const usd = "$" + Math.round(p.spendUsd).toLocaleString("en-US");
  const done = p.items.filter((i) => i.category !== "Wasted").length;
  return `${usd} of AI got ${done} thing${done === 1 ? "" : "s"} done`;
}

/** ISO week helpers (weeks start Monday 00:00 UTC). */
export function weekOf(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - (day - 1));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400_000 + 1) / 7);
  return { id: `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`, start: start.toISOString(), end: end.toISOString() };
}

export function weeksBetween(from: Date, to: Date) {
  const out: ReturnType<typeof weekOf>[] = [];
  let cur = weekOf(from);
  while (Date.parse(cur.start) <= to.getTime()) {
    out.push(cur);
    cur = weekOf(new Date(Date.parse(cur.end) + 1000));
  }
  return out;
}

function sumValues(m?: Map<string, number>) {
  let t = 0;
  for (const v of m?.values() ?? []) t += v;
  return t;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
