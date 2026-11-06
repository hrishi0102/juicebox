// Every private AI task in the web app, paid from the person's own 0G account. Each one asks this
// laptop's server for the message, sends it to 0G from the browser with the 0G session (see
// components/zero-g.tsx), and gives the answer back to the server to check and keep.
import type { ChatReply } from "@/lib/receipts/judge-core";
import type { ZeroG } from "@/components/zero-g";

type Msg = { system: string; user: string; hash: `0x${string}` };
type SessionPlan = { system: string; sessions: { sessionId: string; user: string; hash: `0x${string}` }[]; next?: Msg };
type Answer = { sessionId?: string; content: string; hash: string; reply: ChatReply };

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error);
  return j as T;
}

function payer(zg: ZeroG) {
  if (!zg.signedIn || !zg.wallet) throw new Error("Sign in with 0G first.");
  return zg.wallet;
}

/** One call per session, four at a time. A refused call (no credits) stops everything. */
async function askSessions(zg: ZeroG, plan: SessionPlan, progress: (msg: string) => void) {
  const answers: Answer[] = [];
  const queue = [...plan.sessions];
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, queue.length) }, async () => {
      for (let s = queue.shift(); s; s = queue.shift()) {
        try {
          const reply = await zg.call(plan.system, s.user, 700);
          answers.push({ sessionId: s.sessionId, content: reply.content, hash: s.hash, reply });
        } catch (e) {
          if (String(e).includes("refused")) throw e;
        }
        done++;
        progress(`Private AI on 0G: ${done} of ${plan.sessions.length} sessions`);
      }
    }),
  );
  return answers;
}

/** Write my week: one line per session that needs it, then one call for the weekly list. */
export async function writeWeek(zg: ZeroG, week: string, progress: (msg: string) => void) {
  const who = payer(zg);
  const plan = await postJson<SessionPlan>("/api/week/browser", { action: "plan", week });
  let next = plan.next;
  if (plan.sessions.length) {
    const answers = await askSessions(zg, plan, progress);
    next = (await postJson<{ next?: Msg }>("/api/week/browser", { action: "sessions", week, payer: who, answers })).next;
  }
  if (!next) throw new Error("Nothing to write for this week.");
  progress("Writing your week");
  const reply = await zg.call(next.system, next.user, 1800);
  return postJson<{ items: number; verified?: boolean; requestIds: string[] }>("/api/week/browser", { action: "week", week, payer: who, answer: { content: reply.content, hash: next.hash, reply } });
}

/** Ask the private AI again about chosen sessions (one session's page). */
export async function judgeSessions(zg: ZeroG, sessionIds: string[], progress: (msg: string) => void) {
  const who = payer(zg);
  const plan = await postJson<SessionPlan>("/api/week/browser", { action: "plan-sessions", sessionIds });
  if (!plan.sessions.length) throw new Error("Only sessions read from this laptop's logs can be sent to the private AI.");
  const answers = await askSessions(zg, plan, progress);
  if (!answers.length) throw new Error("0G could not answer. Try again in a minute.");
  return postJson<{ judged: number; failed: number }>("/api/week/browser", { action: "sessions", payer: who, answers });
}

/** A private review of one week: where the money leaked and three things to change. */
export async function reviewWeek(zg: ZeroG, week: string) {
  const who = payer(zg);
  const plan = await postJson<Msg>("/api/review", { action: "plan", week });
  const reply = await zg.call(plan.system, plan.user, 900);
  return postJson<{ requestId?: string; verified?: boolean }>("/api/review", { action: "save", week, payer: who, answer: { content: reply.content, hash: plan.hash, reply } });
}

export type RoastLine = { line: string; model?: string; verified?: boolean; cached?: boolean };

/** Roast me (AI Wrapped): numbers only. The same numbers never cost twice. */
export async function roast(zg: ZeroG, numbers: { card: unknown; extra: unknown }): Promise<RoastLine> {
  const plan = await postJson<({ cached: true } & RoastLine) | ({ cached: false } & Msg)>("/api/wrapped/roast", { action: "plan", ...numbers });
  if (plan.cached) return plan;
  const who = payer(zg);
  const reply = await zg.call(plan.system, plan.user, 160);
  return postJson<RoastLine>("/api/wrapped/roast", { action: "save", ...numbers, payer: who, answer: { content: reply.content, hash: plan.hash, reply } });
}
