import { Contract, InterfaceAbi, formatEther, parseEther } from "ethers";
import abiJson from "../abi/MatchManager.json";
import { MatchConfig, MatchLobby } from "../types/game";
import { walletService } from "./walletService";
import { env } from "../config/env";

// El archivo JSON de Hardhat tiene formato { abi: [...], ... }
const matchAbi = abiJson.abi as InterfaceAbi;
const POLYGON_CHAIN_ID = 137n;

// Dirección del contrato desde configuración
const MATCH_MANAGER_ADDRESS = env.matchManagerAddress;

/**
 * Builds a contract instance bound to the wallet signer
 */
async function getContract() {
  const signer = await walletService.getSigner();
  
  const network = await signer.provider?.getNetwork();
  if (network && network.chainId !== POLYGON_CHAIN_ID) {
    throw new Error(`Red incorrecta. Cambia a Polygon Mainnet (chainId: ${POLYGON_CHAIN_ID}).`);
  }
  
  return new Contract(MATCH_MANAGER_ADDRESS, matchAbi, signer);
}

/**
 * Gets a read-only contract instance for queries
 */
function getReadContract() {
  const provider = walletService.getReadProvider();
  return new Contract(MATCH_MANAGER_ADDRESS, matchAbi, provider);
}

/**
 * Fetches a light list of lobbies from the blockchain
 */
export async function fetchOpenMatches(): Promise<MatchLobby[]> {
  try {
    const contract = getReadContract();
    const lobbies: MatchLobby[] = [];
    
    let totalMatches = 0;
    try {
      const count = await contract.matchCount();
      totalMatches = Number(count);
    } catch {
      return [];
    }

    if (totalMatches === 0) {
      return [];
    }

    const startId = Math.max(1, totalMatches - 50);
    
    for (let id = startId; id <= totalMatches; id += 1) {
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
      } catch {
        // Skip invalid match
      }
    }

    return lobbies;
  } catch {
    return [];
  }
}

/**
 * Check if a specific match has a challenger (someone joined)
 */
export async function checkMatchStatus(matchId: number): Promise<{ hasChallenger: boolean; challenger?: string }> {
  try {
    const contract = getReadContract();
    const data = await contract.matches(matchId);
    const challenger = data.challenger;
    const hasChallenger = challenger !== "0x0000000000000000000000000000000000000000";
    return { hasChallenger, challenger: hasChallenger ? challenger : undefined };
  } catch {
    return { hasChallenger: false };
  }
}

export async function createMatch(config: MatchConfig): Promise<{ matchId: number }> {
  try {
    const contract = await getContract();
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    
    let stakeWei: bigint;
    let stakeToken: string;
    let txValue: bigint;
    
    if (config.isFree) {
      stakeWei = 0n;
      stakeToken = ZERO_ADDRESS;
      txValue = 0n;
    } else {
      stakeWei = parseEther(config.stakeAmount || "0");
      if (stakeWei === 0n) {
        throw new Error("El monto de apuesta debe ser mayor a 0");
      }
      
      const configToken = config.stakeToken?.toLowerCase() || "";
      const isNativeToken = !configToken || 
                            configToken === ZERO_ADDRESS.toLowerCase() || 
                            configToken === "native" ||
                            configToken === "pol" ||
                            configToken === "matic";
      
      if (isNativeToken) {
        stakeToken = ZERO_ADDRESS;
        txValue = stakeWei;
      } else {
        stakeToken = config.stakeToken!;
        txValue = 0n;
      }
    }
    
    const tx = await contract.createMatch(config.goals, config.isFree, stakeWei, stakeToken, {
      value: txValue
    });
    
    const receipt = await tx.wait();
    
    let matchId = 0;
    
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed?.name === "MatchCreated") {
          matchId = Number(parsed.args.matchId);
          break;
        }
      } catch {
        // Skip
      }
    }
    
    if (matchId === 0) {
      const count = await contract.matchCount();
      matchId = Number(count);
    }
    
    if (matchId <= 0) {
      throw new Error("No se pudo obtener el ID de la partida creada.");
    }
    
    return { matchId };
  } catch (error: unknown) {
    const err = error as { reason?: string; data?: { message?: string }; message?: string; code?: string | number };
    
    // Handle Internal JSON-RPC error specifically
    if (err.code === -32603 || (typeof err.message === 'string' && err.message.includes("-32603"))) {
      throw new Error("Error interno RPC. Ve a MetaMask → Configuración → Avanzado → 'Borrar datos de actividad' y reintenta.");
    }
    
    if (err.reason) {
      throw new Error(err.reason);
    }
    if (err.data?.message) {
      throw new Error(err.data.message);
    }
    if (err.code === "INSUFFICIENT_FUNDS") {
      throw new Error("insufficient funds for gas");
    }
    if (err.code === "ACTION_REJECTED" || err.code === 4001) {
      throw new Error("user rejected transaction");
    }
    
    throw error;
  }
}

