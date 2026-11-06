// "What did you get done this week?": turns a week of sessions into a short list of items.
// Pure functions (no Node, no network), so pages, the API and tests can all use them.
//
// The private AI writes the grouping, titles and one summary sentence (see week.ts). This file
// rebuilds every number from the current data, so a saved story never shows stale costs, and it
// has a rule-based fallback: one item per pull request, plus the bigger sessions on their own.

import { sessionUsd } from "./pricing";
import { CATEGORIES, toolOf, type Category, type Judgement, type Session, type Task, type WeekItem, type WeekStory } from "./types";
import { tidyPrTitle, type WeekAnswerItem, type WeekLine } from "./judge-core";

export type StoryInput = {
  sessions: Session[]; // the sessions in the period
  judgements: Judgement[];
  tasks: Task[];
};

const MAX_ITEMS = 10;
const order = (c: Category) => CATEGORIES.indexOf(c);

/** The task (PR or commit) each session spent the most on. */
function primaryTasks(input: StoryInput) {
  const out = new Map<string, Task>();
  const best = new Map<string, number>();
  for (const t of input.tasks) {
    for (const sid of t.sessions) {
      const w = t.costBySession?.[sid] ?? 0;
      if (!out.has(sid) || w > (best.get(sid) ?? -1)) {
        out.set(sid, t);
        best.set(sid, w);
      }
    }
  }
  return out;
}

/** One input line per session for the weekly AI call: ids S1, S2, ... in time order. */
export function sessionLines(input: StoryInput): (WeekLine & { sessionId: string })[] {
  const judgeBy = new Map(input.judgements.map((j) => [j.sessionId, j]));
  const primary = primaryTasks(input);
  return [...input.sessions]
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))
    .map((s, i) => {
      const j = judgeBy.get(s.id);
      const t = primary.get(s.id);
      return {
        id: `S${i + 1}`,
        sessionId: s.id,
        category: j?.category ?? "Figured out",
        title: j?.title ?? "Session",
        costUsd: sessionUsd(s),
        pr: t ? `${t.title} (${t.reverted ? "reverted" : t.state})` : undefined,
        inProgress: j?.inProgress,
      };
    });
}

/** Build one item from a set of sessions; every number comes from the current data. */
export function makeItem(id: string, category: Category, title: string, sessionIds: string[], input: StoryInput): WeekItem {
  const ids = new Set(sessionIds);
  const sessions = input.sessions.filter((s) => ids.has(s.id));
  const judgeBy = new Map(input.judgements.map((j) => [j.sessionId, j]));
  const tasks = input.tasks.filter((t) => t.sessions.some((sid) => ids.has(sid)));
  const merged = tasks.some((t) => (t.state === "merged" || t.state === "direct") && !t.reverted);
  const open = tasks.some((t) => t.state === "open");
  const allInProgress = sessions.length > 0 && sessions.every((s) => judgeBy.get(s.id)?.inProgress);
  return {
    id,
    category,
    title,
    inProgress: !merged && (open || allInProgress) && category !== "Wasted",
    sessions: sessions.map((s) => s.id),
    costUsd: round2(sessions.reduce((a, s) => a + sessionUsd(s), 0)),
    prs: tasks.map((t) => ({ key: t.changeKey, url: t.url, title: t.title, state: t.state, reverted: t.reverted })),
    tools: [...new Set(sessions.map((s) => toolOf(s)))].sort(),
  };
}

