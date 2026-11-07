import { currentSource } from "@/lib/server/data";
import { companyKnown, loadOrg, orgWeek, personName } from "@/lib/server/org";
import { PrTable, type PrRow } from "@/components/pr-table";
import { CompanyDoor, MemberNote, NothingShared, WeekPills } from "@/components/company-door";
import { plural, usd } from "@/lib/format";

export const metadata = { title: "Pull requests · Company · Receipts" };

// Every pull request the week's AI spend went into, from everyone's signed receipts.
export default async function CompanyPrs({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const sp = await searchParams;
  const source = await currentSource();
  if (!(await companyKnown(source))) return <CompanyDoor />;
  const org = await loadOrg(source);
  const { weeks, week, inWeek } = orgWeek(org, sp.week);
  const teamName = (id: string) => org.teams.find((t) => t.id === id)?.name ?? id;
  const prs: PrRow[] = inWeek
    .flatMap((r) => r.evidence.map((e) => ({ ...e, person: personName(org, r.message.owner, r.message.author), team: teamName(r.team) })))
    .sort((a, b) => b.costCents - a.costCents);
  const cost = prs.reduce((a, p) => a + p.costCents, 0) / 100;

  return (
    <div className="co">
      <div className="co-head">
        <div className="co-head-l">
          <h1 className="disp h-page">Every pull request</h1>
          <p className="page-sub">
            {prs.length ? `${plural(prs.length, "PR")} this week, ${usd(cost)} of AI behind them, most expensive first.` : "The pull requests behind everyone's signed week."}
          </p>
        </div>
        <WeekPills weeks={weeks} week={week} href={(w) => `/company/prs?week=${w}`} />
      </div>
      <MemberNote org={org} />
      {inWeek.length === 0 ? (
        <NothingShared org={org} />
      ) : prs.length === 0 ? (
        <div className="sealed mt-9 max-w-[760px] p-7">
          <p className="text-[var(--ink-2)]">No pull requests in the receipts that could be opened this week.</p>
        </div>
      ) : (
        <div className="plist mt-9">
          <p className="pr-cap">Each pull request opens on github.com. The AI cost is what the sessions behind it cost.</p>
          <PrTable evidence={prs} showPerson />
        </div>
      )}
    </div>
  );
}
