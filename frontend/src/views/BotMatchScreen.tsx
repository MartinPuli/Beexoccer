import { useEffect, useRef, useState } from "react";
import { Panel } from "../components/Panel";
import { PitchCanvas } from "../components/PitchCanvas";
import { TokenChip } from "../types/game";

const FIELD_WIDTH = 600;
const FIELD_HEIGHT = 900;
// Softer physics to reduce chaos and slow pieces faster
const FRICTION = 0.97;
const EPSILON = 0.12; // stop sooner to end turns
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

const playerChip: MovingChip = { id: "you-1", x: 300, y: 720, radius: 30, fill: "#2dd673", flagEmoji: "👟", owner: "creator", vx: 0, vy: 0 };
const botChip: MovingChip = { id: "bot-1", x: 300, y: 180, radius: 30, fill: "#00b870", flagEmoji: "🤖", owner: "challenger", vx: 0, vy: 0 };

function magnitude(vx: number, vy: number) {
  return Math.hypot(vx, vy);
}

function reflect(entity: { x: number; y: number; vx: number; vy: number; radius: number }) {
  if (entity.x - entity.radius < 0) {
    entity.x = entity.radius;
    entity.vx = Math.abs(entity.vx);
  }
  if (entity.x + entity.radius > FIELD_WIDTH) {
    entity.x = FIELD_WIDTH - entity.radius;
    entity.vx = -Math.abs(entity.vx);
  }
  if (entity.y - entity.radius < 0) {
    entity.y = entity.radius;
    entity.vy = Math.abs(entity.vy);
  }
  if (entity.y + entity.radius > FIELD_HEIGHT) {
    entity.y = FIELD_HEIGHT - entity.radius;
    entity.vy = -Math.abs(entity.vy);
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
  const newVa = vb;
  const newVb = va;
  a.vx += (newVa - va) * nx;
  a.vy += (newVa - va) * ny;
  b.vx += (newVb - vb) * nx;
  b.vy += (newVb - vb) * ny;
}

export function BotMatchScreen() {
  const chipsRef = useRef<MovingChip[]>([playerChip, botChip]);
  const ballRef = useRef<BallState>({ x: 300, y: 450, vx: 0, vy: 0, radius: 12 });
  const [chips, setChips] = useState<MovingChip[]>(chipsRef.current);
  const [ball, setBall] = useState<BallState>(ballRef.current);
  const [aim, setAim] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | undefined>();
  const [active, setActive] = useState<"creator" | "challenger">("creator");
  const dragRef = useRef<{ chipId: string; start: { x: number; y: number } } | null>(null);
  const simRef = useRef<number | null>(null);
  const awaitingBotRef = useRef(false);
  const turnTakenRef = useRef(false); // true after current side has shot; resets when turn hands off

  useEffect(() => {
    const loop = () => {
      stepEntities();
      resolveCollisions();
      publishFrame();
      maybeAdvanceTurn();
      simRef.current = requestAnimationFrame(loop);
    };
    simRef.current = requestAnimationFrame(loop);
    return () => {
      if (simRef.current) cancelAnimationFrame(simRef.current);
      simRef.current = null;
    };
  }, []);

  const stepEntities = () => {
    chipsRef.current = chipsRef.current.map((c) => step(c));
    ballRef.current = step(ballRef.current);
  };

  const step = <T extends { x: number; y: number; vx: number; vy: number; radius: number }>(entity: T): T => {
    const next = { ...entity };
    next.x += next.vx;
    next.y += next.vy;
    // Clamp speed to avoid explosive collisions
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
    reflect(next);
    return next;
  };

  const resolveCollisions = () => {
    const chipsList = chipsRef.current;
    const ballState = ballRef.current;
    for (let i = 0; i < chipsList.length; i += 1) {
      for (let j = i + 1; j < chipsList.length; j += 1) {
        handleCollision(chipsList[i], chipsList[j]);
      }
      handleCollision(chipsList[i], ballState);
    }
  };

  const publishFrame = () => {
    setChips(chipsRef.current.map((c) => ({ ...c })));
    setBall({ ...ballRef.current });
  };

  const moving = () =>
    chipsRef.current.some((c) => magnitude(c.vx, c.vy) > EPSILON) || magnitude(ballRef.current.vx, ballRef.current.vy) > EPSILON;

  const maybeAdvanceTurn = () => {
    if (moving()) return;
    if (!turnTakenRef.current) return; // wait until a shot was taken for this side

    if (active === "creator") {
      if (awaitingBotRef.current) return;
      awaitingBotRef.current = true;
      turnTakenRef.current = false; // reset for bot turn
      setActive("challenger");
      setTimeout(() => {
        botShoot();
        turnTakenRef.current = true;
        awaitingBotRef.current = false;
      }, 420);
      return;
    }

    // Bot finished its motion; give turn back to player
    turnTakenRef.current = false;
    setActive("creator");
  };

  const botShoot = () => {
    const bot = chipsRef.current.find((c) => c.owner === "challenger");
    if (!bot) return;

    // Simple aggressive shot: always hit the ball hard toward the player's goal (bottom)
    const goalTarget = { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT - 10 };
    const ballPos = ballRef.current;
    const unitToGoal = normalize(goalTarget.x - ballPos.x, goalTarget.y - ballPos.y);
    const contactPoint = {
      x: ballPos.x - unitToGoal.x * (ballPos.radius + bot.radius + 6),
      y: ballPos.y - unitToGoal.y * (ballPos.radius + bot.radius + 6),
    };

    const dirX = contactPoint.x - bot.x;
    const dirY = contactPoint.y - bot.y;
    const mag = Math.hypot(dirX, dirY) || 1;
    // Bot kicks hard toward goal; clamp will cap excessive speed
    const boost = POWER * 1.6;
    bot.vx = (dirX / mag) * boost;
    bot.vy = (dirY / mag) * boost;
    turnTakenRef.current = true; // ensure turn will advance after motion stops
  };

  const normalize = (x: number, y: number) => {
    const m = Math.hypot(x, y) || 1;
    return { x: x / m, y: y / m };
  };

  const stopMotion = () => {
    chipsRef.current = chipsRef.current.map((c) => ({ ...c, vx: 0, vy: 0 }));
    ballRef.current = { ...ballRef.current, vx: 0, vy: 0 };
    publishFrame();
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (active !== "creator" || turnTakenRef.current) return; // only one chip per turn
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * FIELD_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * FIELD_HEIGHT;
    const you = chipsRef.current.find((c) => c.owner === "creator");
    if (!you) return;
    const dist = Math.hypot(you.x - x, you.y - y);
    if (dist > you.radius + 12) return;
    dragRef.current = { chipId: you.id, start: { x: you.x, y: you.y } };
    setAim({ from: { x: you.x, y: you.y }, to: { x, y } });
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
    turnTakenRef.current = true; // lock until motion stops and turn advances
  };

  const turnBadge = active === "creator" ? "Tu turno" : "Turno bot";
  const highlightId = active === "creator" ? "you-1" : "bot-1";

  return (
    <Panel title="Modo Bot" subtitle="1 vs 1 con física local">
      <div style={{ marginBottom: "0.5rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <span className="badge" style={{ background: active === "creator" ? "#123821" : "#123043" }}>{turnBadge}</span>
        <span style={{ color: "var(--text-muted)" }}>Arrastra tu ficha verde, suelta para disparar. El bot responde en su turno.</span>
      </div>
      <PitchCanvas
        chips={chips}
        ball={ball}
        highlightId={highlightId}
        aimLine={aim}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      <ul style={{ marginTop: "1rem", color: "var(--text-muted)" }}>
        <li>1 vs 1: verde (tú) vs bot (azul).</li>
        <li>Física simple local: rebotes, fricción y colisiones con la pelota.</li>
        <li>El bot siempre intenta golpear la pelota hacia su frente.</li>
      </ul>
      <div className="button-grid" style={{ marginTop: "0.75rem" }}>
        <button className="ghost" type="button" onClick={stopMotion}>Detener movimiento</button>
      </div>
    </Panel>
  );
}


