"use client";

// The "Sign in with 0G" item of the employee setup. Its state lives in the browser (0G's sign-in
// runs in this tab), so this row is drawn here rather than on the server.
import { Button } from "@/components/ui/button";
import { SetupRow } from "@/components/setup-row";
import { shortWallet, useZeroG } from "@/components/zero-g";
import { ZeroGElsewhere } from "@/components/zero-g-button";

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
        <p>
          Signed in as <code>{shortWallet(zg.wallet)}</code>
          {zg.balance ? `, ${zg.balance.text} left` : ""}.{" "}
          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={zg.signOut}>
            Sign out
          </button>
        </p>
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
