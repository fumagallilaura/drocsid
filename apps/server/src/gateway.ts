import { WebSocketServer } from 'ws';
import { userFromToken, type User } from './auth.ts';

// Mesmo desenho do gateway documentado do Discord: https://discord.com/developers/docs/events/gateway
export const Op = { DISPATCH: 0, HEARTBEAT: 1, IDENTIFY: 2, HELLO: 10, HEARTBEAT_ACK: 11 } as const;
export const Close = {
  UNKNOWN_OPCODE: 4001,
  DECODE_ERROR: 4002,
  AUTHENTICATION_FAILED: 4004,
  ALREADY_AUTHENTICATED: 4005,
  SESSION_TIMED_OUT: 4009,
} as const;

export function createGateway(heartbeatInterval: number) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });

  wss.on('connection', (ws) => {
    let user: User | null = null;
    let seq = 0;
    let timeout: NodeJS.Timeout | undefined;

    const send = (op: number, d: unknown, t?: string) =>
      ws.send(JSON.stringify(op === Op.DISPATCH ? { op, d, s: ++seq, t } : { op, d }));
    const resetTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => ws.close(Close.SESSION_TIMED_OUT, 'Heartbeat não recebido'), heartbeatInterval * 1.5);
    };

    ws.on('close', () => clearTimeout(timeout));
    send(Op.HELLO, { heartbeat_interval: heartbeatInterval });
    resetTimeout();

    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return ws.close(Close.DECODE_ERROR, 'JSON inválido');
      }
      switch (msg?.op) {
        case Op.HEARTBEAT:
          resetTimeout();
          return send(Op.HEARTBEAT_ACK, null);
        case Op.IDENTIFY: {
          if (user) return ws.close(Close.ALREADY_AUTHENTICATED, 'Já autenticado');
          const token = msg.d?.token;
          user = typeof token === 'string' ? await userFromToken(token) : null;
          if (!user) return ws.close(Close.AUTHENTICATION_FAILED, 'Token inválido');
          return send(Op.DISPATCH, { user }, 'READY');
        }
        default:
          return ws.close(Close.UNKNOWN_OPCODE, 'Opcode desconhecido');
      }
    });
  });

  return wss;
}
