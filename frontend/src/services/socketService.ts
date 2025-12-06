import { io, Socket } from "socket.io-client";
import { env } from "../config/env";
import { PlayingSnapshot, MatchEvent } from "../types/game";

type ServerToClientEvents = {
  snapshot: (payload: PlayingSnapshot) => void;
  event: (payload: MatchEvent) => void;
};

type ClientToServerEvents = {
  joinMatch: (matchId: string) => void;
  input: (payload: { matchId: string; impulse: { dx: number; dy: number }; chipId: string }) => void;
  sync: () => void;
  requestRematch: () => void;
};

class SocketService {
  private socket?: Socket<ServerToClientEvents, ClientToServerEvents>;

  connect(matchId: string, side: "creator" | "challenger") {
    if (this.socket) {
      this.socket.disconnect();
    }
    this.socket = io(env.realtimeUrl, { transports: ["websocket"], query: { matchId, side } });
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
  }

  sendInput(matchId: string, chipId: string, impulse: { dx: number; dy: number }) {
    this.socket?.emit("input", { matchId, chipId, impulse });
  }

  requestRematch() {
    this.socket?.emit("requestRematch");
  }
}

export const socketService = new SocketService();
