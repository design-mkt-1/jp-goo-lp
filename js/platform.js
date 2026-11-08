/* The IT platform connection (Jackpot fast registration).

   Ported from design-mkt-1/tw-lp-template js/platform.js, which follows IT's
   reference landing (_js/main.js in Big_bass_splash_200FS_EN.zip) step for
   step: same config shape, same two requests, same body, same SSO.

   1. config.   Development (localhost, 127.0.0.1, or an origin starting with
                https://land-crm) uses DEV below, IT's TEMP_CONFIG. Everywhere
                else config.json is fetched from next to index.html:
                { id, email_registration, landing }. No config.json (404) means
                "not connected": the GitHub Pages preview.
   2. landing.  GET config.landing -> { data: { active, recaptcha_key, country,
                currency, promocode, rules, policy, login, redirect_link,
                analytics_google, analytics_yandex, gtm_tag } }.
                active false: the "disabled" dialog and nothing else.
   3. submit.   reCAPTCHA v3 token, visitor IP, POST config.email_registration.
   4. success.  data.accessToken (+ data.redirectUrl when IT sends it) is
                POSTed as tmpToken + redirect to <host>/api/welcome.

   The password is in the request body: email_registration must be IT's own
   TLS endpoint and nowhere else. */

(function () {
  'use strict';

  var DEV = {
    id: 8,
    email_registration: 'https://api2-land-dev.jack-pot.tech/api/jp/registration/email',
    landing: 'https://api2-land-dev.jack-pot.tech/api/jp/landing/8'
  };
  var LANGUAGE = 'en';

  function isDevelopment() {
    return location.origin.indexOf('https://land-crm') === 0 ||
           location.hostname === 'localhost' ||
           location.hostname === '127.0.0.1';
  }

  var configP = null;
  var landingP = null;
  var recaptchaP = null;
  var landing = null;      // { data, config, domain } once active
  var analyticsOn = false;
  var busy = false;

  /* Resolves to the config, or null when nobody deployed one (404 only). */
  function loadConfig() {
    if (isDevelopment()) return Promise.resolve(DEV);
    if (configP) return configP;
    configP = fetch('config.json', { cache: 'no-store' })
      .then(function (r) {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error('config.json: HTTP ' + r.status);
        return r.json();
      })
      .then(function (cfg) {
        if (cfg === null) return null;
        if (!cfg || !cfg.id || !cfg.email_registration || !cfg.landing) {
          throw new Error('config.json needs { id, email_registration, landing }');
        }
        return cfg;
      });
    configP.catch(function () { configP = null; });
    return configP;
  }

  function query() { return location.search ? location.search.slice(1) : ''; }

  function withQuery(href) {
    var q = query();
    if (!href || !q) return href;
    return href + (href.indexOf('?') < 0 ? '?' : '&') + q;
  }

  function params() {
    var out = {};
    new URLSearchParams(location.search).forEach(function (v, k) { out[k] = v; });
    return out;
  }

  /* Terms, Privacy and Log in come from IT's landing response. Until then the
     Terms / Privacy anchors have no href at all (never "#"). */
  function applyLinks() {
    var map = { terms: landing.data.rules, privacy: landing.data.policy, login: landing.data.login };
    Object.keys(map).forEach(function (name) {
      if (!map[name]) return;
      document.querySelectorAll('[data-link="' + name + '"]').forEach(function (a) {
        a.setAttribute('href', withQuery(map[name]));
      });
    });
  }

  function loadScript(src, where) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.async = true;
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('script did not load: ' + src)); };
      (where || document.body).appendChild(s);
    });
  }

  /* Resolves to 'demo' | 'off' | 'ready'. Rejects on any fault. */
  function loadLanding() {
    if (landingP) return landingP;
    landingP = loadConfig().then(function (cfg) {
      if (!cfg) return 'demo';
      return fetch(cfg.landing, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
      }).then(function (r) {
        if (!r.ok) throw new Error('landing: HTTP ' + r.status);
        return r.json();
      }).then(function (res) {
        var d = res && res.data;
        if (!d) throw new Error('landing: no data in the response');
        if (!analyticsOn) { analyticsOn = true; injectAnalytics(d); }   // before the active check, as IT does
        if (!d.active) { showOff(); return 'off'; }
        if (!d.recaptcha_key) throw new Error('landing: no recaptcha_key');

        var domain = '';
        try { domain = 'https://' + new URL(d.rules).hostname; } catch (e) { /* no SSO fallback */ }
        landing = { data: d, config: cfg, domain: domain };
        applyLinks();
        recaptchaP = loadScript('https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(d.recaptcha_key));
        recaptchaP.catch(function () { /* reported at submit */ });
        return 'ready';
      });
    });
    landingP.catch(function (e) {
      console.warn('[platform] could not load the landing:', e && e.message);
      landingP = null;   // the next submit tries again
    });
    return landingP;
  }

  /* ── analytics, as IT's _js/analytics.js, without inline <script> text
     (the CSP has no 'unsafe-inline'). Each ID is checked before use. */

  var ID_PATTERN = {
    google: /^(G-[A-Z0-9]+|UA-\d+-\d+)$/,
    yandex: /^\d+$/,
    gtm:    /^GTM-[A-Z0-9]+$/
  };

  function checkId(kind, id) {
    if (id === undefined || id === null || id === '') return null;
    var s = String(id);
    if (ID_PATTERN[kind].test(s)) return s;
    console.warn('[platform] skipped an invalid ' + kind + ' analytics ID');
    return null;
  }

  function injectAnalytics(d) {
    try {
      var ga = checkId('google', d.analytics_google);
      if (ga) {
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', ga);
        loadScript('https://www.googletagmanager.com/gtag/js?id=' + ga, document.head);
      }
      var ym = checkId('yandex', d.analytics_yandex);
      if (ym) {
        window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
        window.ym.l = 1 * new Date();
        loadScript('https://mc.yandex.ru/metrika/tag.js', document.head);
        window.ym(Number(ym), 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true });
      }
      var gtm = checkId('gtm', d.gtm_tag);
      if (gtm) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
        loadScript('https://www.googletagmanager.com/gtm.js?id=' + gtm, document.head);
      }
    } catch (e) {
      console.error('[platform] analytics failed:', e && e.message);
    }
  }

  /* Not dismissible: there is nothing behind it to go back to. */
  function showOff() {
    var el = document.getElementById('off');
    document.querySelectorAll('dialog[open]').forEach(function (d) { if (d !== el) d.close(); });
    el.addEventListener('cancel', function (ev) { ev.preventDefault(); });
    if (!el.open) el.showModal();
  }

  /* IT's call, with a ceiling: a slow third party must not hold a registration. */
  function clientIp() {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 3000);
    return fetch('https://api.ipify.org?format=json', ctl ? { signal: ctl.signal } : {})
      .then(function (r) { return r.json(); })
      .then(function (j) { return (j && j.ip) || ''; })
      .catch(function () { return ''; })
      .then(function (ip) { clearTimeout(timer); return ip; });
  }

  function keyed(message, key) { var e = new Error(message); e.key = key; return e; }

  function recaptchaToken() {
    return recaptchaP.then(function () {
      return new Promise(function (resolve, reject) {
        if (!window.grecaptcha) return reject(new Error('grecaptcha missing'));
        grecaptcha.ready(function () {
          grecaptcha.execute(landing.data.recaptcha_key, { action: 'register' })
            .then(function (token) { token ? resolve(token) : reject(new Error('empty token')); }, reject);
        });
      });
    }).catch(function (e) { throw keyed('recaptcha: ' + (e && e.message), 'recaptcha'); });
  }

  /* The server answers { errors: [msg] } in English. Matched loosely. */
  function classify(message) {
    var m = String(message || '').toLowerCase();
    if (m.indexOf('recaptcha') >= 0) return 'recaptcha';
    if (m.indexOf('already registered') >= 0 || m.indexOf('already exists') >= 0) return 'exists';
    return null;
  }

  function post(body) {
    return fetch(landing.config.email_registration, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (r.ok) return r.json();
      return r.json().catch(function () { return null; }).then(function (j) {
        var msg = j && j.errors && j.errors[0];
        throw keyed(msg ? String(msg) : 'HTTP ' + r.status, classify(msg));
      });
    });
  }

  /* A real form POST: the one-shot token travels in a body, never in a URL. */
  function sso(token, redirectUrl) {
    var action, redirect;
    if (redirectUrl) {
      action = new URL(redirectUrl).origin + '/api/welcome';
      redirect = withQuery(redirectUrl);
    } else {
      var path = [LANGUAGE, String(landing.data.redirect_link || '').replace(/^\/+/, '')].filter(Boolean).join('/');
      action = landing.domain + '/api/welcome';
      redirect = withQuery(landing.domain + '/' + path);
    }
    var form = document.createElement('form');
    form.method = 'POST';
    form.action = action;
    form.enctype = 'application/x-www-form-urlencoded';
    form.hidden = true;
    [['tmpToken', token], ['redirect', redirect]].forEach(function (p) {
      var input = document.createElement('input');
      input.type = 'hidden';
      input.name = p[0];
      input.value = p[1];
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  }

  /* register({ email, password }) ->
       resolves 'demo'  : no config.json, nothing was sent (Pages preview)
       never settles    : success, the page is navigating away; or 'off'
       rejects          : err.key 'exists' | 'recaptcha' | undefined */
  function register(fields) {
    if (busy) return new Promise(function () {});
    busy = true;
    return loadLanding().then(function (state) {
      if (state === 'demo') {
        console.warn('[platform] config.json not found: this build is not connected to the platform.');
        busy = false;
        return 'demo';
      }
      if (state === 'off') { busy = false; return new Promise(function () {}); }

      return recaptchaToken().then(function (token) {
        return clientIp().then(function (ip) {
          /* URL parameters go FIRST so one named email or landing_id can
             never overwrite a real field. */
          var body = Object.assign({}, params(), {
            email: fields.email,
            password: fields.password,
            landing_id: landing.config.id,
            language: LANGUAGE,
            currency: landing.data.currency || null,
            country: landing.data.country || null,
            promocode: landing.data.promocode || null,
            receivePromos: true,
            clientIp: ip,
            'g-recaptcha-response': token
          });
          return post(body);
        });
      }).then(function (res) {
        var token = res && res.data && res.data.accessToken;
        var redirectUrl = res && res.data && res.data.redirectUrl;
        if (!token) throw new Error('registered, but no accessToken');
        if (!redirectUrl && !landing.domain) throw new Error('registered, but no redirectUrl or casino domain');
        sso(token, redirectUrl);
        return new Promise(function () {});   // busy stays on: the page is leaving
      });
    }).catch(function (err) {
      console.warn('[platform] registration failed:', err && err.message);
      busy = false;
      throw err;
    });
  }

  window.JPPlatform = { register: register };

  /* Started at load: a disabled landing shows its dialog before anyone spins. */
  loadLanding().catch(function () { /* warned above */ });
}());
