import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Camera, CheckCircle2, FileCode2, FileText, RefreshCw, RotateCcw, Sparkles, Trash2, Upload, Plus, X } from 'lucide-react';
import { get, post, put, qs } from '../api/client';
import type { Customer } from '../api/types';
import { useAuth } from '../app/auth';
import { CustomerPicker } from '../components/pickers';
import { Badge, Button, Card, Confirm, Empty, Field, Input, Modal, PageHead, Select, Skeleton, Tabs, useToast } from '../components/ui';
import { fmtDate, fmtDateTime, fmtMoney } from '../lib/format';

type Direction = 'outgoing' | 'incoming';
type Status = 'queued' | 'processing' | 'needs_review' | 'completed' | 'failed' | 'duplicate' | 'discarded' | 'undone';
interface Party { name: string | null; companyName: string | null; personName: string | null; street: string | null; zip: string | null; city: string | null; country: string | null; email: string | null; phone: string | null; vatId: string | null; taxNumber: string | null; partyNumber: string | null }
interface Line { name: string; description: string | null; quantity: number; unit: string | null; unitNetCents: number | null; netCents: number; vatBp: number | null }
interface InvoiceData { kind: 'invoice' | 'credit_note' | 'correction' | 'receipt'; number: string | null; issueDate: string | null; dueDate: string | null; serviceDate: string | null; currency: string; seller: Party; buyer: Party; lines: Line[]; vat: Array<{ vatBp: number; netCents: number; vatCents: number }>; netCents: number | null; vatCents: number | null; grossCents: number | null; prepaidCents: number | null; dueCents: number | null; paymentTerms: string | null; paid: boolean | null; notes: string | null; suggestedCategory: string | null }
interface ImportSummary { id: string; direction: Direction; status: Status; fileName: string; fileId: string | null; method: string | null; number: string | null; issueDate: string | null; grossCents: number | null; kind: string | null; partyName: string | null; error: string | null; warnings: string[]; invoiceId: string | null; customerId: string | null; customerCreated: boolean; expenseIds: string[]; createdAt: string; processedAt: string | null; appliedAt: string | null }
interface Candidate { id: string; customerNumber: string; label: string; score: number; reasons: string[] }
interface ImportDetail { import: ImportSummary; data: InvoiceData | null; file: { id: string; mimeType: string; originalName: string; sizeBytes: number } | null; candidates: Candidate[]; suggestedCustomerId: string | null; matchDecision: 'matched' | 'uncertain' | 'ambiguous' | 'new' | null; undoBlockedReason: string | null; suggestedCategory: string | null; customer: { id: string; customerNumber: string; firstName: string; lastName: string; companyName: string | null } | null; invoice: { id: string; invoiceNumber: string; status: string; totalCents: number } | null; expenses: Array<{ id: string; date: string; category: string; grossCents: number; vatBp: number; isPaid: boolean }>; options: { markPaid?: boolean } }
interface ImportStatusInfo { directions: Direction[]; canWrite: Direction[]; aiEnabled: boolean; aiConfigured: boolean; canManageAi: boolean; counts: Array<{ direction: Direction; status: Status; n: number }>; categories: string[] }
interface UploadResult { fileName: string; status: 'queued' | 'duplicate' | 'rejected'; id?: string; existingId?: string; message?: string }

const STATUS: Record<Status, { label: string; tone: string }> = {
  queued: { label: 'Wartet', tone: 'info' }, processing: { label: 'Wird gelesen …', tone: 'info' }, needs_review: { label: 'Prüfen', tone: 'warn' },
  completed: { label: 'Übernommen', tone: 'ok' }, failed: { label: 'Fehler', tone: 'danger' }, duplicate: { label: 'Bereits vorhanden', tone: '' },
  discarded: { label: 'Verworfen', tone: '' }, undone: { label: 'Zurückgenommen', tone: '' },
};
const METHOD: Record<string, string> = { einvoice_cii: 'E-Rechnung (ZUGFeRD)', einvoice_ubl: 'E-Rechnung (XRechnung)', ai: 'Texterkennung (KI)', manual: 'Manuell' };
const KIND: Record<string, string> = { invoice: 'Rechnung', credit_note: 'Gutschrift', correction: 'Rechnungskorrektur', receipt: 'Kassenbon/Quittung' };
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,.xml,application/xml,text/xml';

/** Betrag „1.234,56“ / „1.500“ / „1234.56“ → Cent (ohne Gleitkommafehler); leer oder ungültig → null. */
function parseMoney(v: string): number | null {
  let s = v.trim().replace(/\s|€/g, '');
  if (!s) return null;
  const neg = s.startsWith('-');
  s = s.replace(/^[-+]/, '');
  const comma = s.lastIndexOf(','); const dot = s.lastIndexOf('.');
  if (comma > dot) s = s.replace(/\./g, '').replace(',', '.');
  else if (dot >= 0 && comma < 0 && /^[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // „1.500“ = Tausenderpunkt („0.500“ bleibt 0,50)
  else s = s.replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [int, frac = ''] = s.split('.');
  const f = (frac + '000').slice(0, 3);
  let c = Number(int) * 100 + Number(f.slice(0, 2));
  if (Number(f[2]) >= 5) c += 1;
  return neg ? -c : c;
}
const money = (c: number | null | undefined) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));

