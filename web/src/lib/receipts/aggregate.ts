// Adding up shared receipts for the company and team views, using signed fields only, so a
// shared receipt cannot be edited without breaking its signature.
import { signedNumbers, type EfficiencyView, type SignedReceipt } from "./receipt";
import { SPEND, STAGES, WASTE } from "./efficiency";
import { median } from "./heuristics";
import { CATEGORIES, type Category } from "./types";

export type Agg = {
  receipts: number;
  people: number;
  sessions: number;
  spend: number;
  done: number;
  merged: number;
  waste: number;
  tools: Record<string, number>;
  categoryCounts: Record<Category, number>;
  categorySpend: Record<Category, number>;
};

export function aggregate(rows: SignedReceipt[]): Agg {
  const tools: Record<string, number> = {};
  const categoryCounts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  const categorySpend = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  let spend = 0;
  let done = 0;
  let merged = 0;
  let sessions = 0;
  for (const r of rows) {
    const n = signedNumbers(r);
    spend += n.spendUsd;
    done += n.done;
    merged += n.mergedPrs;
    sessions += n.sessions;
    for (const [t, v] of Object.entries(n.toolSpend)) tools[t] = (tools[t] ?? 0) + v;
    for (const c of CATEGORIES) {
      categoryCounts[c] += n.categoryCounts[c];
      categorySpend[c] += n.categorySpend[c];
    }
  }
  return {
    receipts: rows.length,
    people: new Set(rows.map((r) => r.message.owner.toLowerCase())).size,
    sessions,
    spend,
    done,
    merged,
    waste: categorySpend.Wasted,
    tools,
    categoryCounts,
    categorySpend,
  };
}

const PHRASE: Record<Category, (n: number) => string> = {
  Built: (n) => `built ${n} thing${n === 1 ? "" : "s"}`,
  Fixed: (n) => `fixed ${n} bug${n === 1 ? "" : "s"}`,
  "Figured out": (n) => `figured out ${n} problem${n === 1 ? "" : "s"}`,
  Researched: (n) => `researched ${n} topic${n === 1 ? "" : "s"}`,
  Wrote: (n) => `wrote ${n} piece${n === 1 ? "" : "s"}`,
  Planned: (n) => `planned ${n} thing${n === 1 ? "" : "s"}`,
  Wasted: (n) => `went in circles ${n === 1 ? "once" : `${n} times`}`,
};

/** "Built 40 things, fixed 12 bugs and figured out 9 problems." from category counts. */
export function countsLine(counts: Record<Category, number>) {
  const parts = CATEGORIES.filter((c) => counts[c] > 0).map((c) => PHRASE[c](counts[c]));
  if (!parts.length) return "";
  const text = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return text[0].toUpperCase() + text.slice(1) + ".";
}

/**
 * Efficiency across shared receipts (version 3 only): counts and dollars are added up; the typical
 * time for each step is the median of each person's median.
 */
export function aggregateEfficiency(rows: SignedReceipt[]): EfficiencyView | undefined {
  const views = rows.map((r) => signedNumbers(r).efficiency).filter((e): e is EfficiencyView => !!e);
  if (!views.length) return undefined;
  const stages = Object.fromEntries(
    STAGES.map((st) => {
      const meds = views.map((v) => v.stages[st]).filter((s) => s.n > 0 && s.medianMin !== null);
      return [st, { medianMin: meds.length ? Math.round(median(meds.map((s) => s.medianMin!))) : null, n: meds.reduce((a, s) => a + s.n, 0) }];
    }),
  ) as EfficiencyView["stages"];
  const sum = (f: (v: EfficiencyView) => number) => views.reduce((a, v) => a + f(v), 0);
  const waste = Object.fromEntries(WASTE.map((k) => [k, { count: sum((v) => v.waste[k].count), usd: Math.round(sum((v) => v.waste[k].usd) * 100) / 100 }])) as EfficiencyView["waste"];
  const spend = Object.fromEntries(SPEND.map((k) => [k, Math.round(sum((v) => v.spend[k]) * 100) / 100])) as EfficiencyView["spend"];
  const prs = { opened: sum((v) => v.prs.opened), merged: sum((v) => v.prs.merged), open: sum((v) => v.prs.open), closed: sum((v) => v.prs.closed), reverted: sum((v) => v.prs.reverted) };
  return { stages, brainstormMinutes: sum((v) => v.brainstormMinutes), prs, waste, spend, costPerMergedPr: prs.merged ? Math.round((spend.shipped / prs.merged) * 100) / 100 : null };
}
