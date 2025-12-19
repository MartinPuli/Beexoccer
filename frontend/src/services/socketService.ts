import { io, Socket } from "socket.io-client";
import {
  PlayingSnapshot,
  MatchEvent,
  MatchLobby,
  GoalTarget,
} from "../types/game";
import { env } from "../config/env";

// URL del servidor de tiempo real
const REALTIME_URL = env.realtimeUrl;

// Tipo para lobbies gratuitos (solo socket, sin blockchain)
interface FreeLobby {
  id: string;
  creator: string;
  creatorAlias: string;
  goals: GoalTarget;
  createdAt: number;
}

type ServerToClientEvents = {
  snapshot: (payload: PlayingSnapshot) => void;
  event: (payload: MatchEvent) => void;
  lobbiesUpdate: (lobbies: MatchLobby[]) => void;
  lobbyCreated: (lobby: MatchLobby) => void;
  lobbyJoined: (data: {
    matchId: string;
    challenger: string;
    challengerAlias: string;
  }) => void;
  matchReady: (data: { matchId: string }) => void;
  lobbyCancelled: (data: { matchId: string }) => void;
  matchEnded: (data: {
    winner: "creator" | "challenger";
    reason: string;
  }) => void;
  playerForfeited: (data: { side: "creator" | "challenger" }) => void;
  pong: () => void;
  // Rematch events
  rematchRequested: (data: {
    fromSide: "creator" | "challenger";
    fromAlias: string;
    matchId: string;
  }) => void;
  rematchAccepted: (data: { matchId: string }) => void;
  rematchDeclined: (data: { bySide: "creator" | "challenger" }) => void;
  // Rematch with blockchain
  rematchBlockchainRequired: (data: {
    oldMatchId: string;
    matchConfig: {
      isFree: boolean;
      stakeAmount: string;
      stakeToken: string;
      goals: number;
    };
    initiatorSide: "creator" | "challenger";
  }) => void;
  rematchBlockchainReady: (data: { 
    newMatchId: string; 
    oldMatchId: string;
  }) => void;
  // Free lobbies events
  freeLobbiesUpdate: (lobbies: FreeLobby[]) => void;
  freeMatchReady: (data: { matchId: string; rivalAlias: string }) => void;
  freeLobbyRemoved: (lobbyId: string) => void;
};

type ClientToServerEvents = {
  joinMatch: (matchId: string) => void;
  input: (payload: {
    matchId: string;
    impulse: { dx: number; dy: number };
    chipId: string;
  }) => void;
  sync: () => void;
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
  turnTimeout: (payload: { matchId: string }) => void;
  forfeit: (payload: { matchId: string }) => void;
  subscribeLobbies: () => void;
  unsubscribeLobbies: () => void;
  createLobby: (payload: {
    matchId: string;
    creator: string;
    creatorAlias: string;
    goals: number;
    isFree: boolean;
    stakeAmount: string;
  }) => void;
  joinLobby: (payload: {
    matchId: string;
    challenger: string;
    challengerAlias: string;
  }) => void;
  cancelLobby: (payload: { matchId: string }) => void;
  ping: () => void;
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
};

class SocketService {
  private socket?: Socket<ServerToClientEvents, ClientToServerEvents>;
  private lobbiesCallbacks: ((lobbies: MatchLobby[]) => void)[] = [];
  private lobbyCreatedCallbacks: ((lobby: MatchLobby) => void)[] = [];
  private matchReadyCallbacks: ((matchId: string) => void)[] = [];
  private snapshotCallbacks: ((payload: PlayingSnapshot) => void)[] = [];
  private eventCallbacks: ((payload: MatchEvent) => void)[] = [];
  private connectionCallbacks: ((connected: boolean) => void)[] = [];
  // Rematch callbacks
  private rematchRequestedCallbacks: ((data: {
    fromSide: "creator" | "challenger";
    fromAlias: string;
    matchId: string;
  }) => void)[] = [];
  private rematchAcceptedCallbacks: ((data: { matchId: string }) => void)[] =
    [];
  private rematchDeclinedCallbacks: ((data: {
    bySide: "creator" | "challenger";
  }) => void)[] = [];
  // Free lobbies callbacks
  private freeLobbiesCallbacks: ((lobbies: FreeLobby[]) => void)[] = [];
  private freeMatchReadyCallbacks: ((data: {
    matchId: string;
    rivalAlias: string;
  }) => void)[] = [];
  private freeLobbyRemovedCallbacks: ((lobbyId: string) => void)[] = [];

