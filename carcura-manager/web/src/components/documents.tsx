import { useRef, useState, type DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Download, Trash2, Upload, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { get, del, qs } from '../api/client';
import type { FileRow } from '../api/types';
import { useAuth } from '../app/auth';
import { Badge, Button, Confirm, Select, useToast } from './ui';
import { fmtDateTime } from '../lib/format';

export const FILE_CATEGORY: Record<string, string> = { before: 'Vorher', during: 'Währenddessen', after: 'Nachher', damage: 'Schaden', detail: 'Detail', offer: 'Angebot', invoice: 'Rechnung', protocol: 'Protokoll', other: 'Sonstiges' };

export async function uploadFiles(files: FileList | File[], meta: Record<string, string | null | undefined>): Promise<FileRow[]> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(meta)) if (v) fd.append(k, v);
  for (const f of Array.from(files)) fd.append('file', f, f.name);
  const res = await fetch('/api/files', { method: 'POST', body: fd, credentials: 'same-origin' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? 'Upload fehlgeschlagen');
  return data.items as FileRow[];
}

export function Dropzone({ meta, onDone, categories = true, compact }: { meta: Record<string, string | null | undefined>; onDone: (files: FileRow[]) => void; categories?: boolean; compact?: boolean }) {
  const toast = useToast();
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState(meta.category ?? 'other');
  const input = useRef<HTMLInputElement>(null);
  const handle = async (list: FileList | File[]) => {
    if (!list.length) return;
    setBusy(true);
    try {
      const rows = await uploadFiles(list, { ...meta, category });
      toast.ok(`${rows.length} Datei${rows.length === 1 ? '' : 'en'} hochgeladen`);
      onDone(rows);
    } catch (e) { toast.fromError(e, 'Upload fehlgeschlagen'); } finally { setBusy(false); }
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); void handle(e.dataTransfer.files); };
  return (
    <div className="stack" style={{ gap: 8 }}>
      {categories ? <div className="row"><span className="small muted">Kategorie:</span><Select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: 'auto' }}>{Object.entries(FILE_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div> : null}
      <div className={`dropzone ${over ? 'over' : ''}`} style={compact ? { padding: 10 } : undefined} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop} onClick={() => input.current?.click()}>
        {busy ? <span className="row" style={{ justifyContent: 'center' }}><span className="spinner" /> Lade hoch …</span> : <span className="row" style={{ justifyContent: 'center' }}><Upload size={16} /> Bilder oder PDFs hierher ziehen oder klicken (JPG, PNG, WebP, PDF · max. 25 MB)</span>}
        <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display: 'none' }} onChange={(e) => { if (e.target.files) void handle(e.target.files); e.target.value = ''; }} />
      </div>
    </div>
  );
}

export function DocumentsPanel({ filter, meta }: { filter: { customerId?: string; vehicleId?: string; orderId?: string; protocolId?: string }; meta: Record<string, string | null | undefined> }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const key = ['files', filter];
  const q = useQuery({ queryKey: key, queryFn: () => get<{ items: FileRow[] }>(`/api/files${qs(filter)}`) });
  const [remove, setRemove] = useState<FileRow | null>(null);
  const [light, setLight] = useState<number | null>(null);
  const doDelete = useMutation({ mutationFn: (id: string) => del(`/api/files/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['files'] }); toast.ok('Datei gelöscht'); setRemove(null); }, onError: (e) => toast.fromError(e) });
  const items = q.data?.items ?? [];
  const images = items.filter((f) => f.kind === 'image');
  const docs = items.filter((f) => f.kind !== 'image' && f.kind !== 'signature');
  const groups = new Map<string, FileRow[]>();
  for (const f of images) groups.set(f.category, [...(groups.get(f.category) ?? []), f]);
  return (
    <div className="stack" style={{ gap: 16 }}>
      {can('documents:write') ? <Dropzone meta={meta} onDone={() => qc.invalidateQueries({ queryKey: ['files'] })} /> : null}
      {images.length === 0 && docs.length === 0 ? <p className="muted">Noch keine Dateien.</p> : null}
      {[...groups.entries()].map(([cat, list]) => (
        <div key={cat}>
          <div className="row" style={{ marginBottom: 8 }}><h3>{FILE_CATEGORY[cat] ?? cat}</h3><span className="dim small">{list.length}</span></div>
          <div className="gallery">
            {list.map((f) => (
              <div key={f.id} className="thumb" onClick={() => setLight(images.indexOf(f))}>
                <img src={`/files/${f.id}?variant=thumb`} alt={f.caption ?? f.originalName} loading="lazy" />
                {f.caption ? <div className="cap">{f.caption}</div> : null}
              </div>
            ))}
          </div>
        </div>
      ))}
      {docs.length ? (
        <div className="card" style={{ boxShadow: 'none' }}>
          {docs.map((f) => (
            <div key={f.id} className="doc-row">
              <div className="ico"><FileText size={18} /></div>
              <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.originalName}</div><div className="small muted">{FILE_CATEGORY[f.category] ?? f.category} · {fmtDateTime(f.createdAt)} · {Math.round(f.sizeBytes / 1024)} KB</div></div>
              <a className="btn sm" href={`/files/${f.id}`} target="_blank" rel="noreferrer">Öffnen</a>
              <a className="btn sm ghost" href={`/files/${f.id}?download=true`}><Download /></a>
              {can('documents:write') ? <Button size="sm" variant="ghost" onClick={() => setRemove(f)}><Trash2 /></Button> : null}
            </div>
          ))}
        </div>
      ) : null}
      {light !== null && images[light] ? (
        <div className="lightbox" onClick={() => setLight(null)}>
          <div className="bar" onClick={(e) => e.stopPropagation()}>
            <Badge plain>{FILE_CATEGORY[images[light]!.category]}{images[light]!.caption ? ` · ${images[light]!.caption}` : ''}</Badge>
            <a className="btn sm" href={`/files/${images[light]!.id}?download=true`}><Download /></a>
            {can('documents:write') ? <Button size="sm" variant="danger" onClick={() => { setRemove(images[light!]!); setLight(null); }}><Trash2 /></Button> : null}
            <Button size="sm" onClick={() => setLight(null)}><X /></Button>
          </div>
          {images.length > 1 ? <><Button className="icon" style={{ position: 'absolute', left: 12 }} onClick={(e) => { e.stopPropagation(); setLight((light + images.length - 1) % images.length); }}><ChevronLeft /></Button><Button className="icon" style={{ position: 'absolute', right: 12 }} onClick={(e) => { e.stopPropagation(); setLight((light + 1) % images.length); }}><ChevronRight /></Button></> : null}
          <img src={`/files/${images[light]!.id}?variant=display`} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      ) : null}
      {remove ? <Confirm title="Datei löschen?" text={`„${remove.originalName}“ wird endgültig gelöscht.`} confirmLabel="Löschen" danger loading={doDelete.isPending} onConfirm={() => doDelete.mutate(remove.id)} onClose={() => setRemove(null)} /> : null}
    </div>
  );
}
