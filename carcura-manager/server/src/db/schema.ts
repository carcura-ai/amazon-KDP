import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
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
  productName: text('product_name').notNull().default('Manager'),
  poweredBy: text('powered_by'),
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
    totpSecretEnc: text('totp_secret_enc'),
    totpEnabledAt: text('totp_enabled_at'),
    backupCodesJson: text('backup_codes_json'),
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
    anonymizedAt: text('anonymized_at'),
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

/* ------------------------------------------------------------------ Integrationen (SMTP, Marketing-APIs …) */
export const integrations = sqliteTable(
  'integrations',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    type: text('type').notNull(), // smtp | windsor | google_ads | meta_ads | ga4 | search_console | claude
    name: text('name'),
    configEncrypted: text('config_encrypted').notNull(),
    publicJson: text('public_json').notNull().default('{}'), // unkritische Anzeige-Infos (Host, Absender, Konto-ID)
    status: text('status').notNull().default('configured'), // configured | ok | error | action_required
    lastSyncAt: text('last_sync_at'),
    lastError: text('last_error'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [uniqueIndex('integrations_company_type_unique').on(t.companyId, t.type)],
);

export const emailLog = sqliteTable(
  'email_log',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    toAddress: text('to_address').notNull(),
    subject: text('subject').notNull(),
    status: text('status').notNull(), // sent | failed
    error: text('error'),
    messageId: text('message_id'),
    refType: text('ref_type'),
    refId: text('ref_id'),
    createdAt: ts('created_at'),
  },
  (t) => [index('email_log_company_idx').on(t.companyId, t.createdAt)],
);

/* ------------------------------------------------------------------ Termine */
export const appointments = sqliteTable(
  'appointments',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    customerId: text('customer_id'),
    vehicleId: text('vehicle_id'),
    orderId: text('order_id'),
    userId: text('user_id'),
    type: text('type').notNull().default('service'), // service | pickup | handover | consultation | phone | other
    title: text('title').notNull(),
    startsAt: text('starts_at').notNull(),
    endsAt: text('ends_at').notNull(),
    allDay: integer('all_day', { mode: 'boolean' }).notNull().default(false),
    status: text('status').notNull().default('planned'), // planned | confirmed | done | cancelled | no_show
    location: text('location'),
    notes: text('notes'),
    priceCents: integer('price_cents'),
    reminderSentAt: text('reminder_sent_at'),
    reminderError: text('reminder_error'),
    confirmationSentAt: text('confirmation_sent_at'),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [index('appointments_company_time_idx').on(t.companyId, t.startsAt), index('appointments_customer_idx').on(t.companyId, t.customerId)],
);

/* ------------------------------------------------------------------ Aufträge */
export const orders = sqliteTable(
  'orders',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    orderNumber: text('order_number').notNull(),
    customerId: text('customer_id').notNull(),
    vehicleId: text('vehicle_id'),
    appointmentId: text('appointment_id'),
    userId: text('user_id'),
    leadId: text('lead_id'),
    status: text('status').notNull().default('planned'), // planned | accepted | in_progress | quality_check | finished | picked_up | completed | cancelled
    title: text('title'),
    notes: text('notes'),
    internalNotes: text('internal_notes'),
    scheduledAt: text('scheduled_at'),
    startedAt: text('started_at'),
    finishedAt: text('finished_at'),
    completedAt: text('completed_at'),
    mileageIn: integer('mileage_in'),
    subtotalCents: integer('subtotal_cents').notNull().default(0),
    vatCents: integer('vat_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull().default(0),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [uniqueIndex('orders_number_unique').on(t.companyId, t.orderNumber), index('orders_company_status_idx').on(t.companyId, t.status), index('orders_customer_idx').on(t.companyId, t.customerId)],
);

export const orderItems = sqliteTable(
  'order_items',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    orderId: text('order_id').notNull().references(() => orders.id),
    serviceId: text('service_id'),
    name: text('name').notNull(),
    description: text('description'),
    quantity: integer('quantity').notNull().default(1),
    unitPriceCents: integer('unit_price_cents').notNull().default(0),
    vatBp: integer('vat_bp').notNull().default(1900),
    totalCents: integer('total_cents').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
);

/* ------------------------------------------------------------------ Dateien (Bilder, Dokumente, Signaturen, Logo) */
export const files = sqliteTable(
  'files',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    customerId: text('customer_id'),
    vehicleId: text('vehicle_id'),
    orderId: text('order_id'),
    protocolId: text('protocol_id'),
    kind: text('kind').notNull(), // image | document | pdf | signature | logo
    category: text('category').notNull().default('other'), // before | during | after | damage | detail | offer | invoice | protocol | other
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    storagePath: text('storage_path').notNull(),
    thumbPath: text('thumb_path'),
    displayPath: text('display_path'),
    sha256: text('sha256'),
    width: integer('width'),
    height: integer('height'),
    caption: text('caption'),
    sortOrder: integer('sort_order').notNull().default(0),
    uploadedByUserId: text('uploaded_by_user_id'),
    createdAt: ts('created_at'),
  },
  (t) => [index('files_customer_idx').on(t.companyId, t.customerId), index('files_vehicle_idx').on(t.companyId, t.vehicleId), index('files_order_idx').on(t.companyId, t.orderId), index('files_protocol_idx').on(t.companyId, t.protocolId)],
);

