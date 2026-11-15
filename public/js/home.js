/* Page d'accueil : statut, tarifs des prestations, taux horaires, horaires */
(function () {
  'use strict';
  const { h, icon, fmt, DAYS } = Garage;

  function renderStatus(config) {
    const pill = document.getElementById('open-status');
    pill.classList.toggle('is-open', config.status.open);
    pill.replaceChildren(h('span', { class: 'status-dot' }), h('span', { text: config.status.text }));
  }

  function renderTrust() {
    const items = ['Devis gratuit', 'Prix affichés TTC', 'Toutes marques', 'Garantie constructeur préservée'];
    document.getElementById('trust-list').replaceChildren(...items.map((t) => h('li', null, icon('check'), t)));
  }

  function renderHeroCard(config) {
    document.getElementById('hero-card-title').replaceChildren(icon('euro'), 'Nos taux horaires');
    document.getElementById('hero-rates').replaceChildren(
      ...config.hourlyRates.map((r) =>
        h('div', { class: 'rate-mini' }, h('span', { text: r.label }), h('strong', { text: `${fmt.price(r.priceTTC)} TTC/h` }))
      )
    );
    const key = Garage.todayKey(config.today);
    document.getElementById('hero-today-title').replaceChildren(icon('clock'), 'Aujourd’hui');
    const closure = config.upcomingClosures.find((c) => c.from <= config.today && config.today <= c.to);
    document.getElementById('hero-today').textContent = closure ? `Fermé — ${closure.label}` : fmt.ranges(config.openingHours[key]);
    if (config.garage.description) document.getElementById('hero-lead').textContent = config.garage.description;
  }

  function priceCell(service) {
    return h(
      'div',
      { class: 'price' },
      service.priceFrom && h('span', { class: 'price-from', text: 'à partir de' }),
      h('span', { class: 'price-tag', text: fmt.price(service.price) })
    );
  }

  function renderPrices(config) {
    const grid = document.getElementById('price-grid');
    const filters = document.getElementById('category-filters');
    const cards = config.categories
      .filter((c) => c.services.length)
      .map((cat) =>
        h(
          'article',
          { class: 'card', dataset: { category: cat.id } },
          h(
            'header',
            { class: 'price-cat-head' },
            h('span', { class: 'cat-icon' }, icon(cat.icon)),
            h('h3', { text: cat.name }),
            h('span', { class: 'count', text: `${cat.services.length} prestation${cat.services.length > 1 ? 's' : ''}` })
          ),
          h(
            'ul',
            { class: 'price-list' },
            cat.services.map((s) =>
              h(
                'li',
                { class: 'price-row' },
                h('span', { class: 'name', text: s.name }),
                priceCell(s),
                s.description && h('span', { class: 'desc', text: s.description }),
                h(
                  'span',
                  { class: 'meta' },
                  s.duration ? h('span', null, icon('clock'), `env. ${fmt.duration(s.duration)}`) : null,
                  h('a', { class: 'book-link', href: `/rendez-vous?service=${encodeURIComponent(s.id)}`, text: 'Réserver →' })
                )
              )
            )
          )
        )
      );
    grid.replaceChildren(...cards);

    const setFilter = (id) => {
      filters.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
      cards.forEach((c) => c.classList.toggle('hidden', id !== 'all' && c.dataset.category !== id));
    };
    const chip = (id, label, iconName) =>
      h('button', { type: 'button', class: 'chip', dataset: { id }, 'aria-pressed': 'false', onclick: () => setFilter(id) }, iconName && icon(iconName), label);
    filters.replaceChildren(
      chip('all', 'Toutes'),
      ...config.categories.filter((c) => c.services.length).map((c) => chip(c.id, c.name, c.icon))
    );
    setFilter('all');

    document
      .getElementById('price-note')
      .replaceChildren(
        icon('info'),
        h(
          'span',
          null,
          'Prix indicatifs TTC (TVA ',
          String(config.vatRate).replace('.', ','),
          ' % incluse) pour un véhicule de tourisme courant. Les prix « à partir de » varient selon la marque, le modèle et la motorisation. Votre prestation n’est pas listée ? ',
          h('a', { href: '/support?sujet=devis', text: 'Demandez un devis gratuit' }),
          '.'
        )
      );
  }

  function renderRates(config) {
    document.getElementById('rates').replaceChildren(
      ...config.hourlyRates.map((r) =>
        h(
          'article',
          { class: 'card rate-card' },
          h('h3', { text: r.label }),
          h('p', { class: 'rate-desc', text: r.description }),
          h('div', { class: 'rate-price' }, h('span', { class: 'amount', text: fmt.price(r.priceTTC) }), h('span', { class: 'unit', text: 'TTC / heure' })),
          h('div', { class: 'rate-ht', text: `soit ${fmt.price2(fmt.ht(r.priceTTC, config.vatRate))} HT / heure` })
        )
      )
    );
  }

  function renderHours(config) {
    const key = Garage.todayKey(config.today);
    document.querySelector('#hours-table tbody').replaceChildren(
      ...DAYS.map((d) => {
        const ranges = config.openingHours[d.key];
        return h(
          'tr',
          { class: d.key === key ? 'today' : null },
          h('th', { scope: 'row', text: d.label }),
          h('td', { class: ranges.length ? null : 'closed', text: fmt.ranges(ranges) })
        );
      })
    );

    if (config.upcomingClosures.length) {
      document.getElementById('closures-card').classList.remove('hidden');
      document.getElementById('closures-list').replaceChildren(
        ...config.upcomingClosures.map((c) =>
          h(
            'li',
            null,
            h('strong', { text: c.from === c.to ? Garage.capitalize(fmt.date(c.from)) : `Du ${fmt.dateShort(c.from)} au ${fmt.dateShort(c.to)}` }),
            h('br'),
            h('span', { class: 'muted', text: c.label })
          )
        )
      );
    }

    const g = config.garage;
    const address = Garage.fullAddress(g);
    document.getElementById('contact-lines').replaceChildren(
      address && h('li', null, icon('pin'), h('a', { href: Garage.mapHref(g), target: '_blank', rel: 'noopener', text: address })),
      g.phone && h('li', null, icon('phone'), h('a', { href: Garage.telHref(g.phone), text: g.phone })),
      g.email && h('li', null, icon('mail'), h('a', { href: `mailto:${g.email}`, text: g.email })),
      h('li', null, icon('chat'), h('a', { href: '/support', text: 'Ouvrir une demande de support' }))
    );
  }

  Garage.ready
    .then((config) => {
      renderStatus(config);
      renderTrust();
      renderHeroCard(config);
      renderPrices(config);
      renderRates(config);
      renderHours(config);
      if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
    })
    .catch(() => {});
})();
