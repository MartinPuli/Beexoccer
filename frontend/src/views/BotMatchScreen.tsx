import { useEffect, useRef, useState, useCallback } from "react";
import { PitchCanvas } from "../components/PitchCanvas";
import { useGameStore } from "../hooks/useGameStore";
import { TokenChip } from "../types/game";

/**
 * BotMatchScreen (refactor compatible)
 * - Física mejorada (masa basada en área, impulso estable)
 * - Colisiones más robustas y sin "explosiones"
 * - Mejor uso de refs para evitar re-renders innecesarios
 * - Conserva la API para PitchCanvas, useGameStore y tipos
 */

/* =========================
   CONSTANTES DEL CAMPO
   ========================= */
const FIELD_WIDTH = 600;
const FIELD_HEIGHT = 900;
const BOUNDARY_LEFT = 50;
const BOUNDARY_RIGHT = 550;
const BOUNDARY_TOP = 50;
const BOUNDARY_BOTTOM = 850;
const GOAL_LEFT = 220;
const GOAL_RIGHT = 380;

/* =========================
   FÍSICA / TUNING - Estilo Table Soccer (Plato)
   ========================= */
const FRICTION = 0.985;       // Fricción baja - superficie lisa tipo air hockey
const BALL_FRICTION = 0.98;   // Pelota con más fricción para moverse menos
const EPSILON = 0.15;         // Umbral de velocidad mínima
const POWER = 0.45;           // Factor de potencia base (más responsivo)
const MAX_SPEED = 28;         // Velocidad máxima controlada
const MIN_SPEED = 3;          // Velocidad mínima para tiros suaves
const MAX_DRAG_DISTANCE = 200; // Distancia máxima de arrastre
const TURN_TIME = 12000;      // 12 segundos por turno
const RESTITUTION = 0.85;     // Rebote en colisiones (reducido)
const WALL_RESTITUTION = 0.80; // Rebote en paredes (reducido)
const CHIP_MASS = 5;          // Masa de las fichas (pesadas)
const BALL_MASS = 1.58;       // Masa de la pelota (ajustada +7% movimiento)

/* =========================
   TIPOS LOCALES
   ========================= */
type MovingChip = TokenChip & { vx: number; vy: number };
interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

/* =========================
   INITS - Estilo Table Soccer
   ========================= */
const CHIP_RADIUS = 32;  // Fichas más grandes
const BALL_RADIUS = 20;  // Pelota tamaño ajustado

const initPlayerChips = (): MovingChip[] => [
  { id: "you-1", x: 300, y: 750, radius: CHIP_RADIUS, fill: "#00a8ff", flagEmoji: "", owner: "creator", vx: 0, vy: 0 },
  { id: "you-2", x: 150, y: 650, radius: CHIP_RADIUS, fill: "#00a8ff", flagEmoji: "", owner: "creator", vx: 0, vy: 0 },
  { id: "you-3", x: 450, y: 650, radius: CHIP_RADIUS, fill: "#00a8ff", flagEmoji: "", owner: "creator", vx: 0, vy: 0 },
];

const initBotChips = (): MovingChip[] => [
  { id: "bot-1", x: 300, y: 150, radius: CHIP_RADIUS, fill: "#ff4d5a", flagEmoji: "🤖", owner: "challenger", vx: 0, vy: 0 },
  { id: "bot-2", x: 150, y: 250, radius: CHIP_RADIUS, fill: "#ff4d5a", flagEmoji: "🤖", owner: "challenger", vx: 0, vy: 0 },
  { id: "bot-3", x: 450, y: 250, radius: CHIP_RADIUS, fill: "#ff4d5a", flagEmoji: "🤖", owner: "challenger", vx: 0, vy: 0 },
];

const initBall = (): BallState => ({ x: 300, y: 450, vx: 0, vy: 0, radius: BALL_RADIUS });

/* =========================
   UTILS VECTORIALES
   ========================= */
function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
function mag(vx: number, vy: number) {
  return Math.hypot(vx, vy);
}
function normalize(vx: number, vy: number) {
  const m = Math.hypot(vx, vy) || 1;
  return { nx: vx / m, ny: vy / m, m };
}
function safeNumber(n: number, fallback = 0) {
  return Number.isFinite(n) ? n : fallback;
}

/* =========================
   REFLECT EN BORDES (GOLES) - Estilo Table Soccer
   ========================= */
function reflectInBounds(entity: { x: number; y: number; vx: number; vy: number; radius: number }, isBall: boolean) {
  const r = entity.radius;
  const wallBounce = WALL_RESTITUTION; // Rebote vivo en paredes
  
  if (entity.x - r < BOUNDARY_LEFT) {
    entity.x = BOUNDARY_LEFT + r;
    entity.vx = Math.abs(entity.vx) * wallBounce;
  }
  if (entity.x + r > BOUNDARY_RIGHT) {
    entity.x = BOUNDARY_RIGHT - r;
    entity.vx = -Math.abs(entity.vx) * wallBounce;
  }
  
  const inGoalX = entity.x > GOAL_LEFT && entity.x < GOAL_RIGHT;
  
  if (entity.y - r < BOUNDARY_TOP) {
    if (!isBall || !inGoalX) {
      entity.y = BOUNDARY_TOP + r;
      entity.vy = Math.abs(entity.vy) * wallBounce;
    }
  }
  
  if (entity.y + r > BOUNDARY_BOTTOM) {
    if (!isBall || !inGoalX) {
      entity.y = BOUNDARY_BOTTOM - r;
      entity.vy = -Math.abs(entity.vy) * wallBounce;
    }
  }
}

/* =========================
   COLISIONES - Estilo Table Soccer
   - Fichas pesadas, pelota ligera
   - Colisiones elásticas y predecibles
   ========================= */
function massFromRadius(radius: number, isBall: boolean = false) {
  // En Table Soccer: fichas pesadas, pelota muy ligera
  if (isBall) return BALL_MASS;
  return CHIP_MASS;
}

