// The private AI. For each session it writes one plain line of "what you got": a category
// (Built, Fixed, Figured out, ...) and a short title. It also rates difficulty for scoring.
//
// Engines:
//   heuristic           offline rules (heuristics.ts). Always available.
//   0g                  0G Private Computer (OpenAI-compatible router, TEE-only providers in
//                       "private" trust mode). Prompts leave the laptop only into this call.
//   openai-compatible   any OpenAI-style endpoint (for local models such as Ollama).
//
// What we keep: category, title, difficulty, kind, a short generic reason, the 0G request id, and
// hashes of the exact request and response. What we never keep: the prompts or the AI's answers.

import { keccak256, stringToHex } from "viem";
import { buildPrivateDigest, DEFAULT_LOG_ROOT } from "./parse";
import { judgeAllHeuristic, labelFor, linkedChanges, loopScore } from "./heuristics";
import { chatBody, parseSessionVerdict, readChatReply, sessionMessage, SESSION_SYSTEM, type ChatReply } from "./judge-core";
import { pool } from "./match";
import type { Change, Judgement, JudgeInfo, Session, SessionMatch } from "./types";

export type JudgeConfig = {
  engine: "heuristic" | "0g" | "openai-compatible";
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  fallbackModels?: string[]; // tried in order when the main model's provider is down
  trustMode?: "private" | "verified" | "standard"; // 0G only
  selfVerify?: boolean; // 0G only: re-check the TEE signature ourselves with the 0G SDK
};

export const ZG_ROUTER_URL = process.env.ZG_ROUTER_URL || "https://router-api.0g.ai/v1";
// 0G's own model in its "sia" build: runs inside a TEE, answers in about 2 seconds with thinking off.
export const ZG_DEFAULT_MODEL = "0gm-1.0-35b-a3b-sia";
// Also served by TEE providers in private mode. Used only if the main model's provider is down.
export const ZG_FALLBACK_MODELS = ["glm-5.3", "0gm-1.0-35b-a3b"];

export function judgeConfigFromEnv(): JudgeConfig {
  const engine = (process.env.JUDGE_ENGINE as JudgeConfig["engine"]) || (process.env.ZG_API_KEY ? "0g" : "heuristic");
  if (engine === "0g")
    return {
      engine,
      baseUrl: ZG_ROUTER_URL,
      apiKey: process.env.ZG_API_KEY,
      model: process.env.ZG_MODEL || ZG_DEFAULT_MODEL,
      fallbackModels: (process.env.ZG_FALLBACK_MODELS ?? ZG_FALLBACK_MODELS.join(","))
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
      trustMode: (process.env.ZG_TRUST_MODE as JudgeConfig["trustMode"]) || "private",
      selfVerify: process.env.ZG_SELF_VERIFY !== "0",
    };
  if (engine === "openai-compatible")
    return { engine, baseUrl: process.env.JUDGE_BASE_URL || "http://localhost:11434/v1", apiKey: process.env.JUDGE_API_KEY, model: process.env.JUDGE_MODEL || "llama3.1" };
  return { engine: "heuristic" };
}

export function outcomeText(linked: { change: Change; confidence: number }[]) {
  if (!linked.length) return "No linked pull request or commit found.";
  return linked
    .map(({ change: c, confidence }) => {
      const st = c.reverted ? "merged then REVERTED" : c.state;
      return `${c.type === "pr" ? "PR" : "commit"} "${c.title}" (${c.kind}, +${c.additions}/-${c.deletions} lines, ${c.files.length} files): ${st}; match confidence ${confidence.toFixed(2)}`;
    })
    .join("\n");
}

class FatalChatError extends Error {}

export type ChatResult = ChatReply & { raw?: unknown };

