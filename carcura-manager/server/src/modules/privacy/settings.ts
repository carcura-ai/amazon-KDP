import { z } from 'zod';
import type { companies } from '../../db/schema.js';

/**
 * Datenschutz- und Sicherheitseinstellungen je Mandant (in companies.settings_json unter „privacy“).
 * Fristen sind Voreinstellungen ohne Rechtsberatung; sie sollten mit dem Datenschutzbeauftragten
 * bzw. Steuerberater abgestimmt werden (Löschkonzept, siehe docs/06).
 */
export const privacySchema = z.object({
  leadRetentionMonths: z.number().int().min(1).max(120).default(12),      // verlorene/unbeantwortete Leads
  emailLogRetentionMonths: z.number().int().min(1).max(120).default(12),  // Versandprotokoll
  auditRetentionMonths: z.number().int().min(6).max(240).default(24),     // Audit-Log
  jobLogRetentionDays: z.number().int().min(7).max(3650).default(90),     // Protokoll der automatischen Aufgaben
  inactiveCustomerYears: z.number().int().min(0).max(30).default(0),      // 0 = keine automatische Anonymisierung
  assistantPersonalData: z.boolean().default(false),                       // Namen/Kontaktdaten an den KI-Assistenten übermitteln
  require2faForAdmins: z.boolean().default(false),
});
export type PrivacySettings = z.infer<typeof privacySchema>;

export function privacySettings(company: Pick<typeof companies.$inferSelect, 'settingsJson'>): PrivacySettings {
  let raw: unknown = {};
  try { raw = (JSON.parse(company.settingsJson || '{}') as { privacy?: unknown }).privacy ?? {}; } catch { raw = {}; }
  const parsed = privacySchema.safeParse(raw);
  return parsed.success ? parsed.data : privacySchema.parse({});
}
