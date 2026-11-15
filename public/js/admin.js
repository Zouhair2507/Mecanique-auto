/* Espace administration du garage */
(function () {
  'use strict';
  const { h, icon, fmt, api, alertBox, badge, DAYS } = Garage;
  const $ = (id) => document.getElementById(id);
  const panels = {};
  document.querySelectorAll('[data-panel]').forEach((p) => (panels[p.dataset.panel] = p));

  const APPT_LABELS = { pending: 'À confirmer', confirmed: 'Confirmé', done: 'Terminé', cancelled: 'Annulé' };
  const TICKET_LABELS = { open: 'À traiter', answered: 'Répondu', closed: 'Clôturé' };
  const ICON_LABELS = {
    oil: 'Goutte (entretien)',
    brake: 'Disque (freinage)',
    wrench: 'Clé (mécanique)',
    tire: 'Pneu',
    snow: 'Flocon (clim)',
    bolt: 'Éclair (électricité)',
    spring: 'Ressort (suspension)',
    car: 'Voiture',
  };

  const state = {
    tab: 'dashboard',
    config: null,
    stats: null,
    today: null,
    appointments: [],
    newIds: new Set(),
    apptFilter: { period: 'upcoming', status: 'active', q: '' },
    tickets: [],
    ticketFilter: 'active',
    activeTicketId: null,
    settings: null,
    saved: null,
    icons: [],
    dirty: false,
  };

  const clone = (o) => JSON.parse(JSON.stringify(o));
  let uid = 0;
  const nextId = () => `f${++uid}`;

  // ------------------------------------------------------------
  // Utilitaires
  // ------------------------------------------------------------
  function toast(message, type) {
    const t = h('div', { class: `toast${type === 'error' ? ' error' : ''}`, role: type === 'error' ? 'alert' : 'status', text: message });
    $('toasts').append(t);
    setTimeout(() => t.remove(), type === 'error' ? 6000 : 3000);
  }

  async function call(fn, successMsg) {
    try {
      const res = await fn();
      if (successMsg) toast(successMsg);
      return res;
    } catch (err) {
      if (err.status === 401) {
        showLogin();
        toast(err.message, 'error');
      } else {
        toast(err.message, 'error');
      }
      throw err;
    }
  }

  const quiet = (p) => p.catch(() => undefined);

  function setBadge(id, n) {
    const el = $(id);
    el.textContent = String(n);
    el.classList.toggle('hidden', !n);
  }

  // ------------------------------------------------------------
  // Connexion
  // ------------------------------------------------------------
  function showLogin() {
    $('app-view').classList.add('hidden');
    $('login-view').classList.remove('hidden');
    $('save-bar').classList.add('hidden');
    $('password').focus();
  }

  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('login-errors').replaceChildren();
    try {
      await api.post('/api/admin/login', { password: $('password').value });
      $('password').value = '';
      await startApp();
    } catch (err) {
      $('login-errors').replaceChildren(alertBox('error', err.message));
    }
  });

  $('logout-btn').addEventListener('click', async () => {
    if (state.dirty && !confirm('Des modifications ne sont pas enregistrées. Se déconnecter quand même ?')) return;
    await quiet(api.post('/api/admin/logout'));
    state.dirty = false;
    location.reload();
  });

  // ------------------------------------------------------------
  // Chargement des données
  // ------------------------------------------------------------
  async function loadStats() {
    state.stats = await call(() => api.get('/api/admin/stats'));
    setBadge('badge-appointments', state.stats.unseenAppointments);
    setBadge('badge-tickets', state.stats.unreadTickets);
  }

  async function loadAppointments() {
    const data = await call(() => api.get('/api/admin/appointments'));
    state.today = data.today;
    state.appointments = data.appointments;
  }

  async function loadTickets() {
    state.tickets = (await call(() => api.get('/api/admin/tickets'))).tickets;
  }

  async function loadSettings() {
    const data = await call(() => api.get('/api/admin/settings'));
    state.settings = clone(data.settings);
    state.saved = clone(data.settings);
    state.icons = data.icons;
  }

  async function startApp() {
    await Promise.all([loadStats(), loadAppointments(), loadTickets(), loadSettings()]);
    $('login-view').classList.add('hidden');
    $('app-view').classList.remove('hidden');
    const fromHash = location.hash.slice(1);
    switchTab(panels[fromHash] ? fromHash : 'dashboard');
  }

  // Actualisation automatique toutes les minutes (nouveaux rendez-vous / messages)
  setInterval(async () => {
    if ($('app-view').classList.contains('hidden')) return;
    const typing = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    try {
      await Promise.all([loadStats(), loadAppointments(), loadTickets()]);
      if (!typing && ['dashboard', 'appointments', 'tickets'].includes(state.tab)) renderTab();
    } catch {
      /* déjà signalé */
    }
  }, 60000);

  // ------------------------------------------------------------
  // Onglets
  // ------------------------------------------------------------
  document.querySelectorAll('.admin-tabs .tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  function switchTab(name) {
    state.tab = name;
    document.querySelectorAll('.admin-tabs .tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    Object.entries(panels).forEach(([k, p]) => p.classList.toggle('hidden', k !== name));
    history.replaceState(null, '', `#${name}`);
    const unseen = state.appointments.filter((a) => !a.seen);
    if (name === 'appointments' && unseen.length) {
      unseen.forEach((a) => {
        state.newIds.add(a.id);
        a.seen = true;
      });
      quiet(call(() => api.post('/api/admin/appointments/mark-seen')).then(loadStats));
    }
    renderTab();
  }

  function renderTab() {
    const renderers = {
      dashboard: renderDashboard,
      appointments: renderAppointments,
      tickets: renderTickets,
      prices: renderPrices,
      settings: renderSettings,
    };
    renderers[state.tab]();
  }

  // ------------------------------------------------------------
  // Tableau de bord
  // ------------------------------------------------------------
  function renderDashboard() {
    const s = state.stats;
    const stat = (value, label, onclick, accent) =>
      h('button', { type: 'button', class: `card stat${accent && value ? ' accent' : ''}`, onclick }, h('div', { class: 'stat-value', text: String(value) }), h('div', { class: 'stat-label', text: label }));

    const todays = state.appointments.filter((a) => a.date === state.today && a.status !== 'cancelled');
    const openTickets = state.tickets.filter((t) => t.status === 'open').slice(0, 5);

    panels.dashboard.replaceChildren(
      h(
        'div',
        { class: 'stats' },
        stat(s.todayCount, 'Rendez-vous aujourd’hui', () => {
          state.apptFilter = { period: 'today', status: 'active', q: '' };
          switchTab('appointments');
        }),
        stat(
          s.pendingCount,
          'À confirmer',
          () => {
            state.apptFilter = { period: 'upcoming', status: 'pending', q: '' };
            switchTab('appointments');
          },
          true
        ),
        stat(s.weekCount, 'Dans les 7 prochains jours', () => {
          state.apptFilter = { period: 'upcoming', status: 'active', q: '' };
          switchTab('appointments');
        }),
        stat(
          s.openTickets,
          'Demandes de support à traiter',
          () => {
            state.ticketFilter = 'open';
            switchTab('tickets');
          },
          true
        )
      ),
      h('div', { class: 'admin-section-title' }, h('h2', { text: `Aujourd’hui — ${Garage.capitalize(fmt.date(state.today))}` })),
      todays.length ? h('div', null, todays.map((a) => appointmentCard(a))) : h('div', { class: 'empty-state', text: 'Aucun rendez-vous aujourd’hui.' }),
      h(
        'div',
        { class: 'admin-section-title mt-lg' },
        h('h2', { text: 'Demandes de support en attente' }),
        h('button', { type: 'button', class: 'btn btn-outline btn-sm', text: 'Tout voir', onclick: () => switchTab('tickets') })
      ),
      openTickets.length
        ? h(
            'div',
            { class: 'card ticket-list' },
            openTickets.map((t) =>
              ticketItem(t, () => {
                state.activeTicketId = t.id;
                state.ticketFilter = 'active';
                switchTab('tickets');
                openTicket(t.id);
              })
            )
          )
        : h('div', { class: 'empty-state', text: 'Aucune demande en attente. 👍' })
    );
  }

  // ------------------------------------------------------------
  // Rendez-vous
  // ------------------------------------------------------------
  async function updateAppointment(a, patch, msg) {
    try {
      const updated = await call(() => api.patch(`/api/admin/appointments/${a.id}`, patch), msg);
      Object.assign(a, updated);
      await quiet(loadStats());
      renderTab();
    } catch {
      /* erreur déjà affichée */
    }
  }

  function appointmentCard(a) {
    const actions = [];
    const btn = (label, cls, onclick) => h('button', { type: 'button', class: `btn btn-sm ${cls}`, text: label, onclick });
    if (a.status === 'pending') {
      actions.push(btn('Confirmer', 'btn-primary', () => updateAppointment(a, { status: 'confirmed' }, 'Rendez-vous confirmé')));
    }
    if (a.status === 'confirmed' || a.status === 'pending') {
      actions.push(btn('Terminé', 'btn-outline', () => updateAppointment(a, { status: 'done' }, 'Marqué comme terminé')));
      actions.push(
        btn('Annuler', 'btn-danger', () => {
          if (confirm(`Annuler le rendez-vous de ${a.customer.name} ?`)) updateAppointment(a, { status: 'cancelled' }, 'Rendez-vous annulé');
        })
      );
    }
    if (a.status === 'done') actions.push(btn('Rouvrir', 'btn-outline', () => updateAppointment(a, { status: 'confirmed' })));
    if (a.status === 'cancelled') actions.push(btn('Rétablir', 'btn-outline', () => updateAppointment(a, { status: 'pending' }, 'Rendez-vous rétabli')));

    const noteArea = h('textarea', { maxlength: '2000', placeholder: 'Note interne (non visible par le client)…', value: a.adminNote || '' });
    const extra = h(
      'div',
      { class: 'appt-extra hidden' },
      h('div', { class: 'field' }, noteArea),
      h(
        'div',
        { class: 'form-actions' },
        h('button', { type: 'button', class: 'btn btn-dark btn-sm', text: 'Enregistrer la note', onclick: () => updateAppointment(a, { adminNote: noteArea.value }, 'Note enregistrée') }),
        h('button', {
          type: 'button',
          class: 'btn btn-danger btn-sm',
          text: 'Supprimer le rendez-vous',
          onclick: async () => {
            if (!confirm('Supprimer définitivement ce rendez-vous ? (À réserver aux demandes indésirables.)')) return;
            if (!(await quiet(call(() => api.del(`/api/admin/appointments/${a.id}`), 'Rendez-vous supprimé')))) return;
            state.appointments = state.appointments.filter((x) => x.id !== a.id);
            await quiet(loadStats());
            renderTab();
          },
        })
      )
    );

    const v = a.vehicle;
    const vehicle = [
      [v.brand, v.model].filter(Boolean).join(' '),
      v.plate,
      v.year,
      v.fuel,
      v.mileage !== null && v.mileage !== undefined && v.mileage !== '' ? `${Number(v.mileage).toLocaleString('fr-FR')} km` : null,
    ].filter(Boolean);
    const isNew = state.newIds.has(a.id);
    const classes = ['card', 'appt'];
    if (isNew) classes.push('is-new');
    if (a.status === 'cancelled') classes.push('is-cancelled');

    return h(
      'article',
      { class: classes.join(' ') },
      h('div', null, h('div', { class: 'appt-time', text: fmt.time(a.time) }), h('div', { class: 'appt-ref', text: a.ref })),
      h(
        'div',
        { class: 'appt-main' },
        h(
          'div',
          { class: 'appt-customer' },
          h('span', { text: a.customer.name }),
          h('a', { href: Garage.telHref(a.customer.phone), text: a.customer.phone }),
          h('a', { href: `mailto:${a.customer.email}`, text: a.customer.email })
        ),
        h('div', { class: 'appt-line' }, icon('car'), ' ', h('strong', { text: vehicle.join(' · ') })),
        h(
          'div',
          { class: 'tag-list' },
          a.services.map((s) => h('span', { class: 'tag', text: `${s.name} · ${s.priceFrom ? 'dès ' : ''}${fmt.price(s.price)}` })),
          a.otherRequest ? h('span', { class: 'tag', text: 'Autre demande' }) : null
        ),
        a.services.length ? h('div', { class: 'appt-line', text: `Estimation : ${a.estimate.from ? 'dès ' : ''}${fmt.price(a.estimate.total)} TTC${a.estimate.duration ? ` · env. ${fmt.duration(a.estimate.duration)}` : ''}` }) : null,
        a.otherRequest ? h('div', { class: 'appt-note', text: `Demande : ${a.otherRequest}` }) : null,
        a.notes ? h('div', { class: 'appt-note', text: `Commentaire client : ${a.notes}` }) : null,
        a.adminNote ? h('div', { class: 'appt-note', text: `Note interne : ${a.adminNote}` }) : null,
        a.status === 'cancelled' && a.cancelledBy === 'client' ? h('div', { class: 'appt-line', text: '⚠ Annulé par le client' }) : null
      ),
      h(
        'div',
        { class: 'appt-side' },
        h('div', null, isNew ? h('span', { class: 'badge badge-count', text: 'Nouveau' }) : null, ' ', badge(a.status, APPT_LABELS)),
        h(
          'div',
          { class: 'appt-actions' },
          actions,
          h('button', {
            type: 'button',
            class: 'btn btn-sm btn-outline',
            text: 'Note…',
            onclick: () => extra.classList.toggle('hidden'),
          })
        )
      ),
      extra
    );
  }

  function filteredAppointments() {
    const f = state.apptFilter;
    const q = f.q.trim().toLowerCase();
    let list = state.appointments.filter((a) => {
      if (f.period === 'upcoming' && a.date < state.today) return false;
      if (f.period === 'today' && a.date !== state.today) return false;
      if (f.period === 'past' && a.date >= state.today) return false;
      if (f.status === 'active' && !['pending', 'confirmed'].includes(a.status)) return false;
      if (!['all', 'active'].includes(f.status) && a.status !== f.status) return false;
      if (q) {
        const hay = [a.ref, a.customer.name, a.customer.phone, a.customer.email, a.vehicle.plate, a.vehicle.brand, a.vehicle.model].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (f.period === 'past') list = list.reverse();
    return list;
  }

  function renderAppointments() {
    const f = state.apptFilter;
    const select = (key, options) =>
      h(
        'select',
        {
          'aria-label': key === 'period' ? 'Période' : 'Statut',
          value: f[key],
          onchange: (e) => {
            f[key] = e.target.value;
            renderList();
          },
        },
        options.map(([v, l]) => h('option', { value: v, text: l }))
      );
    const search = h('input', {
      type: 'search',
      placeholder: 'Rechercher : nom, plaque, référence, téléphone…',
      'aria-label': 'Rechercher',
      value: f.q,
      oninput: (e) => {
        f.q = e.target.value;
        renderList();
      },
    });
    const listBox = h('div');

    function renderList() {
      const list = filteredAppointments();
      if (!list.length) {
        listBox.replaceChildren(h('div', { class: 'empty-state', text: 'Aucun rendez-vous pour ces critères.' }));
        return;
      }
      const groups = new Map();
      for (const a of list) {
        if (!groups.has(a.date)) groups.set(a.date, []);
        groups.get(a.date).push(a);
      }
      listBox.replaceChildren(
        ...[...groups].map(([date, items]) =>
          h(
            'div',
            { class: 'day-group' },
            h(
              'h3',
              { class: 'day-title' },
              Garage.capitalize(fmt.date(date)),
              date === state.today ? h('span', { class: 'badge badge-count', text: 'Aujourd’hui' }) : null,
              h('span', { class: 'muted', text: `${items.length} rendez-vous` })
            ),
            items.map((a) => appointmentCard(a))
          )
        )
      );
    }

    panels.appointments.replaceChildren(
      h(
        'div',
        { class: 'toolbar' },
        select('period', [
          ['upcoming', 'À venir'],
          ['today', 'Aujourd’hui'],
          ['past', 'Passés'],
          ['all', 'Toutes les dates'],
        ]),
        select('status', [
          ['active', 'À confirmer + confirmés'],
          ['pending', 'À confirmer'],
          ['confirmed', 'Confirmés'],
          ['done', 'Terminés'],
          ['cancelled', 'Annulés'],
          ['all', 'Tous les statuts'],
        ]),
        search
      ),
      listBox
    );
    renderList();
  }

  // ------------------------------------------------------------
  // Support
  // ------------------------------------------------------------
  const categoryLabel = (id) => state.config.ticketCategories.find((c) => c.id === id)?.label || 'Autre';

  function ticketItem(t, onclick) {
    return h(
      'button',
      { type: 'button', class: `ticket-item${t.id === state.activeTicketId ? ' active' : ''}`, onclick },
      h('div', { class: 'ti-top' }, h('span', { class: 'ti-subject', text: t.subject }), t.unread ? h('span', { class: 'unread-dot', title: 'Non lu' }) : null),
      h('div', { class: 'ti-meta' }, h('span', { text: `${t.customer.name} · ${categoryLabel(t.category)}` }), h('span', { text: fmt.datetime(t.updatedAt) })),
      h('div', { class: 'ti-meta' }, h('span', { class: 'mono', text: t.ref }), badge(t.status, TICKET_LABELS))
    );
  }

  function filteredTickets() {
    const f = state.ticketFilter;
    return state.tickets.filter((t) => (f === 'all' ? true : f === 'active' ? t.status !== 'closed' : t.status === f));
  }

  function renderTickets() {
    const list = filteredTickets();
    const listBox = list.length
      ? h('div', { class: 'card ticket-list' }, list.map((t) => ticketItem(t, () => openTicket(t.id))))
      : h('div', { class: 'empty-state', text: 'Aucune demande.' });
    const detail = h('div', { id: 'ticket-detail' });
    panels.tickets.replaceChildren(
      h(
        'div',
        { class: 'toolbar' },
        h(
          'select',
          {
            'aria-label': 'Filtrer les demandes',
            value: state.ticketFilter,
            onchange: (e) => {
              state.ticketFilter = e.target.value;
              renderTickets();
            },
          },
          [
            ['active', 'En cours (à traiter + répondues)'],
            ['open', 'À traiter'],
            ['answered', 'Répondues'],
            ['closed', 'Clôturées'],
            ['all', 'Toutes'],
          ].map(([v, l]) => h('option', { value: v, text: l }))
        )
      ),
      h('div', { class: 'tickets-layout' }, listBox, detail)
    );
    const active = state.tickets.find((t) => t.id === state.activeTicketId);
    if (active) renderTicketDetail(active);
    else detail.replaceChildren(h('div', { class: 'empty-state', text: 'Sélectionnez une demande pour l’afficher.' }));
  }

  async function openTicket(id) {
    state.activeTicketId = id;
    const t = state.tickets.find((x) => x.id === id);
    if (t?.unread) {
      const updated = await quiet(call(() => api.patch(`/api/admin/tickets/${id}`, { unread: false })));
      if (updated) Object.assign(t, updated);
      quiet(loadStats());
    }
    renderTickets();
    $('ticket-detail')?.scrollIntoView({ block: 'nearest' });
  }

  function renderTicketDetail(t) {
    const replyArea = h('textarea', { maxlength: '4000', placeholder: `Votre réponse à ${t.customer.name}…`, 'aria-label': 'Réponse' });
    const send = async (close) => {
      const message = replyArea.value.trim();
      if (!message) return toast('Écrivez une réponse.', 'error');
      const updated = await quiet(call(() => api.post(`/api/admin/tickets/${t.id}/messages`, { message, close }), close ? 'Réponse envoyée, demande clôturée' : 'Réponse envoyée'));
      if (!updated) return;
      Object.assign(t, updated);
      await quiet(loadStats());
      renderTickets();
    };
    const setStatus = async (status, msg) => {
      const updated = await quiet(call(() => api.patch(`/api/admin/tickets/${t.id}`, { status }), msg));
      if (!updated) return;
      Object.assign(t, updated);
      await quiet(loadStats());
      renderTickets();
    };

    $('ticket-detail').replaceChildren(
      h(
        'div',
        { class: 'card ticket-detail' },
        h('div', { class: 'ticket-head' }, h('div', null, h('h3', { text: t.subject }), h('span', { class: 'muted small mono', text: t.ref })), badge(t.status, TICKET_LABELS)),
        h(
          'div',
          { class: 'ticket-info' },
          h('span', null, h('strong', { text: t.customer.name })),
          h('a', { href: `mailto:${t.customer.email}?subject=${encodeURIComponent(`${t.subject} (${t.ref})`)}`, text: t.customer.email }),
          t.customer.phone ? h('a', { href: Garage.telHref(t.customer.phone), text: t.customer.phone }) : null,
          h('span', { text: categoryLabel(t.category) }),
          t.plate ? h('span', { text: `Véhicule : ${t.plate}` }) : null,
          t.appointmentRef
            ? h('button', {
                type: 'button',
                class: 'link-btn',
                text: `RDV : ${t.appointmentRef}`,
                onclick: () => {
                  state.apptFilter = { period: 'all', status: 'all', q: t.appointmentRef };
                  switchTab('appointments');
                },
              })
            : null,
          h('span', { text: `Créée le ${fmt.datetime(t.createdAt)}` })
        ),
        h(
          'div',
          { class: 'thread' },
          t.messages.map((m) =>
            h(
              'div',
              { class: `msg ${m.from === 'garage' ? 'msg-client' : 'msg-garage'}` },
              h('span', { class: 'msg-meta', text: `${m.from === 'garage' ? 'Vous (garage)' : t.customer.name} · ${fmt.datetime(m.at)}` }),
              m.body
            )
          )
        ),
        h('div', { class: 'field' }, replyArea),
        h(
          'div',
          { class: 'form-actions' },
          h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => send(false) }, icon('send'), 'Répondre'),
          h('button', { type: 'button', class: 'btn btn-outline btn-sm', text: 'Répondre et clôturer', onclick: () => send(true) }),
          t.status === 'closed'
            ? h('button', { type: 'button', class: 'btn btn-outline btn-sm', text: 'Rouvrir', onclick: () => setStatus('open', 'Demande rouverte') })
            : h('button', { type: 'button', class: 'btn btn-outline btn-sm', text: 'Clôturer sans répondre', onclick: () => setStatus('closed', 'Demande clôturée') }),
          h('button', {
            type: 'button',
            class: 'btn btn-danger btn-sm',
            text: 'Supprimer',
            onclick: async () => {
              if (!confirm('Supprimer définitivement cette demande ?')) return;
              if (!(await quiet(call(() => api.del(`/api/admin/tickets/${t.id}`), 'Demande supprimée')))) return;
              state.tickets = state.tickets.filter((x) => x.id !== t.id);
              state.activeTicketId = null;
              await quiet(loadStats());
              renderTickets();
            },
          })
        ),
        h('p', { class: 'muted small', text: 'Le client voit votre réponse sur la page Support, avec sa référence et son e-mail. Pensez à le prévenir par téléphone ou e-mail si c’est urgent.' })
      )
    );
  }

  // ------------------------------------------------------------
  // Éditeurs de réglages (tarifs, horaires, infos)
  // ------------------------------------------------------------
  function markDirty() {
    state.dirty = true;
    $('save-bar').classList.remove('hidden');
  }

  $('save-btn').addEventListener('click', async () => {
    const btn = $('save-btn');
    btn.disabled = true;
    try {
      const data = await call(() => api.put('/api/admin/settings', { settings: state.settings }), 'Modifications enregistrées et publiées sur le site');
      state.settings = clone(data.settings);
      state.saved = clone(data.settings);
      state.dirty = false;
      $('save-bar').classList.add('hidden');
      renderTab();
    } catch {
      /* erreur déjà affichée */
    } finally {
      btn.disabled = false;
    }
  });

  $('discard-btn').addEventListener('click', () => {
    if (!confirm('Annuler toutes les modifications non enregistrées ?')) return;
    state.settings = clone(state.saved);
    state.dirty = false;
    $('save-bar').classList.add('hidden');
    renderTab();
  });

  window.addEventListener('beforeunload', (e) => {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  const asNumber = (v) => {
    const n = Number(String(v).replace(',', '.'));
    return v !== '' && Number.isFinite(n) ? n : v;
  };

  /** Champ texte / nombre relié à obj[key] */
  function bound(obj, key, label, opts = {}) {
    const id = nextId();
    const tag = opts.multiline ? 'textarea' : 'input';
    const attrs = {
      id,
      value: obj[key] ?? '',
      oninput: (e) => {
        obj[key] = opts.number ? asNumber(e.target.value) : e.target.value;
        markDirty();
        opts.onInput?.(obj[key]);
      },
    };
    if (!opts.multiline) attrs.type = opts.type || (opts.number ? 'number' : 'text');
    if (opts.number) {
      attrs.step = opts.step || 'any';
      attrs.min = opts.min ?? '0';
      attrs.inputmode = 'decimal';
    }
    if (opts.placeholder) attrs.placeholder = opts.placeholder;
    if (opts.maxlength) attrs.maxlength = String(opts.maxlength);
    return h('div', { class: `field${opts.full ? ' full' : ''}` }, h('label', { for: id, text: label }), h(tag, attrs), opts.hint ? h('span', { class: 'hint', text: opts.hint }) : null);
  }

  function boundCheckbox(obj, key, label) {
    return h(
      'label',
      { class: 'checkbox-inline' },
      h('input', {
        type: 'checkbox',
        checked: Boolean(obj[key]),
        onchange: (e) => {
          obj[key] = e.target.checked;
          markDirty();
        },
      }),
      label
    );
  }

  function rowTools(arr, i, rerender, confirmMsg) {
    const move = (to) => {
      [arr[i], arr[to]] = [arr[to], arr[i]];
      markDirty();
      rerender();
    };
    return h(
      'div',
      { class: 'row-tools' },
      h('button', { type: 'button', class: 'icon-btn', title: 'Monter', 'aria-label': 'Monter', disabled: i === 0, onclick: () => move(i - 1) }, icon('up')),
      h('button', { type: 'button', class: 'icon-btn', title: 'Descendre', 'aria-label': 'Descendre', disabled: i === arr.length - 1, onclick: () => move(i + 1) }, icon('down')),
      h(
        'button',
        {
          type: 'button',
          class: 'icon-btn danger',
          title: 'Supprimer',
          'aria-label': 'Supprimer',
          onclick: () => {
            if (confirmMsg && !confirm(confirmMsg)) return;
            arr.splice(i, 1);
            markDirty();
            rerender();
          },
        },
        icon('trash')
      )
    );
  }

  const addButton = (label, onclick) => h('button', { type: 'button', class: 'btn btn-outline btn-sm', onclick }, icon('plus'), label);

  function card(title, description, ...content) {
    return h('section', { class: 'card settings-card' }, h('h2', { text: title }), description ? h('p', { class: 'muted', text: description }) : null, ...content);
  }

  // ----- Onglet Tarifs & prestations -----
  function renderPrices() {
    const s = state.settings;
    const rerender = () => renderPrices();
    const htText = (ttc) => {
      const n = Number(String(ttc).replace(',', '.'));
      return Number.isFinite(n) ? `soit ${fmt.price2(fmt.ht(n, s.vatRate))} HT` : '';
    };

    const hints = [];
    const rates = s.hourlyRates.map((r, i) => {
      const hint = h('div', { class: 'ht-hint', text: htText(r.priceTTC) });
      hints.push(() => (hint.textContent = htText(r.priceTTC)));
      return h(
        'div',
        { class: 'row-edit row-rate' },
        bound(r, 'label', 'Intitulé', { maxlength: 80 }),
        bound(r, 'description', 'Description', { maxlength: 200 }),
        bound(r, 'priceTTC', 'Prix TTC / heure (€)', { number: true, step: '0.01', onInput: (v) => (hint.textContent = htText(v)) }),
        hint,
        rowTools(s.hourlyRates, i, rerender, `Supprimer le taux « ${r.label} » ?`)
      );
    });

    const categories = s.categories.map((c, ci) =>
      h(
        'div',
        { class: 'category-card' },
        h(
          'div',
          { class: 'category-head' },
          bound(c, 'name', 'Nom de la catégorie', { maxlength: 80 }),
          h(
            'div',
            { class: 'field' },
            h('label', { text: 'Icône' }),
            h(
              'select',
              {
                value: c.icon,
                onchange: (e) => {
                  c.icon = e.target.value;
                  markDirty();
                },
              },
              state.icons.map((ic) => h('option', { value: ic, text: ICON_LABELS[ic] || ic }))
            )
          ),
          rowTools(s.categories, ci, rerender, `Supprimer la catégorie « ${c.name} » et toutes ses prestations ?`)
        ),
        h(
          'div',
          { class: 'rows' },
          c.services.map((sv, si) =>
            h(
              'div',
              { class: 'row-edit row-service' },
              bound(sv, 'name', 'Prestation', { maxlength: 120 }),
              bound(sv, 'description', 'Description', { maxlength: 300 }),
              bound(sv, 'price', 'Prix TTC (€)', { number: true, step: '0.01' }),
              h('div', { class: 'field' }, h('span', { class: 'label sr-only', text: 'Type de prix' }), boundCheckbox(sv, 'priceFrom', 'à partir de')),
              bound(sv, 'duration', 'Durée (min)', { number: true, step: '5' }),
              rowTools(c.services, si, rerender, `Supprimer « ${sv.name} » ?`)
            )
          )
        ),
        h(
          'div',
          { class: 'form-actions' },
          addButton('Ajouter une prestation', () => {
            c.services.push({ name: '', description: '', price: 0, priceFrom: true, duration: 60 });
            markDirty();
            rerender();
          })
        )
      )
    );

    panels.prices.replaceChildren(
      card(
        'Taux horaires de main d’œuvre',
        'Affichés sur la page d’accueil. Saisissez les prix TTC : le prix HT est calculé automatiquement.',
        h('div', { class: 'grid-3' }, bound(s, 'vatRate', 'Taux de TVA (%)', { number: true, step: '0.1', onInput: () => hints.forEach((fn) => fn()) })),
        h('div', { class: 'rows mt-lg' }, rates),
        h(
          'div',
          { class: 'form-actions' },
          addButton('Ajouter un taux horaire', () => {
            s.hourlyRates.push({ label: '', description: '', priceTTC: 0 });
            markDirty();
            rerender();
          })
        )
      ),
      card(
        'Prestations et prix',
        'Prix TTC pièces et main d’œuvre. Cochez « à partir de » quand le prix dépend du véhicule. La durée sert à informer le client.',
        categories,
        h(
          'div',
          { class: 'form-actions' },
          addButton('Ajouter une catégorie', () => {
            s.categories.push({ name: 'Nouvelle catégorie', icon: 'wrench', services: [] });
            markDirty();
            rerender();
          })
        )
      )
    );
  }

  // ----- Onglet Horaires & infos -----
  function renderSettings() {
    const s = state.settings;
    const rerender = () => renderSettings();

    const dayRows = DAYS.map((d) => {
      const ranges = s.openingHours[d.key];
      return h(
        'div',
        { class: 'day-row' },
        h('strong', { text: d.label }),
        h(
          'div',
          { class: 'day-ranges' },
          ranges.length ? null : h('span', { class: 'muted', text: 'Fermé' }),
          ranges.map((r, i) =>
            h(
              'span',
              { class: 'range' },
              h('input', {
                type: 'time',
                value: r.open,
                'aria-label': `${d.label} – ouverture`,
                onchange: (e) => {
                  r.open = e.target.value;
                  markDirty();
                },
              }),
              '–',
              h('input', {
                type: 'time',
                value: r.close,
                'aria-label': `${d.label} – fermeture`,
                onchange: (e) => {
                  r.close = e.target.value;
                  markDirty();
                },
              }),
              h(
                'button',
                {
                  type: 'button',
                  class: 'icon-btn danger',
                  title: 'Retirer cette plage',
                  'aria-label': 'Retirer cette plage',
                  onclick: () => {
                    ranges.splice(i, 1);
                    markDirty();
                    rerender();
                  },
                },
                icon('close')
              )
            )
          ),
          ranges.length < 4
            ? h('button', {
                type: 'button',
                class: 'btn btn-outline btn-sm',
                text: ranges.length ? '+ Plage' : '+ Ouvrir ce jour',
                onclick: () => {
                  ranges.push(ranges.length ? { open: '14:00', close: '18:00' } : { open: '08:00', close: '12:00' });
                  markDirty();
                  rerender();
                },
              })
            : null
        )
      );
    });

    const b = s.booking;
    const slotSelect = h(
      'div',
      { class: 'field' },
      h('label', { text: 'Durée d’un créneau' }),
      h(
        'select',
        {
          value: String(b.slotMinutes),
          onchange: (e) => {
            b.slotMinutes = Number(e.target.value);
            markDirty();
          },
        },
        [15, 20, 30, 45, 60, 90, 120].map((m) => h('option', { value: String(m), text: fmt.duration(m) }))
      ),
      h('span', { class: 'hint', text: 'Intervalle entre deux horaires de dépôt proposés.' })
    );

    const g = s.garage;
    panels.settings.replaceChildren(
      card(
        'Horaires d’ouverture',
        'Affichés sur le site et utilisés pour calculer les créneaux de rendez-vous. Ajoutez deux plages pour une fermeture le midi.',
        h('div', { class: 'hours-edit' }, dayRows),
        h(
          'div',
          { class: 'form-actions' },
          h('button', {
            type: 'button',
            class: 'btn btn-outline btn-sm',
            text: 'Copier les horaires du lundi sur mardi → vendredi',
            onclick: () => {
              for (const k of ['tue', 'wed', 'thu', 'fri']) s.openingHours[k] = clone(s.openingHours.mon);
              markDirty();
              rerender();
            },
          })
        )
      ),
      card(
        'Fermetures exceptionnelles',
        'Congés, ponts, inventaire… Aucun rendez-vous ne peut être pris sur ces dates, et elles sont annoncées sur le site.',
        h(
          'div',
          { class: 'rows' },
          s.closures.length ? null : h('span', { class: 'muted small', text: 'Aucune fermeture prévue.' }),
          s.closures.map((c, i) =>
            h(
              'div',
              { class: 'row-edit row-closure' },
              bound(c, 'from', 'Du', { type: 'date' }),
              bound(c, 'to', 'Au (inclus)', { type: 'date' }),
              bound(c, 'label', 'Motif affiché', { maxlength: 100, placeholder: 'Ex. : Congés d’été' }),
              rowTools(s.closures, i, rerender)
            )
          )
        ),
        h(
          'div',
          { class: 'form-actions' },
          addButton('Ajouter une fermeture', () => {
            const today = state.today;
            s.closures.push({ from: today, to: today, label: 'Fermeture exceptionnelle' });
            markDirty();
            rerender();
          })
        )
      ),
      card(
        'Prise de rendez-vous',
        null,
        h(
          'div',
          { class: 'grid-3' },
          slotSelect,
          bound(b, 'capacityPerSlot', 'Véhicules acceptés par créneau', { number: true, step: '1', min: '1', hint: 'Selon le nombre de mécaniciens / ponts.' }),
          bound(b, 'minNoticeHours', 'Délai minimum (heures)', { number: true, step: '1', hint: 'Ex. 2 : pas de réservation moins de 2 h avant.' }),
          bound(b, 'maxDaysAhead', 'Réservation jusqu’à (jours)', { number: true, step: '1', min: '1', hint: 'Nombre de jours à l’avance.' }),
          h('div', { class: 'field' }, h('span', { class: 'label', text: 'Jours fériés' }), boundCheckbox(b, 'closeOnHolidays', 'Fermé les jours fériés'))
        )
      ),
      card(
        'Informations du garage',
        'Nom, coordonnées et présentation affichés sur toutes les pages.',
        h(
          'div',
          { class: 'form-grid' },
          bound(g, 'name', 'Nom du garage', { maxlength: 80 }),
          bound(g, 'tagline', 'Accroche (sous le nom)', { maxlength: 160 }),
          bound(g, 'description', 'Présentation (accueil et pied de page)', { multiline: true, full: true, maxlength: 600 }),
          bound(g, 'address', 'Adresse', { maxlength: 160 }),
          bound(g, 'postalCode', 'Code postal', { maxlength: 12 }),
          bound(g, 'city', 'Ville', { maxlength: 80 }),
          bound(g, 'phone', 'Téléphone', { type: 'tel', maxlength: 20 }),
          bound(g, 'email', 'E-mail', { type: 'email', maxlength: 120 }),
          bound(g, 'siret', 'SIRET', { maxlength: 20 }),
          bound(g, 'mapUrl', 'Lien Google Maps (facultatif)', { type: 'url', maxlength: 500, placeholder: 'https://maps.app.goo.gl/…' })
        )
      ),
      card(
        'Message d’information',
        'Affiché en bandeau orange en haut de toutes les pages. Laissez vide pour le masquer.',
        h('div', { class: 'form-grid' }, bound(s, 'announcement', 'Message', { full: true, maxlength: 300, placeholder: 'Ex. : Fermeture exceptionnelle le samedi 26 décembre.' }))
      ),
      card(
        'Questions fréquentes (FAQ)',
        'Affichées sur la page Support.',
        h(
          'div',
          { class: 'rows' },
          s.faq.map((f, i) =>
            h(
              'div',
              { class: 'row-edit row-faq' },
              h('div', { class: 'form-grid' }, bound(f, 'q', 'Question', { full: true, maxlength: 200 }), bound(f, 'a', 'Réponse', { multiline: true, full: true, maxlength: 2000 })),
              rowTools(s.faq, i, rerender, 'Supprimer cette question ?')
            )
          )
        ),
        h(
          'div',
          { class: 'form-actions' },
          addButton('Ajouter une question', () => {
            s.faq.push({ q: '', a: '' });
            markDirty();
            rerender();
          })
        )
      )
    );
  }

  // ------------------------------------------------------------
  // Démarrage
  // ------------------------------------------------------------
  Garage.ready
    .then(async (config) => {
      state.config = config;
      try {
        await api.get('/api/admin/me');
        await startApp();
      } catch {
        showLogin();
      }
    })
    .catch(() => showLogin());
})();
