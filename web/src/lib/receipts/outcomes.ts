// What happened to the work: merged, reverted, and how much of it is still alive.
//
// Survival uses GitHub's blame (GraphQL) on the base branch, measured 30 days after merge
// (or today, marked as not matured yet). We count lines in the changed files that are still
// attributed to the change's own commits (PR commits, the merge/squash commit, or commits
// that landed on the base branch within two minutes of the merge, which covers rebase merges).

import type { GitHub, GhCommit, GhPull } from "./github";
import type { Change, ChangeKind, SurvivalResult } from "./types";

const DAY = 86400_000;
const SKIP_FILE = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|go\.sum|poetry\.lock|composer\.lock)$|\.(min\.js|map|snap|svg|png|jpe?g|gif|webp|ico|pdf|woff2?|ttf)$|(^|\/)(dist|build|out|vendor|node_modules|\.next)\//;

export function kindFromTitle(title: string): ChangeKind {
  const t = title.toLowerCase().trim();
  const m = t.match(/^(\w+)(\(.+?\))?!?:/);
  const tag = m?.[1];
  if (tag) {
    if (["feat", "feature"].includes(tag)) return "feature";
    if (["fix", "bugfix", "hotfix"].includes(tag)) return "fix";
    if (["refactor", "perf", "style"].includes(tag)) return "refactor";
    if (["test", "tests"].includes(tag)) return "test";
    if (["docs", "doc"].includes(tag)) return "docs";
    if (["chore", "build", "ci", "deps"].includes(tag)) return "chore";
  }
  if (/\b(fix|bug|broken|crash|error|issue)\b/.test(t)) return "fix";
  if (/\b(refactor|cleanup|clean up|remove dead|rename|simplify)\b/.test(t)) return "refactor";
  if (/\b(test|tests|spec)\b/.test(t)) return "test";
  if (/\b(doc|docs|readme|copy)\b/.test(t)) return "docs";
  if (/\b(add|new|feature|implement|support|page|build)\b/.test(t)) return "feature";
  return "other";
}

export async function loadPullChange(gh: GitHub, repo: string, number: number): Promise<Change | undefined> {
  const pr = await gh.pull(repo, number);
  if (!pr) return undefined;
  const [files, commits] = await Promise.all([gh.pullFiles(repo, number), gh.pullCommits(repo, number)]);
  return pullToChange(repo, pr, files.map((f) => f.filename), commits.map((c) => c.sha), files);
}

function pullToChange(repo: string, pr: GhPull, files: string[], shas: string[], fileStats?: { filename: string; additions: number; deletions: number }[]): Change {
  const additions = pr.additions ?? fileStats?.reduce((a, f) => a + f.additions, 0) ?? 0;
  const deletions = pr.deletions ?? fileStats?.reduce((a, f) => a + f.deletions, 0) ?? 0;
  return {
    key: `${repo}#${pr.number}`,
    repo,
    type: "pr",
    number: pr.number,
    url: pr.html_url,
    title: pr.title,
    author: pr.user?.login,
    kind: kindFromTitle(pr.title),
    state: pr.merged_at ? "merged" : pr.state === "open" ? "open" : "closed",
    createdAt: pr.created_at,
    mergedAt: pr.merged_at ?? undefined,
    baseRef: pr.base.ref,
    headRef: pr.head.ref,
    additions,
    deletions,
    files,
    commitShas: shas,
    mergeCommitSha: pr.merge_commit_sha ?? undefined,
    reverted: false,
  };
}

/** A commit pushed straight to the default branch, with no PR. */
export async function loadCommitChange(gh: GitHub, repo: string, sha: string): Promise<Change | undefined> {
  const c = await gh.commit(repo, sha);
  if (!c) return undefined;
  const title = c.commit.message.split("\n")[0];
  return {
    key: `${repo}@${c.sha.slice(0, 12)}`,
    repo,
    type: "commit",
    sha: c.sha,
    url: `https://github.com/${repo}/commit/${c.sha}`,
    title,
    author: c.author?.login ?? undefined,
    kind: kindFromTitle(title),
    state: "direct",
    createdAt: c.commit.author?.date,
    mergedAt: c.commit.committer?.date,
    additions: c.stats?.additions ?? 0,
    deletions: c.stats?.deletions ?? 0,
    files: (c.files ?? []).map((f) => f.filename),
    commitShas: [c.sha],
    reverted: false,
  };
}

