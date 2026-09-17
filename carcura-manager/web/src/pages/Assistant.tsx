import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Send, Sparkles, MessageSquarePlus } from 'lucide-react';
import { get, post } from '../api/client';
import { useAuth } from '../app/auth';
import { Badge, Button, Card, PageHead, useToast } from '../components/ui';

interface Msg { id: string; role: string; content: string; toolsUsedJson: string | null; createdAt: string }
const SUGGESTIONS = ['Wie war diese Woche?', 'Welche Leistung bringt den meisten Umsatz?', 'Wo verlieren wir Leads?', 'Welche Kampagne funktioniert am besten?', 'Wie hoch waren unsere Kosten diesen Monat?', 'Welche Kunden haben lange nichts mehr gebucht?', 'Welche Leistungen sollten wir preislich überprüfen?', 'Wie sieht unsere Auslastung aus?', 'Welche Rechnungen sind offen?'];

export function AssistantPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [conv, setConv] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const status = useQuery({ queryKey: ['assistant-status'], queryFn: () => get<{ configured: boolean; model: string }>('/api/assistant/status') });
  const convs = useQuery({ queryKey: ['assistant-convs'], queryFn: () => get<{ items: Array<{ conversationId: string; title: string; createdAt: string }> }>('/api/assistant/conversations') });
  const msgs = useQuery({ queryKey: ['assistant-conv', conv], queryFn: () => get<{ items: Msg[] }>(`/api/assistant/conversations/${conv}`), enabled: Boolean(conv) });
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.data, pending]);
  const ask = useMutation({
    mutationFn: (question: string) => post<{ conversationId: string; answer: string; toolsUsed: string[] }>('/api/assistant/chat', { conversationId: conv ?? undefined, question }),
    onSuccess: (r) => { setConv(r.conversationId); setPending(null); qc.invalidateQueries({ queryKey: ['assistant-conv', r.conversationId] }); qc.invalidateQueries({ queryKey: ['assistant-convs'] }); },
    onError: (e) => { setPending(null); toast.fromError(e, 'Assistent'); },
  });
  const send = (question: string) => { if (!question.trim() || ask.isPending) return; setPending(question); setQ(''); ask.mutate(question); };
  const items = msgs.data?.items ?? [];
  return (
    <>
      <PageHead title="Business-Assistent" sub="Beantwortet Fragen ausschließlich aus den echten Systemdaten (Umsatz, Leads, Aufträge, Kosten, Marketing, Lager). Antworten sind als Fakt, Berechnung, Schätzung oder Empfehlung gekennzeichnet." actions={<Button onClick={() => { setConv(null); }}><MessageSquarePlus /> Neue Unterhaltung</Button>} />
      {status.data && !status.data.configured ? <Card><div className="empty"><h3>Assistent noch nicht eingerichtet</h3><p>Unter Einstellungen → Integrationen den Anthropic-API-Key hinterlegen. Es werden nur aggregierte Kennzahlen an die KI übermittelt, keine Dokumente.</p>{can('integrations:manage') ? <Link className="btn primary" to="/einstellungen/integrationen" style={{ marginTop: 12 }}>Zu den Integrationen</Link> : null}</div></Card> : (
        <div className="grid main-side" style={{ gridTemplateColumns: 'minmax(0, 2.6fr) minmax(220px, 1fr)' }}>
          <Card tight>
            <div style={{ minHeight: 420, maxHeight: '65vh', overflowY: 'auto', padding: 18 }} className="stack">
              {items.length === 0 && !pending ? <div className="empty"><Sparkles size={28} style={{ color: 'var(--brand)', marginBottom: 8 }} /><h3>Was möchtest du wissen?</h3><div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>{SUGGESTIONS.map((s) => <Button key={s} size="sm" onClick={() => send(s)}>{s}</Button>)}</div></div> : null}
              {items.map((m) => (
                <div key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', padding: '10px 14px', borderRadius: 12, background: m.role === 'user' ? 'var(--brand)' : 'var(--bg-hover)', color: m.role === 'user' ? 'var(--brand-ink)' : 'var(--fg)', whiteSpace: 'pre-wrap' }}>
                  {m.content}
                  {m.role === 'assistant' && m.toolsUsedJson && (JSON.parse(m.toolsUsedJson) as string[]).length ? <div className="row" style={{ marginTop: 6 }}>{(JSON.parse(m.toolsUsedJson) as string[]).map((t, i) => <Badge key={i} plain>{t}</Badge>)}</div> : null}
                </div>
              ))}
              {pending ? <><div style={{ alignSelf: 'flex-end', maxWidth: '85%', padding: '10px 14px', borderRadius: 12, background: 'var(--brand)', color: 'var(--brand-ink)' }}>{pending}</div><div className="row" style={{ padding: '6px 4px' }}><span className="spinner" /><span className="muted small">Werte Systemdaten aus …</span></div></> : null}
              <div ref={bottom} />
            </div>
            <form onSubmit={(e: FormEvent) => { e.preventDefault(); send(q); }} className="row" style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
              <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Frage stellen, z. B. „Welche Kampagne bringt die günstigsten Leads?“" style={{ flex: 1 }} disabled={ask.isPending} />
              <Button type="submit" variant="primary" loading={ask.isPending}><Send /></Button>
            </form>
          </Card>
          <Card title="Verlauf" tight>
            {convs.data?.items.length ? convs.data.items.map((c) => <div key={c.conversationId} className="doc-row" style={{ cursor: 'pointer', background: conv === c.conversationId ? 'var(--bg-hover)' : undefined }} onClick={() => setConv(c.conversationId)}><div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div><div className="small muted">{new Date(c.createdAt).toLocaleDateString('de-DE')}</div></div></div>) : <p className="muted" style={{ padding: 18 }}>Noch keine Unterhaltungen.</p>}
            <p className="small dim" style={{ padding: '10px 14px' }}>Modell: {status.data?.model}</p>
          </Card>
        </div>
      )}
    </>
  );
}
