import { SpaceHeader } from "@/components/space-header";
import { SiteFooter } from "@/components/site-footer";
import { CompanyIdentity } from "@/components/company-identity";
import { currentSource, shareTarget } from "@/lib/server/data";
import { companyKnown } from "@/lib/server/org";
import { viewer } from "@/lib/server/viewer";

// The company side, for leads and managers. Your company is your GitHub org and its teams are your
// GitHub teams. You see everyone's signed week; the lists open only for members of the org.
export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const source = await currentSource();
  const v = await viewer(source);
  const name = source === "demo" ? "Acme" : (await companyKnown(source)) ? (await shareTarget()).orgName : undefined;
  return (
    <>
      <SpaceHeader
        space="company"
        title={name}
        tabs={[
          { href: "/company", label: "Overview", exact: true },
          { href: "/company/team", label: "Teams" },
          { href: "/company/people", label: "People" },
          { href: "/company/prs", label: "Pull requests" },
          { href: "/company/setup", label: "Setup" },
        ]}
        right={<CompanyIdentity v={v} />}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <SiteFooter note="Every number is signed by the person it describes. Prompts are never shared." />
    </>
  );
}
