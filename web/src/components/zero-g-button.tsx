"use client";

// A button for a private AI task, paid from your own 0G account. Not signed in: it signs you in
// with 0G first. After the task it shows how your 0G credits changed, which is the point: you can
// see your own balance go down by about a cent a week.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shortWallet, spentLine, useZeroG, ZERO_G_ORIGIN, type ZeroG } from "@/components/zero-g";

type Props = {
  label: string;
  busyLabel: string;
  /** Runs the task; returns the success message. */
  run: (zg: ZeroG, progress: (msg: string) => void) => Promise<string>;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline";
  /** Show "Paid from your 0G account 0xab…cd, $4.21 left" under the button. */
  accountLine?: boolean;
  icon?: boolean;
};

export function ZeroGButton({ label, busyLabel, run, size = "default", variant = "default", accountLine, icon }: Props) {
  const zg = useZeroG();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [spent, setSpent] = useState("");
  const [, start] = useTransition();

  if (!zg.available) return <ZeroGElsewhere />;

  async function go() {
    setBusy(true);
    setSpent("");
    const before = zg.balance;
    const t = toast.loading(`${busyLabel}. Paid from your 0G account.`);
    try {
      const msg = await run(zg, (m) => toast.loading(m, { id: t }));
      const after = await zg.refreshBalance();
      const line = spentLine(before, after);
      setSpent(line);
      toast.success(`${msg} ${line}`.trim(), { id: t, duration: 8000 });
      start(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e), { id: t });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      {zg.signedIn ? (
        <Button size={size} variant={variant} onClick={go} disabled={busy}>
          {icon && <Sparkles className="size-4" aria-hidden="true" />}
          {busy ? busyLabel : label}
        </Button>
      ) : (
        <Button size={size} variant={variant} onClick={zg.signIn} disabled={!zg.ready || zg.connecting}>
          {icon && <Sparkles className="size-4" aria-hidden="true" />}
          {zg.connecting ? "Connecting to 0G" : `Sign in with 0G to ${label.charAt(0).toLowerCase()}${label.slice(1)}`}
        </Button>
      )}
      {accountLine && (
        <p className="text-sm text-[var(--mute)]">
          {zg.signedIn
            ? `Paid from your 0G account ${shortWallet(zg.wallet)}${zg.balance ? ` (balance ${zg.balance.text})` : ""}.`
            : "The private AI is paid from your own 0G credits, about a cent a week."}
          {spent && <span className="ml-1 font-medium text-foreground">{spent}</span>}
        </p>
      )}
      {!accountLine && spent && <p className="text-sm font-medium">{spent}</p>}
    </div>
  );
}

/** On any other address than localhost:3000, say where Sign in with 0G works. */
export function ZeroGElsewhere() {
  const [local, setLocal] = useState<boolean | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the page address is only known in the browser
    setLocal(["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname));
  }, []);
  if (local === null) return null;
  if (!local) return <p className="text-sm text-muted-foreground">The private AI runs on each person&apos;s laptop, paid from their own 0G account with Sign in with 0G.</p>;
  return (
    <p className="text-sm text-muted-foreground">
      The private AI is paid with Sign in with 0G, which only works at{" "}
      <button type="button" className="quiet" onClick={() => (window.location.href = ZERO_G_ORIGIN + window.location.pathname + window.location.search)}>
        {ZERO_G_ORIGIN}
      </button>
      . Open this page there.
    </p>
  );
}
