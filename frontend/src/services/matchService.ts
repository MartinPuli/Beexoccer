import { Contract, InterfaceAbi, formatEther, parseEther } from "ethers";
import abiJson from "../abi/MatchManager.json";
import { env } from "../config/env";
import { MatchConfig, MatchLobby } from "../types/game";
import { xoConnectService } from "./xoConnectService";

// El archivo JSON de Hardhat tiene formato { abi: [...], ... }
const matchAbi = abiJson.abi as InterfaceAbi;
const POLYGON_AMOY_CHAIN_ID = 80002n;

/**
 * Builds a contract instance bound to the XO-CONNECT signer. We only instantiate when needed to avoid
 * prompting the wallet unnecessarily.
 */
async function getContract() {
  const signer = await xoConnectService.getSigner();
  
  // Verificar que estamos en la red correcta
  const network = await signer.provider?.getNetwork();
  if (network && network.chainId !== POLYGON_AMOY_CHAIN_ID) {
    const error = `Red incorrecta. Estás en chainId ${network.chainId}, pero necesitas Polygon Amoy (${POLYGON_AMOY_CHAIN_ID}). Cambia la red en MetaMask.`;
    console.error("❌", error);
    throw new Error(error);
  }
  
  return new Contract(env.matchManagerAddress, matchAbi, signer);
}

/**
 * Gets a read-only contract instance for queries.
 * Uses a dedicated RPC provider to avoid network mismatch issues with MetaMask.
 */
function getReadContract() {
  const provider = xoConnectService.getReadProvider();
  return new Contract(env.matchManagerAddress, matchAbi, provider);
}

/**
 * Fetches a light list of lobbies. Until an indexer/service exists we return a deterministic mock to keep
 * the UI functional; once the smart contract emits events you can hydrate this from The Graph or a Beexo API.
 */
export async function fetchOpenMatches(): Promise<MatchLobby[]> {
  console.log("🔍 fetchOpenMatches iniciando...");
  console.log("📋 Contract address:", env.matchManagerAddress);
  
  try {
    const contract = getReadContract();
    const lobbies: MatchLobby[] = [];
    
    // Get total match count
    let totalMatches = 0;
    try {
      const count = await contract.matchCount();
      totalMatches = Number(count);
      console.log("📊 Total de partidas en contrato:", totalMatches);
    } catch (countError) {
      console.error("❌ Error obteniendo matchCount:", countError);
      return [];
    }

    if (totalMatches === 0) {
      console.log("📭 No hay partidas creadas aún");
      return [];
    }

    // Query recent matches (last 50 or all if less)
    const startId = Math.max(1, totalMatches - 50);
    console.log(`🔄 Buscando partidas desde ID ${startId} hasta ${totalMatches}`);
    
    for (let id = startId; id <= totalMatches; id += 1) {
      try {
        const data = await contract.matches(id);
        console.log(`  Partida #${id}:`, {
          creator: data.creator,
          challenger: data.challenger,
          isOpen: data.isOpen,
          isCompleted: data.isCompleted,
          isFree: data.isFree,
          stakeAmount: data.stakeAmount?.toString()
        });
        
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
        console.error(`❌ Error leyendo partida #${id}:`, innerError);
      }
    }

    console.log(`✅ Partidas abiertas encontradas: ${lobbies.length}`, lobbies);
    return lobbies;
  } catch (error) {
    console.error("❌ fetchOpenMatches error general:", error);
  }

  return [];
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
  } catch (error) {
    console.warn("checkMatchStatus error", error);
    return { hasChallenger: false };
  }
}

export async function createMatch(config: MatchConfig): Promise<{ matchId: number }> {
  console.log("🎮 Creando partida...", config);
  
  try {
    const contract = await getContract();
    const stakeWei = config.isFree ? 0n : parseEther(config.stakeAmount || "0");
    const stakeToken = config.isFree ? "0x0000000000000000000000000000000000000000" : config.stakeToken;
    
    console.log("📝 Parámetros de transacción:", {
      goals: config.goals,
      isFree: config.isFree,
      stakeWei: stakeWei.toString(),
      stakeToken,
      contractAddress: env.matchManagerAddress
    });
    
    // Para partidas gratuitas no enviar valor
    const txValue = config.isFree ? 0n : (stakeToken === "0x0000000000000000000000000000000000000000" ? stakeWei : 0n);
    
    const tx = await contract.createMatch(config.goals, config.isFree, stakeWei, stakeToken, {
      value: txValue
    });
    console.log("⏳ TX enviada:", tx.hash);
    
    const receipt = await tx.wait();
  console.log("✅ TX confirmada en bloque:", receipt.blockNumber);
  
  // Extract matchId from MatchCreated event
  let matchId = 0;
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "MatchCreated") {
        matchId = Number(parsed.args.matchId);
        console.log("🆔 Match ID creado:", matchId);
        break;
      }
    } catch {
      // Not our event, skip
    }
  }
  
  if (matchId === 0) {
    console.warn("⚠️ No se pudo extraer matchId del evento");
  }
  
  return { matchId };
  } catch (error: unknown) {
    console.error("❌ Error en createMatch:", error);
    
    // Intentar parsear el error del contrato
    const err = error as { reason?: string; data?: { message?: string }; message?: string; code?: string };
    
    if (err.reason) {
      throw new Error(err.reason);
    }
    if (err.data?.message) {
      throw new Error(err.data.message);
    }
    if (err.code === "INSUFFICIENT_FUNDS") {
      throw new Error("insufficient funds for gas");
    }
    if (err.code === "ACTION_REJECTED") {
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
  
  // Internal JSON-RPC error - usually nonce issues
  if (err.code === -32603 || err.message?.includes("-32603")) {
    const msg = "Error interno de MetaMask. Ve a MetaMask → Configuración → Avanzado → 'Borrar datos de actividad' y vuelve a intentar.";
    console.error("❌ RPC Error -32603:", err);
    throw new Error(msg);
  }
  
  // User rejected
  if (err.code === 4001 || err.message?.includes("User rejected")) {
    throw new Error("Transacción cancelada por el usuario");
  }
  
  // Insufficient funds
  if (err.message?.includes("insufficient funds")) {
    throw new Error("Fondos insuficientes para gas. Necesitas POL en tu wallet.");
  }
  
  // Nonce too low
  if (err.message?.includes("nonce") || err.message?.includes("replacement")) {
    throw new Error("Error de nonce. Resetea MetaMask: Configuración → Avanzado → Borrar datos de actividad");
  }
  
  throw error;
}

export async function cancelMatch(matchId: number): Promise<void> {
  try {
    const contract = await getContract();
    const tx = await contract.cancelMatch(matchId);
    await tx.wait();
  } catch (error) {
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
