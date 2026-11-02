import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { Database } from './database.js';
import { LIMITS, ProtocolError } from '../shared/protocol.js';
import type { Room, Group } from '../shared/protocol.js';
export type { Group } from '../shared/protocol.js';

export type User = { id: string; username: string };
export type AuthResult = { user: User; token: string };
export type Session = { id: string; user: User; expiresAt: number; idleAt: number };
type Row = Record<string, unknown>;
type Attempt = { count: number; until: number };
const USERNAME = /^[a-z0-9_.]{2,32}$/;
const SECRET = /^[A-Za-z0-9_-]{43}$/;
const PASSWORD_HASH = /^\$scrypt\$131072\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/;
const SESSION_MS = 86400000, IDLE_MS = 1800000, TICKET_MS = 30000;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const secret = () => randomBytes(32).toString('base64url');
const dummySalt = randomBytes(16), dummyHash = randomBytes(64);
// Process-wide: multiple Identity owners cannot multiply the expensive KDF budget.
let activeCredentials = 0;

export class IdentityError extends ProtocolError {
  constructor(public readonly status: number, code: string, message: string) { super(code, message); }
}
const unauthorized = () => new IdentityError(401, 'UNAUTHENTICATED', 'Usuário ou senha incorretos, ou sessão inválida.');
const limited = () => new IdentityError(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde e tente novamente.');
const missing = () => new IdentityError(404, 'NOT_FOUND', 'Recurso não encontrado.');
function text(value: unknown): string {
  if (typeof value !== 'string') throw new ProtocolError('PERSISTENCE_FAILED');
  return value;
}
function integer(value: unknown): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new ProtocolError('PERSISTENCE_FAILED');
  return Number(value);
}
function user(row: Row): User { return { id: text(row.id), username: text(row.username) }; }
function room(row: Row): Room { return { id: text(row.id), name: text(row.name), description: text(row.description) }; }
function name(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 32) throw new IdentityError(400, 'INVALID_INPUT', 'Nome deve ter entre 1 e 32 caracteres.');
  return value.trim();
}
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (error, key) => error ? reject(new ProtocolError('AUTHENTICATION_FAILED')) : resolve(key)));
}

export class Identity {
  private readonly now: () => number;
  private readonly attempts = new Map<string, Attempt>();
  private readonly pending = new Set<Promise<AuthResult>>();
  private closing = false;

  constructor(private readonly database: Database, options: { now?: () => number } = {}) { this.now = options.now ?? Date.now; }
  private open(): void { if (this.closing) throw new ProtocolError('SHUTTING_DOWN'); }

  private reserve(ip: string, username: unknown): Attempt[] {
    const now = this.now();
    for (const [key, entry] of this.attempts) if (entry.until <= now) this.attempts.delete(key);
    const keys = [digest(`ip:${ip}`), digest(`user:${typeof username === 'string' ? username.slice(0, 128) : ''}`)];
    if (keys.some(key => (this.attempts.get(key)?.count ?? 0) >= 5) || this.attempts.size + keys.filter(key => !this.attempts.has(key)).length > 4096) throw limited();
    return keys.map(key => {
      let entry = this.attempts.get(key);
      if (!entry) { entry = { count: 0, until: now + 60000 }; this.attempts.set(key, entry); }
      entry.count++;
      return entry;
    });
  }

  private credentials(ip: string, username: unknown, work: () => Promise<AuthResult>): Promise<AuthResult> {
    try {
      this.open();
      if (activeCredentials >= 2) throw limited();
      const reservations = this.reserve(ip, username);
      activeCredentials++;
      const operation = (async () => {
        try { const result = await work(); for (const entry of reservations) entry.count--; return result; }
        finally { activeCredentials--; }
      })();
      this.pending.add(operation);
      return operation.finally(() => this.pending.delete(operation));
    } catch (error) { return Promise.reject(error); }
  }

