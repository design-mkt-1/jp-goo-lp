/* Wheel, countdown, dialogs and the registration form. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── countdown: decorative, restarts at 23:59:59 on every load ── */
  var left = 24 * 3600 - 1;
  var tH = document.querySelector('[data-t="h"]');
  var tM = document.querySelector('[data-t="m"]');
  var tS = document.querySelector('[data-t="s"]');
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function tick() {
    tH.textContent = pad(Math.floor(left / 3600));
    tM.textContent = pad(Math.floor(left / 60) % 60);
    tS.textContent = pad(left % 60);
    if (left > 0) left -= 1;
  }
  tick();
  setInterval(tick, 1000);

  /* ── dialogs ── */
  var win = $('win');
  var reg = $('reg');
  function open(d) {
    document.querySelectorAll('dialog[open]').forEach(function (o) { if (o !== d) o.close(); });
    if (!d.open) d.showModal();
  }
  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () { b.closest('dialog').close(); });
  });
  /* A click on the dimmed backdrop closes, like the X. */
  [win, reg].forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  });

  /* ── wheel: one spin, always segment 1 (200% + 100 FS), which sits at 0deg ── */
  var wheel = $('wheel');
  var disc = wheel.querySelector('.wheel__disc');
  var spin = $('spin');
  var spun = false;

  function landed() {
    spin.disabled = false;
    spin.removeAttribute('aria-busy');
    spin.textContent = 'OTTIENI IL BONUS';
    open(win);
  }

  spin.addEventListener('click', function () {
    if (spun) { open(reg); return; }
    spun = true;
    spin.disabled = true;
    spin.setAttribute('aria-busy', 'true');
    spin.textContent = 'STA GIRANDO\u2026';
    if (reduced) {
      setTimeout(landed, 300);
      return;
    }
    /* Five full turns plus a few degrees inside segment 1, so it does not
       stop dead centre every time. Segment 1 spans -30deg..30deg. */
    var jitter = Math.round((Math.random() * 2 - 1) * 18);
    wheel.classList.add('is-spinning');
    disc.style.setProperty('--turn', (5 * 360 + jitter) + 'deg');
    var done = false;
    function finish() { if (!done) { done = true; landed(); } }
    disc.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 5600);   // in case transitionend never fires
  });

  $('claim').addEventListener('click', function () { open(reg); });

  /* ── form ── */
  var form = $('form');
  var email = $('email');
  var password = $('password');
  var terms = $('terms');
  var formErr = $('form-err');
  var submit = form.querySelector('[type="submit"]');

  var MSG = {
    required: 'Questo campo è obbligatorio',
    email: 'Inserisci un indirizzo email valido',
    password: 'La password deve contenere almeno 8 caratteri',
    terms: 'Conferma di accettare i termini',
    exists: 'Questa email è già registrata',
    recaptcha: 'Purtroppo non siamo riusciti a verificare la tua identità. Prova a registrarti con un altro browser o dispositivo.',
    generic: 'Qualcosa è andato storto. Riprova.',
    demo: 'Versione di anteprima: la registrazione non è ancora collegata.'
  };
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;   // IT's own rule (form-validations.js)

  function setError(name, text) {
    var field = form.querySelector('[data-field="' + name + '"]');
    var box = $(name + '-err');
    var input = $(name);
    field.classList.toggle('is-error', !!text);
    box.hidden = !text;
    box.querySelector('span').textContent = text || '';
    if (text) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    syncState();
  }
  function syncState() {
    form.classList.toggle('has-errors', !!form.querySelector('.field.is-error'));
  }
  function showFormError(text) {
    formErr.textContent = text || '';
    formErr.hidden = !text;
  }

  function validate() {
    var ok = true;
    var e = email.value.trim();
    if (!e) { setError('email', MSG.required); ok = false; }
    else if (!EMAIL_RE.test(e)) { setError('email', MSG.email); ok = false; }
    else setError('email', '');

    var p = password.value;
    if (!p) { setError('password', MSG.required); ok = false; }
    else if (p.length < 8) { setError('password', MSG.password); ok = false; }
    else setError('password', '');

    if (!terms.checked) { setError('terms', MSG.terms); ok = false; }
    else setError('terms', '');
    return ok;
  }

  email.addEventListener('input', function () { setError('email', ''); showFormError(''); });
  password.addEventListener('input', function () { setError('password', ''); showFormError(''); });
  terms.addEventListener('change', function () { setError('terms', ''); });

  var eye = $('eye');
  eye.addEventListener('click', function () {
    var show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    eye.setAttribute('aria-pressed', String(show));
    eye.setAttribute('aria-label', show ? 'Nascondi password' : 'Mostra password');
  });

  function setBusy(on) {
    if (on) submit.setAttribute('aria-busy', 'true'); else submit.removeAttribute('aria-busy');
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    showFormError('');
    if (!validate()) {
      var first = form.querySelector('.field.is-error input');
      if (first) first.focus();
      return;
    }
    setBusy(true);
    window.JPPlatform.register({ email: email.value.trim(), password: password.value })
      .then(function (state) {
        setBusy(false);
        if (state === 'demo') showFormError(MSG.demo);
      })
      .catch(function (err) {
        setBusy(false);
        if (err && err.key === 'exists') { setError('email', MSG.exists); email.focus(); return; }
        showFormError(err && err.key === 'recaptcha' ? MSG.recaptcha : MSG.generic);
      });
  });
}());
