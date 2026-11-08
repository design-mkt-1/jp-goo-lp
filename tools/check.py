"""One check for the whole page, no real request leaves the machine.

  python tools/check.py            (serves the repo itself on a free port)

1. Smoke: 390, 320 and 1440 wide, no console error, no horizontal scroll,
   the offer and the wheel are inside the first screen.
2. Platform: IT's API, ipify and reCAPTCHA are stubbed. Spin, claim, submit,
   then assert the registration body has IT's shape and that the SSO form is
   POSTed to <host>/api/welcome with tmpToken + redirect.
3. Errors: an "Email already registered" answer is shown under the email field.

Needs: pip install playwright && python -m playwright install chromium
"""
import functools
import http.server
import json
import socketserver
import sys
import threading
from pathlib import Path
from urllib.parse import parse_qs

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
API = 'https://api2-land-dev.jack-pot.tech'
CASINO = 'https://casino.example'
LANDING = {'data': {
    'active': True, 'recaptcha_key': 'test-key', 'country': 'AU', 'currency': 'AUD',
    'promocode': 'WHEEL200', 'rules': CASINO + '/rules', 'policy': CASINO + '/policy',
    'login': CASINO + '/login', 'redirect_link': 'casino'}}
GRECAPTCHA = ('window.grecaptcha={ready:function(f){f()},'
              'execute:function(){return Promise.resolve("tok-123")}};')


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = functools.partial(Quiet, directory=str(ROOT))
    httpd = socketserver.TCPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, 'http://127.0.0.1:%d/' % httpd.server_address[1]


def stub(page, register):
    page.route(API + '/api/jp/landing/8', lambda r: r.fulfill(json=LANDING))
    page.route(API + '/api/jp/registration/email', register)
    page.route('https://api.ipify.org/**', lambda r: r.fulfill(json={'ip': '203.0.113.9'}))
    page.route('https://www.google.com/recaptcha/**',
               lambda r: r.fulfill(body=GRECAPTCHA, content_type='text/javascript'))


def main():
    httpd, url = serve()
    fails = []
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # 1. smoke
        for w, h in ((390, 844), (320, 568), (1440, 900)):
            page = browser.new_page(viewport={'width': w, 'height': h})
            errors = []
            page.on('console', lambda m: m.type == 'error' and errors.append(m.text))
            page.on('pageerror', lambda e: errors.append(str(e)))
            stub(page, lambda r: r.abort())
            page.goto(url)
            page.wait_for_load_state('networkidle')
            scroll = page.evaluate('document.documentElement.scrollWidth - innerWidth')
            offer = page.locator('#offer').bounding_box()
            wheel = page.locator('#wheel').bounding_box()
            if errors: fails.append('%d: console %s' % (w, errors))
            if scroll > 0: fails.append('%d: horizontal scroll %dpx' % (w, scroll))
            if offer['y'] + offer['height'] > h: fails.append('%d: offer below the fold' % w)
            if wheel['y'] > h / 2: fails.append('%d: wheel starts below half the screen' % w)
            small = page.evaluate('''[...document.querySelectorAll('button, a[href], .consent')]
                .filter(e => e.offsetParent)
                .map(e => [e.textContent.trim().slice(0, 20) || e.getAttribute('aria-label'), e.getBoundingClientRect().height])
                .filter(([, h]) => h < 44)''')
            if small: fails.append('%d: controls under 44px %s' % (w, small))
            page.close()

        # 2. platform, happy path
        page = browser.new_page(viewport={'width': 390, 'height': 844})
        seen = {}

        def register(route):
            seen['body'] = json.loads(route.request.post_data)
            route.fulfill(json={'data': {'accessToken': 'acc-1'}})

        def welcome(route):
            seen['sso'] = (route.request.url, parse_qs(route.request.post_data))
            route.fulfill(body='ok')

        stub(page, register)
        page.route(CASINO + '/api/welcome', welcome)
        page.goto(url + '?utm_source=test&email=evil@x.io')
        page.wait_for_load_state('networkidle')
        page.click('#spin')
        page.wait_for_selector('#win[open]', timeout=8000)
        page.click('#claim')
        page.fill('#email', 'mate@example.com.au')
        page.fill('#password', 'hunter22')
        page.click('#form [type=submit]')
        page.wait_for_timeout(1500)

        body = seen.get('body') or {}
        want = {'email': 'mate@example.com.au', 'password': 'hunter22', 'landing_id': 8,
                'language': 'en', 'currency': 'AUD', 'country': 'AU', 'promocode': 'WHEEL200',
                'receivePromos': True, 'clientIp': '203.0.113.9',
                'g-recaptcha-response': 'tok-123', 'utm_source': 'test'}
        for k, v in want.items():
            if body.get(k) != v: fails.append('body.%s = %r, want %r' % (k, body.get(k), v))
        sso_url, form = seen.get('sso', ('', {}))
        if sso_url != CASINO + '/api/welcome': fails.append('SSO went to %r' % sso_url)
        if form.get('tmpToken') != ['acc-1']: fails.append('tmpToken %r' % form.get('tmpToken'))
        if form.get('redirect') != [CASINO + '/en/casino?utm_source=test&email=evil@x.io']:
            fails.append('redirect %r' % form.get('redirect'))
        page.close()

        # 3. email taken + links from the landing response
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        stub(page, lambda r: r.fulfill(status=422, json={'errors': ['Email already registered. Please use a different email or login.']}))
        page.goto(url)
        page.wait_for_load_state('networkidle')
        if page.get_attribute('[data-link="terms"]', 'href') != CASINO + '/rules':
            fails.append('terms link not taken from the landing response')
        page.click('#spin')
        page.wait_for_selector('#win[open]', timeout=8000)
        page.click('#claim')
        page.fill('#email', 'taken@example.com')
        page.fill('#password', 'hunter22')
        page.click('#form [type=submit]')
        page.wait_for_timeout(1500)
        msg = page.text_content('#email-err span')
        if msg != 'This email is already registered': fails.append('email-taken message %r' % msg)
        page.close()
        browser.close()
    httpd.shutdown()

    for f in fails: print('FAIL', f)
    print('all checks passed' if not fails else '%d failure(s)' % len(fails))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
