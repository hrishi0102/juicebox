import { currentSource } from "@/lib/server/data";
import { companyKnown, loadOrg, orgWeek, personName } from "@/lib/server/org";
import { PersonWeek } from "@/components/person-week";
import { CompanyDoor, MemberNote, NothingShared, WeekPills } from "@/components/company-door";
import { signedNumbers } from "@/lib/receipts/receipt";

export const metadata = { title: "People · Company · Receipts" };

// Everyone's signed week: one row per person, open to their list, their PRs and the checks.
// `who` (a signing address) opens that person's row, for "See it as your company sees it".
export default async function CompanyPeople({ searchParams }: { searchParams: Promise<{ week?: string; who?: string }> }) {
  const sp = await searchParams;
  const source = await currentSource();
  if (!(await companyKnown(source))) return <CompanyDoor />;
  const org = await loadOrg(source);
  const { weeks, week, inWeek } = orgWeek(org, sp.week);
  const teamName = (id: string) => org.teams.find((t) => t.id === id)?.name ?? id;
  const people = [...inWeek].sort((a, b) => signedNumbers(b).done - signedNumbers(a).done);
  const sharedBy = new Set(inWeek.map((r) => r.message.owner.toLowerCase()));
  const quiet = org.members.filter((m) => !sharedBy.has(m.address.toLowerCase()));
  const who = sp.who?.toLowerCase();

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight">Everyone&apos;s week</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">Signed by each person. Prompts are never included. People are not ranked; the order is just things done.</p>
        </div>
        <WeekPills weeks={weeks} week={week} href={(w) => `/company/people?week=${w}`} />
        <MemberNote org={org} />
      </div>

      {inWeek.length === 0 ? (
        <NothingShared org={org} />
      ) : (
        <section aria-label="People" className="space-y-3">
          {people.map((r) => (
            <PersonWeek
              key={r.digest}
              r={r}
              name={personName(org, r.message.owner, r.message.author)}
              team={teamName(r.team)}
              verified={r.verified}
              arkivKey={r.arkivKey}
              swarm={r.swarm}
              defaultOpen={!!who && r.message.owner.toLowerCase() === who}
            />
          ))}
          {quiet.map((m) => (
            <div key={m.address} className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{m.name}</span> has not sent this week&apos;s receipt yet.
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
