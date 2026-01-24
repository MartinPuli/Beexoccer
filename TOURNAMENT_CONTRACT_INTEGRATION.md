// Guía de Integración: TournamentManager Smart Contract

// ============================================
// 1. CONFIGURACIÓN BÁSICA
// ============================================

// Guardar en frontend/.env:
VITE_TOURNAMENT_MANAGER_ADDRESS=0x... // (después de deployar)
VITE_TOURNAMENT_MANAGER_ABI=... // (auto-generado por typechain)

// ============================================
// 2. IMPORTACIONES EN EL FRONTEND
// ============================================

import { TournamentManager } from "../typechain-types";
import TOURNAMENT_MANAGER_ABI from "../artifacts/contracts/TournamentManager.sol/TournamentManager.json";

// ============================================
// 3. CREAR INSTANCIA DEL CONTRATO
// ============================================

import { ethers } from "ethers";

// En un hook de React (ej: useTournamentContract.ts):

import { useEffect, useState } from "react";

export function useTournamentContract() {
  const [contract, setContract] = useState<TournamentManager | null>(null);

  useEffect(() => {
    const initContract = async () => {
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      
      const address = import.meta.env.VITE_TOURNAMENT_MANAGER_ADDRESS;
      const tournamentManager = new ethers.Contract(
        address,
        TOURNAMENT_MANAGER_ABI.abi,
        signer
      ) as TournamentManager;

      setContract(tournamentManager);
    };

    initContract();
  }, []);

  return contract;
}

// ============================================
// 4. CREAR TORNEO
// ============================================

// Función en useGameStore.ts o componente:

async function createTournament(config: {
  size: 0 | 1 | 2; // 0=4, 1=8, 2=16
  entryFee: string; // ej: "1.0" MATIC
  isNativeMATIC?: boolean;
  firstPlacePct: number; // ej: 75
  secondPlacePct: number; // ej: 25
  thirdPlacePct?: number; // ej: 0 (opcional)
}) {
  try {
    const entryFeeWei = ethers.parseEther(config.entryFee);
    const thirdPlace = config.thirdPlacePct ?? 0;

    const tx = await contract.createTournament(
      config.size,
      entryFeeWei,
      ethers.ZeroAddress, // native MATIC
      config.firstPlacePct,
      config.secondPlacePct,
      thirdPlace
    );

    const receipt = await tx.wait();
    
    // Extraer tournament ID del evento
    const event = receipt?.logs
      .map(log => contract.interface.parseLog(log))
      .find(event => event?.name === "TournamentCreated");
    
    const tournamentId = event?.args?.[0];
    
    return {
      success: true,
      tournamentId: tournamentId?.toString(),
      txHash: tx.hash
    };
  } catch (error) {
    console.error("Error creating tournament:", error);
    return { success: false, error };
  }
}

// ============================================
// 5. UNIRSE A TORNEO
// ============================================

async function joinTournament(tournamentId: number) {
  try {
    // Primero, obtener el fee requerido
    const tournamentInfo = await contract.getTournament(tournamentId);
    const entryFee = tournamentInfo.entryFee;

    // Unirse pagando el fee exacto
    const tx = await contract.joinTournament(tournamentId, {
      value: entryFee // En wei
    });

    await tx.wait();

    return {
      success: true,
      txHash: tx.hash
    };
  } catch (error) {
    console.error("Error joining tournament:", error);
    if ((error as any).reason === "TM_AlreadyJoined") {
      return { success: false, error: "Ya te uniste a este torneo" };
    }
    if ((error as any).reason === "TM_InvalidFeeCombo") {
      return { success: false, error: "Fee incorrecto" };
    }
    return { success: false, error };
  }
}

// ============================================
// 6. INICIAR TORNEO (Creator only)
// ============================================

async function startTournament(tournamentId: number) {
  try {
    const tx = await contract.startTournament(tournamentId);
    await tx.wait();

    return {
      success: true,
      txHash: tx.hash
    };
  } catch (error) {
    console.error("Error starting tournament:", error);
    return { success: false, error };
  }
}

// ============================================
// 7. COMPLETAR TORNEO (Creator only)
// ============================================

async function completeTournament(params: {
  tournamentId: number;
  firstPlaceAddress: string;
  secondPlaceAddress: string;
  thirdPlaceAddress?: string;
}) {
  try {
    const thirdPlace = params.thirdPlaceAddress ?? ethers.ZeroAddress;

    const tx = await contract.completeTournament(
      params.tournamentId,
      params.firstPlaceAddress,
      params.secondPlaceAddress,
      thirdPlace
    );

    await tx.wait();

    return {
      success: true,
      txHash: tx.hash
    };
  } catch (error) {
    console.error("Error completing tournament:", error);
    
    // Manejo de errores específicos
    if ((error as any).reason === "TM_NotCreator") {
      return { success: false, error: "Solo el creador puede completar el torneo" };
    }
    if ((error as any).reason === "TM_DuplicateWinner") {
      return { success: false, error: "Los ganadores no pueden ser iguales" };
    }
    if ((error as any).reason === "TM_InvalidWinner") {
      return { success: false, error: "Uno de los ganadores no es participante" };
    }

    return { success: false, error };
  }
}

// ============================================
// 8. LECTURA DE INFORMACIÓN
// ============================================

// Obtener info del torneo
async function getTournamentInfo(tournamentId: number) {
  try {
    const info = await contract.getTournament(tournamentId);
    return {
      creator: info.creator,
      status: info.status, // 0=Open, 1=Full, 2=InProgress, 3=Completed
      entryFee: ethers.formatEther(info.entryFee),
      playerCount: info.playerCount.toString(),
      totalPrizePool: ethers.formatEther(info.totalPrizePool),
      size: info.size // 0=4, 1=8, 2=16
    };
  } catch (error) {
    console.error("Error fetching tournament:", error);
    return null;
  }
}

