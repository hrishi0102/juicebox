import { NextResponse } from "next/server";
import { rejectCrossSite } from "@/lib/server/guard";
import { WrappedCardInput, renderWrappedCard } from "@/lib/server/wrapped-card";

export const runtime = "nodejs";

// The AI Wrapped card as a PNG, drawn from numbers only. Nothing is stored.
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const parsed = WrappedCardInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Bad card data" }, { status: 400 });
  return renderWrappedCard(parsed.data);
}
