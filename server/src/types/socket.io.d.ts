declare module "socket.io" {
  export interface ServerOptions {
    cors?: { origin?: string | string[]; methods?: string[] };
  }

  export class Server<ListenEvents = any, EmitEvents = any, ReservedEvents = any, Data = any> {
    constructor(httpServer?: any, options?: ServerOptions);
    on(event: "connection", listener: (socket: Socket<ListenEvents, EmitEvents, ReservedEvents, Data>) => void): this;
    to(room: string): {
      emit<E extends keyof EmitEvents>(event: E, ...args: EmitEvents[E] extends (...inner: any[]) => any ? Parameters<EmitEvents[E]> : never): boolean;
    };
    emit<E extends keyof EmitEvents>(event: E, ...args: EmitEvents[E] extends (...inner: any[]) => any ? Parameters<EmitEvents[E]> : never): boolean;
  }

  export class Socket<ListenEvents = any, EmitEvents = any, ReservedEvents = any, Data = any> {
    id: string;
    data: Data;
    handshake: { query: Record<string, string | string[] | undefined> };
    join(room: string): Promise<void> | void;
    emit<E extends keyof EmitEvents>(event: E, ...args: EmitEvents[E] extends (...inner: any[]) => any ? Parameters<EmitEvents[E]> : never): boolean;
    on<E extends keyof ListenEvents>(event: E, listener: ListenEvents[E]): this;
  }
}
