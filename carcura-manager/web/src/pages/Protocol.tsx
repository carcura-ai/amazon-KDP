import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { FileDown, Lock, Plus, Trash2, PenLine, Camera } from 'lucide-react';
import { get, post, patch, del, qs } from '../api/client';
import type { Customer, Damage, ProtocolDetail, ProtocolRow, Vehicle, FileRow } from '../api/types';
import { useAuth } from '../app/auth';
import { Badge, Button, Card, Confirm, Field, Input, Modal, PageHead, Select, Skeleton, Textarea, useToast } from '../components/ui';
import { Dropzone } from '../components/documents';
import { fmtDateTime, fmtNumber, personName, fmtDate } from '../lib/format';

const AREAS: Record<string, string> = { front: 'Front', rear: 'Heck', left: 'Fahrerseite', right: 'Beifahrerseite', roof: 'Dach', interior: 'Innenraum', wheels: 'Räder/Felgen', glass: 'Glas', other: 'Sonstiges' };
const TYPES: Record<string, string> = { scratch: 'Kratzer', dent: 'Delle', paint: 'Lackschaden', stone_chip: 'Steinschlag', crack: 'Riss', stain: 'Fleck', tear: 'Riss/Loch', wear: 'Abnutzung', other: 'Sonstiges' };
const SEV: Record<string, string> = { minor: 'leicht', medium: 'mittel', major: 'stark' };
const CHECK: Record<string, string> = { warndreieck: 'Warndreieck', verbandskasten: 'Verbandskasten', warnweste: 'Warnweste', bordwerkzeug: 'Bordwerkzeug', ersatzrad: 'Ersatzrad/Pannenset', fussmatten: 'Fußmatten', ladekabel: 'Ladekabel', schluessel2: 'Zweitschlüssel', kindersitz: 'Kindersitz', sonstiges: 'Sonstiges Zubehör' };
const CONDITIONS = ['sauber', 'leicht verschmutzt', 'stark verschmutzt', 'sehr stark verschmutzt'];

function areaFromPos(x: number, y: number): string {
  if (x < 130) return 'front';
  if (x > 870) return 'rear';
  if (y < 380) return 'left';
  if (y > 620) return 'right';
  return 'roof';
}

/** Fahrzeugskizze (Draufsicht). Klick setzt einen Marker, Koordinaten in Promille. */
function Sketch({ damages, active, onAdd, onSelect, readOnly }: { damages: Damage[]; active: number | null; onAdd: (x: number, y: number) => void; onSelect: (i: number) => void; readOnly?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const click = (e: React.MouseEvent) => {
    if (readOnly || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    onAdd(Math.round(((e.clientX - r.left) / r.width) * 1000), Math.round(((e.clientY - r.top) / r.height) * 1000));
  };
  return (
    <div className="sketch" ref={ref}>
      <svg viewBox="0 0 420 210" onClick={click}>
        <rect width="420" height="210" fill="#f4f4f5" rx="8" />
        <g fill="#fff" stroke="#333" strokeWidth="2"><rect x="33.6" y="46.2" width="352.8" height="117.6" rx="46" /><rect x="126" y="58.8" width="168" height="92.4" rx="21" fill="#e8edf3" /><line x1="126" y1="105" x2="294" y2="105" stroke="#bbb" strokeDasharray="4 4" /></g>
        <g fill="#333"><rect x="67" y="29" width="46" height="21" rx="3" /><rect x="307" y="29" width="46" height="21" rx="3" /><rect x="67" y="160" width="46" height="21" rx="3" /><rect x="307" y="160" width="46" height="21" rx="3" /></g>
        <text x="16" y="111" fontSize="10" fill="#777">Front</text><text x="386" y="111" fontSize="10" fill="#777">Heck</text><text x="197" y="21" fontSize="10" fill="#777">Fahrerseite</text><text x="189" y="204" fontSize="10" fill="#777">Beifahrerseite</text>
      </svg>
      {damages.map((d, i) => (d.posX === null || d.posY === null ? null : <div key={i} className={`mark ${active === i ? 'active' : ''}`} style={{ left: `${d.posX / 10}%`, top: `${d.posY / 10}%` }} onClick={(e) => { e.stopPropagation(); onSelect(i); }}>{i + 1}</div>))}
    </div>
  );
}

function SignaturePad({ onSave, label }: { onSave: (dataUrl: string, name?: string) => void; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  const [name, setName] = useState('');
  useEffect(() => {
    const c = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.clientWidth * ratio; c.height = c.clientHeight * ratio;
    const ctx = c.getContext('2d')!;
    ctx.scale(ratio, ratio); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
  }, []);
  const pos = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e: React.PointerEvent) => { drawing.current = true; const ctx = canvas.current!.getContext('2d')!; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); canvas.current!.setPointerCapture(e.pointerId); };
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const ctx = canvas.current!.getContext('2d')!; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); setEmpty(false); };
  const up = () => { drawing.current = false; };
  const clear = () => { const c = canvas.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setEmpty(true); };
  return (
    <div className="stack" style={{ gap: 8 }}>
      <canvas ref={canvas} className="sigpad" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
      <div className="row"><Input placeholder="Name in Druckbuchstaben" value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 260 }} /><Button size="sm" onClick={clear}>Löschen</Button><Button size="sm" variant="primary" disabled={empty} onClick={() => onSave(canvas.current!.toDataURL('image/png'), name || undefined)}><PenLine /> {label}</Button></div>
    </div>
  );
}

