export function normalizeEmail(email?: string | null): string | null {
  const v = email?.trim().toLowerCase();
  return v ? v : null;
}

/** Telefonnummer auf Ziffern reduzieren; deutsche Nummern mit führender 0 → 49… */
export function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `49${digits.slice(1)}`;
  return digits.length >= 6 ? digits : null;
}

export function normalizePlate(plate?: string | null): string | null {
  const v = plate?.toUpperCase().replace(/[^A-Z0-9ÄÖÜ]/g, '');
  return v ? v : null;
}

export function normalizeName(...parts: Array<string | null | undefined>): string {
  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'mandant';
}
