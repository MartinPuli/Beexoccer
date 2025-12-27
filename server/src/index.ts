import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { Server, Socket } from "socket.io";

// Basic field configuration - SYNCED WITH FRONTEND (Table Soccer style)
const FIELD_WIDTH = 600;
const FIELD_HEIGHT = 900;
// Límites del campo de juego (dentro de las líneas neón)
const BOUNDARY_LEFT = 50;
const BOUNDARY_RIGHT = 550;
const BOUNDARY_TOP = 50;
const BOUNDARY_BOTTOM = 850;
const GOAL_WIDTH = 160;
const GOAL_X_START = (FIELD_WIDTH - GOAL_WIDTH) / 2; // 220
const GOAL_X_END = GOAL_X_START + GOAL_WIDTH; // 380
const TICK_MS = 16;
const FRICTION = 0.985; // Fricción baja - superficie lisa
const BALL_FRICTION = 0.98; // Pelota con más fricción
const EPSILON = 0.15;
const MAX_SPEED = 28; // Velocidad máxima controlada
const RESTITUTION = 0.85; // Rebote en colisiones (reducido)
const WALL_RESTITUTION = 0.8; // Rebote en paredes (reducido)
const CHIP_MASS = 5; // Masa de las fichas (pesadas)
const BALL_MASS = 1.58; // Masa de la pelota (ajustada)
const BALL_RADIUS = 20; // Radio de la pelota
const CHIP_RADIUS = 32; // Radio de las fichas
const TURN_MS = 15_000; // 15 segundos por turno (igual que frontend)
const MAX_SIM_MS = 10_000;
const MAX_CONSECUTIVE_TIMEOUTS = 3;

type TeamKit = {
  primary: string;
  secondary: string;
};

type TeamDef = {
  id: string;
  home: TeamKit;
  away: TeamKit;
};

const ARGENTINA_TEAMS_2025: TeamDef[] = [
  { id: "aldosivi", home: { primary: "#ffd100", secondary: "#00843d" }, away: { primary: "#ffffff", secondary: "#00843d" } },
  { id: "atletico-tucuman", home: { primary: "#1e5aa8", secondary: "#ffffff" }, away: { primary: "#ffffff", secondary: "#1e5aa8" } },
  { id: "belgrano", home: { primary: "#4aa6ff", secondary: "#0b2d59" }, away: { primary: "#ffffff", secondary: "#4aa6ff" } },
  { id: "central-cordoba-sde", home: { primary: "#000000", secondary: "#ffffff" }, away: { primary: "#ffffff", secondary: "#000000" } },
  { id: "estudiantes-lp", home: { primary: "#d6001c", secondary: "#ffffff" }, away: { primary: "#ffffff", secondary: "#d6001c" } },
  { id: "gimnasia-lp", home: { primary: "#0b2d59", secondary: "#ffffff" }, away: { primary: "#ffffff", secondary: "#0b2d59" } },
  { id: "godoy-cruz", home: { primary: "#1e5aa8", secondary: "#ffffff" }, away: { primary: "#ffffff", secondary: "#1e5aa8" } },
  { id: "independiente-rivadavia", home: { primary: "#1e5aa8", secondary: "#ffffff" }, away: { primary: "#ffffff", secondary: "#1e5aa8" } },
  { id: "instituto", home: { primary: "#d6001c", secondary: "#ffffff" }, away: { primary: "#ffffff", secondary: "#d6001c" } },
  { id: "newells", home: { primary: "#000000", secondary: "#d6001c" }, away: { primary: "#ffffff", secondary: "#d6001c" } },
  { id: "rosario-central", home: { primary: "#f6c800", secondary: "#1e5aa8" }, away: { primary: "#1e5aa8", secondary: "#f6c800" } },
  { id: "san-martin-sj", home: { primary: "#0b2d59", secondary: "#000000" }, away: { primary: "#ffffff", secondary: "#0b2d59" } },
  { id: "sarmiento-junin", home: { primary: "#00843d", secondary: "#ffffff" }, away: { primary: "#ffffff", secondary: "#00843d" } },
  { id: "talleres", home: { primary: "#1e5aa8", secondary: "#ffffff" }, away: { primary: "#ffffff", secondary: "#1e5aa8" } },
  { id: "union", home: { primary: "#d6001c", secondary: "#ffffff" }, away: { primary: "#ffffff", secondary: "#d6001c" } },
  { id: "argentinos", home: { primary: "#d6001c", secondary: "#ffffff" }, away: { primary: "#ffffff", secondary: "#d6001c" } },
  { id: "banfield", home: { primary: "#00843d", secondary: "#ffffff" }, away: { primary: "#ffffff", secondary: "#00843d" } },
  { id: "barracas-central", home: { primary: "#d6001c", secondary: "#ffffff" }, away: { primary: "#ffffff", secondary: "#d6001c" } },
  { id: "boca", home: { primary: "#0b2d59", secondary: "#f6c800" }, away: { primary: "#f6c800", secondary: "#0b2d59" } },
  { id: "defensa-y-justicia", home: { primary: "#00843d", secondary: "#f6c800" }, away: { primary: "#ffffff", secondary: "#00843d" } },
  { id: "deportivo-riestra", home: { primary: "#000000", secondary: "#ffffff" }, away: { primary: "#ffffff", secondary: "#000000" } },
  { id: "huracan", home: { primary: "#ffffff", secondary: "#d6001c" }, away: { primary: "#d6001c", secondary: "#ffffff" } },
  { id: "independiente", home: { primary: "#d6001c", secondary: "#ffffff" }, away: { primary: "#ffffff", secondary: "#d6001c" } },
  { id: "lanus", home: { primary: "#6a0f2d", secondary: "#ffffff" }, away: { primary: "#ffffff", secondary: "#6a0f2d" } },
  { id: "platense", home: { primary: "#6a0f2d", secondary: "#ffffff" }, away: { primary: "#ffffff", secondary: "#6a0f2d" } },
  { id: "racing", home: { primary: "#4aa6ff", secondary: "#ffffff" }, away: { primary: "#ffffff", secondary: "#4aa6ff" } },
  { id: "river", home: { primary: "#ffffff", secondary: "#d6001c" }, away: { primary: "#d6001c", secondary: "#ffffff" } },
  { id: "san-lorenzo", home: { primary: "#0b2d59", secondary: "#d6001c" }, away: { primary: "#d6001c", secondary: "#0b2d59" } },
  { id: "tigre", home: { primary: "#1e5aa8", secondary: "#d6001c" }, away: { primary: "#ffffff", secondary: "#1e5aa8" } },
  { id: "velez", home: { primary: "#ffffff", secondary: "#0b2d59" }, away: { primary: "#0b2d59", secondary: "#ffffff" } },
];

function getTeamKit(teamId: string | undefined, which: "home" | "away"): TeamKit | undefined {
  if (!teamId) return undefined;
  const t = ARGENTINA_TEAMS_2025.find((x) => x.id === teamId);
  if (!t) return undefined;
  return which === "home" ? t.home : t.away;
}

