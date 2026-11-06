"use client";

// The demo company, Acme: 12 made-up people in 3 teams, with signed weeks on Arkiv. You pick who
// you want to be on /demo, and a thin banner stays on top until you leave the demo.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { DEMO_ROLES } from "@/lib/demo-roles";

function roleFor(path: string) {
  if (path.startsWith("/company")) return DEMO_ROLES[0];
  if (path.startsWith("/me")) return DEMO_ROLES[1];
  if (path.startsWith("/r/")) return DEMO_ROLES[2];
  if (path.startsWith("/wrapped")) return DEMO_ROLES[3];
  return undefined;
}

async function setSource(source: "demo" | "local") {
  await fetch("/api/source", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source }) });
}

/** Switches to the demo company, then opens the page for that role. */
export function EnterDemo({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() =>
        start(async () => {
          await setSource("demo");
          router.push(href);
          router.refresh();
        })
      }
    >
      {children}
    </button>
  );
}

export function LeaveDemo({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() =>
        start(async () => {
          await setSource("local");
          router.push("/");
          router.refresh();
        })
      }
    >
      Leave the demo
    </button>
  );
}

export function DemoBanner() {
  const path = usePathname();
  const role = roleFor(path);
  return (
    <div className="t-demo print:hidden">
      <div className="t-demo-in">
        <p>Acme demo.{role ? ` You are ${role.short}.` : " Pick who you want to be."} Made-up people, real signatures.</p>
        <div className="t-demo-links">
          {DEMO_ROLES.filter((r) => r.id !== role?.id).map((r) => (
            <Link key={r.id} href={r.href}>
              {r.id === "fun" ? "Just for fun" : `Be ${r.short}`}
            </Link>
          ))}
          <LeaveDemo />
        </div>
      </div>
    </div>
  );
}
