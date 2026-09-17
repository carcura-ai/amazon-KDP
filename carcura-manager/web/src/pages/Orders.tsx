import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { Plus, Trash2, Pencil, Calendar, ArrowRight } from 'lucide-react';
import { get, post, patch, del, qs } from '../api/client';
import type { Customer, OrderDetail, OrderRow, Paged, Service, Appointment } from '../api/types';
import { useAuth } from '../app/auth';
import { Badge, Button, Card, Confirm, Empty, Field, Input, PageHead, Pager, Select, Skeleton, Textarea, useDebounced, useToast } from '../components/ui';
import { CustomerPicker, VehicleSelect, UserSelect } from '../components/pickers';
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber, personName, ORDER_STATUS, ORDER_FLOW, inputFromCents, centsFromInput, toLocalInput, fromLocalInput } from '../lib/format';
import { AppointmentModal } from './Calendar';

export function OrdersPage() {
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(true);
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const navigate = useNavigate();
  const list = useQuery({ queryKey: ['orders', { dq, status, open, page }], queryFn: () => get<Paged<OrderRow>>(`/api/orders${qs({ q: dq, status, open: open && !status ? true : undefined, page, pageSize: 50 })}`) });
  return (
    <>
      <PageHead title="Aufträge" sub="Von der Annahme über die Bearbeitung bis zur Abholung." actions={can('orders:write') ? <Link className="btn primary" to="/auftraege/neu"><Plus /> Auftrag anlegen</Link> : null} />
      <Card tight>
        <div className="toolbar">
          <input type="search" placeholder="Auftragsnummer, Kunde, Kennzeichen …" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Alle Status</option>{Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
          {!status ? <label className="check small"><input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} /> nur offene</label> : null}
        </div>
        {list.isLoading ? <Skeleton rows={6} /> : list.data && list.data.items.length === 0 ? <Empty title="Keine Aufträge" text="Aufträge entstehen aus Terminen oder werden direkt angelegt." /> : (
          <>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Nummer</th><th>Kunde</th><th className="hide-mobile">Fahrzeug</th><th className="hide-mobile">Leistung</th><th>Status</th><th className="num">Summe</th><th className="hide-mobile">Geplant</th></tr></thead>
              <tbody>{list.data?.items.map(({ order: o, customer: c, vehicle: v }) => (
                <tr key={o.id} className="row-link" onClick={() => navigate(`/auftraege/${o.id}`)}>
                  <td className="mono">{o.orderNumber}</td>
                  <td><div className="primary">{personName(c)}</div><div className="secondary mono">{c.customerNumber}</div></td>
                  <td className="hide-mobile muted">{v ? [v.make, v.model, v.licensePlate].filter(Boolean).join(' ') : '–'}</td>
                  <td className="hide-mobile muted">{o.title ?? '–'}</td>
                  <td><Badge tone={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label ?? o.status}</Badge></td>
                  <td className="num">{fmtMoney(o.totalCents)}</td>
                  <td className="hide-mobile muted">{o.scheduledAt ? fmtDateTime(o.scheduledAt) : '–'}</td>
                </tr>
              ))}</tbody>
            </table></div>
            {list.data ? <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} /> : null}
          </>
        )}
      </Card>
    </>
  );
}

interface ItemDraft { id?: string; serviceId: string | null; name: string; description: string; quantity: number; unitPrice: string; vatBp: number }
const emptyItem = (): ItemDraft => ({ serviceId: null, name: '', description: '', quantity: 1, unitPrice: '', vatBp: 1900 });

