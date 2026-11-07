import { headers } from "next/headers";
import { SetupRow } from "@/components/setup-row";
import { arkivPublic, arkivWriterAddress, companyPublicKey } from "@/lib/receipts/arkiv";
import { envPrivateKey } from "@/lib/receipts/keys";
import { swarmConfig, swarmReady } from "@/lib/receipts/swarm";
import { currentSource, getDemoOrg, shareTarget } from "@/lib/server/data";
import { companyKnown } from "@/lib/server/org";
import { githubOAuthReady } from "@/lib/server/session";
import { shortAddr } from "@/lib/format";
import { arkivAddressUrl } from "@/lib/proof-urls";
import { ProofAnchor } from "@/components/proof-links";

export const metadata = { title: "Setup · Company · Receipts" };

async function walletBalance(address?: string) {
  if (!address) return undefined;
  try {
    const wei = await Promise.race([arkivPublic().getBalance({ address: address as `0x${string}` }), new Promise<never>((_, no) => setTimeout(() => no(new Error("timeout")), 4000))]);
    return Number(wei) / 1e18;
  } catch {
    return undefined;
  }
}

// For whoever runs Receipts for the company: what this copy has, what to give employees, and
// what must stay here. Read-only: everything is set in web/.env.local.
export default async function CompanySetup() {
  const source = await currentSource();
  const demo = source === "demo";
  const known = await companyKnown(source);
  const target = known && !demo ? await shareTarget() : undefined;
  const demoOrg = demo ? getDemoOrg() : undefined;
  const writer = arkivWriterAddress();
  const balance = await walletBalance(writer);
  const pub = companyPublicKey();
  const ownKey = !!envPrivateKey("COMPANY_PRIVATE_KEY");
  const holdsKey = ownKey || !!writer;
  const sw = swarmConfig();
  const host = (await headers()).get("host") ?? "localhost:3000";
  const origin = `${host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https"}://${host}`;

  // The same six checks as the rows below, for the progress line.
  const done = [known, githubOAuthReady(), !!writer && (balance ?? 1) > 0, holdsKey && !!pub, swarmReady(), false];
  const count = done.filter(Boolean).length;

  return (
    <div className="co max-w-[920px]">
      <div>
        <h1 className="disp h-page">Set up your company</h1>
        <p className="page-sub">
          Once, by whoever runs Receipts for the company. Everything here is set in <code>web/.env.local</code>; this page only checks it.
        </p>
      </div>
      <div className="mt-7 flex flex-wrap items-center gap-3.5 text-[15px]">
        <span className="progress-dots" aria-hidden="true">
          {done.map((d, i) => (
            <span key={i} className={d ? "on" : ""} />
          ))}
        </span>
        <span>
          <strong>
            {count} of {done.length} done.
          </strong>{" "}
          {count === done.length - 1 ? "The last step is yours: invite your people." : "Each step below says what is missing."}
        </span>
      </div>

      <ol className="su-list mt-5">
        <SetupRow n={1} title="Your company on GitHub" done={known}>
          {demo ? (
            <p>
              Acme (demo), with {demoOrg?.teams.length ?? 3} teams: {demoOrg?.teams.map((t) => t.name).join(", ")}.
            </p>
          ) : target ? (
            <p>
              <span className="font-medium">{target.orgName}</span> (<code>{target.org}</code>), from{" "}
              {target.from === "settings" ? "this laptop's settings" : target.from === "github sign-in" ? "your GitHub sign-in" : "this laptop's GitHub login"}.
              Teams are your GitHub teams.
            </p>
          ) : (
            <p>Sign in with GitHub on the Overview page, or join your company on this laptop (My week, Setup).</p>
          )}
        </SetupRow>

        <SetupRow n={2} title="Sign in with GitHub, for leads" done={githubOAuthReady()}>
          <p className="text-[var(--mute)]">
            Leads and managers sign in with GitHub to open the lists. It only reads who they are and which orgs and teams they are in.
          </p>
          {githubOAuthReady() ? (
            <p>Set up. The callback for this address is <code>{origin}/api/auth/callback</code>.</p>
          ) : (
            <p>
              Create an OAuth App on GitHub (Settings, Developer settings) with the callback <code>{origin}/api/auth/callback</code>, then put{" "}
              <code>GITHUB_CLIENT_ID</code> and <code>GITHUB_CLIENT_SECRET</code> in <code>web/.env.local</code>. If your org restricts OAuth apps, an owner
              has to approve it.
            </p>
          )}
        </SetupRow>

        <SetupRow n={3} title="A wallet that pays for the records" done={!!writer && (balance ?? 1) > 0}>
          <p className="text-[var(--mute)]">
            Each receipt is one Arkiv record. This wallet pays the small fee, then hands the record to the person who signed it, so the company never
            owns or edits it.
          </p>
          {writer ? (
            <p>
              <code>{shortAddr(writer)}</code>
              {balance === undefined ? ", balance unknown right now" : `, ${balance.toFixed(4)} tGLM`}
              {balance === 0 && (
                <>
                  . Empty: claim test tGLM at{" "}
                  <ProofAnchor href="https://hub.arkiv.network/faucet">the Arkiv faucet</ProofAnchor>
                </>
              )}
              .
            </p>
          ) : null}
          {writer ? (
            <p className="proof-go mt-0">
              <ProofAnchor href={arkivAddressUrl(writer)}>Every record it wrote, on the Arkiv explorer</ProofAnchor>
            </p>
          ) : (
            <p>
              Not set. Put a key funded with tGLM (from the Arkiv faucet) in <code>ARKIV_PRIVATE_KEY</code>.
            </p>
          )}
        </SetupRow>

        <SetupRow n={4} title="The company key, which opens the lists" done={holdsKey && !!pub}>
          <p className="text-[var(--mute)]">
            Employees encrypt their list to the company&apos;s public key on their laptop. Only the private key opens it, so only this copy (and members
            signed in to it) can read the lists.
          </p>
          {pub ? (
            <p className="break-all">
              Public key: <code>{pub}</code>
            </p>
          ) : (
            <p>Not set. It comes from <code>COMPANY_PRIVATE_KEY</code>, or from the wallet key above.</p>
          )}
          {holdsKey && !ownKey && (
            <p className="warnbox">
              Right now the company key is the same as the wallet key. That is fine for the demo. Before you give employees a wallet for the fees, set a
              separate <code>COMPANY_PRIVATE_KEY</code> here, and give them only <code>COMPANY_PUBLIC_KEY</code>.
            </p>
          )}
        </SetupRow>

        <SetupRow n={5} title="Storage for the lists (Swarm)" done={swarmReady()}>
          <p className="text-[var(--mute)]">The encrypted lists are stored on Swarm. Without it, a list would be public on Arkiv.</p>
          {swarmReady() ? <p>Uploads go to <code>{sw.api}</code>.</p> : <p>Not set. Add the <code>SWARM_*</code> lines from <code>web/.env.example</code>.</p>}
        </SetupRow>

        <SetupRow n={6} title="Invite your people" done={false}>
          <p>
            Each person runs Receipts on their own laptop: clone the repo, then <code>npm install</code> and <code>npm run dev</code> in <code>web</code>, and
            open http://localhost:3000. In My week, Setup they connect GitHub, join {target?.orgName ?? "your company"}, and sign in with 0G. They pay for
            the private AI themselves, from their own 0G credits; the company hands out no AI key.
          </p>
          <p>Their <code>web/.env.local</code> needs only:</p>
          <div className="envbox">
            <pre>{`ARKIV_PRIVATE_KEY=<a wallet with a little tGLM, it only pays the fees>
COMPANY_PUBLIC_KEY=${pub ?? "<the public key above>"}
SWARM_API_URL=${sw.api}
SWARM_GATEWAY_URL=${sw.gateway}
SWARM_POSTAGE_BATCH_ID=${sw.batch ?? "<your batch id>"}`}</pre>
          </div>
          <p className="text-sm text-[var(--mute)]">Never give anyone the company&apos;s private key: it opens everyone&apos;s lists.</p>
        </SetupRow>
      </ol>
    </div>
  );
}
