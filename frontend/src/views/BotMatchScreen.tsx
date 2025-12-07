import { useEffect, useRef, useState } from "react";
import { PitchCanvas } from "../components/PitchCanvas";
import { useGameStore } from "../hooks/useGameStore";
import { TokenChip } from "../types/game";

const FIELD_WIDTH = 600;
const FIELD_HEIGHT = 900;
const FRICTION = 0.97;
const EPSILON = 0.12;
const POWER = 0.14;
const MAX_SPEED = 7.5;

type MovingChip = TokenChip & { vx: number; vy: number };
interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

// 3 fichas para el jugador (azules) - portería arriba
const initPlayerChips = (): MovingChip[] => [
  { id: "you-1", x: 300, y: 680, radius: 30, fill: "#00a8ff", flagEmoji: "⚽", owner: "creator", vx: 0, vy: 0 },
  { id: "you-2", x: 180, y: 600, radius: 30, fill: "#00a8ff", flagEmoji: "⚽", owner: "creator", vx: 0, vy: 0 },
  { id: "you-3", x: 420, y: 600, radius: 30, fill: "#00a8ff", flagEmoji: "⚽", owner: "creator", vx: 0, vy: 0 },
];

// 3 fichas para el bot (rojas) - portería abajo
const initBotChips = (): MovingChip[] => [
  { id: "bot-1", x: 300, y: 220, radius: 30, fill: "#ff4d5a", flagEmoji: "🤖", owner: "challenger", vx: 0, vy: 0 },
  { id: "bot-2", x: 180, y: 300, radius: 30, fill: "#ff4d5a", flagEmoji: "🤖", owner: "challenger", vx: 0, vy: 0 },
  { id: "bot-3", x: 420, y: 300, radius: 30, fill: "#ff4d5a", flagEmoji: "🤖", owner: "challenger", vx: 0, vy: 0 },
];

const initBall = (): BallState => ({ x: 300, y: 450, vx: 0, vy: 0, radius: 12 });

function magnitude(vx: number, vy: number) {
  return Math.hypot(vx, vy);
}