function buildChips(creatorKit?: TeamKit, challengerKit?: TeamKit): Vec2[] {
  const creatorColor = creatorKit?.primary || "#00a8ff";
  const creatorStroke = creatorKit?.secondary;
  const challengerColor = challengerKit?.primary || "#ff4d5a";
  const challengerStroke = challengerKit?.secondary;

  return [
    {
      id: "creator-1",
      x: 300,
      y: 750,
      vx: 0,
      vy: 0,
      radius: CHIP_RADIUS,
      owner: "creator",
      flagEmoji: "",
      color: creatorColor,
      stroke: creatorStroke,
    },
    {
      id: "creator-2",
      x: 150,
      y: 650,
      vx: 0,
      vy: 0,
      radius: CHIP_RADIUS,
      owner: "creator",
      flagEmoji: "",
      color: creatorColor,
      stroke: creatorStroke,
    },
    {
      id: "creator-3",
      x: 450,
      y: 650,
      vx: 0,
      vy: 0,
      radius: CHIP_RADIUS,
      owner: "creator",
      flagEmoji: "",
      color: creatorColor,
      stroke: creatorStroke,
    },
    {
      id: "challenger-1",
      x: 300,
      y: 150,
      vx: 0,
      vy: 0,
      radius: CHIP_RADIUS,
      owner: "challenger",
      flagEmoji: "",
      color: challengerColor,
      stroke: challengerStroke,
    },
    {
      id: "challenger-2",
      x: 150,
      y: 250,
      vx: 0,
      vy: 0,
      radius: CHIP_RADIUS,
      owner: "challenger",
      flagEmoji: "",
      color: challengerColor,
      stroke: challengerStroke,
    },
    {
      id: "challenger-3",
      x: 450,
      y: 250,
      vx: 0,
      vy: 0,
      radius: CHIP_RADIUS,
      owner: "challenger",
      flagEmoji: "",
      color: challengerColor,
      stroke: challengerStroke,
    },
  ];
}

function applyTeamKitsToState(state: MatchState) {
  const creatorTeamId = state.creatorTeamId;
  const challengerTeamId = state.challengerTeamId;
  const creatorKit = getTeamKit(creatorTeamId, "home");
  const challengerKit = getTeamKit(challengerTeamId, "away");
  state.chips = buildChips(creatorKit, challengerKit);
}

type PlayerSide = "creator" | "challenger";

type MatchMode = "goals" | "time";

type MatchEventType =
  | "goal-self"
  | "goal-rival"
  | "timeout"
  | "rematch-requested"
  | "rematch-confirmed";

// Lobby system - matches MatchLobby type from frontend
interface Lobby {
  id: number;
  creator: string;
  creatorAlias: string;
  creatorTeamId?: string;
  goals: number;
  mode?: MatchMode;
  durationMs?: number;
  isFree: boolean;
  stakeAmount: string;
  stakeToken: string;
  open: boolean;
  createdAt: number;
  status: "waiting" | "ready" | "playing";
}

// Free lobbies (no blockchain) system
interface FreeLobby {
  id: string;
  creator: string;
  creatorAlias: string;
  goals: number;
  createdAt: number;
  creatorSocketId?: string;
}

const lobbies = new Map<string, Lobby>();
const lobbySubscribers = new Set<string>(); // socket ids subscribed to lobby updates

// Free lobbies storage
const freeLobbies = new Map<string, FreeLobby>();
const freeLobbySubscribers = new Set<string>();

interface SnapshotPayload {
  activePlayer: PlayerSide;
  turnEndsAt: number;
  awaitingInput: boolean;
  creatorScore: number;
  challengerScore: number;
  creatorTeamId?: string;
  challengerTeamId?: string;
  matchMode?: MatchMode;
  matchEndsAt?: number;
  timeRemainingMs?: number;
  goldenGoal?: boolean;
  commentary: string;
  ball: { x: number; y: number; vx: number; vy: number };
  chips: Array<{
    id: string;
    x: number;
    y: number;
    radius: number;
    fill: string;
    stroke?: string;
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
  input: (payload: {
    matchId?: string;
    chipId: string;
    impulse: { dx: number; dy: number };
  }) => void;
  sync: () => void;
  joinMatch: (matchId: string) => void;
  requestRematch: (payload: { matchId: string; alias: string }) => void;
  acceptRematch: (payload: { matchId: string }) => void;
  declineRematch: (payload: { matchId: string }) => void;
  // Rematch blockchain flow
  rematchBlockchainCreated: (payload: { 
    oldMatchId: string; 
    newMatchId: string;
    creatorAddress: string;
  }) => void;
  rematchBlockchainJoined: (payload: { 
    oldMatchId: string; 
    newMatchId: string;
  }) => void;
  turnTimeout: (payload: { matchId?: string }) => void;
  forfeit: (payload: { matchId?: string }) => void;
  subscribeLobbies: () => void;
  unsubscribeLobbies: () => void;
  createLobby: (payload: {
    matchId: string;
    creator: string;
    creatorAlias: string;
    goals: number;
    isFree: boolean;
    stakeAmount: string;
    teamId?: string;
    mode?: MatchMode;
    durationMs?: number;
  }) => void;
  joinLobby: (payload: {
    matchId: string;
    challenger: string;
    challengerAlias: string;
    teamId?: string;
  }) => void;
  cancelLobby: (payload: { matchId: string }) => void;
  // Free lobbies events
  subscribeFreeLobbies: () => void;
  unsubscribeFreeLobbies: () => void;
  createFreeLobby: (lobby: FreeLobby) => void;
  joinFreeLobby: (payload: {
    lobbyId: string;
    odUserId: string;
    alias: string;
  }) => void;
  cancelFreeLobby: (lobbyId: string) => void;
  // Native socket.io events
  disconnect: () => void;
}

interface ServerToClientEvents {
  snapshot: (payload: SnapshotPayload) => void;
  event: (payload: MatchEventPayload) => void;
  lobbiesUpdate: (lobbies: Lobby[]) => void;
  lobbyCreated: (lobby: Lobby) => void;
  lobbyJoined: (data: {
    matchId: string;
    challenger: string;
    challengerAlias: string;
  }) => void;
  matchReady: (data: { matchId: string }) => void;
  lobbyCancelled: (data: { matchId: string }) => void;
  matchEnded: (data: { winner: PlayerSide; reason: string }) => void;
  playerForfeited: (data: { side: PlayerSide }) => void;
  // Rematch events
  rematchRequested: (data: {
    fromSide: PlayerSide;
    fromAlias: string;
    matchId: string;
  }) => void;
  rematchAccepted: (data: { matchId: string }) => void;
  rematchDeclined: (data: { bySide: PlayerSide }) => void;
  // Rematch with blockchain - tells clients to create new on-chain transaction
  rematchBlockchainRequired: (data: {
    oldMatchId: string;
    matchConfig: {
      isFree: boolean;
      stakeAmount: string;
      stakeToken: string;
      goals: number;
    };
    initiatorSide: PlayerSide;
  }) => void;
  rematchBlockchainReady: (data: { 
    newMatchId: string; 
    oldMatchId: string;
  }) => void;
  // Free lobbies events
  freeLobbiesUpdate: (lobbies: FreeLobby[]) => void;
  freeMatchReady: (data: { matchId: string; rivalAlias: string }) => void;
  freeLobbyRemoved: (lobbyId: string) => void;
}

interface InterServerEvents {}

interface SocketData {
  matchId: string;
  side: PlayerSide;
  usernameKey?: string;
  usernameRaw?: string;
}

type RealtimeServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

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
  stroke?: string;
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
  goalTarget: number;
  creatorScore: number;
  challengerScore: number;
  matchMode?: MatchMode;
  matchDurationMs?: number;
  matchEndsAt?: number;
  goldenGoal?: boolean;
  chips: Vec2[];
  ball: Ball;
  simRunning: boolean;
  simStart: number;
  awaitingInput: boolean;
  ended: boolean;
  connected: { creator: boolean; challenger: boolean };
  rematch: { creator: boolean; challenger: boolean };
  consecutiveTimeouts: { creator: number; challenger: number };
  creatorTeamId?: string;
  challengerTeamId?: string;
  // Track if current move is a kickoff (first move after goal/reset) - goals during kickoff don't count
  isKickoff: boolean;
  // Match configuration for rematch with blockchain
  matchConfig?: {
    isFree: boolean;
    stakeAmount: string;
    stakeToken: string;
    creatorAddress: string;
    challengerAddress: string;
    creatorAlias?: string;
    challengerAlias?: string;
  };
}

