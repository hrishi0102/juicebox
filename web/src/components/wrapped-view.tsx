"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, Lock, Moon, Sparkles, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { FunSegment } from "@/lib/receipts/chat-stats";
import { DAY_NAMES, SEGMENT_COPY, SOURCE_NAMES, hourLabel, minutesLabel, shareText, toCard, type Wrapped } from "@/lib/receipts/wrapped";
import { IMPORT_RANGES, readExportFile, wrappedFromExport, type ImportedExport, type ImportRange } from "@/lib/receipts/chat-import";

type Period = { id: string; label: string; href: string; active: boolean };
type Roast = { line: string; model?: string; verified?: boolean };

const SEG_STYLE: Record<FunSegment, string> = {
  overthinking: "from-violet-600 to-indigo-700",
  therapy: "from-pink-600 to-rose-700",
  student: "from-sky-600 to-blue-700",
  hi: "from-orange-600 to-amber-700",
  goAhead: "from-emerald-600 to-teal-700",
  rage: "from-red-600 to-rose-800",
  brainDump: "from-fuchsia-600 to-purple-800",
};

const n0 = (x: number) => Math.round(x).toLocaleString("en-US");
const pct = (x: number) => `${Math.round(x * 100)}%`;
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

export function WrappedView({ initial, periods, source, aiReady }: { initial?: Wrapped; periods: Period[]; source?: "local" | "demo"; aiReady: boolean }) {
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
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-muted-foreground">AI Wrapped</p>
          <h1 className="mt-1 text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">How you talk to AI</h1>
          <p className="mt-3 text-pretty text-[15px] text-muted-foreground">
            Overthinking, therapy sessions, hellos and caps lock: fun numbers from your own messages. Counted with simple rules on this device, with no AI and nothing uploaded.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-0.5 text-sm" role="group" aria-label="Period">
          {imp
            ? IMPORT_RANGES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRange(r.id)}
                  aria-pressed={range === r.id}
                  className={`rounded-md px-2.5 py-1 transition-colors ${range === r.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {r.label}
                </button>
              ))
            : periods.map((p) => (
                <Link
                  key={p.id}
                  href={p.href}
                  aria-current={p.active ? "page" : undefined}
                  className={`rounded-md px-2.5 py-1 transition-colors ${p.active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {p.label}
                </Link>
              ))}
        </div>
      </header>

      <p className="-mt-6 text-sm text-muted-foreground">
        {imp ? (
          <>
            From your {SOURCE_NAMES[imp.tool]} export, read in this browser tab.{" "}
            <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => setImp(undefined)}>
              Back to my logs
            </button>
          </>
        ) : source === "demo" ? (
          <>
            This is the demo person. Switch to My data at the top for your own logs, or{" "}
            <a href="#import" className="underline underline-offset-2 hover:text-foreground">
              bring a ChatGPT or Claude.ai export
            </a>
            .
          </>
        ) : w ? (
          <>
            From {w.sources.map((s) => `${s.name} (${n0(s.conversations)} ${s.conversations === 1 ? "session" : "sessions"})`).join(" and ")} on this laptop.{" "}
            <a href="#import" className="underline underline-offset-2 hover:text-foreground">
              Use a ChatGPT or Claude.ai export instead
            </a>
          </>
        ) : null}
      </p>

      {w ? <WrappedBody key={`${imp?.tool ?? source}-${w.label}`} w={w} aiReady={aiReady} /> : <NoData imported={!!imp} />}

      <ImportPanel busy={busy} error={error} imported={imp} onFile={onFile} />
    </div>
  );
}

function NoData({ imported }: { imported: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <p className="text-lg font-medium">{imported ? "No messages in this period." : "No messages to count yet."}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {imported ? "Pick a longer period above." : "Read your logs on the My week page, or bring a ChatGPT or Claude.ai export below."}
      </p>
    </div>
  );
}