function reflect(entity: { x: number; y: number; vx: number; vy: number; radius: number }) {
  if (entity.x - entity.radius < 0) { entity.x = entity.radius; entity.vx = Math.abs(entity.vx); }
  if (entity.x + entity.radius > FIELD_WIDTH) { entity.x = FIELD_WIDTH - entity.radius; entity.vx = -Math.abs(entity.vx); }
  if (entity.y - entity.radius < 0) { entity.y = entity.radius; entity.vy = Math.abs(entity.vy); }
  if (entity.y + entity.radius > FIELD_HEIGHT) { entity.y = FIELD_HEIGHT - entity.radius; entity.vy = -Math.abs(entity.vy); }
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
  a.vx += (vb - va) * nx;
  a.vy += (vb - va) * ny;
  b.vx += (va - vb) * nx;
  b.vy += (va - vb) * ny;
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

  const dragRef = useRef<{ chipId: string; start: { x: number; y: number } } | null>(null);
  const simRef = useRef<number | null>(null);
  const awaitingBotRef = useRef(false);
  const turnTakenRef = useRef(false);

  const resetField = () => {
    chipsRef.current = [...initPlayerChips(), ...initBotChips()];
    ballRef.current = initBall();
    setChips(chipsRef.current);
    setBall(ballRef.current);
    setActive("creator");
    setSelectedChipId("you-1");
    turnTakenRef.current = false;
    awaitingBotRef.current = false;
  };

  useEffect(() => {
    const loop = () => {
      stepEntities();
      resolveCollisions();
      checkGoals();
      publishFrame();
      maybeAdvanceTurn();
      simRef.current = requestAnimationFrame(loop);
    };
    simRef.current = requestAnimationFrame(loop);
    return () => { if (simRef.current) cancelAnimationFrame(simRef.current); };
  }, []);

  const stepEntities = () => {
    chipsRef.current = chipsRef.current.map((c) => step(c));
    ballRef.current = step(ballRef.current);
  };

  const step = <T extends { x: number; y: number; vx: number; vy: number; radius: number }>(entity: T): T => {
    const next = { ...entity };
    next.x += next.vx;
    next.y += next.vy;
    const speed = magnitude(next.vx, next.vy);
    if (speed > MAX_SPEED) { next.vx = (next.vx / speed) * MAX_SPEED; next.vy = (next.vy / speed) * MAX_SPEED; }
    next.vx *= FRICTION;
    next.vy *= FRICTION;
    if (magnitude(next.vx, next.vy) < EPSILON) { next.vx = 0; next.vy = 0; }
    reflect(next);
    return next;
  };

  const resolveCollisions = () => {
    const cl = chipsRef.current;
    const bl = ballRef.current;
    for (let i = 0; i < cl.length; i++) {
      for (let j = i + 1; j < cl.length; j++) handleCollision(cl[i], cl[j]);
      handleCollision(cl[i], bl);
    }
  };

  const checkGoals = () => {
    const b = ballRef.current;
    // Gol en arco superior (gol mío)
    if (b.y - b.radius < 40 && b.x > 220 && b.x < 380) {
      setMyScore((s) => { const ns = s + 1; if (ns >= goalTarget) { setWinner("you"); setShowEnd(true); } return ns; });
      resetField();
    }
    // Gol en arco inferior (gol del bot)
    if (b.y + b.radius > 860 && b.x > 220 && b.x < 380) {
      setBotScore((s) => { const ns = s + 1; if (ns >= goalTarget) { setWinner("bot"); setShowEnd(true); } return ns; });
      resetField();
    }
  };

  const publishFrame = () => {
    setChips(chipsRef.current.map((c) => ({ ...c })));
    setBall({ ...ballRef.current });
  };

  const moving = () => chipsRef.current.some((c) => magnitude(c.vx, c.vy) > EPSILON) || magnitude(ballRef.current.vx, ballRef.current.vy) > EPSILON;

  const maybeAdvanceTurn = () => {
    if (moving() || !turnTakenRef.current) return;
    if (active === "creator") {
      if (awaitingBotRef.current) return;
      awaitingBotRef.current = true;
      turnTakenRef.current = false;
      setActive("challenger");
      setTimeout(() => { botShoot(); turnTakenRef.current = true; awaitingBotRef.current = false; }, 400);
      return;
    }
    turnTakenRef.current = false;
    setActive("creator");
  };

  // Bot IA competitivo - elige la mejor ficha y estrategia
  const botShoot = () => {
    const botChips = chipsRef.current.filter((c) => c.owner === "challenger");
    const ballPos = ballRef.current;
    const goalY = FIELD_HEIGHT - 40; // Portería del jugador (abajo)
    const goalX = 300; // Centro de la portería

    // Evaluar cada ficha del bot
    let bestChip: MovingChip | null = null;
    let bestScore = -Infinity;
    let bestDx = 0, bestDy = 0;

    for (const chip of botChips) {
      // Estrategia 1: Golpear la pelota hacia la portería
      const angleToGoal = Math.atan2(goalY - ballPos.y, goalX - ballPos.x);
      const behindBallX = ballPos.x - Math.cos(angleToGoal) * 60;
      const behindBallY = ballPos.y - Math.sin(angleToGoal) * 60;
      const distToBehind = Math.hypot(behindBallX - chip.x, behindBallY - chip.y);
      
      // Score basado en cercanía a la posición ideal
      let score = 1000 - distToBehind;
      
      // Bonus si la pelota está en campo rival (más cerca de su portería)
      if (ballPos.y > FIELD_HEIGHT / 2) score += 200;
      
      // Bonus si podemos golpear directamente hacia la portería
      if (chip.y < ballPos.y) score += 150;

      if (score > bestScore) {
        bestScore = score;
        bestChip = chip;
        
        // Calcular dirección hacia la pelota con componente hacia portería
        const dx = ballPos.x - chip.x;
        const dy = ballPos.y - chip.y;
        const mag = Math.hypot(dx, dy) || 1;
        
        // Agregar bias hacia la portería
        const goalBiasX = (goalX - ballPos.x) * 0.3;
        const goalBiasY = (goalY - ballPos.y) * 0.3;
        
        bestDx = (dx / mag + goalBiasX / 300) * POWER * 2;
        bestDy = (dy / mag + goalBiasY / 300) * POWER * 2;
      }
    }

    if (bestChip) {
      // Agregar un poco de variabilidad
      const randomFactor = 0.9 + Math.random() * 0.2;
      bestChip.vx = bestDx * randomFactor;
      bestChip.vy = bestDy * randomFactor;
    }
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (active !== "creator" || turnTakenRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * FIELD_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * FIELD_HEIGHT;
    
    // Buscar si tocamos alguna ficha nuestra
    const playerChips = chipsRef.current.filter((c) => c.owner === "creator");
    const touched = playerChips.find((c) => Math.hypot(c.x - x, c.y - y) <= c.radius + 12);
    
    if (touched) {
      setSelectedChipId(touched.id);
      dragRef.current = { chipId: touched.id, start: { x: touched.x, y: touched.y } };
      setAim({ from: { x: touched.x, y: touched.y }, to: { x, y } });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * FIELD_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * FIELD_HEIGHT;
    setAim((prev) => (prev ? { ...prev, to: { x, y } } : undefined));
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current || active !== "creator" || turnTakenRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * FIELD_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * FIELD_HEIGHT;
    const { chipId, start } = dragRef.current;
    const dx = (start.x - x) * POWER;
    const dy = (start.y - y) * POWER;
    chipsRef.current = chipsRef.current.map((c) => (c.id === chipId ? { ...c, vx: dx, vy: dy } : c));
    dragRef.current = null;
    setAim(undefined);
    turnTakenRef.current = true;
  };

  const turnLabel = active === "creator" ? "Tu turno" : "Turno bot";

  return (
    <div className="playing-screen">
      <div className="playing-hud">
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
          <div className="timer-bar"><div className="timer-fill" style={{ width: "100%" }} /></div>
          <span className="timer-label">{turnLabel}</span>
        </div>
      </div>

      <div className="playing-pitch">
        <PitchCanvas
          chips={chips}
          ball={ball}
          highlightId={selectedChipId}
          aimLine={aim}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      </div>

      {showEnd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "var(--dark-panel)", border: "3px solid var(--border-green)", borderRadius: 24, padding: 32, textAlign: "center", color: "var(--text-white)" }}>
            <h2 style={{ marginBottom: 16 }}>{winner === "you" ? "¡GANASTE!" : "Perdiste"}</h2>
            <button className="home-btn primary" onClick={() => setView("home")}>Volver al inicio</button>
          </div>
        </div>
      )}
    </div>
  );
}