type WeeklyRankingPlayer = {
  address: string;
  alias?: string;
  xo: number;
  updatedAt: number;
};

type WeeklyRankingState = {
  weekStartMs: number;
  players: Record<string, WeeklyRankingPlayer>;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_XO = 1000;
const RANKING_K = 32;
const RANKING_MIN_CHANGE = 5;
const RANKING_MAX_CHANGE = 50;

const rankingFilePath = join(process.cwd(), "data", "weekly_ranking.json");

function getWeekStartMs(nowMs: number) {
  const d = new Date(nowMs);
  const day = d.getUTCDay();
  const deltaDays = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - deltaDays);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function ensureCurrentWeek(state: WeeklyRankingState, nowMs: number) {
  const desired = getWeekStartMs(nowMs);
  if (state.weekStartMs !== desired) {
    return { weekStartMs: desired, players: {} };
  }
  return state;
}

function loadWeeklyRanking(nowMs: number): WeeklyRankingState {
  const empty: WeeklyRankingState = { weekStartMs: getWeekStartMs(nowMs), players: {} };
  try {
    if (!existsSync(rankingFilePath)) return empty;
    const parsed = JSON.parse(readFileSync(rankingFilePath, "utf8")) as WeeklyRankingState;
    if (!parsed || typeof parsed.weekStartMs !== "number" || !parsed.players) return empty;
    const normalized = ensureCurrentWeek(parsed, nowMs);
    return normalized;
  } catch {
    return empty;
  }
}

function saveWeeklyRanking(state: WeeklyRankingState) {
  const dir = dirname(rankingFilePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(rankingFilePath, JSON.stringify(state), "utf8");
}

function getOrInitPlayer(state: WeeklyRankingState, address: string) {
  const key = address.toLowerCase();
  const existing = state.players[key];
  if (existing) return existing;
  const created: WeeklyRankingPlayer = {
    address: key,
    xo: DEFAULT_XO,
    updatedAt: Date.now(),
  };
  state.players[key] = created;
  return created;
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function expectedScore(myXo: number, otherXo: number) {
  return 1 / (1 + Math.pow(10, (otherXo - myXo) / 400));
}

function computeWinDelta(winnerXo: number, loserXo: number) {
  const expWin = expectedScore(winnerXo, loserXo);
  const raw = RANKING_K * (1 - expWin);
  return clampInt(raw, RANKING_MIN_CHANGE, RANKING_MAX_CHANGE);
}

let weeklyRanking: WeeklyRankingState = loadWeeklyRanking(Date.now());

function applyWeeklyRankingMatchResult(payload: {
  winnerAddress: string;
  loserAddress: string;
  winnerAlias?: string;
  loserAlias?: string;
}) {
  const now = Date.now();
  weeklyRanking = ensureCurrentWeek(weeklyRanking, now);

  const winner = getOrInitPlayer(weeklyRanking, payload.winnerAddress);
  const loser = getOrInitPlayer(weeklyRanking, payload.loserAddress);

  if (payload.winnerAlias) winner.alias = payload.winnerAlias;
  if (payload.loserAlias) loser.alias = payload.loserAlias;

  const delta = computeWinDelta(winner.xo, loser.xo);
  winner.xo += delta;
  loser.xo = Math.max(0, loser.xo - delta);
  winner.updatedAt = now;
  loser.updatedAt = now;

  saveWeeklyRanking(weeklyRanking);

  return { delta, winnerXo: winner.xo, loserXo: loser.xo };
}

function updateRankingIfPossible(state: MatchState, winner: PlayerSide) {
  const cfg = state.matchConfig;
  if (!cfg) return;
  const creator = cfg.creatorAddress;
  const challenger = cfg.challengerAddress;
  if (!creator || !challenger) return;
  if (creator === "" || challenger === "") return;

  const winnerAddress = winner === "creator" ? creator : challenger;
  const loserAddress = winner === "creator" ? challenger : creator;
  const winnerAlias = winner === "creator" ? cfg.creatorAlias : cfg.challengerAlias;
  const loserAlias = winner === "creator" ? cfg.challengerAlias : cfg.creatorAlias;
  applyWeeklyRankingMatchResult({
    winnerAddress,
    loserAddress,
    winnerAlias,
    loserAlias,
  });
}

const matches = new Map<string, MatchState>();

function defaultChips(): Vec2[] {
  return buildChips();
}

function defaultBall(): Ball {
  return {
    x: FIELD_WIDTH / 2,
    y: FIELD_HEIGHT / 2,
    vx: 0,
    vy: 0,
    radius: BALL_RADIUS,
  };
}

function ensureMatch(matchId: string): MatchState {
  let state = matches.get(matchId);
  if (!state) {
    state = {
      id: matchId,
      activePlayer: "creator",
      // Paused until both players are connected.
      turnEndsAt: Number.MAX_SAFE_INTEGER,
      goalTarget: 3,
      creatorScore: 0,
      challengerScore: 0,
      matchMode: "goals",
      matchDurationMs: undefined,
      matchEndsAt: undefined,
      goldenGoal: false,
      chips: defaultChips(),
      ball: defaultBall(),
      simRunning: false,
      simStart: 0,
      awaitingInput: false,
      ended: false,
      connected: { creator: false, challenger: false },
      rematch: { creator: false, challenger: false },
      consecutiveTimeouts: { creator: 0, challenger: 0 },
      // First move of the match is a kickoff - goals during kickoff don't count
      isKickoff: true,
    };
    applyTeamKitsToState(state);
    matches.set(matchId, state);
  }
  return state;
}

function bothPlayersConnected(state: MatchState): boolean {
  return state.connected.creator && state.connected.challenger;
}

function pauseTurn(state: MatchState) {
  state.awaitingInput = false;
  state.turnEndsAt = Number.MAX_SAFE_INTEGER;
}

function resumeTurnIfReady(state: MatchState) {
  if (state.ended || state.simRunning) return;
  if (!bothPlayersConnected(state)) {
    pauseTurn(state);
    return;
  }
  if (state.matchMode === "time" && !state.matchEndsAt) {
    const duration =
      typeof state.matchDurationMs === "number" && state.matchDurationMs > 0
        ? state.matchDurationMs
        : 180_000;
    state.matchEndsAt = Date.now() + duration;
    state.goldenGoal = false;
  }
  if (!state.awaitingInput) {
    state.awaitingInput = true;
    state.turnEndsAt = Date.now() + TURN_MS;
  }
}

function magnitude(vx: number, vy: number) {
  return Math.hypot(vx, vy);
}

function reflect(
  entity: { x: number; y: number; vx: number; vy: number; radius: number },
  isBall: boolean
) {
  const r = entity.radius;

  // Paredes laterales siempre rebotan (límites neón)
  if (entity.x - r < BOUNDARY_LEFT) {
    entity.x = BOUNDARY_LEFT + r;
    entity.vx = Math.abs(entity.vx) * WALL_RESTITUTION;
  }
  if (entity.x + r > BOUNDARY_RIGHT) {
    entity.x = BOUNDARY_RIGHT - r;
    entity.vx = -Math.abs(entity.vx) * WALL_RESTITUTION;
  }

  // Verificar si está en la zona del arco (para permitir goles)
  const inGoalX = entity.x >= GOAL_X_START && entity.x <= GOAL_X_END;

  // Pared superior (línea de gol = BOUNDARY_TOP = 50)
  if (entity.y - r < BOUNDARY_TOP) {
    if (isBall && inGoalX) {
      // Pelota en área de gol - permitir que cruce para detectar gol
    } else {
      entity.y = BOUNDARY_TOP + r;
      entity.vy = Math.abs(entity.vy) * WALL_RESTITUTION;
    }
  }

  // Pared inferior (línea de gol = BOUNDARY_BOTTOM = 850)
  if (entity.y + r > BOUNDARY_BOTTOM) {
    if (isBall && inGoalX) {
      // Pelota en área de gol - permitir que cruce para detectar gol
    } else {
      entity.y = BOUNDARY_BOTTOM - r;
      entity.vy = -Math.abs(entity.vy) * WALL_RESTITUTION;
    }
  }

  // Las fichas no pueden entrar en las porterías (solo la pelota)
  if (!isBall && inGoalX) {
    // Portería superior
    if (entity.y - r < BOUNDARY_TOP) {
      entity.y = BOUNDARY_TOP + r;
      entity.vy = Math.abs(entity.vy) * WALL_RESTITUTION * 0.5;
    }
    // Portería inferior
    if (entity.y + r > BOUNDARY_BOTTOM) {
      entity.y = BOUNDARY_BOTTOM - r;
      entity.vy = -Math.abs(entity.vy) * WALL_RESTITUTION * 0.5;
    }
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
  const aIsBall = a.radius <= BALL_RADIUS;
  const bIsBall = b.radius <= BALL_RADIUS;
  const ma = aIsBall ? BALL_MASS : CHIP_MASS;
  const mb = bIsBall ? BALL_MASS : CHIP_MASS;
  const total = ma + mb;

  // Separación proporcional a masas
  a.x -= overlap * (mb / total) * nx;
  a.y -= overlap * (mb / total) * ny;
  b.x += overlap * (ma / total) * nx;
  b.y += overlap * (ma / total) * ny;

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
  applyTeamKitsToState(state);
  state.simRunning = false;
  const next = conceded; // quien recibió el gol saca
  state.activePlayer = next;
  // Mark next move as kickoff - goals during kickoff don't count
  state.isKickoff = true;

  // Only resume timer when both players are connected.
  state.awaitingInput = false;
  state.turnEndsAt = Number.MAX_SAFE_INTEGER;
  resumeTurnIfReady(state);
}

function detectGoal(ball: Ball): PlayerSide | null {
  const inGoalX = ball.x >= GOAL_X_START && ball.x <= GOAL_X_END;

  // Gol en portería superior (pelota cruzó BOUNDARY_TOP)
  // Creator está abajo, Challenger está arriba
  // Si la pelota entra por arriba, Creator anotó
  if (ball.y - ball.radius < BOUNDARY_TOP - 10 && inGoalX) {
    return "creator"; // Creator anotó en la portería de arriba
  }

  // Gol en portería inferior (pelota cruzó BOUNDARY_BOTTOM)
  // Si la pelota entra por abajo, Challenger anotó
  if (ball.y + ball.radius > BOUNDARY_BOTTOM + 10 && inGoalX) {
    return "challenger"; // Challenger anotó en la portería de abajo
  }

  return null;
}

function toSnapshot(state: MatchState): SnapshotPayload {
  return {
    activePlayer: state.activePlayer,
    turnEndsAt: state.turnEndsAt,
    awaitingInput: state.awaitingInput,
    creatorScore: state.creatorScore,
    challengerScore: state.challengerScore,
    creatorTeamId: state.creatorTeamId,
    challengerTeamId: state.challengerTeamId,
    matchMode: state.matchMode,
    matchEndsAt: state.matchEndsAt,
    timeRemainingMs:
      state.matchMode === "time" && typeof state.matchEndsAt === "number"
        ? Math.max(0, state.matchEndsAt - Date.now())
        : undefined,
    goldenGoal: state.goldenGoal,
    commentary: state.awaitingInput
      ? state.activePlayer === "creator"
        ? "Tu turno: arrastra una ficha para disparar"
        : "Esperando al rival"
      : "Pelota en movimiento...",
    ball: state.ball,
    chips: state.chips.map((c) => ({
      id: c.id,
      x: c.x,
      y: c.y,
      radius: c.radius,
      fill: c.color,
      stroke: c.stroke,
      flagEmoji: c.flagEmoji,
      owner: c.owner,
    })),
  };
}

function applyStep(
  entity: { x: number; y: number; vx: number; vy: number; radius: number },
  isBall: boolean
) {
  entity.x += entity.vx;
  entity.y += entity.vy;

  // Fricción diferenciada: pelota rueda más libre
  const friction = isBall ? BALL_FRICTION : FRICTION;
  entity.vx *= friction;
  entity.vy *= friction;

  if (magnitude(entity.vx, entity.vy) < EPSILON) {
    entity.vx = 0;
    entity.vy = 0;
  }
  reflect(entity, isBall);
}

function isMoving(entity: { vx: number; vy: number }) {
  return magnitude(entity.vx, entity.vy) > EPSILON;
}

function finishTurn(state: MatchState) {
  state.simRunning = false;
  state.activePlayer =
    state.activePlayer === "creator" ? "challenger" : "creator";
  // Clear kickoff flag after first move completes - subsequent moves can score
  state.isKickoff = false;

  // Only resume timer when both players are connected.
  state.awaitingInput = false;
  state.turnEndsAt = Number.MAX_SAFE_INTEGER;
  resumeTurnIfReady(state);
}

function applyTurnTimeout(
  io: RealtimeServer,
  state: MatchState,
  timedOutSide: PlayerSide
) {
  if (state.ended || state.simRunning || !state.awaitingInput) {
    return;
  }
  if (!bothPlayersConnected(state)) {
    pauseTurn(state);
    return;
  }
  if (state.activePlayer !== timedOutSide) {
    return;
  }

  state.consecutiveTimeouts[timedOutSide] += 1;
  console.log(
    `[Timeout] ${timedOutSide} consecutive timeouts: ${state.consecutiveTimeouts[timedOutSide]}/${MAX_CONSECUTIVE_TIMEOUTS}`
  );

  if (state.consecutiveTimeouts[timedOutSide] >= MAX_CONSECUTIVE_TIMEOUTS) {
    const winner = timedOutSide === "creator" ? "challenger" : "creator";
    console.log(
      `[Timeout] ${timedOutSide} loses by inactivity! Winner: ${winner}`
    );

    io.to(state.id).emit("event", {
      type: "timeout",
      message: `${
        timedOutSide === "creator" ? "Creador" : "Retador"
      } pierde por inactividad`,
      accent: "#ff4f64",
      timestamp: Date.now(),
      from: timedOutSide,
    });

    // End match - winner gets max score
    if (winner === "creator") {
      state.creatorScore = 5;
      state.challengerScore = 0;
    } else {
      state.challengerScore = 5;
      state.creatorScore = 0;
    }

    // Mark match as ended to avoid repeated watchdog timeouts.
    state.ended = true;
    state.simRunning = false;
    pauseTurn(state);

    console.log(
      `[Timeout] Emitting matchEnded to room ${state.id} with winner: ${winner}`
    );
    updateRankingIfPossible(state, winner);
    io.to(state.id).emit("matchEnded", { winner, reason: "timeout" });
    io.to(state.id).emit("snapshot", toSnapshot(state));
    return;
  }

  // Just skip turn
  io.to(state.id).emit("event", {
    type: "timeout",
    message: "Tiempo agotado",
    accent: "#ffa500",
    timestamp: Date.now(),
    from: timedOutSide,
  });

  finishTurn(state);
  io.to(state.id).emit("snapshot", toSnapshot(state));
}

function simulateStep(
  io: RealtimeServer,
  state: MatchState,
  startedAt: number
): boolean {
  for (const chip of state.chips) {
    applyStep(chip, false);
  }

  applyStep(state.ball, true);

  for (let i = 0; i < state.chips.length; i += 1) {
    for (let j = i + 1; j < state.chips.length; j += 1) {
      handleCollision(state.chips[i], state.chips[j]);
    }
    handleCollision(state.chips[i], state.ball);
  }

  const scorer = detectGoal(state.ball);
  if (scorer) {
    if (state.ended) {
      return false;
    }
    
    // IMPORTANT: Goals during kickoff (first move after goal/reset) don't count
    // Reset ball to center instead of counting the goal
    if (state.isKickoff) {
      state.ball = defaultBall();
      io.to(state.id).emit("snapshot", toSnapshot(state));
      // Continue simulation - don't count as goal
      return true;
    }
    
    if (scorer === "creator") state.creatorScore += 1;
    else state.challengerScore += 1;

    // Enviar evento de gol con información de quién anotó
    io.to(state.id).emit("event", {
      type: "goal-self",
      message: "GOOOL",
      accent: scorer === "creator" ? "#00ff9d" : "#ff4f64",
      timestamp: Date.now(),
      from: scorer,
    });

    if (state.matchMode === "time" && state.goldenGoal) {
      state.ended = true;
      state.simRunning = false;
      pauseTurn(state);
      updateRankingIfPossible(state, scorer);
      io.to(state.id).emit("matchEnded", { winner: scorer, reason: "golden-goal" });
      io.to(state.id).emit("snapshot", toSnapshot(state));
      return false;
    }

    // End match if target reached (goals mode)
    if (state.matchMode !== "time") {
      const winner =
        state.creatorScore >= state.goalTarget
          ? "creator"
          : state.challengerScore >= state.goalTarget
          ? "challenger"
          : null;
      if (winner) {
        state.ended = true;
        state.simRunning = false;
        pauseTurn(state);
        updateRankingIfPossible(state, winner);
        io.to(state.id).emit("matchEnded", { winner, reason: "goals" });
        io.to(state.id).emit("snapshot", toSnapshot(state));
        return false;
      }
    }

    // Quien recibió el gol saca
    const conceded = scorer === "creator" ? "challenger" : "creator";
    resetAfterGoal(state, conceded);
    io.to(state.id).emit("snapshot", toSnapshot(state));
    return false;
  }

  const moving =
    isMoving(state.ball) || state.chips.some((chip) => isMoving(chip));
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
  if (state.ended) return;
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

const httpServer = createServer((req, res) => {
  const origin = "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname.startsWith("/socket.io")) {
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/ranking/weekly") {
    const now = Date.now();
    weeklyRanking = ensureCurrentWeek(weeklyRanking, now);

    const players = Object.values(weeklyRanking.players)
      .sort((a, b) => b.xo - a.xo || a.address.localeCompare(b.address))
      .slice(0, 200)
      .map((p, idx) => ({
        rank: idx + 1,
        id: p.alias || p.address,
        address: p.address,
        alias: p.alias,
        xo: p.xo,
      }));

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        weekStartMs: weeklyRanking.weekStartMs,
        weekEndMs: weeklyRanking.weekStartMs + WEEK_MS,
        generatedAt: now,
        players,
      })
    );
    return;
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: "not_found" }));
});
const io: RealtimeServer = new Server(httpServer, {
  cors: { origin: "*" },
});

