/* Prayer time and Hijri checks from CLAUDE.md ("Tests to keep"). Run with `npm test`.
   Times are formatted in America/New_York, so the result does not depend on the machine's zone. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rawTimes, dayTimes, iqamahTime, SIX } from '../js/features/prayer-times.js';
import { hijriFor } from '../js/features/dates.js';
import { merge } from '../js/core/config.js';
import prayerTimes from '../js/features/prayer-times.js';

/* Load the vendored UMD bundle the same way the browser gets it, as a plain script. */
function loadAdhan() {
  const src = readFileSync(new URL('../vendor/adhan.umd.min.js', import.meta.url), 'utf8');
  const mod = { exports: {} };
  new Function('module', 'exports', src)(mod, mod.exports);
  return mod.exports;
}
const adhan = loadAdhan();

const NY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });
/* Minutes past midnight in New York, 12 hour clock folded the same way the table is written. */
function nyMinutes(ms) {
  const p = NY.formatToParts(new Date(ms));
  const h = Number(p.find((x) => x.type === 'hour').value) % 12;
  return h * 60 + Number(p.find((x) => x.type === 'minute').value);
}
const tableMinutes = (s) => { const [h, m] = s.split(':').map(Number); return (h % 12) * 60 + m; };

const ROWS = [
  { place: 'Bronx', lat: 40.8448, lng: -73.8648, date: [2026, 11, 5], want: ['5:13', '6:31', '11:40', '2:24', '4:46', '6:04'] },
  { place: 'New York', lat: 40.7128, lng: -74.006, date: [2026, 7, 1], want: ['3:50', '5:29', '1:01', '5:00', '8:31', '10:10'] },
  { place: 'Queens', lat: 40.7282, lng: -73.7949, date: [2026, 4, 4], want: ['5:16', '6:33', '12:59', '4:35', '7:23', '8:41'] }
];

function check(row, lib, asr, want, tolerance) {
  const date = new Date(row.date[0], row.date[1] - 1, row.date[2], 12);
  const r = rawTimes(date, { lat: row.lat, lng: row.lng, method: 'ISNA', asr }, lib);
  SIX.forEach((k, i) => {
    const got = nyMinutes(r.times[k]);
    const diff = Math.abs(got - tableMinutes(want[i]));
    assert.ok(diff <= tolerance, row.place + ' ' + k + ': got ' + NY.format(new Date(r.times[k])) + ', want ' + want[i]);
  });
  return r;
}

for (const row of ROWS) {
  test('adhan-js, ISNA standard Asr: ' + row.place + ' ' + row.date.join('-'), () => {
    const r = check(row, adhan, 1, row.want, 1);
    assert.equal(r.engine, 'adhan-js 4.4.6');
  });
  /* The fallback has no +1 minute Dhuhr adjustment like adhan-js, so its Dhuhr can come out
     two minutes early after rounding. It only runs if vendor/adhan.umd.min.js fails to load. */
  test('built-in fallback, ISNA standard Asr (within 2 min): ' + row.place + ' ' + row.date.join('-'), () => {
    const r = check(row, null, 1, row.want, 2);
    assert.equal(r.engine, 'built-in fallback');
  });
}

test('Hanafi Asr, Queens 2026-04-04 is 5:31 (adhan-js and fallback)', () => {
  const want = ROWS[2].want.slice();
  want[3] = '5:31';
  check(ROWS[2], adhan, 2, want, 1);
  check(ROWS[2], null, 2, want, 2);
});

test('displayed times are rounded to the minute and shifted by the adjustment', () => {
  const cfg = merge(prayerTimes.defaults, { lat: 40.7282, lng: -73.7949 });
  cfg.prayers.asr.adjust = 3;
  const date = new Date(2026, 3, 4, 12);
  const raw = rawTimes(date, cfg, adhan).times;
  const shown = dayTimes(date, cfg, adhan, null).times;
  SIX.forEach((k) => assert.equal(shown[k].getTime() % 60000, 0, k + ' is on the minute'));
  assert.equal(shown.asr.getTime(), Math.round(raw.asr / 60000) * 60000 + 3 * 60000);
});

test('iqamah: minutes after adhan, fixed time, empty, and Jumu\'ah on Fridays', () => {
  const cfg = merge(prayerTimes.defaults, { jumuah: '13:15' });
  const fri = new Date(2026, 10, 20, 12);          // Friday 20 November 2026
  const t = dayTimes(fri, cfg, adhan, null).times;
  assert.equal(iqamahTime('fajr', t, cfg, null).getTime(), t.fajr.getTime() + 20 * 60000);
  assert.equal(iqamahTime('dhuhr', t, cfg, null).getHours(), 13);
  assert.equal(iqamahTime('dhuhr', t, cfg, null).getMinutes(), 15);
  cfg.prayers.isha.iqamah = '19:30';
  assert.equal(iqamahTime('isha', t, cfg, null).getHours(), 19);
  cfg.prayers.asr.iqamah = '';
  assert.equal(iqamahTime('asr', t, cfg, null), null);
  const feed = { iq: { maghrib: '+7' } };
  assert.equal(iqamahTime('maghrib', t, cfg, feed).getTime(), t.maghrib.getTime() + 7 * 60000);
});

test('16 November 2026 is 6 Jumada II 1448 before Maghrib, 7 after', () => {
  const maghrib = new Date(Date.UTC(2026, 10, 16, 21, 38));   // 4:38 pm New York
  assert.equal(hijriFor(new Date(Date.UTC(2026, 10, 16, 17, 0)), maghrib, 0), '6 Jumada II 1448 AH');
  assert.equal(hijriFor(new Date(Date.UTC(2026, 10, 16, 22, 0)), maghrib, 0), '7 Jumada II 1448 AH');
  assert.equal(hijriFor(new Date(Date.UTC(2026, 10, 16, 17, 0)), maghrib, -1), '5 Jumada II 1448 AH');
});
