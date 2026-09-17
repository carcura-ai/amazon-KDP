import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Route, Routes, NavLink } from 'react-router';
import { Plus, RefreshCw, Copy } from 'lucide-react';
import { get, post, patch, del } from '../api/client';
import type { Company, User, Service } from '../api/types';
import { useAuth, applyBranding } from '../app/auth';
import { Badge, Button, Card, Confirm, Field, Input, Modal, PageHead, Select, Skeleton, Textarea, useToast } from '../components/ui';
import { fmtDateTime, fmtMoney, inputFromCents, centsFromInput, ROLE_LABEL } from '../lib/format';

const PERM_LABEL: Record<string, string> = {
  'dashboard:read': 'Dashboard', 'leads:read': 'Leads sehen', 'leads:write': 'Leads bearbeiten', 'customers:read': 'Kunden sehen', 'customers:write': 'Kunden bearbeiten', 'customers:delete': 'Kunden löschen',
  'vehicles:read': 'Fahrzeuge sehen', 'vehicles:write': 'Fahrzeuge bearbeiten', 'appointments:read': 'Termine sehen', 'appointments:write': 'Termine bearbeiten', 'orders:read': 'Aufträge sehen', 'orders:write': 'Aufträge bearbeiten',
  'offers:read': 'Angebote sehen', 'offers:write': 'Angebote bearbeiten', 'invoices:read': 'Rechnungen sehen', 'invoices:write': 'Rechnungen bearbeiten', 'documents:read': 'Dokumente sehen', 'documents:write': 'Dokumente bearbeiten',
  'protocols:read': 'Protokolle sehen', 'protocols:write': 'Protokolle bearbeiten', 'inventory:read': 'Lager sehen', 'inventory:write': 'Lager bearbeiten', 'finance:read': 'Finanzen sehen', 'finance:write': 'Finanzen bearbeiten',
  'marketing:read': 'Marketing sehen', 'reports:read': 'Reports sehen', 'tasks:read': 'Aufgaben sehen', 'tasks:write': 'Aufgaben bearbeiten', 'notes:read': 'Notizen sehen', 'notes:write': 'Notizen bearbeiten', 'assistant:use': 'KI-Assistent nutzen',
  'users:manage': 'Benutzer verwalten', 'settings:manage': 'Einstellungen verwalten', 'integrations:manage': 'Integrationen verwalten', 'audit:read': 'Audit-Log sehen', 'backups:manage': 'Backups verwalten',
};

export function SettingsPage() {
  const { can } = useAuth();
  const tabs = [
    { to: '', label: 'Unternehmen & Branding', show: can('settings:manage') },
    { to: 'leistungen', label: 'Leistungen', show: can('settings:manage') },
    { to: 'benutzer', label: 'Benutzer & Rollen', show: can('users:manage') },
    { to: 'email', label: 'E-Mail-Versand', show: can('integrations:manage') },
    { to: 'integrationen', label: 'Integrationen', show: can('integrations:manage') },
    { to: 'audit', label: 'Audit-Log', show: can('audit:read') },
  ].filter((t) => t.show);
  return (
    <>
      <PageHead title="Einstellungen" sub="Mandant, Branding, Leistungskatalog, Benutzer und Anbindungen." />
      <div className="tabs">{tabs.map((t) => <NavLink key={t.to} to={t.to} end className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>{t.label}</NavLink>)}</div>
      <Routes>
        <Route index element={can('settings:manage') ? <CompanySettings /> : <UsersSettings />} />
        <Route path="leistungen" element={<ServicesSettings />} />
        <Route path="benutzer" element={<UsersSettings />} />
        <Route path="email" element={<MailSettings />} />
        <Route path="integrationen" element={<IntegrationsSettings />} />
        <Route path="audit" element={<AuditLog />} />
      </Routes>
    </>
  );
}

