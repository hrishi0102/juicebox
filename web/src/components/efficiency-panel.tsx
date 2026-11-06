import { usd } from "@/lib/format";
import { formatMinutes, STAGE_LABEL, WASTE, WASTE_LABEL, type Stage } from "@/lib/receipts/efficiency";
import type { EfficiencyView } from "@/lib/receipts/receipt";

const FLOW: Stage[] = ["ideaToCode", "codeToCommit", "commitToPr", "prToMerge"];

const SPEND_PARTS = [
  { k: "shipped", label: "Shipped", varName: "--c-built" },
  { k: "learning", label: "Learning", varName: "--c-figured" },
  { k: "inProgress", label: "In progress", varName: "--c-planned" },
  { k: "wasted", label: "Wasted", varName: "--c-wasted" },
] as const;

const WASTE_HINT: Record<(typeof WASTE)[number], string> = {
  abandonedPlans: "The AI made a plan and nothing was built from it within a day",
  leftHanging: "The AI asked a question or offered more, and nobody came back to it",
  loops: "Repeated failing steps",
  neverShipped: "Code was written but never landed in a PR or commit",
  stoppedAnswers: "Answers stopped midway (the person pressed stop)",
};

/** How efficiently AI time turned into merged work: timeline, PRs, waste, where the money went. */
export function EfficiencyPanel({ e, title = "How the week went", note }: { e: EfficiencyView; title?: string; note?: string }) {
  const total = e.spend.shipped + e.spend.learning + e.spend.inProgress + e.spend.wasted;
  const cycle = e.stages.ideaToMerge;
  return (
    <section aria-labelledby="eff" className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="eff" className="text-xl font-semibold tracking-tight">
          {title}
        </h2>
        <span className="text-sm text-muted-foreground">From log and GitHub timestamps. No AI involved.</span>
      </div>

      <div>
        <div className="text-sm text-muted-foreground">Typical time between steps</div>
        <ol className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FLOW.map((st, i) => (
            <li key={st} className="relative rounded-lg border border-border bg-background px-3 py-2">
              <div className="text-xs text-muted-foreground">
                {i + 1}. {STAGE_LABEL[st]}
              </div>
              <div className="text-lg font-semibold">{formatMinutes(e.stages[st].medianMin)}</div>
              <div className="text-xs text-muted-foreground">{e.stages[st].n ? `over ${e.stages[st].n}` : "no data yet"}</div>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-sm text-muted-foreground">
          {cycle.n ? `From idea to merged: ${formatMinutes(cycle.medianMin)} typical, over ${cycle.n}. ` : ""}
          Time with the AI before writing code: {formatMinutes(e.brainstormMinutes)}.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="text-sm text-muted-foreground">Pull requests</div>
          <p className="mt-1 text-[15px]">
            <span className="font-semibold">{e.prs.merged}</span> merged of {e.prs.opened} opened
            {e.prs.open ? `, ${e.prs.open} still open` : ""}
            {e.prs.closed ? `, ${e.prs.closed} closed` : ""}
            {e.prs.reverted ? `, ${e.prs.reverted} reverted` : ""}.
          </p>
          {e.costPerMergedPr !== null && <p className="text-sm text-muted-foreground">AI cost per merged PR: {usd(e.costPerMergedPr)}</p>}

          {total > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-sm text-muted-foreground">Where the money went</div>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Spend: shipped, learning, in progress, wasted">
                {SPEND_PARTS.filter((p) => e.spend[p.k] > 0).map((p) => (
                  <div key={p.k} style={{ width: `${(e.spend[p.k] / total) * 100}%`, background: `var(${p.varName})` }} title={`${p.label}: ${usd(e.spend[p.k])}`} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {SPEND_PARTS.map((p) => (
                  <span key={p.k} className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: `var(${p.varName})` }} aria-hidden="true" />
                    {p.label} {usd(e.spend[p.k])}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="text-sm text-muted-foreground">Waste, by reason</div>
          <ul className="mt-1 divide-y divide-border">
            {WASTE.map((k) => {
              const w = e.waste[k];
              return (
                <li key={k} className={`flex items-baseline gap-3 py-1.5 text-[15px] ${w.count ? "" : "text-muted-foreground"}`} title={WASTE_HINT[k]}>
                  <span className="min-w-0 flex-1">{WASTE_LABEL[k]}</span>
                  <span className="w-10 text-right">{w.count}</span>
                  <span className="w-20 text-right font-medium">{w.usd ? usd(w.usd) : ""}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </section>
  );
}
