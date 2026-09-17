export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Array<{ path: string; message: string }> | null,
  ) {
    super(message);
  }
  fieldError(path: string): string | undefined {
    return this.details?.find((d) => d.path === path)?.message;
  }
}

export async function api<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...rest,
    headers: { Accept: 'application/json', ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    throw new ApiError(res.status, String(data.error ?? 'error'), String(data.message ?? `Fehler ${res.status}`), (data.details as ApiError['details']) ?? null);
  }
  return data as T;
}

export const get = <T>(url: string) => api<T>(url);
export const post = <T>(url: string, json?: unknown) => api<T>(url, { method: 'POST', json: json ?? {} });
export const patch = <T>(url: string, json: unknown) => api<T>(url, { method: 'PATCH', json });
export const del = <T>(url: string) => api<T>(url, { method: 'DELETE' });

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}
