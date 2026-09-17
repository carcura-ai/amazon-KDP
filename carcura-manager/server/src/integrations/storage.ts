import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { files } from '../db/schema.js';
import { newId } from '../core/ids.js';
import { badRequest } from '../core/errors.js';

export const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const FILE_CATEGORIES = ['before', 'during', 'after', 'damage', 'detail', 'offer', 'invoice', 'protocol', 'other'] as const;

export interface StoreInput {
  companyId: string;
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  kind?: 'image' | 'document' | 'pdf' | 'signature' | 'logo';
  category?: string;
  customerId?: string | null;
  vehicleId?: string | null;
  orderId?: string | null;
  protocolId?: string | null;
  caption?: string | null;
  uploadedByUserId?: string | null;
}

/**
 * Dateiablage je Mandant: data/files/<companyId>/<jahr>/<monat>/<id>.<ext>
 * Bilder erhalten Vorschau (400 px) und Anzeigevariante (1600 px), Originale bleiben erhalten.
 */
export class FileStorage {
  constructor(private readonly db: Db, private readonly rootDir: string) {
    fs.mkdirSync(rootDir, { recursive: true });
  }

  absolute(rel: string): string {
    const abs = path.resolve(this.rootDir, rel);
    if (!abs.startsWith(path.resolve(this.rootDir))) throw badRequest('Ungültiger Dateipfad.');
    return abs;
  }

  async store(input: StoreInput) {
    const ext = ALLOWED_MIME[input.mimeType];
    if (!ext) throw badRequest(`Dateityp nicht erlaubt: ${input.mimeType}. Erlaubt sind JPG, PNG, WebP und PDF.`);
    if (input.buffer.length > MAX_FILE_BYTES) throw badRequest('Datei ist größer als 25 MB.');
    if (input.buffer.length === 0) throw badRequest('Leere Datei.');
    const id = newId();
    const now = new Date();
    const relDir = path.join(input.companyId, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
    fs.mkdirSync(path.join(this.rootDir, relDir), { recursive: true });
    const isImage = input.mimeType.startsWith('image/');
    const kind = input.kind ?? (isImage ? 'image' : 'pdf');
    let buffer = input.buffer;
    let width: number | null = null;
    let height: number | null = null;
    let thumbPath: string | null = null;
    let displayPath: string | null = null;
    if (isImage) {
      // EXIF-Drehung anwenden, Metadaten entfernen, Original als bereinigte Datei speichern
      const img = sharp(input.buffer, { failOn: 'none' }).rotate();
      const meta = await img.metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      buffer = await img.toBuffer();
      if (kind === 'image') {
        thumbPath = path.join(relDir, `${id}.thumb.jpg`);
        displayPath = path.join(relDir, `${id}.display.jpg`);
        await sharp(buffer).resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(this.absolute(thumbPath));
        await sharp(buffer).resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 84 }).toFile(this.absolute(displayPath));
      }
    }
    const storagePath = path.join(relDir, `${id}.${ext}`);
    fs.writeFileSync(this.absolute(storagePath), buffer);
    const sha = crypto.createHash('sha256').update(buffer).digest('hex');
    this.db
      .insert(files)
      .values({
        id,
        companyId: input.companyId,
        customerId: input.customerId ?? null,
        vehicleId: input.vehicleId ?? null,
        orderId: input.orderId ?? null,
        protocolId: input.protocolId ?? null,
        kind,
        category: input.category ?? 'other',
        originalName: input.originalName.slice(0, 200),
        mimeType: input.mimeType,
        sizeBytes: buffer.length,
        storagePath,
        thumbPath,
        displayPath,
        sha256: sha,
        width,
        height,
        caption: input.caption ?? null,
        uploadedByUserId: input.uploadedByUserId ?? null,
      })
      .run();
    return this.get(input.companyId, id)!;
  }

  get(companyId: string, id: string) {
    return this.db.select().from(files).where(and(eq(files.id, id), eq(files.companyId, companyId))).get() ?? null;
  }

  remove(companyId: string, id: string): boolean {
    const row = this.get(companyId, id);
    if (!row) return false;
    for (const rel of [row.storagePath, row.thumbPath, row.displayPath]) {
      if (rel) fs.rmSync(this.absolute(rel), { force: true });
    }
    this.db.delete(files).where(eq(files.id, id)).run();
    return true;
  }

  /** Base64-Data-URL für PDF-Vorlagen (Bilder werden eingebettet, keine Netzwerkzugriffe nötig). */
  dataUrl(row: { mimeType: string; storagePath: string; displayPath: string | null }, variant: 'display' | 'original' = 'display'): string | null {
    const rel = variant === 'display' && row.displayPath ? row.displayPath : row.storagePath;
    const abs = this.absolute(rel);
    if (!fs.existsSync(abs)) return null;
    const mime = variant === 'display' && row.displayPath ? 'image/jpeg' : row.mimeType;
    return `data:${mime};base64,${fs.readFileSync(abs).toString('base64')}`;
  }

  usageBytes(companyId: string): number {
    return this.db.select({ n: files.sizeBytes }).from(files).where(eq(files.companyId, companyId)).all().reduce((s, r) => s + r.n, 0);
  }
}