function CompanySettings() {
  const qc = useQueryClient();
  const toast = useToast();
  const { refresh } = useAuth();
  const q = useQuery({ queryKey: ['company'], queryFn: () => get<Company>('/api/company') });
  const [f, setF] = useState<Partial<Company> | null>(null);
  useEffect(() => { if (q.data && !f) setF(q.data); }, [q.data, f]);
  const m = useMutation({
    mutationFn: (payload: Partial<Company>) => patch<Company>('/api/company', payload),
    onSuccess: async (c) => { qc.setQueryData(['company'], c); applyBranding(c.primaryColor, c.secondaryColor); await refresh(); toast.ok('Einstellungen gespeichert'); },
    onError: (e) => toast.fromError(e),
  });
  if (!f) return <Card><Skeleton /></Card>;
  const set = (k: keyof Company) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const { id: _i, slug: _s, createdAt: _c, updatedAt: _u, isActive: _a, logoFileId: _l, currency: _cu, locale: _lo, timezone: _tz, settingsJson: _sj, ...rest } = f as Company & { createdAt?: string; updatedAt?: string };
    m.mutate({ ...rest, defaultVatBp: Number(rest.defaultVatBp), paymentTermsDays: Number(rest.paymentTermsDays), reminderDaysBefore: Number(rest.reminderDaysBefore) });
  };
  return (
    <form onSubmit={submit} className="stack" style={{ gap: 16 }}>
      <div className="grid cols-2">
        <Card title="Unternehmen">
          <div className="form-grid">
            <Field label="Firmenname" className="span-2"><Input value={f.name ?? ''} onChange={set('name')} required /></Field>
            <Field label="Rechtlicher Name (für Rechnungen)" className="span-2"><Input value={f.legalName ?? ''} onChange={set('legalName')} placeholder="z. B. Carcura GbR" /></Field>
            <Field label="E-Mail"><Input type="email" value={f.email ?? ''} onChange={set('email')} /></Field>
            <Field label="Telefon"><Input value={f.phone ?? ''} onChange={set('phone')} /></Field>
            <Field label="Website" className="span-2"><Input value={f.website ?? ''} onChange={set('website')} /></Field>
            <Field label="Straße und Hausnummer" className="span-2"><Input value={f.street ?? ''} onChange={set('street')} /></Field>
            <Field label="PLZ"><Input value={f.zip ?? ''} onChange={set('zip')} /></Field>
            <Field label="Ort"><Input value={f.city ?? ''} onChange={set('city')} /></Field>
            <Field label="Steuernummer"><Input value={f.taxNumber ?? ''} onChange={set('taxNumber')} /></Field>
            <Field label="USt-IdNr."><Input value={f.vatId ?? ''} onChange={set('vatId')} /></Field>
          </div>
        </Card>
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Branding">
            <div className="form-grid">
              <Field label="Hauptfarbe"><div className="row"><input type="color" value={f.primaryColor ?? '#E8F320'} onChange={(e) => setF({ ...f, primaryColor: e.target.value.toUpperCase() })} /><span className="mono">{f.primaryColor}</span></div></Field>
              <Field label="Sekundärfarbe (Text auf Hauptfarbe)"><div className="row"><input type="color" value={f.secondaryColor ?? '#0B0B0C'} onChange={(e) => setF({ ...f, secondaryColor: e.target.value.toUpperCase() })} /><span className="mono">{f.secondaryColor}</span></div></Field>
            </div>
            <LogoUpload hasLogo={Boolean(f.logoFileId)} onChanged={async () => { qc.invalidateQueries({ queryKey: ['company'] }); await refresh(); setF(null); }} />
          </Card>
          <Card title="Rechnungen & Nummernkreise">
            <div className="form-grid">
              <Field label="Präfix Rechnung"><Input value={f.invoicePrefix ?? ''} onChange={set('invoicePrefix')} /></Field>
              <Field label="Präfix Angebot"><Input value={f.offerPrefix ?? ''} onChange={set('offerPrefix')} /></Field>
              <Field label="Präfix Kundennummer"><Input value={f.customerPrefix ?? ''} onChange={set('customerPrefix')} /></Field>
              <Field label="Standard-MwSt. (%)"><Select value={String(f.defaultVatBp ?? 1900)} onChange={(e) => setF({ ...f, defaultVatBp: Number(e.target.value) })}><option value="1900">19 %</option><option value="700">7 %</option><option value="0">0 %</option></Select></Field>
              <Field label="Zahlungsziel (Tage)"><Input type="number" min={0} value={String(f.paymentTermsDays ?? 14)} onChange={(e) => setF({ ...f, paymentTermsDays: Number(e.target.value) })} /></Field>
              <Field label="Terminerinnerung (Tage vorher)"><Input type="number" min={0} value={String(f.reminderDaysBefore ?? 2)} onChange={(e) => setF({ ...f, reminderDaysBefore: Number(e.target.value) })} /></Field>
              <label className="check span-2"><input type="checkbox" checked={Boolean(f.smallBusiness)} onChange={(e) => setF({ ...f, smallBusiness: e.target.checked })} /> Kleinunternehmer nach § 19 UStG (keine Umsatzsteuer ausweisen)</label>
              <Field label="Bank"><Input value={f.bankName ?? ''} onChange={set('bankName')} /></Field>
              <Field label="BIC"><Input value={f.bic ?? ''} onChange={set('bic')} /></Field>
              <Field label="IBAN" className="span-2"><Input value={f.iban ?? ''} onChange={set('iban')} /></Field>
              <Field label="Fußzeile auf Rechnungen und Angeboten" className="span-2"><Textarea value={f.invoiceFooter ?? ''} onChange={set('invoiceFooter')} /></Field>
            </div>
          </Card>
        </div>
      </div>
      <div className="form-actions"><Button type="submit" variant="primary" loading={m.isPending}>Speichern</Button></div>
    </form>
  );
}

