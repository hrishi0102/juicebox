# Receipts monthly scoring job (Chainlink CRE)

Optional module. Not one of the three partner tracks we submit to (0G, Arkiv, EF), because a project can enter at most three; swap it in if you prefer the Chainlink track.

## What it does

Once a month (the simulator runs it immediately):

1. Reads the team's shared receipts **straight from Arkiv** with a raw `arkiv_query` JSON-RPC call. No Receipts server is involved.
2. Keeps receipts written by trusted writers (config `trustedWriters`, empty = any) whose week ended inside the window.
3. Adds up the team totals from the **signed** fields of each receipt (spend, shipped tasks, kept work, survival, waste).
4. Re-checks the evidence on GitHub: every PR a receipt claims as merged must still be merged (up to 13 PRs per run, CRE allows 15 HTTP calls in total).
5. Every DON node does this on its own; consensus takes the median of each number.
6. Writes the verified monthly team score on-chain to [`TeamScoreboard`](../contracts/src/TeamScoreboard.sol) through the CRE forwarder. Nobody, not the manager, not the engineers, not us, can write a score directly.

Code: [`receipts-monthly/main.ts`](receipts-monthly/main.ts). It type-checks against `@chainlink/cre-sdk` 1.23, and the scoring function was run in Node against fake Arkiv and GitHub responses (20 demo receipts, 11 HTTP calls). It has **not** been compiled to WASM or simulated yet, because the CRE CLI needs a login.

## Run the simulation

1. Install the CRE CLI and log in (free account at app.chain.link, needs your browser):

```bash
curl -sSL https://app.chain.link/cre/install.sh | bash
```

```bash
cre login
```

2. Deploy the consumer contract (Arc testnet; gas is USDC from https://faucet.circle.com):

```bash
cd contracts && forge install foundry-rs/forge-std && FORWARDER=0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1 forge script script/Deploy.s.sol --rpc-url https://rpc.testnet.arc.io --private-key $PK --broadcast
```

3. Put the printed address in `receipts-monthly/config.staging.json` as `consumerAddress`, copy `.env.example` to `.env` (a funded `CRE_ETH_PRIVATE_KEY` and a read-only `GITHUB_TOKEN_ALL`), then:

```bash
cd cre/receipts-monthly && bun install
```

```bash
cd cre && cre workflow simulate receipts-monthly --target staging-settings --broadcast
```

Without `--broadcast` the write is a dry run. With it, the mock forwarder calls `TeamScoreboard.onReport` for real; check the `TeamScorePosted` event on https://explorer.testnet.arc.io.

## Notes

- Chain: `arc-testnet` (CRE supports it; simulation forwarder `0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1`). Switch `chainSelectorName` to `ethereum-testnet-sepolia` and redeploy with the Sepolia forwarder if you prefer.
- The demo team's PR links point to a fictional GitHub org, so they will not be confirmed. Point `teamId` at a real team that shared receipts with evidence to see real confirmations.
- Next step: verify each receipt's EIP-712 signature inside the DON too (the web app already does on read). It needs a synchronous secp256k1 recover in the WASM runtime.
