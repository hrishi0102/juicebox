// Server-side data access for pages and API routes.
import { cookies } from "next/headers";
import { loadDataset, type Dataset } from "@/lib/receipts/pipeline";
import { hasData, readJson, type Source } from "@/lib/receipts/store";
import { summarize, weekOf } from "@/lib/receipts/score";
import type { TeamData } from "@/lib/receipts/demo";
import type { Judgement, PeriodSummary, Session } from "@/lib/receipts/types";

export const SOURCE_COOKIE = "receipts-source";

export async function currentSource(): Promise<Source> {
  const c = (await cookies()).get(SOURCE_COOKIE)?.value;
  if (c === "local" && hasData("local")) return "local";
  if (c === "demo") return "demo";
  return hasData("local") ? "local" : "demo";
}

export function getDataset(source: Source): Dataset | undefined {
  return loadDataset(source);
}

export function getDemoTeam(): TeamData | undefined {
  return readJson<TeamData | null>("demo", "team.json", null) ?? undefined;
}

export type TeamConfig = { id: string; name: string };
export function getLocalTeamConfig(): TeamConfig {
  return readJson<TeamConfig>("local", "team.json", { id: process.env.RECEIPTS_TEAM || "my-team", name: process.env.RECEIPTS_TEAM_NAME || "My team" });
}

/** "Now" for a dataset: the demo is frozen in time so it always looks the same. */
export function nowFor(d: Dataset) {
  return d.source === "demo" ? new Date(d.generatedAt) : new Date();
}

export type WeekView = {
  id: string;
  start: string;
  end: string;
  summary: PeriodSummary;
  sessions: Session[];
  judgements: Judgement[];
};

export function weekView(d: Dataset, weekId?: string): WeekView {
  const all = weeksWithData(d);
  const w = (weekId && all.find((x) => x.id === weekId)) || all[0] || weekOf(nowFor(d));
  const sessions = d.sessions.filter((s) => {
    const t = Date.parse(s.startedAt);
    return t >= Date.parse(w.start) && t < Date.parse(w.end);
  });
  const ids = new Set(sessions.map((s) => s.id));
  const summary = summarize({ periodStart: w.start, periodEnd: w.end, sessions: d.sessions, judgements: d.judgements, tasks: d.tasks, changes: d.changes, owner: d.owner });
  return { ...w, summary, sessions, judgements: d.judgements.filter((j) => ids.has(j.sessionId)) };
}

/** Weeks that have at least one session, newest first. */
export function weeksWithData(d: Dataset) {
  const seen = new Map<string, ReturnType<typeof weekOf>>();
  for (const s of d.sessions) {
    const w = weekOf(new Date(s.startedAt));
    seen.set(w.id, w);
  }
  return [...seen.values()].sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
}

export function periodView(d: Dataset, days: number) {
  const end = nowFor(d);
  const start = new Date(end.getTime() - days * 86400_000);
  return summarize({ periodStart: start.toISOString(), periodEnd: new Date(end.getTime() + 1).toISOString(), sessions: d.sessions, judgements: d.judgements, tasks: d.tasks, changes: d.changes });
}
