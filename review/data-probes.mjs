import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';

const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE messages (id TEXT PRIMARY KEY, room TEXT NOT NULL, author TEXT NOT NULL, text TEXT NOT NULL, created INTEGER NOT NULL);
CREATE INDEX messages_room_created ON messages(room, created);`);
const historyPlan = db.prepare('EXPLAIN QUERY PLAN SELECT id, room, author, text, created FROM (SELECT rowid AS sequence, * FROM messages WHERE room = ? ORDER BY rowid DESC LIMIT 200) ORDER BY sequence').all('geral');
const busyTimeout = db.prepare('PRAGMA busy_timeout').get();
db.close();
function luminance(hex) {
  const rgb = hex.match(/[0-9a-f]{2}/gi).map(v => parseInt(v, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
const contrast = [
  { selector: '.composer-footer', foreground: '#667d6f', background: '#1c2222', fontSizePx: 8 },
  { selector: '.app-footer', foreground: '#67836f', background: '#18201c', fontSizePx: 8 },
  { selector: '.space-header .eyebrow', foreground: '#71877a', background: '#181f1d', fontSizePx: 8 },
].map(pair => { const a = luminance(pair.foreground), b = luminance(pair.background); return { ...pair, ratio: Number(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2)) }; });
const result = { historyPlan, busyTimeout, contrast };
writeFileSync(new URL('data-probes.json', import.meta.url), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
