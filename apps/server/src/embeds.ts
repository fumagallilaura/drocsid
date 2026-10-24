import { lookup, type LookupAddress } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';

export type Embed = {
  type: 'link' | 'image';
  url: string;
  title?: string;
  description?: string;
  site_name?: string;
  image?: { url: string };
};

const MAX_LINKS = 3;
const MAX_HTML = 512 * 1024;
const MAX_REDIRECTS = 3;

// Endereços que um link de usuário nunca pode fazer o servidor acessar (rede interna, loopback, metadados de nuvem).
const blocked = new BlockList();
for (const [net, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3]] as const) {
  blocked.addSubnet(net, prefix, 'ipv4');
}
for (const [net, prefix] of [['::', 127], ['64:ff9b::', 96], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]] as const) {
  blocked.addSubnet(net, prefix, 'ipv6');
}

// IPv4 mapeado em IPv6 (::ffff:a.b.c.d) é rejeitado direto: uma regra ::ffff:0:0/96 no BlockList bloquearia todo IPv4.
export const isPublicAddress = (address: string) => {
  const family = isIP(address);
  if (family === 0 || /^::ffff:/i.test(address)) return false;
  return !blocked.check(address, family === 6 ? 'ipv6' : 'ipv4');
};

// Valida o IP no momento da conexão, então um DNS que muda de resposta (rebinding) não escapa da checagem.
function safeLookup(hostname: string, options: any, callback: (...args: any[]) => void) {
  lookup(hostname, { ...options, all: true }, (err, addresses: LookupAddress[]) => {
    if (err) return callback(err);
    if (!addresses.length || !addresses.every((a) => isPublicAddress(a.address))) {
      return callback(Object.assign(new Error(`Endereço não permitido: ${hostname}`), { code: 'EBLOCKED' }));
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
}

type Page = { url: URL; type: string; html: string };

function get(url: URL, signal: AbortSignal): Promise<Page & { location?: string }> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !isPublicAddress(host)) return Promise.reject(new Error(`Endereço não permitido: ${host}`));
  return new Promise((resolve, reject) => {
    const req = (url.protocol === 'https:' ? https : http).get(url, {
      lookup: safeLookup as any,
      signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; DrocsidBot/1.0)', accept: 'text/html,image/*;q=0.9' },
    }, (res) => {
      const type = res.headers['content-type'] ?? '';
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        return resolve({ url, type, html: '', location: res.headers.location });
      }
      if (status >= 400 || !type.startsWith('text/html')) {
        res.destroy();
        return resolve({ url, type: status >= 400 ? '' : type, html: '' });
      }
      let html = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        html += chunk;
        if (html.length > MAX_HTML) res.destroy();
      });
      res.on('close', () => resolve({ url, type, html }));
    });
    req.on('error', reject);
  });
}

async function fetchPage(url: URL, signal: AbortSignal): Promise<Page> {
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const page = await get(url, signal);
    if (!page.location) return page;
    url = new URL(page.location, url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') break;
  }
  throw new Error('Redirecionamentos demais');
}

const decode = (s: string) =>
  s.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|#39|apos);/gi, (_, e: string) => {
    const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'" };
    if (named[e.toLowerCase()]) return named[e.toLowerCase()];
    const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
  }).trim();

export function parseEmbed(html: string, pageUrl: URL): Embed | null {
  const meta: Record<string, string> = {};
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const value = /\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i.exec(tag);
    if (key && value && !(key in meta)) meta[key] = decode(value[1] ?? value[2]);
  }
  const title = meta['og:title'] ?? meta['twitter:title'] ?? decode(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? '');
  const description = meta['og:description'] ?? meta['twitter:description'] ?? meta.description;
  if (!title && !description) return null;
  let image: string | undefined;
  try {
    const src = meta['og:image'] ?? meta['twitter:image'];
    const abs = src ? new URL(src, pageUrl) : null;
    if (abs && (abs.protocol === 'https:' || abs.protocol === 'http:')) image = abs.href;
  } catch {}
  return {
    type: 'link',
    url: pageUrl.href,
    title: title?.slice(0, 256) || undefined,
    description: description?.slice(0, 350) || undefined,
    site_name: meta['og:site_name']?.slice(0, 100),
    image: image ? { url: image } : undefined,
  };
}

// Links entre <> não geram prévia, como no Discord.
export async function unfurl(content: string): Promise<Embed[]> {
  const links = [...content.matchAll(/(?<!<)https?:\/\/[^\s<>]+/g)].map((m) => m[0].replace(/[.,!?)]+$/, ''));
  const unique = [...new Set(links)].slice(0, MAX_LINKS);
  const signal = AbortSignal.timeout(8000);
  const results = await Promise.allSettled(unique.map(async (link): Promise<Embed | null> => {
    const page = await fetchPage(new URL(link), signal);
    if (page.type.startsWith('image/')) return { type: 'image', url: page.url.href, image: { url: page.url.href } };
    return page.html ? parseEmbed(page.html, page.url) : null;
  }));
  return results.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []));
}
