import Link from "next/link";
import { currentSource } from "@/lib/server/data";
import { companyKnown, loadOrg, orgWeek } from "@/lib/server/org";
import { Collapsible } from "@/components/collapsible";
import { CategoryBar } from "@/components/category-badge";
import { CompanyDoor, MemberNote, NothingShared, WeekPills } from "@/components/company-door";
import { ARKIV_SCHEMA_NAME } from "@/lib/receipts/arkiv";
import { aggregate, aggregateEfficiency, countsLine } from "@/lib/receipts/aggregate";
import { EfficiencyPanel } from "@/components/efficiency-panel";
import { Barcode } from "@/components/front-door";
import { CATEGORY_COPY, pct, plural, usd } from "@/lib/format";
import { CATEGORIES, TOOL_NAMES, type AiTool } from "@/lib/receipts/types";

export const metadata = { title: "Company · Receipts" };

const TOOL_COLOR: Record<string, string> = { "claude-code": "var(--ink)", codex: "#8C93A0" };
const toolName = (t: string) => TOOL_NAMES[t as AiTool] ?? t;

// The company overview: what everyone's AI spend got done this week, team by team. People are
// on the People tab, every pull request on its own tab. Teams are compared; people are not ranked.
export default async function CompanyOverview({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const sp = await searchParams;
  const source = await currentSource();
  if (!(await companyKnown(source))) return <CompanyDoor />;
  const org = await loadOrg(source);
  const { verified, weeks, week, inWeek } = orgWeek(org, sp.week);
  const name = org.name.replace(/ \(demo company\)$/, "");
  const total = aggregate(inWeek);
  const eff = aggregateEfficiency(inWeek);
  const toolTotal = Object.values(total.tools).reduce((a, b) => a + b, 0);
  const toolHint = Object.entries(total.tools)
    .sort((a, b) => b[1] - a[1])
    .map(([t, v]) => `${toolName(t)} ${toolTotal ? Math.round((v / toolTotal) * 100) : 0}%`)
    .join(", ");
  const sharedBy = new Set(inWeek.map((r) => r.message.owner.toLowerCase()));
  const members = org.members.length;

  return (
    <div className="co">
      <div className="co-head">
        <div className="co-head-l">
          <h1 className="disp h-page">What did {name} get done this week?</h1>
          {week && <p className="page-sub">Week {week.split("-W")[1]}, from everyone&apos;s signed receipts.</p>}
        </div>
        <WeekPills weeks={weeks} week={week} href={(w) => `/company?week=${w}`} />
      </div>
      <MemberNote org={org} />

      {inWeek.length === 0 ? (
        <NothingShared org={org} />
      ) : (
        <>
          <section aria-labelledby="kpis" className="co-lead">
            <h2 id="kpis" className="big-line num">
              {usd(total.spend)} of AI got {plural(total.done, "thing")} done.
            </h2>
            <p className="co-counts">{countsLine(total.categoryCounts)}</p>
            <p className="co-meta">
              {total.people} {total.people === 1 ? "person" : "people"} in {plural(org.teams.length, "team")}, {plural(total.sessions, "AI session")}, {plural(total.merged, "shipped change")}.{" "}
              {total.waste > 0 ? `${usd(total.waste)} (${pct(total.spend ? (total.waste / total.spend) * 100 : 0)}) went in circles.` : "Nothing went in circles."}
            </p>
            <div className="mt-6">
              <CategoryBar spend={total.categorySpend} total={total.spend} />
              <ul className="legend num" aria-label="AI spend by category">
                {CATEGORIES.filter((c) => total.categorySpend[c] > 0).map((c) => (
                  <li key={c}>
                    <span className="sq" style={{ background: `var(${CATEGORY_COPY[c].varName})` }} aria-hidden="true" />
                    {c} {usd(total.categorySpend[c])}
                  </li>
                ))}
              </ul>
            </div>
            <div className="co-sent">
              <p>
                {members ? `${sharedBy.size} of ${members} people sent their receipt this week.` : `${plural(sharedBy.size, "person")} sent a receipt this week.`}
              </p>
              <Link href={`/company/people?week=${week}`} className="quiet">
                See everyone&apos;s week
              </Link>
            </div>
          </section>

          <section aria-labelledby="teams" className="co-sec">
            <div className="sec-head">
              <h2 id="teams" className="disp h-card">
                Teams
              </h2>
              <p className="text-sm text-[var(--mute)]">Teams side by side. People are never ranked.</p>
            </div>
            <div className="counter">
              {org.teams.map((t) => {
                const rows = inWeek.filter((r) => r.team === t.id);
                const a = aggregate(rows);
                const ts = Object.values(a.tools).reduce((x, y) => x + y, 0);
                const teamMembers = org.members.filter((m) => m.team === t.id).length;
                return (
                  <div key={t.id} className="tape-col">
                    <div className="tape-shadow">
                      <article className="paper tape" aria-label={`${t.name}, week ${week?.split("-W")[1]} totals`}>
                        <div className="r-head">
                          <div className="r-name" style={{ fontSize: 15 }}>
                            {t.name} at {name}
                          </div>
                          <div className="r-faint">Week {week?.split("-W")[1]}</div>
                        </div>
                        <hr className="r-rule" />
                        <TapeRow k="People" v={String(a.people)} />
                        <TapeRow k="Things done" v={String(a.done)} />
                        <TapeRow k="AI spend" v={usd(a.spend)} />
                        <TapeRow k="Shipped" v={String(a.merged)} />
                        <TapeRow k="Went in circles" v={pct(a.spend ? (a.waste / a.spend) * 100 : 0)} />
                        {CATEGORIES.some((c) => a.categorySpend[c] > 0) && <hr className="r-rule" />}
                        {CATEGORIES.filter((c) => a.categorySpend[c] > 0).map((c) => (
                          <div key={c} className="r-row">
                            <span>
                              <span className="sq mr-[7px]" style={{ width: 7, height: 7, background: `var(${CATEGORY_COPY[c].varName})` }} aria-hidden="true" />
                              {CATEGORY_COPY[c].name} x{a.categoryCounts[c] ?? 0}
                            </span>
                            <span className="leader" />
                            <span>{usd(a.categorySpend[c], 2)}</span>
                          </div>
                        ))}
                        {ts > 0 && <hr className="r-rule" />}
                        {Object.entries(a.tools)
                          .sort((x, y) => y[1] - x[1])
                          .map(([k, v]) => (
                            <TapeRow key={k} k={toolName(k)} v={`${ts ? Math.round((v / ts) * 100) : 0}%`} />
                          ))}
                        <hr className="r-rule" />
                        <div className="r-faint text-center">{teamMembers ? `Signed by ${a.people} of ${teamMembers} people` : `Signed by ${plural(a.people, "person")}`}</div>
                        {rows[0] && <Barcode hex={rows[0].digest} />}
                      </article>
                    </div>
                    <Link className="btn btn-secondary" href={`/company/team?team=${encodeURIComponent(t.id)}&week=${week}`}>
                      Open {t.name}
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>

          {eff && (
            <div className="co-sec">
              <EfficiencyPanel
                e={eff}
                title={`How ${name} worked this week`}
                note="Typical times are the median of each person's median. Counts and dollars are added up across everyone's signed receipts. People are never ranked."
              />
            </div>
          )}

          <section className="co-sec two" aria-label="Spend by tool and week by week">
            <div>
              <h2 className="h-small mb-3.5">Spend by AI tool</h2>
              <div className="catbar" role="img" aria-label="Spend split by AI tool">
                {Object.entries(total.tools)
                  .sort((a, b) => b[1] - a[1])
                  .map(([t, v]) => (
                    <span key={t} style={{ width: `${(v / toolTotal) * 100}%`, background: TOOL_COLOR[t] ?? "var(--mute)" }} title={`${toolName(t)} ${usd(v)}`} />
                  ))}
              </div>
              <ul className="tools-l">
                {Object.entries(total.tools)
                  .sort((a, b) => b[1] - a[1])
                  .map(([t, v]) => (
                    <li key={t}>
                      <span className="sw" style={{ background: TOOL_COLOR[t] ?? "var(--mute)" }} aria-hidden="true" />
                      {toolName(t)}
                      <span className="amt num">{usd(v)}</span>
                    </li>
                  ))}
              </ul>
              <p className="help">{toolHint}. From everyone&apos;s signed totals.</p>
            </div>
            <div>
              <h2 className="h-small mb-3.5">Week by week</h2>
              <ol className="wlist">
                {weeks.map((w) => {
                  const a = aggregate(verified.filter((r) => r.message.period === w));
                  const max = Math.max(...weeks.map((x) => aggregate(verified.filter((r) => r.message.period === x)).spend), 1);
                  return (
                    <li key={w}>
                      <Link href={`/company?week=${w}`} className="wrow" aria-current={w === week ? "page" : undefined}>
                        <span className="wl">Week {w.split("-W")[1]}</span>
                        <span className="wtrack" style={{ width: `${Math.max(4, (a.spend / max) * 100)}%` }}>
                          {CATEGORIES.filter((c) => a.categorySpend[c] > 0).map((c) => (
                            <span key={c} style={{ width: `${(a.categorySpend[c] / Math.max(a.spend, 0.01)) * 100}%`, background: `var(${CATEGORY_COPY[c].varName})` }} />
                          ))}
                        </span>
                        <span className="wv num">
                          {usd(a.spend)} for {plural(a.done, "thing")} done
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>

          <div className="co-sec">
            <Collapsible title="What the company can and cannot see">
              <ul className="list-disc space-y-2 pl-5 text-[var(--ink-2)]">
                <li>Can see: each person&apos;s signed list of what they got done, the pull requests behind it, and the totals per category and AI tool.</li>
                <li>
                  Cannot see: prompts, the AI&apos;s answers, file names or session details. Those never leave the employee&apos;s laptop. People can also keep
                  single lines private; they still count in the signed totals.
                </li>
                <li>
                  The lists are stored on Swarm, encrypted on each person&apos;s laptop. This page opens them with the company key, for members of the org.
                  Anyone else reading Arkiv sees only the signed totals.
                </li>
                <li>
                  Every number comes from receipts signed by the person they describe, read from Arkiv (schema <code>{ARKIV_SCHEMA_NAME}</code>, company
                  &quot;{org.id}&quot;): {org.arkivCount} live on Arkiv now{source === "demo" ? ", plus the demo company's signed receipts from the repo" : ""}.
                  {org.arkivError && ` Arkiv could not be reached: ${org.arkivError.slice(0, 120)}.`}
                </li>
              </ul>
            </Collapsible>
          </div>
        </>
      )}
    </div>
  );
}

function TapeRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="r-row">
      <span>{k}</span>
      <span className="leader" />
      <span>{v}</span>
    </div>
  );
}