// ========== USERNAME UNIQUE REGISTRY ==========
// Case-insensitive registry: key = normalized username, value = socket.id
const reservedUsernames = new Map<string, string>();

function normalizeUsername(name: string) {
  return name.trim().toLowerCase();
}

function isValidUsername(name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 16) return false;
  // allow letters, numbers, underscore
  return /^[a-zA-Z0-9_]+$/.test(trimmed);
}

// Server-side watchdog to enforce turn timeouts even if clients don't send turnTimeout.
// This prevents desync issues and ensures the "3 consecutive timeouts per player" rule.
setInterval(() => {
  const now = Date.now();
  for (const state of matches.values()) {
    if (state.ended) continue;
    if (!bothPlayersConnected(state)) {
      pauseTurn(state);
      continue;
    }

    if (
      state.matchMode === "time" &&
      typeof state.matchEndsAt === "number" &&
      now >= state.matchEndsAt &&
      !state.goldenGoal
    ) {
      if (state.creatorScore === state.challengerScore) {
        state.goldenGoal = true;
        // Keep playing until next goal.
        io.to(state.id).emit("snapshot", toSnapshot(state));
      } else {
        const winner =
          state.creatorScore > state.challengerScore ? "creator" : "challenger";
        state.ended = true;
        state.simRunning = false;
        pauseTurn(state);
        updateRankingIfPossible(state, winner);
        io.to(state.id).emit("matchEnded", { winner, reason: "time" });
        io.to(state.id).emit("snapshot", toSnapshot(state));
      }
      continue;
    }

    if (state.awaitingInput && !state.simRunning && now >= state.turnEndsAt) {
      applyTurnTimeout(io, state, state.activePlayer);
    }
  }
}, 250);

