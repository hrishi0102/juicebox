import Link from "next/link";
import { SetupRow } from "@/components/setup-row";
import { JoinCompany, type JoinOption } from "@/components/join-company";
import { ZeroGSetup } from "@/components/zero-g-setup";
import { ScanButton } from "@/components/pipeline-controls";
import { buttonVariants } from "@/components/ui/button";
import { githubLogin, githubTeams } from "@/lib/receipts/identity";
import { currentSource, getDataset, onLaptop } from "@/lib/server/data";
import { employeeTarget, targetHow } from "@/lib/server/employee";
import { dayTime, plural } from "@/lib/format";

export const metadata = { title: "Setup · My week · Receipts" };

// Set up once, on your laptop. After this, every week is: write, review, sign, send.
export default async function EmployeeSetup() {
  const source = await currentSource();
  const demo = source === "demo";
  const laptop = await onLaptop();
  const login = demo ? "you" : (await githubLogin())?.login;
  const gh = demo ? undefined : await githubTeams();
  const target = await employeeTarget(source);
  const d = getDataset(source);
  const options: JoinOption[] = gh
    ? [
        ...gh.teams.map((t) => ({ org: t.org, team: `${t.org}/${t.slug}`, teamName: t.name })),
        ...gh.orgs.filter((o) => !gh.teams.some((t) => t.org === o)).map((o) => ({ org: o, team: `${o}/everyone`, teamName: "Everyone" })),
      ]
    : [];
  const joined = demo || target.from === "settings";

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-balance text-4xl font-semibold tracking-tight">Set up once</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Four things on this laptop. After that, every week is the same: write, review, sign, send.
          {demo && " In the demo, the engineer is already set up; only Sign in with 0G is real."}
        </p>
      </div>

      {!laptop && !demo && (
        <p className="rounded-lg border border-border bg-card p-4 text-[15px]">
          This part runs on your own laptop, where your logs are. Clone the repo, run <code>npm install</code> and <code>npm run dev</code> in{" "}
          <code>web</code>, and open http://localhost:3000.
        </p>
      )}

      <ol className="space-y-4">
        <SetupRow n={1} title="Connect GitHub" done={!!login}>
          {demo ? (
            <p className="text-muted-foreground">The demo engineer is @you.</p>
          ) : login ? (
            <p>
              Connected as <span className="font-medium">@{login}</span>, through the GitHub login this laptop already has (the GitHub CLI or{" "}
              <code>GITHUB_TOKEN</code>). Receipts uses it to find your pull requests and to know your org and teams. There is no separate sign-in.
            </p>
          ) : (
            <p>
              Run <code>gh auth login</code> in a terminal (or put a <code>GITHUB_TOKEN</code> in <code>web/.env.local</code>), then reload this page.
            </p>
          )}
        </SetupRow>

        <SetupRow n={2} title="Join your company" done={joined}>
          <p className="text-muted-foreground">Your company is your GitHub org, and your team is your GitHub team. Your receipts go there.</p>
          {demo ? (
            <p>
              The demo engineer is on <span className="font-medium">Payments at Acme</span>.
            </p>
          ) : !login ? (
            <p className="text-muted-foreground">Connect GitHub first.</p>
          ) : options.length === 0 ? (
            <p>
              Your GitHub login is not in any org yet. Ask your company to add you on GitHub, or approve this app for the org (orgs that restrict OAuth
              apps hide themselves until an owner approves).
            </p>
          ) : (
            <>
              {target.from !== "default" && (
                <p>
                  {joined ? "Joined: " : "Right now your receipts would go to "}
                  <span className="font-medium">
                    {target.teamName} at {target.orgName}
                  </span>{" "}
                  ({targetHow(target)}).{!joined && " Pick a team to confirm it."}
                </p>
              )}
              <JoinCompany options={options} current={joined ? target.team : undefined} />
            </>
          )}
        </SetupRow>

        <ZeroGSetup n={3} />

        <SetupRow n={4} title="Read your logs" done={!!d}>
          <p className="text-muted-foreground">
            Claude Code and Codex already keep a log of every session on this laptop. Receipts reads them here, prices every call and links sessions
            to your pull requests. Nothing leaves the laptop for this step.
          </p>
          {d ? (
            <p>
              {plural(d.sessions.length, "session")} read{d.generatedAt ? `, last on ${dayTime(d.generatedAt)}` : ""}.
            </p>
          ) : null}
          {!demo && laptop && <ScanButton label={d ? "Read them again" : "Read my logs"} variant={d ? "outline" : "default"} />}
        </SetupRow>
      </ol>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold">Then, every week</h2>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Write my week (the private AI on 0G, paid from your 0G credits), review what your company will see, sign it, send it.
        </p>
        <Link href="/me" className={`${buttonVariants()} mt-3`}>
          Go to this week
        </Link>
      </div>
    </div>
  );
}