function handleCollision(a: MovingChip | BallState, b: MovingChip | BallState, aIsBall: boolean = false, bIsBall: boolean = false): boolean {
  // Evitar NaNs
  a.vx = safeNumber(a.vx);
  a.vy = safeNumber(a.vy);
  b.vx = safeNumber(b.vx);
  b.vy = safeNumber(b.vy);

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const minDist = (a.radius || 7) + (b.radius || 7);
  
  if (dist >= minDist) return false; // no colision

  // Normal y tangente
  const nx = dx / dist;
  const ny = dy / dist;

  // Mover fuera de superposición (proporcional a masas)
  const overlap = minDist - dist;
  const ma = massFromRadius(a.radius || 7, aIsBall);
  const mb = massFromRadius(b.radius || 7, bIsBall);
  const total = ma + mb || 1;

  // Separación: la pelota se mueve más, las fichas menos
  const sepA = (overlap * (mb / total)) + 0.5;
  const sepB = (overlap * (ma / total)) + 0.5;

  a.x -= nx * sepA;
  a.y -= ny * sepA;
  b.x += nx * sepB;
  b.y += ny * sepB;

  // Resolución de velocidades: impulso en la normal
  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const velAlongNormal = rvx * nx + rvy * ny;

  // Si ya se separan, no aplicar impulso
  if (velAlongNormal > 0) return false;

  // Restitución alta para colisiones elásticas estilo Table Soccer
  const restitution = RESTITUTION;

  // Impulso escalar
  let j = -(1 + restitution) * velAlongNormal;
  j = j / (1 / ma + 1 / mb);

  // Aplicar impulso
  const impulseX = j * nx;
  const impulseY = j * ny;

  a.vx -= (impulseX / ma);
  a.vy -= (impulseY / ma);
  b.vx += (impulseX / mb);
  b.vy += (impulseY / mb);

  // Limitar velocidades
  const sa = mag(a.vx, a.vy);
  if (sa > MAX_SPEED * 1.2) {
    const scale = (MAX_SPEED * 1.2) / sa;
    a.vx *= scale;
    a.vy *= scale;
  }
  const sb = mag(b.vx, b.vy);
  if (sb > MAX_SPEED * 1.2) {
    const scale = (MAX_SPEED * 1.2) / sb;
    b.vx *= scale;
    b.vy *= scale;
  }
  
  return true; // Hubo colisión
}

/* =========================
   STEP ENTITY - Estilo Table Soccer (mesa lisa)
   ========================= */
function stepEntity<T extends { x: number; y: number; vx: number; vy: number; radius: number }>(entity: T, isBall: boolean) {
  const next = { ...entity };
  
  // Fricción diferenciada: pelota muy libre, fichas un poco más de roce
  const frictionFactor = isBall ? BALL_FRICTION : FRICTION;
  next.vx *= frictionFactor;
  next.vy *= frictionFactor;

  const speed = mag(next.vx, next.vy);

  // Detener cuando la velocidad es muy baja (sin efecto césped, es mesa lisa)
  if (speed < EPSILON) {
    next.vx = 0;
    next.vy = 0;
  }

  // Limitar velocidad máxima
  if (speed > MAX_SPEED) {
    const s = MAX_SPEED / speed;
    next.vx *= s;
    next.vy *= s;
  }

  // Movimiento con sub-pasos para colisiones precisas
  const steps = Math.max(1, Math.ceil(speed / 8));
  const stepVx = next.vx / steps;
  const stepVy = next.vy / steps;
  
  for (let i = 0; i < steps; i++) {
    next.x += stepVx;
    next.y += stepVy;
    reflectInBounds(next, isBall);
  }

  return next;
}