function WrappedBody({ w, aiReady }: { w: Wrapped; aiReady: boolean }) {
  const [roast, setRoast] = useState<Roast>();
  const [roastBusy, setRoastBusy] = useState(false);
  const [roastError, setRoastError] = useState<string>();
  const card = useMemo(() => ({ ...toCard(w), ...(roast ? { r: roast.line } : {}) }), [w, roast]);
  const cardKey = JSON.stringify(card);
  const [png, setPng] = useState<string>();
  const [cardError, setCardError] = useState<string>();
  const [copied, setCopied] = useState(false);

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

  async function askRoast() {
    setRoastBusy(true);
    setRoastError(undefined);
    try {
      const r = await fetch("/api/wrapped/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card: toCard(w),
          extra: { conversations: w.conversations, words: w.words, manners: w.manners, questions: w.questions, whys: w.whys, avalanches: w.avalanches, activeDays: w.activeDays, peakDay: w.peakDay },
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error ?? "The private AI did not answer.");
      setRoast({ line: j.line, model: j.model, verified: j.verified });
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

  return (
    <div className="space-y-10">
      <section aria-labelledby="persona" className="overflow-hidden rounded-3xl bg-linear-to-br from-[#2c46c9] via-[#6d3fc6] to-[#be185d] p-6 text-white shadow-lg sm:p-10">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/80">{w.label}</p>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <p className="text-lg text-white/80">Your AI personality</p>
            <h2 id="persona" className="mt-2 text-balance text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl">
              {w.persona.name}
            </h2>
            <p className="mt-4 max-w-xl text-pretty text-xl leading-snug text-white/90">{roast ? `"${roast.line}"` : w.persona.line}</p>
            {roast && (
              <p className="mt-2 text-sm text-white/75">
                Written privately by {roast.model ?? "the private AI"} on 0G{roast.verified ? ", TEE verified" : ""}. Only the numbers were sent.
              </p>
            )}
            {w.traits.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="text-sm text-white/75">Also:</span>
                {w.traits.map((t) => (
                  <span key={t.id} className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium">
                    {t.name}
                  </span>
                ))}
              </div>
            )}
            {aiReady && !roast && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={askRoast}
                  disabled={roastBusy}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3.5 text-sm font-semibold text-[#2c46c9] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  <Sparkles className="size-4" aria-hidden="true" />
                  {roastBusy ? "Asking the private AI…" : "Roast me (private AI)"}
                </button>
                <p className="mt-2 max-w-md text-xs text-white/75">Sends only these numbers to a model in a hardware enclave on 0G. Never your messages. About $0.001.</p>
                {roastError && <p className="mt-2 text-sm font-medium text-white">{roastError}</p>}
              </div>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-3 self-end">
            <BigStat value={minutesLabel(w.minutes)} label="with AI" />
            <BigStat value={n0(w.prompts)} label={w.prompts === 1 ? "message" : "messages"} />
            <BigStat value={n0(w.conversations)} label={w.sources.some((s) => s.tool === "chatgpt" || s.tool === "claude-ai") ? "conversations" : "sessions"} />
            <BigStat value={n0(w.streak)} label={w.streak === 1 ? "day streak" : "days in a row"} />
          </dl>
        </div>
      </section>

      <section aria-labelledby="time">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="time" className="text-xl font-semibold tracking-tight">
            Where the time went
          </h2>
          <p className="text-sm text-muted-foreground">A message counts until your next one, up to 15 minutes.</p>
        </div>
        {top && (
          <p className="mt-1 text-[15px]">
            Your biggest one: <span className="font-semibold">{top.label}</span>, {minutesLabel(top.min)}.
          </p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {w.seg.map((s, i) => (
            <div key={s.key} className={`rounded-2xl bg-linear-to-br p-5 text-white ${SEG_STYLE[s.key]} ${s.n === 0 ? "opacity-70" : ""} ${i === 0 && s.n > 0 ? "sm:col-span-2" : ""}`}>
              <p className="text-sm font-medium text-white/85">{s.label}</p>
              <p className={`mt-2 font-bold tracking-tight ${i === 0 && s.n > 0 ? "text-5xl" : "text-4xl"}`}>{minutesLabel(s.min)}</p>
              <p className="mt-1 text-[15px] text-white/95">{s.n ? s.line : SEGMENT_COPY[s.key].zero}</p>
              <p className="mt-3 text-xs text-white/80">
                {s.blurb}
                {s.n ? `. ${pct(s.share)} of your messages.` : "."}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="When you talk to AI">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Your AI clock</h2>
            <p className="text-sm text-muted-foreground">Busiest hour: {hourLabel(w.peakHour)}</p>
          </div>
          <div className="mt-4 flex h-32 items-end gap-[3px]" role="img" aria-label={`Messages per hour. Busiest hour: ${hourLabel(w.peakHour)}.`}>
            {w.hours.map((v, h) => (
              <div
                key={h}
                title={`${hourLabel(h)}: ${n0(v)} ${v === 1 ? "message" : "messages"}`}
                className={`flex-1 rounded-t-sm ${h === w.peakHour ? "bg-[#be185d]" : h < 5 ? "bg-[#6d3fc6]" : "bg-primary/70"}`}
                style={{ height: `${v ? Math.max(4, (v / maxHour) * 100) : 0}%` }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
            <span>midnight</span>
            <span>6 a.m.</span>
            <span>noon</span>
            <span>6 p.m.</span>
            <span>11 p.m.</span>
          </div>
          <p className="mt-4 flex items-start gap-2 text-[15px]">
            <Moon className="mt-0.5 size-4 shrink-0 text-[#6d3fc6]" aria-hidden="true" />
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
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Your AI week</h2>
            <p className="text-sm text-muted-foreground">Busiest day: {DAY_NAMES[w.peakDay]}</p>
          </div>
          <div className="mt-4 space-y-2">
            {WEEK_ORDER.map((d) => (
              <div key={d} className="flex items-center gap-3 text-sm">
                <span className="w-9 shrink-0 text-muted-foreground">{DAY_NAMES[d].slice(0, 3)}</span>
                <div className="h-3 flex-1 rounded-full bg-muted">
                  <div className={`h-3 rounded-full ${d === w.peakDay ? "bg-[#be185d]" : "bg-primary/70"}`} style={{ width: `${(w.weekdays[d] / maxDay) * 100}%` }} />
                </div>
                <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">{n0(w.weekdays[d])}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[15px]">
            {n0(w.activeDays)} {w.activeDays === 1 ? "day" : "days"} with AI, longest streak {n0(w.streak)} {w.streak === 1 ? "day" : "days"}.
          </p>
        </div>
      </section>

      <section aria-labelledby="numbers">
        <h2 id="numbers" className="text-xl font-semibold tracking-tight">
          By the numbers
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {w.facts.map((f) => (
            <li key={f} className="rounded-xl border border-border bg-card p-4 text-[15px] leading-snug">
              {f}
            </li>
          ))}
        </ul>
      </section>

      {w.topWords.length > 0 && (
        <section aria-labelledby="words">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="words" className="text-xl font-semibold tracking-tight">
              Your words
            </h2>
            <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Lock className="size-3.5" aria-hidden="true" />
              Only on this device. Never on the card.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {w.topWords.map(([word, n], i) => (
              <span key={word} className={`rounded-full border border-border bg-card px-3 py-1.5 ${i < 3 ? "text-lg font-semibold" : "text-sm"}`}>
                {word} <span className="tabular-nums text-muted-foreground">{n0(n)}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="share" className="grid gap-6 rounded-2xl border border-border bg-card p-5 sm:p-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <h2 id="share" className="text-xl font-semibold tracking-tight">
            Share your Wrapped
          </h2>
          <p className="mt-1 text-[15px] text-muted-foreground">The card shows your persona and the time numbers. No messages, no words, no spend.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {png ? (
              <a href={png} download={`ai-wrapped-${w.persona.id}.png`} className={buttonVariants({ size: "lg" })}>
                <Download className="size-4" aria-hidden="true" />
                Download the card
              </a>
            ) : (
              <Button size="lg" disabled>
                <Download className="size-4" aria-hidden="true" />
                Drawing the card…
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              {copied ? "Copied" : "Copy the text"}
            </Button>
          </div>
          {cardError && <p className="mt-3 text-sm text-destructive">{cardError}</p>}
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-[13px] leading-relaxed">{text}</pre>
        </div>
        <div>
          {png ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={png} alt={`AI Wrapped card: ${w.persona.name}, ${minutesLabel(w.minutes)} with AI`} className="w-full rounded-xl shadow-md" />
          ) : (
            <div className="aspect-[4/5] w-full animate-pulse rounded-xl bg-muted" />
          )}
        </div>
      </section>
    </div>
  );
}

function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col-reverse rounded-2xl bg-white/12 p-4">
      <dt className="mt-1 text-sm text-white/80">{label}</dt>
      <dd className="text-3xl font-bold tracking-tight sm:text-4xl">{value}</dd>
    </div>
  );
}

function ImportPanel({ busy, error, imported, onFile }: { busy: boolean; error?: string; imported?: ImportedExport; onFile: (f: File | undefined) => void }) {
  return (
    <section id="import" aria-labelledby="import-title" className="scroll-mt-20 rounded-2xl border border-dashed border-border bg-card p-5 sm:p-6">
      <h2 id="import-title" className="text-xl font-semibold tracking-tight">
        Use ChatGPT or Claude.ai
      </h2>
      <p className="mt-1 max-w-2xl text-[15px] text-muted-foreground">
        Not a coder? Export your chats and drop the file here. ChatGPT: Settings, Data controls, Export data. Claude.ai: Settings, Privacy, Export data. Pick the zip you get by email, or the
        conversations.json inside it.
      </p>
      <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Lock className="size-3.5" aria-hidden="true" />
        Read in this browser tab only. Nothing is uploaded.
      </p>
      <div className="mt-4">
        <label className={`${buttonVariants({ variant: "outline", size: "lg" })} cursor-pointer`}>
          <Upload className="size-4" aria-hidden="true" />
          {busy ? "Reading…" : imported ? "Pick another export" : "Pick the export file"}
          <input type="file" accept=".json,.zip,application/json,application/zip" className="sr-only" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </div>
      {imported && <p className="mt-3 text-sm">Read {n0(imported.conversations.length)} conversations from {SOURCE_NAMES[imported.tool]}.</p>}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </section>
  );
}
