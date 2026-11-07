"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, Lock, Moon, Share2, Sparkles, Upload } from "lucide-react";
import { DAY_NAMES, SEGMENT_COPY, SOURCE_NAMES, hourLabel, minutesLabel, shareText, toCard, type Wrapped } from "@/lib/receipts/wrapped";
import { IMPORT_RANGES, readExportFile, wrappedFromExport, type ImportedExport, type ImportRange } from "@/lib/receipts/chat-import";
import { spentLine, useZeroG } from "@/components/zero-g";
import { roast as askZeroG } from "@/lib/zerog-tasks";

type Period = { id: string; label: string; href: string; active: boolean };
type Roast = { line: string; model?: string; verified?: boolean };

const n0 = (x: number) => Math.round(x).toLocaleString("en-US");
const pct = (x: number) => `${Math.round(x * 100)}%`;
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

export function WrappedView({ initial, periods, source }: { initial?: Wrapped; periods: Period[]; source?: "local" | "demo" }) {
  const [imp, setImp] = useState<ImportedExport>();
  const [range, setRange] = useState<ImportRange>("year");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const imported = useMemo(() => (imp ? wrappedFromExport(imp, range) : undefined), [imp, range]);
  const w = imp ? imported : initial;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    try {
      const x = await readExportFile(file);
      setRange(wrappedFromExport(x, "year") ? "year" : "all");
      setImp(x);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fstack">
      <section className="fintro" aria-labelledby="page-h">
        <div className="max-w-[680px]">
          <h1 id="page-h" className="eng fh1">
            My AI Wrapped
          </h1>
          <p className="flede">
            How you talk to AI: overthinking, therapy sessions, hellos and caps lock, and your AI personality. Counted with simple rules from your own
            messages, on this device, with no AI and nothing uploaded.
          </p>
          <p className="fsrc">
            {imp ? (
              <>
                From your {SOURCE_NAMES[imp.tool]} export, read in this browser tab.{" "}
                <button type="button" className="quiet" onClick={() => setImp(undefined)}>
                  Back to my logs
                </button>
              </>
            ) : source === "demo" ? (
              <>
                This is the demo person. Leave the demo for your own logs, or{" "}
                <a href="#import" className="quiet">
                  bring a ChatGPT or Claude.ai export
                </a>
                .
              </>
            ) : w ? (
              <>
                From {w.sources.map((s) => `${s.name} (${n0(s.conversations)} ${s.conversations === 1 ? "session" : "sessions"})`).join(" and ")} on this laptop.{" "}
                <a href="#import" className="quiet">
                  Use a ChatGPT or Claude.ai export instead
                </a>
              </>
            ) : null}
          </p>
        </div>
        <div className="fseg" role="group" aria-label="Period">
          {imp
            ? IMPORT_RANGES.map((r) => (
                <button key={r.id} type="button" onClick={() => setRange(r.id)} aria-pressed={range === r.id} className="fseg-b">
                  {r.label}
                </button>
              ))
            : periods.map((p) => (
                <Link key={p.id} href={p.href} aria-current={p.active ? "page" : undefined} className="fseg-b">
                  {p.label}
                </Link>
              ))}
        </div>
      </section>

      {/* No logs and no export yet: the export is the way in, so it comes first. */}
      {w ? <WrappedBody key={`${imp?.tool ?? source}-${w.label}`} w={w} /> : imp ? <NoData imported /> : null}

      <ImportPanel busy={busy} error={error} imported={imp} onFile={onFile} />
    </div>
  );
}

function NoData({ imported }: { imported: boolean }) {
  return (
    <div className="fempty">
      <p className="text-lg font-medium">{imported ? "No messages in this period." : "No messages to count yet."}</p>
      <p className="mt-2 text-sm text-[var(--fmute)]">
        {imported ? "Pick a longer period above." : "Bring a ChatGPT or Claude.ai export below, or read your Claude Code and Codex logs in My week, Setup."}
      </p>
    </div>
  );
}

