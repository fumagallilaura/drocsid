export type User = { id: string; username: string };
export type Status = 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';
export type Channel = {
  id: string;
  guild_id: string | null;
  name: string;
  type: 'text' | 'voice' | 'dm';
  recipients?: User[];
  last_message_id?: string | null;
};
export type VoiceState = { guild_id: string; channel_id: string | null; user: User };
export type Presence = { user: { id: string }; status: Status };
export type Guild = {
  id: string;
  name: string;
  owner_id: string;
  channels: Channel[];
  members: User[];
  voice_states?: VoiceState[];
  presences?: Presence[];
};
export type Relationship = { id: string; type: number; user: User };
export type Attachment = { id: string; filename: string; size: number; content_type: string; url: string };
export type Embed = {
  type: 'link' | 'image';
  url: string;
  title?: string;
  description?: string;
  site_name?: string;
  image?: { url: string };
};
export type Reaction = { emoji: { name: string }; count: number; me: boolean };
export type Message = {
  id: string;
  channel_id: string;
  content: string;
  created_at: string;
  edited_timestamp: string | null;
  author: User;
  attachments: Attachment[];
  embeds: Embed[];
  mentions: User[];
  reactions?: Reaction[];
  referenced_message: { id: string; content: string; author: User } | null;
};
export type Api = (method: string, path: string, body?: unknown) => Promise<any>;

// Mesmos valores do enum de relacionamentos do Discord.
export const Rel = { FRIEND: 1, PENDING_INCOMING: 3, PENDING_OUTGOING: 4 };

export const STATUS_LABEL: Record<Status, string> = {
  online: 'Disponível',
  idle: 'Ausente',
  dnd: 'Não perturbe',
  invisible: 'Invisível',
  offline: 'Offline',
};

export function createApi(token: string): Api {
  return async (method, path, body) => {
    const raw = body instanceof Blob;
    const res = await fetch(`/api${path}`, {
      method,
      headers: { authorization: token, ...(raw && { 'content-type': body.type || 'application/octet-stream' }) },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
    const data = res.status === 204 ? null : await res.json();
    if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}`);
    return data;
  };
}

export const initials = (name: string) =>
  name.split(/[\s_.-]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export function Avatar({ name, size, status }: { name: string; size?: 'small' | 'large'; status?: Status }) {
  return (
    <span className={`avatar ${size ?? ''}`} aria-hidden>
      {initials(name)}
      {status && <span className={`status-dot ${status}`} />}
    </span>
  );
}

export const SpeakerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ verticalAlign: 'text-bottom' }}>
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4z" />
  </svg>
);

export const FriendsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3.3 0-7 1.7-7 4v2h14v-2c0-2.3-3.7-4-7-4Zm8-2a3 3 0 1 0 0-6v6Zm1 2h-1.5A5 5 0 0 1 18 18v2h4v-2c0-2-2-3.6-4-4Z" />
  </svg>
);
