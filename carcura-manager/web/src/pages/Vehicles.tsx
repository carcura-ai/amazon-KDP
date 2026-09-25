import { useState, type FormEvent } from 'react';
import { Download } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { get, post, patch, qs } from '../api/client';
import type { Vehicle, Paged, DuplicateHit, Customer } from '../api/types';
import { Button, Card, Empty, Field, Input, Modal, PageHead, Pager, Skeleton, Textarea, useDebounced, useToast } from '../components/ui';
import { personName } from '../lib/format';

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
        <div className="toolbar"><input type="search" placeholder="Kennzeichen, Marke, Modell …" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        {list.isLoading ? <Skeleton rows={6} /> : list.data && list.data.items.length === 0 ? <Empty title="Keine Fahrzeuge" text="Fahrzeuge werden in der Kundenakte hinzugefügt." /> : (
          <>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Kennzeichen</th><th>Fahrzeug</th><th>Kunde</th><th className="hide-mobile">Besondere Merkmale</th></tr></thead>
              <tbody>{list.data?.items.map(({ vehicle: v, customer: c }) => (
                <tr key={v.id} className="row-link" onClick={() => navigate(`/fahrzeuge/${v.id}`)}>
                  <td className="mono">{v.licensePlate ?? '–'}</td>
                  <td><div className="primary">{[v.make, v.model].filter(Boolean).join(' ') || '–'}</div></td>
                  <td><Link to={`/kunden/${c.id}`} onClick={(e) => e.stopPropagation()}>{personName(c)}</Link><div className="secondary mono">{c.customerNumber}</div></td>
                  <td className="hide-mobile muted">{v.notes ? (v.notes.length > 60 ? `${v.notes.slice(0, 60)} …` : v.notes) : '–'}</td>
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
  const [f, setF] = useState({ licensePlate: vehicle?.licensePlate ?? '', make: vehicle?.make ?? '', model: vehicle?.model ?? '', notes: vehicle?.notes ?? '' });
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
    m.mutate({ customerId, licensePlate: f.licensePlate || null, make: f.make || null, model: f.model || null, notes: f.notes || null });
  };
  return (
    <Modal title={vehicle ? 'Fahrzeug bearbeiten' : 'Fahrzeug hinzufügen'} onClose={onClose}>
      <form onSubmit={submit}>
        {dups.length > 0 ? <div className="dup-box" style={{ marginBottom: 14 }}>Kennzeichen bereits vorhanden: {dups.map((d) => <Link key={d.id} to={`/fahrzeuge/${d.id}`}>{d.label} </Link>)}</div> : null}
        <div className="form-grid">
          <Field label="Kennzeichen"><Input value={f.licensePlate} onChange={set('licensePlate')} placeholder="K-AB 1234" style={{ textTransform: 'uppercase' }} /></Field>
          <Field label="Marke"><Input value={f.make} onChange={set('make')} /></Field>
          <Field label="Modell"><Input value={f.model} onChange={set('model')} /></Field>
          <Field label="Besondere Merkmale" className="span-2" hint="z. B. Vorschäden, Folierung, Hinweise zur Aufbereitung"><Textarea value={f.notes} onChange={set('notes')} /></Field>
        </div>
        <div className="form-actions"><Button type="button" onClick={onClose}>Abbrechen</Button><Button type="submit" variant="primary" loading={m.isPending}>{vehicle ? 'Speichern' : 'Hinzufügen'}</Button></div>
      </form>
    </Modal>
  );
}
