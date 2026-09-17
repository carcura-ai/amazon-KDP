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
