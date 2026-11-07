import Link from "next/link";
import { createHash } from "node:crypto";
import { ArrowUpRight, BadgeCheck, ChevronLeft, Lock, TriangleAlert } from "lucide-react";
import { ProofAnchor } from "@/components/proof-links";
import { swarmPointer } from "@/lib/receipts/arkiv";
import { swarmConfig } from "@/lib/receipts/swarm";
import { arkivEntityUrl } from "@/lib/proof-urls";
import { currentSource } from "@/lib/server/data";
import { isMember, viewer } from "@/lib/server/viewer";

export const metadata = { title: "On Swarm · Juicebox" };

/** Ask the Swarm gateway for the bytes, and time it. */
async function fetchFromSwarm(url: string): Promise<{ bytes?: Buffer; error?: string; ms: number }> {
  const started = Date.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
    if (!r.ok) throw new Error(`the gateway answered ${r.status}`);
    return { bytes: Buffer.from(await r.arrayBuffer()), ms: Date.now() - started };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e), ms: Date.now() - started };
  }
}

// Proof that a week really sits on Swarm: this page fetches the file from the Swarm gateway right
// now (the gateway's own link downloads it instead of showing it) and shows what is there. When the
// visitor may open the company's lists, it also checks the file against the SHA-256 and size sealed
// inside the Arkiv record that points to it.
export default async function SwarmProof({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ entity?: string }> }) {
  const { ref } = await params;
  const { entity } = await searchParams;
  const gateway = swarmConfig().gateway;
  const raw = `${gateway}/bytes/${ref}`;
  if (!/^[0-9a-f]{64}$/.test(ref)) return <p className="wrapw pub text-[var(--mute)]">That is not a Swarm reference.</p>;

  const { bytes, error, ms } = await fetchFromSwarm(raw);
  const sha = bytes ? createHash("sha256").update(bytes).digest("hex") : undefined;

  // What the Arkiv record says, for those who may open it.
  let expected: Awaited<ReturnType<typeof swarmPointer>> | undefined;
  let mayCheck = false;
  if (entity && /^0x[0-9a-fA-F]{64}$/.test(entity)) {
    try {
      expected = await swarmPointer(entity);
      mayCheck = !!expected.org && isMember(await viewer(await currentSource()), expected.org) && expected.opened;
    } catch {
      expected = undefined;
    }
  }
  const matches = mayCheck && !!sha && expected?.sha256 === sha && (expected?.size === undefined || expected.size === bytes?.length);

  return (
    <div className="wrapw pt-11 max-[760px]:pt-7">
      <div className="max-w-[880px]">
        {entity && (
          <Link href={`/r/${entity}`} className="mw-back">
            <ChevronLeft className="size-4" aria-hidden="true" />
            Back to the shared receipt
          </Link>
        )}
        <div>
          <span className="svc">Swarm</span>
        </div>
        <h1 className="disp h-page mt-3">An encrypted week, fetched from Swarm just now</h1>
        <p className="lede mt-3.5">
          When someone sends their week, the full list is encrypted on their laptop and stored on Swarm. Arkiv keeps only the signed totals and this
          reference. Here is what anyone gets when they ask Swarm for it: ciphertext, which only the company&apos;s key can open.
        </p>

        {error || !bytes ? (
          <div className="errbox mt-7">
            <p className="font-semibold">Swarm did not return it just now</p>
            <p className="mt-1 text-sm text-[var(--mute)]">{error}. The testnet gateway can be slow; reload in a moment.</p>
          </div>
        ) : (
          <section className="pnl mt-7" aria-label="What Swarm returned">
            <dl className="pub-dl">
              <dt>Swarm reference</dt>
              <dd className="mono">{ref}</dd>
              <dt>Fetched from</dt>
              <dd>
                {gateway.replace(/^https?:\/\//, "")} in {(ms / 1000).toFixed(1)} s
              </dd>
              <dt>Size</dt>
              <dd className="num">{bytes.length.toLocaleString("en-US")} bytes</dd>
              <dt>SHA-256</dt>
              <dd className="mono">{sha}</dd>
              <dt>What it is</dt>
              <dd>AES-256-GCM ciphertext. Without the key it reads as noise:</dd>
            </dl>
            <div className="px-[22px] pb-[22px]">
              <pre className="hexbox print-in">{bytes.subarray(0, 96).toString("hex").match(/.{1,64}/g)?.join("\n")}…</pre>
            </div>
          </section>
        )}
        {bytes &&
          entity &&
          (mayCheck ? (
            <p className={`mt-4 flex items-start gap-2 text-[15px] font-medium ${matches ? "text-[var(--ok)]" : "text-[var(--bad)]"}`}>
              {matches ? <BadgeCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
              {matches ? "Matches the SHA-256 and size sealed inside the Arkiv record, opened with the company key." : "Does not match the SHA-256 sealed inside the Arkiv record."}
            </p>
          ) : (
            <p className="mt-4 flex max-w-[66ch] items-start gap-2.5 text-sm text-[var(--ink-2)]">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              The SHA-256 to expect is sealed inside the Arkiv record, for the company only. Members of the company can see the check here.
            </p>
          ))}

        <section className="mt-8" aria-labelledby="else-h">
          <h2 id="else-h" className="h-sub mb-3.5">
            Where it is referenced
          </h2>
          <ul className="proofs">
            {entity && (
              <li className="proof">
                <span className="svc">Arkiv</span>
                <div className="min-w-0">
                  <p className="proof-what">
                    The record that points here: its <span className="mono">swarm</span> attribute is this reference.
                  </p>
                  <div className="proof-go">
                    <ProofAnchor href={arkivEntityUrl(entity)}>The Arkiv record that points here</ProofAnchor>
                  </div>
                </div>
              </li>
            )}
            <li className="proof">
              <span className="svc">Swarm</span>
              <div className="min-w-0">
                <p className="proof-what">The raw bytes on the Swarm gateway. Your browser saves it as a file.</p>
                <div className="proof-go">
                  <span className="one inline-flex flex-wrap items-baseline gap-x-2">
                    <a href={raw} className="plink">
                      The raw bytes on the Swarm gateway
                      <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </a>
                    <span className="host">{gateway.replace(/^https?:\/\//, "").split("/")[0]}</span>
                  </span>
                </div>
              </div>
            </li>
            {entity && (
              <li className="proof">
                <span className="svc">Juicebox</span>
                <div className="min-w-0">
                  <p className="proof-what">The signed receipt this belongs to, with the checks.</p>
                  <div className="proof-go">
                    <ProofAnchor href={`/r/${entity}`}>The signed receipt this belongs to</ProofAnchor>
                  </div>
                </div>
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
