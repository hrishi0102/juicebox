/* eslint-disable @typescript-eslint/no-explicit-any -- log lines are untyped JSON written by Claude Code */
// Reads Claude Code session logs (~/.claude/projects/<folder>/<sessionId>.jsonl plus
// <sessionId>/subagents/**/agent-*.jsonl) and turns each session into a `Session` summary.
//
// Notes on the log format (Claude Code 2.1.x, checked against real logs):
// - One API response is written as several lines (one per content block). Every line repeats the
//   same `message.usage`, so usage must be counted once per `message.id` + `requestId`.
// - Subagent transcripts live in their own files and carry the parent's `sessionId`.
// - `pr-link` lines and `toolUseResult.gitOperation` record PRs, commits and pushes made in the session.
// - `cost-state` lines hold Claude Code's own running cost total, which we use as a cross-check.

import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { execFileSync } from "node:child_process";
import { addTokens, emptyModelCost, emptyTokens, priceUsage } from "./pricing";
export { sessionUsd } from "./pricing";
import type { GitPrRef, PrivateDigest, Session } from "./types";

export const DEFAULT_LOG_ROOT = join(homedir(), ".claude", "projects");

const READ_ONLY_TOOLS = new Set([
  "Read", "Grep", "Glob", "LS", "WebFetch", "WebSearch", "ToolSearch", "TaskOutput", "NotebookRead",
]);
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const TEST_RE = /\b(npm|pnpm|yarn|bun)\s+(run\s+)?test\b|\b(jest|vitest|pytest|mocha|playwright|go test|cargo test|forge test)\b/;
const ACTIVE_GAP_MS = 15 * 60 * 1000;

export type SessionFile = { sessionId: string; projectDir: string; main: string; subagents: string[]; mtimeMs: number; bytes: number };

export function listSessionFiles(root = DEFAULT_LOG_ROOT): SessionFile[] {
  if (!existsSync(/*turbopackIgnore: true*/ root)) return [];
  const out: SessionFile[] = [];
  for (const projectDir of readdirSync(/*turbopackIgnore: true*/ root)) {
    const dir = join(root, projectDir);
    if (!safeIsDir(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".jsonl")) continue;
      const sessionId = f.slice(0, -6);
      const main = join(dir, f);
      const st = statSync(main);
      const subagents = walkJsonl(join(dir, sessionId, "subagents"));
      let mtimeMs = st.mtimeMs;
      let bytes = st.size;
      for (const s of subagents) {
        const ss = statSync(s);
        mtimeMs = Math.max(mtimeMs, ss.mtimeMs);
        bytes += ss.size;
      }
      out.push({ sessionId, projectDir, main, subagents, mtimeMs, bytes });
    }
  }
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function safeIsDir(p: string) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function walkJsonl(dir: string, acc: string[] = []): string[] {
  if (!safeIsDir(dir)) return acc;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (safeIsDir(p)) walkJsonl(p, acc);
    else if (f.endsWith(".jsonl")) acc.push(p);
  }
  return acc;
}

async function* readLines(file: string): AsyncGenerator<Record<string, any>> {
  const rl = createInterface({ input: createReadStream(file, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line || line[0] !== "{") continue;
    try {
      yield JSON.parse(line);
    } catch {
      // partial line from a live session; skip
    }
  }
}

function countPatch(patch: unknown): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  if (!Array.isArray(patch)) return { added, removed };
  for (const hunk of patch) {
    for (const l of hunk?.lines ?? []) {
      if (typeof l !== "string") continue;
      if (l.startsWith("+")) added++;
      else if (l.startsWith("-")) removed++;
    }
  }
  return { added, removed };
}

export function parsePrUrl(url: string): GitPrRef | undefined {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!m) return undefined;
  return { repo: `${m[1]}/${m[2]}`, number: Number(m[3]), url: `https://github.com/${m[1]}/${m[2]}/pull/${m[3]}` };
}

function userText(msg: any): string | undefined {
  const c = msg?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    if (c.some((x: any) => x?.type === "tool_result")) return undefined;
    const t = c.filter((x: any) => x?.type === "text").map((x: any) => x.text).join("\n");
    return t || undefined;
  }
  return undefined;
}

