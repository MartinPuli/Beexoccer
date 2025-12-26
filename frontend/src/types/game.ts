/**
 * Shared Beexoccer type definitions. Keeping them centralized avoids circular imports
 * between the different views (Home, CreateMatch, AcceptMatch, etc.).
 */
export type GoalTarget = 2 | 3 | 5;

export type MatchMode = "goals" | "time";

export const TIMED_MATCH_DURATION_MS = 180_000;

export interface MatchConfig {
  goals: GoalTarget;
  mode: MatchMode;
  durationMs?: number;
  isFree: boolean;
  stakeAmount: string; // Human-readable (ether-style) number for UI binding.
  stakeToken: string; // ERC-20 address or 0x0 for native MATIC.
}

export interface MatchLobby {
  id: number;
  creator: string;
  creatorAlias?: string;
  challenger?: string;
  challengerAlias?: string;
  goals: GoalTarget;
  mode?: MatchMode;
  durationMs?: number;
  isFree: boolean;
  stakeAmount: string;
  stakeToken: string;
  open: boolean;
  createdAt?: number;
  status?: "waiting" | "ready" | "playing";
}

export interface PlayingSnapshot {
  activePlayer: "creator" | "challenger";
  turnEndsAt: number; // Epoch ms for the 15 second shot clock.
  awaitingInput?: boolean; // True when a player is expected to shoot; false while simulation runs / waiting.
  creatorScore: number;
  challengerScore: number;
  matchMode?: MatchMode;
  matchEndsAt?: number;
  timeRemainingMs?: number;
  goldenGoal?: boolean;
  commentary: string;
  ball: { x: number; y: number; vx?: number; vy?: number };
  chips: TokenChip[];
}

export interface TokenChip {
  id: string;
  x: number;
  y: number;
  radius: number;
  fill: string;
  stroke?: string;
  flagEmoji: string;
  owner?: "creator" | "challenger";
}

export interface PhysicsState {
  ball: { x: number; y: number; vx: number; vy: number; radius: number };
  chips: TokenChip[];
}

export type MatchEventType = "goal-self" | "goal-rival" | "timeout" | "rematch-requested" | "rematch-confirmed";

export interface MatchEvent {
  type: MatchEventType;
  message: string;
  accent: string;
  timestamp: number;
  from?: "creator" | "challenger";
}
