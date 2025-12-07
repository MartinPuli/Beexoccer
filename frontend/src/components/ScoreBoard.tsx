import { ReactNode } from "react";

interface ScoreBoardProps {
  creatorScore: number;
  challengerScore: number;
  turnLabel: string;
  children?: ReactNode;
}

/**
 * HUD bar matching the mock: TU vs RIVAL, progress bar, turn label.
 */
export function ScoreBoard({ creatorScore, challengerScore, turnLabel, children }: Readonly<ScoreBoardProps>) {
  return (
    <div className="scoreboard neon-frame">
      <div className="score-row">
        <span className="score-name you">TU</span>
        <div className="score-value">
          <span className="score-number">{creatorScore}</span>
          <span className="score-sep">-</span>
          <span className="score-number rival">{challengerScore}</span>
        </div>
        <span className="score-name rival">RIVAL</span>
      </div>
      <div className="score-turn">
        <div className="turn-track">
          <div className="turn-fill you" />
          <div className="turn-fill rival" />
        </div>
        <span className="turn-label">{turnLabel}</span>
      </div>
      {children}
    </div>
  );
}
