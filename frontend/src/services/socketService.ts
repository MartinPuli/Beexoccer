import { io, Socket } from "socket.io-client";
import { PlayingSnapshot, MatchEvent, MatchLobby } from "../types/game";
import { env } from "../config/env";

// URL del servidor de tiempo real
const REALTIME_URL = env.realtimeUrl;

type ServerToClientEvents = {
  snapshot: (payload: PlayingSnapshot) => void;
  event: (payload: MatchEvent) => void;
  lobbiesUpdate: (lobbies: MatchLobby[]) => void;
  lobbyCreated: (lobby: MatchLobby) => void;
  lobbyJoined: (data: { matchId: string; challenger: string; challengerAlias: string }) => void;
  matchReady: (data: { matchId: string }) => void;
  lobbyCancelled: (data: { matchId: string }) => void;
  matchEnded: (data: { winner: "creator" | "challenger"; reason: string }) => void;
  playerForfeited: (data: { side: "creator" | "challenger" }) => void;
};

type ClientToServerEvents = {
  joinMatch: (matchId: string) => void;
  input: (payload: { matchId: string; impulse: { dx: number; dy: number }; chipId: string }) => void;
  sync: () => void;
  requestRematch: () => void;
  turnTimeout: (payload: { matchId: string }) => void;
  forfeit: (payload: { matchId: string }) => void;
  subscribeLobbies: () => void;
  unsubscribeLobbies: () => void;
  createLobby: (payload: { matchId: string; creator: string; creatorAlias: string; goals: number; isFree: boolean; stakeAmount: string }) => void;
  joinLobby: (payload: { matchId: string; challenger: string; challengerAlias: string }) => void;
  cancelLobby: (payload: { matchId: string }) => void;
};

class SocketService {
  private socket?: Socket<ServerToClientEvents, ClientToServerEvents>;
  private lobbiesCallbacks: ((lobbies: MatchLobby[]) => void)[] = [];
  private lobbyCreatedCallbacks: ((lobby: MatchLobby) => void)[] = [];
  private matchReadyCallbacks: ((matchId: string) => void)[] = [];
  private retryCount = 0;
  private readonly maxRetries = 5;
  private currentMatchId?: string;
  private currentSide?: "creator" | "challenger";

  connect(matchId: string, side: "creator" | "challenger") {
    if (this.socket) {
      this.socket.disconnect();
    }
    
    this.currentMatchId = matchId;
    this.currentSide = side;
    
    try {
      this.socket = io(REALTIME_URL, { 
        transports: ["websocket", "polling"], 
        query: { matchId, side },
        timeout: 10000,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });
      
      this.socket.on("connect_error", () => {
        this.retryCount++;
        if (this.retryCount >= this.maxRetries) {
          this.socket?.disconnect();
        }
      });
      
      this.socket.on("connect", () => {
        this.retryCount = 0;
      });
    } catch {
      // Silently fail
    }
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
        reconnectionDelay: 1000
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
    this.socket?.disconnect();
    this.socket = undefined;
    this.currentMatchId = undefined;
    this.currentSide = undefined;
  }

  onSnapshot(cb: (payload: PlayingSnapshot) => void) {
    this.socket?.on("snapshot", cb);
  }

  onEvent(cb: (payload: MatchEvent) => void) {
    this.socket?.on("event", cb);
  }

  offAll() {
    this.socket?.off("snapshot");
    this.socket?.off("event");
    this.socket?.off("matchReady");
    this.offLobbies();
    this.matchReadyCallbacks = [];
  }

  sendInput(matchId: string, chipId: string, impulse: { dx: number; dy: number }) {
    this.socket?.emit("input", { matchId, chipId, impulse });
  }

  requestSync() {
    this.socket?.emit("sync");
  }

  requestRematch() {
    this.socket?.emit("requestRematch");
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

  onMatchEnded(cb: (data: { winner: "creator" | "challenger"; reason: string }) => void) {
    this.socket?.on("matchEnded", cb);
  }

  // Lobby management methods
  createLobby(matchId: string, creator: string, creatorAlias: string, goals: number, isFree: boolean, stakeAmount: string) {
    const payload = { matchId, creator, creatorAlias, goals, isFree, stakeAmount };
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
        this.socket?.emit("joinLobby", { matchId, challenger, challengerAlias });
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

  onLobbyJoined(cb: (data: { matchId: string; challenger: string; challengerAlias: string }) => void) {
    this.socket?.on("lobbyJoined", cb);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
