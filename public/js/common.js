/* Fonctions partagées par toutes les pages du site */
(function () {
  'use strict';

  // ---------- Icônes (SVG en ligne, aucune dépendance) ----------
  const ICONS = {
    wrench:
      '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    oil: '<path d="M12 2.8S5.8 9.6 5.8 14.2a6.2 6.2 0 0 0 12.4 0C18.2 9.6 12 2.8 12 2.8z"/><path d="M9.2 14.6a2.9 2.9 0 0 0 2.8 2.7"/>',
    brake:
      '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="6.3" r=".5"/><circle cx="17.7" cy="12" r=".5"/><circle cx="12" cy="17.7" r=".5"/><circle cx="6.3" cy="12" r=".5"/>',
    tire: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/><path d="M12 7v3.8M16.75 10.45l-3.6 1.17M14.94 16.05l-2.22-3.08M9.06 16.05l2.22-3.08M7.25 10.45l3.6 1.17"/>',
    snow: '<path d="M12 2v20M4.2 6.5l15.6 9M4.2 17.5l15.6-9"/><path d="M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5M3.4 10l3.4.9-.9 3.4M20.6 14l-3.4-.9.9-3.4M5.9 9.7l.9 3.4-3.4.9M18.1 14.3l-.9-3.4 3.4-.9"/>',
    bolt: '<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/>',
    spring: '<path d="M6 3h12M6 21h12"/><path d="M8 6.5l8 2.5-8 2.5 8 2.5-8 2.5"/>',
    car: '<path d="M5 17H3.8a.8.8 0 0 1-.8-.8V13l2.1-5.2A2 2 0 0 1 7 6.5h10a2 2 0 0 1 1.9 1.3L21 13v3.2a.8.8 0 0 1-.8.8H19"/><path d="M3 13h18M9 17h6"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    phone:
      '<path d="M5.1 3.5h3.6l1.8 4.6-2.3 1.4a10.8 10.8 0 0 0 6.3 6.3l1.4-2.3 4.6 1.8v3.6a1.8 1.8 0 0 1-1.9 1.8A16.4 16.4 0 0 1 3.3 5.4a1.8 1.8 0 0 1 1.8-1.9z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    pin: '<path d="M12 21.5s-7-6-7-11.6a7 7 0 0 1 14 0c0 5.6-7 11.6-7 11.6z"/><circle cx="12" cy="9.8" r="2.6"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    shield: '<path d="M12 3 4.5 6v5.6c0 4.6 3.2 8.4 7.5 9.4 4.3-1 7.5-4.8 7.5-9.4V6z"/><path d="m8.8 12 2.3 2.3 4.3-4.6"/>',
    euro: '<path d="M17.5 6.6A7 7 0 1 0 17.5 17.4"/><path d="M4.5 10.2h9M4.5 13.8h9"/>',
    chat: '<path d="M20.5 11.6a8.1 8.1 0 0 1-11.8 7.2L3.5 20.5l1.6-4.9a8.1 8.1 0 1 1 15.4-4z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    chevronLeft: '<path d="m14.5 6-6 6 6 6"/>',
    chevronRight: '<path d="m9.5 6 6 6-6 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>',
    alert: '<path d="M10.3 4.1 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17v.1"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4.5 7h15M10 11v6M14 11v6M6 7l1 12.5a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4L18 7M9 7V4.5h6V7"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    logout: '<path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15M10 16.5 14.5 12 10 7.5M14.5 12H4"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
    send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  };

  function icon(name, cls) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', `icon${cls ? ` ${cls}` : ''}`);
    svg.innerHTML = ICONS[name] || ICONS.wrench; // chaînes statiques internes uniquement
    return svg;
  }

  // ---------- Création d'éléments DOM (sans innerHTML pour les données) ----------
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    let deferredValue;
    for (const [k, v] of Object.entries(props || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'value') deferredValue = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (typeof v === 'boolean') {
        if (k in el) el[k] = v;
        else el.setAttribute(k, '');
      } else el.setAttribute(k, v);
    }
    for (const c of children.flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      el.append(c instanceof Node ? c : String(c));
    }
    if (deferredValue !== undefined) el.value = deferredValue;
    return el;
  }

  // ---------- Appels à l'API ----------
  async function request(method, url, body) {
    const opts = { method, headers: { Accept: 'application/json' }, credentials: 'same-origin' };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(url, opts);
    } catch {
      throw Object.assign(new Error('Connexion impossible. Vérifiez votre connexion internet.'), { status: 0 });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'Une erreur est survenue.'), { status: res.status, data });
    return data;
  }

  const api = {
    get: (url) => request('GET', url),
    post: (url, body) => request('POST', url, body ?? {}),
    put: (url, body) => request('PUT', url, body ?? {}),
    patch: (url, body) => request('PATCH', url, body ?? {}),
    del: (url) => request('DELETE', url),
  };

  // ---------- Formats ----------
  const DAYS = [
    { key: 'mon', label: 'Lundi', short: 'Lun.' },
    { key: 'tue', label: 'Mardi', short: 'Mar.' },
    { key: 'wed', label: 'Mercredi', short: 'Mer.' },
    { key: 'thu', label: 'Jeudi', short: 'Jeu.' },
    { key: 'fri', label: 'Vendredi', short: 'Ven.' },
    { key: 'sat', label: 'Samedi', short: 'Sam.' },
    { key: 'sun', label: 'Dimanche', short: 'Dim.' },
  ];

  const toUTCDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  };

  const fmt = {
    price(n) {
      const v = Number(n) || 0;
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(v);
    },
    price2(n) {
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
    },
    time(hhmm) {
      const [hh, mm] = String(hhmm).split(':');
      return `${Number(hh)}h${mm}`;
    },
    date(dateStr, opts) {
      return new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
        ...opts,
      }).format(toUTCDate(dateStr));
    },
    dateShort(dateStr) {
      return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
        toUTCDate(dateStr)
      );
    },
    month(monthStr) {
      return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(toUTCDate(`${monthStr}-01`));
    },
    datetime(iso) {
      return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
    },
    duration(min) {
      const m = Number(min) || 0;
      if (!m) return '';
      if (m < 60) return `${m} min`;
      const hh = Math.floor(m / 60);
      const rest = m % 60;
      return rest ? `${hh} h ${String(rest).padStart(2, '0')}` : `${hh} h`;
    },
    ranges(ranges) {
      if (!ranges || !ranges.length) return 'Fermé';
      return ranges.map((r) => `${fmt.time(r.open)} – ${fmt.time(r.close)}`).join(' · ');
    },
    ht(ttc, vat) {
      return (Number(ttc) || 0) / (1 + (Number(vat) || 0) / 100);
    },
  };

  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  /** Regroupe les jours consécutifs ayant les mêmes horaires : « Lun. – Ven. » */
  function groupedHours(openingHours) {
    const groups = [];
    for (const d of DAYS) {
      const text = fmt.ranges(openingHours[d.key]);
      const last = groups[groups.length - 1];
      if (last && last.text === text) last.to = d;
      else groups.push({ from: d, to: d, text });
    }
    return groups.map((g) => ({ label: g.from === g.to ? g.from.short : `${g.from.short} – ${g.to.short}`, text: g.text }));
  }

  function todayKey(todayStr) {
    const idx = (toUTCDate(todayStr).getUTCDay() + 6) % 7;
    return DAYS[idx].key;
  }

  const STATUS_LABELS = {
    pending: 'En attente de confirmation',
    confirmed: 'Confirmé',
    done: 'Terminé',
    cancelled: 'Annulé',
    open: 'En cours de traitement',
    answered: 'Réponse du garage',
    closed: 'Clôturée',
  };

  function badge(status, labels = STATUS_LABELS) {
    return h('span', { class: `badge badge-${status}`, text: labels[status] || status });
  }

  function alertBox(type, message) {
    const iconName = type === 'success' ? 'check' : type === 'error' ? 'alert' : 'info';
    return h('div', { class: `alert alert-${type}`, role: type === 'error' ? 'alert' : 'status' }, icon(iconName), h('div', null, message));
  }

  // ---------- En-tête, pied de page ----------
  const NAV = [
    { href: '/#tarifs', label: 'Tarifs', page: 'tarifs' },
    { href: '/#taux-horaires', label: 'Taux horaires', page: 'taux' },
    { href: '/#horaires', label: 'Horaires', page: 'horaires' },
    { href: '/rendez-vous', label: 'Rendez-vous', page: 'booking' },
    { href: '/support', label: 'Support', page: 'support' },
  ];

  function renderHeader(page) {
    const mount = document.getElementById('site-header');
    if (!mount) return;
    const toggle = h(
      'button',
      { class: 'nav-toggle', type: 'button', 'aria-label': 'Ouvrir le menu', 'aria-expanded': 'false', 'aria-controls': 'nav-panel' },
      icon('menu')
    );
    const header = h(
      'header',
      { class: 'site-header' },
      h(
        'div',
        { class: 'container header-inner' },
        h(
          'a',
          { class: 'brand', href: '/' },
          h('span', { class: 'brand-mark' }, icon('wrench')),
          h('span', { class: 'brand-text' }, h('span', { class: 'brand-name', 'data-bind': 'name' }), h('span', { class: 'brand-tag', 'data-bind': 'tagline' }))
        ),
        toggle,
        h(
          'div',
          { class: 'nav-panel', id: 'nav-panel' },
          h(
            'nav',
            { class: 'main-nav', 'aria-label': 'Navigation principale' },
            NAV.map((n) => h('a', { href: n.href, 'aria-current': n.page === page ? 'page' : null, text: n.label }))
          ),
          h(
            'div',
            { class: 'header-actions' },
            h('a', { class: 'header-phone', href: '#', 'data-bind': 'phone-link' }, icon('phone'), h('span', { 'data-bind': 'phone' })),
            h('a', { class: 'btn btn-primary btn-sm', href: '/rendez-vous' }, icon('calendar'), 'Prendre RDV')
          )
        )
      )
    );
    toggle.addEventListener('click', () => {
      const open = header.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.replaceChildren(icon(open ? 'close' : 'menu'));
    });
    header.querySelectorAll('.main-nav a').forEach((a) =>
      a.addEventListener('click', () => {
        header.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.replaceChildren(icon('menu'));
      })
    );
    mount.replaceWith(header);
  }

  function telHref(phone) {
    return `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;
  }

  function fullAddress(g) {
    return [g.address, [g.postalCode, g.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  }

  function mapHref(g) {
    return g.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${g.name} ${fullAddress(g)}`)}`;
  }

  function applyBindings(config) {
    const g = config.garage;
    document.querySelectorAll('[data-bind]').forEach((el) => {
      const key = el.dataset.bind;
      if (key === 'name') el.textContent = g.name;
      else if (key === 'tagline') el.textContent = g.tagline;
      else if (key === 'phone') el.textContent = g.phone;
      else if (key === 'phone-link') {
        el.href = telHref(g.phone);
        el.classList.toggle('hidden', !g.phone);
      } else if (key === 'email') el.textContent = g.email;
      else if (key === 'email-link') el.href = `mailto:${g.email}`;
      else if (key === 'address') el.textContent = fullAddress(g);
      else if (key === 'siret') el.textContent = g.siret || '[à compléter]';
    });
  }

  function renderAnnouncement(config) {
    if (!config.announcement) return;
    const bar = h('div', { class: 'announcement', role: 'note' }, config.announcement);
    document.body.prepend(bar);
  }

  function renderFooter(config) {
    const mount = document.getElementById('site-footer');
    if (!mount) return;
    const g = config.garage;
    const year = config.today.slice(0, 4);
    const footer = h(
      'footer',
      { class: 'site-footer' },
      h(
        'div',
        { class: 'container' },
        h(
          'div',
          { class: 'footer-grid' },
          h(
            'div',
            null,
            h(
              'a',
              { class: 'brand', href: '/' },
              h('span', { class: 'brand-mark' }, icon('wrench')),
              h('span', { class: 'brand-text' }, h('span', { class: 'brand-name', text: g.name }), h('span', { class: 'brand-tag', text: g.tagline }))
            ),
            h('p', { text: g.description })
          ),
          h(
            'div',
            null,
            h('h4', { text: 'Horaires' }),
            h(
              'ul',
              { class: 'footer-hours' },
              groupedHours(config.openingHours).map((gr) =>
                h('li', null, h('span', { text: gr.label }), h('span', null, gr.text.split(' · ').map((t) => h('span', { class: 'fh-range', text: t }))))
              )
            )
          ),
          h(
            'div',
            null,
            h('h4', { text: 'Contact' }),
            h(
              'ul',
              null,
              fullAddress(g) && h('li', null, h('a', { href: mapHref(g), target: '_blank', rel: 'noopener', text: fullAddress(g) })),
              g.phone && h('li', null, h('a', { href: telHref(g.phone), text: g.phone })),
              g.email && h('li', null, h('a', { href: `mailto:${g.email}`, text: g.email }))
            )
          ),
          h(
            'div',
            null,
            h('h4', { text: 'Liens utiles' }),
            h(
              'ul',
              null,
              h('li', null, h('a', { href: '/rendez-vous', text: 'Prendre rendez-vous' })),
              h('li', null, h('a', { href: '/rendez-vous#gerer', text: 'Gérer mon rendez-vous' })),
              h('li', null, h('a', { href: '/support', text: 'Support & FAQ' })),
              h('li', null, h('a', { href: '/mentions-legales', text: 'Mentions légales' })),
              h('li', null, h('a', { href: '/admin', text: 'Espace garage', rel: 'nofollow' }))
            )
          )
        ),
        h(
          'div',
          { class: 'footer-bottom' },
          h('span', { text: `© ${year} ${g.name}${g.siret ? ` · SIRET ${g.siret}` : ''}` }),
          h('span', { text: 'Prix affichés TTC, TVA comprise' })
        )
      )
    );
    mount.replaceWith(footer);
  }

  function renderHelpButton(page) {
    if (page === 'support' || page === 'admin') return;
    document.body.append(h('a', { class: 'help-fab', href: '/support' }, icon('chat'), h('span', { class: 'fab-label', text: 'Besoin d’aide ?' })));
  }

  // ---------- Initialisation ----------
  let configPromise = null;
  function loadConfig() {
    configPromise ??= api.get('/api/config');
    return configPromise;
  }

  async function init() {
    const page = document.body.dataset.page;
    renderHeader(page);
    renderHelpButton(page);
    try {
      const config = await loadConfig();
      renderAnnouncement(config);
      renderFooter(config);
      applyBindings(config);
      document.title = document.title.replace('{garage}', config.garage.name);
      return config;
    } catch (err) {
      const main = document.querySelector('main');
      main?.prepend(h('div', { class: 'container', style: null }, alertBox('error', `Impossible de charger les informations du garage : ${err.message}`)));
      throw err;
    }
  }

  window.Garage = {
    icon,
    h,
    api,
    fmt,
    DAYS,
    STATUS_LABELS,
    badge,
    alertBox,
    capitalize,
    groupedHours,
    todayKey,
    telHref,
    fullAddress,
    mapHref,
    loadConfig,
    ready: document.readyState === 'loading' ? new Promise((r) => document.addEventListener('DOMContentLoaded', r)).then(init) : init(),
  };
})();
