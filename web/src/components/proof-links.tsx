import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

// "Check it yourself": for each service a receipt used (0G, Arkiv, Swarm), links to the places
// where anyone can see it really happened. Every outside link says what it proves and which site
// it opens; links to our own proof pages say "Opens here". No server imports, so it works in
// browser code too.

export type ProofLink = { label: string; href: string };
export type ProofGroup = { service: "0G" | "Arkiv" | "Swarm"; what: string; links: ProofLink[] };

/** "rabdi.explorer.arkiv.network" for an outside link, "Opens here" for one of our pages. */
export function hostOf(href: string) {
  if (href.startsWith("/")) return "Opens here";
  try {
    return new URL(href).host;
  } catch {
    return "";
  }
}

/** One proof link: what it proves, an external icon, and the host it opens. */
export function ProofAnchor({ href, children, host = true, className = "plink" }: { href: string; children: React.ReactNode; host?: boolean; className?: string }) {
  const inside = href.startsWith("/");
  return (
    <span className="one inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      {inside ? (
        <Link href={href} className={className}>
          {children}
        </Link>
      ) : (
        <a href={href} target="_blank" rel="noreferrer" className={className}>
          {children}
          <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
        </a>
      )}
      {host && <span className="host">{hostOf(href)}</span>}
    </span>
  );
}

export function ProofLinks({ groups, title = "Check it yourself", className = "" }: { groups: ProofGroup[]; title?: string; className?: string }) {
  const shown = groups.filter((g) => g.links.length);
  if (!shown.length) return null;
  return (
    <section className={className} aria-label={title}>
      <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="h-sub">{title}</h2>
        <span className="text-sm text-[var(--mute)]">Each link opens the place where the record lives</span>
      </div>
      <ul className="proofs">
        {shown.map((g) => (
          <li key={g.service + g.what} className="proof">
            <span className="svc">{g.service}</span>
            <div className="min-w-0">
              <p className="proof-what">{g.what}</p>
              <div className="proof-go">
                {g.links.map((l) => (
                  <ProofAnchor key={l.href + l.label} href={l.href}>
                    {l.label}
                  </ProofAnchor>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
