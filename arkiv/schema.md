# Arkiv schema

One entity per shared week.

- Network: Arkiv testnet **Rabdi**, chain id `7794095`
- SDK: `@arkiv-network/sdk` 1.0.1
- Schema name: `receipts-ethglobal-mumbai.receipt.v2` (named schema, so every entity also carries the indexed `arkiv.schema` tag)
- Created with the **`readonly`** flag: nobody can patch it after it is written
- **Owned by the signer**: the same transaction hands ownership to the address that signed the receipt (`executeBatch` with a create and an ownership change, the key predicted with `predictEntityKeys`). The company wallet only pays the gas
- Lifetime: 120 days from publishing (`ExpirationTime.fromDays(120)`), well under the 182 day maximum
- Code: [`web/src/lib/receipts/arkiv.ts`](../web/src/lib/receipts/arkiv.ts)

| Attribute | Type | Indexed | Meaning |
|---|---|---|---|
| `type` | `str` | yes | Always `receipt` |
| `org` | `str` | yes | Company: a GitHub org login, for example `acme` |
| `team` | `str` | yes | Team: `org/team-slug` from GitHub, for example `acme/payments` (demo: `acme-payments`) |
| `period` | `str` | yes | ISO week, for example `2026-W45` |
| `signer` | `str` | yes | Lowercased address that signed the receipt (EIP-712); also the entity's owner |
| `author` | `str` | yes | GitHub login inside the signed receipt, or empty |
| `level` | `str` | yes | `sealed` (signed totals here, the full week encrypted on Swarm), `full` (everything in the payload) or `totals` |
| `spendCents` | `u64` | yes | Total AI spend for the week in US cents |
| `done` | `i32` | yes | Things done (items that were not Wasted) |
| `merged` | `i32` | yes | Merged pull requests |
| `wasteCents` | `u64` | yes | Spend on Wasted items, in US cents |
| `digest` | `str` | no | EIP-712 digest of the receipt |
| `payload` | `bytes` | no | The signed receipt JSON (see below), a few KB. For `sealed`, only the signed totals |
| `swarm` | `str` | no, optional | Swarm reference of the encrypted full week (64 hex) |
| `sealed` | `bytes` | no, optional | `{ ref, key, sha256, size }` sealed to the company's secp256k1 public key (ECIES). Bytes, because `str` attributes are limited to 128 bytes |

## Payload

The payload is the signed receipt (`kind: "receipts.v3"`; the first shares are `"receipts.v2"`), the same JSON a person can download from the app:

- `message`: the EIP-712 typed data that was signed: owner, GitHub login, week, spend, sessions, things done, items and spend per category (Built, Fixed, Figured out, Researched, Wrote, Planned, Wasted), merged PRs, spend per AI tool, three Merkle roots (`itemsRoot`, `evidenceRoot`, `judgeRoot`), and in v3 the efficiency numbers (step-time medians, PR counts, waste by reason, where the money went)
- `signature`: the owner's signature over `message`
- `items`: the whole list (category, title, cost, linked PRs). The employee cannot leave lines out or edit them, and readers rebuild `itemsRoot` from the items. (Receipts from an earlier version could leave lines out; each line they show carries a Merkle proof, and they still verify.)
- `evidence`: one leaf per PR (title, link, state, cost)
- `judges`: one leaf per session the private AI read on 0G (category, model, 0G request id, provider, hashes of exactly what was sent and answered)
- `oneLiner`: the AI's sentence about the week (display only)
- `share`: level, org, team, time

Never in the payload: prompts, the AI's answers, session titles, session ids (only their hashes inside AI leaves), file names, folder names.

## Sealed weeks (Swarm)

With Swarm set up, sharing uploads the full signed week to Swarm as AES-256-GCM ciphertext (encrypted on the laptop), and the entity's payload is the totals-only receipt with `level = sealed`. The company page opens `sealed` with the company key, downloads the ciphertext, checks its size and SHA-256, decrypts it, and checks that it is the same signed receipt (same digest, valid signature). Everyone else sees the signed totals. See [swarm.md](swarm.md).

## Card entity (no longer written)

An earlier version also wrote `receipts-ethglobal-mumbai.card.v1` entities, one per public week card (a PNG on Swarm). The app no longer makes cards: For fun is AI Wrapped only, which is never stored anywhere. The 12 card entities on Rabdi expire on their own, 60 days after they were written.

## System fields we read

Every read also selects these, so the app can show what Arkiv itself guarantees:

| Field | What we use it for |
|---|---|
| `$owner` | The person who signed the receipt (after the handover). The public receipt page says "Only they can delete it or keep it longer" |
| `$creator` | The company wallet that wrote it and paid the fee |
| `$creationFlags` | `readonly: true`, shown as "nobody can change it, not even its owner" |
| `$createdAt` | The block it was created at. When a week was sent twice, readers keep the one sent last |
| `$expiresAt` | The block it expires at, shown as a date (2 second blocks) |

The same fields are on the Arkiv explorer at `https://rabdi.explorer.arkiv.network/entity/<key>`, and the transaction page (`/tx/<hash>`) shows the create with the `readonly` flag, the expiry and the attributes, then the ownership transfer to the signer. Every page in the app that shows a receipt links there.

## Queries

Arkiv's public endpoint refuses anonymous queries (`ANON_COST_LIMITED`), so run these with a free access key from https://hub.arkiv.network/access-keys; the README has a ready `curl` command. Counts are from Nov 7.

A whole company's week (37 entities for week 45: 12 people, several of whom sent the week more than once; the app keeps the latest per person):
```
arkiv.schema = str('receipts-ethglobal-mumbai.receipt.v2') AND type = str('receipt') AND org = str('acme') AND period = str('2026-W45')
```

One team (40):
```
arkiv.schema = str('receipts-ethglobal-mumbai.receipt.v2') AND type = str('receipt') AND team = str('acme-payments')
```

Big weeks that went in circles (10):
```
arkiv.schema = str('receipts-ethglobal-mumbai.receipt.v2') AND org = str('acme') AND spendCents > u64(10000) AND wasteCents > u64(2000)
```

From code (what the company page does):

```ts
await publicClient
  .select({ $key: true, $owner: true, $creator: true, $createdAt: true, $expiresAt: true, $creationFlags: true, payload: true, swarm: true, sealed: true })
  .from(ReceiptSchema)
  .where(and(eq("type", "receipt"), eq("org", org)))
  .orderBy(desc("spendCents"))
  .limit(100)
  .fetch();
```
