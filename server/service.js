import express from 'express';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';

export function createService({ dbPath = 'data/conversa.sqlite', iceServers = [{ urls: 'stun:stun.l.google.com:19302' }] } = {}) {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, room TEXT NOT NULL, author TEXT NOT NULL, text TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS messages_room_created ON messages(room, created);`);
  const addRoom = db.prepare('INSERT OR IGNORE INTO rooms VALUES (?, ?, ?)');
  addRoom.run('geral', 'geral', 'O ponto de encontro do seu grupo');
  addRoom.run('projetos', 'projetos', 'Ideias que ficam melhores em conjunto');
  addRoom.run('cafe', 'café', 'Uma pausa para colocar o papo em dia');
  const roomsQuery = db.prepare('SELECT * FROM rooms ORDER BY rowid');
  const roomQuery = db.prepare('SELECT * FROM rooms WHERE id = ?');
  // Preserve insertion order for messages with identical timestamps.
  const history = db.prepare('SELECT id, room, author, text, created FROM (SELECT rowid AS sequence, * FROM messages WHERE room = ? ORDER BY rowid DESC LIMIT 200) ORDER BY sequence');
  const insertMessage = db.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?)');
  const app = express();
  app.disable('x-powered-by');
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  const isLocalOrigin = origin => { try { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname); } catch { return false; } };
  app.get('/api/config', (req, res) => {
    if (req.headers.origin && isLocalOrigin(req.headers.origin)) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.json({ iceServers, maxCallMembers: 6 });
  });
  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 65536 });
  const clients = new Map();
  const send = (client, event) => { if (client.ws.readyState === WebSocket.OPEN) client.ws.send(JSON.stringify(event)); };
  const broadcast = (room, event) => { for (const c of clients.values()) if (c.room === room) send(c, event); };
  const members = (room) => [...clients.values()].filter(c => c.room === room).map(c => ({ id: c.id, name: c.name, inCall: c.inCall, muted: c.muted, sharing: c.sharing }));
  const presence = (room) => { if (room) broadcast(room, { type: 'presence', members: members(room) }); };
  const error = (client, message) => send(client, { type: 'error', message });

  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/ws') return;
    const origin = req.headers.origin;
    // Accept only the same site; command-line clients may omit Origin.
    if (origin && !isLocalOrigin(origin) && (() => { try { return new URL(origin).host !== req.headers.host; } catch { return true; } })()) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  wss.on('connection', ws => {
    const client = { id: randomUUID(), ws, name: '', room: null, inCall: false, muted: true, sharing: false, alive: true, budget: 100, resetAt: Date.now() };
    clients.set(client.id, client);
    ws.on('error', () => {});
    ws.on('pong', () => { client.alive = true; });
    send(client, { type: 'hello', id: client.id, rooms: roomsQuery.all() });
    ws.on('message', raw => {
      try {
        if (Date.now() - client.resetAt > 10000) { client.budget = 100; client.resetAt = Date.now(); }
        if (--client.budget < 0) return error(client, 'Muitas ações. Aguarde alguns segundos.');
        const event = JSON.parse(raw.toString());
        if (!event || typeof event !== 'object') return;
        if (event.type === 'join') {
          const name = typeof event.name === 'string' ? event.name.trim().slice(0, 32) : '';
          if (!name || typeof event.room !== 'string' || !roomQuery.get(event.room)) return error(client, 'Nome ou sala inválidos.');
          const previous = client.room;
          Object.assign(client, { name, room: event.room, inCall: false, muted: true, sharing: false });
          presence(previous);
          send(client, { type: 'joined', room: roomQuery.get(client.room), messages: history.all(client.room) });
          presence(client.room);
        } else if (!client.room) return error(client, 'Entre em uma sala primeiro.');
        else if (event.type === 'message') {
          const text = typeof event.text === 'string' ? event.text.trim() : '';
          if (!text || text.length > 2000) return error(client, 'A mensagem deve ter entre 1 e 2000 caracteres.');
          const message = { id: randomUUID(), room: client.room, author: client.name, text, created: Date.now() };
          insertMessage.run(message.id, message.room, message.author, message.text, message.created);
          broadcast(client.room, { type: 'message', message });
        } else if (event.type === 'create-room') {
          const name = typeof event.name === 'string' ? event.name.trim().slice(0, 32) : '';
          if (!name) return error(client, 'Dê um nome à sala.');
          if (roomsQuery.all().length >= 100) return error(client, 'O limite de salas deste protótipo foi atingido.');
          const room = { id: randomUUID(), name, description: 'Um espaço para o seu grupo' };
          addRoom.run(room.id, room.name, room.description);
          for (const c of clients.values()) send(c, { type: 'rooms', rooms: roomsQuery.all() });
          send(client, { type: 'room-created', room });
        } else if (event.type === 'call-join') {
          const count = [...clients.values()].filter(c => c.room === client.room && c.inCall && c !== client).length;
          if (count >= 6) return error(client, 'A chamada está cheia (máximo de 6 pessoas).');
          client.inCall = true;
          client.muted = event.muted !== false;
          presence(client.room);
        } else if (event.type === 'call-leave') {
          Object.assign(client, { inCall: false, muted: true, sharing: false });
          presence(client.room);
        } else if (event.type === 'media' && client.inCall) {
          if (typeof event.muted === 'boolean') client.muted = event.muted;
          if (typeof event.sharing === 'boolean') client.sharing = event.sharing;
          presence(client.room);
        } else if (event.type === 'signal' && client.inCall) {
          const target = clients.get(event.to);
          if (!target || target.room !== client.room || !target.inCall) return error(client, 'Participante indisponível nesta chamada.');
          const signal = event.signal;
          if (!signal || typeof signal !== 'object') return;
          if (signal.description && !['offer', 'answer'].includes(signal.description.type)) return;
          send(target, { type: 'signal', from: client.id, signal });
        }
      } catch { error(client, 'Não foi possível processar esta ação.'); }
    });
    ws.on('close', () => { clients.delete(client.id); presence(client.room); });
  });
  const heartbeat = setInterval(() => {
    for (const c of clients.values()) {
      if (!c.alive) { c.ws.terminate(); continue; }
      c.alive = false; c.ws.ping();
    }
  }, 30000);
  heartbeat.unref();
  return { app, server, async close() {
    clearInterval(heartbeat);
    for (const c of clients.values()) c.ws.terminate();
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => server.close(resolve));
    db.close();
  } };
}
