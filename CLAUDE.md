# jp-goo-lp: working rules

## Figma fidelity (owner rule, 2026-11-08)

The GitHub Pages build must look as close to Figma as possible, and it must look good.
When the two pull apart (for example Figma uses a gold wheel rim on mobile and a silver one
on desktop), do not choose silently: show the owner A/B variants (A = Figma exact,
B = adjusted) at phone and desktop width, and the owner picks.

This file is meant to be carried into the Jackpot landing template when it is extracted.

## How visual work runs

- Through Orca workers (Claude), coordinated from the main session.
- `design-taste-frontend` and `ui-ux-pro-max` are applied, not only loaded: every worker
  report ends with a pre-flight table per screen (cards only for hierarchy, one button
  style per block, one accent colour, one radius scale, no em-dash in visible text,
  44 px controls, one baseline, contrast, main content in the first screen at 390 and 320).
- Comparisons are shot at the Figma frame width (375, 1440) plus 390 and 320.
- Scratch output (screenshots, audits, variants) goes in `out/` (gitignored).
- Cache-busting: every change to `css/` or `js/` bumps the `?v=` on its `<link>`/`<script>` in `index.html` (all three share one value, e.g. `?v=20261108.2`); Pages caches for 10 minutes and Chrome otherwise keeps the old file.

## Real-browser check (owner rule, 2026-11-08)

Code checks and Playwright shots are not enough. Every fix round, and again after every push,
open the page in Chrome (Claude in Chrome) and walk every screen: main, spinning, win, register,
form error. Do it at phone 320 / 375 / 390 and desktop 1366, 1440, 1536, 1920 and a wide screen.
Look at each one, compare with Figma, and report per screen and size what was seen. Figma's
frame width (1440) alone hid a broken hero on a 1900 px screen.

## Figma map

File `2MyylxdZblfGnf05nQacUz`, section `128:1956` (AU · Wheel of Fortune).

| screen | node |
|---|---|
| Mobile main | `128:4350` |
| Mobile win | `128:2288` |
| Mobile register | `128:2536` |
| Desktop main | `128:4767` |
| Desktop win | `128:2765` |
| Desktop register | `128:3018` |
| Register form variants | `128:3253` |
| Wheels mobile / desktop | `128:3806` / `128:4026` |
| Language switcher | `128:4246` |
| Button | `128:4327` |

Deliberate gaps (not bugs): Phone tab not built (no phone route on IT's API), language
switcher static, countdown decorative, Figma's legal footer names another operator so the
page shows "18+ only. Please gamble responsibly." until Jackpot's text arrives.
