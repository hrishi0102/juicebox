import Link from "next/link";
import { SpaceHeader } from "@/components/space-header";
import { SiteFooter } from "@/components/site-footer";

// The front door, the demo picker, and pages anyone can open with a link (a shared receipt, the
// receipt checker, how it works). Nobody signs in here.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SpaceHeader
        space="public"
        right={
          <>
            <Link href="/how" className="text-sm text-muted-foreground hover:text-foreground">
              How it works
            </Link>
            <Link href="/verify" className="text-sm text-muted-foreground hover:text-foreground">
              Check a receipt
            </Link>
          </>
        }
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <SiteFooter />
    </>
  );
}
