import { NextResponse } from "next/server";
import { CardInput } from "@/lib/receipts/card";
import { rejectCrossSite } from "@/lib/server/guard";
import { renderCard } from "@/lib/server/card-image";

export const runtime = "nodejs";

// The share card as a PNG, drawn on this laptop from what the person picked. Nothing is stored.
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const parsed = CardInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Bad card data" }, { status: 400 });
  return renderCard(parsed.data);
}
