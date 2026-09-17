import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { Car, Download, FileDown, Mail, MessageSquare, Pencil, Phone, Plus, StickyNote, Trash2, Calendar, FileText, Bell, Cog, ArrowRightLeft } from 'lucide-react';
import { get, post, del } from '../api/client';
import type { Customer, Vehicle, Lead, Activity, DuplicateHit } from '../api/types';
import { useAuth } from '../app/auth';
import { Badge, Button, Card, Confirm, Field, Input, Modal, PageHead, Select, Skeleton, Tabs, Textarea, useToast } from '../components/ui';
import { ACTIVITY_LABEL, fmtDate, fmtDateTime, fmtNumber, LEAD_SOURCE, LEAD_STATUS, personName } from '../lib/format';
import { CustomerForm } from './Customers';
import { VehicleForm } from './Vehicles';
import { CustomerAppointmentsAndOrders } from './Orders';
import { DocumentsPanel } from '../components/documents';
import { ProtocolList } from './Protocol';
import { CustomerBilling } from './Billing';

const ICONS: Record<string, typeof Phone> = { call: Phone, email: Mail, message: MessageSquare, whatsapp: MessageSquare, note: StickyNote, appointment: Calendar, offer: FileText, invoice: FileText, reminder: Bell, system: Cog, status: ArrowRightLeft };

