'use strict';

/**
 * Données de démonstration : clients, rendez-vous et demandes de support FICTIFS.
 * Toutes les dates sont calculées par rapport au jour courant, pour que la démo
 * paraisse toujours « vivante ». Chaque élément porte `demo: true` et peut être
 * supprimé en un clic depuis l'espace garage.
 *
 * Les téléphones sont pris dans la plage 06 39 98 xx xx réservée par l'ARCEP aux
 * œuvres de fiction, et les e-mails utilisent le domaine réservé example.com.
 */

const crypto = require('node:crypto');
const S = require('./schedule');
const { makeRef } = require('./store');

const CUSTOMERS = [
  ['Sophie Laurent', 'sophie.laurent'],
  ['Thomas Girard', 'thomas.girard'],
  ['Nadia Haddad', 'nadia.haddad'],
  ['Julien Moreau', 'julien.moreau'],
  ['Camille Fontaine', 'camille.fontaine'],
  ['Mehdi Bensaïd', 'mehdi.bensaid'],
  ['Élodie Petit', 'elodie.petit'],
  ['Lucas Bernard', 'lucas.bernard'],
  ['Inès Rousseau', 'ines.rousseau'],
  ['Antoine Lefèvre', 'antoine.lefevre'],
  ['Fatima Ouali', 'fatima.ouali'],
  ['Nicolas Garnier', 'nicolas.garnier'],
  ['Manon Chevalier', 'manon.chevalier'],
  ['Yanis Mercier', 'yanis.mercier'],
  ['Claire Dubois', 'claire.dubois'],
  ['Hugo Lambert', 'hugo.lambert'],
  ['Sarah Benoît', 'sarah.benoit'],
  ['Romain Faure', 'romain.faure'],
  ['Aïcha Diallo', 'aicha.diallo'],
  ['Pierre Roche', 'pierre.roche'],
  ['Benjamin Leroy', 'benjamin.leroy'],
  ['Laura Martinez', 'laura.martinez'],
  ['Samir Cherif', 'samir.cherif'],
  ['Julie Morel', 'julie.morel'],
  ['Maxime Fournier', 'maxime.fournier'],
  ['Chloé Gauthier', 'chloe.gauthier'],
  ['Karima Saïdi', 'karima.saidi'],
  ['Alexandre Perrin', 'alexandre.perrin'],
  ['Émilie Robin', 'emilie.robin'],
  ['Vincent Clément', 'vincent.clement'],
  ['Léa Masson', 'lea.masson'],
  ['Rachid Amrani', 'rachid.amrani'],
  ['Océane Henry', 'oceane.henry'],
  ['Florian Roux', 'florian.roux'],
  ['Sabrina Nicolas', 'sabrina.nicolas'],
  ['Kévin Vidal', 'kevin.vidal'],
  ['Mathilde Blanc', 'mathilde.blanc'],
  ['Bilal Kaci', 'bilal.kaci'],
  ['Audrey Guérin', 'audrey.guerin'],
  ['Damien Boyer', 'damien.boyer'],
];

const VEHICLES = [
  ['Peugeot', '208 1.2 PureTech', 'Essence'],
  ['Renault', 'Clio V 1.0 TCe', 'Essence'],
  ['Citroën', 'C3 1.5 BlueHDi', 'Diesel'],
  ['Dacia', 'Sandero Stepway', 'Essence'],
  ['Volkswagen', 'Golf 7 2.0 TDI', 'Diesel'],
  ['Toyota', 'Yaris Hybride', 'Hybride'],
  ['Renault', 'Mégane IV 1.5 dCi', 'Diesel'],
  ['Fiat', '500 1.2', 'Essence'],
  ['Ford', 'Fiesta 1.0 EcoBoost', 'Essence'],
  ['Peugeot', '3008 1.5 BlueHDi', 'Diesel'],
  ['Skoda', 'Octavia 2.0 TDI', 'Diesel'],
  ['Citroën', 'Berlingo 1.6 HDi', 'Diesel'],
  ['Renault', 'Kangoo 1.5 dCi', 'Diesel'],
  ['Opel', 'Corsa F 1.2', 'Essence'],
  ['Dacia', 'Duster 1.5 dCi', 'Diesel'],
  ['Kia', 'Niro Hybride', 'Hybride'],
  ['Renault', 'Captur 1.3 TCe', 'Essence'],
  ['Peugeot', '308 SW 1.5 BlueHDi', 'Diesel'],
  ['Volkswagen', 'Polo 1.0 TSI', 'Essence'],
  ['Citroën', 'C4 Picasso 1.6 HDi', 'Diesel'],
];

