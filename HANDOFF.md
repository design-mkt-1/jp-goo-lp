# Handoff, 2026-11-08 (next: IT archive from another PC)

State: `main` is live on https://design-mkt-1.github.io/jp-goo-lp/ and matches Figma
`128:1956` as far as the owner has decided. Rules for this repo (Figma fidelity, A/B on
conflict, Orca workers + skills, real-Chrome check, `?v=` bump) are in `CLAUDE.md`.
Claude's memory is per machine: on another PC, `CLAUDE.md` is what carries the rules.

## Tomorrow: build the IT archive

```bash
git clone https://github.com/design-mkt-1/jp-goo-lp.git   # or: git pull
cd jp-goo-lp
python tools/check.py </dev/null     # must print "all checks passed" (needs Playwright)
python tools/handoff.py </dev/null   # -> dist/jp-goo-lp-<date>.zip
```

Before sending, open the zip and check: `index.html` loads `css/main.css?v=20261108.2`,
no `config.json`, no `tools/`, `out/`, `.github/`. The zip's README tells IT about
`config.json` and the landing id.

## Done this session

- Audit vs Figma at 320/375/390/1440, then fixes: register dialog scrolls on small
  phones, no second CTA or ring behind dialogs, darker flat backdrop, full-width mobile
  form, "SPINNING…" state, partners in 7 slots, CTA glow centred, no focus ring on X
  when a dialog opens.
- Wide desktop (variant B, owner pick): art spans the width, wheel and text scale with
  `min(vw/1440, vh/940)`; checked in Chrome at 1366, 1536, 1912, 2560.
- Wheel stays gold everywhere (owner, from Figma's Dev · Wheels hand-off).

## Still open

- From IT: real `landing_id`, production API host, Jackpot legal footer text.
- Zamsino and Deutschland logo files are 200x64 and 180x80: soft on retina desktop.
  Re-export @2x from Figma if they should be sharp.
- After a push, `index.html` itself can stay cached up to 10 minutes on Pages
  (`max-age=600`); Ctrl+F5 shows the new build at once.
