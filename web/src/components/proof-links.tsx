import Link from "next/link";
import { ExternalLink } from "lucide-react";

// "Check it yourself": for each service a receipt used (0G, Arkiv, Swarm), links to the places
// where anyone can see it really happened. No server imports, so it works in browser code too.

export type ProofLink = { label: string; href: string };
export type ProofGroup = { service: "0G" | "Arkiv" | "Swarm"; what: string; links: ProofLink[] };

const COLOR: Record<ProofGroup["service"], string> = { "0G": "var(--c-researched)", Arkiv: "var(--c-figured)", Swarm: "var(--c-wrote)" };

export function ProofLinks({ groups, title = "Check it yourself", className = "" }: { groups: ProofGroup[]; title?: string; className?: string }) {
  const shown = groups.filter((g) => g.links.length);
  if (!shown.length) return null;
  return (
    <section className={`rounded-xl border border-border bg-card p-4 ${className}`} aria-label={title}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-2 space-y-2.5">
        {shown.map((g) => (
          <li key={g.service} className="grid grid-cols-[4.5rem_1fr] gap-x-3 text-sm">
            <span className="inline-flex h-6 items-center justify-center rounded-md px-2 text-xs font-semibold" style={{ color: COLOR[g.service], background: `color-mix(in oklab, ${COLOR[g.service]} 12%, transparent)` }}>
              {g.service}
            </span>
            <div className="min-w-0">
              <div className="text-muted-foreground">{g.what}</div>
              <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1">
                {g.links.map((l) =>
                  l.href.startsWith("/") ? (
                    <Link key={l.href} href={l.href} className="font-medium text-primary hover:underline">
                      {l.label}
                    </Link>
                  ) : (
                    <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                      {l.label}
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  ),
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
