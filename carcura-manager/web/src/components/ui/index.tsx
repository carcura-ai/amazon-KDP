import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { X, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

/* ---------------------------------------------------------------- Button */
export function Button({ variant, size, loading, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger' | 'ghost'; size?: 'sm'; loading?: boolean }) {
  return (
    <button className={`btn ${variant ?? ''} ${size ?? ''} ${className}`} disabled={loading || rest.disabled} {...rest}>
      {loading ? <span className="spinner" /> : null}
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- Felder */
export function Field({ label, hint, error, children, className = '' }: { label?: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`field ${className}`}>
      {label ? <label>{label}</label> : null}
      {children}
      {error ? <span className="error">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input type="text" {...p} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} />;

/* ---------------------------------------------------------------- Badge */
export function Badge({ tone = '', children, plain }: { tone?: string; children: ReactNode; plain?: boolean }) {
  return <span className={`badge ${tone} ${plain ? 'plain' : ''}`}>{children}</span>;
}

/* ---------------------------------------------------------------- Card */
export function Card({ title, actions, children, tight, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; tight?: boolean; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {title !== undefined || actions ? (
        <header className="card-head">
          <h2>{title}</h2>
          {actions ? <div className="row">{actions}</div> : null}
        </header>
      ) : null}
      <div className={`card-body ${tight ? 'tight' : ''}`}>{children}</div>
    </section>
  );
}

export function PageHead({ title, sub, actions, crumbs }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; crumbs?: ReactNode }) {
  return (
    <div className="page-head">
      <div style={{ minWidth: 0 }}>
        {crumbs ? <div className="crumbs">{crumbs}</div> : null}
        <h1>{title}</h1>
        {sub ? <p className="sub">{sub}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {text ? <p>{text}</p> : null}
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  );
}

export function Kpi({ label, value, delta, tone, accent }: { label: ReactNode; value: ReactNode; delta?: ReactNode; tone?: 'up' | 'down'; accent?: boolean }) {
  return (
    <div className={`card kpi ${accent ? 'accent' : ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta ? <div className={`delta ${tone ?? ''}`}>{delta}</div> : null}
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="stack" style={{ padding: 18 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ width: `${90 - (i % 3) * 15}%` }} />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Modal */
export function Modal({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="Schließen"><X /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({ title, text, confirmLabel = 'Bestätigen', danger, onConfirm, onClose, loading }: { title: string; text: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onClose: () => void; loading?: boolean }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">{text}</p>
      <div className="form-actions">
        <Button onClick={onClose}>Abbrechen</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- Toasts */
interface Toast { id: number; kind: 'ok' | 'error' | 'info'; title: string; message?: string }
const ToastCtx = createContext<{ push: (t: Omit<Toast, 'id'>) => void }>({ push: () => {} });
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { ...t, id }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), t.kind === 'error' ? 7000 : 3500);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.kind === 'ok' ? <CheckCircle2 size={18} color="var(--ok)" /> : t.kind === 'error' ? <AlertTriangle size={18} color="var(--danger)" /> : <Info size={18} color="var(--info)" />}
            <div>
              <div className="t">{t.title}</div>
              {t.message ? <div className="m">{t.message}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() {
  const { push } = useContext(ToastCtx);
  return {
    ok: (title: string, message?: string) => push({ kind: 'ok', title, message }),
    error: (title: string, message?: string) => push({ kind: 'error', title, message }),
    info: (title: string, message?: string) => push({ kind: 'info', title, message }),
    fromError: (e: unknown, title = 'Aktion fehlgeschlagen') => push({ kind: 'error', title, message: e instanceof Error ? e.message : String(e) }),
  };
}

/* ---------------------------------------------------------------- Tabs */
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: Array<{ id: T; label: ReactNode }> }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((it) => (
        <button key={it.id} role="tab" className={`tab ${it.id === value ? 'active' : ''}`} onClick={() => onChange(it.id)} aria-selected={it.id === value}>{it.label}</button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Pager */
export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pager">
      <span>{total === 0 ? 'Keine Einträge' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} von ${total}`}</span>
      <div className="row">
        <Button size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Zurück</Button>
        <span>Seite {page} / {pages}</span>
        <Button size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Weiter</Button>
      </div>
    </div>
  );
}

/** Debounce-Hook für Suchfelder */
export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  const t = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t.current);
  }, [value, ms]);
  return v;
}