function mostCommon(cats: Category[]): Category {
  const useful = cats.filter((c) => c !== "Wasted");
  const pool = useful.length ? useful : cats;
  const n = new Map<Category, number>();
  for (const c of pool) n.set(c, (n.get(c) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || order(a[0]) - order(b[0]))[0]?.[0] ?? "Figured out";
}

function sortItems(items: WeekItem[]) {
  return items.sort((a, b) => order(a.category) - order(b.category) || b.costUsd - a.costUsd);
}

/** Rule-based list: sessions that share a PR become one item; the biggest of the rest stand alone. */
export function ruleItems(input: StoryInput, onlyIds?: Set<string>): WeekItem[] {
  const lines = sessionLines(input).filter((l) => !onlyIds || onlyIds.has(l.sessionId));
  const primary = primaryTasks(input);
  const groups = new Map<string, typeof lines>();
  for (const l of lines) {
    const key = primary.get(l.sessionId)?.changeKey ?? `session:${l.sessionId}`;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  let items = [...groups.entries()].map(([key, ls]) => {
    const task = primary.get(ls[0].sessionId);
    const cat = mostCommon(ls.map((l) => l.category));
    const title = (task && !key.startsWith("session:") && tidyPrTitle(task.title)) || ls[0].title;
    return makeItem(`r-${ls[0].sessionId.slice(0, 8)}`, cat, title, ls.map((l) => l.sessionId), input);
  });
  if (items.length > MAX_ITEMS) {
    // Keep the biggest; fold the small ones into one line so the list stays short. Dead ends are
    // folded into their own line, so waste never hides inside "smaller bits".
    const fold = (list: WeekItem[], room: number, id: string, title: (n: number) => string) => {
      if (list.length <= room) return list;
      const sorted = [...list].sort((a, b) => b.costUsd - a.costUsd);
      const keep = sorted.slice(0, Math.max(0, room - 1));
      const rest = sorted.slice(keep.length);
      return [...keep, makeItem(id, mostCommon(rest.map((i) => i.category)), title(rest.length), rest.flatMap((i) => i.sessions), input)];
    };
    const wasted = fold(items.filter((i) => i.category === "Wasted"), 2, "r-dead", (n) => `${n} dead ends`);
    items = [...fold(items.filter((i) => i.category !== "Wasted"), MAX_ITEMS - wasted.length, "r-rest", (n) => `${n} smaller bits and questions`), ...wasted];
  }
  return sortItems(items);
}

/** Turn the weekly AI answer into items. Sessions the AI left out are added back by the rules. */
export function itemsFromAnswer(answer: WeekAnswerItem[], lines: (WeekLine & { sessionId: string })[], input: StoryInput): WeekItem[] {
  const byShort = new Map(lines.map((l) => [l.id, l.sessionId]));
  const used = new Set<string>();
  const items: WeekItem[] = [];
  answer.forEach((a, n) => {
    const ids = a.sessions.map((s) => byShort.get(s)).filter((id): id is string => !!id && !used.has(id));
    if (!ids.length) return;
    ids.forEach((id) => used.add(id));
    items.push(makeItem(`a-${n + 1}`, a.category, a.title, ids, input));
  });
  const left = new Set(lines.map((l) => l.sessionId).filter((id) => !used.has(id)));
  const extra = left.size ? ruleItems(input, left) : [];
  // Keep the AI's order (most impressive first), but always put Wasted last.
  return [...items.filter((i) => i.category !== "Wasted"), ...extra.filter((i) => i.category !== "Wasted"), ...items.filter((i) => i.category === "Wasted"), ...extra.filter((i) => i.category === "Wasted")];
}

/** Re-apply a saved story to the current data: same grouping and titles, fresh numbers. */
export function applyStory(story: WeekStory, input: StoryInput): { items: WeekItem[]; newSessions: number } {
  const present = new Set(input.sessions.map((s) => s.id));
  const covered = new Set(story.items.flatMap((i) => i.sessions));
  const items = story.items
    .map((i) => ({ ...i, sessions: i.sessions.filter((id) => present.has(id)) }))
    .filter((i) => i.sessions.length)
    .map((i) => makeItem(i.id, i.category, i.title, i.sessions, input));
  const left = new Set([...present].filter((id) => !covered.has(id)));
  return { items: left.size ? [...items, ...ruleItems(input, left)] : items, newSessions: left.size };
}

const PHRASE: Record<Category, (n: number) => string> = {
  Built: (n) => `built ${n} thing${n === 1 ? "" : "s"}`,
  Fixed: (n) => `fixed ${n} bug${n === 1 ? "" : "s"}`,
  "Figured out": (n) => `figured out ${n} problem${n === 1 ? "" : "s"}`,
  Researched: (n) => `researched ${n} topic${n === 1 ? "" : "s"}`,
  Wrote: (n) => `wrote ${n} piece${n === 1 ? "" : "s"}`,
  Planned: (n) => `planned ${n} thing${n === 1 ? "" : "s"}`,
  Wasted: (n) => `went in circles ${n === 1 ? "once" : n === 2 ? "twice" : `${n} times`}`,
};

/** "Built 3 things, fixed 2 bugs and figured out 4 problems." */
export function countLine(items: WeekItem[]) {
  const counts = new Map<Category, number>();
  for (const i of items) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
  const parts = CATEGORIES.filter((c) => counts.get(c)).map((c) => PHRASE[c](counts.get(c)!));
  if (!parts.length) return "Nothing yet this week.";
  const text = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return text[0].toUpperCase() + text.slice(1) + ".";
}

export function categoryTotals(items: WeekItem[]) {
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  const spend = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  for (const i of items) {
    counts[i.category]++;
    spend[i.category] = round2(spend[i.category] + i.costUsd);
  }
  return { counts, spend };
}

/** Changes when a session is added or continues, so a saved story knows it is out of date. */
export function sessionsHash(sessions: Session[]) {
  const text = sessions
    .map((s) => `${s.id}:${s.endedAt}`)
    .sort()
    .join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** A story written by the rules, for when no private AI is set up. */
export function ruleStory(week: string, source: WeekStory["source"], input: StoryInput): WeekStory {
  const items = ruleItems(input);
  return {
    week,
    source,
    items,
    oneLiner: countLine(items),
    engine: "rules",
    requestIds: [],
    sessionsHash: sessionsHash(input.sessions),
    createdAt: new Date().toISOString(),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
