import Link from "next/link";
import { Collapsible } from "@/components/collapsible";
import { ARKIV_EXPLORER } from "@/lib/receipts/arkiv";
import { CARD_SCHEMA_NAME, fetchCards, type CardRow } from "@/lib/receipts/cards";
import { swarmConfig } from "@/lib/receipts/swarm";
import { plural } from "@/lib/format";

export const metadata = { title: "The wall · Receipts" };

// Everyone's public cards. Each image lives on Swarm; a read-only Arkiv entity, owned by the person
// who made the card, says whose it is, which week, how much got done, and the image's SHA-256.
// This page only reads Arkiv and shows the images from a Swarm gateway: nothing here is ours.
export default async function Wall({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const sp = await searchParams;
  let cards: CardRow[] = [];
  let error: string | undefined;
  try {
    cards = await Promise.race([
      fetchCards({ org: sp.org, limit: 60 }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Arkiv did not answer within 6 seconds")), 6000)),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const gateway = swarmConfig().gateway;
  const orgs = [...new Set(cards.map((c) => c.org).filter(Boolean))];

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">What did people get done this week?</h1>
        <p className="mt-3 text-[15px] text-muted-foreground">
          Cards people chose to make public. Each image lives on Swarm, and a read-only Arkiv record, owned by the person who made it, says whose it
          is, which week and how much got done. Make yours from Share it, then Get a Swarm link.
        </p>
        {(orgs.length > 0 || sp.org) && (
          <div className="mt-4 flex flex-wrap gap-2 text-sm" role="group" aria-label="Company">
            <Link href="/wall" className={`rounded-full border px-3 py-1 ${!sp.org ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-card"}`}>
              Everyone
            </Link>
            {orgs.map((o) => (
              <Link
                key={o}
                href={`/wall?org=${encodeURIComponent(o)}`}
                className={`rounded-full border px-3 py-1 ${sp.org === o ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-card"}`}
              >
                {o}
              </Link>
            ))}
          </div>
        )}
      </div>

      {error ? (
        <p className="text-muted-foreground">Could not read the wall from Arkiv right now ({error}).</p>
      ) : cards.length === 0 ? (
        <div className="max-w-2xl rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">No public cards yet</h2>
          <p className="mt-2 text-muted-foreground">Open Share it, pick what goes on your card, and click Get a Swarm link. It shows up here.</p>
        </div>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <li key={c.key}>
              <figure className="overflow-hidden rounded-xl border border-border bg-card">
                <a href={`${gateway}/bzz/${c.ref}/`} target="_blank" rel="noreferrer" className="block bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element -- served by a Swarm gateway, not by us */}
                  <img src={`${gateway}/bzz/${c.ref}/`} alt={`${c.author}'s week: ${c.caption}`} loading="lazy" className="aspect-[4/5] w-full object-cover" />
                </a>
                <figcaption className="space-y-1 px-4 py-3 text-sm">
                  <div className="font-medium">
                    @{c.author || "someone"}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · Week {c.period.split("-W")[1]} · {plural(c.done, "thing")} done{c.org ? ` · ${c.org}` : ""}
                    </span>
                  </div>
                  <div className="text-muted-foreground">{c.caption}</div>
                  <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <a className="hover:text-foreground hover:underline" href={`${ARKIV_EXPLORER}/entity/${c.key}`} target="_blank" rel="noreferrer">
                      Arkiv record
                    </a>
                    <a className="hover:text-foreground hover:underline" href={`${gateway}/bzz/${c.ref}/`} target="_blank" rel="noreferrer">
                      Image on Swarm
                    </a>
                    <span title={`SHA-256 ${c.sha256}`}>{Math.round(c.size / 1024)} KB</span>
                  </div>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}

      <Collapsible title="How the wall works" hint="Arkiv lists, Swarm stores">
        <div className="max-w-[70ch] space-y-2 text-sm text-muted-foreground">
          <p>
            When you click Get a Swarm link, the card you see in the preview is uploaded to Swarm. Then one Arkiv entity (schema{" "}
            <code>{CARD_SCHEMA_NAME}</code>) is written read-only and handed to you: company, week, your GitHub login, things done, the Swarm
            reference, and the image&apos;s SHA-256 and size so anyone can check the bytes. It expires after 60 days.
          </p>
          <p>Query it yourself:</p>
          <pre className="overflow-x-auto rounded-md bg-background p-3 text-xs">{`arkiv.schema = str('${CARD_SCHEMA_NAME}') AND type = str('card')${sp.org ? ` AND org = str('${sp.org}')` : ""}`}</pre>
        </div>
      </Collapsible>
    </div>
  );
}
