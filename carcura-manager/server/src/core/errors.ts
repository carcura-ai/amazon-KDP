export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (what = 'Datensatz') => new AppError(404, 'not_found', `${what} nicht gefunden.`);
export const forbidden = (msg = 'Keine Berechtigung.') => new AppError(403, 'forbidden', msg);
export const unauthorized = (msg = 'Nicht angemeldet.') => new AppError(401, 'unauthorized', msg);
export const badRequest = (msg: string, details?: unknown) => new AppError(400, 'bad_request', msg, details);
export const conflict = (msg: string, details?: unknown) => new AppError(409, 'conflict', msg, details);
