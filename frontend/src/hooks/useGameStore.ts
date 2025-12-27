import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  MatchLobby,
  GoalTarget,
  PlayingSnapshot,
  MatchEvent,
  MatchMode,
  TIMED_MATCH_DURATION_MS,
} from "../types/game";
import type { TournamentConfig, TournamentLobby, TournamentSize } from "../types/tournaments";

type ViewId =
  | "home"
  | "create"
  | "createBot"
  | "accept"
  | "playing"
  | "bot"
  | "waiting"
  | "connect"
  | "ranking"
  | "teamSelect"
  | "tournaments";

interface WaitingMatchInfo {
  matchId: number;
  goals: GoalTarget;
  mode?: MatchMode;
  durationMs?: number;
  isFree: boolean;
  stakeAmount: string;
  creatorAddress: string; // Dirección del creador para verificar propiedad
}

// Datos de partida activa para restaurar
interface ActiveMatchInfo {
  matchId: string;
  playerSide: "creator" | "challenger";
  goalTarget: GoalTarget;
  mode?: MatchMode;
  durationMs?: number;
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
  tournamentLobbies: TournamentLobby[];
  selectedTournamentId?: string;
  pendingMatches: MatchLobby[];
  currentMatchId?: string;
  playerSide: "creator" | "challenger";
  matchGoalTarget: GoalTarget;
  matchMode: MatchMode;
  matchDurationMs?: number;
  matchStatus: "idle" | "playing" | "ended";
  playing?: PlayingSnapshot;
  lastEvent?: MatchEvent;
  waitingMatch?: WaitingMatchInfo;
  activeMatch?: ActiveMatchInfo;
  pendingRematch?: PendingRematch;
  consecutiveTimeouts: number; // Contador de timeouts seguidos
  selectedTeamId?: string;
  setView: (view: ViewId) => void;
  setAlias: (alias: string) => void;
  setBalance: (balance: string) => void;
  setUserAddress: (address: string) => void;
  createTournament: (config: TournamentConfig) => string;
  selectTournament: (tournamentId?: string) => void;
  joinTournament: (tournamentId: string) => void;
  setTournamentWinner: (tournamentId: string, matchId: string, winner: "a" | "b") => void;
  setMatches: (matches: MatchLobby[]) => void;
  setCurrentMatchId: (matchId?: string) => void;
  setPlayerSide: (side: "creator" | "challenger") => void;
  setMatchGoalTarget: (goal: GoalTarget) => void;
  setMatchMode: (mode: MatchMode) => void;
  setMatchDurationMs: (durationMs?: number) => void;
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
  setSelectedTeamId: (teamId?: string) => void;
}

const TURN_DURATION_MS = 15_000;

const shortAddress = (addr?: string) => {
  const a = (addr || "").trim();
  if (!a) return "WALLET";
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
};

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

const createTournamentMatchIds = (size: TournamentSize): string[] => {
  const ids: string[] = [];
  const makeId = (round: number, order: number) => `main-r${round}-m${order}`;
  const firstRoundMatches = size / 2;
  for (let i = 0; i < firstRoundMatches; i++) ids.push(makeId(1, i + 1));
  let round = 2;
  let prevRoundCount = firstRoundMatches;
  while (prevRoundCount > 1) {
    const roundCount = prevRoundCount / 2;
    for (let i = 0; i < roundCount; i++) ids.push(makeId(round, i + 1));
    prevRoundCount = roundCount;
    round++;
  }
  if (size === 16) ids.push("third-place");
  return ids;
};

