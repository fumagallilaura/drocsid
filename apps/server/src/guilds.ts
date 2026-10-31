import { randomBytes } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { HttpError, type User } from './auth.ts';
import { pool } from './db.ts';
import { uploadPath } from './uploads.ts';

export type Channel = { id: string; guild_id: string | null; name: string; type: 'text' | 'voice' | 'dm' };
export type Guild = { id: string; name: string; owner_id: string; channels: Channel[]; members: User[] };

const CHANNEL_NAME = /^[a-z0-9_-]{1,100}$/;
const ID = /^\d{1,18}$/;
// Um emoji Unicode (com modificadores, ZWJ e bandeiras), como o Discord aceita em reações.
const EMOJI = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Component}|\u200d|\ufe0f)+$/u;
const MAX_REACTIONS = 20;

const USER_JSON = (alias: string) => `json_build_object('id', ${alias}.id::text, 'username', ${alias}.username)`;
const MESSAGE_FIELDS = `m.id, m.channel_id, m.content, m.created_at, m.edited_at AS edited_timestamp, m.attachments, m.embeds,
  ${USER_JSON('u')} AS author,
  (SELECT json_build_object('id', r.id::text, 'content', r.content, 'author', ${USER_JSON('ru')})
     FROM messages r JOIN users ru ON ru.id = r.author_id WHERE r.id = m.reply_to) AS referenced_message,
  COALESCE((SELECT json_agg(${USER_JSON('mu')}) FROM users mu
     WHERE mu.id::text IN (SELECT (regexp_matches(m.content, '<@(\\d{1,18})>', 'g'))[1])), '[]') AS mentions`;

export async function guildsFor(userId: string, guildId: string | null = null) {
  const { rows } = await pool.query<Guild>(
    `SELECT g.id, g.name, g.owner_id,
       COALESCE(json_agg(json_build_object('id', c.id::text, 'guild_id', c.guild_id::text, 'name', c.name, 'type', c.type) ORDER BY c.id)
         FILTER (WHERE c.id IS NOT NULL), '[]') AS channels,
       (SELECT json_agg(${USER_JSON('mu')} ORDER BY mu.username)
          FROM guild_members x JOIN users mu ON mu.id = x.user_id WHERE x.guild_id = g.id) AS members
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

// Canal de servidor do qual o usuário é membro, ou DM da qual ele participa.
export async function memberChannel(user: User, channelId: string) {
  const { rows } = await pool.query<Pick<Channel, 'guild_id' | 'type'> & { owner_id: string | null }>(
    `SELECT c.guild_id, c.type, g.owner_id FROM channels c
     LEFT JOIN guilds g ON g.id = c.guild_id
     WHERE c.id = $1 AND (
       EXISTS (SELECT 1 FROM guild_members gm WHERE gm.guild_id = c.guild_id AND gm.user_id = $2)
       OR EXISTS (SELECT 1 FROM dm_recipients r WHERE r.channel_id = c.id AND r.user_id = $2))`,
    [channelId, user.id],
  );
  if (!rows[0]) throw new HttpError(404, 'Canal não encontrado');
  return rows[0];
}

async function textChannel(user: User, channelId: string) {
  const channel = await memberChannel(user, channelId);
  if (channel.type === 'voice') throw new HttpError(400, 'Canais de voz não aceitam mensagens');
  return channel;
}

export async function channelRecipients(channelId: string) {
  const { rows } = await pool.query<{ user_id: string }>(
    `SELECT gm.user_id FROM channels c JOIN guild_members gm ON gm.guild_id = c.guild_id WHERE c.id = $1
     UNION SELECT user_id FROM dm_recipients WHERE channel_id = $1`,
    [channelId],
  );
  return rows.map((r) => r.user_id);
}

export async function createGuild(user: User, name: unknown) {
  if (typeof name !== 'string' || !name.trim() || name.length > 100) {
    throw new HttpError(400, 'Nome do servidor deve ter entre 1 e 100 caracteres');
  }
  const { rows } = await pool.query<{ id: string }>(
    `WITH g AS (INSERT INTO guilds (name, owner_id) VALUES ($1, $2) RETURNING id),
     m AS (INSERT INTO guild_members (guild_id, user_id) SELECT id, $2 FROM g),
     c AS (INSERT INTO channels (guild_id, name, type) SELECT id, 'geral', 'text' FROM g UNION ALL SELECT id, 'geral', 'voice' FROM g)
     SELECT id FROM g`,
    [name.trim(), user.id],
  );
  return memberGuild(user, rows[0].id);
}

export async function createChannel(user: User, guildId: string, name: unknown, type: unknown = 'text') {
  const guild = await memberGuild(user, guildId);
  if (guild.owner_id !== user.id) throw new HttpError(403, 'Só o dono do servidor pode criar canais');
  if (typeof name !== 'string' || !CHANNEL_NAME.test(name)) {
    throw new HttpError(400, 'Nome do canal deve ter 1 a 100 caracteres: letras minúsculas, números, - ou _');
  }
  if (type !== 'text' && type !== 'voice') throw new HttpError(400, 'Tipo de canal deve ser text ou voice');
  const { rows } = await pool.query<Channel>(
    'INSERT INTO channels (guild_id, name, type) VALUES ($1, $2, $3) RETURNING id, guild_id, name, type',
    [guildId, name, type],
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
       SELECT ${MESSAGE_FIELDS},
         COALESCE((SELECT json_agg(json_build_object('emoji', json_build_object('name', x.emoji), 'count', x.count, 'me', x.me) ORDER BY x.first)
           FROM (SELECT emoji, count(*)::int AS count, bool_or(user_id = $2) AS me, min(created_at) AS first
                 FROM reactions WHERE message_id = m.id GROUP BY emoji) x), '[]') AS reactions
       FROM messages m JOIN users u ON u.id = m.author_id
       WHERE m.channel_id = $1 ORDER BY m.id DESC LIMIT 50
     ) recent ORDER BY id`,
    [channelId, user.id],
  );
  return rows;
}

