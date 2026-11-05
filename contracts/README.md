# Contracts

`TeamScoreboard` stores verified monthly team scores written by the Receipts CRE workflow ([../cre](../cre)). Only the CRE forwarder can write, a score can never be rewritten for an earlier period, and it reports `IReceiver` through ERC165 so the forwarder will call it.

```bash
forge install foundry-rs/forge-std
```

```bash
forge test
```

Deploy (Arc testnet, simulation forwarder by default):

```bash
FORWARDER=0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1 forge script script/Deploy.s.sol --rpc-url https://rpc.testnet.arc.io --private-key $PK --broadcast
```

| Network | Simulation forwarder | Production forwarder |
|---|---|---|
| Arc testnet (5042002) | `0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1` | `0x76c9cf548b4179F8901cda1f8623568b58215E62` |
| Ethereum Sepolia | `0x15fC6ae953E024d975e77382eEeC56A9101f9F88` | `0xF8344CFd5c43616a4366C34E3EEE75af79a74482` |

Report layout (must match `cre/receipts-monthly/main.ts`): `bytes32 teamId, uint32 periodDay, uint32 receipts, uint64 spendCents, uint32 shippedTasks, uint32 keptWorkMilli, uint16 survivalBps, uint16 wasteBps, uint16 prsChecked, uint16 prsStillMerged`.
