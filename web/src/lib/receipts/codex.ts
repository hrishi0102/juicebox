/* eslint-disable @typescript-eslint/no-explicit-any -- log lines are untyped JSON written by Codex */
// Reader for OpenAI Codex sessions (CLI and desktop app):
//   ~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<sessionId>.jsonl
//
// Format notes (checked against real files, Codex 0.119 to 0.153):
// - `session_meta` holds the session id and working folder; `turn_context` holds the model per turn.
// - `token_usage_record` (newer versions) has usage per API response with a `response_id`.
//   Older versions only have `event_msg/token_count` with a running `total_token_usage`; we use the
//   increase between consecutive events.
// - OpenAI counts cached tokens inside `input_tokens` and reasoning inside `output_tokens`.
// - Edits are `apply_patch` calls (a patch text with "*** Update File:" headers and +/- lines).
// - Shell commands are `exec` / `exec_command`; their output says "Process exited with code N".
//
// Output: the same `Session` shape the Claude Code parser produces, with `tool: "codex"`.

import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { addTokens, emptyModelCost, emptyTokens, priceOpenAiUsage } from "./pricing";
import { cleanPrompt, parsePrUrl } from "./parse";
import type { GitPrRef, Session } from "./types";

export const DEFAULT_CODEX_ROOT = join(homedir(), ".codex", "sessions");
const ACTIVE_GAP_MS = 15 * 60 * 1000;
const TEST_RE = /\b(npm|pnpm|yarn|bun)\s+(run\s+)?test\b|\b(jest|vitest|pytest|mocha|playwright|go test|cargo test|forge test)\b/;
const READ_ONLY_CMD = /^\s*(cat|ls|rg|grep|sed -n|head|tail|find|pwd|wc|git (status|log|diff|show))\b/;

export function listCodexFiles(root = DEFAULT_CODEX_ROOT): { file: string; mtimeMs: number }[] {
  const out: { file: string; mtimeMs: number }[] = [];
  const walk = (d: string) => {
    if (!existsSync(d)) return;
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (f.endsWith(".jsonl")) out.push({ file: p, mtimeMs: st.mtimeMs });
    }
  };
  walk(root);
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

