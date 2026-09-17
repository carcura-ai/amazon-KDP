import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router';
import { LogIn } from 'lucide-react';
import { get, post } from '../api/client';
import type { Branding } from '../api/types';
import { useAuth, applyBranding } from '../app/auth';
import { Button, Field, Input } from '../components/ui';

/** Läuft die Oberfläche in der nativen iPhone-App (Capacitor-Hülle)? */
const isNativeApp = typeof window !== 'undefined' && Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

export function LoginPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const branding = useQuery({ queryKey: ['branding'], queryFn: () => get<Branding>(`/api/branding${new URLSearchParams(window.location.search).get('mandant') ? `?slug=${encodeURIComponent(new URLSearchParams(window.location.search).get('mandant') ?? '')}` : ''}`), staleTime: 60_000 });
  const b = branding.data;
  useEffect(() => { if (b) { applyBranding(b.primaryColor, b.secondaryColor); document.title = `${b.name} · ${b.productName}`; } }, [b]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (challenge) {
        await post('/api/auth/2fa/verify', { challenge, code });
      } else {
        const r = await post<{ requires2fa?: boolean; challenge?: string }>('/api/auth/login', { email, password });
        if (r.requires2fa && r.challenge) { setChallenge(r.challenge); setCode(''); return; }
      }
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
            <div className="brand-mark" style={b?.hasLogo ? { background: '#fff' } : undefined}>{b?.hasLogo ? <img src={`/api/branding/logo${b.slug ? `?slug=${encodeURIComponent(b.slug)}` : ''}`} alt="" style={{ objectFit: 'contain', padding: 3, width: '100%', height: '100%' }} /> : (b?.name ?? 'M').charAt(0)}</div>
            <div>
              <h1>Anmelden</h1>
              <p className="muted small">{b ? `${b.name} · ${b.productName}` : 'Zugang zum Management-System'}</p>
            </div>
          </div>
          <form onSubmit={submit} className="stack">
            {challenge ? (
              <>
                <p className="muted small">Zweiter Faktor: Bitte den 6-stelligen Code aus der Authenticator-App eingeben. Alternativ ein Wiederherstellungscode.</p>
                <Field label="Sicherheitscode" error={error ?? undefined}><Input inputMode="numeric" autoComplete="one-time-code" required autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="123 456" /></Field>
                <Button type="submit" variant="primary" className="block" loading={busy}><LogIn /> Bestätigen</Button>
                <button type="button" className="btn ghost block" onClick={() => { setChallenge(null); setError(null); }}>Zurück</button>
              </>
            ) : (
              <>
                <Field label="E-Mail-Adresse"><Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></Field>
                <Field label="Passwort" error={error ?? undefined}><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
                <Button type="submit" variant="primary" className="block" loading={busy}><LogIn /> Anmelden</Button>
              </>
            )}
          </form>
          {b?.poweredBy ? <p className="small dim" style={{ textAlign: 'center', marginTop: 14 }}>{b.poweredBy}</p> : null}
          {isNativeApp ? <p className="small" style={{ textAlign: 'center', marginTop: 14 }}><a href="capacitor://localhost/index.html?change=1" style={{ color: 'var(--fg-muted)' }}>Server-Adresse ändern</a></p> : null}
        </div>
      </div>
    </div>
  );
}
