import crypto from 'node:crypto';

export const newId = (): string => crypto.randomUUID();
export const nowIso = (): string => new Date().toISOString();
export const randomToken = (bytes = 32): string => crypto.randomBytes(bytes).toString('base64url');