function isRealPrompt(text: string) {
  const t = text.trim();
  if (!t) return false;
  if (t.startsWith("<command-") || t.startsWith("<local-command") || t.startsWith("Caveat:")) return false;
  if (t.startsWith("[Request interrupted")) return false;
  if (t.startsWith("<system-reminder>") && !t.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").trim()) return false;
  return true;
}

export function cleanPrompt(text: string, max = 400) {
  return text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<pasted_content[\s\S]*?<\/pasted_content[^>]*>/g, "[pasted text]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Parse one session (main transcript plus its subagent transcripts). */
export async function parseSession(sf: SessionFile): Promise<Session | undefined> {
  const seenMsg = new Set<string>();
  const seenTool = new Set<string>();
  const timestamps: number[] = [];
  const cwdCount = new Map<string, number>();
  const branchCount = new Map<string, number>();
  const models = new Set<string>();
  const unknownModels = new Set<string>();
  const tokens = emptyTokens();
  const byModel: Session["cost"]["byModel"] = {};
  let usd = 0;
  let webSearches = 0;
  // cost-state is cumulative per Claude Code process. A resumed session starts a new process,
  // so the total resets. We sum the last value of every segment.
  const costSegments: { usd: number; added: number; removed: number }[] = [];
  let aiTitle: string | undefined;
  let customTitle: string | undefined;
  const tools: Record<string, number> = {};
  const toolNameById = new Map<string, string>();
  const editsPerFile = new Map<string, number>();
  const bashCounts = new Map<string, number>();
  const prs = new Map<string, GitPrRef>();
  const commits: Session["git"]["commits"] = [];
  const pushes: Session["git"]["pushes"] = [];
  let linesAdded = 0;
  let linesRemoved = 0;
  let userPrompts = 0;
  let toolCalls = 0;
  let toolErrors = 0;
  let errorStreak = 0;
  let maxErrorStreak = 0;
  let testRuns = 0;
  let apiErrors = 0;
  let compactions = 0;
  let interruptions = 0;
  let readOnlyCalls = 0;
  const subagentIds = new Set<string>();

  const files = [sf.main, ...sf.subagents];
  for (const file of files) {
    const isSub = file !== sf.main;
    for await (const o of readLines(file)) {
      const ts = o.timestamp ? Date.parse(o.timestamp) : NaN;
      switch (o.type) {
        case "assistant": {
          if (!Number.isNaN(ts)) timestamps.push(ts);
          if (!isSub && o.cwd) cwdCount.set(o.cwd, (cwdCount.get(o.cwd) ?? 0) + 1);
          if (o.gitBranch) branchCount.set(o.gitBranch, (branchCount.get(o.gitBranch) ?? 0) + 1);
          if (o.agentId) subagentIds.add(o.agentId);
          const msg = o.message ?? {};
          const model: string = msg.model ?? "unknown";
          const key = `${msg.id ?? o.uuid}|${o.requestId ?? ""}`;
          if (!seenMsg.has(key) && msg.usage && model !== "<synthetic>") {
            seenMsg.add(key);
            const priced = priceUsage(model, msg.usage);
            if (!priced.known) unknownModels.add(model);
            models.add(model);
            usd += priced.usd;
            webSearches += priced.webSearches;
            addTokens(tokens, priced.tokens);
            const mc = (byModel[model] ??= emptyModelCost());
            addTokens(mc, priced.tokens);
            mc.usd += priced.usd;
            mc.requests += 1;
            mc.webSearches += priced.webSearches;
          }
          for (const c of msg.content ?? []) {
            if (c?.type !== "tool_use" || !c.id || seenTool.has(c.id)) continue;
            seenTool.add(c.id);
            toolNameById.set(c.id, c.name);
            toolCalls++;
            tools[c.name] = (tools[c.name] ?? 0) + 1;
            if (READ_ONLY_TOOLS.has(c.name)) readOnlyCalls++;
            if (EDIT_TOOLS.has(c.name)) {
              const fp = c.input?.file_path ?? c.input?.notebook_path;
              if (typeof fp === "string") editsPerFile.set(fp, (editsPerFile.get(fp) ?? 0) + 1);
            }
            if (c.name === "Bash") {
              const cmd = String(c.input?.command ?? "").trim();
              if (cmd) {
                const norm = cmd.replace(/\s+/g, " ").slice(0, 300);
                bashCounts.set(norm, (bashCounts.get(norm) ?? 0) + 1);
                if (TEST_RE.test(cmd)) testRuns++;
              }
            }
          }
          if (o.isApiErrorMessage) apiErrors++;
          break;
        }
        case "user": {
          if (!Number.isNaN(ts)) timestamps.push(ts);
          const content = o.message?.content;
          if (Array.isArray(content)) {
            for (const b of content) {
              if (b?.type !== "tool_result") continue;
              if (b.is_error) {
                toolErrors++;
                errorStreak++;
                maxErrorStreak = Math.max(maxErrorStreak, errorStreak);
              } else errorStreak = 0;
            }
          }
          const r = o.toolUseResult;
          if (r && typeof r === "object") {
            if (r.structuredPatch) {
              const p = countPatch(r.structuredPatch);
              linesAdded += p.added;
              linesRemoved += p.removed;
              if (p.added === 0 && p.removed === 0 && r.type === "create" && typeof r.content === "string") {
                linesAdded += r.content.split("\n").length;
              }
            }
            const g = r.gitOperation;
            if (g) {
              const at = o.timestamp ?? "";
              if (g.commit?.sha && /^[0-9a-f]{7,40}$/i.test(g.commit.sha)) commits.push({ sha: g.commit.sha, branch: g.commit.branch, at });
              if (g.push?.branch) pushes.push({ branch: g.push.branch, at });
              if (g.pr?.url) {
                const ref = parsePrUrl(g.pr.url);
                if (ref) prs.set(ref.url, { ...ref, action: g.pr.action });
              }
            }
          }
          if (!isSub && !o.isMeta && !o.isCompactSummary) {
            const text = userText(o.message);
            if (text && text.includes("[Request interrupted")) interruptions++;
            if (text && isRealPrompt(text)) userPrompts++;
          }
          break;
        }
        case "pr-link": {
          if (o.prUrl) {
            const ref = parsePrUrl(o.prUrl);
            if (ref && !prs.has(ref.url)) prs.set(ref.url, { ...ref, action: "linked" });
          }
          break;
        }
        case "cost-state": {
          if (typeof o.totalCostUSD === "number" && !isSub) {
            const cur = { usd: o.totalCostUSD, added: o.totalLinesAdded ?? 0, removed: o.totalLinesRemoved ?? 0 };
            const last = costSegments[costSegments.length - 1];
            if (!last || cur.usd < last.usd - 1e-9) costSegments.push(cur);
            else costSegments[costSegments.length - 1] = cur;
          }
          break;
        }
        case "ai-title":
          if (!isSub && o.aiTitle) aiTitle = o.aiTitle;
          break;
        case "custom-title":
          if (!isSub && o.customTitle) customTitle = o.customTitle;
          break;
        case "system":
          if (o.subtype === "api_error") apiErrors++;
          if (o.subtype === "compact_boundary") compactions++;
          break;
      }
    }
  }

  if (timestamps.length === 0 || seenMsg.size === 0) return undefined;
  const claudeReportedUsd = costSegments.length ? costSegments.reduce((a, c) => a + c.usd, 0) : undefined;
  const costStateLines = costSegments.length
    ? { added: costSegments.reduce((a, c) => a + c.added, 0), removed: costSegments.reduce((a, c) => a + c.removed, 0) }
    : undefined;
  timestamps.sort((a, b) => a - b);
  let activeMs = 0;
  for (let i = 1; i < timestamps.length; i++) {
    const gap = timestamps[i] - timestamps[i - 1];
    if (gap <= ACTIVE_GAP_MS) activeMs += gap;
  }

  const cwd = [...cwdCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const branches = [...branchCount.keys()].filter((b) => !["HEAD", "main", "master", "develop", "dev"].includes(b));
  for (const c of commits) if (c.branch && !branches.includes(c.branch) && !["HEAD", "main", "master"].includes(c.branch)) branches.push(c.branch);
  for (const p of pushes) if (!branches.includes(p.branch) && !["HEAD", "main", "master"].includes(p.branch)) branches.push(p.branch);

  const repeatedCommands = [...bashCounts.values()].filter((n) => n >= 3).length;
  const maxEditsSameFile = Math.max(0, ...editsPerFile.values());
  const prList = [...prs.values()];
  const repos = [...new Set(prList.map((p) => p.repo))];

  return {
    id: sf.sessionId,
    projectDir: sf.projectDir,
    cwd,
    repos,
    branches,
    startedAt: new Date(timestamps[0]).toISOString(),
    endedAt: new Date(timestamps[timestamps.length - 1]).toISOString(),
    activeMinutes: Math.round(activeMs / 60000),
    title: customTitle ?? aiTitle,
    models: [...models],
    cost: {
      usd: round(usd, 4),
      claudeReportedUsd: claudeReportedUsd === undefined ? undefined : round(claudeReportedUsd, 4),
      tokens,
      byModel,
      webSearches,
      unknownModels: [...unknownModels],
    },
    filesEdited: [...editsPerFile.keys()],
    linesAdded: Math.max(costStateLines?.added ?? 0, linesAdded),
    linesRemoved: Math.max(costStateLines?.removed ?? 0, linesRemoved),
    git: { commits, pushes, prs: prList },
    signals: {
      userPrompts,
      assistantTurns: seenMsg.size,
      toolCalls,
      toolErrors,
      maxErrorStreak,
      repeatedCommands,
      maxEditsSameFile,
      testRuns,
      apiErrors,
      compactions,
      interruptions,
      readOnlyRatio: toolCalls ? round(readOnlyCalls / toolCalls, 3) : 0,
      subagents: Math.max(subagentIds.size, sf.subagents.length),
    },
    tools,
  };
}

function round(n: number, d: number) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

/** Scan all sessions that were active since `since`. */
export async function scanSessions(
  opts: { root?: string; codexRoot?: string; includeCodex?: boolean; since?: Date; limit?: number; onProgress?: (done: number, total: number) => void } = {},
) {
  const root = opts.root ?? DEFAULT_LOG_ROOT;
  let files = listSessionFiles(root);
  if (opts.since) files = files.filter((f) => f.mtimeMs >= opts.since!.getTime());
  if (opts.limit) files = files.slice(0, opts.limit);
  const sessions: Session[] = [];
  let done = 0;
  for (const f of files) {
    const s = await parseSession(f);
    done++;
    opts.onProgress?.(done, files.length);
    if (!s) continue;
    if (opts.since && Date.parse(s.endedAt) < opts.since.getTime()) continue;
    sessions.push(s);
  }
  // Other AI tools go through their own readers but end up as the same Session shape.
  if (opts.includeCodex !== false) {
    const { scanCodexSessions } = await import("./codex");
    sessions.push(...(await scanCodexSessions({ root: opts.codexRoot, since: opts.since })));
  }
  resolveRepos(sessions);
  return sessions.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

const remoteCache = new Map<string, string | null>();

export function repoFromRemote(url: string): string | undefined {
  const m = url.trim().match(/github\.com[:/]([^/]+)\/([^/\s]+?)(\.git)?$/);
  return m ? `${m[1]}/${m[2]}` : undefined;
}

function gitRemoteFor(cwd: string): string | null {
  if (!cwd) return null;
  if (remoteCache.has(cwd)) return remoteCache.get(cwd)!;
  let repo: string | null = null;
  try {
    if (existsSync(cwd)) {
      const url = execFileSync("git", ["-C", cwd, "remote", "get-url", "origin"], { stdio: ["ignore", "pipe", "ignore"] }).toString();
      repo = repoFromRemote(url) ?? null;
    }
  } catch {
    repo = null;
  }
  remoteCache.set(cwd, repo);
  return repo;
}

/** Find the GitHub repo of a file path by walking up to the nearest existing folder. */
function repoForPath(file: string): string | null {
  let dir = dirname(file);
  for (let i = 0; i < 12 && dir.length > 1; i++) {
    if (existsSync(dir)) return gitRemoteFor(dir);
    dir = dirname(dir);
  }
  return null;
}

/**
 * Fill `session.repos` when the session itself did not record a PR URL:
 * 1. the git remote of the session's folder, if the folder still exists
 * 2. otherwise a repo seen in another session from the same folder
 * 3. otherwise a known repo whose name equals the folder name
 */
export function resolveRepos(sessions: Session[]) {
  const byCwd = new Map<string, Set<string>>();
  const known = new Set<string>();
  for (const s of sessions) {
    for (const r of s.repos) known.add(r);
    const remote = gitRemoteFor(s.cwd);
    if (remote) {
      known.add(remote);
      if (!s.repos.includes(remote)) s.repos.unshift(remote);
    }
    if (s.repos.length) {
      const set = byCwd.get(s.cwd) ?? new Set();
      s.repos.forEach((r) => set.add(r));
      byCwd.set(s.cwd, set);
    }
  }
  const knownByName = new Map<string, string>();
  for (const r of known) knownByName.set(r.split("/")[1].toLowerCase(), r);
  for (const s of sessions) {
    if (s.repos.length) continue;
    // The folder may hold several repos (or be gone). Edited files point at the real repo.
    const fromFiles = new Map<string, number>();
    for (const f of s.filesEdited.slice(0, 40)) {
      // Folders get moved after the fact, so also match path segments against known repo names.
      const r = repoForPath(f) ?? f.split("/").map((seg) => knownByName.get(seg.toLowerCase())).find(Boolean) ?? null;
      if (r) fromFiles.set(r, (fromFiles.get(r) ?? 0) + 1);
    }
    if (fromFiles.size) {
      s.repos = [...fromFiles.entries()].sort((x, y) => y[1] - x[1]).map(([r]) => r);
      continue;
    }
    const fromCwd = byCwd.get(s.cwd);
    if (fromCwd?.size === 1) {
      s.repos = [...fromCwd];
      continue;
    }
    const base = s.cwd.split("/").filter(Boolean).pop()?.toLowerCase();
    const byName = [...known].filter((r) => r.split("/")[1]?.toLowerCase() === base);
    if (byName.length === 1) s.repos = byName;
  }
}

/**
 * Build the private digest for the judge by re-reading the transcript.
 * Prompts are trimmed and kept in memory only; callers must not persist this object
 * anywhere except the encrypted/TEE judge request.
 */
export async function buildPrivateDigest(session: Session, root = DEFAULT_LOG_ROOT, outcome = ""): Promise<PrivateDigest> {
  const main = join(root, session.projectDir, `${session.id}.jsonl`);
  const prompts: string[] = [];
  if (session.tool === "codex" && session.file) {
    const { codexPrompts } = await import("./codex");
    prompts.push(...(await codexPrompts(session.file)));
  } else if (existsSync(main)) {
    for await (const o of readLines(main)) {
      if (o.type !== "user" || o.isMeta || o.isCompactSummary) continue;
      const t = userText(o.message);
      if (t && isRealPrompt(t)) prompts.push(cleanPrompt(t));
    }
  }
  const keep = prompts.length > 10 ? [...prompts.slice(0, 6), `[${prompts.length - 9} more prompts]`, ...prompts.slice(-3)] : prompts;
  const s = session.signals;
  const topTools = Object.entries(session.tools)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k, v]) => `${k}x${v}`)
    .join(", ");
  return {
    sessionId: session.id,
    prompts: keep,
    toolSummary:
      `${s.toolCalls} tool calls (${topTools}); ${s.toolErrors} tool errors, longest error streak ${s.maxErrorStreak}; ` +
      `${s.repeatedCommands} commands repeated 3+ times; max edits to one file ${s.maxEditsSameFile}; ${s.testRuns} test runs; ` +
      `${session.filesEdited.length} files edited, +${session.linesAdded}/-${session.linesRemoved} lines; read-only share ${Math.round(s.readOnlyRatio * 100)}%; ` +
      `${s.subagents} subagents; ${s.compactions} context compactions; ${session.activeMinutes} active minutes.`,
    outcomeSummary: outcome || "No linked pull request or commit found.",
    costSummary: `$${session.cost.usd.toFixed(2)} across ${s.assistantTurns} model calls (${session.models.join(", ")}).`,
  };
}
