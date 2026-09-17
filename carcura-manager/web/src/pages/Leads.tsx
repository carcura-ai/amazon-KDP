import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { Download, Plus, Upload } from 'lucide-react';
import { get, post, patch, qs } from '../api/client';
import type { Lead, Paged, DuplicateHit } from '../api/types';
import { useAuth } from '../app/auth';
import { ImportModal } from './Customers';
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHead, Pager, Select, Skeleton, Textarea, useDebounced, useToast } from '../components/ui';
import { fmtRelative, LEAD_SOURCE, LEAD_STATUS, personName } from '../lib/format';

export function LeadsPage() {
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [open, setOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [create, setCreate] = useState(false);
  const [imp, setImp] = useState(false);
  const dq = useDebounced(q);
  const navigate = useNavigate();
  const list = useQuery({ queryKey: ['leads', { dq, status, source, open, page }], queryFn: () => get<Paged<Lead>>(`/api/leads${qs({ q: dq, status, source, open: open && !status ? true : undefined, page, pageSize: 50 })}`) });

  return (
    <>
      <PageHead title="Leads" sub="Anfragen aus Website, Werbung und Telefon – vom Erstkontakt bis zum Auftrag." actions={<><a className="btn" href="/api/export/leads.csv" title="Alle Leads als CSV herunterladen"><Download /> CSV</a>{can('leads:write') ? <Button onClick={() => setImp(true)}><Upload /> Import</Button> : null}{can('leads:write') ? <Button variant="primary" onClick={() => setCreate(true)}><Plus /> Lead anlegen</Button> : null}</>} />
      <Card tight>
        <div className="toolbar">
          <input type="search" placeholder="Name, E-Mail, Telefon, Fahrzeug …" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Alle Status</option>
            {Object.entries(LEAD_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          <Select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}>
            <option value="">Alle Quellen</option>
            {Object.entries(LEAD_SOURCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          {!status ? <label className="check small"><input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} /> nur offene</label> : null}
        </div>
        {list.isLoading ? <Skeleton rows={6} /> : list.data && list.data.items.length === 0 ? (
          <Empty title="Keine Leads gefunden" text={dq || status || source ? 'Filter anpassen oder Suchbegriff ändern.' : 'Sobald Anfragen eingehen, erscheinen sie hier.'} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Name</th><th>Kontakt</th><th className="hide-mobile">Leistung / Fahrzeug</th><th>Quelle</th><th>Status</th><th>Eingang</th></tr></thead>
                <tbody>
                  {list.data?.items.map((l) => (
                    <tr key={l.id} className="row-link" onClick={() => navigate(`/leads/${l.id}`)}>
                      <td><div className="primary">{personName(l)}</div>{l.city ? <div className="secondary">{l.zip} {l.city}</div> : null}</td>
                      <td><div>{l.phone ?? '–'}</div><div className="secondary">{l.email ?? ''}</div></td>
                      <td className="hide-mobile"><div>{l.requestedService ?? '–'}</div><div className="secondary">{l.vehicleText ?? ''}</div></td>
                      <td>{LEAD_SOURCE[l.source] ?? l.source}</td>
                      <td><Badge tone={LEAD_STATUS[l.status]?.tone}>{LEAD_STATUS[l.status]?.label ?? l.status}</Badge></td>
                      <td className="muted" title={l.createdAt}>{fmtRelative(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {list.data ? <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} /> : null}
          </>
        )}
      </Card>
      {create ? <LeadForm onClose={() => setCreate(false)} /> : null}
      {imp ? <ImportModal kind="leads" onClose={() => setImp(false)} /> : null}
    </>
  );
}

export function LeadForm({ lead, onClose }: { lead?: Lead; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [f, setF] = useState({
    firstName: lead?.firstName ?? '', lastName: lead?.lastName ?? '', companyName: lead?.companyName ?? '', customerType: lead?.customerType ?? 'private',
    email: lead?.email ?? '', phone: lead?.phone ?? '', street: lead?.street ?? '', zip: lead?.zip ?? '', city: lead?.city ?? '',
    source: lead?.source ?? 'manual', sourceDetail: lead?.sourceDetail ?? '', requestedService: lead?.requestedService ?? '', vehicleText: lead?.vehicleText ?? '',
    message: lead?.message ?? '', notes: lead?.notes ?? '', estimatedValue: lead?.estimatedValueCents ? String(lead.estimatedValueCents / 100) : '',
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const [dups, setDups] = useState<DuplicateHit[]>([]);
  const dq = useDebounced(`${f.email}|${f.phone}|${f.firstName}|${f.lastName}`, 400);
  useQuery({
    queryKey: ['dups', dq],
    queryFn: async () => {
      const r = await get<{ hits: DuplicateHit[] }>(`/api/crm/duplicates${qs({ email: f.email, phone: f.phone, firstName: f.firstName, lastName: f.lastName, excludeId: lead?.id })}`);
      setDups(r.hits);
      return r;
    },
    enabled: Boolean(f.email || f.phone || (f.firstName && f.lastName)),
  });
  const m = useMutation({
    mutationFn: (payload: Record<string, unknown>) => (lead ? patch<Lead>(`/api/leads/${lead.id}`, payload) : post<{ lead: Lead }>('/api/leads', payload).then((r) => r.lead)),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.ok(lead ? 'Lead gespeichert' : 'Lead angelegt');
      onClose();
      if (!lead && res) navigate(`/leads/${res.id}`);
    },
    onError: (e) => toast.fromError(e),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate({
      firstName: f.firstName, lastName: f.lastName, companyName: f.companyName || null, customerType: f.customerType, email: f.email || null, phone: f.phone || null,
      street: f.street || null, zip: f.zip || null, city: f.city || null, source: f.source, sourceDetail: f.sourceDetail || null, requestedService: f.requestedService || null,
      vehicleText: f.vehicleText || null, message: f.message || null, notes: f.notes || null, estimatedValueCents: f.estimatedValue ? Math.round(Number(f.estimatedValue.replace(',', '.')) * 100) : null,
    });
  };
  return (
    <Modal title={lead ? 'Lead bearbeiten' : 'Neuen Lead anlegen'} onClose={onClose} wide>
      <form onSubmit={submit}>
        {dups.length > 0 ? (
          <div className="dup-box" style={{ marginBottom: 14 }}>
            Mögliche Duplikate: {dups.map((d) => <span key={d.kind + d.id}><Link to={d.kind === 'customer' ? `/kunden/${d.id}` : `/leads/${d.id}`}>{d.label}</Link> ({d.matchedOn.join(', ')}) </span>)}
          </div>
        ) : null}
        <div className="form-grid">
          <Field label="Kundentyp"><Select value={f.customerType} onChange={set('customerType')}><option value="private">Privatkunde</option><option value="business">Firmenkunde</option></Select></Field>
          <Field label="Firma"><Input value={f.companyName} onChange={set('companyName')} /></Field>
          <Field label="Vorname"><Input value={f.firstName} onChange={set('firstName')} /></Field>
          <Field label="Nachname"><Input value={f.lastName} onChange={set('lastName')} /></Field>
          <Field label="E-Mail"><Input type="email" value={f.email} onChange={set('email')} /></Field>
          <Field label="Telefon"><Input type="tel" value={f.phone} onChange={set('phone')} /></Field>
          <Field label="Straße"><Input value={f.street} onChange={set('street')} /></Field>
          <div className="row" style={{ gap: 12, alignItems: 'stretch' }}>
            <Field label="PLZ"><Input value={f.zip} onChange={set('zip')} style={{ width: 96 }} /></Field>
            <Field label="Ort" className="" ><Input value={f.city} onChange={set('city')} /></Field>
          </div>
          <Field label="Quelle"><Select value={f.source} onChange={set('source')}>{Object.entries(LEAD_SOURCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Quelle Detail" hint="z. B. Kampagne, Empfehler"><Input value={f.sourceDetail} onChange={set('sourceDetail')} /></Field>
          <Field label="Gewünschte Leistung"><Input value={f.requestedService} onChange={set('requestedService')} /></Field>
          <Field label="Fahrzeug (Text)"><Input value={f.vehicleText} onChange={set('vehicleText')} placeholder="z. B. BMW 3er Touring, schwarz" /></Field>
          <Field label="Geschätzter Wert (€)"><Input inputMode="decimal" value={f.estimatedValue} onChange={set('estimatedValue')} /></Field>
          <Field label="Nachricht des Interessenten" className="span-2"><Textarea value={f.message} onChange={set('message')} /></Field>
          <Field label="Interne Notizen" className="span-2"><Textarea value={f.notes} onChange={set('notes')} /></Field>
        </div>
        <div className="form-actions">
          <Button type="button" onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="primary" loading={m.isPending}>{lead ? 'Speichern' : 'Anlegen'}</Button>
        </div>
      </form>
    </Modal>
  );
}
