import { HttpError, type User } from './auth.ts';
import { pool } from './db.ts';

// Mesmos valores do enum de relacionamentos do cliente do Discord.
export const Relationship = { FRIEND: 1, PENDING_INCOMING: 3, PENDING_OUTGOING: 4 } as const;

type Dispatch = [userId: string, t: string, d: unknown];

export async function relationshipsFor(userId: string) {
  const { rows } = await pool.query(
    `SELECT u.id::text AS id, r.type, json_build_object('id', u.id::text, 'username', u.username) AS user
     FROM relationships r JOIN users u ON u.id = r.peer_id
     WHERE r.user_id = $1 ORDER BY u.username`,
    [userId],
  );
  return rows;
}

async function setRelationship(a: User, b: User, aType: number, bType: number): Promise<Dispatch[]> {
  await pool.query(
    `INSERT INTO relationships (user_id, peer_id, type) VALUES ($1, $2, $3), ($2, $1, $4)
     ON CONFLICT (user_id, peer_id) DO UPDATE SET type = EXCLUDED.type`,
    [a.id, b.id, aType, bType],
  );
  return [
    [a.id, 'RELATIONSHIP_ADD', { id: b.id, type: aType, user: b }],
    [b.id, 'RELATIONSHIP_ADD', { id: a.id, type: bType, user: a }],
  ];
}

async function relationship(user: User, peerId: string) {
  const { rows } = await pool.query<{ type: number; peer: User }>(
    `SELECT r.type, json_build_object('id', u.id::text, 'username', u.username) AS peer
     FROM relationships r JOIN users u ON u.id = r.peer_id WHERE r.user_id = $1 AND r.peer_id = $2`,
    [user.id, peerId],
  );
  return rows[0];
}

// Enviar pedido para quem já te mandou um pedido aceita a amizade, como no Discord.
export async function sendFriendRequest(user: User, username: unknown) {
  if (typeof username !== 'string') throw new HttpError(400, 'Informe o nome de usuário');
  const { rows } = await pool.query<User>('SELECT id::text, username FROM users WHERE username = $1', [username.trim().toLowerCase()]);
  const peer = rows[0];
  if (!peer) throw new HttpError(404, 'Não encontramos ninguém com esse nome de usuário');
  if (peer.id === user.id) throw new HttpError(400, 'Você não pode adicionar a si mesmo');
  const current = await relationship(user, peer.id);
  if (current?.type === Relationship.FRIEND || current?.type === Relationship.PENDING_OUTGOING) return [];
  return current?.type === Relationship.PENDING_INCOMING
    ? setRelationship(user, peer, Relationship.FRIEND, Relationship.FRIEND)
    : setRelationship(user, peer, Relationship.PENDING_OUTGOING, Relationship.PENDING_INCOMING);
}

export async function acceptFriendRequest(user: User, peerId: string) {
  const current = await relationship(user, peerId);
  if (current?.type !== Relationship.PENDING_INCOMING) throw new HttpError(404, 'Pedido de amizade não encontrado');
  return setRelationship(user, current.peer, Relationship.FRIEND, Relationship.FRIEND);
}

// Serve para desfazer amizade, recusar ou cancelar um pedido.
export async function removeRelationship(user: User, peerId: string): Promise<Dispatch[]> {
  const { rows } = await pool.query<{ user_id: string; peer_id: string; type: number }>(
    `DELETE FROM relationships WHERE (user_id = $1 AND peer_id = $2) OR (user_id = $2 AND peer_id = $1)
     RETURNING user_id::text, peer_id::text, type`,
    [user.id, peerId],
  );
  return rows.map((r) => [r.user_id, 'RELATIONSHIP_REMOVE', { id: r.peer_id, type: r.type }]);
}

export async function privateChannelsFor(userId: string, channelId: string | null = null) {
  const { rows } = await pool.query(
    `SELECT c.id::text AS id, c.type, NULL AS guild_id, c.name,
       json_agg(json_build_object('id', u.id::text, 'username', u.username)) AS recipients,
       (SELECT max(id)::text FROM messages WHERE channel_id = c.id) AS last_message_id
     FROM dm_recipients me
     JOIN channels c ON c.id = me.channel_id
     JOIN dm_recipients o ON o.channel_id = c.id AND o.user_id <> me.user_id
     JOIN users u ON u.id = o.user_id
     WHERE me.user_id = $1 AND ($2::bigint IS NULL OR c.id = $2)
     GROUP BY c.id ORDER BY last_message_id DESC NULLS LAST`,
    [userId, channelId],
  );
  return rows;
}

// Abre (ou reaproveita) a DM com um amigo ou com alguém de um servidor em comum.
export async function openDm(user: User, recipientId: unknown) {
  if (typeof recipientId !== 'string' || !/^\d{1,18}$/.test(recipientId) || recipientId === user.id) {
    throw new HttpError(400, 'Destinatário inválido');
  }
  const { rows: allowed } = await pool.query(
    `SELECT 1 FROM relationships WHERE user_id = $1 AND peer_id = $2 AND type = ${Relationship.FRIEND}
     UNION SELECT 1 FROM guild_members a JOIN guild_members b ON b.guild_id = a.guild_id WHERE a.user_id = $1 AND b.user_id = $2`,
    [user.id, recipientId],
  );
  if (!allowed.length) throw new HttpError(403, 'Você só pode mandar mensagem para amigos ou pessoas de um servidor em comum');
  const ids = [user.id, recipientId].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
  const { rows } = await pool.query<{ id: string; created: boolean }>(
    `WITH c AS (
       INSERT INTO channels (guild_id, name, type, dm_key) VALUES (NULL, '', 'dm', $1)
       ON CONFLICT (dm_key) DO NOTHING RETURNING id),
     r AS (INSERT INTO dm_recipients (channel_id, user_id) SELECT c.id, x FROM c, unnest($2::bigint[]) x)
     SELECT id, true AS created FROM c UNION ALL SELECT id, false FROM channels WHERE dm_key = $1`,
    [ids.join(':'), ids],
  );
  // Se outra requisição criou a mesma DM ao mesmo tempo, a linha dela não aparece no snapshot desta consulta.
  return rows[0] ?? { id: (await pool.query('SELECT id FROM channels WHERE dm_key = $1', [ids.join(':')])).rows[0].id, created: false };
}

// Quem deve ver a presença deste usuário: amigos, colegas de servidor e participantes das DMs dele.
export async function relatedUserIds(userId: string) {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT peer_id::text AS id FROM relationships WHERE user_id = $1 AND type = ${Relationship.FRIEND}
     UNION SELECT b.user_id::text FROM guild_members a JOIN guild_members b ON b.guild_id = a.guild_id WHERE a.user_id = $1
     UNION SELECT o.user_id::text FROM dm_recipients me JOIN dm_recipients o ON o.channel_id = me.channel_id WHERE me.user_id = $1`,
    [userId],
  );
  return rows.map((r) => r.id).filter((id) => id !== userId);
}
