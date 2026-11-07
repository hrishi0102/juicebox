import Link from "next/link";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { ReceiptPaper, storyCalls, writtenBy } from "@/components/receipt-paper";
import { ScanButton } from "@/components/pipeline-controls";
import { ReviewWeekButton, WriteWeekButton } from "@/components/ai-actions";
import { WeekList } from "@/components/week-list";
import { EfficiencyPanel } from "@/components/efficiency-panel";
import { CategoryBar, CategoryLegend } from "@/components/category-badge";
import { Difficulty } from "@/components/label-badge";
import { Collapsible } from "@/components/collapsible";
import { FlowSteps } from "@/components/flow-steps";
import { ProofLinks, type ProofGroup } from "@/components/proof-links";
import { EnterDemo } from "@/components/demo";
import { arkivEntityUrl, arkivTxUrl, swarmProofPath, ZG_ACTIVITY, zgProofPath } from "@/lib/proof-urls";
import { readJson } from "@/lib/receipts/store";
import type { WeeklyReview } from "@/lib/receipts/review";
import { currentSource, getDataset, getDemoOrg, onLaptop, weekView, weeksWithData } from "@/lib/server/data";
import { employeeTarget, payerText, weekReceipt } from "@/lib/server/employee";
import { IdentityLine } from "@/components/identity-line";
import { loadSavedReceipt } from "@/lib/server/receipts-store";
import { githubLogin } from "@/lib/receipts/identity";
import { median } from "@/lib/receipts/heuristics";
import { receiptStatus, weekFlow } from "@/lib/receipts/flow";
import { CATEGORY_COPY, dayTime, plural, usd, weekRange } from "@/lib/format";
import { formatMinutes } from "@/lib/receipts/efficiency";
import { CATEGORIES, TOOL_NAMES, type AiTool, type PeriodSummary, type Task } from "@/lib/receipts/types";
import { providersFor } from "@/lib/server/zerog-providers";

export const metadata = { title: "My week · Juicebox" };

