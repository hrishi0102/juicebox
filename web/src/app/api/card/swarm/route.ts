import { NextResponse } from "next/server";
import { CardInput } from "@/lib/receipts/card";
import { fileUrl, swarmReady, uploadFile } from "@/lib/receipts/swarm";
import { renderCard } from "@/lib/server/card-image";
import { rejectCrossSite } from "@/lib/server/guard";

export const runtime = "nodejs";
export const maxDuration = 60;

// "Get a Swarm link": the card you chose to make public is stored on Swarm, so a post can link to
// it for good, without any server of ours. Only runs when the person clicks the button.
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  if (!swarmReady()) return NextResponse.json({ ok: false, error: "Swarm is not set up (SWARM_POSTAGE_BATCH_ID)." }, { status: 400 });
  const parsed = CardInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Bad card data" }, { status: 400 });
  try {
    const png = new Uint8Array(await (await renderCard(parsed.data)).arrayBuffer());
    const ref = await uploadFile(png, `what-i-got-done-${parsed.data.week}.png`, "image/png");
    return NextResponse.json({ ok: true, ref, url: fileUrl(ref) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
