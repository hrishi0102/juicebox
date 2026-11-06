import { SpaceHeader } from "@/components/space-header";
import { SiteFooter } from "@/components/site-footer";
import { ZeroGAccount } from "@/components/zero-g";

// The side product, for anyone: AI Wrapped, a card of your week for socials, and the wall of
// public cards. Nothing here is signed or sent to a company.
export default function PersonalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SpaceHeader
        space="personal"
        tabs={[
          { href: "/wrapped", label: "AI Wrapped" },
          { href: "/card", label: "Week card" },
          { href: "/wall", label: "Wall" },
        ]}
        right={<ZeroGAccount />}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <SiteFooter note="Just for fun. Nothing here is signed or sent to a company." />
    </>
  );
}
