import Link from "next/link";
import { EnterDemo } from "@/components/demo";
import { GithubMark } from "@/components/company-identity";
import { buttonVariants } from "@/components/ui/button";
import { githubOAuthReady } from "@/lib/server/session";
import type { LoadedOrg } from "@/lib/server/org";

/** We do not know your company yet: sign in with GitHub (or try the demo). */
export function CompanyDoor() {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <p className="text-sm font-medium text-muted-foreground">For companies</p>
      <h1 className="mt-1 text-balance text-5xl font-semibold leading-[1.05] tracking-tight">See what your company got done with AI</h1>
      <p className="mt-5 text-lg text-muted-foreground">
        Every week, each person sends a signed receipt from their laptop: what their AI sessions got done, the pull requests behind it, and what it
        cost. Never their prompts. Your company is your GitHub org, and your teams are your GitHub teams.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {githubOAuthReady() ? (
          <a href="/api/auth/login?next=/company" className={buttonVariants({ size: "lg" })}>
            <GithubMark />
            Sign in with GitHub
          </a>
        ) : (
          <Link href="/company/setup" className={buttonVariants({ size: "lg" })}>
            Set up GitHub sign-in
          </Link>
        )}
        <EnterDemo href="/company" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Try the demo company
        </EnterDemo>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Sign-in only reads who you are and which orgs and teams you are in. It never sees your code.</p>
    </div>
  );
}

/** Shown when the lists stay closed for this viewer: not a member, or this copy has no company key. */
export function MemberNote({ org }: { org: LoadedOrg }) {
  const closed = org.rows.some((r) => r.swarm && !r.swarm.opened);
  if (!closed) return null;
  if (!org.member)
    return (
      <div className="max-w-3xl rounded-lg border border-border bg-card p-4 text-[15px]">
        You are seeing what everyone can see: the signed totals. The lists are sealed for {org.name.replace(/ \(demo company\)$/, "")}.{" "}
        {githubOAuthReady() ? (
          <>
            <a href="/api/auth/login?next=/company" className="text-primary hover:underline">
              Sign in with GitHub
            </a>{" "}
            as a member of <code>{org.id}</code> to open them.
          </>
        ) : (
          <>Open this page as a member of {org.id} to read them.</>
        )}
      </div>
    );
  if (!org.hasCompanyKey)
    return (
      <div className="max-w-3xl rounded-lg border border-border bg-card p-4 text-[15px]">
        The lists are sealed with the company key, and this copy does not hold it. Open the company page where the key is kept (see{" "}
        <Link href="/company/setup" className="text-primary hover:underline">
          Setup
        </Link>
        ).
      </div>
    );
  return null;
}

/** Week pills for the company pages. */
export function WeekPills({ weeks, week, href }: { weeks: string[]; week?: string; href: (w: string) => string }) {
  if (weeks.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-2 text-sm" role="group" aria-label="Week">
      {[...weeks].reverse().map((w) => (
        <Link
          key={w}
          href={href(w)}
          aria-current={w === week ? "page" : undefined}
          className={`rounded-full border px-3 py-1 ${w === week ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-card"}`}
        >
          Week {w.split("-W")[1]}
        </Link>
      ))}
    </div>
  );
}

/** Nobody has sent a receipt for this company yet. */
export function NothingShared({ org }: { org: LoadedOrg }) {
  return (
    <div className="max-w-2xl rounded-lg border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">No receipts sent yet</h2>
      <p className="mt-2 text-muted-foreground">
        When people in {org.name} sign and send their week, it shows up here. Each person runs Receipts on their own laptop and joins{" "}
        <code>{org.id}</code> in My week, Setup.{" "}
        <Link href="/company/setup" className="text-primary hover:underline">
          How to invite them
        </Link>
      </p>
      {org.arkivError && <p className="mt-2 text-sm text-muted-foreground">Arkiv could not be reached: {org.arkivError.slice(0, 140)}.</p>}
    </div>
  );
}