// Prestations les plus demandées (plusieurs entrées = plus fréquent)
const POPULAR = [
  'vidange', 'vidange', 'vidange', 'revision', 'revision', 'plaquettes-av', 'plaquettes-av',
  'disques-plaquettes-av', 'diagnostic', 'diagnostic', 'recharge-clim', 'montage-pneu', 'montage-pneu',
  'geometrie', 'batterie', 'distribution', 'precontrole', 'filtre-habitacle', 'amortisseurs-av', 'liquide-frein',
];

const OTHER_REQUESTS = [
  'Bruit de frottement à l’avant droit au freinage.',
  'Voyant moteur orange allumé depuis hier, la voiture roule normalement.',
  'La climatisation ne fait plus de froid.',
  'Vibrations dans le volant au-dessus de 110 km/h.',
  'Démarrage difficile le matin quand il fait froid.',
];

const NOTES = [
  'Je peux déposer la voiture la veille au soir si besoin.',
  'Merci de m’appeler avant toute intervention supplémentaire.',
  'Je dois récupérer le véhicule avant 18h.',
  'Contrôle technique prévu le mois prochain.',
  'Possible d’avoir un véhicule de prêt ?',
];

const ADMIN_NOTES = [
  'Pièces commandées, livraison prévue le matin même.',
  'Client habitué : vérifier aussi l’usure des pneus.',
  'Appeler le client pour valider le devis avant de commencer.',
];

/** Générateur pseudo-aléatoire reproductible (mulberry32) */
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n) => String(n).padStart(2, '0');

function findService(settings, id) {
  for (const c of settings.categories) {
    const s = c.services.find((x) => x.id === id);
    if (s) return s;
  }
  return null;
}

/** Instant ISO correspondant à une date + minutes (approximation suffisante pour la démo) */
function isoAt(dateStr, minutes) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, minutes) - 60 * 60 * 1000).toISOString();
}

/** Fermetures et message d'information de démonstration, selon la saison */
function demoSettingsExtras(today) {
  const year = Number(today.slice(0, 4));
  const xmasYear = today > `${year}-12-26` ? year + 1 : year;
  const closures = [{ from: `${xmasYear}-12-24`, to: `${xmasYear}-12-26`, label: 'Fêtes de fin d’année' }];
  const month = Number(today.slice(5, 7));
  let announcement;
  if (month >= 10 || month <= 1) announcement = 'Pneus hiver : pensez à réserver votre montage avant les premiers froids.';
  else if (month <= 4) announcement = 'Retour des beaux jours : montage de vos pneus été sur rendez-vous.';
  else if (month <= 8) announcement = 'Climatisation qui ne refroidit plus ? Recharge et contrôle sur rendez-vous.';
  else announcement = 'Rentrée : faites contrôler votre véhicule avant l’hiver, devis gratuit.';
  return { closures, announcement };
}

/**
 * Construit les rendez-vous et demandes de démonstration.
 * now = { date, minutes } dans le fuseau du garage ; clock = Date courante.
 */
