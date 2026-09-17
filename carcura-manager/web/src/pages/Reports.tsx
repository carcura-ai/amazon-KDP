import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileDown, Sparkles } from 'lucide-react';
import { get, post, qs } from '../api/client';
import type { ReportContent, ReportRow } from '../api/types';
import { useAuth } from '../app/auth';
import { Badge, Button, Card, Empty, PageHead, Select, Skeleton, useToast } from '../components/ui';
import { fmtDate, fmtDateTime, fmtMoney } from '../lib/format';

const TYPE_LABEL: Record<string, string> = { weekly: 'Wochenbericht', monthly: 'Monatsbericht', yearly: 'Jahresbericht' };

export function ReportsPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [type, setType] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [gen, setGen] = useState<{ type: string; current: boolean }>({ type: 'weekly', current: false });
  const list = useQuery({ queryKey: ['reports', type], queryFn: () => get<{ items: ReportRow[] }>(`/api/reports${qs({ type })}`) });
  const detail = useQuery({ queryKey: ['report', selected], queryFn: () => get<ReportRow & { content: ReportContent }>(`/api/reports/${selected}`), enabled: Boolean(selected) });
  const generate = useMutation({ mutationFn: () => post<{ id: string; sentTo: string | null }>('/api/reports/generate', { type: gen.type, current: gen.current, email: false }), onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['reports'] }); setSelected(r.id); toast.ok('Bericht erstellt'); }, onError: (e) => toast.fromError(e) });
  const c = detail.data?.content;
  return (
    <>
      <PageHead title="Berichte" sub="Automatische Wochen-, Monats- und Jahresberichte: Zahlen, Veränderungen, mögliche Ursachen und Empfehlungen. Wochenberichte montags 6 Uhr, Monatsberichte am 1., Jahresberichte am 2. Januar." actions={can('reports:read') ? <div className="row"><Select value={gen.type} onChange={(e) => setGen({ ...gen, type: e.target.value })} style={{ width: 'auto' }}><option value="weekly">Woche</option><option value="monthly">Monat</option><option value="yearly">Jahr</option></Select><label className="check small"><input type="checkbox" checked={gen.current} onChange={(e) => setGen({ ...gen, current: e.target.checked })} /> laufende Periode</label><Button variant="primary" onClick={() => generate.mutate()} loading={generate.isPending}><Sparkles /> Jetzt erstellen</Button></div> : null} />
      <div className="grid main-side" style={{ gridTemplateColumns: 'minmax(260px, 1fr) minmax(0, 2.4fr)' }}>
        <Card title="Berichte" tight actions={<Select value={type} onChange={(e) => setType(e.target.value)} style={{ width: 'auto' }}><option value="">Alle</option><option value="weekly">Woche</option><option value="monthly">Monat</option><option value="yearly">Jahr</option></Select>}>
          {list.isLoading ? <Skeleton /> : list.data?.items.length === 0 ? <Empty title="Noch keine Berichte" text="Der erste Wochenbericht entsteht automatisch am kommenden Montag – oder jetzt manuell." /> : list.data?.items.map((r) => (
            <div key={r.id} className="doc-row" style={{ cursor: 'pointer', background: selected === r.id ? 'var(--bg-hover)' : undefined }} onClick={() => setSelected(r.id)}>
              <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontWeight: 600 }}>{r.title}</div><div className="small muted">{fmtDateTime(r.generatedAt)}{r.sentTo ? ` · gesendet an ${r.sentTo}` : ''}</div></div>
              <Badge plain>{TYPE_LABEL[r.type]}</Badge>
              {r.pdfFileId ? <a className="btn sm ghost" href={`/api/reports/${r.id}/pdf`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><FileDown /></a> : null}
            </div>
          ))}
        </Card>
        <div>
          {!selected ? <Card><div className="empty"><h3>Bericht auswählen</h3><p>Links einen Bericht wählen oder einen neuen erstellen.</p></div></Card> : detail.isLoading || !c ? <Card><Skeleton /></Card> : (
            <div className="stack" style={{ gap: 16 }}>
              <Card title={detail.data?.title} actions={detail.data?.pdfFileId ? <a className="btn sm" href={`/api/reports/${selected}/pdf`} target="_blank" rel="noreferrer"><FileDown /> PDF</a> : null}>
                <p style={{ fontSize: 15 }}><b>Kurzfassung:</b> {c.summary}</p>
                <p className="small dim" style={{ marginTop: 6 }}>Zeitraum {fmtDate(c.period.from)} – {fmtDate(c.period.to)} · Vergleich {fmtDate(c.period.prevFrom)} – {fmtDate(c.period.prevTo)} · Fakt = gemessen, Veränderung = berechnet, Ursache = Interpretation, Empfehlung = Vorschlag.</p>
              </Card>
              {c.sections.map((s) => (
                <Card key={s.title} title={s.title}>
                  {s.metrics.length ? <div className="grid cols-4" style={{ marginBottom: 12 }}>{s.metrics.map((m) => { const p = m.prev > 0 ? Math.round(((m.value - m.prev) / m.prev) * 100) : null; return <div key={m.label} className="card kpi" style={{ boxShadow: 'none' }}><div className="label">{m.label}</div><div className="value" style={{ fontSize: 20 }}>{m.unit === 'eur' ? fmtMoney(m.value) : m.value}</div><div className={`delta ${p === null ? '' : p >= 0 ? 'up' : 'down'}`}>{p === null ? `Vorperiode ${m.unit === 'eur' ? fmtMoney(m.prev) : m.prev}` : `${p >= 0 ? '+' : ''}${p} % (${m.unit === 'eur' ? fmtMoney(m.prev) : m.prev})`}</div></div>; })}</div> : null}
                  {[['Fakten', s.facts, 'fact'], ['Was hat sich verändert', s.changes, 'calc'], ['Mögliche Ursachen', s.reasons, 'estimate'], ['Empfehlungen', s.actions, 'advice']].map(([t, items, k]) => (items as string[]).length ? <div key={t as string} style={{ marginTop: 8 }}><div className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{t as string}</div><div className="hint-list">{(items as string[]).map((x, i) => <div key={i} className={`hint ${k === 'advice' ? 'warn' : ''}`}><span>{x}</span></div>)}</div></div> : null)}
                  {s.table ? <div className="table-wrap" style={{ marginTop: 10 }}><table className="table"><thead><tr>{s.table.head.map((h, i) => <th key={h} className={i ? 'num' : ''}>{h}</th>)}</tr></thead><tbody>{s.table.rows.map((r, i) => <tr key={i}>{r.map((cell, j) => <td key={j} className={j ? 'num' : ''}>{cell}</td>)}</tr>)}</tbody></table></div> : null}
                </Card>
              ))}
              {c.months ? <Card title="Monat für Monat" tight><div className="table-wrap"><table className="table"><thead><tr><th>Monat</th><th className="num">Umsatz</th><th className="num">Kosten</th><th className="num">Gewinn</th><th className="num">Leads</th><th className="num">Aufträge</th></tr></thead><tbody>{c.months.map((m) => <tr key={m.label}><td>{m.label}</td><td className="num">{fmtMoney(m.revenueCents)}</td><td className="num">{fmtMoney(m.expensesCents)}</td><td className="num">{fmtMoney(m.revenueCents - m.expensesCents)}</td><td className="num">{m.leads}</td><td className="num">{m.orders}</td></tr>)}</tbody></table></div></Card> : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
