import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { LogIn } from 'lucide-react';
import { post } from '../api/client';
import { useAuth } from '../app/auth';
import { Button, Field, Input } from '../components/ui';

export function LoginPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post('/api/auth/login', { email, password });
      await refresh();
      navigate(loc.state?.from && loc.state.from !== '/login' ? loc.state.from : '/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="card auth-card">
        <div className="card-body">
          <div className="auth-logo">
            <div className="brand-mark">M</div>
            <div>
              <h1>Anmelden</h1>
              <p className="muted small">Zugang zum Management-System</p>
            </div>
          </div>
          <form onSubmit={submit} className="stack">
            <Field label="E-Mail-Adresse"><Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></Field>
            <Field label="Passwort" error={error ?? undefined}><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <Button type="submit" variant="primary" className="block" loading={busy}><LogIn /> Anmelden</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
