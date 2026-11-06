# Receipts and signing

Code: `web/src/lib/receipts/receipt.ts`

## EIP-712 message

Domain `{ name: "Receipts", version: "1" }`, with no `chainId` on purpose: a receipt is not tied to a chain, and wallets refuse typed data whose chain id differs from the connected chain.

`Receipt` fields: owner, period (`2026-W45`), periodStart, periodEnd, sessions, spendCents, shippedTasks, survivalBps (65535 = unknown), keptWorkMilli, wasteBps, labels (`uint32[6]`, counts in the order Shipped, Learned, Looped, Abandoned, Overkill, Open), labelSpendCents (`uint64[6]`), tools (`string[]`, AI tools used that week, sorted) and toolSpendCents (`uint64[]`, same order), evidenceRoot, judgeRoot, judge (engine name).

## Merkle roots

Sorted-pair keccak tree (same rule as OpenZeppelin `MerkleProof`).

- **Evidence leaves**, one per task: change key, PR title, URL, state, reverted, survivalBps, costCents, difficulty. An owner can reveal one task with a proof without showing the rest.
- **Judge leaves**, one per judged session: hash of the session id, label, difficulty, engine, model, provider, 0G request id, hashes of the request and response, verified flag.

## The JSON file

`SignedReceipt` = message (bigints as strings) + digest + signature + evidence + judges + an unsigned `summary` (buckets and convenience numbers) + share info. Anything shown to someone else must come from the signed message (`signedNumbers`), never from `summary`.

## Verification

`verifyReceipt` checks: the digest matches the fields, the signature recovers to `owner`, every evidence leaf recomputes and the evidence root matches, the judge root matches. Totals-only shares carry no evidence and pass that check as "not shared".

## Signing paths

- Browser wallet (`viem` with `window.ethereum`), from the home page.
- Local key `RECEIPTS_SIGNER_KEY` (CLI `sign`, or the one-click button).
- Demo mode signs with a deterministic demo key for the "You" persona.

Signed receipts are saved in `~/.receipts/receipts/<week>.json` (demo ones in `demo-receipts/`). If the data changes after signing, the page shows the receipt as out of date.
