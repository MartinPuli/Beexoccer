import { createServer } from "node:http";
import { Server, Socket } from "socket.io";

// Basic field configuration - SYNCED WITH FRONTEND (Table Soccer style)
const FIELD_WIDTH = 600;
const FIELD_HEIGHT = 900;
const GOAL_WIDTH = 160;
const GOAL_HEIGHT = 120;
const GOAL_X_START = (FIELD_WIDTH - GOAL_WIDTH) / 2;
const GOAL_X_END = GOAL_X_START + GOAL_WIDTH;
const TICK_MS = 16;
const FRICTION = 0.985;         // Fricción baja - superficie lisa
const BALL_FRICTION = 0.98;     // Pelota con más fricción
const EPSILON = 0.15;
const POWER = 0.45;
const MAX_SPEED = 28;           // Velocidad máxima controlada
const RESTITUTION = 0.85;       // Rebote en colisiones (reducido)
const WALL_RESTITUTION = 0.80;  // Rebote en paredes (reducido)
const CHIP_MASS = 5;            // Masa de las fichas (pesadas)
const BALL_MASS = 1.58;         // Masa de la pelota (ajustada)
const TURN_MS = 12_000;
const MAX_SIM_MS = 10_000;
const MAX_CONSECUTIVE_TIMEOUTS = 3;

type PlayerSide = "creator" | "challenger";

type MatchEventType = "goal-self" | "goal-rival" | "timeout" | "rematch-requested" | "rematch-confirmed";

// Lobby system - matches MatchLobby type from frontend
interface Lobby {
  id: number;
  creator: string;
  creatorAlias: string;
  goals: number;
  isFree: boolean;
  stakeAmount: string;
  stakeToken: string;
  open: boolean;
  createdAt: number;
  status: "waiting" | "ready" | "playing";
}

const lobbies = new Map<string, Lobby>();
const lobbySubscribers = new Set<string>(); // socket ids subscribed to lobby updates

interface SnapshotPayload {
  activePlayer: PlayerSide;
  turnEndsAt: number;
  creatorScore: number;
  challengerScore: number;
  commentary: string;
  ball: { x: number; y: number; vx: number; vy: number };
  chips: Array<{
    id: string;
    x: number;
    y: number;
    radius: number;
    fill: string;
    flagEmoji: string;
    owner: PlayerSide;
  }>;
}

type MatchEventPayload = {
  type: MatchEventType;
  message: string;
  accent: string;
  timestamp: number;
  from?: PlayerSide;
};

interface ClientToServerEvents {
  input: (payload: { matchId?: string; chipId: string; impulse: { dx: number; dy: number } }) => void;
  sync: () => void;
  requestRematch: () => void;
  turnTimeout: (payload: { matchId?: string }) => void;
  forfeit: (payload: { matchId?: string }) => void;
  subscribeLobbies: () => void;
  unsubscribeLobbies: () => void;
  createLobby: (payload: { matchId: string; creator: string; creatorAlias: string; goals: number; isFree: boolean; stakeAmount: string }) => void;
  joinLobby: (payload: { matchId: string; challenger: string; challengerAlias: string }) => void;
  cancelLobby: (payload: { matchId: string }) => void;
}

interface ServerToClientEvents {
  snapshot: (payload: SnapshotPayload) => void;
  event: (payload: MatchEventPayload) => void;
  lobbiesUpdate: (lobbies: Lobby[]) => void;
  lobbyCreated: (lobby: Lobby) => void;
  lobbyJoined: (data: { matchId: string; challenger: string; challengerAlias: string }) => void;
  matchReady: (data: { matchId: string }) => void;
  lobbyCancelled: (data: { matchId: string }) => void;
  matchEnded: (data: { winner: PlayerSide; reason: string }) => void;
  playerForfeited: (data: { side: PlayerSide }) => void;
}

interface InterServerEvents {}

interface SocketData {
  matchId: string;
  side: PlayerSide;
}

type RealtimeServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

