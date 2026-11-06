import Link from "next/link";
import { Collapsible } from "@/components/collapsible";
import { PersonWeek } from "@/components/person-week";
import { CategoryBar } from "@/components/category-badge";
import { currentSource, shareTarget } from "@/lib/server/data";
import { companyKnown, loadOrg, personName } from "@/lib/server/org";
import { CompanyDoor, MemberNote } from "@/components/company-door";
import { ARKIV_SCHEMA_NAME, exampleQuery } from "@/lib/receipts/arkiv";
import { aggregate, aggregateEfficiency, countsLine } from "@/lib/receipts/aggregate";
import { EfficiencyPanel } from "@/components/efficiency-panel";
import { signedNumbers } from "@/lib/receipts/receipt";
import { pct, plural, usd } from "@/lib/format";
import { ChainlinkCheck } from "@/components/chainlink-check";
import { teamCheck } from "@/lib/server/scoreboard";

export const metadata = { title: "Teams · Company · Receipts" };

// One team: its headline, then everyone's week (the first one open). Default: your own team.
export default async function Team({ searchParams }: { searchParams: Promise<{ week?: string; team?: string }> }) {
  const sp = await searchParams;
  const source = await currentSource();
  if (!(await companyKnown(source))) return <CompanyDoor />;
  const org = await loadOrg(source);
  const you = source === "demo" ? org.members.find((m) => m.you)?.team : (await shareTarget()).team;
  const teamId = sp.team && org.teams.some((t) => t.id === sp.team) ? sp.team : (you ?? org.teams[0]?.id ?? "");
  const cfg = org.teams.find((t) => t.id === teamId) ?? { id: teamId, name: teamId };
  const check = teamId ? await teamCheck(teamId) : undefined;
  const all = org.rows.filter((r) => r.team === teamId);
  const arkivForTeam = all.filter((r) => r.from === "arkiv").length;
  const demoForTeam = all.filter((r) => r.from === "demo file").length;

  const weeks = [...new Set(all.map((r) => r.message.period))].sort().reverse();
  const week = sp.week && weeks.includes(sp.week) ? sp.week : weeks[0];
  const inWeek = all.filter((r) => r.message.period === week && r.verified).sort((a, b) => signedNumbers(b).done - signedNumbers(a).done);
  const members = org.members.filter((m) => m.team === teamId);
  const total = aggregate(inWeek);
  const eff = aggregateEfficiency(inWeek);
  const sharedBy = new Set(inWeek.map((r) => r.message.owner.toLowerCase()));
  const notSharing = members.filter((m) => !sharedBy.has(m.address.toLowerCase()));
  const q = (w: string) => `/company/team?team=${encodeURIComponent(teamId)}&week=${w}`;

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/company${week ? `?week=${week}` : ""}`} className="text-sm text-muted-foreground hover:text-foreground">
          ‹ {org.name.replace(/ \(demo company\)$/, "")}
        </Link>
        <h1 className="mt-1 text-balance text-4xl font-semibold tracking-tight">What did {cfg.name} get done?</h1>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {org.teams.length > 1 &&
            org.teams.map((t) => (
              <Link
                key={t.id}
                href={`/company/team?team=${encodeURIComponent(t.id)}${week ? `&week=${week}` : ""}`}
                className={`rounded-lg border px-3 py-1 ${t.id === teamId ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-card"}`}
              >
                {t.name}
              </Link>
            ))}
          {weeks.length > 1 && <span className="mx-2 h-5 w-px bg-border" aria-hidden="true" />}
          {weeks.length > 1 &&
            weeks.map((w) => (
              <Link key={w} href={q(w)} className={`rounded-full border px-3 py-1 ${w === week ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-card"}`}>
                Week {w.split("-W")[1]}
              </Link>
            ))}
        </div>
      </div>

      <MemberNote org={org} />

      {!week ? (
        <div className="max-w-2xl rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Nothing shared yet</h2>
          <p className="mt-2 text-muted-foreground">When people on this team sign and send their week, their lists show up here with the pull requests behind them.</p>
        </div>
      ) : (
        <>
          <section aria-labelledby="totals" className="max-w-4xl">
            <h2 id="totals" className="text-balance text-2xl font-semibold tracking-tight">
              {usd(total.spend)} of AI got {plural(total.done, "thing")} done.
            </h2>
            <p className="mt-2 text-[17px]">{countsLine(total.categoryCounts)}</p>
            <p className="mt-1 text-muted-foreground">
              {total.people} {total.people === 1 ? "person" : "people"}, {plural(total.merged, "merged PR")}.{" "}
              {total.waste > 0 ? `${usd(total.waste)} (${pct(total.spend ? (total.waste / total.spend) * 100 : 0)}) went in circles.` : ""}
            </p>
            <div className="mt-4">
              <CategoryBar spend={total.categorySpend} total={total.spend} />
            </div>
          </section>

          {check && <ChainlinkCheck check={check} team={cfg.name} company={org.name.replace(/ \(demo company\)$/, "")} demo={source === "demo"} />}

          {eff && <EfficiencyPanel e={eff} title="How the team worked this week" note="Typical times are the median of each person's median. People are never ranked." />}

          <section aria-labelledby="people" className="space-y-3">
            <h2 id="people" className="text-xl font-semibold tracking-tight">
              Everyone&apos;s week
            </h2>
            {inWeek.map((r, i) => (
              <PersonWeek key={r.digest} r={r} name={personName(org, r.message.owner, r.message.author)} verified={r.verified} arkivKey={r.arkivKey} swarm={r.swarm} defaultOpen={i === 0} />
            ))}
            {notSharing.map((m) => (
              <div key={m.address} className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{m.name}</span> has not sent this week&apos;s receipt yet.
              </div>
            ))}
          </section>
        </>
      )}

      <Collapsible title="Where this data comes from" hint="Signed receipts on Arkiv">
        <p className="text-sm text-muted-foreground">
          Shared receipts live on Arkiv (testnet Rabdi) as read-only entities of schema <code>{ARKIV_SCHEMA_NAME}</code>, each owned by the person who
          signed it. Anyone can read them, so this page does not depend on our server, and every receipt is checked against its signature before it
          counts. {arkivForTeam} receipt{arkivForTeam === 1 ? "" : "s"} for this team found on Arkiv right now
          {demoForTeam ? `, plus ${demoForTeam} signed demo receipts from the repo` : ""}.{org.arkivError && ` Arkiv could not be reached: ${org.arkivError.slice(0, 120)}.`}
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-background p-3 text-xs">{exampleQuery(cfg.id)}</pre>
      </Collapsible>
    </div>
  );
}
