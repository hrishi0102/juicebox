import Link from "next/link";
import { ReceiptPaper } from "@/components/receipt-paper";
import { currentSource, getDemoTeam, getLocalTeamConfig } from "@/lib/server/data";
import { ARKIV_SCHEMA_NAME, exampleQuery, fetchTeamReceipts, type TeamReceipt } from "@/lib/receipts/arkiv";
import { signedNumbers, verifyReceipt, type SignedReceipt } from "@/lib/receipts/receipt";
import { pct, shortAddr, usd, weekRange } from "@/lib/format";
import type { PeriodSummary } from "@/lib/receipts/types";

type Row = SignedReceipt & { from: "arkiv" | "demo file"; arkivKey?: string; verified: boolean };

export default async function Team({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const sp = await searchParams;
  const source = await currentSource();
  const demo = source === "demo" ? getDemoTeam() : undefined;
  const cfg = demo ? { id: demo.id, name: demo.name } : getLocalTeamConfig();

  let arkiv: TeamReceipt[] = [];
  let arkivError: string | undefined;
  try {
    arkiv = await fetchTeamReceipts(cfg.id);
  } catch (e) {
    arkivError = e instanceof Error ? e.message : String(e);
  }

  // Merge receipts read live from Arkiv with the demo file (same receipt = same digest).
  const rows = new Map<string, Row>();
  for (const r of demo?.receipts ?? []) rows.set(r.digest, { ...r, from: "demo file", verified: (await verifyReceipt(r)).ok });
  for (const r of arkiv) rows.set(r.digest, { ...r, from: "arkiv", arkivKey: r.arkiv.key, verified: r.verified });
  const all = [...rows.values()];

  const weeks = [...new Set(all.map((r) => r.message.period))].sort().reverse();
  const week = sp.week && weeks.includes(sp.week) ? sp.week : weeks[0];
  const inWeek = all.filter((r) => r.message.period === week && r.verified);
  const members = demo?.members ?? [];
  const nameOf = (addr: string) => members.find((m) => m.address.toLowerCase() === addr.toLowerCase())?.name ?? shortAddr(addr);

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
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{cfg.name}</h1>
        <p className="mt-2 max-w-[72ch] text-muted-foreground">
          What a manager sees: team totals and the receipts people chose to share. No prompts, no session titles, no per-person ranking. Every receipt
          below is checked against its owner&apos;s signature before it counts.
        </p>
        {weeks.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {weeks.map((w) => (
              <Link
                key={w}
                href={`/team?week=${w}`}
                className={`rounded-full border px-3 py-1 ${w === week ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-card"}`}
              >
                Week {w.split("-W")[1]}
              </Link>
            ))}
          </div>
        )}
      </div>

      {!week ? (
        <div className="max-w-2xl rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">No shared receipts yet</h2>
          <p className="mt-2 text-muted-foreground">
            When someone signs a weekly receipt and shares it, it is written to Arkiv under team &quot;{cfg.id}&quot; and shows up here.
          </p>
        </div>
      ) : (
        <>
          <section aria-labelledby="totals" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <h2 id="totals" className="sr-only">
              Team totals
            </h2>
            <Stat k="Team spend" v={usd(spend)} note={first ? weekRange(new Date(Number(first.message.periodStart) * 1000).toISOString(), new Date(Number(first.message.periodEnd) * 1000).toISOString()) : ""} />
            <Stat k="Shipped tasks" v={String(shipped)} note={`${kept.toFixed(1)} tasks of kept work`} />
            <Stat k="Still alive" v={pct(survival)} note="of shipped code, weighted by tasks" />
            <Stat k="Waste" v={usd(waste)} note={spend ? `${pct((waste / spend) * 100)} of spend` : ""} />
          </section>

          <section aria-labelledby="people">
            <h2 id="people" className="text-xl font-semibold tracking-tight">
              Who shared
            </h2>
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
              {inWeek.map((r) => (
                <li key={r.digest} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3">
                  <div className="w-40 font-medium">{nameOf(r.message.owner)}</div>
                  <div className="min-w-0 flex-1">{r.headline}</div>
                  <div className="text-sm text-muted-foreground">{r.share?.level === "full" ? "with evidence" : "totals only"}</div>
                  <div className="text-sm text-muted-foreground">
                    {r.from === "arkiv" && r.arkivKey ? (
                      <Link className="hover:underline" href={`/r/${r.arkivKey}`}>
                        on Arkiv
                      </Link>
                    ) : (
                      "demo file"
                    )}
                  </div>
                </li>
              ))}
              {notSharing.map((m) => (
                <li key={m.address} className="flex flex-wrap items-center gap-x-6 px-4 py-3 text-muted-foreground">
                  <div className="w-40 font-medium">{m.name}</div>
                  <div className="flex-1">Chose not to share this week. Their spend is not in the totals.</div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="receipts">
            <h2 id="receipts" className="text-xl font-semibold tracking-tight">
              Shared receipts
            </h2>
            <div className="mt-4 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {inWeek.map((r) => (
                <div key={r.digest} className="space-y-2">
                  <div className="text-sm font-medium">{nameOf(r.message.owner)}</div>
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
                  {r.share?.level === "full" && r.evidence.length > 0 && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{r.evidence.length} tasks as evidence</summary>
                      <ul className="mt-2 space-y-1">
                        {r.evidence.map((e) => (
                          <li key={e.leaf} className="flex gap-2">
                            <span className="min-w-0 flex-1 truncate">{e.changeKey}</span>
                            <span className="text-muted-foreground">{e.reverted ? "reverted" : e.survivalBps === 65535 ? e.state : `${Math.round(e.survivalBps / 100)}% alive`}</span>
                            <span>{usd(e.costCents / 100)}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="max-w-3xl rounded-lg border border-border bg-card p-5 text-sm">
        <h2 className="font-semibold">Where this comes from</h2>
        <p className="mt-2 text-muted-foreground">
          Shared receipts live on Arkiv (testnet Rabdi, chain 7794095) as entities of schema <code>{ARKIV_SCHEMA_NAME}</code>, readable by anyone, so
          this page does not depend on our server. {arkiv.length} receipt{arkiv.length === 1 ? "" : "s"} for team &quot;{cfg.id}&quot; found on Arkiv
          right now{demo ? `, plus ${demo.receipts.length} signed demo receipts from the repo` : ""}.
          {arkivError && ` Arkiv could not be reached: ${arkivError.slice(0, 120)}.`}
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-background p-3 text-xs">{exampleQuery(cfg.id)}</pre>
      </section>
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
  const n = signedNumbers(r);
  return {
    periodStart: new Date(Number(r.message.periodStart) * 1000).toISOString(),
    periodEnd: new Date(Number(r.message.periodEnd) * 1000).toISOString(),
    sessions: n.sessions,
    spendUsd: n.spendUsd,
    shippedTasks: n.shippedTasks,
    survivalPct: n.survivalPct,
    keptWork: n.keptWork,
    keptWorkPer100Usd: n.spendUsd > 0 ? (n.keptWork / n.spendUsd) * 100 : null,
    labelCounts: n.labelCounts,
    labelSpend: n.labelSpend,
    wasteUsd: n.wasteUsd,
    wastePct: n.wastePct,
    buckets: r.summary.buckets,
    tasks: [],
    tips: [],
  };
}
