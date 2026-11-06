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

With Swarm set up (`SWARM_*` env), a full share is **sealed** instead: the full signed week is encrypted on the laptop (AES-256-GCM, `seal.ts`), uploaded to Swarm (`swarm.ts`, waiting until it is on the network), and the entity keeps only the totals-only receipt (`level = sealed`) plus `swarm` (the reference) and `sealed` (bytes: `{ref, key, sha256, size}` sealed with ECIES to the company's secp256k1 public key, which is `COMPANY_PUBLIC_KEY` or derived from the company key, by default the Arkiv wallet). `str` attributes stop at 128 bytes, so `sealed` is `bytes`.

So the company wallet (`ARKIV_PRIVATE_KEY`) pays the gas, and the employee owns the record: they can let it expire or delete it, and nobody can edit it. Authorship comes from the EIP-712 signature inside the payload, not from who paid gas. A batch estimates at about 886k gas (about 0.0013 tGLM). `explainArkivError` turns the SDK's vague errors into clear ones (for example an empty wallet).

## Read

- `fetchOrgReceipts(org, period?, open)`: every team of a company in one query (paged by 100), each payload decoded and re-verified. Used by the company and team pages, with a 5 second limit so pages never hang on a slow endpoint. With `open` (decided by `mayOpen` in `lib/server/org.ts`: on the laptop, in the demo, or for a GitHub-signed-in member of the org) and the company key, `decodeRow` opens sealed weeks: it unseals the pointer, downloads the ciphertext, checks size and SHA-256, decrypts, and keeps it only if it is the same signed receipt (same digest, valid signature). Otherwise the page shows the signed totals and says the list is private.
- `fetchTeamReceipts(team, period?)`: one team, for the CLI and `/api/team`.
- `fetchReceiptByKey(key)`: one entity, for `/r/<key>` and the Verify page.
- The CRE job reads the same entities with a raw `arkiv_query` JSON-RPC call.

## Privacy

Arkiv is public. With Swarm set up, only the signed totals, the Swarm reference and the sealed pointer go there; the list, PR titles and AI request ids sit on Swarm as ciphertext only the company can open. Without Swarm, a full share puts the signed list, PRs and totals on Arkiv. Never prompts, the AI's answers, file names or session ids. People can hide single items; they still count in the signed totals.

## Public cards

`cards.ts`: when someone clicks Get a Swarm link, the card PNG goes to Swarm (`uploadFile`, served at `<gateway>/bzz/<ref>/`) and one read-only entity with schema `receipts-ethglobal-mumbai.card.v1` (company, week, author, signer, things done, Swarm reference, SHA-256, size, media type, caption) is created and handed to the card's owner, expiring after 60 days. `fetchCards` reads them for `/wall`. See [../arkiv/swarm.md](../arkiv/swarm.md).
