// Link sessions to the work they produced.
// Signals, strongest first:
//   pr-link     the session created or linked the PR (Claude Code writes pr-link lines)
//   commit      a commit made in the session is part of the PR (or a direct commit on main)
//   branch      the session worked on (or pushed) the PR's head branch, around the same time
//   files-time  the session edited files that a PR changed, within a week of the session; or, when
//               no PR fits, files that one of the person's own commits pushed straight to main changed

import type { GitHub, GhPull } from "./github";
import { loadCommitChange, loadPullChange } from "./outcomes";
import type { Change, MatchReason, Session, SessionMatch } from "./types";

const DAY = 86400_000;
const MINUTE = 60_000;

export async function pool<T, R>(items: T[], size: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return out;
}

export async function matchSessions(gh: GitHub, sessions: Session[], log: (m: string) => void = () => {}) {
  const changes = new Map<string, Change>();
  const loading = new Map<string, Promise<Change | undefined>>();
  const found = new Map<string, Map<string, { reason: MatchReason; confidence: number }>>();

  const loadPr = (repo: string, n: number) => {
    const k = `${repo}#${n}`;
    if (!loading.has(k)) {
      loading.set(
        k,
        loadPullChange(gh, repo, n)
          .then((c) => {
            if (c) changes.set(c.key, c);
            return c;
          })
          .catch((e) => {
            log(`could not load ${k}: ${String(e).slice(0, 120)}`);
            return undefined;
          }),
      );
    }
    return loading.get(k)!;
  };

  const add = (s: Session, c: Change | undefined, reason: MatchReason, confidence: number) => {
    if (!c) return;
    const m = found.get(s.id) ?? new Map();
    const prev = m.get(c.key);
    if (!prev || prev.confidence < confidence) m.set(c.key, { reason, confidence });
    found.set(s.id, m);
  };

  const recentByRepo = new Map<string, Promise<GhPull[]>>();
  const recent = (repo: string) => {
    if (!recentByRepo.has(repo)) recentByRepo.set(repo, gh.recentPulls(repo).catch(() => []));
    return recentByRepo.get(repo)!;
  };

  // Commits pushed straight to the default branch, without a PR, by the person whose GitHub token
  // this is: work that never had a PR still counts. Read once per repo, from a day before the first
  // session; each commit is loaded (files, title) only when a session needs it.
  const firstStart = Math.min(...sessions.map((s) => Date.parse(s.startedAt)).filter(Number.isFinite));
  const me = gh.login().catch(() => undefined);
  const pushesByRepo = new Map<string, Promise<{ sha: string; at: number; branch: string }[]>>();
  const mainPushes = (repo: string) => {
    if (!pushesByRepo.has(repo)) {
      pushesByRepo.set(
        repo,
        (async () => {
          const branch = (await gh.repoInfo(repo))?.default_branch ?? "main";
          const login = await me;
          const list = await gh.commitsSince(repo, branch, new Date(firstStart - DAY).toISOString(), 3);
          return list
            .filter((c) => !login || c.author?.login?.toLowerCase() === login.toLowerCase())
            .map((c) => ({ sha: c.sha, at: Date.parse(c.commit.committer?.date ?? c.commit.author?.date ?? ""), branch }));
        })().catch(() => []),
      );
    }
    return pushesByRepo.get(repo)!;
  };
  const loadPush = (repo: string, sha: string, branch: string) => {
    const k = `${repo}@${sha}`;
    if (!loading.has(k)) {
      loading.set(
        k,
        (async () => {
          // A commit that belongs to a PR is that PR's work, matched above; only PR-less pushes here.
          if (((await gh.pullsForCommit(repo, sha)) ?? []).length) return undefined;
          const c = await loadCommitChange(gh, repo, sha, branch);
          if (c) changes.set(c.key, c);
          return c;
        })().catch((e) => {
          log(`could not load ${k}: ${String(e).slice(0, 120)}`);
          return undefined;
        }),
      );
    }
    return loading.get(k)!;
  };

  await pool(sessions, 6, async (s) => {
    const start = Date.parse(s.startedAt);
    const end = Date.parse(s.endedAt);

    // 1. Explicit PR links
    for (const p of s.git.prs) add(s, await loadPr(p.repo, p.number), "pr-link", p.action === "created" ? 0.97 : 0.93);

    const repo = s.repos[0];
    if (!repo) return;

    // 2. Commits made in the session
    for (const c of s.git.commits) {
      try {
        const prs = (await gh.pullsForCommit(repo, c.sha)) ?? [];
        if (prs.length) for (const pr of prs) add(s, await loadPr(repo, pr.number), "commit", 0.9);
        else add(s, await loadCommitChange(gh, repo, c.sha).then((ch) => (ch ? (changes.set(ch.key, ch), ch) : undefined)), "commit", 0.85);
      } catch (e) {
        log(`commit lookup failed for ${repo}@${c.sha}: ${String(e).slice(0, 100)}`);
      }
    }

    // 3. Branch the session worked on
    for (const b of s.branches) {
      try {
        const prs = (await gh.pullsForBranch(repo, b)) ?? [];
        for (const pr of prs) {
          const created = Date.parse(pr.created_at);
          if (created < start - 21 * DAY || created > end + 21 * DAY) continue;
          add(s, await loadPr(repo, pr.number), "branch", 0.75);
        }
      } catch (e) {
        log(`branch lookup failed for ${repo}:${b}: ${String(e).slice(0, 100)}`);
      }
    }

    // 4. Files edited + time window (only when nothing stronger matched)
    if ((found.get(s.id)?.size ?? 0) === 0 && s.filesEdited.length) {
      const pulls = (await recent(repo)).filter((p) => {
        const created = Date.parse(p.created_at);
        const closed = p.merged_at ? Date.parse(p.merged_at) : p.closed_at ? Date.parse(p.closed_at) : Date.now();
        return created <= end + 7 * DAY && closed >= start - DAY;
      });
      const nearest = pulls.sort((a, b) => Math.abs(Date.parse(a.created_at) - end) - Math.abs(Date.parse(b.created_at) - end)).slice(0, 12);
      for (const p of nearest) {
        const c = await loadPr(repo, p.number);
        if (!c?.files.length) continue;
        const overlap = s.filesEdited.filter((f) => c.files.some((pf) => f === pf || f.endsWith("/" + pf))).length;
        if (overlap === 0) continue;
        const shareOfPr = overlap / c.files.length;
        const shareOfSession = overlap / s.filesEdited.length;
        // Giant PRs (vendored code, generated files) overlap with everything; require a real share.
        if (c.files.length > 100 && shareOfPr < 0.3) continue;
        if (shareOfPr >= 0.3 || (overlap >= 3 && shareOfSession >= 0.3)) add(s, c, "files-time", Math.min(0.7, 0.35 + 0.35 * shareOfPr + 0.05 * overlap));
      }
    }

    // 5. Files edited + time, against the person's own pushes to main (only when still nothing matched)
    if ((found.get(s.id)?.size ?? 0) === 0 && s.filesEdited.length) {
      const near = (await mainPushes(repo))
        // Committed during the session or within two days after it (ten minutes of slack for clocks);
        // a commit from before the session started is not its work.
        .filter((p) => p.at >= start - 10 * MINUTE && p.at <= end + 2 * DAY)
        .sort((a, b) => Math.abs(a.at - end) - Math.abs(b.at - end))
        .slice(0, 8);
      for (const p of near) {
        const c = await loadPush(repo, p.sha, p.branch);
        if (!c?.files.length) continue;
        const overlap = s.filesEdited.filter((f) => c.files.some((cf) => f === cf || f.endsWith("/" + cf))).length;
        if (overlap === 0) continue;
        const shareOfCommit = overlap / c.files.length;
        if (c.files.length > 100 && shareOfCommit < 0.3) continue;
        if (shareOfCommit >= 0.3 || (overlap >= 3 && overlap / s.filesEdited.length >= 0.3)) add(s, c, "files-time", Math.min(0.65, 0.35 + 0.3 * shareOfCommit + 0.05 * overlap));
      }
    }
  });

  const matches: SessionMatch[] = [];
  for (const [sessionId, m] of found) for (const [changeKey, v] of m) matches.push({ sessionId, changeKey, ...v });
  return { changes: [...changes.values()], matches };
}

/**
 * Split each session's cost across the changes it matched, weighted by match confidence.
 * Returns, per change, how much each session contributed.
 */
export function attributeCost(sessions: { id: string; usd: number }[], matches: SessionMatch[]) {
  const byChange = new Map<string, Map<string, number>>();
  const bySession = new Map<string, SessionMatch[]>();
  for (const m of matches) bySession.set(m.sessionId, [...(bySession.get(m.sessionId) ?? []), m]);
  for (const s of sessions) {
    const ms = bySession.get(s.id) ?? [];
    const total = ms.reduce((a, m) => a + m.confidence, 0);
    for (const m of ms) {
      const per = byChange.get(m.changeKey) ?? new Map<string, number>();
      per.set(s.id, (per.get(s.id) ?? 0) + (s.usd * m.confidence) / total);
      byChange.set(m.changeKey, per);
    }
  }
  return byChange;
}
