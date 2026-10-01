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
  /** Aufbewahrung von Rechnungen/Buchungsbelegen in Jahren ab Ende des Belegjahres. Voreinstellung 10 (vorsichtig);
   *  für Buchungsbelege gilt seit 2025 in der Regel 8 Jahre (§ 147 AO n. F.) – mit dem Steuerberater abstimmen. */
  documentRetentionYears: z.number().int().min(6).max(12).default(10),
  marketingRetentionMonths: z.number().int().min(3).max(120).default(25),  // Kampagnen-/Website-Kennzahlen (Vorjahresvergleich)
  assistantRetentionDays: z.number().int().min(1).max(3650).default(180),  // Verlauf des KI-Assistenten
  exportRetentionDays: z.number().int().min(1).max(30).default(7),         // bereitgestellte Export-Dateien
  assistantPersonalData: z.boolean().default(false),                       // Namen/Kontaktdaten an den KI-Assistenten übermitteln
  /** Belegimport: Fotos/PDFs ohne E-Rechnungsdaten von der KI (Anthropic) auslesen lassen. Der Beleg enthält Personendaten. */
  aiDocumentRecognition: z.boolean().default(false),
  require2faForAdmins: z.boolean().default(false),
});
export type PrivacySettings = z.infer<typeof privacySchema>;

export function privacySettings(company: Pick<typeof companies.$inferSelect, 'settingsJson'>): PrivacySettings {
  let raw: unknown = {};
  try { raw = (JSON.parse(company.settingsJson || '{}') as { privacy?: unknown }).privacy ?? {}; } catch { raw = {}; }
  const parsed = privacySchema.safeParse(raw);
  return parsed.success ? parsed.data : privacySchema.parse({});
}
