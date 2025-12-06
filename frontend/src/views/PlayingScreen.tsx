import { useMemo } from "react";
import { Panel } from "../components/Panel";
import { PitchCanvas } from "../components/PitchCanvas";
import { ScoreBoard } from "../components/ScoreBoard";
import { useGameStore } from "../hooks/useGameStore";
import { TokenChip } from "../types/game";

const baseChips: TokenChip[] = [
  { id: "br-1", x: 300, y: 140, radius: 28, fill: "#ffe45b", flagEmoji: "🇧🇷" },
  { id: "br-2", x: 220, y: 210, radius: 28, fill: "#ffe45b", flagEmoji: "🇧🇷" },
  { id: "br-3", x: 380, y: 210, radius: 28, fill: "#ffe45b", flagEmoji: "🇧🇷" },
  { id: "it-1", x: 260, y: 690, radius: 28, fill: "#2dd673", flagEmoji: "🇮🇹" },
  { id: "it-2", x: 340, y: 690, radius: 28, fill: "#2dd673", flagEmoji: "🇮🇹" },
  { id: "it-3", x: 300, y: 760, radius: 28, fill: "#2dd673", flagEmoji: "🇮🇹" }
];

/**
 * Field view referencing the Soccer de Plato reference. Real physics will live here in later iterations.
 */
export function PlayingScreen() {
  const playing = useGameStore((state) => state.playing);

  const chips = useMemo(() => baseChips, []);
  const ball = playing?.ball ?? { x: 300, y: 450 };
  let turnPrefix: string | undefined;
  if (playing) {
    turnPrefix = playing.activePlayer === "creator" ? "Tu" : "Rival";
  }
  const turnLabel = turnPrefix ? `${turnPrefix} turno` : "Preparando campo";

  return (
    <Panel title="Partida en curso" subtitle="Arrastra, apunta y suelta">
      <ScoreBoard
        creatorScore={playing?.creatorScore ?? 0}
        challengerScore={playing?.challengerScore ?? 0}
        turnLabel={turnLabel}
      />
      <PitchCanvas chips={chips} ball={ball} highlightId={playing?.activePlayer === "creator" ? "it-1" : "br-1"} />
      <div className="field-legend">
        <span>Turno: 15s • Turnos alternados</span>
        <span>Arrastra la ficha y suelta para disparar</span>
      </div>
    </Panel>
  );
}
