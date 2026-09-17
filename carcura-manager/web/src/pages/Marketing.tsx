import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { RefreshCw, Settings } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from 'recharts';
import { get, post, qs } from '../api/client';
import type { MarketingOverview } from '../api/types';
import { useAuth } from '../app/auth';
import { Badge, Button, Card, Kpi, PageHead, Skeleton, useToast } from '../components/ui';
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber, fmtPct, toDateInput, HINT_KIND, LEAD_SOURCE } from '../lib/format';

const RANGES: Array<{ id: string; label: string; days: number }> = [{ id: '7', label: '7 Tage', days: 7 }, { id: '30', label: '30 Tage', days: 30 }, { id: '90', label: '90 Tage', days: 90 }, { id: '365', label: '12 Monate', days: 365 }];
const tooltipStyle = { background: 'var(--bg-card)', border: '1px solid var(--line-strong)', borderRadius: 8, color: 'var(--fg)' };
const delta = (cur: number, prev: number) => (prev ? `${cur - prev >= 0 ? '+' : ''}${Math.round(((cur - prev) / prev) * 100)} % zur Vorperiode` : 'keine Vorperiode');

export function MarketingPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [range, setRange] = useState('30');
  const days = RANGES.find((r) => r.id === range)!.days;
  const to = toDateInput(new Date());
  const from = toDateInput(new Date(Date.now() - (days - 1) * 86_400_000));
  const q = useQuery({ queryKey: ['marketing', from, to], queryFn: () => get<MarketingOverview>(`/api/marketing/overview${qs({ from, to })}`) });
  const sync = useMutation({ mutationFn: () => post<{ results: Array<{ type: string; ok: boolean; rows: number; leadsImported?: number; error?: string }> }>('/api/marketing/sync', { days: Math.max(days, 30) }), onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['marketing'] }); qc.invalidateQueries({ queryKey: ['leads'] }); const failed = r.results.filter((x) => !x.ok); if (r.results.length === 0) toast.info('Keine Integration eingerichtet', 'Unter Einstellungen → Integrationen anbinden.'); else if (failed.length) toast.error(`${failed.length} Sync fehlgeschlagen`, failed.map((f) => `${f.type}: ${f.error}`).join(' · ')); else toast.ok('Synchronisiert', r.results.map((x) => `${x.type}: ${x.rows} Datensätze${x.leadsImported ? `, ${x.leadsImported} Leads importiert` : ''}`).join(' · ')); }, onError: (e) => toast.fromError(e) });
  const d = q.data;
  return (
    <>
      <PageHead title="Marketing" sub="Google Ads, Meta Ads, Website, Social Media und die tatsächliche Lead- und Umsatzwirkung aus dem CRM." actions={<>{can('integrations:manage') ? <Link className="btn" to="/einstellungen/integrationen"><Settings /> Anbindungen</Link> : null}{can('integrations:manage') ? <Button variant="primary" onClick={() => sync.mutate()} loading={sync.isPending}><RefreshCw /> Jetzt synchronisieren</Button> : null}</>} />
      <Card tight><div className="cal-head"><div className="seg">{RANGES.map((r) => <button key={r.id} className={range === r.id ? 'active' : ''} onClick={() => setRange(r.id)}>{r.label}</button>)}</div><div className="title">{fmtDate(from)} – {fmtDate(to)}</div>{d ? <div className="row small muted" style={{ marginLeft: 'auto' }}>{Object.entries(d.lastSync).map(([t, s]) => <span key={t} className="row"><Badge tone={s.status === 'ok' ? 'ok' : s.status === 'error' ? 'danger' : ''} plain>{t}</Badge>{s.at ? fmtDateTime(s.at) : 'nie'}</span>)}</div> : null}</div></Card>
      {q.isLoading || !d ? <div style={{ marginTop: 16 }}><Card><Skeleton /></Card></div> : (
        <div className="stack" style={{ gap: 16, marginTop: 16 }}>
          <div className="grid cols-4">
            <Kpi label="Werbekosten" value={fmtMoney(d.totals.costCents)} accent delta={`${fmtNumber(d.totals.impressions)} Impressionen · ${fmtNumber(d.totals.clicks)} Klicks`} />
            <Kpi label="Leads (CRM, alle Quellen)" value={d.totals.crmLeads} delta={`${d.totals.wonLeads} gewonnen · Conversion ${fmtPct(d.totals.conversionRate)}`} />
            <Kpi label="Kosten pro Lead (bezahlte Quellen)" value={d.totals.costPerLeadCents === null ? '–' : fmtMoney(d.totals.costPerLeadCents)} delta={d.totals.costPerLeadCents === null ? 'keine bezahlten Leads im Zeitraum' : 'Werbekosten ÷ CRM-Leads aus Google/Meta'} />
            <Kpi label="Umsatz aus Werbung / ROAS" value={fmtMoney(d.totals.revenueCents)} delta={d.totals.roas === null ? 'keine Kosten' : `ROAS ${d.totals.roas} · Umsatz netto von Kunden mit Quelle Google/Meta`} />
          </div>
          <div className="grid cols-2">
            {d.sources.map((s) => (
              <Card key={s.source} title={s.label} actions={<Badge tone={s.costCents ? 'brand' : ''} plain>{s.costCents ? 'aktiv' : 'keine Kosten'}</Badge>}>
                <div className="grid cols-3" style={{ gap: 10 }}>
                  <div><div className="small muted">Kosten</div><div style={{ fontWeight: 700, fontSize: 18 }}>{fmtMoney(s.costCents)}</div><div className="small dim">{delta(s.costCents, s.prev.costCents)}</div></div>
                  <div><div className="small muted">Klicks / CTR</div><div style={{ fontWeight: 700, fontSize: 18 }}>{fmtNumber(s.clicks)}</div><div className="small dim">{fmtPct(s.ctr, 2)} · {fmtNumber(s.impressions)} Impr.</div></div>
                  <div><div className="small muted">Leads Plattform / CRM</div><div style={{ fontWeight: 700, fontSize: 18 }}>{s.platformLeads} / {s.crmLeads}</div><div className="small dim">{s.wonLeads} gewonnen</div></div>
                  <div><div className="small muted">Kosten pro Lead</div><div style={{ fontWeight: 700 }}>{s.costPerLeadCents === null ? '–' : fmtMoney(s.costPerLeadCents)}</div></div>
                  <div><div className="small muted">Umsatz (netto)</div><div style={{ fontWeight: 700 }}>{fmtMoney(s.revenueCents)}</div></div>
                  <div><div className="small muted">ROAS</div><div style={{ fontWeight: 700 }}>{s.roas ?? '–'}</div></div>
                </div>
              </Card>
            ))}
          </div>
          <div className="grid main-side">
            <Card title="Kosten und Leads je Tag">
              <div style={{ width: '100%', height: 260 }}><ResponsiveContainer><BarChart data={d.series.map((s) => ({ name: fmtDate(s.date).slice(0, 5), 'Google Ads': s.googleCostCents / 100, 'Meta Ads': s.metaCostCents / 100, Leads: s.leads }))}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="name" tick={{ fill: 'var(--fg-muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" /><YAxis yAxisId="l" tick={{ fill: 'var(--fg-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v: number) => `${v} €`} /><YAxis yAxisId="r" orientation="right" tick={{ fill: 'var(--fg-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={30} allowDecimals={false} /><Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--bg-hover)' }} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar yAxisId="l" dataKey="Google Ads" stackId="c" fill="var(--brand)" /><Bar yAxisId="l" dataKey="Meta Ads" stackId="c" fill="#60a5fa" radius={[4, 4, 0, 0]} /><Bar yAxisId="r" dataKey="Leads" fill="#34d399" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
            </Card>
            <div className="stack" style={{ gap: 16 }}>
              <Card title="Analyse"><div className="hint-list">{d.hints.map((h, i) => <div key={i} className={`hint ${h.level}`}><span className="tag">{HINT_KIND[h.kind]}</span><span>{h.text}</span></div>)}</div></Card>
              <Card title="Leads nach Quelle (CRM)">{d.leadsBySource.length === 0 ? <p className="muted">Keine Leads im Zeitraum.</p> : <div className="stack" style={{ gap: 8 }}>{d.leadsBySource.sort((a, b) => b.n - a.n).map((s) => { const pct = d.totals.crmLeads ? Math.round((s.n / d.totals.crmLeads) * 100) : 0; return <div key={s.source}><div className="spread small"><span>{LEAD_SOURCE[s.source] ?? s.source}</span><span className="muted">{s.n} · {s.won} gewonnen · {pct} %</span></div><div style={{ height: 6, background: 'var(--bg-hover)', borderRadius: 4, marginTop: 4 }}><div style={{ width: `${pct}%`, height: '100%', background: 'var(--brand)', borderRadius: 4 }} /></div></div>; })}</div>}</Card>
            </div>
          </div>
          <Card title="Kampagnen" tight>
            {d.campaigns.length === 0 ? <p className="muted" style={{ padding: 18 }}>{d.configured.ads ? 'Keine Kampagnendaten im Zeitraum. Synchronisieren, um Daten abzurufen.' : 'Keine Werbeanbindung eingerichtet.'}</p> : <div className="table-wrap"><table className="table"><thead><tr><th>Kampagne</th><th>Quelle</th><th className="num">Impressionen</th><th className="num">Klicks</th><th className="num">Kosten</th><th className="num">Leads (Plattform)</th><th className="num">Leads (CRM)</th><th className="num">Kosten/Lead</th></tr></thead><tbody>{d.campaigns.map((c) => <tr key={c.source + c.campaignId}><td className="primary">{c.campaignName}</td><td>{LEAD_SOURCE[c.source] ?? c.source}</td><td className="num">{fmtNumber(c.impressions)}</td><td className="num">{fmtNumber(c.clicks)}</td><td className="num">{fmtMoney(c.costCents)}</td><td className="num">{c.platformLeads}</td><td className="num">{c.crmLeads}</td><td className="num">{c.crmLeads ? fmtMoney(Math.round(c.costCents / c.crmLeads)) : c.platformLeads ? <span className="muted">{fmtMoney(Math.round(c.costCents / c.platformLeads))}*</span> : '–'}</td></tr>)}</tbody></table><p className="small dim" style={{ padding: '8px 14px' }}>* auf Basis der Plattform-Leads, da im CRM keine Leads dieser Kampagne zugeordnet sind.</p></div>}
          </Card>
          <div className="grid cols-3">
            <Card title="Website (Google Analytics)">
              {!d.web ? <p className="muted">{d.configured.web ? 'Noch keine Daten – bitte synchronisieren.' : 'Keine Website-Anbindung eingerichtet.'}</p> : (
                <div className="stack" style={{ gap: 10 }}>
                  <div className="grid cols-2" style={{ gap: 8 }}><div><div className="small muted">Sitzungen</div><div style={{ fontWeight: 700, fontSize: 20 }}>{fmtNumber(d.web.sessions)}</div><div className="small dim">{delta(d.web.sessions, d.web.prev.sessions)}</div></div><div><div className="small muted">Besucher</div><div style={{ fontWeight: 700, fontSize: 20 }}>{fmtNumber(d.web.users)}</div><div className="small dim">{delta(d.web.users, d.web.prev.users)}</div></div><div><div className="small muted">Seitenaufrufe</div><div style={{ fontWeight: 700 }}>{d.web.pageviews ? fmtNumber(d.web.pageviews) : '–'}</div></div><div><div className="small muted">Conversions (Key Events)</div><div style={{ fontWeight: 700 }}>{fmtNumber(Math.round(d.web.conversions))}</div></div></div>
                  <div><div className="small muted" style={{ marginBottom: 4 }}>Kanäle</div>{d.web.channels.map((c) => <div key={c.name} className="spread small"><span>{c.name || '–'}</span><span className="muted">{c.sessions}</span></div>)}</div>
                  <div><div className="small muted" style={{ marginBottom: 4 }}>Geräte</div>{d.web.devices.map((c) => <div key={c.name} className="spread small"><span>{c.name || '–'}</span><span className="muted">{c.sessions}</span></div>)}</div>
                  <div><div className="small muted" style={{ marginBottom: 4 }}>Landingpages</div>{d.web.landingPages.slice(0, 6).map((c) => <div key={c.name} className="spread small"><span className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{c.name || '/'}</span><span className="muted">{c.sessions}</span></div>)}</div>
                </div>
              )}
            </Card>
            <Card title="Instagram">
              {!d.social ? <p className="muted">{d.configured.social ? 'Noch keine Daten – bitte synchronisieren.' : 'Keine Social-Anbindung (Windsor.ai) eingerichtet.'}</p> : (
                <div className="grid cols-2" style={{ gap: 8 }}><div><div className="small muted">Follower</div><div style={{ fontWeight: 700, fontSize: 20 }}>{d.social.followers ?? '–'}</div><div className="small dim">{d.social.followers !== null && d.social.followersPrev !== null ? `${d.social.followers - d.social.followersPrev >= 0 ? '+' : ''}${d.social.followers - d.social.followersPrev} im Zeitraum` : 'kein Vergleich'}</div></div><div><div className="small muted">Reichweite</div><div style={{ fontWeight: 700, fontSize: 20 }}>{fmtNumber(d.social.reach)}</div><div className="small dim">{delta(d.social.reach, d.social.prev.reach)}</div></div><div><div className="small muted">Aufrufe</div><div style={{ fontWeight: 700 }}>{fmtNumber(d.social.views)}</div><div className="small dim">{delta(d.social.views, d.social.prev.views)}</div></div><div><div className="small muted">Likes · Kommentare · Shares</div><div style={{ fontWeight: 700 }}>{d.social.likes} · {d.social.comments} · {d.social.shares}</div></div></div>
              )}
            </Card>
            <Card title="Google Suche (Search Console)">
              {!d.seo ? <p className="muted">{d.configured.seo ? 'Noch keine Daten – bitte synchronisieren.' : 'Keine Search-Console-Anbindung eingerichtet.'}</p> : (
                <div className="stack" style={{ gap: 10 }}>
                  <div className="grid cols-2" style={{ gap: 8 }}><div><div className="small muted">Klicks</div><div style={{ fontWeight: 700, fontSize: 20 }}>{fmtNumber(d.seo.clicks)}</div><div className="small dim">{delta(d.seo.clicks, d.seo.prev.clicks)}</div></div><div><div className="small muted">Impressionen</div><div style={{ fontWeight: 700, fontSize: 20 }}>{fmtNumber(d.seo.impressions)}</div><div className="small dim">Ø Position {d.seo.position ?? '–'}</div></div></div>
                  <div><div className="small muted" style={{ marginBottom: 4 }}>Top-Suchanfragen</div>{d.seo.queries.slice(0, 8).map((c) => <div key={c.name} className="spread small"><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{c.name}</span><span className="muted">{c.clicks} · Pos. {c.position?.toFixed(1) ?? '–'}</span></div>)}</div>
                </div>
              )}
            </Card>
          </div>
          {d.web ? <Card title="Website-Sitzungen je Tag"><div style={{ width: '100%', height: 180 }}><ResponsiveContainer><LineChart data={d.series.map((s) => ({ name: fmtDate(s.date).slice(0, 5), Sitzungen: s.sessions }))}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="name" tick={{ fill: 'var(--fg-muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" /><YAxis tick={{ fill: 'var(--fg-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={30} allowDecimals={false} /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="Sitzungen" stroke="var(--brand)" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div></Card> : null}
        </div>
      )}
    </>
  );
}
