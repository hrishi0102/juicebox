# Chainlink CRE monthly check and the TeamScoreboard contract

Code: `cre/receipts-monthly/score.ts` (the check), `main.ts` (the workflow), `check-live.ts` (the check in Node), `contracts/src/TeamScoreboard.sol`, `web/src/lib/server/scoreboard.ts` and `web/src/components/chainlink-check.tsx` (the app reading it). Submitted to Chainlink's Best Workflow with CRE (decision 54).

## Workflow

Cron trigger (00:00 UTC on the 1st of each month; the simulator runs it at once). DON mode reads the secrets (`ARKIV_ACCESS_KEY`, optional `GITHUB_TOKEN`) and hands them to node mode. In node mode, on every DON node, `checkTeam`:

1. Queries Arkiv in pages of 30 sorted by key (`arkiv_query` with `ORDER BY $key:key ASC`, the access key as the last part of the RPC address) for the team's receipts, selecting `key`, `owner`, `creator`, `createdAt` and the `payload` attribute.
2. Keeps entities whose `creator` is in `trustedWriters` (the company wallet) and whose week ended inside `windowDays` (45).
3. Recomputes each receipt's EIP-712 digest (the same types as `web/src/lib/receipts/receipt.ts`, v2 and v3) and recovers the signer with `@noble/curves` (synchronous, so it works in the WASM runtime). A receipt whose signer is not `message.owner` is counted in `rejected` and left out. Of the rest, one per person per week: the highest `createdAt`.
4. Sums the signed fields: `spendCents`, `done`, `categorySpendCents[6]` (Wasted), `mergedPrs`; counts receipts and people.
5. Asks GitHub about each PR a full receipt claims as merged (sorted, at most `maxPrChecks` and never more than what is left of 14 HTTP calls after Arkiv), counting `prsStillMerged`.

Consensus: median of every field (`ConsensusAggregationByFields`). The report is ABI-encoded (`REPORT_ABI` in `score.ts`) and written with `EVMClient.writeReport` to `TeamScoreboard` on `ethereum-testnet-sepolia`. A zero `consumerAddress` skips the write and returns the report.

Report layout: `bytes32 teamId, uint32 periodDay, uint32 receipts, uint32 people, uint32 rejected, uint64 spendCents, uint32 done, uint64 wastedCents, uint32 mergedPrs, uint16 prsChecked, uint16 prsStillMerged`.

Status (Nov 7): the CRE CLI (v1.39.0) simulation runs with production limits and `--broadcast`, and wrote the first score to Sepolia (transaction `0xa7f4dfd481fbde18edc11bed280f86d159f76d87d4b4f3973b72679f0cf1e7ff`): 25 signed weeks from 5 people, every signature valid. `check-live.ts` gives the same numbers in Node, and tampered payloads are rejected. Arkiv is read in pages of 30 sorted by key (CRE caps a response at 250 KB), and the run uses `runtime.now()` because the simulator reports a cron run's time as the next scheduled one.

## TeamScoreboard

Deployed on Ethereum Sepolia at `0x563F8f8A06a9bCb394Bd463CEC352e6EB902FDD5` with CRE's Sepolia simulation forwarder. Only the configured forwarder can call `onReport`; a period can never be older than the latest one (no rewriting history); ERC165 reports `IReceiver` so the forwarder calls it; the owner can switch to the production forwarder. `latest(teamId)` returns the newest score, and every post emits `TeamScorePosted`. 5 Foundry tests.

## In the app

`teamCheck(teamId)` reads `latest(keccak256(teamId))` and `forwarder()` from Sepolia (5 second limit), and finds the transaction through the `TeamScorePosted` log. The company's Team page shows "Checked by Chainlink, once a month" when a score exists: signed weeks and people, failed signatures, spend, things done, what went in circles, merged PRs, PRs still merged, and links to the transaction and the contract's events on Etherscan. When the forwarder is the simulation one, the card says the score came from the CRE simulator. `TEAM_SCOREBOARD_ADDRESS` and `SEPOLIA_RPC_URL` override the defaults.

On the laptop (and only there), when the CRE CLI and `cre/.env` are present and the page shows the team in the workflow's config, the card has **Run the check now**: `POST /api/cre/run` (cross-site requests refused, localhost only, one run at a time) runs `cre workflow simulate receipts-monthly ... --broadcast` in `cre/` (`lib/server/cre-run.ts`), reads the score and transaction hash from its log, and the page refreshes. On the Chainlink network the monthly cron runs the workflow instead.