interface Vec2 {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  id: string;
  owner: PlayerSide;
  flagEmoji: string;
  color: string;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface MatchState {
  id: string;
  activePlayer: PlayerSide;
  turnEndsAt: number;
  creatorScore: number;
  challengerScore: number;
  chips: Vec2[];
  ball: Ball;
  simRunning: boolean;
  simStart: number;
  awaitingInput: boolean;
  rematch: { creator: boolean; challenger: boolean };
  consecutiveTimeouts: { creator: number; challenger: number };
}

const matches = new Map<string, MatchState>();

function defaultChips(): Vec2[] {
  // Creator tiene fichas abajo (y mayor), Challenger tiene fichas arriba
  return [
    { id: "creator-1", x: 300, y: 750, vx: 0, vy: 0, radius: 32, owner: "creator", flagEmoji: "", color: "#00a8ff" },
    { id: "creator-2", x: 150, y: 650, vx: 0, vy: 0, radius: 32, owner: "creator", flagEmoji: "", color: "#00a8ff" },
    { id: "creator-3", x: 450, y: 650, vx: 0, vy: 0, radius: 32, owner: "creator", flagEmoji: "", color: "#00a8ff" },
    { id: "challenger-1", x: 300, y: 150, vx: 0, vy: 0, radius: 32, owner: "challenger", flagEmoji: "", color: "#ff4d5a" },
    { id: "challenger-2", x: 150, y: 250, vx: 0, vy: 0, radius: 32, owner: "challenger", flagEmoji: "", color: "#ff4d5a" },
    { id: "challenger-3", x: 450, y: 250, vx: 0, vy: 0, radius: 32, owner: "challenger", flagEmoji: "", color: "#ff4d5a" }
  ];
}

function defaultBall(): Ball {
  return { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 0, vy: 0, radius: 20 };
}

function ensureMatch(matchId: string): MatchState {
  let state = matches.get(matchId);
  if (!state) {
    state = {
      id: matchId,
      activePlayer: "creator",
      turnEndsAt: Date.now() + TURN_MS,
      creatorScore: 0,
      challengerScore: 0,
      chips: defaultChips(),
      ball: defaultBall(),
      simRunning: false,
      simStart: 0,
      awaitingInput: true,
      rematch: { creator: false, challenger: false },
      consecutiveTimeouts: { creator: 0, challenger: 0 }
    };
    matches.set(matchId, state);
  }
  return state;
}

function magnitude(vx: number, vy: number) {
  return Math.hypot(vx, vy);
}

function reflect(entity: { x: number; y: number; vx: number; vy: number; radius: number }) {
  // Walls left/right - rebote vivo
  if (entity.x - entity.radius < 0) {
    entity.x = entity.radius;
    entity.vx = Math.abs(entity.vx) * WALL_RESTITUTION;
  }
  if (entity.x + entity.radius > FIELD_WIDTH) {
    entity.x = FIELD_WIDTH - entity.radius;
    entity.vx = -Math.abs(entity.vx) * WALL_RESTITUTION;
  }
  
  // Verificar si está en la zona del arco (para permitir goles)
  const inGoalX = entity.x >= GOAL_X_START && entity.x <= GOAL_X_END;
  
  // Walls top/bottom - pero NO rebotar si está en el arco
  if (entity.y - entity.radius < 0) {
    if (!inGoalX) {
      // Fuera del arco: rebotar
      entity.y = entity.radius;
      entity.vy = Math.abs(entity.vy) * WALL_RESTITUTION;
    }
    // Si está en el arco, dejarlo pasar (se detectará como gol)
  }
  if (entity.y + entity.radius > FIELD_HEIGHT) {
    if (!inGoalX) {
      // Fuera del arco: rebotar
      entity.y = FIELD_HEIGHT - entity.radius;
      entity.vy = -Math.abs(entity.vy) * WALL_RESTITUTION;
    }
    // Si está en el arco, dejarlo pasar (se detectará como gol)
  }
}

function handleCollision(a: Vec2 | Ball, b: Vec2 | Ball) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const minDist = a.radius + b.radius;
  if (dist === 0 || dist >= minDist) return;

  // Separate
  const overlap = minDist - dist;
  const nx = dx / dist;
  const ny = dy / dist;
  
  // Masas: fichas pesadas, pelota ligera
  const aIsBall = a.radius <= 14;
  const bIsBall = b.radius <= 14;
  const ma = aIsBall ? BALL_MASS : CHIP_MASS;
  const mb = bIsBall ? BALL_MASS : CHIP_MASS;
  const total = ma + mb;
  
  // Separación proporcional a masas
  a.x -= (overlap * (mb / total)) * nx;
  a.y -= (overlap * (mb / total)) * ny;
  b.x += (overlap * (ma / total)) * nx;
  b.y += (overlap * (ma / total)) * ny;

  // Velocidad relativa a lo largo de la normal
  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const velAlongNormal = rvx * nx + rvy * ny;
  
  // Si se están separando, no aplicar impulso
  if (velAlongNormal > 0) return;
  
  // Impulso con restitución alta (colisión elástica)
  let j = -(1 + RESTITUTION) * velAlongNormal;
  j = j / (1 / ma + 1 / mb);
  
  const impulseX = j * nx;
  const impulseY = j * ny;
  
