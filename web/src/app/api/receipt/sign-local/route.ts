import { NextResponse } from "next/server";
import { currentSource, getDataset } from "@/lib/server/data";
import { signWithLocalKey } from "@/lib/server/receipts-store";

export async function POST(req: Request) {
  const { week } = (await req.json()) as { week: string };
  const source = await currentSource();
  const d = getDataset(source);
  if (!d) return NextResponse.json({ ok: false, error: "No data" }, { status: 404 });
  try {
    const r = await signWithLocalKey(source, d, week);
    return NextResponse.json({ ok: true, digest: r.digest, owner: r.message.owner });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