async function uploadOne(file: File, direction: Direction, markPaid: boolean): Promise<UploadResult> {
  const fd = new FormData();
  fd.append('direction', direction);
  fd.append('markPaid', String(markPaid));
  fd.append('file', file, file.name);
  const res = await fetch('/api/document-imports', { method: 'POST', body: fd, credentials: 'same-origin' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? `Upload fehlgeschlagen (${res.status})`);
  return (data.items as UploadResult[])[0]!;
}

export function DocumentImportsPage() {
  const status = useQuery({ queryKey: ['document-imports', 'status'], queryFn: () => get<ImportStatusInfo>('/api/document-imports/status') });
  const [tab, setTab] = useState<Direction | null>(null);
  const dirs = status.data?.directions ?? [];
  const active = tab ?? dirs[0] ?? null;
  if (status.isLoading) return <><PageHead title="Belege importieren" /><Card><Skeleton /></Card></>;
  if (!active) return <><PageHead title="Belege importieren" /><Empty title="Keine Berechtigung" text="Für den Belegimport sind Rechte für Rechnungen oder Finanzen nötig." /></>;
  const open = (d: Direction) => (status.data?.counts ?? []).filter((c) => c.direction === d && (c.status === 'needs_review' || c.status === 'failed')).reduce((s, c) => s + c.n, 0);
  return (
    <>
      <PageHead title="Belege importieren" sub="Rechnungen als PDF, Foto oder E-Rechnung hochladen – Kunde, Rechnung bzw. Ausgabe werden automatisch angelegt, ausgefüllt und abgelegt." />
      <Tabs value={active} onChange={setTab} items={dirs.map((d) => ({ id: d, label: <span className="row" style={{ gap: 6 }}>{d === 'outgoing' ? 'Ausgangsrechnungen (z. B. Lexware Office)' : 'Eingangsrechnungen (Händler, Lieferanten)'}{open(d) ? <span className="count">{open(d)}</span> : null}</span> }))} />
      <ImportArea key={active} direction={active} info={status.data!} />
    </>
  );
}

function AiNotice({ info }: { info: ImportStatusInfo }) {
  const qc = useQueryClient();
  const toast = useToast();
  const toggle = useMutation({ mutationFn: (enabled: boolean) => put('/api/document-imports/ai', { enabled }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['document-imports', 'status'] }); toast.ok('Einstellung gespeichert'); }, onError: (e) => toast.fromError(e) });
  if (info.aiEnabled && info.aiConfigured) {
    return <p className="small muted row" style={{ gap: 6 }}><Sparkles size={14} /> E-Rechnungen (ZUGFeRD/XRechnung) werden exakt gelesen, Fotos und andere PDFs per Texterkennung (KI).{info.canManageAi ? <button className="btn ghost sm" onClick={() => toggle.mutate(false)}>KI-Erkennung ausschalten</button> : null}</p>;
  }
  return (
    <div className="import-ai">
      <AlertTriangle size={16} />
      <div className="stack" style={{ gap: 6, minWidth: 0 }}>
        <span>E-Rechnungen (z. B. Lexware-Office-PDFs mit ZUGFeRD-Daten, XRechnung) werden ohne KI exakt übernommen. Für <strong>Fotos und PDFs ohne E-Rechnungsdaten</strong> ist die automatische Texterkennung {info.aiEnabled ? 'eingeschaltet, aber' : 'ausgeschaltet'}{info.aiEnabled && !info.aiConfigured ? ' es ist kein Anthropic-API-Key hinterlegt (Einstellungen → Integrationen).' : ' – solche Belege landen zur manuellen Erfassung in „Prüfen“.'}</span>
        {!info.aiEnabled ? <span className="small muted">Beim Einschalten werden diese Belege (mit Namen und Anschriften) zur Erkennung an Anthropic übermittelt. Vorher einen Auftragsverarbeitungsvertrag mit Anthropic abschließen und die Datenschutzhinweise ergänzen.</span> : null}
        {!info.aiEnabled && info.canManageAi ? <div><Button size="sm" onClick={() => toggle.mutate(true)} loading={toggle.isPending}><Sparkles /> KI-Texterkennung einschalten</Button></div> : null}
      </div>
    </div>
  );
}

