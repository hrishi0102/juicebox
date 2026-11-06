import Link from "next/link";

export function SiteFooter({ note = "Prompts never leave the employee's laptop.", dark }: { note?: string; dark?: boolean }) {
  return (
    <footer className={`t-foot print:hidden ${dark ? "t-dark" : ""}`}>
      <div className="t-foot-in">
        <p>{note}</p>
        <nav aria-label="Footer">
          <Link href="/how">How it works</Link>
          <Link href="/verify">Check a receipt</Link>
          <Link href="/demo">Try the demo</Link>
        </nav>
      </div>
    </footer>
  );
}
