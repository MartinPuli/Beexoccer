import { useCallback, useEffect, useMemo } from "react";
import { Panel } from "../components/Panel";
import { PitchCanvas } from "../components/PitchCanvas";
import { ScoreBoard } from "../components/ScoreBoard";
import { useGameStore } from "../hooks/useGameStore";
import { TokenChip } from "../types/game";
import { TurnTimer } from "../components/TurnTimer";
import { EventOverlay } from "../components/EventOverlay";
import { NeonButton } from "../components/NeonButton";

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
  const lastEvent = useGameStore((state) => state.lastEvent);
  const triggerGoal = useGameStore((state) => state.triggerGoal);
  const registerTimeout = useGameStore((state) => state.registerTimeout);
  const clearLastEvent = useGameStore((state) => state.clearLastEvent);

  const chips = useMemo(() => baseChips, []);
  const ball = playing?.ball ?? { x: 300, y: 450 };
  let turnPrefix: string | undefined;
  if (playing) {
    turnPrefix = playing.activePlayer === "creator" ? "Tu" : "Rival";
  }
  const turnLabel = turnPrefix ? `${turnPrefix} turno` : "Preparando campo";

  useEffect(() => {
    if (!lastEvent) return undefined;
    const timeout = globalThis.setTimeout(() => clearLastEvent(), 2000);
    return () => globalThis.clearTimeout(timeout);
  }, [lastEvent, clearLastEvent]);

  const handleTimeout = useCallback(() => {
    registerTimeout();
  }, [registerTimeout]);

  return (
    <Panel title="Partida en curso" subtitle="Arrastra, apunta y suelta">
      <ScoreBoard
        creatorScore={playing?.creatorScore ?? 0}
        challengerScore={playing?.challengerScore ?? 0}
        turnLabel={turnLabel}
      >
        {playing && <TurnTimer expiresAt={playing.turnEndsAt} onTimeout={handleTimeout} />}
      </ScoreBoard>
      <PitchCanvas chips={chips} ball={ball} highlightId={playing?.activePlayer === "creator" ? "it-1" : "br-1"}>
        <EventOverlay event={lastEvent} />
      </PitchCanvas>
      <div className="field-legend">
        <span>Turno: 15s • Turnos alternados</span>
        <span>Arrastra la ficha y suelta para disparar</span>
      </div>
      <div className="action-pad">
        <h3>Mecánica V1</h3>
        <p>
          Arrastra tu ficha hacia atrás para definir potencia/dirección. Si el temporizador llega a cero sin disparar, se marca un turno
          perdido automáticamente con animación. Los goles disparan una celebración y reinician posiciones.
        </p>
        <div className="button-grid horizontal">
          <NeonButton label="Gol a favor" onClick={() => triggerGoal("creator")} />
          <NeonButton label="Gol rival" variant="danger" onClick={() => triggerGoal("challenger")} />
          <NeonButton label="Turno saltado" variant="secondary" onClick={() => registerTimeout()} />
        </div>
      </div>
    </Panel>
  );
}
