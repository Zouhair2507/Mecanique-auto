'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');

const { Store, makeRef, hashPassword, verifyPassword } = require('./store');
const { TICKET_CATEGORIES, FUEL_TYPES, ICONS } = require('./defaults');
const S = require('./schedule');
const V = require('./validate');

const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'done', 'cancelled'];
const TICKET_STATUSES = ['open', 'answered', 'closed'];
const SESSION_COOKIE = 'garage_admin';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Limiteur de requêtes très simple, en mémoire, par adresse IP */
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, windowMs);
  timer.unref();
  return (req, res, next) => {
    const now = Date.now();
    let h = hits.get(req.ip);
    if (!h || h.reset < now) {
      h = { count: 0, reset: now + windowMs };
      hits.set(req.ip, h);
    }
    h.count += 1;
    if (h.count > max) {
      res.set('Retry-After', String(Math.ceil((h.reset - now) / 1000)));
      return res.status(429).json({ error: message || 'Trop de requêtes. Merci de réessayer dans quelques minutes.' });
    }
    next();
  };
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function securityHeaders(_req, res, next) {
  res.set({
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  next();
}

const findService = (settings, id) => {
  for (const c of settings.categories) {
    const s = c.services.find((x) => x.id === id);
    if (s) return s;
  }
  return null;
};

const normRef = (ref) => String(ref || '').trim().toUpperCase();

function publicAppointment(a) {
  return {
    ref: a.ref,
    date: a.date,
    time: a.time,
    status: a.status,
    services: a.services.map((s) => ({ name: s.name, price: s.price, priceFrom: s.priceFrom })),
    otherRequest: a.otherRequest,
    estimate: a.estimate,
    vehicle: { brand: a.vehicle.brand, model: a.vehicle.model, plate: a.vehicle.plate },
    customerName: a.customer.name,
    createdAt: a.createdAt,
  };
}

function publicTicket(t) {
  return {
    ref: t.ref,
    subject: t.subject,
    category: t.category,
    status: t.status,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    customerName: t.customer.name,
    messages: t.messages.map((m) => ({ from: m.from, body: m.body, at: m.at })),
  };
}

/**
 * Crée l'application Express.
 * options : { dataDir, adminPassword, timeZone, now, trustProxy, rateLimits }
 */
function createApp(options = {}) {
  const store = new Store(options.dataDir || path.join(__dirname, '..', 'data')).load();
  const timeZone = options.timeZone || 'Europe/Paris';
  const clock = options.now || (() => new Date());
  const now = () => S.zonedNow(clock(), timeZone);
  const envPasswordHash = options.adminPassword ? hashPassword(options.adminPassword) : null;
  const sessions = new Map();
  const limits = options.rateLimits !== false;
  const limiter = (cfg) => (limits ? rateLimit(cfg) : (_q, _r, n) => n());

  const app = express();
  app.disable('x-powered-by');
  if (options.trustProxy) app.set('trust proxy', 1);
  app.use(securityHeaders);
  app.use('/api', express.json({ limit: '300kb' }));
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  const writeLimiter = limiter({ windowMs: 15 * 60 * 1000, max: 30 });
  const lookupLimiter = limiter({ windowMs: 15 * 60 * 1000, max: 60 });
  const loginLimiter = limiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
  });

  const body = (req) => (req.body && typeof req.body === 'object' ? req.body : {});

  // Anti-spam : champ caché « website » que seuls les robots remplissent
  const isBot = (req) => Boolean(body(req).website);

  // ------------------------------------------------------------------
  // API publique
  // ------------------------------------------------------------------

  app.get('/api/config', (_req, res) => {
    const st = store.settings;
    const n = now();
    res.json({
      ...st,
      ticketCategories: TICKET_CATEGORIES,
      fuelTypes: FUEL_TYPES,
      today: n.date,
      status: S.openStatus(st, n),
      upcomingClosures: S.upcomingClosures(st, n),
    });
  });

  app.get('/api/calendar', (req, res) => {
    const month = String(req.query.month || '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return res.status(400).json({ error: 'Mois invalide.' });
    res.json({ month, days: S.monthCalendar(store.settings, month, store.data.appointments, now()) });
  });

  app.get('/api/slots', (req, res) => {
    const date = String(req.query.date || '');
    if (!S.isValidDate(date)) return res.status(400).json({ error: 'Date invalide.' });
    res.json(S.daySlots(store.settings, date, store.data.appointments, now()));
  });

  app.post('/api/appointments', writeLimiter, (req, res) => {
    const b = body(req);
    if (isBot(req)) return res.status(201).json({ ref: 'RDV-OK' });
    const st = store.settings;

    const ids = [...new Set(V.list(b.services, 'Prestations', 30))];
    const services = ids.map((id) => {
      const s = findService(st, id);
      if (!s) V.fail('Une prestation sélectionnée n’existe plus. Merci de recharger la page.');
      return { id: s.id, name: s.name, price: s.price, priceFrom: s.priceFrom, duration: s.duration };
    });
    const otherRequest = V.text(b.otherRequest, 'Autre demande', { max: 1000, multiline: true });
    if (!services.length && otherRequest.length < 3) {
      V.fail('Choisissez au moins une prestation ou décrivez votre besoin.');
    }

    if (!S.isValidDate(b.date) || !S.isValidTime(b.time)) V.fail('Choisissez une date et un horaire.');
    const v = b.vehicle || {};
    const year = v.year === undefined || v.year === '' || v.year === null ? null : V.number(v.year, 'Année', { min: 1950, max: 2100, integer: true });
    const mileage = v.mileage === undefined || v.mileage === '' || v.mileage === null ? null : V.number(v.mileage, 'Kilométrage', { min: 0, max: 2000000, integer: true });
    const fuel = V.text(v.fuel, 'Carburant', { max: 20 });
    const vehicle = {
      brand: V.text(v.brand, 'Marque', { max: 40, required: true }),
      model: V.text(v.model, 'Modèle', { max: 60, required: true }),
      year,
      plate: V.text(v.plate, 'Immatriculation', { max: 15 }).toUpperCase(),
      mileage,
      fuel: FUEL_TYPES.includes(fuel) ? fuel : '',
    };
    const c = b.customer || {};
    const customer = {
      name: V.text(c.name, 'Nom', { max: 80, required: true }),
      phone: V.phone(c.phone),
      email: V.email(c.email),
    };
    const notes = V.text(b.notes, 'Commentaire', { max: 1500, multiline: true });
    if (b.consent !== true) V.fail('Merci d’accepter l’utilisation de vos données pour traiter votre rendez-vous.');

    const day = S.daySlots(st, b.date, store.data.appointments, now());
    const slot = day.slots.find((s) => s.time === b.time);
    if (!day.open || !slot || !slot.available) {
      return res.status(409).json({ error: 'Ce créneau n’est plus disponible. Merci d’en choisir un autre.' });
    }
    const duplicate = store.data.appointments.find(
      (a) => a.customer.email === customer.email && a.date === b.date && S.ACTIVE_STATUSES.has(a.status)
    );
    if (duplicate) {
      return res.status(409).json({ error: `Vous avez déjà un rendez-vous ce jour-là (référence ${duplicate.ref}).` });
    }

    const appointment = {
      id: crypto.randomUUID(),
      ref: makeRef('RDV', store.data.appointments),
      createdAt: new Date().toISOString(),
      date: b.date,
      time: b.time,
      services,
      otherRequest,
      estimate: {
        total: Math.round(services.reduce((sum, s) => sum + s.price, 0) * 100) / 100,
        from: services.some((s) => s.priceFrom) || Boolean(otherRequest),
        duration: services.reduce((sum, s) => sum + (s.duration || 0), 0),
      },
      vehicle,
      customer,
      notes,
      status: 'pending',
      adminNote: '',
      seen: false,
    };
    store.data.appointments.push(appointment);
    store.save();
    res.status(201).json(publicAppointment(appointment));
  });

  const findAppointment = (b) => {
    const ref = normRef(b.ref);
    const mail = String(b.email || '').trim().toLowerCase();
    return store.data.appointments.find((a) => a.ref === ref && a.customer.email === mail);
  };

  app.post('/api/appointments/lookup', lookupLimiter, (req, res) => {
    const a = findAppointment(body(req));
    if (!a) return res.status(404).json({ error: 'Aucun rendez-vous ne correspond à cette référence et cette adresse e-mail.' });
    res.json(publicAppointment(a));
  });

  app.post('/api/appointments/cancel', lookupLimiter, (req, res) => {
    const a = findAppointment(body(req));
    if (!a) return res.status(404).json({ error: 'Aucun rendez-vous ne correspond à cette référence et cette adresse e-mail.' });
    if (!S.ACTIVE_STATUSES.has(a.status)) return res.status(409).json({ error: 'Ce rendez-vous ne peut plus être annulé.' });
    const n = now();
    if (S.dayIndex(a.date) * 1440 + S.toMinutes(a.time) <= S.dayIndex(n.date) * 1440 + n.minutes) {
      return res.status(409).json({ error: 'Ce rendez-vous est déjà passé.' });
    }
    a.status = 'cancelled';
    a.cancelledAt = new Date().toISOString();
    a.cancelledBy = 'client';
    a.seen = false;
    store.save();
    res.json(publicAppointment(a));
  });

  app.post('/api/tickets', writeLimiter, (req, res) => {
    const b = body(req);
    if (isBot(req)) return res.status(201).json({ ref: 'SAV-OK' });
    const category = TICKET_CATEGORIES.some((c) => c.id === b.category) ? b.category : 'autre';
    const customer = {
      name: V.text(b.name, 'Nom', { max: 80, required: true }),
      email: V.email(b.email),
      phone: V.phone(b.phone, 'Téléphone', { required: false }),
    };
    const subject = V.text(b.subject, 'Objet', { max: 120, required: true });
    const message = V.text(b.message, 'Message', { max: 4000, required: true, multiline: true });
    const appointmentRef = V.text(b.appointmentRef, 'Référence de rendez-vous', { max: 20 }).toUpperCase();
    const plate = V.text(b.plate, 'Immatriculation', { max: 15 }).toUpperCase();
    if (b.consent !== true) V.fail('Merci d’accepter l’utilisation de vos données pour traiter votre demande.');

    const at = new Date().toISOString();
    const ticket = {
      id: crypto.randomUUID(),
      ref: makeRef('SAV', store.data.tickets),
      createdAt: at,
      updatedAt: at,
      category,
      subject,
      customer,
      appointmentRef,
      plate,
      status: 'open',
      unread: true,
      messages: [{ from: 'client', body: message, at }],
    };
    store.data.tickets.push(ticket);
    store.save();
    res.status(201).json(publicTicket(ticket));
  });

  const findTicket = (b) => {
    const ref = normRef(b.ref);
    const mail = String(b.email || '').trim().toLowerCase();
    return store.data.tickets.find((t) => t.ref === ref && t.customer.email === mail);
  };

  app.post('/api/tickets/lookup', lookupLimiter, (req, res) => {
    const t = findTicket(body(req));
    if (!t) return res.status(404).json({ error: 'Aucune demande ne correspond à cette référence et cette adresse e-mail.' });
    res.json(publicTicket(t));
  });

  app.post('/api/tickets/reply', writeLimiter, (req, res) => {
    const b = body(req);
    const t = findTicket(b);
    if (!t) return res.status(404).json({ error: 'Aucune demande ne correspond à cette référence et cette adresse e-mail.' });
    const message = V.text(b.message, 'Message', { max: 4000, required: true, multiline: true });
    if (t.messages.length >= 200) return res.status(409).json({ error: 'Cette conversation est trop longue, merci d’ouvrir une nouvelle demande.' });
    const at = new Date().toISOString();
    t.messages.push({ from: 'client', body: message, at });
    t.status = 'open';
    t.unread = true;
    t.updatedAt = at;
    store.save();
    res.json(publicTicket(t));
  });

  // ------------------------------------------------------------------
  // Espace administration
  // ------------------------------------------------------------------

  const sessionFrom = (req) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!token) return null;
    const s = sessions.get(token);
    if (!s || s.expires < Date.now()) {
      sessions.delete(token);
      return null;
    }
    return token;
  };

  const requireAdmin = (req, res, next) => {
    if (!sessionFrom(req)) return res.status(401).json({ error: 'Session expirée. Merci de vous reconnecter.' });
    next();
  };

  app.post('/api/admin/login', loginLimiter, (req, res) => {
    const password = String(body(req).password || '');
    const hash = envPasswordHash || store.readAuth().passwordHash;
    if (!hash || !password || !verifyPassword(password, hash)) {
      return res.status(401).json({ error: 'Mot de passe incorrect.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { expires: Date.now() + SESSION_TTL_MS });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: req.secure,
      maxAge: SESSION_TTL_MS,
      path: '/',
    });
    res.json({ ok: true });
  });

  app.post('/api/admin/logout', (req, res) => {
    const token = sessionFrom(req);
    if (token) sessions.delete(token);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  app.use('/api/admin', requireAdmin);

  app.get('/api/admin/me', (_req, res) => res.json({ ok: true }));

  app.get('/api/admin/stats', (_req, res) => {
    const n = now();
    const weekEnd = S.addDays(n.date, 7);
    const active = store.data.appointments.filter((a) => S.ACTIVE_STATUSES.has(a.status));
    res.json({
      today: n.date,
      todayCount: active.filter((a) => a.date === n.date).length,
      pendingCount: active.filter((a) => a.status === 'pending' && a.date >= n.date).length,
      weekCount: active.filter((a) => a.date >= n.date && a.date <= weekEnd).length,
      openTickets: store.data.tickets.filter((t) => t.status === 'open').length,
      unreadTickets: store.data.tickets.filter((t) => t.unread).length,
      unseenAppointments: store.data.appointments.filter((a) => !a.seen).length,
      demoAppointments: store.data.appointments.filter((a) => a.demo).length,
      demoTickets: store.data.tickets.filter((t) => t.demo).length,
    });
  });

  // Supprime d'un coup les rendez-vous et demandes de démonstration
  app.post('/api/admin/demo/clear', (_req, res) => {
    const before = store.data.appointments.length + store.data.tickets.length;
    store.data.appointments = store.data.appointments.filter((a) => !a.demo);
    store.data.tickets = store.data.tickets.filter((t) => !t.demo);
    store.save();
    res.json({ ok: true, removed: before - store.data.appointments.length - store.data.tickets.length });
  });

  app.get('/api/admin/appointments', (_req, res) => {
    const list = [...store.data.appointments].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    res.json({ today: now().date, appointments: list });
  });

  app.post('/api/admin/appointments/mark-seen', (_req, res) => {
    let changed = 0;
    for (const a of store.data.appointments) {
      if (!a.seen) {
        a.seen = true;
        changed += 1;
      }
    }
    if (changed) store.save();
    res.json({ ok: true, changed });
  });

  app.patch('/api/admin/appointments/:id', (req, res) => {
    const a = store.data.appointments.find((x) => x.id === req.params.id);
    if (!a) return res.status(404).json({ error: 'Rendez-vous introuvable.' });
    const b = body(req);
    if (b.status !== undefined) {
      if (!APPOINTMENT_STATUSES.includes(b.status)) V.fail('Statut invalide.');
      if (b.status === 'cancelled' && a.status !== 'cancelled') a.cancelledBy = 'garage';
      a.status = b.status;
    }
    if (b.adminNote !== undefined) a.adminNote = V.text(b.adminNote, 'Note interne', { max: 2000, multiline: true });
    if (b.seen !== undefined) a.seen = Boolean(b.seen);
    store.save();
    res.json(a);
  });

  app.delete('/api/admin/appointments/:id', (req, res) => {
    const i = store.data.appointments.findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'Rendez-vous introuvable.' });
    store.data.appointments.splice(i, 1);
    store.save();
    res.json({ ok: true });
  });

  app.get('/api/admin/tickets', (_req, res) => {
    const list = [...store.data.tickets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    res.json({ tickets: list });
  });

  app.post('/api/admin/tickets/:id/messages', (req, res) => {
    const t = store.data.tickets.find((x) => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: 'Demande introuvable.' });
    const message = V.text(body(req).message, 'Réponse', { max: 4000, required: true, multiline: true });
    const at = new Date().toISOString();
    t.messages.push({ from: 'garage', body: message, at });
    t.status = body(req).close ? 'closed' : 'answered';
    t.unread = false;
    t.updatedAt = at;
    store.save();
    res.json(t);
  });

  app.patch('/api/admin/tickets/:id', (req, res) => {
    const t = store.data.tickets.find((x) => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: 'Demande introuvable.' });
    const b = body(req);
    if (b.status !== undefined) {
      if (!TICKET_STATUSES.includes(b.status)) V.fail('Statut invalide.');
      t.status = b.status;
    }
    if (b.unread !== undefined) t.unread = Boolean(b.unread);
    store.save();
    res.json(t);
  });

  app.delete('/api/admin/tickets/:id', (req, res) => {
    const i = store.data.tickets.findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'Demande introuvable.' });
    store.data.tickets.splice(i, 1);
    store.save();
    res.json({ ok: true });
  });

  app.get('/api/admin/settings', (_req, res) => {
    res.json({ settings: store.settings, icons: ICONS });
  });

  app.put('/api/admin/settings', (req, res) => {
    store.settings = V.sanitizeSettings(body(req).settings);
    res.json({ settings: store.settings });
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ressource introuvable.' }));

  // ------------------------------------------------------------------
  // Pages du site
  // ------------------------------------------------------------------

  app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'], maxAge: '1h' }));
  app.use((_req, res) => res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html')));

  // Gestion des erreurs
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof V.ValidationError) return res.status(400).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Requête invalide.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Contenu trop volumineux.' });
    console.error(err);
    res.status(500).json({ error: 'Erreur interne. Merci de réessayer.' });
  });

  app.locals.store = store;
  return app;
}

module.exports = { createApp };