async function chatOnce(cfg: JudgeConfig, model: string, system: string, user: string, maxTokens: number): Promise<ChatResult> {
  const zeroG = cfg.engine === "0g";
  // 0G answers 503 when every TEE provider for the model is busy. That is usually brief.
  let res: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1500 * attempt));
    res = await fetch(`${cfg.baseUrl!.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(90_000),
      headers: {
        "Content-Type": "application/json",
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
        // private = only providers whose model runs inside a TEE. The router never falls back silently.
        ...(zeroG ? { "X-0G-Provider-Trust-Mode": cfg.trustMode ?? "private" } : {}),
      },
      body: JSON.stringify(chatBody(model, system, user, { zeroG, maxTokens })),
    });
    if (res.status !== 503 && res.status !== 429) break;
  }
  if (!res) throw new Error("AI call was not sent");
  const text = await res.text();
  if (!res.ok) {
    const msg = `AI call failed (${res.status}, ${model}): ${text.slice(0, 240)}`;
    // Bad key, no credits or not allowed: another model will not help.
    if (res.status === 401 || res.status === 402 || res.status === 403) throw new FatalChatError(msg);
    throw new Error(msg);
  }
  const json = JSON.parse(text);
  return { ...readChatReply(json, (h) => res!.headers.get(h), zeroG, model), raw: json };
}

/** One chat call, trying fallback models when a provider is down. Works for 0G and local endpoints. */
export async function chat(cfg: JudgeConfig, system: string, user: string, maxTokens = 700): Promise<ChatResult> {
  if (!cfg.baseUrl || !cfg.model) throw new Error("AI endpoint not configured");
  if (cfg.engine === "0g" && !cfg.apiKey) throw new Error("ZG_API_KEY is not set");
  const models = [...new Set([cfg.model, ...(cfg.fallbackModels ?? [])])];
  let last: unknown;
  for (const model of models) {
    try {
      const r = await chatOnce(cfg, model, system, user, maxTokens);
      if (!r.content.trim()) throw new Error(`Empty answer from ${model}`);
      return r;
    } catch (e) {
      last = e;
      if (e instanceof FatalChatError) throw e;
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

/**
 * Check the provider's TEE signature for this response ourselves, without trusting the router:
 * a read-only 0G broker (throwaway wallet) fetches the signature and compares it to the TEE signer
 * address registered on 0G mainnet.
 */
export async function selfVerifyTee(provider: string, chatId: string): Promise<boolean | undefined> {
  // The SDK logs "Detected mainnet" on every broker; keep the console quiet while it works.
  const log = console.log;
  console.log = (...args: unknown[]) => {
    if (!String(args[0] ?? "").startsWith("Detected ")) log(...args);
  };
  try {
    const { ethers } = await import("ethers");
    const { createZGComputeNetworkBroker } = await import("@0gfoundation/0g-compute-ts-sdk");
    const rpc = new ethers.JsonRpcProvider(process.env.ZG_CHAIN_RPC || "https://evmrpc.0g.ai");
    const broker = await createZGComputeNetworkBroker(new ethers.Wallet(ethers.Wallet.createRandom().privateKey, rpc));
    const ok = await broker.inference.processResponse(provider, chatId);
    return ok ?? undefined;
  } catch {
    return undefined;
  } finally {
    console.log = log;
  }
}

/** The record we keep about one AI call: enough to look it up and prove what was sent, nothing private. */
export async function judgeInfoFor(cfg: JudgeConfig, r: ChatResult, sent: string): Promise<JudgeInfo> {
  const selfVerified = cfg.engine === "0g" && cfg.selfVerify && r.provider && r.chatId ? await selfVerifyTee(r.provider, r.chatId) : undefined;
  return {
    engine: cfg.engine === "0g" ? "0g-tee" : "openai-compatible",
    model: r.model,
    provider: r.provider,
    requestId: r.requestId,
    chatId: r.chatId,
    trustMode: cfg.engine === "0g" ? (cfg.trustMode ?? "private") : undefined,
    sealed: r.sealed,
    teeVerified: r.teeVerified,
    selfVerified,
    verified: !!(r.teeVerified || selfVerified),
    requestHash: keccak256(stringToHex(sent)),
    responseHash: keccak256(stringToHex(r.content)),
    costUsd: r.costUsd,
    at: new Date().toISOString(),
  };
}

/** Does this judgement still need the AI? (rules only, or written by the older label-only prompt) */
export function needsAi(j: Judgement | undefined) {
  return !j || j.judge.engine === "heuristic" || !j.category || !j.title;
}

/**
 * Judge sessions. Always computes the rule-based verdict first; when an AI engine is configured,
 * each session (or each one in `only`) goes to it, and its answer replaces the rules if it parses.
 */
export async function judgeSessions(
  sessions: Session[],
  matches: SessionMatch[],
  changes: Change[],
  cfg: JudgeConfig = judgeConfigFromEnv(),
  opts: { logRoot?: string; concurrency?: number; onProgress?: (done: number, total: number, last?: Judgement) => void; only?: Set<string> } = {},
): Promise<Judgement[]> {
  const base = judgeAllHeuristic(sessions, matches, changes);
  if (cfg.engine === "heuristic") return base;
  const byKey = new Map(changes.map((c) => [c.key, c]));
  const baseBy = new Map(base.map((j) => [j.sessionId, j]));
  let done = 0;
  const targets = sessions.filter((s) => !opts.only || opts.only.has(s.id));
  const judged = await pool(targets, opts.concurrency ?? 4, async (s) => {
    const h = baseBy.get(s.id)!;
    const linked = linkedChanges(s, matches, byKey);
    try {
      const digest = await buildPrivateDigest(s, opts.logRoot ?? DEFAULT_LOG_ROOT, outcomeText(linked));
      const loops = loopScore(s);
      const hint = `${h.category}: "${h.title}", difficulty ${h.difficulty}, loop score ${loops}`;
      const userMsg = sessionMessage(digest, hint);
      const r = await chat(cfg, SESSION_SYSTEM, userMsg);
      const v = parseSessionVerdict(r.content);
      const j: Judgement = {
        sessionId: s.id,
        category: v.category,
        title: v.title,
        inProgress: v.inProgress,
        label: labelFor(v.category, v.inProgress, h.label, loops),
        difficulty: v.difficulty,
        kind: v.kind,
        confidence: 0.8,
        reason: [v.reason, v.tip].filter(Boolean).join(" Tip: "),
        judge: await judgeInfoFor(cfg, r, SESSION_SYSTEM + "\n" + userMsg),
      };
      done++;
      opts.onProgress?.(done, targets.length, j);
      return j;
    } catch (e) {
      done++;
      const j = { ...h, reason: `${h.reason} (AI failed: ${String(e).slice(0, 120)})` };
      opts.onProgress?.(done, targets.length, j);
      return j;
    }
  });
  const out = new Map(base.map((j) => [j.sessionId, j]));
  for (const j of judged) out.set(j.sessionId, j);
  return [...out.values()];
}
