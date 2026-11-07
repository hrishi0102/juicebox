import { currentSource } from "@/lib/server/data";
import { companyKnown, loadOrg, orgWeek, personName } from "@/lib/server/org";
import { PeopleHead, PersonWeek } from "@/components/person-week";
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
    <div className="co">
      <div className="co-head">
        <div className="co-head-l">
          <h1 className="disp h-page">Everyone&apos;s week</h1>
          <p className="page-sub">Signed by each person. Prompts are never included. People are not ranked; the order is just things done.</p>
        </div>
        <WeekPills weeks={weeks} week={week} href={(w) => `/company/people?week=${w}`} />
      </div>
      <MemberNote org={org} />

      {inWeek.length === 0 ? (
        <NothingShared org={org} />
      ) : (
        <section aria-label="People" className="plist mt-9">
          <PeopleHead />
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
            <div key={m.address} className="quiet-row">
              <b>{m.name}</b> has not sent this week&apos;s receipt yet.
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
