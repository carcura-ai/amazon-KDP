import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { customers } from '../../db/schema.js';
import { eraseCustomer } from './routes.js';

/** Nach Wiederherstellung: Kunden erneut löschen/anonymisieren, deren Löschung nach dem Sicherungsstand erfolgte. */
export function eraseCustomerById(app: FastifyInstance, companyId: string, customerId: string): boolean {
  const c = app.db.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.companyId, companyId))).get();
  if (!c || c.anonymizedAt) return false;
  eraseCustomer(app, companyId, customerId, { userId: null, source: 'job', reason: 'Erneut angewendet nach Wiederherstellung einer Sicherung' });
  return true;
}
