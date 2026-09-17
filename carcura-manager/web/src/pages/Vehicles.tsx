import { useState, type FormEvent } from 'react';
import { Download } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { get, post, patch, qs } from '../api/client';
import type { Vehicle, Paged, DuplicateHit, Customer } from '../api/types';
import { Button, Card, Empty, Field, Input, Modal, PageHead, Pager, Select, Skeleton, Textarea, useDebounced, useToast } from '../components/ui';
import { fmtNumber, personName, VEHICLE_TYPES } from '../lib/format';

type Row = { vehicle: Vehicle; customer: Pick<Customer, 'id' | 'customerNumber' | 'firstName' | 'lastName' | 'companyName'> };

export function VehiclesPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const navigate = useNavigate();
  const list = useQuery({ queryKey: ['vehicles', { dq, page }], queryFn: () => get<Paged<Row>>(`/api/vehicles${qs({ q: dq, page, pageSize: 50 })}`) });
  return (
    <>
      <PageHead title="Fahrzeuge" sub="Alle Fahrzeuge der Kunden. Neue Fahrzeuge werden in der Kundenakte angelegt." actions={<a className="btn" href="/api/export/vehicles.csv"><Download /> CSV</a>} />
      <Card tight>
        <div className="toolbar"><input type="search" placeholder="Kennzeichen, Marke, Modell, VIN …" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        {list.isLoading ? <Skeleton rows={6} /> : list.data && list.data.items.length === 0 ? <Empty title="Keine Fahrzeuge" text="Fahrzeuge werden in der Kundenakte hinzugefügt." /> : (
          <>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Kennzeichen</th><th>Fahrzeug</th><th>Kunde</th><th className="hide-mobile">Typ</th><th className="num hide-mobile">Baujahr</th><th className="num hide-mobile">km</th></tr></thead>
              <tbody>{list.data?.items.map(({ vehicle: v, customer: c }) => (
                <tr key={v.id} className="row-link" onClick={() => navigate(`/fahrzeuge/${v.id}`)}>
                  <td className="mono">{v.licensePlate ?? '–'}</td>
                  <td><div className="primary">{[v.make, v.model].filter(Boolean).join(' ') || '–'}</div><div className="secondary">{v.color ?? ''}</div></td>
                  <td><Link to={`/kunden/${c.id}`} onClick={(e) => e.stopPropagation()}>{personName(c)}</Link><div className="secondary mono">{c.customerNumber}</div></td>
                  <td className="hide-mobile muted">{v.vehicleType ?? '–'}</td>
                  <td className="num hide-mobile">{v.year ?? '–'}</td>
                  <td className="num hide-mobile">{fmtNumber(v.mileage)}</td>
                </tr>
              ))}</tbody>
            </table></div>
            {list.data ? <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} /> : null}
          </>
        )}
      </Card>
    </>
  );
}

export function VehicleForm({ customerId, vehicle, onClose }: { customerId: string; vehicle?: Vehicle; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ licensePlate: vehicle?.licensePlate ?? '', make: vehicle?.make ?? '', model: vehicle?.model ?? '', year: vehicle?.year ? String(vehicle.year) : '', mileage: vehicle?.mileage ? String(vehicle.mileage) : '', color: vehicle?.color ?? '', vehicleType: vehicle?.vehicleType ?? '', vin: vehicle?.vin ?? '', notes: vehicle?.notes ?? '' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const [dups, setDups] = useState<DuplicateHit[]>([]);
  const dq = useDebounced(f.licensePlate, 400);
  useQuery({ queryKey: ['dups-v', dq], queryFn: async () => { const r = await get<{ hits: DuplicateHit[] }>(`/api/crm/duplicates${qs({ plate: dq, excludeId: vehicle?.id })}`); setDups(r.hits); return r; }, enabled: dq.trim().length >= 3 });
  const m = useMutation({
    mutationFn: (payload: Record<string, unknown>) => (vehicle ? patch<Vehicle>(`/api/vehicles/${vehicle.id}`, payload) : post<{ vehicle: Vehicle }>('/api/vehicles', payload).then((r) => r.vehicle)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); qc.invalidateQueries({ queryKey: ['customer', customerId] }); if (vehicle) qc.invalidateQueries({ queryKey: ['vehicle', vehicle.id] }); toast.ok(vehicle ? 'Fahrzeug gespeichert' : 'Fahrzeug angelegt'); onClose(); },
    onError: (e) => toast.fromError(e),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate({ customerId, licensePlate: f.licensePlate || null, make: f.make || null, model: f.model || null, year: f.year ? Number(f.year) : null, mileage: f.mileage ? Number(f.mileage) : null, color: f.color || null, vehicleType: f.vehicleType || null, vin: f.vin || null, notes: f.notes || null });
  };
  return (
    <Modal title={vehicle ? 'Fahrzeug bearbeiten' : 'Fahrzeug hinzufügen'} onClose={onClose}>
      <form onSubmit={submit}>
        {dups.length > 0 ? <div className="dup-box" style={{ marginBottom: 14 }}>Kennzeichen bereits vorhanden: {dups.map((d) => <Link key={d.id} to={`/fahrzeuge/${d.id}`}>{d.label} </Link>)}</div> : null}
        <div className="form-grid">
          <Field label="Kennzeichen"><Input value={f.licensePlate} onChange={set('licensePlate')} placeholder="K-AB 1234" style={{ textTransform: 'uppercase' }} /></Field>
          <Field label="Fahrzeugtyp"><Select value={f.vehicleType} onChange={set('vehicleType')}><option value="">–</option>{VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
          <Field label="Marke"><Input value={f.make} onChange={set('make')} /></Field>
          <Field label="Modell"><Input value={f.model} onChange={set('model')} /></Field>
          <Field label="Baujahr"><Input type="number" min={1950} max={2100} value={f.year} onChange={set('year')} /></Field>
          <Field label="Kilometerstand"><Input type="number" min={0} value={f.mileage} onChange={set('mileage')} /></Field>
          <Field label="Farbe"><Input value={f.color} onChange={set('color')} /></Field>
          <Field label="VIN / Fahrgestellnummer"><Input value={f.vin} onChange={set('vin')} maxLength={20} /></Field>
          <Field label="Notizen" className="span-2"><Textarea value={f.notes} onChange={set('notes')} /></Field>
        </div>
        <div className="form-actions"><Button type="button" onClick={onClose}>Abbrechen</Button><Button type="submit" variant="primary" loading={m.isPending}>{vehicle ? 'Speichern' : 'Hinzufügen'}</Button></div>
      </form>
    </Modal>
  );
}
