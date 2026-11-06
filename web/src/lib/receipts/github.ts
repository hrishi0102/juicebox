// Minimal GitHub client (REST + GraphQL) with an on-disk cache.
// Token: GITHUB_TOKEN, else `gh auth token` if the GitHub CLI is logged in.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR, ensureDir } from "./store";

const API = "https://api.github.com";
const HOUR = 3600_000;

export type GhPull = {
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  merged_at: string | null;
  created_at: string;
  closed_at: string | null;
  merge_commit_sha: string | null;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  user?: { login: string };
  head: { ref: string; sha: string };
  base: { ref: string };
  body?: string | null;
};

export type GhFile = { filename: string; status: string; additions: number; deletions: number; previous_filename?: string };
export type GhCommit = { sha: string; commit: { message: string; author?: { date?: string }; committer?: { date?: string } }; author?: { login?: string } | null; stats?: { additions: number; deletions: number }; files?: GhFile[] };
export type BlameRange = { startingLine: number; endingLine: number; commit: { oid: string } };

export function resolveGithubToken(): string | undefined {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execFileSync("gh", ["auth", "token"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || undefined;
  } catch {
    return undefined;
  }
}

export class GitHub {
  private cacheDir: string;
  calls = 0;
  cacheHits = 0;

  constructor(private token: string | undefined = resolveGithubToken(), cacheDir = join(DATA_DIR, "cache", "github")) {
    this.cacheDir = ensureDir(cacheDir);
  }

  get authed() {
    return !!this.token;
  }

  private cachePath(key: string) {
    return join(this.cacheDir, createHash("sha1").update(key).digest("hex") + ".json");
  }

  private readCache<T>(key: string, ttlMs: number): T | undefined {
    const p = this.cachePath(key);
    if (!existsSync(p)) return undefined;
    try {
      const { at, data } = JSON.parse(readFileSync(p, "utf8"));
      if (Date.now() - at > ttlMs) return undefined;
      this.cacheHits++;
      return data as T;
    } catch {
      return undefined;
    }
  }

  private writeCache(key: string, data: unknown) {
    writeFileSync(this.cachePath(key), JSON.stringify({ at: Date.now(), data }));
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "receipts-app" };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }

  async rest<T>(path: string, ttlMs = HOUR): Promise<T | undefined> {
    const key = `rest:${path}`;
    const cached = this.readCache<T | null>(key, ttlMs);
    if (cached !== undefined) return cached ?? undefined;
    this.calls++;
    const res = await fetch(API + path, { headers: this.headers() });
    if (res.status === 404 || res.status === 422 || res.status === 409) {
      this.writeCache(key, null);
      return undefined;
    }
    if (!res.ok) throw new Error(`GitHub ${res.status} on ${path}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as T;
    this.writeCache(key, data);
    return data;
  }

  async restPaged<T>(path: string, maxPages = 5, ttlMs = HOUR): Promise<T[]> {
    const out: T[] = [];
    const sep = path.includes("?") ? "&" : "?";
    for (let page = 1; page <= maxPages; page++) {
      const batch = await this.rest<T[]>(`${path}${sep}per_page=100&page=${page}`, ttlMs);
      if (!batch?.length) break;
      out.push(...batch);
      if (batch.length < 100) break;
    }
    return out;
  }

  async graphql<T>(query: string, variables: Record<string, unknown>, ttlMs = 6 * HOUR): Promise<T | undefined> {
    if (!this.token) return undefined; // GraphQL needs auth
    const key = `gql:${query}:${JSON.stringify(variables)}`;
    const cached = this.readCache<T | null>(key, ttlMs);
    if (cached !== undefined) return cached ?? undefined;
    this.calls++;
    const res = await fetch(API + "/graphql", { method: "POST", headers: this.headers(), body: JSON.stringify({ query, variables }) });
    if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { data?: T; errors?: unknown[] };
    const data = json.data ?? null;
    this.writeCache(key, data);
    return data ?? undefined;
  }

  pull(repo: string, n: number) {
    return this.rest<GhPull>(`/repos/${repo}/pulls/${n}`);
  }
  pullFiles(repo: string, n: number) {
    return this.restPaged<GhFile>(`/repos/${repo}/pulls/${n}/files`, 3, 24 * HOUR);
  }
  pullCommits(repo: string, n: number) {
    return this.restPaged<GhCommit>(`/repos/${repo}/pulls/${n}/commits`, 3, 24 * HOUR);
  }
  pullsForCommit(repo: string, sha: string) {
    return this.rest<GhPull[]>(`/repos/${repo}/commits/${sha}/pulls`);
  }
  pullsForBranch(repo: string, branch: string) {
    const owner = repo.split("/")[0];
    return this.rest<GhPull[]>(`/repos/${repo}/pulls?state=all&head=${encodeURIComponent(`${owner}:${branch}`)}&per_page=20`);
  }
  recentPulls(repo: string) {
    return this.restPaged<GhPull>(`/repos/${repo}/pulls?state=all&sort=updated&direction=desc`, 2);
  }
  commit(repo: string, sha: string) {
    return this.rest<GhCommit>(`/repos/${repo}/commits/${sha}`, 24 * HOUR);
  }
  commitsSince(repo: string, branch: string, since: string, maxPages = 5) {
    return this.restPaged<GhCommit>(`/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&since=${since}`, maxPages);
  }
  async lastCommitBefore(repo: string, branch: string, until: string) {
    const list = await this.rest<GhCommit[]>(`/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&until=${until}&per_page=1`, 24 * HOUR);
    return list?.[0];
  }
  /**
   * Whether a commit is in a branch's history, from GitHub's compare (branch...sha): "behind" or
   * "identical" means the branch already contains it; "ahead" or "diverged" means it is somewhere else.
   * Undefined when GitHub could not say.
   */
  async inBranch(repo: string, sha: string, branch: string) {
    const r = await this.rest<{ status: string }>(`/repos/${repo}/compare/${encodeURIComponent(branch)}...${sha}`, HOUR);
    return r ? r.status === "behind" || r.status === "identical" : undefined;
  }
  /** The login of whoever owns the GitHub token. */
  async login() {
    return (await this.rest<{ login: string }>("/user", 24 * HOUR))?.login;
  }
  async repoInfo(repo: string) {
    return this.rest<{ default_branch: string; private: boolean; full_name: string }>(`/repos/${repo}`, 24 * HOUR);
  }

  async blame(repo: string, ref: string, path: string): Promise<BlameRange[] | null> {
    const [owner, name] = repo.split("/");
    const q = `query($owner:String!,$name:String!,$expr:String!,$path:String!){repository(owner:$owner,name:$name){object(expression:$expr){... on Commit{blame(path:$path){ranges{startingLine endingLine commit{oid}}}}}}}`;
    try {
      const data = await this.graphql<{ repository: { object: { blame?: { ranges: BlameRange[] } } | null } }>(q, { owner, name, expr: ref, path });
      return data?.repository?.object?.blame?.ranges ?? null;
    } catch {
      return null;
    }
  }
}
