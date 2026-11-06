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
  if (["/wrapped", "/card", "/wall"].some((p) => path.startsWith(p))) return DEMO_ROLES[3];
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

export function LeaveDemo({ className = "font-medium underline underline-offset-2" }: { className?: string }) {
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
    <div className="border-b border-amber-300/60 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100 print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 text-sm sm:px-6">
        <span>
          <span className="font-medium">Demo:</span> Acme, 12 made-up people.{role ? ` You are ${role.short}.` : " Pick who you want to be."}
        </span>
        <span className="flex flex-wrap gap-x-3">
          {DEMO_ROLES.filter((r) => r.id !== role?.id).map((r) => (
            <Link key={r.id} href={r.href} className="underline-offset-2 hover:underline">
              {r.id === "fun" ? "Just for fun" : `Be ${r.short}`}
            </Link>
          ))}
        </span>
        <span className="ml-auto">
          <LeaveDemo />
        </span>
      </div>
    </div>
  );
}
