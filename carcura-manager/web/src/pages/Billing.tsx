import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { Download, Plus, FileDown, Send, Check, X, ArrowRight, Trash2, Pencil, Banknote, Ban, Receipt } from 'lucide-react';
import { get, post, patch, del, qs } from '../api/client';
import type { Customer, OfferDetail, OfferRow, InvoiceDetail, InvoiceRow, InvoiceStats, Paged, Payment } from '../api/types';
import { useAuth } from '../app/auth';
import { Badge, Button, Card, Confirm, Empty, Field, Input, Modal, PageHead, Pager, Select, Skeleton, Textarea, useDebounced, useToast, Kpi } from '../components/ui';
import { CustomerPicker, VehicleSelect } from '../components/pickers';
import { LineItemsEditor, ServiceCatalog, addServiceTo, draftsFrom, emptyItem, payloadFrom, type ItemDraft } from '../components/lineItems';
import { fmtDate, fmtDateTime, fmtMoney, personName, OFFER_STATUS, INVOICE_STATUS, PAYMENT_METHOD, toDateInput } from '../lib/format';

/* ================================================================= Versand-Dialog */
function SendModal({ kind, id, customer, onClose, onSent }: { kind: 'offers' | 'invoices'; id: string; customer: Customer | null; onClose: () => void; onSent: () => void }) {
  const toast = useToast();
  const [to, setTo] = useState(customer?.email ?? '');
  const [message, setMessage] = useState('');
  const m = useMutation({ mutationFn: () => post(`/api/${kind}/${id}/send`, { to, ...(message ? { message } : {}) }), onSuccess: () => { toast.ok('Per E-Mail gesendet', `an ${to}`); onSent(); onClose(); }, onError: (e) => toast.fromError(e, 'Versand fehlgeschlagen') });
  return (
    <Modal title={kind === 'offers' ? 'Angebot per E-Mail senden' : 'Rechnung per E-Mail senden'} onClose={onClose}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); m.mutate(); }} className="stack">
        <Field label="Empfänger"><Input type="email" required value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Nachricht (leer = Standardtext)"><Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Optionaler eigener Text. Das PDF wird automatisch angehängt." /></Field>
        <div className="form-actions"><Button type="button" onClick={onClose}>Abbrechen</Button><Button type="submit" variant="primary" loading={m.isPending}><Send /> Senden</Button></div>
      </form>
    </Modal>
  );
}

