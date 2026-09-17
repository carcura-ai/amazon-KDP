import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { Plus } from 'lucide-react';
import { get, post, patch, qs } from '../api/client';
import type { Customer, Paged, DuplicateHit } from '../api/types';
import { useAuth } from '../app/auth';
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHead, Pager, Select, Skeleton, Textarea, useDebounced, useToast } from '../components/ui';
import { fmtDate, personName } from '../lib/format';

export function CustomersPage() {
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [create, setCreate] = useState(false);
  const dq = useDebounced(q);
  const navigate = useNavigate();
  const list = useQuery({ queryKey: ['customers', { dq, type, page }], queryFn: () => get<Paged<Customer>>(`/api/customers${qs({ q: dq, type, page, pageSize: 50 })}`) });
  return (
    <>
      <PageHead title="Kunden" sub="Alle Kundenakten mit Fahrzeugen, Historie und Dokumenten." actions={can('customers:write') ? <Button variant="primary" onClick={() => setCreate(true)}><Plus /> Kunde anlegen</Button> : null} />
      <Card tight>
        <div className="toolbar">
          <input type="search" placeholder="Name, Firma, Kundennummer, Telefon, Ort …" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}><option value="">Alle Typen</option><option value="private">Privatkunden</option><option value="business">Firmenkunden</option></Select>
        </div>
        {list.isLoading ? <Skeleton rows={6} /> : list.data && list.data.items.length === 0 ? (
          <Empty title="Keine Kunden gefunden" text={dq ? 'Suchbegriff ändern.' : 'Kunden entstehen aus Leads oder werden direkt angelegt.'} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Kunde</th><th>Kontakt</th><th className="hide-mobile">Ort</th><th className="hide-mobile">Tags</th><th>Seit</th></tr></thead>
                <tbody>
                  {list.data?.items.map((c) => (
                    <tr key={c.id} className="row-link" onClick={() => navigate(`/kunden/${c.id}`)}>
                      <td><div className="primary">{personName(c)}</div><div className="secondary mono">{c.customerNumber}{c.type === 'business' ? ' · Firma' : ''}</div></td>
                      <td><div>{c.phone ?? '–'}</div><div className="secondary">{c.email ?? ''}</div></td>
                      <td className="hide-mobile muted">{[c.zip, c.city].filter(Boolean).join(' ') || '–'}</td>
                      <td className="hide-mobile"><div className="row">{(JSON.parse(c.tagsJson) as string[]).map((t) => <Badge key={t} plain>{t}</Badge>)}</div></td>
                      <td className="muted">{fmtDate(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {list.data ? <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} /> : null}
          </>
        )}
      </Card>
      {create ? <CustomerForm onClose={() => setCreate(false)} /> : null}
    </>
  );
}

export function CustomerForm({ customer, onClose }: { customer?: Customer; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [f, setF] = useState({
    type: customer?.type ?? 'private', salutation: customer?.salutation ?? '', firstName: customer?.firstName ?? '', lastName: customer?.lastName ?? '', companyName: customer?.companyName ?? '',
    street: customer?.street ?? '', houseNumber: customer?.houseNumber ?? '', zip: customer?.zip ?? '', city: customer?.city ?? '', email: customer?.email ?? '', phone: customer?.phone ?? '', phone2: customer?.phone2 ?? '',
    notes: customer?.notes ?? '', tags: customer ? (JSON.parse(customer.tagsJson) as string[]).join(', ') : '', source: customer?.source ?? '',
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const [dups, setDups] = useState<DuplicateHit[]>([]);
  const dq = useDebounced(`${f.email}|${f.phone}|${f.firstName}|${f.lastName}`, 400);
  useQuery({
    queryKey: ['dups-c', dq],
    queryFn: async () => { const r = await get<{ hits: DuplicateHit[] }>(`/api/crm/duplicates${qs({ email: f.email, phone: f.phone, firstName: f.firstName, lastName: f.lastName, excludeId: customer?.id })}`); setDups(r.hits.filter((h) => h.kind === 'customer')); return r; },
    enabled: Boolean(f.email || f.phone || (f.firstName && f.lastName)),
  });
  const m = useMutation({
    mutationFn: (payload: Record<string, unknown>) => (customer ? patch<Customer>(`/api/customers/${customer.id}`, payload) : post<{ customer: Customer }>('/api/customers', payload).then((r) => r.customer)),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['customers'] }); qc.invalidateQueries({ queryKey: ['customer', res.id] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.ok(customer ? 'Kunde gespeichert' : `Kunde ${res.customerNumber} angelegt`); onClose(); if (!customer) navigate(`/kunden/${res.id}`); },
    onError: (e) => toast.fromError(e),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate({ type: f.type, salutation: f.salutation || null, firstName: f.firstName, lastName: f.lastName, companyName: f.companyName || null, street: f.street || null, houseNumber: f.houseNumber || null, zip: f.zip || null, city: f.city || null, email: f.email || null, phone: f.phone || null, phone2: f.phone2 || null, notes: f.notes || null, source: f.source || null, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean) });
  };
  return (
    <Modal title={customer ? 'Kunde bearbeiten' : 'Neuen Kunden anlegen'} onClose={onClose} wide>
      <form onSubmit={submit}>
        {dups.length > 0 ? <div className="dup-box" style={{ marginBottom: 14 }}>Mögliche Duplikate: {dups.map((d) => <span key={d.id}><Link to={`/kunden/${d.id}`}>{d.label}</Link> ({d.matchedOn.join(', ')}) </span>)}</div> : null}
        <div className="form-grid">
          <Field label="Kundentyp"><Select value={f.type} onChange={set('type')}><option value="private">Privatkunde</option><option value="business">Firmenkunde</option></Select></Field>
          <Field label="Firma"><Input value={f.companyName} onChange={set('companyName')} /></Field>
          <Field label="Anrede"><Select value={f.salutation} onChange={set('salutation')}><option value="">–</option><option>Herr</option><option>Frau</option><option>Divers</option></Select></Field>
          <div />
          <Field label="Vorname"><Input value={f.firstName} onChange={set('firstName')} /></Field>
          <Field label="Nachname"><Input value={f.lastName} onChange={set('lastName')} /></Field>
          <Field label="E-Mail"><Input type="email" value={f.email} onChange={set('email')} /></Field>
          <Field label="Telefon"><Input type="tel" value={f.phone} onChange={set('phone')} /></Field>
          <Field label="Telefon 2"><Input type="tel" value={f.phone2} onChange={set('phone2')} /></Field>
          <Field label="Quelle"><Input value={f.source} onChange={set('source')} placeholder="z. B. Empfehlung" /></Field>
          <div className="row" style={{ gap: 12, alignItems: 'stretch' }}>
            <Field label="Straße" className="" ><Input value={f.street} onChange={set('street')} /></Field>
            <Field label="Nr."><Input value={f.houseNumber} onChange={set('houseNumber')} style={{ width: 72 }} /></Field>
          </div>
          <div className="row" style={{ gap: 12, alignItems: 'stretch' }}>
            <Field label="PLZ"><Input value={f.zip} onChange={set('zip')} style={{ width: 96 }} /></Field>
            <Field label="Ort" className="" ><Input value={f.city} onChange={set('city')} /></Field>
          </div>
          <Field label="Tags" hint="Kommagetrennt, z. B. Stammkunde, Flotte" className="span-2"><Input value={f.tags} onChange={set('tags')} /></Field>
          <Field label="Interne Notizen" className="span-2"><Textarea value={f.notes} onChange={set('notes')} /></Field>
        </div>
        <div className="form-actions"><Button type="button" onClick={onClose}>Abbrechen</Button><Button type="submit" variant="primary" loading={m.isPending}>{customer ? 'Speichern' : 'Anlegen'}</Button></div>
      </form>
    </Modal>
  );
}