  private async newSession(client: PoolClient, account: User): Promise<AuthResult> {
    const token = secret(), now = this.now();
    await client.query('INSERT INTO drocsid.sessions(token_hash,user_id,expires_at,last_seen) VALUES ($1,$2,$3,$4)', [digest(token), account.id, now + SESSION_MS, now]);
    return { user: account, token };
  }

  register(username: unknown, password: unknown, ip: string): Promise<AuthResult> {
    if (typeof username !== 'string' || !USERNAME.test(username) || typeof password !== 'string' || password.length < 15 || password.length > 128) return Promise.reject(new IdentityError(400, 'INVALID_INPUT', 'Use usuário de 2 a 32 caracteres a-z0-9_. e senha de 15 a 128 caracteres.'));
    return this.credentials(ip, username, async () => {
      const salt = randomBytes(16), key = await derive(password, salt);
      this.open();
      const stored = `$scrypt$131072$8$1$${salt.toString('hex')}$${key.toString('hex')}`;
      return this.database.transaction(async client => {
        const rows = (await client.query<Row>('INSERT INTO drocsid.accounts(id,username,password_hash) VALUES ($1,$2,$3) ON CONFLICT(username) DO NOTHING RETURNING id,username', [randomUUID(), username, stored])).rows;
        if (!rows[0]) throw new IdentityError(409, 'USERNAME_TAKEN', 'Nome de usuário já está em uso.');
        return this.newSession(client, user(rows[0]));
      });
    });
  }

  login(username: unknown, password: unknown, ip: string): Promise<AuthResult> {
    return this.credentials(ip, username, async () => {
      if (typeof username !== 'string' || !USERNAME.test(username) || typeof password !== 'string' || password.length < 15 || password.length > 128) throw unauthorized();
      const rows = await this.database.query('SELECT id,username,password_hash FROM drocsid.accounts WHERE username=$1', [username]);
      const row = rows[0], stored = row && typeof row.password_hash === 'string' ? PASSWORD_HASH.exec(row.password_hash) : null;
      const key = await derive(password, stored ? Buffer.from(stored[1], 'hex') : dummySalt);
      this.open();
      const matches = timingSafeEqual(key, stored ? Buffer.from(stored[2], 'hex') : dummyHash);
      if (!row || !stored || !matches) throw unauthorized();
      return this.database.transaction(client => this.newSession(client, user(row)));
    });
  }

  private tokenHash(token: unknown): string {
    this.open();
    if (typeof token !== 'string' || !SECRET.test(token)) throw unauthorized();
    return digest(token);
  }

  private async session(client: PoolClient, id: string, touch: boolean): Promise<Session> {
    const now = this.now();
    const rows = (await client.query<Row>(touch
      ? `UPDATE drocsid.sessions s SET last_seen=$2 FROM drocsid.accounts u
         WHERE s.token_hash=$1 AND s.user_id=u.id AND s.expires_at>$2 AND s.last_seen>$3
         RETURNING s.token_hash,u.id,u.username,s.expires_at,s.last_seen`
      : `SELECT s.token_hash,u.id,u.username,s.expires_at,s.last_seen FROM drocsid.sessions s
         JOIN drocsid.accounts u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>$2 AND s.last_seen>$3`, [id, now, now - IDLE_MS])).rows;
    if (!rows[0]) throw unauthorized();
    return { id: text(rows[0].token_hash), user: user(rows[0]), expiresAt: integer(rows[0].expires_at), idleAt: integer(rows[0].last_seen) + IDLE_MS };
  }

  async authenticate(token: unknown): Promise<Session> {
    const id = this.tokenHash(token);
    return this.database.transaction(client => this.session(client, id, true));
  }

  // Internal session identity for WS ownership. Polling does not count as user activity.
  async checkSession(id: string, touch = false): Promise<Session> {
    this.open();
    return this.database.transaction(client => this.session(client, id, touch));
  }