/* ================================================================= Angebote */
export function OffersPage() {
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const navigate = useNavigate();
  const list = useQuery({ queryKey: ['offers', { dq, status, page }], queryFn: () => get<Paged<OfferRow>>(`/api/offers${qs({ q: dq, status, page, pageSize: 50 })}`) });
  return (
    <>
      <PageHead title="Angebote" sub="Angebote erstellen, versenden und in Aufträge oder Rechnungen überführen." actions={can('offers:write') ? <Link className="btn primary" to="/angebote/neu"><Plus /> Angebot</Link> : null} />
      <Card tight>
        <div className="toolbar"><input type="search" placeholder="Nummer, Kunde, Titel …" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /><Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Alle Status</option>{Object.entries(OFFER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></div>
        {list.isLoading ? <Skeleton rows={6} /> : list.data && list.data.items.length === 0 ? <Empty title="Keine Angebote" /> : (
          <><div className="table-wrap"><table className="table">
            <thead><tr><th>Nummer</th><th>Kunde</th><th className="hide-mobile">Titel</th><th>Status</th><th className="num">Summe</th><th className="hide-mobile">Datum</th><th className="hide-mobile">Gültig bis</th></tr></thead>
            <tbody>{list.data?.items.map(({ offer: o, customer: c }) => (
              <tr key={o.id} className="row-link" onClick={() => navigate(`/angebote/${o.id}`)}>
                <td className="mono">{o.offerNumber}</td><td><div className="primary">{personName(c)}</div><div className="secondary mono">{c.customerNumber}</div></td><td className="hide-mobile muted">{o.title ?? '–'}</td>
                <td><Badge tone={OFFER_STATUS[o.status]?.tone}>{OFFER_STATUS[o.status]?.label}</Badge></td><td className="num">{fmtMoney(o.totalCents)}</td><td className="hide-mobile muted">{fmtDate(o.issueDate)}</td><td className="hide-mobile muted">{fmtDate(o.validUntil)}</td>
              </tr>
            ))}</tbody>
          </table></div>{list.data ? <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} /> : null}</>
        )}
      </Card>
    </>
  );
}

export function OfferFormPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const existing = useQuery({ queryKey: ['offer', id], queryFn: () => get<OfferDetail>(`/api/offers/${id}`), enabled: editing });
  const preset = useQuery({ queryKey: ['customer', sp.get('customerId')], queryFn: () => get<{ customer: Customer }>(`/api/customers/${sp.get('customerId')}`), enabled: Boolean(sp.get('customerId')) && !editing });
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [f, setF] = useState({ vehicleId: sp.get('vehicleId') || null as string | null, leadId: sp.get('leadId') || null as string | null, title: sp.get('title') ?? '', introText: '', notes: '', issueDate: toDateInput(new Date()), validUntil: toDateInput(new Date(Date.now() + 14 * 86_400_000)) });
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (editing && existing.data && !loaded) { const o = existing.data.offer; setCustomer(existing.data.customer); setF({ vehicleId: o.vehicleId, leadId: o.leadId, title: o.title ?? '', introText: o.introText ?? '', notes: o.notes ?? '', issueDate: o.issueDate, validUntil: o.validUntil ?? '' }); setItems(draftsFrom(existing.data.items)); setLoaded(true); }
    if (!editing && preset.data && !customer) setCustomer(preset.data.customer);
  }, [editing, existing.data, preset.data, loaded, customer]);
  const save = useMutation({
    mutationFn: () => { const payload = { customerId: customer!.id, vehicleId: f.vehicleId, leadId: f.leadId, title: f.title || null, introText: f.introText || null, notes: f.notes || null, issueDate: f.issueDate, validUntil: f.validUntil || null, items: payloadFrom(items) }; return editing ? patch<OfferDetail>(`/api/offers/${id}`, payload) : post<OfferDetail>('/api/offers', payload); },
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['offers'] }); qc.invalidateQueries({ queryKey: ['offer', r.offer.id] }); toast.ok(editing ? 'Angebot gespeichert' : `Angebot ${r.offer.offerNumber} erstellt`); navigate(`/angebote/${r.offer.id}`); },
    onError: (e) => toast.fromError(e),
  });
  if (editing && existing.isLoading) return <Card><Skeleton /></Card>;
  return (
    <>
      <PageHead crumbs={<><Link to="/angebote">Angebote</Link><span>/</span><span>{editing ? existing.data?.offer.offerNumber : 'Neu'}</span></>} title={editing ? `Angebot ${existing.data?.offer.offerNumber} bearbeiten` : 'Neues Angebot'} />
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (!customer) return toast.error('Bitte Kunden wählen.'); if (!payloadFrom(items).length) return toast.error('Mindestens eine Position angeben.'); save.mutate(); }} className="stack" style={{ gap: 16 }}>
        <div className="grid main-side">
          <Card title="Angebotsdaten">
            <div className="form-grid">
              <Field label="Kunde *" className="span-2"><CustomerPicker value={customer} onChange={(c) => { setCustomer(c); setF({ ...f, vehicleId: null }); }} disabled={editing} /></Field>
              <Field label="Fahrzeug"><VehicleSelect customerId={customer?.id ?? null} value={f.vehicleId} onChange={(v) => setF({ ...f, vehicleId: v })} /></Field>
              <Field label="Titel"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="z. B. Komplettaufbereitung + Keramik" /></Field>
              <Field label="Angebotsdatum"><Input type="date" value={f.issueDate} onChange={(e) => setF({ ...f, issueDate: e.target.value })} /></Field>
              <Field label="Gültig bis"><Input type="date" value={f.validUntil} onChange={(e) => setF({ ...f, validUntil: e.target.value })} /></Field>
              <Field label="Einleitungstext (leer = Standard)" className="span-2"><Textarea value={f.introText} onChange={(e) => setF({ ...f, introText: e.target.value })} /></Field>
              <Field label="Hinweise / Bedingungen" className="span-2"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="z. B. Preise inkl. Anfahrt, Terminvereinbarung nach Auftragserteilung" /></Field>
            </div>
          </Card>
          <ServiceCatalog onPick={(s) => addServiceTo(setItems, s)} />
        </div>
        <LineItemsEditor items={items} setItems={setItems} />
        <div className="form-actions"><Button type="button" onClick={() => navigate(-1)}>Abbrechen</Button><Button type="submit" variant="primary" loading={save.isPending}>{editing ? 'Speichern' : 'Angebot erstellen'}</Button></div>
      </form>
    </>
  );
}

