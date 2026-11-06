# How Receipts uses Arkiv

Arkiv is where a person's week goes when they share it with their company. It is the only shared storage in the product.

## Write path

1. The person's private AI writes their week ("what did you get done this week?") and they sign it (EIP-712) with a key made on their laptop.
2. They click **Share with my company**. The company is their GitHub org and the team is their GitHub team.
3. `publishReceipt()` checks the signature again and sends **one transaction** with two operations:
   - **create** a `readonly` entity with indexed attributes (org, team, week, signer, GitHub login, numbers) and the signed JSON as a `bytes` payload, expiring after 120 days;
   - **change ownership** of that entity to the signer's address.

So the company wallet pays the gas, but the record belongs to the employee and nobody can edit it. This is our answer to "the person who signs should own the record, without every employee going through a faucet".

Code: [`publishReceipt` in web/src/lib/receipts/arkiv.ts](../web/src/lib/receipts/arkiv.ts), called from [`/api/share`](../web/src/app/api/share/route.ts) (the "Share with my company" button) and the CLI (`npm run receipts -- share 2026-W45`).

## Read path (what users see)

- **Company page** (`/org`): one query by `org`, every payload decoded and its EIP-712 signature and Merkle roots re-verified, totals built only from signed fields, then everyone's list with their PRs.
- **Team page** (`/team`): the same, for one team.
- **Shared receipt page** (`/r/<entity key>`): one entity, checked and shown with its list.
- **Verify page** (`/verify`): paste an Arkiv entity key and the app loads and checks it.
- **API** (`GET /api/team?team=...&period=...`) and **CLI** (`npm run receipts -- arkiv <team>`).

## Why the read side does not trust the write side

Anyone can write entities with our schema name. So the pages never trust an entity because it exists: they trust it because the payload carries a valid signature from the person it is about, and the indexed attributes are only used to find candidates. A forged or edited receipt is dropped on read.

## Expiry

Weeks are useful for a review cycle, not forever. 120 days covers a quarter plus some slack. The owner can extend their entity (`extendEntity`) if they want it to live longer.

## Demo data

`npm run receipts -- publish-demo` writes the signed weeks of the fictional demo company (Acme, 12 people) to Arkiv, so the company page can be shown reading live data. Each demo week is signed by its own demo key and handed to it.
