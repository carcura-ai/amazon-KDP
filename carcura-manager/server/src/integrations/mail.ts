import nodemailer, { type Transporter } from 'nodemailer';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { companies, emailLog } from '../db/schema.js';
import { newId } from '../core/ids.js';
import type { IntegrationStore } from './store.js';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string | null;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  refType?: string;
  refId?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}

export class MailService {
  /** Für Tests: ersetzt den echten SMTP-Transport. */
  transportOverride: Transporter | null = null;

  constructor(private readonly db: Db, private readonly store: IntegrationStore) {}

  isConfigured(companyId: string): boolean {
    return Boolean(this.transportOverride) || this.store.get<SmtpConfig>(companyId, 'smtp') !== null;
  }

  private transport(cfg: SmtpConfig): Transporter {
    if (this.transportOverride) return this.transportOverride;
    return nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined, connectionTimeout: 15_000, socketTimeout: 20_000 });
  }

  async verify(cfg: SmtpConfig): Promise<void> {
    await this.transport(cfg).verify();
  }

  async send(companyId: string, msg: MailMessage): Promise<{ ok: true; messageId: string | null } | { ok: false; error: string }> {
    const found = this.store.get<SmtpConfig>(companyId, 'smtp');
    const cfg: SmtpConfig | null = found?.config ?? (this.transportOverride ? { host: 'test', port: 25, secure: false, user: '', pass: '', fromName: 'Test', fromEmail: 'test@example.test' } : null);
    if (!cfg) return { ok: false, error: 'Kein E-Mail-Versand (SMTP) konfiguriert.' };
    const company = this.db.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId)).get();
    try {
      const info = await this.transport(cfg).sendMail({
        from: { name: cfg.fromName || company?.name || 'Manager', address: cfg.fromEmail },
        to: msg.to,
        replyTo: cfg.replyTo ?? undefined,
        subject: msg.subject,
        text: msg.text,
        html: msg.html ?? textToHtml(msg.text),
        attachments: msg.attachments,
      });
      const messageId = (info as { messageId?: string }).messageId ?? null;
      this.db.insert(emailLog).values({ id: newId(), companyId, toAddress: msg.to, subject: msg.subject, status: 'sent', messageId, refType: msg.refType ?? null, refId: msg.refId ?? null }).run();
      if (found) this.store.setStatus(companyId, 'smtp', 'ok', null, true);
      return { ok: true, messageId };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.db.insert(emailLog).values({ id: newId(), companyId, toAddress: msg.to, subject: msg.subject, status: 'failed', error, refType: msg.refType ?? null, refId: msg.refId ?? null }).run();
      if (found) this.store.setStatus(companyId, 'smtp', 'error', error);
      return { ok: false, error };
    }
  }
}

export function textToHtml(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#111;padding:8px"><div style="white-space:pre-wrap">${esc}</div></body></html>`;
}