/* =========================
   COMPONENTE PRINCIPAL
   (compatible con API anterior)
   ========================= */
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
  const [shotPower, setShotPower] = useState<number>(0);
  const [showPowerMeter, setShowPowerMeter] = useState<{ x: number; y: number } | null>(null);

  const dragRef = useRef<{ chipId: string; start: { x: number; y: number } } | null>(null);
  const simRef = useRef<number | null>(null);
  const turnTakenRef = useRef(false);
  const turnStartTimeRef = useRef<number>(Date.now());
  const goalScoredRef = useRef(false);
  const botAggressionRef = useRef(0.5);
  const botStatsRef = useRef({
    shots: 0,
    passes: 0,
    goals: 0,
    conceded: 0,
    shotsOnTarget: 0,
    successfulPasses: 0,
    interceptions: 0,
  });

  // ========== SISTEMA DE IA AVANZADA DEL BOT ==========
  
  // Personalidad del bot con más estados y memoria
  const botPersonalityRef = useRef<'ultra_aggressive' | 'aggressive' | 'balanced' | 'defensive' | 'parking_bus'>('balanced');
  
  // Estado emocional del bot (afecta toma de riesgos)
  const botMoodRef = useRef<'confident' | 'neutral' | 'frustrated' | 'desperate'>('neutral');
  
  // Contador de turnos sin anotar (para frustración)
  const turnsWithoutScoringRef = useRef(0);
  
  // Historial de jugadas para aprendizaje básico
  const playHistoryRef = useRef<Array<{
    action: 'shoot' | 'pass' | 'clear' | 'intercept' | 'position';
    success: boolean;
    position: { x: number; y: number };
    result?: 'goal' | 'saved' | 'missed' | 'blocked';
  }>>([]);
  
  // Estilo de juego preferido (cambia según lo que funcione)
  const preferredStyleRef = useRef<'direct' | 'passing' | 'counter'>('direct');
  
  // Función para actualizar el estado emocional del bot
  const updateBotMood = useCallback(() => {
    const stats = botStatsRef.current;
    const scoreDiff = botScore - myScore;
    const turnsWithout = turnsWithoutScoringRef.current;
    
    // Calcular eficiencia
    const shotEfficiency = stats.shots > 0 ? stats.goals / stats.shots : 0.5;
    const passEfficiency = stats.passes > 0 ? stats.successfulPasses / stats.passes : 0.5;
    
    // Determinar estado emocional
    if (scoreDiff >= 2 && shotEfficiency > 0.3) {
      botMoodRef.current = 'confident';
    } else if (scoreDiff <= -2 || turnsWithout > 6) {
      botMoodRef.current = 'desperate';
    } else if (turnsWithout > 3 || shotEfficiency < 0.15) {
      botMoodRef.current = 'frustrated';
    } else {
      botMoodRef.current = 'neutral';
    }
    
    // Ajustar estilo preferido según lo que funcione
    if (stats.goals > 0 && stats.shots > 2) {
      if (shotEfficiency > 0.4) {
        preferredStyleRef.current = 'direct'; // Los tiros funcionan
      }
    }
    if (stats.successfulPasses > 3 && passEfficiency > 0.6) {
      preferredStyleRef.current = 'passing'; // Los pases funcionan
    }
    if (stats.interceptions > 2) {
      preferredStyleRef.current = 'counter'; // Contraataques funcionan
    }
  }, [botScore, myScore]);

  // Simulación avanzada de trayectoria con colisiones
  const simulateTrajectory = useCallback((
    startX: number, startY: number, vx: number, vy: number, 
    steps: number = 40, isBall: boolean = true
  ): { x: number; y: number; vx: number; vy: number; willScore: boolean; dangerZone: boolean } => {
    let x = startX, y = startY;
    let cvx = vx, cvy = vy;
    const friction = isBall ? BALL_FRICTION : FRICTION;
    const radius = isBall ? BALL_RADIUS : CHIP_RADIUS;
    let willScore = false;
    let dangerZone = false;
    
    for (let i = 0; i < steps; i++) {
      cvx *= friction;
      cvy *= friction;
      
      if (Math.hypot(cvx, cvy) < EPSILON) break;
      
      x += cvx;
      y += cvy;
      
      // Detectar si entrará en el arco del bot (arriba)
      if (y - radius < BOUNDARY_TOP && x > GOAL_LEFT && x < GOAL_RIGHT) {
        willScore = true;
      }
      
      // Detectar zona de peligro (cerca del arco del bot)
      if (y < FIELD_HEIGHT * 0.3) {
        dangerZone = true;
      }
      
      // Rebotes en paredes
      if (x - radius < BOUNDARY_LEFT) { x = BOUNDARY_LEFT + radius; cvx = Math.abs(cvx) * WALL_RESTITUTION; }
      if (x + radius > BOUNDARY_RIGHT) { x = BOUNDARY_RIGHT - radius; cvx = -Math.abs(cvx) * WALL_RESTITUTION; }
      if (y - radius < BOUNDARY_TOP && !(x > GOAL_LEFT && x < GOAL_RIGHT)) { 
        y = BOUNDARY_TOP + radius; cvy = Math.abs(cvy) * WALL_RESTITUTION; 
      }
      if (y + radius > BOUNDARY_BOTTOM && !(x > GOAL_LEFT && x < GOAL_RIGHT)) { 
        y = BOUNDARY_BOTTOM - radius; cvy = -Math.abs(cvy) * WALL_RESTITUTION; 
      }
    }
    
    return { x, y, vx: cvx, vy: cvy, willScore, dangerZone };
  }, []);

  // Simula un tiro y predice si resultará en gol
  const simulateShot = useCallback((
    fromX: number, fromY: number, 
    targetX: number, targetY: number, 
    power: number,
    playerChips: MovingChip[]
  ): { willScore: boolean; blocked: boolean; finalPos: { x: number; y: number } } => {
    const dx = targetX - fromX;
    const dy = targetY - fromY;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * power;
    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed;
    
    // Simular la trayectoria
    let x = fromX, y = fromY;
    let cvx = vx, cvy = vy;
    let blocked = false;
    
    for (let step = 0; step < 60; step++) {
      cvx *= BALL_FRICTION;
      cvy *= BALL_FRICTION;
      
      if (Math.hypot(cvx, cvy) < EPSILON) break;
      
      x += cvx;
      y += cvy;
      
      // Verificar si un defensor bloquea
      for (const player of playerChips) {
        const distToPlayer = Math.hypot(x - player.x, y - player.y);
        if (distToPlayer < CHIP_RADIUS + BALL_RADIUS + 5) {
          blocked = true;
          break;
        }
      }
      if (blocked) break;
      
      // Verificar gol
      if (y + BALL_RADIUS > BOUNDARY_BOTTOM && x > GOAL_LEFT && x < GOAL_RIGHT) {
        return { willScore: true, blocked: false, finalPos: { x, y } };
      }
      
      // Rebotes
      if (x - BALL_RADIUS < BOUNDARY_LEFT || x + BALL_RADIUS > BOUNDARY_RIGHT) {
        cvx = -cvx * WALL_RESTITUTION;
      }
      if (y - BALL_RADIUS < BOUNDARY_TOP || y + BALL_RADIUS > BOUNDARY_BOTTOM) {
        if (!(x > GOAL_LEFT && x < GOAL_RIGHT)) {
          cvy = -cvy * WALL_RESTITUTION;
        }
      }
    }
    
    return { willScore: false, blocked, finalPos: { x, y } };
  }, []);

  // Función para predecir dónde estará la pelota con análisis de peligro
  const predictBallPosition = useCallback((frames: number = 25) => {
    const ball = ballRef.current;
    return simulateTrajectory(ball.x, ball.y, ball.vx, ball.vy, frames, true);
  }, [simulateTrajectory]);

  // Evalúa qué tan peligrosa es una posición para el bot - MEJORADA
  const evaluateDanger = useCallback((ballX: number, ballY: number, playerChips: MovingChip[], ballVx: number = 0, ballVy: number = 0): number => {
    let danger = 0;
    
    // 1. Peligro por cercanía al arco del bot (zona crítica)
    const distToOurGoal = Math.hypot(ballX - 300, ballY - 50);
    if (distToOurGoal < 250) {
      danger += (250 - distToOurGoal) * 3; // Multiplicador alto
    }
    
    // 2. Peligro EXTREMO si la pelota está en el área chica
    if (ballY < 150 && ballX > 180 && ballX < 420) {
      danger += 200;
    }
    
    // 3. Peligro si la pelota viene hacia nuestro arco
    if (ballVy < -2) {
      danger += Math.abs(ballVy) * 15; // Velocidad hacia arriba = peligro
      
      // Predecir si va a ser gol
      const prediction = simulateTrajectory(ballX, ballY, ballVx, ballVy, 50, true);
      if (prediction.willScore) {
        danger += 300; // MÁXIMO PELIGRO
      }
    }
    
    // 4. Peligro si hay jugadores cerca de la pelota en nuestra mitad
    playerChips.forEach(player => {
      const distToBall = Math.hypot(player.x - ballX, player.y - ballY);
      if (distToBall < 120) {
        const proximityDanger = (120 - distToBall) * 2;
        // Más peligroso si el jugador está en posición de tiro
        if (player.y < FIELD_HEIGHT * 0.5) {
          danger += proximityDanger * 1.5;
        } else {
          danger += proximityDanger;
        }
      }
    });
    
    // 5. Más peligro si la pelota está en nuestra mitad
    if (ballY < FIELD_HEIGHT / 2) {
      danger += 80;
    }
    
    // 6. Peligro adicional si estamos perdiendo (más presión)
    const scoreDiff = myScore - botScore;
    if (scoreDiff > 0) {
      danger += scoreDiff * 20; // Más urgencia si vamos perdiendo
    }
    
    return danger;
  }, [simulateTrajectory, myScore, botScore]);

  // Evalúa qué tan buena es una oportunidad de gol
  const evaluateGoalOpportunity = useCallback((
    chipX: number, chipY: number, 
    playerChips: MovingChip[]
  ): { score: number; bestAngle: number; targetX: number } => {
    const goalCenterX = 300;
    const goalY = BOUNDARY_BOTTOM;
    
    // Calcular ángulo al centro del arco
    const angleToGoal = Math.atan2(goalY - chipY, goalCenterX - chipX);
    const distToGoal = Math.hypot(goalCenterX - chipX, goalY - chipY);
    
    // Encontrar el mejor punto del arco (menos defendido)
    let bestScore = -Infinity;
    let bestTargetX = goalCenterX;
    
    for (let targetX = GOAL_LEFT + 20; targetX <= GOAL_RIGHT - 20; targetX += 20) {
      let pointScore = 100;
      
      // Penalizar si hay defensores en el camino
      playerChips.forEach(player => {
        const dx = targetX - chipX;
        const dy = goalY - chipY;
        const len = Math.hypot(dx, dy);
        
        // Distancia del defensor a la línea de tiro
        const t = Math.max(0, Math.min(1, ((player.x - chipX) * dx + (player.y - chipY) * dy) / (len * len)));
        const projX = chipX + t * dx;
        const projY = chipY + t * dy;
        const distToLine = Math.hypot(player.x - projX, player.y - projY);
        
        if (distToLine < 60 && t > 0 && t < 1) {
          pointScore -= (60 - distToLine) * 2;
        }
      });
      
      // Bonus por estar cerca del centro del arco
      pointScore += 20 - Math.abs(targetX - goalCenterX) * 0.2;
      
      if (pointScore > bestScore) {
        bestScore = pointScore;
        bestTargetX = targetX;
      }
    }
    
    // Ajustar puntuación por distancia
    const distanceScore = Math.max(0, 400 - distToGoal) * 0.5;
    
    return {
      score: bestScore + distanceScore,
      bestAngle: Math.atan2(goalY - chipY, bestTargetX - chipX),
      targetX: bestTargetX
    };
  }, []);

  // Sistema de decisión principal del bot con variedad y personalidad adaptativa
  const makeDecision = useCallback((): {
    action: 'shoot' | 'pass' | 'clear' | 'intercept' | 'position';
    chip: MovingChip;
    targetX: number;
    targetY: number;
    power: number;
    confidence: number;
  } => {
    const botChips = chipsRef.current.filter(c => c.owner === "challenger");
    const playerChips = chipsRef.current.filter(c => c.owner === "creator");
    const ball = ballRef.current;
    const predictedBall = predictBallPosition(20);
    
    // Actualizar estado emocional
    updateBotMood();
    
    // Evaluar situación general con velocidad de la pelota
    const currentDanger = evaluateDanger(ball.x, ball.y, playerChips, ball.vx, ball.vy);
    const predictedDanger = evaluateDanger(predictedBall.x, predictedBall.y, playerChips, predictedBall.vx, predictedBall.vy);
    
    // Detectar si la pelota viene hacia nuestro arco
    const ballComingToUs = ball.vy < -3;
    const ballInDangerZone = predictedBall.dangerZone || ball.y < FIELD_HEIGHT * 0.35;
    
    // ===== SISTEMA DE PERSONALIDAD ADAPTATIVA MEJORADO =====
    const scoreDiff = botScore - myScore;
    const mood = botMoodRef.current;
    const style = preferredStyleRef.current;
    const stats = botStatsRef.current;
    
    // Calcular tiempo de partido (basado en goles totales)
    const totalGoals = myScore + botScore;
    const isLateGame = totalGoals >= Math.floor(goalTarget * 0.7);
    const isCloseGame = Math.abs(scoreDiff) <= 1;
    
    // Determinar personalidad basada en múltiples factores
    if (scoreDiff >= 3) {
      botPersonalityRef.current = 'parking_bus'; // Muy defensivo, solo contraataques
    } else if (scoreDiff >= 2) {
      botPersonalityRef.current = 'defensive';
    } else if (scoreDiff <= -3 || (mood === 'desperate' && scoreDiff < 0)) {
      botPersonalityRef.current = 'ultra_aggressive'; // Todo o nada
    } else if (scoreDiff <= -2 || mood === 'frustrated') {
      botPersonalityRef.current = 'aggressive';
    } else if (isLateGame && scoreDiff > 0) {
      botPersonalityRef.current = 'defensive'; // Proteger ventaja
    } else if (isLateGame && scoreDiff < 0) {
      botPersonalityRef.current = 'aggressive'; // Necesita remontar
    } else {
      botPersonalityRef.current = 'balanced';
    }
    
    const personality = botPersonalityRef.current;
    
    // ===== MODIFICADORES DE DECISIÓN SEGÚN PERSONALIDAD =====
    let shootBias = 0;
    let passBias = 0;
    let clearBias = 0;
    let riskTolerance = 0.5; // 0 = muy conservador, 1 = muy arriesgado
    
    switch (personality) {
      case 'ultra_aggressive':
        shootBias = 100;
        passBias = -30;
        clearBias = -50;
        riskTolerance = 0.9;
        break;
      case 'aggressive':
        shootBias = 60;
        passBias = 0;
        clearBias = -20;
        riskTolerance = 0.7;
        break;
      case 'balanced':
        shootBias = 20;
        passBias = 20;
        clearBias = 0;
        riskTolerance = 0.5;
        break;
      case 'defensive':
        shootBias = -20;
        passBias = 30;
        clearBias = 40;
        riskTolerance = 0.3;
        break;
      case 'parking_bus':
        shootBias = -50;
        passBias = 10;
        clearBias = 80;
        riskTolerance = 0.1;
        break;
    }
    
    // Ajustar según estado emocional
    if (mood === 'confident') {
      shootBias += 20;
      riskTolerance += 0.1;
    } else if (mood === 'frustrated') {
      // Más impredecible cuando está frustrado
      shootBias += (Math.random() - 0.5) * 60;
      riskTolerance += 0.2;
    } else if (mood === 'desperate') {
      shootBias += 50;
      riskTolerance = 0.95;
    }
    
    // Ajustar según estilo preferido
    if (style === 'direct') {
      shootBias += 30;
    } else if (style === 'passing') {
      passBias += 40;
      shootBias -= 20;
    } else if (style === 'counter') {
      clearBias += 20;
      // Bonus a tiros después de recuperar
      if (stats.interceptions > 0) shootBias += 25;
    }
    
    // Añadir factor aleatorio para variedad (el bot no siempre hace lo "óptimo")
    const randomVariance = (Math.random() - 0.5) * 40;
    shootBias += randomVariance;
    passBias += randomVariance * 0.5;
    
    let bestDecision = {
      action: 'shoot' as const,
      chip: botChips[0],
      targetX: 300,
      targetY: BOUNDARY_BOTTOM,
      power: 0.7,
      confidence: 0
    };
    
    // PRIORIDAD MÁXIMA: Si la pelota va a ser gol, interceptar inmediatamente
    if (predictedBall.willScore || currentDanger > 250) {
      const closestToBall = botChips.reduce((closest, c) => {
        const d = Math.hypot(c.x - ball.x, c.y - ball.y);
        return d < Math.hypot(closest.x - ball.x, closest.y - ball.y) ? c : closest;
      }, botChips[0]);
      
      return {
        action: 'intercept' as const,
        chip: closestToBall,
        targetX: predictedBall.x,
        targetY: Math.max(BOUNDARY_TOP + 50, predictedBall.y - 30),
        power: 0.9,
        confidence: 999 // Máxima prioridad
      };
    }
    
    // Evaluar cada ficha del bot
    botChips.forEach(chip => {
      const distToBall = Math.hypot(chip.x - ball.x, chip.y - ball.y);
      const distToPredicted = Math.hypot(chip.x - predictedBall.x, chip.y - predictedBall.y);
      
      // ===== OPCIÓN 1: TIRO A GOL CON SIMULACIÓN =====
      const goalOpp = evaluateGoalOpportunity(chip.x, chip.y, playerChips);
      let shootScore = goalOpp.score;
      
      // Simular el tiro para ver si tiene probabilidad de gol
      const shotSimulation = simulateShot(
        chip.x, chip.y, 
        goalOpp.targetX, BOUNDARY_BOTTOM + 10,
        0.8, playerChips
      );
      
      // Gran bonus si la simulación predice gol (priorizar estos tiros)
      if (shotSimulation.willScore) {
        shootScore += 220;
        // Preferir potencia alta en tiros con probabilidad de gol
        // (se ajustará más abajo al decidir power)
      }
      // Penalizar fuertemente si será bloqueado (solo menos si somos muy arriesgados)
      if (shotSimulation.blocked) {
        shootScore -= 150 * (1 - riskTolerance * 0.6);
      }
      
      // Bonus si estamos en posición ofensiva
      if (chip.y > FIELD_HEIGHT * 0.5) shootScore += 60;
      if (chip.y > FIELD_HEIGHT * 0.7) shootScore += 100;
      
      // Penalizar si estamos muy lejos (menos si somos agresivos)
      const distToGoal = Math.hypot(chip.x - 300, chip.y - BOUNDARY_BOTTOM);
      if (distToGoal > 450) shootScore -= 120 * (1 - riskTolerance * 0.3);
      
      // APLICAR MODIFICADOR DE PERSONALIDAD
      shootScore += shootBias;
      
      // Variedad: a veces intentar tiros "imposibles" si está frustrado
      if (mood === 'frustrated' && Math.random() < 0.3) {
        shootScore += 50; // Intenta algo diferente
      }
      
      if (shootScore > bestDecision.confidence) {
        // Potencia variable según personalidad
        let power = Math.min(1, Math.max(0.6, distToGoal / 450));
        if (personality === 'ultra_aggressive') power = Math.min(1, power + 0.2);
        if (mood === 'desperate') power = 1; // Tiros con máxima potencia
        
        bestDecision = {
          action: 'shoot',
          chip,
          targetX: goalOpp.targetX,
          targetY: BOUNDARY_BOTTOM + 20,
          power,
          confidence: shootScore
        };
      }
      
      // ===== OPCIÓN 2: PASE A COMPAÑERO =====
      botChips.forEach(teammate => {
        if (teammate.id === chip.id) return;
        
        const distToTeammate = Math.hypot(chip.x - teammate.x, chip.y - teammate.y);
        if (distToTeammate > 300 || distToTeammate < 50) return;
        
        let passScore = 50;
        
        // Mejor si el compañero está más adelantado
        if (teammate.y > chip.y) passScore += (teammate.y - chip.y) * 0.4;
        
        // Mejor si el compañero tiene mejor oportunidad de gol
        const teammateGoalOpp = evaluateGoalOpportunity(teammate.x, teammate.y, playerChips);
        passScore += teammateGoalOpp.score * 0.6;
        
        // Simular si el pase llegaría (usamos la misma simulación simplificada)
        const passSimulation = simulateShot(chip.x, chip.y, teammate.x, teammate.y, 0.5, playerChips);
        if (passSimulation.blocked) {
          // Penalizamos, pero menos si somos arriesgados
          passScore -= 90 * (1 - riskTolerance * 0.5);
        }
        
        // Penalizar si hay defensores en el camino
        playerChips.forEach(player => {
          const dx = teammate.x - chip.x;
          const dy = teammate.y - chip.y;
          const len = Math.hypot(dx, dy);
          const t = Math.max(0, Math.min(1, ((player.x - chip.x) * dx + (player.y - chip.y) * dy) / (len * len)));
          const projX = chip.x + t * dx;
          const projY = chip.y + t * dy;
          const distToLine = Math.hypot(player.x - projX, player.y - projY);
          
          if (distToLine < 50 && t > 0 && t < 1) {
            passScore -= 70;
          }
        });
        
        // APLICAR MODIFICADOR DE PERSONALIDAD
        passScore += passBias;
        
        // Pases más creativos si estilo es "passing"
        if (style === 'passing') {
          // Considerar pases hacia atrás para reorganizar
          if (teammate.y < chip.y && personality !== 'ultra_aggressive') {
            passScore += 30; // Pases de seguridad
          }
        }
        
        if (passScore > bestDecision.confidence) {
          bestDecision = {
            action: 'pass',
            chip,
            targetX: teammate.x + (teammate.y > chip.y ? 0 : (Math.random() - 0.5) * 40),
            targetY: teammate.y + 20,
            power: Math.min(0.8, distToTeammate / 300),
            confidence: passScore
          };
        }
      });
      
      // ===== OPCIÓN 3: DESPEJE DEFENSIVO =====
      if (chip.y < FIELD_HEIGHT * 0.45 || currentDanger > 80 || ballInDangerZone) {
        let clearScore = currentDanger * 0.9 + predictedDanger * 0.5;
        
        // Muy importante si la pelota está cerca de nuestro arco
        if (ball.y < 200) clearScore += 180;
        if (ball.y < 120) clearScore += 100; // Área chica = máxima urgencia
        
        // APLICAR MODIFICADOR DE PERSONALIDAD
        clearScore += clearBias;
        
        // Bonus si somos la ficha más cercana a la pelota
        const closestBot = botChips.reduce((closest, c) => {
          const d = Math.hypot(c.x - ball.x, c.y - ball.y);
          return d < Math.hypot(closest.x - ball.x, closest.y - ball.y) ? c : closest;
        }, botChips[0]);
        
        if (chip.id === closestBot.id) clearScore += 50;
        
        if (clearScore > bestDecision.confidence) {
          const side = chip.x < FIELD_WIDTH / 2 ? 1 : -1;
          // Dirección del despeje varía según personalidad
          const clearY = personality === 'parking_bus' ? FIELD_HEIGHT * 0.5 : FIELD_HEIGHT * 0.7;
          bestDecision = {
            action: 'clear',
            chip,
            targetX: FIELD_WIDTH / 2 + side * 150,
            targetY: clearY,
            power: mood === 'desperate' ? 1 : 0.9,
            confidence: clearScore
          };
        }
      }
      
      // ===== OPCIÓN 4: INTERCEPTAR =====
      // Si la pelota viene hacia nosotros, intentar interceptar
      if (ball.vy < -2 && distToPredicted < 150) {
        let interceptScore = 80 + (150 - distToPredicted);
        
        // Ajustar según personalidad
        if (personality === 'defensive' || personality === 'parking_bus') {
          interceptScore += 40; // Más dispuesto a interceptar
        }
        
        if (interceptScore > bestDecision.confidence) {
          bestDecision = {
            action: 'intercept',
            chip,
            targetX: predictedBall.x,
            targetY: predictedBall.y,
            power: 0.6,
            confidence: interceptScore
          };
        }
      }
      
      // ===== OPCIÓN 5: POSICIONAMIENTO (SI NO HAY BUENAS OPCIONES) =====
      if (bestDecision.confidence < 30 && Math.random() < 0.4) {
        // Moverse a una mejor posición en lugar de forzar una jugada mala
        const idealY = personality === 'defensive' ? FIELD_HEIGHT * 0.3 : FIELD_HEIGHT * 0.5;
        const idealX = chip.x < FIELD_WIDTH/2 ? 200 : 400;
        
        if (Math.hypot(chip.x - idealX, chip.y - idealY) > 100) {
          bestDecision = {
            action: 'position',
            chip,
            targetX: idealX,
            targetY: idealY,
            power: 0.4,
            confidence: 25
          };
        }
      }
    });
    
    // Actualizar mood después de cada decisión
    updateBotMood();
    
    return bestDecision;
  }, [myScore, botScore, predictBallPosition, evaluateDanger, evaluateGoalOpportunity, simulateShot, updateBotMood]);

  // EXIT handlers
  const handleExitRequest = () => setShowExitConfirm(true);
  const handleExitConfirm = () => { setShowExitConfirm(false); setView("home"); };
  const handleExitCancel = () => setShowExitConfirm(false);

  const momentum = myScore - botScore;
  const momentumPercent = 50 + (momentum / Math.max(1, goalTarget)) * 50;
  const recomputeBotAggression = () => {
    const stats = botStatsRef.current;
    const scoreDiff = myScore - botScore;
    const pressure = stats.conceded - stats.goals;
    // Modo equilibrado: agresividad media que se adapta al marcador y a la presión
    let value = 0.65 + scoreDiff * 0.05 + pressure * 0.04;
    if (botScore > myScore + 1) {
      // Si va muy arriba en el marcador, baja un poco la agresividad
      value -= 0.08;
    }
    botAggressionRef.current = clamp(value, 0.35, 0.9);
  };

  // Función para el disparo del bot con IA avanzada
  const botShoot = useCallback(() => {
    const botChips = chipsRef.current.filter(c => c.owner === "challenger");
    
    if (botChips.length === 0) return;

    // Usar el sistema de decisión de IA
    const decision = makeDecision();
    
    // Añadir variación humana (pequeños errores aleatorios)
    // Reducir error cuando la confianza de la decisión es alta
    const confidenceFactor = Math.min(1, Math.max(0, (decision.confidence || 0) / 300));
    const baseError = 0.05 + Math.random() * 0.06; // base 5-11%
    const humanError = Math.max(0.02, baseError * (1 - confidenceFactor * 0.7));
    const errorAngle = (Math.random() - 0.5) * humanError * Math.PI;
    
    // Calcular dirección base
    const dx = decision.targetX - decision.chip.x;
    const dy = decision.targetY - decision.chip.y;
    const baseAngle = Math.atan2(dy, dx);
    const distance = Math.hypot(dx, dy) || 1;
    
    // Aplicar error según la acción
    let finalAngle = baseAngle;
    let finalPower = decision.power;
    
    switch (decision.action) {
      case 'shoot':
        // Tiros tienen menos error cuando están cerca del arco
        const distToGoal = Math.hypot(decision.chip.x - 300, decision.chip.y - BOUNDARY_BOTTOM);
        const shootError = errorAngle * (distToGoal / 400);
        finalAngle = baseAngle + shootError;
        finalPower = Math.max(0.6, decision.power);
        break;
        
      case 'pass':
        // Pases tienen error moderado
        finalAngle = baseAngle + errorAngle * 0.5;
        finalPower = Math.min(0.75, decision.power);
        break;
        
      case 'clear':
        // Despejes son más potentes pero menos precisos
        finalAngle = baseAngle + errorAngle * 0.7;
        finalPower = Math.max(0.8, decision.power);
        break;
        
      case 'intercept':
        // Intercepciones son precisas pero suaves
        finalAngle = baseAngle + errorAngle * 0.3;
        finalPower = 0.5 + Math.random() * 0.2;
        break;
        
      case 'position':
        // Movimientos de posicionamiento son suaves y precisos
        finalAngle = baseAngle + errorAngle * 0.2;
        finalPower = Math.min(0.5, decision.power);
        break;
    }
    
    // Calcular velocidad final
    const speed = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * finalPower;
    const vx = Math.cos(finalAngle) * speed;
    const vy = Math.sin(finalAngle) * speed;
    
    // Aplicar movimiento a la ficha elegida
    chipsRef.current = chipsRef.current.map(chip =>
      chip.id === decision.chip.id ? { ...chip, vx, vy } : chip
    );
    
    setChips([...chipsRef.current]);
    turnTakenRef.current = true;
    
    // Actualizar estadísticas
    const stats = botStatsRef.current;
    if (decision.action === 'shoot') {
      stats.shots += 1;
      // Si está apuntando hacia la portería, contar como tiro a puerta
      if (decision.targetX > GOAL_LEFT && decision.targetX < GOAL_RIGHT && 
          decision.targetY > FIELD_HEIGHT * 0.8) {
        stats.shotsOnTarget += 1;
      }
    } else if (decision.action === 'pass') {
      stats.passes += 1;
      // Asumimos éxito inicialmente, se ajustará si el oponente intercepta
      stats.successfulPasses += 1;
    } else if (decision.action === 'intercept') {
      stats.interceptions += 1;
    }
    
    // Guardar en historial para aprendizaje
    playHistoryRef.current.push({
      action: decision.action === 'intercept' ? 'clear' : (decision.action === 'position' ? 'pass' : decision.action),
      success: true, // Se actualizará después según resultado
      position: { x: decision.chip.x, y: decision.chip.y }
    });
    
    // Limitar historial a últimas 20 jugadas
    if (playHistoryRef.current.length > 20) {
      playHistoryRef.current.shift();
    }
  }, [makeDecision]);

  // RESET campo (compatible)
  const resetField = useCallback((scorer: "you" | "bot") => {
    // 1. Resetear fichas y pelota
    chipsRef.current = [...initPlayerChips(), ...initBotChips()];
    ballRef.current = initBall();
    
    // 2. Actualizar estados
    setChips([...chipsRef.current]);
    setBall({...ballRef.current});
    
    // 3. Resetear estado del juego
    turnTakenRef.current = false;
    turnStartTimeRef.current = Date.now();
    goalScoredRef.current = false;
    setGoalAnimation(null);
    setTurnLostAnimation(false);
    setTurnTimeLeft(TURN_TIME);
    
    // 4. Establecer el jugador activo
    if (scorer === "you") {
      // No establecer el turno aquí, lo haremos después en showGoalAnim
    } else {
      setActive("creator");
      setSelectedChipId("you-1");
    }
  }, []);

  const showGoalAnim = useCallback((scorer: "you" | "bot") => {
    setGoalAnimation(scorer);
    
    setTimeout(() => {
      setGoalAnimation(null);
      const stats = botStatsRef.current;
      if (scorer === "bot") {
        stats.goals += 1;
      } else {
        stats.conceded += 1;
      }
      recomputeBotAggression();

      // 1. Primero reiniciamos el campo
      resetField(scorer);
      
      // 2. Si el jugador anotó, el bot debe tirar
      if (scorer === "you") {
        // Pequeño retraso para asegurar que el estado se actualice
        setTimeout(() => {
          // Asegurarse de que el turno esté configurado para el bot
          setActive("challenger");
          setSelectedChipId("bot-1");
          turnTakenRef.current = false;
          
          // Pequeño retraso antes de disparar
          setTimeout(() => {
            botShoot();
          }, 100);
        }, 300);
      }
    }, 1500);
  }, [resetField, botShoot]);

  const showTurnLost = useCallback(() => {
    setTurnLostAnimation(true);
    setTimeout(() => setTurnLostAnimation(false), 1200);
  }, []);

  // Helper: ¿hay movimiento?
  const isMoving = useCallback(() => {
    return chipsRef.current.some((c) => mag(c.vx, c.vy) > EPSILON) ||
           mag(ballRef.current.vx, ballRef.current.vy) > EPSILON;
  }, []);

  /* =========================
     BOT AI (moved to the top to avoid reference issues)
     ========================= */

  /* =========================
     SIM LOOP
     ========================= */
  useEffect(() => {
    let last = performance.now();

    const loop = () => {
      const now = performance.now();
      const dt = (now - last) / 16.6667; // ~frames ratio
      last = now;

      // Si animación de goal o end, no simular (pero mantener loop)
      if (goalAnimation || showEnd || turnLostAnimation) {
        simRef.current = requestAnimationFrame(loop);
        return;
      }

      // Ejecutar pasos físicos (sub-step hasta 3 para estabilidad)
      for (let step = 0; step < Math.min(3, Math.ceil(dt)); step++) {
        const currentChips = chipsRef.current.map(c => ({ ...c }));
        const currentBall = { ...ballRef.current };

        // Mover entidades
        const movedChips = currentChips.map(c => stepEntity(c, false));
        const movedBall = stepEntity(currentBall, true);

        // Colisiones entre fichas (ninguna es pelota)
        for (let i = 0; i < movedChips.length; i++) {
          for (let j = i + 1; j < movedChips.length; j++) {
            handleCollision(movedChips[i], movedChips[j], false, false);
          }
          // Colisión ficha con pelota (segundo es pelota)
          handleCollision(movedChips[i], movedBall, false, true);
        }

        // Actualizar refs (copia)
        chipsRef.current = movedChips;
        ballRef.current = movedBall;
      }

      // Comprobar goles (con debouncing via goalScoredRef)
      const b = ballRef.current;
      if (!goalScoredRef.current) {
        if (b.y < BOUNDARY_TOP - 10 && b.x > GOAL_LEFT && b.x < GOAL_RIGHT) {
          goalScoredRef.current = true;
          const newScore = myScore + 1;
          setMyScore(newScore);
          if (newScore >= goalTarget) { 
            setWinner("you"); 
            setShowEnd(true);
          }
          else { showGoalAnim("you"); }
        } else if (b.y > BOUNDARY_BOTTOM + 10 && b.x > GOAL_LEFT && b.x < GOAL_RIGHT) {
          goalScoredRef.current = true;
          const newScore = botScore + 1;
          setBotScore(newScore);
          if (newScore >= goalTarget) { 
            setWinner("bot"); 
            setShowEnd(true);
          }
          else { showGoalAnim("bot"); }
        }
      }

      // Timeout - pierde turno si no movió y no hay movimiento
      if (turnTimeLeft <= 0 && !turnTakenRef.current && !isMoving() && !goalScoredRef.current) {
        if (active === "creator") showTurnLost();
        turnTakenRef.current = true;
      }

      // Cambiar turno si no hay movimiento y ya se tomó turno
      if (!isMoving() && turnTakenRef.current && !goalScoredRef.current) {
        if (active === "creator") {
          setActive("challenger");
          setSelectedChipId("bot-1");
          turnTakenRef.current = false;
          turnStartTimeRef.current = Date.now();
          // Bot dispara luego de un pequeño delay
          setTimeout(() => { if (!goalScoredRef.current) botShoot(); }, 600);
        } else {
          setActive("creator");
          setSelectedChipId("you-1");
          turnTakenRef.current = false;
          turnStartTimeRef.current = Date.now();
        }
      }

      // Propagar estado a React (solo shallow copies para evitar re-renders innecesarios)
      setChips(chipsRef.current.map(c => ({ ...c })));
      setBall({ ...ballRef.current });

      simRef.current = requestAnimationFrame(loop);
    };

    simRef.current = requestAnimationFrame(loop);
    return () => { if (simRef.current) cancelAnimationFrame(simRef.current); };
  }, [active, goalAnimation, showEnd, turnLostAnimation, myScore, botScore, goalTarget, isMoving, botShoot, showGoalAnim, showTurnLost]);

  /* =========================
     TEMPORIZADOR DE TURNO
     ========================= */
  const [turnTimeLeft, setTurnTimeLeft] = useState(TURN_TIME);
  const turnTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Efecto para el temporizador
  useEffect(() => {
    // Limpiar temporizador anterior si existe
    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current);
    }

    // Solo iniciar el temporizador si es el turno del jugador y no hay animaciones
    if (active === "creator" && !goalAnimation && !showEnd && !turnLostAnimation) {
      const startTime = Date.now();
      setTurnTimeLeft(TURN_TIME);
      
      turnTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, TURN_TIME - elapsed);
        setTurnTimeLeft(remaining);
        
        if (remaining <= 0) {
          clearInterval(turnTimerRef.current!);
          showTurnLost();
        }
      }, 50);
    }

    // Limpieza al desmontar o cuando cambien las dependencias
    return () => {
      if (turnTimerRef.current) {
        clearInterval(turnTimerRef.current);
      }
    };
  }, [active, goalAnimation, showEnd, turnLostAnimation, showTurnLost]);

  /* =========================
     INPUT HANDLERS (pointer)
     - compatibles con PitchCanvas handlers previos
     ========================= */
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (active !== "creator" || turnTakenRef.current || isMoving()) return;

    // Prevenir comportamientos del navegador y capturar el pointer
    e.preventDefault();
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * FIELD_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * FIELD_HEIGHT;

    const playerChips = chipsRef.current.filter((c) => c.owner === "creator");
    const touched = playerChips.find((c) => Math.hypot(c.x - x, c.y - y) <= c.radius + 15);

    if (touched) {
      setSelectedChipId(touched.id);
      dragRef.current = { chipId: touched.id, start: { x: touched.x, y: touched.y } };
      setAim({ from: { x: touched.x, y: touched.y }, to: { x, y } });
      setShowPowerMeter({ x: touched.x, y: touched.y });
      setShotPower(0);
      (globalThis as Record<string, unknown>).shotPower = 0;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    
    e.preventDefault();
    
    const rect = e.currentTarget.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * FIELD_WIDTH;
    let y = ((e.clientY - rect.top) / rect.height) * FIELD_HEIGHT;
    const { start } = dragRef.current;

    let dist = Math.hypot(x - start.x, y - start.y);
    if (dist > MAX_DRAG_DISTANCE) {
      const a = Math.atan2(y - start.y, x - start.x);
      x = start.x + Math.cos(a) * MAX_DRAG_DISTANCE;
      y = start.y + Math.sin(a) * MAX_DRAG_DISTANCE;
      dist = MAX_DRAG_DISTANCE;
    }

    // Calcular powerScale con una curva más suave para mejor control
    const rawPower = dist / (MAX_DRAG_DISTANCE * 0.7);
    const powerScale = Math.min(1, rawPower * rawPower);  // Curva cuadrática para mejor control
    // Update both state and ref for immediate access
    setShotPower(powerScale);
    (globalThis as Record<string, any>).currentShotPower = powerScale;
    (globalThis as Record<string, unknown>).shotPower = powerScale; // Para PitchCanvas
    
    setAim((prev) => (prev ? { ...prev, to: { x, y } } : undefined));

    if (showPowerMeter) setShowPowerMeter({ x: start.x, y: start.y });
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current || active !== "creator" || turnTakenRef.current) {
      dragRef.current = null;
      setAim(undefined);
      setShowPowerMeter(null);
      setShotPower(0);
      (globalThis as Record<string, unknown>).shotPower = 0;
      return;
    }

    (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);

    const rect = e.currentTarget.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * FIELD_WIDTH;
    let y = ((e.clientY - rect.top) / rect.height) * FIELD_HEIGHT;
    const { chipId, start } = dragRef.current;

    let dist = Math.hypot(x - start.x, y - start.y);
    if (dist > MAX_DRAG_DISTANCE) {
      const a = Math.atan2(y - start.y, x - start.x);
      x = start.x + Math.cos(a) * MAX_DRAG_DISTANCE;
      y = start.y + Math.sin(a) * MAX_DRAG_DISTANCE;
      dist = MAX_DRAG_DISTANCE;
    }

    // === SISTEMA DE POTENCIA LINEAL ===
    // La potencia es directamente proporcional a la longitud del arrastre
    // 0% arrastre = 0 velocidad, 100% arrastre = MAX_SPEED (36)
    const normalizedDist = Math.min(1, dist / MAX_DRAG_DISTANCE);
    
    // Potencia lineal: velocidad = porcentaje * MAX_SPEED
    const targetSpeed = normalizedDist * MAX_SPEED;
    
    // Calcular dirección normalizada
    const dirX = start.x - x;
    const dirY = start.y - y;
    const dirMag = Math.hypot(dirX, dirY) || 1;
    
    // Aplicar velocidad en la dirección del arrastre
    const dx = (dirX / dirMag) * targetSpeed;
    const dy = (dirY / dirMag) * targetSpeed;

    // Umbral ligeramente más bajo para permitir tiros más suaves
    if (Math.hypot(dx, dy) > 0.3) {
      // Actualizar solo la ficha objetivo de forma inmutable
      chipsRef.current = chipsRef.current.map((c) => c.id === chipId ? { ...c, vx: dx, vy: dy } : c);
      turnTakenRef.current = true;
    }

    // limpiar estados
    dragRef.current = null;
    setAim(undefined);
    setShowPowerMeter(null);
    setShotPower(0);
    (globalThis as Record<string, unknown>).shotPower = 0;
  };

  const handlePointerCancel = () => {
    dragRef.current = null;
    setAim(undefined);
    setShowPowerMeter(null);
    setShotPower(0);
    (globalThis as Record<string, unknown>).shotPower = 0;
  };

  const turnLabel = active === "creator" ? "TU TURNO" : "TURNO BOT";
  const isPlayerTurn = active === "creator";

  /* =========================
     RENDER
     ========================= */
  return (
    <div className="playing-screen">
      <div className="playing-hud">
        <div className="hud-header">
          <button className="exit-btn" onClick={handleExitRequest}>✕</button>
          <span className="hud-title">VS BOT</span>
        </div>

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
                width: `${(turnTimeLeft / TURN_TIME) * 100}%`,
                backgroundColor: turnTimeLeft < 3000 ? 'var(--accent-red)' : 'var(--neon-green)'
              }} 
            />
          </div>
          <span className="timer-label">
            {active === "creator" ? 'TU TURNO' : 'TURNO BOT'}
          </span>
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
          shotPower={shotPower}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
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
  
  {showPowerMeter && (
    <g>
      <line
        x1={showPowerMeter.x}
        y1={showPowerMeter.y - 40}
        x2={showPowerMeter.x + 100 * (shotPower || 0)}
        y2={showPowerMeter.y - 40}
        stroke="white"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </g>
  )}
</div>
);
}