/* ------------------------------------------------------------------ Fahrzeugprotokolle (Annahme / Übergabe) */
export const protocols = sqliteTable(
  'protocols',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    protocolNumber: text('protocol_number').notNull(),
    type: text('type').notNull().default('intake'), // intake (Annahme) | handover (Übergabe)
    customerId: text('customer_id').notNull(),
    vehicleId: text('vehicle_id').notNull(),
    orderId: text('order_id'),
    status: text('status').notNull().default('draft'), // draft | final
    mileage: integer('mileage'),
    fuelLevel: integer('fuel_level'), // 0–100 %
    exteriorCondition: text('exterior_condition'), // z. B. sauber | leicht verschmutzt | stark verschmutzt
    interiorCondition: text('interior_condition'),
    checklistJson: text('checklist_json').notNull().default('{}'), // z. B. { warndreieck: true, verbandskasten: true, ... }
    notes: text('notes'),
    customerSignatureFileId: text('customer_signature_file_id'),
    employeeSignatureFileId: text('employee_signature_file_id'),
    signedByName: text('signed_by_name'),
    signedAt: text('signed_at'),
    pdfFileId: text('pdf_file_id'),
    finalizedAt: text('finalized_at'),
    createdByUserId: text('created_by_user_id'),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [uniqueIndex('protocols_number_unique').on(t.companyId, t.protocolNumber), index('protocols_vehicle_idx').on(t.companyId, t.vehicleId), index('protocols_customer_idx').on(t.companyId, t.customerId)],
);

export const protocolDamages = sqliteTable(
  'protocol_damages',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    protocolId: text('protocol_id').notNull().references(() => protocols.id),
    area: text('area').notNull(), // front | rear | left | right | roof | interior | wheels | glass | other
    type: text('type').notNull(), // scratch | dent | paint | stone_chip | crack | stain | tear | wear | other
    severity: text('severity').notNull().default('minor'), // minor | medium | major
    description: text('description'),
    posX: integer('pos_x'), // Position auf der Skizze in Promille (0–1000)
    posY: integer('pos_y'),
    fileId: text('file_id'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('protocol_damages_protocol_idx').on(t.protocolId)],
);

/* ------------------------------------------------------------------ Angebote */
export const offers = sqliteTable(
  'offers',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    offerNumber: text('offer_number').notNull(),
    customerId: text('customer_id').notNull(),
    vehicleId: text('vehicle_id'),
    leadId: text('lead_id'),
    orderId: text('order_id'),
    status: text('status').notNull().default('draft'), // draft | sent | accepted | rejected | expired
    title: text('title'),
    introText: text('intro_text'),
    notes: text('notes'),
    issueDate: text('issue_date').notNull(),
    validUntil: text('valid_until'),
    subtotalCents: integer('subtotal_cents').notNull().default(0),
    vatCents: integer('vat_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull().default(0),
    sentAt: text('sent_at'),
    acceptedAt: text('accepted_at'),
    pdfFileId: text('pdf_file_id'),
    createdByUserId: text('created_by_user_id'),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [uniqueIndex('offers_number_unique').on(t.companyId, t.offerNumber), index('offers_customer_idx').on(t.companyId, t.customerId), index('offers_status_idx').on(t.companyId, t.status)],
);

export const offerItems = sqliteTable(
  'offer_items',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    offerId: text('offer_id').notNull().references(() => offers.id),
    serviceId: text('service_id'),
    name: text('name').notNull(),
    description: text('description'),
    quantity: integer('quantity').notNull().default(1),
    unitPriceCents: integer('unit_price_cents').notNull().default(0),
    vatBp: integer('vat_bp').notNull().default(1900),
    totalCents: integer('total_cents').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('offer_items_offer_idx').on(t.offerId)],
);

