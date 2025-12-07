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

  connect(matchId: string, side: "creator" | "challenger") {
    if (this.socket) {
      this.socket.disconnect();
    }
    this.socket = io(env.realtimeUrl, { transports: ["websocket"], query: { matchId, side } });
  }

  connectLobbies() {
    if (this.socket) return;
    this.socket = io(env.realtimeUrl, { transports: ["websocket"] });
    this.socket.emit("subscribeLobbies");
    
    this.socket.on("lobbiesUpdate", (lobbies) => {
      for (const cb of this.lobbiesCallbacks) cb(lobbies);
    });
    
    this.socket.on("lobbyCreated", (lobby) => {
      for (const cb of this.lobbyCreatedCallbacks) cb(lobby);
    });
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
