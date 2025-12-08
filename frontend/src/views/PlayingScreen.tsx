import { useEffect, useRef, useState, useCallback } from "react";
import { PitchCanvas } from "../components/PitchCanvas";
import { useGameStore } from "../hooks/useGameStore";
import { socketService } from "../services/socketService";
import { TokenChip, PlayingSnapshot } from "../types/game";

/**
 * PlayingScreen - Partida online 1v1 con sincronización por sockets
 * Cada jugador se ve siempre como AZUL (perspectiva local)
 */

const FIELD_WIDTH = 600;
const FIELD_HEIGHT = 900;
const TURN_TIME = 15000;
const MAX_DRAG_DISTANCE = 300;
const POWER = 0.3;

interface AimLine {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

function flipY(y: number): number {
  return FIELD_HEIGHT - y;
}

function flipChip(chip: TokenChip, isChallenger: boolean): TokenChip {
  if (!isChallenger) return chip;
  return {
    ...chip,
    x: FIELD_WIDTH - chip.x,
    y: flipY(chip.y),
    owner: chip.owner === "creator" ? "challenger" : "creator"
  };
}

function flipBall(ball: { x: number; y: number }, isChallenger: boolean): { x: number; y: number } {
  if (!isChallenger) return ball;
  return {
    x: FIELD_WIDTH - ball.x,
    y: flipY(ball.y)
  };
}

export function PlayingScreen() {
  const playerSide = useGameStore((s) => s.playerSide);
  const currentMatchId = useGameStore((s) => s.currentMatchId);
  const goalTarget = useGameStore((s) => s.matchGoalTarget);
  const setView = useGameStore((s) => s.setView);
  const setMatchStatus = useGameStore((s) => s.setMatchStatus);
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
  const [commentary, setCommentary] = useState("Esperando partida...");

  const dragRef = useRef<{ chipId: string; start: { x: number; y: number } } | null>(null);
  const turnEndRef = useRef<number>(Date.now() + TURN_TIME);

  const isMyTurn = (isChallenger && activePlayer === "challenger") || (!isChallenger && activePlayer === "creator");

  // Conectar al servidor de tiempo real
  useEffect(() => {
    if (!currentMatchId) return;

    socketService.connect(currentMatchId, playerSide);

    socketService.onSnapshot((snapshot: PlayingSnapshot) => {
      // Transformar según perspectiva
      const transformedChips = snapshot.chips.map((c) => {
        const chip = flipChip(c, isChallenger);
        // El jugador local siempre es azul
        if (isChallenger) {
          return {
            ...chip,
            fill: chip.owner === "challenger" ? "#00a8ff" : "#ff4d5a",
            flagEmoji: chip.owner === "challenger" ? "" : "👤"
          };
        }
        return {
          ...chip,
          fill: chip.owner === "creator" ? "#00a8ff" : "#ff4d5a",
          flagEmoji: chip.owner === "creator" ? "" : "👤"
        };
      });

      setChips(transformedChips);
      setBall(flipBall(snapshot.ball, isChallenger));
      
      // Transformar activePlayer según perspectiva
      let realActivePlayer: "creator" | "challenger";
      if (isChallenger) {
        realActivePlayer = snapshot.activePlayer === "creator" ? "challenger" : "creator";
      } else {
        realActivePlayer = snapshot.activePlayer;
      }
      setActivePlayer(realActivePlayer);
      
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
        setCommentary("¡GOOOL!");
      } else if (event.type === "goal-rival") {
        setCommentary("Gol rival...");
      } else if (event.type === "timeout") {
        setCommentary("Se agotó el tiempo");
      }
    });

    return () => {
      socketService.offAll();
      socketService.disconnect();
    };
  }, [currentMatchId, playerSide, isChallenger]);

