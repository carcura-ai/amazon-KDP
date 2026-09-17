import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Check, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { del, get, patch, post, qs } from '../api/client';
import type { Customer, Paged, Task, TaskStats } from '../api/types';
import { useAuth } from '../app/auth';
import { Badge, Button, Card, Confirm, Empty, Field, Input, Modal, PageHead, Pager, Select, Skeleton, Tabs, Textarea, useToast } from '../components/ui';
import { CustomerPicker, UserSelect } from '../components/pickers';
import { fmtDateTime, fmtRelative, toLocalInput, fromLocalInput } from '../lib/format';

const PRIORITY: Record<string, { label: string; tone: string }> = { high: { label: 'Hoch', tone: 'danger' }, normal: { label: 'Normal', tone: '' }, low: { label: 'Niedrig', tone: 'info' } };
type View = 'today' | 'open' | 'overdue' | 'week' | 'done';

export function TasksPage() {
  const { can } = useAuth();
  const [view, setView] = useState<View>('open');
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<Partial<Task> | null>(null);
  const [remove, setRemove] = useState<Task | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['tasks', view, page], queryFn: () => get<Paged<Task> & { stats: TaskStats }>(`/api/tasks${qs({ view, page, pageSize: 50 })}`) });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['tasks'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };
  const toggle = useMutation({ mutationFn: (t: Task) => patch<Task>(`/api/tasks/${t.id}`, { status: t.status === 'done' ? 'open' : 'done' }), onSuccess: (t) => { invalidate(); toast.ok(t.status === 'done' ? 'Aufgabe erledigt' : 'Aufgabe wieder geöffnet'); }, onError: (e) => toast.fromError(e) });
  const doDelete = useMutation({ mutationFn: (id: string) => del(`/api/tasks/${id}`), onSuccess: () => { invalidate(); setRemove(null); toast.ok('Aufgabe gelöscht'); }, onError: (e) => toast.fromError(e) });
  const s = q.data?.stats;
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  return (
    <>
      <PageHead title="Aufgaben" sub="Rückrufe, Nachfassen, Bestellungen, Erinnerungen – mit Fälligkeit, Priorität und Bezug zu Kunde, Lead oder Auftrag." actions={can('tasks:write') ? <Button variant="primary" onClick={() => setEdit({ priority: 'normal' })}><Plus /> Aufgabe</Button> : null} />
      <Tabs value={view} onChange={(v) => { setView(v); setPage(1); }} items={[{ id: 'open', label: `Offen${s ? ` (${s.open})` : ''}` }, { id: 'today', label: `Heute${s ? ` (${s.dueToday})` : ''}` }, { id: 'overdue', label: <span style={s?.overdue ? { color: 'var(--danger)' } : undefined}>Überfällig{s ? ` (${s.overdue})` : ''}</span> }, { id: 'week', label: 'Nächste 7 Tage' }, { id: 'done', label: 'Erledigt' }]} />
      <Card tight>
        {q.isLoading ? <Skeleton /> : q.data?.items.length === 0 ? <Empty title={view === 'done' ? 'Noch nichts erledigt' : view === 'overdue' ? 'Nichts überfällig' : 'Keine Aufgaben'} text={view === 'open' ? 'Aufgaben entstehen manuell oder aus Kunden-, Lead- und Auftragsakten.' : undefined} action={can('tasks:write') && view !== 'done' ? <Button variant="primary" onClick={() => setEdit({ priority: 'normal' })}><Plus /> Aufgabe anlegen</Button> : undefined} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th style={{ width: 44 }}></th><th>Aufgabe</th><th>Fällig</th><th className="hide-mobile">Bezug</th><th className="hide-mobile">Zuständig</th><th>Priorität</th><th></th></tr></thead>
            <tbody>{q.data?.items.map((t) => {
              const overdue = t.status === 'open' && t.dueAt && new Date(t.dueAt).getTime() < startOfToday;
              return (
                <tr key={t.id} style={t.status === 'done' ? { opacity: 0.6 } : undefined}>
                  <td>{can('tasks:write') ? <button type="button" className={`btn icon sm ${t.status === 'done' ? 'primary' : 'ghost'}`} title={t.status === 'done' ? 'Wieder öffnen' : 'Erledigt'} aria-label="Status wechseln" onClick={() => toggle.mutate(t)} style={{ border: '1px solid var(--line)' }}>{t.status === 'done' ? <RotateCcw size={14} /> : <Check size={14} />}</button> : null}</td>
                  <td><div className="primary" style={t.status === 'done' ? { textDecoration: 'line-through' } : undefined}>{t.title}</div>{t.description ? <div className="secondary" style={{ whiteSpace: 'pre-wrap' }}>{t.description.length > 140 ? `${t.description.slice(0, 140)}…` : t.description}</div> : null}</td>
                  <td style={overdue ? { color: 'var(--danger)', fontWeight: 600 } : undefined}>{t.status === 'done' ? <span className="muted">erledigt {fmtRelative(t.completedAt)}</span> : t.dueAt ? <>{fmtDateTime(t.dueAt)}<div className="small muted">{fmtRelative(t.dueAt)}</div></> : <span className="dim">–</span>}</td>
                  <td className="hide-mobile small">{t.customerId ? <Link to={`/kunden/${t.customerId}`}>{t.customerName ?? 'Kunde'}</Link> : t.leadId ? <Link to={`/leads/${t.leadId}`}>Lead {t.leadName ?? ''}</Link> : t.orderId ? <Link to={`/auftraege/${t.orderId}`}>Auftrag {t.orderNumber ?? ''}</Link> : <span className="dim">–</span>}{t.vehiclePlate ? <div className="muted">{t.vehiclePlate}</div> : null}</td>
                  <td className="hide-mobile muted">{t.assignedName ?? '–'}</td>
                  <td><Badge tone={PRIORITY[t.priority]?.tone}>{PRIORITY[t.priority]?.label ?? t.priority}</Badge></td>
                  <td className="num">{can('tasks:write') ? <div className="row" style={{ justifyContent: 'flex-end' }}><Button size="sm" variant="ghost" onClick={() => setEdit(t)} aria-label="Bearbeiten"><Pencil /></Button><Button size="sm" variant="ghost" onClick={() => setRemove(t)} aria-label="Löschen"><Trash2 /></Button></div> : null}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
        {q.data && q.data.total > q.data.pageSize ? <Pager page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} /> : null}
      </Card>
      {edit ? <TaskForm task={edit} onClose={() => setEdit(null)} onSaved={() => { invalidate(); setEdit(null); }} /> : null}
      {remove ? <Confirm title="Aufgabe löschen?" text={`„${remove.title}“ wird endgültig entfernt.`} confirmLabel="Löschen" danger loading={doDelete.isPending} onConfirm={() => doDelete.mutate(remove.id)} onClose={() => setRemove(null)} /> : null}
    </>
  );
}

/** Formular für neue und bestehende Aufgaben; optional mit festem Bezug (Kunde/Lead/Auftrag) aus der jeweiligen Akte. */
export function TaskForm({ task, fixed, onClose, onSaved }: { task: Partial<Task>; fixed?: { customerId?: string; leadId?: string; orderId?: string; vehicleId?: string }; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Partial<Task>>({ ...task, ...fixed });
  const [customer, setCustomer] = useState<Customer | null>(task.customerId && task.customerName ? ({ id: task.customerId, firstName: task.customerName, lastName: '', companyName: null } as unknown as Customer) : null);
  const m = useMutation({
    mutationFn: () => {
      const payload = { title: f.title, description: f.description || null, priority: f.priority ?? 'normal', dueAt: f.dueAt ?? null, assignedUserId: f.assignedUserId ?? null, customerId: f.customerId ?? null, leadId: f.leadId ?? null, orderId: f.orderId ?? null, vehicleId: f.vehicleId ?? null };
      return f.id ? patch<Task>(`/api/tasks/${f.id}`, payload) : post<Task>('/api/tasks', payload);
    },
    onSuccess: () => { toast.ok(f.id ? 'Aufgabe gespeichert' : 'Aufgabe angelegt'); onSaved(); },
    onError: (e) => toast.fromError(e),
  });
  const quick = (days: number, hour = 9) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); setF({ ...f, dueAt: d.toISOString() }); };
  return (
    <Modal title={f.id ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'} onClose={onClose}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); m.mutate(); }}>
        <div className="form-grid">
          <Field label="Aufgabe *" className="span-2"><Input required autoFocus value={f.title ?? ''} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="z. B. Kunde wegen Angebot anrufen" /></Field>
          <Field label="Fällig am" hint="Leer = ohne Termin"><Input type="datetime-local" value={f.dueAt ? toLocalInput(f.dueAt) : ''} onChange={(e) => setF({ ...f, dueAt: e.target.value ? fromLocalInput(e.target.value) : null })} /></Field>
          <Field label="Schnellwahl"><div className="row"><Button type="button" size="sm" onClick={() => quick(0, 17)}>Heute</Button><Button type="button" size="sm" onClick={() => quick(1)}>Morgen</Button><Button type="button" size="sm" onClick={() => quick(7)}>In 1 Woche</Button></div></Field>
          <Field label="Priorität"><Select value={f.priority ?? 'normal'} onChange={(e) => setF({ ...f, priority: e.target.value as Task['priority'] })}><option value="high">Hoch</option><option value="normal">Normal</option><option value="low">Niedrig</option></Select></Field>
          <Field label="Zuständig"><UserSelect value={f.assignedUserId ?? null} onChange={(id) => setF({ ...f, assignedUserId: id })} /></Field>
          {!fixed?.customerId && !fixed?.leadId && !fixed?.orderId ? <Field label="Kunde (optional)" className="span-2"><CustomerPicker value={customer} onChange={(c) => { setCustomer(c); setF({ ...f, customerId: c?.id ?? null }); }} /></Field> : null}
          <Field label="Details" className="span-2"><Textarea value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        </div>
        <div className="form-actions"><Button type="button" onClick={onClose}>Abbrechen</Button><Button type="submit" variant="primary" loading={m.isPending}>{f.id ? 'Speichern' : 'Anlegen'}</Button></div>
      </form>
    </Modal>
  );
}

/** Kompakte Aufgabenliste für Kunden-, Lead- und Auftragsakten. */
export function TaskPanel({ filter }: { filter: { customerId?: string; leadId?: string; orderId?: string } }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [add, setAdd] = useState(false);
  const key = ['tasks', 'panel', filter.customerId ?? filter.leadId ?? filter.orderId ?? ''];
  const q = useQuery({ queryKey: key, queryFn: () => get<Paged<Task>>(`/api/tasks${qs({ view: 'all', ...filter, pageSize: 20 })}`) });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['tasks'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };
  const toggle = useMutation({ mutationFn: (t: Task) => patch<Task>(`/api/tasks/${t.id}`, { status: t.status === 'done' ? 'open' : 'done' }), onSuccess: invalidate, onError: (e) => toast.fromError(e) });
  const items = (q.data?.items ?? []).filter((t) => t.status === 'open').slice(0, 8);
  return (
    <Card title="Aufgaben" tight actions={can('tasks:write') ? <Button size="sm" onClick={() => setAdd(true)}><Plus /> Aufgabe</Button> : null}>
      {q.isLoading ? <Skeleton rows={2} /> : items.length === 0 ? <p className="muted" style={{ padding: 14 }}>Keine offenen Aufgaben.</p> : items.map((t) => (
        <div key={t.id} className="doc-row">
          {can('tasks:write') ? <button type="button" className="btn icon sm ghost" style={{ border: '1px solid var(--line)' }} onClick={() => toggle.mutate(t)} aria-label="Erledigt"><Check size={14} /></button> : null}
          <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontWeight: 600 }}>{t.title}</div><div className="small muted">{t.dueAt ? fmtDateTime(t.dueAt) : 'ohne Termin'}{t.assignedName ? ` · ${t.assignedName}` : ''}</div></div>
          <Badge tone={PRIORITY[t.priority]?.tone}>{PRIORITY[t.priority]?.label}</Badge>
        </div>
      ))}
      {add ? <TaskForm task={{ priority: 'normal' }} fixed={filter} onClose={() => setAdd(false)} onSaved={() => { invalidate(); setAdd(false); }} /> : null}
    </Card>
  );
}
