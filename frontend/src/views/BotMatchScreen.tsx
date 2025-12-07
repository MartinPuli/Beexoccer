import { useEffect, useRef, useState, useCallback } from "react";
import { PitchCanvas } from "../components/PitchCanvas";
import { useGameStore } from "../hooks/useGameStore";
import { TokenChip } from "../types/game";

// Constantes del campo
const FIELD_WIDTH = 600;
const FIELD_HEIGHT = 900;
const BOUNDARY_LEFT = 50;
const BOUNDARY_RIGHT = 550;
const BOUNDARY_TOP = 50;
const BOUNDARY_BOTTOM = 850;
const GOAL_LEFT = 220;
const GOAL_RIGHT = 380;

// Física
const FRICTION = 0.97;
const EPSILON = 0.15;
const POWER = 0.18;
const MAX_SPEED = 8;
const MAX_DRAG_DISTANCE = 350; // Límite máximo de arrastre
const TURN_TIME = 10000;

type MovingChip = TokenChip & { vx: number; vy: number };
interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

const initPlayerChips = (): MovingChip[] => [
  { id: "you-1", x: 300, y: 750, radius: 28, fill: "#00a8ff", flagEmoji: "", owner: "creator", vx: 0, vy: 0 },
  { id: "you-2", x: 150, y: 650, radius: 28, fill: "#00a8ff", flagEmoji: "", owner: "creator", vx: 0, vy: 0 },
  { id: "you-3", x: 450, y: 650, radius: 28, fill: "#00a8ff", flagEmoji: "", owner: "creator", vx: 0, vy: 0 },
];

const initBotChips = (): MovingChip[] => [
  { id: "bot-1", x: 300, y: 150, radius: 28, fill: "#ff4d5a", flagEmoji: "🤖", owner: "challenger", vx: 0, vy: 0 },
  { id: "bot-2", x: 150, y: 250, radius: 28, fill: "#ff4d5a", flagEmoji: "🤖", owner: "challenger", vx: 0, vy: 0 },
  { id: "bot-3", x: 450, y: 250, radius: 28, fill: "#ff4d5a", flagEmoji: "🤖", owner: "challenger", vx: 0, vy: 0 },
];

const initBall = (): BallState => ({ x: 300, y: 450, vx: 0, vy: 0, radius: 14 });

function magnitude(vx: number, vy: number) {
  return Math.hypot(vx, vy);
}

function reflectInBounds(entity: { x: number; y: number; vx: number; vy: number; radius: number }, isBall: boolean) {
  const r = entity.radius;
  
  if (entity.x - r < BOUNDARY_LEFT) {
    entity.x = BOUNDARY_LEFT + r;
    entity.vx = Math.abs(entity.vx) * 0.8;
  }
  if (entity.x + r > BOUNDARY_RIGHT) {
    entity.x = BOUNDARY_RIGHT - r;
    entity.vx = -Math.abs(entity.vx) * 0.8;
  }
  
  const inGoalX = entity.x > GOAL_LEFT && entity.x < GOAL_RIGHT;
  
  if (entity.y - r < BOUNDARY_TOP) {
    if (!isBall || !inGoalX) {
      entity.y = BOUNDARY_TOP + r;
      entity.vy = Math.abs(entity.vy) * 0.8;
    }
  }
  
  if (entity.y + r > BOUNDARY_BOTTOM) {
    if (!isBall || !inGoalX) {
      entity.y = BOUNDARY_BOTTOM - r;
      entity.vy = -Math.abs(entity.vy) * 0.8;
    }
  }
}

function handleCollision(a: MovingChip | BallState, b: MovingChip | BallState) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const minDist = a.radius + b.radius;
  if (dist === 0 || dist >= minDist) return;
  
  const overlap = minDist - dist;
  const nx = dx / dist;
  const ny = dy / dist;
  
  a.x -= (overlap / 2) * nx;
  a.y -= (overlap / 2) * ny;
  b.x += (overlap / 2) * nx;
  b.y += (overlap / 2) * ny;
  
  const va = a.vx * nx + a.vy * ny;
  const vb = b.vx * nx + b.vy * ny;
  a.vx += (vb - va) * nx * 0.9;
  a.vy += (vb - va) * ny * 0.9;
  b.vx += (va - vb) * nx * 0.9;
  b.vy += (va - vb) * ny * 0.9;
}