  async logout(token: unknown): Promise<string> {
    const id = this.tokenHash(token);
    await this.database.query('DELETE FROM drocsid.sessions WHERE token_hash=$1', [id]);
    return id;
  }

  async createTicket(token: unknown): Promise<{ ticket: string; expiresAt: number }> {
    const id = this.tokenHash(token);
    return this.database.transaction(async client => {
      const session = await this.session(client, id, true), ticket = secret(), expiresAt = Math.min(this.now() + TICKET_MS, session.expiresAt);
      await client.query('DELETE FROM drocsid.ws_tickets WHERE expires_at<=$1', [this.now()]);
      await client.query('INSERT INTO drocsid.ws_tickets(ticket_hash,session_id,expires_at) VALUES ($1,$2,$3)', [digest(ticket), id, expiresAt]);
      return { ticket, expiresAt };
    });
  }

  async consumeTicket(ticket: unknown): Promise<Session> {
    const hash = this.tokenHash(ticket);
    return this.database.transaction(async client => {
      const rows = (await client.query<Row>('SELECT session_id FROM drocsid.ws_tickets WHERE ticket_hash=$1 AND expires_at>$2', [hash, this.now()])).rows;
      if (!rows[0]) throw unauthorized();
      // Logout locks the session before its cascading ticket deletion. Use the
      // same order so a concurrent upgrade cannot prevent session revocation.
      const session = await this.session(client, text(rows[0].session_id), true);
      const consumed = (await client.query<Row>('DELETE FROM drocsid.ws_tickets WHERE ticket_hash=$1 AND session_id=$2 AND expires_at>$3 RETURNING session_id', [hash, session.id, this.now()])).rows;
      if (!consumed[0]) throw unauthorized();
      return session;
    });
  }

  async roomsFor(userId: string, groupId: string | null = null): Promise<Room[]> {
    this.open();
    return (await this.database.query(`SELECT r.id,r.name,r.description FROM drocsid.rooms r
      JOIN drocsid.group_rooms gr ON gr.room_id=r.id JOIN drocsid.group_members gm ON gm.group_id=gr.group_id
      WHERE gm.user_id=$1 AND ($2::text IS NULL OR gr.group_id=$2) ORDER BY r.position`, [userId, groupId])).map(room);
  }

  async requireRoom(userId: string, roomId: string): Promise<Room> {
    this.open();
    const rows = await this.database.query(`SELECT r.id,r.name,r.description FROM drocsid.rooms r
      JOIN drocsid.group_rooms gr ON gr.room_id=r.id JOIN drocsid.group_members gm ON gm.group_id=gr.group_id
      WHERE gm.user_id=$1 AND r.id=$2`, [userId, roomId]);
    if (!rows[0]) throw missing();
    return room(rows[0]);
  }

  async groupsFor(userId: string): Promise<Group[]> {
    this.open();
    const groups = await this.database.query(`SELECT g.id,g.name,g.owner_id FROM drocsid.groups g
      JOIN drocsid.group_members gm ON gm.group_id=g.id WHERE gm.user_id=$1 ORDER BY g.position`, [userId]);
    const rooms = await this.database.query(`SELECT r.id,r.name,r.description,gr.group_id FROM drocsid.rooms r
      JOIN drocsid.group_rooms gr ON gr.room_id=r.id JOIN drocsid.group_members gm ON gm.group_id=gr.group_id
      WHERE gm.user_id=$1 ORDER BY r.position`, [userId]);
    return groups.map(row => ({ id: text(row.id), name: text(row.name), ownerId: text(row.owner_id), rooms: rooms.filter(item => item.group_id === row.id).map(room) }));
  }

