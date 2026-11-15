'use strict';

const { DAY_KEYS, isValidDate, isValidTime, toMinutes } = require('./schedule');
const { ICONS } = require('./defaults');

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const fail = (msg) => {
  throw new ValidationError(msg);
};

/** Texte nettoyé : supprime les caractères de contrôle, limite la longueur */
function text(value, label, { max = 200, required = false, multiline = false } = {}) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string' && typeof value !== 'number') fail(`${label} : valeur invalide.`);
  let s = String(value);
  s = multiline ? s.replace(/\r\n?/g, '\n').replace(/[^\S\n]+$/gm, '') : s.replace(/\s+/g, ' ');
  // eslint-disable-next-line no-control-regex
  s = s.replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '').trim();
  if (required && !s) fail(`${label} : champ obligatoire.`);
  if (s.length > max) fail(`${label} : ${max} caractères maximum.`);
  return s;
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;
const PHONE_RE = /^\+?[0-9 ().-]{6,20}$/;

function email(value, label = 'E-mail', { required = true } = {}) {
  const s = text(value, label, { max: 120, required }).toLowerCase();
  if (s && !EMAIL_RE.test(s)) fail(`${label} : adresse invalide.`);
  return s;
}

function phone(value, label = 'Téléphone', { required = true } = {}) {
  const s = text(value, label, { max: 20, required });
  if (s && (!PHONE_RE.test(s) || s.replace(/\D/g, '').length < 6)) fail(`${label} : numéro invalide.`);
  return s;
}

function number(value, label, { min = 0, max = 1e6, integer = false } = {}) {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) fail(`${label} : doit être compris entre ${min} et ${max}.`);
  if (integer && !Number.isInteger(n)) fail(`${label} : doit être un nombre entier.`);
  return integer ? n : Math.round(n * 100) / 100;
}

function list(value, label, max) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail(`${label} : liste invalide.`);
  if (value.length > max) fail(`${label} : ${max} éléments maximum.`);
  return value;
}

function slugify(s) {
  return (
    String(s)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'item'
  );
}

/** Garantit des identifiants uniques et valides dans une liste */
function assignIds(items, nameKey, taken = new Set()) {
  for (const item of items) {
    let base = /^[a-z0-9-]{1,40}$/.test(item.id || '') ? item.id : slugify(item[nameKey]);
    let id = base;
    for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
    taken.add(id);
    item.id = id;
  }
  return items;
}

function url(value, label) {
  const s = text(value, label, { max: 500 });
  if (s && !/^https?:\/\/[^\s]+$/i.test(s)) fail(`${label} : doit commencer par http:// ou https://`);
  return s;
}

