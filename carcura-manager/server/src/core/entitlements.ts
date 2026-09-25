import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { plans, planFeatures, addons, tenantSubscriptions, tenantAddons, tenantFeatureOverrides } from '../db/schema.js';
import { newId } from './ids.js';

/**
 * Module (Feature-Schlüssel) und ihre Zuordnung zu Tarifen.
 *
 * Grundsätze:
 * - Jede kostenpflichtige Funktion wird serverseitig geprüft (plugins/entitlements.ts), nie nur im UI.
 * - Ein Modul abzuschalten sperrt nur den Zugriff; Daten werden nie gelöscht und sind nach
 *   Reaktivierung wieder da.
 * - Self-Hosted-Betrieb (DEPLOYMENT_MODE=selfhosted): alle Module ohne Abo.
 * - Preise stehen nur in der Datenbank (Tabelle plans/addons), hier nur Startwerte (Platzhalter).
 */
export const FEATURES = {
  CUSTOMERS: 'Kunden',
  VEHICLES: 'Fahrzeuge',
  CALENDAR: 'Kalender und Termine',
  ORDERS: 'Aufträge',
  OFFERS: 'Angebote',
  INVOICES: 'Rechnungen',
  PROTOCOLS: 'Protokolle, Fotos, Dokumente',
  REPORTS_BASIC: 'Basisberichte',
  BACKUPS: 'Sicherungen',
  CRM_LEADS: 'CRM, Leads, Lead-Pipeline',
  TASKS: 'Aufgaben',
  INVENTORY: 'Lager',
  FINANCE: 'Finanzen',
  MARGINS: 'Preis- und Margenanalyse',
  SERVICE_PLANS: 'Pflegeabos und wiederkehrende Leistungen',
  REMINDERS: 'Erinnerungen und Automationen',
  MARKETING: 'Marketing (Google Ads, Meta, GA4)',
  REPORTS_ADVANCED: 'Erweiterte Berichte',
  TIME_TRACKING: 'Zeiterfassung',
  DEALER_PORTAL: 'Autohausportal',
  CUSTOMER_PORTAL: 'Kundenportal',
  ONLINE_BOOKING: 'Online-Buchung',
  PAINT_MEASUREMENT: 'Lackschichtmessung (PTG)',
  E_INVOICE: 'E-Rechnung (XRechnung/ZUGFeRD)',
  ANALYTICS_ADVANCED: 'Erweiterte Auswertungen',
  COMPETITORS: 'Wettbewerbermonitoring',
  AI_ASSISTANT: 'KI-Assistent',
  API_ACCESS: 'API und Webhooks',
  GRANULAR_PERMISSIONS: 'Individuelle Rechte je Rolle',
  WHITE_LABEL: 'White Label',
  MULTI_LOCATION: 'Mehrere Standorte',
  FLEETS: 'Flotten',
  FRANCHISE: 'Franchise und Gruppen',
  CUSTOM_INTEGRATIONS: 'Individuelle Integrationen',
} as const;
export type FeatureKey = keyof typeof FEATURES;
export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];

const START: FeatureKey[] = ['CUSTOMERS', 'VEHICLES', 'CALENDAR', 'ORDERS', 'OFFERS', 'INVOICES', 'PROTOCOLS', 'REPORTS_BASIC', 'BACKUPS'];
const BUSINESS: FeatureKey[] = [...START, 'CRM_LEADS', 'TASKS', 'INVENTORY', 'FINANCE', 'MARGINS', 'SERVICE_PLANS', 'REMINDERS', 'MARKETING', 'REPORTS_ADVANCED', 'TIME_TRACKING'];
const PRO: FeatureKey[] = [...BUSINESS, 'DEALER_PORTAL', 'CUSTOMER_PORTAL', 'ONLINE_BOOKING', 'PAINT_MEASUREMENT', 'E_INVOICE', 'ANALYTICS_ADVANCED', 'COMPETITORS', 'AI_ASSISTANT', 'API_ACCESS', 'GRANULAR_PERMISSIONS', 'WHITE_LABEL'];
const ENTERPRISE: FeatureKey[] = [...FEATURE_KEYS];

