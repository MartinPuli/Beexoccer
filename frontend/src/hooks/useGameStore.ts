import { create } from "zustand";
import { MatchLobby, GoalTarget, PlayingSnapshot, MatchEvent } from "../types/game";

type ViewId = "home" | "create" | "accept" | "playing" | "bot";

interface GameStore {
  view: ViewId;
  alias: string;
  balance: string;
  pendingMatches: MatchLobby[];
  currentMatchId?: string;
  playerSide: "creator" | "challenger";
  matchGoalTarget: GoalTarget;
  matchStatus: "idle" | "playing" | "ended";
  playing?: PlayingSnapshot;
  lastEvent?: MatchEvent;
  setView: (view: ViewId) => void;
  setAlias: (alias: string) => void;
  setBalance: (balance: string) => void;
  setMatches: (matches: MatchLobby[]) => void;
  setCurrentMatchId: (matchId?: string) => void;
  setPlayerSide: (side: "creator" | "challenger") => void;
  setMatchGoalTarget: (goal: GoalTarget) => void;
  setMatchStatus: (status: "idle" | "playing" | "ended") => void;
  setPlayingSnapshot: (snapshot?: PlayingSnapshot) => void;
  applyRealtimeSnapshot: (snapshot: PlayingSnapshot) => void;
  setLastEvent: (event?: MatchEvent) => void;
  appendMockMatch: () => void;
  triggerGoal: (scorer: "creator" | "challenger") => void;
  registerTimeout: () => void;
  clearLastEvent: () => void;
}

const demoLobby = (id: number): MatchLobby => ({
  id,
  creator: "0xCreator",
  challenger: undefined,
  goals: (id % 2 === 0 ? 3 : 5) as GoalTarget,
  isFree: id % 2 === 0,
  stakeAmount: id % 2 === 0 ? "0" : "5",
  stakeToken: "0x0000000000000000000000000000000000000000",
  open: true
});

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

export const useGameStore = create<GameStore>((set) => ({
  view: "home",
  alias: "Invitado",
  balance: "0.00 XO",
  pendingMatches: [demoLobby(1), demoLobby(2)],
  currentMatchId: undefined,
  playerSide: "creator",
  matchGoalTarget: 3,
  matchStatus: "idle",
  playing: defaultSnapshot(),
  setView: (view) => set({ view }),
  setAlias: (alias) => set({ alias }),
  setBalance: (balance) => set({ balance }),
  setMatches: (pendingMatches) => set({ pendingMatches }),
  setCurrentMatchId: (currentMatchId) => set({ currentMatchId }),
  setPlayerSide: (playerSide) => set({ playerSide }),
  setMatchGoalTarget: (matchGoalTarget) => set({ matchGoalTarget }),
  setMatchStatus: (matchStatus) => set({ matchStatus }),
  setPlayingSnapshot: (playing) => set({ playing }),
  applyRealtimeSnapshot: (playing) => set({ playing }),
  setLastEvent: (lastEvent) => set({ lastEvent }),
  appendMockMatch: () =>
    set((state) => ({ pendingMatches: [...state.pendingMatches, demoLobby(state.pendingMatches.length + 1)] })),
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

      return { playing: nextSnapshot, lastEvent: event };
    }),
  registerTimeout: () =>
    set((state) => {
      if (!state.playing) return state;
      const timedOutPlayer = state.playing.activePlayer;
      const nextPlayer = rotatePlayer(timedOutPlayer);
      const event: MatchEvent = {
        type: "timeout",
        message: timedOutPlayer === "creator" ? "Perdiste tu turno" : "El rival se quedó sin jugar",
        accent: "#ffb347",
        timestamp: Date.now()
      };

      return {
        playing: {
          ...state.playing,
          activePlayer: nextPlayer,
          turnEndsAt: Date.now() + TURN_DURATION_MS,
          commentary: nextPlayer === "creator" ? "Tu turno nuevamente" : "Esperando al rival"
        },
        lastEvent: event
      };
    }),
  clearLastEvent: () => set({ lastEvent: undefined })
}));

export type { ViewId };
