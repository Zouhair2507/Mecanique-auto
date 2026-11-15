/* Page Support : FAQ, création d'une demande, suivi et réponses */
(function () {
  'use strict';
  const { h, icon, fmt, api, alertBox } = Garage;
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'garage:last-ticket';
  let config = null;

  const remember = (ref, email) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ref, email }));
    } catch {
      /* stockage indisponible */
    }
  };
  const recall = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch {
      return null;
    }
  };

  function renderFaq() {
    $('faq-list').replaceChildren(...config.faq.map((f) => h('details', null, h('summary', { text: f.q }), h('p', { text: f.a }))));
    const g = config.garage;
    $('contact-quick').replaceChildren(
      g.phone &&
        h(
          'a',
          { class: 'card', href: Garage.telHref(g.phone) },
          h('span', { class: 'cat-icon' }, icon('phone')),
          h('span', null, h('strong', { text: g.phone }), h('small', { text: 'Aux heures d’ouverture' }))
        ),
      g.email &&
        h(
          'a',
          { class: 'card', href: `mailto:${g.email}` },
          h('span', { class: 'cat-icon' }, icon('mail')),
          h('span', null, h('strong', { text: g.email }), h('small', { text: 'Par e-mail' }))
        )
    );
  }

  function showTab(name) {
    const follow = name === 'follow';
    $('tab-ticket-new').setAttribute('aria-selected', String(!follow));
    $('tab-ticket-follow').setAttribute('aria-selected', String(follow));
    $('ticket-new').classList.toggle('hidden', follow);
    $('ticket-follow').classList.toggle('hidden', !follow);
  }

  $('tab-ticket-new').addEventListener('click', () => showTab('new'));
  $('tab-ticket-follow').addEventListener('click', () => showTab('follow'));

  // ------------------------------------------------------------
  // Nouvelle demande
  // ------------------------------------------------------------
  const ticketForm = $('ticket-form');
  const tv = (name) => (ticketForm.elements.namedItem(name)?.value || '').trim();

  ticketForm.addEventListener('input', (e) => {
    if (e.target.getAttribute('aria-invalid') === 'true') e.target.setAttribute('aria-invalid', 'false');
  });

  ticketForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errors = [];
    const check = (name, bad, msg) => {
      ticketForm.elements.namedItem(name).setAttribute('aria-invalid', bad ? 'true' : 'false');
      if (bad) errors.push(msg);
    };
    check('name', !tv('name'), 'Indiquez votre nom.');
    check('email', !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(tv('email')), 'Indiquez une adresse e-mail valide.');
    check('phone', tv('phone') && !/^\+?[0-9 ().-]{6,20}$/.test(tv('phone')), 'Numéro de téléphone invalide.');
    check('subject', !tv('subject'), 'Indiquez l’objet de votre demande.');
    check('message', !tv('message'), 'Écrivez votre message.');
    check('consent', !ticketForm.elements.namedItem('consent').checked, 'Merci d’accepter l’utilisation de vos données.');
    if (errors.length) {
      $('ticket-errors').replaceChildren(alertBox('error', h('ul', null, errors.map((m) => h('li', { text: m })))));
      return;
    }
    $('ticket-errors').replaceChildren();
    const btn = $('ticket-submit');
    btn.disabled = true;
    btn.textContent = 'Envoi…';
    try {
      const email = tv('email');
      const ticket = await api.post('/api/tickets', {
        name: tv('name'),
        email,
        phone: tv('phone'),
        category: tv('category'),
        subject: tv('subject'),
        plate: tv('plate'),
        appointmentRef: tv('appointmentRef'),
        message: tv('message'),
        consent: true,
        website: tv('website'),
      });
      remember(ticket.ref, email);
      ticketForm.classList.add('hidden');
      $('ticket-created').replaceChildren(
        h(
          'div',
          { class: 'success-box' },
          h('div', { class: 'success-icon' }, icon('check')),
          h('h2', { text: 'Demande envoyée' }),
          h('p', { class: 'muted', text: 'Nous vous répondons au plus vite. Retrouvez la réponse ici, avec votre référence et votre e-mail.' }),
          h('div', { class: 'ref-code', text: ticket.ref }),
          h(
            'div',
            { class: 'center-actions' },
            h('button', {
              type: 'button',
              class: 'btn btn-dark',
              text: 'Suivre ma demande',
              onclick: () => {
                $('f-ref').value = ticket.ref;
                $('f-email').value = email;
                showTab('follow');
                renderThread(ticket, email);
              },
            }),
            h('button', {
              type: 'button',
              class: 'btn btn-outline',
              text: 'Nouvelle demande',
              onclick: () => {
                ticketForm.reset();
                fillCategories();
                ticketForm.classList.remove('hidden');
                $('ticket-created').replaceChildren();
              },
            })
          )
        )
      );
    } catch (err) {
      $('ticket-errors').replaceChildren(alertBox('error', err.message));
    } finally {
      btn.disabled = false;
      btn.textContent = 'Envoyer ma demande';
    }
  });

  // ------------------------------------------------------------
  // Suivi d'une demande
  // ------------------------------------------------------------
  const categoryLabel = (id) => config.ticketCategories.find((c) => c.id === id)?.label || 'Autre';

  function renderThread(ticket, email) {
    const textarea = h('textarea', { name: 'message', maxlength: '4000', required: true, placeholder: 'Votre réponse…', 'aria-label': 'Votre réponse' });
    const errors = h('div');
    const sendBtn = h('button', { type: 'submit', class: 'btn btn-primary' }, icon('send'), 'Envoyer');
    const reply = h(
      'form',
      {
        novalidate: true,
        onsubmit: async (e) => {
          e.preventDefault();
          const message = textarea.value.trim();
          if (!message) {
            errors.replaceChildren(alertBox('error', 'Écrivez votre message.'));
            return;
          }
          sendBtn.disabled = true;
          try {
            renderThread(await api.post('/api/tickets/reply', { ref: ticket.ref, email, message }), email);
          } catch (err) {
            errors.replaceChildren(alertBox('error', err.message));
            sendBtn.disabled = false;
          }
        },
      },
      errors,
      h('div', { class: 'field' }, textarea),
      h(
        'div',
        { class: 'form-actions' },
        sendBtn,
        h('button', {
          type: 'button',
          class: 'btn btn-outline',
          text: 'Actualiser',
          onclick: async () => {
            try {
              renderThread(await api.post('/api/tickets/lookup', { ref: ticket.ref, email }), email);
            } catch (err) {
              errors.replaceChildren(alertBox('error', err.message));
            }
          },
        })
      )
    );

    $('thread-view').replaceChildren(
      h(
        'div',
        { class: 'result-card' },
        h(
          'div',
          { class: 'ticket-head' },
          h('div', null, h('h3', { text: ticket.subject }), h('span', { class: 'muted small' }, h('span', { class: 'mono', text: ticket.ref }), ` · ${categoryLabel(ticket.category)}`)),
          Garage.badge(ticket.status)
        ),
        ticket.status === 'closed' && alertBox('info', 'Cette demande est clôturée. Vous pouvez la rouvrir en répondant ci-dessous.'),
        h(
          'div',
          { class: 'thread' },
          ticket.messages.map((m) =>
            h(
              'div',
              { class: `msg msg-${m.from}` },
              h('span', { class: 'msg-meta', text: `${m.from === 'garage' ? config.garage.name : 'Vous'} · ${fmt.datetime(m.at)}` }),
              m.body
            )
          )
        ),
        reply
      )
    );
  }

  $('follow-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ref = $('f-ref').value.trim();
    const email = $('f-email').value.trim();
    $('follow-errors').replaceChildren();
    $('thread-view').replaceChildren();
    if (!ref || !email) {
      $('follow-errors').replaceChildren(alertBox('error', 'Indiquez la référence et l’adresse e-mail.'));
      return;
    }
    try {
      const ticket = await api.post('/api/tickets/lookup', { ref, email });
      remember(ticket.ref, email);
      renderThread(ticket, email);
    } catch (err) {
      $('follow-errors').replaceChildren(alertBox('error', err.message));
    }
  });

  function fillCategories(selected) {
    const sel = $('t-category');
    sel.replaceChildren(...config.ticketCategories.map((c) => h('option', { value: c.id, text: c.label })));
    if (selected && config.ticketCategories.some((c) => c.id === selected)) sel.value = selected;
  }

  Garage.ready
    .then((cfg) => {
      config = cfg;
      renderFaq();
      const params = new URLSearchParams(location.search);
      fillCategories(params.get('sujet'));
      if (params.get('rdv')) $('t-rdv').value = params.get('rdv');
      const last = recall();
      if (params.get('ref')) {
        $('f-ref').value = params.get('ref');
        showTab('follow');
      } else if (last) {
        $('f-ref').value = last.ref;
        $('f-email').value = last.email;
      }
    })
    .catch(() => {});
})();