export function BotMatchScreen() {
  const goalTarget = useGameStore((s) => s.matchGoalTarget);
  const setView = useGameStore((s) => s.setView);

  const chipsRef = useRef<MovingChip[]>([...initPlayerChips(), ...initBotChips()]);
  const ballRef = useRef<BallState>(initBall());
  
  const [chips, setChips] = useState<MovingChip[]>(chipsRef.current);
  const [ball, setBall] = useState<BallState>(ballRef.current);
  const [aim, setAim] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | undefined>();
  const [active, setActive] = useState<"creator" | "challenger">("creator");
  const [selectedChipId, setSelectedChipId] = useState<string>("you-1");
  const [myScore, setMyScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [showEnd, setShowEnd] = useState(false);
  const [winner, setWinner] = useState<"you" | "bot" | null>(null);
  const [goalAnimation, setGoalAnimation] = useState<"you" | "bot" | null>(null);
  const [turnLostAnimation, setTurnLostAnimation] = useState(false);
  const [timerPercent, setTimerPercent] = useState(100);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const dragRef = useRef<{ chipId: string; start: { x: number; y: number } } | null>(null);
  const simRef = useRef<number | null>(null);
  const turnTakenRef = useRef(false);
  const turnStartTimeRef = useRef<number>(Date.now());
  const goalScoredRef = useRef(false);

  // Handler para salir
  const handleExitRequest = () => {
    setShowExitConfirm(true);
  };

  const handleExitConfirm = () => {
    setShowExitConfirm(false);
    setView("home");
  };

  const handleExitCancel = () => {
    setShowExitConfirm(false);
  };

  // Calcular momentum (quién va ganando)
  const momentum = myScore - botScore;
  const momentumPercent = 50 + (momentum / goalTarget) * 50;

  const resetField = useCallback((scorer: "you" | "bot") => {
    chipsRef.current = [...initPlayerChips(), ...initBotChips()];
    ballRef.current = initBall();
    setChips(chipsRef.current);
    setBall(ballRef.current);
    setActive(scorer === "you" ? "challenger" : "creator");
    setSelectedChipId(scorer === "you" ? "bot-1" : "you-1");
    turnTakenRef.current = false;
    turnStartTimeRef.current = Date.now();
    setTimerPercent(100);
    goalScoredRef.current = false;
  }, []);

  const showGoalAnim = useCallback((scorer: "you" | "bot") => {
    setGoalAnimation(scorer);
    setTimeout(() => {
      setGoalAnimation(null);
      resetField(scorer);
    }, 1500);
  }, [resetField]);

  const showTurnLost = useCallback(() => {
    setTurnLostAnimation(true);
    setTimeout(() => setTurnLostAnimation(false), 1200);
  }, []);

  // Timer separado para actualización fluida cada 50ms
  useEffect(() => {
    const timerInterval = setInterval(() => {
      if (goalAnimation || showEnd || turnLostAnimation) return;
      
      const elapsed = Date.now() - turnStartTimeRef.current;
      const remaining = Math.max(0, TURN_TIME - elapsed);
      setTimerPercent((remaining / TURN_TIME) * 100);
    }, 50);
    
    return () => clearInterval(timerInterval);
  }, [goalAnimation, showEnd, turnLostAnimation]);

  const stepEntity = <T extends { x: number; y: number; vx: number; vy: number; radius: number }>(entity: T, isBall: boolean): T => {
    const next = { ...entity };
    next.x += next.vx;
    next.y += next.vy;
    const speed = magnitude(next.vx, next.vy);
    if (speed > MAX_SPEED) {
      next.vx = (next.vx / speed) * MAX_SPEED;
      next.vy = (next.vy / speed) * MAX_SPEED;
    }
    next.vx *= FRICTION;
    next.vy *= FRICTION;
    if (magnitude(next.vx, next.vy) < EPSILON) {
      next.vx = 0;
      next.vy = 0;
    }
    reflectInBounds(next, isBall);
    return next;
  };

  const isMoving = useCallback(() => {
    return chipsRef.current.some((c) => magnitude(c.vx, c.vy) > EPSILON) || 
           magnitude(ballRef.current.vx, ballRef.current.vy) > EPSILON;
  }, []);

  const botShoot = useCallback(() => {
    const botChips = chipsRef.current.filter((c) => c.owner === "challenger");
    const ballPos = ballRef.current;
    
    let bestChip: MovingChip | null = null;
    let minDist = Infinity;
    for (const chip of botChips) {
      const dist = Math.hypot(ballPos.x - chip.x, ballPos.y - chip.y);
      if (dist < minDist) {
        minDist = dist;
        bestChip = chip;
      }
    }
    
    if (bestChip) {
      const dx = ballPos.x - bestChip.x;
      const dy = ballPos.y - bestChip.y;
      const mag = Math.hypot(dx, dy) || 1;
      const speed = 5 + Math.random() * 2;
      bestChip.vx = (dx / mag) * speed;
      bestChip.vy = (dy / mag) * speed;
    }
    
    turnTakenRef.current = true;
  }, []);

  useEffect(() => {
    let lastTime = performance.now();
    
    const loop = () => {
      const now = performance.now();
      const delta = (now - lastTime) / 16.67;
      lastTime = now;
      
      if (goalAnimation || showEnd || turnLostAnimation) {
        simRef.current = requestAnimationFrame(loop);
        return;
      }
      
      for (let i = 0; i < Math.min(delta, 3); i++) {
        chipsRef.current = chipsRef.current.map((c) => stepEntity(c, false));
        ballRef.current = stepEntity(ballRef.current, true);
        
        const cl = chipsRef.current;
        const bl = ballRef.current;
        for (let j = 0; j < cl.length; j++) {
          for (let k = j + 1; k < cl.length; k++) handleCollision(cl[j], cl[k]);
          handleCollision(cl[j], bl);
        }
      }
      
      const b = ballRef.current;
      if (!goalScoredRef.current) {
        if (b.y < BOUNDARY_TOP - 10 && b.x > GOAL_LEFT && b.x < GOAL_RIGHT) {
          goalScoredRef.current = true;
          const newScore = myScore + 1;
          setMyScore(newScore);
          if (newScore >= goalTarget) {
            setWinner("you");
            setShowEnd(true);
          } else {
            showGoalAnim("you");
          }
        }
        if (b.y > BOUNDARY_BOTTOM + 10 && b.x > GOAL_LEFT && b.x < GOAL_RIGHT) {
          goalScoredRef.current = true;
          const newScore = botScore + 1;
          setBotScore(newScore);
          if (newScore >= goalTarget) {
            setWinner("bot");
            setShowEnd(true);
          } else {
            showGoalAnim("bot");
          }
        }
      }
      
      // Check timeout para perder turno
      const elapsed = Date.now() - turnStartTimeRef.current;
      const remaining = Math.max(0, TURN_TIME - elapsed);
      
      // Timeout - perdió turno
      if (remaining <= 0 && !turnTakenRef.current && !isMoving() && !goalScoredRef.current) {
        if (active === "creator") {
          showTurnLost();
        }
        turnTakenRef.current = true;
      }
      
      if (!isMoving() && turnTakenRef.current && !goalScoredRef.current) {
        if (active === "creator") {
          setActive("challenger");
          setSelectedChipId("bot-1");
          turnTakenRef.current = false;
          turnStartTimeRef.current = Date.now();
          setTimeout(() => {
            if (!goalScoredRef.current) botShoot();
          }, 600);
        } else {
          setActive("creator");
          setSelectedChipId("you-1");
          turnTakenRef.current = false;
          turnStartTimeRef.current = Date.now();
        }
      }
      
      setChips(chipsRef.current.map((c) => ({ ...c })));
      setBall({ ...ballRef.current });
      
      simRef.current = requestAnimationFrame(loop);
    };
    
    simRef.current = requestAnimationFrame(loop);
    return () => {
      if (simRef.current) cancelAnimationFrame(simRef.current);
    };
  }, [active, goalAnimation, showEnd, turnLostAnimation, myScore, botScore, goalTarget, isMoving, botShoot, showGoalAnim, showTurnLost]);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (active !== "creator" || turnTakenRef.current || isMoving()) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * FIELD_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * FIELD_HEIGHT;
    
    const playerChips = chipsRef.current.filter((c) => c.owner === "creator");
    const touched = playerChips.find((c) => Math.hypot(c.x - x, c.y - y) <= c.radius + 15);
    
    if (touched) {
      setSelectedChipId(touched.id);
      dragRef.current = { chipId: touched.id, start: { x: touched.x, y: touched.y } };
      setAim({ from: { x: touched.x, y: touched.y }, to: { x, y } });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * FIELD_WIDTH;
    let y = ((e.clientY - rect.top) / rect.height) * FIELD_HEIGHT;
    
    // Limitar distancia de arrastre
    const { start } = dragRef.current;
    const dist = Math.hypot(x - start.x, y - start.y);
    if (dist > MAX_DRAG_DISTANCE) {
      const angle = Math.atan2(y - start.y, x - start.x);
      x = start.x + Math.cos(angle) * MAX_DRAG_DISTANCE;
      y = start.y + Math.sin(angle) * MAX_DRAG_DISTANCE;
    }
    
    setAim((prev) => (prev ? { ...prev, to: { x, y } } : undefined));
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current || active !== "creator" || turnTakenRef.current) {
      dragRef.current = null;
      setAim(undefined);
      return;
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * FIELD_WIDTH;
    let y = ((e.clientY - rect.top) / rect.height) * FIELD_HEIGHT;
    const { chipId, start } = dragRef.current;
    
    // Limitar distancia
    const dist = Math.hypot(x - start.x, y - start.y);
    if (dist > MAX_DRAG_DISTANCE) {
      const angle = Math.atan2(y - start.y, x - start.x);
      x = start.x + Math.cos(angle) * MAX_DRAG_DISTANCE;
      y = start.y + Math.sin(angle) * MAX_DRAG_DISTANCE;
    }
    
    const dx = (start.x - x) * POWER;
    const dy = (start.y - y) * POWER;
    
    if (Math.hypot(dx, dy) > 0.5) {
      chipsRef.current = chipsRef.current.map((c) => 
        c.id === chipId ? { ...c, vx: dx, vy: dy } : c
      );
      turnTakenRef.current = true;
    }
    
    dragRef.current = null;
    setAim(undefined);
  };

  const turnLabel = active === "creator" ? "TU TURNO" : "TURNO BOT";
  const isPlayerTurn = active === "creator";

  return (
    <div className="playing-screen">
      <div className="playing-hud">
        {/* Header con botón de salir */}
        <div className="hud-header">
          <button className="exit-btn" onClick={handleExitRequest}>✕</button>
          <span className="hud-title">VS BOT</span>
          <span style={{ width: 32 }} />
        </div>
        
        {/* Barra de momentum - indicador de quién va ganando */}
        <div className="momentum-bar">
          <div className="momentum-fill" style={{ left: `calc(${momentumPercent}% - 3px)` }} />
          <div className="momentum-center" />
        </div>
        
        <div className="hud-scores">
          <span className="hud-player you">TU</span>
          <div className="hud-score-center">
            <span className="hud-score-num">{myScore}</span>
            <span className="hud-sep">-</span>
            <span className="hud-score-num rival">{botScore}</span>
          </div>
          <span className="hud-player rival">BOT</span>
        </div>
        
        <div className="hud-timer">
          <div className="timer-bar">
            <div 
              className="timer-fill" 
              style={{ 
                width: `${timerPercent}%`,
                backgroundColor: timerPercent < 30 ? 'var(--accent-red)' : 'var(--neon-green)'
              }} 
            />
          </div>
          <span className="timer-label">{turnLabel}</span>
        </div>
      </div>

      <div className="playing-pitch">
        <PitchCanvas
          chips={chips}
          ball={ball}
          highlightId={selectedChipId}
          activePlayer={active}
          isPlayerTurn={isPlayerTurn}
          aimLine={aim}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      </div>

      {turnLostAnimation && (
        <div className="turn-lost-overlay">
          <div className="turn-lost-text">¡TIEMPO! ⏰</div>
        </div>
      )}

      {goalAnimation && (
        <div className="goal-overlay">
          <div className="goal-text">
            {goalAnimation === "you" ? "¡GOOOL! ⚽" : "GOL DEL BOT 😢"}
          </div>
        </div>
      )}

      {showEnd && (
        <div className="end-overlay">
          <div className="end-modal">
            <h2 className="end-title">{winner === "you" ? "¡GANASTE! 🏆" : "PERDISTE 😔"}</h2>
            <p className="end-score">{myScore} - {botScore}</p>
            <button className="home-btn primary" onClick={() => setView("home")}>
              Volver al inicio
            </button>
          </div>
        </div>
      )}

      {/* Modal de confirmación para salir */}
      {showExitConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-modal">
            <div className="confirm-icon">⚽</div>
            <h2 className="confirm-title">¿Abandonar partida?</h2>
            <p className="confirm-text">
              Esta partida contra el bot se perderá. ¿Estás seguro?
            </p>
            <div className="confirm-buttons">
              <button className="confirm-btn cancel" onClick={handleExitCancel}>
                Continuar jugando
              </button>
              <button className="confirm-btn confirm" onClick={handleExitConfirm}>
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


