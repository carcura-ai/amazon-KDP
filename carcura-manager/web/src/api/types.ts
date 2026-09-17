export interface User { id: string; email: string; firstName: string; lastName: string; role: string; isActive: boolean; isPlatformAdmin: boolean; lastLoginAt: string | null; createdAt: string }
export interface Company {
  id: string; name: string; slug: string; legalName: string | null; email: string | null; phone: string | null; website: string | null;
  street: string | null; zip: string | null; city: string | null; country: string; taxNumber: string | null; vatId: string | null;
  bankName: string | null; iban: string | null; bic: string | null; logoFileId: string | null; primaryColor: string; secondaryColor: string;
  currency: string; locale: string; timezone: string; invoicePrefix: string; offerPrefix: string; customerPrefix: string; defaultVatBp: number;
  smallBusiness: boolean; invoiceFooter: string | null; paymentTermsDays: number; reminderDaysBefore: number; settingsJson: string; isActive: boolean;
}
export interface Me { user: User; company: Company; permissions: string[] }
export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number }

export interface Lead {
  id: string; firstName: string; lastName: string; companyName: string | null; customerType: 'private' | 'business'; email: string | null; phone: string | null;
  street: string | null; zip: string | null; city: string | null; source: string; sourceDetail: string | null; gclid: string | null; fbclid: string | null; campaign: string | null;
  status: string; requestedService: string | null; vehicleText: string | null; message: string | null; notes: string | null; estimatedValueCents: number | null;
  assignedUserId: string | null; customerId: string | null; lostReason: string | null; lastContactAt: string | null; createdAt: string; updatedAt: string;
}
export interface Customer {
  id: string; customerNumber: string; type: 'private' | 'business'; salutation: string | null; firstName: string; lastName: string; companyName: string | null;
  street: string | null; houseNumber: string | null; zip: string | null; city: string | null; country: string; email: string | null; phone: string | null; phone2: string | null;
  notes: string | null; tagsJson: string; source: string | null; leadId: string | null; isActive: boolean; createdAt: string; updatedAt: string;
}
export interface Vehicle {
  id: string; customerId: string; licensePlate: string | null; make: string | null; model: string | null; year: number | null; mileage: number | null; color: string | null;
  vehicleType: string | null; vin: string | null; notes: string | null; isActive: boolean; createdAt: string; updatedAt: string;
}
export interface Activity {
  id: string; customerId: string | null; leadId: string | null; vehicleId: string | null; userId: string | null; type: string; direction: string | null;
  subject: string | null; content: string | null; refType: string | null; refId: string | null; occurredAt: string; createdAt: string;
}
export interface DuplicateHit { kind: 'customer' | 'lead' | 'vehicle'; id: string; label: string; matchedOn: string[] }
export interface Service { id: string; name: string; description: string | null; category: string | null; priceCents: number; vatBp: number; durationMinutes: number; materialCostCents: number; isActive: boolean; sortOrder: number }
export interface SearchHit { kind: 'customer' | 'lead' | 'vehicle'; id: string; title: string; subtitle: string; href: string }
export interface Dashboard {
  generatedAt: string;
  leads: { today: number; thisWeek: number; lastWeek: number; thisMonth: number; open: number; new: number; conversionRateMonth: number | null; bySource: Array<{ source: string; n: number }> };
  customers: { total: number; thisMonth: number };
  appointments: { today: number; next7Days: number; next: Array<{ id: string; title: string; startsAt: string; endsAt: string; status: string; type: string; customerName: string | null; vehicleLabel: string | null }> };
  orders: { inProgress: number; ready: number; completedMonth: number; completedMonthCents: number };
  finance: { revenueNetMonthCents: number; expensesNetMonthCents: number; profitNetMonthCents: number; lowStockCount: number };
  revenue: { todayCents: number; weekCents: number; monthCents: number; yearCents: number; monthCount: number; openCents: number; openCount: number; overdueCents: number; overdueCount: number };
  vehicles: { total: number };
  recentLeads: Lead[];
  hints: Array<{ level: 'info' | 'warn'; kind: 'fact' | 'calc'; text: string }>;
}

