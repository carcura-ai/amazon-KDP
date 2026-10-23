// E-Mail-Versand an Kunden über das web.de-Postfach von Carcura (SMTP).
// web.de: In den Postfach-Einstellungen "POP3/IMAP Abruf" bzw. SMTP-Zugriff erlauben.

import nodemailer from "nodemailer";

export function createMailer(cfg) {
  if (!cfg.user || !cfg.pass) return null;
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    requireTLS: cfg.port === 587,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  return {
    async send({ to, subject, text }) {
      await transport.sendMail({ from: cfg.from, to, bcc: cfg.bcc || undefined, subject, text });
    },
  };
}
