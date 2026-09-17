import { services } from '../../db/schema.js';
import { newId } from '../../core/ids.js';
import type { Db } from '../../db/index.js';

/**
 * Startkatalog typischer Aufbereitungsleistungen. Preise sind bewusst 0 und müssen
 * vom Mandanten gepflegt werden – es werden keine erfundenen Preise vorgegeben.
 */
const STARTER: Array<{ name: string; category: string; durationMinutes: number }> = [
  { name: 'Innenreinigung Basis', category: 'Innen', durationMinutes: 90 },
  { name: 'Innenreinigung Intensiv', category: 'Innen', durationMinutes: 180 },
  { name: 'Polster- und Teppichreinigung', category: 'Innen', durationMinutes: 120 },
  { name: 'Lederpflege', category: 'Innen', durationMinutes: 60 },
  { name: 'Außenreinigung Handwäsche', category: 'Außen', durationMinutes: 60 },
  { name: 'Lackpolitur einstufig', category: 'Außen', durationMinutes: 240 },
  { name: 'Lackpolitur mehrstufig', category: 'Außen', durationMinutes: 480 },
  { name: 'Keramikversiegelung', category: 'Versiegelung', durationMinutes: 300 },
  { name: 'Wachsversiegelung', category: 'Versiegelung', durationMinutes: 90 },
  { name: 'Komplettaufbereitung', category: 'Paket', durationMinutes: 480 },
  { name: 'Geruchsneutralisation (Ozon)', category: 'Innen', durationMinutes: 60 },
  { name: 'Motorwäsche', category: 'Außen', durationMinutes: 45 },
  { name: 'Scheinwerferaufbereitung', category: 'Außen', durationMinutes: 60 },
];

export function seedDefaultServices(db: Db, companyId: string): void {
  STARTER.forEach((s, i) => {
    db.insert(services)
      .values({ id: newId(), companyId, name: s.name, category: s.category, durationMinutes: s.durationMinutes, sortOrder: i, priceCents: 0 })
      .run();
  });
}
