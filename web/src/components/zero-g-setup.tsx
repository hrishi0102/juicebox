"use client";

// The "Sign in with 0G" item of the employee setup. Its state lives in the browser (0G's sign-in
// runs in this tab), so this row is drawn here rather than on the server.
import { Button } from "@/components/ui/button";
import { SetupRow } from "@/components/setup-row";
import { formatAmount, shortWallet, useZeroG } from "@/components/zero-g";
import { ZeroGElsewhere } from "@/components/zero-g-button";
import { ZG_ACTIVITY, ZG_BILLING, zgAddressUrl } from "@/lib/proof-urls";
import { ProofAnchor } from "@/components/proof-links";

export function ZeroGSetup({ n }: { n: number }) {
  const zg = useZeroG();
  return (
    <SetupRow n={n} title="Sign in with 0G" done={zg.signedIn}>
      <p>
        The private AI that writes your week runs on 0G, inside a hardware enclave. It is paid from your own 0G account: your iAI daily credits, or
        credits you add on pc.0g.ai. A week costs about a cent, and you see your balance go down each time.
      </p>
      {!zg.available ? (
        <ZeroGElsewhere />
      ) : zg.signedIn ? (
        <div className="flex flex-col gap-3">
          <p>
            Signed in as <span className="mono">{shortWallet(zg.wallet)}</span>.{" "}
            <button type="button" className="quiet" onClick={zg.signOut}>
              Sign out
            </button>
          </p>
          <div className="bal">
            <div className="bal-l">Balance you can spend now</div>
            <div className="bal-v">{zg.balance ? zg.balance.text : zg.balance === null ? "Not shown by 0G" : "Reading…"}</div>
            {zg.balance && (zg.balance.credits || zg.balance.pending) ? (
              <div className="mt-1 text-sm text-[var(--mute)]">
                {zg.balance.credits ? `Includes ${formatAmount(zg.balance.credits, zg.balance.usd)} of granted credit. ` : ""}
                {zg.balance.pending ? `${formatAmount(zg.balance.pending, zg.balance.usd)} of calls are still being charged.` : ""}
              </div>
            ) : null}
            <button type="button" className="quiet mt-1 self-start text-sm" onClick={() => void zg.refreshBalance()}>
              Read it again
            </button>
          </div>
          <div className="proof-go text-sm">
            <ProofAnchor href={ZG_BILLING}>Your balance on pc.0g.ai</ProofAnchor>
            <ProofAnchor href={ZG_ACTIVITY}>Your calls on pc.0g.ai</ProofAnchor>
            {zg.wallet && <ProofAnchor href={zgAddressUrl(zg.wallet)}>This account on 0G ChainScan</ProofAnchor>}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Button onClick={zg.signIn} disabled={!zg.ready || zg.connecting}>
            {zg.connecting ? "Connecting to 0G" : "Sign in with 0G"}
          </Button>
          {zg.error && <p className="text-sm text-[var(--bad)]">{zg.error}</p>}
        </div>
      )}
    </SetupRow>
  );
}
