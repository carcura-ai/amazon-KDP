import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get, qs } from '../api/client';
import type { Customer, Paged, Vehicle } from '../api/types';
import { personName } from '../lib/format';
import { useDebounced } from './ui';

/** Kundensuche mit Auswahl-Dropdown. */
export function CustomerPicker({ value, onChange, disabled }: { value: Customer | null; onChange: (c: Customer | null) => void; disabled?: boolean }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const dq = useDebounced(q, 200);
  const ref = useRef<HTMLDivElement>(null);
  const res = useQuery({ queryKey: ['customers', 'pick', dq], queryFn: () => get<Paged<Customer>>(`/api/customers${qs({ q: dq, pageSize: 8 })}`), enabled: open });
  useEffect(() => {
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  if (value) {
    return (
      <div className="row" style={{ padding: '8px 12px', border: '1px solid var(--line-strong)', borderRadius: 8, background: 'var(--bg-input)', justifyContent: 'space-between' }}>
        <span><strong>{personName(value)}</strong> <span className="dim mono small">{value.customerNumber}</span></span>
        {!disabled ? <button type="button" className="btn ghost sm" onClick={() => onChange(null)}>Ändern</button> : null}
      </div>
    );
  }
  return (
    <div className="search" ref={ref} style={{ maxWidth: 'none' }}>
      <input type="text" placeholder="Kunde suchen (Name, Nummer, Telefon) …" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} style={{ paddingLeft: 12 }} disabled={disabled} />
      {open ? (
        <div className="search-pop">
          {res.isLoading ? <div className="search-hit muted">Suche …</div> : null}
          {res.data?.items.length === 0 ? <div className="search-hit muted">Kein Kunde gefunden</div> : null}
          {res.data?.items.map((c) => (
            <div key={c.id} className="search-hit" onMouseDown={() => { onChange(c); setOpen(false); setQ(''); }}>
              <div><div className="title">{personName(c)}</div><div className="sub">{c.customerNumber}{c.city ? ` · ${c.city}` : ''}{c.phone ? ` · ${c.phone}` : ''}</div></div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function VehicleSelect({ customerId, value, onChange }: { customerId: string | null; value: string | null; onChange: (id: string | null) => void }) {
  const res = useQuery({ queryKey: ['vehicles', 'of', customerId], queryFn: () => get<Paged<{ vehicle: Vehicle }>>(`/api/vehicles${qs({ customerId, pageSize: 100 })}`), enabled: Boolean(customerId) });
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} disabled={!customerId}>
      <option value="">{customerId ? (res.data?.items.length ? '– kein Fahrzeug –' : 'Kunde hat noch kein Fahrzeug') : 'Zuerst Kunde wählen'}</option>
      {res.data?.items.map(({ vehicle: v }) => <option key={v.id} value={v.id}>{[v.make, v.model].filter(Boolean).join(' ')}{v.licensePlate ? ` · ${v.licensePlate}` : ''}</option>)}
    </select>
  );
}

export function UserSelect({ value, onChange, allowEmpty = true }: { value: string | null; onChange: (id: string | null) => void; allowEmpty?: boolean }) {
  const res = useQuery({ queryKey: ['crm-assignees'], queryFn: () => get<{ items: Array<{ id: string; firstName: string; lastName: string }> }>('/api/crm/assignees') });
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      {allowEmpty ? <option value="">– nicht zugewiesen –</option> : null}
      {res.data?.items.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
    </select>
  );
}
