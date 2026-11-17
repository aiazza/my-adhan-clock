# Azan Clock

A home prayer clock that runs as a web page on a wall or countertop tablet in kiosk mode.
Plain JavaScript modules, no build step. See `CLAUDE.md` for goals, decisions and the roadmap.

## Run it

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080/. The service worker only runs over http(s), not from `file://`.

## Publish and update

`.github/workflows/publish.yml` publishes to GitHub Pages on every push to `main`, after the
unit tests pass. One-time setup on GitHub: Settings → Pages → Source: **GitHub Actions**.
The workflow also writes `version.json`; the clock checks it every 30 minutes and reloads
itself at a quiet time (`js/features/updates.js`), so a push reaches the tablet on its own.

## Settings from a computer

Put a `settings.json` next to `index.html` (copy `settings.example.json` and keep only the
keys you want). The clock applies it whenever its content changes; anything it leaves out
keeps its current value, and a later change with the gear icon stays until the file changes
again. Iqamah is minutes after the adhan (`"15"`) or a fixed time (`"13:30"`).

## On the tablet (Fully Kiosk Browser)

Start URL: the Pages address. Turn on Keep Screen On, Start on Boot, and Web Content →
**Autoplay Audio**, so the adhan plays with no tap (the player is a static `<audio>` tag in
`index.html` for this reason). Remote Admin (PLUS licence) lets a computer on the same Wi-Fi
reload the page, change the volume or turn the screen off. On a Samsung tablet, turn on
Settings → Battery → Protect battery so it can stay plugged in.

## Test

```bash
npm test
```

Browser checks (need Playwright and the server above):

```bash
node tests/browser/behavior.cjs
```

## Layout

```
index.html              layout slots only; features fill them
css/                    tokens.css, layout.css, one file per feature
js/main.js              boots: builds ctx, mounts features, starts the clock
js/core/                bus.js, config.js (store), time.js (second tick, minute, day change),
                        format.js (pure time helpers), dom.js
js/lib/praycalc.js      built-in fallback calculation
js/features/            one file per feature; index.js lists the enabled ones
vendor/                 adhan-js 4.4.6 (MIT)
assets/audio/           optional adhan.mp3 / adhan-fajr.mp3
assets/backgrounds/     CC0 Islamic art from The Met, index.json lists them (README has licenses)
assets/content/         hadith, Quran, adhkar, Names of Allah for the reminder slides (README)
sw.js                   offline cache
settings.example.json   every config key, for settings.json
.github/workflows/      publish.yml: tests, version.json, GitHub Pages
tests/                  node --test unit tests; browser/ Playwright checks
reference/              the original single-file prototype, kept for comparison
```

## Adding a feature

1. Create `js/features/my-feature.js` exporting an object:

   ```js
   export default {
     id: 'my-feature',
     defaults: { myOption: true },          // config keys it owns
     mount(ctx) { /* build DOM into ctx.slot('center'), listen, ctx.provide(...) */ },
     onTick(now) {},                        // every second, on the second
     onMinute(now) {},                      // every minute
     onDayChange(now) {},                   // new day, or settings / feed changed
     settings: [{ section: 'display', order: 40, grid: '<label>…</label>', fill(cfg) {}, read(draft) {} }]
   };
   ```

2. Add one line to `js/features/index.js`.
3. If it needs styles, add `css/my-feature.css` and a `<link>` in `index.html`.

The full `ctx` and feature interface is documented at the top of `js/main.js`; the settings
contribution format at the top of `js/features/settings.js`.
Use `ctx.use('times')` for prayer times (`today`, `iqamah`, `current`, `name`).
