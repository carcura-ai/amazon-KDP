import crypto from 'node:crypto';

/**
 * AES-256-GCM-Verschlüsselung für Zugangsdaten von Integrationen.
 * Format: base64url( iv(12) | tag(16) | ciphertext )
 */
export class SecretBox {
  private readonly key: Buffer;
  constructor(appSecret: string) {
    this.key = crypto.createHash('sha256').update(`secretbox:${appSecret}`).digest();
  }
  encrypt(plain: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ct]).toString('base64url');
  }
  decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64url');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  }
}

export const sha256 = (input: string): string => crypto.createHash('sha256').update(input).digest('hex');
