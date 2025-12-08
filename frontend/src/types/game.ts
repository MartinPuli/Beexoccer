/**
 * Shared Beexoccer type definitions. Keeping them centralized avoids circular imports
 * between the different views (Home, CreateMatch, AcceptMatch, etc.).
 */
export type GoalTarget = 2 | 3 | 5;

export interface MatchConfig {
  goals: GoalTarget;
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
  creatorScore: number;
  challengerScore: number;
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