function WrappedBody({ w }: { w: Wrapped }) {
  const zg = useZeroG();
  const [roast, setRoast] = useState<Roast>();
  const [spent, setSpent] = useState("");
  const [roastBusy, setRoastBusy] = useState(false);
  const [roastError, setRoastError] = useState<string>();
  const card = useMemo(() => ({ ...toCard(w), ...(roast ? { r: roast.line } : {}) }), [w, roast]);
  const cardKey = JSON.stringify(card);
  const [png, setPng] = useState<string>();
  const [cardError, setCardError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the share sheet is only known in the browser
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    let url: string | undefined;
    let cancelled = false;
    fetch("/api/card/wrapped", { method: "POST", headers: { "Content-Type": "application/json" }, body: cardKey })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? `Card failed (${r.status})`);
        return r.blob();
      })
      .then((b) => {
        if (cancelled) return;
        url = URL.createObjectURL(b);
        setPng(url);
        setCardError(undefined);
      })
      .catch((e) => !cancelled && setCardError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [cardKey]);

  // Paid from your own 0G account (Sign in with 0G). Only these numbers are sent, never a message.
  async function askRoast() {
    if (!zg.signedIn) return zg.signIn();
    setRoastBusy(true);
    setRoastError(undefined);
    const before = zg.balance;
    try {
      const j = await askZeroG(zg, {
        card: toCard(w),
        extra: { conversations: w.conversations, words: w.words, manners: w.manners, questions: w.questions, whys: w.whys, avalanches: w.avalanches, activeDays: w.activeDays, peakDay: w.peakDay },
      });
      setRoast({ line: j.line, model: j.model, verified: j.verified });
      if (!j.cached) setSpent(spentLine(before, await zg.refreshBalance()));
    } catch (e) {
      setRoastError(e instanceof Error ? e.message : String(e));
    } finally {
      setRoastBusy(false);
    }
  }

  const text = shareText(w) + (roast ? `\n"${roast.line}"` : "");
  const top = w.seg.find((s) => s.n > 0);
  const maxHour = Math.max(1, ...w.hours);
  const maxDay = Math.max(1, ...w.weekdays);

  const kicker = `Your AI personality, ${w.label.charAt(0).toLowerCase()}${w.label.slice(1)}`;
  const fp = fingerprint(w);
  const arcs = clockArcs(w, maxHour);

  return (
    <>
      <section aria-labelledby="persona" className="persona">
        <div className="persona-txt">
          <p className="persona-k">{kicker}</p>
          <h2 id="persona" className="eng persona-n">
            {w.persona.name}
          </h2>
          <p className={`persona-line ${roast ? "is-roast" : ""}`}>{roast ? `"${roast.line}"` : w.persona.line}</p>
          {w.traits.length > 0 && (
            <div className="traits">
              <span className="text-sm text-[var(--fmute)]">Also</span>
              {w.traits.map((t) => (
                <span key={t.id} className="trait">
                  {t.name}
                </span>
              ))}
            </div>
          )}
          <dl className="fstats">
            <BigStat value={minutesLabel(w.minutes)} label="with AI" />
            <BigStat value={n0(w.prompts)} label={w.prompts === 1 ? "message" : "messages"} />
            <BigStat value={n0(w.conversations)} label={w.sources.some((s) => s.tool === "chatgpt" || s.tool === "claude-ai") ? "conversations" : "sessions"} />
            <BigStat value={n0(w.streak)} label={w.streak === 1 ? "day streak" : "days in a row"} />
          </dl>
          <div className="roast" role="status" aria-live="polite">
            {roast && (
              <p className="fine">
                Written privately by {roast.model ?? "the private AI"} on 0G{roast.verified ? ", TEE verified" : ""}, paid from your 0G account. Only the numbers were sent.
                {spent ? ` ${spent}` : ""}
              </p>
            )}
            {!roast && zg.available && (
              <>
                <button type="button" onClick={askRoast} disabled={roastBusy || !zg.ready || zg.connecting} className={`fbtn ${zg.signedIn ? "fbtn-1" : "fbtn-2"}`}>
                  <Sparkles className="size-[17px]" aria-hidden="true" />
                  {roastBusy ? "Asking the private AI…" : zg.signedIn ? "Roast me (private AI)" : zg.connecting ? "Connecting to 0G" : "Sign in with 0G to roast me"}
                </button>
                <p className="fine">Sends only these numbers to a model in a hardware enclave on 0G, paid from your own 0G credits. Never your messages. Under $0.001.</p>
                {roastError && <p className="ferr">{roastError}</p>}
              </>
            )}
            {!roast && !zg.available && <p className="fine">Roast me runs on your laptop, at http://localhost:3000, with Sign in with 0G.</p>}
          </div>
        </div>
        <figure className="fp">
          <svg className="fp-svg" viewBox="-150 -150 300 300" role="img" aria-label="Your AI fingerprint: a pattern drawn from your numbers">
            <g className="fp-rot">
              {fp.c.map((d, i) => (
                <path key={`c${i}`} className="fc" d={d} />
              ))}
              {fp.a.map((d, i) => (
                <path key={`a${i}`} className="fa" d={d} />
              ))}
              {fp.b.map((d, i) => (
                <path key={`b${i}`} className="fb" d={d} />
              ))}
            </g>
          </svg>
          <figcaption>Your AI fingerprint. Drawn from your numbers, so no two look the same.</figcaption>
        </figure>
      </section>

      <div className="g12">
        <section aria-labelledby="time" className="fpanel c7">
          <div className="fsec-head">
            <h2 id="time" className="eng fh2">
              Where the time went
            </h2>
            <p className="text-sm text-[var(--fmute)]">A message counts until your next one, up to 15 minutes.</p>
          </div>
          {top && (
            <p className="biggest">
              Your biggest one: <strong>{top.label}</strong>, {minutesLabel(top.min)}.
            </p>
          )}
          <ul className="segs">
            {w.seg.map((s, i) => (
              <li key={s.key} className={`sg ${s.n === 0 ? "is-zero" : ""}`}>
                <div className="sg-top">
                  <div className="sg-l">
                    <span className="sg-name">{s.label}</span>
                    <span className="sg-blurb">{s.blurb}</span>
                  </div>
                  <span className="eng sg-t num">{minutesLabel(s.min)}</span>
                </div>
                <div className="fbar" aria-hidden="true">
                  <span className={i === 0 && s.n > 0 ? "is-top" : ""} style={{ width: `${w.seg[0]?.min ? Math.max(2, Math.round((s.min / w.seg[0].min) * 100)) : 0}%` }} />
                </div>
                <p className="sg-c">
                  {s.n ? s.line : SEGMENT_COPY[s.key].zero}
                  {s.n > 0 && `, ${pct(s.share)} of your messages`}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="fpanel c5" aria-labelledby="clock-h">
          <div className="fsec-head">
            <h2 id="clock-h" className="eng fh2">
              Your AI clock
            </h2>
            <p className="text-sm text-[var(--fmute)]">Busiest hour: {hourLabel(w.peakHour)}</p>
          </div>
          <div className="clock-box">
            <div className="clock-wrap">
              <svg className="clock" viewBox="-190 -170 380 340" role="img" aria-label={`Messages per hour. Busiest hour: ${hourLabel(w.peakHour)}.`}>
                <circle className="clk-ring" cx="0" cy="0" r="56" />
                {arcs.map((a, h) => (
                  <path key={h} className={a.cls} d={a.d}>
                    <title>{`${hourLabel(h)}: ${n0(w.hours[h])} ${w.hours[h] === 1 ? "message" : "messages"}`}</title>
                  </path>
                ))}
                <text className="clk-l" x="0" y="-150" textAnchor="middle">
                  midnight
                </text>
                <text className="clk-l" x="166" y="4" textAnchor="middle">
                  6 a.m.
                </text>
                <text className="clk-l" x="0" y="160" textAnchor="middle">
                  noon
                </text>
                <text className="clk-l" x="-166" y="4" textAnchor="middle">
                  6 p.m.
                </text>
              </svg>
              <div className="clk-center" aria-hidden="true">
                <b>{hourLabel(w.peakHour)}</b>
                <span>busiest hour</span>
              </div>
            </div>
            <div className="flegend" aria-hidden="true">
              <span>
                <i style={{ background: "#F5C6A5" }} />
                Busiest hour
              </span>
              <span>
                <i style={{ background: "#B7A6F5" }} />
                After midnight
              </span>
              <span>
                <i style={{ background: "#5E78C2" }} />
                Other hours
              </span>
            </div>
          </div>
          <p className="night">
            <Moon className="mt-[3px] size-4 shrink-0 text-[#B7A6F5]" aria-hidden="true" />
            <span>
              {w.nightMinutes > 0 ? (
                <>
                  Night owl: {minutesLabel(w.nightMinutes)} after midnight, {pct(w.nightShare)} of your messages.
                  {w.latestAt && ` Latest one: ${w.latestAt}.`}
                </>
              ) : (
                "Nothing after midnight. You sleep like a normal person."
              )}
            </span>
          </p>
        </section>

        <section className="fpanel c7" aria-labelledby="numbers">
          <h2 id="numbers" className="eng fh2">
            By the numbers
          </h2>
          <ul className="facts-l">
            {w.facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>

        <section className="fpanel c5" aria-labelledby="week-h">
          <div className="fsec-head">
            <h2 id="week-h" className="eng fh2">
              Your AI week
            </h2>
            <p className="text-sm text-[var(--fmute)]">Busiest day: {DAY_NAMES[w.peakDay]}</p>
          </div>
          <div className="wk-list" role="img" aria-label={`Messages per day of the week. Busiest day: ${DAY_NAMES[w.peakDay]}.`}>
            {WEEK_ORDER.map((d) => (
              <div key={d} className="wk">
                <span className="text-[var(--text-2)]">{DAY_NAMES[d].slice(0, 3)}</span>
                <span className="fbar">
                  <span className={d === w.peakDay ? "is-top" : ""} style={{ width: `${(w.weekdays[d] / maxDay) * 100}%` }} />
                </span>
                <span className="wk-n">{n0(w.weekdays[d])}</span>
              </div>
            ))}
          </div>
          <p className="wk-line">
            {n0(w.activeDays)} {w.activeDays === 1 ? "day" : "days"} with AI, longest streak {n0(w.streak)} {w.streak === 1 ? "day" : "days"}.
          </p>
        </section>
      </div>

      {w.topWords.length > 0 && (
        <section aria-labelledby="words" className="py-2">
          <div className="fsec-head">
            <h2 id="words" className="eng fh2">
              Your words
            </h2>
            <p className="lock">
              <Lock className="size-[15px]" aria-hidden="true" />
              Only on this device. Never on the card.
            </p>
          </div>
          <div className="words">
            {w.topWords.map(([word, n], i) => (
              <span key={word} className={`word ${i < 3 ? "word-big" : ""}`}>
                {word} <span>{n0(n)}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="g12">
        <div className="fpanel c7 card-frame">
          {png ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={png} alt={`AI Wrapped card: ${w.persona.name}, ${minutesLabel(w.minutes)} with AI`} className="card-img" />
          ) : (
            <div className="card-skel" />
          )}
        </div>
        <section aria-labelledby="share" className="fpanel c5">
          <h2 id="share" className="eng fh2">
            Share it
          </h2>
          <p className="mt-2 max-w-[60ch] text-[15px] text-[var(--text-2)]">The card shows your persona and the time numbers. No messages, no words, no spend.</p>
          <div className="share-acts">
            {canShare && png && (
              <button
                type="button"
                className="fbtn fbtn-1"
                onClick={async () => {
                  try {
                    const file = new File([await (await fetch(png)).blob()], `ai-wrapped-${w.persona.id}.png`, { type: "image/png" });
                    await navigator.share(navigator.canShare?.({ files: [file] }) ? { files: [file], text } : { text });
                  } catch {
                    // the person closed the share sheet
                  }
                }}
              >
                <Share2 className="size-[17px]" aria-hidden="true" />
                Share
              </button>
            )}
            {png ? (
              <a href={png} download={`ai-wrapped-${w.persona.id}.png`} className={`fbtn ${canShare ? "fbtn-2" : "fbtn-1"}`}>
                <Download className="size-[17px]" aria-hidden="true" />
                Download the card
              </a>
            ) : (
              <button type="button" className="fbtn fbtn-2" disabled>
                <Download className="size-[17px]" aria-hidden="true" />
                Drawing the card…
              </button>
            )}
            <button
              type="button"
              className="fbtn fbtn-2"
              disabled={!png}
              onClick={() => {
                // X cannot take an image through a link: save the card, then open a post with the text to attach it to.
                const a = document.createElement("a");
                a.href = png!;
                a.download = `ai-wrapped-${w.persona.id}.png`;
                a.click();
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "noopener");
              }}
            >
              Post on X
            </button>
            <button
              type="button"
              className="fbtn fbtn-2"
              onClick={async () => {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="size-[17px]" aria-hidden="true" /> : <Copy className="size-[17px]" aria-hidden="true" />}
              {copied ? "Copied" : "Copy the text"}
            </button>
          </div>
          {cardError && <p className="ferr mt-3">{cardError}</p>}
          <div className="copybox">
            <p className="copybox-l">The text it copies</p>
            <pre className="copybox-t">{text}</pre>
          </div>
        </section>
      </div>
    </>
  );
}

function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="eng">{value}</dd>
    </div>
  );
}

function ImportPanel({ busy, error, imported, onFile }: { busy: boolean; error?: string; imported?: ImportedExport; onFile: (f: File | undefined) => void }) {
  return (
    <div className="g12 scroll-mt-20" id="import">
      <section aria-labelledby="import-title" className="fpanel c7">
        <h2 id="import-title" className="eng fh2">
          Use ChatGPT or Claude.ai
        </h2>
        <p className="mt-2 max-w-[60ch] text-[15px] text-[var(--text-2)]">
          Not a coder? Export your chats and bring the file here. ChatGPT: Settings, Data controls, Export data. Claude.ai: Settings, Privacy, Export data. Pick the zip you get by email, or the
          conversations.json inside it.
        </p>
        <p className="lock mt-4">
          <Lock className="size-[15px]" aria-hidden="true" />
          Read in this browser tab only. Nothing is uploaded.
        </p>
        {imported && <p className="mt-3 text-sm text-[var(--fok)]">Read {n0(imported.conversations.length)} conversations from {SOURCE_NAMES[imported.tool]}.</p>}
        {error && <p className="ferr mt-3">{error}</p>}
      </section>
      <div className="fdrop c5">
        <Upload className="size-[22px] text-[var(--text-2)]" aria-hidden="true" />
        <p className="text-base font-[560]">{imported ? "Bring another export" : "Your export, zip or json"}</p>
        <label className="fbtn fbtn-2 fbtn-sm cursor-pointer">
          {busy ? "Reading…" : imported ? "Pick another export" : "Pick the export file"}
          <input type="file" accept=".json,.zip,application/json,application/zip" className="sr-only" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </div>
    </div>
  );
}

/* The fingerprint: hypotrochoid rosettes whose lobes, turns and depths come from the person's numbers. Decoration only. */
function gcd(a: number, b: number) {
  while (b) [a, b] = [b, a % b];
  return a;
}
function rosette(L: number, q: number, A: number, d: number, phi: number, pts: number) {
  const k = (L - q) / q;
  const T = Math.PI * 2 * q;
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const out: string[] = [];
  for (let i = 0; i <= pts; i++) {
    const t = (T * i) / pts;
    const x = A * Math.cos(t) + d * Math.cos(k * t);
    const y = A * Math.sin(t) - d * Math.sin(k * t);
    out.push(`${i ? "L" : "M"}${(x * c - y * s).toFixed(1)} ${(x * s + y * c).toFixed(1)}`);
  }
  return out.join(" ");
}
function ring(R0: number, amp: number, n: number, phase: number, pts: number) {
  const out: string[] = [];
  for (let i = 0; i <= pts; i++) {
    const a = (Math.PI * 2 * i) / pts;
    const r = R0 + amp * Math.sin(n * a + phase);
    out.push(`${i ? "L" : "M"}${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`);
  }
  return out.join(" ");
}
function fingerprint(w: Wrapped) {
  const mins = [...w.seg.map((x) => x.min), 0, 0, 0, 0, 0, 0, 0].slice(0, 7);
  const max = Math.max(1, ...mins);
  const sh = mins.map((v) => v / max);
  const L = 5 + (w.peakHour % 7);
  let q = 2 + (w.streak % 3);
  while (gcd(L, q) !== 1) q++;
  const a: string[] = [];
  const b: string[] = [];
  const c: string[] = [];
  for (let i = 0; i < 6; i++) a.push(rosette(L, q, 50, 36 + 50 * sh[i], (i * Math.PI) / (L * 3), 360 * q));
  const L2 = 9 + (w.peakHour % 5);
  let q2 = 5;
  while (gcd(L2, q2) !== 1) q2++;
  [0, 2, 4, 6].forEach((j, n) => b.push(rosette(L2, q2, 22, 10 + 22 * sh[j], (n * Math.PI) / (L2 * 2), 300 * q2)));
  const nRing = 36 + (w.prompts % 12);
  for (let i = 0; i < 3; i++) c.push(ring(140, 4, nRing, (i * Math.PI * 2) / 3, 720));
  return { a, b, c };
}

/** The 24 hours as a ring of bars: midnight at the top, the busiest hour in peach, after midnight in lavender. */
function clockArcs(w: Wrapped, max: number) {
  const ri = 58;
  const span = 76;
  const pt = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`;
  return w.hours.map((v, h) => {
    const a0 = (h / 24) * Math.PI * 2 - Math.PI / 2 + 0.035;
    const a1 = ((h + 1) / 24) * Math.PI * 2 - Math.PI / 2 - 0.035;
    const ro = ri + (v ? Math.max(3, (span * v) / max) : 1);
    const d = `M${pt(ri, a0)} L${pt(ro, a0)} A${ro.toFixed(1)} ${ro.toFixed(1)} 0 0 1 ${pt(ro, a1)} L${pt(ri, a1)} A${ri} ${ri} 0 0 0 ${pt(ri, a0)} Z`;
    return { d, cls: h === w.peakHour ? "arc arc-peak" : h < 5 ? "arc arc-night" : "arc" };
  });
}
