// ============================================
// EJEMPLOS PRÁCTICOS DE INTEGRACIÓN
// TournamentManager con Beexoccer Frontend
// ============================================

// ============================================
// 1. HOOK PERSONALIZADO: useTournamentContractWeb3
// ============================================
// Ubicación: frontend/src/hooks/useTournamentContractWeb3.ts

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { TournamentManager } from "../../typechain-types";
import TOURNAMENT_MANAGER_ABI from "../../artifacts/contracts/TournamentManager.sol/TournamentManager.json";

export function useTournamentContractWeb3() {
  const [contract, setContract] = useState<TournamentManager | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentAddress, setCurrentAddress] = useState<string>("");

  useEffect(() => {
    const initContract = async () => {
      try {
        if (!window.ethereum) {
          console.error("MetaMask no detectado");
          return;
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const userAddress = await signer.getAddress();
        setCurrentAddress(userAddress);

        const contractAddress = import.meta.env.VITE_TOURNAMENT_MANAGER_ADDRESS;
        if (!contractAddress) {
          console.error("VITE_TOURNAMENT_MANAGER_ADDRESS no configurado");
          return;
        }

        const tournamentManager = new ethers.Contract(
          contractAddress,
          TOURNAMENT_MANAGER_ABI.abi,
          signer
        ) as TournamentManager;

        setContract(tournamentManager);
        setIsConnected(true);
      } catch (error) {
        console.error("Error inicializando contrato:", error);
        setIsConnected(false);
      }
    };

    initContract();
  }, []);

  return { contract, isConnected, currentAddress };
}

// ============================================
// 2. ACTIONS EN ZUSTAND: Agregar a useGameStore.ts
// ============================================

// Agregar estas funciones a tu tienda Zustand existente:

import { TournamentManager } from "../typechain-types";

// Agregar al store interface:
interface GameState {
  // ... existing fields
  tournamentContract: TournamentManager | null;
  setTournamentContract: (contract: TournamentManager) => void;
  
  createBlockchainTournament: (config: {
    size: 0 | 1 | 2;
    entryFee: string;
    firstPlacePct: number;
    secondPlacePct: number;
    thirdPlacePct?: number;
  }) => Promise<{ success: boolean; tournamentId?: string; error?: any }>;

  joinBlockchainTournament: (tournamentId: number) => Promise<{ success: boolean; error?: any }>;

  completeBlockchainTournament: (params: {
    tournamentId: number;
    winners: [string, string, string?];
  }) => Promise<{ success: boolean; txHash?: string; error?: any }>;

  getTournamentBlockchainInfo: (tournamentId: number) => Promise<any>;
}

