import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { get, del } from '../api/client';
import type { Vehicle, Customer, Activity } from '../api/types';
import { useAuth } from '../app/auth';
import { Button, Card, Confirm, PageHead, Skeleton, useToast } from '../components/ui';
import { fmtDate, fmtNumber, personName } from '../lib/format';
import { VehicleForm } from './Vehicles';
import { Timeline } from './CustomerDetail';

export function VehicleDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [edit, setEdit] = useState(false);
  const [remove, setRemove] = useState(false);
  const q = useQuery({ queryKey: ['vehicle', id], queryFn: () => get<{ vehicle: Vehicle; customer: Customer; activities: Activity[] }>(`/api/vehicles/${id}`) });
  const doDelete = useMutation({ mutationFn: () => del(`/api/vehicles/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); toast.ok('Fahrzeug entfernt'); navigate(`/kunden/${q.data?.customer.id}`); }, onError: (e) => toast.fromError(e) });
  if (q.isLoading) return <Card><Skeleton rows={6} /></Card>;
  if (!q.data) return <Card><div className="empty"><h3>Fahrzeug nicht gefunden</h3></div></Card>;
  const { vehicle: v, customer: c, activities } = q.data;
  const title = [v.make, v.model].filter(Boolean).join(' ') || 'Fahrzeug';
  return (
    <>
      <PageHead
        crumbs={<><Link to="/fahrzeuge">Fahrzeuge</Link><span>/</span><Link to={`/kunden/${c.id}`}>{personName(c)}</Link></>}
        title={title}
        sub={<span className="mono">{v.licensePlate ?? 'ohne Kennzeichen'}</span>}
        actions={can('vehicles:write') ? <><Button onClick={() => setEdit(true)}><Pencil /> Bearbeiten</Button><Button variant="danger" onClick={() => setRemove(true)}><Trash2 /></Button></> : null}
      />
      <div className="grid main-side">
        <Card title="Fahrzeugdaten">
          <dl className="dl">
            <dt>Halter</dt><dd><Link to={`/kunden/${c.id}`}>{personName(c)}</Link> <span className="dim mono">{c.customerNumber}</span></dd>
            <dt>Kennzeichen</dt><dd className="mono">{v.licensePlate ?? '–'}</dd>
            <dt>Marke / Modell</dt><dd>{title}</dd>
            <dt>Typ</dt><dd>{v.vehicleType ?? '–'}</dd>
            <dt>Baujahr</dt><dd>{v.year ?? '–'}</dd>
            <dt>Kilometerstand</dt><dd>{v.mileage ? `${fmtNumber(v.mileage)} km` : '–'}</dd>
            <dt>Farbe</dt><dd>{v.color ?? '–'}</dd>
            <dt>VIN</dt><dd className="mono">{v.vin ?? '–'}</dd>
            <dt>Angelegt</dt><dd>{fmtDate(v.createdAt)}</dd>
            <dt>Notizen</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{v.notes ?? '–'}</dd>
          </dl>
        </Card>
        <Card title="Aufbereitungshistorie"><Timeline items={activities} /><p className="small dim" style={{ marginTop: 10 }}>Aufträge, Protokolle und Bilder erscheinen hier, sobald die Module aktiv sind.</p></Card>
      </div>
      {edit ? <VehicleForm customerId={c.id} vehicle={v} onClose={() => setEdit(false)} /> : null}
      {remove ? <Confirm title="Fahrzeug entfernen?" text="Das Fahrzeug wird deaktiviert und aus Listen ausgeblendet." confirmLabel="Entfernen" danger loading={doDelete.isPending} onConfirm={() => doDelete.mutate()} onClose={() => setRemove(false)} /> : null}
    </>
  );
}