async function* lines(file: string): AsyncGenerator<Record<string, any>> {
  const rl = createInterface({ input: createReadStream(file, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line || line[0] !== "{") continue;
    try {
      yield JSON.parse(line);
    } catch {
      /* partial line */
    }
  }
}

/** Files touched by an apply_patch call, and the lines it adds and removes. */
export function parsePatch(patch: string) {
  const files: string[] = [];
  let added = 0;
  let removed = 0;
  for (const l of patch.split("\n")) {
    const m = l.match(/^\*\*\* (Add|Update|Delete) File: (.+)$/);
    if (m) files.push(m[2].trim());
    else if (l.startsWith("+") && !l.startsWith("+++")) added++;
    else if (l.startsWith("-") && !l.startsWith("---")) removed++;
  }
  return { files, added, removed };
}

function argsOf(payload: any): any {
  const raw = payload.arguments ?? payload.input;
  if (typeof raw !== "string") return raw ?? {};
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function parseCodexSession(file: string): Promise<Session | undefined> {
  let id = file.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/)?.[1] ?? file;
  let cwd = "";
  let model = "unknown";
  const timestamps: number[] = [];
  const models = new Set<string>();
  const unknownModels = new Set<string>();
  const tokens = emptyTokens();
  const byModel: Session["cost"]["byModel"] = {};
  let usd = 0;
  let requests = 0;
  const seenResponses = new Set<string>();
  let usedRecords = false;
  let prevTotal: { input_tokens: number; cached_input_tokens: number; output_tokens: number } | undefined;
  const fallbackUsage: { model: string; u: any }[] = [];
  const tools: Record<string, number> = {};
  const editsPerFile = new Map<string, number>();
  const bashCounts = new Map<string, number>();
  const callName = new Map<string, string>();
  const prs = new Map<string, GitPrRef>();
  const commits: Session["git"]["commits"] = [];
  const branches = new Set<string>();
  let linesAdded = 0;
  let linesRemoved = 0;
  let userPrompts = 0;
  let toolCalls = 0;
  let toolErrors = 0;
  let errorStreak = 0;
  let maxErrorStreak = 0;
  let testRuns = 0;
  let readOnly = 0;
  let interruptions = 0;
  let title: string | undefined;

  const addUsage = (m: string, u: any) => {
    const priced = priceOpenAiUsage(m, u);
    if (!priced.known) unknownModels.add(m);
    models.add(m);
    usd += priced.usd;
    requests++;
    addTokens(tokens, priced.tokens);
    const mc = (byModel[m] ??= emptyModelCost());
    addTokens(mc, priced.tokens);
    mc.usd += priced.usd;
    mc.requests += 1;
  };

  for await (const o of lines(file)) {
    const ts = o.timestamp ? Date.parse(o.timestamp) : NaN;
    const p = o.payload ?? {};
    if (o.type === "session_meta") {
      if (p.id) id = p.id;
      if (p.cwd) cwd = p.cwd;
      continue;
    }
    if (o.type === "turn_context") {
      if (p.model) model = p.model;
      if (p.cwd) cwd = p.cwd;
      continue;
    }
    if (!Number.isNaN(ts)) timestamps.push(ts);

    if (o.type === "token_usage_record") {
      const key = p.response_id ?? `${p.turn_id}:${o.ordinal}`;
      if (!seenResponses.has(key) && p.usage) {
        seenResponses.add(key);
        usedRecords = true;
        addUsage(model, p.usage);
      }
      continue;
    }

    if (o.type === "event_msg") {
      if (p.type === "token_count" && p.info?.total_token_usage) {
        const t = p.info.total_token_usage;
        if (prevTotal && t.input_tokens >= prevTotal.input_tokens && t.output_tokens >= prevTotal.output_tokens) {
          const d = {
            input_tokens: t.input_tokens - prevTotal.input_tokens,
            cached_input_tokens: (t.cached_input_tokens ?? 0) - (prevTotal.cached_input_tokens ?? 0),
            output_tokens: t.output_tokens - prevTotal.output_tokens,
          };
          if (d.input_tokens > 0 || d.output_tokens > 0) fallbackUsage.push({ model, u: d });
        } else if (!prevTotal && (t.input_tokens > 0 || t.output_tokens > 0)) {
          fallbackUsage.push({ model, u: t });
        }
        prevTotal = t;
      } else if (p.type === "user_message" && typeof p.message === "string") {
        if (p.message.trim()) {
          userPrompts++;
          title ??= cleanPrompt(p.message, 80);
        }
      } else if (p.type === "turn_aborted") interruptions++;
      continue;
    }

    if (o.type === "response_item") {
      if (p.type === "function_call" || p.type === "custom_tool_call") {
        toolCalls++;
        tools[p.name] = (tools[p.name] ?? 0) + 1;
        if (p.call_id) callName.set(p.call_id, p.name);
        const args = argsOf(p);
        if (p.name === "apply_patch") {
          const patch = typeof args === "string" ? args : (args.input ?? args.patch ?? "");
          const r = parsePatch(String(patch));
          const base = cwd ? cwd.replace(/\/$/, "") + "/" : "";
          for (const f of r.files) {
            const abs = f.startsWith("/") ? f : base + f;
            editsPerFile.set(abs, (editsPerFile.get(abs) ?? 0) + 1);
          }
          linesAdded += r.added;
          linesRemoved += r.removed;
        } else if (p.name === "exec" || p.name === "exec_command" || p.name === "shell") {
          const raw = args.cmd ?? args.command;
          const cmd = (Array.isArray(raw) ? raw.join(" ") : String(raw ?? "")).trim();
          if (cmd) {
            const norm = cmd.replace(/\s+/g, " ").slice(0, 300);
            bashCounts.set(norm, (bashCounts.get(norm) ?? 0) + 1);
            if (TEST_RE.test(cmd)) testRuns++;
            if (READ_ONLY_CMD.test(cmd)) readOnly++;
            const b = cmd.match(/git (?:checkout -b|switch -c)\s+([^\s;&|]+)/);
            if (b) branches.add(b[1]);
          }
        }
      } else if (p.type === "function_call_output" || p.type === "custom_tool_call_output") {
        const out = typeof p.output === "string" ? p.output : JSON.stringify(p.output ?? "");
        const code = out.match(/Process exited with code (\d+)/)?.[1] ?? out.match(/"exit_code"\s*:\s*(\d+)/)?.[1];
        if (code !== undefined) {
          if (code !== "0") {
            toolErrors++;
            errorStreak++;
            maxErrorStreak = Math.max(maxErrorStreak, errorStreak);
          } else errorStreak = 0;
        }
        for (const m of out.matchAll(/https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+/g)) {
          const ref = parsePrUrl(m[0]);
          if (ref && !prs.has(ref.url)) prs.set(ref.url, { ...ref, action: "linked" });
        }
        const commit = out.match(/^\[([^\s\]]+)(?: \(root-commit\))? ([0-9a-f]{7,40})\]/m);
        if (commit && callName.get(p.call_id)?.startsWith("exec")) {
          commits.push({ sha: commit[2], branch: commit[1], at: o.timestamp ?? "" });
          if (!["main", "master", "HEAD"].includes(commit[1])) branches.add(commit[1]);
        }
      }
    }
  }

  if (!usedRecords) for (const f of fallbackUsage) addUsage(f.model, f.u);
  if (!timestamps.length || requests === 0) return undefined;

  timestamps.sort((a, b) => a - b);
  let activeMs = 0;
  for (let i = 1; i < timestamps.length; i++) {
    const gap = timestamps[i] - timestamps[i - 1];
    if (gap <= ACTIVE_GAP_MS) activeMs += gap;
  }
  const prList = [...prs.values()];

  return {
    id,
    tool: "codex",
    file,
    projectDir: "codex",
    cwd,
    repos: [...new Set(prList.map((p) => p.repo))],
    branches: [...branches],
    startedAt: new Date(timestamps[0]).toISOString(),
    endedAt: new Date(timestamps[timestamps.length - 1]).toISOString(),
    activeMinutes: Math.round(activeMs / 60000),
    title,
    models: [...models],
    cost: { usd: Math.round(usd * 10000) / 10000, tokens, byModel, webSearches: tools.web_search ?? 0, unknownModels: [...unknownModels] },
    filesEdited: [...editsPerFile.keys()],
    linesAdded,
    linesRemoved,
    git: { commits, pushes: [], prs: prList },
    signals: {
      userPrompts,
      assistantTurns: requests,
      toolCalls,
      toolErrors,
      maxErrorStreak,
      repeatedCommands: [...bashCounts.values()].filter((n) => n >= 3).length,
      maxEditsSameFile: Math.max(0, ...editsPerFile.values()),
      testRuns,
      apiErrors: 0,
      compactions: 0,
      interruptions,
      readOnlyRatio: toolCalls ? Math.round((readOnly / toolCalls) * 1000) / 1000 : 0,
      subagents: 0,
    },
    tools,
  };
}

