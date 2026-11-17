/* Prayer times: calculation, iqamah, Jumu'ah, and which prayer is next.
   Provides the 'times' service every other prayer-aware feature uses:
     times.today(now), times.tomorrow(now)   { fajr, sunrise, dhuhr, asr, maghrib, isha } as Dates
     times.iqamah(k, dayTimes)               Date or null
     times.name(k, day)                      ['Fajr', 'الفجر'] (Jumu'ah on Fridays when set)
     times.current(now)                      { live, next, prev, today }
     times.engine                            which calculator produced the times
   The pure functions below are exported for the Node tests. */
import { compute as builtIn } from '../lib/praycalc.js';
import { dayKey, parseClock } from '../core/format.js';
import { $, readNumber } from '../core/dom.js';

export const SIX = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const FIVE = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const NAMES = {
  fajr: ['Fajr', 'الفجر'], sunrise: ['Sunrise', 'الشروق'], dhuhr: ['Dhuhr', 'الظهر'],
  asr: ['Asr', 'العصر'], maghrib: ['Maghrib', 'المغرب'], isha: ['Isha', 'العشاء'],
  jumuah: ["Jumu'ah", 'الجمعة']
};
export const METHOD_LABEL = {
  ISNA: 'ISNA', MWL: 'Muslim World League', Egypt: 'Egyptian Authority', Karachi: 'Karachi',
  Makkah: 'Umm al-Qura', Moonsighting: 'Moonsighting Committee'
};

/* adhan-js (github.com/batoulapps/adhan-js) is vendored in vendor/ and loaded before the app.
   The built-in math is the fallback if it is missing or fails. */
export const ADHAN_VERSION = '4.4.6';
const ADHAN_METHOD = {
  ISNA: 'NorthAmerica', MWL: 'MuslimWorldLeague', Egypt: 'Egyptian', Karachi: 'Karachi',
  Makkah: 'UmmAlQura', Moonsighting: 'MoonsightingCommittee'
};

/* Unrounded epoch milliseconds for the six events on date's local calendar day.
   opts: { lat, lng, method, asr }. A is the adhan-js namespace, or null for the fallback. */
export function rawTimes(date, opts, A) {
  if (A && A.PrayerTimes) {
    try {
      const coords = new A.Coordinates(Number(opts.lat), Number(opts.lng));
      const p = A.CalculationMethod[ADHAN_METHOD[opts.method] || 'NorthAmerica']();
      p.madhab = Number(opts.asr) === 2 ? A.Madhab.Hanafi : A.Madhab.Shafi;
      if (A.HighLatitudeRule && A.HighLatitudeRule.recommended) p.highLatitudeRule = A.HighLatitudeRule.recommended(coords);
      const pt = new A.PrayerTimes(coords, new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12), p);
      const out = {};
      SIX.forEach((k) => { out[k] = pt[k].getTime(); });
      if (!SIX.some((k) => isNaN(out[k]))) return { times: out, engine: 'adhan-js ' + ADHAN_VERSION };
    } catch (e) {}
  }
  const times = builtIn(date.getFullYear(), date.getMonth() + 1, date.getDate(), Number(opts.lat), Number(opts.lng),
    { method: opts.method, asrFactor: Number(opts.asr) });
  return { times, engine: 'built-in fallback' };
}

/* The times shown for a day: rounded to the minute, shifted by the per-prayer adjustment, and
   replaced by the masjid's adhan times when the feed provides them and the setting allows. */
export function dayTimes(date, cfg, A, feed) {
  const r = rawTimes(date, cfg, A);
  const out = {};
  SIX.forEach((k) => {
    let t = Math.round(r.times[k] / 60000) * 60000;
    if (cfg.prayers[k]) t += (Number(cfg.prayers[k].adjust) || 0) * 60000;
    out[k] = new Date(t);
  });
  if (cfg.feedTimes && feed && feed.times) {
    SIX.forEach((k) => { const d = parseClock(feed.times[k], date); if (d) out[k] = d; });
  }
  return { times: out, engine: r.engine };
}

