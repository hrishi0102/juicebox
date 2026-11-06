import Link from "next/link";

export function SiteFooter({ note = "Prompts never leave the employee's laptop.", wide }: { note?: string; wide?: boolean }) {
  return (
    <footer className={`mx-auto flex w-full flex-wrap gap-x-6 gap-y-1 border-t border-border/60 px-4 py-5 text-sm text-muted-foreground sm:px-6 print:hidden ${wide ? "max-w-7xl" : "max-w-6xl"}`}>
      <span>{note}</span>
      <Link href="/how" className="hover:text-foreground">
        How it works
      </Link>
      <Link href="/verify" className="hover:text-foreground">
        Check a receipt
      </Link>
      <Link href="/demo" className="hover:text-foreground">
        Try the demo
      </Link>
    </footer>
  );
}
