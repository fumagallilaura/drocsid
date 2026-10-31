import { randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { HttpError, type User } from './auth.ts';
import { pool } from './db.ts';

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? fileURLToPath(new URL('../uploads/', import.meta.url));
// Tipos que o navegador pode exibir dentro da página; o resto é servido como download.
const INLINE_TYPES = /^(image\/(png|jpeg|gif|webp|avif)|video\/(mp4|webm)|audio\/(mpeg|ogg|wav|webm))$/;
const CONTENT_TYPE = /^[\w.+-]{1,64}\/[\w.+-]{1,64}$/;

export const uploadPath = (name: string) => join(UPLOAD_DIR, name);

// Mesmo fluxo do cliente do Discord: pede uma URL por arquivo, envia os bytes e cita `uploaded_filename` na mensagem.
// ponytail: uploads que nunca viram mensagem ficam no disco; limpar periodicamente os sem message_id mais antigos que 1 dia.
export async function createUploads(user: User, channelId: string, files: unknown) {
  if (!Array.isArray(files) || !files.length || files.length > 10) throw new HttpError(400, 'Envie de 1 a 10 arquivos');
  const rows = files.map((f: any) => {
    const size = f?.file_size;
    if (typeof f?.filename !== 'string' || !f.filename.trim()) throw new HttpError(400, 'Nome de arquivo inválido');
    if (!Number.isInteger(size) || size < 1) throw new HttpError(400, 'Tamanho de arquivo inválido');
    if (size > MAX_FILE_SIZE) throw new HttpError(413, 'Arquivo maior que 10 MB');
    const filename = f.filename.split(/[\\/]/).pop()!.replace(/[^\p{L}\p{N} ._-]/gu, '_').slice(0, 200);
    return { name: randomBytes(16).toString('hex'), filename, size };
  });
  await pool.query(
    `INSERT INTO uploads (name, user_id, channel_id, filename, size)
     SELECT * FROM unnest($1::text[], $2::bigint[], $3::bigint[], $4::text[], $5::int[])`,
    [rows.map((r) => r.name), rows.map(() => user.id), rows.map(() => channelId), rows.map((r) => r.filename), rows.map((r) => r.size)],
  );
  return {
    attachments: rows.map((r, id) => ({ id, upload_url: `/api/uploads/${r.name}`, upload_filename: r.name })),
  };
}

export async function receiveUpload(user: User, name: string, req: IncomingMessage) {
  const { rows } = await pool.query<{ size: number }>(
    'SELECT size FROM uploads WHERE name = $1 AND user_id = $2 AND NOT uploaded',
    [name, user.id],
  );
  if (!rows[0]) throw new HttpError(404, 'Upload não encontrado');
  const limit = rows[0].size;
  let received = 0;
  const limiter = new Transform({
    transform(chunk, _, done) {
      received += chunk.length;
      done(received > limit ? new HttpError(413, 'Arquivo maior que o tamanho declarado') : null, chunk);
    },
  });
  await mkdir(UPLOAD_DIR, { recursive: true });
  try {
    await pipeline(req, limiter, createWriteStream(uploadPath(name)));
  } catch (err) {
    await rm(uploadPath(name), { force: true });
    throw err;
  }
  const type = req.headers['content-type'];
  await pool.query('UPDATE uploads SET uploaded = true, size = $2, content_type = $3 WHERE name = $1', [
    name,
    received,
    type && CONTENT_TYPE.test(type) ? type.toLowerCase() : 'application/octet-stream',
  ]);
  return {};
}

// ponytail: arquivos anexados são públicos para quem tiver o nome aleatório de 128 bits, como as URLs da CDN do Discord.
export async function serveAttachment(name: string, res: ServerResponse) {
  const { rows } = await pool.query<{ filename: string; content_type: string }>(
    'SELECT filename, content_type FROM uploads WHERE name = $1 AND message_id IS NOT NULL',
    [name],
  );
  const file = rows[0];
  const info = file && (await stat(uploadPath(name)).catch(() => null));
  if (!file || !info) throw new HttpError(404, 'Anexo não encontrado');
  const inline = INLINE_TYPES.test(file.content_type);
  res.writeHead(200, {
    'content-type': inline ? file.content_type : 'application/octet-stream',
    'content-length': info.size,
    'content-disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    'x-content-type-options': 'nosniff',
    'content-security-policy': "sandbox; default-src 'none'",
    'cache-control': 'private, max-age=86400',
  });
  await pipeline(createReadStream(uploadPath(name)), res);
}