// Obtener resultados
async function getTournamentResults(tournamentId: number) {
  try {
    const results = await contract.getTournamentResults(tournamentId);
    return {
      firstPlace: results.firstPlace,
      secondPlace: results.secondPlace,
      thirdPlace: results.thirdPlace
    };
  } catch (error) {
    console.error("Error fetching results:", error);
    return null;
  }
}

// Obtener lista de jugadores
async function getTournamentPlayers(tournamentId: number) {
  try {
    return await contract.getTournamentPlayers(tournamentId);
  } catch (error) {
    console.error("Error fetching players:", error);
    return [];
  }
}

// Calcular premios
async function calculatePrizes(tournamentId: number) {
  try {
    const [first, second, third] = await contract.calculatePrizes(tournamentId);
    return {
      firstPlace: ethers.formatEther(first),
      secondPlace: ethers.formatEther(second),
      thirdPlace: ethers.formatEther(third)
    };
  } catch (error) {
    console.error("Error calculating prizes:", error);
    return null;
  }
}

// ============================================
// 9. INTEGRACIÓN CON SOCKET EVENTS
// ============================================

// En server/src/index.ts, cuando se reporta resultado del partido:

// ANTES (sin blockchain):
io.emit("tournamentsUpdate", updatedTournaments);

// DESPUÉS (con blockchain):
socket.on("reportTournamentResult", async (data, callback) => {
  const { tournamentId, firstPlace, secondPlace, thirdPlace } = data;

  try {
    // 1. Reportar resultado en blockchain
    const tx = await tournamentManager.completeTournament(
      tournamentId,
      firstPlace,
      secondPlace,
      thirdPlace ?? ethers.ZeroAddress
    );

    // 2. Esperar confirmación
    const receipt = await tx.wait();

    // 3. Actualizar estado local y broadcast
    const tournament = tournaments[tournamentId];
    tournament.status = TournamentStatus.Completed;
    tournament.firstPlaceWinner = firstPlace;
    tournament.secondPlaceWinner = secondPlace;
    tournament.thirdPlaceWinner = thirdPlace;

    saveTournaments();
    broadcastTournaments();

    // 4. Confirmar al cliente
    callback({
      success: true,
      txHash: receipt?.hash,
      blockNumber: receipt?.blockNumber
    });
  } catch (error) {
    callback({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// ============================================
// 10. COMPONENTE DE REACT EJEMPLO
// ============================================

import { useEffect, useState } from "react";
import { useTournamentContract } from "../hooks/useTournamentContract";

export function TournamentCreateForm() {
  const contract = useTournamentContract();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    size: "0", // 4-player por defecto
    entryFee: "1.0",
    firstPlacePct: "75",
    secondPlacePct: "25"
  });

  const handleCreate = async () => {
    if (!contract) return;
    
    setLoading(true);
    try {
      const tx = await contract.createTournament(
        parseInt(formData.size),
        ethers.parseEther(formData.entryFee),
        ethers.ZeroAddress,
        parseInt(formData.firstPlacePct),
        parseInt(formData.secondPlacePct),
        0
      );

      const receipt = await tx.wait();
      alert(`✅ Torneo creado! TX: ${tx.hash}`);
    } catch (error) {
      alert(`❌ Error: ${error instanceof Error ? error.message : "Unknown"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded">
      <h2>Crear Torneo</h2>
      
      <select 
        value={formData.size}
        onChange={(e) => setFormData({...formData, size: e.target.value})}
      >
        <option value="0">4 Jugadores</option>
        <option value="1">8 Jugadores</option>
        <option value="2">16 Jugadores</option>
      </select>

      <input 
        type="number"
        step="0.01"
        value={formData.entryFee}
        onChange={(e) => setFormData({...formData, entryFee: e.target.value})}
        placeholder="Entry Fee (MATIC)"
      />

      <button onClick={handleCreate} disabled={loading}>
        {loading ? "Creando..." : "Crear Torneo"}
      </button>
    </div>
  );
}

// ============================================
// 11. TESTING EN HARDHAT
// ============================================

// npm run hardhat test test/TournamentManager.test.ts

// ============================================
// 12. DEPLOYMENT A MAINNET
// ============================================

// 1. Configurar .env:
// POLYGON_RPC=https://rpc.ankr.com/polygon
// PRIVATE_KEY=tu_clave_privada
// POLYGONSCAN_API_KEY=tu_api_key

// 2. Ejecutar:
// npx hardhat run scripts/deployTournamentManager.ts --network polygon

// 3. Copiar la dirección y guardar en .env.local del frontend:
// VITE_TOURNAMENT_MANAGER_ADDRESS=0x...

// ============================================
// 13. DEBUGGING
// ============================================

// Ver eventos del contrato:
contract.on("TournamentCreated", (id, creator, size, fee, token) => {
  console.log(`Tournament ${id} created by ${creator}`);
});

contract.on("PlayerJoined", (id, player, current, max) => {
  console.log(`${player} joined tournament ${id} (${current}/${max})`);
});

contract.on("TournamentCompleted", (id, first, second, third, f, s, t) => {
  console.log(`Tournament ${id} completed! Winners: ${first}, ${second}, ${third}`);
});

// Ver transacciones pendientes:
console.log("Pending:", await ethers.provider.getNetwork());

// Ver balance de contrato:
const balance = await ethers.provider.getBalance(contract.address);
console.log("Contract balance:", ethers.formatEther(balance));
