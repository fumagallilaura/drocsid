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
      body: JSON.stringify({ username: form.get('username'), password: form.get('password'), accept_terms: form.has('accept_terms') }),
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
    <main className="login">
      <form onSubmit={submit}>
        <h1>
          Drocsid<span>.</span>
        </h1>
        <label>
          Usuário <input name="username" autoComplete="username" required />
        </label>
        <label>
          Senha <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <label className="consent">
          <input name="accept_terms" type="checkbox" />
          <span>
            Para criar conta: tenho 18 anos ou mais e li e aceito os <a href="/termos.html" target="_blank">Termos de Uso</a> e
            a <a href="/privacidade.html" target="_blank">Política de Privacidade</a>.
          </span>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions">
          <button className="btn primary" value="login">Entrar</button>
          <button className="btn" value="register">Criar conta</button>
        </div>
      </form>
    </main>
  );
}
