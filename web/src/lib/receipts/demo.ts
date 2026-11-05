// Synthetic demo data: a fictional team ("Acme Payments", five people) over four weeks.
// No real transcript, repo or person is in here. Labels come from the real heuristic judge,
// run over synthetic signals, so the demo exercises the same code paths as real data.

import { keccak256, stringToHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { judgeAllHeuristic } from "./heuristics";
import { buildTasks, summarize, weeksBetween } from "./score";
import { buildReceipt, totalsOnly, typedDataFor, type SignedReceipt } from "./receipt";
import type { Dataset } from "./pipeline";
import type { Change, ChangeKind, Session, SessionMatch } from "./types";

export const DEMO_END = Date.parse("2026-11-06T12:00:00Z");
const DAY = 86400_000;

type Archetype = "ship" | "loop" | "learn" | "abandon" | "overkill" | "pending" | "revert";

export type TeamMember = { name: string; role: string; address: string; share: "full" | "totals" | "none"; you?: boolean };
export type TeamData = {
  id: string;
  name: string;
  members: TeamMember[];
  receipts: SignedReceipt[]; // what members chose to share (full or totals only)
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

export function memberSessions(name: string, seed: number, plan: Record<Archetype, number>) {
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
    const model = premium ? "claude-opus-5-5" : "claude-sonnet-5-5";
    const p = model === "claude-opus-5-5" ? { cr: 0.2, cw: 8, out: 20 } : { cr: 0.2, cw: 4, out: 10 };
    const tokens = {
      input: Math.round(between(500, 20000)),
      output: Math.round((0.3 * usd) / (p.out / 1e6)),
      cacheRead: Math.round((0.45 * usd) / (p.cr / 1e6)),
      cacheWrite5m: 0,
      cacheWrite1h: Math.round((0.25 * usd) / (p.cw / 1e6)),
    };
    const id = uuid(r);
    const branch = `${name.toLowerCase()}/${title.split(":")[1]?.trim().replace(/\W+/g, "-").slice(0, 30) ?? "work"}`;
    const loopy = a === "loop";
    const toolCalls = Math.round(minutes * between(0.8, 2));
    const s: Session = {
      id,
      projectDir: `-Users-${name.toLowerCase()}-code-${repo.split("/")[1]}`,
      cwd: `/Users/${name.toLowerCase()}/code/${repo.split("/")[1]}`,
      repos: [repo],
      branches: a === "learn" ? [] : [branch],
      startedAt: new Date(start).toISOString(),
      endedAt: new Date(start + minutes * 60_000).toISOString(),
      activeMinutes: minutes,
      title: a === "learn" ? pick(["How does settlement batching work?", "Compare queue options for payouts", "Why is the webhook test slow?"]) : title.replace(/^\w+: /, ""),
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
      tools: a === "learn" ? { Read: 20, Grep: 9, WebSearch: 3 } : { Bash: Math.round(toolCalls * 0.5), Edit: Math.round(toolCalls * 0.25), Read: Math.round(toolCalls * 0.25) },
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

const MEMBERS: (TeamMember & { seed: number; plan: Record<Archetype, number> })[] = [
  { name: "You", role: "Engineer", address: "", share: "full", you: true, seed: 35, plan: { ship: 13, loop: 4, learn: 5, abandon: 3, overkill: 2, pending: 2, revert: 1 } },
  { name: "Asha", role: "Senior engineer", address: "", share: "full", seed: 11, plan: { ship: 16, loop: 1, learn: 4, abandon: 1, overkill: 1, pending: 2, revert: 0 } },
  { name: "Ravi", role: "Engineer", address: "", share: "totals", seed: 23, plan: { ship: 9, loop: 7, learn: 2, abandon: 4, overkill: 1, pending: 1, revert: 1 } },
  { name: "Meera", role: "Staff engineer", address: "", share: "full", seed: 31, plan: { ship: 8, loop: 1, learn: 9, abandon: 1, overkill: 0, pending: 2, revert: 0 } },
  { name: "Kabir", role: "Engineer", address: "", share: "none", seed: 47, plan: { ship: 10, loop: 2, learn: 2, abandon: 2, overkill: 5, pending: 1, revert: 0 } },
];

export async function makeDemoDataset(): Promise<{ dataset: Dataset; team: TeamData }> {
  const weeks = weeksBetween(new Date(DEMO_END - 27 * DAY), new Date(DEMO_END));
  const receipts: SignedReceipt[] = [];
  let mine: Dataset | undefined;
  const members: TeamMember[] = [];

  for (const m of MEMBERS) {
    const account = privateKeyToAccount(demoKey(m.name));
    const { sessions, changes, matches } = memberSessions(m.name, m.seed, m.plan);
    const judgements = judgeAllHeuristic(sessions, matches, changes, DEMO_END);
    const tasks = buildTasks(sessions, matches, changes, judgements);
    members.push({ name: m.name, role: m.role, address: account.address, share: m.share, you: m.you });
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
      const summary = summarize({ periodStart: w.start, periodEnd: w.end, sessions, judgements, tasks, changes, owner: account.address });
      if (!summary.sessions) continue;
      const ids = new Set(sessions.filter((s) => Date.parse(s.startedAt) >= Date.parse(w.start) && Date.parse(s.startedAt) < Date.parse(w.end)).map((s) => s.id));
      let r = buildReceipt({ owner: account.address, periodId: w.id, summary, judgements: judgements.filter((j) => ids.has(j.sessionId)) });
      r.signature = await account.signTypedData(typedDataFor(r));
      r.signedAt = new Date(Math.min(DEMO_END, Date.parse(w.end))).toISOString();
      if (m.share === "totals") r = totalsOnly(r);
      r.share = { level: m.share, team: "acme-payments", publishedAt: r.signedAt };
      receipts.push(r);
    }
  }
  return {
    dataset: mine!,
    team: { id: "acme-payments", name: "Acme Payments (demo team)", members, receipts, weeks: weeks.map((w) => w.id) },
  };
}