  a.vx -= impulseX / ma;
  a.vy -= impulseY / ma;
  b.vx += impulseX / mb;
  b.vy += impulseY / mb;
  
  // Limitar velocidades
  const sa = magnitude(a.vx, a.vy);
  if (sa > MAX_SPEED * 1.2) {
    const scale = (MAX_SPEED * 1.2) / sa;
    a.vx *= scale;
    a.vy *= scale;
  }
  const sb = magnitude(b.vx, b.vy);
  if (sb > MAX_SPEED * 1.2) {
    const scale = (MAX_SPEED * 1.2) / sb;
    b.vx *= scale;
    b.vy *= scale;
  }
}

function resetAfterGoal(state: MatchState, conceded: PlayerSide) {
  state.ball = defaultBall();
  state.chips = defaultChips();
  state.simRunning = false;
  state.awaitingInput = true;
  const next = conceded; // quien recibió el gol saca
  state.activePlayer = next;
  state.turnEndsAt = Date.now() + TURN_MS;
}

function detectGoal(ball: Ball): PlayerSide | null {
  const inX = ball.x >= GOAL_X_START && ball.x <= GOAL_X_END;
  const atTop = ball.y - ball.radius <= GOAL_HEIGHT && inX;
  const atBottom = ball.y + ball.radius >= FIELD_HEIGHT - GOAL_HEIGHT && inX;
  if (atTop) return "challenger"; // creator dispara hacia abajo; gol al rival (arriba)
  if (atBottom) return "creator";
  return null;
}

function toSnapshot(state: MatchState): SnapshotPayload {
  return {
    activePlayer: state.activePlayer,
    turnEndsAt: state.turnEndsAt,
    creatorScore: state.creatorScore,
    challengerScore: state.challengerScore,
    commentary: state.awaitingInput ? "Apunta y dispara" : "Resolviendo jugada",
    ball: { x: state.ball.x, y: state.ball.y, vx: state.ball.vx, vy: state.ball.vy },
    chips: state.chips.map((c) => ({
      id: c.id,
      x: c.x,
      y: c.y,
      radius: c.radius,
      fill: c.color,
      flagEmoji: c.flagEmoji,
      owner: c.owner
    }))
  };
}

function applyStep(entity: { x: number; y: number; vx: number; vy: number; radius: number }) {
  entity.x += entity.vx;
  entity.y += entity.vy;
  
  // Fricción diferenciada: pelota rueda más libre
  const isBall = entity.radius <= 14;
  const friction = isBall ? BALL_FRICTION : FRICTION;
  entity.vx *= friction;
  entity.vy *= friction;
  
  if (magnitude(entity.vx, entity.vy) < EPSILON) {
    entity.vx = 0;
    entity.vy = 0;
  }
  reflect(entity);
}

function isMoving(entity: { vx: number; vy: number }) {
  return magnitude(entity.vx, entity.vy) > EPSILON;
}

function finishTurn(state: MatchState) {
  state.simRunning = false;
  state.awaitingInput = true;
  state.activePlayer = state.activePlayer === "creator" ? "challenger" : "creator";
  state.turnEndsAt = Date.now() + TURN_MS;
}

function simulateStep(io: RealtimeServer, state: MatchState, startedAt: number): boolean {
  for (const chip of state.chips) {
    applyStep(chip);
  }

  applyStep(state.ball);

  for (let i = 0; i < state.chips.length; i += 1) {
    for (let j = i + 1; j < state.chips.length; j += 1) {
      handleCollision(state.chips[i], state.chips[j]);
    }
    handleCollision(state.chips[i], state.ball);
  }

  const scorer = detectGoal(state.ball);
  if (scorer) {
    if (scorer === "creator") state.creatorScore += 1;
    else state.challengerScore += 1;
    io.to(state.id).emit("event", {
      type: scorer === "creator" ? "goal-self" : "goal-rival",
      message: "GOOOL",
      accent: scorer === "creator" ? "#00ff9d" : "#ff4f64",
      timestamp: Date.now()
    });
    resetAfterGoal(state, scorer === "creator" ? "challenger" : "creator");
    io.to(state.id).emit("snapshot", toSnapshot(state));
    return false;
  }

  const moving = isMoving(state.ball) || state.chips.some((chip) => isMoving(chip));
  const elapsed = Date.now() - startedAt;

  if (!moving || elapsed > MAX_SIM_MS) {
    finishTurn(state);
    io.to(state.id).emit("snapshot", toSnapshot(state));
    return false;
  }

  io.to(state.id).emit("snapshot", toSnapshot(state));
  return true;
}

