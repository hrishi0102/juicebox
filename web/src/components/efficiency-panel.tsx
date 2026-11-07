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

/**
 * How efficiently AI time turned into merged work: timeline, PRs, waste, where the money went.
 * `bare` drops the panel and its heading, for use inside a disclosure.
 */
export function EfficiencyPanel({ e, title = "How the week went", note, bare }: { e: EfficiencyView; title?: string; note?: string; bare?: boolean }) {
  const total = e.spend.shipped + e.spend.learning + e.spend.inProgress + e.spend.wasted;
  const cycle = e.stages.ideaToMerge;
  const body = (
    <div className="space-y-6">
      <div>
        <p className={bare ? "text-[var(--mute)]" : "mb-4 text-sm text-[var(--mute)]"}>{bare ? "Typical time between steps, from log and GitHub timestamps. No AI involved." : "Typical time between steps"}</p>
        {bare ? (
          <ol className="stages4">
            {FLOW.map((st, i) => (
              <li key={st} className="stage4">
                <div className="l">
                  {i + 1}. {STAGE_LABEL[st]}
                </div>
                <div className="v">{formatMinutes(e.stages[st].medianMin)}</div>
                <div className="n">{e.stages[st].n ? `over ${e.stages[st].n}` : "no data yet"}</div>
              </li>
            ))}
          </ol>
        ) : (
          <ol className="tl-stages">
            {FLOW.map((st) => (
              <li key={st} className="tl-stage">
                <span className="k">{STAGE_LABEL[st]}</span>
                <span className="v num">{formatMinutes(e.stages[st].medianMin)}</span>
                <span className="n">{e.stages[st].n ? `over ${e.stages[st].n}` : "no data yet"}</span>
              </li>
            ))}
          </ol>
        )}
        <p className={bare ? "mt-3" : "flow-say"}>
          {cycle.n ? (
            <>
              From idea to merged: <strong>{formatMinutes(cycle.medianMin)}</strong> typical, over {cycle.n}.{" "}
            </>
          ) : (
            ""
          )}
          Time with the AI before writing code: {formatMinutes(e.brainstormMinutes)}.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">Pull requests</h3>
          <p className="mt-1 text-[15px]">
            <span className="font-semibold">{e.prs.merged}</span> merged of {e.prs.opened} opened
            {e.prs.open ? `, ${e.prs.open} still open` : ""}
            {e.prs.closed ? `, ${e.prs.closed} closed` : ""}
            {e.prs.reverted ? `, ${e.prs.reverted} reverted` : ""}.
          </p>
          {e.costPerMergedPr !== null && <p className="text-sm text-[var(--mute)]">AI cost per shipped change (merged PR or push to main): {usd(e.costPerMergedPr)}</p>}

          {total > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold">Where the money went</h3>
              <div className="catbar mt-2.5" role="img" aria-label="Spend: shipped, learning, in progress, wasted">
                {SPEND_PARTS.filter((p) => e.spend[p.k] > 0).map((p) => (
                  <span key={p.k} style={{ width: `${(e.spend[p.k] / total) * 100}%`, background: `var(${p.varName})` }} title={`${p.label}: ${usd(e.spend[p.k])}`} />
                ))}
              </div>
              <ul className="legend num">
                {SPEND_PARTS.map((p) => (
                  <li key={p.k}>
                    <span className="sq" style={{ background: `var(${p.varName})` }} aria-hidden="true" />
                    {p.label} {usd(e.spend[p.k])}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold">Waste, by reason</h3>
          <ul className="mt-1">
            {WASTE.map((k) => {
              const w = e.waste[k];
              return (
                <li key={k} className={`flex items-baseline gap-3 border-t border-[var(--line)] py-2 text-[15px] first:border-t-0 ${w.count ? "" : "text-[var(--mute)]"}`} title={WASTE_HINT[k]}>
                  <span className="min-w-0 flex-1">{WASTE_LABEL[k]}</span>
                  <span className="num w-10 text-right">{w.count}</span>
                  <span className="num w-20 text-right font-medium">{w.usd ? usd(w.usd) : ""}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      {note && <p className="text-sm text-[var(--mute)]">{note}</p>}
    </div>
  );
  if (bare) return body;
  return (
    <section aria-labelledby="eff">
      <div className="sec-head">
        <h2 id="eff" className="disp h-card">
          {title}
        </h2>
        <p className="text-sm text-[var(--mute)]">From log and GitHub timestamps. No AI involved.</p>
      </div>
      <div className="card p-7 max-[760px]:p-5">{body}</div>
    </section>
  );
}
