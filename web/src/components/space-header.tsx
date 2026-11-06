import Link from "next/link";
import { SpaceTabs, type SpaceTab } from "@/components/space-tabs";

// Each part of the app has its own header, tabs and identity, so you always know where you are:
//   Company   leads and managers: everyone's signed week (Sign in with GitHub)
//   My week   an employee on their laptop: write, review, sign, send (Sign in with 0G pays the AI)
//   For fun   AI Wrapped, week cards and the wall, for anyone
//   (none)    the front door, the demo picker and public pages
export type Space = "company" | "employee" | "personal" | "public";

const SPACE: Record<Exclude<Space, "public">, { label: string; color: string }> = {
  company: { label: "Company", color: "var(--c-researched)" },
  employee: { label: "My week", color: "var(--c-built)" },
  personal: { label: "For fun", color: "var(--c-wrote)" },
};

export function SpaceHeader({ space, title, tabs, right }: { space: Space; title?: React.ReactNode; tabs?: SpaceTab[]; right?: React.ReactNode }) {
  const s = space === "public" ? undefined : SPACE[space];
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight" title="Receipts home">
          <Logo />
          <span className="text-[17px]">Receipts</span>
        </Link>
        {s && (
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium" style={{ borderColor: s.color, color: s.color }}>
            <span className="size-1.5 rounded-full" style={{ background: s.color }} aria-hidden="true" />
            {s.label}
          </span>
        )}
        {title && <span className="text-sm font-medium text-muted-foreground">{title}</span>}
        {tabs && tabs.length > 0 && <SpaceTabs tabs={tabs} />}
        <div className="ml-auto flex flex-wrap items-center gap-3">{right}</div>
      </div>
    </header>
  );
}

export function Logo() {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" aria-hidden="true" className="text-primary">
      <path
        d="M1 1h16v18l-2.7-1.6L11.6 19l-2.6-1.6L6.4 19l-2.7-1.6L1 19z"
        fill="var(--paper)"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M4.5 6h9M4.5 9h9M4.5 12h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
