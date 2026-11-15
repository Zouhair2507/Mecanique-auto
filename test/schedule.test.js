'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/schedule');
const { defaultSettings } = require('../src/defaults');
const { sanitizeSettings } = require('../src/validate');

const settings = () => structuredClone(defaultSettings);

test('dates de Pâques et jours fériés', () => {
  assert.equal(S.easterSunday(2025), '2025-04-20');
  assert.equal(S.easterSunday(2026), '2026-04-05');
  assert.equal(S.easterSunday(2027), '2027-03-28');
  const h = S.frenchHolidays(2026);
  assert.equal(h.get('2026-04-06'), 'Lundi de Pâques');
  assert.equal(h.get('2026-05-14'), 'Ascension');
  assert.equal(h.get('2026-05-25'), 'Lundi de Pentecôte');
  assert.equal(h.get('2026-11-11'), 'Armistice 1918');
  assert.equal(h.size, 11);
});

test('créneaux d’un lundi standard', () => {
  const now = { date: '2026-11-15', minutes: 600 }; // dimanche 10h00
  const day = S.daySlots(settings(), '2026-11-16', [], now);
  assert.equal(day.open, true);
  // 8h00-12h00 (8 créneaux) + 14h00-18h30 (9 créneaux)
  assert.equal(day.slots.length, 17);
  assert.equal(day.slots[0].time, '08:00');
  assert.equal(day.slots.at(-1).time, '18:00');
  assert.ok(day.slots.every((s) => s.available && s.remaining === 2));
});

test('jours fermés, passés, trop lointains, fériés et fermetures', () => {
  const now = { date: '2026-11-15', minutes: 600 };
  const st = settings();
  assert.equal(S.daySlots(st, '2026-11-15', [], now).reason, 'closed_day'); // dimanche
  assert.equal(S.daySlots(st, '2026-11-14', [], now).reason, 'past');
  assert.equal(S.daySlots(st, '2027-03-01', [], now).reason, 'too_far');
  assert.equal(S.daySlots(st, '2026-12-25', [], now).reason, 'holiday');
  st.closures = [{ from: '2026-11-18', to: '2026-11-20', label: 'Congés' }];
  const closed = S.daySlots(st, '2026-11-19', [], now);
  assert.equal(closed.reason, 'closure');
  assert.equal(closed.label, 'Congés');
});

test('capacité par créneau et délai minimum', () => {
  const st = settings();
  const now = { date: '2026-11-16', minutes: 9 * 60 + 10 }; // lundi 9h10
  const appts = [
    { date: '2026-11-16', time: '14:00', status: 'pending' },
    { date: '2026-11-16', time: '14:00', status: 'confirmed' },
    { date: '2026-11-16', time: '14:30', status: 'cancelled' },
  ];
  const day = S.daySlots(st, '2026-11-16', appts, now);
  const slot = (t) => day.slots.find((s) => s.time === t);
  assert.equal(slot('11:00').available, false); // moins de 2 h
  assert.equal(slot('11:30').available, true);
  assert.equal(slot('14:00').available, false); // complet
  assert.equal(slot('14:30').remaining, 2); // les annulations libèrent la place
});

test('statut ouvert / fermé', () => {
  const st = settings();
  assert.deepEqual(S.openStatus(st, { date: '2026-11-16', minutes: 600 }), { open: true, text: 'Ouvert · jusqu’à 12h00' });
  assert.equal(S.openStatus(st, { date: '2026-11-16', minutes: 12 * 60 + 30 }).text, 'Fermé · ouvre aujourd’hui à 14h00');
  assert.equal(S.openStatus(st, { date: '2026-11-15', minutes: 600 }).text, 'Fermé · ouvre demain à 8h00');
  assert.equal(S.openStatus(st, { date: '2026-11-14', minutes: 13 * 60 }).text, 'Fermé · ouvre lundi à 8h00');
  assert.match(S.openStatus(st, { date: '2026-12-25', minutes: 600 }).text, /^Fermé \(Noël \(jour férié\)\)/);
});

test('validation des réglages', () => {
  const clean = sanitizeSettings(settings());
  assert.equal(clean.categories.length, defaultSettings.categories.length);
  const bad = settings();
  bad.openingHours.mon = [{ open: '12:00', close: '08:00' }];
  assert.throws(() => sanitizeSettings(bad), /ouverture doit précéder/);
  const overlap = settings();
  overlap.openingHours.tue = [{ open: '08:00', close: '12:00' }, { open: '11:00', close: '15:00' }];
  assert.throws(() => sanitizeSettings(overlap), /chevauchent/);
  const ids = settings();
  ids.categories[0].services.push({ name: 'Vidange + filtre à huile', price: '12,5', duration: 30 });
  const out = sanitizeSettings(ids);
  const added = out.categories[0].services.at(-1);
  assert.equal(added.id, 'vidange-filtre-a-huile');
  assert.equal(added.price, 12.5);
});
