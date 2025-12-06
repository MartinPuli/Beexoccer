import { create } from "zustand";
import { MatchLobby, GoalTarget, PlayingSnapshot } from "../types/game";

type ViewId = "home" | "create" | "accept" | "playing" | "bot";

interface GameStore {
  view: ViewId;
  alias: string;
  balance: string;
  pendingMatches: MatchLobby[];
  playing?: PlayingSnapshot;
  setView: (view: ViewId) => void;
  setAlias: (alias: string) => void;
  setBalance: (balance: string) => void;
  setMatches: (matches: MatchLobby[]) => void;
  setPlayingSnapshot: (snapshot?: PlayingSnapshot) => void;
  appendMockMatch: () => void;
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

export const useGameStore = create<GameStore>((set) => ({
  view: "home",
  alias: "Invitado",
  balance: "0.00 XO",
  pendingMatches: [demoLobby(1), demoLobby(2)],
  setView: (view) => set({ view }),
  setAlias: (alias) => set({ alias }),
  setBalance: (balance) => set({ balance }),
  setMatches: (pendingMatches) => set({ pendingMatches }),
  setPlayingSnapshot: (playing) => set({ playing }),
  appendMockMatch: () =>
    set((state) => ({ pendingMatches: [...state.pendingMatches, demoLobby(state.pendingMatches.length + 1)] }))
}));

export type { ViewId };
