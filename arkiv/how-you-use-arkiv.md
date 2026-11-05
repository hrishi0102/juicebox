# How Receipts uses Arkiv

Arkiv is where a weekly receipt goes when its owner decides to share it with the team. It is the only shared storage in the product.

## Write path

1. The engineer signs their weekly receipt (EIP-712) on their own machine.
2. They pick how much to share: **totals only** (headline numbers) or **with evidence** (adds PR links, per-task cost and survival, and 0G judge records).
3. `publishReceipt()` checks the signature again, strips evidence for a totals share, and creates one entity with indexed attributes (team, week, signer, numbers) and the signed JSON as a `bytes` payload. It expires after 120 days.

Code: [`publishReceipt` in web/src/lib/receipts/arkiv.ts](../web/src/lib/receipts/arkiv.ts), called from [`/api/share`](../web/src/app/api/share/route.ts) (buttons "Share totals with team" and "Share with evidence" on the home page) and from the CLI (`npm run receipts -- share 2026-W45`).

## Read path (what users see)

- **Team page** (`/team`): queries every entity for the team, decodes each payload, re-verifies the EIP-712 signature and both Merkle roots, and builds team totals only from signed fields. Receipts that fail the check are ignored. This is the manager's view: totals plus the receipts people chose to share, never prompts.
- **Verify page** (`/verify`): paste an Arkiv entity key, and the app loads the entity and checks it.
- **API** (`GET /api/team?team=...&period=...`): the same read for other tools, for example a monthly scoring job.
- **CLI**: `npm run receipts -- arkiv acme-payments` prints what is on Arkiv for a team.

## Why the read side does not trust the write side

Anyone can write entities with our schema name. So the team view never trusts an entity because it exists: it trusts it because the payload carries a valid signature from the person it claims to be about, and the indexed attributes are only used to find candidates. A forged or edited receipt is dropped on read.

## Expiry

Receipts are useful for a review cycle, not forever. 120 days covers a quarter plus some slack. An owner can extend an entity (`extendEntity`) if they want it to live longer, or simply re-share.

## Demo data

`npm run receipts -- publish-demo` writes the signed receipts of the fictional demo team (`acme-payments`) to Arkiv, so the team page can be shown reading live data. Each demo receipt is signed by its own demo key; the entities are all written by one funded writer wallet.
