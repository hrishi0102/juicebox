"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** `exact`: only this path. `also`: other path prefixes that belong to this tab. */
export type SpaceTab = { href: string; label: string; exact?: boolean; also?: string[] };

export function SpaceTabs({ tabs }: { tabs: SpaceTab[] }) {
  const path = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Sections">
      {tabs.map((t) => {
        const own = t.exact ? path === t.href : path === t.href || path.startsWith(`${t.href}/`);
        const active = own || !!t.also?.some((p) => path === p || path.startsWith(`${p}/`));
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-2.5 py-1 transition-colors ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
