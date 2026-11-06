# Receipts and signing

Code: `web/src/lib/receipts/receipt.ts`, `identity.ts`, `web/src/lib/server/receipts-store.ts`

## EIP-712 message (version 2)

Domain `{ name: "Receipts", version: "2" }`, with no `chainId` on purpose: a receipt is not tied to a chain, and wallets refuse typed data whose chain id differs from the connected chain.

`Receipt` fields: owner, author (GitHub login or ""), period (`2026-W45`), periodStart, periodEnd, sessions, spendCents, done (things done), categories (`uint32[7]`, items per category in the order Built, Fixed, Figured out, Researched, Wrote, Planned, Wasted), categorySpendCents (`uint64[7]`), mergedPrs, tools (`string[]`) and toolSpendCents (`uint64[]`), itemsRoot, evidenceRoot, judgeRoot, judge (who wrote the list, for example `0g-private-computer:0gm-1.0-35b-a3b-sia:9/9`).

## Merkle roots

Sorted-pair keccak trees (same rule as OpenZeppelin `MerkleProof`).

- **Item leaves**, one per line of the list: category, title, cost, linked PR keys, in progress. `revealItems` keeps only some items, each with a proof; the counts and spend for every category stay signed, so hiding an item never changes the totals.
- **Evidence leaves**, one per PR or commit: change key, title, URL, state, reverted, survival, cost, difficulty.
- **Judge leaves**, one per session the private AI read: hash of the session id, category, difficulty, engine, model, provider, 0G request id, hashes of the request and response, verified flag.

## The JSON file

`SignedReceipt` (`kind: "receipts.v2"`) = message (bigints as strings) + digest + signature + items + evidence + judges + the AI's one sentence + an unsigned `summary` (cost by difficulty, who wrote it) + share info. Anything shown to someone else comes from the signed message (`signedNumbers`) or from leaves that match a signed root.

## Verification

`verifyReceipt` checks: the format, the digest matches the fields, the signature recovers to `owner`, every revealed item recomputes and either rebuilds `itemsRoot` (all shown) or carries a valid proof (some shown), every PR leaf recomputes and rebuilds `evidenceRoot`, and every judge leaf recomputes and rebuilds `judgeRoot`. Totals-only shares carry no items, PRs or AI records.

## Who signs

- **A key made on the laptop** (`laptopAccount`): created on first "Sign", saved in `~/.receipts/identity.json` with mode 0600. No wallet needed. This is the default.
- `RECEIPTS_SIGNER_KEY` in `.env.local` overrides it (CLI and app).
- A browser wallet is still offered ("Use a wallet instead").
- Demo mode signs with deterministic demo keys.

The `author` field is the GitHub login of the token the app already uses for PRs (`githubLogin`, cached for a day). Anyone could put any login in their own receipt; the company page shows the address too, and an org can pin each address to a login the first time it sees it.

Signed receipts are saved in `~/.receipts/receipts/<week>.json` (demo ones in `demo-receipts/`). Receipts from before version 2 are ignored and simply signed again. If the week changes after signing (rescan, new write-up), the page shows the receipt as out of date.