export interface Appointment {
  id: string; customerId: string | null; vehicleId: string | null; orderId: string | null; userId: string | null; type: string; typeLabel?: string; title: string;
  startsAt: string; endsAt: string; allDay: boolean; status: string; location: string | null; notes: string | null; priceCents: number | null;
  reminderSentAt: string | null; reminderError: string | null; confirmationSentAt: string | null; createdAt: string; updatedAt: string;
  customer?: { id: string; customerNumber: string; firstName: string; lastName: string; companyName: string | null; phone: string | null; email: string | null } | null;
  vehicle?: { id: string; licensePlate: string | null; make: string | null; model: string | null } | null;
  user?: { id: string; firstName: string; lastName: string } | null;
}
export interface OrderItem { id: string; orderId: string; serviceId: string | null; name: string; description: string | null; quantity: number; unitPriceCents: number; vatBp: number; totalCents: number; sortOrder: number }
export interface Order {
  id: string; orderNumber: string; customerId: string; vehicleId: string | null; appointmentId: string | null; userId: string | null; leadId: string | null; status: string; title: string | null;
  notes: string | null; internalNotes: string | null; scheduledAt: string | null; startedAt: string | null; finishedAt: string | null; completedAt: string | null; mileageIn: number | null;
  subtotalCents: number; vatCents: number; totalCents: number; createdAt: string; updatedAt: string;
}
export interface Totals { subtotalCents: number; vatCents: number; totalCents: number; vatBreakdown: Array<{ vatBp: number; netCents: number; vatCents: number }> }
export interface OrderDetail { order: Order; items: OrderItem[]; customer: Customer | null; vehicle: Vehicle | null; appointment: Appointment | null; user: { id: string; firstName: string; lastName: string } | null; totals: Totals; statusLabels: Record<string, string> }
export interface OrderRow { order: Order; customer: Pick<Customer, 'id' | 'customerNumber' | 'firstName' | 'lastName' | 'companyName'>; vehicle: Pick<Vehicle, 'id' | 'licensePlate' | 'make' | 'model'> | null }

export interface FileRow { id: string; customerId: string | null; vehicleId: string | null; orderId: string | null; protocolId: string | null; kind: string; category: string; originalName: string; mimeType: string; sizeBytes: number; thumbPath: string | null; width: number | null; height: number | null; caption: string | null; sortOrder: number; createdAt: string }
export interface Damage { id?: string; area: string; type: string; severity: string; description: string | null; posX: number | null; posY: number | null; fileId: string | null }
export interface Protocol { id: string; protocolNumber: string; type: 'intake' | 'handover'; customerId: string; vehicleId: string; orderId: string | null; status: 'draft' | 'final'; mileage: number | null; fuelLevel: number | null; exteriorCondition: string | null; interiorCondition: string | null; checklistJson: string; notes: string | null; customerSignatureFileId: string | null; employeeSignatureFileId: string | null; signedByName: string | null; signedAt: string | null; pdfFileId: string | null; finalizedAt: string | null; createdAt: string; updatedAt: string }
export interface ProtocolDetail { protocol: Protocol; damages: Array<Damage & { id: string }>; customer: Customer | null; vehicle: Vehicle | null; order: Order | null; files: FileRow[]; labels: { AREA_LABEL: Record<string, string>; TYPE_LABEL: Record<string, string>; SEV_LABEL: Record<string, string> } }
export interface ProtocolRow { protocol: Protocol; customer: Pick<Customer, 'id' | 'firstName' | 'lastName' | 'companyName'>; vehicle: Pick<Vehicle, 'id' | 'licensePlate' | 'make' | 'model'> }

export interface LineItem { id: string; serviceId: string | null; name: string; description: string | null; quantity: number; unitPriceCents: number; vatBp: number; totalCents: number; sortOrder: number }
export interface Offer { id: string; offerNumber: string; customerId: string; vehicleId: string | null; leadId: string | null; orderId: string | null; status: string; title: string | null; introText: string | null; notes: string | null; issueDate: string; validUntil: string | null; subtotalCents: number; vatCents: number; totalCents: number; sentAt: string | null; acceptedAt: string | null; pdfFileId: string | null; createdAt: string; updatedAt: string }
export interface OfferDetail { offer: Offer; items: LineItem[]; customer: Customer | null; vehicle: Vehicle | null; totals: Totals; invoice: { id: string; invoiceNumber: string | null; status: string } | null; order: { id: string; orderNumber: string; status: string } | null }
export interface OfferRow { offer: Offer; customer: Pick<Customer, 'id' | 'customerNumber' | 'firstName' | 'lastName' | 'companyName'> }
export interface Invoice { id: string; invoiceNumber: string | null; customerId: string; vehicleId: string | null; orderId: string | null; offerId: string | null; status: string; title: string | null; introText: string | null; notes: string | null; issueDate: string | null; serviceDate: string | null; dueDate: string | null; subtotalCents: number; vatCents: number; totalCents: number; paidCents: number; paidAt: string | null; sentAt: string | null; issuedAt: string | null; pdfFileId: string | null; cancelsInvoiceId: string | null; cancelledByInvoiceId: string | null; createdAt: string; updatedAt: string }
export interface Payment { id: string; invoiceId: string; amountCents: number; paidAt: string; method: string; note: string | null; createdAt: string }
export interface InvoiceDetail { invoice: Invoice; items: LineItem[]; payments: Payment[]; customer: Customer | null; vehicle: Vehicle | null; order: { id: string; orderNumber: string; status: string } | null; totals: Totals; cancels: { id: string; invoiceNumber: string | null } | null; cancelledBy: { id: string; invoiceNumber: string | null } | null }
export interface InvoiceRow { invoice: Invoice; customer: Pick<Customer, 'id' | 'customerNumber' | 'firstName' | 'lastName' | 'companyName'> }
export interface InvoiceStats { openCents: number; openCount: number; overdueCents: number; overdueCount: number; invoicedMonthCents: number; invoicedMonthCount: number; invoicedYearCents: number; paidMonthCents: number }