// Implementación:
export const useGameStore = create<GameState>((set) => ({
  // ... existing fields
  tournamentContract: null,
  
  setTournamentContract: (contract) => set({ tournamentContract: contract }),

  createBlockchainTournament: async (config) => {
    try {
      const { tournamentContract } = useGameStore.getState();
      if (!tournamentContract) throw new Error("Contract no inicializado");

      const entryFeeWei = ethers.parseEther(config.entryFee);
      const thirdPlace = config.thirdPlacePct ?? 0;

      const tx = await tournamentContract.createTournament(
        config.size,
        entryFeeWei,
        ethers.ZeroAddress, // MATIC
        config.firstPlacePct,
        config.secondPlacePct,
        thirdPlace
      );

      const receipt = await tx.wait();
      
      // Extraer tournament ID
      const event = receipt?.logs
        .map(log => tournamentContract.interface.parseLog(log))
        .find(event => event?.name === "TournamentCreated");

      const tournamentId = event?.args?.[0]?.toString();

      return {
        success: true,
        tournamentId
      };
    } catch (error) {
      console.error("Error creating blockchain tournament:", error);
      return {
        success: false,
        error
      };
    }
  },

  joinBlockchainTournament: async (tournamentId) => {
    try {
      const { tournamentContract } = useGameStore.getState();
      if (!tournamentContract) throw new Error("Contract no inicializado");

      // Obtener el fee del torneo
      const tournamentInfo = await tournamentContract.getTournament(tournamentId);
      const entryFee = tournamentInfo.entryFee;

      // Unirse pagando exactamente el fee
      const tx = await tournamentContract.joinTournament(tournamentId, {
        value: entryFee
      });

      await tx.wait();

      return { success: true };
    } catch (error: any) {
      console.error("Error joining blockchain tournament:", error);
      
      let errorMsg = error.message;
      if (error.reason === "TM_AlreadyJoined") {
        errorMsg = "Ya te uniste a este torneo";
      } else if (error.reason === "TM_TournamentClosed") {
        errorMsg = "El torneo está lleno o cerrado";
      } else if (error.reason === "TM_InvalidFeeCombo") {
        errorMsg = "Fee incorrecto";
      }

      return {
        success: false,
        error: errorMsg
      };
    }
  },

  completeBlockchainTournament: async (params) => {
    try {
      const { tournamentContract } = useGameStore.getState();
      if (!tournamentContract) throw new Error("Contract no inicializado");

      const [first, second, third] = params.winners;
      const thirdPlace = third ?? ethers.ZeroAddress;

      const tx = await tournamentContract.completeTournament(
        params.tournamentId,
        first,
        second,
        thirdPlace
      );

      const receipt = await tx.wait();

      return {
        success: true,
        txHash: tx.hash
      };
    } catch (error: any) {
      console.error("Error completing blockchain tournament:", error);
      
      let errorMsg = error.message;
      if (error.reason === "TM_NotCreator") {
        errorMsg = "Solo el creador puede completar el torneo";
      } else if (error.reason === "TM_DuplicateWinner") {
        errorMsg = "Los ganadores no pueden ser iguales";
      } else if (error.reason === "TM_InvalidWinner") {
        errorMsg = "Uno de los ganadores no es válido";
      }

      return {
        success: false,
        error: errorMsg
      };
    }
  },

  getTournamentBlockchainInfo: async (tournamentId) => {
    try {
      const { tournamentContract } = useGameStore.getState();
      if (!tournamentContract) throw new Error("Contract no inicializado");

      const info = await tournamentContract.getTournament(tournamentId);
      const players = await tournamentContract.getTournamentPlayers(tournamentId);
      const prizes = await tournamentContract.calculatePrizes(tournamentId);

      return {
        creator: info.creator,
        status: info.status,
        entryFee: ethers.formatEther(info.entryFee),
        playerCount: info.playerCount.toString(),
        totalPrizePool: ethers.formatEther(info.totalPrizePool),
        size: info.size,
        players,
        prizes: {
          first: ethers.formatEther(prizes[0]),
          second: ethers.formatEther(prizes[1]),
          third: ethers.formatEther(prizes[2])
        }
      };
    } catch (error) {
      console.error("Error fetching tournament info:", error);
      return null;
    }
  }
}));

// ============================================
// 3. COMPONENTE: TournamentJoinButton
// ============================================
// Ubicación: frontend/src/components/TournamentJoinButton.tsx

import { useState } from "react";
import { useGameStore } from "../hooks/useGameStore";
import { Toast } from "./Toast";

interface TournamentJoinButtonProps {
  tournamentId: number;
  entryFeeDisplay: string;
  onJoinSuccess?: () => void;
}

