"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "My week" },
  { href: "/sessions", label: "My sessions" },
  { href: "/team", label: "Team" },
  { href: "/org", label: "Company" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Main">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-2.5 py-1 transition-colors ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
