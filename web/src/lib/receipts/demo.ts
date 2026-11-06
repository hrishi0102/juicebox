// Synthetic demo data: a fictional company ("Acme", three teams, twelve people) over four weeks,
// using Claude Code and Codex. Company policy in the demo: everyone shares a signed weekly receipt
// including the list of PRs it paid for. Prompts never leave the laptop.
// No real transcript, repo or person is in here. Labels come from the real heuristic judge,
// run over synthetic signals, so the demo exercises the same code paths as real data.

import { keccak256, stringToHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { judgeAllHeuristic } from "./heuristics";
import { buildTasks, summarize, weeksBetween } from "./score";
import { buildReceipt, totalsOnly, typedDataFor, type SignedReceipt } from "./receipt";
import { readJson } from "./store";
import type { Dataset } from "./pipeline";
import type { Change, ChangeKind, Session, SessionMatch, WeekStory } from "./types";

export const DEMO_END = Date.parse("2026-11-06T12:00:00Z");
const DAY = 86400_000;

type Archetype = "ship" | "loop" | "learn" | "abandon" | "overkill" | "pending" | "revert";

export type TeamMember = { name: string; role: string; address: string; share: "full" | "totals" | "none"; team: string; you?: boolean; login?: string };
export type OrgTeam = { id: string; name: string };
export type OrgData = {
  id: string;
  name: string;
  policy: string; // shown on the org page
  teams: OrgTeam[];
  members: TeamMember[];
  receipts: SignedReceipt[]; // what members shared (totals, or totals plus evidence)
  weeks: string[];
};

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TITLES: Record<ChangeKind, string[]> = {
  feature: ["feat: add refund status webhook", "feat: team spend dashboard", "feat: retry queue for payouts", "feat: CSV export for ledgers", "feat: invoice PDF preview", "feat: rate limit per API key"],
  fix: ["fix: double charge on retry", "fix: timezone bug in settlement report", "fix: flaky login redirect", "fix: null merchant name in receipts", "fix: webhook signature check"],
  refactor: ["refactor: split payments service", "refactor: move fees into pure functions", "refactor: drop legacy auth middleware"],
  test: ["test: cover payout edge cases", "test: e2e for checkout"],
  docs: ["docs: API quickstart", "docs: runbook for incidents"],
  chore: ["chore: bump dependencies", "chore: CI cache"],
  other: ["spike: evaluate ledger db"],
};

const REPOS = ["acme-demo/payments-api", "acme-demo/web-app", "acme-demo/infra"];

export function memberSessions(name: string, seed: number, plan: Record<Archetype, number>, codexShare = 0) {
  const r = mulberry32(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const between = (a: number, b: number) => a + r() * (b - a);
  const sessions: Session[] = [];
  const changes: Change[] = [];
  const matches: SessionMatch[] = [];
  let prNum = 100 + Math.floor(r() * 50);
  const archetypes: Archetype[] = Object.entries(plan).flatMap(([k, n]) => Array.from({ length: n }, () => k as Archetype));
  // spread over 28 days
  archetypes.sort(() => r() - 0.5);
  archetypes.forEach((a, i) => {
    const start = DEMO_END - 28 * DAY + (i / archetypes.length) * 27 * DAY + r() * 6 * 3600_000;
    const minutes = Math.round(a === "learn" ? between(10, 50) : a === "loop" ? between(70, 200) : a === "overkill" ? between(60, 160) : between(20, 110));
    const repo = pick(REPOS);
    const kind: ChangeKind = a === "learn" ? "other" : pick(["feature", "feature", "fix", "fix", "refactor", "test", "docs", "chore"] as ChangeKind[]);
    const title = pick(TITLES[kind]);
    const smallChange = a === "overkill";
    const additions = Math.round(smallChange ? between(4, 18) : a === "learn" ? 0 : between(20, 600));
    const deletions = Math.round(additions * between(0.1, 0.5));
    const fileCount = Math.max(1, Math.round(smallChange ? 1 : additions / between(25, 70)));
    const files = Array.from({ length: fileCount }, (_, k) => `src/${kind}/${title.split(":")[1]?.trim().replace(/\W+/g, "-") ?? "x"}-${k}.ts`);
    const usd =
      a === "learn" ? between(0.8, 6) : a === "loop" ? between(18, 70) : a === "overkill" ? between(45, 95) : a === "abandon" ? between(6, 28) : between(2, 22) * (1 + additions / 500);
    const premium = a === "overkill" || r() > 0.4;
    // Only draw from the generator for people who use Codex, so Claude-only personas stay stable.
    const codex = codexShare > 0 && r() < codexShare;
    const model = codex ? (premium ? "gpt-5.5" : "gpt-5.4") : premium ? "claude-opus-5-5" : "claude-sonnet-5-5";
    const tokens = codex
      ? (() => {
          const p = model === "gpt-5.5" ? { in: 5, cached: 0.5, out: 30 } : { in: 2.5, cached: 0.25, out: 15 };
          return { input: Math.round((0.3 * usd) / (p.in / 1e6)), output: Math.round((0.4 * usd) / (p.out / 1e6)), cacheRead: Math.round((0.3 * usd) / (p.cached / 1e6)), cacheWrite5m: 0, cacheWrite1h: 0 };
        })()
      : (() => {
          const p = model === "claude-opus-5-5" ? { cr: 0.2, cw: 8, out: 20 } : { cr: 0.2, cw: 4, out: 10 };
          return {
            input: Math.round(between(500, 20000)),
            output: Math.round((0.3 * usd) / (p.out / 1e6)),
            cacheRead: Math.round((0.45 * usd) / (p.cr / 1e6)),
            cacheWrite5m: 0,
            cacheWrite1h: Math.round((0.25 * usd) / (p.cw / 1e6)),
          };
        })();
    const learnTitle = pick(["How settlement batching works", "Queue options for payouts compared", "Why the webhook test is slow", "Plan for splitting the payments service"]);
    const id = uuid(r);
    const branch = `${name.toLowerCase()}/${title.split(":")[1]?.trim().replace(/\W+/g, "-").slice(0, 30) ?? "work"}`;
    const loopy = a === "loop";
    const toolCalls = Math.round(minutes * between(0.8, 2));
    const s: Session = {
      id,
      tool: codex ? "codex" : "claude-code",
      projectDir: `-Users-${name.toLowerCase()}-code-${repo.split("/")[1]}`,
      cwd: `/Users/${name.toLowerCase()}/code/${repo.split("/")[1]}`,
      repos: [repo],
      branches: a === "learn" ? [] : [branch],
      startedAt: new Date(start).toISOString(),
      endedAt: new Date(start + minutes * 60_000).toISOString(),
      activeMinutes: minutes,
      title: a === "learn" ? learnTitle : title.replace(/^\w+: /, ""),
      models: [model],
      cost: {
        usd: Math.round(usd * 100) / 100,
        tokens,
        byModel: { [model]: { ...tokens, usd: Math.round(usd * 100) / 100, requests: Math.round(toolCalls * 1.1), webSearches: 0 } },
        webSearches: 0,
        unknownModels: [],
      },
      filesEdited: a === "learn" ? [] : files.map((f) => `/Users/${name.toLowerCase()}/code/${repo.split("/")[1]}/${f}`),
      linesAdded: a === "learn" ? 0 : additions,
      linesRemoved: a === "learn" ? 0 : deletions,
      git: { commits: [], pushes: [], prs: [] },
      signals: {
        userPrompts: Math.round(minutes / between(4, 9)),
        assistantTurns: Math.round(toolCalls * 1.1),
        toolCalls,
        toolErrors: loopy ? Math.round(toolCalls * between(0.32, 0.5)) : Math.round(toolCalls * between(0, 0.08)),
        maxErrorStreak: loopy ? Math.round(between(6, 12)) : Math.round(between(0, 2)),
        repeatedCommands: loopy ? Math.round(between(3, 7)) : Math.round(between(0, 1)),
        maxEditsSameFile: loopy ? Math.round(between(12, 30)) : Math.round(between(1, 6)),
        testRuns: loopy ? Math.round(between(10, 25)) : Math.round(between(0, 5)),
        apiErrors: 0,
        compactions: minutes > 120 ? 1 : 0,
        interruptions: loopy ? Math.round(between(1, 4)) : 0,
        readOnlyRatio: a === "learn" ? 0.85 : between(0.2, 0.5),
        subagents: r() > 0.7 ? Math.round(between(1, 4)) : 0,
      },
      tools: codex
        ? { exec_command: Math.round(toolCalls * 0.7), apply_patch: Math.round(toolCalls * 0.3) }
        : a === "learn"
          ? learnTitle.includes("compared")
            ? { Read: 8, WebSearch: 4, WebFetch: 3 }
            : learnTitle.startsWith("Plan")
              ? { Read: 18, Grep: 6, ExitPlanMode: 1 }
              : { Read: 20, Grep: 9 }
          : { Bash: Math.round(toolCalls * 0.5), Edit: Math.round(toolCalls * 0.25), Read: Math.round(toolCalls * 0.25) },
    };
    sessions.push(s);

    if (a === "learn" || (a === "abandon" && r() > 0.5)) return;
    const n = prNum++;
    const mergedAt = start + minutes * 60_000 + between(0.2, 2.5) * DAY;
    const state: Change["state"] = a === "pending" ? "open" : a === "abandon" ? "closed" : "merged";
    const survivalRatio = a === "revert" ? 0 : a === "loop" ? between(0.55, 0.9) : between(0.78, 1);
    const matured = DEMO_END - mergedAt > 30 * DAY;
    const c: Change = {
      key: `${repo}#${n}`,
      repo,
      type: "pr",
      number: n,
      url: `https://github.com/${repo}/pull/${n}`,
      title,
      author: name.toLowerCase(),
      kind,
      state,
      createdAt: new Date(start + minutes * 60_000).toISOString(),
      mergedAt: state === "merged" ? new Date(mergedAt).toISOString() : undefined,
      baseRef: "main",
      headRef: branch,
      additions,
      deletions,
      files,
      commitShas: [keccak256(stringToHex(id)).slice(2, 42)],
      reverted: a === "revert",
      revertedBy: a === "revert" ? `https://github.com/${repo}/commit/${keccak256(stringToHex(id + "r")).slice(2, 42)}` : undefined,
      survival:
        state === "merged" && a !== "revert"
          ? { measuredAt: new Date(Math.min(DEMO_END, mergedAt + 30 * DAY)).toISOString(), matured, linesAdded: additions, linesAlive: Math.round(additions * survivalRatio), ratio: survivalRatio, filesChecked: Math.min(8, fileCount), method: "blame" }
          : undefined,
    };
    changes.push(c);
    s.git.prs.push({ repo, number: n, url: c.url, action: "created" });
    matches.push({ sessionId: id, changeKey: c.key, reason: "pr-link", confidence: 0.97 });
  });
  return { sessions, changes, matches };
}

function uuid(r: () => number) {
  const h = Array.from({ length: 32 }, () => Math.floor(r() * 16).toString(16)).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function demoKey(name: string): Hex {
  return keccak256(stringToHex(`receipts-demo-key:${name}`));
}

export const DEMO_ORG = { id: "acme", name: "Acme (demo company)" };
const TEAMS: OrgTeam[] = [
  { id: "acme-payments", name: "Payments" },
  { id: "acme-platform", name: "Platform" },
  { id: "acme-mobile", name: "Mobile" },
];

type Persona = Omit<TeamMember, "address"> & { seed: number; plan: Record<Archetype, number>; codex: number };
const P = (ship: number, loop: number, learn: number, abandon: number, overkill: number, pending: number, revert: number) => ({ ship, loop, learn, abandon, overkill, pending, revert });

// codex = share of a person's sessions run in Codex instead of Claude Code.
const MEMBERS: Persona[] = [
  { name: "You", role: "Engineer", share: "full", team: "acme-payments", you: true, seed: 35, codex: 0.25, plan: P(22, 4, 9, 4, 2, 3, 1) },
  { name: "Asha", role: "Senior engineer", share: "full", team: "acme-payments", seed: 11, codex: 0.2, plan: P(16, 1, 4, 1, 1, 2, 0) },
  { name: "Ravi", role: "Engineer", share: "full", team: "acme-payments", seed: 23, codex: 0.5, plan: P(9, 7, 2, 4, 1, 1, 1) },
  { name: "Meera", role: "Staff engineer", share: "full", team: "acme-payments", seed: 31, codex: 0, plan: P(8, 1, 9, 1, 0, 2, 0) },
  { name: "Kabir", role: "Engineer", share: "full", team: "acme-payments", seed: 47, codex: 0.3, plan: P(10, 2, 2, 2, 5, 1, 0) },
  { name: "Neel", role: "Platform lead", share: "full", team: "acme-platform", seed: 53, codex: 0.6, plan: P(12, 2, 6, 1, 1, 2, 0) },
  { name: "Tara", role: "SRE", share: "full", team: "acme-platform", seed: 59, codex: 0.8, plan: P(7, 3, 8, 2, 0, 1, 1) },
  { name: "Imran", role: "Engineer", share: "full", team: "acme-platform", seed: 61, codex: 0.4, plan: P(11, 5, 3, 3, 2, 1, 0) },
  { name: "Divya", role: "Engineer", share: "full", team: "acme-platform", seed: 67, codex: 0.1, plan: P(14, 1, 3, 1, 3, 2, 0) },
  { name: "Arjun", role: "Mobile lead", share: "full", team: "acme-mobile", seed: 71, codex: 0.5, plan: P(10, 2, 4, 2, 1, 2, 1) },
  { name: "Sara", role: "Engineer", share: "full", team: "acme-mobile", seed: 73, codex: 0.9, plan: P(6, 6, 2, 4, 1, 1, 0) },
  { name: "Dev", role: "Engineer", share: "full", team: "acme-mobile", seed: 79, codex: 0.2, plan: P(13, 1, 5, 1, 4, 1, 0) },
];

export async function makeDemoDataset(): Promise<{ dataset: Dataset; org: OrgData }> {
  const weeks = weeksBetween(new Date(DEMO_END - 27 * DAY), new Date(DEMO_END));
  const receipts: SignedReceipt[] = [];
  let mine: Dataset | undefined;
  const members: TeamMember[] = [];

  for (const m of MEMBERS) {
    const account = privateKeyToAccount(demoKey(m.name));
    const { sessions, changes, matches } = memberSessions(m.name, m.seed, m.plan, m.codex);
    const judgements = judgeAllHeuristic(sessions, matches, changes, DEMO_END);
    const tasks = buildTasks(sessions, matches, changes, judgements);
    const login = `${m.name.toLowerCase()}-acme`;
    members.push({ name: m.name, role: m.role, address: account.address, share: m.share, team: m.team, you: m.you, login });
    if (m.you) {
      mine = {
        generatedAt: new Date(DEMO_END).toISOString(),
        source: "demo",
        owner: account.address,
        sessions,
        changes,
        matches,
        judgements,
        tasks,
        meta: { days: 28, judge: "heuristic" },
      };
    }
    if (m.share === "none") continue;
    for (const w of weeks) {
      // "You" uses the weeks the private AI wrote (fixtures/demo/weeks); others use the rules.
      const story = m.you ? (readJson<WeekStory | null>("demo", `weeks/${w.id}.json`, null) ?? undefined) : undefined;
      const summary = summarize({ periodStart: w.start, periodEnd: w.end, sessions, judgements, tasks, changes, owner: account.address, story });
      if (!summary.sessions) continue;
      const ids = new Set(sessions.filter((s) => Date.parse(s.startedAt) >= Date.parse(w.start) && Date.parse(s.startedAt) < Date.parse(w.end)).map((s) => s.id));
      let r = buildReceipt({ owner: account.address, author: m.you ? "you" : login, periodId: w.id, summary, judgements: judgements.filter((j) => ids.has(j.sessionId)) });
      r.signature = await account.signTypedData(typedDataFor(r));
      r.signedAt = new Date(Math.min(DEMO_END, Date.parse(w.end))).toISOString();
      if (m.share === "totals") r = totalsOnly(r);
      r.share = { level: m.share, team: m.team, org: DEMO_ORG.id, publishedAt: r.signedAt };
      receipts.push(r);
    }
  }
  return {
    dataset: mine!,
    org: {
      ...DEMO_ORG,
      policy: "Everyone shares a signed weekly receipt with the PRs it paid for. Prompts never leave anyone's laptop.",
      teams: TEAMS,
      members,
      receipts,
      weeks: weeks.map((w) => w.id),
    },
  };
}