/* ------------------------------------------------------------------ Rechnungen */
export const invoices = sqliteTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    invoiceNumber: text('invoice_number'), // wird erst beim Ausstellen vergeben (lückenlos)
    customerId: text('customer_id').notNull(),
    vehicleId: text('vehicle_id'),
    orderId: text('order_id'),
    offerId: text('offer_id'),
    status: text('status').notNull().default('draft'), // draft | sent | open | overdue | paid | cancelled
    title: text('title'),
    introText: text('intro_text'),
    notes: text('notes'),
    issueDate: text('issue_date'),
    serviceDate: text('service_date'),
    dueDate: text('due_date'),
    subtotalCents: integer('subtotal_cents').notNull().default(0),
    vatCents: integer('vat_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull().default(0),
    paidCents: integer('paid_cents').notNull().default(0),
    paidAt: text('paid_at'),
    sentAt: text('sent_at'),
    issuedAt: text('issued_at'),
    pdfFileId: text('pdf_file_id'),
    cancelsInvoiceId: text('cancels_invoice_id'), // Stornorechnung zu …
    cancelledByInvoiceId: text('cancelled_by_invoice_id'),
    createdByUserId: text('created_by_user_id'),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [uniqueIndex('invoices_number_unique').on(t.companyId, t.invoiceNumber), index('invoices_customer_idx').on(t.companyId, t.customerId), index('invoices_status_idx').on(t.companyId, t.status), index('invoices_issue_idx').on(t.companyId, t.issueDate)],
);

export const invoiceItems = sqliteTable(
  'invoice_items',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    invoiceId: text('invoice_id').notNull().references(() => invoices.id),
    serviceId: text('service_id'),
    name: text('name').notNull(),
    description: text('description'),
    quantity: integer('quantity').notNull().default(1),
    unitPriceCents: integer('unit_price_cents').notNull().default(0),
    vatBp: integer('vat_bp').notNull().default(1900),
    totalCents: integer('total_cents').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('invoice_items_invoice_idx').on(t.invoiceId)],
);

export const payments = sqliteTable(
  'payments',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    invoiceId: text('invoice_id').notNull().references(() => invoices.id),
    amountCents: integer('amount_cents').notNull(),
    paidAt: text('paid_at').notNull(),
    method: text('method').notNull().default('transfer'), // cash | transfer | card | paypal | other
    note: text('note'),
    createdByUserId: text('created_by_user_id'),
    createdAt: ts('created_at'),
  },
  (t) => [index('payments_invoice_idx').on(t.invoiceId), index('payments_company_date_idx').on(t.companyId, t.paidAt)],
);

/* ------------------------------------------------------------------ Lager */
export const inventoryItems = sqliteTable(
  'inventory_items',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    name: text('name').notNull(),
    sku: text('sku'),
    manufacturer: text('manufacturer'),
    category: text('category'),
    unit: text('unit').notNull().default('Stück'),
    quantity: real('quantity').notNull().default(0),
    minQuantity: real('min_quantity').notNull().default(0),
    purchasePriceCents: integer('purchase_price_cents').notNull().default(0), // je Einheit, netto
    supplier: text('supplier'),
    location: text('location'),
    notes: text('notes'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [index('inventory_company_idx').on(t.companyId, t.name)],
);

export const inventoryMovements = sqliteTable(
  'inventory_movements',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    itemId: text('item_id').notNull().references(() => inventoryItems.id),
    type: text('type').notNull(), // in | out | adjust
    delta: real('delta').notNull(), // Vorzeichenbehaftete Mengenänderung
    quantityAfter: real('quantity_after').notNull(),
    unitCostCents: integer('unit_cost_cents'),
    reason: text('reason'),
    refType: text('ref_type'),
    refId: text('ref_id'),
    userId: text('user_id'),
    createdAt: ts('created_at'),
  },
  (t) => [index('inventory_movements_item_idx').on(t.itemId, t.createdAt)],
);

