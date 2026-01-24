import { Contract, InterfaceAbi, formatEther, parseEther, parseUnits } from "ethers";
import abiJson from "../abi/TournamentManager.json";
import { walletService } from "./walletService";
import { env } from "../config/env";
import { TournamentConfig } from "../types/tournaments";

const tournamentAbi = abiJson.abi as InterfaceAbi;
const POLYGON_CHAIN_ID = 137n;
const TOURNAMENT_MANAGER_ADDRESS = env.tournamentManagerAddress;

async function getContract() {
  const signer = await walletService.getSigner();
  const network = await signer.provider?.getNetwork();
  if (network && network.chainId !== POLYGON_CHAIN_ID) {
    throw new Error(`Red incorrecta. Cambia a Polygon Mainnet (chainId: ${POLYGON_CHAIN_ID}).`);
  }
  return new Contract(TOURNAMENT_MANAGER_ADDRESS, tournamentAbi, signer);
}

function getReadContract() {
  const provider = walletService.getReadProvider();
  return new Contract(TOURNAMENT_MANAGER_ADDRESS, tournamentAbi, provider);
}

export async function createTournament(config: TournamentConfig): Promise<number> {
  try {
    const contract = await getContract();
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    
    // Default to native token if not specified or free
    let entryFeeWei = 0n;
    let entryToken = ZERO_ADDRESS;

    if (!config.isFree && config.entryFee) {
       entryFeeWei = parseEther(config.entryFee);
       // Assuming native token for simplicity as per current UI
    }

    const tx = await contract.createTournament(config.size, entryFeeWei, entryToken);
    const receipt = await tx.wait();

    let tournamentId = 0;
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed?.name === "TournamentCreated") {
          tournamentId = Number(parsed.args.tournamentId);
          break;
        }
      } catch {}
    }
    
    if (tournamentId === 0) {
        // Fallback: fetch count
        tournamentId = Number(await contract.tournamentCount());
    }

    return tournamentId;
  } catch (error) {
    console.error("Error creating tournament:", error);
    throw error;
  }
}

export async function joinTournament(tournamentIdStr: string, entryFee: string): Promise<void> {
  try {
    const tournamentId = Number(tournamentIdStr);
    if (isNaN(tournamentId)) throw new Error("Invalid Tournament ID");

    const contract = await getContract();
    const entryFeeWei = parseEther(entryFee);

    // Assuming native payment for now based on UI "POL"
    const tx = await contract.joinTournament(tournamentId, {
      value: entryFeeWei
    });
    
    await tx.wait();
  } catch (error) {
    console.error("Error joining tournament:", error);
    throw error;
  }
}

export async function leaveTournament(tournamentIdStr: string): Promise<void> {
  try {
    const tournamentId = Number(tournamentIdStr);
    if (isNaN(tournamentId)) throw new Error("Invalid Tournament ID");

    const contract = await getContract();
    
    // Explicitly defining the method signature just in case ABI is not updated yet 
    // (though ethers usually fails if not in ABI, user needs to redeploy/update ABI)
    // But we rely on the user updating the ABI file after redeploy.
    const tx = await contract.leaveTournament(tournamentId);
    await tx.wait();
  } catch (error) {
    console.error("Error leaving tournament:", error);
    throw error;
  }
}