  // Timer visual
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, turnEndRef.current - Date.now());
      setTimerPercent((remaining / TURN_TIME) * 100);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Verificar victoria
  useEffect(() => {
    if (myScore >= goalTarget) {
      setWinner("you");
      setShowEnd(true);
      setMatchStatus("ended");
    } else if (rivalScore >= goalTarget) {
      setWinner("rival");
      setShowEnd(true);
      setMatchStatus("ended");
    }
  }, [myScore, rivalScore, goalTarget, setMatchStatus]);

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
    if (!isMyTurn) return;
    
    const { x, y } = getSvgPoint(e);
    
    // Buscar ficha propia cercana
    const myChips = chips.filter((c) => c.fill === "#00a8ff");
    const hit = myChips.find((c) => Math.hypot(c.x - x, c.y - y) < c.radius + 10);
    
    if (hit) {
      dragRef.current = { chipId: hit.id, start: { x, y } };
      setSelectedChipId(hit.id);
      (e.target as Element).setPointerCapture(e.pointerId);
    }
  }, [chips, isMyTurn, getSvgPoint]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    
    const { x, y } = getSvgPoint(e);
    const chip = chips.find((c) => c.id === dragRef.current?.chipId);
    if (!chip) return;

    const dx = dragRef.current.start.x - x;
    const dy = dragRef.current.start.y - y;
    const dist = Math.min(Math.hypot(dx, dy), MAX_DRAG_DISTANCE);
    const angle = Math.atan2(dy, dx);
    
    const power = dist / MAX_DRAG_DISTANCE;
    (globalThis as Record<string, unknown>).shotPower = power;

    setAim({
      from: { x: chip.x, y: chip.y },
      to: {
        x: chip.x + Math.cos(angle) * dist,
        y: chip.y + Math.sin(angle) * dist
      }
    });
  }, [chips, getSvgPoint]);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current || !currentMatchId) {
      setAim(undefined);
      dragRef.current = null;
      return;
    }

    const { x, y } = getSvgPoint(e);
    const dx = dragRef.current.start.x - x;
    const dy = dragRef.current.start.y - y;
    const dist = Math.min(Math.hypot(dx, dy), MAX_DRAG_DISTANCE);
    
    if (dist > 20) {
      const angle = Math.atan2(dy, dx);
      let impulseX = Math.cos(angle) * dist * POWER;
      let impulseY = Math.sin(angle) * dist * POWER;

      // Si es challenger, invertir el impulso porque la cancha está rotada
      if (isChallenger) {
        impulseX = -impulseX;
        impulseY = -impulseY;
      }

      socketService.sendInput(currentMatchId, dragRef.current.chipId, {
        dx: impulseX,
        dy: impulseY
      });
    }

    setAim(undefined);
    setSelectedChipId(null);
    dragRef.current = null;
    (globalThis as Record<string, unknown>).shotPower = 0;
  }, [currentMatchId, isChallenger, getSvgPoint]);

  const handleExit = () => setShowExitConfirm(true);
  const confirmExit = () => {
    setShowExitConfirm(false);
    socketService.disconnect();
    setView("home");
  };
  const cancelExit = () => setShowExitConfirm(false);

  const handleRematch = () => {
    socketService.requestRematch();
    setCommentary("Esperando respuesta del rival...");
  };

  const handleGoHome = () => {
    socketService.disconnect();
    setView("home");
  };

  return (
    <div className="playing-screen">
      {/* Header */}
      <div className="playing-header">
        <button className="exit-btn" onClick={handleExit}>✕</button>
        <div className="score-display">
          <span className="score my-score">{myScore}</span>
          <span className="score-divider">-</span>
          <span className="score rival-score">{rivalScore}</span>
        </div>
        <div className="goal-target">Meta: {goalTarget}</div>
      </div>

      {/* Timer */}
      <div className="turn-timer">
        <div 
          className="timer-bar" 
          style={{ 
            width: `${timerPercent}%`,
            backgroundColor: (() => {
              if (timerPercent > 30) return '#00ff6a';
              if (timerPercent > 10) return '#ffaa00';
              return '#ff4444';
            })()
          }} 
        />
      </div>

      {/* Turn indicator */}
      <div className={`turn-indicator ${isMyTurn ? 'my-turn' : 'rival-turn'}`}>
        {isMyTurn ? "TU TURNO" : "TURNO RIVAL"}
      </div>

      {/* Pitch */}
      <PitchCanvas
        chips={chips}
        ball={ball}
        highlightId={selectedChipId ?? undefined}
        activePlayer={isMyTurn ? "creator" : "challenger"}
        isPlayerTurn={isMyTurn}
        aimLine={aim}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* Commentary */}
      <div className="commentary">{commentary}</div>

      {/* Player info */}
      <div className="player-info">
        <span className="player-alias">{alias}</span>
        <span className="player-side">{isChallenger ? "(Retador)" : "(Creador)"}</span>
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

        .playing-header {
          width: 100%;
          max-width: 600px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
        }

        .exit-btn {
          background: rgba(255,255,255,0.1);
          border: none;
          color: #fff;
          font-size: 20px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          cursor: pointer;
        }

        .score-display {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .score {
          font-size: 32px;
          font-weight: bold;
        }

        .my-score { color: #00a8ff; }
        .rival-score { color: #ff4d5a; }
        .score-divider { color: #666; }

        .goal-target {
          color: #888;
          font-size: 14px;
        }

        .turn-timer {
          width: 100%;
          max-width: 600px;
          height: 6px;
          background: #222;
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .timer-bar {
          height: 100%;
          transition: width 0.1s linear;
        }

        .turn-indicator {
          padding: 8px 20px;
          border-radius: 20px;
          font-weight: bold;
          font-size: 14px;
          margin-bottom: 10px;
        }

        .my-turn {
          background: rgba(0, 168, 255, 0.2);
          color: #00a8ff;
          border: 1px solid #00a8ff;
        }

        .rival-turn {
          background: rgba(255, 77, 90, 0.2);
          color: #ff4d5a;
          border: 1px solid #ff4d5a;
        }

        .commentary {
          color: #00ff6a;
          font-size: 14px;
          margin-top: 12px;
          text-align: center;
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
          background: rgba(0,0,0,0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }

        .modal-box {
          background: #111;
          border: 1px solid #333;
          border-radius: 16px;
          padding: 24px;
          text-align: center;
          min-width: 280px;
        }

        .modal-box p {
          color: #fff;
          margin-bottom: 8px;
        }

        .modal-subtitle {
          color: #888 !important;
          font-size: 14px;
        }

        .modal-buttons {
          display: flex;
          gap: 12px;
          margin-top: 20px;
          justify-content: center;
        }

        .modal-btn {
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: bold;
          cursor: pointer;
          border: none;
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
          background: #00ff6a;
          color: #000;
        }

        .modal-btn.secondary {
          background: #333;
          color: #fff;
        }

        .end-modal h2 {
          font-size: 28px;
          margin-bottom: 12px;
        }

        .win-title { color: #00ff6a; }
        .lose-title { color: #ff4d5a; }

        .final-score {
          font-size: 24px;
          color: #fff;
        }
      `}</style>
    </div>
  );
}
