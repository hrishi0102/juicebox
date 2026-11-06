# CRE monthly job and contracts (optional)

Code: `cre/receipts-monthly/main.ts`, `contracts/src/TeamScoreboard.sol`

Not part of the three submitted partner tracks. Kept so the Chainlink track can be swapped in.

## Workflow

Cron trigger (monthly; the simulator runs it at once). In node mode, on every DON node:

1. `arkiv_query` POST to the Arkiv RPC for the team's receipts (body base64 via `hexToBase64`).
2. Keep entities from `trustedWriters` (empty = any) whose week ended inside `windowDays`; one receipt per person per week.
3. Sum the signed fields: spend, shipped tasks, kept work, survival (weighted by shipped tasks), waste (weighted by spend).
4. Re-check up to 13 evidence PRs on GitHub (token from the `GITHUB_TOKEN` secret, fetched in DON mode and passed in).

Consensus: median of every field (`ConsensusAggregationByFields`). Then the report is ABI-encoded and written with `EVMClient.writeReport` to `TeamScoreboard` on `arc-testnet` (or Sepolia).

Report layout: `bytes32 teamId, uint32 periodDay, uint32 receipts, uint64 spendCents, uint32 shippedTasks, uint32 keptWorkMilli, uint16 survivalBps, uint16 wasteBps, uint16 prsChecked, uint16 prsStillMerged`.

Status: type-checks against `@chainlink/cre-sdk` 1.23; the scoring function was run in Node against fake Arkiv and GitHub responses (11 HTTP calls, CRE allows 15). Not compiled to WASM or simulated (needs `cre login`). Signature checks inside the DON are a known gap.

## TeamScoreboard

Only the configured forwarder can call `onReport`; a period can never be older than the latest one (no rewriting history); ERC165 reports `IReceiver` so the forwarder calls it; the owner can switch from the simulation forwarder to the production one. 5 Foundry tests.
