import { BadgeCheck, CircleDashed, ExternalLink, TriangleAlert } from "lucide-react";
import { ZG_ACTIVITY, zgAddressUrl, zgIdentityUrl } from "@/lib/proof-urls";

export const metadata = { title: "On 0G · Receipts" };

// Proof that the private AI ran inside a TEE: 0G's router checks every provider's hardware
// attestation before it sends it private requests, and publishes its verdicts. This page reads them
// live and says what each one means.
const VERDICTS: Record<string, string> = {
  quote_dcap: "Hardware attestation quote (Intel DCAP)",
  onchain_signer: "Signing key matches the one registered on 0G Chain",
  measurement: "Code in the enclave matches what was expected",
  runtime_release: "Runtime release",
  compose_baseline: "App setup matches a published baseline",
};
const STATUS: Record<string, string> = { pass: "passed", fail: "failed", not_checked: "not run", no_baseline: "no baseline published" };

type Identity = { address?: string; endpoint?: string; verdicts?: Record<string, string>; os_image?: string; compose_hash?: string };

export default async function ZeroGProof({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(provider)) return <p className="text-muted-foreground">That is not a provider address.</p>;
  let id: Identity | undefined;
  let error: string | undefined;
  try {
    const r = await fetch(zgIdentityUrl(provider), { signal: AbortSignal.timeout(15_000), cache: "no-store" });
    if (!r.ok) throw new Error(`0G answered ${r.status}`);
    id = (await r.json()) as Identity;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const verdicts = Object.entries(id?.verdicts ?? {});
  const passed = verdicts.filter(([, v]) => v === "pass").length;
  const failed = verdicts.filter(([, v]) => v === "fail").length;
  const notRun = verdicts.length - passed - failed;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <p className="text-sm font-medium text-[var(--c-researched)]">On 0G</p>
        <h1 className="mt-1 text-balance text-3xl font-semibold tracking-tight">The provider that ran the private AI, checked by 0G</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Receipts only accepts answers from 0G providers whose model runs inside a hardware enclave (TEE). 0G&apos;s router checks each provider&apos;s
          attestation before sending it private requests, and publishes its verdicts. These are read from 0G right now.
        </p>
      </div>

      {error || !id ? (
        <div className="rounded-xl border border-destructive/40 bg-card p-5">
          <p className="font-medium">0G did not answer just now</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
      ) : (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <p className={`text-lg font-semibold ${failed ? "text-destructive" : "text-[var(--c-built)]"}`}>
            {failed ? `${failed} of ${passed + failed} checks failed` : `All ${passed} checks 0G ran passed`}
            {notRun ? <span className="font-normal text-muted-foreground"> ({notRun} not run)</span> : null}
          </p>
          <ul className="space-y-2">
            {verdicts.map(([k, v]) => (
              <li key={k} className="flex items-start gap-2.5 text-[15px]">
                {v === "pass" ? (
                  <BadgeCheck className="mt-0.5 size-5 shrink-0 text-[var(--c-built)]" aria-hidden="true" />
                ) : v === "fail" ? (
                  <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
                ) : (
                  <CircleDashed className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span>
                  {VERDICTS[k] ?? k}
                  <span className="ml-2 text-sm text-muted-foreground">{STATUS[v] ?? v.replace(/_/g, " ")}</span>
                </span>
              </li>
            ))}
          </ul>
          <dl className="grid gap-x-6 gap-y-2 border-t border-border pt-4 text-sm sm:grid-cols-[9rem_1fr]">
            <dt className="text-muted-foreground">Provider</dt>
            <dd className="break-all font-mono text-xs">{id.address ?? provider}</dd>
            {id.endpoint && (
              <>
                <dt className="text-muted-foreground">Endpoint</dt>
                <dd className="break-all">{id.endpoint}</dd>
              </>
            )}
            {id.os_image && (
              <>
                <dt className="text-muted-foreground">Enclave image</dt>
                <dd>{id.os_image}</dd>
              </>
            )}
            {id.compose_hash && (
              <>
                <dt className="text-muted-foreground">App hash</dt>
                <dd className="break-all font-mono text-xs">{id.compose_hash}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      <section className="space-y-2 text-sm">
        <h2 className="font-semibold">Check it somewhere else</h2>
        <ul className="space-y-1.5">
          <li>
            <a href={zgIdentityUrl(provider)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              0G&apos;s raw verdicts for this provider <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </li>
          <li>
            <a href={zgAddressUrl(provider)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              The provider on 0G ChainScan <ExternalLink className="size-3" aria-hidden="true" />
            </a>{" "}
            <span className="text-muted-foreground">(its registration on 0G&apos;s serving contract)</span>
          </li>
          <li>
            <a href={ZG_ACTIVITY} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Your own calls on pc.0g.ai <ExternalLink className="size-3" aria-hidden="true" />
            </a>{" "}
            <span className="text-muted-foreground">(sign in with the 0G account that paid; each call&apos;s request id is listed)</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
