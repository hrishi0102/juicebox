import Link from "next/link";
import { currentSource } from "@/lib/server/data";
import { loadOrg, type OrgRow } from "@/lib/server/org";
import { ARKIV_SCHEMA_NAME } from "@/lib/receipts/arkiv";
import { signedNumbers } from "@/lib/receipts/receipt";
import { pct, usd } from "@/lib/format";
import { TOOL_NAMES, type AiTool } from "@/lib/receipts/types";

const TOOL_COLOR: Record<string, string> = { "claude-code": "var(--primary)", codex: "var(--chart-2)" };
const toolName = (t: string) => TOOL_NAMES[t as AiTool] ?? t;

type Agg = {
  receipts: number;
  people: number;
  withEvidence: number;
  spend: number;
  shipped: number;
  kept: number;
  waste: number;
  survival: number | null;
  tools: Record<string, number>;
};

/** Add up shared receipts using only their signed fields. */
function aggregate(rows: OrgRow[]): Agg {
  const nums = rows.map((r) => ({ r, n: signedNumbers(r) }));
  const tools: Record<string, number> = {};
  for (const { n } of nums) for (const [t, v] of Object.entries(n.toolSpend)) tools[t] = (tools[t] ?? 0) + v;
  const surv = nums.filter(({ n }) => n.survivalPct !== null);
  const w = surv.reduce((a, { n }) => a + Math.max(1, n.shippedTasks), 0);
  return {
    receipts: rows.length,
    people: new Set(rows.map((r) => r.message.owner.toLowerCase())).size,
    withEvidence: new Set(rows.filter((r) => r.share?.level === "full").map((r) => r.message.owner.toLowerCase())).size,
    spend: nums.reduce((a, { n }) => a + n.spendUsd, 0),
    shipped: nums.reduce((a, { n }) => a + n.shippedTasks, 0),
    kept: nums.reduce((a, { n }) => a + n.keptWork, 0),
    waste: nums.reduce((a, { n }) => a + n.wasteUsd, 0),
    survival: w ? surv.reduce((a, { n }) => a + (n.survivalPct ?? 0) * Math.max(1, n.shippedTasks), 0) / w : null,
    tools,
  };
}