/** Startwerte. Preise sind Platzhalter aus der Planung und werden im Betreiberbereich gepflegt. */
export const DEFAULT_PLANS = [
  { code: 'START', name: 'Start', description: 'Kernfunktionen für Einzelbetriebe', monthlyPriceCents: 2900, yearlyPriceCents: 29000, setupFeeCents: 0, maxUsers: 2, maxLocations: 1, sortOrder: 1, features: START },
  { code: 'BUSINESS', name: 'Business', description: 'CRM, Lager, Finanzen, Marketing, Zeiterfassung', monthlyPriceCents: 5900, yearlyPriceCents: 59000, setupFeeCents: 0, maxUsers: 5, maxLocations: 1, sortOrder: 2, features: BUSINESS },
  { code: 'PRO', name: 'Pro', description: 'Portale, Online-Buchung, E-Rechnung, KI, API, White Label', monthlyPriceCents: 9900, yearlyPriceCents: 99000, setupFeeCents: 0, maxUsers: 15, maxLocations: 1, sortOrder: 3, features: PRO },
  { code: 'ENTERPRISE', name: 'Enterprise', description: 'Standorte, Flotten, Gruppen, individuelle Integrationen', monthlyPriceCents: 14900, yearlyPriceCents: null, setupFeeCents: 0, maxUsers: null, maxLocations: null, sortOrder: 4, features: ENTERPRISE },
] as const;

export const DEFAULT_ADDONS = [
  { code: 'AI', name: 'KI-Assistent', features: ['AI_ASSISTANT'], monthlyPriceCents: 1900, extraUsers: 0, extraLocations: 0 },
  { code: 'MARKETING', name: 'Marketing Analytics', features: ['MARKETING', 'ANALYTICS_ADVANCED'], monthlyPriceCents: 1900, extraUsers: 0, extraLocations: 0 },
  { code: 'DEALER_PORTAL', name: 'Autohausportal', features: ['DEALER_PORTAL'], monthlyPriceCents: 2900, extraUsers: 0, extraLocations: 0 },
  { code: 'CUSTOMER_PORTAL', name: 'Kundenportal', features: ['CUSTOMER_PORTAL'], monthlyPriceCents: 1900, extraUsers: 0, extraLocations: 0 },
  { code: 'ONLINE_BOOKING', name: 'Online-Buchung', features: ['ONLINE_BOOKING'], monthlyPriceCents: 1900, extraUsers: 0, extraLocations: 0 },
  { code: 'PTG', name: 'Lackschichtmessung', features: ['PAINT_MEASUREMENT'], monthlyPriceCents: 900, extraUsers: 0, extraLocations: 0 },
  { code: 'E_INVOICE', name: 'E-Rechnung', features: ['E_INVOICE'], monthlyPriceCents: 900, extraUsers: 0, extraLocations: 0 },
  { code: 'EXTRA_USER', name: 'Zusätzlicher Benutzer', features: [], monthlyPriceCents: 900, extraUsers: 1, extraLocations: 0 },
  { code: 'EXTRA_LOCATION', name: 'Zusätzlicher Standort', features: ['MULTI_LOCATION'], monthlyPriceCents: 2900, extraUsers: 0, extraLocations: 1 },
] as const;

/** Legt Tarife und Add-ons einmalig an, wenn die Tabellen leer sind (bestehende Pflege bleibt unberührt). */
export function seedPlans(db: Db): void {
  if (db.select({ id: plans.id }).from(plans).limit(1).get()) return;
  db.transaction((tx) => {
    for (const p of DEFAULT_PLANS) {
      const id = newId();
      tx.insert(plans).values({ id, code: p.code, name: p.name, description: p.description, monthlyPriceCents: p.monthlyPriceCents, yearlyPriceCents: p.yearlyPriceCents, setupFeeCents: p.setupFeeCents, maxUsers: p.maxUsers, maxLocations: p.maxLocations, sortOrder: p.sortOrder }).run();
      for (const f of p.features) tx.insert(planFeatures).values({ id: newId(), planId: id, featureKey: f }).run();
    }
    DEFAULT_ADDONS.forEach((a, i) => tx.insert(addons).values({ id: newId(), code: a.code, name: a.name, featureKeysJson: JSON.stringify(a.features), monthlyPriceCents: a.monthlyPriceCents, yearlyPriceCents: a.monthlyPriceCents * 10, extraUsers: a.extraUsers, extraLocations: a.extraLocations, sortOrder: i }).run());
  });
}

/** Status, in denen der Mandant arbeiten kann. past_due = Zahlung offen, Kulanzzeit. */
const WORKING = new Set(['trial', 'active', 'past_due']);

export interface Entitlements {
  mode: 'selfhosted' | 'saas';
  /** legacy = Mandant ohne Abo (vor Einführung der Tarife angelegt) → alle Module. */
  source: 'selfhosted' | 'subscription' | 'legacy';
  plan: { id: string; code: string; name: string } | null;
  status: string | null;
  /** Darf der Mandant Daten ändern? Nein bei pausiert/gekündigt nach Vertragsende/abgelaufen (Lesen und Export bleiben möglich). */
  canWrite: boolean;
  features: Set<FeatureKey>;
  limits: { maxUsers: number | null; maxLocations: number | null };
}

