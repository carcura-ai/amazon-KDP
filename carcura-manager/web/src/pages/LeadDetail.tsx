import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowRightLeft, Pencil, Trash2 } from 'lucide-react';
import { get, post, patch, del } from '../api/client';
import type { Lead, Activity, DuplicateHit, Customer } from '../api/types';
import { useAuth } from '../app/auth';
import { TaskPanel } from './Tasks';
import { Badge, Button, Card, Confirm, Field, Modal, PageHead, Select, Skeleton, Textarea, useToast } from '../components/ui';
import { fmtDateTime, fmtMoney, LEAD_SOURCE, LEAD_STATUS, personName } from '../lib/format';
import { LeadForm } from './Leads';
import { Timeline, ActivityForm } from './CustomerDetail';

export function LeadDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [edit, setEdit] = useState(false);
  const [convert, setConvert] = useState(false);
  const [remove, setRemove] = useState(false);
  const [lost, setLost] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['lead', id], queryFn: () => get<{ lead: Lead; activities: Activity[]; duplicates: DuplicateHit[] }>(`/api/leads/${id}`) });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['lead', id] }); qc.invalidateQueries({ queryKey: ['leads'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };
  const setStatus = useMutation({
    mutationFn: (payload: { status: string; lostReason?: string }) => patch<Lead>(`/api/leads/${id}`, payload),
    onSuccess: () => { invalidate(); toast.ok('Status aktualisiert'); setLost(null); },
    onError: (e) => toast.fromError(e),
  });
  const doConvert = useMutation({
    mutationFn: (existingCustomerId?: string) => post<{ customer: Customer }>(`/api/leads/${id}/convert`, existingCustomerId ? { existingCustomerId } : {}),
    onSuccess: (r) => { invalidate(); qc.invalidateQueries({ queryKey: ['customers'] }); toast.ok('Kunde angelegt', r.customer.customerNumber); navigate(`/kunden/${r.customer.id}`); },
    onError: (e) => toast.fromError(e),
  });
  const doDelete = useMutation({
    mutationFn: () => del(`/api/leads/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }); toast.ok('Lead gelöscht'); navigate('/leads'); },
    onError: (e) => toast.fromError(e),
  });

  if (q.isLoading) return <Card><Skeleton rows={6} /></Card>;
  if (!q.data) return <Card><div className="empty"><h3>Lead nicht gefunden</h3></div></Card>;
  const { lead, activities, duplicates } = q.data;
  const customerDups = duplicates.filter((d) => d.kind === 'customer');

  return (
    <>
      <PageHead
        crumbs={<><Link to="/leads">Leads</Link><span>/</span><span>{personName(lead)}</span></>}
        title={personName(lead)}
        sub={<span className="row"><Badge tone={LEAD_STATUS[lead.status]?.tone}>{LEAD_STATUS[lead.status]?.label ?? lead.status}</Badge><span>{LEAD_SOURCE[lead.source] ?? lead.source}{lead.sourceDetail ? ` · ${lead.sourceDetail}` : ''}</span><span className="dim">Eingang {fmtDateTime(lead.createdAt)}</span></span>}
        actions={can('leads:write') ? (
          <>
            {lead.customerId ? <><Link className="btn primary" to={`/angebote/neu?customerId=${lead.customerId}&leadId=${lead.id}&title=${encodeURIComponent(lead.requestedService ?? '')}`}>Angebot erstellen</Link><Link className="btn" to={`/kunden/${lead.customerId}`}>Zur Kundenakte</Link></> : <Button variant="primary" onClick={() => setConvert(true)}><ArrowRightLeft /> In Kunde umwandeln</Button>}
            <Button onClick={() => setEdit(true)}><Pencil /> Bearbeiten</Button>
            {!lead.customerId ? <Button variant="danger" onClick={() => setRemove(true)}><Trash2 /></Button> : null}
          </>
        ) : null}
      />
      <div className="grid main-side">
        <div className="stack" style={{ gap: 16 }}>
          {customerDups.length > 0 && !lead.customerId ? (
            <div className="dup-box">Es gibt bereits Kunden mit denselben Kontaktdaten: {customerDups.map((d) => <Link key={d.id} to={`/kunden/${d.id}`}>{d.label}</Link>)}. Beim Umwandeln kann der Lead dieser Akte zugeordnet werden.</div>
          ) : null}
          <Card title="Anfrage">
            <dl className="dl">
              <dt>Gewünschte Leistung</dt><dd>{lead.requestedService ?? '–'}</dd>
              <dt>Fahrzeug</dt><dd>{lead.vehicleText ?? '–'}</dd>
              <dt>Nachricht</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{lead.message ?? '–'}</dd>
              <dt>Geschätzter Wert</dt><dd>{fmtMoney(lead.estimatedValueCents)}</dd>
              <dt>Interne Notizen</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{lead.notes ?? '–'}</dd>
              {lead.gclid ? <><dt>Google-Klick-ID</dt><dd className="mono">{lead.gclid}</dd></> : null}
              {lead.lostReason ? <><dt>Verlustgrund</dt><dd>{lead.lostReason}</dd></> : null}
            </dl>
          </Card>
          <Card title="Historie" actions={can('leads:write') ? <ActivityForm url={`/api/leads/${id}/activities`} onSaved={invalidate} /> : null}>
            <Timeline items={activities} />
          </Card>
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Status">
            {can('leads:write') && !lead.customerId ? (
              <Field label="Status ändern">
                <Select value={lead.status} onChange={(e) => (e.target.value === 'lost' ? setLost('') : setStatus.mutate({ status: e.target.value }))}>
                  {Object.entries(LEAD_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </Select>
              </Field>
            ) : <Badge tone={LEAD_STATUS[lead.status]?.tone}>{LEAD_STATUS[lead.status]?.label}</Badge>}
            <p className="small dim" style={{ marginTop: 10 }}>Letzter Kontakt: {fmtDateTime(lead.lastContactAt)}</p>
          </Card>
          <TaskPanel filter={{ leadId: id }} />
          <Card title="Kontakt">
            <dl className="dl">
              <dt>Typ</dt><dd>{lead.customerType === 'business' ? 'Firmenkunde' : 'Privatkunde'}</dd>
              <dt>Telefon</dt><dd>{lead.phone ? <a href={`tel:${lead.phone}`}>{lead.phone}</a> : '–'}</dd>
              <dt>E-Mail</dt><dd>{lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : '–'}</dd>
              <dt>Adresse</dt><dd>{[lead.street, [lead.zip, lead.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '–'}</dd>
            </dl>
          </Card>
        </div>
      </div>
      {edit ? <LeadForm lead={lead} onClose={() => { setEdit(false); invalidate(); }} /> : null}
      {lost !== null ? (
        <Modal title="Lead als verloren markieren" onClose={() => setLost(null)}>
          <Field label="Grund (optional)"><Textarea value={lost} onChange={(e) => setLost(e.target.value)} placeholder="z. B. Preis, Entfernung, keine Rückmeldung" /></Field>
          <div className="form-actions"><Button onClick={() => setLost(null)}>Abbrechen</Button><Button variant="danger" loading={setStatus.isPending} onClick={() => setStatus.mutate({ status: 'lost', lostReason: lost || undefined })}>Als verloren markieren</Button></div>
        </Modal>
      ) : null}
      {convert ? (
        <Modal title="Lead in Kunde umwandeln" onClose={() => setConvert(false)}>
          <p className="muted">Es wird eine Kundenakte mit Kundennummer angelegt. Die Historie des Leads wird übernommen.</p>
          {customerDups.length > 0 ? (
            <div className="stack" style={{ marginTop: 14 }}>
              <p>Oder einem bestehenden Kunden zuordnen:</p>
              {customerDups.map((d) => <Button key={d.id} onClick={() => doConvert.mutate(d.id)} loading={doConvert.isPending}>{d.label} zuordnen</Button>)}
            </div>
          ) : null}
          <div className="form-actions"><Button onClick={() => setConvert(false)}>Abbrechen</Button><Button variant="primary" loading={doConvert.isPending} onClick={() => doConvert.mutate(undefined)}>Neuen Kunden anlegen</Button></div>
        </Modal>
      ) : null}
      {remove ? <Confirm title="Lead löschen?" text="Der Lead und seine Historie werden endgültig entfernt." confirmLabel="Löschen" danger loading={doDelete.isPending} onConfirm={() => doDelete.mutate()} onClose={() => setRemove(false)} /> : null}
    </>
  );
}
