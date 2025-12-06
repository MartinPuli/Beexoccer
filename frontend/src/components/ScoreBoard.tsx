import { ReactNode } from "react";

interface ScoreBoardProps {
  creatorScore: number;
  challengerScore: number;
  turnLabel: string;
  children?: ReactNode;
}

/**
 * Minimal scoreboard shown on the Playing screen.
 */
export function ScoreBoard({ creatorScore, challengerScore, turnLabel, children }: Readonly<ScoreBoardProps>) {
  return (
    <div className="scoreboard">
      <span>Local {creatorScore}</span>
      <span style={{ color: "var(--accent-amber)", fontSize: "0.95rem" }}>{turnLabel}</span>
      <span>{challengerScore} Visitante</span>
      {children}
    </div>
  );
}
