# jp-goo-lp

Jackpot landing, Australia: "Spin & win your pokies bonus, 200% + 100 FS".
One spin, the wheel always stops on 200% + 100 FS, then the visitor registers
with IT's fast email registration and is signed in on the casino.

Design: Figma `2MyylxdZblfGnf05nQacUz`, section `128:1956` (AU · Wheel of Fortune).

Plain HTML, CSS and JavaScript. No build step, no Node.

```bash
python -m http.server 8000      # http://127.0.0.1:8000
python tools/check.py           # smoke + registration flow, all stubbed
```

## Files

| file | what |
|---|---|
| `index.html` | the page: header, hero, wheel, footer, three `<dialog>`s (win, register, disabled) |
| `css/main.css` | all styles; colours are the `:root` variables at the top |
| `js/app.js` | wheel spin, countdown, dialogs, form validation |
| `js/platform.js` | IT platform: config, landing, reCAPTCHA, registration, SSO, analytics |
| `tools/check.py` | the one check (Playwright) |
| `config.example.json` | shape of the `config.json` IT writes on the server |

## Behaviour

- **Wheel.** Two layers from Figma "Dev · Wheels": the static rim and the disc.
  Only the disc turns: five turns plus up to 18 degrees, so it lands inside
  segment 1 (200% + 100 FS) every time. Reduced motion: no spin, the win
  dialog opens after 300 ms.
- **After the spin** the main button reads "CLAIM BONUS" and opens the form.
- **Countdown.** Decorative: starts at 23:59:59 on every load.
- **Form.** Email and password only. Figma's Phone tab is not built: the
  platform has `registration/email` and no phone route.

## The platform (what IT needs to know)

`js/platform.js` follows IT's reference landing (`_js/main.js` in
`Big_bass_splash_200FS_EN`) step for step:

1. **Config.** On `localhost`, `127.0.0.1` or `https://land-crm…` it uses IT's
   dev landing 8 (`api2-land-dev.jack-pot.tech`). Everywhere else it fetches
   `config.json` from next to `index.html`.
2. **Landing.** `GET config.landing`. `active: false` shows the "Page disabled"
   dialog with support@jack-pot.com. Otherwise Terms, Privacy and Log in take
   `rules`, `policy`, `login` from the response, and reCAPTCHA v3 loads with
   `recaptcha_key`. Analytics IDs (`analytics_google`, `analytics_yandex`,
   `gtm_tag`) are injected if present.
3. **Submit.** `POST config.email_registration` with
   `email, password, landing_id, language: "en", currency, country, promocode,
   receivePromos: true, clientIp, g-recaptcha-response` plus the URL's query
   parameters (which can never overwrite those fields).
4. **Success.** `accessToken` is POSTed as `tmpToken` + `redirect` to
   `<redirectUrl origin>/api/welcome`, or, without `redirectUrl`, to
   `<rules host>/api/welcome` with `/en/<redirect_link>`.

GitHub Pages has no `config.json`, so the preview is **not connected**: a
valid submit shows "Preview build: registration is not connected yet."

## Deploy (IT)

1. Copy the files (everything `pages.yml` publishes: `index.html`, `css/`,
   `js/`, `assets/`).
2. Write `config.json` next to `index.html` from `config.example.json`, with
   **this landing's own id** from the CRM. Never 8 (dev) and never another
   landing's id: registrations would be counted on that landing.
3. If the production API host is not under `jack-pot.tech` or `jack-pot.com`,
   add it to `connect-src` in the CSP `<meta>` in `index.html`.
4. Register the live domain on the reCAPTCHA key and in CORS for the landing
   and registration endpoints.
5. On the live URL the console must show no `[platform]` warning and no CSP
   refusal; then do one real registration.
6. Every change to `css/main.css`, `js/app.js` or `js/platform.js` bumps the `?v=` on all three
   references in `index.html` (one shared value, e.g. `?v=20261108.2`). Without it browsers keep
   the old file from cache (GitHub Pages sends `max-age=600`).

## Open

- Footer legal text: Figma's line names another operator (Wettzo,
  flashdashcasino.com). The page shows "18+ only. Please gamble responsibly."
  until Jackpot's licence text arrives.
