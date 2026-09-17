import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Repeat } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { get, post, patch, del, qs } from '../api/client';
import type { Expense, FinanceOverview, RecurringExpense } from '../api/types';
import { useAuth } from '../app/auth';
import { Badge, Button, Card, Confirm, Empty, Field, Input, Kpi, Modal, PageHead, Select, Skeleton, Tabs, Textarea, useToast } from '../components/ui';
import { fmtDate, fmtMoney, inputFromCents, centsFromInput, toDateInput, HINT_KIND, INTERVAL_LABEL, PAY_METHOD_ALL } from '../lib/format';

type Period = 'day' | 'week' | 'month' | 'quarter' | 'year';
const CATEGORIES = ['Material', 'Miete', 'Software', 'Versicherung', 'Telefon/Internet', 'Strom/Wasser', 'Leasing/Fahrzeug', 'Marketing', 'Personal', 'Steuern/Abgaben', 'Werkzeug/Ausstattung', 'Reparatur/Wartung', 'Fortbildung', 'Sonstiges'];

function shift(date: string, period: Period, n: number): string {
  const d = new Date(date + 'T00:00:00');
  if (period === 'day') d.setDate(d.getDate() + n);
  else if (period === 'week') d.setDate(d.getDate() + 7 * n);
  else if (period === 'month') d.setMonth(d.getMonth() + n, 1);
  else if (period === 'quarter') d.setMonth(d.getMonth() + 3 * n, 1);
  else d.setFullYear(d.getFullYear() + n, 0, 1);
  return toDateInput(d);
}

