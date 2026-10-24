import { createServer, type IncomingMessage } from 'node:http';
import { HttpError, login, register } from './auth.ts';
import { createGateway } from './gateway.ts';

const MAX_BODY = 10_000;

async function readJson(req: IncomingMessage) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > MAX_BODY) throw new HttpError(413, 'Corpo da requisição muito grande');
  }
  try {
    return JSON.parse(body) ?? {};
  } catch {
    throw new HttpError(400, 'JSON inválido');
  }
}

export function createApp({ heartbeatInterval = 41_250 } = {}) {
  const gateway = createGateway(heartbeatInterval);

  const server = createServer(async (req, res) => {
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    try {
      if (req.method === 'POST' && req.url === '/api/auth/register') {
        const { username, password } = await readJson(req);
        return json(201, await register(username, password));
      }
      if (req.method === 'POST' && req.url === '/api/auth/login') {
        const { username, password } = await readJson(req);
        return json(200, await login(username, password));
      }
      json(404, { error: 'Não encontrado' });
    } catch (err) {
      if (err instanceof HttpError) return json(err.status, { error: err.message });
      console.error(err);
      json(500, { error: 'Erro interno' });
    }
  });

  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/gateway') return socket.destroy();
    gateway.handleUpgrade(req, socket, head, (ws) => gateway.emit('connection', ws, req));
  });

  return server;
}