io.on(
  "connection",
  (
    socket: Socket<
      ClientToServerEvents,
      ServerToClientEvents,
      InterServerEvents,
      SocketData
    >
  ) => {
    const rawMatchId = socket.handshake.query.matchId;
    const rawSide = socket.handshake.query.side;
    const rawGoals = socket.handshake.query.goals;
    const rawMode = socket.handshake.query.mode;
    const rawDurationMs = socket.handshake.query.durationMs;
    let matchId =
      typeof rawMatchId === "string" && rawMatchId.length > 0
        ? rawMatchId
        : "demo-match";
    const side: PlayerSide =
      rawSide === "challenger" ? "challenger" : "creator";
    socket.data.matchId = matchId;
    socket.data.side = side;

    console.log(
      `[Socket] Player connected: matchId=${matchId}, side=${side}, socketId=${socket.id}`
    );

    const match = ensureMatch(matchId);
    // Store goal target if provided.
    const parsedGoals =
      typeof rawGoals === "string" ? Number.parseInt(rawGoals, 10) : NaN;
    if (Number.isFinite(parsedGoals) && parsedGoals > 0 && parsedGoals <= 10) {
      match.goalTarget = parsedGoals;
    }

    // Store match mode (optional) and duration (optional)
    if (rawMode === "time" || rawMode === "goals") {
      match.matchMode = rawMode;
    }
    const parsedDurationMs =
      typeof rawDurationMs === "string" ? Number.parseInt(rawDurationMs, 10) : NaN;
    if (Number.isFinite(parsedDurationMs) && parsedDurationMs > 0) {
      match.matchDurationMs = parsedDurationMs;
    }

    // Track connections and (re)start the timer only when both are present.
    match.connected[side] = true;
    resumeTurnIfReady(match);
    socket.join(matchId);

    // Send initial snapshot
    const snapshot = toSnapshot(match);
    console.log(`[Socket] Sending initial snapshot to ${socket.id}:`, {
      activePlayer: snapshot.activePlayer,
      turnEndsAt: snapshot.turnEndsAt,
    });
    socket.emit("snapshot", snapshot);

    socket.on("disconnect", () => {
      const state = matches.get(matchId);
      if (!state) return;
      state.connected[side] = false;
      pauseTurn(state);
      io.to(state.id).emit("snapshot", toSnapshot(state));
    });

    socket.on(
      "input",
      ({
        matchId: incomingId,
        chipId,
        impulse,
      }: {
        matchId?: string;
        chipId: string;
        impulse: { dx: number; dy: number };
      }) => {
        console.log(
          `[Socket] Input received from ${side}: chipId=${chipId}, impulse=`,
          impulse
        );
        const state = ensureMatch(incomingId || matchId);
        if (state.simRunning || !state.awaitingInput) {
          console.log(
            `[Socket] Input rejected: simRunning=${state.simRunning}, awaitingInput=${state.awaitingInput}`
          );
          return;
        }
        const chip = state.chips.find(
          (c) => c.id === chipId && c.owner === state.activePlayer
        );
        if (!chip) {
          console.log(
            `[Socket] Chip not found: chipId=${chipId}, activePlayer=${state.activePlayer}`
          );
          console.log(
            `[Socket] Available chips:`,
            state.chips.map((c) => ({ id: c.id, owner: c.owner }))
          );
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

        console.log(
          `[Socket] Chip ${chipId} velocity set to: vx=${chip.vx}, vy=${chip.vy}`
        );
        state.simStart = Date.now();
        startSimulation(io, state);
      }
    );

    // Handle turn timeout - called by client when time runs out
    socket.on("turnTimeout", ({ matchId: incomingId }) => {
      const state = ensureMatch(incomingId || matchId);
      console.log(
        `[Timeout] Received from ${side}, activePlayer: ${state.activePlayer}, simRunning: ${state.simRunning}, awaitingInput: ${state.awaitingInput}`
      );

      if (state.simRunning || !state.awaitingInput) {
        console.log(`[Timeout] Ignored - simRunning or not awaiting input`);
        return;
      }
      if (state.activePlayer !== side) {
        console.log(`[Timeout] Ignored - not active player`);
        return; // Only the active player can timeout
      }

      applyTurnTimeout(io, state, side);
    });

    // Handle player forfeit (abandonment)
    socket.on("forfeit", ({ matchId: incomingId }) => {
      const state = ensureMatch(incomingId || matchId);
      const winner = side === "creator" ? "challenger" : "creator";

      // Notify both players
      io.to(state.id).emit("playerForfeited", { side });
      updateRankingIfPossible(state, winner);
      io.to(state.id).emit("matchEnded", { winner, reason: "forfeit" });

      // Clean up match
      matches.delete(state.id);
    });

    socket.on("sync", () => {
      const state = ensureMatch(matchId);
      socket.emit("snapshot", toSnapshot(state));
    });

    // Handler para unirse a un match (usado en revancha)
    socket.on("joinMatch", (newMatchId: string) => {
      if (!newMatchId) return;
      
      // Unirse al nuevo room
      socket.join(newMatchId);
      socket.data.matchId = newMatchId;
      
      // Actualizar el matchId local del handler
      matchId = newMatchId;
      
      const state = matches.get(newMatchId);
      if (state) {
        // Marcar como conectado según el lado
        if (side === "creator") {
          state.connected.creator = true;
        } else {
          state.connected.challenger = true;
        }
        
        // Si ambos están conectados, enviar snapshot
        if (bothPlayersConnected(state)) {
          resumeTurnIfReady(state);
          socket.emit("snapshot", toSnapshot(state));
        }
      }
    });

    // Nuevo sistema de revancha con popup
    socket.on("requestRematch", ({ matchId: reqMatchId, alias }) => {
      const targetMatchId = reqMatchId || matchId;
      const state = matches.get(targetMatchId);
      if (!state) return;

      state.rematch[side] = true;

      // Notificar a la sala del match. El cliente ignora la solicitud si viene de su mismo lado.
      io.to(state.id).emit("rematchRequested", {
        fromSide: side,
        fromAlias: alias,
        matchId: state.id,
      });

      // Expirar la solicitud después de 20 segundos
      setTimeout(() => {
        if (
          state.rematch[side] &&
          !state.rematch[side === "creator" ? "challenger" : "creator"]
        ) {
          state.rematch[side] = false;
          // Notificar que la revancha expiró
          io.to(state.id).emit("rematchDeclined", {
            bySide: side === "creator" ? "challenger" : "creator",
          });
        }
      }, 20_000);
    });

    socket.on("acceptRematch", ({ matchId: reqMatchId }) => {
      const targetMatchId = reqMatchId || matchId;
      const state = matches.get(targetMatchId);
      if (!state) return;

      // Marcar que este lado acepta
      state.rematch[side] = true;

      // Si ambos aceptaron
      if (state.rematch.creator && state.rematch.challenger) {
        // Si el match tiene apuesta (matchConfig.isFree === false), 
        // necesitamos transacción blockchain
        if (state.matchConfig && !state.matchConfig.isFree) {
          // Emitir evento para que el creador original inicie la transacción
          io.to(state.id).emit("rematchBlockchainRequired", {
            oldMatchId: state.id,
            matchConfig: {
              isFree: state.matchConfig.isFree,
              stakeAmount: state.matchConfig.stakeAmount,
              stakeToken: state.matchConfig.stakeToken,
              goals: state.goalTarget,
            },
            initiatorSide: "creator", // El que fue creator original crea el nuevo match
          });
        } else {
          // Match gratis: reiniciar directamente
          state.creatorScore = 0;
          state.challengerScore = 0;
          applyTeamKitsToState(state);
          state.ball = defaultBall();
          state.activePlayer = "creator";
          state.ended = false;
          pauseTurn(state);
          resumeTurnIfReady(state);
          state.simRunning = false;
          state.rematch = { creator: false, challenger: false };
          state.consecutiveTimeouts = { creator: 0, challenger: 0 };

          // Notificar a ambos que la revancha fue aceptada
          io.to(state.id).emit("rematchAccepted", { matchId: state.id });

          // Enviar snapshot inicial
          io.to(state.id).emit("snapshot", toSnapshot(state));
        }
      }
    });

    socket.on("declineRematch", ({ matchId: reqMatchId }) => {
      const targetMatchId = reqMatchId || matchId;
      const state = matches.get(targetMatchId);
      if (!state) return;

      // Limpiar estado de rematch
      state.rematch = { creator: false, challenger: false };

      // Notificar que la revancha fue rechazada
      io.to(state.id).emit("rematchDeclined", { bySide: side });
    });

    // Handler: Creator creó nuevo match en blockchain para revancha
    socket.on("rematchBlockchainCreated", ({ oldMatchId, newMatchId, creatorAddress }) => {
      const oldState = matches.get(oldMatchId);
      if (!oldState) return;

      // Crear nuevo estado del match con la configuración del anterior
      const newState = ensureMatch(newMatchId);
      newState.goalTarget = oldState.goalTarget;
      newState.matchConfig = {
        ...oldState.matchConfig!,
        creatorAddress,
      };

      // El creator se une al nuevo room
      socket.join(newMatchId);
      socket.data.matchId = newMatchId;
      socket.data.side = "creator";
      newState.connected.creator = true;

      // Notificar al rival que debe unirse al nuevo match
      io.to(oldMatchId).emit("rematchBlockchainReady", { 
        newMatchId, 
        oldMatchId 
      });
    });

    // Handler: Challenger se unió al nuevo match en blockchain
    socket.on("rematchBlockchainJoined", ({ oldMatchId, newMatchId }) => {
      const oldState = matches.get(oldMatchId);
      const newState = matches.get(newMatchId);
      if (!oldState || !newState) return;

      // El challenger se une al nuevo room
      socket.join(newMatchId);
      socket.data.matchId = newMatchId;
      socket.data.side = "challenger";
      newState.connected.challenger = true;

      // Limpiar el match anterior
      matches.delete(oldMatchId);

      // Notificar a ambos que el nuevo match está listo (en AMBOS rooms para asegurar)
      io.to(oldMatchId).emit("rematchAccepted", { matchId: newMatchId });
      io.to(newMatchId).emit("rematchAccepted", { matchId: newMatchId });

      // Iniciar la partida
      newState.activePlayer = "creator";
      newState.ended = false;
      pauseTurn(newState);
      resumeTurnIfReady(newState);

      // Enviar snapshot inicial al nuevo room
      setTimeout(() => {
        io.to(newMatchId).emit("snapshot", toSnapshot(newState));
      }, 100);
    });

    // Lobby system handlers
    socket.on("subscribeLobbies", () => {
      lobbySubscribers.add(socket.id);
      // Send current lobbies list
      const waitingLobbies = Array.from(lobbies.values()).filter(
        (l) => l.status === "waiting"
      );
      socket.emit("lobbiesUpdate", waitingLobbies);
    });

    socket.on("unsubscribeLobbies", () => {
      lobbySubscribers.delete(socket.id);
    });

    socket.on(
      "createLobby",
      ({
        matchId: lobbyMatchId,
        creator,
        creatorAlias,
        goals,
        isFree,
        stakeAmount,
        teamId,
        mode,
        durationMs,
      }) => {
        // Ensure this socket is in the lobby room so it can receive matchReady/lobbyJoined.
        socket.join(lobbyMatchId);

        const lobby: Lobby = {
          id: Number(lobbyMatchId),
          creator,
          creatorAlias,
          creatorTeamId: teamId,
          goals,
          mode,
          durationMs,
          isFree,
          stakeAmount,
          stakeToken: "0x0000000000000000000000000000000000000000",
          open: true,
          createdAt: Date.now(),
          status: "waiting",
        };
        lobbies.set(lobbyMatchId, lobby);

        // Guardar config del match para revancha con blockchain
        const matchState = ensureMatch(lobbyMatchId);
        matchState.creatorTeamId = teamId;
        matchState.goalTarget = goals;
        matchState.matchMode = mode === "time" ? "time" : "goals";
        matchState.matchDurationMs =
          typeof durationMs === "number" && durationMs > 0 ? durationMs : undefined;
        matchState.matchEndsAt = undefined;
        matchState.goldenGoal = false;
        applyTeamKitsToState(matchState);
        matchState.matchConfig = {
          isFree,
          stakeAmount,
          stakeToken: "0x0000000000000000000000000000000000000000",
          creatorAddress: creator,
          challengerAddress: "",
          creatorAlias,
        };

        // Notify all subscribers
        const waitingLobbies = Array.from(lobbies.values()).filter(
          (l) => l.status === "waiting"
        );
        for (const subId of lobbySubscribers) {
          io.to(subId).emit("lobbiesUpdate", waitingLobbies);
        }
        socket.emit("lobbyCreated", lobby);
      }
    );

    socket.on(
      "joinLobby",
      ({ matchId: lobbyMatchId, challenger, challengerAlias, teamId }) => {
        // Ensure this socket is in the lobby room so it can receive matchReady.
        socket.join(lobbyMatchId);

        const lobby = lobbies.get(lobbyMatchId);
        if (lobby?.status !== "waiting") return;

        lobby.status = "ready";

        // Guardar challenger address en matchConfig para revancha
        const matchState = matches.get(lobbyMatchId);
        if (matchState?.matchConfig) {
          matchState.matchConfig.challengerAddress = challenger;
          matchState.matchConfig.challengerAlias = challengerAlias;
        }
        if (matchState) {
          matchState.challengerTeamId = teamId;
          applyTeamKitsToState(matchState);
        }

        // Notify creator that someone joined
        io.to(lobbyMatchId).emit("lobbyJoined", {
          matchId: lobbyMatchId,
          challenger,
          challengerAlias,
        });

        // Notify both players match is ready
        io.to(lobbyMatchId).emit("matchReady", { matchId: lobbyMatchId });

        // Update lobbies list for all subscribers
        const waitingLobbies = Array.from(lobbies.values()).filter(
          (l) => l.status === "waiting"
        );
        for (const subId of lobbySubscribers) {
          io.to(subId).emit("lobbiesUpdate", waitingLobbies);
        }
      }
    );

    socket.on("cancelLobby", ({ matchId: lobbyMatchId }) => {
      const lobby = lobbies.get(lobbyMatchId);
      if (!lobby) return;

      lobbies.delete(lobbyMatchId);

      // Notify subscribers
      const waitingLobbies = Array.from(lobbies.values()).filter(
        (l) => l.status === "waiting"
      );
      for (const subId of lobbySubscribers) {
        io.to(subId).emit("lobbiesUpdate", waitingLobbies);
      }
      io.to(lobbyMatchId).emit("lobbyCancelled", { matchId: lobbyMatchId });
    });

    // ========== USERNAME UNIQUE HANDLERS ==========
    socket.on(
      "reserveUsername",
      (
        payload: { username: string },
        cb?: (res: { ok: boolean; reason?: string; username?: string }) => void
      ) => {
        const desired = payload?.username ?? "";
        const trimmed = desired.trim();
        if (!isValidUsername(trimmed)) {
          cb?.({ ok: false, reason: "invalid" });
          return;
        }

        const key = normalizeUsername(trimmed);
        const current = (socket.data as any).usernameKey as string | undefined;
        if (current === key) {
          cb?.({ ok: true, username: trimmed });
          return;
        }

        const owner = reservedUsernames.get(key);
        if (owner && owner !== socket.id) {
          cb?.({ ok: false, reason: "taken" });
          return;
        }

        // release previous username if any
        if (current) {
          const prevOwner = reservedUsernames.get(current);
          if (prevOwner === socket.id) reservedUsernames.delete(current);
        }

        reservedUsernames.set(key, socket.id);
        (socket.data as any).usernameKey = key;
        (socket.data as any).usernameRaw = trimmed;
        cb?.({ ok: true, username: trimmed });
      }
    );

    socket.on(
      "releaseUsername",
      (_payload: unknown, cb?: (res: { ok: boolean }) => void) => {
        const current = (socket.data as any).usernameKey as string | undefined;
        if (current) {
          const owner = reservedUsernames.get(current);
          if (owner === socket.id) reservedUsernames.delete(current);
        }
        delete (socket.data as any).usernameKey;
        delete (socket.data as any).usernameRaw;
        cb?.({ ok: true });
      }
    );

    socket.on("disconnect", () => {
      const current = (socket.data as any).usernameKey as string | undefined;
      if (current) {
        const owner = reservedUsernames.get(current);
        if (owner === socket.id) reservedUsernames.delete(current);
      }
    });

    // ========== FREE LOBBIES (sin blockchain) ==========

    socket.on("subscribeFreeLobbies", () => {
      freeLobbySubscribers.add(socket.id);
      // Send current free lobbies list
      const currentLobbies = Array.from(freeLobbies.values());
      socket.emit("freeLobbiesUpdate", currentLobbies);
      console.log(
        `[FreeLobby] ${socket.id} subscribed. Total lobbies: ${currentLobbies.length}`
      );
    });

    socket.on("unsubscribeFreeLobbies", () => {
      freeLobbySubscribers.delete(socket.id);
    });

    socket.on("createFreeLobby", (lobby: FreeLobby) => {
      // Add socket id for cleanup on disconnect
      lobby.creatorSocketId = socket.id;
      freeLobbies.set(lobby.id, lobby);

      // Join the lobby room
      socket.join(lobby.id);

      // Notify all subscribers
      const currentLobbies = Array.from(freeLobbies.values());
      for (const subId of freeLobbySubscribers) {
        io.to(subId).emit("freeLobbiesUpdate", currentLobbies);
      }
      console.log(
        `[FreeLobby] Created lobby ${lobby.id} by ${lobby.creatorAlias}`
      );
    });

    socket.on("joinFreeLobby", ({ lobbyId, odUserId, alias }) => {
      const lobby = freeLobbies.get(lobbyId);
      if (!lobby) {
        console.log(`[FreeLobby] Lobby ${lobbyId} not found`);
        return;
      }

      // Remove lobby from free lobbies
      freeLobbies.delete(lobbyId);

      // Join the match room
      socket.join(lobbyId);

      // Notify the creator that a rival joined
      io.to(lobby.creatorSocketId || lobbyId).emit("freeMatchReady", {
        matchId: lobbyId,
        rivalAlias: alias,
      });

      // Update lobbies list for all subscribers
      const currentLobbies = Array.from(freeLobbies.values());
      for (const subId of freeLobbySubscribers) {
        io.to(subId).emit("freeLobbiesUpdate", currentLobbies);
      }

      console.log(`[FreeLobby] ${alias} joined lobby ${lobbyId}`);
    });

    socket.on("cancelFreeLobby", (lobbyId: string) => {
      const lobby = freeLobbies.get(lobbyId);
      if (!lobby) return;

      freeLobbies.delete(lobbyId);

      // Notify all subscribers
      const currentLobbies = Array.from(freeLobbies.values());
      for (const subId of freeLobbySubscribers) {
        io.to(subId).emit("freeLobbiesUpdate", currentLobbies);
      }

      // Notify the room that lobby was removed
      io.to(lobbyId).emit("freeLobbyRemoved", lobbyId);

      console.log(`[FreeLobby] Cancelled lobby ${lobbyId}`);
    });

    // Handle disconnect - clean up lobby subscriptions and free lobbies
    socket.on("disconnect", () => {
      lobbySubscribers.delete(socket.id);
      freeLobbySubscribers.delete(socket.id);

      // Remove any free lobbies created by this socket
      for (const [lobbyId, lobby] of freeLobbies.entries()) {
        if (lobby.creatorSocketId === socket.id) {
          freeLobbies.delete(lobbyId);
          // Notify subscribers
          const currentLobbies = Array.from(freeLobbies.values());
          for (const subId of freeLobbySubscribers) {
            io.to(subId).emit("freeLobbiesUpdate", currentLobbies);
          }
          io.to(lobbyId).emit("freeLobbyRemoved", lobbyId);
          console.log(
            `[FreeLobby] Cleaned up lobby ${lobbyId} (creator disconnected)`
          );
        }
      }
    });
  }
);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
httpServer.listen(PORT, () => {
  console.log(`Realtime server listening on :${PORT}`);
});
