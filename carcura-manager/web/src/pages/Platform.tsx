import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { get, post, patch } from '../api/client';
import type { Company } from '../api/types';
import { useAuth } from '../app/auth';
import { Badge, Button, Card, Field, Input, Modal, PageHead, Skeleton, useToast } from '../components/ui';
import { fmtDate } from '../lib/format';

export function PlatformPage() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['platform-companies'], queryFn: () => get<{ items: Array<Company & { userCount: number; createdAt: string }>; version: string }>('/api/platform/companies') });
  const [create, setCreate] = useState(false);
  const [f, setF] = useState({ name: '', city: '', primaryColor: '#E8F320', firstName: '', lastName: '', email: '', password: '' });
  const m = useMutation({
    mutationFn: () => post('/api/platform/companies', { company: { name: f.name, city: f.city || null, primaryColor: f.primaryColor }, admin: { firstName: f.firstName, lastName: f.lastName, email: f.email, password: f.password } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-companies'] }); toast.ok('Mandant angelegt'); setCreate(false); },
    onError: (e) => toast.fromError(e),
  });
  const toggle = useMutation({ mutationFn: (c: Company) => patch(`/api/platform/companies/${c.id}`, { isActive: !c.isActive }), onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-companies'] }), onError: (e) => toast.fromError(e) });
  return (
    <>
      <PageHead title="Mandanten" sub={`Betreiber-Ebene · Softwareversion ${q.data?.version ?? ''}`} actions={<Button variant="primary" onClick={() => setCreate(true)}><Plus /> Mandant anlegen</Button>} />
      <Card tight>
        {q.isLoading ? <Skeleton /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Unternehmen</th><th>Slug</th><th className="num">Benutzer</th><th>Status</th><th>Angelegt</th><th></th></tr></thead>
            <tbody>{q.data?.items.map((c) => (
              <tr key={c.id}>
                <td><div className="row"><span style={{ width: 12, height: 12, borderRadius: 3, background: c.primaryColor }} /><span className="primary">{c.name}</span>{c.id === me?.company.id ? <span className="dim">(aktuell)</span> : null}</div></td>
                <td className="mono muted">{c.slug}</td>
                <td className="num">{c.userCount}</td>
                <td>{c.isActive ? <Badge tone="ok">aktiv</Badge> : <Badge tone="danger">deaktiviert</Badge>}</td>
                <td className="muted">{fmtDate(c.createdAt)}</td>
                <td className="num">{c.id !== me?.company.id ? <Button size="sm" variant={c.isActive ? 'danger' : undefined} onClick={() => toggle.mutate(c)}>{c.isActive ? 'Deaktivieren' : 'Aktivieren'}</Button> : null}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      {create ? (
        <Modal title="Neuen Mandanten anlegen" onClose={() => setCreate(false)}>
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); m.mutate(); }}>
            <div className="form-grid">
              <Field label="Firmenname" className="span-2"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
              <Field label="Ort"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
              <Field label="Markenfarbe"><div className="row"><input type="color" value={f.primaryColor} onChange={(e) => setF({ ...f, primaryColor: e.target.value.toUpperCase() })} /><span className="mono">{f.primaryColor}</span></div></Field>
              <Field label="Admin Vorname"><Input required value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></Field>
              <Field label="Admin Nachname"><Input required value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></Field>
              <Field label="Admin E-Mail" className="span-2"><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
              <Field label="Startpasswort" className="span-2"><Input type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
            </div>
            <div className="form-actions"><Button type="button" onClick={() => setCreate(false)}>Abbrechen</Button><Button type="submit" variant="primary" loading={m.isPending}>Anlegen</Button></div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
