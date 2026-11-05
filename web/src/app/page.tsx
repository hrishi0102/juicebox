import Link from "next/link";
import { ReceiptPaper } from "@/components/receipt-paper";
import { UseDemoButton } from "@/components/source-switch";
import { ReceiptActions } from "@/components/receipt-actions";
import { JudgeButton, ReviewButton, ScanButton } from "@/components/pipeline-controls";
import { readJson } from "@/lib/receipts/store";
import type { WeeklyReview } from "@/lib/receipts/review";
import { Difficulty, LabelBadge, SpendBar } from "@/components/label-badge";
import { currentSource, getDataset, getDemoTeam, weekView, weeksWithData } from "@/lib/server/data";
import { loadSavedReceipt, localSigner } from "@/lib/server/receipts-store";
import { headline } from "@/lib/receipts/score";
import { median } from "@/lib/receipts/heuristics";
import { buildReceipt } from "@/lib/receipts/receipt";
import { LABEL_ORDER, pct, usd, weekRange } from "@/lib/format";
import type { Judgement, Task } from "@/lib/receipts/types";

export default async function ThisWeek({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const sp = await searchParams;
  const source = await currentSource();
  const d = getDataset(source);
  if (!d) return <Empty />;

  const weeks = weeksWithData(d);
  const wv = weekView(d, sp.week);
  const idx = weeks.findIndex((w) => w.id === wv.id);
  const older = weeks[idx + 1];
  const newer = idx > 0 ? weeks[idx - 1] : undefined;
  const s = wv.summary;
  const saved = loadSavedReceipt(source, wv.id);
  const signer = localSigner(source);
  const owner = saved?.message.owner ?? signer?.address ?? d.owner;
  const preview = owner ? buildReceipt({ owner: owner as `0x${string}`, periodId: wv.id, summary: { ...s, owner }, judgements: wv.judgements }) : undefined;
  // A saved receipt is stale when the data changed after it was signed (rescan, new judge labels).
  const stale = !!saved && !!preview && saved.digest !== preview.digest;
  const digest = stale ? preview?.digest : (saved?.digest ?? preview?.digest);
  const shipped = s.tasks.filter((t) => t.state === "merged" || t.state === "direct");
  const other = s.tasks.filter((t) => !(t.state === "merged" || t.state === "direct"));
  const teamBuckets = source === "demo" ? teamMedians() : undefined;
  const judgeReady = !!process.env.ZG_API_KEY;
  const review = readJson<WeeklyReview | null>("local", `reviews/${source}-${wv.id}.json`, null);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 text-sm">
          <WeekLink week={older?.id} label="Older week" dir="prev" />
          <span className="px-2 font-medium">
            Week {wv.id.split("-W")[1]}, {weekRange(wv.start, wv.end)}
          </span>
          <WeekLink week={newer?.id} label="Newer week" dir="next" />
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {source === "local" && <ScanButton label="Rescan logs" variant="outline" />}
          {source === "local" && <JudgeButton label="Ask the private judge" sessionIds={wv.sessions.map((x) => x.id)} judgeReady={judgeReady} />}
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          <ReceiptPaper
            weekId={wv.id}
            start={wv.start}
            end={wv.end}
            summary={s}
            owner={owner}
            judgeLine={judgeLine(wv.judgements)}
            digest={digest}
            signed={!!saved?.signature && !stale}
            stale={stale}
            sharedLevel={stale ? undefined : saved?.share?.level}
            animate
          />
          <ReceiptActions
            week={wv.id}
            source={source}
            signed={!!saved?.signature && !stale}
            stale={stale}
            shared={stale ? null : (saved?.share ?? null)}
            canSignLocally={!!signer}
            arkivReady={!!process.env.ARKIV_PRIVATE_KEY}
            savedJson={saved ? JSON.stringify(saved, null, 2) : undefined}
          />
          <PrivateJudgePanel judgements={wv.judgements} />
        </div>

        <div className="min-w-0 space-y-10">
          <section>
            <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">{headline(s)}.</h1>
            <p className="mt-4 max-w-[60ch] text-lg text-muted-foreground">
              {s.sessions} sessions this week.{" "}
              {s.wasteUsd > 0 ? `${usd(s.wasteUsd)} (${pct(s.wastePct)}) went to loops, dead ends and oversized runs.` : "Almost nothing went to loops or dead ends."}{" "}
              {s.labelCounts.Pending > 0 && `${s.labelCounts.Pending} still open.`}
            </p>
            {s.spendUsd > 0 && (
              <div className="mt-6 max-w-xl space-y-2">
                <SpendBar parts={LABEL_ORDER.map((l) => ({ label: l, value: s.labelSpend[l] }))} total={s.spendUsd} />
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {LABEL_ORDER.filter((l) => s.labelSpend[l] > 0).map((l) => (
                    <span key={l} className="inline-flex items-center gap-1.5">
                      <LabelBadge label={l} /> {usd(s.labelSpend[l])}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section aria-labelledby="bought">
            <h2 id="bought" className="text-xl font-semibold tracking-tight">
              What it bought
            </h2>
            {shipped.length === 0 ? (
              <p className="mt-3 text-muted-foreground">Nothing merged from this week&apos;s sessions yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
                {shipped.map((t) => (
                  <TaskRow key={t.changeKey} t={t} />
                ))}
              </ul>
            )}
            {other.length > 0 && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  {other.length} more linked change{other.length === 1 ? "" : "s"} not merged (open or closed)
                </summary>
                <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
                  {other.map((t) => (
                    <TaskRow key={t.changeKey} t={t} />
                  ))}
                </ul>
              </details>
            )}
          </section>

          <section aria-labelledby="leaks">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="leaks" className="text-xl font-semibold tracking-tight">
                Where it leaked
              </h2>
              <div className="ml-auto">
                <ReviewButton week={wv.id} judgeReady={judgeReady} label={review ? "New private review" : "Get a private review"} />
              </div>
            </div>
            {review && (
              <div className="mt-3 max-w-[72ch] rounded-lg border border-primary/30 bg-accent/40 p-4">
                <p className="text-[15px]">{review.summary}</p>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px]">
                  {review.tips.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">
                  Private review by {review.judge.model} on 0G Private Computer ({review.judge.trustMode ?? "private"} mode
                  {review.judge.sealed ? ", sealed" : ""}
                  {review.judge.verified ? ", TEE signature verified" : ""}). Request {review.judge.requestId ?? "n/a"}.
                </p>
              </div>
            )}
            <ul className="mt-3 max-w-[70ch] list-disc space-y-2 pl-5 text-[15px]">
              {s.tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="buckets">
            <h2 id="buckets" className="text-xl font-semibold tracking-tight">
              Cost per kept task, by difficulty
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Compared only with tasks of the same difficulty{teamBuckets ? ", against your team's median" : ""}.</p>
            <table className="mt-3 w-full max-w-xl text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-1.5 font-normal">Difficulty</th>
                  <th className="py-1.5 font-normal">Tasks</th>
                  <th className="py-1.5 font-normal">Kept</th>
                  <th className="py-1.5 font-normal">You</th>
                  {teamBuckets && <th className="py-1.5 font-normal">Team median</th>}
                </tr>
              </thead>
              <tbody>
                {s.buckets
                  .filter((b) => b.tasks > 0)
                  .map((b) => {
                    const team = teamBuckets?.[b.difficulty];
                    const worse = team && b.costPerKept !== null && b.costPerKept > team * 1.25;
                    return (
                      <tr key={b.difficulty} className="border-t border-border">
                        <td className="py-2">
                          <Difficulty value={b.difficulty} />
                        </td>
                        <td className="py-2">{b.tasks}</td>
                        <td className="py-2">{b.keptWork.toFixed(1)}</td>
                        <td className={`py-2 font-medium ${worse ? "text-[var(--l-overkill)]" : ""}`}>{b.costPerKept === null ? "nothing kept" : usd(b.costPerKept)}</td>
                        {teamBuckets && <td className="py-2 text-muted-foreground">{team ? usd(team) : "n/a"}</td>}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}

function TaskRow({ t }: { t: Task }) {
  const alive = t.survival === null ? null : Math.round(t.survival * 100);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="w-full min-w-0 sm:w-auto sm:flex-1">
        <a href={t.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
          {t.title}
        </a>
        <div className="text-sm text-muted-foreground">
          {t.changeKey} {t.reverted ? "(reverted)" : t.state === "open" ? "(open)" : t.state === "closed" ? "(closed, not merged)" : ""}
        </div>
      </div>
      <Difficulty value={t.difficulty} />
      <div className="w-28 text-sm">
        {t.reverted ? (
          <span className="text-[var(--l-overkill)]">0% alive</span>
        ) : alive === null ? (
          <span className="text-muted-foreground">{t.state === "merged" || t.state === "direct" ? "survival unknown" : "not merged"}</span>
        ) : (
          <div title={t.survivalMatured ? "Measured 30 days after merge" : "Measured so far; final check at 30 days"}>
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div className="h-1.5 rounded-full bg-[var(--l-shipped)]" style={{ width: `${alive}%` }} />
            </div>
            <span className="text-muted-foreground">
              {alive}% alive{t.survivalMatured ? "" : " so far"}
            </span>
          </div>
        )}
      </div>
      <div className="ml-auto w-20 text-right font-medium">{usd(t.costUsd)}</div>
    </li>
  );
}

function WeekLink({ week, label, dir }: { week?: string; label: string; dir: "prev" | "next" }) {
  const glyph = dir === "prev" ? "‹" : "›";
  if (!week)
    return (
      <span className="rounded-md px-2 py-1 text-muted-foreground/40" aria-hidden="true">
        {glyph}
      </span>
    );
  return (
    <Link href={`/?week=${week}`} aria-label={label} className="rounded-md px-2 py-1 text-lg leading-none hover:bg-accent">
      {glyph}
    </Link>
  );
}

/** Visible proof of the private judge: which sessions were judged on 0G, with request ids. */
function PrivateJudgePanel({ judgements }: { judgements: Judgement[] }) {
  const tee = judgements.filter((j) => j.judge.engine === "0g-tee");
  if (!tee.length)
    return (
      <p className="text-sm text-muted-foreground">
        Labels this week come from offline rules. The private judge reads each session inside a 0G enclave and does better.
      </p>
    );
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-sm">
      <div className="font-medium">
        Judged privately on 0G: {tee.length} of {judgements.length} sessions, {tee.filter((j) => j.judge.verified).length} with a verified TEE signature
      </div>
      <ul className="mt-2 space-y-0.5 text-muted-foreground">
        {tee.slice(0, 6).map((j) => (
          <li key={j.sessionId} className="truncate">
            <Link href={`/sessions/${j.sessionId}`} className="hover:underline">
              {j.label}
            </Link>
            , request {j.judge.requestId ?? "n/a"}
          </li>
        ))}
        {tee.length > 6 && <li>and {tee.length - 6} more</li>}
      </ul>
    </div>
  );
}

function judgeLine(js: Judgement[]) {
  const tee = js.filter((j) => j.judge.engine === "0g-tee").length;
  if (tee) return `0G TEE, ${tee} of ${js.length}`;
  const oa = js.filter((j) => j.judge.engine === "openai-compatible").length;
  if (oa) return `local model, ${oa} of ${js.length}`;
  return "offline rules";
}

function teamMedians() {
  const team = getDemoTeam();
  if (!team) return undefined;
  const by: Record<number, number[]> = {};
  for (const r of team.receipts) for (const b of r.summary.buckets) if (b.costPerKept !== null) (by[b.difficulty] ??= []).push(b.costPerKept);
  return Object.fromEntries(Object.entries(by).map(([k, v]) => [Number(k), median(v)])) as Record<number, number>;
}

function Empty() {
  return (
    <div className="mx-auto max-w-2xl py-16">
      <h1 className="text-4xl font-semibold tracking-tight">See what your AI coding spend bought.</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Receipts reads your Claude Code logs on this machine, links each session to the pull requests it produced, and prints a weekly receipt you
        own and sign. Nothing leaves your laptop until you choose to share totals.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ScanButton />
        <UseDemoButton />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Needs GitHub access for outcomes: set GITHUB_TOKEN, or be logged in with the GitHub CLI (gh auth login).
      </p>
    </div>
  );
}
