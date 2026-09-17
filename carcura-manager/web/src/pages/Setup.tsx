import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { post, ApiError } from '../api/client';
import { useAuth } from '../app/auth';
import { Button, Field, Input } from '../components/ui';

export function SetupPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [c, setC] = useState({ name: '', email: '', phone: '', website: '', street: '', zip: '', city: '', primaryColor: '#E8F320' });
  const [a, setA] = useState({ firstName: '', lastName: '', email: '', password: '', password2: '' });
  const [seed, setSeed] = useState(true);
  const [err, setErr] = useState<ApiError | Error | null>(null);
  const [busy, setBusy] = useState(false);
  const fe = (p: string) => (err instanceof ApiError ? err.fieldError(p) : undefined);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (a.password !== a.password2) return setErr(new Error('Die Passwörter stimmen nicht überein.'));
    setBusy(true);
    setErr(null);
    try {
      await post('/api/setup', { company: { ...c, email: c.email || null, phone: c.phone || null, website: c.website || null, street: c.street || null, zip: c.zip || null, city: c.city || null }, admin: { firstName: a.firstName, lastName: a.lastName, email: a.email, password: a.password }, seedDefaultServices: seed });
      await refresh();
      navigate('/', { replace: true });
    } catch (e2) {
      setErr(e2 as Error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="card auth-card wide">
        <div className="card-body">
          <div className="auth-logo">
            <div className="brand-mark" style={{ background: c.primaryColor }}>{(c.name || 'M').slice(0, 1).toUpperCase()}</div>
            <div>
              <h1>Ersteinrichtung</h1>
              <p className="muted small">Unternehmen und Administrator anlegen. Alle Angaben lassen sich später ändern.</p>
            </div>
          </div>
          <form onSubmit={submit}>
            <h2 style={{ marginBottom: 12 }}>Unternehmen</h2>
            <div className="form-grid">
              <Field label="Firmenname *" error={fe('company.name')} className="span-2"><Input required value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="z. B. Carcura" /></Field>
              <Field label="E-Mail"><Input type="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} /></Field>
              <Field label="Telefon"><Input value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></Field>
              <Field label="Website"><Input value={c.website} onChange={(e) => setC({ ...c, website: e.target.value })} placeholder="https://" /></Field>
              <Field label="Markenfarbe"><div className="row"><input type="color" value={c.primaryColor} onChange={(e) => setC({ ...c, primaryColor: e.target.value.toUpperCase() })} /><span className="mono">{c.primaryColor}</span></div></Field>
              <Field label="Straße und Hausnummer"><Input value={c.street} onChange={(e) => setC({ ...c, street: e.target.value })} /></Field>
              <div className="row" style={{ gap: 12, alignItems: 'stretch' }}>
                <Field label="PLZ" className="" ><Input value={c.zip} onChange={(e) => setC({ ...c, zip: e.target.value })} style={{ width: 96 }} /></Field>
                <Field label="Ort" className="" ><Input value={c.city} onChange={(e) => setC({ ...c, city: e.target.value })} /></Field>
              </div>
            </div>
            <h2 style={{ margin: '22px 0 12px' }}>Administrator</h2>
            <div className="form-grid">
              <Field label="Vorname *" error={fe('admin.firstName')}><Input required value={a.firstName} onChange={(e) => setA({ ...a, firstName: e.target.value })} /></Field>
              <Field label="Nachname *" error={fe('admin.lastName')}><Input required value={a.lastName} onChange={(e) => setA({ ...a, lastName: e.target.value })} /></Field>
              <Field label="E-Mail (Anmeldename) *" error={fe('admin.email')} className="span-2"><Input type="email" required value={a.email} onChange={(e) => setA({ ...a, email: e.target.value })} /></Field>
              <Field label="Passwort *" hint="Mindestens 10 Zeichen, Groß- und Kleinbuchstaben, eine Ziffer." error={fe('admin.password')}><Input type="password" required autoComplete="new-password" value={a.password} onChange={(e) => setA({ ...a, password: e.target.value })} /></Field>
              <Field label="Passwort wiederholen *"><Input type="password" required autoComplete="new-password" value={a.password2} onChange={(e) => setA({ ...a, password2: e.target.value })} /></Field>
              <label className="check span-2"><input type="checkbox" checked={seed} onChange={(e) => setSeed(e.target.checked)} /> Startkatalog typischer Aufbereitungsleistungen anlegen (Preise werden später gepflegt)</label>
            </div>
            {err && !(err instanceof ApiError && err.details?.length) ? <p className="error" style={{ color: 'var(--danger)', marginTop: 12 }}>{err.message}</p> : null}
            <div className="form-actions">
              <Button type="submit" variant="primary" loading={busy}>Einrichtung abschließen</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
