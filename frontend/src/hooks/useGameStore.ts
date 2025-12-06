import { create } from "zustand";
import { MatchLobby, GoalTarget, PlayingSnapshot, MatchEvent } from "../types/game";

type ViewId = "home" | "create" | "accept" | "playing" | "bot";

interface GameStore {
  view: ViewId;
  alias: string;
  balance: string;
  pendingMatches: MatchLobby[];
  playing?: PlayingSnapshot;
  lastEvent?: MatchEvent;
  setView: (view: ViewId) => void;
  setAlias: (alias: string) => void;
  setBalance: (balance: string) => void;
  setMatches: (matches: MatchLobby[]) => void;
  setPlayingSnapshot: (snapshot?: PlayingSnapshot) => void;
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
  ball: { x: 300, y: 450 }
});

const rotatePlayer = (current: "creator" | "challenger"): "creator" | "challenger" =>
  current === "creator" ? "challenger" : "creator";

export const useGameStore = create<GameStore>((set) => ({
  view: "home",
  alias: "Invitado",
  balance: "0.00 XO",
  pendingMatches: [demoLobby(1), demoLobby(2)],
  playing: defaultSnapshot(),
  setView: (view) => set({ view }),
  setAlias: (alias) => set({ alias }),
  setBalance: (balance) => set({ balance }),
  setMatches: (pendingMatches) => set({ pendingMatches }),
  setPlayingSnapshot: (playing) => set({ playing }),
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
        ball: { x: 300, y: 450 },
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
