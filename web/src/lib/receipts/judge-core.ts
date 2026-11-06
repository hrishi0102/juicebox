// The browser-safe half of the private AI: what we ask it, and how we read its answers.
// No Node imports here, so the same prompts work from the server (API key) and, later, from the
// browser (Sign in with 0G, paid from the person's own 0G credits).
//
// Two kinds of calls:
//   1. One call per session: reads the private digest (prompts, the AI's last answers, tool use,
//      GitHub outcome, cost) and writes one plain line: category + title.
//   2. One call per week: reads only those lines (never prompts) and merges them into the list
//      "what you got done this week", plus a one-sentence summary.

import { z } from "zod";
import { CATEGORIES, type Category, type ChangeKind, type PrivateDigest } from "./types";

export const SESSION_SYSTEM = `You write one line of a person's weekly "what I got done" list, from one session they ran with an AI assistant (Claude Code or Codex). You get a private digest: what they asked (trimmed), what the AI said at the end, a summary of tool use, what happened on GitHub, and the cost. On GitHub, work ships either as a merged pull request or as a commit pushed straight to the main branch with no pull request; both count as shipped.

Pick one category:
- Built: made something new that works (a feature, page, tool, script, test suite).
- Fixed: fixed a bug or something broken.
- Figured out: understood or diagnosed something (how code works, why it fails, the answer to a question).
- Researched: compared options, read docs or the web, collected facts.
- Wrote: wrote words (docs, a post, a spec, an email, a talk or video script).
- Planned: designed or planned work (architecture, steps, decisions).
- Wasted: went in circles or produced nothing usable.

title: what they got, 3 to 8 plain words a friend would understand, no full stop. Name the thing, not its status (no "shipped", "merged", "done", "completed"). Good: "Login page that remembers you", "Why the nightly build kept failing", "Price comparison of three GPU clouds". Bad: "Worked on code", "Session about the project".
in_progress: true when the work is clearly not finished (open PR, commits not on main yet, still debugging, half built). A commit pushed straight to main is finished, not in progress.
difficulty: 1 trivial, 2 small, 3 moderate, 4 hard, 5 very hard.
kind: feature, fix, refactor, test, docs, chore or other.
reason: why this category, at most 20 words, generic.
tip: one practical way to spend less next time, at most 15 words, or "".

Never put secrets, keys, emails, people's names, client or customer names, file paths or code in title, reason or tip. Names of public tools and products are fine. Plain English, no em dashes.
Reply with JSON only: {"category":"Built","title":"...","in_progress":false,"difficulty":3,"kind":"feature","reason":"...","tip":""}`;

export const WEEK_SYSTEM = `You turn one person's AI sessions from one week into a short, fun list: "what I got done this week". Each input line is one session: its id, category, title, cost and what it shipped on GitHub, if anything: a pull request (merged, open or closed) or a commit pushed straight to main with no pull request, which counts as shipped too.

Rules:
- Merge sessions that are clearly about the same piece of work into one item. Keep different work separate.
- 3 to 10 items, the most impressive first, "Wasted" items last. Never invent work that is not in the input.
- Each item has a category (Built, Fixed, Figured out, Researched, Wrote, Planned or Wasted), a title of 3 to 8 plain words that names the thing, not its status (no "shipped", "merged", "landed", "done", "handled"), and the ids of the sessions it covers. Every session id goes in exactly one item.
- summary: one upbeat sentence the person could post about their week, at most 18 words, no dollar amounts, no "I" at the start. Example: "Shipped the login flow, chased down a flaky build and planned the next release."
- No secrets, people's names, client or customer names, file paths or code. Names of public tools and products are fine. Plain English, no em dashes.
Reply with JSON only: {"items":[{"category":"Built","title":"...","sessions":["S1","S4"]}],"summary":"..."}`;

/** The private message for one session. Only ever sent to the private AI (0G TEE) or a local model. */
export function sessionMessage(d: PrivateDigest, hint: string) {
  return [
    `WHAT THEY ASKED (${d.prompts.length} prompts):`,
    ...d.prompts.map((p, i) => `${i + 1}. ${p}`),
    "",
    `WHAT THE AI SAID AT THE END (${d.replies.length}):`,
    ...(d.replies.length ? d.replies.map((r) => `- ${r}`) : ["- (nothing)"]),
    "",
    `TOOL USE: ${d.toolSummary}`,
    `OUTCOME: ${d.outcomeSummary}`,
    `COST: ${d.costSummary}`,
    `RULE-BASED GUESS (may be wrong): ${hint}`,
  ].join("\n");
}

