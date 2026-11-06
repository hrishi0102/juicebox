import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { ReceiptPaper, storyCalls, writtenBy } from "@/components/receipt-paper";
import { ScanButton } from "@/components/pipeline-controls";
import { ReviewWeekButton, WriteWeekButton } from "@/components/ai-actions";
import { WeekList } from "@/components/week-list";
import { EfficiencyPanel } from "@/components/efficiency-panel";
import { CategoryBar, CategoryLegend } from "@/components/category-badge";
import { Difficulty } from "@/components/label-badge";
import { Collapsible } from "@/components/collapsible";
import { FlowSteps } from "@/components/flow-steps";
import { EnterDemo } from "@/components/demo";
import { buttonVariants } from "@/components/ui/button";
import { readJson } from "@/lib/receipts/store";
import type { WeeklyReview } from "@/lib/receipts/review";
import { currentSource, getDataset, getDemoOrg, onLaptop, weekView, weeksWithData } from "@/lib/server/data";
import { employeeTarget, payerText, weekReceipt } from "@/lib/server/employee";
import { IdentityLine } from "@/components/identity-line";
import { loadSavedReceipt } from "@/lib/server/receipts-store";
import { githubLogin } from "@/lib/receipts/identity";
import { median } from "@/lib/receipts/heuristics";
import { receiptStatus, weekFlow } from "@/lib/receipts/flow";
import { CATEGORY_COPY, plural, usd, weekRange } from "@/lib/format";
import { CATEGORIES, TOOL_NAMES, type AiTool, type PeriodSummary, type Task } from "@/lib/receipts/types";

export const metadata = { title: "My week · Receipts" };

