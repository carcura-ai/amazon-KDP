// Befüllt eine frische Installation mit realistischen Demo-Daten (nur für Demo/Screenshots).
import { DatabaseSync as Database } from 'node:sqlite';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
const base = process.env.BASE ?? 'http://127.0.0.1:4800';
const DATA_DIR = process.env.DATA_DIR;
let cookie = '';
async function api(method, url, body, raw) {
  const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${url} -> ${r.status} ${text.slice(0, 300)}`);
  return raw ? text : (text ? JSON.parse(text) : null);
}
const day = (n, h = 10, m = 0) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, m, 0, 0); return d; };
const iso = (d) => d.toISOString();
const dateStr = (d) => d.toISOString().slice(0, 10);
let seed = 42; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

// 1) Einrichtung
await api('POST', '/api/setup', { company: { name: 'Carcura', email: 'info@carcura.info', phone: '+49 151 12345678', city: 'Nürnberg', website: 'https://carcura.info' }, admin: { email: 'alex@carcura.info', password: 'Demo-Passwort-2026', firstName: 'Alex', lastName: 'Fuchs' }, seedDefaultServices: true });
await api('PATCH', '/api/company', { legalName: 'Carcura GbR', street: 'Werkstattstraße 12', zip: '90402', city: 'Nürnberg', taxNumber: '241/123/45678', bankName: 'Sparkasse Nürnberg', iban: 'DE12 7605 0101 0000 1234 56', bic: 'SSKNDE77XXX', invoiceFooter: 'Vielen Dank für Ihr Vertrauen. Zahlbar innerhalb von 14 Tagen ohne Abzug.', paymentTermsDays: 14 });
const me = await api('GET', '/api/auth/me');
await api('POST', '/api/users', { email: 'jonas@carcura.info', password: 'Demo-Passwort-2026', firstName: 'Jonas', lastName: 'Berger', role: 'employee' });
await api('POST', '/api/users', { email: 'buchhaltung@carcura.info', password: 'Demo-Passwort-2026', firstName: 'Sabine', lastName: 'Keller', role: 'accounting' });
const users = (await api('GET', '/api/users')).items ?? (await api('GET', '/api/users'));
const uid = (first) => users.find((u) => u.firstName === first)?.id ?? me.user.id;

// 2) Leistungen bepreisen
const PRICES = { 'Innenreinigung Basis': [8900, 60, 600], 'Innenreinigung Intensiv': [18900, 150, 1400], 'Polster- und Teppichreinigung': [14900, 120, 1200], 'Lederpflege': [12900, 90, 1500], 'Außenreinigung Handwäsche': [5900, 45, 400], 'Lackpolitur einstufig': [34900, 240, 2500], 'Lackpolitur mehrstufig': [64900, 480, 4500], 'Wachsversiegelung': [19900, 90, 2200], 'Keramikversiegelung': [89900, 540, 14000], 'Komplettaufbereitung': [44900, 300, 3500], 'Geruchsneutralisation (Ozon)': [7900, 60, 300], 'Motorwäsche': [6900, 45, 500], 'Scheinwerferaufbereitung': [9900, 60, 900] };
const services = (await api('GET', '/api/services')).items;
for (const s of services) { const p = PRICES[s.name]; if (p) await api('PATCH', `/api/services/${s.id}`, { priceCents: p[0], durationMinutes: p[1], materialCostCents: p[2] }); }
const svc = (name) => services.find((s) => s.name === name);
const line = (name, qty = 1, price) => { const s = svc(name); return { serviceId: s?.id ?? null, name, quantity: qty, unitPriceCents: price ?? PRICES[name][0], vatBp: 1900 }; };

// 3) Kunden + Fahrzeuge
const CUSTOMERS = [
  ['Herr', 'Michael', 'Hartmann', null, 'michael.hartmann@example.de', '0911 4471230', 'Fürther Straße 88', '90429', 'Nürnberg', ['Stammkunde'], [['N-MH 2021', 'BMW', 'M340i Touring', 2021, 'Kombi', 'schwarz', 41200]]],
  ['Frau', 'Sandra', 'Weber', null, 'sandra.weber@example.de', '0170 8812345', 'Am Plärrer 3', '90443', 'Nürnberg', [], [['N-SW 77', 'Audi', 'Q5 Sportback', 2022, 'SUV', 'weiß', 22800]]],
  [null, 'Thomas', 'Lindner', 'Autohaus Lindner GmbH', 'einkauf@autohaus-lindner.example', '0911 990120', 'Industriestraße 4', '90765', 'Fürth', ['Händler', 'Rahmenvertrag'], [['FÜ-AL 101', 'VW', 'Tiguan', 2020, 'SUV', 'grau', 68000], ['FÜ-AL 102', 'Skoda', 'Octavia Combi', 2019, 'Kombi', 'blau', 91000], ['FÜ-AL 103', 'VW', 'ID.4', 2023, 'SUV', 'weiß', 12000]]],
  ['Frau', 'Julia', 'Schneider', null, 'julia.schneider@example.de', '0176 4455667', 'Rothenburger Str. 210', '90439', 'Nürnberg', ['Stammkunde'], [['N-JS 500', 'Mercedes-Benz', 'C 300 e', 2023, 'Limousine', 'silber', 9800]]],
  ['Herr', 'Daniel', 'Roth', null, 'd.roth@example.de', '0151 2233445', 'Erlanger Str. 15', '91052', 'Erlangen', [], [['ER-DR 9', 'Porsche', '911 Carrera', 2018, 'Sportwagen', 'rot', 33000]]],
  [null, 'Petra', 'Maier', 'Maier Immobilien', 'p.maier@maier-immo.example', '0911 3344550', 'Königstraße 60', '90402', 'Nürnberg', ['Firmenkunde'], [['N-MI 1', 'Tesla', 'Model Y', 2023, 'SUV', 'schwarz', 15500]]],
  ['Herr', 'Kevin', 'Braun', null, 'kevin.braun@example.de', '0172 9988776', 'Sulzbacher Str. 44', '90489', 'Nürnberg', [], [['N-KB 333', 'Ford', 'Focus ST', 2017, 'Kompaktklasse', 'blau', 122000]]],
  ['Frau', 'Anna', 'Hoffmann', null, 'anna.hoffmann@example.de', '0160 1122334', 'Bahnhofstraße 7', '90762', 'Fürth', ['Stammkunde'], [['FÜ-AH 22', 'Mini', 'Cooper S', 2021, 'Kleinwagen', 'grün', 27000]]],
  [null, 'Stefan', 'Krüger', 'Krüger Taxi & Transfer', 'info@krueger-taxi.example', '0911 1234500', 'Flughafenstraße 100', '90411', 'Nürnberg', ['Firmenkunde', 'Flotte'], [['N-KT 1', 'Mercedes-Benz', 'E 220 d', 2022, 'Limousine', 'beige', 98000], ['N-KT 2', 'Mercedes-Benz', 'V 300 d', 2021, 'Van', 'schwarz', 143000]]],
  ['Herr', 'Markus', 'Vogel', null, 'markus.vogel@example.de', '0179 5566778', 'Schwabacher Str. 12', '90439', 'Nürnberg', [], [['N-MV 88', 'BMW', 'X3', 2020, 'SUV', 'weiß', 54000]]],
  ['Frau', 'Lisa', 'Neumann', null, 'lisa.neumann@example.de', '0157 3344556', 'Wodanstraße 25', '90461', 'Nürnberg', [], [['N-LN 7', 'VW', 'Golf GTI', 2022, 'Kompaktklasse', 'grau', 19000]]],
  ['Herr', 'Florian', 'Wagner', null, 'f.wagner@example.de', '0163 7788990', 'Hauptstraße 3', '90513', 'Zirndorf', ['Wohnmobil'], [['FÜ-FW 21', 'Fiat', 'Ducato Wohnmobil', 2019, 'Wohnmobil', 'weiß', 61000]]],
  ['Frau', 'Claudia', 'Fischer', null, 'claudia.fischer@example.de', '0171 2345678', 'Nürnberger Str. 5', '90522', 'Oberasbach', [], [['FÜ-CF 4', 'Hyundai', 'Tucson', 2021, 'SUV', 'grau', 38000]]],
  ['Herr', 'Peter', 'Zimmermann', null, 'peter.zimmermann@example.de', '0911 7788990', 'Regensburger Str. 300', '90478', 'Nürnberg', ['Oldtimer'], [['N-PZ 65 H', 'Mercedes-Benz', '280 SL Pagode', 1968, 'Cabrio', 'weiß', 145000]]],
];
const customers = []; const vehicles = [];
for (const [salutation, firstName, lastName, companyName, email, phone, street, zip, city, tags, cars] of CUSTOMERS) {
  const c = (await api('POST', '/api/customers', { type: companyName ? 'business' : 'private', salutation, firstName, lastName, companyName, email, phone, street, zip, city, tags, source: pick(['website', 'google_ads', 'referral', 'phone', 'google_business']) })).customer;
  customers.push(c);
  for (const [licensePlate, make, model, year, vehicleType, color, mileage] of cars) { const vr = await api('POST', '/api/vehicles', { customerId: c.id, licensePlate, make, model, year, vehicleType, color, mileage }); vehicles.push({ customerId: c.id, ...(vr.vehicle ?? vr) }); }
}
const cust = (last) => customers.find((c) => c.lastName === last);
const veh = (plate) => vehicles.find((v) => v.licensePlate === plate);
const vehOf = (c) => vehicles.find((v) => v.customerId === c.id);

// Kommunikation
await api('POST', `/api/customers/${cust('Hartmann').id}/activities`, { type: 'call', direction: 'out', subject: 'Terminabsprache Keramikversiegelung', content: 'Kunde möchte vor dem Urlaub die Versiegelung, Abgabe Freitag 8 Uhr.' });
await api('POST', `/api/customers/${cust('Hartmann').id}/activities`, { type: 'whatsapp', direction: 'in', subject: 'Frage zur Pflege', content: 'Welches Shampoo nach der Keramikversiegelung?' });
await api('POST', `/api/customers/${cust('Lindner').id}/activities`, { type: 'email', direction: 'out', subject: 'Rahmenvertrag 2026', content: 'Angebot für monatliche Aufbereitung der Vorführwagen gesendet.' });

// 4) Leads
const LEADS = [
  ['Marco', 'Seidel', 'marco.seidel@example.de', '0176 1234123', 'website', 'Keramikversiegelung', 'BMW 3er, 2021', 'Hallo, ich hätte gerne ein Angebot für eine Keramikversiegelung inkl. Politur.', 'new', 0, 89900],
  ['Nina', 'Krause', 'nina.krause@example.de', '0151 9876543', 'google_ads', 'Komplettaufbereitung', 'VW Polo 2016', 'Auto soll verkauft werden, bitte komplett aufbereiten.', 'new', 1, 44900],
  ['Tobias', 'Frank', null, '0170 5551234', 'phone', 'Innenreinigung Intensiv', 'Audi A4 Avant', 'Hundehaare und Flecken auf der Rückbank.', 'contacted', 2, 18900],
  ['Sarah', 'Lang', 'sarah.lang@example.de', null, 'meta_ads', 'Lackpolitur einstufig', 'Mercedes A-Klasse 2019', 'Swirls im Lack nach Waschanlage.', 'offer_sent', 4, 34900],
  ['Jan', 'Peters', 'jan.peters@example.de', '0162 3332221', 'google_business', 'Wachsversiegelung', 'Tesla Model 3', null, 'appointment', 6, 19900],
  ['Elena', 'Schulz', 'elena.schulz@example.de', '0173 7776665', 'referral', 'Lederpflege', 'Range Rover Velar', 'Empfehlung von Frau Schneider.', 'contacted', 3, 12900],
  ['Robert', 'Hahn', null, '0911 4455661', 'website', 'Scheinwerferaufbereitung', 'Opel Astra 2014', null, 'lost', 12, 9900],
  ['Katrin', 'Böhm', 'katrin.boehm@example.de', '0176 8889990', 'google_ads', 'Komplettaufbereitung', 'Skoda Kodiaq 2020', 'Bitte Angebot für Innen + Außen.', 'won', 9, 44900],
  ['Lukas', 'Meyer', 'lukas.meyer@example.de', null, 'meta_ads', 'Keramikversiegelung', 'Porsche Macan', 'Neuwagen, soll direkt versiegelt werden.', 'offer_created', 5, 89900],
  ['Sophie', 'Richter', 'sophie.richter@example.de', '0157 1112223', 'website', 'Innenreinigung Basis', 'Fiat 500', null, 'lost', 15, 8900],
  ['Dennis', 'Wolf', null, '0171 6667778', 'phone', 'Motorwäsche', 'Ford Ranger', null, 'won', 20, 6900],
  ['Laura', 'Koch', 'laura.koch@example.de', '0160 4443332', 'google_ads', 'Polster- und Teppichreinigung', 'Seat Leon', 'Kaffee auf dem Beifahrersitz.', 'new', 0, 14900],
];
const leads = [];
for (const [firstName, lastName, email, phone, source, requestedService, vehicleText, message, status, ageDays, estimatedValueCents] of LEADS) {
  const lr = await api('POST', '/api/leads', { firstName, lastName, email, phone, source, requestedService, vehicleText, message, estimatedValueCents, campaign: source === 'google_ads' ? 'Search – Fahrzeugaufbereitung Nürnberg' : source === 'meta_ads' ? 'Keramik-Kampagne Herbst' : null, assignedUserId: pick([me.user.id, uid('Jonas')]) });
  const l = lr.lead ?? lr;
  if (status !== 'new') await api('PATCH', `/api/leads/${l.id}`, { status, lostReason: status === 'lost' ? pick(['Preis zu hoch', 'Keine Rückmeldung']) : null });
  leads.push({ ...l, ageDays });
}
await api('POST', `/api/leads/${leads[2].id}/activities`, { type: 'call', direction: 'out', subject: 'Rückruf', content: 'Termin nächste Woche vorgeschlagen, Kunde meldet sich.' });

// 5) Termine (vergangen und kommend)
const APPTS = [
  [-21, 8, 'service', 'Komplettaufbereitung', 'Lindner', 'FÜ-AL 101', 'done', 44900], [-18, 9, 'service', 'Keramikversiegelung', 'Hartmann', 'N-MH 2021', 'done', 89900], [-14, 10, 'service', 'Innenreinigung Intensiv', 'Krüger', 'N-KT 2', 'done', 18900],
  [-12, 13, 'service', 'Lackpolitur einstufig', 'Weber', 'N-SW 77', 'done', 34900], [-9, 8, 'service', 'Komplettaufbereitung', 'Lindner', 'FÜ-AL 102', 'done', 44900], [-7, 14, 'consultation', 'Beratung Oldtimer-Politur', 'Zimmermann', 'N-PZ 65 H', 'done', null],
  [-5, 9, 'service', 'Wachsversiegelung', 'Hoffmann', 'FÜ-AH 22', 'done', 19900], [-2, 8, 'service', 'Innenreinigung Intensiv', 'Braun', 'N-KB 333', 'done', 18900], [-1, 10, 'service', 'Komplettaufbereitung Wohnmobil', 'Wagner', 'FÜ-FW 21', 'done', 64900],
  [0, 8, 'service', 'Keramikversiegelung', 'Roth', 'ER-DR 9', 'confirmed', 89900], [0, 15, 'pickup', 'Abholung Wohnmobil', 'Wagner', 'FÜ-FW 21', 'planned', null], [1, 9, 'service', 'Komplettaufbereitung', 'Schneider', 'N-JS 500', 'confirmed', 44900],
  [1, 14, 'handover', 'Übergabe 911', 'Roth', 'ER-DR 9', 'planned', null], [2, 8, 'service', 'Lackpolitur mehrstufig', 'Zimmermann', 'N-PZ 65 H', 'confirmed', 64900], [3, 10, 'service', 'Innenreinigung Basis', 'Neumann', 'N-LN 7', 'planned', 8900],
  [4, 9, 'service', 'Flottenreinigung Taxi', 'Krüger', 'N-KT 1', 'planned', 14900], [6, 8, 'service', 'Komplettaufbereitung', 'Lindner', 'FÜ-AL 103', 'planned', 44900], [8, 11, 'consultation', 'Beratung Keramik', 'Vogel', 'N-MV 88', 'planned', null],
  [10, 8, 'service', 'Keramikversiegelung', 'Maier', 'N-MI 1', 'planned', 89900], [12, 9, 'service', 'Lederpflege', 'Fischer', 'FÜ-CF 4', 'planned', 12900],
];
for (const [d, h, type, title, last, plate, status, priceCents] of APPTS) {
  const dur = type === 'service' ? (title.includes('Keramik') || title.includes('mehrstufig') ? 8 : title.includes('Komplett') ? 5 : 3) : 1;
  await api('POST', '/api/appointments', { customerId: cust(last).id, vehicleId: veh(plate).id, userId: pick([me.user.id, uid('Jonas')]), type, title, startsAt: iso(day(d, h)), endsAt: iso(day(d, h + dur)), status, priceCents, allDay: false });
}

// 6) Aufträge + Rechnungen
const ORDERS = [
  ['Lindner', 'FÜ-AL 101', 'Komplettaufbereitung Vorführwagen', 'completed', -21, [line('Komplettaufbereitung')], 'paid', -20],
  ['Hartmann', 'N-MH 2021', 'Keramikversiegelung inkl. Politur', 'completed', -18, [line('Lackpolitur einstufig'), line('Keramikversiegelung')], 'paid', -17],
  ['Krüger', 'N-KT 2', 'Innenreinigung Taxi-Van', 'completed', -14, [line('Innenreinigung Intensiv'), line('Geruchsneutralisation (Ozon)')], 'paid', -13],
  ['Weber', 'N-SW 77', 'Lackpolitur nach Waschanlage', 'completed', -12, [line('Lackpolitur einstufig'), line('Wachsversiegelung')], 'overdue', -40],
  ['Lindner', 'FÜ-AL 102', 'Komplettaufbereitung Gebrauchtwagen', 'completed', -9, [line('Komplettaufbereitung'), line('Scheinwerferaufbereitung')], 'open', -8],
  ['Hoffmann', 'FÜ-AH 22', 'Wachsversiegelung', 'completed', -5, [line('Außenreinigung Handwäsche'), line('Wachsversiegelung')], 'paid', -5],
  ['Braun', 'N-KB 333', 'Innenreinigung mit Polsterreinigung', 'completed', -2, [line('Innenreinigung Intensiv'), line('Polster- und Teppichreinigung')], 'open', -2],
  ['Wagner', 'FÜ-FW 21', 'Wohnmobil-Komplettaufbereitung', 'finished', -1, [line('Komplettaufbereitung', 1, 64900), line('Motorwäsche')], null],
  ['Roth', 'ER-DR 9', 'Keramikversiegelung 911', 'in_progress', 0, [line('Lackpolitur mehrstufig'), line('Keramikversiegelung')], null],
  ['Schneider', 'N-JS 500', 'Komplettaufbereitung', 'accepted', 1, [line('Komplettaufbereitung')], null],
  ['Zimmermann', 'N-PZ 65 H', 'Oldtimer-Politur mehrstufig', 'planned', 2, [line('Lackpolitur mehrstufig'), line('Lederpflege')], null],
];
const orders = [];
for (const [last, plate, title, status, d, items, inv, invDay] of ORDERS) {
  const orr = await api('POST', '/api/orders', { customerId: cust(last).id, vehicleId: veh(plate).id, userId: pick([me.user.id, uid('Jonas')]), title, status: 'planned', scheduledAt: iso(day(d, 8)), mileageIn: veh(plate).mileage, items, notes: status === 'in_progress' ? 'Kunde wünscht Felgenversiegelung zusätzlich – Rücksprache.' : null });
  const o = orr.order ?? orr;
  if (status !== 'planned') await api('PATCH', `/api/orders/${o.id}`, { status });
  orders.push({ ...o, last, inv, invDay, status });
  if (inv) {
    const i = await api('POST', '/api/invoices/from-order', { orderId: o.id });
    const invId = i.invoice?.id ?? i.id;
    await api('POST', `/api/invoices/${invId}/issue`, { issueDate: dateStr(day(invDay)) });
    const full = await api('GET', `/api/invoices/${invId}`);
    const total = full.invoice?.totalCents ?? full.totalCents;
    if (inv === 'paid') await api('POST', `/api/invoices/${invId}/payments`, { amountCents: total, method: pick(['transfer', 'card', 'cash']) });
  }
}
// Angebote
const off1 = await api('POST', '/api/offers', { customerId: cust('Maier').id, vehicleId: veh('N-MI 1').id, title: 'Keramikversiegelung Tesla Model Y', items: [line('Lackpolitur einstufig'), line('Keramikversiegelung')], introText: 'vielen Dank für Ihre Anfrage. Gerne bieten wir Ihnen an:' });
await api('POST', `/api/offers/${off1.offer?.id ?? off1.id}/send`, {}).catch(() => api('PATCH', `/api/offers/${off1.offer?.id ?? off1.id}`, { status: 'sent' }));
await api('POST', '/api/offers', { customerId: cust('Lindner').id, title: 'Rahmenvertrag: monatliche Aufbereitung Vorführwagen', items: [line('Komplettaufbereitung', 4, 39900), line('Außenreinigung Handwäsche', 8, 4900)] });
await api('POST', '/api/offers', { customerId: cust('Vogel').id, vehicleId: veh('N-MV 88').id, title: 'Keramikversiegelung BMW X3', items: [line('Keramikversiegelung')] });

// 7) Protokoll mit Schäden und Fotos
const proto = await api('POST', '/api/protocols', { type: 'intake', customerId: cust('Roth').id, vehicleId: veh('ER-DR 9').id, orderId: orders.find((o) => o.last === 'Roth').id, mileage: 33120, fuelLevel: 60, exteriorCondition: 'stark verschmutzt, Insektenreste Front', interiorCondition: 'gut, leichte Gebrauchsspuren', checklist: { warndreieck: true, verbandskasten: true, ersatzrad: false, ladekabel: false }, notes: 'Kunde wünscht besondere Vorsicht am Heckspoiler.', damages: [{ area: 'front', type: 'stone_chip', severity: 'minor', description: 'Steinschläge Frontschürze links', posX: 180, posY: 420 }, { area: 'left', type: 'scratch', severity: 'medium', description: 'Kratzer Fahrertür ca. 8 cm', posX: 380, posY: 560 }, { area: 'wheels', type: 'wear', severity: 'minor', description: 'Bordsteinkratzer Felge hinten rechts', posX: 760, posY: 620 }] });
const protoId = proto.protocol?.id ?? proto.id;
async function photo(label, hue) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},25%,28%)"/><stop offset="1" stop-color="hsl(${hue},20%,10%)"/></linearGradient></defs><rect width="1600" height="1100" fill="url(#g)"/><ellipse cx="800" cy="900" rx="620" ry="70" fill="rgba(0,0,0,0.45)"/><path d="M300 780 C340 640 420 560 560 540 L1050 530 C1180 540 1280 640 1330 780 Z" fill="hsl(${hue},12%,40%)"/><path d="M560 545 L1040 535 C1120 545 1180 600 1210 660 L400 665 C430 600 490 555 560 545 Z" fill="hsl(${hue},30%,70%)" opacity="0.5"/><circle cx="520" cy="800" r="95" fill="#111"/><circle cx="520" cy="800" r="55" fill="#666"/><circle cx="1110" cy="800" r="95" fill="#111"/><circle cx="1110" cy="800" r="55" fill="#666"/><text x="60" y="1040" font-family="Arial" font-size="46" fill="rgba(255,255,255,0.75)">${label} · Demo-Foto</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}
async function upload(fields, name, buffer) {
  const fd = new FormData(); for (const [k, v] of Object.entries(fields)) fd.append(k, String(v)); fd.append('file', new Blob([buffer], { type: 'image/jpeg' }), name);
  const r = await fetch(base + '/api/files', { method: 'POST', headers: { cookie }, body: fd }); if (!r.ok) throw new Error('upload ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}
await upload({ protocolId: protoId, customerId: cust('Roth').id, vehicleId: veh('ER-DR 9').id, category: 'before', caption: 'Front vor der Aufbereitung' }, 'front-vorher.jpg', await photo('Front vorher', 0));
await upload({ protocolId: protoId, customerId: cust('Roth').id, vehicleId: veh('ER-DR 9').id, category: 'damage', caption: 'Kratzer Fahrertür' }, 'kratzer-tuer.jpg', await photo('Kratzer Fahrertür', 20));
await upload({ protocolId: protoId, customerId: cust('Roth').id, vehicleId: veh('ER-DR 9').id, category: 'before', caption: 'Heck vor der Aufbereitung' }, 'heck-vorher.jpg', await photo('Heck vorher', 350));
await upload({ customerId: cust('Hartmann').id, vehicleId: veh('N-MH 2021').id, category: 'after', caption: 'Nach Keramikversiegelung' }, 'nachher.jpg', await photo('Nach Keramik', 210));
await upload({ customerId: cust('Hartmann').id, vehicleId: veh('N-MH 2021').id, category: 'before', caption: 'Vorher' }, 'vorher.jpg', await photo('Vorher', 210));

// 8) Ausgaben, wiederkehrende Kosten, Lager
const EXP = [['Material', 'Keramikversiegelung Gtechniq Crystal Serum 30 ml', 'Detailing Store', 18900, -3], ['Material', 'Poliermaschine-Pads Set', 'Koch-Chemie Händler', 6490, -6], ['Material', 'Reinigungschemie Monatsbestellung', 'Koch-Chemie Händler', 42300, -10], ['Fahrzeugkosten', 'Diesel Firmenwagen', 'Aral', 9850, -4], ['Werbung', 'Google Ads September', 'Google Ireland', 48000, -1], ['Werbung', 'Meta Ads September', 'Meta Platforms', 22000, -1], ['Werkzeug', 'Dampfreiniger Ersatzdüsen', 'Kärcher', 7900, -13], ['Material', 'Mikrofasertücher 50 Stück', 'Amazon', 5990, -16], ['Sonstiges', 'Arbeitskleidung mit Logo', 'Textildruck Nürnberg', 21400, -19], ['Material', 'Lederpflege-Set', 'Colourlock', 8900, -22], ['Fahrzeugkosten', 'Diesel Firmenwagen', 'Aral', 10200, -24], ['Werbung', 'Google Ads August', 'Google Ireland', 45000, -31], ['Werbung', 'Meta Ads August', 'Meta Platforms', 20000, -31], ['Material', 'Reinigungschemie', 'Koch-Chemie Händler', 39800, -40], ['Werkzeug', 'Exzenterpolierer Flex', 'Werkzeug-Profi', 34900, -45], ['Material', 'Wachs und Versiegelungen', 'Detailing Store', 15600, -52], ['Werbung', 'Google Ads Juli', 'Google Ireland', 42000, -61], ['Material', 'Reinigungschemie', 'Koch-Chemie Händler', 41200, -70], ['Sonstiges', 'Steuerberater Quartal', 'Kanzlei Huber', 38000, -33]];
for (const [category, description, vendor, grossCents, d] of EXP) await api('POST', '/api/expenses', { date: dateStr(day(d)), category, description, vendor, grossCents, vatBp: 1900, isPaid: d < -2, paymentMethod: pick(['transfer', 'card']) });
for (const [name, category, vendor, netCents, interval] of [['Hallenmiete', 'Miete', 'Gewerbepark Nürnberg Süd', 95000, 'monthly'], ['Betriebshaftpflicht', 'Versicherung', 'Allianz', 8900, 'monthly'], ['Software Manager', 'Software', 'Carcura Software', 4900, 'monthly'], ['Telefon & Internet', 'Kommunikation', 'Telekom', 5900, 'monthly'], ['Strom & Wasser', 'Nebenkosten', 'N-ERGIE', 21000, 'monthly']]) await api('POST', '/api/recurring-expenses', { name, category, vendor, netCents, vatBp: 1900, interval, startDate: dateStr(new Date(new Date().getFullYear(), new Date().getMonth() - 3, 1)), paymentMethod: 'direct_debit', autoPaid: true });
const INV = [['Keramikversiegelung 30 ml', 'Versiegelung', 'Stück', 4, 2, 18900, 'Detailing Store'], ['Allzweckreiniger 10 l', 'Reiniger', 'Liter', 12, 10, 890, 'Koch-Chemie'], ['Felgenreiniger 5 l', 'Reiniger', 'Liter', 3, 5, 1290, 'Koch-Chemie'], ['Polierpad weich 150 mm', 'Politur', 'Stück', 14, 6, 690, 'Koch-Chemie'], ['Polierpaste Heavy Cut 1 l', 'Politur', 'Stück', 2, 2, 4590, 'Koch-Chemie'], ['Mikrofasertuch Premium', 'Zubehör', 'Stück', 48, 30, 120, 'Amazon'], ['Lederreiniger 250 ml', 'Innenraum', 'Stück', 1, 3, 1490, 'Colourlock'], ['Ozon-Filter', 'Innenraum', 'Stück', 0, 1, 2900, 'Ozon-Technik'], ['Wachs Carnauba 200 g', 'Versiegelung', 'Stück', 5, 2, 3900, 'Detailing Store']];
for (const [name, category, unit, quantity, minQuantity, purchasePriceCents, supplier] of INV) { const itr = await api('POST', '/api/inventory', { name, category, unit, quantity, minQuantity, purchasePriceCents, supplier, location: 'Regal A' }); const it = itr.item ?? itr; if (quantity > 2) await api('POST', `/api/inventory/${it.id}/movements`, { type: 'out', quantity: 1, reason: 'Auftrag Keramikversiegelung' }); }

// 9) Aufgaben
for (const [title, d, h, priority, last, lead] of [['Angebot Keramik an Herrn Seidel senden', 0, 12, 'high', null, 0], ['Frau Krause zurückrufen (Google Ads Lead)', 0, 10, 'high', null, 1], ['Keramikversiegelung nachbestellen (nur 4 Stück)', 1, 9, 'normal', null, null], ['Rechnung Weber anmahnen – 26 Tage überfällig', -1, 9, 'high', 'Weber', null], ['Rahmenvertrag Lindner nachfassen', 2, 11, 'normal', 'Lindner', null], ['Google-Bewertung bei Herrn Hartmann erbitten', 3, 15, 'low', 'Hartmann', null], ['Winterreifen-Aktion planen', 7, 9, 'low', null, null]]) await api('POST', '/api/tasks', { title, dueAt: iso(day(d, h)), priority, customerId: last ? cust(last).id : null, leadId: lead !== null ? leads[lead].id : null, assignedUserId: pick([me.user.id, uid('Jonas')]) });

// 10) Wettbewerber
const comps = [];
for (const [name, address, website, rating, ratingCount, notes] of [['Glanzwerk Fahrzeugpflege', 'Sigmundstraße 120, 90431 Nürnberg', 'https://glanzwerk-beispiel.de', 4.7, 128, 'Keramik ab 799 €, viele Instagram-Reels'], ['CarSpa Franken', 'Nürnberger Str. 45, 90762 Fürth', 'https://carspa-franken-beispiel.de', 4.4, 61, 'Fokus Innenreinigung, Preise günstiger'], ['Detail Boutique Erlangen', 'Am Europakanal 8, 91056 Erlangen', 'https://detailboutique-beispiel.de', 4.9, 212, 'Premium, Porsche/Tesla, Wartezeit 3 Wochen'], ['Autopflege Express', 'Bayreuther Str. 200, 90411 Nürnberg', null, 3.8, 44, 'Waschstraße mit Handwäsche, kein Detailing'], ['Carcura Fahrzeugaufbereitung', 'Werkstattstraße 12, 90402 Nürnberg', 'https://carcura.info', 5.0, 37, null]]) { const cr = await api('POST', '/api/competitors', { name, address, website, rating, ratingCount, notes }); comps.push(cr.competitor ?? cr); }
await api('PATCH', `/api/competitors/${comps[4].id}`, { isOwn: true });

// 11) Direkt in die Datenbank: Marketing-Kennzahlen, Verlauf, Zeitstempel
const db = new Database(`${DATA_DIR}/app.db`);
const cid = me.company.id; const now = new Date().toISOString();
const ins = (table, row) => { const keys = Object.keys(row); db.prepare(`insert into ${table} (${keys.join(',')}) values (${keys.map(() => '?').join(',')})`).run(...keys.map((k) => row[k])); };
for (let d = 75; d >= 1; d--) {
  const date = dateStr(day(-d)); const wk = [0, 6].includes(day(-d).getDay()) ? 0.6 : 1; const trend = 1 + (75 - d) / 250;
  const ga = Math.round((3200 + rnd() * 900) * wk * trend); const gc = Math.round(ga * (0.055 + rnd() * 0.02)); const gcost = Math.round(gc * (95 + rnd() * 40));
  ins('marketing_daily', { id: randomUUID(), company_id: cid, source: 'google_ads', date, campaign_id: 'g-1', campaign_name: 'Search – Fahrzeugaufbereitung Nürnberg', impressions: ga, clicks: gc, cost_cents: gcost, conversions: Math.round(gc * 0.06 * 10) / 10, conversion_value_cents: 0, reach: null, leads: Math.round(gc * 0.06), currency: 'EUR', fetched_at: now });
  const ga2 = Math.round((1400 + rnd() * 500) * wk); const gc2 = Math.round(ga2 * 0.04); ins('marketing_daily', { id: randomUUID(), company_id: cid, source: 'google_ads', date, campaign_id: 'g-2', campaign_name: 'Search – Keramikversiegelung', impressions: ga2, clicks: gc2, cost_cents: Math.round(gc2 * (140 + rnd() * 40)), conversions: Math.round(gc2 * 0.05 * 10) / 10, conversion_value_cents: 0, reach: null, leads: Math.round(gc2 * 0.05), currency: 'EUR', fetched_at: now });
  const ma = Math.round((9000 + rnd() * 4000) * wk); const mc = Math.round(ma * 0.012); ins('marketing_daily', { id: randomUUID(), company_id: cid, source: 'meta_ads', date, campaign_id: 'm-1', campaign_name: 'Keramik-Kampagne Herbst', impressions: ma, clicks: mc, cost_cents: Math.round(mc * (55 + rnd() * 25)), conversions: Math.round(mc * 0.03 * 10) / 10, conversion_value_cents: 0, reach: Math.round(ma * 0.7), leads: Math.round(mc * 0.03), currency: 'EUR', fetched_at: now });
  const sessions = Math.round((140 + rnd() * 60) * wk * trend);
  ins('web_analytics_daily', { id: randomUUID(), company_id: cid, date, dimension_type: 'total', dimension_value: 'total', sessions, users: Math.round(sessions * 0.82), pageviews: Math.round(sessions * 2.4), conversions: Math.round(sessions * 0.035 * 10) / 10, fetched_at: now });
  for (const [ch, share] of [['Organic Search', 0.41], ['Paid Search', 0.27], ['Direct', 0.12], ['Paid Social', 0.1], ['Organic Social', 0.06], ['Referral', 0.04]]) ins('web_analytics_daily', { id: randomUUID(), company_id: cid, date, dimension_type: 'channel', dimension_value: ch, sessions: Math.round(sessions * share), users: Math.round(sessions * share * 0.8), pageviews: Math.round(sessions * share * 2.3), conversions: Math.round(sessions * share * (ch.includes('Paid') ? 0.05 : 0.03) * 10) / 10, fetched_at: now });
  for (const [dev, share] of [['mobile', 0.68], ['desktop', 0.28], ['tablet', 0.04]]) ins('web_analytics_daily', { id: randomUUID(), company_id: cid, date, dimension_type: 'device', dimension_value: dev, sessions: Math.round(sessions * share), users: Math.round(sessions * share * 0.8), pageviews: Math.round(sessions * share * 2.2), conversions: Math.round(sessions * share * 0.035 * 10) / 10, fetched_at: now });
  for (const [lp, share] of [['/', 0.38], ['/keramikversiegelung/', 0.22], ['/fahrzeugaufbereitung-nuernberg/', 0.17], ['/innenreinigung/', 0.12], ['/preise/', 0.11]]) ins('web_analytics_daily', { id: randomUUID(), company_id: cid, date, dimension_type: 'landing_page', dimension_value: lp, sessions: Math.round(sessions * share), users: Math.round(sessions * share * 0.8), pageviews: Math.round(sessions * share * 2), conversions: Math.round(sessions * share * 0.04 * 10) / 10, fetched_at: now });
  ins('social_daily', { id: randomUUID(), company_id: cid, platform: 'instagram', date, followers: 1840 + (75 - d) * 4, reach: Math.round((900 + rnd() * 700) * wk), impressions: Math.round((1400 + rnd() * 900) * wk), views: Math.round((2500 + rnd() * 3000) * wk), likes: Math.round(40 + rnd() * 60), comments: Math.round(rnd() * 8), shares: Math.round(rnd() * 12), fetched_at: now });
  const sc = Math.round((38 + rnd() * 18) * wk * trend); ins('seo_daily', { id: randomUUID(), company_id: cid, date, dimension_type: 'total', dimension_value: 'total', clicks: sc, impressions: sc * 24, position: 8.2 - (75 - d) * 0.02, fetched_at: now });
  for (const [q, share, pos] of [['fahrzeugaufbereitung nürnberg', 0.28, 3.1], ['keramikversiegelung nürnberg', 0.19, 4.4], ['autoaufbereitung fürth', 0.12, 6.8], ['innenreinigung auto nürnberg', 0.11, 5.2], ['carcura', 0.15, 1.0], ['lackpolitur nürnberg', 0.08, 9.5]]) ins('seo_daily', { id: randomUUID(), company_id: cid, date, dimension_type: 'query', dimension_value: q, clicks: Math.round(sc * share), impressions: Math.round(sc * share * 20), position: pos, fetched_at: now });
  for (const [p, share, pos] of [['https://carcura.info/', 0.4, 4.1], ['https://carcura.info/keramikversiegelung/', 0.25, 5.0], ['https://carcura.info/fahrzeugaufbereitung-nuernberg/', 0.2, 3.9], ['https://carcura.info/preise/', 0.15, 7.7]]) ins('seo_daily', { id: randomUUID(), company_id: cid, date, dimension_type: 'page', dimension_value: p, clicks: Math.round(sc * share), impressions: Math.round(sc * share * 22), position: pos, fetched_at: now });
}
// Wettbewerber-Verlauf (Snapshots der letzten Wochen)
for (const c of comps) { const row = db.prepare('select id, name from competitors where id = ?').get(c.id); const baseRating = { 'Glanzwerk Fahrzeugpflege': [4.7, 128], 'CarSpa Franken': [4.4, 61], 'Detail Boutique Erlangen': [4.9, 212], 'Autopflege Express': [3.8, 44], 'Carcura Fahrzeugaufbereitung': [5.0, 37] }[row.name]; for (const w of [5, 4, 3, 2, 1]) ins('competitor_snapshots', { id: randomUUID(), company_id: cid, competitor_id: c.id, date: dateStr(day(-7 * w)), rating: baseRating[0], rating_count: Math.max(0, baseRating[1] - w * (row.name.startsWith('Carcura') ? 2 : row.name.startsWith('Glanz') ? 4 : 1)), business_status: 'OPERATIONAL', price_level: null, created_at: now }); }
// Zeitstempel zurückdatieren (Leads, Kunden, Aufträge)
for (const l of leads) { const t = day(-l.ageDays, 9 + Math.floor(rnd() * 9), Math.floor(rnd() * 59)).toISOString(); db.prepare('update leads set created_at = ?, updated_at = ? where id = ?').run(t, t, l.id); }
customers.forEach((c, i) => { const t = day(-(5 + i * 9), 10).toISOString(); db.prepare('update customers set created_at = ? where id = ?').run(t, c.id); });
db.prepare("update marketing_daily set leads = leads where 1").run();
db.close();
// Windsor-Anbindung als konfiguriert markieren, damit das Marketing-Dashboard die Daten anzeigt (Demo-Key, kein Abruf)
await api('PUT', '/api/integrations/marketing/windsor', { apiKey: 'demo-key-nicht-gueltig' }).catch((e) => console.log('windsor config:', e.message.slice(0, 120)));
// Berichte
await api('POST', '/api/reports/generate', { type: 'weekly' });
await api('POST', '/api/reports/generate', { type: 'monthly', current: true });
console.log('Demo-Daten angelegt:', { customers: customers.length, vehicles: vehicles.length, leads: leads.length, orders: orders.length });