export function jumuahTime(day, cfg, feed) {
  return parseClock(cfg.jumuah, day) || (feed ? parseClock(feed.jumuah, day) : null);
}
export function isJumuah(k, day, cfg, feed) {
  return k === 'dhuhr' && day.getDay() === 5 && !!jumuahTime(day, cfg, feed);
}
/* Iqamah: Jumu'ah time on Fridays, else the masjid feed, else the manual setting.
   Values are "+minutes" / "minutes" after the adhan, or a fixed "HH:MM". */
export function iqamahTime(k, times, cfg, feed) {
  const adhan = times[k];
  if (isJumuah(k, adhan, cfg, feed)) return jumuahTime(adhan, cfg, feed);
  const fv = feed && feed.iq ? feed.iq[k] : null;
  let v = (fv !== null && fv !== undefined && String(fv).trim() !== '') ? fv : cfg.prayers[k].iqamah;
  v = String(v == null ? '' : v).trim().replace(/^\+/, '');
  if (!v) return null;
  if (/[:.]/.test(v)) return parseClock(v, adhan);
  const mins = Number(v);
  return mins > 0 ? new Date(adhan.getTime() + mins * 60000) : null;
}

function createService(ctx) {
  let memo = { key: '', today: null, tomorrow: null };
  let cur = { key: '', val: null };
  let engine = 'built-in';
  const feedFor = (d) => { const f = ctx.use('feed'); return f ? f.forDay(d) : null; };

  /* Recomputed when the day changes or after ctx.refresh() (settings or feed changed). */
  function days(now) {
    const key = dayKey(now) + '#' + ctx.rev;
    if (memo.key !== key) {
      const A = globalThis.adhan;
      const tm = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12);
      const a = dayTimes(now, ctx.cfg, A, feedFor(now));
      const b = dayTimes(tm, ctx.cfg, A, feedFor(tm));
      memo = { key, today: a.times, tomorrow: b.times };
      engine = b.engine;
    }
    return memo;
  }
  const api = {
    get engine() { return engine; },
    today: (now) => days(now).today,
    tomorrow: (now) => days(now).tomorrow,
    iqamah: (k, times) => iqamahTime(k, times, ctx.cfg, feedFor(times[k])),
    isJumuah: (k, day) => isJumuah(k, day, ctx.cfg, feedFor(day)),
    name: (k, day) => (api.isJumuah(k, day) ? NAMES.jumuah : NAMES[k]),
    /* live: the prayer whose adhan has been called and whose iqamah is still ahead.
       next: the next adhan (tomorrow's Fajr after Isha). prev: the last event that passed. */
    current(now) {
      const key = now.getTime() + '#' + ctx.rev;
      if (cur.key === key) return cur.val;
      const t = api.today(now);
      let live = null, next = null, prev = null;
      FIVE.forEach((k) => {
        const q = api.iqamah(k, t);
        if (q && now >= t[k] && now < q) live = { k, at: q };
        if (!next && t[k] > now) next = { k, at: t[k] };
      });
      SIX.forEach((k) => { if (t[k] <= now) prev = t[k]; });
      if (!next) next = { k: 'fajr', at: api.tomorrow(now).fajr };
      cur = { key, val: { live, next, prev, today: t } };
      return cur.val;
    }
  };
  return api;
}

const PRAYER_DEFAULTS = {
  fajr:    { sound: true, iqamah: '20', adjust: 0 },
  dhuhr:   { sound: true, iqamah: '15', adjust: 0 },
  asr:     { sound: true, iqamah: '15', adjust: 0 },
  maghrib: { sound: true, iqamah: '5',  adjust: 0 },
  isha:    { sound: true, iqamah: '15', adjust: 0 }
};

let service = null;