// The employee's week. One question, one answer, and one next step: write it, sign it, send it.
// The receipt itself, and the Sign and Send buttons, are on the next page.
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
  // The 0G provider(s) recorded for this week's sessions, else the ones serving the model (the demo).
  const recorded = [...new Set(wv.judgements.filter((j) => j.judge.engine === "0g-tee" && j.judge.provider).map((j) => j.judge.provider!))];
  const providers = recorded.length ? recorded : aiStory ? await providersFor(s.story.model) : [];
  const proofs = weekProofs(providers, s.story.payer, rc.sent);

  const week = wv.id.split("-W")[1];
  const writeButton = (flow.next === "write" || aiStory) && (
    <WriteWeekButton week={wv.id} variant={flow.next === "write" ? "default" : "outline"} label={!aiStory ? "Write my week" : s.story.stale ? "Update with new sessions" : "Write it again"} />
  );
  const sendLink = flow.next !== "done" && (
    <Link href={sendHref} className={`btn ${flow.next === "write" ? "btn-secondary" : flow.next === "sign" ? "btn-sign" : "btn-primary"}`}>
      {flow.next === "send" ? `Send to ${target.orgName}` : "Sign it"}
    </Link>
  );

  return (
    <div className="mw">
      <div className="mw-id">
        <IdentityLine login={login} target={target} />
      </div>
      <div className="mw-grid">
        <div className="min-w-0">
          <div className="weekrow">
            <div className="weeksw">
              <WeekLink week={older?.id} label="Older week" dir="prev" />
              <span className="weeklabel">
                Week {week} <span>{weekRange(wv.start, wv.end)}</span>
              </span>
              <WeekLink week={newer?.id} label="Newer week" dir="next" />
            </div>
            <FlowSteps
              label={`Week ${week} steps`}
              steps={[
                { label: "Write", state: flow.write },
                { label: "Sign", state: flow.sign, href: sendHref },
                { label: "Send", state: flow.send, href: sendHref },
              ]}
            />
          </div>

          <h1 className="disp mw-q">What did you get done this week?</h1>
          <p className={`mw-one ${aiStory ? "" : "is-rules"}`}>{s.oneLiner}</p>
          <div className="mw-stats num">
            <p>
              {s.oneLiner !== s.countLine && `${s.countLine} `}
              {plural(s.sessions, "AI session")}, {usd(s.spendUsd)}
              {toolText(s)}.
            </p>
            {source === "local" && <ScanButton label="Refresh from my logs" variant="outline" />}
          </div>

          <section className="mw-next" aria-label="Next step">
            {flow.next === "done" && (
              <div className="done-line mb-5">
                <span className="ok-dot" aria-hidden="true">
                  <Check className="size-4" strokeWidth={2.6} />
                </span>
                <div>
                  <p className="done-t">Sent to {target.orgName}.</p>
                  <div className="done-links">
                    <Link href={sendHref} className="plink">
                      See what they got
                    </Link>
                  </div>
                </div>
              </div>
            )}
            <div className="mw-next-row">
              {flow.next === "write" ? (
                <>
                  {writeButton}
                  {sendLink}
                </>
              ) : (
                <>
                  {sendLink}
                  {writeButton}
                </>
              )}
            </div>
            <p className="help">
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

          <ProofLinks className="mw-sec" groups={proofs} />

          <section className="mw-sec" aria-labelledby="got">
            <div className="mw-sec-h">
              <h2 id="got" className="h-sub">
                What you got
              </h2>
              <span className="mw-count num">
                {plural(s.items.length, "item")}, {usd(s.spendUsd)}
              </span>
            </div>
            <WeekList items={s.items} timelines={s.efficiency?.items} />
            {s.spendUsd > 0 && (
              <div className="mt-[18px]">
                <CategoryBar spend={s.categorySpend} total={s.spendUsd} />
                <ul className="legend num">
                  {CATEGORIES.filter((c) => s.categorySpend[c] > 0).map((c) => (
                    <li key={c}>
                      <span className="sq" style={{ background: `var(${CATEGORY_COPY[c].varName})` }} aria-hidden="true" />
                      {c} {usd(s.categorySpend[c])}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <div className="disc mw-sec">
            <Collapsible grouped title="Pull requests" hint={prHint(s.tasks)}>
              <PrList tasks={s.tasks} />
            </Collapsible>

            <Collapsible grouped title="How this was written" hint={aiStory ? `Private AI on 0G, ${storyCalls(s.story)}` : "Simple rules"}>
              <HowWritten s={s} firstSession={wv.sessions[0]?.id} />
            </Collapsible>

            <Collapsible grouped title="Where money leaked" hint={review ? "Private review ready" : s.wasteUsd > 0 ? `${usd(s.wasteUsd)} went in circles` : plural(s.tips.length, "tip")}>
              {review && (
                <div className="panel-soft mb-4 p-4">
                  <p>{review.summary}</p>
                  <ul className="mt-3 list-disc space-y-1.5 pl-5">
                    {review.tips.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[13px] text-[var(--mute)]">
                    Private review by {review.judge.model} on 0G ({review.judge.trustMode ?? "private"} mode{review.judge.verified ? ", TEE verified" : ""}
                    {review.judge.payer ? `, ${payerText(review.judge.payer)}` : ""}). Request <span className="req">{review.judge.requestId ?? "n/a"}</span>.
                  </p>
                </div>
              )}
              <ul className="max-w-[68ch] list-disc space-y-2 pl-5">
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

            <Collapsible grouped title="Cost by difficulty" hint={teamBuckets ? "Compared with your team" : "Small, medium and hard work kept apart"}>
              <p className="text-[var(--mute)]">Work is only compared with work of the same difficulty, never across people.</p>
              <table className="diff">
                <thead>
                  <tr>
                    <th scope="col">Difficulty</th>
                    <th scope="col">PRs</th>
                    <th scope="col">You, per shipped change</th>
                    {teamBuckets && <th scope="col">Team median</th>}
                  </tr>
                </thead>
                <tbody>
                  {s.buckets
                    .filter((b) => b.tasks > 0)
                    .map((b) => {
                      const team = teamBuckets?.[b.difficulty];
                      return (
                        <tr key={b.difficulty}>
                          <td>
                            <Difficulty value={b.difficulty} />
                          </td>
                          <td>{b.tasks}</td>
                          <td className="font-medium">{b.costPerKept === null ? "nothing merged" : usd(b.costPerKept)}</td>
                          {teamBuckets && <td className="text-[var(--mute)]">{team ? usd(team) : "n/a"}</td>}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </Collapsible>

            {s.efficiency && (
              <Collapsible
                grouped
                title="How the week went"
                hint={s.efficiency.stages.ideaToMerge.n ? `Idea to merged in ${formatMinutes(s.efficiency.stages.ideaToMerge.medianMin)}` : "From log and GitHub timestamps"}
              >
                <EfficiencyPanel e={s.efficiency} bare />
              </Collapsible>
            )}

            <Collapsible grouped title="What the categories mean">
              <CategoryLegend />
            </Collapsible>
          </div>
        </div>

        <aside className="mw-side" aria-label="Your receipt">
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
            signedAt={rc.saved?.signedAt ? dayTime(rc.saved.signedAt) : undefined}
            stub={rc.sent?.arkivKey ? { to: target.from === "default" ? target.orgName : `${target.teamName} at ${target.orgName}`, at: rc.sent.publishedAt ? dayTime(rc.sent.publishedAt) : undefined, record: rc.sent.arkivKey } : undefined}
            animate
          />
          <section aria-labelledby="past" className={rc.sent?.arkivKey ? "mt-3" : ""}>
            <h2 id="past" className="hist-h">
              Your receipts
            </h2>
            <ul className="hist">
              {weeks.slice(0, 8).map((w) => {
                const st = w.id === wv.id ? (flow.next === "done" ? "sent" : rc.signed ? "signed" : "not signed") : receiptStatus(loadSavedReceipt(source, w.id));
                return (
                  <li key={w.id}>
                    <Link href={`/me?week=${w.id}`} className={w.id === wv.id ? "is-cur" : ""} aria-current={w.id === wv.id ? "page" : undefined}>
                      <span>
                        Week {w.id.split("-W")[1]} <span className="d">{weekRange(w.start, w.end)}</span>
                      </span>
                      <span className={st === "sent" ? "st-sent" : st === "signed" ? "st-signed" : "st-wait"}>{st === "sent" ? `Sent` : st === "signed" ? "Signed, not sent" : "Not sent"}</span>
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

/**
 * "Check it yourself" for one week: the 0G provider that wrote it and the account that paid, and,
 * once sent, the Arkiv record and its encrypted copy on Swarm.
 */
function weekProofs(providers: string[], payer: string | undefined, sent: { arkivKey?: string; arkivTx?: string; swarm?: string } | null): ProofGroup[] {
  const wallet = payer && payer !== "app key" ? payer : undefined;
  const groups: ProofGroup[] = [];
  if (providers.length || wallet)
    groups.push({
      service: "0G",
      what: `The private AI that wrote this week ran in a hardware enclave${wallet ? ", paid from your 0G account" : ""}`,
      links: [
        ...providers.slice(0, 2).map((p, i) => ({ label: providers.length > 1 ? `0G's TEE check of provider ${i + 1}` : "0G's TEE check of the provider", href: zgProofPath(p) })),
        ...(wallet ? [{ label: "Your calls on pc.0g.ai", href: ZG_ACTIVITY }] : []),
      ],
    });
  if (sent?.arkivKey) {
    groups.push({
      service: "Arkiv",
      what: "The receipt you sent: read-only, owned by you",
      links: [{ label: "The record on the Arkiv explorer", href: arkivEntityUrl(sent.arkivKey) }, ...(sent.arkivTx ? [{ label: "The transaction", href: arkivTxUrl(sent.arkivTx) }] : [])],
    });
    if (sent.swarm) groups.push({ service: "Swarm", what: "Your full week, encrypted for the company", links: [{ label: "Fetch it from Swarm now", href: swarmProofPath(sent.swarm, sent.arkivKey) }] });
  }
  return groups;
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
  if (!tasks.length) return <p className="text-[var(--mute)]">No pull requests or commits linked to this week&apos;s sessions.</p>;
  return (
    <>
      <ul className="prs-list">
        {tasks.map((t) => (
          <li key={t.changeKey}>
            <a href={t.url} target="_blank" rel="noreferrer" className="plink">
              {t.title}
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </a>
            <span className="it-cost">{usd(t.costUsd, 2)}</span>
            <span className="k">
              {t.changeKey}, {t.reverted ? "reverted" : t.state === "direct" ? "pushed to main" : t.state}
            </span>
          </li>
        ))}
      </ul>
      <p className="help">Each one opens on github.com.</p>
    </>
  );
}

function HowWritten({ s, firstSession }: { s: PeriodSummary; firstSession?: string }) {
  if (s.story.engine === "rules")
    return (
      <div className="max-w-[70ch] space-y-2.5">
        <p>
          This list comes from simple rules: one item per pull request, named after it, and the biggest other sessions on their own. Categories come
          from signals in the logs (edits, web searches, failing commands).
        </p>
        <p className="text-[var(--mute)]">
          The private AI does better: it reads what you asked and what the AI answered on 0G, where the model runs inside a hardware enclave (TEE),
          and writes one line per session. A second call merges the lines into this list. It is paid from your own 0G account with Sign in with 0G.
        </p>
      </div>
    );
  return (
    <div className="max-w-[70ch] space-y-3">
      <p>
        Written by <span className="font-medium">{s.story.model}</span> on the 0G Private Computer, in private mode: only providers running the model
        inside a TEE could answer{s.story.verified ? ", and every answer's TEE signature was checked" : ""}.
        {s.story.payer ? ` It was ${payerText(s.story.payer)}.` : ""}
      </p>
      <p className="text-[var(--mute)]">The requests reach 0G over HTTPS through its router and are not end-to-end sealed today, so the router could read them in transit.</p>
      <ol className="list-decimal space-y-1 pl-5 text-[var(--mute)]">
        <li>Each session went in as a private digest: what you asked, what the AI said at the end, tool counts, the GitHub outcome and the cost.</li>
        <li>The AI answered with a category and a short title. Only those are kept, never the prompts.</li>
        <li>One more call saw only the titles and merged them into this list and its one sentence.</li>
      </ol>
      {s.story.requestIds.length > 0 && (
        <div className="text-sm">
          <div className="text-[var(--mute)]">0G request ids ({s.story.requestIds.length}):</div>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {s.story.requestIds.slice(0, 5).map((id) => (
              <li key={id} className="req">
                {id}
              </li>
            ))}
            {s.story.requestIds.length > 5 && <li className="self-center text-[var(--mute)]">and {s.story.requestIds.length - 5} more</li>}
          </ul>
        </div>
      )}
      {firstSession && (
        <Link href={`/me/sessions/${firstSession}`} className="quiet inline-block">
          See exactly what was sent for one session
        </Link>
      )}
    </div>
  );
}

function WeekLink({ week, label, dir }: { week?: string; label: string; dir: "prev" | "next" }) {
  const Glyph = dir === "prev" ? ChevronLeft : ChevronRight;
  if (!week)
    return (
      <span className="icon-btn off" aria-hidden="true">
        <Glyph className="size-[18px]" />
      </span>
    );
  return (
    <Link href={`/me?week=${week}`} aria-label={label} className="icon-btn">
      <Glyph className="size-[18px]" aria-hidden="true" />
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
    <div className="mx-auto max-w-2xl py-14">
      <p className="text-sm font-semibold text-[var(--mute)]">For employees</p>
      <h1 className="disp h-page mt-2">Your weekly receipt</h1>
      <p className="lede mt-5">
        Juicebox reads your Claude Code and Codex sessions on this laptop and writes down what they got done: what you built, fixed, figured out and
        researched, and what it cost. You check it, sign it with a key that stays here, and send it to your company. Your prompts never leave the
        laptop.
      </p>
      {laptop ? (
        <>
          <div className="card card-pad mt-8">
            <h2 className="h-small">Set up once</h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[15px] text-[var(--ink-2)]">
              <li>Connect GitHub (the GitHub CLI you already use)</li>
              <li>Join your company: your GitHub org and team</li>
              <li>Sign in with 0G: the private AI is paid from your own 0G credits</li>
              <li>Read your logs. Nothing leaves your laptop for this step</li>
            </ol>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/me/setup" className="btn btn-primary">
                Start setup
              </Link>
              <ScanButton label="Just read my logs" variant="outline" />
            </div>
          </div>
          <p className="mt-6 text-sm text-[var(--mute)]">
            Just looking?{" "}
            <EnterDemo href="/me" className="quiet">
              Be an engineer at the demo company
            </EnterDemo>
            .
          </p>
        </>
      ) : (
        <div className="card card-pad mt-8">
          <h2 className="h-small">This part runs on your laptop</h2>
          <p className="mt-2 text-[15px] text-[var(--ink-2)]">
            Your logs are on your laptop, so is this app: clone the repo, then <code>npm install</code> and <code>npm run dev</code> in <code>web</code>, and
            open http://localhost:3000.
          </p>
          <div className="mt-5">
            <EnterDemo href="/me" className="btn btn-primary">
              Try it as an engineer at the demo company
            </EnterDemo>
          </div>
        </div>
      )}
    </div>
  );
}
