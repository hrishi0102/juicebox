# Receipts monthly check (Chainlink CRE)

Submitted to **Chainlink: Best Workflow with CRE**.

## Why it exists

Receipts are written by employees and read by their company, and both sides have a reason to bend the numbers. Inside the app, the company's own computer checks each receipt. Once a month, this workflow checks the team on its own, with no Receipts server and no company computer involved. Each Chainlink node:

1. **reads the team's receipts straight from Arkiv** (one `arkiv_query` JSON-RPC call),
2. **checks every receipt's EIP-712 signature** against the person it is about, and drops any that fail,
3. **adds up the signed numbers**, one receipt per person per week (the one written last): spend, things done, spend that went in circles, merged PRs,
4. **asks GitHub** whether each PR a receipt claims as merged is still merged.

The nodes agree on every number (median), and the result goes on chain to [`TeamScoreboard`](../contracts/src/TeamScoreboard.sol) on **Ethereum Sepolia** through Chainlink's forwarder. Only the forwarder can post, and a month can never be rewritten, so nobody (not the manager, not the employees, not us) can post or change a team's score. The company's Team page in the app reads the latest score from the contract and links to it on Etherscan.

One blockchain (Sepolia), two outside systems (Arkiv and the GitHub API), and the workflow is what makes the score trustworthy.

## Deployed

- `TeamScoreboard` on Ethereum Sepolia: [`0x563F8f8A06a9bCb394Bd463CEC352e6EB902FDD5`](https://sepolia.etherscan.io/address/0x563F8f8A06a9bCb394Bd463CEC352e6EB902FDD5), deploy transaction [`0x2afdeaf9…3acf`](https://sepolia.etherscan.io/tx/0x2afdeaf9e488bff2b55b01108b4e5a8218c4f9c7a76c6b9cf3b3b36d66073acf). Its forwarder is CRE's Sepolia simulation forwarder `0x15fC6ae953E024d975e77382eEeC56A9101f9F88`, so `cre workflow simulate --broadcast` can post to it. For the live network, the owner switches it to the production forwarder with `setForwarder`.
- **First score, posted by the CRE simulator on Nov 7:** transaction [`0xa7f4dfd4…e7ff`](https://sepolia.etherscan.io/tx/0xa7f4dfd481fbde18edc11bed280f86d159f76d87d4b4f3973b72679f0cf1e7ff) (sent to the simulation forwarder, which called `onReport`; 489k gas). `latest(keccak256("acme-payments"))` returns 25 signed weeks from 5 people, 0 failed signatures, $2,834.77 of spend, 116 things done, $222.08 that went in circles, 89 merged PRs as signed, and 12 PRs asked on GitHub with 0 still merged (the demo company's PRs are made up).
- Team checked: `acme-payments`, the demo company's Payments team. Only entities written by the company wallet `0x09351DC0A6AFa87da28D00914fE87373C5C82747` count (`trustedWriters`).

## Files

| What | File |
|---|---|
| The check (no CRE SDK in it, so it runs the same everywhere) | [`receipts-monthly/score.ts`](receipts-monthly/score.ts) |
| The workflow: cron trigger, node mode, consensus, report, write | [`receipts-monthly/main.ts`](receipts-monthly/main.ts) |
| The same check in Node against live Arkiv and GitHub | [`receipts-monthly/check-live.ts`](receipts-monthly/check-live.ts) |
| Config (team, window, chain, contract) | [`receipts-monthly/config.staging.json`](receipts-monthly/config.staging.json) |
| Secrets (the Arkiv access key) | [`secrets.yaml`](secrets.yaml), values in `cre/.env` (see [`.env.example`](.env.example)) |
| The contract and its tests | [`../contracts/src/TeamScoreboard.sol`](../contracts/src/TeamScoreboard.sol), [`../contracts/test/TeamScoreboard.t.sol`](../contracts/test/TeamScoreboard.t.sol) |
| The app reading the score | [`../web/src/lib/server/scoreboard.ts`](../web/src/lib/server/scoreboard.ts), [`../web/src/components/chainlink-check.tsx`](../web/src/components/chainlink-check.tsx) |

## Run it

**1. The check, against live data, no account needed** (from `cre/receipts-monthly`, after `npm install`):

```bash
node check-live.ts
```

Output on Nov 7 (the same numbers the simulator wrote on chain): 14 HTTP calls in about 1 second; 25 signed weeks from 5 people, 0 failed signatures, $2,834.77 of spend, 116 things done, $222.08 that went in circles, 89 merged PRs as signed, and 12 PRs asked on GitHub (0 still merged, because the demo company's PRs are made up). `--as-of=2026-11-01` checks as of another day. Changing one number inside a payload makes that receipt fail its signature check, and it is left out.

**2. Compile to WASM** (what CRE runs; this works without an account):

```bash
bun node_modules/.bin/cre-compile main.ts /tmp/receipts-monthly.wasm
```

**3. Simulate with the CRE CLI** (needs a free Chainlink account; the login opens your browser):

```bash
curl -sSL https://app.chain.link/cre/install.sh | bash
```

```bash
cre login
```

`cre/.env` needs `CRE_ETH_PRIVATE_KEY` (a Sepolia key with a little ETH; it pays the gas of the write) and `ARKIV_ACCESS_KEY_ALL` (free from https://hub.arkiv.network/access-keys). Then, from `cre/`:

```bash
cre workflow simulate receipts-monthly --target staging-settings --non-interactive --trigger-index 0 --broadcast
```

The simulator runs the workflow as one node, signs the report, and sends it through the simulation forwarder to `TeamScoreboard`. Look for the `TeamScorePosted` event on Etherscan, then open the app as Acme's lead (`/demo`), Teams, Payments: the "Checked by Chainlink" card shows the score and links to the transaction. Without `--broadcast` the write is a dry run.

## Limits and notes

- **HTTP calls:** CRE allows 15 per run. Arkiv is read in pages of 30 sorted by key (`ORDER BY $key:key ASC`), because CRE also caps one response at 250 KB and the whole team was 260 KB; GitHub gets what is left, keeping one call spare (12 for the demo team).
- **The clock:** the workflow uses `runtime.now()`, the DON's agreed time. The simulator reports a cron run's scheduled time as the *next* one (Dec 1), which would have scored the wrong weeks in a demo; on the network the cron fires on the 1st, so both are the same.
- **Sepolia RPC:** the public endpoints rate-limit; the simulator's write goes through `https://rpc.sepolia.ethpandaops.io` (`project.yaml`), after publicnode and Tenderly's gateway both answered 429.
- **GitHub token:** optional. Public PRs are checked without one. For private repositories, add `GITHUB_TOKEN` to `secrets.yaml` (mapped to `GITHUB_TOKEN_ALL`).
- **Sealed weeks:** their PRs are encrypted on Swarm for the company, so the DON checks the PRs of full receipts only. The signed totals of sealed weeks still count.
- **Gas on Sepolia:** storing contract code now costs far more than older rules: the deploy used 5.1M gas (Foundry's own estimate of 1M failed twice), and one report write about 364k. The workflow's gas limit is 1.5M.
- **One team per run:** the cron job checks the team in its config. A company with several teams runs one workflow per team, or loops over teams within the 15-call limit.
