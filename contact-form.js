/* Contact Us modal — posts to the TBWC Worker's public /api/contact route,
   which files an ordinary (anonymous) support ticket and emails the visitor
   a confirmation + the admin team a heads-up (see TBWC/api/worker/routes/contact.ts).
   Opened by any element with [data-contact-form] (nav.js's "Contact" link,
   footer.js's "Technical Support" link) — those keep a plain mailto/anchor
   href as a no-JS fallback. Plain JS, no framework, same pattern as nav.js/footer.js. */
(function () {
  'use strict';

  var API_BASE = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? 'http://localhost:8788/api'
    : 'https://tbwc-api-production.emilguirguis.workers.dev/api';

  var overlay, statusEl, submitBtn, form;
  var built = false;

  function build() {
    if (built) return;
    built = true;

    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="modal-overlay" id="contact-overlay" hidden>' +
        '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="contact-modal-title" style="position:relative">' +
          '<button class="modal__close" type="button" id="contact-close" aria-label="Close">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
          '</button>' +
          '<div>' +
            '<h3 id="contact-modal-title" class="title" style="margin:0 0 6px;font-size:22px">Contact Us</h3>' +
            '<p class="body" style="margin:0">Tell us what’s going on and we’ll get back to you by email.</p>' +
          '</div>' +
          '<form id="contact-form" style="display:flex;flex-direction:column;gap:18px">' +
            '<div class="field"><label for="contact-name">Name</label><input id="contact-name" name="name" required maxlength="200" /></div>' +
            '<div class="field"><label for="contact-email">Email</label><input id="contact-email" name="email" type="email" required maxlength="200" /></div>' +
            '<div class="field"><label for="contact-message">Message</label><textarea id="contact-message" name="message" rows="4" required maxlength="2000" style="appearance:none;border:0;border-bottom:var(--rule-w) solid var(--rule-2);background:transparent;padding:10px 0;font:inherit;font-size:16px;color:var(--ink);outline:none;resize:vertical"></textarea></div>' +
            // Honeypot — hidden from real visitors via CSS (not `hidden`/`display:none`,
            // which some bots skip filling), never a real field a screen reader visits.
            '<div aria-hidden="true" style="position:absolute;left:-9999px;top:-9999px">' +
              '<label for="contact-company">Company</label>' +
              '<input id="contact-company" name="company" tabindex="-1" autocomplete="off" />' +
            '</div>' +
            '<p id="contact-status" role="status" style="margin:0;font-size:13px;min-height:16px"></p>' +
            '<button class="btn btn--accent" type="submit" style="justify-content:center">Send Message</button>' +
          '</form>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap.firstElementChild);

    overlay = document.getElementById('contact-overlay');
    statusEl = document.getElementById('contact-status');
    form = document.getElementById('contact-form');
    submitBtn = form.querySelector('button[type="submit"]');

    document.getElementById('contact-close').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !overlay.hidden) close(); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.name.value.trim();
      var email = form.email.value.trim();
      var message = form.message.value.trim();
      if (!name || !email || !message) return;

      submitBtn.disabled = true;
      statusEl.textContent = '';
      statusEl.style.color = 'var(--ink-2)';

      fetch(API_BASE + '/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, email: email, message: message, company: form.company.value }),
      })
        .then(function (res) { return res.json().then(function (json) { return { ok: res.ok, json: json }; }); })
        .then(function (r) {
          submitBtn.disabled = false;
          if (!r.ok || !r.json.success) {
            statusEl.textContent = (r.json && r.json.message) || 'Something went wrong — please try again.';
            statusEl.style.color = '#c0392b';
            return;
          }
          statusEl.textContent = 'Thanks — we got your message and will follow up by email shortly.';
          statusEl.style.color = 'var(--ink-2)';
          form.reset();
          setTimeout(close, 2200);
        })
        .catch(function () {
          submitBtn.disabled = false;
          statusEl.textContent = 'Network error — please try again.';
          statusEl.style.color = '#c0392b';
        });
    });
  }

  function open() {
    build();
    overlay.hidden = false;
    statusEl.textContent = '';
    var el = document.getElementById('contact-name');
    if (el) el.focus();
  }

  function close() {
    if (overlay) overlay.hidden = true;
  }

  window.TBWCContactModal = { open: open, close: close };

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-contact-form]');
    if (!trigger) return;
    e.preventDefault();
    open();
  });
})();