function ServicesSettings() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['services', 'all'], queryFn: () => get<{ items: Service[] }>('/api/services?includeInactive=true') });
  const [edit, setEdit] = useState<Partial<Service> | null>(null);
  const save = useMutation({
    mutationFn: (s: Partial<Service>) => (s.id ? patch<Service>(`/api/services/${s.id}`, s) : post<Service>('/api/services', s)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['services'] }); toast.ok('Leistung gespeichert'); setEdit(null); },
    onError: (e) => toast.fromError(e),
  });
  const deactivate = useMutation({ mutationFn: (id: string) => del(`/api/services/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['services'] }); toast.ok('Leistung deaktiviert'); }, onError: (e) => toast.fromError(e) });
  return (
    <Card title="Leistungskatalog" tight actions={<Button size="sm" variant="primary" onClick={() => setEdit({ name: '', category: '', priceCents: 0, vatBp: 1900, durationMinutes: 60, materialCostCents: 0, isActive: true, sortOrder: (q.data?.items.length ?? 0) + 1 })}><Plus /> Leistung</Button>}>
      {q.isLoading ? <Skeleton /> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Leistung</th><th>Kategorie</th><th className="num">Preis</th><th className="num hide-mobile">MwSt.</th><th className="num hide-mobile">Dauer</th><th className="num hide-mobile">Material</th><th>Status</th><th></th></tr></thead>
          <tbody>{q.data?.items.map((s) => (
            <tr key={s.id}>
              <td><div className="primary">{s.name}</div>{s.description ? <div className="secondary">{s.description}</div> : null}</td>
              <td className="muted">{s.category ?? '–'}</td>
              <td className="num">{s.priceCents === 0 ? <span className="badge warn">Preis fehlt</span> : fmtMoney(s.priceCents)}</td>
              <td className="num hide-mobile">{s.vatBp / 100} %</td>
              <td className="num hide-mobile">{s.durationMinutes} Min.</td>
              <td className="num hide-mobile">{fmtMoney(s.materialCostCents)}</td>
              <td>{s.isActive ? <Badge tone="ok">aktiv</Badge> : <Badge>inaktiv</Badge>}</td>
              <td className="num"><div className="row" style={{ justifyContent: 'flex-end' }}><Button size="sm" onClick={() => setEdit(s)}>Bearbeiten</Button>{s.isActive ? <Button size="sm" variant="ghost" onClick={() => deactivate.mutate(s.id)}>Deaktivieren</Button> : null}</div></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {edit ? (
        <Modal title={edit.id ? 'Leistung bearbeiten' : 'Neue Leistung'} onClose={() => setEdit(null)}>
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(edit); }}>
            <div className="form-grid">
              <Field label="Name" className="span-2"><Input required value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Kategorie"><Input value={edit.category ?? ''} onChange={(e) => setEdit({ ...edit, category: e.target.value || null })} placeholder="Innen, Außen, Versiegelung …" /></Field>
              <Field label="Dauer (Minuten)"><Input type="number" min={0} value={String(edit.durationMinutes ?? 60)} onChange={(e) => setEdit({ ...edit, durationMinutes: Number(e.target.value) })} /></Field>
              <Field label="Preis brutto/netto lt. Einstellung (€)"><Input inputMode="decimal" value={inputFromCents(edit.priceCents)} onChange={(e) => setEdit({ ...edit, priceCents: centsFromInput(e.target.value) })} /></Field>
              <Field label="MwSt."><Select value={String(edit.vatBp ?? 1900)} onChange={(e) => setEdit({ ...edit, vatBp: Number(e.target.value) })}><option value="1900">19 %</option><option value="700">7 %</option><option value="0">0 %</option></Select></Field>
              <Field label="Materialkosten je Ausführung (€)" hint="Für Margenberechnung"><Input inputMode="decimal" value={inputFromCents(edit.materialCostCents)} onChange={(e) => setEdit({ ...edit, materialCostCents: centsFromInput(e.target.value) })} /></Field>
              <Field label="Reihenfolge"><Input type="number" value={String(edit.sortOrder ?? 0)} onChange={(e) => setEdit({ ...edit, sortOrder: Number(e.target.value) })} /></Field>
              <Field label="Beschreibung" className="span-2"><Textarea value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value || null })} /></Field>
              <label className="check span-2"><input type="checkbox" checked={edit.isActive ?? true} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} /> aktiv</label>
            </div>
            <div className="form-actions"><Button type="button" onClick={() => setEdit(null)}>Abbrechen</Button><Button type="submit" variant="primary" loading={save.isPending}>Speichern</Button></div>
          </form>
        </Modal>
      ) : null}
    </Card>
  );
}

function UsersSettings() {
  const qc = useQueryClient();
  const toast = useToast();
  const { me } = useAuth();
  const users = useQuery({ queryKey: ['users'], queryFn: () => get<{ items: User[] }>('/api/users') });
  const perms = useQuery({ queryKey: ['role-permissions'], queryFn: () => get<{ roles: string[]; permissions: string[]; byRole: Record<string, string[]> }>('/api/company/role-permissions') });
  const [create, setCreate] = useState(false);
  const [reset, setReset] = useState<User | null>(null);
  const [role, setRole] = useState('employee');
  const [rolePerms, setRolePerms] = useState<string[] | null>(null);
  useEffect(() => { if (perms.data) setRolePerms(perms.data.byRole[role] ?? []); }, [perms.data, role]);
  const [nf, setNf] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'employee' });
  const [pw, setPw] = useState('');
  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] });
  const createUser = useMutation({ mutationFn: () => post('/api/users', nf), onSuccess: () => { invalidate(); toast.ok('Benutzer angelegt'); setCreate(false); setNf({ firstName: '', lastName: '', email: '', password: '', role: 'employee' }); }, onError: (e) => toast.fromError(e) });
  const updateUser = useMutation({ mutationFn: ({ id, ...p }: { id: string; role?: string; isActive?: boolean }) => patch(`/api/users/${id}`, p), onSuccess: () => { invalidate(); toast.ok('Benutzer aktualisiert'); }, onError: (e) => toast.fromError(e) });
  const resetPw = useMutation({ mutationFn: () => post(`/api/users/${reset!.id}/reset-password`, { password: pw }), onSuccess: () => { toast.ok('Passwort gesetzt'); setReset(null); setPw(''); }, onError: (e) => toast.fromError(e) });
  const savePerms = useMutation({ mutationFn: () => fetch(`/api/company/role-permissions/${role}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permissions: rolePerms }) }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).message); }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['role-permissions'] }); toast.ok('Berechtigungen gespeichert'); }, onError: (e) => toast.fromError(e) });

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card title="Benutzer" tight actions={<Button size="sm" variant="primary" onClick={() => setCreate(true)}><Plus /> Benutzer</Button>}>
        {users.isLoading ? <Skeleton /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Status</th><th className="hide-mobile">Letzte Anmeldung</th><th></th></tr></thead>
            <tbody>{users.data?.items.map((u) => (
              <tr key={u.id}>
                <td className="primary">{u.firstName} {u.lastName}{u.id === me?.user.id ? <span className="dim"> (ich)</span> : null}</td>
                <td className="muted">{u.email}</td>
                <td><Select value={u.role} disabled={u.id === me?.user.id} onChange={(e) => updateUser.mutate({ id: u.id, role: e.target.value })} style={{ width: 'auto' }}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></td>
                <td>{u.isActive ? <Badge tone="ok">aktiv</Badge> : <Badge tone="danger">deaktiviert</Badge>}</td>
                <td className="muted hide-mobile">{fmtDateTime(u.lastLoginAt)}</td>
                <td className="num"><div className="row" style={{ justifyContent: 'flex-end' }}><Button size="sm" onClick={() => setReset(u)}>Passwort</Button>{u.id !== me?.user.id ? <Button size="sm" variant={u.isActive ? 'danger' : undefined} onClick={() => updateUser.mutate({ id: u.id, isActive: !u.isActive })}>{u.isActive ? 'Deaktivieren' : 'Aktivieren'}</Button> : null}</div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      <Card title="Berechtigungen je Rolle" actions={<Select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: 'auto' }}>{perms.data?.roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}</Select>}>
        {role === 'admin' ? <p className="muted">Administratoren haben immer alle Rechte.</p> : rolePerms && perms.data ? (
          <>
            <div className="grid cols-3" style={{ gap: 8 }}>
              {perms.data.permissions.map((p) => (
                <label key={p} className="check"><input type="checkbox" checked={rolePerms.includes(p)} onChange={(e) => setRolePerms(e.target.checked ? [...rolePerms, p] : rolePerms.filter((x) => x !== p))} /> {PERM_LABEL[p] ?? p}</label>
              ))}
            </div>
            <div className="form-actions"><Button variant="primary" loading={savePerms.isPending} onClick={() => savePerms.mutate()}>Berechtigungen speichern</Button></div>
          </>
        ) : <Skeleton />}
      </Card>
      {create ? (
        <Modal title="Benutzer anlegen" onClose={() => setCreate(false)}>
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); createUser.mutate(); }}>
            <div className="form-grid">
              <Field label="Vorname"><Input required value={nf.firstName} onChange={(e) => setNf({ ...nf, firstName: e.target.value })} /></Field>
              <Field label="Nachname"><Input required value={nf.lastName} onChange={(e) => setNf({ ...nf, lastName: e.target.value })} /></Field>
              <Field label="E-Mail" className="span-2"><Input type="email" required value={nf.email} onChange={(e) => setNf({ ...nf, email: e.target.value })} /></Field>
              <Field label="Startpasswort" hint="Mind. 10 Zeichen, Groß-/Kleinbuchstaben, Ziffer"><Input type="password" required value={nf.password} onChange={(e) => setNf({ ...nf, password: e.target.value })} /></Field>
              <Field label="Rolle"><Select value={nf.role} onChange={(e) => setNf({ ...nf, role: e.target.value })}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            </div>
            <div className="form-actions"><Button type="button" onClick={() => setCreate(false)}>Abbrechen</Button><Button type="submit" variant="primary" loading={createUser.isPending}>Anlegen</Button></div>
          </form>
        </Modal>
      ) : null}
      {reset ? (
        <Modal title={`Passwort setzen: ${reset.firstName} ${reset.lastName}`} onClose={() => setReset(null)}>
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); resetPw.mutate(); }} className="stack">
            <Field label="Neues Passwort" hint="Alle Sitzungen dieses Benutzers werden beendet."><Input type="password" required value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
            <div className="form-actions"><Button type="button" onClick={() => setReset(null)}>Abbrechen</Button><Button type="submit" variant="primary" loading={resetPw.isPending}>Setzen</Button></div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function IntegrationsSettings() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['lead-token'], queryFn: () => get<{ token: string; endpoint: string }>('/api/company/website-lead-token') });
  const [rotate, setRotate] = useState(false);
  const doRotate = useMutation({ mutationFn: () => post('/api/company/website-lead-token/rotate'), onSuccess: () => { qc.invalidateQueries({ queryKey: ['lead-token'] }); toast.ok('Neues Token erzeugt'); setRotate(false); }, onError: (e) => toast.fromError(e) });
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.ok('Kopiert'));
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card title="Website-Lead-Eingang">
        <p className="muted">Das Anfrageformular der Website sendet Leads an diesen Endpunkt. Das Format entspricht dem bestehenden Formular auf carcura.info (Felder name, email, phone, vehicle, service, message, customer_type, source, channel, gclid).</p>
        {q.data ? (
          <dl className="dl" style={{ marginTop: 14 }}>
            <dt>Endpunkt</dt><dd className="row"><code className="mono">{q.data.endpoint}</code><Button size="sm" variant="ghost" onClick={() => copy(q.data!.endpoint)}><Copy /></Button></dd>
            <dt>Header</dt><dd className="row"><code className="mono">X-Lead-Token: {q.data.token}</code><Button size="sm" variant="ghost" onClick={() => copy(q.data!.token)}><Copy /></Button></dd>
          </dl>
        ) : <Skeleton rows={2} />}
        <div className="form-actions"><Button variant="danger" onClick={() => setRotate(true)}><RefreshCw /> Token neu erzeugen</Button></div>
      </Card>
      <ClaudeCard />
      <PlacesCard />
      <MarketingIntegrationCard type="windsor" title="Windsor.ai (empfohlen: eine Anbindung für Google Ads, Meta Ads, GA4, Instagram und Meta Lead Ads)" intro="API-Key aus dem Windsor.ai-Konto. Konto-IDs sind optional (leer = alle verbundenen Konten). Meta Lead-Formulare werden automatisch als Leads importiert." fields={[{ key: 'apiKey', label: 'API-Key', secret: true }, { key: 'googleAdsAccount', label: 'Google-Ads-Konto (z. B. 919-151-5213)' }, { key: 'metaAccount', label: 'Meta-Werbekonto-ID' }, { key: 'ga4Account', label: 'GA4-Property-ID' }, { key: 'instagramAccount', label: 'Instagram-Konto-ID' }, { key: 'leadsAccount', label: 'Facebook-Seiten-ID (Lead Ads)' }]} />
      <MarketingIntegrationCard type="google_ads" title="Google Ads API (direkt)" intro="Developer-Token aus dem Google-Ads-API-Center, OAuth-Client (Client-ID/-Secret) und ein Refresh-Token mit Zugriff auf das Kundenkonto." fields={[{ key: 'developerToken', label: 'Developer-Token', secret: true }, { key: 'clientId', label: 'OAuth Client-ID' }, { key: 'clientSecret', label: 'OAuth Client-Secret', secret: true }, { key: 'refreshToken', label: 'Refresh-Token', secret: true }, { key: 'customerId', label: 'Kundennummer (xxx-xxx-xxxx)' }, { key: 'loginCustomerId', label: 'Verwaltungskonto (optional)' }]} />
      <MarketingIntegrationCard type="meta_ads" title="Meta Marketing API (direkt)" intro="System-User-Token mit ads_read und die Werbekonto-ID (act_…)." fields={[{ key: 'accessToken', label: 'Access-Token', secret: true }, { key: 'adAccountId', label: 'Werbekonto-ID' }]} />
      <MarketingIntegrationCard type="ga4" title="Google Analytics 4 (direkt, Service-Account)" intro="Service-Account in der Google Cloud anlegen, als Betrachter zur GA4-Property hinzufügen, JSON-Schlüssel: client_email und private_key eintragen." fields={[{ key: 'clientEmail', label: 'client_email' }, { key: 'privateKey', label: 'private_key', secret: true, multiline: true }, { key: 'propertyId', label: 'Property-ID (z. B. 548650753)' }]} />
      <MarketingIntegrationCard type="search_console" title="Google Search Console (direkt, Service-Account)" intro="Service-Account als Nutzer der Property in der Search Console eintragen." fields={[{ key: 'clientEmail', label: 'client_email' }, { key: 'privateKey', label: 'private_key', secret: true, multiline: true }, { key: 'siteUrl', label: 'Property (https://carcura.info/ oder sc-domain:carcura.info)' }]} />
      {rotate ? <Confirm title="Token neu erzeugen?" text="Das alte Token wird sofort ungültig. Die Website muss anschließend das neue Token verwenden." confirmLabel="Neu erzeugen" danger loading={doRotate.isPending} onConfirm={() => doRotate.mutate()} onClose={() => setRotate(false)} /> : null}
    </div>
  );
}

