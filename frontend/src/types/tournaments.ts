import type { GoalTarget, MatchMode } from "./game";

export type TournamentSize = 4 | 8 | 16;

export type TournamentPrizeRule = {
  place: 1 | 2 | 3;
  pct: number;
};

export type TournamentMatchResult = {
  winner: "a" | "b";
};

export type TournamentPlayer = {
  id: string;
  address?: string;
  alias: string;
};

export type TournamentConfig = {
  size: TournamentSize;
  mode: MatchMode;
  goals: GoalTarget;
  durationMs?: number;
  isFree: boolean;
  entryFee: string; // human readable (POL)
};

export type TournamentLobby = {
  id: string;
  createdAt: number;
  creatorAddress: string;
  creatorAlias: string;
  config: TournamentConfig;
  players: TournamentPlayer[];
  results: Record<string, TournamentMatchResult | undefined>;
};