function startSimulation(io: RealtimeServer, state: MatchState) {
  state.simRunning = true;
  state.simStart = Date.now();
  state.awaitingInput = false;

  const interval = setInterval(() => {
    const keepGoing = simulateStep(io, state, state.simStart);
    if (!keepGoing) {
      clearInterval(interval);
    }
  }, TICK_MS);
}

const httpServer = createServer();
const io: RealtimeServer = new Server(httpServer, {
  cors: { origin: "*" }
});

io.on("connection", (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
  const rawMatchId = socket.handshake.query.matchId;
  const rawSide = socket.handshake.query.side;
  const matchId = typeof rawMatchId === "string" && rawMatchId.length > 0 ? rawMatchId : "demo-match";
  const side: PlayerSide = rawSide === "challenger" ? "challenger" : "creator";
  socket.data.matchId = matchId;
  socket.data.side = side;

  console.log(`[Socket] Player connected: matchId=${matchId}, side=${side}, socketId=${socket.id}`);

  const match = ensureMatch(matchId);
  socket.join(matchId);

  // Send initial snapshot
  const snapshot = toSnapshot(match);
  console.log(`[Socket] Sending initial snapshot to ${socket.id}:`, { activePlayer: snapshot.activePlayer, turnEndsAt: snapshot.turnEndsAt });
  socket.emit("snapshot", snapshot);

  socket.on("input", ({ matchId: incomingId, chipId, impulse }: { matchId?: string; chipId: string; impulse: { dx: number; dy: number } }) => {
    console.log(`[Socket] Input received from ${side}: chipId=${chipId}, impulse=`, impulse);
    const state = ensureMatch(incomingId || matchId);
    if (state.simRunning || !state.awaitingInput) {
      console.log(`[Socket] Input rejected: simRunning=${state.simRunning}, awaitingInput=${state.awaitingInput}`);
      return;
    }
    const chip = state.chips.find((c) => c.id === chipId && c.owner === state.activePlayer);
    if (!chip) {
      console.log(`[Socket] Chip not found: chipId=${chipId}, activePlayer=${state.activePlayer}`);
      console.log(`[Socket] Available chips:`, state.chips.map(c => ({ id: c.id, owner: c.owner })));
      return;
    }

    // Reset timeout counter on successful input
    state.consecutiveTimeouts[state.activePlayer] = 0;

    // Apply impulse directly (frontend already applied power scaling)
    chip.vx = impulse.dx;
    chip.vy = impulse.dy;
    
    // Clamp to max speed
    const speed = Math.hypot(chip.vx, chip.vy);
    if (speed > MAX_SPEED) {
      chip.vx = (chip.vx / speed) * MAX_SPEED;
      chip.vy = (chip.vy / speed) * MAX_SPEED;
    }
    
    console.log(`[Socket] Chip ${chipId} velocity set to: vx=${chip.vx}, vy=${chip.vy}`);
    state.simStart = Date.now();
    startSimulation(io, state);
  });

  // Handle turn timeout - called by client when time runs out
  socket.on("turnTimeout", ({ matchId: incomingId }) => {
    const state = ensureMatch(incomingId || matchId);
    if (state.simRunning || !state.awaitingInput) return;
    if (state.activePlayer !== side) return; // Only the active player can timeout
    
    // Increment consecutive timeouts
    state.consecutiveTimeouts[side]++;
    
    // Check for auto-lose (3 consecutive timeouts)
    if (state.consecutiveTimeouts[side] >= MAX_CONSECUTIVE_TIMEOUTS) {
      const winner = side === "creator" ? "challenger" : "creator";
      io.to(state.id).emit("event", {
        type: "timeout",
        message: `${side === "creator" ? "Creador" : "Retador"} pierde por inactividad`,
        accent: "#ff4f64",
        timestamp: Date.now()
      });
      
      // End match - winner gets max score
      if (winner === "creator") {
        state.creatorScore = 5;
        state.challengerScore = 0;
      } else {
        state.challengerScore = 5;
        state.creatorScore = 0;
      }
      io.to(state.id).emit("matchEnded", { winner, reason: "timeout" });
      io.to(state.id).emit("snapshot", toSnapshot(state));
      return;
    }
    
    // Just skip turn
    io.to(state.id).emit("event", {
      type: "timeout",
      message: "Tiempo agotado",
      accent: "#ffa500",
      timestamp: Date.now()
    });
    finishTurn(state);
    io.to(state.id).emit("snapshot", toSnapshot(state));
  });

  // Handle player forfeit (abandonment)
  socket.on("forfeit", ({ matchId: incomingId }) => {
    const state = ensureMatch(incomingId || matchId);
    const winner = side === "creator" ? "challenger" : "creator";
    
    // Notify both players
    io.to(state.id).emit("playerForfeited", { side });
    io.to(state.id).emit("matchEnded", { winner, reason: "forfeit" });
    
    // Clean up match
    matches.delete(state.id);
  });

  socket.on("sync", () => {
    const state = ensureMatch(matchId);
    socket.emit("snapshot", toSnapshot(state));
  });

  socket.on("requestRematch", () => {
    const state = ensureMatch(matchId);
    state.rematch[side] = true;
    io.to(state.id).emit("event", {
      type: "rematch-requested",
      message: side === "creator" ? "Creador pide revancha" : "Retador pide revancha",
      accent: "#7cc0ff",
      timestamp: Date.now(),
      from: side
    });

    const expiry = Date.now() + 10_000;
    setTimeout(() => {
      const pending = !(state.rematch.creator && state.rematch.challenger);
      if (pending && state.rematch[side] && Date.now() >= expiry) {
        state.rematch[side] = false;
      }
    }, 10_000);

    if (state.rematch.creator && state.rematch.challenger) {
      state.creatorScore = 0;
      state.challengerScore = 0;
      state.chips = defaultChips();
      state.ball = defaultBall();
      state.activePlayer = "creator";
      state.turnEndsAt = Date.now() + TURN_MS;
      state.awaitingInput = true;
      state.simRunning = false;
      state.rematch = { creator: false, challenger: false };
      io.to(state.id).emit("snapshot", toSnapshot(state));
      io.to(state.id).emit("event", {
        type: "rematch-confirmed",
        message: "Revancha aceptada",
        accent: "#00ff9d",
        timestamp: Date.now()
      });
    }
  });

  // Lobby system handlers
  socket.on("subscribeLobbies", () => {
    lobbySubscribers.add(socket.id);
    // Send current lobbies list
    const waitingLobbies = Array.from(lobbies.values()).filter(l => l.status === "waiting");
    socket.emit("lobbiesUpdate", waitingLobbies);
  });

  socket.on("unsubscribeLobbies", () => {
    lobbySubscribers.delete(socket.id);
  });

  socket.on("createLobby", ({ matchId: lobbyMatchId, creator, creatorAlias, goals, isFree, stakeAmount }) => {
    const lobby: Lobby = {
      id: Number(lobbyMatchId),
      creator,
      creatorAlias,
      goals,
      isFree,
      stakeAmount,
      stakeToken: "0x0000000000000000000000000000000000000000",
      open: true,
      createdAt: Date.now(),
      status: "waiting"
    };
    lobbies.set(lobbyMatchId, lobby);
    
    // Notify all subscribers
    const waitingLobbies = Array.from(lobbies.values()).filter(l => l.status === "waiting");
    for (const subId of lobbySubscribers) {
      io.to(subId).emit("lobbiesUpdate", waitingLobbies);
    }
    socket.emit("lobbyCreated", lobby);
  });

  socket.on("joinLobby", ({ matchId: lobbyMatchId, challenger, challengerAlias }) => {
    const lobby = lobbies.get(lobbyMatchId);
    if (lobby?.status !== "waiting") return;
    
    lobby.status = "ready";
    
    // Notify creator that someone joined
    io.to(lobbyMatchId).emit("lobbyJoined", { matchId: lobbyMatchId, challenger, challengerAlias });
    
    // Notify both players match is ready
    io.to(lobbyMatchId).emit("matchReady", { matchId: lobbyMatchId });
    
    // Update lobbies list for all subscribers
    const waitingLobbies = Array.from(lobbies.values()).filter(l => l.status === "waiting");
    for (const subId of lobbySubscribers) {
      io.to(subId).emit("lobbiesUpdate", waitingLobbies);
    }
  });

  socket.on("cancelLobby", ({ matchId: lobbyMatchId }) => {
    const lobby = lobbies.get(lobbyMatchId);
    if (!lobby) return;
    
    lobbies.delete(lobbyMatchId);
    
    // Notify subscribers
    const waitingLobbies = Array.from(lobbies.values()).filter(l => l.status === "waiting");
    for (const subId of lobbySubscribers) {
      io.to(subId).emit("lobbiesUpdate", waitingLobbies);
    }
    io.to(lobbyMatchId).emit("lobbyCancelled", { matchId: lobbyMatchId });
  });

  // Handle disconnect - clean up lobby subscriptions
  (socket as unknown as { on: (event: string, cb: () => void) => void }).on("disconnect", () => {
    lobbySubscribers.delete(socket.id);
  });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
httpServer.listen(PORT, () => {
  console.log(`Realtime server listening on :${PORT}`);
});
