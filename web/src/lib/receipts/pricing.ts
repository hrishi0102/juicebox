// Claude API list prices, USD per million tokens (first-party API rates, Oct 2026).
// Cache writes: 1.25x input for the 5 minute TTL, 2x input for the 1 hour TTL.
// Cache reads differ per model. Fast mode doubles the price on the Opus models that support it.
// Checked against Claude Code's own `cost-state` records: the numbers match to the cent.

import type { ModelCost, TokenCounts } from "./types";

type Price = { input: number; output: number; cacheRead: number; longContext?: { over: number; input: number; output: number } };

const PRICES: Record<string, Price> = {
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25 },
  "claude-mythos-5-1": { input: 10, output: 50, cacheRead: 0.25 },
  "claude-fable-5": { input: 10, output: 50, cacheRead: 1 },
  "claude-mythos-5": { input: 10, output: 50, cacheRead: 1 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-7": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-6": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-5": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-1": { input: 15, output: 75, cacheRead: 1.5 },
  "claude-opus-4": { input: 15, output: 75, cacheRead: 1.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3 },
  "claude-sonnet-4-5": { input: 3, output: 15, cacheRead: 0.3 },
  "claude-sonnet-4": { input: 3, output: 15, cacheRead: 0.3 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, longContext: { over: 100_000, input: 0.5, output: 2.5 } },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1 },
};

const FAST_MULTIPLIER = 2;
const WEB_SEARCH_USD = 0.01; // $10 per 1,000 searches

export function normalizeModel(model: string): string {
  let m = model.toLowerCase().replace(/\[.*?\]$/, "").trim();
  m = m.replace(/^(anthropic\.|us\.anthropic\.|eu\.anthropic\.)/, "");
  m = m.replace(/-\d{8}$/, "").replace(/@\d{8}$/, "").replace(/-v\d+(:\d+)?$/, "");
  return m;
}

export function priceFor(model: string): Price | undefined {
  const m = normalizeModel(model);
  if (PRICES[m]) return PRICES[m];
  // Unknown minor version: fall back to the family's current price, flagged as unknown by the caller.
  return undefined;
}

export function familyFallback(model: string): Price {
  const m = normalizeModel(model);
  if (m.includes("fable") || m.includes("mythos")) return PRICES["claude-fable-5-1"];
  if (m.includes("haiku")) return PRICES["claude-haiku-5-5"];
  if (m.includes("sonnet")) return PRICES["claude-sonnet-5-5"];
  return PRICES["claude-opus-5-5"];
}

export type UsageLike = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number };
  server_tool_use?: { web_search_requests?: number };
  speed?: string;
};

export function splitUsage(u: UsageLike): TokenCounts & { webSearches: number; fast: boolean } {
  const cw = u.cache_creation_input_tokens ?? 0;
  const cw1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const cw5mRaw = u.cache_creation?.ephemeral_5m_input_tokens;
  const cw5m = cw5mRaw ?? Math.max(0, cw - cw1h);
  return {
    input: u.input_tokens ?? 0,
    output: u.output_tokens ?? 0,
    cacheRead: u.cache_read_input_tokens ?? 0,
    cacheWrite5m: cw5m,
    cacheWrite1h: cw1h,
    webSearches: u.server_tool_use?.web_search_requests ?? 0,
    fast: u.speed === "fast",
  };
}

/** Price one API response. Returns USD and whether the model price was known. */
export function priceUsage(model: string, u: UsageLike): { usd: number; known: boolean; tokens: TokenCounts; webSearches: number } {
  const t = splitUsage(u);
  const known = priceFor(model);
  let p = known ?? familyFallback(model);
  const promptSize = t.input + t.cacheRead + t.cacheWrite5m + t.cacheWrite1h;
  if (p.longContext && promptSize > p.longContext.over) {
    p = { ...p, input: p.longContext.input, output: p.longContext.output, cacheRead: p.longContext.input / 10 };
  }
  const mult = t.fast ? FAST_MULTIPLIER : 1;
  const usd =
    ((t.input * p.input +
      t.output * p.output +
      t.cacheRead * p.cacheRead +
      t.cacheWrite5m * p.input * 1.25 +
      t.cacheWrite1h * p.input * 2) /
      1_000_000) *
      mult +
    t.webSearches * WEB_SEARCH_USD;
  return {
    usd,
    known: !!known,
    tokens: { input: t.input, output: t.output, cacheRead: t.cacheRead, cacheWrite5m: t.cacheWrite5m, cacheWrite1h: t.cacheWrite1h },
    webSearches: t.webSearches,
  };
}

export function emptyTokens(): TokenCounts {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 };
}

export function emptyModelCost(): ModelCost {
  return { ...emptyTokens(), usd: 0, requests: 0, webSearches: 0 };
}

export function addTokens(a: TokenCounts, b: TokenCounts) {
  a.input += b.input;
  a.output += b.output;
  a.cacheRead += b.cacheRead;
  a.cacheWrite5m += b.cacheWrite5m;
  a.cacheWrite1h += b.cacheWrite1h;
}

export function totalTokens(t: TokenCounts) {
  return t.input + t.output + t.cacheRead + t.cacheWrite5m + t.cacheWrite1h;
}

/** Rough "is this a premium model" check, used by the Overkill heuristic. */
export function isPremiumModel(model: string) {
  const m = normalizeModel(model);
  return m.includes("opus") || m.includes("fable") || m.includes("mythos");
}
