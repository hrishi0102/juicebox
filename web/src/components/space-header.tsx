"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";

// One space per role, each with the same top bar: the logo, a switcher between the spaces, then
// that space's tabs.
//   Company   leads and managers: everyone's signed week (Sign in with GitHub)
//   My week   an employee on their laptop: write, sign, send (Sign in with 0G pays the AI)
//   For fun   AI Wrapped, for anyone
//   (none)    the front door, the demo picker and public pages
export type Space = "company" | "employee" | "personal" | "public";

/** `exact`: only this path. `also`: other path prefixes that belong to this tab. */
export type NavItem = { href: string; label: string; exact?: boolean; also?: string[] };

const SPACES = [
  { id: "public", href: "/", title: "Front door", what: "What Juicebox is, and the demo" },
  { id: "employee", href: "/me", title: "My week", what: "Write, sign and send your weekly receipt" },
  { id: "company", href: "/company", title: "Company", what: "Everyone's signed week, for leads" },
  { id: "personal", href: "/wrapped", title: "AI Wrapped", what: "How you talk to AI, just for fun" },
] as const;

function isActive(path: string, n: NavItem) {
  const own = n.exact ? path === n.href : path === n.href || path.startsWith(`${n.href}/`);
  return own || !!n.also?.some((p) => path === p || path.startsWith(`${p}/`));
}

/** What the switcher says on a public page: the kind of page you are on. */
function publicLabel(path: string) {
  if (path.startsWith("/r/")) return "Shared link";
  if (path.startsWith("/verify")) return "Check a receipt";
  if (path.startsWith("/proof/0g")) return "On 0G";
  if (path.startsWith("/proof/swarm")) return "On Swarm";
  if (path.startsWith("/how")) return "How it works";
  if (path.startsWith("/demo")) return "Demo";
  return "Front door";
}

export function SpaceHeader({ space, title, right, nav, dark }: { space: Space; title?: React.ReactNode; right?: React.ReactNode; nav?: NavItem[]; dark?: boolean }) {
  const path = usePathname();
  const label = space === "public" ? publicLabel(path) : SPACES.find((s) => s.id === space)!.title;
  return (
    <header className={`t-bar print:hidden ${dark ? "t-dark" : ""}`}>
      <div className={`t-bar-in ${nav?.length ? "" : "t-no-tabs"}`}>
        <Link href="/" className="t-logo" aria-label="Juicebox, front door">
          <Logo dark={dark} />
          <span className="t-logo-word">Juicebox</span>
        </Link>
        <span className="t-vdiv t-hide-s" aria-hidden="true" />
        <Switcher current={space} label={title ? <>{title}</> : label} sub={space === "company" && title ? "company" : undefined} />
        {nav && nav.length > 0 && (
          <nav className="t-tabs" aria-label={label}>
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="t-tab" aria-current={isActive(path, n) ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="t-right">{right}</div>
      </div>
    </header>
  );
}

function Switcher({ current, label, sub }: { current: Space; label: React.ReactNode; sub?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const path = usePathname();
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  // A new page closes the menu.
  const [seen, setSeen] = useState(path);
  if (seen !== path) {
    setSeen(path);
    setOpen(false);
  }
  return (
    <div className="t-switch" ref={box}>
      <button type="button" className="t-switch-btn" aria-haspopup="true" aria-expanded={open} aria-controls="t-spaces" onClick={() => setOpen(!open)}>
        <span>{label}</span>
        {sub && <span className="t-sub">{sub}</span>}
        <ChevronDown className="chev size-4" aria-hidden="true" />
      </button>
      {open && (
        <nav className="t-menu" id="t-spaces" aria-label="Spaces">
          {SPACES.map((s) => {
            const here = s.id === current && (s.id !== "public" || path === "/");
            return (
              <Link key={s.id} href={s.href} className="t-mi" aria-current={here ? "page" : undefined}>
                <span className="t-mi-t">
                  {s.title}
                  {here && <Check className="size-4" aria-hidden="true" />}
                </span>
                <span className="t-mi-d">{s.what}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

/** A space with several pages: the top bar with its tabs, the page, and the footer. */
export function SpaceShell({ space, title, right, nav, footerNote, children }: { space: Space; title?: React.ReactNode; right?: React.ReactNode; nav: NavItem[]; footerNote?: string; children: React.ReactNode }) {
  return (
    <>
      <SpaceHeader space={space} title={title} right={right} nav={nav} />
      <main className="wrapw flex-1">{children}</main>
      <SiteFooter note={footerNote} />
    </>
  );
}

/**
 * The Juicebox mark: a juice box drawn in 3D, with a receipt printed on its front (torn at the
 * bottom) and a bendy straw. No text, no background, square. It is app/icon.svg, also the favicon.
 */
export function Logo({ size = 40 }: { dark?: boolean; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- one small SVG, no optimization needed
  return <img src="/icon.svg" width={size} height={size} alt="" className="shrink-0" />;
}
