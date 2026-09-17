import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight, Plus, Send, MessageCircle, Trash2, ClipboardList } from 'lucide-react';
import { get, post, patch, del, qs } from '../api/client';
import type { Appointment, Customer } from '../api/types';
import { useAuth } from '../app/auth';
import { Badge, Button, Card, Confirm, Field, Input, Modal, PageHead, Select, Textarea, useToast } from '../components/ui';
import { CustomerPicker, VehicleSelect, UserSelect } from '../components/pickers';
import { APPOINTMENT_STATUS, APPOINTMENT_TYPE, fmtDate, fmtDateTime, fmtTime, fmtWeekday, fromLocalInput, toLocalInput, personName, inputFromCents, centsFromInput } from '../lib/format';

type View = 'day' | 'week' | 'month' | 'list';
const HOURS = Array.from({ length: 14 }, (_, i) => 7 + i); // 07–20 Uhr
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

function range(view: View, cursor: Date): { from: Date; to: Date } {
  if (view === 'day') return { from: startOfDay(cursor), to: addDays(startOfDay(cursor), 1) };
  if (view === 'week') return { from: startOfWeek(cursor), to: addDays(startOfWeek(cursor), 7) };
  if (view === 'month') { const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1); return { from: startOfWeek(first), to: addDays(startOfWeek(first), 42) }; }
  return { from: startOfDay(cursor), to: addDays(startOfDay(cursor), 60) };
}

export function CalendarPage() {
  const { can } = useAuth();
  const [view, setView] = useState<View>(window.innerWidth < 860 ? 'list' : 'week');
  const [cursor, setCursor] = useState(new Date());
  const [userId, setUserId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ appt?: Appointment; start?: Date } | null>(null);
  const { from, to } = useMemo(() => range(view, cursor), [view, cursor]);
  const q = useQuery({ queryKey: ['appointments', from.toISOString(), to.toISOString(), userId], queryFn: () => get<{ items: Appointment[] }>(`/api/appointments${qs({ from: from.toISOString(), to: to.toISOString(), userId })}`) });
  const items = q.data?.items ?? [];
  const move = (n: number) => setCursor(view === 'day' ? addDays(cursor, n) : view === 'week' ? addDays(cursor, 7 * n) : view === 'month' ? new Date(cursor.getFullYear(), cursor.getMonth() + n, 1) : addDays(cursor, 30 * n));
  const title = view === 'month' ? cursor.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) : view === 'day' ? cursor.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' }) : view === 'week' ? `${fmtDate(from.toISOString())} – ${fmtDate(addDays(to, -1).toISOString())}` : `ab ${fmtDate(from.toISOString())}`;
  const openNew = (start: Date) => can('appointments:write') && setModal({ start });

  return (
    <>
      <PageHead title="Kalender" sub="Alle Termine: Aufbereitungen, Abholungen, Übergaben, Beratungen." actions={can('appointments:write') ? <Button variant="primary" onClick={() => setModal({ start: nextSlot() })}><Plus /> Termin</Button> : null} />
      <Card tight>
        <div className="cal-head">
          <div className="row"><Button size="sm" onClick={() => move(-1)} aria-label="Zurück"><ChevronLeft /></Button><Button size="sm" onClick={() => setCursor(new Date())}>Heute</Button><Button size="sm" onClick={() => move(1)} aria-label="Weiter"><ChevronRight /></Button></div>
          <div className="title">{title}</div>
          <div className="seg" role="tablist">{(['day', 'week', 'month', 'list'] as View[]).map((v) => <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{{ day: 'Tag', week: 'Woche', month: 'Monat', list: 'Liste' }[v]}</button>)}</div>
          <div style={{ marginLeft: 'auto', minWidth: 180 }}><UserSelect value={userId} onChange={setUserId} /></div>
        </div>
        {view === 'month' ? <MonthView cursor={cursor} from={from} items={items} onDay={(d) => { setCursor(d); setView('day'); }} onNew={openNew} onOpen={(a) => setModal({ appt: a })} /> : null}
        {view === 'week' || view === 'day' ? <WeekView days={view === 'day' ? [startOfDay(cursor)] : Array.from({ length: 7 }, (_, i) => addDays(from, i))} items={items} onNew={openNew} onOpen={(a) => setModal({ appt: a })} /> : null}
        {view === 'list' ? <ListView items={items} onOpen={(a) => setModal({ appt: a })} /> : null}
      </Card>
      {modal ? <AppointmentModal appointment={modal.appt} start={modal.start} onClose={() => setModal(null)} /> : null}
    </>
  );
}

function nextSlot(): Date { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d; }