function ImportArea({ direction, info }: { direction: Direction; info: ImportStatusInfo }) {
  const qc = useQueryClient();
  const toast = useToast();
  const canWrite = info.canWrite.includes(direction);
  const [filter, setFilter] = useState<'open' | 'all' | 'completed'>('all');
  const [markPaid, setMarkPaid] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [over, setOver] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const list = useQuery({
    queryKey: ['document-imports', direction, filter],
    queryFn: () => get<{ items: ImportSummary[] }>(`/api/document-imports${qs({ direction, open: filter === 'open' ? 'true' : undefined, status: filter === 'completed' ? 'completed' : undefined })}`),
    refetchInterval: (q) => ((q.state.data?.items ?? []).some((i) => i.status === 'queued' || i.status === 'processing') || progress ? 2000 : false),
  });
  const items = list.data?.items ?? [];

  const handle = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    setProgress({ done: 0, total: arr.length });
    let queued = 0; let dup = 0; const rejected: string[] = [];
    for (const [i, f] of arr.entries()) {
      try {
        const r = await uploadOne(f, direction, markPaid);
        if (r.status === 'queued') queued++; else if (r.status === 'duplicate') dup++; else rejected.push(`${r.fileName}: ${r.message ?? 'abgelehnt'}`);
      } catch (e) { rejected.push(`${f.name}: ${e instanceof Error ? e.message : 'Fehler'}`); }
      setProgress({ done: i + 1, total: arr.length });
      void qc.invalidateQueries({ queryKey: ['document-imports', direction] });
    }
    setProgress(null);
    if (queued) toast.ok(`${queued} Beleg${queued === 1 ? '' : 'e'} hochgeladen`, 'Die Daten werden jetzt ausgelesen und eingepflegt.');
    if (dup) toast.info(`${dup} Beleg${dup === 1 ? ' wurde' : 'e wurden'} bereits hochgeladen`);
    for (const r of rejected) toast.error('Nicht übernommen', r);
    void qc.invalidateQueries({ queryKey: ['document-imports', 'status'] });
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); if (canWrite) void handle(e.dataTransfer.files); };

  // Nach Abschluss der Verarbeitung abhängige Ansichten (Kunden, Rechnungen, Finanzen) aktualisieren
  const prevBusy = useRef(false);
  const busy = items.some((i) => i.status === 'queued' || i.status === 'processing');
  useEffect(() => {
    if (prevBusy.current && !busy) for (const k of ['customers', 'invoices', 'expenses', 'finance', 'files']) void qc.invalidateQueries({ queryKey: [k] });
    if (prevBusy.current && !busy) void qc.invalidateQueries({ queryKey: ['document-imports', 'status'] });
    prevBusy.current = busy;
  }, [busy, qc]);

  const counts = useMemo(() => {
    const by = (s: Status[]) => (info.counts ?? []).filter((c) => c.direction === direction && s.includes(c.status)).reduce((a, c) => a + c.n, 0);
    return { review: by(['needs_review', 'failed']), done: by(['completed']) };
  }, [info.counts, direction]);

  return (
    <div className="stack" style={{ gap: 16 }}>
      {canWrite ? (
        <Card>
          <div className="stack" style={{ gap: 12 }}>
            <AiNotice info={info} />
            <div className={`dropzone import-drop ${over ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop} onClick={() => !progress && fileInput.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.current?.click(); }}>
              {progress ? (
                <span className="row" style={{ justifyContent: 'center' }}><span className="spinner" /> Lade hoch … {progress.done} / {progress.total}</span>
              ) : (
                <div className="stack" style={{ gap: 6, alignItems: 'center' }}>
                  <Upload size={26} />
                  <strong>{direction === 'outgoing' ? 'Ausgangsrechnungen hierher ziehen' : 'Eingangsrechnungen hierher ziehen'}</strong>
                  <span className="small">oder klicken, um Dateien auszuwählen · PDF, Foto (JPG/PNG/WebP), E-Rechnung (XML) · mehrere gleichzeitig · max. 25 MB je Datei</span>
                </div>
              )}
              <input ref={fileInput} type="file" multiple accept={ACCEPT} style={{ display: 'none' }} onChange={(e) => { if (e.target.files) void handle(e.target.files); e.target.value = ''; }} />
              <input ref={cameraInput} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => { if (e.target.files) void handle(e.target.files); e.target.value = ''; }} />
            </div>
            <div className="row wrap" style={{ gap: 12, justifyContent: 'space-between' }}>
              <label className="check"><input type="checkbox" checked={markPaid} onChange={(e) => setMarkPaid(e.target.checked)} /> {direction === 'outgoing' ? 'Rechnungen sind bereits bezahlt' : 'Rechnungen sind bereits bezahlt (z. B. Karte/bar)'}</label>
              <Button className="show-mobile-flex" onClick={() => cameraInput.current?.click()} disabled={Boolean(progress)}><Camera /> Foto aufnehmen</Button>
            </div>
            <p className="small dim">{direction === 'outgoing'
              ? 'Gehört die Rechnung zu einem bestehenden Kunden (E-Mail, Telefon, Name/Firma mit PLZ), wird sie dort abgelegt und fehlende Kundendaten werden ergänzt. Sonst wird der Kunde automatisch neu angelegt. Rechnungsnummer, Datum, Positionen und Beträge bleiben exakt wie im Original.'
              : 'Lieferant, Rechnungsnummer, Datum, Fälligkeit, Netto/MwSt./Brutto (je Steuersatz) und eine passende Kostenkategorie werden erfasst; der Beleg wird an die Ausgabe angehängt. Doppelt hochgeladene Rechnungen werden erkannt.'}</p>
          </div>
        </Card>
      ) : null}

      <Card tight title={<span className="row" style={{ gap: 8 }}>Hochgeladene Belege {counts.review ? <Badge tone="warn">{counts.review} zu prüfen</Badge> : null}</span>} actions={<div className="seg">{([['all', 'Alle'], ['open', 'Zu prüfen'], ['completed', 'Übernommen']] as const).map(([k, l]) => <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{l}</button>)}</div>}>
        {list.isLoading ? <Skeleton /> : items.length === 0 ? <Empty title={filter === 'open' ? 'Nichts zu prüfen' : 'Noch keine Belege'} text={filter === 'open' ? 'Alle hochgeladenen Belege wurden verarbeitet.' : 'Laden Sie oben Rechnungen hoch.'} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Beleg</th><th>{direction === 'outgoing' ? 'Kunde' : 'Lieferant'}</th><th className="hide-mobile">Datum</th><th className="num">Betrag</th><th className="hide-mobile">Status</th></tr></thead>
            <tbody>{items.map((i) => (
              <tr key={i.id} className="row-link" onClick={() => setOpenId(i.id)}>
                <td style={{ maxWidth: 300 }}><div className="primary row" style={{ gap: 6, flexWrap: 'nowrap' }}>{i.fileName.toLowerCase().endsWith('.xml') ? <FileCode2 size={15} style={{ flex: 'none' }} /> : <FileText size={15} style={{ flex: 'none' }} />}<span className="ellipsis" style={{ maxWidth: '100%' }}>{i.number ? `${KIND[i.kind ?? 'invoice'] ?? 'Rechnung'} ${i.number}` : i.fileName}</span></div><div className="secondary">{i.number ? i.fileName : ''}{i.method ? `${i.number ? ' · ' : ''}${METHOD[i.method] ?? i.method}` : ''} · {fmtDateTime(i.createdAt)}</div></td>
                <td>{i.partyName ?? <span className="dim">–</span>}{i.customerCreated ? <div className="secondary">neu angelegt</div> : null}</td>
                <td className="hide-mobile muted">{fmtDate(i.issueDate)}</td>
                <td className="num">{fmtMoney(i.grossCents)}<div className="show-mobile" style={{ marginTop: 4 }}><Badge tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Badge></div></td>
                <td className="hide-mobile"><Badge tone={STATUS[i.status].tone}>{i.status === 'processing' ? <><span className="spinner" style={{ width: 10, height: 10 }} /> {STATUS[i.status].label}</> : STATUS[i.status].label}</Badge>{i.status === 'needs_review' || i.status === 'failed' ? <div className="secondary ellipsis" style={{ maxWidth: 220 }} title={i.error ?? ''}>{i.error}</div> : null}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      {openId ? <ReviewModal id={openId} direction={direction} categories={info.categories} canWrite={canWrite} onClose={() => setOpenId(null)} /> : null}
    </div>
  );
}

function FilePreview({ file }: { file: NonNullable<ImportDetail['file']> }) {
  const src = `/files/${file.id}`;
  if (file.mimeType.startsWith('image/')) return <a href={src} target="_blank" rel="noreferrer"><img src={`${src}?variant=display`} alt={file.originalName} className="import-preview-img" /></a>;
  if (file.mimeType === 'application/pdf') return <iframe src={src} title={file.originalName} className="import-preview-pdf" />;
  return <div className="import-preview-xml"><FileCode2 size={28} /><div>E-Rechnung (XML)</div><a className="btn sm" href={`${src}?download=true`}>Herunterladen</a></div>;
}

function ReviewModal({ id, direction, categories, canWrite, onClose }: { id: string; direction: Direction; categories: string[]; canWrite: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['document-import', id], queryFn: () => get<ImportDetail>(`/api/document-imports/${id}`), refetchInterval: (s) => (s.state.data && ['queued', 'processing'].includes(s.state.data.import.status) ? 1500 : false) });
  const d = q.data;
  const [data, setData] = useState<InvoiceData | null>(null);
  const [customerMode, setCustomerMode] = useState<'candidate' | 'other' | 'new'>('candidate');
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [other, setOther] = useState<Customer | null>(null);
  const [category, setCategory] = useState<string>('');
  const [markPaid, setMarkPaid] = useState(false);
  const [confirm, setConfirm] = useState<'discard' | 'undo' | null>(null);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [rateChoice, setRateChoice] = useState<string | null>(null);
  // Formular aus dem Serverstand befüllen – erneut, sobald der Beleg neu ausgelesen wurde
  const [initKey, setInitKey] = useState('');
  useEffect(() => {
    if (!d || ['queued', 'processing'].includes(d.import.status)) return;
    const key = `${d.import.status}|${d.import.processedAt ?? ''}|${d.import.method ?? ''}`;
    if (key === initKey) return;
    setInitKey(key);
    setData(d.data ? structuredClone(d.data) : null);
    setRateChoice(null);
    setCandidateId(d.suggestedCustomerId);
    // Nur ein eindeutiger bzw. wahrscheinlicher Treffer wird vorgewählt; bei mehreren Treffern muss gewählt werden
    setCustomerMode(d.suggestedCustomerId ? 'candidate' : d.matchDecision === 'ambiguous' ? 'candidate' : 'new');
    setCategory(d.suggestedCategory ?? '');
    setMarkPaid(Boolean(d.options.markPaid || (d.import.direction === 'incoming' && d.data?.paid)));
    setAllowDuplicate(false);
  }, [d, initKey]);
  const refresh = () => { for (const k of [['document-imports'], ['document-import', id], ['customers'], ['invoices'], ['expenses'], ['finance'], ['files']]) void qc.invalidateQueries({ queryKey: k }); };
  const apply = useMutation({
    mutationFn: () => post(`/api/document-imports/${id}/apply`, { data, markPaid, allowDuplicate, category: direction === 'incoming' ? category || null : null, customerId: direction === 'outgoing' ? (customerMode === 'candidate' ? candidateId : customerMode === 'other' ? other?.id ?? null : null) : null, createCustomer: direction === 'outgoing' && customerMode === 'new' }),
    onSuccess: () => { toast.ok('Beleg übernommen'); refresh(); onClose(); },
    onError: (e) => toast.fromError(e, 'Übernahme nicht möglich'),
  });
  const retry = useMutation({ mutationFn: () => post(`/api/document-imports/${id}/retry`), onSuccess: () => { setInitKey(''); refresh(); toast.info('Wird erneut ausgelesen'); }, onError: (e) => toast.fromError(e) });
  const discard = useMutation({ mutationFn: () => post(`/api/document-imports/${id}/discard`), onSuccess: () => { toast.ok('Beleg verworfen'); refresh(); onClose(); }, onError: (e) => toast.fromError(e) });
  const undo = useMutation({ mutationFn: () => post<{ invoiceRemoved: boolean; customerRemoved: boolean; expensesRemoved: number }>(`/api/document-imports/${id}/undo`), onSuccess: (r) => { toast.ok('Übernahme zurückgenommen', [r.invoiceRemoved ? 'Rechnung entfernt' : null, r.customerRemoved ? 'neu angelegter Kunde entfernt' : null, r.expensesRemoved ? `${r.expensesRemoved} Ausgabe(n) entfernt` : null].filter(Boolean).join(' · ')); refresh(); onClose(); }, onError: (e) => toast.fromError(e) });

  const imp = d?.import;
  const isDuplicateNoNumber = imp?.status === 'duplicate' && direction === 'incoming' && !data?.number;
  const editable = canWrite && imp && (['needs_review', 'failed'].includes(imp.status) || isDuplicateNoNumber) && data;
  const party = data ? (direction === 'outgoing' ? data.buyer : data.seller) : null;
  const setParty = (patch: Partial<Party>) => setData((s) => (s ? (direction === 'outgoing' ? { ...s, buyer: { ...s.buyer, ...patch } } : { ...s, seller: { ...s.seller, ...patch } }) : s));
  const setField = <K extends keyof InvoiceData>(k: K, v: InvoiceData[K]) => setData((s) => (s ? { ...s, [k]: v } : s));
  const sumLines = data?.lines.reduce((s, l) => s + l.netCents, 0) ?? 0;
  const arithmeticOk = data && data.netCents !== null && data.vatCents !== null && data.grossCents !== null ? Math.abs(data.netCents + data.vatCents - data.grossCents) <= 2 : true;
  const docRate = data?.vat.length === 1 ? String(data.vat[0]!.vatBp / 100) : data?.vat.length ? 'mixed' : '';
  const vatRate = rateChoice ?? docRate;
  /** Aus Brutto (bevorzugt) oder Netto und dem gewählten Steuersatz die übrigen Beträge berechnen. */
  const recalc = (rate: string, next: InvoiceData, from: 'gross' | 'net') => {
    if (rate === '' || rate === 'mixed') return next;
    const bp = Math.round(Number(rate) * 100);
    let net: number | null; let gross: number | null;
    if (from === 'gross' && next.grossCents !== null) { gross = next.grossCents; net = Math.round((gross * 10000) / (10000 + bp)); }
    else if (next.netCents !== null) { net = next.netCents; gross = net + Math.round((net * bp) / 10000); }
    else return next;
    const vat = gross - net;
    return { ...next, netCents: net, vatCents: vat, grossCents: gross, vat: [{ vatBp: bp, netCents: net, vatCents: vat }], lines: next.lines.map((l) => ({ ...l, vatBp: bp })) };
  };
  /** Aufteilung nach Steuersätzen (mehrere Sätze): Summen ergeben Netto, MwSt. und Brutto. */
  const setBreakdown = (vat: InvoiceData['vat']) => setData((s) => {
    if (!s) return s;
    const net = vat.reduce((a, v) => a + v.netCents, 0);
    const tax = vat.reduce((a, v) => a + v.vatCents, 0);
    return { ...s, vat, netCents: net, vatCents: tax, grossCents: net + tax };
  });
  const setVatRate = (rate: string) => {
    setRateChoice(rate);
    if (!data) return;
    if (rate === 'mixed') { if (data.vat.length < 2) setBreakdown(data.vat.length ? data.vat : [{ vatBp: 1900, netCents: data.netCents ?? 0, vatCents: data.vatCents ?? 0 }]); return; }
    setData(recalc(rate, data, data.grossCents !== null ? 'gross' : 'net'));
  };
  const setAmount = (k: 'netCents' | 'vatCents' | 'grossCents', v: number | null) => {
    if (!data) return;
    const next = { ...data, [k]: v };
    setData(k === 'vatCents' || vatRate === '' || vatRate === 'mixed' ? next : recalc(vatRate, next, k === 'grossCents' ? 'gross' : 'net'));
  };

  return (
    <Modal title={imp ? (imp.number ? `${KIND[imp.kind ?? 'invoice'] ?? 'Rechnung'} ${imp.number}` : imp.fileName) : 'Beleg'} onClose={onClose} wide>
      {!d || !imp ? <Skeleton /> : (
        <div className="import-review">
          <div className="import-preview">{d.file ? <FilePreview file={d.file} /> : <div className="import-preview-xml">Datei nicht mehr vorhanden</div>}</div>
          <div className="stack" style={{ gap: 14, minWidth: 0 }}>
            <div className="row wrap" style={{ gap: 8 }}>
              <Badge tone={STATUS[imp.status].tone}>{STATUS[imp.status].label}</Badge>
              {imp.method ? <Badge plain>{METHOD[imp.method] ?? imp.method}</Badge> : null}
            </div>
            {['queued', 'processing'].includes(imp.status) ? <p className="row muted"><span className="spinner" /> Der Beleg wird ausgelesen …</p> : null}
            {imp.error && imp.status !== 'completed' ? <div className="hint warn"><AlertTriangle size={16} /><span>{imp.error}</span></div> : null}
            {imp.warnings.filter((w) => w !== imp.error).length ? <ul className="import-warnings">{imp.warnings.filter((w) => w !== imp.error).map((w, i) => <li key={i}>{w}</li>)}</ul> : null}

            {imp.status === 'completed' ? (
              <div className="stack" style={{ gap: 10 }}>
                <div className="hint ok"><CheckCircle2 size={16} /><span>Übernommen am {fmtDateTime(imp.appliedAt)}.</span></div>
                {d.customer ? <div>Kunde: <Link to={`/kunden/${d.customer.id}`} onClick={onClose}><strong>{d.customer.companyName ?? `${d.customer.firstName} ${d.customer.lastName}`}</strong></Link> <span className="dim mono small">{d.customer.customerNumber}</span>{imp.customerCreated ? <Badge tone="info">neu angelegt</Badge> : null}</div> : null}
                {d.invoice ? <div>Rechnung: <Link to={`/rechnungen/${d.invoice.id}`} onClick={onClose}><strong>{d.invoice.invoiceNumber}</strong></Link> · {fmtMoney(d.invoice.totalCents)}</div> : null}
                {d.expenses.length ? <div className="stack" style={{ gap: 4 }}>{d.expenses.map((e) => <div key={e.id}>Ausgabe {fmtDate(e.date)} · {e.category} · {fmtMoney(e.grossCents)} ({e.vatBp / 100} %) {e.isPaid ? <Badge tone="ok">bezahlt</Badge> : <Badge tone="warn">offen</Badge>}</div>)}<Link to="/finanzen" onClick={onClose} className="small">Zu den Ausgaben</Link></div> : null}
                {canWrite ? (d.undoBlockedReason ? <p className="small muted">Rückgängig nicht mehr möglich: {d.undoBlockedReason}</p> : <div className="form-actions" style={{ justifyContent: 'flex-start' }}><Button onClick={() => setConfirm('undo')}><RotateCcw /> Übernahme rückgängig machen</Button></div>) : null}
              </div>
            ) : null}

            {editable && party ? (
              <>
                {direction === 'outgoing' ? (
                  <Card title="Kunde" tight>
                    <div className="stack" style={{ gap: 8, padding: '4px 14px 12px' }}>
                      {d.candidates.map((c) => (
                        <label key={c.id} className="check"><input type="radio" checked={customerMode === 'candidate' && candidateId === c.id} onChange={() => { setCustomerMode('candidate'); setCandidateId(c.id); }} /> <span>{c.label} <span className="dim small">· Übereinstimmung: {c.reasons.join(', ')}</span></span></label>
                      ))}
                      <label className="check"><input type="radio" checked={customerMode === 'other'} onChange={() => setCustomerMode('other')} /> Anderen bestehenden Kunden wählen</label>
                      {customerMode === 'other' ? <CustomerPicker value={other} onChange={setOther} /> : null}
                      <label className="check"><input type="radio" checked={customerMode === 'new'} onChange={() => setCustomerMode('new')} /> Neuen Kunden aus den Rechnungsdaten anlegen</label>
                    </div>
                  </Card>
                ) : null}
                <div className="form-grid">
                  <Field label={direction === 'outgoing' ? 'Kunde / Firma *' : 'Lieferant *'} className="span-2"><Input value={party.name ?? ''} onChange={(e) => setParty({ name: e.target.value || null })} /></Field>
                  {direction === 'outgoing' ? <Field label="Ansprechpartner" className="span-2"><Input value={party.personName ?? ''} onChange={(e) => setParty({ personName: e.target.value || null })} /></Field> : null}
                  <Field label="Straße und Nr." className="span-2"><Input value={party.street ?? ''} onChange={(e) => setParty({ street: e.target.value || null })} /></Field>
                  <Field label="PLZ"><Input value={party.zip ?? ''} onChange={(e) => setParty({ zip: e.target.value || null })} /></Field>
                  <Field label="Ort"><Input value={party.city ?? ''} onChange={(e) => setParty({ city: e.target.value || null })} /></Field>
                  {direction === 'outgoing' ? <><Field label="E-Mail"><Input type="email" value={party.email ?? ''} onChange={(e) => setParty({ email: e.target.value || null })} /></Field><Field label="Telefon"><Input value={party.phone ?? ''} onChange={(e) => setParty({ phone: e.target.value || null })} /></Field></> : null}
                  <Field label="Belegart"><Select value={data!.kind} onChange={(e) => setField('kind', e.target.value as InvoiceData['kind'])}>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
                  <Field label={direction === 'outgoing' ? 'Rechnungsnummer *' : 'Rechnungs-/Belegnummer'}><Input value={data!.number ?? ''} onChange={(e) => setField('number', e.target.value || null)} /></Field>
                  <Field label="Rechnungsdatum *"><Input type="date" value={data!.issueDate ?? ''} onChange={(e) => setField('issueDate', e.target.value || null)} /></Field>
                  <Field label="Fällig am"><Input type="date" value={data!.dueDate ?? ''} onChange={(e) => setField('dueDate', e.target.value || null)} /></Field>
                  <Field label="Netto (€)"><Input inputMode="decimal" defaultValue={money(data!.netCents)} key={`n${data!.netCents}`} readOnly={vatRate === 'mixed'} onBlur={(e) => setAmount('netCents', parseMoney(e.target.value))} /></Field>
                  <Field label="MwSt.-Satz" hint="Satz wählen und Brutto eingeben – Netto und MwSt. werden berechnet."><Select value={vatRate} onChange={(e) => setVatRate(e.target.value)}><option value="">–</option><option value="19">19 %</option><option value="7">7 %</option><option value="0">0 % (steuerfrei / § 19 UStG{direction === 'incoming' ? ' / ausländische USt.' : ''})</option><option value="16">16 % (Jul.–Dez. 2020)</option><option value="5">5 % (Jul.–Dez. 2020)</option><option value="mixed">mehrere Sätze</option></Select></Field>
                  <Field label="MwSt. (€)"><Input inputMode="decimal" defaultValue={money(data!.vatCents)} key={`v${data!.vatCents}`} readOnly={vatRate === 'mixed'} onBlur={(e) => setAmount('vatCents', parseMoney(e.target.value))} /></Field>
                  <Field label="Brutto (€) *" error={arithmeticOk ? undefined : 'Netto + MwSt. ergibt nicht Brutto'}><Input inputMode="decimal" defaultValue={money(data!.grossCents)} key={`g${data!.grossCents}`} readOnly={vatRate === 'mixed'} onBlur={(e) => setAmount('grossCents', parseMoney(e.target.value))} /></Field>
                  {vatRate === 'mixed' ? (
                    <div className="span-2 stack" style={{ gap: 6 }}>
                      <div className="small muted">Aufteilung nach Steuersätzen – Netto, MwSt. und Brutto ergeben sich aus der Summe.</div>
                      {data!.vat.map((v, i) => (
                        <div key={i} className="import-vat">
                          <Select aria-label="Steuersatz" value={String(v.vatBp)} onChange={(e) => { const bp = Number(e.target.value); setBreakdown(data!.vat.map((x, j) => (j === i ? { vatBp: bp, netCents: x.netCents, vatCents: Math.round((x.netCents * bp) / 10000) } : x))); }}>{[1900, 1600, 700, 500, 0].concat([1900, 1600, 700, 500, 0].includes(v.vatBp) ? [] : [v.vatBp]).map((bp) => <option key={bp} value={bp}>{bp / 100} %</option>)}</Select>
                          <Input aria-label="Netto" inputMode="decimal" placeholder="Netto" defaultValue={money(v.netCents)} key={`vn${i}-${v.netCents}`} onBlur={(e) => { const n = parseMoney(e.target.value) ?? 0; if (n !== v.netCents) setBreakdown(data!.vat.map((x, j) => (j === i ? { ...x, netCents: n, vatCents: Math.round((n * x.vatBp) / 10000) } : x))); }} />
                          <Input aria-label="MwSt." inputMode="decimal" placeholder="MwSt." defaultValue={money(v.vatCents)} key={`vv${i}-${v.vatCents}`} onBlur={(e) => { const t = parseMoney(e.target.value) ?? 0; if (t !== v.vatCents) setBreakdown(data!.vat.map((x, j) => (j === i ? { ...x, vatCents: t } : x))); }} />
                          <button className="btn ghost icon" type="button" aria-label="Steuersatz entfernen" disabled={data!.vat.length <= 1} onClick={() => setBreakdown(data!.vat.filter((_, j) => j !== i))}><X size={14} /></button>
                        </div>
                      ))}
                      <div><Button size="sm" variant="ghost" onClick={() => setBreakdown([...data!.vat, { vatBp: 700, netCents: 0, vatCents: 0 }])}><Plus /> Steuersatz</Button></div>
                    </div>
                  ) : null}
                  {direction === 'incoming' && vatRate === '0' ? <p className="small muted span-2">Ausländische Umsatzsteuer (z. B. 20 %) ist in der deutschen Umsatzsteuer-Voranmeldung nicht als Vorsteuer abziehbar – mit 0 % wird der Bruttobetrag als Kosten erfasst. Im Zweifel mit dem Steuerberater klären.</p> : null}
                  {direction === 'incoming' ? <Field label="Kategorie"><Select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">automatisch</option>{categories.map((c) => <option key={c}>{c}</option>)}</Select></Field> : null}
                  <label className="check span-2"><input type="checkbox" checked={markPaid} onChange={(e) => setMarkPaid(e.target.checked)} /> Bereits bezahlt</label>
                  {isDuplicateNoNumber ? <label className="check span-2"><input type="checkbox" checked={allowDuplicate} onChange={(e) => setAllowDuplicate(e.target.checked)} /> Kein Duplikat – es ist ein weiterer, gleicher Beleg (trotzdem erfassen)</label> : null}
                </div>
                <Card title={`Positionen (${data!.lines.length})`} tight actions={<Button size="sm" variant="ghost" onClick={() => setField('lines', [...data!.lines, { name: '', description: null, quantity: 1, unit: null, unitNetCents: null, netCents: 0, vatBp: data!.vat[0]?.vatBp ?? null }])}><Plus /> Position</Button>}>
                  {data!.lines.length === 0 ? <p className="small muted" style={{ padding: '4px 14px 12px' }}>Ohne Positionen wird eine Sammelposition über den Nettobetrag angelegt.</p> : (
                    <div className="stack" style={{ gap: 6, padding: '4px 14px 12px' }}>
                      {data!.lines.map((l, i) => (
                        <div key={i} className="import-line">
                          <Input value={l.name} placeholder="Bezeichnung" onChange={(e) => setField('lines', data!.lines.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                          <Input inputMode="decimal" defaultValue={money(l.netCents)} key={`l${i}-${l.netCents}`} placeholder="Netto" onBlur={(e) => { const v = parseMoney(e.target.value) ?? 0; if (v !== l.netCents) setField('lines', data!.lines.map((x, j) => (j === i ? { ...x, netCents: v, unitNetCents: null, quantity: 1 } : x))); }} />
                          <button className="btn ghost icon" type="button" aria-label="Position entfernen" onClick={() => setField('lines', data!.lines.filter((_, j) => j !== i))}><X size={14} /></button>
                        </div>
                      ))}
                      <div className="small muted">Summe Positionen netto: {fmtMoney(sumLines)}{data!.netCents !== null && Math.abs(sumLines - data!.netCents) > Math.max(2, data!.lines.length) ? ' – weicht vom Nettobetrag ab (z. B. Rabatt); übernommen wird der Rechnungsbetrag.' : ''}</div>
                    </div>
                  )}
                </Card>
                <div className="form-actions" style={{ flexWrap: 'wrap' }}>
                  <Button variant="ghost" onClick={() => setConfirm('discard')}><Trash2 /> Verwerfen</Button>
                  {imp.method !== 'einvoice_cii' && imp.method !== 'einvoice_ubl' ? <Button onClick={() => retry.mutate()} loading={retry.isPending}><RefreshCw /> Erneut auslesen</Button> : null}
                  <Button variant="primary" onClick={() => apply.mutate()} loading={apply.isPending} disabled={(direction === 'outgoing' && ((customerMode === 'other' && !other) || (customerMode === 'candidate' && !candidateId))) || (isDuplicateNoNumber && !allowDuplicate)}><CheckCircle2 /> Prüfen und übernehmen</Button>
                </div>
              </>
            ) : null}
            {canWrite && ((imp.status === 'duplicate' && !isDuplicateNoNumber) || (imp.status === 'failed' && !data)) ? <div className="form-actions" style={{ justifyContent: 'flex-start' }}><Button variant="ghost" onClick={() => setConfirm('discard')}><Trash2 /> Verwerfen</Button>{imp.status === 'failed' ? <Button onClick={() => retry.mutate()} loading={retry.isPending}><RefreshCw /> Erneut auslesen</Button> : null}</div> : null}
          </div>
        </div>
      )}
      {confirm === 'discard' ? <Confirm title="Beleg verwerfen?" text="Der Beleg wird nicht übernommen und die hochgeladene Datei gelöscht." confirmLabel="Verwerfen" danger loading={discard.isPending} onConfirm={() => discard.mutate()} onClose={() => setConfirm(null)} /> : null}
      {confirm === 'undo' ? <Confirm title="Übernahme rückgängig machen?" text={direction === 'outgoing' ? 'Die importierte Rechnung wird entfernt. Ein nur dafür neu angelegter Kunde ohne weitere Daten wird ebenfalls entfernt. Der Beleg bleibt erhalten und steht wieder unter „Prüfen“ – dort korrigieren und erneut übernehmen oder verwerfen.' : 'Die erfassten Ausgaben werden entfernt. Der Beleg bleibt erhalten und steht wieder unter „Prüfen“.'} confirmLabel="Rückgängig machen" danger loading={undo.isPending} onConfirm={() => undo.mutate()} onClose={() => setConfirm(null)} /> : null}
    </Modal>
  );
}
