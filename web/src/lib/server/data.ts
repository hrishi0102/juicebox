// Server-side data access for pages and API routes.
import { cookies } from "next/headers";
import { loadDataset, type Dataset } from "@/lib/receipts/pipeline";
import { hasData, readJson, type Source } from "@/lib/receipts/store";
import { summarize, weekOf } from "@/lib/receipts/score";
import { loadWeekStory } from "@/lib/receipts/week";
import type { OrgData, OrgTeam } from "@/lib/receipts/demo";
import type { Judgement, PeriodSummary, Session } from "@/lib/receipts/types";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "@/lib/receipts/store";
import { githubTeams } from "@/lib/receipts/identity";
import { getSession } from "./session";

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

export function getDemoOrg(): OrgData | undefined {
  return readJson<OrgData | null>("demo", "org.json", null) ?? undefined;
}

export type TeamConfig = { id: string; name: string };
export function getLocalTeamConfig(): TeamConfig {
  return readJson<TeamConfig>("local", "team.json", { id: process.env.RECEIPTS_TEAM || "my-team", name: process.env.RECEIPTS_TEAM_NAME || "My team" });
}

export type OrgConfig = { id: string; name: string; teams: OrgTeam[] };
/** The org this person belongs to (set with `npm run receipts -- org <id> "Name"`). */
export function getLocalOrgConfig(): OrgConfig {
  const team = getLocalTeamConfig();
  return readJson<OrgConfig>("local", "org.json", { id: process.env.RECEIPTS_ORG || "my-org", name: process.env.RECEIPTS_ORG_NAME || "My org", teams: [team] });
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
  const story = loadWeekStory(d.source, w.id);
  const summary = summarize({ periodStart: w.start, periodEnd: w.end, sessions: d.sessions, judgements: d.judgements, tasks: d.tasks, changes: d.changes, owner: d.owner, story, now: nowFor(d).getTime() });
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
  return summarize({ periodStart: start.toISOString(), periodEnd: new Date(end.getTime() + 1).toISOString(), sessions: d.sessions, judgements: d.judgements, tasks: d.tasks, changes: d.changes, now: end.getTime() });
}

export type ShareTarget = { org: string; orgName: string; team: string; teamName: string; from: "settings" | "github sign-in" | "github" | "default" };

/**
 * Where your shared receipts go: a company (GitHub org) and a team (GitHub team).
 * Settings made with the CLI win; then the GitHub sign-in; then the teams of the GitHub token
 * this app already uses; then a default.
 */
export async function shareTarget(): Promise<ShareTarget> {
  if (existsSync(join(DATA_DIR, "org.json")) || existsSync(join(DATA_DIR, "team.json"))) {
    const o = getLocalOrgConfig();
    const t = getLocalTeamConfig();
    return { org: o.id, orgName: o.name, team: t.id, teamName: t.name, from: "settings" };
  }
  const s = await getSession();
  const gh = s ? { orgs: s.orgs, teams: s.teams } : await githubTeams();
  if (gh && (gh.teams.length || gh.orgs.length)) {
    const t = gh.teams[0];
    const org = t?.org ?? gh.orgs[0];
    return { org, orgName: org, team: t ? `${t.org}/${t.slug}` : `${org}/everyone`, teamName: t?.name ?? "Everyone", from: s ? "github sign-in" : "github" };
  }
  return { org: "my-org", orgName: "My org", team: "my-team", teamName: "My team", from: "default" };
}
