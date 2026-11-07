import { Check, CircleDashed, TriangleAlert, X } from "lucide-react";
import { ProofAnchor } from "@/components/proof-links";
import { ZG_ACTIVITY, zgAddressUrl, zgIdentityUrl } from "@/lib/proof-urls";

export const metadata = { title: "On 0G · Juicebox" };

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
  if (!/^0x[0-9a-fA-F]{40}$/.test(provider)) return <p className="wrapw pub text-[var(--mute)]">That is not a provider address.</p>;
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
    <div className="wrapw pt-11 max-[760px]:pt-7">
      <div className="max-w-[880px]">
        <span className="svc">0G</span>
        <h1 className="disp h-page mt-3">The provider that ran the private AI, checked by 0G</h1>
        <p className="lede mt-3.5">
          Juicebox only accepts answers from 0G providers whose model runs inside a hardware enclave (TEE). 0G&apos;s router checks each provider&apos;s
          attestation before sending it private requests, and publishes its verdicts. These are read from 0G right now.
        </p>

        {error || !id ? (
          <div className="errbox mt-7">
            <p className="font-semibold">0G did not answer just now</p>
            <p className="mt-1 text-sm text-[var(--mute)]">{error}</p>
          </div>
        ) : (
          <section className="pnl ticks mt-7" aria-label="0G's verdicts">
            <div className={`verdict ${failed ? "bad" : "ok"} border-t-0`}>
              <span className={`ck ck-lg ${failed ? "ck-bad" : "ck-done"}`} aria-hidden="true">
                {failed ? <X className="size-4" strokeWidth={3} /> : <Check className="size-4" strokeWidth={3} />}
              </span>
              <div className="vt">
                {failed ? `${failed} of ${passed + failed} checks failed` : `All ${passed} checks 0G ran passed`}
                {notRun ? <span className="font-normal text-[var(--ink-2)]"> ({notRun} not run)</span> : null}
              </div>
            </div>
            <ol>
              {verdicts.map(([k, v]) => (
                <li key={k} className="check-row">
                  {v === "pass" ? (
                    <span className="ck ck-done" aria-hidden="true">
                      <Check className="size-[13px]" strokeWidth={3} />
                    </span>
                  ) : v === "fail" ? (
                    <span className="ck ck-bad" aria-hidden="true">
                      <TriangleAlert className="size-[13px]" />
                    </span>
                  ) : (
                    <span className="ck ck-pending" aria-hidden="true">
                      <CircleDashed className="size-[13px] text-[var(--mute)]" />
                    </span>
                  )}
                  <span>
                    {VERDICTS[k] ?? k}
                    <span className="d">{STATUS[v] ?? v.replace(/_/g, " ")}</span>
                  </span>
                </li>
              ))}
            </ol>
            <dl className="pub-dl border-t border-[var(--line)]">
              <dt>Provider</dt>
              <dd className="mono">{id.address ?? provider}</dd>
              {id.endpoint && (
                <>
                  <dt>Endpoint</dt>
                  <dd>{id.endpoint}</dd>
                </>
              )}
              {id.os_image && (
                <>
                  <dt>Enclave image</dt>
                  <dd>{id.os_image}</dd>
                </>
              )}
              {id.compose_hash && (
                <>
                  <dt>App hash</dt>
                  <dd className="mono">{id.compose_hash}</dd>
                </>
              )}
            </dl>
          </section>
        )}

        <section className="mt-8" aria-labelledby="else-h">
          <h2 id="else-h" className="h-sub mb-3.5">
            Check it somewhere else
          </h2>
          <ul className="proofs">
            <li className="proof">
              <span className="svc">0G</span>
              <div className="min-w-0">
                <p className="proof-what">0G&apos;s raw verdicts for this provider, as JSON.</p>
                <div className="proof-go">
                  <ProofAnchor href={zgIdentityUrl(provider)}>0G&apos;s raw verdicts for this provider</ProofAnchor>
                </div>
              </div>
            </li>
            <li className="proof">
              <span className="svc">0G</span>
              <div className="min-w-0">
                <p className="proof-what">Its registration on 0G&apos;s serving contract.</p>
                <div className="proof-go">
                  <ProofAnchor href={zgAddressUrl(provider)}>The provider on 0G ChainScan</ProofAnchor>
                </div>
              </div>
            </li>
            <li className="proof">
              <span className="svc">0G</span>
              <div className="min-w-0">
                <p className="proof-what">Sign in with the 0G account that paid; each call&apos;s request id is listed.</p>
                <div className="proof-go">
                  <ProofAnchor href={ZG_ACTIVITY}>Your own calls on pc.0g.ai</ProofAnchor>
                </div>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
