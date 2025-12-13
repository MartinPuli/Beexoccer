import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MatchLobby, GoalTarget, PlayingSnapshot, MatchEvent } from "../types/game";

type ViewId = "home" | "create" | "createBot" | "accept" | "playing" | "bot" | "waiting" | "connect" | "freeOnline";

interface WaitingMatchInfo {
  matchId: number;
  goals: GoalTarget;
  isFree: boolean;
  stakeAmount: string;
  creatorAddress: string; // Dirección del creador para verificar propiedad
}

// Datos de partida activa para restaurar
interface ActiveMatchInfo {
  matchId: string;
  playerSide: "creator" | "challenger";
  goalTarget: GoalTarget;
  userAddress: string; // Dirección del usuario para verificar propiedad
}

// Datos de solicitud de revancha pendiente
interface PendingRematch {
  matchId: string;
  fromSide: "creator" | "challenger";
  rivalAlias: string;
  expiresAt: number;
}

interface GameStore {
  view: ViewId;
  alias: string;
  balance: string;
  userAddress: string;
  pendingMatches: MatchLobby[];
  currentMatchId?: string;
  playerSide: "creator" | "challenger";
  matchGoalTarget: GoalTarget;
  matchStatus: "idle" | "playing" | "ended";
  playing?: PlayingSnapshot;
  lastEvent?: MatchEvent;
  waitingMatch?: WaitingMatchInfo;
  activeMatch?: ActiveMatchInfo;
  pendingRematch?: PendingRematch;
  consecutiveTimeouts: number; // Contador de timeouts seguidos
  setView: (view: ViewId) => void;
  setAlias: (alias: string) => void;
  setBalance: (balance: string) => void;
  setUserAddress: (address: string) => void;
  setMatches: (matches: MatchLobby[]) => void;
  setCurrentMatchId: (matchId?: string) => void;
  setPlayerSide: (side: "creator" | "challenger") => void;
  setMatchGoalTarget: (goal: GoalTarget) => void;
  setMatchStatus: (status: "idle" | "playing" | "ended") => void;
  setPlayingSnapshot: (snapshot?: PlayingSnapshot) => void;
  applyRealtimeSnapshot: (snapshot: PlayingSnapshot) => void;
  setLastEvent: (event?: MatchEvent) => void;
  triggerGoal: (scorer: "creator" | "challenger") => void;
  registerTimeout: () => void;
  clearLastEvent: () => void;
  setWaitingMatch: (info?: WaitingMatchInfo) => void;
  setActiveMatch: (info?: ActiveMatchInfo) => void;
  setPendingRematch: (info?: PendingRematch) => void;
  resetTimeoutCounter: () => void;
  clearSession: () => void;
}

const TURN_DURATION_MS = 15_000;

const defaultSnapshot = (): PlayingSnapshot => ({
  activePlayer: "creator",
  turnEndsAt: Date.now() + TURN_DURATION_MS,
  creatorScore: 0,
  challengerScore: 0,
  commentary: "Arrastra tu ficha para preparar el disparo",
  ball: { x: 300, y: 450, vx: 0, vy: 0 },
  chips: [
    { id: "creator-1", x: 300, y: 160, radius: 28, fill: "#2dd673", flagEmoji: "🏠", owner: "creator" },
    { id: "challenger-1", x: 300, y: 740, radius: 28, fill: "#ffe45b", flagEmoji: "🚩", owner: "challenger" }
  ]
});

