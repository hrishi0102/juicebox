// Link sessions to the work they produced.
// Signals, strongest first:
//   pr-link     the session created or linked the PR (Claude Code writes pr-link lines)
//   commit      a commit made in the session is part of the PR (or a direct commit on main)
//   branch      the session worked on (or pushed) the PR's head branch, around the same time
//   files-time  the session edited files that a PR changed, within a week of the session

import type { GitHub, GhPull } from "./github";
import { loadCommitChange, loadPullChange } from "./outcomes";
import type { Change, MatchReason, Session, SessionMatch } from "./types";

const DAY = 86400_000;

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
  });

  const matches: SessionMatch[] = [];
  for (const [sessionId, m] of found) for (const [changeKey, v] of m) matches.push({ sessionId, changeKey, ...v });
  return { changes: [...changes.values()], matches };
}

/** Split each session's cost across the changes it matched, weighted by match confidence. */
export function attributeCost(sessions: { id: string; usd: number }[], matches: SessionMatch[]) {
  const byChange = new Map<string, number>();
  const bySession = new Map<string, SessionMatch[]>();
  for (const m of matches) bySession.set(m.sessionId, [...(bySession.get(m.sessionId) ?? []), m]);
  for (const s of sessions) {
    const ms = bySession.get(s.id) ?? [];
    const total = ms.reduce((a, m) => a + m.confidence, 0);
    for (const m of ms) byChange.set(m.changeKey, (byChange.get(m.changeKey) ?? 0) + (s.usd * m.confidence) / total);
  }
  return byChange;
}
