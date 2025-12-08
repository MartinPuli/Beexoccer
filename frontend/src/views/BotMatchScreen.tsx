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
   FÍSICA / TUNING
   ========================= */
const FRICTION = 0.96;  // Aumentado ligeramente para más deslizamiento
const EPSILON = 0.1;    // Reducido para detección de parada más sensible
const POWER = 0.3;      // Aumentado para mejor respuesta
const MAX_SPEED = 15;   // Aumentado para mayor velocidad máxima
const MAX_DRAG_DISTANCE = 300;  // Reducido para mejor control
const TURN_TIME = 10000;

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
   INITS
   ========================= */
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
   REFLECT EN BORDES (GOLES)
   ========================= */
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

/* =========================
   COLISIONES
   - Masa proporcional al área -> evita "saltos" raros
   - Resolución de solapamiento estable
   ========================= */
function massFromRadius(radius: number) {
  // Proporcional a área (pi r^2) pero sin la constante pi para mantener relative scales
  return Math.max(1, radius * radius);
}

function handleCollision(a: MovingChip | BallState, b: MovingChip | BallState) {
  // Evitar NaNs
  a.vx = safeNumber(a.vx);
  a.vy = safeNumber(a.vy);
  b.vx = safeNumber(b.vx);
  b.vy = safeNumber(b.vy);

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const minDist = (a.radius || 7) + (b.radius || 7);
  
  if (dist >= minDist) return; // no colision

  // Normal y tangente
  const nx = dx / dist;
  const ny = dy / dist;

  // Mover fuera de superposición (proporcional a masas)
  const overlap = minDist - dist;
  const ma = massFromRadius(a.radius || 7);
  const mb = massFromRadius(b.radius || 7);
  const total = ma + mb || 1;

  // Separación más estable: mover según la proporción de masas
  const sepA = (overlap * (mb / total)) + 0.001;
  const sepB = (overlap * (ma / total)) + 0.001;

  a.x -= nx * sepA;
  a.y -= ny * sepA;
  b.x += nx * sepB;
  b.y += ny * sepB;

  // Resolución de velocidades: impulso en la normal
  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const velAlongNormal = rvx * nx + rvy * ny;

  // Si ya se separan, no aplicar impulso
  if (velAlongNormal > 0) return;

  // Restitución: pequeño rebote conservando energía parcial
  const restitution = 0.8;

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

  // Limitar velocidades para evitar "explosiones"
  const sa = mag(a.vx, a.vy);
  if (sa > MAX_SPEED) {
    const scale = MAX_SPEED / sa;
    a.vx *= scale;
    a.vy *= scale;
  }
  const sb = mag(b.vx, b.vy);
  if (sb > MAX_SPEED) {
    const scale = MAX_SPEED / sb;
    b.vx *= scale;
    b.vy *= scale;
  }
}

/* =========================
   STEP ENTITY (universal)
   ========================= */
