"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SpaceHeader } from "@/components/space-header";
import { SiteFooter } from "@/components/site-footer";

/** Public pages get the shared top bar; the front door draws its own header and footer. */
export function PublicFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/") return <>{children}</>;
  return (
    <>
      <SpaceHeader
        space="public"
        right={
          <>
            <Link href="/how" className="t-navlink t-hide-s">
              How it works
            </Link>
            <Link href="/demo" className="btn btn-secondary btn-sm">
              Try the demo
            </Link>
          </>
        }
      />
      <main className="flex-1">{children}</main>
      <SiteFooter note="Every number is signed by the person it describes. Prompts are never shared." />
    </>
  );
}
