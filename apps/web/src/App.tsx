import { useState, type FormEvent } from 'react';
import { Chat } from './Chat.tsx';

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [error, setError] = useState('');

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

  if (token) return <Chat token={token} onLogout={logout} />;

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
