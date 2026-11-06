import { SpaceShell } from "@/components/space-header";
import { ZeroGAccount } from "@/components/zero-g";
import { githubLogin } from "@/lib/receipts/identity";
import { currentSource } from "@/lib/server/data";

// The employee side, on your own laptop. Set up once (GitHub, your company, Sign in with 0G, your
// logs), then every week: write, sign, send.
export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const source = await currentSource();
  const login = source === "demo" ? "you" : (await githubLogin())?.login;
  return (
    <SpaceShell
      space="employee"
      nav={[
        { href: "/me", label: "This week", exact: true, also: ["/me/send"] },
        { href: "/me/sessions", label: "Sessions" },
        { href: "/me/setup", label: "Setup" },
      ]}
      right={
        <>
          {login && (
            <span className="t-who" title={source === "demo" ? "The demo engineer" : "Your GitHub login on this laptop"}>
              @{login}
            </span>
          )}
          <ZeroGAccount />
        </>
      }
      footerNote="Your raw logs never leave this laptop."
    >
      {children}
    </SpaceShell>
  );
}
