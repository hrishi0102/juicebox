// The private judge. Labels each session and rates its difficulty.
//
// Engines:
//   heuristic           offline rules (heuristics.ts). Always available.
//   0g                  0G Private Computer (OpenAI-compatible router, TEE-backed providers).
//                       Prompts leave the laptop only into this call.
//   openai-compatible   any OpenAI-style endpoint (for local models such as Ollama).
//
// What we keep: label, difficulty, kind, a short generic reason, the request id, and hashes of the
// exact request and response. What we never keep: the prompts themselves.

import { keccak256, stringToHex } from "viem";
import { z } from "zod";
import { buildPrivateDigest, DEFAULT_LOG_ROOT } from "./parse";
import { judgeAllHeuristic, linkedChanges, loopScore } from "./heuristics";
import { pool } from "./match";
import type { Change, Judgement, JudgeInfo, PrivateDigest, Session, SessionMatch } from "./types";

export type JudgeConfig = {
  engine: "heuristic" | "0g" | "openai-compatible";
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  trustMode?: "private" | "verified" | "standard"; // 0G only
  selfVerify?: boolean; // 0G only: re-check the TEE signature ourselves with the 0G SDK
};

export const ZG_ROUTER_URL = process.env.ZG_ROUTER_URL || "https://router-api.0g.ai/v1";
// The only chat model on the 0G router that runs fully inside a TEE (TeeML) as of Nov 2026.
export const ZG_DEFAULT_MODEL = "0gm-1.0-35b-a3b";

export function judgeConfigFromEnv(): JudgeConfig {
  const engine = (process.env.JUDGE_ENGINE as JudgeConfig["engine"]) || (process.env.ZG_API_KEY ? "0g" : "heuristic");
  if (engine === "0g")
    return {
      engine,
      baseUrl: ZG_ROUTER_URL,
      apiKey: process.env.ZG_API_KEY,
      model: process.env.ZG_MODEL || ZG_DEFAULT_MODEL,
      trustMode: (process.env.ZG_TRUST_MODE as JudgeConfig["trustMode"]) || "private",
      selfVerify: process.env.ZG_SELF_VERIFY !== "0",
    };
  if (engine === "openai-compatible")
    return { engine, baseUrl: process.env.JUDGE_BASE_URL || "http://localhost:11434/v1", apiKey: process.env.JUDGE_API_KEY, model: process.env.JUDGE_MODEL || "llama3.1" };
  return { engine: "heuristic" };
}

export const JUDGE_SYSTEM = `You review one AI coding session for the person who ran it. You get a private digest: their prompts (trimmed), a summary of tool use, what happened on GitHub, and the cost. Decide what the spend bought.

Labels (pick exactly one):
- Shipped: produced work that merged and is still alive.
- Learned: no shipped code, but the person gained something real: research, a diagnosis, a design, a review, an answer.
- Looped: a large part of the session went in circles: repeated failing commands, redoing the same edit, fighting the environment.
- Abandoned: code was written but did not ship (no PR, PR closed, or reverted).
- Overkill: work shipped, but the spend was far larger than the task needed (simple change, very long or premium-model session).
- Pending: work still in flight (open PR, or fresh edits from the last few days).

Difficulty 1-5: 1 trivial (copy, config, one-liner), 2 small (single-file fix), 3 moderate (feature across a few files), 4 hard (multi-part feature or tricky bug), 5 very hard (architecture, cross-system, deep debugging).
Kind: feature, fix, refactor, test, docs, chore or other.

Rules:
- Never quote or repeat prompts, file names, code, people or company names in your answer.
- "reason" is at most 25 words, generic, about the work pattern, not the content.
- "tip" is one practical suggestion to waste less next time, at most 20 words, or "" if none.
- Reply with JSON only: {"label":"...","difficulty":1,"kind":"...","confidence":0.0,"reason":"...","tip":"..."}`;

const Verdict = z.object({
  label: z.enum(["Shipped", "Learned", "Looped", "Abandoned", "Overkill", "Pending"]),
  difficulty: z.coerce.number().int().min(1).max(5),
  kind: z.enum(["feature", "fix", "refactor", "test", "docs", "chore", "other"]).catch("other"),
  confidence: z.coerce.number().min(0).max(1).catch(0.6),
  reason: z.string().max(400).catch(""),
  tip: z.string().max(300).optional().catch(""),
});

export function outcomeText(linked: { change: Change; confidence: number }[]) {
  if (!linked.length) return "No linked pull request or commit found.";
  return linked
    .map(({ change: c, confidence }) => {
      const sv = c.survival ? `, ${Math.round(c.survival.ratio * 100)}% of added lines still alive${c.survival.matured ? " after 30 days" : " so far"}` : "";
      const st = c.reverted ? "merged then REVERTED" : c.state;
      return `${c.type === "pr" ? "PR" : "commit"} (${c.kind}, +${c.additions}/-${c.deletions} lines, ${c.files.length} files): ${st}${sv}; match confidence ${confidence.toFixed(2)}`;
    })
    .join("\n");
}

export function digestToUserMessage(d: PrivateDigest, hint: string) {
  return [
    `PROMPTS (${d.prompts.length}):`,
    ...d.prompts.map((p, i) => `${i + 1}. ${p}`),
    "",
    `TOOL USE: ${d.toolSummary}`,
    `OUTCOME: ${d.outcomeSummary}`,
    `COST: ${d.costSummary}`,
    `RULE-BASED GUESS (may be wrong): ${hint}`,
  ].join("\n");
}