export function FinancePage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'overview' | 'expenses' | 'recurring'>('overview');
  const [period, setPeriod] = useState<Period>('month');
  const [date, setDate] = useState(toDateInput(new Date()));
  const ov = useQuery({ queryKey: ['finance', period, date], queryFn: () => get<FinanceOverview>(`/api/finance/overview${qs({ period, date })}`) });
  const d = ov.data;
  const delta = (cur: number, prev: number) => (prev ? `${cur - prev >= 0 ? '+' : ''}${Math.round(((cur - prev) / Math.abs(prev)) * 100)} % zur Vorperiode` : 'keine Vorperiode');
  return (
    <>
      <PageHead title="Finanzen" sub="Einnahmen aus Rechnungen, Ausgaben, Gewinn und Liquidität. Alle Beträge netto, sofern nicht anders angegeben." actions={can('finance:write') ? <Button variant="primary" onClick={() => setTab('expenses')}><Plus /> Ausgabe</Button> : null} />
      <Tabs value={tab} onChange={setTab} items={[{ id: 'overview', label: 'Übersicht' }, { id: 'expenses', label: 'Ausgaben' }, { id: 'recurring', label: 'Wiederkehrende Kosten' }]} />
      {tab === 'overview' ? (
        <div className="stack" style={{ gap: 16 }}>
          <Card tight>
            <div className="cal-head">
              <div className="row"><Button size="sm" onClick={() => setDate(shift(date, period, -1))}><ChevronLeft /></Button><Button size="sm" onClick={() => setDate(toDateInput(new Date()))}>Heute</Button><Button size="sm" onClick={() => setDate(shift(date, period, 1))}><ChevronRight /></Button></div>
              <div className="title">{d?.range.label ?? '…'}</div>
              <div className="seg">{(['day', 'week', 'month', 'quarter', 'year'] as Period[]).map((p) => <button key={p} className={period === p ? 'active' : ''} onClick={() => setPeriod(p)}>{{ day: 'Tag', week: 'Woche', month: 'Monat', quarter: 'Quartal', year: 'Jahr' }[p]}</button>)}</div>
            </div>
          </Card>
          {ov.isLoading || !d ? <Card><Skeleton /></Card> : (
            <>
              <div className="grid cols-4">
                <Kpi label="Umsatz (netto)" value={fmtMoney(d.revenueNetCents)} accent delta={`${d.invoiceCount} Rechnungen · brutto ${fmtMoney(d.revenueGrossCents)} · ${delta(d.revenueNetCents, d.previous.revenueNetCents)}`} />
                <Kpi label="Kosten (netto)" value={fmtMoney(d.expensesNetCents)} delta={`${d.expenseCount} Buchungen · ${delta(d.expensesNetCents, d.previous.expensesNetCents)}`} />
                <Kpi label="Gewinn (netto, vor Steuern)" value={fmtMoney(d.profitNetCents)} tone={d.profitNetCents >= 0 ? 'up' : 'down'} delta={d.marginPct === null ? 'keine Umsätze' : `Marge ${d.marginPct} %`} />
                <Kpi label="Liquidität (Zahlungsfluss)" value={fmtMoney(d.cashflowCents)} tone={d.cashflowCents >= 0 ? 'up' : 'down'} delta={`Eingänge ${fmtMoney(d.paymentsInCents)} · Ausgänge ${fmtMoney(d.expensesPaidCents)}`} />
              </div>
              <div className="grid cols-3">
                <Kpi label="Offene Forderungen" value={fmtMoney(d.openReceivablesCents)} />
                <Kpi label="Offene Verbindlichkeiten" value={fmtMoney(d.openPayablesCents)} />
                <Kpi label="USt-Saldo (Schätzung)" value={fmtMoney(d.vatBalanceCents)} delta="vereinnahmt minus Vorsteuer" />
              </div>
              <div className="grid main-side">
                <Card title="Umsatz und Kosten im Verlauf">
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer>
                      <BarChart data={d.series.map((s) => ({ name: s.label, Umsatz: s.revenueNetCents / 100, Kosten: s.expensesNetCents / 100 }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="var(--line)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: 'var(--fg-muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fill: 'var(--fg-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={60} tickFormatter={(v: number) => `${v.toLocaleString('de-DE')} €`} />
                        <Tooltip cursor={{ fill: 'var(--bg-hover)' }} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--line-strong)', borderRadius: 8, color: 'var(--fg)' }} formatter={(v) => fmtMoney(Math.round(Number(v ?? 0) * 100))} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="Umsatz" fill="var(--brand)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Kosten" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <div className="stack" style={{ gap: 16 }}>
                  <Card title="Hinweise">
                    {d.hints.length === 0 ? <p className="muted">Keine Hinweise.</p> : <div className="hint-list">{d.hints.map((h, i) => <div key={i} className={`hint ${h.level}`}><span className="tag">{HINT_KIND[h.kind]}</span><span>{h.text}</span></div>)}</div>}
                    <p className="small dim" style={{ marginTop: 10 }}>Schätzungen ersetzen keine Steuerberatung.</p>
                  </Card>
                  <Card title="Kosten nach Kategorie">
                    {d.byCategory.length === 0 ? <p className="muted">Keine Ausgaben in der Periode.</p> : <div className="stack" style={{ gap: 8 }}>{d.byCategory.map((c) => { const pct = d.expensesNetCents ? Math.round((c.netCents / d.expensesNetCents) * 100) : 0; return <div key={c.category}><div className="spread small"><span>{c.category}</span><span className="muted">{fmtMoney(c.netCents)} · {pct} %</span></div><div style={{ height: 6, background: 'var(--bg-hover)', borderRadius: 4, marginTop: 4 }}><div style={{ width: `${pct}%`, height: '100%', background: '#60a5fa', borderRadius: 4 }} /></div></div>; })}</div>}
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
      {tab === 'expenses' ? <ExpensesTab /> : null}
      {tab === 'recurring' ? <RecurringTab /> : null}
    </>
  );
}

function ExpensesTab() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [from, setFrom] = useState(toDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [to, setTo] = useState(toDateInput(new Date()));
  const [category, setCategory] = useState('');
  const [edit, setEdit] = useState<Partial<Expense> | null>(null);
  const [remove, setRemove] = useState<Expense | null>(null);
  const q = useQuery({ queryKey: ['expenses', from, to, category], queryFn: () => get<{ items: Expense[]; total: number; sumNetCents: number; sumGrossCents: number }>(`/api/expenses${qs({ from, to, category, pageSize: 200 })}`) });
  const doDelete = useMutation({ mutationFn: (id: string) => del(`/api/expenses/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['finance'] }); toast.ok('Ausgabe gelöscht'); setRemove(null); }, onError: (e) => toast.fromError(e) });
  return (
    <Card tight title="Ausgaben" actions={can('finance:write') ? <Button size="sm" variant="primary" onClick={() => setEdit({ date: toDateInput(new Date()), vatBp: 1900, isPaid: true, paymentMethod: 'transfer', category: 'Material' })}><Plus /> Ausgabe erfassen</Button> : null}>
      <div className="toolbar"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 'auto' }} /><span className="muted">bis</span><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 'auto' }} /><Select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Alle Kategorien</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>{q.data ? <span className="muted small" style={{ marginLeft: 'auto' }}>{q.data.total} Buchungen · netto {fmtMoney(q.data.sumNetCents)} · brutto {fmtMoney(q.data.sumGrossCents)}</span> : null}</div>
      {q.isLoading ? <Skeleton /> : q.data?.items.length === 0 ? <Empty title="Keine Ausgaben im Zeitraum" /> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Datum</th><th>Beschreibung</th><th className="hide-mobile">Kategorie</th><th className="num">Netto</th><th className="num hide-mobile">MwSt.</th><th className="num">Brutto</th><th>Status</th><th></th></tr></thead>
          <tbody>{q.data?.items.map((e) => (
            <tr key={e.id}>
              <td className="muted">{fmtDate(e.date)}</td><td><div className="primary">{e.description}</div><div className="secondary">{[e.vendor, e.recurringExpenseId ? 'wiederkehrend' : null].filter(Boolean).join(' · ')}</div></td><td className="hide-mobile muted">{e.category}</td>
              <td className="num">{fmtMoney(e.netCents)}</td><td className="num hide-mobile muted">{fmtMoney(e.vatCents)}</td><td className="num">{fmtMoney(e.grossCents)}</td>
              <td>{e.isPaid ? <Badge tone="ok">bezahlt</Badge> : <Badge tone="warn">offen</Badge>}</td>
              <td className="num">{can('finance:write') ? <div className="row" style={{ justifyContent: 'flex-end' }}><Button size="sm" variant="ghost" onClick={() => setEdit(e)}><Pencil /></Button><Button size="sm" variant="ghost" onClick={() => setRemove(e)}><Trash2 /></Button></div> : null}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {edit ? <ExpenseModal expense={edit} onClose={() => setEdit(null)} /> : null}
      {remove ? <Confirm title="Ausgabe löschen?" text={`„${remove.description}“ wird gelöscht.`} confirmLabel="Löschen" danger loading={doDelete.isPending} onConfirm={() => doDelete.mutate(remove.id)} onClose={() => setRemove(null)} /> : null}
    </Card>
  );
}

function ExpenseModal({ expense, onClose }: { expense: Partial<Expense>; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ date: expense.date ?? toDateInput(new Date()), category: expense.category ?? 'Material', description: expense.description ?? '', vendor: expense.vendor ?? '', gross: inputFromCents(expense.grossCents ?? 0) || '', vatBp: String(expense.vatBp ?? 1900), paymentMethod: expense.paymentMethod ?? 'transfer', isPaid: expense.isPaid ?? true, dueDate: expense.dueDate ?? '', notes: expense.notes ?? '' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const m = useMutation({
    mutationFn: () => { const p = { date: f.date, category: f.category, description: f.description, vendor: f.vendor || null, grossCents: centsFromInput(f.gross || '0'), vatBp: Number(f.vatBp), paymentMethod: f.paymentMethod, isPaid: f.isPaid, dueDate: f.dueDate || null, notes: f.notes || null }; return expense.id ? patch(`/api/expenses/${expense.id}`, p) : post('/api/expenses', p); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['finance'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.ok('Ausgabe gespeichert'); onClose(); },
    onError: (e) => toast.fromError(e),
  });
  const gross = centsFromInput(f.gross || '0'); const net = Math.round((gross * 10000) / (10000 + Number(f.vatBp)));
  return (
    <Modal title={expense.id ? 'Ausgabe bearbeiten' : 'Ausgabe erfassen'} onClose={onClose}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); m.mutate(); }}>
        <div className="form-grid">
          <Field label="Belegdatum"><Input type="date" required value={f.date} onChange={set('date')} /></Field>
          <Field label="Kategorie"><Select value={f.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Beschreibung *" className="span-2"><Input required value={f.description} onChange={set('description')} placeholder="z. B. Poliermittel 5 L" /></Field>
          <Field label="Lieferant / Empfänger" className="span-2"><Input value={f.vendor} onChange={set('vendor')} /></Field>
          <Field label="Bruttobetrag (€)" hint={`netto ${fmtMoney(net)} · MwSt. ${fmtMoney(gross - net)}`}><Input inputMode="decimal" required value={f.gross} onChange={set('gross')} /></Field>
          <Field label="MwSt.-Satz"><Select value={f.vatBp} onChange={set('vatBp')}><option value="1900">19 %</option><option value="700">7 %</option><option value="0">0 % / ohne Vorsteuer</option></Select></Field>
          <Field label="Zahlungsart"><Select value={f.paymentMethod} onChange={set('paymentMethod')}>{Object.entries(PAY_METHOD_ALL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Fällig am (falls offen)"><Input type="date" value={f.dueDate} onChange={set('dueDate')} disabled={f.isPaid} /></Field>
          <label className="check span-2"><input type="checkbox" checked={f.isPaid} onChange={(e) => setF({ ...f, isPaid: e.target.checked })} /> bereits bezahlt</label>
          <Field label="Notizen" className="span-2"><Textarea value={f.notes} onChange={set('notes')} /></Field>
        </div>
        <div className="form-actions"><Button type="button" onClick={onClose}>Abbrechen</Button><Button type="submit" variant="primary" loading={m.isPending}>Speichern</Button></div>
      </form>
    </Modal>
  );
}

function RecurringTab() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['recurring'], queryFn: () => get<{ items: RecurringExpense[]; monthlyNetCents: number }>('/api/recurring-expenses') });
  const [edit, setEdit] = useState<Partial<RecurringExpense> | null>(null);
  const deactivate = useMutation({ mutationFn: (id: string) => del(`/api/recurring-expenses/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['recurring'] }); toast.ok('Beendet'); }, onError: (e) => toast.fromError(e) });
  return (
    <Card tight title="Wiederkehrende Kosten" actions={<div className="row">{q.data ? <span className="muted small">≈ {fmtMoney(q.data.monthlyNetCents)} netto pro Monat</span> : null}{can('finance:write') ? <Button size="sm" variant="primary" onClick={() => setEdit({ interval: 'monthly', vatBp: 1900, autoPaid: true, category: 'Miete', startDate: toDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) })}><Plus /> Anlegen</Button> : null}</div>}>
      <p className="muted small" style={{ padding: '10px 14px 0' }}>Einmal eintragen – die Buchungen werden automatisch zum Fälligkeitstag als Ausgabe erzeugt (Miete, Software, Versicherung, Leasing …).</p>
      {q.isLoading ? <Skeleton /> : q.data?.items.length === 0 ? <Empty title="Keine wiederkehrenden Kosten" /> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Bezeichnung</th><th className="hide-mobile">Kategorie</th><th className="num">Netto</th><th className="num hide-mobile">Brutto</th><th>Intervall</th><th className="hide-mobile">Nächste Buchung</th><th>Status</th><th></th></tr></thead>
          <tbody>{q.data?.items.map((r) => (
            <tr key={r.id}>
              <td><div className="primary">{r.name}</div><div className="secondary">{r.vendor ?? ''}</div></td><td className="hide-mobile muted">{r.category}</td><td className="num">{fmtMoney(r.netCents)}</td><td className="num hide-mobile muted">{fmtMoney(r.netCents + Math.round((r.netCents * r.vatBp) / 10000))}</td>
              <td><span className="row"><Repeat size={13} /> {INTERVAL_LABEL[r.interval]}</span></td><td className="hide-mobile muted">{fmtDate(r.nextDate)}</td><td>{r.isActive ? <Badge tone="ok">aktiv</Badge> : <Badge>beendet</Badge>}</td>
              <td className="num">{can('finance:write') ? <div className="row" style={{ justifyContent: 'flex-end' }}><Button size="sm" variant="ghost" onClick={() => setEdit(r)}><Pencil /></Button>{r.isActive ? <Button size="sm" variant="ghost" onClick={() => deactivate.mutate(r.id)}>Beenden</Button> : null}</div> : null}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {edit ? <RecurringModal rec={edit} onClose={() => setEdit(null)} /> : null}
    </Card>
  );
}

function RecurringModal({ rec, onClose }: { rec: Partial<RecurringExpense>; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ name: rec.name ?? '', category: rec.category ?? 'Miete', vendor: rec.vendor ?? '', net: inputFromCents(rec.netCents ?? 0) || '', vatBp: String(rec.vatBp ?? 1900), interval: rec.interval ?? 'monthly', startDate: rec.startDate ?? toDateInput(new Date()), endDate: rec.endDate ?? '', paymentMethod: rec.paymentMethod ?? 'transfer', autoPaid: rec.autoPaid ?? true, notes: rec.notes ?? '' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const m = useMutation({
    mutationFn: () => { const p = { name: f.name, category: f.category, vendor: f.vendor || null, netCents: centsFromInput(f.net || '0'), vatBp: Number(f.vatBp), interval: f.interval, startDate: f.startDate, endDate: f.endDate || null, paymentMethod: f.paymentMethod, autoPaid: f.autoPaid, notes: f.notes || null }; return rec.id ? patch(`/api/recurring-expenses/${rec.id}`, p) : post('/api/recurring-expenses', p); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recurring'] }); qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['finance'] }); toast.ok('Gespeichert'); onClose(); },
    onError: (e) => toast.fromError(e),
  });
  return (
    <Modal title={rec.id ? 'Wiederkehrende Kosten bearbeiten' : 'Wiederkehrende Kosten anlegen'} onClose={onClose}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); m.mutate(); }}>
        <div className="form-grid">
          <Field label="Bezeichnung *" className="span-2"><Input required value={f.name} onChange={set('name')} placeholder="z. B. Miete Halle, Software-Abo" /></Field>
          <Field label="Kategorie"><Select value={f.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Empfänger"><Input value={f.vendor} onChange={set('vendor')} /></Field>
          <Field label="Nettobetrag (€)"><Input inputMode="decimal" required value={f.net} onChange={set('net')} /></Field>
          <Field label="MwSt.-Satz"><Select value={f.vatBp} onChange={set('vatBp')}><option value="1900">19 %</option><option value="700">7 %</option><option value="0">0 %</option></Select></Field>
          <Field label="Intervall"><Select value={f.interval} onChange={set('interval')}>{Object.entries(INTERVAL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Zahlungsart"><Select value={f.paymentMethod} onChange={set('paymentMethod')}>{Object.entries(PAY_METHOD_ALL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Erste Buchung am"><Input type="date" required value={f.startDate} onChange={set('startDate')} /></Field>
          <Field label="Ende (optional)"><Input type="date" value={f.endDate} onChange={set('endDate')} /></Field>
          <label className="check span-2"><input type="checkbox" checked={f.autoPaid} onChange={(e) => setF({ ...f, autoPaid: e.target.checked })} /> Buchungen automatisch als bezahlt markieren (z. B. Lastschrift/Dauerauftrag)</label>
          <Field label="Notizen" className="span-2"><Textarea value={f.notes} onChange={set('notes')} /></Field>
        </div>
        <div className="form-actions"><Button type="button" onClick={onClose}>Abbrechen</Button><Button type="submit" variant="primary" loading={m.isPending}>Speichern</Button></div>
      </form>
    </Modal>
  );
}
