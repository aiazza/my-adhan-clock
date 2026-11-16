# Azan Clock

A home prayer clock that runs as a web page on a wall or countertop tablet in kiosk mode.
Plain JavaScript modules, no build step. See `CLAUDE.md` for goals, decisions and the roadmap.

## Run it

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080/. A static host (GitHub Pages, Cloudflare Pages) serves the
repository as is. The service worker only runs over http(s), not from `file://`.

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
assets/backgrounds/     background images (with license records)
sw.js                   offline cache
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
