import { useCallback, useEffect, useRef, useState } from "react";
import { PitchCanvas } from "../components/PitchCanvas";
import { useGameStore } from "../hooks/useGameStore";
import { EventOverlay } from "../components/EventOverlay";
import { socketService } from "../services/socketService";

export function PlayingScreen() {
  const playing = useGameStore((state) => state.playing);
  const lastEvent = useGameStore((state) => state.lastEvent);
  const registerTimeout = useGameStore((state) => state.registerTimeout);
  const clearLastEvent = useGameStore((state) => state.clearLastEvent);
  const applyRealtimeSnapshot = useGameStore((state) => state.applyRealtimeSnapshot);
  const setLastEvent = useGameStore((state) => state.setLastEvent);
  const matchId = useGameStore((state) => state.currentMatchId) ?? "demo-match";
  const playerSide = useGameStore((state) => state.playerSide);
  const goalTarget = useGameStore((state) => state.matchGoalTarget);
  const setView = useGameStore((state) => state.setView);

  const [aim, setAim] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | undefined>();
  const dragRef = useRef<{ chipId: string; start: { x: number; y: number } } | null>(null);
  const [showEnd, setShowEnd] = useState(false);
  const [winner, setWinner] = useState<"creator" | "challenger" | null>(null);
  const [timerPercent, setTimerPercent] = useState(100);

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
  const creatorScore = playing?.creatorScore ?? 0;
  const challengerScore = playing?.challengerScore ?? 0;
  const isMyTurn = playing?.activePlayer === "creator";
  const turnLabel = isMyTurn ? "Tu turno" : "Turno rival";

  // Timer countdown
  useEffect(() => {
    if (!playing?.turnEndsAt) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, playing.turnEndsAt - now);
      const total = 15000; // 15s turn
      setTimerPercent((remaining / total) * 100);
    }, 100);
    return () => clearInterval(interval);
  }, [playing?.turnEndsAt]);

  useEffect(() => {
    if (!lastEvent) return undefined;
    const timeout = globalThis.setTimeout(() => clearLastEvent(), 2000);
    return () => globalThis.clearTimeout(timeout);
  }, [lastEvent, clearLastEvent]);

  const handleTimeout = useCallback(() => {
    registerTimeout();
  }, [registerTimeout]);

  useEffect(() => {
    if (!playing) return;
    if (creatorScore >= goalTarget) {
      setWinner("creator");
      setShowEnd(true);
    } else if (challengerScore >= goalTarget) {
      setWinner("challenger");
      setShowEnd(true);
    }
  }, [playing, creatorScore, challengerScore, goalTarget]);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!playing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 600;
    const y = ((e.clientY - rect.top) / rect.height) * 900;
    const target = chips
      .filter((c) => c.owner ? c.owner === playing.activePlayer : c.id.startsWith(playing.activePlayer))
      .find((c) => Math.hypot(c.x - x, c.y - y) <= c.radius + 12);
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

  return (
    <div className="playing-screen">
      {/* HUD */}
      <div className="playing-hud">
        <div className="hud-scores">
          <span className="hud-player you">TU</span>
          <div className="hud-score-center">
            <span className="hud-score-num">{creatorScore}</span>
            <span className="hud-sep">-</span>
            <span className="hud-score-num rival">{challengerScore}</span>
          </div>
          <span className="hud-player rival">RIVAL</span>
        </div>
        <div className="hud-timer">
          <div className="timer-bar">
            <div className="timer-fill" style={{ width: `${timerPercent}%` }} />
          </div>
          <span className="timer-label">{turnLabel}</span>
        </div>
      </div>

      {/* Pitch */}
      <div className="playing-pitch">
        <PitchCanvas
          chips={chips}
          ball={ball}
          highlightId={isMyTurn ? "creator-1" : "challenger-1"}
          aimLine={aim}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <EventOverlay event={lastEvent} />
        </PitchCanvas>
      </div>

      {/* Modal fin */}
      {showEnd && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100
        }}>
          <div style={{
            background: "var(--dark-panel)",
            border: "3px solid var(--border-green)",
            borderRadius: 24,
            padding: 32,
            textAlign: "center",
            color: "var(--text-white)"
          }}>
            <h2>{winner === "creator" ? "¡GANASTE!" : "Perdiste"}</h2>
            <button className="home-btn primary" style={{ marginTop: 20 }} onClick={() => setView("home")}>
              Volver al inicio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
