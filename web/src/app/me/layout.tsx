import { SpaceHeader } from "@/components/space-header";
import { SiteFooter } from "@/components/site-footer";
import { ZeroGAccount } from "@/components/zero-g";
import { githubLogin } from "@/lib/receipts/identity";
import { currentSource } from "@/lib/server/data";

// The employee side, on your own laptop. Set up once (GitHub, your company, Sign in with 0G, your
// logs), then every week: write, review, sign, send.
export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const source = await currentSource();
  const login = source === "demo" ? "you" : (await githubLogin())?.login;
  return (
    <>
      <SpaceHeader
        space="employee"
        tabs={[
          { href: "/me", label: "This week", exact: true, also: ["/me/send"] },
          { href: "/me/sessions", label: "Sessions" },
          { href: "/me/setup", label: "Setup" },
        ]}
        right={
          <>
            {login && (
              <span className="text-sm text-muted-foreground" title={source === "demo" ? "The demo engineer" : "Your GitHub login on this laptop"}>
                @{login}
              </span>
            )}
            <ZeroGAccount />
          </>
        }
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <SiteFooter note="Your raw logs never leave this laptop." />
    </>
  );
}
