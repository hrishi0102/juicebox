# Contracts

`TeamScoreboard` stores verified monthly team scores written by the Juicebox CRE workflow ([../cre](../cre)). Only the CRE forwarder can write, a score can never be rewritten for an earlier period, and it reports `IReceiver` through ERC165 so the forwarder will call it.

## Deployed

Ethereum Sepolia: [`0x563F8f8A06a9bCb394Bd463CEC352e6EB902FDD5`](https://sepolia.etherscan.io/address/0x563F8f8A06a9bCb394Bd463CEC352e6EB902FDD5), deploy transaction [`0x2afdeaf9…3acf`](https://sepolia.etherscan.io/tx/0x2afdeaf9e488bff2b55b01108b4e5a8218c4f9c7a76c6b9cf3b3b36d66073acf). Its forwarder is CRE's Sepolia simulation forwarder `0x15fC6ae953E024d975e77382eEeC56A9101f9F88`, so `cre workflow simulate --broadcast` can post to it; the owner can switch it to the production forwarder with `setForwarder`. The first score is transaction [`0xa7f4dfd4…e7ff`](https://sepolia.etherscan.io/tx/0xa7f4dfd481fbde18edc11bed280f86d159f76d87d4b4f3973b72679f0cf1e7ff).

## Test

```bash
forge install foundry-rs/forge-std
```

```bash
forge test
```

## Deploy your own

Ethereum Sepolia, with the simulation forwarder (the default in `script/Deploy.s.sol`):

```bash
FORWARDER=0x15fC6ae953E024d975e77382eEeC56A9101f9F88 forge script script/Deploy.s.sol --rpc-url https://rpc.sepolia.ethpandaops.io --private-key $PK --broadcast
```

Storing contract code on Sepolia costs far more gas than Foundry expects: our deploy used 5.1M gas, while Foundry's estimate (about 1M) failed twice. If that happens to you, send the creation code with `cast send --create` and let the node estimate the gas.

| Network | Simulation forwarder | Production forwarder |
|---|---|---|
| Ethereum Sepolia (used) | `0x15fC6ae953E024d975e77382eEeC56A9101f9F88` | `0xF8344CFd5c43616a4366C34E3EEE75af79a74482` |
| Arc testnet (5042002) | `0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1` | `0x76c9cf548b4179F8901cda1f8623568b58215E62` |

Report layout (the `Report` struct in `src/TeamScoreboard.sol`, ABI-encoded by `cre/receipts-monthly/main.ts`): `bytes32 teamId, uint32 periodDay, uint32 receipts, uint32 people, uint32 rejected, uint64 spendCents, uint32 done, uint64 wastedCents, uint32 mergedPrs, uint16 prsChecked, uint16 prsStillMerged`.
