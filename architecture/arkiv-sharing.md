# Arkiv sharing

Code: `web/src/lib/receipts/arkiv.ts`. More detail for the Arkiv track in `/arkiv`.

## Network

Arkiv testnet Rabdi, chain 7794095, SDK `@arkiv-network/sdk` 1.0.1. Optional `ARKIV_ACCESS_KEY` for higher rate limits (the public endpoint is heavily rate limited), `ARKIV_RPC_URL` to use another endpoint.

## Write (share with my company)

`publishReceipt` re-verifies the receipt, strips items, PRs and AI records for a totals-only share, and then sends **one transaction** (`executeBatch`):

1. **Create** one entity with schema `receipts-ethglobal-mumbai.receipt.v2`, flag `readonly: true` (nobody, not the company and not us, can ever patch it):
   - Indexed: `type`, `org` (GitHub org), `team` (`org/team-slug`), `period`, `signer`, `author` (GitHub login), `level`, `spendCents` (u64), `done`, `merged` (i32), `wasteCents` (u64)
   - Not indexed: `digest`, `payload` (the signed JSON as bytes)
   - Expires after 120 days
2. **Hand ownership** of that entity to the address that signed the receipt. The entity key is predicted first (`predictEntityKeys`) so both operations fit in the same transaction.

So the company wallet (`ARKIV_PRIVATE_KEY`) pays the gas, and the employee owns the record: they can let it expire or delete it, and nobody can edit it. Authorship comes from the EIP-712 signature inside the payload, not from who paid gas. A batch estimates at about 886k gas (about 0.0013 tGLM). `explainArkivError` turns the SDK's vague errors into clear ones (for example an empty wallet).

## Read

- `fetchOrgReceipts(org, period?)`: every team of a company in one query (paged by 100), each payload decoded and re-verified. Used by the company and team pages, with a 5 second limit so pages never hang on a slow endpoint.
- `fetchTeamReceipts(team, period?)`: one team, for the CLI and `/api/team`.
- `fetchReceiptByKey(key)`: one entity, for `/r/<key>` and the Verify page.
- The CRE job reads the same entities with a raw `arkiv_query` JSON-RPC call.

## Privacy

Arkiv is public. Only signed lists (category, title, cost), PR titles and links, AI request ids and totals go there. Never prompts, the AI's answers, file names or session ids. People can hide single items; they still count in the signed totals.