export type WeekLine = { id: string; category: Category; title: string; costUsd: number; pr?: string; inProgress?: boolean };

/** The message for the weekly roll-up. Holds titles only: no prompts, no answers. */
export function weekMessage(weekLabel: string, lines: WeekLine[]) {
  return [
    `WEEK: ${weekLabel}`,
    `SESSIONS (${lines.length}):`,
    ...lines.map(
      (l) => `${l.id} | ${l.category} | ${l.title} | $${l.costUsd.toFixed(2)}${l.pr ? ` | ${l.pr}` : ""}${l.inProgress ? " | in progress" : ""}`,
    ),
  ].join("\n");
}

const KINDS = ["feature", "fix", "refactor", "test", "docs", "chore", "other"] as const;

/** Read a category the model wrote, forgiving case and small wording changes. */
export function toCategory(raw: unknown): Category | undefined {
  const t = String(raw ?? "").toLowerCase().replace(/[^a-z ]/g, "").trim();
  const exact = CATEGORIES.find((c) => c.toLowerCase() === t);
  if (exact) return exact;
  if (t.startsWith("built") || t === "build" || t.startsWith("made") || t.startsWith("shipped")) return "Built";
  if (t.startsWith("fix")) return "Fixed";
  if (t.startsWith("figured") || t.startsWith("learn") || t.startsWith("understood") || t.startsWith("debug")) return "Figured out";
  if (t.startsWith("research")) return "Researched";
  if (t.startsWith("wr") || t.startsWith("doc")) return "Wrote";
  if (t.startsWith("plan") || t.startsWith("design")) return "Planned";
  if (t.startsWith("wast") || t.startsWith("loop")) return "Wasted";
  return undefined;
}

/** "feat(auth): add login" reads better as "Add login". */
export function tidyPrTitle(title: string | undefined) {
  return cleanTitle((title ?? "").replace(/^[a-z]+(\([^)]*\))?!?:\s*/i, ""));
}

