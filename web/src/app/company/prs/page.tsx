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
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight">Every pull request</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            {prs.length ? `${plural(prs.length, "PR")} this week, ${usd(cost)} of AI behind them, most expensive first.` : "The pull requests behind everyone's signed week."}
          </p>
        </div>
        <WeekPills weeks={weeks} week={week} href={(w) => `/company/prs?week=${w}`} />
        <MemberNote org={org} />
      </div>
      {inWeek.length === 0 ? (
        <NothingShared org={org} />
      ) : prs.length === 0 ? (
        <p className="text-muted-foreground">No pull requests in the receipts that could be opened this week.</p>
      ) : (
        <div className="rounded-lg border border-border bg-card px-4 py-2">
          <PrTable evidence={prs} showPerson />
        </div>
      )}
    </div>
  );
}