export function TournamentJoinButton({
  tournamentId,
  entryFeeDisplay,
  onJoinSuccess
}: TournamentJoinButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const joinBlockchainTournament = useGameStore(
    state => state.joinBlockchainTournament
  );

  const handleJoin = async () => {
    setLoading(true);
    try {
      const result = await joinBlockchainTournament(tournamentId);

      if (result.success) {
        setToastMessage("✅ ¡Te uniste al torneo! Tu MATIC fue depositado.");
        setToastType("success");
        onJoinSuccess?.();
      } else {
        setToastMessage(`❌ ${result.error}`);
        setToastType("error");
      }
    } catch (error) {
      setToastMessage("❌ Error al unirse. Intenta de nuevo.");
      setToastType("error");
    } finally {
      setLoading(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
    }
  };

  return (
    <>
      <button
        onClick={handleJoin}
        disabled={loading}
        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 rounded-lg text-white font-semibold transition"
      >
        {loading ? "Uniéndose..." : `Unirme (${entryFeeDisplay} MATIC)`}
      </button>

      {showToast && <Toast message={toastMessage} type={toastType} />}
    </>
  );
}

// ============================================
// 4. COMPONENTE: TournamentResultsForm
// ============================================
// Ubicación: frontend/src/components/TournamentResultsForm.tsx

import { useState } from "react";
import { useGameStore } from "../hooks/useGameStore";
import { Toast } from "./Toast";

interface TournamentResultsFormProps {
  tournamentId: number;
  players: string[];
  isTournament16: boolean;
  onSubmitSuccess?: () => void;
}

export function TournamentResultsForm({
  tournamentId,
  players,
  isTournament16,
  onSubmitSuccess
}: TournamentResultsFormProps) {
  const [winners, setWinners] = useState<{
    first: string;
    second: string;
    third: string;
  }>({
    first: "",
    second: "",
    third: ""
  });

  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const completeBlockchainTournament = useGameStore(
    state => state.completeBlockchainTournament
  );

  const handleSubmit = async () => {
    if (!winners.first || !winners.second) {
      setToastMessage("❌ Debes seleccionar primer y segundo lugar");
      setShowToast(true);
      return;
    }

    if (isTournament16 && !winners.third) {
      setToastMessage("❌ Debes seleccionar tercer lugar para tournament de 16");
      setShowToast(true);
      return;
    }

    setLoading(true);
    try {
      const result = await completeBlockchainTournament({
        tournamentId,
        winners: [
          winners.first,
          winners.second,
          isTournament16 ? winners.third : undefined
        ] as any
      });

      if (result.success) {
        setToastMessage(`✅ ¡Torneo completado! TX: ${result.txHash?.slice(0, 10)}...`);
        onSubmitSuccess?.();
      } else {
        setToastMessage(`❌ ${result.error}`);
      }
    } catch (error) {
      setToastMessage("❌ Error al completar torneo");
    } finally {
      setLoading(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
    }
  };

  return (
    <div className="p-6 bg-gray-900 rounded-lg border border-yellow-500">
      <h3 className="text-xl font-bold text-white mb-4">Reportar Resultados</h3>

      <div className="space-y-4">
        {/* 1er Lugar */}
        <div>
          <label className="block text-sm font-semibold text-yellow-400 mb-2">
            🥇 1er Lugar (70%)
          </label>
          <select
            value={winners.first}
            onChange={(e) => setWinners({ ...winners, first: e.target.value })}
            className="w-full px-3 py-2 bg-gray-800 border border-yellow-400 rounded text-white"
          >
            <option value="">Selecciona jugador</option>
            {players.map((player) => (
              <option key={player} value={player}>
                {player.slice(0, 6)}...{player.slice(-4)}
              </option>
            ))}
          </select>
        </div>

        {/* 2do Lugar */}
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            🥈 2do Lugar (20%)
          </label>
          <select
            value={winners.second}
            onChange={(e) => setWinners({ ...winners, second: e.target.value })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-500 rounded text-white"
          >
            <option value="">Selecciona jugador</option>
            {players.map((player) => (
              <option key={player} value={player}>
                {player.slice(0, 6)}...{player.slice(-4)}
              </option>
            ))}
          </select>
        </div>

        {/* 3er Lugar (si aplica) */}
        {isTournament16 && (
          <div>
            <label className="block text-sm font-semibold text-orange-600 mb-2">
              🥉 3er Lugar (10%)
            </label>
            <select
              value={winners.third}
              onChange={(e) => setWinners({ ...winners, third: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-orange-600 rounded text-white"
            >
              <option value="">Selecciona jugador</option>
              {players.map((player) => (
                <option key={player} value={player}>
                  {player.slice(0, 6)}...{player.slice(-4)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full mt-6 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 rounded-lg text-black font-bold text-lg transition"
      >
        {loading ? "Procesando..." : "✅ Completar Torneo"}
      </button>

      {showToast && <Toast message={toastMessage} type={toastMessage.includes("✅") ? "success" : "error"} />}
    </div>
  );
}

// ============================================
// 5. MODIFICAR TournamentsScreen.tsx
// ============================================
// Agregar integración blockchain a componente existente:

// En TournamentsScreen.tsx, agregar:

import { useTournamentContractWeb3 } from "../hooks/useTournamentContractWeb3";
import { useGameStore } from "../hooks/useGameStore";
import { TournamentJoinButton } from "./TournamentJoinButton";
import { TournamentResultsForm } from "./TournamentResultsForm";

export function TournamentsScreen() {
  const { contract, isConnected } = useTournamentContractWeb3();
  const tournamentLobbies = useGameStore(state => state.tournamentLobbies);
  const setTournamentContract = useGameStore(state => state.setTournamentContract);

  // Inicializar contrato en store cuando esté listo
  useEffect(() => {
    if (contract) {
      setTournamentContract(contract);
    }
  }, [contract, setTournamentContract]);

  if (!isConnected) {
    return (
      <div className="p-4 text-red-500">
        ❌ Wallet no conectada. Conecta MetaMask para acceder a torneos con apuestas.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {tournamentLobbies.map((lobby) => (
        <div key={lobby.id} className="p-4 bg-gray-800 rounded-lg border border-yellow-500">
          <h3 className="text-lg font-bold">{lobby.name}</h3>
          <p className="text-sm text-gray-300">Jugadores: {lobby.players.length}/{lobby.maxPlayers}</p>

          {/* Si es el creador y tournament no está full, mostrar botón de join */}
          {lobby.players.length < lobby.maxPlayers && (
            <TournamentJoinButton
              tournamentId={parseInt(lobby.id)}
              entryFeeDisplay={lobby.entryFee}
              onJoinSuccess={() => {
                // Refrescar información del torneo
              }}
            />
          )}

          {/* Si es el creador y tournament está completo, mostrar formulario de resultados */}
          {lobby.isCreator && lobby.players.length === lobby.maxPlayers && (
            <TournamentResultsForm
              tournamentId={parseInt(lobby.id)}
              players={lobby.players}
              isTournament16={lobby.maxPlayers === 16}
              onSubmitSuccess={() => {
                // Refrescar información
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================
// 6. AMBIENTE: .env.local
// ============================================

VITE_TOURNAMENT_MANAGER_ADDRESS=0x... // Dirección después de deployar
VITE_POLYGON_RPC=https://rpc.ankr.com/polygon
VITE_NETWORK_ID=137

// ============================================
// 7. TESTING DE INTEGRACIÓN
// ============================================

// Crear test file: frontend/src/hooks/__tests__/useTournamentContractWeb3.test.ts

import { renderHook, act } from "@testing-library/react";
import { useTournamentContractWeb3 } from "../useTournamentContractWeb3";
import { useGameStore } from "../useGameStore";

describe("Tournament Contract Integration", () => {
  it("should initialize contract on hook mount", async () => {
    const { result } = renderHook(() => useTournamentContractWeb3());
    
    await act(async () => {
      // Esperar inicialización
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(result.current.contract).toBeDefined();
  });

  it("should create tournament via store action", async () => {
    const store = useGameStore.getState();

    const result = await store.createBlockchainTournament({
      size: 0,
      entryFee: "1.0",
      firstPlacePct: 75,
      secondPlacePct: 25,
      thirdPlacePct: 0
    });

    expect(result.success).toBe(true);
    expect(result.tournamentId).toBeDefined();
  });
});

// ============================================
// 8. FLUJO COMPLETO DEL USUARIO
// ============================================

/*
1. Usuario entra en TournamentsScreen
   ↓
2. Si wallet no conectada: "Conecta MetaMask"
   ↓
3. Ve lista de torneos con entry fees
   ↓
4. Hace click en "Unirme (1.0 MATIC)"
   ↓
5. MetaMask pide confirmación de transacción
   ↓
6. Fondos se escrowean en contrato
   ↓
7. Una vez llenado el torneo, creador inicia
   ↓
8. Juegos se juegan (sin blockchain)
   ↓
9. Creador reporta resultados:
   - Selecciona ganadores
   - Click "Completar Torneo"
   - MetaMask confirma
   ↓
10. Premios distribuidos automáticamente:
    - 1er lugar: 75%
    - 2do lugar: 25%
    - (3er lugar: 10% si 16-player)
   ↓
11. Transacción finaliza, evento emitido
    ↓
12. Usuarios ven notificación "✅ Recibiste X MATIC"
*/

// ============================================
// RESUMEN DE CAMBIOS NECESARIOS
// ============================================

/*
ARCHIVOS A CREAR:
✅ frontend/src/hooks/useTournamentContractWeb3.ts
✅ frontend/src/components/TournamentJoinButton.tsx
✅ frontend/src/components/TournamentResultsForm.tsx

ARCHIVOS A MODIFICAR:
✅ frontend/src/hooks/useGameStore.ts (agregar 3 actions + 1 setter)
✅ frontend/src/views/TournamentsScreen.tsx (integrar componentes + isConnected check)
✅ frontend/.env.local (agregar VITE_TOURNAMENT_MANAGER_ADDRESS)

VARIABLES DE ENTORNO:
✅ VITE_TOURNAMENT_MANAGER_ADDRESS
✅ VITE_POLYGON_RPC (opcional)
✅ VITE_NETWORK_ID (opcional)

DEPENDENCIAS (ya instaladas):
✅ ethers: ^6.0
✅ @openzeppelin/contracts: (en Hardhat)
✅ typechain: (auto-generado)
*/
