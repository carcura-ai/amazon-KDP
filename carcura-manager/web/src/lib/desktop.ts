/**
 * Brücke zur Windows-Desktop-App (Electron-Hülle, siehe desktop/). Die Hülle stellt über ein
 * Preload-Skript nur dieses kleine, schreibgeschützte Objekt bereit – keinen Node-Zugriff.
 */
export interface CarcuraDesktop {
  isDesktop: true;
  version: string;
  platform: string;
  serverUrl: string;
  changeServer: () => void;
  reload: () => void;
}

export const desktop: CarcuraDesktop | null = typeof window !== 'undefined' ? ((window as unknown as { carcuraDesktop?: CarcuraDesktop }).carcuraDesktop ?? null) : null;
export const isDesktop = Boolean(desktop?.isDesktop);