export default {
  id: 'prayer-times',
  defaults: {
    place: 'Queens, New York', lat: 40.7282, lng: -73.7949,
    method: 'ISNA', asr: 1, jumuah: '',
    prayers: PRAYER_DEFAULTS
  },
  mount(ctx) {
    service = createService(ctx);
    ctx.provide('times', service);
  },
  settings: [
    {
      section: 'location', order: 10,
      grid: '<label class="wide" for="s-place">Label shown on the clock<input type="text" id="s-place"></label>' +
        '<label for="s-lat">Latitude<input type="number" id="s-lat" step="0.0001" min="-90" max="90"></label>' +
        '<label for="s-lng">Longitude (west is negative)<input type="number" id="s-lng" step="0.0001" min="-180" max="180"></label>',
      after: '<p class="hint">The time zone comes from this device, so set the device clock and zone correctly.</p>',
      fill(cfg) { ['place', 'lat', 'lng'].forEach((k) => { $('s-' + k).value = cfg[k]; }); },
      read(d) {
        d.place = $('s-place').value.trim();
        d.lat = Math.max(-90, Math.min(90, readNumber('s-lat', d.lat)));
        d.lng = Math.max(-180, Math.min(180, readNumber('s-lng', d.lng)));
      }
    },
    {
      section: 'calculation', order: 10,
      grid: '<label for="s-method">Fajr and Isha angles <select id="s-method">' +
          '<option value="ISNA">ISNA (15&deg; / 15&deg;)</option>' +
          '<option value="MWL">Muslim World League (18&deg; / 17&deg;)</option>' +
          '<option value="Egypt">Egyptian Authority (19.5&deg; / 17.5&deg;)</option>' +
          '<option value="Karachi">Karachi (18&deg; / 18&deg;)</option>' +
          '<option value="Makkah">Umm al-Qura (18.5&deg; / 90 min)</option>' +
          '<option value="Moonsighting">Moonsighting Committee (seasonal)</option>' +
        '</select></label>' +
        '<label for="s-asr">Asr shadow length <select id="s-asr">' +
          '<option value="1">Standard, 1x (Maliki, Shafi\'i, Hanbali)</option>' +
          '<option value="2">Hanafi, 2x</option>' +
        '</select></label>',
      after: '<p class="hint" id="s-engine"></p>',
      fill(cfg) {
        $('s-method').value = cfg.method;
        $('s-asr').value = cfg.asr;
        $('s-engine').textContent = 'Calculated with ' + service.engine + '.';
      },
      read(d) { d.method = $('s-method').value; d.asr = Number($('s-asr').value); }
    },
    {
      section: 'calculation', order: 40,
      grid: '<label for="s-jumuah">Jumu\'ah time on Fridays<input type="text" id="s-jumuah" placeholder="13:15"></label>',
      fill(cfg) { $('s-jumuah').value = cfg.jumuah; },
      read(d) { d.jumuah = $('s-jumuah').value.trim(); }
    },
    {
      section: 'prayers', order: 10,
      after: '<table><thead><tr><th>Prayer</th><th>Adhan sound</th><th>Iqamah</th><th>Adjust (min)</th></tr></thead>' +
        '<tbody id="s-rows"></tbody></table>' +
        '<p class="hint">Iqamah takes minutes after the adhan (15) or a fixed time (19:30). Leave it empty to hide it. ' +
        'Adjust shifts the adhan time to match your masjid\'s timetable.</p>',
      fill(cfg) {
        $('s-rows').innerHTML = FIVE.map((k) => {
          const p = cfg.prayers[k], n = NAMES[k][0];
          return '<tr><td>' + n + '</td>' +
            '<td><input type="checkbox" id="s-' + k + '-sound" aria-label="' + n + ' adhan sound"' + (p.sound ? ' checked' : '') + '></td>' +
            '<td><input type="text" id="s-' + k + '-iqamah" aria-label="' + n + ' iqamah" value="' + String(p.iqamah).replace(/"/g, '') + '"></td>' +
            '<td><input type="number" id="s-' + k + '-adjust" aria-label="' + n + ' adjustment" step="1" value="' + (Number(p.adjust) || 0) + '"></td></tr>';
        }).join('');
      },
      read(d) {
        FIVE.forEach((k) => {
          d.prayers[k] = {
            sound: $('s-' + k + '-sound').checked,
            iqamah: $('s-' + k + '-iqamah').value.trim(),
            adjust: Math.round(readNumber('s-' + k + '-adjust', 0))
          };
        });
      }
    }
  ]
};
