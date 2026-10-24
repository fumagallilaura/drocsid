import express from 'express';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createService } from './service.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const production = process.argv.includes('--production');
let iceServers;
try { iceServers = process.env.ICE_SERVERS ? JSON.parse(process.env.ICE_SERVERS) : undefined; }
catch { throw new Error('ICE_SERVERS deve conter um array JSON válido.'); }
if (iceServers && !Array.isArray(iceServers)) throw new Error('ICE_SERVERS deve ser um array.');
const service = createService({ dbPath: process.env.DB_PATH || resolve(root, 'data/conversa.sqlite'), iceServers });
let vite;
if (production) {
  service.app.use(express.static(resolve(root, 'dist')));
  service.app.get('/{*path}', (_req, res) => res.sendFile(resolve(root, 'dist/index.html')));
} else {
  const { createServer } = await import('vite');
  vite = await createServer({ root, server: { middlewareMode: true, hmr: { server: service.server } }, appType: 'spa' });
  service.app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 4310);
const host = process.env.HOST || '127.0.0.1';
service.server.listen(port, host, () => console.log(`Conversa disponível em http://${host}:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await vite?.close(); await service.close(); process.exit(0); });