function AuditLog() {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['audit', page], queryFn: () => get<{ items: Array<{ id: string; action: string; entityType: string; entityId: string | null; userId: string | null; ip: string | null; createdAt: string }>; total: number; pageSize: number }>(`/api/audit?page=${page}&pageSize=50`) });
  const users = useQuery({ queryKey: ['users'], queryFn: () => get<{ items: User[] }>('/api/users') });
  const name = (id: string | null) => { const u = users.data?.items.find((x) => x.id === id); return u ? `${u.firstName} ${u.lastName}` : id ? id.slice(0, 8) : 'System'; };
  return (
    <Card title="Audit-Log" tight>
      {q.isLoading ? <Skeleton /> : (
        <>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Zeitpunkt</th><th>Aktion</th><th>Objekt</th><th>Benutzer</th><th className="hide-mobile">IP</th></tr></thead>
            <tbody>{q.data?.items.map((e) => <tr key={e.id}><td className="muted">{fmtDateTime(e.createdAt)}</td><td className="mono">{e.action}</td><td className="muted">{e.entityType}{e.entityId ? <span className="dim"> · {e.entityId.slice(0, 8)}</span> : null}</td><td>{name(e.userId)}</td><td className="dim hide-mobile">{e.ip ?? '–'}</td></tr>)}</tbody>
          </table></div>
          <div className="pager"><span>{q.data?.total ?? 0} Einträge</span><div className="row"><Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Zurück</Button><Button size="sm" disabled={!q.data || page * q.data.pageSize >= q.data.total} onClick={() => setPage(page + 1)}>Weiter</Button></div></div>
        </>
      )}
    </Card>
  );
}

