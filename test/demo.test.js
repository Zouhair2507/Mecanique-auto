'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const S = require('../src/schedule');
const { defaultSettings } = require('../src/defaults');
const { buildDemoData, seedDemo } = require('../src/demo');
const { createApp } = require('../src/app');

const NOW = new Date('2026-11-15T12:00:00Z'); // dimanche 13h00 à Paris
const nowParts = { date: '2026-11-15', minutes: 13 * 60 };

test('les rendez-vous de démo respectent horaires, créneaux et capacité', () => {
  const st = structuredClone(defaultSettings);
  const { appointments, tickets } = buildDemoData(st, nowParts, NOW);
  assert.ok(appointments.length > 30);
  assert.ok(tickets.length >= 5);
  const perSlot = new Map();
  const perDayEmail = new Set();
  for (const a of appointments) {
    assert.equal(a.demo, true);
    const opening = S.dayOpening(st, a.date);
    assert.equal(opening.closedReason, null, `${a.date} est un jour fermé`);
    const t = S.toMinutes(a.time);
    assert.ok(opening.ranges.some((r) => t >= S.toMinutes(r.open) && t + st.booking.slotMinutes <= S.toMinutes(r.close)), `${a.date} ${a.time}`);
    const key = `${a.date} ${a.time}`;
    perSlot.set(key, (perSlot.get(key) || 0) + 1);
    const dayEmail = `${a.date} ${a.customer.email}`;
    assert.ok(!perDayEmail.has(dayEmail), `doublon ${dayEmail}`);
    perDayEmail.add(dayEmail);
    assert.match(a.customer.phone, /^06 39 98 \d{2} \d{2}$/);
    assert.match(a.customer.email, /@example\.com$/);
    if (a.date > nowParts.date) assert.notEqual(a.status, 'done');
  }
  assert.ok([...perSlot.values()].every((n) => n <= st.booking.capacityPerSlot));
  // Il reste des créneaux libres pour de vraies réservations
  const free = S.daySlots(st, '2026-11-16', appointments, nowParts).slots.filter((s) => s.available).length;
  assert.ok(free >= 10);
});

test('seedDemo conserve les données réelles et la suppression ne retire que la démo', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'garage-demo-'));
  const app = createApp({ dataDir, adminPassword: 'demo-pass', now: () => NOW, rateLimits: false });
  const store = app.locals.store;
  store.data.tickets.push({ id: 'reel', ref: 'SAV-REEL22', status: 'open', unread: true, updatedAt: NOW.toISOString(), customer: { email: 'vrai@example.com' }, messages: [] });
  const n = seedDemo(store, { clock: NOW });
  seedDemo(store, { clock: NOW }); // relancer ne duplique pas
  assert.equal(store.data.appointments.length, n.appointments);
  assert.equal(store.data.tickets.length, n.tickets + 1);
  assert.equal(store.settings.closures.length, 1);
  assert.ok(store.settings.announcement);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${base}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'demo-pass' }),
  });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const stats = await (await fetch(`${base}/api/admin/stats`, { headers: { Cookie: cookie } })).json();
  assert.equal(stats.demoAppointments, n.appointments);
  const clear = await fetch(`${base}/api/admin/demo/clear`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(clear.status, 200);
  assert.equal(store.data.appointments.length, 0);
  assert.deepEqual(store.data.tickets.map((t) => t.id), ['reel']);
  server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});
