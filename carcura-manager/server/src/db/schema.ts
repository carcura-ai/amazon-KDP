import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const ts = (name: string) => text(name).notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);

/* ------------------------------------------------------------------ Mandanten */
export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  legalName: text('legal_name'),
  email: text('email'),
  phone: text('phone'),
  website: text('website'),
  street: text('street'),
  zip: text('zip'),
  city: text('city'),
  country: text('country').notNull().default('DE'),
  taxNumber: text('tax_number'),
  vatId: text('vat_id'),
  bankName: text('bank_name'),
  iban: text('iban'),
  bic: text('bic'),
  logoFileId: text('logo_file_id'),
  primaryColor: text('primary_color').notNull().default('#E8F320'),
  secondaryColor: text('secondary_color').notNull().default('#0B0B0C'),
  currency: text('currency').notNull().default('EUR'),
  locale: text('locale').notNull().default('de-DE'),
  timezone: text('timezone').notNull().default('Europe/Berlin'),
  invoicePrefix: text('invoice_prefix').notNull().default('RE'),
  offerPrefix: text('offer_prefix').notNull().default('AN'),
  customerPrefix: text('customer_prefix').notNull().default('KD'),
  defaultVatBp: integer('default_vat_bp').notNull().default(1900),
  smallBusiness: integer('small_business', { mode: 'boolean' }).notNull().default(false),
  invoiceFooter: text('invoice_footer'),
  paymentTermsDays: integer('payment_terms_days').notNull().default(14),
  reminderDaysBefore: integer('reminder_days_before').notNull().default(2),
  settingsJson: text('settings_json').notNull().default('{}'),
  websiteLeadToken: text('website_lead_token'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: ts('created_at'),
  updatedAt: ts('updated_at'),
});

/* ------------------------------------------------------------------ Benutzer */
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    role: text('role').notNull().default('employee'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    isPlatformAdmin: integer('is_platform_admin', { mode: 'boolean' }).notNull().default(false),
    lastLoginAt: text('last_login_at'),
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: text('locked_until'),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email), index('users_company_idx').on(t.companyId)],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id),
    companyId: text('company_id').notNull().references(() => companies.id),
    createdAt: ts('created_at'),
    expiresAt: text('expires_at').notNull(),
    lastSeenAt: text('last_seen_at').notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    revokedAt: text('revoked_at'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const rolePermissions = sqliteTable(
  'role_permissions',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    role: text('role').notNull(),
    permission: text('permission').notNull(),
  },
  (t) => [uniqueIndex('role_permissions_unique').on(t.companyId, t.role, t.permission)],
);

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    userId: text('user_id'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    beforeJson: text('before_json'),
    afterJson: text('after_json'),
    ip: text('ip'),
    createdAt: ts('created_at'),
  },
  (t) => [index('audit_company_idx').on(t.companyId, t.createdAt), index('audit_entity_idx').on(t.entityType, t.entityId)],
);

/* ------------------------------------------------------------------ Leistungskatalog */
export const services = sqliteTable(
  'services',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category'),
    priceCents: integer('price_cents').notNull().default(0),
    vatBp: integer('vat_bp').notNull().default(1900),
    durationMinutes: integer('duration_minutes').notNull().default(60),
    materialCostCents: integer('material_cost_cents').notNull().default(0),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [index('services_company_idx').on(t.companyId)],
);