  private retryCount = 0;
  private readonly maxRetries = 10;
  private currentMatchId?: string;
  private currentSide?: "creator" | "challenger";
  private reconnecting = false;
  private latency = 0;
  private pingInterval?: ReturnType<typeof setInterval>;

  connect(
    matchId: string,
    side: "creator" | "challenger",
    goalTarget?: number
  ) {
    if (this.socket?.connected && this.currentMatchId === matchId) {
      return; // Ya conectado a este match
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    this.currentMatchId = matchId;
    this.currentSide = side;
    this.retryCount = 0;

    try {
      this.socket = io(REALTIME_URL, {
        transports: ["websocket", "polling"],
        query: { matchId, side, goals: goalTarget?.toString() || "3" },
        timeout: 15000,
        reconnection: true,
        reconnectionAttempts: this.maxRetries,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      this.socket.on("connect_error", (err) => {
        console.warn("[Socket] Connection error:", err.message);
        this.retryCount++;
        this.notifyConnection(false);
        if (this.retryCount >= this.maxRetries) {
          console.error("[Socket] Max retries reached, giving up");
          this.socket?.disconnect();
        }
      });

      this.socket.on("connect", () => {
        console.log("[Socket] Connected to server");
        this.retryCount = 0;
        this.reconnecting = false;
        this.notifyConnection(true);
        this.startPing();
        // Solicitar sync inmediatamente
        setTimeout(() => this.requestSync(), 100);
      });

      this.socket.on("disconnect", (reason) => {
        console.warn("[Socket] Disconnected:", reason);
        this.notifyConnection(false);
        this.stopPing();

        // Intentar reconectar automáticamente si fue desconexión inesperada
        if (reason === "io server disconnect" || reason === "transport close") {
          this.reconnecting = true;
          setTimeout(() => {
            if (
              this.currentMatchId &&
              this.currentSide &&
              !this.socket?.connected
            ) {
              this.connect(this.currentMatchId, this.currentSide);
            }
          }, 1000);
        }
      });

      // Re-registrar callbacks de snapshot
      this.socket.on("snapshot", (payload) => {
        for (const cb of this.snapshotCallbacks) cb(payload);
      });

      this.socket.on("event", (payload) => {
        for (const cb of this.eventCallbacks) cb(payload);
      });

      // Ping/pong para medir latencia
      this.socket.on("pong", () => {
        // Latencia calculada en startPing
      });
    } catch (err) {
      console.error("[Socket] Failed to create socket:", err);
    }
  }

  private startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.socket?.connected) {
        const start = Date.now();
        this.socket.emit("ping");
        this.socket.once("pong", () => {
          this.latency = Date.now() - start;
        });
      }
    }, 5000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }

  private notifyConnection(connected: boolean) {
    for (const cb of this.connectionCallbacks) cb(connected);
  }

  onConnectionChange(cb: (connected: boolean) => void) {
    this.connectionCallbacks.push(cb);
  }

  getLatency(): number {
    return this.latency;
  }

  isReconnecting(): boolean {
    return this.reconnecting;
  }

