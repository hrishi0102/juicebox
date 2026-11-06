import Link from "next/link";
import { createHash } from "node:crypto";
import { BadgeCheck, ExternalLink, TriangleAlert } from "lucide-react";
import { swarmPointer } from "@/lib/receipts/arkiv";
import { swarmConfig } from "@/lib/receipts/swarm";
import { arkivEntityUrl } from "@/lib/proof-urls";
import { currentSource } from "@/lib/server/data";
import { isMember, viewer } from "@/lib/server/viewer";

export const metadata = { title: "On Swarm · Receipts" };

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
  if (!/^[0-9a-f]{64}$/.test(ref)) return <p className="text-muted-foreground">That is not a Swarm reference.</p>;

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
    <div className="max-w-3xl space-y-8">
      <div>
        <p className="text-sm font-medium text-[var(--c-wrote)]">On Swarm</p>
        <h1 className="mt-1 text-balance text-3xl font-semibold tracking-tight">An encrypted week, fetched from Swarm just now</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          When someone sends their week, the full list is encrypted on their laptop and stored on Swarm. Arkiv keeps only the signed totals and this
          reference. Here is what anyone gets when they ask Swarm for it: ciphertext, which only the company&apos;s key can open.
        </p>
      </div>

      {error || !bytes ? (
        <div className="rounded-xl border border-destructive/40 bg-card p-5">
          <p className="font-medium">Swarm did not return it just now</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}. The testnet gateway can be slow; reload in a moment.</p>
        </div>
      ) : (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted-foreground">Swarm reference</dt>
            <dd className="break-all font-mono text-xs">{ref}</dd>
            <dt className="text-muted-foreground">Fetched from</dt>
            <dd className="break-all">
              {gateway.replace(/^https?:\/\//, "")} in {(ms / 1000).toFixed(1)} s
            </dd>
            <dt className="text-muted-foreground">Size</dt>
            <dd>{bytes.length.toLocaleString("en-US")} bytes</dd>
            <dt className="text-muted-foreground">SHA-256</dt>
            <dd className="break-all font-mono text-xs">{sha}</dd>
            <dt className="text-muted-foreground">What it is</dt>
            <dd>AES-256-GCM ciphertext. Without the key it reads as noise:</dd>
          </dl>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">{bytes.subarray(0, 96).toString("hex").match(/.{1,64}/g)?.join("\n")}…</pre>
          {entity &&
            (mayCheck ? (
              <p className={`flex items-start gap-2 text-sm ${matches ? "text-[var(--c-built)]" : "text-destructive"}`}>
                {matches ? <BadgeCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
                {matches
                  ? "Matches the SHA-256 and size sealed inside the Arkiv record, opened with the company key."
                  : "Does not match the SHA-256 sealed inside the Arkiv record."}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                The SHA-256 to expect is sealed inside the Arkiv record, for the company only. Members of the company can see the check here.
              </p>
            ))}
        </section>
      )}

      <section className="space-y-2 text-sm">
        <h2 className="font-semibold">Check it somewhere else</h2>
        <ul className="space-y-1.5">
          {entity && (
            <li>
              <a href={arkivEntityUrl(entity)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                The Arkiv record that points here <ExternalLink className="size-3" aria-hidden="true" />
              </a>{" "}
              <span className="text-muted-foreground">(its <code>swarm</code> attribute is this reference)</span>
            </li>
          )}
          <li>
            <a href={raw} className="inline-flex items-center gap-1 text-primary hover:underline">
              The raw bytes on the Swarm gateway <ExternalLink className="size-3" aria-hidden="true" />
            </a>{" "}
            <span className="text-muted-foreground">(your browser saves it as a file)</span>
          </li>
          {entity && (
            <li>
              <Link href={`/r/${entity}`} className="text-primary hover:underline">
                The signed receipt this belongs to
              </Link>
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
