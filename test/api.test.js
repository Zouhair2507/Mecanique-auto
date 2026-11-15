'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../src/app');

// Dimanche 15 novembre 2026, 13h00 à Paris
const NOW = new Date('2026-11-15T12:00:00Z');
const MONDAY = '2026-11-16';

let server;
let base;
let dataDir;
let adminCookie = '';

async function req(method, url, body, headers = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

const admin = (method, url, body) => req(method, url, body, { Cookie: adminCookie });

const booking = (over = {}) => ({
  services: ['vidange', 'plaquettes-av'],
  date: MONDAY,
  time: '09:00',
  vehicle: { brand: 'Renault', model: 'Clio 4', year: '2017', plate: 'ab-123-cd', mileage: '98000', fuel: 'Diesel' },
  customer: { name: 'Jean Dupont', phone: '06 12 34 56 78', email: 'Jean@Example.com' },
  notes: '',
  consent: true,
  ...over,
});

test.before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'garage-test-'));
  const app = createApp({ dataDir, adminPassword: 'secret-garage', now: () => NOW, rateLimits: false });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('configuration publique', async () => {
  const { status, data } = await req('GET', '/api/config');
  assert.equal(status, 200);
  assert.equal(data.today, '2026-11-15');
  assert.equal(data.status.open, false);
  assert.equal(data.hourlyRates.length, 3);
  assert.ok(data.categories.length > 0);
  assert.ok(data.ticketCategories.length > 0);
});

test('pages et en-têtes de sécurité', async () => {
  for (const p of ['/', '/rendez-vous', '/support', '/admin', '/mentions-legales']) {
    const res = await fetch(base + p);
    assert.equal(res.status, 200, p);
    assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
  }
  assert.equal((await fetch(`${base}/inexistant`)).status, 404);
  assert.equal((await req('GET', '/api/inexistant')).status, 404);
});

test('calendrier et créneaux', async () => {
  const cal = await req('GET', '/api/calendar?month=2026-11');
  assert.equal(cal.status, 200);
  const byDate = Object.fromEntries(cal.data.days.map((d) => [d.date, d.status]));
  assert.equal(byDate['2026-11-14'], 'past');
  assert.equal(byDate['2026-11-15'], 'closed');
  assert.equal(byDate[MONDAY], 'available');
  const slots = await req('GET', `/api/slots?date=${MONDAY}`);
  assert.equal(slots.data.slots.length, 17);
  assert.equal((await req('GET', '/api/slots?date=2026-02-30')).status, 400);
});

test('prise de rendez-vous complète', async () => {
  const created = await req('POST', '/api/appointments', booking());
  assert.equal(created.status, 201);
  assert.match(created.data.ref, /^RDV-[A-Z2-9]{6}$/);
  assert.equal(created.data.estimate.total, 188);
  assert.equal(created.data.vehicle.plate, 'AB-123-CD');

  // Même client, même jour
  const dup = await req('POST', '/api/appointments', booking({ time: '10:00' }));
  assert.equal(dup.status, 409);

  // Capacité : 2 véhicules par créneau
  const second = await req('POST', '/api/appointments', booking({ customer: { name: 'B', phone: '0600000000', email: 'b@example.com' } }));
  assert.equal(second.status, 201);
  const third = await req('POST', '/api/appointments', booking({ customer: { name: 'C', phone: '0600000001', email: 'c@example.com' } }));
  assert.equal(third.status, 409);
  assert.match(third.data.error, /créneau/);

  // Consultation avec la référence et l'e-mail (insensible à la casse)
  const look = await req('POST', '/api/appointments/lookup', { ref: created.data.ref.toLowerCase(), email: 'JEAN@example.com' });
  assert.equal(look.status, 200);
  assert.equal(look.data.status, 'pending');
  assert.equal((await req('POST', '/api/appointments/lookup', { ref: created.data.ref, email: 'autre@example.com' })).status, 404);

  // Annulation : le créneau se libère
  const cancel = await req('POST', '/api/appointments/cancel', { ref: created.data.ref, email: 'jean@example.com' });
  assert.equal(cancel.data.status, 'cancelled');
  const slot = (await req('GET', `/api/slots?date=${MONDAY}`)).data.slots.find((s) => s.time === '09:00');
  assert.equal(slot.remaining, 1);
});

test('refus des rendez-vous invalides', async () => {
  const cases = [
    [booking({ consent: false }), 400],
    [booking({ services: ['inexistant'] }), 400],
    [booking({ services: [], otherRequest: '' }), 400],
    [booking({ customer: { name: 'X', phone: 'abc', email: 'x@example.com' } }), 400],
    [booking({ customer: { name: 'X', phone: '0600000000', email: 'pas-un-email' } }), 400],
    [booking({ vehicle: { brand: '', model: 'Clio' } }), 400],
    [booking({ date: '2026-11-15', customer: { name: 'X', phone: '0600000000', email: 'x@example.com' } }), 409], // dimanche
    [booking({ time: '07:00', customer: { name: 'X', phone: '0600000000', email: 'x@example.com' } }), 409],
  ];
  for (const [body, expected] of cases) {
    const res = await req('POST', '/api/appointments', body);
    assert.equal(res.status, expected, JSON.stringify(res.data));
  }
  // Demande libre sans prestation du catalogue : acceptée
  const free = await req(
    'POST',
    '/api/appointments',
    booking({ services: [], otherRequest: 'Voyant moteur allumé', time: '10:00', customer: { name: 'Y', phone: '0600000002', email: 'y@example.com' } })
  );
  assert.equal(free.status, 201);
});

