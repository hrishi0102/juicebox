// "AI Wrapped": fun numbers about how someone talks to AI, from their own messages. Not about code.
// Pure functions. The readers feed each message (text and time) to a ChatStatsBuilder while they
// read the logs; only counts and minutes are kept, never the text (except a short list of the
// most-used words, which stays in ~/.receipts on the laptop).

export const FUN = ["overthinking", "therapy", "student", "hi", "goAhead", "rage", "brainDump"] as const;
export type FunSegment = (typeof FUN)[number];

export type ChatStats = {
  prompts: number;
  words: number;
  longestWords: number;
  questions: number;
  whys: number;
  manners: number; // please, thanks, sorry
  images: number;
  pasted: number;
  avalanches?: number; // messages with three or more questions in one go
  hours: number[]; // messages per local hour, 24 bins
  days: number[]; // messages per weekday, 7 bins, 0 = Sunday
  minutes?: number; // time in all exchanges (each message to the next, capped)
  dayKeys?: string[]; // local dates with a message (YYYY-MM-DD), for streaks
  nightMinutes: number; // time spent between midnight and 5 a.m.
  latestMinuteOfNight?: number; // latest message after midnight, minutes past 00:00
  seg: Record<FunSegment, { n: number; min: number }>;
  topWords: [string, number][]; // this session's most-used words
};

// Time an exchange takes: from a message to the next one, capped like the active-time rule.
const CAP_MIN = 15;

const STOP = new Set(
  "the a an and or but if then else for to of in on at by with from as is are was were be been being it its this that these those i me my we our you your he she they them their what which who whom whose when where why how all any both each few more most other some such no nor not only own same so than too very can will just should now do does did doing have has had having would could also into about over after before again further once here there out up down off under while because until against between through during above below am im ive id ill dont doesnt didnt cant wont isnt arent wasnt let lets okay ok yes yeah hi hey please thanks thank sure get got make like need want use using one two new see go going know think way still well really much many even back first last next want now right here also bro pls plz u ur".split(" "),
);

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s?!']/gu, " ").replace(/\s+/g, " ").trim();

