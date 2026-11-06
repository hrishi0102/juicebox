"use client";

// The "Sign in with 0G" item of the employee setup. Its state lives in the browser (0G's sign-in
// runs in this tab), so this row is drawn here rather than on the server.
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SetupRow } from "@/components/setup-row";
import { formatAmount, shortWallet, useZeroG } from "@/components/zero-g";
import { ZeroGElsewhere } from "@/components/zero-g-button";
import { ZG_ACTIVITY, ZG_BILLING, zgAddressUrl } from "@/lib/proof-urls";

export function ZeroGSetup({ n }: { n: number }) {
  const zg = useZeroG();
  return (
    <SetupRow n={n} title="Sign in with 0G" done={zg.signedIn}>
      <p className="text-muted-foreground">
        The private AI that writes your week runs on 0G, inside a hardware enclave. It is paid from your own 0G account: your iAI daily credits, or
        credits you add on pc.0g.ai. A week costs about a cent, and you see your balance go down each time.
      </p>
      {!zg.available ? (
        <ZeroGElsewhere />
      ) : zg.signedIn ? (
        <div className="space-y-3">
          <p>
            Signed in as <code>{shortWallet(zg.wallet)}</code>.{" "}
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={zg.signOut}>
              Sign out
            </button>
          </p>
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="text-sm text-muted-foreground">Balance you can spend now</div>
            <div className="text-2xl font-semibold tabular-nums">{zg.balance ? zg.balance.text : zg.balance === null ? "Not shown by 0G" : "Reading…"}</div>
            {zg.balance && (zg.balance.credits || zg.balance.pending) ? (
              <div className="mt-1 text-sm text-muted-foreground">
                {zg.balance.credits ? `Includes ${formatAmount(zg.balance.credits, zg.balance.usd)} of granted credit. ` : ""}
                {zg.balance.pending ? `${formatAmount(zg.balance.pending, zg.balance.usd)} of calls are still being charged.` : ""}
              </div>
            ) : null}
            <button type="button" className="mt-1 text-sm text-primary hover:underline" onClick={() => void zg.refreshBalance()}>
              Read it again
            </button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <a href={ZG_BILLING} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Your balance on pc.0g.ai <ExternalLink className="size-3" aria-hidden="true" />
            </a>
            <a href={ZG_ACTIVITY} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Your calls on pc.0g.ai <ExternalLink className="size-3" aria-hidden="true" />
            </a>
            {zg.wallet && (
              <a href={zgAddressUrl(zg.wallet)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                This account on 0G ChainScan <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Button onClick={zg.signIn} disabled={!zg.ready || zg.connecting}>
            {zg.connecting ? "Connecting to 0G" : "Sign in with 0G"}
          </Button>
          {zg.error && <p className="text-sm text-destructive">{zg.error}</p>}
        </div>
      )}
    </SetupRow>
  );
}