/* ------------------------------------------------------------------ CRM */
export const customers = sqliteTable(
  'customers',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    customerNumber: text('customer_number').notNull(),
    type: text('type').notNull().default('private'), // private | business
    salutation: text('salutation'),
    firstName: text('first_name').notNull().default(''),
    lastName: text('last_name').notNull().default(''),
    companyName: text('company_name'),
    street: text('street'),
    houseNumber: text('house_number'),
    zip: text('zip'),
    city: text('city'),
    country: text('country').notNull().default('DE'),
    email: text('email'),
    phone: text('phone'),
    phone2: text('phone2'),
    notes: text('notes'),
    tagsJson: text('tags_json').notNull().default('[]'),
    source: text('source'),
    leadId: text('lead_id'),
    normalizedEmail: text('normalized_email'),
    normalizedPhone: text('normalized_phone'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [
    uniqueIndex('customers_number_unique').on(t.companyId, t.customerNumber),
    index('customers_company_idx').on(t.companyId),
    index('customers_email_idx').on(t.companyId, t.normalizedEmail),
    index('customers_phone_idx').on(t.companyId, t.normalizedPhone),
    index('customers_name_idx').on(t.companyId, t.lastName, t.firstName),
  ],
);

export const leads = sqliteTable(
  'leads',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    firstName: text('first_name').notNull().default(''),
    lastName: text('last_name').notNull().default(''),
    companyName: text('company_name'),
    customerType: text('customer_type').notNull().default('private'),
    email: text('email'),
    phone: text('phone'),
    street: text('street'),
    zip: text('zip'),
    city: text('city'),
    source: text('source').notNull().default('manual'), // google_ads | meta_ads | website | manual | phone | referral | other
    sourceDetail: text('source_detail'),
    gclid: text('gclid'),
    fbclid: text('fbclid'),
    campaign: text('campaign'),
    status: text('status').notNull().default('new'),
    requestedService: text('requested_service'),
    vehicleText: text('vehicle_text'),
    message: text('message'),
    notes: text('notes'),
    estimatedValueCents: integer('estimated_value_cents'),
    assignedUserId: text('assigned_user_id'),
    customerId: text('customer_id'),
    lostReason: text('lost_reason'),
    externalId: text('external_id'),
    normalizedEmail: text('normalized_email'),
    normalizedPhone: text('normalized_phone'),
    lastContactAt: text('last_contact_at'),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [
    index('leads_company_status_idx').on(t.companyId, t.status),
    index('leads_email_idx').on(t.companyId, t.normalizedEmail),
    index('leads_phone_idx').on(t.companyId, t.normalizedPhone),
    uniqueIndex('leads_external_unique').on(t.companyId, t.externalId),
  ],
);

export const vehicles = sqliteTable(
  'vehicles',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    customerId: text('customer_id').notNull().references(() => customers.id),
    licensePlate: text('license_plate'),
    normalizedPlate: text('normalized_plate'),
    make: text('make'),
    model: text('model'),
    year: integer('year'),
    mileage: integer('mileage'),
    color: text('color'),
    vehicleType: text('vehicle_type'), // Kleinwagen, Kombi, SUV, Van, Transporter, Motorrad, Sonstiges
    vin: text('vin'),
    notes: text('notes'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [index('vehicles_customer_idx').on(t.companyId, t.customerId), index('vehicles_plate_idx').on(t.companyId, t.normalizedPlate)],
);

export const activities = sqliteTable(
  'activities',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    customerId: text('customer_id'),
    leadId: text('lead_id'),
    vehicleId: text('vehicle_id'),
    userId: text('user_id'),
    type: text('type').notNull(), // call | email | message | whatsapp | note | appointment | offer | invoice | reminder | system
    direction: text('direction'), // in | out
    subject: text('subject'),
    content: text('content'),
    refType: text('ref_type'),
    refId: text('ref_id'),
    occurredAt: text('occurred_at').notNull(),
    createdAt: ts('created_at'),
  },
  (t) => [index('activities_customer_idx').on(t.companyId, t.customerId, t.occurredAt), index('activities_lead_idx').on(t.companyId, t.leadId, t.occurredAt)],
);

/* ------------------------------------------------------------------ Nummernkreise */
export const numberSequences = sqliteTable(
  'number_sequences',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    kind: text('kind').notNull(), // customer | invoice | offer | order
    year: integer('year').notNull().default(0),
    value: integer('value').notNull().default(0),
  },
  (t) => [uniqueIndex('number_sequences_unique').on(t.companyId, t.kind, t.year)],
);

/* ------------------------------------------------------------------ Jobs */
export const jobs = sqliteTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id'),
    type: text('type').notNull(),
    payloadJson: text('payload_json').notNull().default('{}'),
    status: text('status').notNull().default('pending'), // pending | running | done | failed
    runAt: text('run_at').notNull(),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    lastError: text('last_error'),
    startedAt: text('started_at'),
    finishedAt: text('finished_at'),
    dedupeKey: text('dedupe_key'),
    createdAt: ts('created_at'),
  },
  (t) => [index('jobs_status_idx').on(t.status, t.runAt), uniqueIndex('jobs_dedupe_unique').on(t.dedupeKey)],
);