export async function scanCodexSessions(opts: { root?: string; since?: Date } = {}): Promise<Session[]> {
  let files = listCodexFiles(opts.root);
  if (opts.since) files = files.filter((f) => f.mtimeMs >= opts.since!.getTime());
  const out: Session[] = [];
  for (const f of files) {
    const s = await parseCodexSession(f.file);
    if (!s) continue;
    if (opts.since && Date.parse(s.endedAt) < opts.since.getTime()) continue;
    out.push(s);
  }
  return out;
}

/** Prompts and the AI's answers in a Codex session, for the private AI (read on demand, never stored). */
export async function codexTranscript(file: string): Promise<{ prompts: string[]; answers: string[] }> {
  const prompts: string[] = [];
  const answers: string[] = [];
  const fromItems: string[] = []; // older logs only have the answer as a response item
  if (!existsSync(file)) return { prompts, answers };
  for await (const o of lines(file)) {
    const p = o.payload;
    if (o.type === "event_msg" && p?.type === "user_message" && typeof p.message === "string" && p.message.trim()) prompts.push(cleanPrompt(p.message));
    else if (o.type === "event_msg" && p?.type === "agent_message" && typeof p.message === "string" && p.message.trim()) answers.push(p.message.trim());
    else if (o.type === "response_item" && p?.type === "message" && p.role === "assistant" && Array.isArray(p.content)) {
      const t = p.content
        .map((c: { text?: string }) => c?.text ?? "")
        .join("\n")
        .trim();
      if (t) fromItems.push(t);
    }
  }
  return { prompts, answers: answers.length ? answers : fromItems };
}

/** Prompts of a Codex session, for the private judge (read on demand, never stored). */
export async function codexPrompts(file: string): Promise<string[]> {
  const prompts: string[] = [];
  if (!existsSync(file)) return prompts;
  for await (const o of lines(file)) {
    if (o.type === "event_msg" && o.payload?.type === "user_message" && typeof o.payload.message === "string" && o.payload.message.trim()) {
      prompts.push(cleanPrompt(o.payload.message));
    }
  }
  return prompts;
}
