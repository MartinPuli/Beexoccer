import { createServer } from "node:http";
import { Server, Socket } from "socket.io";

// Basic field configuration
const FIELD_WIDTH = 600;
const FIELD_HEIGHT = 900;
const GOAL_WIDTH = 160;
const GOAL_HEIGHT = 120;
const GOAL_X_START = (FIELD_WIDTH - GOAL_WIDTH) / 2;
const GOAL_X_END = GOAL_X_START + GOAL_WIDTH;
const TICK_MS = 16;
const FRICTION = 0.985;
const EPSILON = 0.05;
const TURN_MS = 15_000;
const MAX_SIM_MS = 10_000;

type PlayerSide = "creator" | "challenger";

type MatchEventType = "goal-self" | "goal-rival" | "timeout" | "rematch-requested" | "rematch-confirmed";

// Lobby system
interface Lobby {
  matchId: string;
  creator: string;
  creatorAlias: string;
  stake: string;
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
  subscribeLobbies: () => void;
  unsubscribeLobbies: () => void;
  createLobby: (payload: { matchId: string; creator: string; creatorAlias: string; stake: string }) => void;
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
}

const matches = new Map<string, MatchState>();

function defaultChips(): Vec2[] {
  return [
    { id: "creator-1", x: 300, y: 180, vx: 0, vy: 0, radius: 26, owner: "creator", flagEmoji: "🏠", color: "#2dd673" },
    { id: "creator-2", x: 220, y: 240, vx: 0, vy: 0, radius: 26, owner: "creator", flagEmoji: "🏠", color: "#2dd673" },
    { id: "creator-3", x: 380, y: 240, vx: 0, vy: 0, radius: 26, owner: "creator", flagEmoji: "🏠", color: "#2dd673" },
    { id: "challenger-1", x: 300, y: 720, vx: 0, vy: 0, radius: 26, owner: "challenger", flagEmoji: "🚩", color: "#ffe45b" },
    { id: "challenger-2", x: 220, y: 660, vx: 0, vy: 0, radius: 26, owner: "challenger", flagEmoji: "🚩", color: "#ffe45b" },
    { id: "challenger-3", x: 380, y: 660, vx: 0, vy: 0, radius: 26, owner: "challenger", flagEmoji: "🚩", color: "#ffe45b" }
  ];
}

function defaultBall(): Ball {
  return { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 0, vy: 0, radius: 12 };
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
      rematch: { creator: false, challenger: false }
    };
    matches.set(matchId, state);
  }
  return state;
}

function magnitude(vx: number, vy: number) {
  return Math.hypot(vx, vy);
}

function reflect(entity: { x: number; y: number; vx: number; vy: number; radius: number }) {
  // Walls left/right
  if (entity.x - entity.radius < 0) {
    entity.x = entity.radius;
    entity.vx = Math.abs(entity.vx);
  }
  if (entity.x + entity.radius > FIELD_WIDTH) {
    entity.x = FIELD_WIDTH - entity.radius;
    entity.vx = -Math.abs(entity.vx);
  }
  // Walls top/bottom
  if (entity.y - entity.radius < 0) {
    entity.y = entity.radius;
    entity.vy = Math.abs(entity.vy);
  }
  if (entity.y + entity.radius > FIELD_HEIGHT) {
    entity.y = FIELD_HEIGHT - entity.radius;
    entity.vy = -Math.abs(entity.vy);
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
  a.x -= (overlap / 2) * nx;
  a.y -= (overlap / 2) * ny;
  b.x += (overlap / 2) * nx;
  b.y += (overlap / 2) * ny;

  // Simple elastic swap along normal
  const va = a.vx * nx + a.vy * ny;
  const vb = b.vx * nx + b.vy * ny;
  const newVa = vb;
  const newVb = va;
  a.vx += (newVa - va) * nx;
  a.vy += (newVa - va) * ny;
  b.vx += (newVb - vb) * nx;
  b.vy += (newVb - vb) * ny;
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
  entity.vx *= FRICTION;
  entity.vy *= FRICTION;
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

  const match = ensureMatch(matchId);
  socket.join(matchId);

  socket.emit("snapshot", toSnapshot(match));

  socket.on("input", ({ matchId: incomingId, chipId, impulse }: { matchId?: string; chipId: string; impulse: { dx: number; dy: number } }) => {
    const state = ensureMatch(incomingId || matchId);
    if (state.simRunning || !state.awaitingInput) return;
    const chip = state.chips.find((c) => c.id === chipId && c.owner === state.activePlayer);
    if (!chip) return;

    chip.vx = impulse.dx;
    chip.vy = impulse.dy;
    state.simStart = Date.now();
    startSimulation(io, state);
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

  socket.on("createLobby", ({ matchId: lobbyMatchId, creator, creatorAlias, stake }) => {
    const lobby: Lobby = {
      matchId: lobbyMatchId,
      creator,
      creatorAlias,
      stake,
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
