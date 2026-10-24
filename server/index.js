import express from 'express';
import { posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createService, logFailure } from './service.js';
import { LIMITS, ProtocolError, parsePort, readIceServers } from '../shared/protocol.js';

const root = fileURLToPath(new URL('../', import.meta.url));

export async function startServer({ env = process.env, production = process.argv.includes('--production') } = {}) {
  let port, iceServers;
  try {
    port = parsePort(env.PORT ?? '4310');
    iceServers = readIceServers(env.ICE_SERVERS === undefined ? undefined : JSON.parse(env.ICE_SERVERS));
  } catch (cause) { throw new ProtocolError('INVALID_INPUT', 'Configuração PORT ou ICE_SERVERS inválida.'); }
  let service, vite, closing;
  const close = () => {
    if (closing) return closing;
    process.removeListener('SIGINT', onSignal); process.removeListener('SIGTERM', onSignal);
    closing = (async () => {
      let timer;
      try {
        const results = await Promise.race([
          Promise.allSettled([service?.close(), vite?.close()]),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new ProtocolError('SHUTDOWN_FAILED')), LIMITS.shutdownMs); }),
        ]);
        if (results.some(result => result.status === 'rejected')) throw new ProtocolError('SHUTDOWN_FAILED');
      } finally { clearTimeout(timer); }
    })();
    return closing;
  };
  const onSignal = () => { void close().then(() => process.exit(0), cause => { logFailure('shutdown', 'SHUTDOWN_FAILED', null, cause); process.exit(1); }); };
  try {
    service = createService({ dbPath: env.DB_PATH || resolve(root, 'data/conversa.sqlite'), iceServers });
    if (production) {
      service.app.use(express.static(resolve(root, 'dist')));
      service.app.get('/{*path}', (_req, res) => res.sendFile(resolve(root, 'dist/index.html')));
    } else {
      const { createServer } = await import('vite');
      const existing = new Set(service.server.listeners('upgrade'));
      vite = await createServer({ root, server: { middlewareMode: true, hmr: { server: service.server } }, appType: 'spa' });
      // Vite installs its listener on this server. Route it through the owner so
      // unknown upgrades are rejected and no socket is handled twice.
      const consumers = service.server.listeners('upgrade').filter(handler => !existing.has(handler));
      for (const handler of consumers) service.server.removeListener('upgrade', handler);
      const hmr = vite.config.server.hmr;
      const path = typeof hmr === 'object' && hmr.path ? posix.join(vite.config.base, hmr.path) : vite.config.base;
      service.setDevelopmentUpgrade((req, socket, head) => {
        if (!consumers.length || !['vite-hmr', 'vite-ping'].includes(req.headers['sec-websocket-protocol']) || new URL(req.url, 'http://localhost').pathname !== path) return false;
        for (const handler of consumers) handler.call(service.server, req, socket, head);
        return true;
      });
      service.app.use(vite.middlewares);
    }
    await new Promise((resolveListen, reject) => {
      service.server.once('error', reject);
      service.server.listen(port, env.HOST || '127.0.0.1', () => { service.server.removeListener('error', reject); resolveListen(); });
    });
    process.once('SIGINT', onSignal); process.once('SIGTERM', onSignal);
    console.log(`Conversa disponível em http://${env.HOST || '127.0.0.1'}:${service.server.address().port}`);
    return { ...service, close };
  } catch (cause) {
    try { await close(); } catch (cleanupError) { logFailure('shutdown', 'SHUTDOWN_FAILED', null, cleanupError); }
    const error = new ProtocolError('BOOTSTRAP_FAILED', 'Não foi possível iniciar o servidor.'); error.cause = cause;
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await startServer(); }
  catch (cause) { logFailure('bootstrap', cause.code || 'BOOTSTRAP_FAILED', null, cause); process.exitCode = 1; }
}
