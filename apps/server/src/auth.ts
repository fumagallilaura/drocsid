import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { pool } from './db.ts';

export type User = { id: string; username: string };

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const USERNAME = /^[a-z0-9_.]{2,32}$/;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  const actual = await scryptAsync(password, Buffer.from(salt, 'hex'), 64);
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}

async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  await pool.query('INSERT INTO sessions (token_hash, user_id) VALUES ($1, $2)', [sha256(token), userId]);
  return token;
}

export async function register(username: unknown, password: unknown) {
  if (typeof username !== 'string' || !USERNAME.test(username)) {
    throw new HttpError(400, 'Nome de usuário deve ter 2 a 32 caracteres: letras minúsculas, números, _ ou .');
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new HttpError(400, 'Senha deve ter entre 8 e 128 caracteres');
  }
  const { rows } = await pool.query<User>(
    `INSERT INTO users (username, password_hash) VALUES ($1, $2)
     ON CONFLICT (username) DO NOTHING RETURNING id, username`,
    [username, await hashPassword(password)],
  );
  if (!rows[0]) throw new HttpError(409, 'Nome de usuário já está em uso');
  return { user: rows[0], token: await createSession(rows[0].id) };
}

export async function login(username: unknown, password: unknown) {
  if (typeof username !== 'string' || typeof password !== 'string') throw new HttpError(400, 'Credenciais inválidas');
  const { rows } = await pool.query<User & { password_hash: string }>(
    'SELECT id, username, password_hash FROM users WHERE username = $1',
    [username],
  );
  const row = rows[0];
  if (!row || !(await verifyPassword(password, row.password_hash))) throw new HttpError(401, 'Usuário ou senha incorretos');
  return { user: { id: row.id, username: row.username }, token: await createSession(row.id) };
}

export async function authenticate(token: string | undefined) {
  const user = token ? await userFromToken(token) : null;
  if (!user) throw new HttpError(401, 'Não autenticado');
  return user;
}

export async function userFromToken(token: string) {
  const { rows } = await pool.query<User>(
    'SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1',
    [sha256(token)],
  );
  return rows[0] ?? null;
}