  private async owner(client: PoolClient, userId: string, groupId: string): Promise<void> {
    const rows = (await client.query<Row>(`SELECT g.owner_id FROM drocsid.groups g JOIN drocsid.group_members gm ON gm.group_id=g.id
      WHERE gm.user_id=$1 AND g.id=$2 FOR NO KEY UPDATE OF g`, [userId, groupId])).rows;
    if (!rows[0]) throw missing();
    if (rows[0].owner_id !== userId) throw new IdentityError(403, 'FORBIDDEN', 'Somente o dono pode administrar o grupo.');
  }

  private async insertRoom(client: PoolClient, groupId: string, roomName: string): Promise<Room> {
    await client.query('SELECT pg_advisory_xact_lock($1)', [41973922]);
    const count = (await client.query<Row>('SELECT count(*)::text AS count FROM drocsid.rooms')).rows[0];
    if (integer(count.count) >= LIMITS.rooms) throw new IdentityError(409, 'ROOM_LIMIT', 'Limite de salas atingido.');
    const created = { id: randomUUID(), name: roomName, description: '' };
    await client.query('INSERT INTO drocsid.rooms(id,name,description) VALUES ($1,$2,$3)', [created.id, created.name, created.description]);
    await client.query('INSERT INTO drocsid.group_rooms(room_id,group_id) VALUES ($1,$2)', [created.id, groupId]);
    return created;
  }

  async createGroup(userId: string, input: unknown): Promise<Group> {
    this.open(); const groupName = name(input), id = randomUUID();
    return this.database.transaction(async client => {
      await client.query('INSERT INTO drocsid.groups(id,name,owner_id) VALUES ($1,$2,$3)', [id, groupName, userId]);
      await client.query('INSERT INTO drocsid.group_members(group_id,user_id) VALUES ($1,$2)', [id, userId]);
      const initial = await this.insertRoom(client, id, 'geral');
      return { id, name: groupName, ownerId: userId, rooms: [initial] };
    });
  }

  async createRoom(userId: string, groupId: string, input: unknown): Promise<Room> {
    this.open(); const roomName = name(input);
    return this.database.transaction(async client => { await this.owner(client, userId, groupId); return this.insertRoom(client, groupId, roomName); });
  }

  async createInvite(userId: string, groupId: string): Promise<{ id: string; code: string; groupId: string; expiresAt: number }> {
    this.open();
    return this.database.transaction(async client => {
      await this.owner(client, userId, groupId);
      const code = secret(), id = randomUUID(), expiresAt = this.now() + SESSION_MS;
      await client.query('INSERT INTO drocsid.invites(id,code_hash,group_id,expires_at) VALUES ($1,$2,$3,$4)', [id, digest(code), groupId, expiresAt]);
      return { id, code, groupId, expiresAt };
    });
  }

  async revokeInvite(userId: string, groupId: string, id: string): Promise<void> {
    this.open();
    await this.database.transaction(async client => {
      await this.owner(client, userId, groupId);
      const rows = (await client.query<Row>('UPDATE drocsid.invites SET revoked=true WHERE id=$1 AND group_id=$2 RETURNING id', [id, groupId])).rows;
      if (!rows[0]) throw missing();
    });
  }

  async acceptInvite(userId: string, code: unknown): Promise<Group> {
    this.open();
    if (typeof code !== 'string' || !SECRET.test(code)) throw missing();
    const groupId = await this.database.transaction(async client => {
      const rows = (await client.query<Row>(`UPDATE drocsid.invites SET consumed_by=$2
        WHERE code_hash=$1 AND expires_at>$3 AND NOT revoked AND consumed_by IS NULL RETURNING group_id`, [digest(code), userId, this.now()])).rows;
      if (!rows[0]) throw missing();
      const id = text(rows[0].group_id);
      await client.query('INSERT INTO drocsid.group_members(group_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, userId]);
      return id;
    });
    const group = (await this.groupsFor(userId)).find(item => item.id === groupId);
    if (!group) throw missing();
    return group;
  }

  async close(): Promise<void> {
    this.closing = true;
    await Promise.allSettled([...this.pending]);
  }
}
