/* Optional masjid feed. Provides the 'feed' service: feed.forDay(date) returns
   { name, iq: { fajr..isha } | null, times: { fajr..isha } | null, jumuah } or null.

   Accepts either a Mawaqit mosque ID (the last part of its mawaqit.net address) or a URL.
   Understood shapes:
     1. Mawaqit: { name, times, shuruq, jumua, iqamaCalendar: [month][day] -> 5 values, calendar: [month][day] -> 6 values }
        either as JSON or embedded in the mosque page as "confData = {...}".
     2. Your own: { "name": "My masjid", "iqamah": { "fajr": "+20", "dhuhr": "13:15", ... }, "jumuah": "13:15",
                    "times": ["05:24","06:43","11:41","14:15","16:36","17:55"] }   (times optional)
   Iqamah values are "+minutes" after the adhan or a fixed "HH:MM".
   The last good copy is kept in localStorage and used when a sync fails. */
import { dayKey, formatTime } from '../core/format.js';
import { $ } from '../core/dom.js';
import { SIX, FIVE } from './prayer-times.js';

const FEED_STORE = 'azan-clock-feed-v1';
const RESYNC_MS = 6 * 3600000;

export function feedUrl(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : 'https://mawaqit.net/en/' + encodeURIComponent(v);
}

export function extractJson(text) {
  try { return JSON.parse(text); } catch (e) {}
  const m = /confData\s*=\s*/.exec(text);
  if (!m) return null;
  const i = m.index + m[0].length;
  let depth = 0, inStr = false, esc = false;
  if (text.charAt(i) !== '{') return null;
  for (let j = i; j < text.length; j++) {
    const c = text.charAt(j);
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; }
    else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) { try { return JSON.parse(text.slice(i, j + 1)); } catch (e) { return null; } } }
  }
  return null;
}

/* Keep only the fields we use, tagged with the day it was fetched and the feed setting. */
export function slimFeed(o, src, today) {
  if (Array.isArray(o)) o = o[0];
  if (!o || typeof o !== 'object') return null;
  const keep = {};
  let any = false;
  ['name', 'label', 'iqamaCalendar', 'calendar', 'iqama', 'iqamah', 'times', 'shuruq', 'jumua', 'jumuah'].forEach((k) => {
    if (o[k] !== undefined && o[k] !== null) { keep[k] = o[k]; if (k !== 'name' && k !== 'label') any = true; }
  });
  if (!any) return null;
  keep._day = dayKey(today || new Date());
  keep._src = String(src || '').trim();
  return keep;
}

/* Today's values from a slimmed feed. Calendars cover every day; flat lists only the fetch day. */
export function feedDay(raw, date) {
  const mo = date.getMonth(), d = date.getDate(), same = raw._day === dayKey(date);
  let iq = null, times = null;
  const pick = (cal) => { const m = Array.isArray(cal) ? cal[mo] : null; return m ? (m[d] || m[String(d)] || null) : null; };
  const a = pick(raw.iqamaCalendar) || (same && Array.isArray(raw.iqama) ? raw.iqama : null);
  if (Array.isArray(a) && a.length >= 5) { iq = {}; FIVE.forEach((k, i) => { iq[k] = a[i]; }); }
  else if (raw.iqamah && typeof raw.iqamah === 'object') { iq = {}; FIVE.forEach((k) => { iq[k] = raw.iqamah[k]; }); }
  const t = pick(raw.calendar) || (same && Array.isArray(raw.times) ? raw.times : null);
  if (Array.isArray(t) && t.length === 6) { times = {}; SIX.forEach((k, i) => { times[k] = t[i]; }); }
  else if (Array.isArray(t) && t.length === 5) { times = { sunrise: raw.shuruq }; FIVE.forEach((k, i) => { times[k] = t[i]; }); }
  return { name: raw.name || raw.label || 'masjid feed', iq, times, jumuah: raw.jumua || raw.jumuah || '' };
}

let ctx = null;
let raw = null;       // slimmed feed currently in use
let memo = null;      // { key, raw, val } for forDay
let status = '';      // shown in settings
let syncDay = '';     // day of the last sync attempt

const source = () => String(ctx.cfg.feed || '').trim();

function showStatus() { const el = $('s-feed-status'); if (el) el.textContent = status; }

function sync() {
  const url = feedUrl(ctx.cfg.feed);
  syncDay = dayKey(new Date());
  if (!url) { raw = null; status = ''; showStatus(); return Promise.resolve(); }
  return fetch(url, { cache: 'no-store' }).then((r) => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  }).then((text) => {
    const slim = slimFeed(extractJson(text), source());
    if (!slim) throw new Error('no timetable in the response');
    raw = slim; memo = null;
    const now = formatTime(new Date(), ctx.cfg.hour24);
    status = 'Synced with ' + (slim.name || slim.label || 'the feed') + ' at ' + now.t + (now.ap ? ' ' + now.ap : '') + '.';
    try { localStorage.setItem(FEED_STORE, JSON.stringify(slim)); } catch (e) {}
    ctx.refresh();
  }).catch((err) => {
    status = 'Could not load the feed (' + ((err && err.message) || 'request blocked') + '). ' +
      (raw ? 'Showing the last synced copy.' : 'Using your manual iqamah times.');
  }).then(showStatus);
}

export default {
  id: 'masjid-feed',
  defaults: { feed: '', feedTimes: false },
  mount(c) {
    ctx = c;
    try { raw = JSON.parse(localStorage.getItem(FEED_STORE) || 'null'); } catch (e) { raw = null; }
    if (raw && raw._src !== source()) raw = null;
    ctx.provide('feed', {
      forDay(date) {
        if (!raw || !source()) return null;
        const key = dayKey(date);
        if (memo && memo.key === key && memo.raw === raw) return memo.val;
        memo = { key, raw, val: feedDay(raw, date) };
        return memo.val;
      },
      sync
    });
    ctx.bus.on('config:change', (e) => {
      if (!e.saved) return;
      if (e.reset) { raw = null; memo = null; status = ''; return; }
      if (!raw || raw._src !== source()) { raw = null; memo = null; }
      sync();
    });
  },
  start() {
    sync();
    setInterval(sync, RESYNC_MS);
  },
  onDayChange(now) {
    if (syncDay && syncDay !== dayKey(now)) sync();
  },
  settings: [{
    section: 'feed', order: 10,
    grid: '<label class="wide" for="s-feed">Mawaqit mosque ID, or the address of a JSON feed<input type="text" id="s-feed" placeholder="astoria-queens or https://example.org/iqamah.json" autocapitalize="off" spellcheck="false"></label>' +
      '<label class="check wide" for="s-feedtimes"><input type="checkbox" id="s-feedtimes">Use the masjid\'s adhan times too, not only its iqamah times</label>',
    after: '<p class="hint" id="s-feed-status"></p>' +
      '<p class="hint">When this is set, the masjid\'s iqamah times replace the ones in the table below. A browser only loads mawaqit.net directly if the kiosk allows cross-site requests; otherwise point this at a JSON feed you host.</p>',
    fill(cfg) {
      $('s-feed').value = cfg.feed || '';
      $('s-feedtimes').checked = !!cfg.feedTimes;
      $('s-feed-status').textContent = status;
    },
    read(d) { d.feed = $('s-feed').value.trim(); d.feedTimes = $('s-feedtimes').checked; }
  }]
};
