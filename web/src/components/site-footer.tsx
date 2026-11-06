import Link from "next/link";

export function SiteFooter({ note = "Prompts never leave the employee's laptop." }: { note?: string }) {
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-wrap gap-x-6 gap-y-1 px-4 pb-8 pt-4 text-sm text-muted-foreground sm:px-6 print:hidden">
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
