import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { KeyRound, Mail } from 'lucide-react';
import { post } from '../api/client';
import { Button, Field, Input } from '../components/ui';

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="auth">
      <div className="card auth-card">
        <div className="card-body">
          <div className="auth-logo">
            <div className="brand-mark"><KeyRound /></div>
            <div><h1>{title}</h1><p className="muted small">{subtitle}</p></div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/** „Passwort vergessen“: Link per E-Mail anfordern. Die Antwort verrät nicht, ob ein Konto existiert. */
export function PasswordForgotPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { const r = await post<{ message: string }>('/api/auth/password-reset/request', { email }); setDone(r.message); }
    catch (err) { setError(err instanceof Error ? err.message : 'Anfrage fehlgeschlagen.'); }
    finally { setBusy(false); }
  };
  return (
    <AuthCard title="Passwort vergessen" subtitle="Link zum Zurücksetzen per E-Mail">
      {done ? (
        <div className="stack"><p>{done}</p><p className="muted small">Der Link ist 30 Minuten gültig. Bitte auch den Spam-Ordner prüfen.</p><Link className="btn block" to="/login">Zur Anmeldung</Link></div>
      ) : (
        <form onSubmit={submit} className="stack">
          <Field label="E-Mail-Adresse Ihres Kontos" error={error ?? undefined}><Input type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Button type="submit" variant="primary" className="block" loading={busy}><Mail /> Link anfordern</Button>
          <Link className="btn ghost block" to="/login">Zurück</Link>
        </form>
      )}
    </AuthCard>
  );
}

/** Neues Passwort mit dem Einmal-Link setzen. */
export function PasswordResetPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null);
    if (password !== repeat) { setError('Die Passwörter stimmen nicht überein.'); return; }
    setBusy(true);
    try { await post('/api/auth/password-reset/confirm', { token, password }); setDone(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'Zurücksetzen fehlgeschlagen.'); }
    finally { setBusy(false); }
  };
  if (!token) return <AuthCard title="Link unvollständig" subtitle="Passwort zurücksetzen"><Link className="btn block" to="/passwort-vergessen">Neuen Link anfordern</Link></AuthCard>;
  return (
    <AuthCard title="Neues Passwort" subtitle="Mindestens 10 Zeichen, Groß- und Kleinbuchstaben und eine Ziffer">
      {done ? (
        <div className="stack"><p>Das Passwort wurde geändert. Alle bisherigen Anmeldungen wurden beendet.</p><Button variant="primary" className="block" onClick={() => navigate('/login', { replace: true })}>Jetzt anmelden</Button></div>
      ) : (
        <form onSubmit={submit} className="stack">
          <Field label="Neues Passwort"><Input type="password" autoComplete="new-password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Field label="Wiederholen" error={error ?? undefined}><Input type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} /></Field>
          <Button type="submit" variant="primary" className="block" loading={busy}><KeyRound /> Passwort speichern</Button>
        </form>
      )}
    </AuthCard>
  );
}
