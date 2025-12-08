import { io, Socket } from "socket.io-client";
import { PlayingSnapshot, MatchEvent, MatchLobby } from "../types/game";

// URL del servidor de tiempo real (cambiar para producción)
const REALTIME_URL = "https://beexoccer-server.onrender.com";

type ServerToClientEvents = {
  snapshot: (payload: PlayingSnapshot) => void;
  event: (payload: MatchEvent) => void;
  lobbiesUpdate: (lobbies: MatchLobby[]) => void;
  lobbyCreated: (lobby: MatchLobby) => void;
  lobbyJoined: (data: { matchId: number; challenger: string }) => void;
  matchReady: (data: { matchId: string }) => void;
};

type ClientToServerEvents = {
  joinMatch: (matchId: string) => void;
  input: (payload: { matchId: string; impulse: { dx: number; dy: number }; chipId: string }) => void;
  sync: () => void;
  requestRematch: () => void;
  subscribeLobbies: () => void;
  unsubscribeLobbies: () => void;
};

class SocketService {
  private socket?: Socket<ServerToClientEvents, ClientToServerEvents>;
  private lobbiesCallbacks: ((lobbies: MatchLobby[]) => void)[] = [];
  private lobbyCreatedCallbacks: ((lobby: MatchLobby) => void)[] = [];
  private matchReadyCallbacks: ((matchId: string) => void)[] = [];
  private connectionFailed = false;
  private currentMatchId?: string;
  private currentSide?: "creator" | "challenger";

  connect(matchId: string, side: "creator" | "challenger") {
    if (this.connectionFailed) return;
    if (this.socket) {
      this.socket.disconnect();
    }
    
    this.currentMatchId = matchId;
    this.currentSide = side;
    
    try {
      this.socket = io(REALTIME_URL, { 
        transports: ["websocket"], 
        query: { matchId, side },
        timeout: 5000,
        reconnectionAttempts: 3
      });
      
      this.socket.on("connect_error", () => {
        this.connectionFailed = true;
        this.socket?.disconnect();
      });
    } catch {
      this.connectionFailed = true;
    }
  }

  connectLobbies() {
    if (this.connectionFailed) return;
    if (this.socket) return;
    
    try {
      this.socket = io(REALTIME_URL, { 
        transports: ["websocket"],
        timeout: 5000,
        reconnectionAttempts: 3
      });
      
      this.socket.on("connect_error", () => {
        this.connectionFailed = true;
        this.socket?.disconnect();
      });
      
      this.socket.on("connect", () => {
        this.socket?.emit("subscribeLobbies");
      });
    
      this.socket.on("lobbiesUpdate", (lobbies) => {
        for (const cb of this.lobbiesCallbacks) cb(lobbies);
      });
      
      this.socket.on("lobbyCreated", (lobby) => {
        for (const cb of this.lobbyCreatedCallbacks) cb(lobby);
      });
    } catch {
      this.connectionFailed = true;
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

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
