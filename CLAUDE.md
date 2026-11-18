# Azan Clock

A home prayer clock that runs as a web page on a wall or countertop tablet in kiosk mode.
It replaces a commercial azan frame. Two goals drive every decision:

1. It must feel very smooth and fluid on cheap hardware.
2. It must be easy to add features to over time.

## Current state

Roadmap steps 1, 2 and 3 are done, and part of step 4 (adhkar and the dua after the adhan).
The app is `index.html` plus ES modules (layout below and in `README.md`). The original single-file prototype is kept in `reference/azan-clock.html` for
comparison; `tests/browser/compare-with-prototype.cjs` diffs the two.

What it does today:

- Computes prayer times on the device with adhan-js 4.4.6 (vendored in `vendor/`), with a small
  built-in solar calculation as fallback if that file fails to load.
- Shows a large clock, Gregorian and Hijri dates (Hijri day rolls over at Maghrib), a countdown to
  the next prayer, then a countdown to iqamah once the adhan has been called.
- Shows six columns (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha) with adhan and iqamah times, and a
  midnight-to-midnight day bar with a marker for now.
- Plays the adhan at each prayer time. Source order: a recording chosen in settings (stored in
  IndexedDB), then `assets/audio/adhan.mp3` / `adhan-fajr.mp3`, then a synthesized chime.
- Background: Islamic art from The Met (12 CC0 works in `assets/backgrounds/`), crossfading
  every 10 minutes under a dark scrim; or the sky gradient that follows the real sun.
- Reminder slides (full screen, small clock and countdown in the corner) every 10 minutes, 30 s each:
  hadith, Quran verses (Pickthall translation), Names of Allah, and morning / evening adhkar in
  their time. The dua after the adhan shows when the adhan screen closes; an after-prayer dhikr
  when the prayer is over. Quiet from a minute before each adhan until 15 minutes after iqamah,
  and while the screen is dimmed. Content is JSON in `assets/content/` (see its README).
- Reminders before each of the five prayers at 30, 15, 10 and 5 minutes (each can be turned
  off): a banner drops in at the top with the iqamah time and a soft chime plays; the last one
  stays until the adhan with a live countdown (`pre-prayer.js`).
- Settings panel (gear icon), saved in localStorage: location, method, Asr school, per-prayer
  sound / iqamah / minute adjustment, Jumu'ah time, Hijri adjustment, 12/24h, night dimming.
- Optional masjid feed: a Mawaqit mosque ID or a JSON feed URL. The masjid's iqamah times (and
  optionally adhan times) override the manual ones. Falls back to manual values on failure.
- Kiosk details: small pixel shift each minute against burn-in, night dimming from an hour after
  Isha to half an hour before Fajr, wake lock, hidden cursor when idle.
- Works offline after the first visit (`sw.js`, network first for this site, so a git push shows
  up on the next page load).
- Updates itself: `.github/workflows/publish.yml` publishes to GitHub Pages after the unit tests
  pass and writes `version.json`; `updates.js` checks it every 30 minutes and reloads only at a
  quiet time (no adhan within 30 minutes, not before 15 minutes after iqamah, nothing showing,
  and not when sound was unlocked by a tap, since a reload would lock it again).
- Settings from a computer: an optional `settings.json` (see `settings.example.json`) is applied
  when its content changes (`settings-file.js`); tablet changes stay until the file changes.