const computeTournamentDescendants = (size: TournamentSize, fromMatchId: string): string[] => {
  const ids = createTournamentMatchIds(size);
  const edges = new Map<string, string[]>();
  const makeId = (round: number, order: number) => `main-r${round}-m${order}`;

  const firstRoundMatches = size / 2;
  let round = 2;
  let prevRoundCount = firstRoundMatches;
  while (prevRoundCount > 1) {
    const roundCount = prevRoundCount / 2;
    for (let i = 0; i < roundCount; i++) {
      const parent = makeId(round, i + 1);
      const left = makeId(round - 1, i * 2 + 1);
      const right = makeId(round - 1, i * 2 + 2);
      edges.set(left, [...(edges.get(left) ?? []), parent]);
      edges.set(right, [...(edges.get(right) ?? []), parent]);
    }
    prevRoundCount = roundCount;
    round++;
  }

  if (size === 16) {
    const semi1 = makeId(3, 1);
    const semi2 = makeId(3, 2);
    edges.set(semi1, [...(edges.get(semi1) ?? []), "third-place"]);
    edges.set(semi2, [...(edges.get(semi2) ?? []), "third-place"]);
  }

  const visited = new Set<string>();
  const stack = [fromMatchId];
  while (stack.length) {
    const cur = stack.pop()!;
    const next = edges.get(cur) ?? [];
    for (const n of next) {
      if (visited.has(n)) continue;
      visited.add(n);
      stack.push(n);
    }
  }

  return ids.filter((id) => visited.has(id));
};

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      view: "home",
      alias: "Invitado",
      balance: "0.00 XO",
      userAddress: "",
      tournamentLobbies: [],
      selectedTournamentId: undefined,
      pendingMatches: [],
      currentMatchId: undefined,
      playerSide: "creator",
      matchGoalTarget: 3,
      matchMode: "goals",
      matchDurationMs: undefined,
      matchStatus: "idle",
      playing: defaultSnapshot(),
      waitingMatch: undefined,
      activeMatch: undefined,
      pendingRematch: undefined,
      consecutiveTimeouts: 0,
      selectedTeamId: "river",
      setView: (view) => set({ view }),
      setAlias: (alias) => set({ alias }),
      setBalance: (balance) => set({ balance }),
      setUserAddress: (userAddress) => set({ userAddress }),
      createTournament: (config) => {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const createdAt = Date.now();
        set((state) => {
          const creatorAddress = state.userAddress || "";
          const creatorAlias = shortAddress(creatorAddress) || state.alias || "Invitado";
          const me = {
            id: creatorAddress || `local-${id}`,
            address: creatorAddress || undefined,
            alias: creatorAlias,
          };
          const lobby: TournamentLobby = {
            id,
            createdAt,
            creatorAddress,
            creatorAlias,
            config,
            players: [me],
            results: {},
          };
          return {
            tournamentLobbies: [lobby, ...state.tournamentLobbies],
            selectedTournamentId: id,
          };
        });
        return id;
      },
      selectTournament: (selectedTournamentId) => set({ selectedTournamentId }),
      joinTournament: (tournamentId) => {
        set((state) => {
          const userAddress = state.userAddress || "";
          const userAlias = shortAddress(userAddress) || state.alias || "Invitado";
          return {
            tournamentLobbies: state.tournamentLobbies.map((t) => {
              if (t.id !== tournamentId) return t;
              if (t.players.length >= t.config.size) return t;
              if (userAddress && t.players.some((p) => p.address?.toLowerCase() === userAddress.toLowerCase())) return t;

              const playerId = userAddress || `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
              const nextPlayer = { id: playerId, address: userAddress || undefined, alias: userAlias };
              return { ...t, players: [...t.players, nextPlayer] };
            })
          };
        });
      },
      setTournamentWinner: (tournamentId, matchId, winner) => {
        set((state) => {
          const t = state.tournamentLobbies.find((x) => x.id === tournamentId);
          if (!t) return state;
          const descendants = computeTournamentDescendants(t.config.size as TournamentSize, matchId);
          const nextResults = { ...t.results, [matchId]: { winner } };
          for (const depId of descendants) {
            delete nextResults[depId];
          }
          return {
            tournamentLobbies: state.tournamentLobbies.map((x) =>
              x.id === tournamentId ? { ...x, results: nextResults } : x
            ),
          };
        });
      },
      setMatches: (pendingMatches) => set({ pendingMatches }),
      setCurrentMatchId: (currentMatchId) => set({ currentMatchId }),
      setPlayerSide: (playerSide) => set({ playerSide }),
      setMatchGoalTarget: (matchGoalTarget) => set({ matchGoalTarget }),
      setMatchMode: (matchMode) =>
        set({
          matchMode,
          matchDurationMs:
            matchMode === "time" ? TIMED_MATCH_DURATION_MS : undefined,
        }),
      setMatchDurationMs: (matchDurationMs) => set({ matchDurationMs }),
      setMatchStatus: (matchStatus) => set({ matchStatus }),
      setPlayingSnapshot: (playing) => set({ playing }),
      applyRealtimeSnapshot: (playing) => set({ playing }),
      setLastEvent: (lastEvent) => set({ lastEvent }),
      setWaitingMatch: (waitingMatch) => set({ waitingMatch }),
      setActiveMatch: (activeMatch) => set({ activeMatch }),
      setPendingRematch: (pendingRematch) => set({ pendingRematch }),
      setSelectedTeamId: (selectedTeamId) => set({ selectedTeamId }),
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
        tournamentLobbies: state.tournamentLobbies,
        selectedTournamentId: state.selectedTournamentId,
        userAddress: state.userAddress,
        selectedTeamId: state.selectedTeamId,
      })
    }
  )
);

export type { ViewId, PendingRematch };
