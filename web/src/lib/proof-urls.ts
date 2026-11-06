// Where anyone can check that Receipts really used 0G, Arkiv and Swarm. Plain constants and
// helpers, safe to use in browser code (no SDKs here).
//
//   Arkiv  the Rabdi explorer: an entity, the transaction that wrote it, the wallet that paid
//   Swarm  our page that fetches the file from the Swarm gateway live (the raw link downloads it)
//   0G     0G's own TEE check of the provider that answered, the provider on 0G ChainScan, and the
//          person's own activity on pc.0g.ai (needs their 0G login)

export const ARKIV_EXPLORER = "https://rabdi.explorer.arkiv.network";
export const arkivEntityUrl = (key: string) => `${ARKIV_EXPLORER}/entity/${key}`;
export const arkivTxUrl = (hash: string) => `${ARKIV_EXPLORER}/tx/${hash}`;
export const arkivAddressUrl = (address: string) => `${ARKIV_EXPLORER}/address/${address}`;

/** Our page that fetches a Swarm reference live and shows what is there. */
export const swarmProofPath = (ref: string, entity?: string) => `/proof/swarm/${ref}${entity ? `?entity=${entity}` : ""}`;

export const ZG_CHAINSCAN = "https://chainscan.0g.ai";
export const zgAddressUrl = (address: string) => `${ZG_CHAINSCAN}/address/${address}`;
/** 0G's public TEE attestation verdicts for one provider (JSON). */
export const zgIdentityUrl = (provider: string) => `https://router-api.0g.ai/v1/providers/${provider}/identity`;
/** Our page that shows those verdicts in plain words. */
export const zgProofPath = (provider: string) => `/proof/0g/${provider}`;
export const ZG_ACTIVITY = "https://pc.0g.ai/dashboard/activity";
export const ZG_BILLING = "https://pc.0g.ai/dashboard/billing";

/** A live sealed week from the demo company (@you, week 45), for the front door's examples. */
export const DEMO_SEALED = {
  entity: "0xea50b76a7c871350d819fac561481bfb8070e3da040b3828e9369d0d99cb9ca6",
  swarm: "6483e19496c5b16f1f7b35da826f42ff140caedb31732c4e7a7fa90d597eeb75",
};

/** The Chainlink CRE monthly check writes each team's score to this contract on Ethereum Sepolia. */
export const CRE_SCOREBOARD = {
  address: "0x563F8f8A06a9bCb394Bd463CEC352e6EB902FDD5",
  deployTx: "0x2afdeaf9e488bff2b55b01108b4e5a8218c4f9c7a76c6b9cf3b3b36d66073acf",
  fromBlock: BigInt(12079434),
};
export const SEPOLIA_ETHERSCAN = "https://sepolia.etherscan.io";
export const sepoliaAddressUrl = (address: string) => `${SEPOLIA_ETHERSCAN}/address/${address}`;
export const sepoliaTxUrl = (hash: string) => `${SEPOLIA_ETHERSCAN}/tx/${hash}`;