function messageContent(content: unknown, hasAttachments: boolean) {
  if (typeof content !== 'string' || content.length > 2000 || (!content.trim() && !hasAttachments)) {
    throw new HttpError(400, 'Mensagem deve ter entre 1 e 2000 caracteres');
  }
  return content;
}

export async function createMessage(user: User, channelId: string, body: any) {
  const { guild_id: guildId } = await textChannel(user, channelId);
  const files: unknown[] = body?.attachments ?? [];
  if (!Array.isArray(files) || files.length > 10) throw new HttpError(400, 'Envie até 10 anexos');
  const names = files.map((f: any) => f?.uploaded_filename);
  if (!names.every((n) => typeof n === 'string')) throw new HttpError(400, 'Anexo inválido');
  const content = messageContent(body?.content ?? '', names.length > 0);
  const replyTo = body?.message_reference?.message_id ?? null;
  if (replyTo !== null && (typeof replyTo !== 'string' || !ID.test(replyTo))) throw new HttpError(400, 'Resposta inválida');

  // Os uploads só entram se forem deste usuário, deste canal, já enviados e ainda não usados em outra mensagem.
  const { rows } = await pool.query(
    `WITH up AS (
       SELECT name, filename, size, content_type FROM uploads
       WHERE name = ANY($5::text[]) AND user_id = $2 AND channel_id = $1 AND uploaded AND message_id IS NULL
       FOR UPDATE),
     m AS (
       INSERT INTO messages (channel_id, author_id, content, reply_to, attachments)
       SELECT $1, $2, $3, (SELECT id FROM messages WHERE id = $4 AND channel_id = $1),
         COALESCE((SELECT jsonb_agg(jsonb_build_object('id', name, 'filename', filename, 'size', size,
           'content_type', content_type, 'url', '/cdn/attachments/' || name)) FROM up), '[]')
       WHERE (SELECT count(*) FROM up) = cardinality($5::text[])
       RETURNING *),
     claimed AS (UPDATE uploads SET message_id = (SELECT id FROM m) WHERE name IN (SELECT name FROM up) AND EXISTS (SELECT 1 FROM m))
     SELECT ${MESSAGE_FIELDS}, '[]'::json AS reactions FROM m JOIN users u ON u.id = m.author_id`,
    [channelId, user.id, content, replyTo, names],
  );
  if (!rows[0]) throw new HttpError(400, 'Anexo inválido ou já usado');
  return { guildId, message: rows[0] };
}

