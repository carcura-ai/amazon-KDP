import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { get } from '../api/client';
import type { Dashboard } from '../api/types';
import { useAuth } from '../app/auth';
import { Card, Kpi, PageHead, Skeleton, Badge, Empty } from '../components/ui';
import { fmtRelative, fmtMoney, fmtDateTime, LEAD_SOURCE, LEAD_STATUS, personName } from '../lib/format';

export function DashboardPage() {
  const { me } = useAuth();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => get<Dashboard>('/api/dashboard'), refetchInterval: 60_000 });
  const d = q.data;
  const weekDelta = d && d.leads.lastWeek > 0 ? Math.round(((d.leads.thisWeek - d.leads.lastWeek) / d.leads.lastWeek) * 100) : null;

  return (
    <>
      <PageHead title={`Guten Tag, ${me?.user.firstName}`} sub="Überblick aus echten Systemdaten. Umsatz = ausgestellte Rechnungen nach Rechnungsdatum (brutto)." />
      {q.isLoading || !d ? (
        <Card><Skeleton rows={5} /></Card>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          <div className="grid cols-4">
            <Kpi label="Umsatz heute" value={fmtMoney(d.revenue.todayCents)} accent delta={`Woche ${fmtMoney(d.revenue.weekCents)}`} />
            <Kpi label="Umsatz diesen Monat" value={fmtMoney(d.revenue.monthCents)} delta={`${d.revenue.monthCount} Rechnungen · Jahr ${fmtMoney(d.revenue.yearCents)}`} />
            <Kpi label="Offene Rechnungen" value={fmtMoney(d.revenue.openCents)} delta={`${d.revenue.openCount} offen`} />
            <Kpi label="Überfällig" value={fmtMoney(d.revenue.overdueCents)} delta={d.revenue.overdueCount ? `${d.revenue.overdueCount} Rechnung${d.revenue.overdueCount === 1 ? '' : 'en'} überfällig` : 'nichts überfällig'} tone={d.revenue.overdueCount ? 'down' : undefined} />
          </div>
          <div className="grid cols-4">
            <Kpi label="Neue Leads (unbearbeitet)" value={d.leads.new} delta={`${d.leads.today} heute eingegangen`} />
            <Kpi label="Leads diese Woche" value={d.leads.thisWeek} delta={weekDelta === null ? `Vorwoche: ${d.leads.lastWeek}` : `${weekDelta > 0 ? '+' : ''}${weekDelta} % zur Vorwoche (${d.leads.lastWeek})`} tone={weekDelta === null ? undefined : weekDelta >= 0 ? 'up' : 'down'} />
            <Kpi label="Offene Leads" value={d.leads.open} delta={d.leads.conversionRateMonth === null ? 'Conversion: noch keine abgeschlossenen Leads diesen Monat' : `Conversion diesen Monat: ${d.leads.conversionRateMonth} %`} />
            <Kpi label="Kunden" value={d.customers.total} delta={`${d.customers.thisMonth} neu diesen Monat · ${d.vehicles.total} Fahrzeuge`} />
          </div>
          <div className="grid cols-4" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
            <Kpi label="Termine heute" value={d.appointments.today} delta={`${d.appointments.next7Days} in den nächsten 7 Tagen`} />
            <Kpi label="Fahrzeuge in Bearbeitung" value={d.orders.inProgress} delta={d.orders.ready > 0 ? `${d.orders.ready} fertig, wartet auf Abholung` : 'kein fertiges Fahrzeug wartet'} tone={d.orders.ready > 0 ? 'up' : undefined} />
            <Kpi label="Abgeschlossene Aufträge (Monat)" value={d.orders.completedMonth} delta={`Auftragsvolumen ${fmtMoney(d.orders.completedMonthCents)} brutto`} />
            <Kpi label="Gewinn diesen Monat (netto)" value={fmtMoney(d.finance.profitNetMonthCents)} tone={d.finance.profitNetMonthCents >= 0 ? 'up' : 'down'} delta={`Umsatz ${fmtMoney(d.finance.revenueNetMonthCents)} · Kosten ${fmtMoney(d.finance.expensesNetMonthCents)}${d.finance.lowStockCount ? ` · ${d.finance.lowStockCount} Lagerwarnung${d.finance.lowStockCount === 1 ? '' : 'en'}` : ''}`} />
            <Kpi label="Nächster Termin" value={d.appointments.next[0] ? fmtDateTime(d.appointments.next[0].startsAt) : '–'} delta={d.appointments.next[0] ? `${d.appointments.next[0].title}${d.appointments.next[0].customerName ? ' · ' + d.appointments.next[0].customerName : ''}` : 'kein Termin geplant'} />
          </div>
          <div className="grid main-side">
            <Card title="Zuletzt eingegangene Leads" tight actions={<Link className="btn sm" to="/leads">Alle Leads</Link>}>
              {d.recentLeads.length === 0 ? (
                <Empty title="Noch keine Leads" text="Leads entstehen über das Website-Formular, Werbekampagnen oder manuell." action={<Link className="btn primary" to="/leads">Lead anlegen</Link>} />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Name</th><th>Leistung</th><th>Quelle</th><th>Status</th><th>Eingang</th></tr></thead>
                    <tbody>
                      {d.recentLeads.map((l) => (
                        <tr key={l.id} className="row-link" onClick={() => (window.location.href = `/leads/${l.id}`)}>
                          <td><div className="primary">{personName(l)}</div><div className="secondary">{l.phone ?? l.email ?? ''}</div></td>
                          <td className="muted">{l.requestedService ?? '–'}</td>
                          <td>{LEAD_SOURCE[l.source] ?? l.source}</td>
                          <td><Badge tone={LEAD_STATUS[l.status]?.tone}>{LEAD_STATUS[l.status]?.label ?? l.status}</Badge></td>
                          <td className="muted">{fmtRelative(l.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <div className="stack" style={{ gap: 16 }}>
              <Card title="Kommende Termine" tight actions={<Link className="btn sm" to="/kalender">Kalender</Link>}>
                {d.appointments.next.length === 0 ? <p className="muted" style={{ padding: 18 }}>Keine Termine geplant.</p> : d.appointments.next.map((a) => (
                  <Link key={a.id} to="/kalender" className="list-evt" style={{ gridTemplateColumns: '1fr' }}>
                    <div><div style={{ fontWeight: 600 }}>{fmtDateTime(a.startsAt)} · {a.title}</div><div className="small muted">{[a.customerName, a.vehicleLabel].filter(Boolean).join(' · ') || 'ohne Kunde'}</div></div>
                  </Link>
                ))}
              </Card>
              <Card title="Hinweise">
                {d.hints.length === 0 ? <p className="muted">Keine Auffälligkeiten.</p> : (
                  <div className="hint-list">
                    {d.hints.map((h, i) => (
                      <div key={i} className={`hint ${h.level}`}><span className="tag">{h.kind === 'fact' ? 'Fakt' : 'Berechnung'}</span><span>{h.text}</span></div>
                    ))}
                  </div>
                )}
              </Card>
              <Card title="Lead-Quellen diesen Monat">
                {d.leads.bySource.length === 0 ? <p className="muted">Noch keine Leads in diesem Monat.</p> : (
                  <div className="stack" style={{ gap: 8 }}>
                    {d.leads.bySource.sort((a, b) => b.n - a.n).map((s) => {
                      const pct = d.leads.thisMonth ? Math.round((s.n / d.leads.thisMonth) * 100) : 0;
                      return (
                        <div key={s.source}>
                          <div className="spread small"><span>{LEAD_SOURCE[s.source] ?? s.source}</span><span className="muted">{s.n} · {pct} %</span></div>
                          <div style={{ height: 6, background: 'var(--bg-hover)', borderRadius: 4, marginTop: 4 }}><div style={{ width: `${pct}%`, height: '100%', background: 'var(--brand)', borderRadius: 4 }} /></div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
