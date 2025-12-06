interface ScoreBoardProps {
  creatorScore: number;
  challengerScore: number;
  turnLabel: string;
}

/**
 * Minimal scoreboard shown on the Playing screen.
 */
export function ScoreBoard({ creatorScore, challengerScore, turnLabel }: Readonly<ScoreBoardProps>) {
  return (
    <div className="scoreboard">
      <span>Local {creatorScore}</span>
      <span style={{ color: "var(--accent-amber)", fontSize: "0.95rem" }}>{turnLabel}</span>
      <span>{challengerScore} Visitante</span>
    </div>
  );
}
