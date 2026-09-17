import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, ApiError } from '../api/client';
import type { Me } from '../api/types';

interface AuthState {
  me: Me | null;
  loading: boolean;
  needsSetup: boolean;
  can: (perm: string) => boolean;
  refresh: () => Promise<void>;
}
const AuthCtx = createContext<AuthState>({ me: null, loading: true, needsSetup: false, can: () => false, refresh: async () => {} });

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)] : [232, 243, 32];
}
export function applyBranding(primary: string, secondary: string) {
  const [r, g, b] = hexToRgb(primary);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const root = document.documentElement.style;
  root.setProperty('--brand', primary);
  root.setProperty('--brand-ink', luminance > 0.55 ? secondary : '#ffffff');
  root.setProperty('--brand-soft', `rgba(${r}, ${g}, ${b}, 0.12)`);
  root.setProperty('--brand-line', `rgba(${r}, ${g}, ${b}, 0.35)`);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const setup = useQuery({ queryKey: ['setup-status'], queryFn: () => get<{ needsSetup: boolean }>('/api/setup/status'), staleTime: 60_000 });
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await get<Me>('/api/auth/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    enabled: setup.data?.needsSetup === false,
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (me.data) {
      applyBranding(me.data.company.primaryColor, me.data.company.secondaryColor);
      document.title = me.data.company.name;
    }
  }, [me.data]);

  const perms = new Set(me.data?.permissions ?? []);
  const value: AuthState = {
    me: me.data ?? null,
    loading: setup.isLoading || (setup.data?.needsSetup === false && me.isLoading),
    needsSetup: setup.data?.needsSetup ?? false,
    can: (p) => perms.has(p),
    refresh: async () => {
      await qc.invalidateQueries({ queryKey: ['setup-status'] });
      await qc.invalidateQueries({ queryKey: ['me'] });
    },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