export function ProtocolPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const isNew = !id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['protocol', id], queryFn: () => get<ProtocolDetail>(`/api/protocols/${id}`), enabled: !isNew });
  const presetCustomer = useQuery({ queryKey: ['customer', sp.get('customerId')], queryFn: () => get<{ customer: Customer; vehicles: Vehicle[] }>(`/api/customers/${sp.get('customerId')}`), enabled: isNew && Boolean(sp.get('customerId')) });
  const [f, setF] = useState({ type: (sp.get('type') as 'intake' | 'handover') || 'intake', vehicleId: sp.get('vehicleId') || '', orderId: sp.get('orderId') || null, mileage: '', fuelLevel: 50, exteriorCondition: '', interiorCondition: '', checklist: {} as Record<string, boolean>, notes: '' });
  const [damages, setDamages] = useState<Damage[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sign, setSign] = useState<'customer' | 'employee' | null>(null);
  const [finalize, setFinalize] = useState(false);
  const [remove, setRemove] = useState(false);
  useEffect(() => {
    if (q.data && !loaded) {
      const p = q.data.protocol;
      setF({ type: p.type, vehicleId: p.vehicleId, orderId: p.orderId, mileage: p.mileage?.toString() ?? '', fuelLevel: p.fuelLevel ?? 50, exteriorCondition: p.exteriorCondition ?? '', interiorCondition: p.interiorCondition ?? '', checklist: JSON.parse(p.checklistJson || '{}'), notes: p.notes ?? '' });
      setDamages(q.data.damages);
      setLoaded(true);
    }
  }, [q.data, loaded]);
  const readOnly = q.data?.protocol.status === 'final' || !can('protocols:write');
  const customer = q.data?.customer ?? presetCustomer.data?.customer ?? null;
  const vehicles = presetCustomer.data?.vehicles ?? (q.data?.vehicle ? [q.data.vehicle] : []);
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['protocol', id] }); qc.invalidateQueries({ queryKey: ['protocols'] }); qc.invalidateQueries({ queryKey: ['files'] }); if (customer) qc.invalidateQueries({ queryKey: ['customer', customer.id] }); };
  const payload = () => ({ type: f.type, customerId: customer!.id, vehicleId: f.vehicleId, orderId: f.orderId, mileage: f.mileage ? Number(f.mileage) : null, fuelLevel: f.fuelLevel, exteriorCondition: f.exteriorCondition || null, interiorCondition: f.interiorCondition || null, checklist: f.checklist, notes: f.notes || null, damages: damages.map((d) => ({ ...d, description: d.description || null })) });
  const save = useMutation({
    mutationFn: () => (isNew ? post<ProtocolDetail>('/api/protocols', payload()) : patch<ProtocolDetail>(`/api/protocols/${id}`, payload())),
    onSuccess: (r) => { invalidate(); toast.ok(isNew ? `Protokoll ${r.protocol.protocolNumber} angelegt` : 'Protokoll gespeichert'); if (isNew) navigate(`/protokolle/${r.protocol.id}`, { replace: true }); },
    onError: (e) => toast.fromError(e),
  });
  const doSign = useMutation({ mutationFn: ({ role, dataUrl, name }: { role: string; dataUrl: string; name?: string }) => post(`/api/protocols/${id}/sign`, { role, dataUrl, name: name ?? null }), onSuccess: () => { invalidate(); toast.ok('Unterschrift gespeichert'); setSign(null); }, onError: (e) => toast.fromError(e) });
  const doFinal = useMutation({ mutationFn: () => post(`/api/protocols/${id}/finalize`), onSuccess: () => { invalidate(); toast.ok('Protokoll abgeschlossen', 'PDF wurde in der Kundenakte abgelegt.'); setFinalize(false); }, onError: (e) => toast.fromError(e, 'Abschluss fehlgeschlagen') });
  const doDelete = useMutation({ mutationFn: () => del(`/api/protocols/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['protocols'] }); toast.ok('Protokoll gelöscht'); navigate(customer ? `/kunden/${customer.id}` : '/kunden'); }, onError: (e) => toast.fromError(e) });
  const upd = (i: number, p: Partial<Damage>) => setDamages((l) => l.map((d, j) => (j === i ? { ...d, ...p } : d)));
  const addDamage = (x: number, y: number) => { setDamages((l) => [...l, { area: areaFromPos(x, y), type: 'scratch', severity: 'minor', description: '', posX: x, posY: y, fileId: null }]); setActive(damages.length); };

  if (!isNew && q.isLoading) return <Card><Skeleton /></Card>;
  if (isNew && !customer) return <Card><div className="empty"><h3>Bitte über die Kundenakte oder das Fahrzeug starten</h3><Link className="btn" to="/kunden">Zu den Kunden</Link></div></Card>;
  const p = q.data?.protocol;
  const files = q.data?.files ?? [];
  const title = `${f.type === 'intake' ? 'Annahmeprotokoll' : 'Übergabeprotokoll'}${p ? ` ${p.protocolNumber}` : ''}`;
  return (
    <>
      <PageHead
        crumbs={<><Link to="/kunden">Kunden</Link><span>/</span>{customer ? <Link to={`/kunden/${customer.id}`}>{personName(customer)}</Link> : null}<span>/</span><span>Protokoll</span></>}
        title={<span className="row">{title}{p ? <Badge tone={p.status === 'final' ? 'ok' : 'warn'}>{p.status === 'final' ? 'abgeschlossen' : 'Entwurf'}</Badge> : null}</span>}
        sub={p ? `Angelegt ${fmtDateTime(p.createdAt)}${p.finalizedAt ? ` · abgeschlossen ${fmtDateTime(p.finalizedAt)}` : ''}` : 'Fahrzeugzustand vor Beginn der Arbeiten dokumentieren.'}
        actions={<>
          {p ? <a className="btn" href={`/api/protocols/${p.id}/pdf`} target="_blank" rel="noreferrer"><FileDown /> PDF</a> : null}
          {p && !readOnly ? <Button onClick={() => setFinalize(true)}><Lock /> Abschließen</Button> : null}
          {p && !readOnly ? <Button variant="danger" onClick={() => setRemove(true)}><Trash2 /></Button> : null}
          {!readOnly ? <Button variant="primary" loading={save.isPending} onClick={() => { if (!f.vehicleId) return toast.error('Bitte Fahrzeug wählen.'); save.mutate(); }}>{isNew ? 'Protokoll anlegen' : 'Speichern'}</Button> : null}
        </>}
      />
      <div className="grid main-side">
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Fahrzeug und Zustand">
            <div className="form-grid">
              <Field label="Art"><Select value={f.type} disabled={readOnly || !isNew} onChange={(e) => setF({ ...f, type: e.target.value as 'intake' | 'handover' })}><option value="intake">Annahme (vor der Aufbereitung)</option><option value="handover">Übergabe (nach der Aufbereitung)</option></Select></Field>
              <Field label="Fahrzeug"><Select value={f.vehicleId} disabled={readOnly || !isNew} onChange={(e) => setF({ ...f, vehicleId: e.target.value })}><option value="">– wählen –</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{[v.make, v.model].filter(Boolean).join(' ')}{v.licensePlate ? ` · ${v.licensePlate}` : ''}</option>)}</Select></Field>
              <Field label="Kilometerstand"><Input type="number" min={0} disabled={readOnly} value={f.mileage} onChange={(e) => setF({ ...f, mileage: e.target.value })} /></Field>
              <Field label={`Tankfüllung: ${f.fuelLevel} %`}><div className="fuel">{[0, 12, 25, 37, 50, 62, 75, 87, 100].map((v) => <button type="button" key={v} className={f.fuelLevel >= v ? 'on' : ''} disabled={readOnly} onClick={() => setF({ ...f, fuelLevel: v })} title={`${v} %`} />)}</div></Field>
              <Field label="Zustand außen"><Select disabled={readOnly} value={f.exteriorCondition} onChange={(e) => setF({ ...f, exteriorCondition: e.target.value })}><option value="">–</option>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
              <Field label="Zustand innen"><Select disabled={readOnly} value={f.interiorCondition} onChange={(e) => setF({ ...f, interiorCondition: e.target.value })}><option value="">–</option>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
              <Field label="Zubehör im Fahrzeug" className="span-2"><div className="row" style={{ gap: 14 }}>{Object.entries(CHECK).map(([k, v]) => <label key={k} className="check small"><input type="checkbox" disabled={readOnly} checked={Boolean(f.checklist[k])} onChange={(e) => setF({ ...f, checklist: { ...f.checklist, [k]: e.target.checked } })} /> {v}</label>)}</div></Field>
              <Field label="Bemerkungen" className="span-2"><Textarea disabled={readOnly} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
            </div>
          </Card>
          <Card title="Vorhandene Schäden" actions={!readOnly ? <Button size="sm" onClick={() => { setDamages((l) => [...l, { area: 'interior', type: 'stain', severity: 'minor', description: '', posX: null, posY: null, fileId: null }]); setActive(damages.length); }}><Plus /> Ohne Position</Button> : null}>
            <p className="small muted" style={{ marginBottom: 10 }}>{readOnly ? 'Nummern verweisen auf die Liste.' : 'In die Skizze klicken, um einen Schaden zu markieren. Danach Art und Beschreibung ergänzen.'}</p>
            <Sketch damages={damages} active={active} onAdd={addDamage} onSelect={setActive} readOnly={readOnly} />
            <div className="stack" style={{ marginTop: 14, gap: 8 }}>
              {damages.length === 0 ? <p className="muted">Keine Schäden erfasst.</p> : damages.map((d, i) => (
                <div key={i} className="card" style={{ padding: 10, boxShadow: 'none', borderColor: active === i ? 'var(--brand)' : undefined }} onClick={() => setActive(i)}>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <span className="badge danger plain" style={{ fontWeight: 700 }}>{i + 1}</span>
                    <div className="form-grid" style={{ flex: 1, gap: 8 }}>
                      <Select disabled={readOnly} value={d.area} onChange={(e) => upd(i, { area: e.target.value })}>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
                      <Select disabled={readOnly} value={d.type} onChange={(e) => upd(i, { type: e.target.value })}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
                      <Select disabled={readOnly} value={d.severity} onChange={(e) => upd(i, { severity: e.target.value })}>{Object.entries(SEV).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
                      <Select disabled={readOnly || !p} value={d.fileId ?? ''} onChange={(e) => upd(i, { fileId: e.target.value || null })}><option value="">{p ? 'Foto zuordnen' : 'Foto nach dem Anlegen'}</option>{files.map((fl, fi) => <option key={fl.id} value={fl.id}>Foto {fi + 1}{fl.caption ? ` · ${fl.caption}` : ''}</option>)}</Select>
                      <Input className="span-2" disabled={readOnly} placeholder="Beschreibung" value={d.description ?? ''} onChange={(e) => upd(i, { description: e.target.value })} />
                    </div>
                    {!readOnly ? <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDamages((l) => l.filter((_, j) => j !== i)); setActive(null); }}><Trash2 /></Button> : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Fotos">
            {p ? (
              <>
                {!readOnly ? <Dropzone meta={{ protocolId: p.id, customerId: p.customerId, vehicleId: p.vehicleId, orderId: p.orderId, category: 'damage' }} categories={false} compact onDone={invalidate} /> : null}
                {files.length ? <div className="gallery" style={{ marginTop: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }}>{files.map((fl: FileRow, i: number) => <a key={fl.id} className="thumb" href={`/files/${fl.id}?variant=display`} target="_blank" rel="noreferrer"><img src={`/files/${fl.id}?variant=thumb`} alt="" /><div className="cap">Foto {i + 1}</div></a>)}</div> : <p className="muted small" style={{ marginTop: 8 }}>Noch keine Fotos.</p>}
              </>
            ) : <p className="muted small"><Camera size={14} /> Fotos können nach dem Anlegen hinzugefügt werden.</p>}
          </Card>
          <Card title="Unterschriften">
            {p ? (
              <div className="stack" style={{ gap: 12 }}>
                <div><div className="small muted">Kunde{p.signedByName ? `: ${p.signedByName}` : ''}{p.signedAt ? ` · ${fmtDateTime(p.signedAt)}` : ''}</div>{p.customerSignatureFileId ? <div className="sig-preview"><img src={`/files/${p.customerSignatureFileId}`} alt="Unterschrift Kunde" /></div> : <span className="dim small">noch nicht unterschrieben</span>}{!readOnly ? <div style={{ marginTop: 6 }}><Button size="sm" onClick={() => setSign('customer')}><PenLine /> Kunde unterschreibt</Button></div> : null}</div>
                <div><div className="small muted">Mitarbeiter</div>{p.employeeSignatureFileId ? <div className="sig-preview"><img src={`/files/${p.employeeSignatureFileId}`} alt="Unterschrift Mitarbeiter" /></div> : <span className="dim small">noch nicht unterschrieben</span>}{!readOnly ? <div style={{ marginTop: 6 }}><Button size="sm" onClick={() => setSign('employee')}><PenLine /> Mitarbeiter unterschreibt</Button></div> : null}</div>
              </div>
            ) : <p className="muted small">Nach dem Anlegen kann direkt auf dem Bildschirm unterschrieben werden.</p>}
          </Card>
          {customer ? <Card title="Kunde"><div style={{ fontWeight: 600 }}>{personName(customer)}</div><div className="small muted">{customer.phone}</div>{q.data?.vehicle ? <div className="small muted" style={{ marginTop: 6 }}>{[q.data.vehicle.make, q.data.vehicle.model, q.data.vehicle.licensePlate].filter(Boolean).join(' ')}{q.data.vehicle.mileage ? ` · ${fmtNumber(q.data.vehicle.mileage)} km` : ''}</div> : null}{q.data?.order ? <Link className="btn sm" style={{ marginTop: 8 }} to={`/auftraege/${q.data.order.id}`}>Auftrag {q.data.order.orderNumber}</Link> : null}</Card> : null}
        </div>
      </div>
      {sign ? <Modal title={sign === 'customer' ? 'Unterschrift Kunde' : 'Unterschrift Mitarbeiter'} onClose={() => setSign(null)}><p className="muted small" style={{ marginBottom: 8 }}>Mit Finger, Stift oder Maus im weißen Feld unterschreiben.</p><SignaturePad label="Übernehmen" onSave={(dataUrl, name) => doSign.mutate({ role: sign, dataUrl, name })} /></Modal> : null}
      {finalize ? <Confirm title="Protokoll abschließen?" text="Das Protokoll wird eingefroren, als PDF erzeugt und in der Kundenakte abgelegt. Änderungen sind danach nicht mehr möglich. Nicht gespeicherte Änderungen bitte vorher speichern." confirmLabel="Abschließen" loading={doFinal.isPending} onConfirm={() => doFinal.mutate()} onClose={() => setFinalize(false)} /> : null}
      {remove ? <Confirm title="Protokoll löschen?" text="Entwurf inklusive Fotos wird gelöscht." confirmLabel="Löschen" danger loading={doDelete.isPending} onConfirm={() => doDelete.mutate()} onClose={() => setRemove(false)} /> : null}
    </>
  );
}

export function ProtocolList({ filter, newParams }: { filter: { customerId?: string; vehicleId?: string; orderId?: string }; newParams: Record<string, string | null | undefined> }) {
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['protocols', filter], queryFn: () => get<{ items: ProtocolRow[] }>(`/api/protocols${qs(filter)}`) });
  const params = Object.entries(newParams).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&');
  return (
    <Card title="Protokolle" tight actions={can('protocols:write') ? <div className="row"><Link className="btn sm" to={`/protokolle/neu?${params}&type=intake`}><Plus /> Annahme</Link><Link className="btn sm" to={`/protokolle/neu?${params}&type=handover`}><Plus /> Übergabe</Link></div> : null}>
      {!q.data?.items.length ? <p className="muted" style={{ padding: 18 }}>Noch kein Protokoll.</p> : q.data.items.map(({ protocol: p, vehicle: v }) => (
        <Link key={p.id} to={`/protokolle/${p.id}`} className="doc-row">
          <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontWeight: 600 }}>{p.type === 'intake' ? 'Annahme' : 'Übergabe'} {p.protocolNumber}</div><div className="small muted">{[v.make, v.model, v.licensePlate].filter(Boolean).join(' ')} · {fmtDate(p.createdAt)}</div></div>
          <Badge tone={p.status === 'final' ? 'ok' : 'warn'}>{p.status === 'final' ? 'abgeschlossen' : 'Entwurf'}</Badge>
          {p.status === 'final' ? <a className="btn sm ghost" href={`/api/protocols/${p.id}/pdf`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><FileDown /></a> : null}
        </Link>
      ))}
    </Card>
  );
}
