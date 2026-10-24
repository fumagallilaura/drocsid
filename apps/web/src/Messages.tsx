import { Fragment, useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react';
import { Avatar, type Api, type Attachment, type Embed, type Message, type User } from './ui.tsx';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '🇧🇷'];
const GROUP_WINDOW_MS = 7 * 60 * 1000;
// O cliente do Discord reenvia "digitando" a cada 80% da janela de 10 s que o indicador fica visível.
const TYPING_RESEND_MS = 8000;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const time = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const fileSize = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`);

// Menções viajam como <@id>, como no Discord; na digitação e na edição a pessoa vê @nome.
const toWire = (text: string, users: User[]) =>
  text.replace(/@([a-z0-9_.]{2,32})/g, (all, name) => {
    const u = users.find((x) => x.username === name);
    return u ? `<@${u.id}>` : all;
  });
const fromWire = (text: string, users: Map<string, User>) =>
  text.replace(/<@(\d+)>/g, (all, id) => (users.has(id) ? `@${users.get(id)!.username}` : all));

function Content({ text, users, me }: { text: string; users: Map<string, User>; me: User }) {
  return text.split(/(<@\d+>|https?:\/\/[^\s<>]+)/g).map((part, i) => {
    const mention = /^<@(\d+)>$/.exec(part);
    if (mention) {
      const name = users.get(mention[1])?.username ?? 'usuário-desconhecido';
      return <span key={i} className={`mention ${mention[1] === me.id ? 'me' : ''}`}>@{name}</span>;
    }
    if (/^https?:\/\//.test(part)) return <a key={i} href={part} target="_blank" rel="noreferrer noopener">{part}</a>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function AttachmentView({ file }: { file: Attachment }) {
  if (file.content_type.startsWith('image/')) {
    return <a href={file.url} target="_blank" rel="noreferrer"><img className="attachment-media" src={file.url} alt={file.filename} loading="lazy" /></a>;
  }
  if (file.content_type.startsWith('video/')) return <video className="attachment-media" src={file.url} controls preload="metadata" />;
  if (file.content_type.startsWith('audio/')) return <audio src={file.url} controls preload="metadata" />;
  return (
    <a className="file-card" href={file.url} download={file.filename}>
      <span aria-hidden>📄</span>
      <span><strong>{file.filename}</strong><small>{fileSize(file.size)}</small></span>
    </a>
  );
}

// ponytail: imagens de embeds carregam direto do site de origem; o Discord passa por um proxy para não expor o IP de quem lê.
function EmbedView({ embed }: { embed: Embed }) {
  if (embed.type === 'image') {
    return <a href={embed.url} target="_blank" rel="noreferrer"><img className="attachment-media" src={embed.url} alt="" loading="lazy" /></a>;
  }
  return (
    <article className="embed">
      {embed.site_name && <small>{embed.site_name}</small>}
      {embed.title && <a href={embed.url} target="_blank" rel="noreferrer noopener"><strong>{embed.title}</strong></a>}
      {embed.description && <p>{embed.description}</p>}
      {embed.image && <img src={embed.image.url} alt="" loading="lazy" />}
    </article>
  );
}

type Props = {
  api: Api;
  me: User;
  channelId: string;
  label: string;
  messages: Message[];
  users: Map<string, User>;
  mentionable: User[];
  typing: string[];
  canModerate: boolean;
};

export function Messages({ api, me, channelId, label, messages, users, mentionable, typing, canModerate }: Props) {
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastTyping = useRef(0);
  const fail = (err: Error) => alert(err.message);

  useEffect(() => {
    setReplyTo(null);
    setEditing(null);
    setFiles([]);
    setText('');
    inputRef.current?.focus();
  }, [channelId]);

  // Só desce sozinho se a pessoa já estava perto do fim, para não atrapalhar quem está lendo o histórico.
  useEffect(() => {
    const el = listRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 200) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function addFiles(list: FileList | File[]) {
    const accepted = [...list].filter((f) => f.size <= MAX_FILE_SIZE);
    if (accepted.length < list.length) alert('Arquivos acima de 10 MB foram ignorados.');
    setFiles((fs) => [...fs, ...accepted].slice(0, 10));
  }

  async function send() {
    const content = toWire(text, mentionable);
    if ((!content.trim() && !files.length) || sending) return;
    setSending(true);
    try {
      let attachments: { uploaded_filename: string }[] = [];
      if (files.length) {
        const slots = await api('POST', `/channels/${channelId}/attachments`, {
          files: files.map((f) => ({ filename: f.name, file_size: f.size })),
        });
        await Promise.all(slots.attachments.map((s: any, i: number) => api('PUT', s.upload_url.replace(/^\/api/, ''), files[i])));
        attachments = slots.attachments.map((s: any) => ({ uploaded_filename: s.upload_filename }));
      }
      await api('POST', `/channels/${channelId}/messages`, {
        content,
        attachments,
        ...(replyTo && { message_reference: { message_id: replyTo.id } }),
      });
      setText('');
      setFiles([]);
      setReplyTo(null);
      lastTyping.current = 0;
    } catch (err) {
      fail(err as Error);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function onComposerKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    } else if (e.key === 'Escape') {
      setReplyTo(null);
    } else if (e.key === 'ArrowUp' && !text) {
      const last = messages.findLast((m) => m.author.id === me.id);
      if (last) {
        e.preventDefault();
        setEditing(last.id);
      }
    }
  }

  function onTextChange(value: string) {
    setText(value);
    if (value && Date.now() - lastTyping.current > TYPING_RESEND_MS) {
      lastTyping.current = Date.now();
      api('POST', `/channels/${channelId}/typing`).catch(() => {});
    }
  }

  const react = (m: Message, emoji: string, mine: boolean) => {
    setPicker(null);
    api(mine ? 'DELETE' : 'PUT', `/channels/${channelId}/messages/${m.id}/reactions/${encodeURIComponent(emoji)}/@me`).catch(fail);
  };
  const remove = (m: Message, skipConfirm: boolean) => {
    if (skipConfirm || confirm('Tem certeza de que deseja apagar esta mensagem?')) {
      api('DELETE', `/channels/${channelId}/messages/${m.id}`).catch(fail);
    }
  };
  const saveEdit = (m: Message, value: string) =>
    api('PATCH', `/channels/${channelId}/messages/${m.id}`, { content: toWire(value, mentionable) })
      .then(() => setEditing(null))
      .catch(fail);

  const typingText =
    typing.length === 0 ? '' :
    typing.length === 1 ? `${typing[0]} está digitando…` :
    typing.length <= 3 ? `${typing.slice(0, -1).join(', ')} e ${typing.at(-1)} estão digitando…` :
    'Várias pessoas estão digitando…';

  return (
    <div
      className="chat"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        addFiles(e.dataTransfer.files);
      }}
    >
      <ol className="messages" ref={listRef} aria-label={`Mensagens em ${label}`}>
        {!messages.length && <li className="empty">Este é o começo de {label}. Diga oi!</li>}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const grouped = !!prev && !m.referenced_message && prev.author.id === m.author.id &&
            new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_WINDOW_MS;
          const mentionsMe = m.mentions.some((u) => u.id === me.id) || m.referenced_message?.author.id === me.id;
          const canDelete = m.author.id === me.id || canModerate;
          return (
            <li key={m.id} className={`message ${grouped ? 'grouped' : ''} ${mentionsMe ? 'mentioned' : ''}`}>
              {m.referenced_message && (
                <div className="reply-preview">
                  <span>↱</span> <strong>@{m.referenced_message.author.username}</strong>{' '}
                  {fromWire(m.referenced_message.content, users) || 'Clique para ver o anexo'}
                </div>
              )}
              <div className="message-row">
                {grouped ? <time className="hover-time" dateTime={m.created_at}>{time(m.created_at)}</time> : <Avatar name={m.author.username} />}
                <div className="message-body">
                  {!grouped && (
                    <div>
                      <strong>{m.author.username}</strong>
                      <time dateTime={m.created_at}>{dateTime(m.created_at)}</time>
                    </div>
                  )}
                  {editing === m.id ? (
                    <EditBox initial={fromWire(m.content, users)} onSave={(v) => saveEdit(m, v)} onCancel={() => setEditing(null)} />
                  ) : (
                    m.content && (
                      <p>
                        <Content text={m.content} users={users} me={me} />
                        {m.edited_timestamp && <small className="edited" title={dateTime(m.edited_timestamp)}> (editado)</small>}
                      </p>
                    )
                  )}
                  {m.attachments.map((a) => <AttachmentView key={a.id} file={a} />)}
                  {m.embeds.map((e, j) => <EmbedView key={j} embed={e} />)}
                  {!!m.reactions?.length && (
                    <div className="reactions">
                      {m.reactions.map((r) => (
                        <button key={r.emoji.name} className="reaction" aria-pressed={r.me}
                          aria-label={`${r.emoji.name}, ${r.count} ${r.count === 1 ? 'reação' : 'reações'}`}
                          onClick={() => react(m, r.emoji.name, r.me)}>
                          {r.emoji.name} {r.count}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="message-actions" role="toolbar" aria-label="Ações da mensagem">
                <button title="Adicionar reação" aria-label="Adicionar reação" aria-expanded={picker === m.id}
                  onClick={() => setPicker(picker === m.id ? null : m.id)}>😀</button>
                <button title="Responder" aria-label="Responder" onClick={() => { setReplyTo(m); inputRef.current?.focus(); }}>↩</button>
                {m.author.id === me.id && <button title="Editar" aria-label="Editar" onClick={() => setEditing(m.id)}>✏️</button>}
                {canDelete && (
                  <button title="Apagar (Shift pula a confirmação)" aria-label="Apagar" className="danger" onClick={(e) => remove(m, e.shiftKey)}>🗑</button>
                )}
                {picker === m.id && (
                  <div className="emoji-picker">
                    {QUICK_REACTIONS.map((emoji) => (
                      <button key={emoji} aria-label={`Reagir com ${emoji}`}
                        onClick={() => react(m, emoji, !!m.reactions?.find((r) => r.emoji.name === emoji)?.me)}>{emoji}</button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        {replyTo && (
          <div className="composer-bar">
            Respondendo a <strong>{replyTo.author.username}</strong>
            <button type="button" className="icon-btn" aria-label="Cancelar resposta" onClick={() => setReplyTo(null)}>✕</button>
          </div>
        )}
        {!!files.length && (
          <ul className="pending-files">
            {files.map((f, i) => (
              <li key={i}>
                📎 {f.name} <small>{fileSize(f.size)}</small>
                <button type="button" className="icon-btn" aria-label={`Remover ${f.name}`} onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}>✕</button>
              </li>
            ))}
          </ul>
        )}
        <div className="composer-row">
          <label className="upload-btn" title="Enviar arquivo">
            <span aria-hidden>+</span>
            <input type="file" multiple hidden aria-label="Enviar arquivo" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
          </label>
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            placeholder={`Conversar em ${label}`}
            aria-label={`Mensagem em ${label}`}
            maxLength={2000}
            disabled={sending}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={onComposerKey}
            onPaste={(e: ClipboardEvent) => { if (e.clipboardData.files.length) { e.preventDefault(); addFiles(e.clipboardData.files); } }}
          />
        </div>
        <p className="typing" aria-live="polite">{typingText}</p>
      </form>
    </div>
  );
}

function EditBox({ initial, onSave, onCancel }: { initial: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="edit-box">
      <textarea
        autoFocus
        value={value}
        maxLength={2000}
        aria-label="Editar mensagem"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            value === initial ? onCancel() : onSave(value);
          }
        }}
      />
      <small>esc para <button className="link" onClick={onCancel}>cancelar</button> • enter para <button className="link" onClick={() => onSave(value)}>salvar</button></small>
    </div>
  );
}