/** Make a model-written title safe and tidy: no secrets, paths, emails, quotes or em dashes. */
export function cleanTitle(raw: unknown, max = 70) {
  let t = String(raw ?? "")
    .replace(/[—–]/g, ", ")
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "a key")
    .replace(/0x[0-9a-fA-F]{40,}/g, "an address")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "an email")
    .replace(/(?:~|\.{0,2})?\/(?:[\w.-]+\/)+[\w.-]*/g, "")
    .replace(/[`"*_#<>{}[\]]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim()
    .replace(/[.,;:!\s]+$/, "");
  if (t.length > max) t = t.slice(0, max).replace(/\s+\S*$/, "");
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

const SessionVerdict = z.object({
  category: z.unknown().transform((v, ctx) => {
    const c = toCategory(v);
    if (!c) ctx.addIssue({ code: "custom", message: `unknown category ${String(v)}` });
    return c as Category;
  }),
  title: z.unknown().transform((v) => cleanTitle(v)),
  in_progress: z.coerce.boolean().catch(false),
  difficulty: z.coerce.number().int().min(1).max(5).catch(2),
  kind: z.enum(KINDS).catch("other"),
  reason: z.string().max(400).catch(""),
  tip: z.string().max(300).optional().catch(""),
});
export type SessionVerdict = { category: Category; title: string; inProgress: boolean; difficulty: 1 | 2 | 3 | 4 | 5; kind: ChangeKind; reason: string; tip: string };

const WeekAnswer = z.object({
  items: z
    .array(
      z.object({
        category: z.unknown(),
        title: z.unknown(),
        sessions: z.array(z.coerce.string()).catch([]),
      }),
    )
    .min(1),
  summary: z.string().catch(""),
});
export type WeekAnswerItem = { category: Category; title: string; sessions: string[] };

/** Find the first JSON object in a model answer that has `key` (skips <think> blocks and code fences). */
export function extractJson(content: string, key: string): Record<string, unknown> {
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const starts = [...cleaned.matchAll(/\{/g)].map((m) => m.index!);
  const ends = [...cleaned.matchAll(/\}/g)].map((m) => m.index!).reverse();
  for (const a of starts) {
    for (const b of ends) {
      if (b <= a) break;
      try {
        const obj = JSON.parse(cleaned.slice(a, b + 1));
        if (obj && typeof obj === "object" && key in obj) return obj;
      } catch {
        /* keep looking */
      }
    }
  }
  throw new Error(`No JSON with "${key}" in the AI answer`);
}

export function parseSessionVerdict(content: string): SessionVerdict {
  const v = SessionVerdict.parse(extractJson(content, "category"));
  if (!v.title) throw new Error("AI answer had no title");
  return { category: v.category, title: v.title, inProgress: v.in_progress, difficulty: v.difficulty as SessionVerdict["difficulty"], kind: v.kind, reason: cleanTitle(v.reason, 200), tip: cleanTitle(v.tip ?? "", 140) };
}

export function parseWeekAnswer(content: string): { items: WeekAnswerItem[]; summary: string } {
  const a = WeekAnswer.parse(extractJson(content, "items"));
  const items = a.items
    .map((i) => ({ category: toCategory(i.category), title: cleanTitle(i.title), sessions: i.sessions.map((s) => s.trim().toUpperCase()) }))
    .filter((i): i is WeekAnswerItem => !!i.category && !!i.title);
  if (!items.length) throw new Error("AI answer had no usable items");
  return { items, summary: cleanTitle(a.summary, 160) };
}

export const ZG_ROUTER = "https://router-api.0g.ai/v1";
// 0G's own model in its "sia" build runs inside a TEE and answers in about 2 seconds with thinking
// off. The others are also served by TEE providers in private mode, used only if it is down.
export const ZG_MODELS = ["0gm-1.0-35b-a3b-sia", "glm-5.3", "0gm-1.0-35b-a3b"];

/** 0G's own models think before answering unless told not to; the answer is the same, 10x faster. */
export function thinkingOffFor(model: string) {
  return /^0gm-/i.test(model);
}

/** Body for an OpenAI-compatible chat call (0G router or a local model). */
export function chatBody(model: string, system: string, user: string, opts: { zeroG: boolean; maxTokens: number }) {
  const noThink = thinkingOffFor(model);
  return {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0,
    // Models that think spend tokens on it before the answer; leave room for that.
    max_tokens: noThink ? opts.maxTokens : opts.maxTokens + 2500,
    ...(noThink ? { chat_template_kwargs: { enable_thinking: false } } : {}),
    ...(opts.zeroG ? { verify_tee: true } : {}),
  };
}

export type ChatReply = {
  content: string;
  model?: string;
  requestId?: string;
  chatId?: string;
  provider?: string;
  sealed?: boolean;
  teeVerified?: boolean;
  costUsd?: number;
};

/** Read an OpenAI-compatible answer, plus 0G's trace (request id, provider, TEE check, billing). */
export function readChatReply(json: Record<string, unknown>, header: (name: string) => string | null, zeroG: boolean, model: string): ChatReply {
  const j = json as { x_0g_trace?: Record<string, unknown>; choices?: { message?: { content?: string } }[]; model?: string; id?: string };
  const trace = (j.x_0g_trace ?? {}) as { request_id?: string; provider?: string; tee_verified?: boolean; billing?: { total_cost_usd_micro?: string | number } };
  const micro = trace.billing?.total_cost_usd_micro;
  return {
    content: j.choices?.[0]?.message?.content ?? "",
    model: j.model ?? model,
    requestId: trace.request_id ?? header("x-request-id") ?? j.id,
    // The browser may not see the ZG-Res-Key header; the response id carries the same value.
    chatId: header("ZG-Res-Key") ?? j.id?.replace(/^chatcmpl-/, ""),
    provider: trace.provider,
    sealed: zeroG ? header("X-0G-E2EE") === "sealed" : undefined,
    teeVerified: typeof trace.tee_verified === "boolean" ? trace.tee_verified : undefined,
    // 0G reports what the call cost in millionths of a dollar.
    costUsd: micro !== undefined && !Number.isNaN(Number(micro)) ? Number(micro) / 1e6 : undefined,
  };
}
