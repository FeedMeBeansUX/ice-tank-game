/**
 * Minimal type description for the parts of the "ws" WebSocket library this
 * server uses (the library itself ships without types).
 */
declare module 'ws' {
  import type { Server as HttpServer } from 'node:http';

  export class WebSocket {
    static readonly OPEN: number;
    readonly OPEN: number;
    readonly readyState: number;
    send(data: string): void;
    close(code?: number, reason?: string): void;
    on(event: 'message', listener: (data: Buffer | ArrayBuffer | Buffer[]) => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
  }

  export class WebSocketServer {
    constructor(options: { server?: HttpServer; port?: number; path?: string });
    on(event: 'connection', listener: (socket: WebSocket) => void): this;
    close(callback?: () => void): void;
  }

  export default WebSocket;
}
