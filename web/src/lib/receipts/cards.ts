// Public cards on Swarm, listed on Arkiv: "the files your users see".
//
// When someone clicks "Get a Swarm link", their card image (exactly what they chose to show) is
// stored on Swarm, and one small Arkiv entity points to it: who, which week, how much got done, the
// Swarm reference, and the image's SHA-256 and size so anyone can check the bytes. Like shared weeks,
// the entity is created read-only and handed to the person who made it. The wall page reads them.
/* eslint-disable @typescript-eslint/no-explicit-any -- query rows come back with SDK-generated shapes */

import { ExpirationTime } from "@arkiv-network/sdk";
import { and, desc, eq } from "@arkiv-network/sdk/query";
import { defineSchema, i32, str, u64 } from "@arkiv-network/sdk/schema";
import type { Address } from "viem";
import { arkivPublic, arkivWriter, explainArkivError } from "./arkiv";

export const CARD_SCHEMA_NAME = "receipts-ethglobal-mumbai.card.v1";

export const CardSchema = defineSchema(CARD_SCHEMA_NAME, {
  type: str().indexed(), // always "card"
  org: str().indexed(), // company (GitHub org), or "" for a personal card
  period: str().indexed(), // ISO week, e.g. 2026-W45
  author: str().indexed(), // GitHub login or handle
  signer: str().indexed(), // lowercased address that owns the entity
  done: i32().indexed(), // things done on the card
  swarm: str(), // Swarm reference of the PNG: <gateway>/bzz/<ref>/
  sha256: str(), // SHA-256 of the PNG, to check the bytes
  size: u64(), // PNG size in bytes
  mediaType: str(), // image/png
  caption: str(), // short text, at most 120 characters
});

export type CardMeta = { ref: string; sha256: string; size: number; period: string; author: string; org: string; owner: Address; done: number; caption: string };

export async function publishCard(c: CardMeta) {
  const { account, wallet } = arkivWriter();
  const values = {
    type: "card",
    org: c.org,
    period: c.period,
    author: c.author,
    signer: c.owner.toLowerCase(),
    done: c.done,
    swarm: c.ref,
    sha256: c.sha256,
    size: u64(BigInt(c.size)),
    mediaType: "image/png",
    caption: c.caption.length > 120 ? c.caption.slice(0, 117).replace(/\s+\S*$/, "") + "..." : c.caption,
  };
  const expiration = ExpirationTime.fromDays(60);
  try {
    if (c.owner.toLowerCase() === account.address.toLowerCase()) {
      const { entityKey, txHash } = await wallet.createEntity(CardSchema, values, { expiration, flags: { readonly: true } });
      return { entityKey: entityKey as string, txHash: txHash as string };
    }
    const [next] = await arkivPublic().predictEntityKeys({ owner: account.address, count: 1 });
    const out = await wallet.executeBatch({
      creates: [{ schema: CardSchema, values, expiration, flags: { readonly: true }, salt: next.salt }],
      ownershipChanges: [{ entityKey: next.key, newOwner: c.owner }],
    });
    return { entityKey: (out.createdEntities[0] ?? next.key) as string, txHash: out.txHash as string };
  } catch (e) {
    throw new Error(explainArkivError(e, account.address));
  }
}

export type CardRow = { key: string; owner: string; org: string; period: string; author: string; done: number; ref: string; sha256: string; size: number; caption: string };

const v = (x: any) => (x && typeof x === "object" && "value" in x ? x.value : x);

/** The newest public cards, optionally for one company. */
export async function fetchCards(opts: { org?: string; limit?: number } = {}): Promise<CardRow[]> {
  const where = opts.org ? and(eq("type", "card"), eq("org", opts.org)) : eq("type", "card");
  const { entities } = await arkivPublic()
    .select({ $key: true, $owner: true, org: true, period: true, author: true, done: true, swarm: true, sha256: true, size: true, caption: true })
    .from(CardSchema)
    .where(where)
    .orderBy(desc("period"))
    .limit(opts.limit ?? 60)
    .fetch();
  return (entities as any[])
    .map((e) => ({
      key: String(v(e.$key)),
      owner: String(v(e.$owner) ?? ""),
      org: String(v(e.org) ?? ""),
      period: String(v(e.period) ?? ""),
      author: String(v(e.author) ?? ""),
      done: Number(v(e.done) ?? 0),
      ref: String(v(e.swarm) ?? ""),
      sha256: String(v(e.sha256) ?? ""),
      size: Number(v(e.size) ?? 0),
      caption: String(v(e.caption) ?? ""),
    }))
    .filter((c) => /^[0-9a-f]{64}$/.test(c.ref));
}