export interface InventoryItem { id: string; name: string; sku: string | null; manufacturer: string | null; category: string | null; unit: string; quantity: number; minQuantity: number; purchasePriceCents: number; supplier: string | null; location: string | null; notes: string | null; isActive: boolean; isLow: boolean; stockValueCents: number; createdAt: string; updatedAt: string }
export interface InventoryMovement { id: string; itemId: string; type: string; delta: number; quantityAfter: number; unitCostCents: number | null; reason: string | null; refType: string | null; refId: string | null; userId: string | null; createdAt: string }
export interface Expense { id: string; date: string; category: string; description: string; vendor: string | null; netCents: number; vatBp: number; vatCents: number; grossCents: number; paymentMethod: string; isPaid: boolean; paidAt: string | null; dueDate: string | null; recurringExpenseId: string | null; receiptFileId: string | null; notes: string | null; createdAt: string }
export interface RecurringExpense { id: string; name: string; category: string; vendor: string | null; netCents: number; vatBp: number; interval: string; startDate: string; endDate: string | null; nextDate: string; paymentMethod: string; autoPaid: boolean; isActive: boolean; notes: string | null }
export interface FinanceOverview {
  period: string; date: string; range: { from: string; to: string; label: string };
  revenueNetCents: number; revenueVatCents: number; revenueGrossCents: number; invoiceCount: number;
  expensesNetCents: number; expensesVatCents: number; expensesGrossCents: number; expenseCount: number;
  profitNetCents: number; marginPct: number | null; paymentsInCents: number; expensesPaidCents: number; cashflowCents: number;
  openReceivablesCents: number; openPayablesCents: number; vatBalanceCents: number;
  previous: { revenueNetCents: number; expensesNetCents: number; profitNetCents: number };
  byCategory: Array<{ category: string; netCents: number; n: number }>;
  series: Array<{ label: string; from: string; revenueNetCents: number; expensesNetCents: number }>;
  hints: Array<{ kind: 'fact' | 'calc' | 'estimate' | 'advice'; level: 'info' | 'warn'; text: string }>;
}

export interface MarketingSourceStats { source: string; label: string; impressions: number; clicks: number; costCents: number; platformLeads: number; crmLeads: number; wonLeads: number; revenueCents: number; costPerLeadCents: number | null; roas: number | null; ctr: number | null; prev: { costCents: number; crmLeads: number; clicks: number } }
export interface MarketingOverview {
  range: { from: string; to: string; label: string; prevFrom: string; prevTo: string };
  configured: { ads: boolean; web: boolean; social: boolean; seo: boolean };
  lastSync: Record<string, { at: string | null; status: string; error: string | null }>;
  totals: { costCents: number; impressions: number; clicks: number; crmLeads: number; wonLeads: number; costPerLeadCents: number | null; conversionRate: number | null; revenueCents: number; roas: number | null };
  sources: MarketingSourceStats[];
  leadsBySource: Array<{ source: string; n: number; won: number }>;
  campaigns: Array<{ source: string; campaignId: string; campaignName: string; impressions: number; clicks: number; costCents: number; platformLeads: number; crmLeads: number }>;
  series: Array<{ date: string; googleCostCents: number; metaCostCents: number; leads: number; sessions: number }>;
  web: { sessions: number; users: number; pageviews: number; conversions: number; prev: { sessions: number; users: number }; channels: Array<{ name: string; sessions: number }>; devices: Array<{ name: string; sessions: number }>; landingPages: Array<{ name: string; sessions: number }> } | null;
  social: { platform: string; followers: number | null; followersPrev: number | null; reach: number; views: number; likes: number; comments: number; shares: number; prev: { reach: number; views: number } } | null;
  seo: { clicks: number; impressions: number; position: number | null; prev: { clicks: number; impressions: number }; queries: Array<{ name: string; clicks: number; impressions: number; position: number | null }> } | null;
  hints: Array<{ kind: 'fact' | 'calc' | 'estimate' | 'advice'; level: 'info' | 'warn'; text: string }>;
}
export interface IntegrationInfo { id: string; type: string; name: string | null; public: Record<string, unknown>; status: string; lastSyncAt: string | null; lastError: string | null; isActive: boolean; updatedAt: string }
