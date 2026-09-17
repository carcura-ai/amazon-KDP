import { z } from 'zod';
import { badRequest } from './errors.js';

export function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    throw badRequest('Eingabe ungültig.', details);
  }
  return result.data;
}

export const zTrimmed = (max = 200) => z.string().trim().max(max);
export const zOptionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
export const zEmail = z.string().trim().toLowerCase().pipe(z.email('Ungültige E-Mail-Adresse.'));
export const zOptionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .pipe(z.email('Ungültige E-Mail-Adresse.').nullable());
export const zId = z.string().uuid();
export const zMoneyCents = z.number().int().min(0).max(1_000_000_000);
export const zPagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  q: z.string().trim().max(100).optional(),
});
