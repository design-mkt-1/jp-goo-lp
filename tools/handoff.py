#!/usr/bin/env python3
"""Zip exactly what a server should serve, plus a note for IT.

    python tools/handoff.py          # -> dist/jp-goo-lp-<date>.zip

The file list is READ from the `cp -r ... _site/` line in
.github/workflows/pages.yml, the same allowlist GitHub Pages publishes, so
there is one list to keep, not two. Pattern from tw-lp-template tools/handoff.py.
"""
import datetime as dt
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NEVER = ('tools', 'out', 'dist', '.git', '.github', 'config.json')

README = """# jp-goo-lp: for whoever hosts this

Jackpot landing, Australia ("Spin & win your pokies bonus, 200% + 100 FS").
Static files: no build step, no server code. Upload the contents of this
archive and open index.html. All paths are relative, so a subfolder works.

Source: https://github.com/design-mkt-1/jp-goo-lp
Preview (not connected): https://design-mkt-1.github.io/jp-goo-lp/

## 1. config.json: WITHOUT IT THE PAGE IS NOT CONNECTED

Write config.json next to index.html, with THIS landing's own id:

    { "id": <landing_id for this landing>,
      "email_registration": "https://<api host>/api/jp/registration/email",
      "landing": "https://<api host>/api/jp/landing/<the same id>" }

Never id 8 (your dev landing) or another landing's id: registrations would be
counted there with no visible error. Without config.json the form still
validates, then shows "Preview build: registration is not connected yet." and
the console says "[platform] config.json not found".

On localhost, 127.0.0.1 or https://land-crm... the page uses your dev landing 8
(api2-land-dev.jack-pot.tech) instead, as your reference landing does.

## 2. The flow (js/platform.js, same as your _js/main.js)

1. GET config.landing. data.active false -> "Page disabled" dialog with
   support@jack-pot.com. Otherwise Terms / Privacy / Log in links come from
   rules / policy / login, reCAPTCHA v3 loads with recaptcha_key, and
   analytics_google / analytics_yandex / gtm_tag are injected if present.
2. Submit: reCAPTCHA token (action "register"), IP from api.ipify.org, then
   POST config.email_registration with
       { email, password, landing_id, language: "en", currency, country,
         promocode, receivePromos: true, clientIp, "g-recaptcha-response",
         ...page URL params (spread first, cannot overwrite these fields) }
3. Success: data.accessToken is POSTed as tmpToken + redirect to
   <origin of data.redirectUrl>/api/welcome; without redirectUrl, to
   <host of rules>/api/welcome with redirect <host>/en/<redirect_link>.
4. Errors { errors: [msg] }: "already registered" shows under the email field,
   reCAPTCHA failures get their own message, anything else a generic line.

Email + password only: the Phone tab in the design is not built, the API has
registration/email only.

## 3. What you have to check

1. Content-Security-Policy <meta> in index.html: connect-src allows
   *.jack-pot.tech and *.jack-pot.com. If the production API host is elsewhere,
   add it, or every request is refused (visible only in the console).
2. The reCAPTCHA v3 key must be registered for this page's domain.
3. CORS on the landing and registration endpoints for this domain (the GET
   sends Content-Type: application/json, so there is a preflight).
4. On the live URL: no "[platform]" warning, no CSP refusal, then one real
   registration end to end.

The reCAPTCHA badge is hidden; the Google attribution text is in the form.

## 4. Open

The footer legal line is a placeholder ("18+ only. Please gamble responsibly.").
Jackpot's licence text is still to come.
"""


def allowlist():
    text = (ROOT / '.github' / 'workflows' / 'pages.yml').read_text(encoding='utf-8')
    m = re.search(r'cp -r (.+?) _site/', text)
    if not m:
        sys.exit('handoff: no `cp -r ... _site/` line in pages.yml')
    return m.group(1).split()


def main():
    out = ROOT / 'dist'
    out.mkdir(exist_ok=True)
    path = out / ('jp-goo-lp-%s.zip' % dt.date.today().isoformat())
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for entry in allowlist():
            p = ROOT / entry
            files = [p] if p.is_file() else sorted(f for f in p.rglob('*') if f.is_file())
            for f in files:
                z.write(f, f.relative_to(ROOT).as_posix())
        z.writestr('README-IT.md', README)
    names = zipfile.ZipFile(path).namelist()
    assert 'index.html' in names, 'no index.html in the archive'
    leaked = [n for n in names if n.split('/')[0] in NEVER]
    assert not leaked, 'archive contains ' + ', '.join(leaked)
    print('handoff: %s, %d files, %d kB' % (path.relative_to(ROOT).as_posix(), len(names), path.stat().st_size // 1024))


if __name__ == '__main__':
    main()
