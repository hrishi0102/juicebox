import Link from "next/link";
import { ReceiptPaper } from "@/components/receipt-paper";
import { Collapsible } from "@/components/collapsible";
import { PrTable } from "@/components/pr-table";
import { currentSource } from "@/lib/server/data";
import { loadOrg, personName } from "@/lib/server/org";
import { ARKIV_SCHEMA_NAME, exampleQuery } from "@/lib/receipts/arkiv";
import { signedNumbers, summaryFromReceipt, type SignedReceipt } from "@/lib/receipts/receipt";
import { pct, usd, weekRange } from "@/lib/format";
import type { PeriodSummary } from "@/lib/receipts/types";

export default async function Team({ searchParams }: { searchParams: Promise<{ week?: string; team?: string }> }) {
  const sp = await searchParams;
  const source = await currentSource();
  const org = await loadOrg(source);
  const you = org.members.find((m) => m.you)?.team;
  const teamId = sp.team && org.teams.some((t) => t.id === sp.team) ? sp.team : (you ?? org.teams[0]?.id ?? "");
  const cfg = org.teams.find((t) => t.id === teamId) ?? { id: teamId, name: teamId };
  const all = org.rows.filter((r) => r.team === teamId);
  const arkivForTeam = all.filter((r) => r.from === "arkiv").length;
  const demoForTeam = all.filter((r) => r.from === "demo file").length;

  const weeks = [...new Set(all.map((r) => r.message.period))].sort().reverse();
  const week = sp.week && weeks.includes(sp.week) ? sp.week : weeks[0];
  const inWeek = all.filter((r) => r.message.period === week && r.verified);
  const members = org.members.filter((m) => m.team === teamId);
  const nameOf = (addr: string) => personName(org, addr);
  const q = (w: string) => `/team?team=${teamId}&week=${w}`;

  // Totals use only signed fields, so a shared receipt cannot be edited without breaking its signature.
  const nums = inWeek.map((r) => signedNumbers(r));
  const spend = nums.reduce((a, n) => a + n.spendUsd, 0);
  const shipped = nums.reduce((a, n) => a + n.shippedTasks, 0);
  const kept = nums.reduce((a, n) => a + n.keptWork, 0);
  const waste = nums.reduce((a, n) => a + n.wasteUsd, 0);
  const survW = nums.filter((n) => n.survivalPct !== null);
  const survival = survW.length ? survW.reduce((a, n) => a + (n.survivalPct ?? 0) * Math.max(1, n.shippedTasks), 0) / survW.reduce((a, n) => a + Math.max(1, n.shippedTasks), 0) : null;
  const sharedBy = new Set(inWeek.map((r) => r.message.owner.toLowerCase()));
  const notSharing = members.filter((m) => !sharedBy.has(m.address.toLowerCase()));
  const first = inWeek[0];

  return (
    <div className="space-y-8">
      <div>
        <Link href="/org" className="text-sm text-muted-foreground hover:text-foreground">
          {org.name}
        </Link>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{cfg.name} team</h1>
        <p className="mt-2 max-w-[72ch] text-muted-foreground">What each person&apos;s AI spend bought this week, and the pull requests behind it. Prompts are never shared.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {org.teams.length > 1 &&
            org.teams.map((t) => (
              <Link
                key={t.id}
                href={`/team?team=${t.id}${week ? `&week=${week}` : ""}`}
                className={`rounded-lg border px-3 py-1 ${t.id === teamId ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-card"}`}
              >
                {t.name}
              </Link>
            ))}
          {weeks.length > 1 && <span className="mx-2 h-5 w-px bg-border" aria-hidden="true" />}
          {weeks.length > 1 &&
            weeks.map((w) => (
              <Link
                key={w}
                href={q(w)}
                className={`rounded-full border px-3 py-1 ${w === week ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-card"}`}
              >
                Week {w.split("-W")[1]}
              </Link>
            ))}
        </div>
      </div>

      {!week ? (
        <div className="max-w-2xl rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">No receipts shared yet</h2>
          <p className="mt-2 text-muted-foreground">When people on this team sign and share their weekly receipt, it shows up here with its pull requests.</p>
        </div>
      ) : (
        <>
          <section aria-labelledby="totals">
            <h2 id="totals" className="text-lg font-semibold">
              {usd(spend)} bought {shipped} shipped tasks{survival !== null ? `, ${Math.round(survival)}% still alive` : ""}
            </h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Stat k="AI spend" v={usd(spend)} note={first ? weekRange(new Date(Number(first.message.periodStart) * 1000).toISOString(), new Date(Number(first.message.periodEnd) * 1000).toISOString()) : ""} />
              <Stat k="Shipped tasks" v={String(shipped)} note={`${kept.toFixed(1)} tasks of kept work`} />
              <Stat k="Still alive" v={pct(survival)} note="of shipped code" />
              <Stat k="Waste" v={pct(spend ? (waste / spend) * 100 : 0)} note={`${usd(waste)} on loops and dead ends`} />
            </div>
          </section>

          <section aria-labelledby="people" className="space-y-3">
            <h2 id="people" className="text-xl font-semibold tracking-tight">
              People
            </h2>
            {inWeek.map((r) => {
              const merged = r.evidence.filter((e) => (e.state === "merged" || e.state === "direct") && !e.reverted);
              return (
                <Collapsible key={r.digest} title={nameOf(r.message.owner)} hint={`${r.headline}. ${r.evidence.length} PR${r.evidence.length === 1 ? "" : "s"}`}>
                  <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                    <div className="min-w-0">
                      {r.evidence.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No PR list in this receipt.</p>
                      ) : (
                        <PrTable evidence={r.evidence} />
                      )}
                      <p className="mt-3 text-sm text-muted-foreground">
                        {merged.length} merged. Every row is part of the signed receipt, so it cannot be edited.{" "}
                        {r.from === "arkiv" && r.arkivKey ? (
                          <Link className="text-primary hover:underline" href={`/r/${r.arkivKey}`}>
                            Open on Arkiv
                          </Link>
                        ) : null}
                      </p>
                    </div>
                    <ReceiptPaper
                      compact
                      weekId={r.message.period}
                      start={new Date(Number(r.message.periodStart) * 1000).toISOString()}
                      end={new Date(Number(r.message.periodEnd) * 1000).toISOString()}
                      summary={toSummary(r)}
                      owner={r.message.owner}
                      judgeLine={r.message.judge.startsWith("0g") ? "0G TEE" : r.message.judge}
                      digest={r.digest}
                      signed={r.verified}
                      sharedLevel={r.share?.level}
                    />
                  </div>
                </Collapsible>
              );
            })}
            {notSharing.map((m) => (
              <div key={m.address} className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{m.name}</span>: no receipt shared this week.
              </div>
            ))}
          </section>
        </>
      )}

      <Collapsible title="Where this data comes from" hint="Signed receipts on Arkiv">
        <p className="text-sm text-muted-foreground">
          Shared receipts live on Arkiv (testnet Rabdi) as entities of schema <code>{ARKIV_SCHEMA_NAME}</code>, readable by anyone, so this page does
          not depend on our server. Every receipt is checked against its owner&apos;s signature before it counts. {arkivForTeam} receipt
          {arkivForTeam === 1 ? "" : "s"} for this team found on Arkiv right now{demoForTeam ? `, plus ${demoForTeam} signed demo receipts from the repo` : ""}.
          {org.arkivError && ` Arkiv could not be reached: ${org.arkivError.slice(0, 120)}.`}
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-background p-3 text-xs">{exampleQuery(cfg.id)}</pre>
      </Collapsible>
    </div>
  );
}

function Stat({ k, v, note }: { k: string; v: string; note?: string }) {
  return (
    <div className="border-l-2 border-primary/60 pl-4">
      <div className="text-sm text-muted-foreground">{k}</div>
      <div className="mt-1 text-3xl font-semibold tracking-tight">{v}</div>
      {note && <div className="mt-1 text-sm text-muted-foreground">{note}</div>}
    </div>
  );
}

function toSummary(r: SignedReceipt): PeriodSummary {
  return summaryFromReceipt(r);
}
