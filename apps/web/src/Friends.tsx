import { useState, type FormEvent } from 'react';
import { Avatar, FriendsIcon, Rel, STATUS_LABEL, type Api, type Relationship, type Status } from './ui.tsx';

type Tab = 'online' | 'all' | 'pending' | 'add';

type Props = {
  api: Api;
  relationships: Relationship[];
  statusOf: (id: string) => Status;
  openDm: (userId: string) => void;
};

export function Friends({ api, relationships, statusOf, openDm }: Props) {
  const [tab, setTab] = useState<Tab>('online');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const fail = (err: Error) => alert(err.message);

  const friends = relationships.filter((r) => r.type === Rel.FRIEND);
  const pending = relationships.filter((r) => r.type === Rel.PENDING_INCOMING || r.type === Rel.PENDING_OUTGOING);
  const rows =
    tab === 'online' ? friends.filter((r) => statusOf(r.id) !== 'offline') :
    tab === 'all' ? friends :
    tab === 'pending' ? pending : [];
  const heading = { online: 'Disponível', all: 'Todos os amigos', pending: 'Pendente', add: '' }[tab];

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const username = String(new FormData(form).get('username'));
    try {
      await api('POST', '/users/@me/relationships', { username });
      setResult({ ok: true, text: `Pronto! Seu pedido de amizade para ${username} foi enviado.` });
      form.reset();
    } catch (err) {
      setResult({ ok: false, text: (err as Error).message });
    }
  }

  return (
    <section className="friends" aria-label="Amigos">
      <header className="header">
        <span className="title"><FriendsIcon /> Amigos</span>
        <nav className="tabs" aria-label="Filtro de amigos">
          {(['online', 'all', 'pending'] as const).map((t) => (
            <button key={t} className="tab" aria-current={tab === t || undefined} onClick={() => setTab(t)}>
              {{ online: 'Disponível', all: 'Todos', pending: 'Pendente' }[t]}
              {t === 'pending' && pending.some((r) => r.type === Rel.PENDING_INCOMING) && (
                <span className="badge">{pending.filter((r) => r.type === Rel.PENDING_INCOMING).length}</span>
              )}
            </button>
          ))}
          <button className="tab add" aria-current={tab === 'add' || undefined} onClick={() => { setTab('add'); setResult(null); }}>
            Adicionar amigo
          </button>
        </nav>
      </header>

      {tab === 'add' ? (
        <form className="add-friend" onSubmit={add}>
          <h2>Adicionar amigo</h2>
          <p>Você pode adicionar amigos com o nome de usuário deles no Drocsid.</p>
          <div className="add-friend-row">
            <input name="username" placeholder="Digite o nome de usuário" aria-label="Nome de usuário" required autoComplete="off" />
            <button className="btn primary">Enviar pedido de amizade</button>
          </div>
          {result && <p className={result.ok ? 'success' : 'error'} role="status">{result.text}</p>}
        </form>
      ) : (
        <div className="friend-list">
          <h3>{heading} — {rows.length}</h3>
          {!rows.length && (
            <p className="empty">
              {tab === 'pending' ? 'Não há pedidos de amizade pendentes.' : 'Ninguém por aqui ainda. Que tal adicionar um amigo?'}
            </p>
          )}
          <ul>
            {rows.map((r) => {
              const status = statusOf(r.id);
              return (
                <li key={r.id} className="friend">
                  <Avatar name={r.user.username} status={status} />
                  <span className="friend-name">
                    <strong>{r.user.username}</strong>
                    <small>
                      {r.type === Rel.PENDING_INCOMING ? 'Pedido de amizade recebido'
                        : r.type === Rel.PENDING_OUTGOING ? 'Pedido de amizade enviado'
                        : STATUS_LABEL[status]}
                    </small>
                  </span>
                  {r.type === Rel.FRIEND && (
                    <button className="round-btn" title="Mensagem" aria-label={`Mandar mensagem para ${r.user.username}`} onClick={() => openDm(r.id)}>💬</button>
                  )}
                  {r.type === Rel.PENDING_INCOMING && (
                    <button className="round-btn ok" title="Aceitar" aria-label={`Aceitar ${r.user.username}`}
                      onClick={() => api('PUT', `/users/@me/relationships/${r.id}`).catch(fail)}>✓</button>
                  )}
                  <button className="round-btn" title={r.type === Rel.FRIEND ? 'Desfazer amizade' : 'Recusar'}
                    aria-label={`${r.type === Rel.FRIEND ? 'Desfazer amizade com' : 'Recusar'} ${r.user.username}`}
                    onClick={() => (r.type !== Rel.FRIEND || confirm(`Desfazer amizade com ${r.user.username}?`)) &&
                      api('DELETE', `/users/@me/relationships/${r.id}`).catch(fail)}>✕</button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