function MailSettings() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['smtp'], queryFn: () => get<{ configured: boolean; config?: { host: string; port: number; secure: boolean; user: string; fromName: string; fromEmail: string; replyTo: string | null; hasPassword: boolean }; status?: string; lastError?: string | null; lastSyncAt?: string | null }>('/api/integrations/smtp') });
  const log = useQuery({ queryKey: ['email-log'], queryFn: () => get<{ items: Array<{ id: string; toAddress: string; subject: string; status: string; error: string | null; createdAt: string }> }>('/api/integrations/email-log') });
  const [f, setF] = useState({ host: '', port: '587', secure: false, user: '', pass: '', fromName: '', fromEmail: '', replyTo: '' });
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { if (q.data?.config && !loaded) { const c = q.data.config; setF({ host: c.host, port: String(c.port), secure: c.secure, user: c.user, pass: '', fromName: c.fromName, fromEmail: c.fromEmail, replyTo: c.replyTo ?? '' }); setLoaded(true); } }, [q.data, loaded]);
  const save = useMutation({ mutationFn: () => fetch('/api/integrations/smtp', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host: f.host, port: Number(f.port), secure: f.secure, user: f.user, pass: f.pass || undefined, fromName: f.fromName, fromEmail: f.fromEmail, replyTo: f.replyTo || null }) }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).message); }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['smtp'] }); toast.ok('SMTP gespeichert'); setF({ ...f, pass: '' }); }, onError: (e) => toast.fromError(e) });
  const test = useMutation({ mutationFn: () => post<{ to: string }>('/api/integrations/smtp/test'), onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['email-log'] }); qc.invalidateQueries({ queryKey: ['smtp'] }); toast.ok('Testmail gesendet', `an ${r.to}`); }, onError: (e) => { qc.invalidateQueries({ queryKey: ['email-log'] }); toast.fromError(e, 'Testmail fehlgeschlagen'); } });
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card title="SMTP-Zugangsdaten" actions={q.data?.configured ? <Badge tone={q.data.status === 'error' ? 'danger' : q.data.status === 'ok' ? 'ok' : 'info'}>{q.data.status === 'error' ? 'Fehler' : q.data.status === 'ok' ? 'funktioniert' : 'gespeichert'}</Badge> : <Badge tone="warn">nicht eingerichtet</Badge>}>
        <p className="muted" style={{ marginBottom: 14 }}>Für Terminbestätigungen, Erinnerungen, Angebote und Rechnungen. Die Zugangsdaten werden verschlüsselt gespeichert. Für carcura.info können dieselben Daten wie in FluentSMTP verwendet werden.</p>
        {q.data?.lastError ? <div className="dup-box" style={{ marginBottom: 14 }}>Letzter Fehler: {q.data.lastError}</div> : null}
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }}>
          <div className="form-grid">
            <Field label="SMTP-Host"><Input required value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })} placeholder="smtp.web.de" /></Field>
            <div className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
              <Field label="Port"><Input type="number" required value={f.port} onChange={(e) => setF({ ...f, port: e.target.value })} style={{ width: 100 }} /></Field>
              <label className="check" style={{ paddingBottom: 10 }}><input type="checkbox" checked={f.secure} onChange={(e) => setF({ ...f, secure: e.target.checked })} /> SSL/TLS (Port 465)</label>
            </div>
            <Field label="Benutzername"><Input value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} /></Field>
            <Field label="Passwort" hint={q.data?.config?.hasPassword ? 'Leer lassen, um das gespeicherte Passwort zu behalten.' : undefined}><Input type="password" value={f.pass} onChange={(e) => setF({ ...f, pass: e.target.value })} autoComplete="new-password" /></Field>
            <Field label="Absendername"><Input required value={f.fromName} onChange={(e) => setF({ ...f, fromName: e.target.value })} /></Field>
            <Field label="Absenderadresse"><Input type="email" required value={f.fromEmail} onChange={(e) => setF({ ...f, fromEmail: e.target.value })} /></Field>
            <Field label="Antwort an (optional)" className="span-2"><Input type="email" value={f.replyTo} onChange={(e) => setF({ ...f, replyTo: e.target.value })} /></Field>
          </div>
          <div className="form-actions"><Button type="button" onClick={() => test.mutate()} loading={test.isPending} disabled={!q.data?.configured}>Testmail an mich senden</Button><Button type="submit" variant="primary" loading={save.isPending}>Speichern</Button></div>
        </form>
      </Card>
      <Card title="Versandprotokoll" tight>
        {!log.data?.items.length ? <p className="muted" style={{ padding: 18 }}>Noch keine E-Mails gesendet.</p> : (
          <div className="table-wrap"><table className="table"><thead><tr><th>Zeitpunkt</th><th>Empfänger</th><th>Betreff</th><th>Status</th></tr></thead>
            <tbody>{log.data.items.map((m) => <tr key={m.id}><td className="muted">{fmtDateTime(m.createdAt)}</td><td>{m.toAddress}</td><td className="muted">{m.subject}</td><td>{m.status === 'sent' ? <Badge tone="ok">gesendet</Badge> : <Badge tone="danger" >fehlgeschlagen</Badge>}{m.error ? <div className="small dim">{m.error}</div> : null}</td></tr>)}</tbody></table></div>
        )}
      </Card>
    </div>
  );
}

