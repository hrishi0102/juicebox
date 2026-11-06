# Arkiv sharing

Code: `web/src/lib/receipts/arkiv.ts`. More detail for the Arkiv track in `/arkiv`.

## Network

Arkiv testnet Rabdi, chain 7794095, RPC `https://rpc.rabdi.db-chain.testnet.arkiv.network`, SDK `@arkiv-network/sdk` 1.0.1. Optional `ARKIV_ACCESS_KEY` for higher rate limits, `ARKIV_RPC_URL` to use another endpoint.

## Write (share)

`publishReceipt` re-verifies the receipt, strips evidence and judge leaves for a totals-only share, and creates one entity with schema `receipts-ethglobal-mumbai.receipt.v1`:

- Indexed: `type`, `org`, `team`, `period`, `signer`, `level`, `spendCents` (u64), `shipped`, `survivalBps`, `wasteBps` (i32)
- Not indexed: `digest`, `payload` (the signed JSON as bytes)
- Expires after 120 days

Writes are paid in tGLM by one writer wallet (`ARKIV_PRIVATE_KEY`). Authorship comes from the EIP-712 signature inside the payload, not from who paid gas. A full receipt estimates at about 827k gas (about 0.0012 tGLM). `explainArkivError` turns the SDK's vague errors into clear ones (for example an empty wallet).

## Read

- `fetchTeamReceipts(team, period?)`: query by attributes, decode payloads, re-verify each one. Unsigned or tampered receipts are dropped.
- `fetchOrgReceipts(org, period?)`: every team of a company in one query (paged by 100), re-verified. Used by the org view.
- `fetchReceiptByKey(key)`: one entity, for `/r/<key>` and the Verify page.
- The CRE job reads the same entities with a raw `arkiv_query` JSON-RPC call.

## Privacy

Arkiv is public. Only signed totals, and PR links plus per-task cost for "with evidence" shares, ever go there. Never prompts, titles, file names or session ids.