/* ------------------------------------------------------------------ Ausgaben */
export const expenses = sqliteTable(
  'expenses',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    date: text('date').notNull(), // YYYY-MM-DD (Belegdatum)
    category: text('category').notNull().default('Sonstiges'),
    description: text('description').notNull(),
    vendor: text('vendor'),
    netCents: integer('net_cents').notNull().default(0),
    vatBp: integer('vat_bp').notNull().default(1900),
    vatCents: integer('vat_cents').notNull().default(0),
    grossCents: integer('gross_cents').notNull().default(0),
    paymentMethod: text('payment_method').notNull().default('transfer'),
    isPaid: integer('is_paid', { mode: 'boolean' }).notNull().default(true),
    paidAt: text('paid_at'),
    dueDate: text('due_date'),
    recurringExpenseId: text('recurring_expense_id'),
    receiptFileId: text('receipt_file_id'),
    notes: text('notes'),
    createdByUserId: text('created_by_user_id'),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [index('expenses_company_date_idx').on(t.companyId, t.date), index('expenses_category_idx').on(t.companyId, t.category), uniqueIndex('expenses_recurring_period_unique').on(t.recurringExpenseId, t.date)],
);

export const recurringExpenses = sqliteTable(
  'recurring_expenses',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    name: text('name').notNull(),
    category: text('category').notNull().default('Sonstiges'),
    vendor: text('vendor'),
    netCents: integer('net_cents').notNull().default(0),
    vatBp: integer('vat_bp').notNull().default(1900),
    interval: text('interval').notNull().default('monthly'), // weekly | monthly | quarterly | yearly
    startDate: text('start_date').notNull(),
    endDate: text('end_date'),
    nextDate: text('next_date').notNull(),
    paymentMethod: text('payment_method').notNull().default('transfer'),
    autoPaid: integer('auto_paid', { mode: 'boolean' }).notNull().default(true),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    notes: text('notes'),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [index('recurring_company_idx').on(t.companyId, t.nextDate)],
);

/* ------------------------------------------------------------------ Marketing / Analytics (synchronisierte Daten) */
export const marketingDaily = sqliteTable(
  'marketing_daily',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    source: text('source').notNull(), // google_ads | meta_ads
    date: text('date').notNull(),
    campaignId: text('campaign_id').notNull(),
    campaignName: text('campaign_name').notNull(),
    impressions: integer('impressions').notNull().default(0),
    clicks: integer('clicks').notNull().default(0),
    costCents: integer('cost_cents').notNull().default(0),
    conversions: real('conversions').notNull().default(0),
    conversionValueCents: integer('conversion_value_cents').notNull().default(0),
    reach: integer('reach'),
    leads: integer('leads'),
    currency: text('currency').notNull().default('EUR'),
    fetchedAt: text('fetched_at').notNull(),
  },
  (t) => [uniqueIndex('marketing_daily_unique').on(t.companyId, t.source, t.date, t.campaignId), index('marketing_daily_date_idx').on(t.companyId, t.date)],
);

export const webAnalyticsDaily = sqliteTable(
  'web_analytics_daily',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    date: text('date').notNull(),
    dimensionType: text('dimension_type').notNull(), // total | channel | device | landing_page
    dimensionValue: text('dimension_value').notNull().default(''),
    sessions: integer('sessions').notNull().default(0),
    users: integer('users').notNull().default(0),
    pageviews: integer('pageviews').notNull().default(0),
    conversions: real('conversions').notNull().default(0),
    fetchedAt: text('fetched_at').notNull(),
  },
  (t) => [uniqueIndex('web_daily_unique').on(t.companyId, t.date, t.dimensionType, t.dimensionValue), index('web_daily_date_idx').on(t.companyId, t.date)],
);