export function OfferDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [send, setSend] = useState(false);
  const [remove, setRemove] = useState(false);
  const q = useQuery({ queryKey: ['offer', id], queryFn: () => get<OfferDetail>(`/api/offers/${id}`) });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['offer', id] }); qc.invalidateQueries({ queryKey: ['offers'] }); qc.invalidateQueries({ queryKey: ['leads'] }); };
  const setStatus = useMutation({ mutationFn: (status: string) => post(`/api/offers/${id}/status`, { status }), onSuccess: () => { invalidate(); toast.ok('Status aktualisiert'); }, onError: (e) => toast.fromError(e) });
  const convert = useMutation({ mutationFn: (to: 'order' | 'invoice') => post<{ orderId?: string; invoiceId?: string }>(`/api/offers/${id}/convert`, { to }), onSuccess: (r) => { invalidate(); qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['invoices'] }); toast.ok(r.orderId ? 'Auftrag erstellt' : 'Rechnungsentwurf erstellt'); navigate(r.orderId ? `/auftraege/${r.orderId}` : `/rechnungen/${r.invoiceId}`); }, onError: (e) => toast.fromError(e) });
  const doDelete = useMutation({ mutationFn: () => del(`/api/offers/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['offers'] }); toast.ok('Angebot gelöscht'); navigate('/angebote'); }, onError: (e) => toast.fromError(e) });
  if (q.isLoading) return <Card><Skeleton /></Card>;
  if (!q.data) return <Card><div className="empty"><h3>Angebot nicht gefunden</h3></div></Card>;
  const { offer: o, items, customer, vehicle, totals, invoice, order } = q.data;
  const editable = can('offers:write') && !['accepted', 'rejected'].includes(o.status);
  return (
    <>
      <PageHead crumbs={<><Link to="/angebote">Angebote</Link><span>/</span><span>{o.offerNumber}</span></>} title={<span className="row">{o.offerNumber}<Badge tone={OFFER_STATUS[o.status]?.tone}>{OFFER_STATUS[o.status]?.label}</Badge></span>} sub={o.title ?? undefined}
        actions={<>
          <a className="btn" href={`/api/offers/${id}/pdf`} target="_blank" rel="noreferrer"><FileDown /> PDF</a>
          {can('offers:write') && !['accepted', 'rejected'].includes(o.status) ? <Button variant="primary" onClick={() => setSend(true)}><Send /> Senden</Button> : null}
          {editable ? <Link className="btn" to={`/angebote/${id}/bearbeiten`}><Pencil /> Bearbeiten</Link> : null}
          {can('offers:write') && o.status === 'draft' ? <Button variant="danger" onClick={() => setRemove(true)}><Trash2 /></Button> : null}
        </>} />
      <div className="grid main-side">
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Positionen" tight>
            <div className="table-wrap"><table className="table"><thead><tr><th>Leistung</th><th className="num">Menge</th><th className="num">Einzelpreis</th><th className="num">Gesamt</th></tr></thead>
              <tbody>{items.map((it) => <tr key={it.id}><td><div className="primary">{it.name}</div>{it.description ? <div className="secondary">{it.description}</div> : null}</td><td className="num">{it.quantity}</td><td className="num">{fmtMoney(it.unitPriceCents)}</td><td className="num">{fmtMoney(it.totalCents)}</td></tr>)}</tbody></table></div>
            <div className="row" style={{ padding: 12, justifyContent: 'flex-end' }}><div className="totals"><div className="l"><span className="muted">Netto</span><span>{fmtMoney(totals.subtotalCents)}</span></div>{totals.vatBreakdown.map((v) => <div className="l" key={v.vatBp}><span className="muted">MwSt. {v.vatBp / 100} %</span><span>{fmtMoney(v.vatCents)}</span></div>)}<div className="l total"><span>Gesamt</span><span>{fmtMoney(totals.totalCents)}</span></div></div></div>
          </Card>
          {o.notes ? <Card title="Hinweise"><p style={{ whiteSpace: 'pre-wrap' }}>{o.notes}</p></Card> : null}
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Status">
            {can('offers:write') ? (
              <div className="row">
                {o.status !== 'accepted' ? <Button size="sm" onClick={() => setStatus.mutate('accepted')}><Check /> Angenommen</Button> : null}
                {o.status !== 'rejected' && o.status !== 'accepted' ? <Button size="sm" onClick={() => setStatus.mutate('rejected')}><X /> Abgelehnt</Button> : null}
                {o.status === 'draft' ? <Button size="sm" onClick={() => setStatus.mutate('sent')}>Als versendet markieren</Button> : null}
              </div>
            ) : null}
            <dl className="dl" style={{ marginTop: 12 }}><dt>Datum</dt><dd>{fmtDate(o.issueDate)}</dd><dt>Gültig bis</dt><dd>{fmtDate(o.validUntil)}</dd><dt>Versendet</dt><dd>{fmtDateTime(o.sentAt)}</dd><dt>Angenommen</dt><dd>{fmtDateTime(o.acceptedAt)}</dd></dl>
          </Card>
          <Card title="Weiterverarbeitung">
            <div className="stack" style={{ gap: 8 }}>
              {order ? <Link className="btn" to={`/auftraege/${order.id}`}>Auftrag {order.orderNumber} <ArrowRight /></Link> : can('orders:write') ? <Button onClick={() => convert.mutate('order')} loading={convert.isPending}>Auftrag erstellen <ArrowRight /></Button> : null}
              {invoice ? <Link className="btn" to={`/rechnungen/${invoice.id}`}><Receipt /> Rechnung {invoice.invoiceNumber ?? '(Entwurf)'}</Link> : can('invoices:write') ? <Button onClick={() => convert.mutate('invoice')} loading={convert.isPending}><Receipt /> Rechnung erstellen</Button> : null}
            </div>
          </Card>
          <Card title="Kunde"><dl className="dl"><dt>Kunde</dt><dd>{customer ? <Link to={`/kunden/${customer.id}`}>{personName(customer)}</Link> : '–'}<div className="small dim">{customer?.email ?? 'keine E-Mail'}</div></dd><dt>Fahrzeug</dt><dd>{vehicle ? [vehicle.make, vehicle.model, vehicle.licensePlate].filter(Boolean).join(' ') : '–'}</dd>{o.leadId ? <><dt>Lead</dt><dd><Link to={`/leads/${o.leadId}`}>Zum Lead</Link></dd></> : null}</dl></Card>
        </div>
      </div>
      {send ? <SendModal kind="offers" id={id} customer={customer} onClose={() => setSend(false)} onSent={invalidate} /> : null}
      {remove ? <Confirm title="Angebot löschen?" text="Der Entwurf wird endgültig entfernt." confirmLabel="Löschen" danger loading={doDelete.isPending} onConfirm={() => doDelete.mutate()} onClose={() => setRemove(false)} /> : null}
    </>
  );
}

/* ================================================================= Rechnungen */
export function InvoicesPage() {
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const navigate = useNavigate();
  const list = useQuery({ queryKey: ['invoices', { dq, status, page }], queryFn: () => get<Paged<InvoiceRow>>(`/api/invoices${qs({ q: dq, status, page, pageSize: 50 })}`) });
  const stats = useQuery({ queryKey: ['invoices', 'stats'], queryFn: () => get<InvoiceStats>('/api/invoices/stats') });
  return (
    <>
      <PageHead title="Rechnungen" sub="Rechnungen ausstellen, versenden, Zahlungen erfassen." actions={<><a className="btn" href="/api/export/invoices.csv" title="Rechnungsliste als CSV (z. B. für den Steuerberater)"><Download /> CSV</a>{can('invoices:write') ? <Link className="btn primary" to="/rechnungen/neu"><Plus /> Rechnung</Link> : null}</>} />
      {stats.data ? <div className="grid cols-4" style={{ marginBottom: 16 }}><Kpi label="Offen" value={fmtMoney(stats.data.openCents)} delta={`${stats.data.openCount} Rechnung${stats.data.openCount === 1 ? '' : 'en'}`} /><Kpi label="Überfällig" value={fmtMoney(stats.data.overdueCents)} delta={`${stats.data.overdueCount} Rechnung${stats.data.overdueCount === 1 ? '' : 'en'}`} tone={stats.data.overdueCount ? 'down' : undefined} /><Kpi label="Fakturiert diesen Monat" value={fmtMoney(stats.data.invoicedMonthCents)} delta={`${stats.data.invoicedMonthCount} Rechnungen · Jahr ${fmtMoney(stats.data.invoicedYearCents)}`} /><Kpi label="Zahlungseingang Monat" value={fmtMoney(stats.data.paidMonthCents)} /></div> : null}
      <Card tight>
        <div className="toolbar"><input type="search" placeholder="Nummer, Kunde, Titel …" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /><Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Alle Status</option>{Object.entries(INVOICE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></div>
        {list.isLoading ? <Skeleton rows={6} /> : list.data && list.data.items.length === 0 ? <Empty title="Keine Rechnungen" text="Rechnungen entstehen aus Aufträgen, Angeboten oder direkt." /> : (
          <><div className="table-wrap"><table className="table">
            <thead><tr><th>Nummer</th><th>Kunde</th><th className="hide-mobile">Titel</th><th>Status</th><th className="num">Betrag</th><th className="num hide-mobile">Offen</th><th className="hide-mobile">Datum</th><th className="hide-mobile">Fällig</th></tr></thead>
            <tbody>{list.data?.items.map(({ invoice: inv, customer: c }) => (
              <tr key={inv.id} className="row-link" onClick={() => navigate(`/rechnungen/${inv.id}`)}>
                <td className="mono">{inv.invoiceNumber ?? <span className="dim">Entwurf</span>}</td><td><div className="primary">{personName(c)}</div><div className="secondary mono">{c.customerNumber}</div></td><td className="hide-mobile muted">{inv.title ?? '–'}</td>
                <td><Badge tone={INVOICE_STATUS[inv.status]?.tone}>{INVOICE_STATUS[inv.status]?.label}</Badge></td><td className="num">{fmtMoney(inv.totalCents)}</td><td className="num hide-mobile">{['open', 'sent', 'overdue'].includes(inv.status) ? fmtMoney(inv.totalCents - inv.paidCents) : '–'}</td><td className="hide-mobile muted">{fmtDate(inv.issueDate)}</td><td className="hide-mobile muted">{fmtDate(inv.dueDate)}</td>
              </tr>
            ))}</tbody>
          </table></div>{list.data ? <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} /> : null}</>
        )}
      </Card>
    </>
  );
}

export function InvoiceFormPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const existing = useQuery({ queryKey: ['invoice', id], queryFn: () => get<InvoiceDetail>(`/api/invoices/${id}`), enabled: editing });
  const preset = useQuery({ queryKey: ['customer', sp.get('customerId')], queryFn: () => get<{ customer: Customer }>(`/api/customers/${sp.get('customerId')}`), enabled: Boolean(sp.get('customerId')) && !editing });
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [f, setF] = useState({ vehicleId: sp.get('vehicleId') || null as string | null, orderId: sp.get('orderId') || null as string | null, title: sp.get('title') ?? '', introText: '', notes: '', serviceDate: toDateInput(new Date()) });
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (editing && existing.data && !loaded) { const inv = existing.data.invoice; setCustomer(existing.data.customer); setF({ vehicleId: inv.vehicleId, orderId: inv.orderId, title: inv.title ?? '', introText: inv.introText ?? '', notes: inv.notes ?? '', serviceDate: inv.serviceDate ?? '' }); setItems(draftsFrom(existing.data.items)); setLoaded(true); }
    if (!editing && preset.data && !customer) setCustomer(preset.data.customer);
  }, [editing, existing.data, preset.data, loaded, customer]);
  const save = useMutation({
    mutationFn: () => { const payload = { customerId: customer!.id, vehicleId: f.vehicleId, orderId: f.orderId, title: f.title || null, introText: f.introText || null, notes: f.notes || null, serviceDate: f.serviceDate || null, items: payloadFrom(items) }; return editing ? patch<InvoiceDetail>(`/api/invoices/${id}`, payload) : post<InvoiceDetail>('/api/invoices', payload); },
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['invoice', r.invoice.id] }); toast.ok('Rechnungsentwurf gespeichert'); navigate(`/rechnungen/${r.invoice.id}`); },
    onError: (e) => toast.fromError(e),
  });
  if (editing && existing.isLoading) return <Card><Skeleton /></Card>;
  if (editing && existing.data && existing.data.invoice.status !== 'draft') return <Card><div className="empty"><h3>Ausgestellte Rechnungen sind unveränderlich</h3><Link className="btn" to={`/rechnungen/${id}`}>Zur Rechnung</Link></div></Card>;
  return (
    <>
      <PageHead crumbs={<><Link to="/rechnungen">Rechnungen</Link><span>/</span><span>Entwurf</span></>} title={editing ? 'Rechnungsentwurf bearbeiten' : 'Neue Rechnung'} sub="Die Rechnungsnummer wird beim Ausstellen lückenlos vergeben." />
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (!customer) return toast.error('Bitte Kunden wählen.'); if (!payloadFrom(items).length) return toast.error('Mindestens eine Position angeben.'); save.mutate(); }} className="stack" style={{ gap: 16 }}>
        <div className="grid main-side">
          <Card title="Rechnungsdaten">
            <div className="form-grid">
              <Field label="Kunde *" className="span-2"><CustomerPicker value={customer} onChange={(c) => { setCustomer(c); setF({ ...f, vehicleId: null }); }} disabled={editing} /></Field>
              <Field label="Fahrzeug"><VehicleSelect customerId={customer?.id ?? null} value={f.vehicleId} onChange={(v) => setF({ ...f, vehicleId: v })} /></Field>
              <Field label="Leistungsdatum"><Input type="date" value={f.serviceDate} onChange={(e) => setF({ ...f, serviceDate: e.target.value })} /></Field>
              <Field label="Titel" className="span-2"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
              <Field label="Einleitungstext" className="span-2"><Textarea value={f.introText} onChange={(e) => setF({ ...f, introText: e.target.value })} /></Field>
              <Field label="Hinweise" className="span-2"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
            </div>
          </Card>
          <ServiceCatalog onPick={(s) => addServiceTo(setItems, s)} />
        </div>
        <LineItemsEditor items={items} setItems={setItems} />
        <div className="form-actions"><Button type="button" onClick={() => navigate(-1)}>Abbrechen</Button><Button type="submit" variant="primary" loading={save.isPending}>Entwurf speichern</Button></div>
      </form>
    </>
  );
}

function PaymentModal({ invoiceId, remaining, onClose, onDone }: { invoiceId: string; remaining: number; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ amount: (remaining / 100).toFixed(2).replace('.', ','), paidAt: toDateInput(new Date()), method: 'transfer', note: '' });
  const m = useMutation({ mutationFn: () => post(`/api/invoices/${invoiceId}/payments`, { amountCents: Math.round(Number(f.amount.replace(',', '.')) * 100), paidAt: f.paidAt, method: f.method, note: f.note || null }), onSuccess: () => { toast.ok('Zahlung erfasst'); onDone(); onClose(); }, onError: (e) => toast.fromError(e) });
  return (
    <Modal title="Zahlung erfassen" onClose={onClose}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); m.mutate(); }}>
        <div className="form-grid">
          <Field label="Betrag (€)"><Input inputMode="decimal" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Zahlungsdatum"><Input type="date" required value={f.paidAt} onChange={(e) => setF({ ...f, paidAt: e.target.value })} /></Field>
          <Field label="Zahlungsart"><Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{Object.entries(PAYMENT_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Notiz"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        </div>
        <div className="form-actions"><Button type="button" onClick={onClose}>Abbrechen</Button><Button type="submit" variant="primary" loading={m.isPending}><Banknote /> Erfassen</Button></div>
      </form>
    </Modal>
  );
}

export function InvoiceDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [send, setSend] = useState(false);
  const [pay, setPay] = useState(false);
  const [issue, setIssue] = useState(false);
  const [cancel, setCancel] = useState(false);
  const q = useQuery({ queryKey: ['invoice', id], queryFn: () => get<InvoiceDetail>(`/api/invoices/${id}`) });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['invoice', id] }); qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };
  const doIssue = useMutation({ mutationFn: () => post<InvoiceDetail>(`/api/invoices/${id}/issue`, {}), onSuccess: (r) => { invalidate(); toast.ok(`Rechnung ${r.invoice.invoiceNumber} ausgestellt`); setIssue(false); }, onError: (e) => toast.fromError(e) });
  const doCancel = useMutation({ mutationFn: () => post<InvoiceDetail | { deleted: boolean }>(`/api/invoices/${id}/cancel`, {}), onSuccess: (r) => { invalidate(); setCancel(false); if ('deleted' in r) { toast.ok('Entwurf gelöscht'); navigate('/rechnungen'); } else { toast.ok(`Storniert durch ${r.invoice.invoiceNumber}`); navigate(`/rechnungen/${r.invoice.id}`); } }, onError: (e) => toast.fromError(e) });
  const removePayment = useMutation({ mutationFn: (p: Payment) => del(`/api/invoices/${id}/payments/${p.id}`), onSuccess: () => { invalidate(); toast.ok('Zahlung entfernt'); }, onError: (e) => toast.fromError(e) });
  if (q.isLoading) return <Card><Skeleton /></Card>;
  if (!q.data) return <Card><div className="empty"><h3>Rechnung nicht gefunden</h3></div></Card>;
  const { invoice: inv, items, payments, customer, vehicle, order, totals, cancels, cancelledBy } = q.data;
  const remaining = inv.totalCents - inv.paidCents;
  const unpaid = ['open', 'sent', 'overdue'].includes(inv.status);
  return (
    <>
      <PageHead crumbs={<><Link to="/rechnungen">Rechnungen</Link><span>/</span><span>{inv.invoiceNumber ?? 'Entwurf'}</span></>} title={<span className="row">{inv.cancelsInvoiceId ? 'Storno ' : ''}{inv.invoiceNumber ?? 'Rechnungsentwurf'}<Badge tone={INVOICE_STATUS[inv.status]?.tone}>{INVOICE_STATUS[inv.status]?.label}</Badge></span>} sub={inv.title ?? undefined}
        actions={<>
          <a className="btn" href={`/api/invoices/${id}/pdf`} target="_blank" rel="noreferrer"><FileDown /> PDF</a>
          {can('invoices:write') && inv.status === 'draft' ? <><Link className="btn" to={`/rechnungen/${id}/bearbeiten`}><Pencil /> Bearbeiten</Link><Button variant="primary" onClick={() => setIssue(true)}><Check /> Ausstellen</Button></> : null}
          {can('invoices:write') && unpaid ? <><Button variant="primary" onClick={() => setSend(true)}><Send /> Senden</Button><Button onClick={() => setPay(true)}><Banknote /> Zahlung</Button></> : null}
          {can('invoices:write') && inv.status !== 'cancelled' && !inv.cancelsInvoiceId ? <Button variant="danger" onClick={() => setCancel(true)}><Ban /> {inv.status === 'draft' ? 'Löschen' : 'Stornieren'}</Button> : null}
        </>} />
      {cancelledBy ? <div className="dup-box" style={{ marginBottom: 16 }}>Diese Rechnung wurde storniert durch <Link to={`/rechnungen/${cancelledBy.id}`}>{cancelledBy.invoiceNumber}</Link>.</div> : null}
      {cancels ? <div className="dup-box" style={{ marginBottom: 16 }}>Stornorechnung zu <Link to={`/rechnungen/${cancels.id}`}>{cancels.invoiceNumber}</Link>.</div> : null}
      <div className="grid main-side">
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Positionen" tight>
            <div className="table-wrap"><table className="table"><thead><tr><th>Leistung</th><th className="num">Menge</th><th className="num">Einzelpreis</th><th className="num">Gesamt</th></tr></thead>
              <tbody>{items.map((it) => <tr key={it.id}><td><div className="primary">{it.name}</div>{it.description ? <div className="secondary">{it.description}</div> : null}</td><td className="num">{it.quantity}</td><td className="num">{fmtMoney(it.unitPriceCents)}</td><td className="num">{fmtMoney(it.totalCents)}</td></tr>)}</tbody></table></div>
            <div className="row" style={{ padding: 12, justifyContent: 'flex-end' }}><div className="totals"><div className="l"><span className="muted">Netto</span><span>{fmtMoney(totals.subtotalCents)}</span></div>{totals.vatBreakdown.map((v) => <div className="l" key={v.vatBp}><span className="muted">MwSt. {v.vatBp / 100} %</span><span>{fmtMoney(v.vatCents)}</span></div>)}<div className="l total"><span>Gesamt</span><span>{fmtMoney(totals.totalCents)}</span></div>{inv.paidCents ? <><div className="l"><span className="muted">Bezahlt</span><span>{fmtMoney(inv.paidCents)}</span></div><div className="l"><span className="muted">Offen</span><span>{fmtMoney(remaining)}</span></div></> : null}</div></div>
          </Card>
          <Card title="Zahlungen" tight>
            {payments.length === 0 ? <p className="muted" style={{ padding: 18 }}>Noch keine Zahlung erfasst.</p> : <div className="table-wrap"><table className="table"><thead><tr><th>Datum</th><th>Art</th><th>Notiz</th><th className="num">Betrag</th><th></th></tr></thead><tbody>{payments.map((p) => <tr key={p.id}><td>{fmtDate(p.paidAt)}</td><td>{PAYMENT_METHOD[p.method] ?? p.method}</td><td className="muted">{p.note ?? '–'}</td><td className="num">{fmtMoney(p.amountCents)}</td><td className="num">{can('invoices:write') && !inv.cancelsInvoiceId ? <Button size="sm" variant="ghost" onClick={() => removePayment.mutate(p)}><Trash2 /></Button> : null}</td></tr>)}</tbody></table></div>}
          </Card>
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Daten"><dl className="dl"><dt>Rechnungsdatum</dt><dd>{fmtDate(inv.issueDate)}</dd><dt>Leistungsdatum</dt><dd>{fmtDate(inv.serviceDate)}</dd><dt>Fällig am</dt><dd>{fmtDate(inv.dueDate)}</dd><dt>Versendet</dt><dd>{fmtDateTime(inv.sentAt)}</dd><dt>Bezahlt am</dt><dd>{fmtDateTime(inv.paidAt)}</dd></dl></Card>
          <Card title="Kunde"><dl className="dl"><dt>Kunde</dt><dd>{customer ? <Link to={`/kunden/${customer.id}`}>{personName(customer)}</Link> : '–'}<div className="small dim">{customer?.email ?? 'keine E-Mail'}</div></dd><dt>Fahrzeug</dt><dd>{vehicle ? [vehicle.make, vehicle.model, vehicle.licensePlate].filter(Boolean).join(' ') : '–'}</dd>{order ? <><dt>Auftrag</dt><dd><Link to={`/auftraege/${order.id}`}>{order.orderNumber}</Link></dd></> : null}</dl></Card>
        </div>
      </div>
      {send ? <SendModal kind="invoices" id={id} customer={customer} onClose={() => setSend(false)} onSent={invalidate} /> : null}
      {pay ? <PaymentModal invoiceId={id} remaining={remaining} onClose={() => setPay(false)} onDone={invalidate} /> : null}
      {issue ? <Confirm title="Rechnung ausstellen?" text="Die Rechnung erhält die nächste fortlaufende Nummer mit heutigem Datum und ist danach unveränderlich. Fehler lassen sich nur per Storno korrigieren." confirmLabel="Ausstellen" loading={doIssue.isPending} onConfirm={() => doIssue.mutate()} onClose={() => setIssue(false)} /> : null}
      {cancel ? <Confirm title={inv.status === 'draft' ? 'Entwurf löschen?' : 'Rechnung stornieren?'} text={inv.status === 'draft' ? 'Der Entwurf wird endgültig gelöscht.' : 'Es wird eine Stornorechnung mit eigener Nummer erzeugt; die Originalrechnung bleibt als storniert erhalten (GoBD).'} confirmLabel={inv.status === 'draft' ? 'Löschen' : 'Stornieren'} danger loading={doCancel.isPending} onConfirm={() => doCancel.mutate()} onClose={() => setCancel(false)} /> : null}
    </>
  );
}

/** Kompakte Listen für die Kundenakte. */
export function CustomerBilling({ customerId }: { customerId: string }) {
  const offers = useQuery({ queryKey: ['offers', 'customer', customerId], queryFn: () => get<Paged<OfferRow>>(`/api/offers${qs({ customerId, pageSize: 50 })}`) });
  const invoices = useQuery({ queryKey: ['invoices', 'customer', customerId], queryFn: () => get<Paged<InvoiceRow>>(`/api/invoices${qs({ customerId, pageSize: 50 })}`) });
  return (
    <>
      <Card title="Angebote" actions={<Link className="btn sm" to={`/angebote/neu?customerId=${customerId}`}><Plus /></Link>}>
        {!offers.data?.items.length ? <p className="muted">Keine Angebote.</p> : offers.data.items.map(({ offer: o }) => <Link key={o.id} to={`/angebote/${o.id}`} className="spread" style={{ padding: '6px 0' }}><span className="mono">{o.offerNumber}<div className="small muted" style={{ fontFamily: 'var(--font)' }}>{fmtDate(o.issueDate)} · {fmtMoney(o.totalCents)}</div></span><Badge tone={OFFER_STATUS[o.status]?.tone}>{OFFER_STATUS[o.status]?.label}</Badge></Link>)}
      </Card>
      <Card title="Rechnungen" actions={<Link className="btn sm" to={`/rechnungen/neu?customerId=${customerId}`}><Plus /></Link>}>
        {!invoices.data?.items.length ? <p className="muted">Keine Rechnungen.</p> : invoices.data.items.map(({ invoice: inv }) => <Link key={inv.id} to={`/rechnungen/${inv.id}`} className="spread" style={{ padding: '6px 0' }}><span className="mono">{inv.invoiceNumber ?? 'Entwurf'}<div className="small muted" style={{ fontFamily: 'var(--font)' }}>{fmtDate(inv.issueDate ?? inv.createdAt)} · {fmtMoney(inv.totalCents)}</div></span><Badge tone={INVOICE_STATUS[inv.status]?.tone}>{INVOICE_STATUS[inv.status]?.label}</Badge></Link>)}
      </Card>
    </>
  );
}