export function OrderFormPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { me } = useAuth();
  const editing = Boolean(id);
  const existing = useQuery({ queryKey: ['order', id], queryFn: () => get<OrderDetail>(`/api/orders/${id}`), enabled: editing });
  const presetCustomer = useQuery({ queryKey: ['customer', sp.get('customerId')], queryFn: () => get<{ customer: Customer }>(`/api/customers/${sp.get('customerId')}`), enabled: Boolean(sp.get('customerId')) && !editing });
  const services = useQuery({ queryKey: ['services'], queryFn: () => get<{ items: Service[] }>('/api/services') });
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [f, setF] = useState({ vehicleId: sp.get('vehicleId') || null as string | null, userId: null as string | null, title: sp.get('title') ?? '', notes: '', internalNotes: '', scheduledAt: '', mileageIn: '', appointmentId: sp.get('appointmentId') || null as string | null });
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (editing && existing.data && !loaded) {
      const { order: o, items: its } = existing.data;
      setCustomer(existing.data.customer);
      setF({ vehicleId: o.vehicleId, userId: o.userId, title: o.title ?? '', notes: o.notes ?? '', internalNotes: o.internalNotes ?? '', scheduledAt: o.scheduledAt ? toLocalInput(o.scheduledAt) : '', mileageIn: o.mileageIn ? String(o.mileageIn) : '', appointmentId: o.appointmentId });
      setItems(its.length ? its.map((i) => ({ id: i.id, serviceId: i.serviceId, name: i.name, description: i.description ?? '', quantity: i.quantity, unitPrice: inputFromCents(i.unitPriceCents), vatBp: i.vatBp })) : [emptyItem()]);
      setLoaded(true);
    }
    if (!editing && presetCustomer.data && !customer) setCustomer(presetCustomer.data.customer);
  }, [editing, existing.data, presetCustomer.data, loaded, customer]);

  const smallBusiness = me?.company.smallBusiness ?? false;
  const valid = items.filter((i) => i.name.trim());
  const subtotal = valid.reduce((s, i) => s + i.quantity * centsFromInput(i.unitPrice || '0'), 0);
  const vat = smallBusiness ? 0 : valid.reduce((s, i) => s + Math.round((i.quantity * centsFromInput(i.unitPrice || '0') * i.vatBp) / 10000), 0);

  const save = useMutation({
    mutationFn: () => {
      const payload = { customerId: customer!.id, vehicleId: f.vehicleId, userId: f.userId, appointmentId: f.appointmentId, title: f.title || null, notes: f.notes || null, internalNotes: f.internalNotes || null, scheduledAt: f.scheduledAt ? fromLocalInput(f.scheduledAt) : null, mileageIn: f.mileageIn ? Number(f.mileageIn) : null, items: valid.map((i) => ({ id: i.id, serviceId: i.serviceId, name: i.name.trim(), description: i.description || null, quantity: i.quantity, unitPriceCents: centsFromInput(i.unitPrice || '0'), vatBp: i.vatBp })) };
      return editing ? patch<OrderDetail>(`/api/orders/${id}`, payload) : post<OrderDetail>('/api/orders', payload);
    },
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['order', r.order.id] }); qc.invalidateQueries({ queryKey: ['appointments'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.ok(editing ? 'Auftrag gespeichert' : `Auftrag ${r.order.orderNumber} angelegt`); navigate(`/auftraege/${r.order.id}`); },
    onError: (e) => toast.fromError(e),
  });
  const addService = (svc: Service) => setItems((list) => { const empty = list.findIndex((i) => !i.name.trim()); const it: ItemDraft = { serviceId: svc.id, name: svc.name, description: '', quantity: 1, unitPrice: inputFromCents(svc.priceCents), vatBp: svc.vatBp }; if (empty >= 0) { const c = [...list]; c[empty] = it; return c; } return [...list, it]; });
  const upd = (i: number, p: Partial<ItemDraft>) => setItems((list) => list.map((it, j) => (j === i ? { ...it, ...p } : it)));

  if (editing && existing.isLoading) return <Card><Skeleton /></Card>;
  return (
    <>
      <PageHead crumbs={<><Link to="/auftraege">Aufträge</Link><span>/</span><span>{editing ? existing.data?.order.orderNumber : 'Neu'}</span></>} title={editing ? `Auftrag ${existing.data?.order.orderNumber} bearbeiten` : 'Neuer Auftrag'} />
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (!customer) return toast.error('Bitte Kunden wählen.'); if (!valid.length) return toast.error('Mindestens eine Position angeben.'); save.mutate(); }} className="stack" style={{ gap: 16 }}>
        <div className="grid main-side">
          <Card title="Auftragsdaten">
            <div className="form-grid">
              <Field label="Kunde *" className="span-2"><CustomerPicker value={customer} onChange={(c) => { setCustomer(c); setF({ ...f, vehicleId: null }); }} disabled={editing} /></Field>
              <Field label="Fahrzeug"><VehicleSelect customerId={customer?.id ?? null} value={f.vehicleId} onChange={(v) => setF({ ...f, vehicleId: v })} /></Field>
              <Field label="Mitarbeiter"><UserSelect value={f.userId} onChange={(u) => setF({ ...f, userId: u })} /></Field>
              <Field label="Bezeichnung" className="span-2"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="z. B. Komplettaufbereitung + Keramik" /></Field>
              <Field label="Geplanter Termin"><Input type="datetime-local" value={f.scheduledAt} onChange={(e) => setF({ ...f, scheduledAt: e.target.value })} /></Field>
              <Field label="Kilometerstand bei Annahme"><Input type="number" min={0} value={f.mileageIn} onChange={(e) => setF({ ...f, mileageIn: e.target.value })} /></Field>
              <Field label="Hinweise für den Kunden (auf Dokumenten)" className="span-2"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
              <Field label="Interne Notizen" className="span-2"><Textarea value={f.internalNotes} onChange={(e) => setF({ ...f, internalNotes: e.target.value })} /></Field>
            </div>
          </Card>
          <Card title="Leistung hinzufügen">
            <p className="small muted" style={{ marginBottom: 10 }}>Aus dem Katalog übernehmen oder unten frei eingeben.</p>
            <div className="stack" style={{ gap: 6 }}>
              {services.data?.items.map((s) => <button type="button" key={s.id} className="btn sm" style={{ justifyContent: 'space-between' }} onClick={() => addService(s)}><span>{s.name}</span><span className="muted">{s.priceCents ? fmtMoney(s.priceCents) : 'Preis offen'}</span></button>)}
            </div>
          </Card>
        </div>
        <Card title="Positionen" tight>
          <div className="table-wrap"><table className="table items-editor">
            <thead><tr><th style={{ width: '40%' }}>Leistung</th><th className="num">Menge</th><th className="num">Einzelpreis (€)</th><th className="num hide-mobile">MwSt.</th><th className="num">Gesamt</th><th></th></tr></thead>
            <tbody>{items.map((it, i) => (
              <tr key={i}>
                <td><Input value={it.name} onChange={(e) => upd(i, { name: e.target.value, serviceId: null })} placeholder="Bezeichnung" /><Input value={it.description} onChange={(e) => upd(i, { description: e.target.value })} placeholder="Beschreibung (optional)" style={{ marginTop: 4 }} /></td>
                <td className="num"><Input type="number" min={1} value={String(it.quantity)} onChange={(e) => upd(i, { quantity: Math.max(1, Number(e.target.value)) })} style={{ width: 72 }} /></td>
                <td className="num"><Input inputMode="decimal" value={it.unitPrice} onChange={(e) => upd(i, { unitPrice: e.target.value })} style={{ width: 110 }} /></td>
                <td className="num hide-mobile"><Select value={String(it.vatBp)} onChange={(e) => upd(i, { vatBp: Number(e.target.value) })} style={{ width: 90 }}><option value="1900">19 %</option><option value="700">7 %</option><option value="0">0 %</option></Select></td>
                <td className="num">{fmtMoney(it.quantity * centsFromInput(it.unitPrice || '0'))}</td>
                <td><Button type="button" size="sm" variant="ghost" onClick={() => setItems((l) => (l.length > 1 ? l.filter((_, j) => j !== i) : [emptyItem()]))}><Trash2 /></Button></td>
              </tr>
            ))}</tbody>
          </table></div>
          <div className="row" style={{ padding: 12, justifyContent: 'space-between' }}>
            <Button type="button" size="sm" onClick={() => setItems((l) => [...l, emptyItem()])}><Plus /> Position</Button>
            <div className="totals"><div className="l"><span className="muted">Netto</span><span>{fmtMoney(subtotal)}</span></div><div className="l"><span className="muted">{smallBusiness ? 'MwSt. (§ 19 UStG, keine)' : 'MwSt.'}</span><span>{fmtMoney(vat)}</span></div><div className="l total"><span>Gesamt</span><span>{fmtMoney(subtotal + vat)}</span></div></div>
          </div>
        </Card>
        <div className="form-actions"><Button type="button" onClick={() => navigate(-1)}>Abbrechen</Button><Button type="submit" variant="primary" loading={save.isPending}>{editing ? 'Speichern' : 'Auftrag anlegen'}</Button></div>
      </form>
    </>
  );
}

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [cancel, setCancel] = useState(false);
  const [appt, setAppt] = useState(false);
  const q = useQuery({ queryKey: ['order', id], queryFn: () => get<OrderDetail>(`/api/orders/${id}`) });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['order', id] }); qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };
  const setStatus = useMutation({ mutationFn: (status: string) => patch(`/api/orders/${id}`, { status }), onSuccess: () => { invalidate(); toast.ok('Status aktualisiert'); setCancel(false); }, onError: (e) => toast.fromError(e) });
  const doDelete = useMutation({ mutationFn: () => del(`/api/orders/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast.ok('Auftrag gelöscht'); navigate('/auftraege'); }, onError: (e) => toast.fromError(e) });
  if (q.isLoading) return <Card><Skeleton /></Card>;
  if (!q.data) return <Card><div className="empty"><h3>Auftrag nicht gefunden</h3></div></Card>;
  const { order: o, items, customer, vehicle, appointment, user, totals } = q.data;
  const idx = ORDER_FLOW.indexOf(o.status);
  const next = idx >= 0 && idx < ORDER_FLOW.length - 1 ? ORDER_FLOW[idx + 1]! : null;
  const final = o.status === 'completed' || o.status === 'cancelled';
  return (
    <>
      <PageHead
        crumbs={<><Link to="/auftraege">Aufträge</Link><span>/</span><span>{o.orderNumber}</span></>}
        title={<span className="row">{o.orderNumber}<Badge tone={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label}</Badge></span>}
        sub={o.title ?? undefined}
        actions={can('orders:write') && !final ? <>
          {next ? <Button variant="primary" onClick={() => setStatus.mutate(next)} loading={setStatus.isPending}>{ORDER_STATUS[next]?.label} <ArrowRight /></Button> : null}
          <Link className="btn" to={`/auftraege/${id}/bearbeiten`}><Pencil /> Bearbeiten</Link>
          {!appointment ? <Button onClick={() => setAppt(true)}><Calendar /> Termin</Button> : null}
          <Button variant="danger" onClick={() => setCancel(true)}>Stornieren</Button>
        </> : o.status === 'planned' || o.status === 'cancelled' ? <Button variant="danger" onClick={() => doDelete.mutate()}><Trash2 /></Button> : null}
      />
      <div className="flow" style={{ marginBottom: 18 }}>{ORDER_FLOW.map((s, i) => <span key={s} className={`step ${i < idx ? 'done' : ''} ${s === o.status ? 'current' : ''}`}>{ORDER_STATUS[s]?.label}</span>)}{o.status === 'cancelled' ? <span className="step current" style={{ background: 'var(--danger)' }}>Storniert</span> : null}</div>
      <div className="grid main-side">
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Positionen" tight>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Leistung</th><th className="num">Menge</th><th className="num">Einzelpreis</th><th className="num hide-mobile">MwSt.</th><th className="num">Gesamt</th></tr></thead>
              <tbody>{items.map((it) => <tr key={it.id}><td><div className="primary">{it.name}</div>{it.description ? <div className="secondary">{it.description}</div> : null}</td><td className="num">{it.quantity}</td><td className="num">{fmtMoney(it.unitPriceCents)}</td><td className="num hide-mobile">{it.vatBp / 100} %</td><td className="num">{fmtMoney(it.totalCents)}</td></tr>)}</tbody>
            </table></div>
            <div className="row" style={{ padding: 12, justifyContent: 'flex-end' }}>
              <div className="totals"><div className="l"><span className="muted">Netto</span><span>{fmtMoney(totals.subtotalCents)}</span></div>{totals.vatBreakdown.map((v) => <div className="l" key={v.vatBp}><span className="muted">MwSt. {v.vatBp / 100} %</span><span>{fmtMoney(v.vatCents)}</span></div>)}<div className="l total"><span>Gesamt</span><span>{fmtMoney(totals.totalCents)}</span></div></div>
            </div>
          </Card>
          {o.notes ? <Card title="Hinweise für den Kunden"><p style={{ whiteSpace: 'pre-wrap' }}>{o.notes}</p></Card> : null}
          {o.internalNotes ? <Card title="Interne Notizen"><p style={{ whiteSpace: 'pre-wrap' }} className="muted">{o.internalNotes}</p></Card> : null}
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Kunde & Fahrzeug">
            <dl className="dl">
              <dt>Kunde</dt><dd>{customer ? <Link to={`/kunden/${customer.id}`}>{personName(customer)}</Link> : '–'}<div className="small dim">{customer?.phone}</div></dd>
              <dt>Fahrzeug</dt><dd>{vehicle ? <Link to={`/fahrzeuge/${vehicle.id}`}>{[vehicle.make, vehicle.model].filter(Boolean).join(' ')} <span className="mono dim">{vehicle.licensePlate}</span></Link> : '–'}</dd>
              <dt>km bei Annahme</dt><dd>{o.mileageIn ? `${fmtNumber(o.mileageIn)} km` : '–'}</dd>
              <dt>Mitarbeiter</dt><dd>{user ? `${user.firstName} ${user.lastName}` : '–'}</dd>
            </dl>
          </Card>
          <Card title="Zeiten">
            <dl className="dl">
              <dt>Termin</dt><dd>{appointment ? <span>{fmtDateTime(appointment.startsAt)}<div className="small dim">{appointment.title}</div></span> : o.scheduledAt ? fmtDateTime(o.scheduledAt) : '–'}</dd>
              <dt>Begonnen</dt><dd>{fmtDateTime(o.startedAt)}</dd>
              <dt>Fertig</dt><dd>{fmtDateTime(o.finishedAt)}</dd>
              <dt>Abgeschlossen</dt><dd>{fmtDateTime(o.completedAt)}</dd>
              <dt>Angelegt</dt><dd>{fmtDate(o.createdAt)}</dd>
            </dl>
          </Card>
        </div>
      </div>
      {cancel ? <Confirm title="Auftrag stornieren?" text="Der Auftrag wird als storniert markiert und bleibt in der Historie sichtbar." confirmLabel="Stornieren" danger loading={setStatus.isPending} onConfirm={() => setStatus.mutate('cancelled')} onClose={() => setCancel(false)} /> : null}
      {appt && customer ? <AppointmentModal customer={customer} vehicleId={o.vehicleId} orderId={o.id} start={o.scheduledAt ? new Date(o.scheduledAt) : undefined} onClose={() => { setAppt(false); invalidate(); }} /> : null}
    </>
  );
}

export function CustomerAppointmentsAndOrders({ customerId }: { customerId: string }) {
  const appts = useQuery({ queryKey: ['appointments', 'customer', customerId], queryFn: () => get<{ items: Appointment[] }>(`/api/appointments${qs({ customerId, limit: 50 })}`) });
  const ords = useQuery({ queryKey: ['orders', 'customer', customerId], queryFn: () => get<Paged<OrderRow>>(`/api/orders${qs({ customerId, pageSize: 50 })}`) });
  const [modal, setModal] = useState<Appointment | null>(null);
  return (
    <>
      <Card title="Termine">
        {!appts.data?.items.length ? <p className="muted">Keine Termine.</p> : appts.data.items.slice().reverse().slice(0, 6).map((a) => <div key={a.id} className="spread" style={{ padding: '6px 0', cursor: 'pointer' }} onClick={() => setModal(a)}><span>{fmtDateTime(a.startsAt)}<div className="small muted">{a.title}</div></span><Badge tone={APPOINTMENT_STATUS_TONE(a.status)}>{APPOINTMENT_LABEL(a.status)}</Badge></div>)}
      </Card>
      <Card title="Aufträge">
        {!ords.data?.items.length ? <p className="muted">Keine Aufträge.</p> : ords.data.items.map(({ order: o }) => <Link key={o.id} to={`/auftraege/${o.id}`} className="spread" style={{ padding: '6px 0' }}><span className="mono">{o.orderNumber}<div className="small muted" style={{ fontFamily: 'var(--font)' }}>{o.title ?? fmtDate(o.createdAt)} · {fmtMoney(o.totalCents)}</div></span><Badge tone={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label}</Badge></Link>)}
      </Card>
      {modal ? <AppointmentModal appointment={modal} onClose={() => setModal(null)} /> : null}
    </>
  );
}
import { APPOINTMENT_STATUS } from '../lib/format';
const APPOINTMENT_LABEL = (s: string) => APPOINTMENT_STATUS[s]?.label ?? s;
const APPOINTMENT_STATUS_TONE = (s: string) => APPOINTMENT_STATUS[s]?.tone ?? '';