const rotatePlayer = (current: "creator" | "challenger"): "creator" | "challenger" =>
  current === "creator" ? "challenger" : "creator";

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      view: "home",
      alias: "Invitado",
      balance: "0.00 XO",
      userAddress: "",
      pendingMatches: [],
      currentMatchId: undefined,
      playerSide: "creator",
      matchGoalTarget: 3,
      matchStatus: "idle",
      playing: defaultSnapshot(),
      waitingMatch: undefined,
      activeMatch: undefined,
      pendingRematch: undefined,
      consecutiveTimeouts: 0,
      setView: (view) => set({ view }),
      setAlias: (alias) => set({ alias }),
      setBalance: (balance) => set({ balance }),
      setUserAddress: (userAddress) => set({ userAddress }),
      setMatches: (pendingMatches) => set({ pendingMatches }),
      setCurrentMatchId: (currentMatchId) => set({ currentMatchId }),
      setPlayerSide: (playerSide) => set({ playerSide }),
      setMatchGoalTarget: (matchGoalTarget) => set({ matchGoalTarget }),
      setMatchStatus: (matchStatus) => set({ matchStatus }),
      setPlayingSnapshot: (playing) => set({ playing }),
      applyRealtimeSnapshot: (playing) => set({ playing }),
      setLastEvent: (lastEvent) => set({ lastEvent }),
      setWaitingMatch: (waitingMatch) => set({ waitingMatch }),
      setActiveMatch: (activeMatch) => set({ activeMatch }),
      setPendingRematch: (pendingRematch) => set({ pendingRematch }),
      resetTimeoutCounter: () => set({ consecutiveTimeouts: 0 }),
      clearSession: () => set({ 
        waitingMatch: undefined, 
        activeMatch: undefined, 
        pendingRematch: undefined,
        matchStatus: "idle",
        currentMatchId: undefined,
        consecutiveTimeouts: 0
      }),
      triggerGoal: (scorer) =>
        set((state) => {
          if (!state.playing) return state;
          const isCreator = scorer === "creator";
          const updatedScore = isCreator
            ? state.playing.creatorScore + 1
            : state.playing.challengerScore + 1;

          const nextSnapshot: PlayingSnapshot = {
            ...state.playing,
            creatorScore: isCreator ? updatedScore : state.playing.creatorScore,
            challengerScore: isCreator ? state.playing.challengerScore : updatedScore,
            activePlayer: rotatePlayer(scorer),
            turnEndsAt: Date.now() + TURN_DURATION_MS,
            ball: { x: 300, y: 450, vx: 0, vy: 0 },
            chips: state.playing.chips,
            commentary: isCreator ? "Ventaja para tu equipo" : "El rival recorta distancia"
          };

          const event: MatchEvent = {
            type: isCreator ? "goal-self" : "goal-rival",
            message: isCreator ? "¡Golazo!" : "Gol rival",
            accent: isCreator ? "#00ff9d" : "#ff4f64",
            timestamp: Date.now()
          };

          // Reset timeout counter on goal
          return { playing: nextSnapshot, lastEvent: event, consecutiveTimeouts: 0 };
        }),
      registerTimeout: () =>
        set((state) => {
          if (!state.playing) return state;
          const timedOutPlayer = state.playing.activePlayer;
          const nextPlayer = rotatePlayer(timedOutPlayer);
          
          // Incrementar contador solo para el jugador local
          const newTimeouts = timedOutPlayer === state.playerSide 
            ? state.consecutiveTimeouts + 1 
            : 0; // Reset si es el rival
          
          const event: MatchEvent = {
            type: "timeout",
            message: timedOutPlayer === state.playerSide ? "Perdiste tu turno" : "El rival se quedó sin jugar",
            accent: "#ffb347",
            timestamp: Date.now()
          };

          return {
            playing: {
              ...state.playing,
              activePlayer: nextPlayer,
              turnEndsAt: Date.now() + TURN_DURATION_MS,
              commentary: nextPlayer === state.playerSide ? "Tu turno nuevamente" : "Esperando al rival"
            },
            lastEvent: event,
            consecutiveTimeouts: newTimeouts
          };
        }),
      clearLastEvent: () => set({ lastEvent: undefined })
    }),
    {
      name: "beexoccer-session",
      partialize: (state) => ({
        // Solo persistir datos de sesión críticos
        waitingMatch: state.waitingMatch,
        activeMatch: state.activeMatch,
        userAddress: state.userAddress
      })
    }
  )
);

export type { ViewId, PendingRematch };
