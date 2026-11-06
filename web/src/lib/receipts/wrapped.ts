// AI Wrapped: a fun look at how someone talks to AI over a period. Built only from ChatStats
// (counts and minutes), so it works the same for Claude Code and Codex logs read on the laptop and
// for ChatGPT or Claude.ai exports read in the browser. No AI needed: the persona comes from rules.
// Browser-safe: no Node imports here.

import { FUN, type ChatStats, type FunSegment } from "./chat-stats";

/** One conversation (or coding session) going into a Wrapped. */
export type WrappedInput = { tool: string; startedAt: string; minutes: number; usd: number; chat: ChatStats };

export const SOURCE_NAMES: Record<string, string> = { "claude-code": "Claude Code", codex: "Codex", chatgpt: "ChatGPT", "claude-ai": "Claude.ai" };

export const SEGMENT_COPY: Record<FunSegment, { label: string; one: string; many: string; blurb: string; zero: string }> = {
  overthinking: { label: "Overthinking", one: '"wait, actually" moment', many: '"wait, actually" moments', blurb: 'Second thoughts, what-ifs and "which is better?"', zero: "Decisive. Not one second thought." },
  therapy: { label: "AI as your therapist", one: "heart-to-heart", many: "heart-to-hearts", blurb: "Stress, feelings and pep talks", zero: "Strictly business. The AI is not your therapist (yet)." },
  student: { label: "Student mode", one: '"explain it to me"', many: '"explain it to me" asks', blurb: "Explain, what is, how does, ELI5", zero: "You already know everything, apparently." },
  hi: { label: "Just saying hi", one: "hello", many: "hellos", blurb: "Messages that were only a greeting", zero: "Straight to the point. No hellos." },
  goAhead: { label: '"Yes, go ahead"', one: "one-line yes", many: "one-line yeses", blurb: "Yes, ok, do it, continue", zero: "You never just say yes." },
  rage: { label: "Rage moments", one: "caps lock moment", many: "caps lock moments", blurb: 'ALL CAPS, "!!!" and "still not working"', zero: "Zen. Not one caps lock moment." },
  brainDump: { label: "Brain dumps", one: "wall of text", many: "walls of text", blurb: "Very long or pasted messages", zero: "Short and sweet, every time." },
};

export const PERSONAS = {
  overthinker: { name: "The Overthinker", line: "Asks, rethinks, asks again. The AI has seen every version of the plan." },
  "deep-talker": { name: "The Deep Talker", line: "Came for answers, stayed for the heart-to-hearts." },
  student: { name: "The Eternal Student", line: "Treats every chat like office hours. Never stops asking how things work." },
  "small-talk": { name: "The Small-Talk Champion", line: "Never skips the hello. The AI appreciates it." },
  delegator: { name: "The Delegator", line: "Says yes and lets the AI do the rest. A natural manager." },
  "keyboard-warrior": { name: "The Keyboard Warrior", line: "Types in caps so the AI knows it is serious." },
  "brain-dumper": { name: "The Brain Dumper", line: "Why write one line when you can paste the whole thing?" },
  polite: { name: "The Most Polite Human Alive", line: "Says please and thanks to a computer. Will be spared first." },
  "night-owl": { name: "The 2 a.m. Philosopher", line: "Does the best thinking while everyone else is asleep." },
  calm: { name: "The Calm Operator", line: "Short asks, clear goals, no drama." },
} as const;
export type PersonaId = keyof typeof PERSONAS;
export const PERSONA_IDS = Object.keys(PERSONAS) as PersonaId[];

const SEG_PERSONA: Record<FunSegment, PersonaId> = {
  overthinking: "overthinker",
  therapy: "deep-talker",
  student: "student",
  hi: "small-talk",
  goAhead: "delegator",
  rage: "keyboard-warrior",
  brainDump: "brain-dumper",
};
// What a typical person's share of messages looks like (a rough guess). A persona wins when
// someone is well above typical, so a coder full of "explain" asks is not always The Student.
const TYPICAL: Record<FunSegment, number> = { overthinking: 0.07, therapy: 0.015, student: 0.12, hi: 0.03, goAhead: 0.08, rage: 0.05, brainDump: 0.08 };
const TYPICAL_MANNERS = 0.2; // please, thanks or sorry per message
const TYPICAL_NIGHT = 0.1; // share of messages sent between midnight and 5 a.m.
const MIN_SEGMENT = 3; // messages a segment needs before it can name you
const COFFEE_USD = 4;

export type WrappedSegment = { key: FunSegment; label: string; blurb: string; n: number; min: number; share: number; line: string };

