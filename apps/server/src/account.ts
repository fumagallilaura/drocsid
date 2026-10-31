import { rm } from 'node:fs/promises';
import type { User } from './auth.ts';
import { pool } from './db.ts';
import { uploadPath } from './uploads.ts';

// Direitos de acesso e portabilidade da LGPD (art. 18, II e V): tudo que a pessoa criou ou que descreve a conta dela.
export async function exportData(user: User) {
  const q = (sql: string) => pool.query(sql, [user.id]).then((r) => r.rows);
  const [[account], guilds, relationships, messages, reactions] = await Promise.all([
    q('SELECT id::text, username, created_at, terms_accepted_at FROM users WHERE id = $1'),
    q(`SELECT g.id::text, g.name, g.owner_id = $1 AS owner FROM guild_members m JOIN guilds g ON g.id = m.guild_id
       WHERE m.user_id = $1 ORDER BY g.id`),
    q(`SELECT u.username, CASE r.type WHEN 1 THEN 'amizade' WHEN 3 THEN 'pedido recebido' WHEN 4 THEN 'pedido enviado' END AS type
       FROM relationships r JOIN users u ON u.id = r.peer_id WHERE r.user_id = $1 ORDER BY u.username`),
    q(`SELECT id::text, channel_id::text, content, created_at, edited_at, attachments FROM messages
       WHERE author_id = $1 ORDER BY id`),
    q('SELECT message_id::text, emoji, created_at FROM reactions WHERE user_id = $1 ORDER BY created_at'),
  ]);
  return { exported_at: new Date().toISOString(), account, guilds, relationships, messages, reactions };
}

// Direito de eliminação (art. 18, VI). Servidores criados pela pessoa somem junto, com o conteúdo de todos os membros.
// ponytail: outros usuários conectados só deixam de ver as mensagens e os servidores apagados ao recarregar; enviar
// MESSAGE_DELETE/GUILD_DELETE pelo gateway se isso incomodar.
export async function deleteAccount(user: User) {
  const client = await pool.connect();
  let files: string[];
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ name: string }>(
      `SELECT name FROM uploads WHERE user_id = $1
       OR channel_id IN (SELECT c.id FROM channels c JOIN guilds g ON g.id = c.guild_id WHERE g.owner_id = $1)`,
      [user.id],
    );
    files = rows.map((r) => r.name);
    await client.query('DELETE FROM messages WHERE author_id = $1', [user.id]);
    await client.query('DELETE FROM guilds WHERE owner_id = $1', [user.id]);
    await client.query('DELETE FROM users WHERE id = $1', [user.id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  await Promise.all(files.map((name) => rm(uploadPath(name), { force: true })));
}