type ChatResult = {
  content: string;
  model?: string;
  requestId?: string;
  chatId?: string;
  provider?: string;
  sealed?: boolean;
  teeVerified?: boolean;
  raw: unknown;
};

/** One OpenAI-compatible chat call. Works for the 0G router and for local endpoints. */
export async function chat(cfg: JudgeConfig, system: string, user: string): Promise<ChatResult> {
  if (!cfg.baseUrl || !cfg.model) throw new Error("Judge endpoint not configured");
  if (cfg.engine === "0g" && !cfg.apiKey) throw new Error("ZG_API_KEY is not set");
  const is0g = cfg.engine === "0g";
  // 0G answers 503 no_provider_for_trust_mode when every TEE provider is busy. It is transient.
  let res: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1500 * attempt));
    res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
        // private = only providers whose model runs inside a TEE. Never silently falls back.
        ...(is0g ? { "X-0G-Provider-Trust-Mode": cfg.trustMode ?? "private" } : {}),
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0,
        max_tokens: 2500, // 0GM thinks before answering
        ...(is0g ? { verify_tee: true } : {}),
      }),
    });
    if (res.status !== 503) break;
  }
  if (!res) throw new Error("Judge call was not sent");
  const text = await res.text();
  if (!res.ok) throw new Error(`Judge call failed (${res.status}): ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  const trace = json.x_0g_trace ?? {};
  return {
    content: json.choices?.[0]?.message?.content ?? "",
    model: json.model ?? cfg.model,
    requestId: trace.request_id ?? res.headers.get("x-request-id") ?? json.id,
    chatId: res.headers.get("ZG-Res-Key") ?? json.id,
    provider: trace.provider,
    sealed: is0g ? res.headers.get("X-0G-E2EE") === "sealed" : undefined,
    teeVerified: typeof trace.tee_verified === "boolean" ? trace.tee_verified : undefined,
    raw: json,
  };
}

/**
 * Check the provider's TEE signature for this response ourselves, without trusting the router:
 * a read-only 0G broker (throwaway wallet) fetches the signature and compares it to the TEE signer
 * address registered on 0G mainnet.
 */
export async function selfVerifyTee(provider: string, chatId: string): Promise<boolean | undefined> {
  try {
    const { ethers } = await import("ethers");
    const { createZGComputeNetworkBroker } = await import("@0gfoundation/0g-compute-ts-sdk");
    const rpc = new ethers.JsonRpcProvider(process.env.ZG_CHAIN_RPC || "https://evmrpc.0g.ai");
    const broker = await createZGComputeNetworkBroker(new ethers.Wallet(ethers.Wallet.createRandom().privateKey, rpc));
    const ok = await broker.inference.processResponse(provider, chatId);
    return ok ?? undefined;
  } catch {
    return undefined;
  }
}

/** Pull the verdict JSON out of a model answer (handles <think> blocks and code fences). */
export function parseVerdict(content: string) {
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const starts = [...cleaned.matchAll(/\{/g)].map((m) => m.index!);
  const ends = [...cleaned.matchAll(/\}/g)].map((m) => m.index!).reverse();
  for (const a of starts) {
    for (const b of ends) {
      if (b <= a) break;
      try {
        const obj = JSON.parse(cleaned.slice(a, b + 1));
        if (obj && typeof obj === "object" && "label" in obj) return Verdict.parse(obj);
      } catch {
        /* keep looking */
      }
    }
  }
  throw new Error("No verdict JSON in judge answer");
}

/**
 * Judge sessions. Always computes the heuristic verdict first; when an AI engine is configured,
 * each session is sent to it and the AI verdict replaces the heuristic one if it parses.
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
  const judged = await pool(targets, opts.concurrency ?? 3, async (s) => {
    const h = baseBy.get(s.id)!;
    const linked = linkedChanges(s, matches, byKey);
    try {
      const digest = await buildPrivateDigest(s, opts.logRoot ?? DEFAULT_LOG_ROOT, outcomeText(linked));
      const hint = `${h.label}, difficulty ${h.difficulty}, loop score ${loopScore(s)}`;
      const userMsg = digestToUserMessage(digest, hint);
      const r = await chat(cfg, JUDGE_SYSTEM, userMsg);
      const v = parseVerdict(r.content);
      const selfVerified = cfg.engine === "0g" && cfg.selfVerify && r.provider && r.chatId ? await selfVerifyTee(r.provider, r.chatId) : undefined;
      const info: JudgeInfo = {
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
        requestHash: keccak256(stringToHex(JUDGE_SYSTEM + "\n" + userMsg)),
        responseHash: keccak256(stringToHex(r.content)),
        at: new Date().toISOString(),
      };
      const j: Judgement = {
        sessionId: s.id,
        label: v.label,
        difficulty: v.difficulty as Judgement["difficulty"],
        kind: v.kind,
        confidence: v.confidence,
        reason: [v.reason, v.tip].filter(Boolean).join(" Tip: "),
        judge: info,
      };
      done++;
      opts.onProgress?.(done, targets.length, j);
      return j;
    } catch (e) {
      done++;
      const j = { ...h, reason: `${h.reason} (AI judge failed: ${String(e).slice(0, 80)})` };
      opts.onProgress?.(done, targets.length, j);
      return j;
    }
  });
  const out = new Map(base.map((j) => [j.sessionId, j]));
  for (const j of judged) out.set(j.sessionId, j);
  return [...out.values()];
}