export type Wrapped = {
  label: string; // "This week", "Last 30 days", "Your ChatGPT export"
  from?: string;
  to?: string;
  sources: { tool: string; name: string; conversations: number; prompts: number }[];
  conversations: number;
  prompts: number;
  words: number;
  pages: number; // words / 250, a page of a paperback
  minutes: number; // time with AI
  activeDays: number;
  streak: number; // longest run of days in a row with a message
  usd: number;
  coffees: number;
  seg: WrappedSegment[]; // most minutes first
  manners: number;
  questions: number;
  whys: number;
  images: number;
  avalanches: number;
  longestWords: number;
  pasted: number;
  hours: number[]; // messages per local hour
  weekdays: number[]; // messages per weekday, 0 = Sunday
  peakHour: number;
  peakDay: number;
  nightMinutes: number;
  nightShare: number;
  latestAt?: string; // latest message after midnight, "4:12 a.m."
  persona: { id: PersonaId; name: string; line: string };
  traits: { id: PersonaId; name: string }[]; // runners-up, strongest first
  topWords: [string, number][]; // stays on the device: never on the card or sent anywhere
  facts: string[];
};

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function hourLabel(h: number) {
  if (h === 0) return "midnight";
  if (h === 12) return "noon";
  return h < 12 ? `${h} a.m.` : `${h - 12} p.m.`;
}

export function minutesLabel(min: number) {
  if (min < 1) return min > 0 ? "under a minute" : "0 minutes";
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  return h < 10 ? `${h.toFixed(1).replace(/\.0$/, "")} h` : `${Math.round(h)} h`;
}

const n0 = (x: number) => Math.round(x).toLocaleString("en-US");
const word = (n: number, one: string, many: string) => `${n0(n)} ${n === 1 ? one : many}`;