test('le champ anti-robot n’enregistre rien', async () => {
  const before = (await req('GET', `/api/slots?date=${MONDAY}`)).data.slots.find((s) => s.time === '11:00').remaining;
  const res = await req('POST', '/api/appointments', booking({ time: '11:00', website: 'http://spam', customer: { name: 'Z', phone: '0600000003', email: 'z@example.com' } }));
  assert.equal(res.status, 201);
  const after = (await req('GET', `/api/slots?date=${MONDAY}`)).data.slots.find((s) => s.time === '11:00').remaining;
  assert.equal(after, before);
});

let ticketRef;

test('support : création, suivi et réponse du client', async () => {
  const created = await req('POST', '/api/tickets', {
    name: 'Marie Martin',
    email: 'marie@example.com',
    category: 'devis',
    subject: 'Devis embrayage',
    message: 'Bonjour,\nl’embrayage patine.',
    consent: true,
  });
  assert.equal(created.status, 201);
  assert.match(created.data.ref, /^SAV-/);
  ticketRef = created.data.ref;
  assert.equal(created.data.messages[0].body, 'Bonjour,\nl’embrayage patine.');

  assert.equal((await req('POST', '/api/tickets/lookup', { ref: ticketRef, email: 'x@example.com' })).status, 404);
  const reply = await req('POST', '/api/tickets/reply', { ref: ticketRef, email: 'marie@example.com', message: 'Précision : Clio 4' });
  assert.equal(reply.data.messages.length, 2);
  assert.equal((await req('POST', '/api/tickets', { name: 'A', email: 'a@example.com', subject: '', message: 'x', consent: true })).status, 400);
});

test('espace administration', async () => {
  assert.equal((await req('GET', '/api/admin/stats')).status, 401);
  assert.equal((await req('POST', '/api/admin/login', { password: 'mauvais' })).status, 401);
  const login = await req('POST', '/api/admin/login', { password: 'secret-garage' });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  adminCookie = cookie.split(';')[0];

  const stats = await admin('GET', '/api/admin/stats');
  assert.equal(stats.status, 200);
  assert.ok(stats.data.pendingCount >= 2);
  assert.equal(stats.data.openTickets, 1);

  // Confirmer un rendez-vous
  const list = (await admin('GET', '/api/admin/appointments')).data.appointments;
  const pending = list.find((a) => a.status === 'pending');
  const patched = await admin('PATCH', `/api/admin/appointments/${pending.id}`, { status: 'confirmed', adminNote: 'Pièces commandées' });
  assert.equal(patched.data.status, 'confirmed');
  assert.equal((await admin('PATCH', `/api/admin/appointments/${pending.id}`, { status: 'nimporte' })).status, 400);

  // Répondre à une demande de support
  const ticket = (await admin('GET', '/api/admin/tickets')).data.tickets[0];
  const answered = await admin('POST', `/api/admin/tickets/${ticket.id}/messages`, { message: 'Devis : 590 € TTC.' });
  assert.equal(answered.data.status, 'answered');
  const seen = await req('POST', '/api/tickets/lookup', { ref: ticketRef, email: 'marie@example.com' });
  assert.equal(seen.data.messages.at(-1).from, 'garage');
  assert.equal(seen.data.status, 'answered');

  // Modifier les tarifs et horaires
  const { settings } = (await admin('GET', '/api/admin/settings')).data;
  settings.hourlyRates[0].priceTTC = '70,50';
  settings.categories[0].services[0].price = 95;
  settings.openingHours.sat = [];
  const saved = await admin('PUT', '/api/admin/settings', { settings });
  assert.equal(saved.status, 200);
  const config = (await req('GET', '/api/config')).data;
  assert.equal(config.hourlyRates[0].priceTTC, 70.5);
  assert.equal(config.categories[0].services[0].price, 95);
  assert.deepEqual(config.openingHours.sat, []);

  settings.openingHours.mon = [{ open: '18:00', close: '08:00' }];
  assert.equal((await admin('PUT', '/api/admin/settings', { settings })).status, 400);

  // Déconnexion
  await admin('POST', '/api/admin/logout');
  assert.equal((await admin('GET', '/api/admin/stats')).status, 401);
});

test('les données sont enregistrées sur disque', () => {
  const db = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
  assert.ok(db.appointments.length >= 3);
  assert.equal(db.tickets.length, 1);
  assert.equal(db.settings.categories[0].services[0].price, 95);
});
