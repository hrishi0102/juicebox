import { SpaceHeader } from "@/components/space-header";
import { SiteFooter } from "@/components/site-footer";
import { ZeroGAccount } from "@/components/zero-g";

// The side product, for anyone: one page, AI Wrapped. It has nothing to do with receipts and is
// never sent to a company.
export default function PersonalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SpaceHeader space="personal" title="AI Wrapped" right={<ZeroGAccount />} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <SiteFooter note="Just for fun. Counted on this device; never sent to a company." />
    </>
  );
}