export const socialDaily = sqliteTable(
  'social_daily',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    platform: text('platform').notNull(), // instagram | facebook
    date: text('date').notNull(),
    followers: integer('followers'),
    reach: integer('reach').notNull().default(0),
    impressions: integer('impressions'),
    views: integer('views').notNull().default(0),
    likes: integer('likes').notNull().default(0),
    comments: integer('comments').notNull().default(0),
    shares: integer('shares').notNull().default(0),
    fetchedAt: text('fetched_at').notNull(),
  },
  (t) => [uniqueIndex('social_daily_unique').on(t.companyId, t.platform, t.date)],
);

export const seoDaily = sqliteTable(
  'seo_daily',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    date: text('date').notNull(),
    dimensionType: text('dimension_type').notNull(), // total | query | page
    dimensionValue: text('dimension_value').notNull().default(''),
    clicks: integer('clicks').notNull().default(0),
    impressions: integer('impressions').notNull().default(0),
    position: real('position'),
    fetchedAt: text('fetched_at').notNull(),
  },
  (t) => [uniqueIndex('seo_daily_unique').on(t.companyId, t.date, t.dimensionType, t.dimensionValue), index('seo_daily_date_idx').on(t.companyId, t.date)],
);

/* ------------------------------------------------------------------ Reports */
export const reports = sqliteTable(
  'reports',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    type: text('type').notNull(), // weekly | monthly | yearly | competitors
    periodStart: text('period_start').notNull(),
    periodEnd: text('period_end').notNull(), // inklusive
    title: text('title').notNull(),
    summary: text('summary'),
    contentJson: text('content_json').notNull(),
    pdfFileId: text('pdf_file_id'),
    sentTo: text('sent_to'),
    generatedAt: ts('generated_at'),
  },
  (t) => [index('reports_company_idx').on(t.companyId, t.type, t.periodStart)],
);

/* ------------------------------------------------------------------ Wettbewerber */
export const competitors = sqliteTable(
  'competitors',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    placeId: text('place_id'),
    name: text('name').notNull(),
    address: text('address'),
    website: text('website'),
    phone: text('phone'),
    lat: real('lat'),
    lng: real('lng'),
    source: text('source').notNull().default('manual'), // google_places | manual
    isOwn: integer('is_own', { mode: 'boolean' }).notNull().default(false),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    notes: text('notes'),
    firstSeenAt: ts('first_seen_at'),
    lastSeenAt: text('last_seen_at'),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [uniqueIndex('competitors_place_unique').on(t.companyId, t.placeId), index('competitors_company_idx').on(t.companyId)],
);

export const competitorSnapshots = sqliteTable(
  'competitor_snapshots',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    competitorId: text('competitor_id').notNull().references(() => competitors.id),
    date: text('date').notNull(),
    rating: real('rating'),
    ratingCount: integer('rating_count'),
    businessStatus: text('business_status'),
    priceLevel: text('price_level'),
    createdAt: ts('created_at'),
  },
  (t) => [uniqueIndex('competitor_snapshots_unique').on(t.competitorId, t.date)],
);

/* ------------------------------------------------------------------ KI-Assistent (Verlauf) */
export const assistantMessages = sqliteTable(
  'assistant_messages',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    userId: text('user_id').notNull(),
    conversationId: text('conversation_id').notNull(),
    role: text('role').notNull(), // user | assistant
    content: text('content').notNull(),
    toolsUsedJson: text('tools_used_json'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    createdAt: ts('created_at'),
  },
  (t) => [index('assistant_conv_idx').on(t.companyId, t.conversationId, t.createdAt)],
);

/* ------------------------------------------------------------------ Aufgaben */
export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull().default('open'), // open | done
    priority: text('priority').notNull().default('normal'), // low | normal | high
    dueAt: text('due_at'),
    assignedUserId: text('assigned_user_id'),
    customerId: text('customer_id'),
    leadId: text('lead_id'),
    vehicleId: text('vehicle_id'),
    orderId: text('order_id'),
    createdByUserId: text('created_by_user_id'),
    completedAt: text('completed_at'),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [index('tasks_company_status_idx').on(t.companyId, t.status, t.dueAt), index('tasks_customer_idx').on(t.companyId, t.customerId), index('tasks_lead_idx').on(t.companyId, t.leadId)],
);
