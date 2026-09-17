import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { RefreshCw, Plus, Settings, ExternalLink, Star } from 'lucide-react';
import { get, post, patch } from '../api/client';
import type { Competitor } from '../api/types';
import { useAuth } from '../app/auth';
import { Badge, Button, Card, Empty, Field, Input, Kpi, Modal, PageHead, Skeleton, Textarea, useToast } from '../components/ui';
import { fmtDateTime } from '../lib/format';

interface Res { items: Competitor[]; own: Competitor | null; avgRating: number | null; newThisWeek: number; configured: boolean; lastScanAt: string | null; lastError: string | null; total: number }

export function CompetitorsPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [add, setAdd] = useState(false);
  const [f, setF] = useState({ name: '', address: '', website: '', rating: '', ratingCount: '', notes: '' });
  const q = useQuery({ queryKey: ['competitors'], queryFn: () => get<Res>('/api/competitors') });
  const scan = useMutation({ mutationFn: () => post<{ found: number; newCount: number }>('/api/competitors/scan'), onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['competitors'] }); toast.ok('Scan abgeschlossen', `${r.found} Einträge, ${r.newCount} neu`); }, onError: (e) => toast.fromError(e) });
  const create = useMutation({ mutationFn: () => post('/api/competitors', { name: f.name, address: f.address || null, website: f.website || null, notes: f.notes || null, rating: f.rating ? Number(f.rating.replace(',', '.')) : null, ratingCount: f.ratingCount ? Number(f.ratingCount) : null }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['competitors'] }); toast.ok('Wettbewerber angelegt'); setAdd(false); }, onError: (e) => toast.fromError(e) });
  const markOwn = useMutation({ mutationFn: (c: Competitor) => patch(`/api/competitors/${c.id}`, { isOwn: true }), onSuccess: () => qc.invalidateQueries({ queryKey: ['competitors'] }) });
  const d = q.data;
  return (
    <>
      <PageHead title="Wettbewerber" sub="Öffentliche Daten aus dem Google-Unternehmensprofil (Bewertungen, Anzahl Rezensionen, Website), wöchentlich aktualisiert. Nur rechtmäßig abrufbare Informationen." actions={<>{can('integrations:manage') ? <Link className="btn" to="/einstellungen/integrationen"><Settings /> Einrichten</Link> : null}{can('integrations:manage') ? <Button onClick={() => setAdd(true)}><Plus /> Manuell</Button> : null}{can('integrations:manage') && d?.configured ? <Button variant="primary" onClick={() => scan.mutate()} loading={scan.isPending}><RefreshCw /> Jetzt scannen</Button> : null}</>} />
      {q.isLoading || !d ? <Card><Skeleton /></Card> : (
        <div className="stack" style={{ gap: 16 }}>
          <div className="grid cols-4">
            <Kpi label="Wettbewerber im Umkreis" value={d.total} delta={d.newThisWeek ? `${d.newThisWeek} neu diese Woche` : 'keine neuen diese Woche'} tone={d.newThisWeek ? 'down' : undefined} />
            <Kpi label="Ø Bewertung Wettbewerb" value={d.avgRating ?? '–'} />
            <Kpi label="Eigene Bewertung" value={d.own?.latest?.rating ?? '–'} delta={d.own ? `${d.own.latest?.ratingCount ?? 0} Rezensionen${d.own.reviewsChange30 ? ` · ${d.own.reviewsChange30 > 0 ? '+' : ''}${d.own.reviewsChange30} in 30 Tagen` : ''}` : 'eigenen Eintrag in der Liste markieren'} />
            <Kpi label="Letzter Scan" value={d.lastScanAt ? fmtDateTime(d.lastScanAt) : '–'} delta={d.lastError ?? (d.configured ? 'wöchentlich montags' : 'Google-Places-API nicht eingerichtet')} tone={d.lastError ? 'down' : undefined} />
          </div>
          <Card tight>
            {d.items.length === 0 ? <Empty title="Noch keine Wettbewerber" text={d.configured ? 'Jetzt scannen, um Einträge aus Google zu laden.' : 'Google-Places-API unter Einstellungen → Integrationen einrichten oder Wettbewerber manuell anlegen.'} /> : (
              <div className="table-wrap"><table className="table">
                <thead><tr><th>Unternehmen</th><th className="hide-mobile">Adresse</th><th className="num">Bewertung</th><th className="num">Rezensionen</th><th className="num hide-mobile">Δ 30 Tage</th><th>Status</th><th></th></tr></thead>
                <tbody>{d.items.map((c) => (
                  <tr key={c.id}>
                    <td><div className="primary row">{c.name}{c.isNew ? <Badge tone="warn">neu</Badge> : null}</div>{c.website ? <a className="small muted row" href={c.website} target="_blank" rel="noreferrer" style={{ gap: 4 }}>{c.website.replace(/^https?:\/\//, '').slice(0, 40)} <ExternalLink size={11} /></a> : null}</td>
                    <td className="hide-mobile muted">{c.address ?? '–'}</td>
                    <td className="num"><span className="row" style={{ justifyContent: 'flex-end', gap: 4 }}><Star size={13} style={{ color: 'var(--warn)' }} />{c.latest?.rating ?? '–'}</span></td>
                    <td className="num">{c.latest?.ratingCount ?? '–'}</td>
                    <td className="num hide-mobile">{c.reviewsChange30 === null ? <span className="dim">–</span> : <span style={{ color: c.reviewsChange30 > 0 ? 'var(--ok)' : 'var(--fg-muted)' }}>{c.reviewsChange30 > 0 ? '+' : ''}{c.reviewsChange30} Rez.{c.ratingChange30 ? ` · ${c.ratingChange30 > 0 ? '+' : ''}${c.ratingChange30}` : ''}</span>}</td>
                    <td>{c.latest?.businessStatus === 'CLOSED_PERMANENTLY' ? <Badge tone="danger">geschlossen</Badge> : c.source === 'manual' ? <Badge plain>manuell</Badge> : <Badge tone="ok">aktiv</Badge>}</td>
                    <td className="num">{can('integrations:manage') ? <Button size="sm" variant="ghost" onClick={() => markOwn.mutate(c)} title="Als eigenen Eintrag markieren">eigener</Button> : null}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </Card>
        </div>
      )}
      {add ? (
        <Modal title="Wettbewerber manuell anlegen" onClose={() => setAdd(false)}>
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); create.mutate(); }}>
            <div className="form-grid">
              <Field label="Name *" className="span-2"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
              <Field label="Adresse" className="span-2"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
              <Field label="Website" className="span-2"><Input value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://" /></Field>
              <Field label="Bewertung (0–5)"><Input inputMode="decimal" value={f.rating} onChange={(e) => setF({ ...f, rating: e.target.value })} /></Field>
              <Field label="Anzahl Rezensionen"><Input type="number" min={0} value={f.ratingCount} onChange={(e) => setF({ ...f, ratingCount: e.target.value })} /></Field>
              <Field label="Notizen (Preise, Leistungen, Beobachtungen)" className="span-2"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
            </div>
            <div className="form-actions"><Button type="button" onClick={() => setAdd(false)}>Abbrechen</Button><Button type="submit" variant="primary" loading={create.isPending}>Anlegen</Button></div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