function LogoUpload({ hasLogo, onChanged }: { hasLogo: boolean; onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const fd = new FormData(); fd.append('file', file, file.name);
      const r = await fetch('/api/company/logo', { method: 'POST', body: fd });
      if (!r.ok) throw new Error((await r.json()).message);
      toast.ok('Logo gespeichert'); onChanged();
    } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  };
  return (
    <div className="row" style={{ marginTop: 14, alignItems: 'center' }}>
      {hasLogo ? <img src={`/api/company/logo?t=${Date.now()}`} alt="Logo" style={{ maxHeight: 48, maxWidth: 180, background: '#fff', padding: 4, borderRadius: 6 }} /> : <span className="small muted">Kein Logo hinterlegt (PNG mit transparentem Hintergrund empfohlen).</span>}
      <label className="btn sm">{busy ? <span className="spinner" /> : null} Logo hochladen<input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} /></label>
      {hasLogo ? <Button size="sm" variant="ghost" onClick={async () => { await del('/api/company/logo'); toast.ok('Logo entfernt'); onChanged(); }}>Entfernen</Button> : null}
    </div>
  );
}

function MarketingIntegrationCard({ type, title, intro, fields }: { type: string; title: string; intro: string; fields: Array<{ key: string; label: string; secret?: boolean; multiline?: boolean }> }) {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['integration', type], queryFn: () => get<{ configured: boolean; config?: Record<string, string>; hasSecrets?: Record<string, boolean>; status?: string; lastError?: string | null; lastSyncAt?: string | null }>(`/api/integrations/marketing/${type}`) });
  const [f, setF] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { if (q.data && !loaded) { setF(Object.fromEntries(fields.map((x) => [x.key, q.data?.config?.[x.key] ?? '']))); setLoaded(true); } }, [q.data, loaded, fields]);
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['integration', type] }); qc.invalidateQueries({ queryKey: ['marketing'] }); };
  const save = useMutation({ mutationFn: () => fetch(`/api/integrations/marketing/${type}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v || null]))) }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).message); }), onSuccess: () => { invalidate(); toast.ok('Gespeichert'); setF((x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, fields.find((fl) => fl.key === k)?.secret ? '' : v]))); }, onError: (e) => toast.fromError(e) });
  const test = useMutation({ mutationFn: () => post(`/api/integrations/marketing/${type}/test`), onSuccess: () => { invalidate(); toast.ok('Verbindung erfolgreich'); }, onError: (e) => { invalidate(); toast.fromError(e, 'Verbindungstest'); } });
  const remove = useMutation({ mutationFn: () => del(`/api/integrations/marketing/${type}`), onSuccess: () => { invalidate(); setLoaded(false); toast.ok('Anbindung entfernt'); }, onError: (e) => toast.fromError(e) });
  const status = q.data?.status;
  return (
    <Card title={title} actions={<div className="row">{q.data?.configured ? <Badge tone={status === 'ok' ? 'ok' : status === 'error' ? 'danger' : 'info'}>{status === 'ok' ? 'verbunden' : status === 'error' ? 'Fehler' : 'gespeichert'}</Badge> : <Badge>nicht eingerichtet</Badge>}<Button size="sm" onClick={() => setOpen(!open)}>{open ? 'Schließen' : q.data?.configured ? 'Bearbeiten' : 'Einrichten'}</Button></div>}>
      <p className="muted small">{intro}</p>
      {q.data?.lastSyncAt ? <p className="small dim" style={{ marginTop: 6 }}>Letzter Abruf: {fmtDateTime(q.data.lastSyncAt)}</p> : null}
      {q.data?.lastError ? <div className="dup-box" style={{ marginTop: 8 }}>{q.data.lastError}</div> : null}
      {open ? (
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} style={{ marginTop: 14 }}>
          <div className="form-grid">
            {fields.map((fl) => {
              const stored = Boolean(fl.secret && q.data?.hasSecrets?.[fl.key]);
              const common = { value: f[fl.key] ?? '', onChange: (e: { target: { value: string } }) => setF({ ...f, [fl.key]: e.target.value }), placeholder: stored ? '••••••' : '' };
              return (
                <Field key={fl.key} label={fl.label} className={fl.multiline ? 'span-2' : ''} hint={stored ? 'Gespeichert – leer lassen, um zu behalten.' : undefined}>
                  {fl.multiline ? <Textarea {...common} /> : <Input type={fl.secret ? 'password' : 'text'} autoComplete="off" {...common} />}
                </Field>
              );
            })}
          </div>
          <div className="form-actions">{q.data?.configured ? <><Button type="button" variant="danger" onClick={() => remove.mutate()} style={{ marginRight: 'auto' }}>Entfernen</Button><Button type="button" onClick={() => test.mutate()} loading={test.isPending}>Verbindung testen</Button></> : null}<Button type="submit" variant="primary" loading={save.isPending}>Speichern</Button></div>
        </form>
      ) : null}
    </Card>
  );
}

function ClaudeCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['integration', 'claude'], queryFn: () => get<{ configured: boolean; model: string; models: string[]; status: string | null; lastError: string | null }>('/api/integrations/claude') });
  const [key, setKey] = useState('');
  const [model, setModel] = useState('claude-opus-5');
  const [open, setOpen] = useState(false);
  useEffect(() => { if (q.data) setModel(q.data.model); }, [q.data]);
  const save = useMutation({ mutationFn: () => fetch('/api/integrations/claude', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: key || undefined, model }) }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).message); }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['integration', 'claude'] }); qc.invalidateQueries({ queryKey: ['assistant-status'] }); toast.ok('Gespeichert'); setKey(''); }, onError: (e) => toast.fromError(e) });
  const remove = useMutation({ mutationFn: () => del('/api/integrations/claude'), onSuccess: () => { qc.invalidateQueries({ queryKey: ['integration', 'claude'] }); toast.ok('Entfernt'); } });
  return (
    <Card title="KI-Business-Assistent (Claude)" actions={<div className="row">{q.data?.configured ? <Badge tone={q.data.status === 'error' ? 'danger' : 'ok'}>{q.data.status === 'error' ? 'Fehler' : 'eingerichtet'}</Badge> : <Badge>nicht eingerichtet</Badge>}<Button size="sm" onClick={() => setOpen(!open)}>{open ? 'Schließen' : q.data?.configured ? 'Bearbeiten' : 'Einrichten'}</Button></div>}>
      <p className="muted small">Anthropic-API-Key (console.anthropic.com). Der Assistent erhält nur aggregierte Kennzahlen aus dem System, keine Dokumente oder Bilder. Kosten fallen je Anfrage beim Anbieter an; Opus 5 liefert die beste Analysequalität, Sonnet 5 ist günstiger.</p>
      {q.data?.lastError ? <div className="dup-box" style={{ marginTop: 8 }}>{q.data.lastError}</div> : null}
      {open ? <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} style={{ marginTop: 14 }}><div className="form-grid"><Field label="API-Key" hint={q.data?.configured ? 'Leer lassen, um den gespeicherten Key zu behalten.' : undefined}><Input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={q.data?.configured ? '••••••' : 'sk-ant-…'} /></Field><Field label="Modell"><Select value={model} onChange={(e) => setModel(e.target.value)}>{(q.data?.models ?? ['claude-opus-5']).map((m) => <option key={m}>{m}</option>)}</Select></Field></div><div className="form-actions">{q.data?.configured ? <Button type="button" variant="danger" style={{ marginRight: 'auto' }} onClick={() => remove.mutate()}>Entfernen</Button> : null}<Button type="submit" variant="primary" loading={save.isPending}>Speichern</Button></div></form> : null}
    </Card>
  );
}

function PlacesCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['integration', 'google_places'], queryFn: () => get<{ configured: boolean; config?: { queries: string[]; lat: number | null; lng: number | null; radiusKm: number | null; ownPlaceId: string | null }; status?: string; lastError?: string | null; lastSyncAt?: string | null }>('/api/integrations/google_places') });
  const [f, setF] = useState({ apiKey: '', queries: 'Fahrzeugaufbereitung Köln', radiusKm: '30', lat: '', lng: '', ownPlaceId: '' });
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { if (q.data?.config && !loaded) { const c = q.data.config; setF({ apiKey: '', queries: c.queries.join('\n'), radiusKm: String(c.radiusKm ?? 30), lat: c.lat?.toString() ?? '', lng: c.lng?.toString() ?? '', ownPlaceId: c.ownPlaceId ?? '' }); setLoaded(true); } }, [q.data, loaded]);
  const save = useMutation({ mutationFn: () => fetch('/api/integrations/google_places', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: f.apiKey || undefined, queries: f.queries.split('\n').map((x) => x.trim()).filter(Boolean), radiusKm: Number(f.radiusKm) || 30, lat: f.lat ? Number(f.lat.replace(',', '.')) : null, lng: f.lng ? Number(f.lng.replace(',', '.')) : null, ownPlaceId: f.ownPlaceId || null }) }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).message); }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['integration', 'google_places'] }); qc.invalidateQueries({ queryKey: ['competitors'] }); toast.ok('Gespeichert'); setF({ ...f, apiKey: '' }); }, onError: (e) => toast.fromError(e) });
  const remove = useMutation({ mutationFn: () => del('/api/integrations/google_places'), onSuccess: () => { qc.invalidateQueries({ queryKey: ['integration', 'google_places'] }); setLoaded(false); toast.ok('Entfernt'); } });
  return (
    <Card title="Wettbewerber-Monitoring (Google Places API)" actions={<div className="row">{q.data?.configured ? <Badge tone={q.data.status === 'error' ? 'danger' : q.data.status === 'ok' ? 'ok' : 'info'}>{q.data.status === 'error' ? 'Fehler' : q.data.status === 'ok' ? 'aktiv' : 'gespeichert'}</Badge> : <Badge>nicht eingerichtet</Badge>}<Button size="sm" onClick={() => setOpen(!open)}>{open ? 'Schließen' : q.data?.configured ? 'Bearbeiten' : 'Einrichten'}</Button></div>}>
      <p className="muted small">API-Key aus der Google Cloud Console mit aktivierter „Places API (New)“. Wöchentlich werden die Suchbegriffe (eine je Zeile, z. B. „Fahrzeugaufbereitung Köln“) im Umkreis abgefragt: Bewertungen, Rezensionen, Website. Nur öffentliche Daten über die offizielle API.</p>
      {q.data?.lastError ? <div className="dup-box" style={{ marginTop: 8 }}>{q.data.lastError}</div> : null}
      {open ? <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} style={{ marginTop: 14 }}><div className="form-grid"><Field label="API-Key" hint={q.data?.configured ? 'Leer lassen, um den gespeicherten Key zu behalten.' : undefined} className="span-2"><Input type="password" autoComplete="off" value={f.apiKey} onChange={(e) => setF({ ...f, apiKey: e.target.value })} placeholder={q.data?.configured ? '••••••' : ''} /></Field><Field label="Suchbegriffe (eine je Zeile)" className="span-2"><Textarea value={f.queries} onChange={(e) => setF({ ...f, queries: e.target.value })} /></Field><Field label="Umkreis (km)"><Input type="number" min={1} max={200} value={f.radiusKm} onChange={(e) => setF({ ...f, radiusKm: e.target.value })} /></Field><Field label="Eigene Place-ID (optional)"><Input value={f.ownPlaceId} onChange={(e) => setF({ ...f, ownPlaceId: e.target.value })} /></Field><Field label="Breitengrad (optional)"><Input value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} placeholder="50.94" /></Field><Field label="Längengrad (optional)"><Input value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} placeholder="6.96" /></Field></div><div className="form-actions">{q.data?.configured ? <Button type="button" variant="danger" style={{ marginRight: 'auto' }} onClick={() => remove.mutate()}>Entfernen</Button> : null}<Button type="submit" variant="primary" loading={save.isPending}>Speichern</Button></div></form> : null}
    </Card>
  );
}
