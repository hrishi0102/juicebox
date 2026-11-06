import { SpaceShell } from "@/components/space-header";
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
    <SpaceShell
      space="company"
      title={name}
      nav={[
        { href: "/company", label: "Overview", icon: "overview", exact: true },
        { href: "/company/team", label: "Teams", icon: "teams" },
        { href: "/company/people", label: "People", icon: "people" },
        { href: "/company/prs", label: "Pull requests", icon: "prs" },
        { href: "/company/setup", label: "Setup", icon: "setup" },
      ]}
      right={<CompanyIdentity v={v} />}
      footerNote="Every number is signed by the person it describes. Prompts are never shared."
    >
      {children}
    </SpaceShell>
  );
}
