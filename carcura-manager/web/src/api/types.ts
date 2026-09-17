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
  vehicles: { total: number };
  recentLeads: Lead[];
  hints: Array<{ level: 'info' | 'warn'; kind: 'fact' | 'calc'; text: string }>;
}
