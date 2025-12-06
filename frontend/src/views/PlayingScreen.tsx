import { useCallback, useEffect, useRef, useState } from "react";
import { Panel } from "../components/Panel";
import { PitchCanvas } from "../components/PitchCanvas";
import { ScoreBoard } from "../components/ScoreBoard";
import { useGameStore } from "../hooks/useGameStore";
import { TurnTimer } from "../components/TurnTimer";
import { EventOverlay } from "../components/EventOverlay";
import { NeonButton } from "../components/NeonButton";
import { socketService } from "../services/socketService";

/**
 * Field view referencing the Soccer de Plato reference. Real physics will live here in later iterations.
 */
export function PlayingScreen() {
  const playing = useGameStore((state) => state.playing);
  const lastEvent = useGameStore((state) => state.lastEvent);
  const triggerGoal = useGameStore((state) => state.triggerGoal);
  const registerTimeout = useGameStore((state) => state.registerTimeout);
  const clearLastEvent = useGameStore((state) => state.clearLastEvent);
  const applyRealtimeSnapshot = useGameStore((state) => state.applyRealtimeSnapshot);
  const setLastEvent = useGameStore((state) => state.setLastEvent);
  const matchId = useGameStore((state) => state.currentMatchId) ?? "demo-match";
  const playerSide = useGameStore((state) => state.playerSide);
  const goalTarget = useGameStore((state) => state.matchGoalTarget);

  const [aim, setAim] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | undefined>();
  const dragRef = useRef<{ chipId: string; start: { x: number; y: number } } | null>(null);
  const [showEnd, setShowEnd] = useState(false);
  const [winner, setWinner] = useState<"creator" | "challenger" | null>(null);
  const [waitingRematchUntil, setWaitingRematchUntil] = useState<number | null>(null);

  // Demo: connect to socket server with fixed match id until backend provides lobby ids.
  useEffect(() => {
    socketService.connect(matchId, playerSide ?? "creator");
    socketService.onSnapshot((snapshot) => applyRealtimeSnapshot(snapshot));
    socketService.onEvent((evt) => setLastEvent(evt));
    return () => {
      socketService.offAll();
      socketService.disconnect();
    };
  }, [applyRealtimeSnapshot, setLastEvent, matchId, playerSide]);

  const chips = playing?.chips ?? [];
  const ball = playing?.ball ?? { x: 300, y: 450, vx: 0, vy: 0 };
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

  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === "rematch-confirmed") {
      setWaitingRematchUntil(null);
      setShowEnd(false);
      setWinner(null);
    }
    if (lastEvent.type === "rematch-requested") {
      setShowEnd(true);
      setWaitingRematchUntil(Date.now() + 10_000);
    }
  }, [lastEvent]);

  const handleTimeout = useCallback(() => {
    registerTimeout();
  }, [registerTimeout]);

  useEffect(() => {
    if (!playing) return;
    if (playing.creatorScore >= goalTarget) {
      setWinner("creator");
      setShowEnd(true);
    } else if (playing.challengerScore >= goalTarget) {
      setWinner("challenger");
      setShowEnd(true);
    }
  }, [playing, goalTarget]);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!playing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 600;
    const y = ((e.clientY - rect.top) / rect.height) * 900;
    const target = chips
      .filter((c) => c.owner ? c.owner === playing.activePlayer : c.id.startsWith(playing.activePlayer))
      .find((c) => {
        const dx = c.x - x;
        const dy = c.y - y;
        return Math.hypot(dx, dy) <= c.radius + 12;
      });
    if (!target) return;
    dragRef.current = { chipId: target.id, start: { x: target.x, y: target.y } };
    setAim({ from: { x: target.x, y: target.y }, to: { x, y } });
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 600;
    const y = ((e.clientY - rect.top) / rect.height) * 900;
    setAim((prev) => (prev ? { ...prev, to: { x, y } } : undefined));
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current || !playing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 600;
    const y = ((e.clientY - rect.top) / rect.height) * 900;
    const { chipId, start } = dragRef.current;
    const dx = (start.x - x) * 0.15;
    const dy = (start.y - y) * 0.15;
    socketService.sendInput(matchId, chipId, { dx, dy });
    dragRef.current = null;
    setAim(undefined);
  };

  const handleRematch = () => {
    socketService.requestRematch();
    setWaitingRematchUntil(Date.now() + 10_000);
    setShowEnd(false);
  };

  useEffect(() => {
    if (!waitingRematchUntil) return undefined;
    const delay = waitingRematchUntil - Date.now();
    if (delay <= 0) {
      setWaitingRematchUntil(null);
      return undefined;
    }
    const timeout = globalThis.setTimeout(() => setWaitingRematchUntil(null), delay);
    return () => globalThis.clearTimeout(timeout);
  }, [waitingRematchUntil]);

  return (
    <Panel title="Partida en curso" subtitle="Arrastra, apunta y suelta">
      <ScoreBoard
        creatorScore={playing?.creatorScore ?? 0}
        challengerScore={playing?.challengerScore ?? 0}
        turnLabel={turnLabel}
      >
        {playing && <TurnTimer expiresAt={playing.turnEndsAt} onTimeout={handleTimeout} />}
      </ScoreBoard>
      <PitchCanvas
        chips={chips}
        ball={ball}
        highlightId={playing?.activePlayer === "creator" ? "creator-1" : "challenger-1"}
        aimLine={aim}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
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
      {waitingRematchUntil && (
        <div className="toast info">
          Esperando aceptación de revancha (hasta 10s)
        </div>
      )}
      {showEnd && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Fin del partido</h3>
            <p>{winner === "creator" ? "¡Ganaste esta partida!" : "El rival se llevó la victoria."}</p>
            <div className="button-grid horizontal">
              <NeonButton label="Revancha" onClick={handleRematch} />
              <NeonButton label="Salir" variant="secondary" onClick={() => setShowEnd(false)} />
            </div>
            <small>La revancha se activa cuando ambos aceptan (10s de gracia).</small>
          </div>
        </div>
      )}
    </Panel>
  );
}
