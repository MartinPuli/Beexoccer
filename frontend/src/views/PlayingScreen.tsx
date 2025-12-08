import { useEffect, useRef, useState, useCallback } from "react";
import { PitchCanvas } from "../components/PitchCanvas";
import { useGameStore } from "../hooks/useGameStore";
import { socketService } from "../services/socketService";
import { reportResult } from "../services/matchService";
import { TokenChip, PlayingSnapshot } from "../types/game";

/**
 * PlayingScreen - Partida online 1v1 con sincronización por sockets
 * - Mecánicas idénticas a BotMatchScreen
 * - Sin iconos en las fichas
 * - Cada jugador ve sus fichas abajo (azules)
 * - Perder automático si 3 turnos sin tiempo consecutivos
 */

const FIELD_WIDTH = 600;
const FIELD_HEIGHT = 900;
const TURN_TIME = 15000;
const MAX_DRAG_DISTANCE = 200;  // Distancia máxima de arrastre (estilo Table Soccer)
const MAX_TIMEOUTS_TO_LOSE = 3;

// Constantes de física estilo Table Soccer (Plato)
const MIN_SPEED = 3;
const MAX_SPEED = 28;  // Velocidad máxima controlada

interface AimLine {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

// Transformar coordenadas para que el jugador siempre vea sus fichas abajo
function transformForPlayer(
  chips: TokenChip[],
  ball: { x: number; y: number },
  isChallenger: boolean
): { chips: TokenChip[]; ball: { x: number; y: number } } {
  // En el servidor: Creator está abajo (y alto), Challenger está arriba (y bajo)
  // Creator quiere ver sus fichas abajo → no invertir
  // Challenger quiere ver sus fichas abajo → invertir todo
  
  if (isChallenger) {
    // Challenger: invertir para ver sus fichas abajo
    return {
      chips: chips.map(c => ({
        ...c,
        x: FIELD_WIDTH - c.x,
        y: FIELD_HEIGHT - c.y,
        // Challenger = azul (yo), Creator = rojo (rival)
        fill: c.owner === "challenger" ? "#00a8ff" : "#ff4d5a",
        flagEmoji: ""
      })),
      ball: {
        x: FIELD_WIDTH - ball.x,
        y: FIELD_HEIGHT - ball.y
      }
    };
  }
  // Creator: las fichas del servidor ya están correctas (creator abajo)
  return {
    chips: chips.map(c => ({
      ...c,
      // Creator = azul (yo), Challenger = rojo (rival)
      fill: c.owner === "creator" ? "#00a8ff" : "#ff4d5a",
      flagEmoji: ""
    })),
    ball
  };
}

export function PlayingScreen() {
  const playerSide = useGameStore((s) => s.playerSide);
  const currentMatchId = useGameStore((s) => s.currentMatchId);
  const goalTarget = useGameStore((s) => s.matchGoalTarget);
  const setView = useGameStore((s) => s.setView);
  const setMatchStatus = useGameStore((s) => s.setMatchStatus);
  const setCurrentMatchId = useGameStore((s) => s.setCurrentMatchId);
  const setActiveMatch = useGameStore((s) => s.setActiveMatch);
  const alias = useGameStore((s) => s.alias);

  const isChallenger = playerSide === "challenger";

  const [chips, setChips] = useState<TokenChip[]>([]);
  const [ball, setBall] = useState({ x: 300, y: 450 });
  const [activePlayer, setActivePlayer] = useState<"creator" | "challenger">("creator");
  const [myScore, setMyScore] = useState(0);
  const [rivalScore, setRivalScore] = useState(0);
  const [aim, setAim] = useState<AimLine | undefined>();
  const [selectedChipId, setSelectedChipId] = useState<string | null>(null);
  const [timerPercent, setTimerPercent] = useState(100);
  const [showEnd, setShowEnd] = useState(false);
  const [winner, setWinner] = useState<"you" | "rival" | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [commentary, setCommentary] = useState("Conectando...");
  const [connected, setConnected] = useState(false);
  const [shotPower, setShotPower] = useState(0);
  const [goalAnimation, setGoalAnimation] = useState<"you" | "rival" | null>(null);
  const [turnLostAnimation, setTurnLostAnimation] = useState(false);

  const dragRef = useRef<{ chipId: string; start: { x: number; y: number } } | null>(null);
  const turnEndRef = useRef<number>(Date.now() + TURN_TIME);
  const consecutiveTimeoutsRef = useRef(0);
  const lastTurnPlayerRef = useRef<"creator" | "challenger" | null>(null);
  const resultReportedRef = useRef(false);

  const isMyTurn = (isChallenger && activePlayer === "challenger") || (!isChallenger && activePlayer === "creator");

  // Reportar resultado al contrato cuando la partida termina
  useEffect(() => {
    if (!showEnd || !winner || !currentMatchId || resultReportedRef.current) return;
    
    // Solo el ganador reporta el resultado para evitar doble llamada
    if (winner === "you") {
      resultReportedRef.current = true;
      const matchIdNum = Number.parseInt(currentMatchId, 10);
      const userAddress = useGameStore.getState().userAddress;
      
      if (matchIdNum && userAddress) {
        console.log("[PlayingScreen] Reporting result to contract:", { matchId: matchIdNum, winner: userAddress });
        reportResult(matchIdNum, userAddress).catch((err) => {
          console.error("[PlayingScreen] Error reporting result:", err);
          // El error puede ser porque la partida es gratis o ya se reportó
        });
      }
    }
  }, [showEnd, winner, currentMatchId]);

  // Conectar al servidor de tiempo real
  useEffect(() => {
    if (!currentMatchId) return;

    // Primero registrar los listeners, luego conectar
    socketService.connect(currentMatchId, playerSide);

    socketService.onSnapshot((snapshot: PlayingSnapshot) => {
      setConnected(true);
      
      // Debug: log snapshot received
      if (import.meta.env.DEV) {
        console.log("[PlayingScreen] Snapshot received:", { 
          activePlayer: snapshot.activePlayer, 
          turnEndsAt: snapshot.turnEndsAt,
          chipCount: snapshot.chips.length 
        });
      }
      
      // Transformar según perspectiva del jugador
      const { chips: transformedChips, ball: transformedBall } = transformForPlayer(
        snapshot.chips,
        snapshot.ball,
        isChallenger
      );

      setChips(transformedChips);
      setBall(transformedBall);
      
      // Active player desde perspectiva local
      setActivePlayer(snapshot.activePlayer);
      
      // Verificar si cambió de turno para tracking de timeouts
      if (lastTurnPlayerRef.current !== null && lastTurnPlayerRef.current !== snapshot.activePlayer) {
        // Cambió el turno
        const myServerSide = isChallenger ? "challenger" : "creator";
        if (snapshot.activePlayer === myServerSide) {
          // Ahora es mi turno - resetear contador si hice algo
          consecutiveTimeoutsRef.current = 0;
        }
      }
      lastTurnPlayerRef.current = snapshot.activePlayer;
      
      // Scores desde perspectiva local
      if (isChallenger) {
        setMyScore(snapshot.challengerScore);
        setRivalScore(snapshot.creatorScore);
      } else {
        setMyScore(snapshot.creatorScore);
        setRivalScore(snapshot.challengerScore);
      }

      turnEndRef.current = snapshot.turnEndsAt;
      setCommentary(snapshot.commentary);
    });

    socketService.onEvent((event) => {
      if (event.type === "goal-self") {
        // goal-self = el jugador activo metió gol
        setGoalAnimation("you");
        setCommentary("¡GOOOL!");
        setTimeout(() => setGoalAnimation(null), 2000);
      } else if (event.type === "goal-rival") {
        setGoalAnimation("rival");
        setCommentary("Gol rival...");
        setTimeout(() => setGoalAnimation(null), 2000);
      } else if (event.type === "timeout") {
        // Mostrar animación de turno perdido
        setTurnLostAnimation(true);
        setTimeout(() => setTurnLostAnimation(false), 1500);
        const myServerSide = isChallenger ? "challenger" : "creator";
        if (event.from === myServerSide) {
          consecutiveTimeoutsRef.current += 1;
          if (consecutiveTimeoutsRef.current >= MAX_TIMEOUTS_TO_LOSE) {
            setWinner("rival");
            setShowEnd(true);
            setMatchStatus("ended");
            setCommentary("Perdiste por inactividad");
          }
        }
      }
    });

    // Listen for rival forfeit
    socketService.onPlayerForfeited((side) => {
      const myServerSide = isChallenger ? "challenger" : "creator";
      if (side !== myServerSide) {
        // Rival forfeited, we win!
        setWinner("you");
        setShowEnd(true);
        setMatchStatus("ended");
        setCommentary("¡Tu rival abandonó!");
      }
    });

    // Listen for match ended
    socketService.onMatchEnded((data) => {
      const myServerSide = isChallenger ? "challenger" : "creator";
      if (data.winner === myServerSide) {
        setWinner("you");
      } else {
        setWinner("rival");
      }
      setShowEnd(true);
      setMatchStatus("ended");
    });

    // Request sync after listeners are registered to ensure we get the current state
    const syncTimeout = setTimeout(() => {
      socketService.requestSync();
    }, 500);

    return () => {
      clearTimeout(syncTimeout);
      socketService.offAll();
      socketService.disconnect();
    };
  }, [currentMatchId, playerSide, isChallenger, setMatchStatus]);

  // Timer visual y detección de timeout
  const timeoutSentRef = useRef(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, turnEndRef.current - Date.now());
      setTimerPercent((remaining / TURN_TIME) * 100);
      
      // Si es mi turno y el tiempo llegó a 0, enviar timeout
      if (remaining === 0 && isMyTurn && !timeoutSentRef.current && currentMatchId) {
        timeoutSentRef.current = true;
        consecutiveTimeoutsRef.current += 1;
        socketService.sendTimeout(currentMatchId);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isMyTurn, currentMatchId]);

