"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, GitPullRequest, LayoutDashboard, ListChecks, Settings, UserRound, Users } from "lucide-react";

// The pages of one part of the app, down the left side (a scrolling row on phones). Icons are
// named, not passed, because a server layout cannot hand a component to the browser.
const ICONS = { week: CalendarCheck, sessions: ListChecks, setup: Settings, overview: LayoutDashboard, teams: Users, people: UserRound, prs: GitPullRequest };

/** `exact`: only this path. `also`: other path prefixes that belong to this item. */
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; exact?: boolean; also?: string[] };

function isActive(path: string, n: NavItem) {
  const own = n.exact ? path === n.href : path === n.href || path.startsWith(`${n.href}/`);
  return own || !!n.also?.some((p) => path === p || path.startsWith(`${p}/`));
}

export function SidebarNav({ items, label }: { items: NavItem[]; label: string }) {
  const path = usePathname();
  return (
    <>
      <aside className="hidden w-56 shrink-0 border-r border-border md:block print:hidden">
        <nav className="sticky top-[57px] space-y-0.5 p-3 pt-6" aria-label={label}>
          {items.map((n) => {
            const Icon = ICONS[n.icon];
            const active = isActive(path, n);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <nav className="flex gap-1 overflow-x-auto border-b border-border px-4 py-2 md:hidden print:hidden" aria-label={label}>
        {items.map((n) => {
          const Icon = ICONS[n.icon];
          const active = isActive(path, n);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground"}`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
