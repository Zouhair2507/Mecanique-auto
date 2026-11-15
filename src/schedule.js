'use strict';

/**
 * Calculs liés au calendrier : jours fériés, horaires, créneaux disponibles,
 * statut « ouvert / fermé ». Les dates sont manipulées sous forme de chaînes
 * « AAAA-MM-JJ » et les heures en minutes depuis minuit, dans le fuseau du garage.
 */

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABELS = {
  mon: 'lundi',
  tue: 'mardi',
  wed: 'mercredi',
  thu: 'jeudi',
  fri: 'vendredi',
  sat: 'samedi',
  sun: 'dimanche',
};
const ACTIVE_STATUSES = new Set(['pending', 'confirmed']);

const pad = (n) => String(n).padStart(2, '0');

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(min) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

/** 8:00 -> « 8h00 », style français */
function frTime(hhmm) {
  const [h, m] = hhmm.split(':');
  return `${Number(h)}h${m}`;
}

function dayIndex(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

function fromDayIndex(idx) {
  const d = new Date(idx * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function addDays(dateStr, n) {
  return fromDayIndex(dayIndex(dateStr) + n);
}

function dayKey(dateStr) {
  return DAY_KEYS[new Date(dayIndex(dateStr) * 86400000).getUTCDay()];
}

function isValidDate(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  return fromDayIndex(dayIndex(dateStr)) === dateStr;
}

function isValidTime(t) {
  return typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

/** Date et heure courantes dans le fuseau du garage */
function zonedNow(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

/** Dimanche de Pâques (algorithme de Meeus / Jones / Butcher) */
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

const holidayCache = new Map();

/** Jours fériés en France métropolitaine : Map date -> nom */
function frenchHolidays(year) {
  if (holidayCache.has(year)) return holidayCache.get(year);
  const easter = easterSunday(year);
  const list = [
    [`${year}-01-01`, 'Jour de l’an'],
    [addDays(easter, 1), 'Lundi de Pâques'],
    [`${year}-05-01`, 'Fête du Travail'],
    [`${year}-05-08`, 'Victoire 1945'],
    [addDays(easter, 39), 'Ascension'],
    [addDays(easter, 50), 'Lundi de Pentecôte'],
    [`${year}-07-14`, 'Fête nationale'],
    [`${year}-08-15`, 'Assomption'],
    [`${year}-11-01`, 'Toussaint'],
    [`${year}-11-11`, 'Armistice 1918'],
    [`${year}-12-25`, 'Noël'],
  ];
  const map = new Map(list);
  holidayCache.set(year, map);
  return map;
}

function holidayName(dateStr) {
  return frenchHolidays(Number(dateStr.slice(0, 4))).get(dateStr) || null;
}

/**
 * Horaires d'un jour donné, en tenant compte des fermetures et jours fériés.
 * Retourne { ranges: [{open, close}], closedReason, label }.
 */
function dayOpening(settings, dateStr) {
  const closure = (settings.closures || []).find((c) => c.from <= dateStr && dateStr <= c.to);
  if (closure) return { ranges: [], closedReason: 'closure', label: closure.label || 'Fermeture exceptionnelle' };
  if (settings.booking?.closeOnHolidays) {
    const name = holidayName(dateStr);
    if (name) return { ranges: [], closedReason: 'holiday', label: `${name} (jour férié)` };
  }
  const ranges = settings.openingHours?.[dayKey(dateStr)] || [];
  if (!ranges.length) return { ranges: [], closedReason: 'closed_day', label: 'Fermé' };
  return { ranges, closedReason: null, label: null };
}

/**
 * Créneaux d'une journée pour la prise de rendez-vous.
 * now = { date, minutes } (fuseau du garage)
 */
function daySlots(settings, dateStr, appointments, now) {
  const b = settings.booking;
  const today = dayIndex(now.date);
  const idx = dayIndex(dateStr);
  const base = { date: dateStr, open: false, reason: null, label: null, slots: [] };

  if (idx < today) return { ...base, reason: 'past', label: 'Date passée' };
  if (idx > today + b.maxDaysAhead) {
    return { ...base, reason: 'too_far', label: `Réservation possible jusqu’à ${b.maxDaysAhead} jours à l’avance` };
  }
  const opening = dayOpening(settings, dateStr);
  if (opening.closedReason) return { ...base, reason: opening.closedReason, label: opening.label };

  const booked = new Map();
  for (const a of appointments) {
    if (a.date === dateStr && ACTIVE_STATUSES.has(a.status)) booked.set(a.time, (booked.get(a.time) || 0) + 1);
  }

  const earliest = today * 1440 + now.minutes + b.minNoticeHours * 60;
  const slots = [];
  opening.ranges.forEach((r, rangeIndex) => {
    const start = toMinutes(r.open);
    const end = toMinutes(r.close);
    for (let t = start; t + b.slotMinutes <= end; t += b.slotMinutes) {
      const time = fromMinutes(t);
      const remaining = Math.max(0, b.capacityPerSlot - (booked.get(time) || 0));
      const inTime = idx * 1440 + t >= earliest;
      slots.push({ time, period: rangeIndex, available: inTime && remaining > 0, remaining: inTime ? remaining : 0 });
    }
  });
  const anyFree = slots.some((s) => s.available);
  return { ...base, open: true, reason: anyFree ? null : 'full', label: anyFree ? null : 'Complet', slots };
}

/** Statut de chaque jour d'un mois (« AAAA-MM ») pour le calendrier de réservation */
function monthCalendar(settings, month, appointments, now) {
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${y}-${pad(m)}-${pad(d)}`;
    const info = daySlots(settings, date, appointments, now);
    let status;
    if (!info.open) status = info.reason === 'past' ? 'past' : info.reason === 'too_far' ? 'unavailable' : 'closed';
    else status = info.reason === 'full' ? 'full' : 'available';
    days.push({ date, status, label: info.label, free: info.slots.filter((s) => s.available).length });
  }
  return days;
}

function relativeDayLabel(dateStr, todayStr) {
  const diff = dayIndex(dateStr) - dayIndex(todayStr);
  if (diff === 0) return 'aujourd’hui';
  if (diff === 1) return 'demain';
  const key = dayKey(dateStr);
  if (diff < 7) return DAY_LABELS[key];
  const [, mm, dd] = dateStr.split('-');
  return `le ${DAY_LABELS[key]} ${Number(dd)}/${mm}`;
}

/** Statut « ouvert / fermé » affiché sur le site */
function openStatus(settings, now) {
  const today = dayOpening(settings, now.date);
  for (const r of today.ranges) {
    if (now.minutes >= toMinutes(r.open) && now.minutes < toMinutes(r.close)) {
      return { open: true, text: `Ouvert · jusqu’à ${frTime(r.close)}` };
    }
  }
  const closedToday = today.closedReason && today.closedReason !== 'closed_day' ? today.label : null;
  for (let i = 0; i < 31; i++) {
    const date = addDays(now.date, i);
    const { ranges } = i === 0 ? today : dayOpening(settings, date);
    const next = ranges.find((r) => i > 0 || toMinutes(r.open) > now.minutes);
    if (next) {
      const prefix = closedToday ? `Fermé (${closedToday})` : 'Fermé';
      return { open: false, text: `${prefix} · ouvre ${relativeDayLabel(date, now.date)} à ${frTime(next.open)}` };
    }
  }
  return { open: false, text: 'Fermé' };
}

/** Fermetures et jours fériés à venir (pour information) */
function upcomingClosures(settings, now, days = 45) {
  const end = addDays(now.date, days);
  const out = [];
  for (const c of settings.closures || []) {
    if (c.to >= now.date && c.from <= end) out.push({ from: c.from, to: c.to, label: c.label || 'Fermeture exceptionnelle' });
  }
  if (settings.booking?.closeOnHolidays) {
    for (let i = 0; i <= days; i++) {
      const date = addDays(now.date, i);
      const name = holidayName(date);
      const normallyOpen = (settings.openingHours?.[dayKey(date)] || []).length > 0;
      if (name && normallyOpen && !out.some((c) => c.from <= date && date <= c.to)) {
        out.push({ from: date, to: date, label: `${name} (jour férié)` });
      }
    }
  }
  return out.sort((a, b) => a.from.localeCompare(b.from));
}

module.exports = {
  DAY_KEYS,
  ACTIVE_STATUSES,
  toMinutes,
  fromMinutes,
  dayIndex,
  addDays,
  dayKey,
  isValidDate,
  isValidTime,
  zonedNow,
  easterSunday,
  frenchHolidays,
  holidayName,
  dayOpening,
  daySlots,
  monthCalendar,
  openStatus,
  upcomingClosures,
};