async function channelMessage(user: User, channelId: string, messageId: string) {
  const channel = await textChannel(user, channelId);
  const { rows } = await pool.query<{ author_id: string; attachments: { id: string }[] }>(
    'SELECT author_id, attachments FROM messages WHERE id = $1 AND channel_id = $2',
    [messageId, channelId],
  );
  if (!rows[0]) throw new HttpError(404, 'Mensagem não encontrada');
  return { ...channel, ...rows[0] };
}

export async function editMessage(user: User, channelId: string, messageId: string, content: unknown) {
  const message = await channelMessage(user, channelId, messageId);
  if (message.author_id !== user.id) throw new HttpError(403, 'Só o autor pode editar a mensagem');
  const { rows } = await pool.query(
    `WITH m AS (UPDATE messages SET content = $2, edited_at = now() WHERE id = $1 RETURNING *)
     SELECT ${MESSAGE_FIELDS} FROM m JOIN users u ON u.id = m.author_id`,
    [messageId, messageContent(content, message.attachments.length > 0)],
  );
  return { guildId: message.guild_id, message: rows[0] };
}

export async function deleteMessage(user: User, channelId: string, messageId: string) {
  const message = await channelMessage(user, channelId, messageId);
  if (message.author_id !== user.id && message.owner_id !== user.id) {
    throw new HttpError(403, 'Só o autor ou o dono do servidor pode apagar a mensagem');
  }
  await pool.query('DELETE FROM messages WHERE id = $1', [messageId]);
  await Promise.all(message.attachments.map((a) => rm(uploadPath(a.id), { force: true })));
  return { guildId: message.guild_id, event: { id: messageId, channel_id: channelId, guild_id: message.guild_id } };
}

// Só grava se o conteúdo não mudou desde que os links foram lidos, para um embed antigo não sobrescrever uma edição.
export async function setEmbeds(messageId: string, content: string, embeds: unknown[]) {
  const { rows } = await pool.query<{ id: string; channel_id: string }>(
    'UPDATE messages SET embeds = $3 WHERE id = $1 AND content = $2 RETURNING id, channel_id',
    [messageId, content, JSON.stringify(embeds)],
  );
  return rows[0];
}

export async function react(user: User, channelId: string, messageId: string, emoji: string, add: boolean) {
  const { guild_id: guildId } = await channelMessage(user, channelId, messageId);
  if (emoji.length > 32 || !EMOJI.test(emoji)) throw new HttpError(400, 'Emoji inválido');
  const { rowCount } = add
    ? await pool.query(
        `INSERT INTO reactions (message_id, user_id, emoji)
         SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM reactions WHERE message_id = $1 AND emoji = $3)
           OR (SELECT count(DISTINCT emoji) FROM reactions WHERE message_id = $1) < ${MAX_REACTIONS}
         ON CONFLICT DO NOTHING`,
        [messageId, user.id, emoji],
      )
    : await pool.query('DELETE FROM reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3', [messageId, user.id, emoji]);
  const event = { user_id: user.id, channel_id: channelId, message_id: messageId, guild_id: guildId, emoji: { name: emoji } };
  return { guildId, event: rowCount ? event : null };
}