- Kiosk autoplay: the adhan player is a static `<audio id="adhanPlayer">` in `index.html`
  (Fully Kiosk's "Autoplay audio" covers only static tags), and the page probes at start, so a
  kiosk that allows autoplay needs no tap.

### How the code is organized

- `js/main.js` boots everything and documents the feature interface and `ctx`. Features are
  plain objects: `{ id, defaults, mount(ctx), start(ctx), onDayChange(now), onTick(now),
  onMinute(now), settings }`. `js/features/index.js` lists the enabled ones in mount order.
- `ctx`: `cfg`, `config` (store), `bus`, `slot(name)`, `provide/use` for services, `refresh()`.
  Services: `times` (prayer-times.js: `today`, `tomorrow`, `iqamah`, `name`, `current`),
  `feed` (masjid-feed.js), `adhan` (adhan-audio.js: `fire`, `hide`, `unlock`),
  `background` (backgrounds.js: `current()`), `nightDim` (night-dim.js: `isDimmed()`),
  `prePrayer` (pre-prayer.js: `active()`). The `adhan` service also has `remind()`, the soft chime,
  and `sound()`: 'autoplay', 'tapped' or 'locked'.
  Bus events: `config:change`, `adhan:start`, `adhan:end`, `prayer:soon`. `ctx.precache(urls)` asks the
  service worker to keep files offline.
- Each feature builds its own markup into a named slot of `index.html` and contributes its own
  settings fields; the format is documented at the top of `js/features/settings.js`.
- `js/core/time.js` ticks once per second on the second boundary.
- Overlays open and close with `openLayer` / `closeLayer` from `js/core/dom.js`.
- Config is still stored under `azan-clock-config-v1` in the same shape as the prototype.

Defaults: Queens, New York (40.7282, -73.7949), ISNA 15/15, standard Asr (1x shadow).

## Decisions already made

- Plain JavaScript ES modules. No build step, no framework, no TypeScript. One file per feature.
- Hosted from a Git repo (GitHub Pages or Cloudflare Pages). The tablet loads the URL, a git push
  updates it, and a service worker keeps it working offline after the first load.
- Target device is a low-end Android tablet (Fire HD 8 class) running Fully Kiosk Browser, so the
  performance budget is tight.
- Use maintained open source for the parts that benefit from it: adhan-js for calculation.
  Vendor it into the repo rather than relying on the CDN once the project is hosted.

## Roadmap, in order

1. **Restructure into modules.** Done. The shape below was the suggestion; the actual layout is
   in `README.md` (adds `countdown.js`, `dates.js`, `day-bar.js`, `prayer-panel.js`,
   `pattern.js`, `burn-in.js`, `kiosk.js`; `hijri.js` became `dates.js`).

   ```
   index.html
   css/           tokens.css, layout.css, one file per feature where needed
   js/core/       config.js (store + defaults), time.js (tick, day change, events), bus.js
   js/features/   prayer-times.js, clock.js, sky.js, hijri.js, adhan-audio.js,
                  masjid-feed.js, night-dim.js, settings.js
   js/features/index.js   the list of enabled features
   vendor/        adhan.umd.min.js
   assets/        audio/, backgrounds/
   sw.js          offline cache
   tests/         prayer-times.test.mjs (node --test)
   ```

   Each feature exports the same small interface, for example
   `{ id, defaults, mount(ctx), onTick(now), onMinute(now), onDayChange(now), settings }`,
   and `ctx` gives it the config store, the event bus and named layout slots. Adding a feature
   should mean adding one file and one line in `js/features/index.js`.

2. **Animation pass** (see Performance rules). Done: no backdrop-filter, highlight and adhan
   glow animate opacity / transform only, day-bar marker moves by transform, status line
   rewrites only the number, overlays fade (sheet slides), reduced motion respected. Still to
   do: check smoothness on the real tablet.
3. **Cycling backgrounds.** Done for Islamic art (`backgrounds.js`); the sky gradient is the
   other mode. Photography could be added the same way if the owner supplies or licenses it.
4. **Quran and audio.** Adhkar and the dua after the adhan are done as reminder slides
   (`slides.js`). Still to do: a Quran player and any recited audio.
5. **Masjid content.** Reliable iqamah sync, announcements, Jumu'ah, Ramadan timetable.

## Performance rules

- Animate only `transform` and `opacity`. Never animate layout properties or gradients.
- No `backdrop-filter` or large blurs. The prototype uses blur on the prayer panel and the adhan
  overlay; replace it with flat translucent fills.
- Move the day-bar marker with `transform`, not `left`.
- Update text only when its value changes. The prototype rewrites the status line four times a
  second; tick once per second, aligned to the second boundary.
- Crossfade backgrounds with two stacked layers and opacity. Decode the next image before fading
  (`img.decode()`), and ship images sized to the panel (about 1920 px wide, WebP or AVIF), not
  originals.
- Give overlays (adhan screen, settings sheet) enter and exit transitions; today they pop.
- Respect `prefers-reduced-motion`.
- Check smoothness on the real tablet, not on a laptop.

## Constraints and known gaps

- **Autoplay.** Browsers block sound until a user gesture. The kiosk must enable audio autoplay
  (a Fully Kiosk setting, or Chromium's `--autoplay-policy=no-user-gesture-required`). The page
  shows a "Tap to enable adhan sound" button when sound is locked.
- **Adhan recording:** `assets/audio/adhan.mp3` (Ahmed Al-Haddad, supplied by the owner) plays at
  every prayer, Fajr included; browser tests check it. Not yet heard on the target hardware.
- **Mawaqit sync is untested against the live site.** It was only tested against a simulated
  mosque page. A browser will refuse to load mawaqit.net cross-origin unless the kiosk permits
  it. Once hosted on Cloudflare Pages, a small Pages Function can fetch the feed server-side.
  Do not build anything that impersonates a browser or works around Mawaqit's protections;
  prefer their official API with the owner's own access token.
- **Which platform the owner's masjid uses (Masjidal, Mawaqit, neither) is still unknown.** Ask
  before investing in sync.
- **Background images must be licensed for this use**: the owner's own, public domain, or CC0.
  Record the source and license of each image in `assets/backgrounds/README.md`.
- Time zone comes from the device. Prayer timestamps are absolute, so DST is handled.
- **Updates need a page load.** `updates.js` reloads at quiet times once `version.json` changes
  (only on the published site). If sound was unlocked by a tap it never reloads, because that
  would lock sound again; then Fully Kiosk's scheduled reload or Remote Admin does it.
- **Hardware chosen (Nov 2026):** a Samsung Galaxy Tab A11 (8.7", SM-X133, international) on a
  desk stand, with Fully Kiosk Browser (PLUS for Remote Admin). Check the layout on it. Turn on
  Protect battery. Repository: github.com/aiazza/my-adhan-clock; site: https://aiazza.github.io/my-adhan-clock/
- **Bundled mp3 files are not cached offline** (media uses range requests; the worker skips
  them). Recordings chosen in settings live in IndexedDB and do work offline.
- **Fallback calculation** lacks adhan-js's +1 minute Dhuhr adjustment, so its Dhuhr can be up
  to 2 minutes early. It only runs if `vendor/adhan.umd.min.js` fails to load.
- **Reminder English needs review.** The Arabic in `assets/content/` was checked word for word
  against the hadith and Quran datasets named in its README; the English for hadith, duas and
  names was written for this project. The owner's imam or a teacher should review it.
- **Network**: this cloud environment allows `collectionapi.metmuseum.org` and
  `images.metmuseum.org` (for picking art); hadith and Quran data came from
  raw.githubusercontent.com (fawazahmed0/hadith-api and quran-api).
- Google Fonts are still loaded from Google (cached by the worker). Vendoring them into `assets/`
  would remove the first-visit dependency.

## Tests to keep

`npm test` runs `tests/prayer-times.test.mjs` (table below, Hanafi, Hijri, iqamah rules) and
`tests/slides.test.mjs` (content files complete, quiet times, adhkar windows, rotation,
reminders before prayers) and `tests/updates.test.mjs` (quiet-time reload rule, settings.json
merge). `node tests/browser/behavior.cjs` runs 76 browser checks with a fake clock (needs Playwright and
`python3 -m http.server 8080`).

ISNA, standard Asr. Computed times should match within one minute:

| Place and date | Fajr | Sunrise | Dhuhr | Asr | Maghrib | Isha |
|---|---|---|---|---|---|---|
| Bronx (40.8448, -73.8648), 2026-11-05 | 5:13 | 6:31 | 11:40 | 2:24 | 4:46 | 6:04 |
| New York (40.7128, -74.006), 2026-07-01 | 3:50 | 5:29 | 1:01 | 5:00 | 8:31 | 10:10 |
| Queens (40.7282, -73.7949), 2026-04-04 | 5:16 | 6:33 | 12:59 | 4:35 | 7:23 | 8:41 |

Hanafi Asr for the Queens row is 5:31. 16 November 2026 is 6 Jumada II 1448 before Maghrib.

## Next session

Check the clock on the real tablet: smoothness of the art crossfade and slide fades, autoplay,
a real adhan recording. Get the reminder English reviewed. Then the rest of step 4 (Quran
player) or step 5, after asking which masjid platform the owner uses.
