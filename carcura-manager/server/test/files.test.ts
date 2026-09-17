import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { testApp, setupCompany, as, type Session } from './helpers.js';

let app: FastifyInstance;
let admin: Session;
let customerId: string;
let vehicleId: string;
let imageBuf: Buffer;

function multipart(fields: Record<string, string>, file?: { name: string; type: string; data: Buffer }) {
  const boundary = '----cmtest' + Date.now();
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  if (file) parts.push(Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`), file.data, Buffer.from('\r\n')]));
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(parts), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

beforeAll(async () => {
  app = await testApp();
  admin = await setupCompany(app);
  customerId = (await app.inject(as(admin, { method: 'POST', url: '/api/customers', payload: { salutation: 'Frau', firstName: 'Erika', lastName: 'Beispiel', email: 'erika@example.de', street: 'Musterweg 1', zip: '50667', city: 'Köln' } }))).json().customer.id;
  vehicleId = (await app.inject(as(admin, { method: 'POST', url: '/api/vehicles', payload: { customerId, licensePlate: 'K-EB 77', make: 'VW', model: 'Golf', color: 'schwarz' } }))).json().vehicle.id;
  imageBuf = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#224488' } }).jpeg().toBuffer();
});
afterAll(async () => app.close());

describe('Dateien', () => {
  let fileId: string;
  it('lädt ein Bild hoch, erzeugt Vorschau-Varianten und liefert es nur mit Session aus', async () => {
    const m = multipart({ customerId, vehicleId, category: 'before', caption: 'Vorher links' }, { name: 'vorher.jpg', type: 'image/jpeg', data: imageBuf });
    const res = await app.inject(as(admin, { method: 'POST', url: '/api/files', payload: m.payload, headers: m.headers }));
    expect(res.statusCode).toBe(200);
    const f = res.json().items[0];
    fileId = f.id;
    expect(f.width).toBe(2400);
    expect(f.thumbPath).toBeTruthy();
    expect(f.category).toBe('before');
    const thumb = await app.inject(as(admin, { url: `/files/${fileId}?variant=thumb` }));
    expect(thumb.statusCode).toBe(200);
    expect(thumb.headers['content-type']).toBe('image/jpeg');
    expect(thumb.rawPayload.length).toBeLessThan(imageBuf.length);
    expect((await app.inject({ url: `/files/${fileId}` })).statusCode).toBe(401);
    const list = (await app.inject(as(admin, { url: `/api/files?vehicleId=${vehicleId}` }))).json();
    expect(list.items).toHaveLength(1);
  });

  it('lehnt unerlaubte Dateitypen ab', async () => {
    const m = multipart({ customerId }, { name: 'x.exe', type: 'application/octet-stream', data: Buffer.from('MZ') });
    const res = await app.inject(as(admin, { method: 'POST', url: '/api/files', payload: m.payload, headers: m.headers }));
    expect(res.statusCode).toBe(400);
  });

  it('Logo hochladen und in Firmendaten verknüpfen', async () => {
    const png = await sharp({ create: { width: 300, height: 100, channels: 4, background: '#E8F320' } }).png().toBuffer();
    const m = multipart({}, { name: 'logo.png', type: 'image/png', data: png });
    const res = await app.inject(as(admin, { method: 'POST', url: '/api/company/logo', payload: m.payload, headers: m.headers }));
    expect(res.statusCode).toBe(200);
    expect((await app.inject(as(admin, { url: '/api/company/logo' }))).headers['content-type']).toBe('image/png');
    expect((await app.inject(as(admin, { url: '/api/company' }))).json().logoFileId).toBe(res.json().fileId);
  });

  it('Datei löschen entfernt Datensatz und Datei', async () => {
    expect((await app.inject(as(admin, { method: 'DELETE', url: `/api/files/${fileId}` }))).statusCode).toBe(200);
    expect((await app.inject(as(admin, { url: `/files/${fileId}` }))).statusCode).toBe(404);
  });
});

describe('Fahrzeugprotokoll', () => {
  let protocolId: string;
  it('legt Annahmeprotokoll mit Schäden an, aktualisiert Kilometerstand', async () => {
    const res = await app.inject(as(admin, { method: 'POST', url: '/api/protocols', payload: { type: 'intake', customerId, vehicleId, mileage: 91500, fuelLevel: 50, exteriorCondition: 'leicht verschmutzt', checklist: { warndreieck: true, verbandskasten: true }, notes: 'Kunde wünscht Rückruf', damages: [{ area: 'left', type: 'scratch', severity: 'minor', description: 'Kratzer Fahrertür', posX: 450, posY: 150 }, { area: 'rear', type: 'dent', severity: 'medium', posX: 900, posY: 500 }] } }));
    expect(res.statusCode).toBe(200);
    protocolId = res.json().protocol.id;
    expect(res.json().protocol.protocolNumber).toMatch(/^PR-\d{4}-0001$/);
    expect(res.json().damages).toHaveLength(2);
    expect((await app.inject(as(admin, { url: `/api/vehicles/${vehicleId}` }))).json().vehicle.mileage).toBe(91500);
    const other = (await app.inject(as(admin, { method: 'POST', url: '/api/customers', payload: { firstName: 'Anderer', lastName: 'Kunde' } }))).json().customer;
    const wrong = await app.inject(as(admin, { method: 'POST', url: '/api/protocols', payload: { customerId: other.id, vehicleId } }));
    expect(wrong.statusCode).toBe(400); // Fahrzeug gehört einem anderen Kunden
  });

  it('Foto zum Protokoll, Unterschrift, PDF-Entwurf', async () => {
    const m = multipart({ protocolId, customerId, vehicleId, category: 'damage', caption: 'Kratzer Fahrertür' }, { name: 'schaden.jpg', type: 'image/jpeg', data: imageBuf });
    const up = await app.inject(as(admin, { method: 'POST', url: '/api/files', payload: m.payload, headers: m.headers }));
    expect(up.statusCode).toBe(200);
    const sigPng = await sharp({ create: { width: 400, height: 150, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const sign = await app.inject(as(admin, { method: 'POST', url: `/api/protocols/${protocolId}/sign`, payload: { role: 'customer', dataUrl: `data:image/png;base64,${sigPng.toString('base64')}`, name: 'Erika Beispiel' } }));
    expect(sign.statusCode).toBe(200);
    expect(sign.json().protocol.customerSignatureFileId).toBeTruthy();
    expect(sign.json().protocol.signedByName).toBe('Erika Beispiel');
    const pdf = await app.inject(as(admin, { url: `/api/protocols/${protocolId}/pdf` }));
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.rawPayload.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.headers['content-disposition']).toContain('entwurf');
  }, 60000);

  it('Abschluss friert das Protokoll ein und legt das PDF in der Kundenakte ab', async () => {
    const fin = await app.inject(as(admin, { method: 'POST', url: `/api/protocols/${protocolId}/finalize` }));
    expect(fin.statusCode).toBe(200);
    expect(fin.json().protocol.status).toBe('final');
    expect(fin.json().protocol.pdfFileId).toBeTruthy();
    const docs = (await app.inject(as(admin, { url: `/api/files?customerId=${customerId}&kind=pdf` }))).json();
    expect(docs.items.some((f: { id: string }) => f.id === fin.json().protocol.pdfFileId)).toBe(true);
    expect((await app.inject(as(admin, { method: 'PATCH', url: `/api/protocols/${protocolId}`, payload: { notes: 'x' } }))).statusCode).toBe(409);
    expect((await app.inject(as(admin, { method: 'DELETE', url: `/api/protocols/${protocolId}` }))).statusCode).toBe(409);
    const stored = await app.inject(as(admin, { url: `/api/protocols/${protocolId}/pdf` }));
    expect(stored.headers['content-disposition']).not.toContain('entwurf');
    const hist = (await app.inject(as(admin, { url: `/api/customers/${customerId}` }))).json();
    expect(hist.activities.some((a: { subject: string }) => a.subject?.includes('abgeschlossen'))).toBe(true);
  }, 60000);

  it('Kundenakte und Auftrag als PDF', async () => {
    const pdf = await app.inject(as(admin, { url: `/api/customers/${customerId}/pdf` }));
    expect(pdf.statusCode).toBe(200);
    expect(pdf.rawPayload.subarray(0, 4).toString()).toBe('%PDF');
    const order = (await app.inject(as(admin, { method: 'POST', url: '/api/orders', payload: { customerId, vehicleId, title: 'Politur', items: [{ name: 'Politur', quantity: 1, unitPriceCents: 25000, vatBp: 1900 }] } }))).json();
    const opdf = await app.inject(as(admin, { url: `/api/orders/${order.order.id}/pdf` }));
    expect(opdf.statusCode).toBe(200);
    expect(opdf.headers['content-disposition']).toContain(order.order.orderNumber);
  }, 60000);
});