  connectLobbies() {
    if (this.socket?.connected) {
      this.socket.emit("subscribeLobbies");
      return;
    }

    try {
      this.socket = io(REALTIME_URL, {
        transports: ["websocket", "polling"],
        timeout: 10000,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.socket.on("connect_error", () => {
        this.retryCount++;
      });

      this.socket.on("connect", () => {
        this.retryCount = 0;
        this.socket?.emit("subscribeLobbies");
      });

      this.socket.on("lobbiesUpdate", (lobbies) => {
        for (const cb of this.lobbiesCallbacks) cb(lobbies);
      });

      this.socket.on("lobbyCreated", (lobby) => {
        for (const cb of this.lobbyCreatedCallbacks) cb(lobby);
      });
    } catch {
      // Silently fail
    }
  }

  getCurrentSide(): "creator" | "challenger" | undefined {
    return this.currentSide;
  }

  getCurrentMatchId(): string | undefined {
    return this.currentMatchId;
  }

  onLobbiesUpdate(cb: (lobbies: MatchLobby[]) => void) {
    this.lobbiesCallbacks.push(cb);
  }

  onLobbyCreated(cb: (lobby: MatchLobby) => void) {
    this.lobbyCreatedCallbacks.push(cb);
  }

  onMatchReady(cb: (matchId: string) => void) {
    this.matchReadyCallbacks.push(cb);
    this.socket?.on("matchReady", (data) => cb(data.matchId));
  }

  offLobbies() {
    this.lobbiesCallbacks = [];
    this.lobbyCreatedCallbacks = [];
    this.socket?.off("lobbiesUpdate");
    this.socket?.off("lobbyCreated");
    this.socket?.off("lobbyCancelled");
  }

  disconnect() {
    this.stopPing();
    this.socket?.disconnect();
    this.socket = undefined;
    this.currentMatchId = undefined;
    this.currentSide = undefined;
    this.reconnecting = false;
  }

  onSnapshot(cb: (payload: PlayingSnapshot) => void) {
    this.snapshotCallbacks.push(cb);
    // También registrar directamente si el socket ya existe
    this.socket?.on("snapshot", cb);
  }

  onEvent(cb: (payload: MatchEvent) => void) {
    this.eventCallbacks.push(cb);
    this.socket?.on("event", cb);
  }

  offAll() {
    this.snapshotCallbacks = [];
    this.eventCallbacks = [];
    this.connectionCallbacks = [];
    this.socket?.off("snapshot");
    this.socket?.off("event");
    this.socket?.off("matchReady");
    this.socket?.off("matchEnded");
    this.socket?.off("playerForfeited");
    this.offLobbies();
    this.offRematch();
    this.matchReadyCallbacks = [];
  }

  sendInput(
    matchId: string,
    chipId: string,
    impulse: { dx: number; dy: number }
  ) {
    this.socket?.emit("input", { matchId, chipId, impulse });
  }

  requestSync() {
    this.socket?.emit("sync");
  }

  requestRematch(matchId: string, alias: string) {
    this.socket?.emit("requestRematch", { matchId, alias });
  }

  acceptRematch(matchId: string) {
    this.socket?.emit("acceptRematch", { matchId });
  }

  declineRematch(matchId: string) {
    this.socket?.emit("declineRematch", { matchId });
  }

  onRematchRequested(
    cb: (data: {
      fromSide: "creator" | "challenger";
      fromAlias: string;
      matchId: string;
    }) => void
  ) {
    this.rematchRequestedCallbacks.push(cb);
    this.socket?.on("rematchRequested", cb);
  }

  onRematchAccepted(cb: (data: { matchId: string }) => void) {
    this.rematchAcceptedCallbacks.push(cb);
    this.socket?.on("rematchAccepted", cb);
  }

  onRematchDeclined(cb: (data: { bySide: "creator" | "challenger" }) => void) {
    this.rematchDeclinedCallbacks.push(cb);
    this.socket?.on("rematchDeclined", cb);
  }

  offRematch() {
    this.rematchRequestedCallbacks = [];
    this.rematchAcceptedCallbacks = [];
    this.rematchDeclinedCallbacks = [];
    this.socket?.off("rematchRequested");
    this.socket?.off("rematchAccepted");
    this.socket?.off("rematchDeclined");
    this.socket?.off("rematchBlockchainRequired");
    this.socket?.off("rematchBlockchainReady");
  }

  // Rematch blockchain handlers
  onRematchBlockchainRequired(
    cb: (data: {
      oldMatchId: string;
      matchConfig: {
        isFree: boolean;
        stakeAmount: string;
        stakeToken: string;
        goals: number;
      };
      initiatorSide: "creator" | "challenger";
    }) => void
  ) {
    this.socket?.on("rematchBlockchainRequired", cb);
  }

  onRematchBlockchainReady(
    cb: (data: { newMatchId: string; oldMatchId: string }) => void
  ) {
    this.socket?.on("rematchBlockchainReady", cb);
  }

  notifyRematchBlockchainCreated(oldMatchId: string, newMatchId: string, creatorAddress: string) {
    this.socket?.emit("rematchBlockchainCreated", { oldMatchId, newMatchId, creatorAddress });
  }

  notifyRematchBlockchainJoined(oldMatchId: string, newMatchId: string) {
    this.socket?.emit("rematchBlockchainJoined", { oldMatchId, newMatchId });
  }

  sendTimeout(matchId: string) {
    this.socket?.emit("turnTimeout", { matchId });
  }

  sendForfeit(matchId: string) {
    this.socket?.emit("forfeit", { matchId });
  }

  onPlayerForfeited(cb: (side: "creator" | "challenger") => void) {
    this.socket?.on("playerForfeited", (data) => cb(data.side));
  }

  onMatchEnded(
    cb: (data: { winner: "creator" | "challenger"; reason: string }) => void
  ) {
    this.socket?.on("matchEnded", cb);
  }

  // Lobby management methods
  createLobby(
    matchId: string,
    creator: string,
    creatorAlias: string,
    goals: number,
    isFree: boolean,
    stakeAmount: string
  ) {
    const payload = {
      matchId,
      creator,
      creatorAlias,
      goals,
      isFree,
      stakeAmount,
    };
    if (this.socket?.connected) {
      this.socket.emit("createLobby", payload);
    } else {
      // Connect first, then emit when connected
      this.connectLobbies();
      this.socket?.once("connect", () => {
        this.socket?.emit("createLobby", payload);
      });
    }
  }

  joinLobby(matchId: string, challenger: string, challengerAlias: string) {
    if (!this.socket?.connected) {
      this.connectLobbies();
      this.socket?.once("connect", () => {
        this.socket?.emit("joinLobby", {
          matchId,
          challenger,
          challengerAlias,
        });
      });
    } else {
      this.socket.emit("joinLobby", { matchId, challenger, challengerAlias });
    }
  }

  cancelLobby(matchId: string) {
    if (!this.socket?.connected) {
      this.connectLobbies();
      this.socket?.once("connect", () => {
        this.socket?.emit("cancelLobby", { matchId });
      });
    } else {
      this.socket.emit("cancelLobby", { matchId });
    }
  }

  onLobbyCancelled(cb: (matchId: string) => void) {
    this.socket?.on("lobbyCancelled", (data) => cb(data.matchId));
  }

  onLobbyJoined(
    cb: (data: {
      matchId: string;
      challenger: string;
      challengerAlias: string;
    }) => void
  ) {
    this.socket?.on("lobbyJoined", cb);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // ========== FREE LOBBIES (sin blockchain) ==========

  connectFreeLobbies() {
    if (this.socket?.connected) {
      this.socket.emit("subscribeFreeLobbies");
      return;
    }

    try {
      this.socket = io(REALTIME_URL, {
        transports: ["websocket", "polling"],
        timeout: 10000,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.socket.on("connect", () => {
        this.retryCount = 0;
        this.socket?.emit("subscribeFreeLobbies");
      });

      this.socket.on("freeLobbiesUpdate", (lobbies) => {
        for (const cb of this.freeLobbiesCallbacks) cb(lobbies);
      });

      this.socket.on("freeMatchReady", (data) => {
        for (const cb of this.freeMatchReadyCallbacks) cb(data);
      });

      this.socket.on("freeLobbyRemoved", (lobbyId) => {
        for (const cb of this.freeLobbyRemovedCallbacks) cb(lobbyId);
      });
    } catch {
      // Silently fail
    }
  }

  disconnectFreeLobbies() {
    this.socket?.emit("unsubscribeFreeLobbies");
    this.freeLobbiesCallbacks = [];
    this.freeMatchReadyCallbacks = [];
    this.freeLobbyRemovedCallbacks = [];
    this.socket?.off("freeLobbiesUpdate");
    this.socket?.off("freeMatchReady");
    this.socket?.off("freeLobbyRemoved");
  }

  onFreeLobbiesUpdate(cb: (lobbies: FreeLobby[]) => void) {
    this.freeLobbiesCallbacks.push(cb);
  }

  onFreeMatchReady(
    cb: (data: { matchId: string; rivalAlias: string }) => void
  ) {
    this.freeMatchReadyCallbacks.push(cb);
  }

  onFreeLobbyRemoved(cb: (lobbyId: string) => void) {
    this.freeLobbyRemovedCallbacks.push(cb);
  }

  createFreeLobby(lobby: FreeLobby) {
    if (!this.socket?.connected) {
      this.connectFreeLobbies();
      this.socket?.once("connect", () => {
        this.socket?.emit("createFreeLobby", lobby);
      });
    } else {
      this.socket.emit("createFreeLobby", lobby);
    }
  }

  joinFreeLobby(lobbyId: string, data: { odUserId: string; alias: string }) {
    if (!this.socket?.connected) {
      this.connectFreeLobbies();
      this.socket?.once("connect", () => {
        this.socket?.emit("joinFreeLobby", { lobbyId, ...data });
      });
    } else {
      this.socket.emit("joinFreeLobby", { lobbyId, ...data });
    }
  }

  cancelFreeLobby(lobbyId: string) {
    if (!this.socket?.connected) {
      this.connectFreeLobbies();
      this.socket?.once("connect", () => {
        this.socket?.emit("cancelFreeLobby", lobbyId);
      });
    } else {
      this.socket.emit("cancelFreeLobby", lobbyId);
    }
  }
}

export const socketService = new SocketService();
