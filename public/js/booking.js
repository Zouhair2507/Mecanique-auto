/* Page Rendez-vous : réservation en 4 étapes + gestion d'un rendez-vous existant */
(function () {
  'use strict';
  const { h, icon, fmt, api, alertBox } = Garage;

  const state = { step: 0, services: new Set(), date: null, time: null, month: null, sending: false };
  let config = null;
  let calendarStarted = false;

  const $ = (id) => document.getElementById(id);
  const form = $('booking-form');
  const panels = [...form.querySelectorAll('[data-step]')];
  const stepperItems = [...document.querySelectorAll('#stepper li')];
  const field = (name) => form.elements.namedItem(name);
  const value = (name) => (field(name)?.value || '').trim();

  const pad = (n) => String(n).padStart(2, '0');
  const addDays = (dateStr, n) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  };
  const addMonths = (month, n) => {
    const [y, m] = month.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + n, 1));
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}`;
  };

  function findService(id) {
    for (const c of config.categories) {
      const s = c.services.find((x) => x.id === id);
      if (s) return s;
    }
    return null;
  }

  // ------------------------------------------------------------
  // Étape 1 : prestations
  // ------------------------------------------------------------
  function renderServices() {
    $('service-groups').replaceChildren(
      ...config.categories
        .filter((c) => c.services.length)
        .map((cat) =>
          h(
            'fieldset',
            { class: 'service-group', style: null },
            h('h3', null, h('span', { class: 'cat-icon' }, icon(cat.icon)), cat.name),
            h(
              'div',
              { class: 'service-options' },
              cat.services.map((s) =>
                h(
                  'label',
                  { class: 'service-option' },
                  h('input', {
                    type: 'checkbox',
                    value: s.id,
                    checked: state.services.has(s.id),
                    onchange: (e) => {
                      if (e.target.checked) state.services.add(s.id);
                      else state.services.delete(s.id);
                      clearErrors(0);
                      renderSummary();
                    },
                  }),
                  h(
                    'span',
                    { class: 'so-body' },
                    h('span', { class: 'so-name', text: s.name }),
                    s.duration ? h('span', { class: 'so-meta', text: `Durée env. ${fmt.duration(s.duration)}` }) : null
                  ),
                  h('span', { class: 'so-price' }, s.priceFrom && h('small', { text: 'dès' }), fmt.price(s.price))
                )
              )
            )
          )
        )
    );
  }

  // ------------------------------------------------------------
  // Étape 2 : calendrier et créneaux
  // ------------------------------------------------------------
  const minMonth = () => config.today.slice(0, 7);
  const maxMonth = () => addDays(config.today, config.booking.maxDaysAhead).slice(0, 7);

  async function loadCalendar(month, autoSelect = false) {
    state.month = month;
    const cal = $('calendar');
    cal.setAttribute('aria-busy', 'true');
    try {
      const data = await api.get(`/api/calendar?month=${month}`);
      const available = data.days.filter((d) => d.status === 'available');
      if (autoSelect && !state.date && !available.length && month < maxMonth()) return loadCalendar(addMonths(month, 1), true);
      renderCalendar(data.days);
      if (autoSelect && !state.date && available.length) selectDate(available[0].date);
    } catch (err) {
      cal.replaceChildren(h('div', { class: 'empty-state' }, err.message));
    } finally {
      cal.removeAttribute('aria-busy');
    }
  }

  const DAY_STATUS = {
    available: 'disponible',
    full: 'complet',
    closed: 'fermé',
    past: 'passé',
    unavailable: 'non réservable',
  };

  function renderCalendar(days) {
    const firstDow = (new Date(`${days[0].date}T00:00:00Z`).getUTCDay() + 6) % 7;
    const prev = h(
      'button',
      { type: 'button', class: 'cal-nav', 'aria-label': 'Mois précédent', disabled: state.month <= minMonth(), onclick: () => loadCalendar(addMonths(state.month, -1)) },
      icon('chevronLeft')
    );
    const next = h(
      'button',
      { type: 'button', class: 'cal-nav', 'aria-label': 'Mois suivant', disabled: state.month >= maxMonth(), onclick: () => loadCalendar(addMonths(state.month, 1)) },
      icon('chevronRight')
    );
    $('calendar').replaceChildren(
      h('div', { class: 'cal-head' }, prev, h('strong', { text: fmt.month(state.month) }), next),
      h(
        'div',
        { class: 'cal-grid', role: 'grid' },
        ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => h('div', { class: 'cal-dow', 'aria-hidden': 'true', text: d })),
        Array.from({ length: firstDow }, () => h('span')),
        days.map((d) => {
          const classes = ['cal-day', d.status];
          if (d.date === state.date) classes.push('selected');
          if (d.date === config.today) classes.push('is-today');
          const label = d.label || DAY_STATUS[d.status];
          return h(
            'button',
            {
              type: 'button',
              class: classes.join(' '),
              dataset: { date: d.date },
              disabled: d.status !== 'available',
              title: label ? Garage.capitalize(label) : null,
              'aria-label': `${fmt.date(d.date)}, ${label || ''}`,
              'aria-pressed': d.date === state.date ? 'true' : 'false',
              onclick: () => selectDate(d.date),
            },
            String(Number(d.date.slice(8))),
            d.status === 'available' ? h('small', { 'aria-hidden': 'true', text: '●' }) : null
          );
        })
      ),
      h(
        'div',
        { class: 'cal-legend' },
        h('span', null, h('i'), 'Disponible'),
        h('span', null, h('i', { class: 'l-sel' }), 'Sélectionné'),
        h('span', null, h('i', { class: 'l-off' }), 'Fermé ou complet')
      )
    );
  }

  async function selectDate(date) {
    state.date = date;
    state.time = null;
    document.querySelectorAll('.cal-day').forEach((b) => {
      const on = b.dataset.date === date;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', String(on));
    });
    clearErrors(1);
    renderSummary();
    await loadSlots(date);
  }

  async function loadSlots(date) {
    $('slots-title').textContent = Garage.capitalize(fmt.date(date, { year: undefined }));
    const box = $('slots');
    box.replaceChildren(h('p', { class: 'loading', text: 'Chargement des horaires…' }));
    try {
      const data = await api.get(`/api/slots?date=${date}`);
      if (state.date !== date) return;
      if (!data.open) {
        box.replaceChildren(h('div', { class: 'empty-state', text: data.label || 'Aucun créneau ce jour-là.' }));
        return;
      }
      const periods = new Map();
      for (const s of data.slots) {
        if (!periods.has(s.period)) periods.set(s.period, []);
        periods.get(s.period).push(s);
      }
      const nodes = [];
      for (const slots of periods.values()) {
        if (periods.size > 1) nodes.push(h('div', { class: 'slot-period', text: slots[0].time < '12:00' ? 'Matin' : 'Après-midi' }));
        nodes.push(
          h(
            'div',
            { class: 'slots' },
            slots.map((s) =>
              h('button', {
                type: 'button',
                class: `slot${s.time === state.time ? ' selected' : ''}`,
                dataset: { time: s.time },
                disabled: !s.available,
                title: s.available ? null : 'Indisponible',
                'aria-pressed': s.time === state.time ? 'true' : 'false',
                text: fmt.time(s.time),
                onclick: () => selectTime(s.time),
              })
            )
          )
        );
      }
      if (data.reason === 'full') nodes.unshift(h('div', { class: 'empty-state', text: 'Tous les créneaux de cette journée sont pris. Choisissez un autre jour.' }));
      box.replaceChildren(...nodes);
    } catch (err) {
      box.replaceChildren(alertBox('error', err.message));
    }
  }

  function selectTime(time) {
    state.time = time;
    document.querySelectorAll('.slot').forEach((b) => {
      const on = b.dataset.time === time;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', String(on));
    });
    clearErrors(1);
    renderSummary();
  }

  // ------------------------------------------------------------
  // Navigation et validation
  // ------------------------------------------------------------
  function clearErrors(step) {
    $(`step-errors-${step}`).replaceChildren();
  }

  function showErrors(step, messages) {
    $(`step-errors-${step}`).replaceChildren(alertBox('error', messages.length > 1 ? h('ul', null, messages.map((m) => h('li', { text: m }))) : messages[0]));
  }

  function markInvalid(name, invalid) {
    const el = field(name);
    if (el) el.setAttribute('aria-invalid', invalid ? 'true' : 'false');
  }

  function validateStep(step) {
    const errors = [];
    if (step === 0) {
      if (!state.services.size && value('otherRequest').length < 3) errors.push('Choisissez au moins une prestation ou décrivez votre besoin.');
    } else if (step === 1) {
      if (!state.date) errors.push('Choisissez un jour dans le calendrier.');
      else if (!state.time) errors.push('Choisissez un horaire de dépôt.');
    } else if (step === 2) {
      const checks = [
        ['brand', !value('brand'), 'Indiquez la marque du véhicule.'],
        ['model', !value('model'), 'Indiquez le modèle du véhicule.'],
        ['year', value('year') && (Number(value('year')) < 1950 || Number(value('year')) > 2100), 'Année invalide.'],
      ];
      for (const [name, bad, msg] of checks) {
        markInvalid(name, bad);
        if (bad) errors.push(msg);
      }
    } else if (step === 3) {
      const phoneOk = /^\+?[0-9 ().-]{6,20}$/.test(value('phone'));
      const emailOk = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value('email'));
      const checks = [
        ['name', !value('name'), 'Indiquez votre nom.'],
        ['phone', !phoneOk, 'Indiquez un numéro de téléphone valide.'],
        ['email', !emailOk, 'Indiquez une adresse e-mail valide.'],
        ['consent', !field('consent').checked, 'Merci d’accepter l’utilisation de vos données pour ce rendez-vous.'],
      ];
      for (const [name, bad, msg] of checks) {
        markInvalid(name, bad);
        if (bad) errors.push(msg);
      }
    }
    if (errors.length) showErrors(step, errors);
    else clearErrors(step);
    return !errors.length;
  }

  function goTo(step) {
    state.step = step;
    panels.forEach((p, i) => p.classList.toggle('hidden', i !== step));
    stepperItems.forEach((li, i) => {
      li.classList.toggle('active', i === step);
      li.classList.toggle('done', i < step);
      if (i === step) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    });
    if (step === 1 && !calendarStarted) {
      calendarStarted = true;
      loadCalendar(state.date ? state.date.slice(0, 7) : minMonth(), true);
    }
    const top = $('stepper').getBoundingClientRect().top;
    if (top < 60 || top > window.innerHeight * 0.6) $('stepper').scrollIntoView({ block: 'start', behavior: 'instant' });
    renderSummary();
  }

  form.addEventListener('click', (e) => {
    if (e.target.closest('[data-next]')) {
      if (validateStep(state.step)) goTo(state.step + 1);
    } else if (e.target.closest('[data-prev]')) {
      goTo(state.step - 1);
    }
  });

  form.addEventListener('input', (e) => {
    if (e.target.name && e.target.getAttribute('aria-invalid') === 'true') e.target.setAttribute('aria-invalid', 'false');
    if (['otherRequest', 'brand', 'model', 'plate'].includes(e.target.name)) renderSummary();
  });

  // ------------------------------------------------------------
  // Récapitulatif
  // ------------------------------------------------------------
  function estimate() {
    const list = [...state.services].map(findService).filter(Boolean);
    return {
      list,
      total: list.reduce((s, x) => s + x.price, 0),
      from: list.some((x) => x.priceFrom) || value('otherRequest').length > 0,
      duration: list.reduce((s, x) => s + (x.duration || 0), 0),
    };
  }

  function renderSummary() {
    const est = estimate();
    const other = value('otherRequest');
    const vehicle = [value('brand'), value('model')].filter(Boolean).join(' ');
    $('summary').replaceChildren(
      h('h3', { text: 'Récapitulatif' }),
      h(
        'div',
        { class: 'summary-block' },
        h('div', { class: 's-label', text: 'Prestations' }),
        est.list.length || other
          ? h(
              'ul',
              null,
              est.list.map((s) => h('li', null, h('span', { text: s.name }), h('span', { text: `${s.priceFrom ? 'dès ' : ''}${fmt.price(s.price)}` }))),
              other ? h('li', null, h('span', { text: 'Autre demande / diagnostic' }), h('span', { text: 'sur devis' })) : null
            )
          : h('span', { class: 'muted', text: 'Aucune prestation choisie' })
      ),
      h(
        'div',
        { class: 'summary-block' },
        h('div', { class: 's-label', text: 'Dépôt du véhicule' }),
        state.date
          ? h('div', null, Garage.capitalize(fmt.date(state.date)), state.time ? h('strong', { text: ` à ${fmt.time(state.time)}` }) : null)
          : h('span', { class: 'muted', text: 'À choisir' })
      ),
      vehicle &&
        h(
          'div',
          { class: 'summary-block' },
          h('div', { class: 's-label', text: 'Véhicule' }),
          h('div', { text: [vehicle, value('plate').toUpperCase()].filter(Boolean).join(' · ') })
        ),
      h(
        'div',
        { class: 'summary-total' },
        h('span', { text: est.from && est.list.length ? 'Estimation dès' : 'Estimation' }),
        h('strong', { text: est.list.length ? fmt.price(est.total) : other ? 'Sur devis' : '—' })
      ),
      est.duration ? h('p', { class: 'fine', text: `Durée d’intervention estimée : ${fmt.duration(est.duration)}` }) : null,
      h('p', { class: 'fine', text: 'Prix TTC indicatifs, confirmés après examen du véhicule. Rien à payer en ligne : le règlement se fait au garage.' })
    );
  }

  // ------------------------------------------------------------
  // Envoi
  // ------------------------------------------------------------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.sending) return;
    for (let s = 0; s <= 3; s++) {
      if (!validateStep(s)) return goTo(s);
    }
    const btn = $('submit-btn');
    state.sending = true;
    btn.disabled = true;
    btn.textContent = 'Envoi en cours…';
    const payload = {
      services: [...state.services],
      otherRequest: value('otherRequest'),
      date: state.date,
      time: state.time,
      vehicle: {
        brand: value('brand'),
        model: value('model'),
        year: value('year'),
        fuel: value('fuel'),
        plate: value('plate'),
        mileage: value('mileage'),
      },
      customer: { name: value('name'), phone: value('phone'), email: value('email') },
      notes: value('notes'),
      consent: field('consent').checked,
      website: value('website'),
    };
    try {
      const appt = await api.post('/api/appointments', payload);
      showSuccess(appt, payload.customer.email);
    } catch (err) {
      if (err.status === 409 && /créneau/.test(err.message)) {
        goTo(1);
        showErrors(1, [err.message]);
        state.time = null;
        loadCalendar(state.month || state.date.slice(0, 7));
        loadSlots(state.date);
      } else {
        showErrors(3, [err.message]);
      }
    } finally {
      state.sending = false;
      btn.disabled = false;
      btn.textContent = 'Confirmer le rendez-vous';
    }
  });

  function icsEscape(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  }

  function downloadIcs(appt) {
    const start = `${appt.date.replace(/-/g, '')}T${appt.time.replace(':', '')}00`;
    const [hh, mm] = appt.time.split(':').map(Number);
    const endMin = hh * 60 + mm + config.booking.slotMinutes;
    const end = `${appt.date.replace(/-/g, '')}T${pad(Math.floor(endMin / 60))}${pad(endMin % 60)}00`;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const g = config.garage;
    const desc = [
      `Référence : ${appt.ref}`,
      appt.services.length ? `Prestations : ${appt.services.map((s) => s.name).join(', ')}` : '',
      g.phone ? `Téléphone du garage : ${g.phone}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Garage//Rendez-vous//FR',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${appt.ref}@garage`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${icsEscape(`Dépôt du véhicule – ${g.name}`)}`,
      `LOCATION:${icsEscape(Garage.fullAddress(g))}`,
      `DESCRIPTION:${icsEscape(desc)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = h('a', { href: url, download: `rendez-vous-${appt.ref}.ics` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function appointmentDetails(appt) {
    const services = appt.services.map((s) => s.name);
    if (appt.otherRequest) services.push('Autre demande / diagnostic');
    return h(
      'dl',
      { class: 'details-list' },
      h('dt', { text: 'Date' }),
      h('dd', { text: Garage.capitalize(fmt.date(appt.date)) }),
      h('dt', { text: 'Heure de dépôt' }),
      h('dd', { text: fmt.time(appt.time) }),
      h('dt', { text: 'Prestations' }),
      h('dd', { text: services.join(', ') }),
      h('dt', { text: 'Véhicule' }),
      h('dd', { text: [appt.vehicle.brand, appt.vehicle.model, appt.vehicle.plate].filter(Boolean).join(' · ') }),
      appt.estimate && appt.services.length
        ? [h('dt', { text: 'Estimation' }), h('dd', { text: `${appt.estimate.from ? 'à partir de ' : ''}${fmt.price(appt.estimate.total)} TTC` })]
        : null
    );
  }

  function showSuccess(appt, email) {
    $('booking-layout').classList.add('hidden');
    document.querySelector('.tabs').classList.add('hidden');
    const box = $('success');
    box.classList.remove('hidden');
    box.replaceChildren(
      h('div', { class: 'success-icon' }, icon('check')),
      h('h2', { text: 'Rendez-vous enregistré !' }),
      h('p', { class: 'muted', text: 'Merci, votre demande est bien reçue. Le garage vous recontacte si besoin pour confirmer les détails.' }),
      h('div', { class: 'muted small', text: 'Votre référence' }),
      h('div', { class: 'ref-code', text: appt.ref }),
      appointmentDetails(appt),
      h(
        'p',
        { class: 'muted small' },
        'Conservez cette référence : avec votre e-mail, elle permet de consulter ou d’annuler le rendez-vous depuis l’onglet « Gérer mon rendez-vous ».'
      ),
      h(
        'div',
        { class: 'center-actions' },
        h('button', { type: 'button', class: 'btn btn-dark', onclick: () => downloadIcs(appt) }, icon('download'), 'Ajouter à mon agenda'),
        h('a', { class: 'btn btn-outline', href: '/', text: 'Retour à l’accueil' })
      )
    );
    $('m-ref').value = appt.ref;
    $('m-email').value = email;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ------------------------------------------------------------
  // Onglets & gestion d'un rendez-vous
  // ------------------------------------------------------------
  function showTab(name) {
    const manage = name === 'manage';
    $('tab-new').setAttribute('aria-selected', String(!manage));
    $('tab-manage').setAttribute('aria-selected', String(manage));
    $('view-new').classList.toggle('hidden', manage);
    $('view-manage').classList.toggle('hidden', !manage);
  }

  $('tab-new').addEventListener('click', () => {
    showTab('new');
    history.replaceState(null, '', location.pathname + location.search);
  });
  $('tab-manage').addEventListener('click', () => {
    showTab('manage');
    history.replaceState(null, '', '#gerer');
  });

  function renderManageResult(appt, email) {
    const n = Number(appt.date.replace(/-/g, '') + appt.time.replace(':', ''));
    const nowKey = Number(config.today.replace(/-/g, '') + '0000');
    const canCancel = ['pending', 'confirmed'].includes(appt.status) && n >= nowKey;
    const result = h(
      'div',
      { class: 'result-card' },
      h('div', { class: 'ticket-head' }, h('div', null, h('h3', { text: `Rendez-vous ${appt.ref}` }), h('span', { class: 'muted small', text: `Au nom de ${appt.customerName}` })), Garage.badge(appt.status)),
      appointmentDetails(appt),
      h(
        'div',
        { class: 'form-actions' },
        canCancel &&
          h('button', {
            type: 'button',
            class: 'btn btn-danger',
            text: 'Annuler ce rendez-vous',
            onclick: async (e) => {
              if (!confirm(`Confirmez-vous l’annulation du rendez-vous du ${fmt.date(appt.date)} à ${fmt.time(appt.time)} ?`)) return;
              e.target.disabled = true;
              try {
                const updated = await api.post('/api/appointments/cancel', { ref: appt.ref, email });
                renderManageResult(updated, email);
                $('manage-result').prepend(alertBox('success', 'Votre rendez-vous a bien été annulé.'));
              } catch (err) {
                e.target.disabled = false;
                $('manage-errors').replaceChildren(alertBox('error', err.message));
              }
            },
          }),
        h('a', { class: 'btn btn-outline', href: `/support?rdv=${encodeURIComponent(appt.ref)}&sujet=rdv`, text: 'Modifier / poser une question' })
      ),
      appt.status === 'cancelled' && h('p', { class: 'muted small' }, 'Besoin d’un nouveau créneau ? ', h('a', { href: '/rendez-vous', text: 'Reprendre rendez-vous' }), '.')
    );
    $('manage-result').replaceChildren(result);
  }

  $('manage-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ref = $('m-ref').value.trim();
    const email = $('m-email').value.trim();
    $('manage-errors').replaceChildren();
    $('manage-result').replaceChildren();
    if (!ref || !email) {
      $('manage-errors').replaceChildren(alertBox('error', 'Indiquez votre référence et votre adresse e-mail.'));
      return;
    }
    try {
      renderManageResult(await api.post('/api/appointments/lookup', { ref, email }), email);
    } catch (err) {
      $('manage-errors').replaceChildren(alertBox('error', err.message));
    }
  });

  // ------------------------------------------------------------
  // Démarrage
  // ------------------------------------------------------------
  Garage.ready
    .then((cfg) => {
      config = cfg;
      const params = new URLSearchParams(location.search);
      const pre = params.get('service');
      if (pre && findService(pre)) state.services.add(pre);
      const fuel = field('fuel');
      cfg.fuelTypes.forEach((f) => fuel.append(h('option', { value: f, text: f })));
      renderServices();
      if (location.hash === '#gerer') showTab('manage');
      goTo(0);
    })
    .catch(() => {});
})();