function MonthView({ cursor, from, items, onDay, onNew, onOpen }: { cursor: Date; from: Date; items: Appointment[]; onDay: (d: Date) => void; onNew: (d: Date) => void; onOpen: (a: Appointment) => void }) {
  const today = new Date();
  const cells = Array.from({ length: 42 }, (_, i) => addDays(from, i));
  return (
    <div className="month-grid">
      {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => <div key={d} className="dow">{d}</div>)}
      {cells.map((d) => {
        const evts = items.filter((a) => sameDay(new Date(a.startsAt), d));
        return (
          <div key={d.toISOString()} className={`month-cell ${d.getMonth() !== cursor.getMonth() ? 'other' : ''} ${sameDay(d, today) ? 'today' : ''}`} onClick={() => (window.innerWidth < 860 ? onDay(d) : onNew(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9)))} onDoubleClick={() => onDay(d)}>
            <div className="d"><span>{d.getDate()}</span></div>
            {evts.slice(0, 3).map((a) => <div key={a.id} className={`evt ${a.status}`} onClick={(e) => { e.stopPropagation(); onOpen(a); }}>{a.allDay ? '' : fmtTime(a.startsAt) + ' '}{a.title}</div>)}
            {evts.length > 3 ? <div className="small dim">+{evts.length - 3} weitere</div> : null}
            <div className="dots">{evts.slice(0, 6).map((a) => <i key={a.id} />)}</div>
          </div>
        );
      })}
    </div>
  );
}

