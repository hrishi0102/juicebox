// Reads the monthly team check that the Chainlink CRE workflow (cre/receipts-monthly) writes to
// TeamScoreboard on Ethereum Sepolia. Read-only, no wallet. Nothing shows until the workflow has
// posted a score for the team.
import { createPublicClient, http, keccak256, parseAbi, parseAbiItem, stringToHex, type Address } from "viem";
import { sepolia } from "viem/chains";
import { CRE_SCOREBOARD } from "@/lib/proof-urls";

const ABI = parseAbi([
  "function forwarder() view returns (address)",
  "function latest(bytes32 teamId) view returns (uint32 periodDay, (uint64 postedAt, uint32 receipts, uint32 people, uint32 rejected, uint64 spendCents, uint32 done, uint64 wastedCents, uint32 mergedPrs, uint16 prsChecked, uint16 prsStillMerged) score)",
]);
const POSTED = parseAbiItem(
  "event TeamScorePosted(bytes32 indexed teamId, uint32 indexed periodDay, uint32 receipts, uint32 people, uint32 rejected, uint64 spendCents, uint32 done, uint64 wastedCents, uint32 mergedPrs, uint16 prsChecked, uint16 prsStillMerged)",
);

export type TeamCheck = {
  contract: string;
  postedAt: Date;
  receipts: number;
  people: number;
  rejected: number;
  spendCents: number;
  done: number;
  wastedCents: number;
  mergedPrs: number;
  prsChecked: number;
  prsStillMerged: number;
  txHash?: string;
  /** Posted through the CRE simulator's forwarder, not the live Chainlink network. */
  simulated: boolean;
};

export function scoreboardAddress(): Address {
  return (process.env.TEAM_SCOREBOARD_ADDRESS || CRE_SCOREBOARD.address) as Address;
}

/** CRE's MockKeystoneForwarder on Sepolia, used by `cre workflow simulate --broadcast`. */
const SIMULATION_FORWARDER = "0x15fc6ae953e024d975e77382eeec56a9101f9f88";

const timeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

/** The latest score for one team (its Arkiv `team` id), or undefined if there is none yet. */
export async function teamCheck(teamId: string): Promise<TeamCheck | undefined> {
  const address = scoreboardAddress();
  const client = createPublicClient({ chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com") });
  const id = keccak256(stringToHex(teamId));
  try {
    const [[day, s], forwarder] = await timeout(
      Promise.all([client.readContract({ address, abi: ABI, functionName: "latest", args: [id] }), client.readContract({ address, abi: ABI, functionName: "forwarder" })]),
      5000,
    );
    if (!s.postedAt) return undefined;
    let txHash: string | undefined;
    try {
      const fromBlock = process.env.TEAM_SCOREBOARD_ADDRESS ? undefined : CRE_SCOREBOARD.fromBlock;
      const logs = await timeout(client.getLogs({ address, event: POSTED, args: { teamId: id, periodDay: day }, fromBlock, toBlock: "latest" }), 5000);
      txHash = logs[logs.length - 1]?.transactionHash ?? undefined;
    } catch {
      txHash = undefined; // the score still shows; only the transaction link is missing
    }
    return {
      contract: address,
      postedAt: new Date(Number(s.postedAt) * 1000),
      receipts: s.receipts,
      people: s.people,
      rejected: s.rejected,
      spendCents: Number(s.spendCents),
      done: s.done,
      wastedCents: Number(s.wastedCents),
      mergedPrs: s.mergedPrs,
      prsChecked: s.prsChecked,
      prsStillMerged: s.prsStillMerged,
      txHash,
      simulated: forwarder.toLowerCase() === SIMULATION_FORWARDER,
    };
  } catch {
    return undefined;
  }
}
