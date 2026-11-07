import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Collapsible } from "@/components/collapsible";
import { PeopleHead, PersonWeek } from "@/components/person-week";
import { CategoryBar } from "@/components/category-badge";
import { currentSource, onLaptop, shareTarget } from "@/lib/server/data";
import { companyKnown, loadOrg, personName } from "@/lib/server/org";
import { CompanyDoor, MemberNote } from "@/components/company-door";
import { ARKIV_SCHEMA_NAME, exampleQuery } from "@/lib/receipts/arkiv";
import { aggregate, aggregateEfficiency, countsLine } from "@/lib/receipts/aggregate";
import { EfficiencyPanel } from "@/components/efficiency-panel";
import { signedNumbers } from "@/lib/receipts/receipt";
import { pct, plural, usd } from "@/lib/format";
import { ChainlinkCheck } from "@/components/chainlink-check";
import { teamCheck } from "@/lib/server/scoreboard";
import { creCli, creTeam } from "@/lib/server/cre-run";

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
  const canRun = !!creCli() && creTeam() === teamId && (await onLaptop());
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
    <div className="co">
      <div className="co-head">
        <div className="co-head-l">
          <Link href={`/company${week ? `?week=${week}` : ""}`} className="mw-back">
            <ChevronLeft className="size-4" aria-hidden="true" />
            {org.name.replace(/ \(demo company\)$/, "")}
          </Link>
          <h1 className="disp h-page">What did {cfg.name} get done?</h1>
          {week && <p className="page-sub">Week {week.split("-W")[1]}, each week signed by the person it describes.</p>}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {org.teams.length > 1 && (
            <nav className="seg" aria-label="Team">
              {org.teams.map((t) => (
                <Link key={t.id} href={`/company/team?team=${encodeURIComponent(t.id)}${week ? `&week=${week}` : ""}`} className="seg-b" aria-current={t.id === teamId ? "page" : undefined}>
                  {t.name}
                </Link>
              ))}
            </nav>
          )}
          {weeks.length > 1 && (
            <nav className="seg" aria-label="Week">
              {weeks.map((w) => (
                <Link key={w} href={q(w)} className="seg-b" aria-current={w === week ? "page" : undefined}>
                  Week {w.split("-W")[1]}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>

      <MemberNote org={org} />

      {!week ? (
        <div className="card card-pad mt-9 max-w-2xl">
          <h2 className="h-small">Nothing shared yet</h2>
          <p className="mt-2 text-[var(--ink-2)]">When people on this team sign and send their week, their lists show up here with the pull requests behind them.</p>
        </div>
      ) : (
        <>
          <section aria-labelledby="totals" className="co-lead">
            <h2 id="totals" className="big-line num">
              {usd(total.spend)} of AI got {plural(total.done, "thing")} done.
            </h2>
            <p className="co-counts">{countsLine(total.categoryCounts)}</p>
            <p className="co-meta">
              {total.people} {total.people === 1 ? "person" : "people"}, {plural(total.merged, "shipped change")}.{" "}
              {total.waste > 0 ? `${usd(total.waste)} (${pct(total.spend ? (total.waste / total.spend) * 100 : 0)}) went in circles.` : ""}
            </p>
            <div className="mt-6">
              <CategoryBar spend={total.categorySpend} total={total.spend} />
            </div>
          </section>

          {check ? (
            <div className="co-sec">
              <ChainlinkCheck check={check} team={cfg.name} company={org.name.replace(/ \(demo company\)$/, "")} demo={source === "demo"} canRun={canRun} />
            </div>
          ) : null}

          {eff && (
            <div className="co-sec">
              <EfficiencyPanel e={eff} title="How the team worked this week" note="Typical times are the median of each person's median. People are never ranked." />
            </div>
          )}

          <section aria-labelledby="people" className="co-sec">
            <div className="sec-head">
              <h2 id="people" className="disp h-card">
                Everyone&apos;s week
              </h2>
              <p className="text-sm text-[var(--mute)]">Ordered by things done. People are never ranked.</p>
            </div>
            <div className="plist">
              <PeopleHead />
              {inWeek.map((r, i) => (
                <PersonWeek key={r.digest} r={r} name={personName(org, r.message.owner, r.message.author)} verified={r.verified} arkivKey={r.arkivKey} swarm={r.swarm} defaultOpen={i === 0} />
              ))}
              {notSharing.map((m) => (
                <div key={m.address} className="quiet-row">
                  <b>{m.name}</b> has not sent this week&apos;s receipt yet.
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <div className="co-sec">
        <Collapsible title="Where this data comes from" hint="Signed receipts on Arkiv">
          <p className="text-[var(--ink-2)]">
            Shared receipts live on Arkiv (testnet Rabdi) as read-only entities of schema <code>{ARKIV_SCHEMA_NAME}</code>, each owned by the person who
            signed it. Anyone can read them, so this page does not depend on our server, and every receipt is checked against its signature before it
            counts. {arkivForTeam} receipt{arkivForTeam === 1 ? "" : "s"} for this team found on Arkiv right now
            {demoForTeam ? `, plus ${demoForTeam} signed demo receipts from the repo` : ""}.{org.arkivError && ` Arkiv could not be reached: ${org.arkivError.slice(0, 120)}.`}
          </p>
          <div className="envbox mt-3">
            <pre>{exampleQuery(cfg.id)}</pre>
          </div>
        </Collapsible>
      </div>
    </div>
  );
}
