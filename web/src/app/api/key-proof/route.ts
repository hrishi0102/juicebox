import { NextResponse } from "next/server";
import { z } from "zod";
import { githubLogin } from "@/lib/receipts/identity";
import { currentSource, onLaptop } from "@/lib/server/data";
import { rejectCrossSite } from "@/lib/server/guard";
import { keyProofFor, publishKeyProof } from "@/lib/server/key-proofs";
import { signerAddress } from "@/lib/server/receipts-store";

// Prove that this laptop's signing key belongs to your GitHub login: "publish" puts a public gist
// on your own GitHub account (a short note signed by the key), "check" looks for it again.
const Body = z.object({ action: z.enum(["publish", "check"]) });

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  const source = await currentSource();
  if (source === "demo") return NextResponse.json({ ok: false, error: "The demo engineer has no GitHub account to prove." }, { status: 400 });
  if (!(await onLaptop())) return NextResponse.json({ ok: false, error: "This runs on your own laptop." }, { status: 400 });

  if (parsed.data.action === "publish") {
    const r = await publishKeyProof(source);
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  const me = await githubLogin();
  const address = signerAddress(source);
  if (!me || !address) return NextResponse.json({ ok: true, status: "none" });
  const p = await keyProofFor(me.login, address, { fresh: true });
  return NextResponse.json({ ok: true, ...p });
}
