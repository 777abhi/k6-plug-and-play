import ws, { Response as WsResponse, Socket } from 'k6/ws';
import { EnvConfig } from '../config/env.js';
import { AuthProvider, NoAuthProvider } from './auth.js';

export interface WsSessionHandlers {
  onOpen?: (socket: Socket) => void;
  onMessage?: (socket: Socket, data: string) => void;
  onError?: (err: unknown) => void;
  onClose?: () => void;
}

export class WebSocketClient {
  private readonly baseWsUrl: string;
  private readonly authProvider: AuthProvider;

  constructor(config: EnvConfig, authProvider: AuthProvider = new NoAuthProvider()) {
    this.baseWsUrl = config.baseUrl.replace(/^http/, 'ws');
    this.authProvider = authProvider;
  }

  public connect(
    path: string,
    handlers: WsSessionHandlers,
    tags: Record<string, string> = {}
  ): WsResponse {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${this.baseWsUrl}${cleanPath}`;
    const headers = this.authProvider.getHeaders();

    return ws.connect(url, { headers, tags }, (socket) => {
      socket.on('open', () => {
        handlers.onOpen?.(socket);
      });

      socket.on('message', (data: string) => {
        handlers.onMessage?.(socket, data);
      });

      socket.on('error', (err) => {
        console.error(JSON.stringify({ level: 'error', type: 'ws_error', url, err: String(err) }));
        handlers.onError?.(err);
      });

      socket.on('close', () => {
        handlers.onClose?.();
      });
    });
  }
}