function longestStreak(days: string[]) {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev = NaN;
  for (const d of sorted) {
    const t = Date.parse(`${d}T12:00:00Z`);
    run = t - prev === 86400_000 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

/** Scores per persona: how far above typical someone is. */
export function personaScores(w: Pick<Wrapped, "prompts" | "seg" | "manners" | "nightShare">) {
  const scores = new Map<PersonaId, number>();
  if (w.prompts < 10) return scores;
  for (const s of w.seg) {
    if (s.n >= MIN_SEGMENT) scores.set(SEG_PERSONA[s.key], s.share / TYPICAL[s.key]);
  }
  if (w.manners >= MIN_SEGMENT) scores.set("polite", w.manners / w.prompts / TYPICAL_MANNERS);
  if (w.nightShare > 0) scores.set("night-owl", w.nightShare / TYPICAL_NIGHT);
  return scores;
}

export function pickPersona(scores: Map<PersonaId, number>) {
  const ranked = [...scores.entries()].filter(([, v]) => v >= 1.15).sort((a, b) => b[1] - a[1]);
  const id: PersonaId = ranked[0]?.[0] ?? "calm";
  return {
    persona: { id, ...PERSONAS[id] },
    traits: ranked.slice(1, 4).map(([t]) => ({ id: t, name: PERSONAS[t].name.replace(/^The /, "") })),
  };
}

export function buildWrapped(inputs: WrappedInput[], meta: { label: string; from?: string; to?: string }): Wrapped | undefined {
  const rows = inputs.filter((i) => i.chat && i.chat.prompts > 0);
  if (!rows.length) return undefined;
  const seg = Object.fromEntries(FUN.map((f) => [f, { n: 0, min: 0 }])) as Record<FunSegment, { n: number; min: number }>;
  const hours = Array(24).fill(0) as number[];
  const weekdays = Array(7).fill(0) as number[];
  const words = new Map<string, number>();
  const bySource = new Map<string, { conversations: number; prompts: number }>();
  const days: string[] = [];
  let prompts = 0, wordCount = 0, minutes = 0, usd = 0, manners = 0, questions = 0, whys = 0, images = 0, avalanches = 0, longest = 0, pasted = 0, night = 0;
  let latest: number | undefined;
  for (const r of rows) {
    const c = r.chat;
    prompts += c.prompts;
    wordCount += c.words;
    minutes += r.minutes;
    usd += r.usd;
    manners += c.manners;
    questions += c.questions;
    whys += c.whys;
    images += c.images;
    avalanches += c.avalanches ?? 0;
    pasted += c.pasted;
    longest = Math.max(longest, c.longestWords);
    night += c.nightMinutes;
    if (c.latestMinuteOfNight !== undefined) latest = Math.max(latest ?? 0, c.latestMinuteOfNight);
    c.hours.forEach((v, h) => (hours[h] += v));
    c.days.forEach((v, d) => (weekdays[d] += v));
    for (const f of FUN) {
      seg[f].n += c.seg[f]?.n ?? 0;
      seg[f].min += c.seg[f]?.min ?? 0;
    }
    for (const [w, k] of c.topWords) words.set(w, (words.get(w) ?? 0) + k);
    days.push(...(c.dayKeys?.length ? c.dayKeys : [r.startedAt.slice(0, 10)]));
    const s = bySource.get(r.tool) ?? { conversations: 0, prompts: 0 };
    s.conversations++;
    s.prompts += c.prompts;
    bySource.set(r.tool, s);
  }
  const nightMsgs = hours.slice(0, 5).reduce((a, b) => a + b, 0);
  const segs: WrappedSegment[] = FUN.map((key) => {
    const copy = SEGMENT_COPY[key];
    const { n, min } = seg[key];
    return { key, label: copy.label, blurb: copy.blurb, n, min: Math.round(min * 10) / 10, share: n / prompts, line: word(n, copy.one, copy.many) };
  }).sort((a, b) => b.min - a.min || b.n - a.n);
  const peakHour = hours.indexOf(Math.max(...hours));
  const peakDay = weekdays.indexOf(Math.max(...weekdays));
  const latestAt = latest === undefined ? undefined : `${Math.floor(latest / 60) || 12}:${String(latest % 60).padStart(2, "0")} a.m.`;
  const base = {
    label: meta.label,
    from: meta.from,
    to: meta.to,
    sources: [...bySource.entries()].map(([tool, v]) => ({ tool, name: SOURCE_NAMES[tool] ?? tool, ...v })).sort((a, b) => b.prompts - a.prompts),
    conversations: rows.length,
    prompts,
    words: wordCount,
    pages: Math.max(0, Math.round(wordCount / 250)),
    minutes: Math.round(minutes),
    activeDays: new Set(days).size,
    streak: longestStreak(days),
    usd: Math.round(usd * 100) / 100,
    coffees: Math.round(usd / COFFEE_USD),
    seg: segs,
    manners,
    questions,
    whys,
    images,
    avalanches,
    longestWords: longest,
    pasted,
    hours,
    weekdays,
    peakHour,
    peakDay,
    nightMinutes: Math.round(night),
    nightShare: prompts ? nightMsgs / prompts : 0,
    latestAt,
    topWords: [...words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
  };
  const { persona, traits } = pickPersona(personaScores(base));
  return { ...base, persona, traits, facts: facts(base) };
}

function facts(w: Omit<Wrapped, "persona" | "traits" | "facts">) {
  const out: string[] = [];
  out.push(`${n0(w.words)} words typed to AI, about ${word(w.pages, "page", "pages")} of a book.`);
  if (w.longestWords >= 50) out.push(`Longest message: ${n0(w.longestWords)} words in one go.`);
  if (w.manners) out.push(`${word(w.manners, "please, thanks or sorry", "pleases, thanks and sorrys")}. The robots will remember.`);
  else out.push("Zero pleases or thank-yous. The robots will remember that too.");
  if (w.whys) out.push(`You asked "why" ${word(w.whys, "time", "times")}.`);
  if (w.avalanches) out.push(`${word(w.avalanches, "time", "times")} you asked three or more questions in one message.`);
  if (w.images) out.push(`${word(w.images, "screenshot or image", "screenshots and images")} shared.`);
  out.push(`Busiest hour: ${hourLabel(w.peakHour)}. Busiest day: ${DAY_NAMES[w.peakDay]}.`);
  if (w.latestAt) out.push(`Latest message after midnight: ${w.latestAt}.`);
  if (w.streak >= 2) out.push(`${w.streak} days in a row with AI.`);
  if (w.usd >= 1) out.push(`$${w.usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} of AI, about ${word(w.coffees, "cup", "cups")} of coffee.`);
  return out;
}

/** What goes on a public card: numbers and the persona only (no words, no spend). */
export type WrappedCard = {
  l: string; // period label
  p: PersonaId;
  m: number; // minutes with AI
  n: number; // messages
  s: [FunSegment, number, number][]; // segment, messages, minutes (top 4)
  ns: number; // night share, percent
  ph: number; // peak hour
  st: number; // streak
  t: PersonaId[]; // traits
  h?: number[]; // messages per hour, scaled 0 to 100 (24 numbers)
  r?: string; // the private AI's one-liner, when the person asked for one
};

export function toCard(w: Wrapped): WrappedCard {
  return {
    l: w.label.slice(0, 40),
    p: w.persona.id,
    m: w.minutes,
    n: w.prompts,
    s: w.seg.filter((s) => s.n > 0).slice(0, 4).map((s) => [s.key, s.n, Math.round(s.min)]),
    ns: Math.round(w.nightShare * 100),
    ph: w.peakHour,
    st: w.streak,
    t: w.traits.map((t) => t.id).slice(0, 3),
    h: w.hours.map((v) => Math.round((v / Math.max(1, ...w.hours)) * 100)),
  };
}

export function encodeCard(c: WrappedCard) {
  const json = JSON.stringify(c);
  const b64 = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeCard(s: string): unknown {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const json = typeof atob === "function" ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, "base64").toString("utf8");
  return JSON.parse(json);
}

/** A short text to paste with the card. */
export function shareText(w: Wrapped) {
  const top = w.seg.filter((s) => s.n > 0).slice(0, 3);
  return [
    `My AI Wrapped (${w.label.toLowerCase()}): ${w.persona.name}.`,
    `${minutesLabel(w.minutes)} with AI, ${n0(w.prompts)} messages.`,
    ...top.map((s) => `${s.label}: ${minutesLabel(s.min)} (${s.line})`),
    "Counted on my own laptop with Receipts.",
  ].join("\n");
}
