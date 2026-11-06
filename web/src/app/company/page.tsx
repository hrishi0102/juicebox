import Link from "next/link";
import { currentSource } from "@/lib/server/data";
import { companyKnown, loadOrg, orgWeek } from "@/lib/server/org";
import { Collapsible } from "@/components/collapsible";
import { CategoryBar } from "@/components/category-badge";
import { CompanyDoor, MemberNote, NothingShared, WeekPills } from "@/components/company-door";
import { ARKIV_SCHEMA_NAME } from "@/lib/receipts/arkiv";
import { aggregate, aggregateEfficiency, countsLine } from "@/lib/receipts/aggregate";
import { EfficiencyPanel } from "@/components/efficiency-panel";
import { CATEGORY_COPY, pct, plural, usd } from "@/lib/format";
import { CATEGORIES, TOOL_NAMES, type AiTool } from "@/lib/receipts/types";

export const metadata = { title: "Company · Receipts" };

const TOOL_COLOR: Record<string, string> = { "claude-code": "var(--primary)", codex: "var(--chart-2)" };
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
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">What did {name} get done this week?</h1>
        <WeekPills weeks={weeks} week={week} href={(w) => `/company?week=${w}`} />
        <MemberNote org={org} />
      </div>

      {inWeek.length === 0 ? (
        <NothingShared org={org} />
      ) : (
        <>
          <section aria-labelledby="kpis" className="max-w-4xl">
            <h2 id="kpis" className="text-balance text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
              {usd(total.spend)} of AI got {plural(total.done, "thing")} done.
            </h2>
            <p className="mt-2 text-[17px]">{countsLine(total.categoryCounts)}</p>
            <p className="mt-1 text-muted-foreground">
              {total.people} {total.people === 1 ? "person" : "people"} in {plural(org.teams.length, "team")}, {plural(total.sessions, "AI session")}, {plural(total.merged, "shipped change")}.{" "}
              {total.waste > 0 ? `${usd(total.waste)} (${pct(total.spend ? (total.waste / total.spend) * 100 : 0)}) went in circles.` : "Nothing went in circles."}
            </p>
            <div className="mt-4 space-y-2">
              <CategoryBar spend={total.categorySpend} total={total.spend} />
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {CATEGORIES.filter((c) => total.categorySpend[c] > 0).map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: `var(${CATEGORY_COPY[c].varName})` }} aria-hidden="true" />
                    {c} {usd(total.categorySpend[c])}
                  </span>
                ))}
              </div>
            </div>
            <p className="mt-4 text-[15px]">
              {members ? `${sharedBy.size} of ${members} people sent their receipt this week.` : `${plural(sharedBy.size, "person")} sent a receipt this week.`}{" "}
              <Link href={`/company/people?week=${week}`} className="text-primary hover:underline">
                See everyone&apos;s week
              </Link>
            </p>
          </section>

          {eff && (
            <EfficiencyPanel
              e={eff}
              title={`How ${name} worked this week`}
              note="Typical times are the median of each person's median. Counts and dollars are added up across everyone's signed receipts. People are never ranked."
            />
          )}

          <section aria-labelledby="teams">
            <h2 id="teams" className="text-xl font-semibold tracking-tight">
              Teams
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Teams side by side. People are never ranked.</p>
            <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="border-b border-border text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-normal">Team</th>
                    <th className="px-4 py-2.5 font-normal">People</th>
                    <th className="px-4 py-2.5 font-normal">AI spend</th>
                    <th className="px-4 py-2.5 font-normal">Things done</th>
                    <th className="px-4 py-2.5 font-normal">Merged PRs</th>
                    <th className="px-4 py-2.5 font-normal">Went in circles</th>
                    <th className="px-4 py-2.5 font-normal">Tools</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {org.teams.map((t) => {
                    const a = aggregate(inWeek.filter((r) => r.team === t.id));
                    const ts = Object.values(a.tools).reduce((x, y) => x + y, 0);
                    return (
                      <tr key={t.id}>
                        <td className="px-4 py-3 font-medium">
                          <Link className="text-primary hover:underline" href={`/company/team?team=${encodeURIComponent(t.id)}&week=${week}`}>
                            {t.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{a.people}</td>
                        <td className="px-4 py-3">{usd(a.spend)}</td>
                        <td className="px-4 py-3">{a.done}</td>
                        <td className="px-4 py-3">{a.merged}</td>
                        <td className="px-4 py-3">{pct(a.spend ? (a.waste / a.spend) * 100 : 0)}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {Object.entries(a.tools)
                            .sort((x, y) => y[1] - x[1])
                            .map(([k, v]) => `${toolName(k)} ${ts ? Math.round((v / ts) * 100) : 0}%`)
                            .join(", ")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="space-y-3">
            <Collapsible title="Spend by AI tool" hint={toolHint}>
              <div className="max-w-2xl space-y-2">
                <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Spend split by AI tool">
                  {Object.entries(total.tools)
                    .sort((a, b) => b[1] - a[1])
                    .map(([t, v]) => (
                      <div key={t} style={{ width: `${(v / toolTotal) * 100}%`, background: TOOL_COLOR[t] ?? "var(--muted-foreground)" }} title={`${toolName(t)} ${usd(v)}`} />
                    ))}
                </div>
                <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {Object.entries(total.tools)
                    .sort((a, b) => b[1] - a[1])
                    .map(([t, v]) => (
                      <li key={t} className="inline-flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ background: TOOL_COLOR[t] ?? "var(--muted-foreground)" }} aria-hidden="true" />
                        {toolName(t)}: {usd(v)}
                      </li>
                    ))}
                </ul>
              </div>
            </Collapsible>

            <Collapsible title="Week by week" hint={plural(weeks.length, "week")}>
              <ul className="max-w-3xl space-y-3">
                {weeks.map((w) => {
                  const a = aggregate(verified.filter((r) => r.message.period === w));
                  const max = Math.max(...weeks.map((x) => aggregate(verified.filter((r) => r.message.period === x)).spend), 1);
                  return (
                    <li key={w} className="grid grid-cols-[5rem_1fr] items-center gap-3 text-sm sm:grid-cols-[5rem_1fr_16rem]">
                      <Link href={`/company?week=${w}`} className="hover:underline">
                        Week {w.split("-W")[1]}
                      </Link>
                      <div className="flex h-3 overflow-hidden rounded-full bg-muted" style={{ width: `${Math.max(4, (a.spend / max) * 100)}%` }}>
                        {CATEGORIES.filter((c) => a.categorySpend[c] > 0).map((c) => (
                          <div key={c} style={{ width: `${(a.categorySpend[c] / Math.max(a.spend, 0.01)) * 100}%`, background: `var(${CATEGORY_COPY[c].varName})` }} />
                        ))}
                      </div>
                      <div className="col-span-2 text-muted-foreground sm:col-span-1">
                        {usd(a.spend)} for {plural(a.done, "thing")} done
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Collapsible>

            <Collapsible title="What the company can and cannot see">
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
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