export default async function OrgPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const sp = await searchParams;
  const source = await currentSource();
  const org = await loadOrg(source);
  const verified = org.rows.filter((r) => r.verified);
  const weeks = [...new Set(verified.map((r) => r.message.period))].sort();
  const week = sp.week && weeks.includes(sp.week) ? sp.week : undefined;
  const inPeriod = week ? verified.filter((r) => r.message.period === week) : verified.filter((r) => weeks.slice(-4).includes(r.message.period));
  const total = aggregate(inPeriod);
  const toolTotal = Object.values(total.tools).reduce((a, b) => a + b, 0);
  const periodLabel = week ? `Week ${week.split("-W")[1]}` : `Last ${Math.min(4, weeks.length)} weeks`;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{org.name}</h1>
        <p className="mt-2 max-w-[72ch] text-muted-foreground">{org.policy}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm" role="group" aria-label="Period">
          <Link href="/org" className={`rounded-full border px-3 py-1 ${!week ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-card"}`}>
            Last {Math.min(4, weeks.length)} weeks
          </Link>
          {[...weeks].reverse().map((w) => (
            <Link
              key={w}
              href={`/org?week=${w}`}
              className={`rounded-full border px-3 py-1 ${w === week ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-card"}`}
            >
              Week {w.split("-W")[1]}
            </Link>
          ))}
        </div>
      </div>

      {inPeriod.length === 0 ? (
        <div className="max-w-2xl rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">No shared receipts yet</h2>
          <p className="mt-2 text-muted-foreground">
            When people in &quot;{org.id}&quot; share their weekly receipts, the company view fills in here. Set your org with{" "}
            <code>npm run receipts -- org &lt;id&gt; &quot;Name&quot;</code>.
          </p>
        </div>
      ) : (
        <>
          <section aria-labelledby="kpis">
            <h2 id="kpis" className="text-lg font-semibold">
              {periodLabel}: {usd(total.spend)} bought {total.shipped} shipped tasks{total.survival !== null ? `, ${Math.round(total.survival)}% still alive` : ""}
            </h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              <Stat k="AI spend" v={usd(total.spend)} note={`${total.people} people, ${org.teams.length} teams`} />
              <Stat k="Shipped tasks" v={String(total.shipped)} note={`${total.kept.toFixed(1)} tasks of kept work`} />
              <Stat k="Still alive" v={pct(total.survival)} note="of shipped code" />
              <Stat k="Waste" v={pct(total.spend ? (total.waste / total.spend) * 100 : 0)} note={`${usd(total.waste)} on loops and dead ends`} />
              <Stat k="Kept work per $100" v={total.spend ? ((total.kept / total.spend) * 100).toFixed(1) : "n/a"} note="higher is better" />
            </div>
          </section>

          <section aria-labelledby="tools">
            <h2 id="tools" className="text-xl font-semibold tracking-tight">
              Spend by AI tool
            </h2>
            <div className="mt-3 max-w-2xl space-y-2">
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
                      {toolName(t)}: {usd(v)} ({Math.round((v / toolTotal) * 100)}%)
                    </li>
                  ))}
              </ul>
            </div>
          </section>

          <section aria-labelledby="teams">
            <h2 id="teams" className="text-xl font-semibold tracking-tight">
              By team
            </h2>
            <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-border text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-normal">Team</th>
                    <th className="px-4 py-2.5 font-normal">People</th>
                    <th className="px-4 py-2.5 font-normal">Spend</th>
                    <th className="px-4 py-2.5 font-normal">Shipped</th>
                    <th className="px-4 py-2.5 font-normal">Still alive</th>
                    <th className="px-4 py-2.5 font-normal">Waste</th>
                    <th className="px-4 py-2.5 font-normal">Kept per $100</th>
                    <th className="px-4 py-2.5 font-normal">Tools</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {org.teams.map((t) => {
                    const a = aggregate(inPeriod.filter((r) => r.team === t.id));
                    const ts = Object.values(a.tools).reduce((x, y) => x + y, 0);
                    return (
                      <tr key={t.id}>
                        <td className="px-4 py-3 font-medium">
                          <Link className="hover:underline" href={`/team?team=${t.id}${week ? `&week=${week}` : ""}`}>
                            {t.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          {a.people}
                          <span className="text-muted-foreground"> ({a.withEvidence} share PRs)</span>
                        </td>
                        <td className="px-4 py-3">{usd(a.spend)}</td>
                        <td className="px-4 py-3">{a.shipped}</td>
                        <td className="px-4 py-3">{pct(a.survival)}</td>
                        <td className="px-4 py-3">{pct(a.spend ? (a.waste / a.spend) * 100 : 0)}</td>
                        <td className="px-4 py-3">{a.spend ? ((a.kept / a.spend) * 100).toFixed(1) : "n/a"}</td>
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
            <p className="mt-2 text-sm text-muted-foreground">Teams are compared on outcomes per dollar, never people. Open a team to see each person&apos;s shared receipt.</p>
          </section>

          <section aria-labelledby="trend">
            <h2 id="trend" className="text-xl font-semibold tracking-tight">
              Week by week
            </h2>
            <ul className="mt-3 max-w-3xl space-y-3">
              {weeks.map((w) => {
                const a = aggregate(verified.filter((r) => r.message.period === w));
                const max = Math.max(...weeks.map((x) => aggregate(verified.filter((r) => r.message.period === x)).spend), 1);
                return (
                  <li key={w} className="grid grid-cols-[5rem_1fr] items-center gap-3 text-sm sm:grid-cols-[5rem_1fr_16rem]">
                    <Link href={`/org?week=${w}`} className="hover:underline">
                      Week {w.split("-W")[1]}
                    </Link>
                    <div className="flex h-3 overflow-hidden rounded-full bg-muted" style={{ width: `${Math.max(4, (a.spend / max) * 100)}%` }}>
                      {Object.entries(a.tools).map(([t, v]) => (
                        <div key={t} style={{ width: `${(v / Math.max(a.spend, 0.01)) * 100}%`, background: TOOL_COLOR[t] ?? "var(--muted-foreground)" }} />
                      ))}
                    </div>
                    <div className="col-span-2 text-muted-foreground sm:col-span-1">
                      {usd(a.spend)} for {a.shipped} shipped, {pct(a.survival)} alive
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      <section className="max-w-3xl rounded-lg border border-border bg-card p-5 text-sm">
        <h2 className="font-semibold">What the company can and cannot see</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Can see: each person&apos;s signed weekly totals (spend, spend per AI tool, shipped tasks, % still alive, waste), and PR lists from people who chose to share them.</li>
          <li>Cannot see: prompts, session titles, file names, or anything from a session nobody shared.</li>
          <li>
            Every number above comes from receipts signed by the person they describe, read from Arkiv (schema <code>{ARKIV_SCHEMA_NAME}</code>, org &quot;{org.id}&quot;):{" "}
            {org.arkivCount} live on Arkiv now{source === "demo" ? `, plus the demo company's signed receipts from the repo` : ""}.
            {org.arkivError && ` Arkiv could not be reached: ${org.arkivError.slice(0, 120)}.`}
          </li>
        </ul>
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