export function Timeline({ items }: { items: Activity[] }) {
  if (items.length === 0) return <p className="muted">Noch keine Einträge.</p>;
  return (
    <div className="timeline">
      {items.map((a) => {
        const Icon = ICONS[a.type] ?? Cog;
        return (
          <div key={a.id} className="tl-item">
            <div className="tl-dot"><Icon /></div>
            <div style={{ minWidth: 0 }}>
              <div className="row"><span className="subject">{a.subject ?? ACTIVITY_LABEL[a.type] ?? a.type}</span><Badge plain>{ACTIVITY_LABEL[a.type] ?? a.type}{a.direction ? (a.direction === 'in' ? ' · eingehend' : ' · ausgehend') : ''}</Badge></div>
              {a.content ? <div className="body">{a.content}</div> : null}
              <div className="when">{fmtDateTime(a.occurredAt)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ActivityForm({ url, onSaved }: { url: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ type: 'call', direction: 'out', subject: '', content: '' });
  const toast = useToast();
  const m = useMutation({
    mutationFn: () => post(url, { type: f.type, direction: ['call', 'email', 'message', 'whatsapp'].includes(f.type) ? f.direction : null, subject: f.subject || null, content: f.content || null }),
    onSuccess: () => { toast.ok('Eintrag gespeichert'); setOpen(false); setF({ type: 'call', direction: 'out', subject: '', content: '' }); onSaved(); },
    onError: (e) => toast.fromError(e),
  });
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Plus /> Eintrag</Button>
      {open ? (
        <Modal title="Kontakt protokollieren" onClose={() => setOpen(false)}>
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); m.mutate(); }} className="stack">
            <div className="form-grid">
              <Field label="Art"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{['call', 'email', 'whatsapp', 'message', 'note'].map((t) => <option key={t} value={t}>{ACTIVITY_LABEL[t]}</option>)}</Select></Field>
              {['call', 'email', 'message', 'whatsapp'].includes(f.type) ? <Field label="Richtung"><Select value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })}><option value="out">Ausgehend</option><option value="in">Eingehend</option></Select></Field> : <div />}
              <Field label="Betreff" className="span-2"><Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
              <Field label="Inhalt" className="span-2"><Textarea value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} autoFocus /></Field>
            </div>
            <div className="form-actions"><Button type="button" onClick={() => setOpen(false)}>Abbrechen</Button><Button type="submit" variant="primary" loading={m.isPending}>Speichern</Button></div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

type Tab = 'overview' | 'vehicles' | 'documents' | 'protocols' | 'history';

export function CustomerDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [edit, setEdit] = useState(false);
  const [addVehicle, setAddVehicle] = useState(false);
  const [remove, setRemove] = useState(false);
  const q = useQuery({ queryKey: ['customer', id], queryFn: () => get<{ customer: Customer; vehicles: Vehicle[]; leads: Lead[]; activities: Activity[]; duplicates: DuplicateHit[] }>(`/api/customers/${id}`) });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['customer', id] }); qc.invalidateQueries({ queryKey: ['customers'] }); };
  const doDelete = useMutation({ mutationFn: () => del(`/api/customers/${id}?hard=true`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); toast.ok('Kunde gelöscht'); navigate('/kunden'); }, onError: (e) => toast.fromError(e) });

  if (q.isLoading) return <Card><Skeleton rows={6} /></Card>;
  if (!q.data) return <Card><div className="empty"><h3>Kunde nicht gefunden</h3></div></Card>;
  const { customer: c, vehicles, leads, activities, duplicates } = q.data;
  const tags = JSON.parse(c.tagsJson) as string[];

  return (
    <>
      <PageHead
        crumbs={<><Link to="/kunden">Kunden</Link><span>/</span><span>{c.customerNumber}</span></>}
        title={personName(c)}
        sub={<span className="row"><span className="mono">{c.customerNumber}</span><Badge plain>{c.type === 'business' ? 'Firmenkunde' : 'Privatkunde'}</Badge>{tags.map((t) => <Badge key={t} tone="brand" plain>{t}</Badge>)}{!c.isActive ? <Badge tone="danger">deaktiviert</Badge> : null}</span>}
        actions={<>
          <a className="btn" href={`/api/customers/${id}/pdf`} target="_blank" rel="noreferrer"><FileDown /> PDF</a>
          <a className="btn ghost" href={`/api/customers/${id}/export`} download title="Datenexport (JSON)"><Download /></a>
          {can('customers:write') ? <Button onClick={() => setEdit(true)}><Pencil /> Bearbeiten</Button> : null}
          {can('customers:delete') ? <Button variant="danger" onClick={() => setRemove(true)}><Trash2 /></Button> : null}
        </>}
      />
      {duplicates.length > 0 ? <div className="dup-box" style={{ marginBottom: 16 }}>Mögliche Dubletten: {duplicates.map((d) => <Link key={d.id} to={`/kunden/${d.id}`}>{d.label} </Link>)}</div> : null}
      <Tabs value={tab} onChange={setTab} items={[{ id: 'overview', label: 'Übersicht' }, { id: 'vehicles', label: `Fahrzeuge (${vehicles.length})` }, { id: 'documents', label: 'Dokumente & Bilder' }, { id: 'protocols', label: 'Protokolle' }, { id: 'history', label: `Historie (${activities.length})` }]} />
      {tab === 'overview' ? (
        <div className="grid main-side">
          <div className="stack" style={{ gap: 16 }}>
            <Card title="Stammdaten">
              <dl className="dl">
                <dt>Name</dt><dd>{[c.salutation, c.firstName, c.lastName].filter(Boolean).join(' ') || '–'}</dd>
                <dt>Firma</dt><dd>{c.companyName ?? '–'}</dd>
                <dt>Adresse</dt><dd>{[[c.street, c.houseNumber].filter(Boolean).join(' '), [c.zip, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '–'}</dd>
                <dt>Telefon</dt><dd>{c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : '–'}{c.phone2 ? <> · <a href={`tel:${c.phone2}`}>{c.phone2}</a></> : null}</dd>
                <dt>E-Mail</dt><dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '–'}</dd>
                <dt>Quelle</dt><dd>{c.source ? (LEAD_SOURCE[c.source] ?? c.source) : '–'}</dd>
                <dt>Kunde seit</dt><dd>{fmtDate(c.createdAt)}</dd>
                <dt>Notizen</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{c.notes ?? '–'}</dd>
              </dl>
            </Card>
            <Card title="Letzte Aktivitäten" actions={can('customers:write') ? <ActivityForm url={`/api/customers/${id}/activities`} onSaved={invalidate} /> : null}>
              <Timeline items={activities.slice(0, 5)} />
              {activities.length > 5 ? <Button size="sm" variant="ghost" onClick={() => setTab('history')} style={{ marginTop: 8 }}>Alle {activities.length} Einträge</Button> : null}
            </Card>
          </div>
          <div className="stack" style={{ gap: 16 }}>
            <Card title="Fahrzeuge" actions={can('vehicles:write') ? <Button size="sm" onClick={() => setAddVehicle(true)}><Plus /></Button> : null}>
              {vehicles.length === 0 ? <p className="muted">Noch kein Fahrzeug hinterlegt.</p> : (
                <div className="stack" style={{ gap: 8 }}>
                  {vehicles.map((v) => (
                    <Link key={v.id} to={`/fahrzeuge/${v.id}`} className="row" style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-hover)' }}>
                      <Car size={16} /><div style={{ minWidth: 0 }}><div style={{ fontWeight: 600 }}>{[v.make, v.model].filter(Boolean).join(' ') || 'Fahrzeug'}</div><div className="small muted">{v.licensePlate ?? 'ohne Kennzeichen'}{v.year ? ` · ${v.year}` : ''}{v.mileage ? ` · ${fmtNumber(v.mileage)} km` : ''}</div></div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
            <CustomerAppointmentsAndOrders customerId={id} />
            <CustomerBilling customerId={id} />
            <Card title="Leads">
              {leads.length === 0 ? <p className="muted">Kein Lead verknüpft.</p> : leads.map((l) => <Link key={l.id} to={`/leads/${l.id}`} className="spread" style={{ padding: '6px 0' }}><span>{l.requestedService ?? 'Anfrage'} · {fmtDate(l.createdAt)}</span><Badge tone={LEAD_STATUS[l.status]?.tone}>{LEAD_STATUS[l.status]?.label}</Badge></Link>)}
            </Card>
          </div>
        </div>
      ) : null}
      {tab === 'vehicles' ? (
        <Card title="Fahrzeuge" tight actions={can('vehicles:write') ? <Button size="sm" variant="primary" onClick={() => setAddVehicle(true)}><Plus /> Fahrzeug</Button> : null}>
          {vehicles.length === 0 ? <div className="empty"><h3>Noch kein Fahrzeug</h3></div> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Kennzeichen</th><th>Fahrzeug</th><th>Typ</th><th className="num">Baujahr</th><th className="num">km</th><th>Farbe</th></tr></thead>
              <tbody>{vehicles.map((v) => <tr key={v.id} className="row-link" onClick={() => navigate(`/fahrzeuge/${v.id}`)}><td className="mono">{v.licensePlate ?? '–'}</td><td className="primary">{[v.make, v.model].filter(Boolean).join(' ') || '–'}</td><td className="muted">{v.vehicleType ?? '–'}</td><td className="num">{v.year ?? '–'}</td><td className="num">{fmtNumber(v.mileage)}</td><td className="muted">{v.color ?? '–'}</td></tr>)}</tbody>
            </table></div>
          )}
        </Card>
      ) : null}
      {tab === 'documents' ? <Card title="Dokumente & Bilder"><DocumentsPanel filter={{ customerId: id }} meta={{ customerId: id }} /></Card> : null}
      {tab === 'protocols' ? <ProtocolList filter={{ customerId: id }} newParams={{ customerId: id, vehicleId: vehicles[0]?.id }} /> : null}
      {tab === 'history' ? <Card title="Kommunikationshistorie" actions={can('customers:write') ? <ActivityForm url={`/api/customers/${id}/activities`} onSaved={invalidate} /> : null}><Timeline items={activities} /></Card> : null}
      {edit ? <CustomerForm customer={c} onClose={() => { setEdit(false); invalidate(); }} /> : null}
      {addVehicle ? <VehicleForm customerId={id} onClose={() => { setAddVehicle(false); invalidate(); }} /> : null}
      {remove ? <Confirm title="Kunde endgültig löschen?" text="Kundenakte, Fahrzeuge und Historie werden unwiderruflich entfernt (DSGVO-Löschung). Für ein Archiv stattdessen deaktivieren." confirmLabel="Endgültig löschen" danger loading={doDelete.isPending} onConfirm={() => doDelete.mutate()} onClose={() => setRemove(false)} /> : null}
    </>
  );
}