/** Mark changes that were later reverted, by scanning base-branch commit messages. */
export async function detectReverts(gh: GitHub, changes: Change[]) {
  const byRepoBranch = new Map<string, Change[]>();
  for (const c of changes) {
    if (!c.mergedAt) continue;
    const branch = c.baseRef ?? (await gh.repoInfo(c.repo))?.default_branch ?? "main";
    const k = `${c.repo}|${branch}`;
    byRepoBranch.set(k, [...(byRepoBranch.get(k) ?? []), c]);
  }
  for (const [k, list] of byRepoBranch) {
    const [repo, branch] = k.split("|");
    const since = new Date(Math.min(...list.map((c) => Date.parse(c.mergedAt!)))).toISOString();
    let commits: GhCommit[] = [];
    try {
      commits = await gh.commitsSince(repo, branch, since, 5);
    } catch {
      continue;
    }
    for (const commit of commits) {
      const msg = commit.commit.message;
      const shaMatch = [...msg.matchAll(/This reverts commit ([0-9a-f]{7,40})/g)].map((m) => m[1]);
      const titleMatch = msg.match(/^Revert "(.+?)"/)?.[1];
      for (const c of list) {
        if (c.reverted) continue;
        const shaHit = shaMatch.some((s) => [c.mergeCommitSha, ...c.commitShas].some((x) => x?.startsWith(s) || s.startsWith(x ?? "~")));
        const titleHit = !!titleMatch && stripPrSuffix(titleMatch) === stripPrSuffix(c.title);
        const prRefHit = c.number !== undefined && new RegExp(`Reverts ${escapeRe(c.repo)}#${c.number}\\b`).test(msg);
        if ((shaHit || titleHit || prRefHit) && commit.sha !== c.mergeCommitSha) {
          c.reverted = true;
          c.revertedBy = `https://github.com/${repo}/commit/${commit.sha}`;
        }
      }
    }
  }
}

function stripPrSuffix(t: string) {
  return t.replace(/\s*\(#\d+\)\s*$/, "").trim().toLowerCase();
}
function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Measure how much of a merged change is still alive, using blame on the base branch. */
export async function measureSurvival(gh: GitHub, change: Change, opts: { maxFiles?: number; now?: number } = {}): Promise<SurvivalResult | undefined> {
  if (!change.mergedAt || change.reverted || !gh.authed) return undefined;
  const now = opts.now ?? Date.now();
  const merged = Date.parse(change.mergedAt);
  const matured = now - merged >= 30 * DAY;
  const branch = change.baseRef ?? (await gh.repoInfo(change.repo))?.default_branch ?? "main";
  const at = matured ? new Date(merged + 30 * DAY).toISOString() : new Date(now).toISOString();
  const head = await gh.lastCommitBefore(change.repo, branch, at);
  if (!head) return undefined;

  // Which commits count as "this change" on the base branch.
  const own = new Set<string>([...change.commitShas, ...(change.mergeCommitSha ? [change.mergeCommitSha] : [])]);
  try {
    const around = await gh.rest<GhCommit[]>(
      `/repos/${change.repo}/commits?sha=${encodeURIComponent(branch)}&since=${new Date(merged - 120_000).toISOString()}&until=${new Date(merged + 120_000).toISOString()}&per_page=50`,
      24 * 3600_000,
    );
    around?.forEach((c) => own.add(c.sha));
  } catch {
    /* rebase-merge fallback is best effort */
  }

  // Pick the files with the most added lines.
  let fileStats: { filename: string; additions: number; status: string }[] = [];
  if (change.type === "pr" && change.number !== undefined) fileStats = await gh.pullFiles(change.repo, change.number);
  else if (change.sha) fileStats = ((await gh.commit(change.repo, change.sha))?.files ?? []) as typeof fileStats;
  const candidates = fileStats
    .filter((f) => f.additions > 0 && f.status !== "removed" && !SKIP_FILE.test(f.filename))
    .sort((a, b) => b.additions - a.additions)
    .slice(0, opts.maxFiles ?? 8);
  if (!candidates.length) {
    return { measuredAt: head.commit.committer?.date ?? at, matured, linesAdded: 0, linesAlive: 0, ratio: 1, filesChecked: 0, method: "estimate" };
  }

  let added = 0;
  let alive = 0;
  for (const f of candidates) {
    added += f.additions;
    const ranges = await gh.blame(change.repo, head.sha, f.filename);
    if (!ranges) continue; // file deleted or renamed: counts as not alive
    let mine = 0;
    for (const r of ranges) if (own.has(r.commit.oid)) mine += r.endingLine - r.startingLine + 1;
    alive += Math.min(mine, f.additions);
  }
  return {
    measuredAt: head.commit.committer?.date ?? at,
    matured,
    linesAdded: added,
    linesAlive: alive,
    ratio: added ? Math.min(1, alive / added) : 1,
    filesChecked: candidates.length,
    method: "blame",
  };
}
