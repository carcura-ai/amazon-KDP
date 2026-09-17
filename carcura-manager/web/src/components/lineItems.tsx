import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { get } from '../api/client';
import type { Service, LineItem } from '../api/types';
import { useAuth } from '../app/auth';
import { Button, Card, Input, Select } from './ui';
import { fmtMoney, inputFromCents, centsFromInput } from '../lib/format';

export interface ItemDraft { id?: string; serviceId: string | null; name: string; description: string; quantity: number; unitPrice: string; vatBp: number }
export const emptyItem = (): ItemDraft => ({ serviceId: null, name: '', description: '', quantity: 1, unitPrice: '', vatBp: 1900 });
export const draftsFrom = (items: LineItem[]): ItemDraft[] => (items.length ? items.map((i) => ({ id: i.id, serviceId: i.serviceId, name: i.name, description: i.description ?? '', quantity: i.quantity, unitPrice: inputFromCents(i.unitPriceCents), vatBp: i.vatBp })) : [emptyItem()]);
export const payloadFrom = (items: ItemDraft[]) => items.filter((i) => i.name.trim()).map((i) => ({ id: i.id, serviceId: i.serviceId, name: i.name.trim(), description: i.description || null, quantity: i.quantity, unitPriceCents: centsFromInput(i.unitPrice || '0'), vatBp: i.vatBp }));

export function useTotals(items: ItemDraft[]) {
  const { me } = useAuth();
  const smallBusiness = me?.company.smallBusiness ?? false;
  const valid = items.filter((i) => i.name.trim());
  const subtotal = valid.reduce((s, i) => s + i.quantity * centsFromInput(i.unitPrice || '0'), 0);
  const vat = smallBusiness ? 0 : valid.reduce((s, i) => s + Math.round((i.quantity * centsFromInput(i.unitPrice || '0') * i.vatBp) / 10000), 0);
  return { subtotal, vat, total: subtotal + vat, smallBusiness, valid };
}

export function ServiceCatalog({ onPick }: { onPick: (s: Service) => void }) {
  const services = useQuery({ queryKey: ['services'], queryFn: () => get<{ items: Service[] }>('/api/services') });
  return (
    <Card title="Leistung hinzufügen">
      <p className="small muted" style={{ marginBottom: 10 }}>Aus dem Katalog übernehmen oder in der Tabelle frei eingeben.</p>
      <div className="stack" style={{ gap: 6 }}>{services.data?.items.map((s) => <button type="button" key={s.id} className="btn sm" style={{ justifyContent: 'space-between' }} onClick={() => onPick(s)}><span>{s.name}</span><span className="muted">{s.priceCents ? fmtMoney(s.priceCents) : 'Preis offen'}</span></button>)}</div>
    </Card>
  );
}

export function LineItemsEditor({ items, setItems, readOnly }: { items: ItemDraft[]; setItems: (fn: (l: ItemDraft[]) => ItemDraft[]) => void; readOnly?: boolean }) {
  const t = useTotals(items);
  const upd = (i: number, p: Partial<ItemDraft>) => setItems((list) => list.map((it, j) => (j === i ? { ...it, ...p } : it)));
  return (
    <Card title="Positionen" tight>
      <div className="table-wrap"><table className="table items-editor">
        <thead><tr><th style={{ width: '40%' }}>Leistung</th><th className="num">Menge</th><th className="num">Einzelpreis (€)</th><th className="num hide-mobile">MwSt.</th><th className="num">Gesamt</th><th></th></tr></thead>
        <tbody>{items.map((it, i) => (
          <tr key={i}>
            <td><Input disabled={readOnly} value={it.name} onChange={(e) => upd(i, { name: e.target.value, serviceId: null })} placeholder="Bezeichnung" /><Input disabled={readOnly} value={it.description} onChange={(e) => upd(i, { description: e.target.value })} placeholder="Beschreibung (optional)" style={{ marginTop: 4 }} /></td>
            <td className="num"><Input disabled={readOnly} type="number" min={1} value={String(it.quantity)} onChange={(e) => upd(i, { quantity: Math.max(1, Number(e.target.value)) })} style={{ width: 72 }} /></td>
            <td className="num"><Input disabled={readOnly} inputMode="decimal" value={it.unitPrice} onChange={(e) => upd(i, { unitPrice: e.target.value })} style={{ width: 110 }} /></td>
            <td className="num hide-mobile"><Select disabled={readOnly} value={String(it.vatBp)} onChange={(e) => upd(i, { vatBp: Number(e.target.value) })} style={{ width: 90 }}><option value="1900">19 %</option><option value="700">7 %</option><option value="0">0 %</option></Select></td>
            <td className="num">{fmtMoney(it.quantity * centsFromInput(it.unitPrice || '0'))}</td>
            <td>{!readOnly ? <Button type="button" size="sm" variant="ghost" onClick={() => setItems((l) => (l.length > 1 ? l.filter((_, j) => j !== i) : [emptyItem()]))}><Trash2 /></Button> : null}</td>
          </tr>
        ))}</tbody>
      </table></div>
      <div className="row" style={{ padding: 12, justifyContent: 'space-between' }}>
        {!readOnly ? <Button type="button" size="sm" onClick={() => setItems((l) => [...l, emptyItem()])}><Plus /> Position</Button> : <span />}
        <div className="totals"><div className="l"><span className="muted">Netto</span><span>{fmtMoney(t.subtotal)}</span></div><div className="l"><span className="muted">{t.smallBusiness ? 'MwSt. (§ 19 UStG, keine)' : 'MwSt.'}</span><span>{fmtMoney(t.vat)}</span></div><div className="l total"><span>Gesamt</span><span>{fmtMoney(t.total)}</span></div></div>
      </div>
    </Card>
  );
}

export function addServiceTo(setItems: (fn: (l: ItemDraft[]) => ItemDraft[]) => void, svc: Service) {
  setItems((list) => { const empty = list.findIndex((i) => !i.name.trim()); const it: ItemDraft = { serviceId: svc.id, name: svc.name, description: '', quantity: 1, unitPrice: inputFromCents(svc.priceCents), vatBp: svc.vatBp }; if (empty >= 0) { const c = [...list]; c[empty] = it; return c; } return [...list, it]; });
}
