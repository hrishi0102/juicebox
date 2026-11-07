import Link from "next/link";
import { Lock } from "lucide-react";
import { EnterDemo } from "@/components/demo";
import { GithubMark } from "@/components/company-identity";
import { githubOAuthReady } from "@/lib/server/session";
import type { LoadedOrg } from "@/lib/server/org";

/** We do not know your company yet: sign in with GitHub (or try the demo). */
export function CompanyDoor() {
  return (
    <div className="mx-auto max-w-2xl py-14">
      <p className="text-sm font-semibold text-[var(--mute)]">For companies</p>
      <h1 className="disp h-page mt-2">See what your company got done with AI</h1>
      <p className="lede mt-5">
        Every week, each person sends a signed receipt from their laptop: what their AI sessions got done, the pull requests behind it, and what it
        cost. Never their prompts. Your company is your GitHub org, and your teams are your GitHub teams.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {githubOAuthReady() ? (
          <a href="/api/auth/login?next=/company" className="btn btn-primary btn-lg">
            <GithubMark />
            Sign in with GitHub
          </a>
        ) : (
          <Link href="/company/setup" className="btn btn-primary btn-lg">
            Set up GitHub sign-in
          </Link>
        )}
        <EnterDemo href="/company" className="btn btn-secondary btn-lg">
          Try the demo company
        </EnterDemo>
      </div>
      <p className="help mt-4">Sign-in only reads who you are and which orgs and teams you are in. It never sees your code.</p>
    </div>
  );
}

/** Shown when the lists stay closed for this viewer: not a member, or this copy has no company key. */
export function MemberNote({ org }: { org: LoadedOrg }) {
  const closed = org.rows.some((r) => r.swarm && !r.swarm.opened);
  if (!closed) return null;
  if (!org.member)
    return (
      <div className="banner mt-7">
        <Lock className="size-5 shrink-0" aria-hidden="true" />
        <p>
          You are seeing what everyone can see: the signed totals. The lists are sealed for {org.name.replace(/ \(demo company\)$/, "")}.{" "}
          {githubOAuthReady() ? (
            <>
              Sign in with GitHub as a member of <code>{org.id}</code> to open them.
            </>
          ) : (
            <>Open this page as a member of {org.id} to read them.</>
          )}
        </p>
        {githubOAuthReady() && (
          <a href="/api/auth/login?next=/company" className="btn btn-primary">
            <GithubMark />
            Sign in with GitHub
          </a>
        )}
      </div>
    );
  if (!org.hasCompanyKey)
    return (
      <div className="banner mt-7">
        <Lock className="size-5 shrink-0" aria-hidden="true" />
        <p>
          The lists are sealed with the company key, and this copy does not hold it. Open the company page where the key is kept (see{" "}
          <Link href="/company/setup" className="quiet">
            Setup
          </Link>
          ).
        </p>
      </div>
    );
  return null;
}

/** Week pills for the company pages. */
export function WeekPills({ weeks, week, href }: { weeks: string[]; week?: string; href: (w: string) => string }) {
  if (weeks.length < 2) return null;
  return (
    <nav className="seg" aria-label="Week">
      {[...weeks].reverse().map((w) => (
        <Link key={w} href={href(w)} aria-current={w === week ? "page" : undefined} className="seg-b">
          Week {w.split("-W")[1]}
        </Link>
      ))}
    </nav>
  );
}

/** Nobody has sent a receipt for this company yet. */
export function NothingShared({ org }: { org: LoadedOrg }) {
  return (
    <div className="card card-pad mt-9 max-w-2xl">
      <h2 className="h-small">No receipts sent yet</h2>
      <p className="mt-2 text-[var(--ink-2)]">
        When people in {org.name} sign and send their week, it shows up here. Each person runs Juicebox on their own laptop and joins{" "}
        <code>{org.id}</code> in My week, Setup.{" "}
        <Link href="/company/setup" className="quiet">
          How to invite them
        </Link>
      </p>
      {org.arkivError && <p className="help">Arkiv could not be reached: {org.arkivError.slice(0, 140)}.</p>}
    </div>
  );
}
