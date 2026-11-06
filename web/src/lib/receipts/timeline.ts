// When things happened inside one session, so a week can show how fast ideas became merged work:
// first prompt, first and last code edit, a plan (Claude Code plan mode), first commit, PR, and
// whether the AI's last answer asked a question or offered a next step that nobody answered.
// Both log readers feed this; it keeps times only, never text.

import type { SessionTimeline } from "./types";

// The AI's last answer "left the door open": a question, or an offer to do more.
const OFFER = /\b(want me to|should i\b|shall i\b|would you like|do you want|let me know|which (one|option|approach)|ready to (proceed|start)|okay to proceed|ok to proceed|go ahead\?|say the word)/i;

export function endsOnQuestion(text: string) {
  const tail = text.trim().replace(/[\s*_`)\]>"'.!]+$/u, "").slice(-300);
  return tail.endsWith("?") || OFFER.test(tail);
}

export class TimelineBuilder {
  private firstPrompt = Infinity;
  private lastPrompt = -Infinity;
  private firstEdit = Infinity;
  private lastEdit = -Infinity;
  private planAt = Infinity;
  private firstPr = Infinity;
  private lastAnswer = -Infinity;
  private lastAnswerText = "";

  prompt(ts: number) {
    if (Number.isNaN(ts)) return;
    this.firstPrompt = Math.min(this.firstPrompt, ts);
    this.lastPrompt = Math.max(this.lastPrompt, ts);
  }
  edit(ts: number) {
    if (Number.isNaN(ts)) return;
    this.firstEdit = Math.min(this.firstEdit, ts);
    this.lastEdit = Math.max(this.lastEdit, ts);
  }
  plan(ts: number) {
    if (!Number.isNaN(ts)) this.planAt = Math.min(this.planAt, ts);
  }
  pr(ts: number) {
    if (!Number.isNaN(ts)) this.firstPr = Math.min(this.firstPr, ts);
  }
  answer(ts: number, text: string) {
    if (Number.isNaN(ts) || !text.trim() || ts < this.lastAnswer) return;
    this.lastAnswer = ts;
    this.lastAnswerText = text;
  }

  finish(commits: { at: string }[]): SessionTimeline {
    const iso = (n: number) => (Number.isFinite(n) ? new Date(n).toISOString() : undefined);
    const commitTimes = commits.map((c) => Date.parse(c.at)).filter((n) => !Number.isNaN(n));
    return {
      firstPromptAt: iso(this.firstPrompt),
      lastPromptAt: iso(this.lastPrompt),
      firstEditAt: iso(this.firstEdit),
      lastEditAt: iso(this.lastEdit),
      planAt: iso(this.planAt),
      firstCommitAt: commitTimes.length ? iso(Math.min(...commitTimes)) : undefined,
      firstPrAt: iso(this.firstPr),
      lastAnswerAt: iso(this.lastAnswer),
      // Only "open" if the answer came after the person's last message (nobody replied to it).
      endsOnQuestion: Number.isFinite(this.lastAnswer) && this.lastAnswer >= this.lastPrompt ? endsOnQuestion(this.lastAnswerText) : false,
    };
  }
}
