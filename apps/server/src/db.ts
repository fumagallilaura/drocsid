import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://drocsid:drocsid@localhost:5432/drocsid',
});

// ponytail: schema inline com IF NOT EXISTS; trocar por uma ferramenta de migrations quando precisar alterar tabelas existentes.
export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS guilds (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id BIGINT NOT NULL REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS guild_members (
      guild_id BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (guild_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS channels (
      id BIGSERIAL PRIMARY KEY,
      guild_id BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS invites (
      code TEXT PRIMARY KEY,
      guild_id BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      author_id BIGINT NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS messages_channel_id ON messages (channel_id, id);
    ALTER TABLE channels ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'text';
    ALTER TABLE channels ALTER COLUMN guild_id DROP NOT NULL;
    ALTER TABLE channels ADD COLUMN IF NOT EXISTS dm_key TEXT UNIQUE;
    CREATE TABLE IF NOT EXISTS dm_recipients (
      channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (channel_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS dm_recipients_user ON dm_recipients (user_id);
    CREATE TABLE IF NOT EXISTS relationships (
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      peer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type SMALLINT NOT NULL,
      PRIMARY KEY (user_id, peer_id)
    );
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to BIGINT REFERENCES messages(id) ON DELETE SET NULL;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS embeds JSONB NOT NULL DEFAULT '[]';
    CREATE TABLE IF NOT EXISTS reactions (
      message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (message_id, emoji, user_id)
    );
    CREATE TABLE IF NOT EXISTS uploads (
      name TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      size INT NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      uploaded BOOLEAN NOT NULL DEFAULT false,
      message_id BIGINT REFERENCES messages(id) ON DELETE CASCADE
    );
  `);
}
