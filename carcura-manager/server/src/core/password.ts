import crypto from 'node:crypto';

// scrypt-Parameter (OWASP-Empfehlung: N=2^17, r=8, p=1 – hier N=2^16 für flüssiges Login auf Laptops)
const N = 1 << 16;
const R = 8;
const P = 1;
const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4]!, 'base64');
  const expected = Buffer.from(parts[5]!, 'base64');
  const actual = await scrypt(password, salt, n, r, p);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function scrypt(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEYLEN, { N: n, r, p, maxmem: 256 * 1024 * 1024 }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 10) return 'Das Passwort muss mindestens 10 Zeichen lang sein.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Das Passwort braucht Groß- und Kleinbuchstaben sowie eine Ziffer.';
  }
  return null;
}