function isEffectivelyEnded(sub: typeof tenantSubscriptions.$inferSelect, now: Date): boolean {
  if (sub.status === 'expired') return true;
  if (sub.status === 'cancelled' && (!sub.cancellationDate || new Date(sub.cancellationDate) <= now)) return true;
  if (sub.status === 'trial' && sub.trialEnd && new Date(sub.trialEnd) < now) return true;
  return false;
}

export function computeEntitlements(db: Db, companyId: string, mode: 'selfhosted' | 'saas', now = new Date()): Entitlements {
  const all = new Set(FEATURE_KEYS);
  if (mode === 'selfhosted') return { mode, source: 'selfhosted', plan: null, status: null, canWrite: true, features: all, limits: { maxUsers: null, maxLocations: null } };
  const sub = db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.companyId, companyId)).get();
  if (!sub) return { mode, source: 'legacy', plan: null, status: null, canWrite: true, features: all, limits: { maxUsers: null, maxLocations: null } };
  const plan = db.select().from(plans).where(eq(plans.id, sub.planId)).get()!;
  const features = new Set<FeatureKey>(db.select({ k: planFeatures.featureKey }).from(planFeatures).where(eq(planFeatures.planId, plan.id)).all().map((r) => r.k as FeatureKey));
  let maxUsers = plan.maxUsers;
  let maxLocations = plan.maxLocations;
  const active = db.select({ a: addons, qty: tenantAddons.quantity }).from(tenantAddons).innerJoin(addons, eq(addons.id, tenantAddons.addonId)).where(and(eq(tenantAddons.companyId, companyId), eq(tenantAddons.status, 'active'))).all();
  for (const { a, qty } of active) {
    for (const f of JSON.parse(a.featureKeysJson) as FeatureKey[]) features.add(f);
    if (maxUsers !== null && a.extraUsers) maxUsers += a.extraUsers * qty;
    if (maxLocations !== null && a.extraLocations) maxLocations += a.extraLocations * qty;
  }
  for (const o of db.select().from(tenantFeatureOverrides).where(eq(tenantFeatureOverrides.companyId, companyId)).all()) {
    if (o.enabled) features.add(o.featureKey as FeatureKey);
    else features.delete(o.featureKey as FeatureKey);
  }
  const ended = isEffectivelyEnded(sub, now);
  const canWrite = !ended && WORKING.has(sub.status === 'cancelled' ? 'active' : sub.status);
  return { mode, source: 'subscription', plan: { id: plan.id, code: plan.code, name: plan.name }, status: ended && sub.status !== 'expired' ? 'expired' : sub.status, canWrite, features, limits: { maxUsers, maxLocations } };
}

/**
 * Zuordnung von API-Routen zu Modulen (Präfix → Feature). Routen ohne Eintrag gehören zum Kern.
 * Lesende Routen sind bei gesperrtem Modul ebenfalls gesperrt; der Datenexport des Mandanten
 * (Datenschutz, Vertragsende) ist davon ausgenommen.
 */
export const ROUTE_FEATURES: Array<[prefix: string, feature: FeatureKey]> = [
  ['/api/leads', 'CRM_LEADS'],
  ['/api/export/leads.csv', 'CRM_LEADS'],
  ['/api/import/leads', 'CRM_LEADS'],
  ['/api/tasks', 'TASKS'],
  ['/api/inventory', 'INVENTORY'],
  ['/api/expenses', 'FINANCE'],
  ['/api/recurring-expenses', 'FINANCE'],
  ['/api/finance', 'FINANCE'],
  ['/api/export/expenses.csv', 'FINANCE'],
  ['/api/analysis', 'MARGINS'],
  ['/api/marketing', 'MARKETING'],
  ['/api/integrations/marketing', 'MARKETING'],
  ['/api/competitors', 'COMPETITORS'],
  ['/api/integrations/google_places', 'COMPETITORS'],
  ['/api/assistant', 'AI_ASSISTANT'],
  ['/api/integrations/claude', 'AI_ASSISTANT'],
];

export function featureForRoute(url: string, method: string): FeatureKey | null {
  if (url.startsWith('/api/company/role-permissions/') && method !== 'GET') return 'GRANULAR_PERMISSIONS';
  for (const [prefix, feature] of ROUTE_FEATURES) if (url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`)) return feature;
  return null;
}
