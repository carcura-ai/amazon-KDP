import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutDashboard, Users, UserPlus, Car, Settings, LogOut, Menu, Search, ShieldCheck, Building2 } from 'lucide-react';
import { useAuth } from './auth';
import { get, post, qs } from '../api/client';
import type { SearchHit } from '../api/types';
import { initials, ROLE_LABEL } from '../lib/format';
import { useDebounced } from '../components/ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard:read', end: true },
  { to: '/leads', label: 'Leads', icon: UserPlus, perm: 'leads:read' },
  { to: '/kunden', label: 'Kunden', icon: Users, perm: 'customers:read' },
  { to: '/fahrzeuge', label: 'Fahrzeuge', icon: Car, perm: 'vehicles:read' },
];

export function AppShell() {
  const { me, can, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  useEffect(() => setOpen(false), [loc.pathname]);

  const leadStats = useQuery({ queryKey: ['leads', 'stats'], queryFn: () => get<{ byStatus: Record<string, number> }>('/api/leads/stats'), enabled: can('leads:read'), refetchInterval: 60_000 });
  const newLeads = leadStats.data?.byStatus.new ?? 0;

  const logout = async () => {
    await post('/api/auth/logout');
    qc.setQueryData(['me'], null);
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' && q.queryKey[0] !== 'setup-status' });
    await refresh();
    navigate('/login');
  };

  if (!me) return null;
  return (
    <div className="app">
      {open ? <div className="sidebar-backdrop" onClick={() => setOpen(false)} /> : null}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">{me.company.name.slice(0, 2).toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <div className="brand-name">{me.company.name}</div>
            <div className="brand-sub">Manager</div>
          </div>
        </div>
        <div className="nav-section">Arbeit</div>
        {NAV.filter((n) => can(n.perm)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <n.icon />
            <span>{n.label}</span>
            {n.to === '/leads' && newLeads > 0 ? <span className="count">{newLeads}</span> : null}
          </NavLink>
        ))}
        {can('settings:manage') || can('users:manage') ? (
          <>
            <div className="nav-section">Verwaltung</div>
            <NavLink to="/einstellungen" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Settings /><span>Einstellungen</span></NavLink>
          </>
        ) : null}
        {me.user.isPlatformAdmin ? (
          <NavLink to="/betreiber" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Building2 /><span>Mandanten</span></NavLink>
        ) : null}
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar">{initials(me.user.firstName, me.user.lastName)}</div>
            <div className="meta">
              <div className="name">{me.user.firstName} {me.user.lastName}</div>
              <div className="role">{ROLE_LABEL[me.user.role] ?? me.user.role}</div>
            </div>
            <button className="btn ghost icon" style={{ marginLeft: 'auto' }} onClick={logout} title="Abmelden" aria-label="Abmelden"><LogOut /></button>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="btn ghost icon menu-btn" onClick={() => setOpen(true)} aria-label="Menü"><Menu /></button>
          <GlobalSearch />
          <div style={{ marginLeft: 'auto' }} className="row hide-mobile">
            <span className="badge plain"><ShieldCheck size={13} /> Angemeldet</span>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const [idx, setIdx] = useState(0);
  const dq = useDebounced(q, 200);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const res = useQuery({ queryKey: ['search', dq], queryFn: () => get<{ hits: SearchHit[] }>(`/api/search${qs({ q: dq })}`), enabled: dq.trim().length >= 2 });
  const hits = res.data?.hits ?? [];
  useEffect(() => setIdx(0), [dq]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setFocus(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const go = (h: SearchHit) => {
    navigate(h.href);
    setQ('');
    setFocus(false);
  };
  return (
    <div className="search" ref={ref}>
      <Search className="icon" />
      <input
        type="search"
        placeholder="Suche: Kunde, Lead, Kennzeichen …"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocus(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setIdx((i) => Math.min(i + 1, hits.length - 1));
          if (e.key === 'ArrowUp') setIdx((i) => Math.max(i - 1, 0));
          if (e.key === 'Enter' && hits[idx]) go(hits[idx]!);
          if (e.key === 'Escape') setFocus(false);
        }}
      />
      {focus && dq.trim().length >= 2 ? (
        <div className="search-pop">
          {res.isLoading ? <div className="search-hit"><span className="spinner" /><span className="muted">Suche …</span></div> : null}
          {!res.isLoading && hits.length === 0 ? <div className="search-hit muted">Keine Treffer für „{dq}“</div> : null}
          {hits.map((h, i) => (
            <div key={`${h.kind}-${h.id}`} className={`search-hit ${i === idx ? 'active' : ''}`} onMouseDown={() => go(h)}>
              <span className="kind">{h.kind === 'customer' ? 'Kunde' : h.kind === 'lead' ? 'Lead' : 'Fahrzeug'}</span>
              <div style={{ minWidth: 0 }}>
                <div className="title">{h.title}</div>
                <div className="sub">{h.subtitle}</div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