function buildDemoData(settings, now, clock = new Date(), seed = 2026) {
  const rand = seededRandom(seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const chance = (p) => rand() < p;
  const year = Number(now.date.slice(0, 4));

  const people = CUSTOMERS.map(([name, slug], i) => {
    const [brand, model, fuel] = VEHICLES[i % VEHICLES.length];
    const vYear = year - 1 - Math.floor(rand() * 12);
    const letters = 'ABCDEFGHJKLMNPQRSTVWXYZ';
    const L = () => letters[Math.floor(rand() * letters.length)];
    return {
      name,
      email: `${slug}@example.com`,
      phone: `06 39 98 ${pad(10 + ((i * 7) % 90))} ${pad(Math.floor(rand() * 90) + 10)}`,
      vehicle: {
        brand,
        model,
        year: vYear,
        plate: `${L()}${L()}-${Math.floor(rand() * 900) + 100}-${L()}${L()}`,
        mileage: Math.round(((year - vYear) * (11000 + rand() * 7000)) / 100) * 100,
        fuel,
      },
    };
  });

  // Véhicules cohérents avec les conversations du support
  Object.assign(people[0].vehicle, { brand: 'Renault', model: 'Clio IV 1.5 dCi', year: 2016, mileage: 118000, fuel: 'Diesel' });

  const appointments = [];
  const slotMinutes = settings.booking.slotMinutes;
  const lastVisit = new Map();
  // M. Lefèvre est réservé au scénario « véhicule à l'atelier » ci-dessous
  const regulars = people.filter((p) => p.name !== 'Antoine Lefèvre');

  for (let offset = -21; offset <= 14; offset++) {
    const date = S.addDays(now.date, offset);
    const opening = S.dayOpening(settings, date);
    if (opening.closedReason) continue;

    const times = [];
    for (const r of opening.ranges) {
      for (let t = S.toMinutes(r.open); t + slotMinutes <= S.toMinutes(r.close); t += slotMinutes) times.push(t);
    }
    const isSaturday = S.dayKey(date) === 'sat';
    let count;
    if (offset < 0) count = 1 + Math.floor(rand() * 3);
    else if (offset === 0) count = 4;
    else if (offset <= 5) count = 2 + Math.floor(rand() * 2);
    else count = Math.floor(rand() * 3);
    if (isSaturday) count = Math.min(count, 2);

    // Créneaux distincts, plutôt le matin (heure de dépôt habituelle)
    const chosen = new Set();
    let guard = 0;
    while (chosen.size < Math.min(count, times.length) && guard++ < 200) {
      const morning = times.filter((t) => t < 12 * 60);
      chosen.add(chance(0.65) && morning.length ? pick(morning) : pick(times));
    }

    const usedPeople = new Set();
    const dayIdx = S.dayIndex(date);
    for (const t of [...chosen].sort((a, b) => a - b)) {
      // Un client ne revient pas plus d'une fois par semaine
      let person = null;
      for (let tries = 0; tries < 60 && !person; tries++) {
        const p = pick(regulars);
        const last = lastVisit.get(p.email);
        if (!usedPeople.has(p.email) && (last === undefined || Math.abs(dayIdx - last) >= 21)) person = p;
      }
      if (!person) continue;
      usedPeople.add(person.email);
      lastVisit.set(person.email, dayIdx);

      const nbServices = chance(0.3) ? 2 : chance(0.85) ? 1 : 0;
      const ids = new Set();
      while (ids.size < nbServices) ids.add(pick(POPULAR));
      const services = [...ids]
        .map((id) => findService(settings, id))
        .filter(Boolean)
        .map((s) => ({ id: s.id, name: s.name, price: s.price, priceFrom: s.priceFrom, duration: s.duration }));
      const otherRequest = services.length === 0 || chance(0.12) ? pick(OTHER_REQUESTS) : '';

      let status;
      let cancelledBy;
      if (offset < 0) {
        status = chance(0.1) ? 'cancelled' : 'done';
        if (status === 'cancelled') cancelledBy = chance(0.7) ? 'client' : 'garage';
      } else if (offset === 0) {
        status = t + slotMinutes <= now.minutes ? 'done' : 'confirmed';
      } else if (offset <= 3) {
        status = chance(0.75) ? 'confirmed' : 'pending';
      } else {
        status = chance(0.6) ? 'pending' : 'confirmed';
      }

      const createdDaysBefore = 1 + Math.floor(rand() * 9);
      appointments.push({
        id: crypto.randomUUID(),
        ref: makeRef('RDV', appointments),
        createdAt: isoAt(S.addDays(date, -createdDaysBefore), 8 * 60 + Math.floor(rand() * 12 * 60)),
        date,
        time: S.fromMinutes(t),
        services,
        otherRequest,
        estimate: {
          total: services.reduce((sum, s) => sum + s.price, 0),
          from: services.some((s) => s.priceFrom) || Boolean(otherRequest),
          duration: services.reduce((sum, s) => sum + (s.duration || 0), 0),
        },
        vehicle: { ...person.vehicle },
        customer: { name: person.name, phone: person.phone, email: person.email },
        notes: chance(0.25) ? pick(NOTES) : '',
        status,
        ...(cancelledBy ? { cancelledBy, cancelledAt: isoAt(date, 7 * 60) } : {}),
        adminNote: status !== 'cancelled' && chance(0.15) ? pick(ADMIN_NOTES) : '',
        seen: true,
        demo: true,
      });
    }
  }

  // Une annulation récente par un client, et deux réservations pas encore vues par le garage
  const future = appointments.filter((a) => a.date > now.date && ['pending', 'confirmed'].includes(a.status));
  if (future.length > 3) {
    const c = future[Math.floor(future.length / 2)];
    Object.assign(c, { status: 'cancelled', cancelledBy: 'client', cancelledAt: new Date(clock.getTime() - 5 * 3600e3).toISOString() });
  }
  future
    .filter((a) => a.status === 'pending')
    .slice(-2)
    .forEach((a, i) => {
      a.seen = false;
      a.createdAt = new Date(clock.getTime() - (i + 1) * 95 * 60e3).toISOString();
    });

  // Le 3008 de M. Lefèvre est à l'atelier depuis le dernier jour ouvré
  const antoine = people.find((p) => p.name === 'Antoine Lefèvre');
  const lastDay = appointments.filter((a) => a.date < now.date).map((a) => a.date).sort().at(-1);
  const inWorkshop = appointments.find((a) => a.date === lastDay && a.status === 'done');
  if (inWorkshop) {
    Object.assign(inWorkshop, {
      status: 'confirmed',
      services: [],
      otherRequest: 'Bruit sourd à l’avant gauche au passage des dos-d’âne.',
      estimate: { total: 0, from: true, duration: 0 },
      vehicle: { ...antoine.vehicle },
      customer: { name: antoine.name, phone: antoine.phone, email: antoine.email },
      notes: '',
      adminNote: 'Biellette de barre stabilisatrice AV G à remplacer. Pièce commandée, livraison demain matin.',
    });
  }

  // ------------------------------------------------------------------
  // Demandes de support
  // ------------------------------------------------------------------
  const ago = (hours) => new Date(clock.getTime() - hours * 3600e3).toISOString();
  const person = (name) => people.find((p) => p.name === name);
  const tickets = [];
  const addTicket = (t) => {
    const messages = t.messages.map(([from, body, hoursAgo]) => ({ from, body, at: ago(hoursAgo) }));
    const p = person(t.customer);
    tickets.push({
      id: crypto.randomUUID(),
      ref: makeRef('SAV', tickets),
      createdAt: messages[0].at,
      updatedAt: messages.at(-1).at,
      category: t.category,
      subject: t.subject,
      customer: { name: p.name, email: p.email, phone: t.withPhone ? p.phone : '' },
      appointmentRef: t.appointmentRef || '',
      plate: t.plate || '',
      status: t.status,
      unread: Boolean(t.unread),
      messages,
      demo: true,
    });
  };

  addTicket({
    customer: 'Sophie Laurent',
    category: 'devis',
    subject: 'Devis distribution Clio 4 1.5 dCi',
    plate: people[0].vehicle.plate,
    withPhone: true,
    status: 'open',
    unread: true,
    messages: [
      [
        'client',
        'Bonjour,\nJ’ai une Clio 4 1.5 dCi de 2016 qui arrive à 118 000 km. Le carnet indique qu’il faut changer la courroie de distribution. Pouvez-vous me donner un prix avec la pompe à eau ?\nMerci d’avance.',
        3,
      ],
    ],
  });

  addTicket({
    customer: 'Antoine Lefèvre',
    category: 'suivi',
    subject: 'Suivi réparation Peugeot 3008',
    plate: antoine.vehicle.plate,
    appointmentRef: inWorkshop?.ref,
    withPhone: true,
    status: 'open',
    unread: true,
    messages: [
      ['client', 'Bonjour, j’ai déposé mon 3008 pour le bruit à l’avant. Avez-vous trouvé d’où ça vient ?', 30],
      [
        'garage',
        'Bonjour M. Lefèvre,\nC’est la biellette de barre stabilisatrice avant gauche qui est usée. La pièce arrive demain matin et le véhicule sera prêt en fin de journée. Montant : 89 € TTC pièce et main d’œuvre.',
        26,
      ],
      ['client', 'Parfait, merci ! Je peux passer la récupérer vers 18h ?', 0.7],
    ],
  });

  const toMove = appointments.find((a) => a.status === 'confirmed' && S.dayIndex(a.date) - S.dayIndex(now.date) >= 2 && a.services.length);
  if (toMove) {
    const dayName = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${toMove.date}T00:00:00Z`));
    addTicket({
      customer: toMove.customer.name,
      category: 'rdv',
      subject: `Décaler mon rendez-vous de ${dayName}`,
      appointmentRef: toMove.ref,
      withPhone: true,
      status: 'open',
      unread: false,
      messages: [
        [
          'client',
          `Bonjour,\nJ’ai rendez-vous ${dayName} à ${Number(toMove.time.slice(0, 2))}h${toMove.time.slice(3)} (${toMove.services[0].name.toLowerCase()}) mais j’ai un empêchement. Est-il possible de décaler au samedi matin ?\nBonne journée.`,
          7,
        ],
      ],
    });
  }

  addTicket({
    customer: 'Lucas Bernard',
    category: 'reclamation',
    subject: 'Léger sifflement après changement des plaquettes',
    status: 'answered',
    messages: [
      ['client', 'Bonjour, vous avez changé mes plaquettes avant la semaine dernière et j’entends un léger sifflement au freinage. Est-ce normal ?', 52],
      [
        'garage',
        'Bonjour M. Bernard,\nUn léger bruit peut apparaître pendant le rodage des plaquettes neuves (environ 200 km). S’il persiste au-delà, passez au garage quand vous voulez : nous contrôlons gratuitement, sans rendez-vous.',
        49,
      ],
    ],
  });

  addTicket({
    customer: 'Claire Dubois',
    category: 'facture',
    subject: 'Copie de facture',
    status: 'closed',
    messages: [
      ['client', 'Bonjour, pourriez-vous m’envoyer une copie de la facture de la révision du mois dernier ? Je l’ai égarée.', 120],
      ['garage', 'Bonjour Mme Dubois,\nNous venons de vous l’envoyer par e-mail. Bonne journée !', 118],
    ],
  });

  addTicket({
    customer: 'Inès Rousseau',
    category: 'autre',
    subject: 'Entretien et garantie constructeur',
    status: 'closed',
    messages: [
      ['client', 'Bonjour, ma voiture a 2 ans et est encore sous garantie. Si je fais la révision chez vous et pas chez le concessionnaire, est-ce que je garde la garantie ?', 200],
      [
        'garage',
        'Bonjour Mme Rousseau,\nOui, tout à fait : le règlement européen vous permet de faire l’entretien dans le garage de votre choix. Nous suivons le programme du constructeur, utilisons des pièces de qualité équivalente et tamponnons votre carnet d’entretien.',
        196,
      ],
      ['client', 'Super, merci pour la réponse rapide. Je prends rendez-vous en ligne.', 190],
    ],
  });

  return { appointments, tickets };
}

/**
 * (Ré)génère les données de démonstration dans le stockage.
 * Les rendez-vous et demandes réels (sans `demo: true`) et les réglages sont conservés.
 * Lors d'une première installation, ajoute aussi une fermeture et un message d'exemple.
 */
function seedDemo(store, { timeZone = 'Europe/Paris', clock = new Date() } = {}) {
  const now = S.zonedNow(clock, timeZone);
  const st = store.settings;
  if (!st.closures.length && !st.announcement) Object.assign(st, demoSettingsExtras(now.date));
  const { appointments, tickets } = buildDemoData(st, now, clock, clock.getTime() % 1e6);
  store.data.appointments = store.data.appointments.filter((a) => !a.demo).concat(appointments);
  store.data.tickets = store.data.tickets.filter((t) => !t.demo).concat(tickets);
  store.save();
  return { appointments: appointments.length, tickets: tickets.length };
}

module.exports = { buildDemoData, demoSettingsExtras, seedDemo };