function WeekView({ days, items, onNew, onOpen }: { days: Date[]; items: Appointment[]; onNew: (d: Date) => void; onOpen: (a: Appointment) => void }) {
  const today = new Date();
  const slotH = 48;
  const top = (d: Date) => Math.max(0, ((d.getHours() + d.getMinutes() / 60) - HOURS[0]!) * slotH);
  return (
    <div className="table-wrap">
      <div className={`week ${days.length === 1 ? 'day' : ''}`} style={{ minWidth: days.length === 1 ? 0 : 640 }}>
        <div />
        {days.map((d) => <div key={d.toISOString()} className={`dow ${sameDay(d, today) ? 'today' : ''}`}>{fmtWeekday(d.toISOString())}</div>)}
        <div className="gutter">{HOURS.map((h) => <div key={h} className="h">{String(h).padStart(2, '0')}:00</div>)}</div>
        {days.map((d) => {
          const evts = items.filter((a) => sameDay(new Date(a.startsAt), d) && !a.allDay);
          const allDay = items.filter((a) => sameDay(new Date(a.startsAt), d) && a.allDay);
          return (
            <div key={d.toISOString()} className="col">
              {HOURS.map((h) => <div key={h} className="slot" onClick={() => onNew(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h))} />)}
              {allDay.map((a, i) => <div key={a.id} className={`evt ${a.status}`} style={{ top: 2 + i * 22, height: 20 }} onClick={() => onOpen(a)}>{a.title}</div>)}
              {evts.map((a) => {
                const s = new Date(a.startsAt); const e = new Date(a.endsAt);
                const h = Math.max(22, ((e.getTime() - s.getTime()) / 3600_000) * slotH - 2);
                return <div key={a.id} className={`evt ${a.status}`} style={{ top: top(s), height: h }} onClick={() => onOpen(a)}><div className="t">{fmtTime(a.startsAt)} {a.title}</div>{a.customer ? <div className="s small">{personName(a.customer)}</div> : null}{a.vehicle ? <div className="s small dim">{[a.vehicle.make, a.vehicle.model, a.vehicle.licensePlate].filter(Boolean).join(' ')}</div> : null}</div>;
              })}
              {sameDay(d, today) ? <div className="now" style={{ top: top(today) }} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView({ items, onOpen }: { items: Appointment[]; onOpen: (a: Appointment) => void }) {
  if (items.length === 0) return <div className="empty"><h3>Keine Termine im Zeitraum</h3></div>;
  const groups = new Map<string, Appointment[]>();
  for (const a of items) { const k = new Date(a.startsAt).toDateString(); groups.set(k, [...(groups.get(k) ?? []), a]); }
  return (
    <div>
      {[...groups.entries()].map(([k, list]) => (
        <div key={k}>
          <div className="list-day">{new Date(k).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
          {list.map((a) => (
            <div key={a.id} className="list-evt" onClick={() => onOpen(a)}>
              <div className="time">{a.allDay ? 'ganztägig' : `${fmtTime(a.startsAt)}–${fmtTime(a.endsAt)}`}</div>
              <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600 }}>{a.title}</div><div className="small muted">{[a.customer ? personName(a.customer) : null, a.vehicle ? [a.vehicle.make, a.vehicle.model, a.vehicle.licensePlate].filter(Boolean).join(' ') : null, a.user ? `${a.user.firstName} ${a.user.lastName}` : null].filter(Boolean).join(' · ')}</div></div>
              <Badge tone={APPOINTMENT_STATUS[a.status]?.tone}>{APPOINTMENT_STATUS[a.status]?.label}</Badge>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function AppointmentModal({ appointment, start, customer: presetCustomer, vehicleId: presetVehicle, orderId, onClose }: { appointment?: Appointment; start?: Date; customer?: Customer | null; vehicleId?: string | null; orderId?: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { can } = useAuth();
  const a = appointment;
  const s0 = start ?? new Date();
  const [customer, setCustomer] = useState<Customer | null>(presetCustomer ?? (a?.customer ? ({ ...a.customer } as unknown as Customer) : null));
  const [f, setF] = useState({
    title: a?.title ?? '', type: a?.type ?? 'service', vehicleId: a?.vehicleId ?? presetVehicle ?? null, userId: a?.userId ?? null,
    startsAt: toLocalInput(a?.startsAt ?? s0.toISOString()), endsAt: toLocalInput(a?.endsAt ?? new Date(s0.getTime() + 2 * 3600_000).toISOString()),
    allDay: a?.allDay ?? false, status: a?.status ?? 'planned', location: a?.location ?? '', notes: a?.notes ?? '', price: inputFromCents(a?.priceCents), sendConfirmation: false,
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const [remove, setRemove] = useState(false);
  const detail = useQuery({ queryKey: ['appointment', a?.id], queryFn: () => get<{ appointment: Appointment; whatsappUrl: string | null; mailConfigured: boolean }>(`/api/appointments/${a!.id}`), enabled: Boolean(a) });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['appointments'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); if (a) qc.invalidateQueries({ queryKey: ['appointment', a.id] }); if (customer) qc.invalidateQueries({ queryKey: ['customer', customer.id] }); };
  const save = useMutation({
    mutationFn: () => {
      const payload = { title: f.title, type: f.type, customerId: customer?.id ?? null, vehicleId: customer ? f.vehicleId : null, userId: f.userId, orderId: orderId ?? a?.orderId ?? null, startsAt: fromLocalInput(f.startsAt), endsAt: f.allDay ? new Date(new Date(fromLocalInput(f.startsAt)).setHours(23, 59)).toISOString() : fromLocalInput(f.endsAt), allDay: f.allDay, status: f.status, location: f.location || null, notes: f.notes || null, priceCents: f.price ? centsFromInput(f.price) : null };
      return a ? patch<{ appointment: Appointment; conflicts: unknown[] }>(`/api/appointments/${a.id}`, payload) : post<{ appointment: Appointment; conflicts: unknown[]; confirmation: { ok: boolean; error?: string } | null }>('/api/appointments', { ...payload, sendConfirmation: f.sendConfirmation });
    },
    onSuccess: (r) => {
      invalidate();
      toast.ok(a ? 'Termin gespeichert' : 'Termin angelegt', r.conflicts.length ? `Achtung: ${r.conflicts.length} Überschneidung(en) beim Mitarbeiter.` : undefined);
      const conf = (r as { confirmation?: { ok: boolean; error?: string } | null }).confirmation;
      if (conf && !conf.ok) toast.error('Bestätigung nicht gesendet', conf.error);
      onClose();
    },
    onError: (e) => toast.fromError(e),
  });
  const doDelete = useMutation({ mutationFn: () => del(`/api/appointments/${a!.id}`), onSuccess: () => { invalidate(); toast.ok('Termin gelöscht'); onClose(); }, onError: (e) => toast.fromError(e) });
  const remind = useMutation({ mutationFn: () => post(`/api/appointments/${a!.id}/send-reminder`), onSuccess: () => { invalidate(); toast.ok('Erinnerung per E-Mail gesendet'); }, onError: (e) => toast.fromError(e, 'Erinnerung nicht gesendet') });
  const logWa = useMutation({ mutationFn: () => post(`/api/appointments/${a!.id}/log-manual-reminder`, { channel: 'whatsapp' }), onSuccess: () => { invalidate(); toast.ok('WhatsApp-Erinnerung protokolliert'); } });

  return (
    <Modal title={a ? 'Termin' : 'Neuer Termin'} onClose={onClose} wide>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }}>
        <div className="form-grid">
          <Field label="Kunde" className="span-2"><CustomerPicker value={customer} onChange={(c) => { setCustomer(c); setF({ ...f, vehicleId: null }); }} /></Field>
          <Field label="Fahrzeug"><VehicleSelect customerId={customer?.id ?? null} value={f.vehicleId} onChange={(id) => setF({ ...f, vehicleId: id })} /></Field>
          <Field label="Mitarbeiter"><UserSelect value={f.userId} onChange={(id) => setF({ ...f, userId: id })} /></Field>
          <Field label="Titel *" className="span-2"><Input required value={f.title} onChange={set('title')} placeholder="z. B. Komplettaufbereitung, Abholung" /></Field>
          <Field label="Art"><Select value={f.type} onChange={set('type')}>{Object.entries(APPOINTMENT_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Status"><Select value={f.status} onChange={set('status')}>{Object.entries(APPOINTMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
          <Field label="Beginn"><Input type="datetime-local" required value={f.startsAt} onChange={(e) => { const s = e.target.value; const dur = new Date(f.endsAt).getTime() - new Date(f.startsAt).getTime(); setF({ ...f, startsAt: s, endsAt: toLocalInput(new Date(new Date(s).getTime() + (dur > 0 ? dur : 7200_000)).toISOString()) }); }} /></Field>
          <Field label="Ende"><Input type="datetime-local" required={!f.allDay} disabled={f.allDay} value={f.endsAt} onChange={set('endsAt')} /></Field>
          <label className="check"><input type="checkbox" checked={f.allDay} onChange={(e) => setF({ ...f, allDay: e.target.checked })} /> ganztägig</label>
          <Field label="Preis (€, optional)"><Input inputMode="decimal" value={f.price} onChange={set('price')} /></Field>
          <Field label="Ort" className="span-2"><Input value={f.location} onChange={set('location')} placeholder="Werkstatt, beim Kunden …" /></Field>
          <Field label="Notizen (erscheinen in Bestätigung/Erinnerung)" className="span-2"><Textarea value={f.notes} onChange={set('notes')} /></Field>
          {!a && customer?.email ? <label className="check span-2"><input type="checkbox" checked={f.sendConfirmation} onChange={(e) => setF({ ...f, sendConfirmation: e.target.checked })} /> Terminbestätigung per E-Mail an {customer.email} senden</label> : null}
        </div>
        {a ? (
          <div className="stack" style={{ marginTop: 16, gap: 8 }}>
            <div className="row small muted">
              <span>Erinnerung: {a.reminderSentAt ? `gesendet ${fmtDateTime(a.reminderSentAt)}` : a.reminderError ? <span style={{ color: 'var(--warn)' }}>{a.reminderError}</span> : 'noch nicht gesendet (automatisch 2 Tage vorher per E-Mail)'}</span>
              {a.confirmationSentAt ? <span>· Bestätigung gesendet {fmtDateTime(a.confirmationSentAt)}</span> : null}
            </div>
            <div className="row">
              {customer?.email ? <Button type="button" size="sm" onClick={() => remind.mutate()} loading={remind.isPending}><Send /> Erinnerung jetzt per E-Mail</Button> : null}
              {detail.data?.whatsappUrl ? <a className="btn sm" href={detail.data.whatsappUrl} target="_blank" rel="noreferrer" onClick={() => logWa.mutate()}><MessageCircle /> Per WhatsApp erinnern</a> : null}
              {a.orderId ? <Link className="btn sm" to={`/auftraege/${a.orderId}`}><ClipboardList /> Zum Auftrag</Link> : customer && can('orders:write') ? <Button type="button" size="sm" onClick={() => { onClose(); navigate(`/auftraege/neu?customerId=${customer.id}&vehicleId=${f.vehicleId ?? ''}&appointmentId=${a.id}&title=${encodeURIComponent(f.title)}`); }}><ClipboardList /> Auftrag anlegen</Button> : null}
              {customer ? <Link className="btn sm ghost" to={`/kunden/${customer.id}`} onClick={onClose}>Kundenakte</Link> : null}
            </div>
          </div>
        ) : null}
        <div className="form-actions">
          {a ? <Button type="button" variant="danger" onClick={() => setRemove(true)} style={{ marginRight: 'auto' }}><Trash2 /></Button> : null}
          <Button type="button" onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="primary" loading={save.isPending}>{a ? 'Speichern' : 'Anlegen'}</Button>
        </div>
      </form>
      {remove ? <Confirm title="Termin löschen?" text="Der Termin wird entfernt. Die Kundenhistorie bleibt erhalten." confirmLabel="Löschen" danger loading={doDelete.isPending} onConfirm={() => doDelete.mutate()} onClose={() => setRemove(false)} /> : null}
    </Modal>
  );
}