// The employee's week. One question, one answer, and one next step: write it, review and sign it,
// send it. What the company will see is on the next page (Review and send).
export default async function MyWeek({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const sp = await searchParams;
  const source = await currentSource();
  const d = getDataset(source);
  if (!d) return <FirstRun laptop={await onLaptop()} />;

  const weeks = weeksWithData(d);
  const wv = weekView(d, sp.week);
  const idx = weeks.findIndex((w) => w.id === wv.id);
  const older = weeks[idx + 1];
  const newer = idx > 0 ? weeks[idx - 1] : undefined;
  const s = wv.summary;
  const rc = weekReceipt(source, d, wv);
  const aiStory = s.story.engine !== "rules";
  const flow = weekFlow({ aiWritten: aiStory, storyStale: s.story.stale, signed: !!rc.saved?.signature, receiptStale: rc.stale, sent: !!rc.saved?.share?.arkivKey });
  const review = readJson<WeeklyReview | null>("local", `reviews/${source}-${wv.id}.json`, null);
  const teamBuckets = source === "demo" ? teamMedians() : undefined;
  const target = await employeeTarget(source);
  const login = source === "demo" ? "you" : (await githubLogin())?.login;
  const sendHref = `/me/send?week=${wv.id}`;

  return (
    <div className="space-y-8">
      <IdentityLine login={login} target={target} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 text-sm">
          <WeekLink week={older?.id} label="Older week" dir="prev" />
          <span className="px-2 font-medium">
            Week {wv.id.split("-W")[1]}, {weekRange(wv.start, wv.end)}
          </span>
          <WeekLink week={newer?.id} label="Newer week" dir="next" />
        </div>
        <FlowSteps
          label={`Week ${wv.id.split("-W")[1]} steps`}
          steps={[
            { label: "Write", state: flow.write },
            { label: "Review", state: flow.review, href: sendHref },
            { label: "Sign", state: flow.sign, href: sendHref },
            { label: "Send", state: flow.send, href: sendHref },
          ]}
        />
        {source === "local" && (
          <div className="ml-auto">
            <ScanButton label="Refresh from my logs" variant="outline" />
          </div>
        )}
      </div>

      <section className="max-w-3xl">
        <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">What did you get done this week?</h1>
        <p className="mt-4 text-pretty text-xl leading-snug sm:text-2xl">{s.oneLiner}</p>
        <p className="mt-2 text-[15px] text-muted-foreground">
          {s.oneLiner !== s.countLine && `${s.countLine} `}
          {plural(s.sessions, "AI session")}, {usd(s.spendUsd)}
          {toolText(s)}.
        </p>

        <div className="mt-6 flex flex-wrap items-start gap-3">
          {(flow.next === "write" || aiStory) && (
            <WriteWeekButton week={wv.id} variant={flow.next === "write" ? "default" : "outline"} label={!aiStory ? "Write my week" : s.story.stale ? "Update with new sessions" : "Write it again"} />
          )}
          {flow.next === "done" ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-accent-foreground">
                <Check className="size-4" aria-hidden="true" /> Sent to {target.orgName}
              </span>
              <Link href={sendHref} className="text-sm text-primary hover:underline">
                See what they got
              </Link>
            </div>
          ) : (
            <Link href={sendHref} className={buttonVariants({ variant: flow.next === "write" ? "outline" : "default", size: "lg" })}>
              {flow.next === "send" ? `Send it to ${target.orgName}` : "Review and send"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          )}
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          {aiStory ? (
            <>
              Written privately by {s.story.model} on 0G{s.story.verified ? ", TEE verified" : ""}
              {s.story.payer ? `, ${payerText(s.story.payer)}` : ""}.{" "}
              {s.story.stale ? `${plural(s.story.newSessions, "new session")} since then, shown below with simple rules.` : ""}
            </>
          ) : (
            "Simple rules drafted this list. Write my week has the private AI on 0G read each session and write a better one. Only a trimmed summary of each session goes to 0G, where the model runs in a hardware enclave."
          )}
        </p>
      </section>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="got">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="got" className="text-xl font-semibold tracking-tight">
                What you got
              </h2>
              <span className="text-sm text-muted-foreground">{plural(s.items.length, "item")}</span>
            </div>
            <WeekList items={s.items} timelines={s.efficiency?.items} />
            {s.spendUsd > 0 && (
              <div className="mt-4 space-y-2">
                <CategoryBar spend={s.categorySpend} total={s.spendUsd} />
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {CATEGORIES.filter((c) => s.categorySpend[c] > 0).map((c) => (
                    <span key={c} className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ background: `var(${CATEGORY_COPY[c].varName})` }} aria-hidden="true" />
                      {c} {usd(s.categorySpend[c])}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {s.efficiency && <EfficiencyPanel e={s.efficiency} />}

          <div className="space-y-3">
            <Collapsible title="Pull requests" hint={prHint(s.tasks)}>
              <PrList tasks={s.tasks} />
            </Collapsible>

            <Collapsible title="How this was written" hint={aiStory ? `Private AI on 0G, ${storyCalls(s.story)}` : "Simple rules"}>
              <HowWritten s={s} firstSession={wv.sessions[0]?.id} />
            </Collapsible>

            <Collapsible title="Where money leaked" hint={review ? "Private review ready" : s.wasteUsd > 0 ? `${usd(s.wasteUsd)} went in circles` : plural(s.tips.length, "tip")}>
              {review && (
                <div className="mb-4 rounded-lg border border-primary/30 bg-accent/40 p-4">
                  <p className="text-[15px]">{review.summary}</p>
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px]">
                    {review.tips.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Private review by {review.judge.model} on 0G ({review.judge.trustMode ?? "private"} mode{review.judge.verified ? ", TEE verified" : ""}
                    {review.judge.payer ? `, ${payerText(review.judge.payer)}` : ""}). Request {review.judge.requestId ?? "n/a"}.
                  </p>
                </div>
              )}
              <ul className="max-w-[70ch] list-disc space-y-2 pl-5 text-[15px]">
                {s.tips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
              {source === "local" && (
                <div className="mt-4">
                  <ReviewWeekButton week={wv.id} label={review ? "Get a new private review" : "Get a private AI review"} />
                </div>
              )}
            </Collapsible>

            <Collapsible title="Cost by difficulty" hint={teamBuckets ? "Compared with your team" : "Small, medium and hard work kept apart"}>
              <p className="text-sm text-muted-foreground">Work is only compared with work of the same difficulty, never across people.</p>
              <table className="mt-3 w-full max-w-xl text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-1.5 font-normal">Difficulty</th>
                    <th className="py-1.5 font-normal">PRs</th>
                    <th className="py-1.5 font-normal">You, per merged PR</th>
                    {teamBuckets && <th className="py-1.5 font-normal">Team median</th>}
                  </tr>
                </thead>
                <tbody>
                  {s.buckets
                    .filter((b) => b.tasks > 0)
                    .map((b) => {
                      const team = teamBuckets?.[b.difficulty];
                      return (
                        <tr key={b.difficulty} className="border-t border-border">
                          <td className="py-2">
                            <Difficulty value={b.difficulty} />
                          </td>
                          <td className="py-2">{b.tasks}</td>
                          <td className="py-2 font-medium">{b.costPerKept === null ? "nothing merged" : usd(b.costPerKept)}</td>
                          {teamBuckets && <td className="py-2 text-muted-foreground">{team ? usd(team) : "n/a"}</td>}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </Collapsible>

            <Collapsible title="What the categories mean">
              <CategoryLegend />
            </Collapsible>
          </div>
        </div>

        <aside className="space-y-6">
          <ReceiptPaper
            weekId={wv.id}
            start={wv.start}
            end={wv.end}
            summary={s}
            owner={rc.owner}
            judgeLine={writtenBy(s.story)}
            digest={rc.digest}
            signed={rc.signed}
            stale={rc.stale}
            sharedLevel={rc.sent?.level}
            animate
          />
          <section aria-labelledby="past">
            <h2 id="past" className="text-sm font-medium">
              Your receipts
            </h2>
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card text-sm">
              {weeks.slice(0, 8).map((w) => {
                const st = w.id === wv.id ? (flow.next === "done" ? "sent" : rc.signed ? "signed" : "not signed") : receiptStatus(loadSavedReceipt(source, w.id));
                return (
                  <li key={w.id}>
                    <Link href={`/me?week=${w.id}`} className={`flex items-center justify-between gap-3 px-3 py-2 hover:bg-accent/50 ${w.id === wv.id ? "font-medium" : ""}`}>
                      <span>
                        Week {w.id.split("-W")[1]} <span className="font-normal text-muted-foreground">{weekRange(w.start, w.end)}</span>
                      </span>
                      <span className={st === "sent" ? "text-[var(--c-built)]" : "text-muted-foreground"}>{st === "sent" ? `Sent` : st === "signed" ? "Signed, not sent" : "Not sent"}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function toolText(s: PeriodSummary) {
  const parts = Object.entries(s.toolSpend ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([t, v]) => `${TOOL_NAMES[t as AiTool] ?? t} ${usd(v)}`);
  return parts.length > 1 ? ` (${parts.join(", ")})` : parts.length === 1 ? ` in ${TOOL_NAMES[Object.keys(s.toolSpend)[0] as AiTool] ?? Object.keys(s.toolSpend)[0]}` : "";
}

function prHint(tasks: Task[]) {
  if (!tasks.length) return "None linked this week";
  const merged = tasks.filter((t) => (t.state === "merged" || t.state === "direct") && !t.reverted).length;
  return `${plural(tasks.length, "PR")}, ${merged} merged. Always included when you send your receipt`;
}

function PrList({ tasks }: { tasks: Task[] }) {
  if (!tasks.length) return <p className="text-sm text-muted-foreground">No pull requests or commits linked to this week&apos;s sessions.</p>;
  return (
    <ul className="divide-y divide-border">
      {tasks.map((t) => (
        <li key={t.changeKey} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <a href={t.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
              {t.title}
            </a>
            <div className="text-sm text-muted-foreground">
              {t.changeKey}, {t.reverted ? "reverted" : t.state === "direct" ? "pushed to main" : t.state}
            </div>
          </div>
          <div className="shrink-0 text-right font-medium">{usd(t.costUsd, 2)}</div>
        </li>
      ))}
    </ul>
  );
}

function HowWritten({ s, firstSession }: { s: PeriodSummary; firstSession?: string }) {
  if (s.story.engine === "rules")
    return (
      <div className="max-w-[70ch] space-y-2 text-[15px]">
        <p>
          This list comes from simple rules: one item per pull request, named after it, and the biggest other sessions on their own. Categories come
          from signals in the logs (edits, web searches, failing commands).
        </p>
        <p className="text-muted-foreground">
          The private AI does better: it reads what you asked and what the AI answered on 0G, where the model runs inside a hardware enclave (TEE),
          and writes one line per session. A second call merges the lines into this list. It is paid from your own 0G account with Sign in with 0G.
        </p>
      </div>
    );
  return (
    <div className="max-w-[70ch] space-y-3 text-[15px]">
      <p>
        Written by <span className="font-medium">{s.story.model}</span> on the 0G Private Computer, in private mode: only providers running the model
        inside a TEE could answer{s.story.verified ? ", and every answer's TEE signature was checked" : ""}. The requests reach 0G over HTTPS
        through its router and are not end-to-end sealed today, so the router could read them in transit.
        {s.story.payer ? ` It was ${payerText(s.story.payer)}.` : ""}
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
        <li>Each session went in as a private digest: what you asked, what the AI said at the end, tool counts, the GitHub outcome and the cost.</li>
        <li>The AI answered with a category and a short title. Only those are kept, never the prompts.</li>
        <li>One more call saw only the titles and merged them into this list and its one sentence.</li>
      </ol>
      {s.story.requestIds.length > 0 && (
        <div className="text-sm">
          <div className="text-muted-foreground">0G request ids ({s.story.requestIds.length}):</div>
          <ul className="mt-1 space-y-0.5 font-mono text-xs">
            {s.story.requestIds.slice(0, 5).map((id) => (
              <li key={id}>{id}</li>
            ))}
            {s.story.requestIds.length > 5 && <li>and {s.story.requestIds.length - 5} more</li>}
          </ul>
        </div>
      )}
      {firstSession && (
        <Link href={`/me/sessions/${firstSession}`} className="text-sm text-primary hover:underline">
          See exactly what was sent for one session
        </Link>
      )}
    </div>
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
    <Link href={`/me?week=${week}`} aria-label={label} className="rounded-md px-2 py-1 text-lg leading-none hover:bg-accent">
      {glyph}
    </Link>
  );
}

function teamMedians() {
  const org = getDemoOrg();
  if (!org) return undefined;
  const team = org.members.find((m) => m.you)?.team;
  const by: Record<number, number[]> = {};
  for (const r of org.receipts.filter((x) => x.share?.team === team)) for (const b of r.summary.buckets) if (b.costPerKept !== null) (by[b.difficulty] ??= []).push(b.costPerKept);
  return Object.fromEntries(Object.entries(by).map(([k, v]) => [Number(k), median(v)])) as Record<number, number>;
}

/** No logs read yet: set up first. On a hosted copy there are no logs, so it points at the demo. */
function FirstRun({ laptop }: { laptop: boolean }) {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <p className="text-sm font-medium text-muted-foreground">For employees</p>
      <h1 className="mt-1 text-balance text-5xl font-semibold leading-[1.05] tracking-tight">Your weekly receipt</h1>
      <p className="mt-5 text-lg text-muted-foreground">
        Receipts reads your Claude Code and Codex sessions on this laptop and writes down what they got done: what you built, fixed, figured out and
        researched, and what it cost. You check it, sign it with a key that stays here, and send it to your company. Your prompts never leave the
        laptop.
      </p>
      {laptop ? (
        <>
          <div className="mt-8 rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold">Set up once</h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[15px]">
              <li>Connect GitHub (the GitHub CLI you already use)</li>
              <li>Prove your key on GitHub: one public gist, so your company sees your login as proven</li>
              <li>Join your company: your GitHub org and team</li>
              <li>Sign in with 0G: the private AI is paid from your own 0G credits</li>
              <li>Read your logs. Nothing leaves your laptop for this step</li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/me/setup" className={buttonVariants({ size: "lg" })}>
                Start setup
              </Link>
              <ScanButton label="Just read my logs" variant="outline" />
            </div>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Just looking?{" "}
            <EnterDemo href="/me" className="text-primary hover:underline">
              Be an engineer at the demo company
            </EnterDemo>
            .
          </p>
        </>
      ) : (
        <div className="mt-8 rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">This part runs on your laptop</h2>
          <p className="mt-2 text-[15px] text-muted-foreground">
            Your logs are on your laptop, so is this app: clone the repo, then <code>npm install</code> and <code>npm run dev</code> in <code>web</code>, and
            open http://localhost:3000.
          </p>
          <div className="mt-4">
            <EnterDemo href="/me" className={buttonVariants({ size: "lg" })}>
              Try it as an engineer at the demo company
            </EnterDemo>
          </div>
        </div>
      )}
    </div>
  );
}
