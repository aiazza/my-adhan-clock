/* Safe automatic updates. When the site is published (see .github/workflows/publish.yml) a
   version.json with the commit id goes up with it. Every 30 minutes the clock reads that file;
   if it changed, the clock reloads itself at the next quiet moment, so a new feature reaches
   the tablet without anyone touching it.

   A quiet moment is when all of these hold:
   - no adhan within the next 30 minutes, and not from a minute before an adhan until 15
     minutes after its iqamah (the same quiet time the reminder slides keep)
   - no adhan screen, reminder, banner or settings sheet is showing
   - sound will survive the reload: the kiosk allows autoplay, or sound was locked anyway.
     If sound was unlocked by a tap, a reload would lock it again, so the clock waits for the
     kiosk's own scheduled reload instead.

   Without version.json (a local copy, or offline) nothing happens. Turned off in settings
   with "Update automatically". */
import { $ } from '../core/dom.js';
import { FIVE } from './prayer-times.js';
import { quietWindow } from './slides.js';

const VERSION_URL = 'version.json';
export const CHECK_MS = 30 * 60000;
export const BEFORE_ADHAN_MS = 30 * 60000;

/* The next adhan of the five prayers after `now`. */
export function nextAdhan(now, today, tomorrow) {
  for (const k of FIVE) if (today[k] > now) return today[k];
  return tomorrow.fajr;
}

/* Whether reloading now is safe. s: { nextAdhan: Date, quiet: bool, showing: bool, sound } */
export function safeToReload(now, s) {
  if (s.sound === 'tapped' || s.showing || s.quiet) return false;
  return s.nextAdhan - now > BEFORE_ADHAN_MS;
}

let ctx = null;
let base = null;        // version this page was loaded with
let pending = false;    // a newer version is published
let lastCheck = 0;

function fetchVersion() {
  return fetch(VERSION_URL, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j && j.version ? String(j.version) : null))
    .catch(() => null);
}

function check() {
  lastCheck = Date.now();
  return fetchVersion().then((v) => {
    if (!v) return;
    if (base === null) base = v;
    else if (v !== base) pending = true;
  });
}

function showing() {
  const open = (id) => { const el = $(id); return !!el && !el.hidden; };
  const pre = ctx.use('prePrayer');
  return open('adhan') || open('sheet') || open('slide') || !!(pre && pre.active());
}

function state(now) {
  const times = ctx.use('times');
  const t = times.today(now);
  const audio = ctx.use('adhan');
  return {
    nextAdhan: nextAdhan(now, t, times.tomorrow(now)),
    quiet: !!quietWindow(now, t, (k) => times.iqamah(k, t)),
    showing: showing(),
    sound: audio && audio.sound ? audio.sound() : 'locked'
  };
}

export default {
  id: 'updates',
  defaults: { autoUpdate: true },
  mount(c) { ctx = c; },
  start() { check(); },
  onMinute(now) {
    if (!ctx.cfg.autoUpdate) return;
    if (!pending && Date.now() - lastCheck >= CHECK_MS) { check(); return; }
    if (pending && safeToReload(now, state(now))) location.reload();
  },
  settings: [{
    section: 'display', order: 90,
    grid: '<label class="check wide" for="s-autoupdate"><input type="checkbox" id="s-autoupdate">Update automatically when a new version is published</label>',
    after: '<p class="hint">The clock checks every 30 minutes and reloads only at a quiet time: never in the half hour ' +
      'before an adhan, nor until 15 minutes after iqamah, nor while anything is showing.</p>',
    fill(cfg) { $('s-autoupdate').checked = !!cfg.autoUpdate; },
    read(d) { d.autoUpdate = $('s-autoupdate').checked; }
  }]
};
