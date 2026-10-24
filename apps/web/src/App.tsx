import { useEffect, useState, type FormEvent } from 'react';

type User = { id: string; username: string };

const Op = { DISPATCH: 0, HEARTBEAT: 1, IDENTIFY: 2, HELLO: 10 };
const AUTHENTICATION_FAILED = 4004;

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/gateway`);
    const send = (op: number, d: unknown) => ws.send(JSON.stringify({ op, d }));
    let seq: number | null = null;
    let heartbeat: number | undefined;

    ws.onmessage = (e) => {
      const { op, d, s, t } = JSON.parse(e.data);
      if (s) seq = s;
      if (op === Op.HELLO) {
        heartbeat = window.setInterval(() => send(Op.HEARTBEAT, seq), d.heartbeat_interval);
        send(Op.IDENTIFY, { token });
      }
      if (op === Op.DISPATCH && t === 'READY') setUser(d.user);
    };
    ws.onclose = (e) => {
      clearInterval(heartbeat);
      setUser(null);
      if (e.code === AUTHENTICATION_FAILED) logout();
    };

    return () => {
      clearInterval(heartbeat);
      ws.onclose = null;
      ws.close();
    };
  }, [token]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const action = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement).value;
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/auth/${action}`, {
      method: 'POST',
      body: JSON.stringify({ username: form.get('username'), password: form.get('password') }),
    });
    const body = await res.json();
    if (!res.ok) return setError(body.error);
    setError('');
    localStorage.setItem('token', body.token);
    setToken(body.token);
  }

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
  }

  if (token) {
    return (
      <main>
        <p>{user ? `Conectado ao gateway como ${user.username}` : 'Conectando…'}</p>
        <button onClick={logout}>Sair</button>
      </main>
    );
  }

  return (
    <main>
      <h1>Drocsid</h1>
      <form onSubmit={submit}>
        <label>
          Usuário <input name="username" autoComplete="username" required />
        </label>
        <label>
          Senha <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button value="login">Entrar</button>
        <button value="register">Criar conta</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
