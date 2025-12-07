import { useEffect, useRef, useState } from "react";
import { PitchCanvas } from "../components/PitchCanvas";
import { useGameStore } from "../hooks/useGameStore";
import { EventOverlay } from "../components/EventOverlay";
import { socketService } from "../services/socketService";
import { toast } from "../components/Toast";

// Constantes para unificar con BotMatchScreen
const FIELD_WIDTH = 600;
const FIELD_HEIGHT = 900;
const MAX_DRAG_DISTANCE = 350;
const POWER = 0.25;

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
  const consecutiveTimeouts = useGameStore((state) => state.consecutiveTimeouts);
  const resetTimeoutCounter = useGameStore((state) => state.resetTimeoutCounter);
  const setActiveMatch = useGameStore((state) => state.setActiveMatch);
  const clearSession = useGameStore((state) => state.clearSession);
  const userAddress = useGameStore((state) => state.userAddress);

  const [aim, setAim] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | undefined>();
  const dragRef = useRef<{ chipId: string; start: { x: number; y: number } } | null>(null);
  const [showEnd, setShowEnd] = useState(false);
  const [winner, setWinner] = useState<"creator" | "challenger" | null>(null);
  const [loseReason, setLoseReason] = useState<string>("");
  const [timerPercent, setTimerPercent] = useState(100);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const handleExitClick = () => {
    setShowExitConfirm(true);
  };

  const handleExitConfirm = () => {
    // Cleanup sockets
    socketService.offAll();
    socketService.disconnect();
    // Limpiar sesión al abandonar
    clearSession();
    toast.warning("Partida abandonada", "Has perdido la partida por abandono");
    setView("home");
  };

  const handleExitCancel = () => {
    setShowExitConfirm(false);
  };

  // Guardar partida activa al montar
  useEffect(() => {
    setActiveMatch({
      matchId,
      playerSide,
      goalTarget,
      userAddress
    });
  }, [matchId, playerSide, goalTarget, userAddress, setActiveMatch]);

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
  const isMyTurn = playing?.activePlayer === playerSide;
  const turnLabel = isMyTurn ? "Tu turno" : "Turno rival";

  // Detectar 3 timeouts seguidos = derrota automática
  useEffect(() => {
    if (consecutiveTimeouts >= 3) {
      toast.error("¡Derrota por inactividad!", "Perdiste 3 turnos seguidos");
      setWinner(playerSide === "creator" ? "challenger" : "creator");
      setLoseReason("Perdiste por inactividad (3 turnos sin jugar)");
      setShowEnd(true);
      clearSession();
    }
  }, [consecutiveTimeouts, playerSide, clearSession]);

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

  // Detectar timeout de turno (en modo online el servidor lo maneja)
  useEffect(() => {
    if (!playing?.turnEndsAt || !isMyTurn) return;
    
    const checkTimeout = () => {
      if (Date.now() >= playing.turnEndsAt) {
        registerTimeout();
      }
    };
    
    const remaining = playing.turnEndsAt - Date.now();
    if (remaining <= 0) {
      registerTimeout();
      return;
    }
    
    const timer = setTimeout(checkTimeout, remaining);
    return () => clearTimeout(timer);
  }, [playing?.turnEndsAt, isMyTurn, registerTimeout]);

  useEffect(() => {
    if (!playing) return;
    if (creatorScore >= goalTarget) {
      setWinner("creator");
      setLoseReason("");
      setShowEnd(true);
      clearSession(); // Limpiar sesión al terminar
    } else if (challengerScore >= goalTarget) {
      setWinner("challenger");
      setLoseReason("");
      setShowEnd(true);
      clearSession(); // Limpiar sesión al terminar
    }
  }, [playing, creatorScore, challengerScore, goalTarget, clearSession]);

  // Estado para potencia del tiro (unificado con BotMatchScreen)
  const [shotPower, setShotPower] = useState(0);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!playing || !isMyTurn) return;
    
    // Prevenir comportamientos del navegador
    e.preventDefault();
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * FIELD_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * FIELD_HEIGHT;
    
    const target = chips
      .filter((c) => c.owner ? c.owner === playing.activePlayer : c.id.startsWith(playing.activePlayer))
      .find((c) => Math.hypot(c.x - x, c.y - y) <= c.radius + 15); // Radio más grande para facilitar touch
    if (!target) return;
    
    dragRef.current = { chipId: target.id, start: { x: target.x, y: target.y } };
    setAim({ from: { x: target.x, y: target.y }, to: { x, y } });
    setShotPower(0);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    
    e.preventDefault();
    
    const rect = e.currentTarget.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * FIELD_WIDTH;
    let y = ((e.clientY - rect.top) / rect.height) * FIELD_HEIGHT;
    const { start } = dragRef.current;
    
    // Limitar distancia máxima de arrastre
    let dist = Math.hypot(x - start.x, y - start.y);
    if (dist > MAX_DRAG_DISTANCE) {
      const a = Math.atan2(y - start.y, x - start.x);
      x = start.x + Math.cos(a) * MAX_DRAG_DISTANCE;
      y = start.y + Math.sin(a) * MAX_DRAG_DISTANCE;
      dist = MAX_DRAG_DISTANCE;
    }
    
    // Calcular potencia visual
    const powerScale = Math.min(1, dist / (MAX_DRAG_DISTANCE * 0.7));
    setShotPower(powerScale);
    (globalThis as Record<string, unknown>).shotPower = powerScale;
    
    setAim((prev) => (prev ? { ...prev, to: { x, y } } : undefined));
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current || !playing) {
    dragRef.current = null;
    setAim(undefined);
    setShotPower(0);
    (globalThis as Record<string, unknown>).shotPower = 0;
    return;
  }    (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
    
    const rect = e.currentTarget.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * FIELD_WIDTH;
    let y = ((e.clientY - rect.top) / rect.height) * FIELD_HEIGHT;
    const { chipId, start } = dragRef.current;
    
    // Limitar distancia
    let dist = Math.hypot(x - start.x, y - start.y);
    if (dist > MAX_DRAG_DISTANCE) {
      const a = Math.atan2(y - start.y, x - start.x);
      x = start.x + Math.cos(a) * MAX_DRAG_DISTANCE;
      y = start.y + Math.sin(a) * MAX_DRAG_DISTANCE;
    }
    
    // Calcular velocidad con potencia variable (igual que BotMatchScreen)
    const power = POWER * (0.5 + shotPower * 1.5);
    const dx = (start.x - x) * power;
    const dy = (start.y - y) * power;
    
    // Solo enviar si hay movimiento significativo
    if (Math.hypot(dx, dy) > 0.3) {
      socketService.sendInput(matchId, chipId, { dx, dy });
      // Resetear contador de timeouts cuando el jugador hace una jugada
      resetTimeoutCounter();
    }
    
    dragRef.current = null;
    setAim(undefined);
    setShotPower(0);
    (globalThis as Record<string, unknown>).shotPower = 0;
  };

  const handlePointerCancel = () => {
    dragRef.current = null;
    setAim(undefined);
    setShotPower(0);
    (globalThis as Record<string, unknown>).shotPower = 0;
  };

  return (
    <div className="playing-screen">
      {/* HUD */}
      <div className="playing-hud">
        <div className="hud-header">
          <button className="exit-btn-icon" onClick={handleExitClick}>←</button>
          <span className="hud-title">VS ONLINE</span>
          <span className="hud-placeholder" />
        </div>
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
          activePlayer={playing?.activePlayer}
          isPlayerTurn={isMyTurn}
          aimLine={aim}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
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
            border: `3px solid ${winner === playerSide ? "var(--neon-green)" : "#ff4f64"}`,
            borderRadius: 24,
            padding: 32,
            textAlign: "center",
            color: "var(--text-white)",
            maxWidth: 320
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>
              {winner === playerSide ? "🏆" : "😢"}
            </div>
            <h2 style={{ 
              color: winner === playerSide ? "var(--neon-green)" : "#ff4f64",
              marginBottom: 8
            }}>
              {winner === playerSide ? "¡GANASTE!" : "Perdiste"}
            </h2>
            {loseReason && (
              <p style={{ color: "#888", fontSize: 14, marginBottom: 16 }}>{loseReason}</p>
            )}
            <div style={{ 
              fontSize: 24, 
              fontWeight: 700, 
              marginBottom: 20,
              color: "#fff"
            }}>
              {creatorScore} - {challengerScore}
            </div>
            <button className="home-btn primary" onClick={() => setView("home")}>
              Volver al inicio
            </button>
          </div>
        </div>
      )}

      {/* Modal salir con advertencia de apuesta */}
      {showExitConfirm && (
        <div className="exit-confirm-overlay">
          <div className="exit-modal">
            <h3>⚠️ ¿Abandonar partida?</h3>
            <p className="exit-warning-bet">
              Si abandonas ahora, <strong>perderás tu apuesta activa</strong> y la partida contará como derrota.
            </p>
            <div className="exit-btn-row">
              <button className="exit-btn cancel" onClick={handleExitCancel}>
                Seguir jugando
              </button>
              <button className="exit-btn confirm" onClick={handleExitConfirm}>
                Abandonar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
