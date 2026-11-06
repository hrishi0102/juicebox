# How Receipts uses Arkiv

Receipts tells a company what its AI spend got done: each employee sends a signed weekly receipt from their laptop, and the company reads everyone's. Arkiv is where those receipts live. It is the only shared storage in the product: there is no Receipts server, so the employee's app writes to Arkiv and the company's pages read from it.

## Who can do what, and when it expires

| Entity | Written by (pays the fee) | Owner after the write | Change it | Delete it, or keep it longer | Expires |
|---|---|---|---|---|---|
| Receipt (`receipts-ethglobal-mumbai.receipt.v2`), one per person per week sent | The company wallet | The employee who signed it | **Nobody, ever** (created `readonly`) | Only the employee | 120 days after sending |

An earlier version also wrote public week cards (`receipts-ethglobal-mumbai.card.v1`). The app no longer makes them; the 12 that exist on Rabdi expire on their own.

Why this fits:

- **Nobody can change a receipt, not even the person who wrote it.** A receipt is evidence at review time. If the company could edit it, it would not be the employee's evidence; if the employee could edit it after sending, it would not be evidence for the company. Arkiv's `readonly` flag makes this a property of the entity, not a promise of our code. (Read-only entities can still be extended, transferred or deleted by their owner, which is exactly the control we want the employee to keep.)
- **The employee owns it, not the company that paid for it.** One transaction (`executeBatch`) creates the entity and hands its ownership to the address that signed the receipt. The company wallet pays the small fee, so employees never need tGLM or a faucet, but it cannot delete or extend what it wrote.
- **It expires on its own.** Performance evidence should not live forever. 120 days covers a quarterly review with some slack. If the employee wants a week kept for a yearly review, they extend it themselves (`extendEntity`). We deliberately did not set `permissionlessExtension`: only the person a receipt describes decides how long it stays public.
- **A corrected week is a new entity.** Because receipts are read-only, sending a week again (after new sessions) writes a new entity. Readers keep one receipt per person per week: verified first, then the newest receipt format, Arkiv over local copies, opened lists over closed ones, and among equals the one sent last. The employee owns both and can delete the old one.

## Write path (the employee, on their laptop)

1. In My week, the private AI on 0G writes the week, paid from the employee's own 0G credits.
2. On the Send page they see the whole receipt the company will get, what everyone can check and what stays on the laptop. Nothing can be picked out or edited, so the company gets the whole week as the private AI wrote it. They sign it (EIP-712) with a key made on the laptop.
3. **Send to <company>**: `publishReceipt()` checks the signature again and sends **one transaction** with two operations:
   - **create** a `readonly` entity with indexed attributes (org, team, week, signer, GitHub login, numbers) and the signed JSON as a `bytes` payload, expiring after 120 days;
   - **change ownership** of that entity to the signer's address (its key is predicted first with `predictEntityKeys`, so both fit in one transaction).

With Swarm set up, the full week goes to Swarm encrypted and the entity keeps only the signed totals plus a pointer sealed to the company key (`level = sealed`). Arkiv stays the public, queryable index; Swarm holds the private details. See [swarm.md](swarm.md).

After sending, the Send page links to the new record and the transaction on the Arkiv explorer, so the employee (or a judge) can see the read-only flag, the expiry and the ownership transfer outside the app.

Code: [`publishReceipt` in web/src/lib/receipts/arkiv.ts](../web/src/lib/receipts/arkiv.ts), called from [`/api/share`](../web/src/app/api/share/route.ts) (the Send step of My week) and the CLI (`npm run receipts -- share 2026-W45`).

## Read path (what people see)

- **The company** (`/company`, Teams, People, Pull requests): one query by `org`, every payload decoded and its EIP-712 signature and Merkle roots re-verified, totals built only from signed fields, then everyone's list with their PRs. Sealed lists are opened from Swarm for members of the GitHub org.
- **Anyone with a link** (`/r/<entity key>`): one entity, checked, with its signed totals; the list stays sealed.
- **Check a receipt** (`/verify`): paste an Arkiv entity key and the app loads and checks it.
- **Check it yourself**: every page that shows a receipt links to it on the Arkiv explorer (`rabdi.explorer.arkiv.network/entity/<key>`), its transaction and its owner's address, and to the encrypted copy on Swarm (`/proof/swarm/<ref>`, which fetches it live). The links are built in [`web/src/lib/proof-urls.ts`](../web/src/lib/proof-urls.ts).
- **API** (`GET /api/team?team=...&period=...`), the **CLI** (`npm run receipts -- arkiv <team>`, `entity <key>`), and an optional Chainlink CRE job that reads the same entities with a raw `arkiv_query` call.

## Why the read side does not trust the write side

Anyone can write entities with our schema name. So the pages never trust an entity because it exists: they trust it because the payload carries a valid signature from the person it is about, and the indexed attributes are only used to find candidates. A forged or edited receipt is dropped on read, and the owner shown next to it is the address that signed it.

## Demo data

`npm run receipts -- publish-demo` writes the signed weeks of the fictional demo company (Acme, 12 people) to Arkiv, so the company side can be shown reading live data. Each demo week is signed by its own demo key and handed to it, so the 89 live receipts are owned by 12 different addresses.
