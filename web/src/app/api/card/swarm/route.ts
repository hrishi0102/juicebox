import { NextResponse } from "next/server";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import { CardInput } from "@/lib/receipts/card";
import { publishCard } from "@/lib/receipts/cards";
import { countsLine } from "@/lib/receipts/aggregate";
import { arkivWriterAddress } from "@/lib/receipts/arkiv";
import { fileUrl, swarmReady, uploadFile } from "@/lib/receipts/swarm";
import { CATEGORIES, type Category } from "@/lib/receipts/types";
import { renderCard } from "@/lib/server/card-image";
import { currentSource, getDemoOrg, shareTarget } from "@/lib/server/data";
import { rejectCrossSite } from "@/lib/server/guard";
import { authorFor, ensureSignerAddress } from "@/lib/server/receipts-store";

export const runtime = "nodejs";
export const maxDuration = 60;

// "Get a Swarm link": the card you chose to make public is stored on Swarm, so a post can link to it
// for good, without any server of ours. A small Arkiv entity points to it (week, author, SHA-256),
// owned by you, so it shows on the wall. Only runs when the person clicks the button.
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  if (!swarmReady()) return NextResponse.json({ ok: false, error: "Swarm is not set up (SWARM_POSTAGE_BATCH_ID)." }, { status: 400 });
  const parsed = CardInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Bad card data" }, { status: 400 });
  const card = parsed.data;
  try {
    const png = new Uint8Array(await (await renderCard(card)).arrayBuffer());
    const ref = await uploadFile(png, `what-i-got-done-${card.week}.png`, "image/png");
    let entityKey: string | undefined;
    let arkivError: string | undefined;
    if (arkivWriterAddress()) {
      try {
        const source = await currentSource();
        const counts = Object.fromEntries(CATEGORIES.map((c) => [c, card.items.filter((i) => i.category === c).length])) as Record<Category, number>;
        const out = await publishCard({
          ref,
          sha256: bytesToHex(sha256(png)),
          size: png.length,
          period: card.week,
          author: await authorFor(source),
          org: source === "demo" ? (getDemoOrg()?.id ?? "acme") : (await shareTarget()).org,
          owner: ensureSignerAddress(source),
          done: card.items.filter((i) => i.category !== "Wasted").length,
          caption: card.sentence || countsLine(counts),
        });
        entityKey = out.entityKey;
      } catch (e) {
        arkivError = e instanceof Error ? e.message : String(e);
      }
    }
    return NextResponse.json({ ok: true, ref, url: fileUrl(ref), entityKey, arkivError });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