  // Reset timeout flag cuando cambia de turno
  useEffect(() => {
    timeoutSentRef.current = false;
  }, [activePlayer]);

  // Verificar victoria por goles
  useEffect(() => {
    if (showEnd) return;
    if (myScore >= goalTarget) {
      setWinner("you");
      setShowEnd(true);
      setMatchStatus("ended");
    } else if (rivalScore >= goalTarget) {
      setWinner("rival");
      setShowEnd(true);
      setMatchStatus("ended");
    }
  }, [myScore, rivalScore, goalTarget, setMatchStatus, showEnd]);

  const getSvgPoint = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM()?.inverse();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm);
    return { x: p.x, y: p.y };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!isMyTurn || showEnd) return;
    
    const { x, y } = getSvgPoint(e);
    
    // Buscar ficha propia cercana (azules = mías)
    const myChips = chips.filter((c) => c.fill === "#00a8ff");
    const hit = myChips.find((c) => Math.hypot(c.x - x, c.y - y) < c.radius + 10);
    
    if (hit) {
      dragRef.current = { chipId: hit.id, start: { x, y } };
      setSelectedChipId(hit.id);
      (e.target as Element).setPointerCapture(e.pointerId);
    }
  }, [chips, isMyTurn, showEnd, getSvgPoint]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    
    const { x, y } = getSvgPoint(e);
    const chip = chips.find((c) => c.id === dragRef.current?.chipId);
    if (!chip) return;

    const dx = dragRef.current.start.x - x;
    const dy = dragRef.current.start.y - y;
    const dist = Math.min(Math.hypot(dx, dy), MAX_DRAG_DISTANCE);
    const angle = Math.atan2(dy, dx);
    
    // Calcular potencia normalizada para feedback visual
    const normalizedPower = dist / MAX_DRAG_DISTANCE;
    setShotPower(normalizedPower);
    (globalThis as Record<string, unknown>).shotPower = normalizedPower;

    // La línea de apuntado muestra hacia dónde IRÁ la ficha
    // Para el challenger, el impulso se invierte, así que la aim line también
    const aimAngle = isChallenger ? angle + Math.PI : angle;
    setAim({
      from: { x: chip.x, y: chip.y },
      to: {
        x: chip.x + Math.cos(aimAngle) * dist * 1.5,
        y: chip.y + Math.sin(aimAngle) * dist * 1.5
      }
    });
  }, [chips, getSvgPoint, isChallenger]);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current || !currentMatchId) {
      setAim(undefined);
      setShotPower(0);
      dragRef.current = null;
      return;
    }

    const { x, y } = getSvgPoint(e);
    const dx = dragRef.current.start.x - x;
    const dy = dragRef.current.start.y - y;
    const dist = Math.min(Math.hypot(dx, dy), MAX_DRAG_DISTANCE);
    
    if (dist > 20) {
      // === SISTEMA DE POTENCIA LINEAL ===
      // La potencia es directamente proporcional a la longitud del arrastre
      // 0% arrastre = 0 velocidad, 100% arrastre = MAX_SPEED (36)
      const normalizedDist = Math.min(1, dist / MAX_DRAG_DISTANCE);
      const targetSpeed = normalizedDist * MAX_SPEED;
      
      // Calcular dirección normalizada
      const angle = Math.atan2(dy, dx);
      let impulseX = Math.cos(angle) * targetSpeed;
      let impulseY = Math.sin(angle) * targetSpeed;

      // Si es challenger, invertir porque la cancha está rotada para él
      if (isChallenger) {
        impulseX = -impulseX;
        impulseY = -impulseY;
      }

      // Resetear timeout counter porque hicimos una jugada
      consecutiveTimeoutsRef.current = 0;

      socketService.sendInput(currentMatchId, dragRef.current.chipId, {
        dx: impulseX,
        dy: impulseY
      });
    }

    setAim(undefined);
    setShotPower(0);
    setSelectedChipId(null);
    dragRef.current = null;
  }, [currentMatchId, isChallenger, getSvgPoint]);

  const handleExit = () => setShowExitConfirm(true);
  const confirmExit = () => {
    setShowExitConfirm(false);
    // If game is not over, forfeit the match
    if (!showEnd && currentMatchId) {
      socketService.sendForfeit(currentMatchId);
    }
    socketService.disconnect();
    // Limpiar estado del store
    setCurrentMatchId(undefined);
    setActiveMatch(undefined);
    setMatchStatus("idle");
    setView("home");
  };
  const cancelExit = () => setShowExitConfirm(false);

  const handleRematch = () => {
    socketService.requestRematch();
    setCommentary("Esperando respuesta del rival...");
  };

  const handleGoHome = () => {
    socketService.disconnect();
    // Limpiar estado del store
    setCurrentMatchId(undefined);
    setActiveMatch(undefined);
    setMatchStatus("idle");
    setView("home");
  };

  // Momentum bar como en BotMatchScreen
  const momentum = myScore - rivalScore;
  const momentumPercent = 50 + (momentum / Math.max(1, goalTarget)) * 50;

  return (
    <div className="playing-screen">
      {/* Header con scores estilo BotMatch */}
      <div className="game-header">
        <button className="exit-btn" onClick={handleExit}>✕</button>
        
        <div className="score-section">
          <div className="player-score-box me">
            <span className="score-label">TÚ</span>
            <span className="score-value">{myScore}</span>
          </div>
          
          <div className="vs-section">
            <span className="vs-text">VS</span>
            <span className="goal-target">Meta: {goalTarget}</span>
          </div>
          
          <div className="player-score-box rival">
            <span className="score-label">RIVAL</span>
            <span className="score-value">{rivalScore}</span>
          </div>
        </div>
      </div>

      {/* Momentum bar */}
      <div className="momentum-bar">
        <div className="momentum-fill me" style={{ width: `${momentumPercent}%` }} />
        <div className="momentum-fill rival" style={{ width: `${100 - momentumPercent}%` }} />
      </div>

      {/* Timer bar */}
      <div className="turn-timer">
        <div 
          className="timer-bar" 
          style={{ 
            width: `${timerPercent}%`,
            backgroundColor: timerPercent > 30 ? '#00ff6a' : timerPercent > 10 ? '#ffaa00' : '#ff4444'
          }} 
        />
      </div>

      {/* Turn indicator */}
      <div className={`turn-indicator ${isMyTurn ? 'my-turn' : 'rival-turn'}`}>
        {isMyTurn ? "🎯 TU TURNO" : "⏳ TURNO RIVAL"}
        {consecutiveTimeoutsRef.current > 0 && isMyTurn && (
          <span className="timeout-warning"> ⚠️ {MAX_TIMEOUTS_TO_LOSE - consecutiveTimeoutsRef.current} turnos restantes</span>
        )}
      </div>

      {/* Power meter cuando arrastra */}
      {shotPower > 0 && (
        <div className="power-meter">
          <div className="power-fill" style={{ 
            width: `${shotPower * 100}%`,
            backgroundColor: shotPower > 0.7 ? '#ff4444' : shotPower > 0.4 ? '#ffaa00' : '#00ff6a'
          }} />
          <span className="power-label">{Math.round(shotPower * 100)}%</span>
        </div>
      )}

      {/* Pitch */}
      <PitchCanvas
        chips={chips}
        ball={ball}
        highlightId={selectedChipId ?? undefined}
        activePlayer={activePlayer}
        isPlayerTurn={isMyTurn}
        aimLine={aim}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* Commentary */}
      <div className="commentary">
        {!connected ? "🔄 Conectando al servidor..." : commentary}
      </div>

      {/* Animación de GOL */}
      {goalAnimation && (
        <div className={`goal-overlay ${goalAnimation === "you" ? "goal-you" : "goal-rival"}`}>
          <div className="goal-text">
            {goalAnimation === "you" ? "⚽ ¡GOOOL!" : "😔 Gol rival"}
          </div>
        </div>
      )}

      {/* Animación de turno perdido */}
      {turnLostAnimation && (
        <div className="turn-lost-overlay">
          <div className="turn-lost-text">⏱️ Turno perdido</div>
        </div>
      )}

      {/* Player info */}
      <div className="player-info">
        <span className="player-alias">{alias}</span>
        <span className="player-side">({isChallenger ? "Retador" : "Creador"})</span>
      </div>

      {/* Exit confirmation */}
      {showExitConfirm && (
        <div className="modal-overlay">
          <div className="modal-box">
            <p>¿Salir de la partida?</p>
            <p className="modal-subtitle">Perderás la partida</p>
            <div className="modal-buttons">
              <button className="modal-btn cancel" onClick={cancelExit}>Cancelar</button>
              <button className="modal-btn confirm" onClick={confirmExit}>Salir</button>
            </div>
          </div>
        </div>
      )}

      {/* End screen */}
      {showEnd && (
        <div className="modal-overlay">
          <div className="modal-box end-modal">
            <div className={`end-icon ${winner === "you" ? "win" : "lose"}`}>
              {winner === "you" ? "🏆" : "😢"}
            </div>
            <h2 className={winner === "you" ? "win-title" : "lose-title"}>
              {winner === "you" ? "¡VICTORIA!" : "DERROTA"}
            </h2>
            <p className="final-score">{myScore} - {rivalScore}</p>
            <div className="modal-buttons">
              <button className="modal-btn primary" onClick={handleRematch}>
                🔄 Revancha
              </button>
              <button className="modal-btn secondary" onClick={handleGoHome}>
                🏠 Inicio
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .playing-screen {
          min-height: 100vh;
          min-height: 100dvh;
          background: linear-gradient(180deg, #001a00 0%, #000 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 10px;
        }

        .game-header {
          width: 100%;
          max-width: 600px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
        }

        .exit-btn {
          background: rgba(255,77,90,0.2);
          border: 1px solid #ff4d5a;
          color: #ff4d5a;
          font-size: 18px;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s;
        }
        .exit-btn:hover {
          background: #ff4d5a;
          color: #000;
        }

        .score-section {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
        }

        .player-score-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 8px 16px;
          border-radius: 12px;
          min-width: 70px;
        }
        .player-score-box.me {
          background: rgba(0,168,255,0.15);
          border: 1px solid #00a8ff;
        }
        .player-score-box.rival {
          background: rgba(255,77,90,0.15);
          border: 1px solid #ff4d5a;
        }

        .score-label {
          font-size: 11px;
          font-weight: 600;
          opacity: 0.8;
        }
        .player-score-box.me .score-label { color: #00a8ff; }
        .player-score-box.rival .score-label { color: #ff4d5a; }

        .score-value {
          font-size: 28px;
          font-weight: bold;
          color: #fff;
        }

        .vs-section {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .vs-text {
          font-size: 16px;
          font-weight: bold;
          color: #666;
        }
        .goal-target {
          font-size: 11px;
          color: #888;
        }

        .momentum-bar {
          width: 100%;
          max-width: 600px;
          height: 6px;
          background: #222;
          border-radius: 3px;
          display: flex;
          overflow: hidden;
          margin-bottom: 4px;
        }
        .momentum-fill.me {
          background: linear-gradient(90deg, #00a8ff, #00ff6a);
          transition: width 0.3s;
        }
        .momentum-fill.rival {
          background: linear-gradient(90deg, #ff4d5a, #ff8800);
          transition: width 0.3s;
        }

        .turn-timer {
          width: 100%;
          max-width: 600px;
          height: 8px;
          background: #111;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
          border: 1px solid #333;
        }

        .timer-bar {
          height: 100%;
          transition: width 0.1s linear;
          box-shadow: 0 0 10px currentColor;
        }

        .turn-indicator {
          padding: 10px 24px;
          border-radius: 20px;
          font-weight: bold;
          font-size: 14px;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .my-turn {
          background: rgba(0, 168, 255, 0.2);
          color: #00a8ff;
          border: 1px solid #00a8ff;
          animation: pulse 1s ease-in-out infinite;
        }
        .rival-turn {
          background: rgba(255, 77, 90, 0.15);
          color: #ff4d5a;
          border: 1px solid rgba(255, 77, 90, 0.5);
        }
        .timeout-warning {
          color: #ffaa00;
          font-size: 12px;
        }

        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 168, 255, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(0, 168, 255, 0); }
        }

        .power-meter {
          width: 200px;
          height: 20px;
          background: #111;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 8px;
          position: relative;
          border: 1px solid #333;
        }
        .power-fill {
          height: 100%;
          transition: width 0.05s;
        }
        .power-label {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #fff;
          font-size: 12px;
          font-weight: bold;
          text-shadow: 0 0 4px #000;
        }

        .commentary {
          color: #00ff6a;
          font-size: 14px;
          margin-top: 12px;
          text-align: center;
          padding: 8px 16px;
          background: rgba(0, 255, 106, 0.1);
          border-radius: 8px;
        }

        .player-info {
          display: flex;
          gap: 8px;
          margin-top: 8px;
          color: #888;
          font-size: 13px;
        }
        .player-alias { color: #00a8ff; }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }

        .modal-box {
          background: linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%);
          border: 1px solid #333;
          border-radius: 20px;
          padding: 28px;
          text-align: center;
          min-width: 300px;
        }
        .modal-box p {
          color: #fff;
          margin-bottom: 8px;
          font-size: 18px;
        }
        .modal-subtitle {
          color: #888 !important;
          font-size: 14px !important;
        }

        .modal-buttons {
          display: flex;
          gap: 12px;
          margin-top: 24px;
          justify-content: center;
        }

        .modal-btn {
          padding: 14px 28px;
          border-radius: 12px;
          font-weight: bold;
          cursor: pointer;
          border: none;
          font-size: 15px;
          transition: transform 0.1s;
        }
        .modal-btn:active {
          transform: scale(0.95);
        }
        .modal-btn.cancel {
          background: #333;
          color: #fff;
        }
        .modal-btn.confirm {
          background: #ff4d5a;
          color: #fff;
        }
        .modal-btn.primary {
          background: linear-gradient(135deg, #00ff6a, #00cc55);
          color: #000;
        }
        .modal-btn.secondary {
          background: #333;
          color: #fff;
        }

        .end-modal .end-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }
        .end-icon.win {
          animation: bounce 0.5s ease-out;
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .end-modal h2 {
          font-size: 28px;
          margin-bottom: 12px;
        }
        .win-title { color: #00ff6a; text-shadow: 0 0 20px #00ff6a; }
        .lose-title { color: #ff4d5a; }

        .final-score {
          font-size: 32px;
          color: #fff;
          font-weight: bold;
          margin-bottom: 8px;
        }
      `}</style>
    </div>
  );
}
