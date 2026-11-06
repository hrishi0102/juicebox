import Link from "next/link";
import { SpaceHeader } from "@/components/space-header";
import { SiteFooter } from "@/components/site-footer";
import { ZeroGAccount } from "@/components/zero-g";

// The side product, for anyone: one page, AI Wrapped. It has nothing to do with receipts and is
// never sent to a company.
export default function PersonalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="fun flex flex-1 flex-col">
        <SpaceHeader
          space="personal"
          dark
          right={
            <>
              <Link href="/how" className="t-navlink t-hide-s">
                How it works
              </Link>
              <Link href="/verify" className="t-navlink t-hide-s">
                Check a receipt
              </Link>
              <ZeroGAccount />
            </>
          }
        />
        <main className="wrapw flex-1">{children}</main>
        <SiteFooter dark note="Just for fun. Counted on this device and never sent to a company." />
      </div>
    </>
  );
}
