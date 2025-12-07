import { io, Socket } from "socket.io-client";
import { env } from "../config/env";
import { PlayingSnapshot, MatchEvent, MatchLobby } from "../types/game";

type ServerToClientEvents = {
  snapshot: (payload: PlayingSnapshot) => void;
  event: (payload: MatchEvent) => void;
  lobbiesUpdate: (lobbies: MatchLobby[]) => void;
  lobbyCreated: (lobby: MatchLobby) => void;
  lobbyJoined: (data: { matchId: number; challenger: string }) => void;
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
  private connectionFailed = false;
  private disabled = !env.enableRealtime; // Deshabilitar si VITE_ENABLE_REALTIME != "true"

  connect(matchId: string, side: "creator" | "challenger") {
    if (this.disabled || this.connectionFailed) return; // Skip if disabled or server unavailable
    if (this.socket) {
      this.socket.disconnect();
    }
    try {
      this.socket = io(env.realtimeUrl, { 
        transports: ["websocket"], 
        query: { matchId, side },
        timeout: 5000,
        reconnectionAttempts: 2
      });
      this.socket.on("connect_error", () => {
        console.warn("Realtime server unavailable - running in offline mode");
        this.connectionFailed = true;
        this.socket?.disconnect();
      });
    } catch {
      console.warn("Socket connection failed");
      this.connectionFailed = true;
    }
  }

  connectLobbies() {
    if (this.disabled || this.connectionFailed) return; // Skip if disabled or server unavailable
    if (this.socket) return;
    try {
      this.socket = io(env.realtimeUrl, { 
        transports: ["websocket"],
        timeout: 5000,
        reconnectionAttempts: 2
      });
      
      this.socket.on("connect_error", () => {
        console.warn("Realtime server unavailable - lobbies will use blockchain only");
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
    } catch (error) {
      console.warn("Socket lobbies connection failed", error);
      this.connectionFailed = true;
    }
  }

  onLobbiesUpdate(cb: (lobbies: MatchLobby[]) => void) {
    this.lobbiesCallbacks.push(cb);
  }

  onLobbyCreated(cb: (lobby: MatchLobby) => void) {
    this.lobbyCreatedCallbacks.push(cb);
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
    this.offLobbies();
  }

  sendInput(matchId: string, chipId: string, impulse: { dx: number; dy: number }) {
    this.socket?.emit("input", { matchId, chipId, impulse });
  }

  requestRematch() {
    this.socket?.emit("requestRematch");
  }
}

export const socketService = new SocketService();