/**
 * Handles common RPC errors and provides user-friendly messages
 */
function handleRpcError(error: unknown): never {
  const err = error as { code?: number; message?: string; data?: { message?: string } };
  
  if (err.code === -32603 || err.message?.includes("-32603")) {
    throw new Error("Error interno. Ve a tu wallet → Configuración → Avanzado → 'Borrar datos de actividad'.");
  }
  
  if (err.code === 4001 || err.message?.includes("User rejected")) {
    throw new Error("Transacción cancelada por el usuario");
  }
  
  if (err.message?.includes("insufficient funds")) {
    throw new Error("Fondos insuficientes para gas. Necesitas POL en tu wallet.");
  }
  
  if (err.message?.includes("nonce") || err.message?.includes("replacement")) {
    throw new Error("Error de nonce. Resetea tu wallet: Configuración → Avanzado → Borrar datos de actividad");
  }
  
  throw error;
}

export async function cancelMatch(matchId: number): Promise<void> {
  if (!matchId || matchId <= 0) {
    throw new Error("ID de partida inválido.");
  }
  
  try {
    const contract = await getContract();
    const userAddress = walletService.getUserAddress();
    
    try {
      const matchData = await contract.matches(matchId);
      
      if (matchData.creator.toLowerCase() !== userAddress?.toLowerCase()) {
        throw new Error("No sos el creador de esta partida.");
      }
      
      if (!matchData.isOpen) {
        throw new Error("La partida ya no está abierta.");
      }
      
      if (matchData.challenger !== "0x0000000000000000000000000000000000000000") {
        throw new Error("La partida ya tiene un rival.");
      }
    } catch (checkError) {
      if (checkError instanceof Error && !checkError.message.includes("call revert")) {
        throw checkError;
      }
    }
    
    const tx = await contract.cancelMatch(matchId);
    await tx.wait();
  } catch (error) {
    if (error instanceof Error && 
        (error.message.includes("creador") || 
         error.message.includes("abierta") || 
         error.message.includes("rival") ||
         error.message.includes("inválido"))) {
      throw error;
    }
    
    const errorStr = String(error);
    if (errorStr.includes("NotCreator")) throw new Error("No sos el creador de esta partida.");
    if (errorStr.includes("MatchNotOpen")) throw new Error("La partida ya no está abierta.");
    if (errorStr.includes("ChallengerAlreadySet")) throw new Error("Ya hay un rival en esta partida.");
    
    handleRpcError(error);
  }
}

export async function acceptMatch(matchId: number, match: MatchLobby) {
  try {
    const contract = await getContract();
    const stakeWei = match.isFree ? 0n : parseEther(match.stakeAmount || "0");
    const tx = await contract.joinMatch(matchId, {
      value: match.stakeToken === "0x0000000000000000000000000000000000000000" ? stakeWei : 0n
    });
    return tx.wait();
  } catch (error) {
    handleRpcError(error);
  }
}

export async function reportResult(matchId: number, winner: string) {
  try {
    const contract = await getContract();
    const tx = await contract.reportResult(matchId, winner);
    return tx.wait();
  } catch (error) {
    handleRpcError(error);
  }
}
