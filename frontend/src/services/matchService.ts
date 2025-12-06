import { Contract, InterfaceAbi, formatEther, parseEther } from "ethers";
import abi from "../abi/MatchManager.json";
import { env } from "../config/env";
import { MatchConfig, MatchLobby } from "../types/game";
import { xoConnectService } from "./xoConnectService";

const matchAbi = abi as InterfaceAbi;

/**
 * Builds a contract instance bound to the XO-CONNECT signer. We only instantiate when needed to avoid
 * prompting the wallet unnecessarily.
 */
async function getContract() {
  const signer = await xoConnectService.getSigner();
  return new Contract(env.matchManagerAddress, matchAbi, signer);
}

/**
 * Fetches a light list of lobbies. Until an indexer/service exists we return a deterministic mock to keep
 * the UI functional; once the smart contract emits events you can hydrate this from The Graph or a Beexo API.
 */
export async function fetchOpenMatches(): Promise<MatchLobby[]> {
  try {
    const provider = xoConnectService.getProvider();
    const contract = new Contract(env.matchManagerAddress, matchAbi, provider);
    const lobbies: MatchLobby[] = [];

    for (let id = 1; id <= 3; id += 1) {
      try {
        const data = await contract.matches(id);
        if (!data.isCompleted && data.isOpen) {
          lobbies.push({
            id,
            creator: data.creator,
            challenger: data.challenger === "0x0000000000000000000000000000000000000000" ? undefined : data.challenger,
            goals: Number(data.goalsTarget) as MatchLobby["goals"],
            isFree: data.isFree,
            stakeAmount: formatEther(data.stakeAmount ?? 0n),
            stakeToken: data.stakeToken,
            open: data.isOpen
          });
        }
      } catch (innerError) {
        console.debug("match not found", innerError);
      }
    }

    if (lobbies.length) return lobbies;
  } catch (error) {
    console.warn("Falling back to mock lobbies", error);
  }

  return [
    {
      id: 101,
      creator: "0xCreator",
      challenger: undefined,
      goals: 3,
      isFree: true,
      stakeAmount: "0",
      stakeToken: "0x0000000000000000000000000000000000000000",
      open: true
    },
    {
      id: 202,
      creator: "0xCreator",
      challenger: undefined,
      goals: 5,
      isFree: false,
      stakeAmount: "5",
      stakeToken: "0x0000000000000000000000000000000000000000",
      open: true
    }
  ];
}

export async function createMatch(config: MatchConfig) {
  const contract = await getContract();
  const stakeWei = config.isFree ? 0n : parseEther(config.stakeAmount || "0");
  const tx = await contract.createMatch(config.goals, config.isFree, stakeWei, config.stakeToken, {
    value: config.stakeToken === "0x0000000000000000000000000000000000000000" ? stakeWei : 0n
  });
  return tx.wait();
}

export async function acceptMatch(matchId: number, match: MatchLobby) {
  const contract = await getContract();
  const stakeWei = match.isFree ? 0n : parseEther(match.stakeAmount || "0");
  const tx = await contract.joinMatch(matchId, {
    value: match.stakeToken === "0x0000000000000000000000000000000000000000" ? stakeWei : 0n
  });
  return tx.wait();
}

export async function reportResult(matchId: number, winner: string) {
  const contract = await getContract();
  const tx = await contract.reportResult(matchId, winner);
  return tx.wait();
}