function stepEntity<T extends { x: number; y: number; vx: number; vy: number; radius: number }>(entity: T, isBall: boolean) {
  // Copia por seguridad (llamado desde loop donde se mutan copias)
  const next = { ...entity };

  // Fricción (aplicada exponencialmente)
  next.vx *= FRICTION;
  next.vy *= FRICTION;

  // Normalizar pequeños valores a 0
  if (Math.abs(next.vx) < EPSILON) next.vx = 0;
  if (Math.abs(next.vy) < EPSILON) next.vy = 0;

  // Limitar velocidad
  const speed = mag(next.vx, next.vy);
  if (speed > MAX_SPEED) {
    const s = MAX_SPEED / speed;
    next.vx *= s;
    next.vy *= s;
  }

  // Mover
  next.x += next.vx;
  next.y += next.vy;

  // Seguridad anti-tunneling muy básica: si se salió mucho, clamp a bordes
  reflectInBounds(next, isBall);

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
  });

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
  
  // Analiza la posición de los defensores y el arquero
  const analyzeDefense = useCallback((botChip: MovingChip, playerChips: MovingChip[]) => {
    // Encontrar el arquero (jugador más cercano a su propia área)
    const goalkeeper = [...playerChips].sort(
      (a, b) => (Math.hypot(a.x - 300, a.y - 800) - Math.hypot(b.x - 300, b.y - 800))
    )[0];
    
    // Calcular ángulo desde la posición del bot al arco
    const goalLeft = { x: 220, y: 850 };
    const goalRight = { x: 380, y: 850 };
    
    // Crear múltiples puntos objetivo en el arco
    const goalTargets = Array.from({ length: 9 }, (_, i) => ({
      x: goalLeft.x + (i * (goalRight.x - goalLeft.x) / 8),
      y: goalLeft.y
    }));
    
    // Calcular puntuación para cada punto del arco
    const scoredTargets = goalTargets.map(target => {
      // Distancia al arquero (cuanto más lejos, mejor)
      const goalieDist = Math.hypot(goalkeeper.x - target.x, goalkeeper.y - target.y);
      
      // Ángulo desde la posición del bot
      const angleToTarget = Math.atan2(target.y - botChip.y, target.x - botChip.x);
      
      // Verificar si hay defensores en la línea de tiro
      const defendersInWay = playerChips.filter(player => {
        if (player === goalkeeper) return false;
        
        // Calcular distancia del jugador a la línea de tiro
        const A = { x: botChip.x, y: botChip.y };
        const B = { x: target.x, y: target.y };
        const P = { x: player.x, y: player.y };
        
        // Distancia del punto a la línea (A-B)
        const normalLength = Math.hypot(B.x - A.x, B.y - A.y);
        const distance = Math.abs((P.x - A.x) * (B.y - A.y) - (P.y - A.y) * (B.x - A.x)) / normalLength;
        
        // Verificar si el defensor está en el camino
        const dotProduct = ((P.x - A.x) * (B.x - A.x) + (P.y - A.y) * (B.y - A.y)) / (normalLength * normalLength);
        return distance < 50 && dotProduct > 0 && dotProduct < 1;
      }).length;
      
      // Calcular puntuación (mayor es mejor)
      let score = goalieDist; // Preferir lejos del arquero
      score -= defendersInWay * 100; // Penalizar defensores en el camino
      
      // Preferir tiros con mejor ángulo
      const angleScore = 1 - Math.abs(angleToTarget) / (Math.PI / 2);
      score += angleScore * 50;
      
      return { x: target.x, y: target.y, score };
    });
    
    // Ordenar por puntuación y devolver el mejor
    const bestTarget = [...scoredTargets].sort((a, b) => b.score - a.score)[0];
    
    return {
      target: { x: bestTarget.x, y: bestTarget.y },
      goalkeeperPosition: { x: goalkeeper.x, y: goalkeeper.y }
    };
  }, []);

  // Función para el disparo del bot con IA mejorada
  const botShoot = useCallback(() => {
    console.log("Ejecutando botShoot con IA...");
    
    // Obtener fichas del bot, jugador y la pelota
    const botChips = chipsRef.current.filter(c => c.owner === "challenger");
    const playerChips = chipsRef.current.filter(c => c.owner === "creator");
    const ballPos = { ...ballRef.current };
    
    if (botChips.length === 0) {
      console.log("No hay fichas del bot disponibles");
      return;
    }

    recomputeBotAggression();
    const aggression = botAggressionRef.current;

    // 1. Elegir la mejor ficha para tirar
    // Priorizar fichas más cercanas al área rival y mejor posicionadas
    let bestChip = botChips[0];
    let bestScore = -Infinity;
    let bestAction: 'shoot' | 'pass' | 'clear' = 'shoot';
    let bestTarget = { x: 0, y: 0 };
    let bestPassTargetX: number | null = null;
    let bestPassTargetY: number | null = null;
    
    // Analizar cada ficha del bot
    botChips.forEach(chip => {
      // Calcular puntuación de tiro
      const { target: shootTarget, goalkeeperPosition } = analyzeDefense(chip, playerChips);
      
      // Calcular puntuación de pase a compañeros mejor posicionados
      let bestPassScore = -Infinity;
      let bestPass: MovingChip | null = null;
      
      botChips.forEach(teammate => {
        if (teammate === chip) return;
        
        const distToTeammate = Math.hypot(teammate.x - chip.x, teammate.y - chip.y);
        if (distToTeammate > 300) return; // Pases muy largos son difíciles
        
        // Preferir pases hacia adelante
        const forwardBias = (teammate.y - chip.y) * 2;
        const goalDist = Math.hypot(teammate.x - 300, teammate.y - 850);
        
        // Verificar si hay defensores en el camino
        const defendersInWay = playerChips.filter(player => {
          const A = { x: chip.x, y: chip.y };
          const B = { x: teammate.x, y: teammate.y };
          const P = { x: player.x, y: player.y };
          
          const normalLength = Math.hypot(B.x - A.x, B.y - A.y);
          const distance = Math.abs((P.x - A.x) * (B.y - A.y) - (P.y - A.y) * (B.x - A.x)) / normalLength;
          const dotProduct = ((P.x - A.x) * (B.x - A.x) + (P.y - A.y) * (B.y - A.y)) / (normalLength * normalLength);
          
          return distance < 60 && dotProduct > 0 && dotProduct < 1;
        }).length;
        
        // Calcular puntuación del pase
        let passScore = 100 - goalDist + forwardBias - (defendersInWay * 50);
        
        if (passScore > bestPassScore) {
          bestPassScore = passScore;
          bestPass = teammate;
        }
      });
      
      // Calcular puntuación de tiro
      const goalDist = Math.hypot(chip.x - 300, chip.y - 850);
      const angleToGoal = Math.abs(Math.atan2(850 - chip.y, 300 - chip.x));
      const angleScore = (Math.PI/2 - angleToGoal) * 100; // Mejor ángulo = mejor puntuación

      // Ajustar puntuación basada en la posición y cercanía a la pelota
      const distToBall = Math.hypot(chip.x - ballPos.x, chip.y - ballPos.y);
      let positionScore = 0;
      if (chip.y > 600) { // Cerca del área
        positionScore = 200 - goalDist * 0.5;
      } else if (chip.y > 400) { // Mitad de cancha
        positionScore = 100 - goalDist * 0.3;
      } else { // Defensa
        positionScore = 50 - goalDist * 0.2;
      }
      const ballProximityScore = Math.max(0, 260 - distToBall) * 0.7;
      positionScore += ballProximityScore;

      // --- MOTOR DE RAZONAMIENTO DEL BOT ---
      // Para cada ficha, evalúa todas las jugadas posibles y simula utilidad
      let bestLocalAction: 'shoot' | 'pass' | 'clear' = 'shoot';
      let bestLocalScore = -Infinity;
      let bestLocalTarget = { x: 0, y: 0 };
      let bestLocalPassTarget: MovingChip | null = null;
      let reasoningLog = [] as string[];

      // 1. Simular tiro
      const shootUtility = positionScore + angleScore * 1.3 + Math.max(0, 320 - goalDist) * 0.8;
      reasoningLog.push(`Tiro: pos=${positionScore.toFixed(1)} ang=${angleScore.toFixed(1)} distBonus=${Math.max(0,320-goalDist)*0.8}`);
      if (shootUtility > bestLocalScore) {
        bestLocalScore = shootUtility;
        bestLocalAction = 'shoot';
        bestLocalTarget = shootTarget;
        bestLocalPassTarget = null;
      }

      // 2. Simular pase a cada compañero
      botChips.forEach(teammate => {
        if (teammate === chip) return;
        const distToTeammate = Math.hypot(teammate.x - chip.x, teammate.y - chip.y);
        if (distToTeammate > 340) return;
        const forwardBias = (teammate.y - chip.y) * 2;
        const goalDistTeammate = Math.hypot(teammate.x - 300, teammate.y - 850);
        const defendersInWay = playerChips.filter(player => {
          const A = { x: chip.x, y: chip.y };
          const B = { x: teammate.x, y: teammate.y };
          const P = { x: player.x, y: player.y };
          const normalLength = Math.hypot(B.x - A.x, B.y - A.y);
          const distance = Math.abs((P.x - A.x) * (B.y - A.y) - (P.y - A.y) * (B.x - A.x)) / normalLength;
          const dotProduct = ((P.x - A.x) * (B.x - A.x) + (P.y - A.y) * (B.y - A.y)) / (normalLength * normalLength);
          return distance < 60 && dotProduct > 0 && dotProduct < 1;
        }).length;
        let passUtility = 120 - goalDistTeammate + forwardBias - defendersInWay * 80;
        passUtility += Math.max(0, 180 - distToTeammate) * 0.5;
        reasoningLog.push(`Pase a ${teammate.id}: util=${passUtility.toFixed(1)} dist=${distToTeammate.toFixed(1)} defensores=${defendersInWay}`);
        if (passUtility > bestLocalScore) {
          bestLocalScore = passUtility;
          bestLocalAction = 'pass';
          bestLocalTarget = { x: teammate.x, y: teammate.y };
          bestLocalPassTarget = teammate;
        }
      });

      // 3. Simular despeje defensivo si está en zona propia
      if (chip.y < FIELD_HEIGHT * 0.35) {
        // Despeje hacia banda
        const side = chip.x < FIELD_WIDTH / 2 ? -1 : 1;
        const clearX = clamp(FIELD_WIDTH / 2 + side * (FIELD_WIDTH / 2 - 80), BOUNDARY_LEFT + 40, BOUNDARY_RIGHT - 40);
        const clearY = FIELD_HEIGHT * 0.6 + Math.random() * 120;
        const clearUtility = 80 + (FIELD_HEIGHT - chip.y) * 0.2;
        reasoningLog.push(`Despeje: util=${clearUtility.toFixed(1)} hacia x=${clearX.toFixed(1)}, y=${clearY.toFixed(1)}`);
        if (clearUtility > bestLocalScore) {
          bestLocalScore = clearUtility;
          bestLocalAction = 'clear';
          bestLocalTarget = { x: clearX, y: clearY };
          bestLocalPassTarget = null;
        }
      }

      // --- Fin razonamiento para esta ficha ---
      reasoningLog.push(`Mejor acción: ${bestLocalAction} (utilidad=${bestLocalScore.toFixed(1)})`);
      if (bestLocalScore > bestScore) {
        bestScore = bestLocalScore;
        bestChip = chip;
        bestAction = bestLocalAction;
        bestTarget = bestLocalTarget;
        bestPassTargetX = bestLocalPassTarget ? bestLocalPassTarget.x : null;
        bestPassTargetY = bestLocalPassTarget ? bestLocalPassTarget.y : null;
        // Log razonamiento solo de la ficha elegida
        console.log(`Bot reasoning for ${chip.id}:\n` + reasoningLog.join('\n'));
      }
    });
    const ballIsNearOurGoal = ballPos.y < BOUNDARY_TOP + 140;
    const playerNearBall = playerChips.some(player => Math.hypot(player.x - ballPos.x, player.y - ballPos.y) < 140);
    // Si la pelota está cerca de nuestro arco y el rival presiona, priorizar despeje
    if (ballIsNearOurGoal && playerNearBall) {
      let closestChip = botChips[0];
      let closestDist = Infinity;
      botChips.forEach(chip => {
        const d = Math.hypot(chip.x - ballPos.x, chip.y - ballPos.y);
        if (d < closestDist) {
          closestDist = d;
          closestChip = chip;
        }
      });
      bestChip = closestChip;
      bestAction = 'clear';
      bestPassTargetX = null;
      bestPassTargetY = null;
    }
    
    // 2. Ejecutar la mejor acción: tiro o pase hacia el objetivo decidido
    let targetX = bestChip.x;
    let targetY = bestChip.y;
    let powerMultiplier = 1.0;

    if (bestAction === 'shoot') {
      const distanceToGoal = Math.hypot(bestTarget.x - bestChip.x, bestTarget.y - bestChip.y);
      const baseAngle = Math.atan2(bestTarget.y - bestChip.y, bestTarget.x - bestChip.x);
      // Máxima precisión: casi sin ruido angular
      const angleVariance = Math.max(0.01, 0.06 - distanceToGoal / 2000);
      const finalAngle = baseAngle + (Math.random() - 0.5) * angleVariance;

      const shootDistance = Math.min(distanceToGoal + 100, 620);
      targetX = bestChip.x + Math.cos(finalAngle) * shootDistance;
      targetY = bestChip.y + Math.sin(finalAngle) * shootDistance;

      powerMultiplier = 1.15 + Math.random() * 0.2; // Tiros muy potentes y directos
    } else if (bestAction === 'pass' && bestPassTargetX !== null && bestPassTargetY !== null) {
      // Pases casi perfectos: dispersión mínima
      targetX = bestPassTargetX + (Math.random() - 0.5) * 8;
      targetY = bestPassTargetY + (Math.random() - 0.5) * 8;
      powerMultiplier = 0.82 + Math.random() * 0.18; // Pases tensos y precisos
    } else {
      if (bestAction === 'clear') {
        const side = ballPos.x < FIELD_WIDTH / 2 ? -1 : 1;
        const safeX = FIELD_WIDTH / 2 + side * (FIELD_WIDTH / 2 - 80);
        targetX = clamp(safeX, BOUNDARY_LEFT + 40, BOUNDARY_RIGHT - 40);
        targetY = FIELD_HEIGHT * 0.6 + Math.random() * 120;
        powerMultiplier = 1.0;
      } else {
        targetX = FIELD_WIDTH / 2 + (Math.random() - 0.5) * 40;
        targetY = (FIELD_HEIGHT * 3) / 4 + (Math.random() - 0.5) * 40;
        powerMultiplier = 0.8;
      }
    }

    // 3. Calcular dirección, potencia y velocidad
    const dx = targetX - bestChip.x;
    const dy = targetY - bestChip.y;
    const distance = Math.hypot(dx, dy) || 1;

    const basePower = 9;
    const distanceFactor = Math.min(1.5, distance / 500);
    const power = basePower * powerMultiplier * (0.8 + distanceFactor);
    const speed = Math.min(MAX_SPEED, power);

    const vx = (dx / distance) * speed;
    const vy = (dy / distance) * speed;

    // 4. Aplicar la velocidad a la ficha seleccionada
    chipsRef.current = chipsRef.current.map(chip =>
      chip.id === bestChip.id ? { ...chip, vx, vy } : chip
    );

    setChips([...chipsRef.current]);
    turnTakenRef.current = true;
    const stats = botStatsRef.current;
    if (bestAction === 'shoot') {
      stats.shots += 1;
    } else if (bestAction === 'pass') {
      stats.passes += 1;
    }
    const tipoAccion = bestAction === 'shoot' ? 'tiro' : bestAction === 'pass' ? 'pase' : 'despeje';
    console.log(`Bot ha realizado un ${tipoAccion} con potencia ${power.toFixed(1)}`);
  }, [analyzeDefense, myScore, botScore]);

  // RESET campo (compatible)
  const resetField = useCallback((scorer: "you" | "bot") => {
    console.log(`Reseteando campo. Último gol: ${scorer}`);
    
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
      console.log("Configurando turno del bot...");
      // No establecer el turno aquí, lo haremos después en showGoalAnim
    } else {
      console.log("Configurando turno del jugador...");
      setActive("creator");
      setSelectedChipId("you-1");
    }
  }, []);

  const showGoalAnim = useCallback((scorer: "you" | "bot") => {
    console.log(`Gol de: ${scorer}`);
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
        console.log("Preparando turno del bot...");
        
        // Pequeño retraso para asegurar que el estado se actualice
        setTimeout(() => {
          console.log("Es el turno del bot, disparando...");
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

        // Colisiones entre fichas
        for (let i = 0; i < movedChips.length; i++) {
          for (let j = i + 1; j < movedChips.length; j++) {
            handleCollision(movedChips[i], movedChips[j]);
          }
          // con la pelota
          handleCollision(movedChips[i], movedBall);
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
          if (newScore >= goalTarget) { setWinner("you"); setShowEnd(true); }
          else { showGoalAnim("you"); }
        } else if (b.y > BOUNDARY_BOTTOM + 10 && b.x > GOAL_LEFT && b.x < GOAL_RIGHT) {
          goalScoredRef.current = true;
          const newScore = botScore + 1;
          setBotScore(newScore);
          if (newScore >= goalTarget) { setWinner("bot"); setShowEnd(true); }
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

    // Cálculo de potencia con mejor respuesta
    const normalizedDist = Math.min(1, dist / (MAX_DRAG_DISTANCE * 0.8));
    const powerCurve = Math.pow(normalizedDist, 1.5);  // Curva más suave al inicio, más pronunciada al final
    
    const minPower = 0.1;   // Mínima potencia para que los tiros sean más consistentes
    const maxPower = 8.0;   // Reducido para mejor control
    const effectivePower = minPower + (powerCurve * (maxPower - minPower));
    
    // Aplicar vector de dirección con la potencia calculada
    const powerMultiplier = 0.18;  // Ajuste fino de la sensibilidad
    const dx = (start.x - x) * effectivePower * powerMultiplier;
    const dy = (start.y - y) * effectivePower * 0.15;

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
          <span style={{ width: 32 }} />
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
