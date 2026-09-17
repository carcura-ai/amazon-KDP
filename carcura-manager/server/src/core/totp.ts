import crypto from 'node:crypto';

/** Zeitbasierte Einmalpasswörter nach RFC 6238 (kompatibel mit Google Authenticator, Apple Passwörter, Authy, 1Password). */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0; let value = 0; let out = '';
  for (const byte of buf) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}
export function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0; let value = 0; const out: number[] = [];
  for (const ch of clean) { value = (value << 5) | ALPHABET.indexOf(ch); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}

export const generateTotpSecret = (): string => base32Encode(crypto.randomBytes(20));

export function totpCode(secret: string, timeStep = Math.floor(Date.now() / 30_000)): string {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(timeStep));
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code = ((hmac[offset]! & 0x7f) << 24) | ((hmac[offset + 1]! & 0xff) << 16) | ((hmac[offset + 2]! & 0xff) << 8) | (hmac[offset + 3]! & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

/** Prüft einen Code mit Toleranz von einem Zeitschritt (30 s) in beide Richtungen. */
export function verifyTotp(secret: string, code: string, now = Date.now()): boolean {
  const c = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(c)) return false;
  const step = Math.floor(now / 30_000);
  for (const d of [0, -1, 1]) { const expected = totpCode(secret, step + d); if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(c))) return true; }
  return false;
}

export function otpauthUrl(issuer: string, account: string, secret: string): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/** Wiederherstellungscodes: 10 Stück, je 10 Zeichen; gespeichert werden nur SHA-256-Hashes. */
export function generateBackupCodes(n = 10): { plain: string[]; hashes: string[] } {
  const plain: string[] = [];
  for (let i = 0; i < n; i++) { const raw = base32Encode(crypto.randomBytes(7)).slice(0, 10).toLowerCase(); plain.push(`${raw.slice(0, 5)}-${raw.slice(5)}`); }
  return { plain, hashes: plain.map(hashBackupCode) };
}
export const hashBackupCode = (code: string): string => crypto.createHash('sha256').update(code.replace(/[\s-]/g, '').toLowerCase()).digest('hex');
