import { randomBytes } from 'node:crypto';
import { HttpError, type User } from './auth.ts';
import { pool } from './db.ts';

export type Channel = { id: string; guild_id: string; name: string };
export type Guild = { id: string; name: string; owner_id: string; channels: Channel[] };

const CHANNEL_NAME = /^[a-z0-9_-]{1,100}$/;

const MESSAGE_FIELDS = `m.id, m.channel_id, m.content, m.created_at,
  json_build_object('id', u.id::text, 'username', u.username) AS author`;

export async function guildsFor(userId: string, guildId: string | null = null) {
  const { rows } = await pool.query<Guild>(
    `SELECT g.id, g.name, g.owner_id,
       COALESCE(json_agg(json_build_object('id', c.id::text, 'guild_id', c.guild_id::text, 'name', c.name) ORDER BY c.id)
         FILTER (WHERE c.id IS NOT NULL), '[]') AS channels
     FROM guild_members gm
     JOIN guilds g ON g.id = gm.guild_id
     LEFT JOIN channels c ON c.guild_id = g.id
     WHERE gm.user_id = $1 AND ($2::bigint IS NULL OR g.id = $2)
     GROUP BY g.id ORDER BY g.id`,
    [userId, guildId],
  );
  return rows;
}

export async function memberIds(guildId: string) {
  const { rows } = await pool.query<{ user_id: string }>('SELECT user_id FROM guild_members WHERE guild_id = $1', [guildId]);
  return rows.map((r) => r.user_id);
}

async function memberGuild(user: User, guildId: string) {
  const [guild] = await guildsFor(user.id, guildId);
  if (!guild) throw new HttpError(404, 'Servidor não encontrado');
  return guild;
}

async function memberChannel(user: User, channelId: string) {
  const { rows } = await pool.query<{ guild_id: string }>(
    `SELECT c.guild_id FROM channels c
     JOIN guild_members gm ON gm.guild_id = c.guild_id AND gm.user_id = $2
     WHERE c.id = $1`,
    [channelId, user.id],
  );
  if (!rows[0]) throw new HttpError(404, 'Canal não encontrado');
  return rows[0].guild_id;
}

export async function createGuild(user: User, name: unknown) {
  if (typeof name !== 'string' || !name.trim() || name.length > 100) {
    throw new HttpError(400, 'Nome do servidor deve ter entre 1 e 100 caracteres');
  }
  const { rows } = await pool.query<{ id: string }>(
    `WITH g AS (INSERT INTO guilds (name, owner_id) VALUES ($1, $2) RETURNING id),
     m AS (INSERT INTO guild_members (guild_id, user_id) SELECT id, $2 FROM g),
     c AS (INSERT INTO channels (guild_id, name) SELECT id, 'geral' FROM g)
     SELECT id FROM g`,
    [name.trim(), user.id],
  );
  return memberGuild(user, rows[0].id);
}

export async function createChannel(user: User, guildId: string, name: unknown) {
  const guild = await memberGuild(user, guildId);
  if (guild.owner_id !== user.id) throw new HttpError(403, 'Só o dono do servidor pode criar canais');
  if (typeof name !== 'string' || !CHANNEL_NAME.test(name)) {
    throw new HttpError(400, 'Nome do canal deve ter 1 a 100 caracteres: letras minúsculas, números, - ou _');
  }
  const { rows } = await pool.query<Channel>(
    'INSERT INTO channels (guild_id, name) VALUES ($1, $2) RETURNING id, guild_id, name',
    [guildId, name],
  );
  return rows[0];
}

export async function createInvite(user: User, guildId: string) {
  await memberGuild(user, guildId);
  const code = randomBytes(6).toString('base64url');
  await pool.query('INSERT INTO invites (code, guild_id) VALUES ($1, $2)', [code, guildId]);
  return { code, guild_id: guildId };
}

export async function acceptInvite(user: User, code: string) {
  const { rows } = await pool.query<{ guild_id: string }>(
    `INSERT INTO guild_members (guild_id, user_id)
     SELECT guild_id, $2 FROM invites WHERE code = $1
     ON CONFLICT DO NOTHING RETURNING guild_id`,
    [code, user.id],
  );
  const invite = rows[0] ?? (await pool.query('SELECT guild_id FROM invites WHERE code = $1', [code])).rows[0];
  if (!invite) throw new HttpError(404, 'Convite inválido');
  return { guild: await memberGuild(user, invite.guild_id), joined: rows.length > 0 };
}

export async function listMessages(user: User, channelId: string) {
  await memberChannel(user, channelId);
  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT ${MESSAGE_FIELDS} FROM messages m JOIN users u ON u.id = m.author_id
       WHERE m.channel_id = $1 ORDER BY m.id DESC LIMIT 50
     ) recent ORDER BY id`,
    [channelId],
  );
  return rows;
}

export async function createMessage(user: User, channelId: string, content: unknown) {
  const guildId = await memberChannel(user, channelId);
  if (typeof content !== 'string' || !content.trim() || content.length > 2000) {
    throw new HttpError(400, 'Mensagem deve ter entre 1 e 2000 caracteres');
  }
  const { rows } = await pool.query(
    `WITH m AS (INSERT INTO messages (channel_id, author_id, content) VALUES ($1, $2, $3) RETURNING *)
     SELECT ${MESSAGE_FIELDS} FROM m JOIN users u ON u.id = m.author_id`,
    [channelId, user.id, content],
  );
  return { guildId, message: rows[0] };
}