export const GREETING = /^(hi+|hey+|hello+|hellooo*|yo+|sup|wassup|whats up|hola|namaste|gm|good (morning|evening|afternoon|night)|hiya|howdy|hlo|helo)( (there|claude|codex|ai|buddy|bro|man|again|friend))?[!?.]*$/;
export const GO_AHEAD = /^(yes|yep|yeah|ya|yup|ok|okay|k|sure|go|go ahead|do it|continue|proceed|sounds good|looks good|lgtm|ship it|go for it|yes please|yes do it|ok do it|carry on|keep going|next|perfect|great|cool|nice|done|approved|alright|fine|confirmed)( (please|then|now|man|bro|thanks|thank you|go ahead|do it|continue))*[!.]*$/;
export const OVERTHINK = /\b(on second thought|second guess|second-guess|never ?mind|nvm|am i overthinking|overthink\w*|which (one )?is better|which should i|should i (go|use|pick|choose|do)|or should i|what if|pros and cons|i'?m torn|not sure (if|whether|which)|rethink|reconsider|is it (better|worth)|would it be better|on the other hand|but what about|hmm+ but)\b/;
export const OVERTHINK_START = /^(wait|actually|hmm+|hold on|no wait|but wait|on second thought|hmm+ actually|ok wait|wait actually)\b/;
export const THERAPY = /\b(i (feel|am feeling|'m feeling|m feeling) (so |really |very |kinda |kind of |a bit |pretty |super )?(sad|down|low|lost|tired|anxious|overwhelmed|stressed|burnt out|burned out|bad|terrible|awful|useless|stupid|dumb|hopeless|lonely|empty|demotivated|unmotivated|scared|nervous|worried|exhausted|drained|like (giving up|quitting|a failure|an imposter|a fraud))|stressed( out)?|stressful|anxious|anxiety|overwhelm(ed|ing)|burn ?out|burnt out|burned out|depressed|lonely|i'?m (so |really )?(tired|exhausted|drained|scared|afraid|nervous|worried|sad)|(no|lost|need|zero) motivation|motivate me|unmotivated|demotivated|imposter syndrome|self.?doubt|my (life|career|mental health|relationship|girlfriend|boyfriend|wife|husband|parents|manager|boss)|mental health|therapy|therapist|vent(ing)?|rant(ing)?|i don'?t know what to do with my|cheer me up|pep talk|heartbreak|breakup|break up|relationship advice)\b/;
export const STUDENT = /\b(explain|eli5|explain like|what is|what are|what does|how does|how do|how is|why does|why is|teach me|help me understand|what'?s the difference|difference between|in simple (words|terms|english)|meaning of|what do you mean)\b/;
export const RAGE_WORDS = /\b(wtf|ffs|ugh+|omfg|seriously\??|come on|for god'?s sake|still (not|doesn'?t|isn'?t|broken|failing)|not working|doesn'?t work|does not work|didn'?t work|stop doing|why (isn'?t|is it not|does it keep|did you)|again\?+|useless|terrible)\b/;
// Shouting: three or more ALL-CAPS words in a row (acronyms like API or USDC on their own do not count).
const CAPS_RUN = /\b[A-Z]{2,}(?:[ ]+[A-Z]{2,}){2,}\b/g;
export const ACRONYM = /^(API|URL|URLS|JSON|HTTP|HTTPS|PR|PRS|UI|UX|CSS|HTML|SQL|AWS|GPU|CPU|AI|CLI|SDK|NPM|ENV|IST|UTC|TEE|EIP|ID|IDS|JWT|SSH|DNS|CORS|CRUD|REST|GET|POST|PUT|PATCH|DELETE|README|TODO|MVP|LLM|ETH|EVM|NFT|USD|PDF|PNG|SVG|CSV|OK|AM|PM|IOS|MCP|OAUTH|XML|YAML|TOML|RPC|GCP|VPN|ASAP|FYI|IMO|TBH|LOL)$/;

function shouts(plain: string) {
  for (const m of plain.match(CAPS_RUN) ?? []) {
    const words = m.split(/ +/).filter((w) => !ACRONYM.test(w));
    // Real words, not strings of acronyms like "KEK HKDF AES GCM".
    if (words.length >= 3 && words.filter((w) => w.length >= 4 && /[AEIOU]/.test(w)).length >= 2) return true;
  }
  return false;
}

export function classify(text: string): { segments: FunSegment[]; words: number; question: boolean; whys: number; manners: number; pasted: boolean; avalanche: boolean } {
  const raw = text.trim();
  const pasted = /<pasted_content|\[Pasted text|\[pasted text\]/i.test(raw);
  const plain = raw.replace(/<pasted_content[\s\S]*?<\/pasted_content[^>]*>/g, " ").replace(/<[^>]+>/g, " ");
  const n = norm(plain);
  const words = n ? n.split(" ").length : 0;
  const segs = new Set<FunSegment>();
  if (words <= 4 && GREETING.test(n)) segs.add("hi");
  else if (words <= 7 && GO_AHEAD.test(n)) segs.add("goAhead");
  const qm = plain.match(/\?/g)?.length ?? 0;
  if (OVERTHINK.test(n) || OVERTHINK_START.test(n) || (qm >= 5 && words <= 80 && !pasted)) segs.add("overthinking");
  if (THERAPY.test(n)) segs.add("therapy");
  if (STUDENT.test(n)) segs.add("student");
  if (RAGE_WORDS.test(n) || shouts(plain) || /!{3,}|\?!|!\?|\?{4,}/.test(plain)) segs.add("rage");
  if (words >= 250 || pasted) segs.add("brainDump");
  return {
    segments: [...segs],
    words,
    question: /\?\s*$/.test(plain.trim()) || /^(what|why|how|when|where|who|which|can you|could you|do you|is it|is there|are there|should i)\b/.test(n),
    whys: n.match(/\bwhy\b/g)?.length ?? 0,
    manners: n.match(/\b(please|pls|plz|thanks|thank you|thx|ty|sorry|appreciate it)\b/g)?.length ?? 0,
    pasted,
    avalanche: qm >= 3 && !pasted,
  };
}

export function emptyChatStats(): ChatStats {
  return {
    prompts: 0,
    words: 0,
    longestWords: 0,
    questions: 0,
    whys: 0,
    manners: 0,
    images: 0,
    pasted: 0,
    avalanches: 0,
    hours: Array(24).fill(0),
    days: Array(7).fill(0),
    minutes: 0,
    dayKeys: [],
    nightMinutes: 0,
    seg: Object.fromEntries(FUN.map((f) => [f, { n: 0, min: 0 }])) as ChatStats["seg"],
    topWords: [],
  };
}

/** Feed messages in any order; `finish` sorts them by time to work out minutes per exchange. */
export class ChatStatsBuilder {
  private msgs: { ts: number; text: string; images: number }[] = [];
  private lastTs = -Infinity;

  message(ts: number, text: string, images = 0) {
    if (Number.isNaN(ts)) return;
    this.msgs.push({ ts, text, images });
  }
  /** Any later activity in the session (answers, tool results): bounds the last exchange. */
  seen(ts: number) {
    if (!Number.isNaN(ts)) this.lastTs = Math.max(this.lastTs, ts);
  }

  finish(): ChatStats | undefined {
    if (!this.msgs.length) return undefined;
    const st = emptyChatStats();
    const counts = new Map<string, number>();
    const msgs = [...this.msgs].sort((a, b) => a.ts - b.ts);
    const dayKeys = new Set<string>();
    let total = 0;
    msgs.forEach((m, i) => {
      const next = i + 1 < msgs.length ? msgs[i + 1].ts : Math.max(this.lastTs, m.ts);
      const min = Math.min(CAP_MIN, Math.max(0, (next - m.ts) / 60000));
      const c = classify(m.text);
      const d = new Date(m.ts);
      st.prompts++;
      st.words += c.words;
      st.longestWords = Math.max(st.longestWords, c.words);
      if (c.question) st.questions++;
      st.whys += c.whys;
      st.manners += c.manners;
      st.images += m.images;
      if (c.pasted) st.pasted++;
      if (c.avalanche) st.avalanches = (st.avalanches ?? 0) + 1;
      total += min;
      dayKeys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      st.hours[d.getHours()]++;
      st.days[d.getDay()]++;
      if (d.getHours() < 5) {
        st.nightMinutes += min;
        const mins = d.getHours() * 60 + d.getMinutes();
        st.latestMinuteOfNight = Math.max(st.latestMinuteOfNight ?? 0, mins);
      }
      for (const s of c.segments) {
        st.seg[s].n++;
        st.seg[s].min += min;
      }
      for (const w of norm(m.text.replace(/<pasted_content[\s\S]*?<\/pasted_content[^>]*>/g, " ")).split(" ")) {
        const t = w.replace(/^'+|'+$/g, "");
        if (t.length < 4 || STOP.has(t) || /^\d+$/.test(t)) continue;
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    });
    st.nightMinutes = Math.round(st.nightMinutes);
    st.minutes = Math.round(total * 10) / 10;
    st.dayKeys = [...dayKeys].sort();
    for (const f of FUN) st.seg[f].min = Math.round(st.seg[f].min * 10) / 10;
    st.topWords = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
    return st;
  }
}