/** Valide et nettoie l'ensemble des réglages envoyés par l'espace admin */
function sanitizeSettings(input) {
  if (!input || typeof input !== 'object') fail('Réglages invalides.');
  const g = input.garage || {};
  const garage = {
    name: text(g.name, 'Nom du garage', { max: 80, required: true }),
    tagline: text(g.tagline, 'Accroche', { max: 160 }),
    description: text(g.description, 'Présentation', { max: 600, multiline: true }),
    address: text(g.address, 'Adresse', { max: 160 }),
    postalCode: text(g.postalCode, 'Code postal', { max: 12 }),
    city: text(g.city, 'Ville', { max: 80 }),
    phone: phone(g.phone, 'Téléphone du garage', { required: false }),
    email: email(g.email, 'E-mail du garage', { required: false }),
    siret: text(g.siret, 'SIRET', { max: 20 }),
    mapUrl: url(g.mapUrl, 'Lien Google Maps'),
  };

  const hourlyRates = assignIds(
    list(input.hourlyRates, 'Taux horaires', 20).map((r, i) => ({
      id: r?.id,
      label: text(r?.label, `Taux horaire n°${i + 1} – intitulé`, { max: 80, required: true }),
      description: text(r?.description, `Taux horaire n°${i + 1} – description`, { max: 200 }),
      priceTTC: number(r?.priceTTC, `Taux horaire n°${i + 1} – prix`, { min: 0, max: 10000 }),
    })),
    'label'
  );

  const openingHours = {};
  const DAY_FR = { mon: 'Lundi', tue: 'Mardi', wed: 'Mercredi', thu: 'Jeudi', fri: 'Vendredi', sat: 'Samedi', sun: 'Dimanche' };
  for (const key of DAY_KEYS) {
    const ranges = list(input.openingHours?.[key], `Horaires du ${DAY_FR[key]}`, 4).map((r) => {
      if (!isValidTime(r?.open) || !isValidTime(r?.close)) fail(`Horaires du ${DAY_FR[key]} : heure invalide.`);
      if (toMinutes(r.open) >= toMinutes(r.close)) fail(`Horaires du ${DAY_FR[key]} : l’ouverture doit précéder la fermeture.`);
      return { open: r.open, close: r.close };
    });
    ranges.sort((a, b) => a.open.localeCompare(b.open));
    for (let i = 1; i < ranges.length; i++) {
      if (ranges[i].open < ranges[i - 1].close) fail(`Horaires du ${DAY_FR[key]} : les plages se chevauchent.`);
    }
    openingHours[key] = ranges;
  }

  const b = input.booking || {};
  const booking = {
    slotMinutes: number(b.slotMinutes, 'Durée d’un créneau', { min: 10, max: 240, integer: true }),
    capacityPerSlot: number(b.capacityPerSlot, 'Véhicules par créneau', { min: 1, max: 50, integer: true }),
    minNoticeHours: number(b.minNoticeHours, 'Délai minimum', { min: 0, max: 336, integer: true }),
    maxDaysAhead: number(b.maxDaysAhead, 'Réservation à l’avance', { min: 1, max: 365, integer: true }),
    closeOnHolidays: Boolean(b.closeOnHolidays),
  };

  const closures = list(input.closures, 'Fermetures exceptionnelles', 100).map((c) => {
    if (!isValidDate(c?.from) || !isValidDate(c?.to)) fail('Fermeture exceptionnelle : date invalide.');
    if (c.to < c.from) fail('Fermeture exceptionnelle : la date de fin doit suivre la date de début.');
    return { from: c.from, to: c.to, label: text(c.label, 'Fermeture exceptionnelle – motif', { max: 100 }) };
  });
  closures.sort((x, y) => x.from.localeCompare(y.from));

  const serviceIds = new Set();
  const categories = assignIds(
    list(input.categories, 'Catégories', 30).map((c, ci) => {
      const catName = text(c?.name, `Catégorie n°${ci + 1} – nom`, { max: 80, required: true });
      const services = list(c?.services, `Prestations de « ${catName} »`, 100).map((s, si) => ({
        id: s?.id,
        name: text(s?.name, `${catName} – prestation n°${si + 1} – nom`, { max: 120, required: true }),
        description: text(s?.description, `${catName} – prestation n°${si + 1} – description`, { max: 300 }),
        price: number(s?.price, `${catName} – « ${s?.name || si + 1} » – prix`, { min: 0, max: 100000 }),
        priceFrom: Boolean(s?.priceFrom),
        duration: number(s?.duration ?? 0, `${catName} – « ${s?.name || si + 1} » – durée`, { min: 0, max: 2880, integer: true }),
      }));
      return { id: c?.id, name: catName, icon: ICONS.includes(c?.icon) ? c.icon : 'wrench', services };
    }),
    'name'
  );
  for (const c of categories) assignIds(c.services, 'name', serviceIds);

  const faq = list(input.faq, 'FAQ', 50).map((f, i) => ({
    q: text(f?.q, `FAQ n°${i + 1} – question`, { max: 200, required: true }),
    a: text(f?.a, `FAQ n°${i + 1} – réponse`, { max: 2000, required: true, multiline: true }),
  }));

  return {
    garage,
    announcement: text(input.announcement, 'Message d’information', { max: 300 }),
    vatRate: number(input.vatRate ?? 20, 'Taux de TVA', { min: 0, max: 100 }),
    hourlyRates,
    openingHours,
    booking,
    closures,
    categories,
    faq,
  };
}

module.exports = { ValidationError, fail, text, email, phone, number, list, sanitizeSettings, slugify };
