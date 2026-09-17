import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, PackagePlus, PackageMinus, ClipboardCheck, Pencil, History } from 'lucide-react';
import { get, post, patch, qs } from '../api/client';
import type { InventoryItem, InventoryMovement } from '../api/types';
import { useAuth } from '../app/auth';
import { Badge, Button, Card, Empty, Field, Input, Kpi, Modal, PageHead, Pager, Select, Skeleton, Textarea, useDebounced, useToast } from '../components/ui';
import { fmtMoney, fmtQty, fmtDateTime, inputFromCents, centsFromInput } from '../lib/format';

interface ListRes { items: InventoryItem[]; total: number; page: number; pageSize: number; lowCount: number; stockValueCents: number; categories: string[]; units: string[] }

export function InventoryPage() {
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [low, setLow] = useState(false);
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<Partial<InventoryItem> | null>(null);
  const [move, setMove] = useState<{ item: InventoryItem; type: 'in' | 'out' | 'adjust' } | null>(null);
  const [history, setHistory] = useState<InventoryItem | null>(null);
  const dq = useDebounced(q);
  const list = useQuery({ queryKey: ['inventory', { dq, low, category, page }], queryFn: () => get<ListRes>(`/api/inventory${qs({ q: dq, low: low || undefined, category, page, pageSize: 100 })}`) });
  const d = list.data;
  return (
    <>
      <PageHead title="Lager" sub="Verbrauchsmaterial, Bestände, Mindestbestände und Nachbestellbedarf." actions={can('inventory:write') ? <Button variant="primary" onClick={() => setEdit({ unit: 'Stück', quantity: 0, minQuantity: 0, purchasePriceCents: 0 })}><Plus /> Artikel</Button> : null} />
      {d ? <div className="grid cols-3" style={{ marginBottom: 16 }}><Kpi label="Artikel" value={d.total} /><Kpi label="Unter Mindestbestand" value={d.lowCount} tone={d.lowCount ? 'down' : undefined} delta={d.lowCount ? 'Nachbestellung prüfen' : 'alles ausreichend'} /><Kpi label="Lagerwert (Einkauf, netto)" value={fmtMoney(d.stockValueCents)} /></div> : null}
      <Card tight>
        <div className="toolbar">
          <input type="search" placeholder="Artikel, Hersteller, Lieferant …" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <Select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Alle Kategorien</option>{d?.categories.map((c) => <option key={c}>{c}</option>)}</Select>
          <label className="check small"><input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} /> nur Nachbestellbedarf</label>
        </div>
        {list.isLoading ? <Skeleton /> : d && d.items.length === 0 ? <Empty title="Keine Artikel" text="Produkte anlegen, um Bestände und Verbrauch zu verfolgen." /> : (
          <><div className="table-wrap"><table className="table">
            <thead><tr><th>Artikel</th><th className="hide-mobile">Kategorie</th><th className="num">Bestand</th><th className="num hide-mobile">Mindest</th><th className="num hide-mobile">EK/Einheit</th><th className="hide-mobile">Lagerort</th><th>Status</th><th></th></tr></thead>
            <tbody>{d?.items.map((it) => (
              <tr key={it.id}>
                <td><div className="primary">{it.name}</div><div className="secondary">{[it.manufacturer, it.sku, it.supplier].filter(Boolean).join(' · ')}</div></td>
                <td className="hide-mobile muted">{it.category ?? '–'}</td>
                <td className="num"><b>{fmtQty(it.quantity)}</b> <span className="muted">{it.unit}</span></td>
                <td className="num hide-mobile muted">{fmtQty(it.minQuantity)}</td>
                <td className="num hide-mobile">{fmtMoney(it.purchasePriceCents)}</td>
                <td className="hide-mobile muted">{it.location ?? '–'}</td>
                <td>{it.isLow ? <Badge tone="danger">nachbestellen</Badge> : it.quantity === 0 ? <Badge tone="warn">leer</Badge> : <Badge tone="ok">ok</Badge>}</td>
                <td className="num"><div className="row" style={{ justifyContent: 'flex-end' }}>
                  {can('inventory:write') ? <><Button size="sm" title="Zugang" onClick={() => setMove({ item: it, type: 'in' })}><PackagePlus /></Button><Button size="sm" title="Entnahme" onClick={() => setMove({ item: it, type: 'out' })}><PackageMinus /></Button><Button size="sm" title="Inventur" onClick={() => setMove({ item: it, type: 'adjust' })}><ClipboardCheck /></Button><Button size="sm" variant="ghost" onClick={() => setEdit(it)}><Pencil /></Button></> : null}
                  <Button size="sm" variant="ghost" onClick={() => setHistory(it)}><History /></Button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>{d ? <Pager page={d.page} pageSize={d.pageSize} total={d.total} onPage={setPage} /> : null}</>
        )}
      </Card>
      {edit ? <ItemModal item={edit} units={d?.units ?? ['Stück']} onClose={() => setEdit(null)} /> : null}
      {move ? <MovementModal item={move.item} type={move.type} onClose={() => setMove(null)} /> : null}
      {history ? <HistoryModal item={history} onClose={() => setHistory(null)} /> : null}
    </>
  );
}

function ItemModal({ item, units, onClose }: { item: Partial<InventoryItem>; units: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ name: item.name ?? '', sku: item.sku ?? '', manufacturer: item.manufacturer ?? '', category: item.category ?? '', unit: item.unit ?? 'Stück', quantity: String(item.quantity ?? 0), minQuantity: String(item.minQuantity ?? 0), purchasePrice: inputFromCents(item.purchasePriceCents ?? 0), supplier: item.supplier ?? '', location: item.location ?? '', notes: item.notes ?? '' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const m = useMutation({
    mutationFn: () => { const p = { name: f.name, sku: f.sku || null, manufacturer: f.manufacturer || null, category: f.category || null, unit: f.unit, minQuantity: Number(f.minQuantity.replace(',', '.')) || 0, purchasePriceCents: centsFromInput(f.purchasePrice || '0'), supplier: f.supplier || null, location: f.location || null, notes: f.notes || null }; return item.id ? patch(`/api/inventory/${item.id}`, p) : post('/api/inventory', { ...p, quantity: Number(f.quantity.replace(',', '.')) || 0 }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.ok(item.id ? 'Artikel gespeichert' : 'Artikel angelegt'); onClose(); },
    onError: (e) => toast.fromError(e),
  });
  return (
    <Modal title={item.id ? 'Artikel bearbeiten' : 'Neuer Artikel'} onClose={onClose}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); m.mutate(); }}>
        <div className="form-grid">
          <Field label="Produktname *" className="span-2"><Input required value={f.name} onChange={set('name')} /></Field>
          <Field label="Hersteller"><Input value={f.manufacturer} onChange={set('manufacturer')} /></Field>
          <Field label="Artikelnummer / SKU"><Input value={f.sku} onChange={set('sku')} /></Field>
          <Field label="Kategorie"><Input value={f.category} onChange={set('category')} placeholder="z. B. Versiegelung, Reiniger" list="inv-cats" /></Field>
          <Field label="Einheit"><Select value={f.unit} onChange={set('unit')}>{units.map((u) => <option key={u}>{u}</option>)}</Select></Field>
          {!item.id ? <Field label="Anfangsbestand"><Input inputMode="decimal" value={f.quantity} onChange={set('quantity')} /></Field> : <div />}
          <Field label="Mindestbestand" hint="Warnung, wenn der Bestand darunter fällt"><Input inputMode="decimal" value={f.minQuantity} onChange={set('minQuantity')} /></Field>
          <Field label="Einkaufspreis je Einheit (€ netto)"><Input inputMode="decimal" value={f.purchasePrice} onChange={set('purchasePrice')} /></Field>
          <Field label="Lieferant"><Input value={f.supplier} onChange={set('supplier')} /></Field>
          <Field label="Lagerort"><Input value={f.location} onChange={set('location')} placeholder="Regal A2" /></Field>
          <Field label="Notizen" className="span-2"><Textarea value={f.notes} onChange={set('notes')} /></Field>
        </div>
        <div className="form-actions"><Button type="button" onClick={onClose}>Abbrechen</Button><Button type="submit" variant="primary" loading={m.isPending}>Speichern</Button></div>
      </form>
    </Modal>
  );
}

function MovementModal({ item, type, onClose }: { item: InventoryItem; type: 'in' | 'out' | 'adjust'; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [qty, setQty] = useState(type === 'adjust' ? String(item.quantity) : '1');
  const [cost, setCost] = useState(inputFromCents(item.purchasePriceCents));
  const [reason, setReason] = useState('');
  const title = { in: 'Zugang buchen', out: 'Entnahme buchen', adjust: 'Inventur / Bestand korrigieren' }[type];
  const m = useMutation({ mutationFn: () => post(`/api/inventory/${item.id}/movements`, { type, quantity: Number(qty.replace(',', '.')), unitCostCents: type === 'in' ? centsFromInput(cost || '0') : null, reason: reason || null }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.ok('Bestand aktualisiert'); onClose(); }, onError: (e) => toast.fromError(e) });
  return (
    <Modal title={`${title}: ${item.name}`} onClose={onClose}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); m.mutate(); }}>
        <p className="muted small" style={{ marginBottom: 12 }}>Aktueller Bestand: <b>{fmtQty(item.quantity)} {item.unit}</b></p>
        <div className="form-grid">
          <Field label={type === 'adjust' ? `Neuer Bestand (${item.unit})` : `Menge (${item.unit})`}><Input inputMode="decimal" required autoFocus value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
          {type === 'in' ? <Field label="Einkaufspreis je Einheit (€ netto)"><Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} /></Field> : <div />}
          <Field label="Grund / Bezug" className="span-2"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={type === 'out' ? 'z. B. Auftrag AU-2026-0012' : type === 'in' ? 'z. B. Lieferung Detailing Shop' : 'z. B. Inventur'} /></Field>
        </div>
        <div className="form-actions"><Button type="button" onClick={onClose}>Abbrechen</Button><Button type="submit" variant="primary" loading={m.isPending}>Buchen</Button></div>
      </form>
    </Modal>
  );
}

function HistoryModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const q = useQuery({ queryKey: ['inventory', item.id], queryFn: () => get<{ item: InventoryItem; movements: InventoryMovement[]; consumption30: number; daysOfStock: number | null }>(`/api/inventory/${item.id}`) });
  const T: Record<string, string> = { in: 'Zugang', out: 'Entnahme', adjust: 'Korrektur' };
  return (
    <Modal title={`Bewegungen: ${item.name}`} onClose={onClose} wide>
      {q.data ? <p className="muted small" style={{ marginBottom: 10 }}>Verbrauch letzte 30 Tage: <b>{fmtQty(q.data.consumption30)} {item.unit}</b>{q.data.daysOfStock !== null ? ` · reicht rechnerisch noch ca. ${q.data.daysOfStock} Tage` : ''}</p> : null}
      {q.isLoading ? <Skeleton /> : <div className="table-wrap"><table className="table"><thead><tr><th>Zeitpunkt</th><th>Art</th><th className="num">Änderung</th><th className="num">Danach</th><th>Grund</th></tr></thead><tbody>{q.data?.movements.map((m) => <tr key={m.id}><td className="muted">{fmtDateTime(m.createdAt)}</td><td>{T[m.type] ?? m.type}</td><td className="num" style={{ color: m.delta < 0 ? 'var(--danger)' : 'var(--ok)' }}>{m.delta > 0 ? '+' : ''}{fmtQty(m.delta)}</td><td className="num">{fmtQty(m.quantityAfter)}</td><td className="muted">{m.reason ?? '–'}</td></tr>)}</tbody></table></div>}
    </Modal>
  );
}
