/* Reminder slides: content files are complete, and the scheduling rules hold. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { quietWindow, adhkarTime, kindFor, pool, dayOrder, durationFor } from '../js/features/slides.js';

const read = (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url), 'utf8'));
const content = { hadith: read('assets/content/hadith.json'), quran: read('assets/content/quran.json'),
  adhkar: read('assets/content/adhkar.json'), names: read('assets/content/names.json') };
const ARABIC = /[؀-ۿ]/;

test('every hadith, dhikr, verse and name has Arabic, English and a reference', () => {
  for (const [kind, list] of Object.entries(content)) {
    assert.ok(list.length >= 10, kind + ' has items');
    for (const x of list) {
      const ar = Array.isArray(x.ar) ? x.ar.join(' ') : x.ar;
      const en = Array.isArray(x.en) ? x.en.join(' ') : x.en;
      assert.ok(ARABIC.test(ar), kind + ' Arabic: ' + x.ref);
      assert.ok(en && !ARABIC.test(en), kind + ' English: ' + x.ref);
      assert.ok(/\d/.test(x.ref), kind + ' reference has a number: ' + x.ref);
    }
  }
  for (const q of content.quran) assert.equal(q.ar.length, q.en.length, 'one English entry per verse: ' + q.ref);
  for (const a of content.adhkar) assert.ok(['after-adhan', 'after-prayer', 'morning', 'evening', 'both'].includes(a.when), a.ref);
  assert.ok(content.adhkar.some((a) => a.when === 'after-adhan'), 'has the dua after the adhan');
});

test('every background in index.json exists and is recorded as CC0 in the README', () => {
  const list = read('assets/backgrounds/index.json');
  const readme = readFileSync(new URL('../assets/backgrounds/README.md', import.meta.url), 'utf8');
  assert.ok(list.length >= 6);
  for (const b of list) {
    assert.ok(existsSync(new URL('../assets/backgrounds/' + b.file, import.meta.url)), b.file);
    assert.match(b.license, /CC0/);
    assert.ok(readme.includes('`' + b.file + '`'), b.file + ' listed in README');
  }
});

/* Times for a sample day: Fajr 5:25, Sunrise 6:44, Dhuhr 11:41, Asr 2:14, Maghrib 4:36, Isha 5:55. */
const at = (h, m) => new Date(2026, 10, 17, h, m);
const T = { fajr: at(5, 25), sunrise: at(6, 44), dhuhr: at(11, 41), asr: at(14, 14), maghrib: at(16, 36), isha: at(17, 55) };
const IQ = { fajr: at(5, 45), dhuhr: at(11, 56), asr: at(14, 29), maghrib: at(16, 41), isha: null };
const iq = (k) => IQ[k];

test('quiet from a minute before the adhan until 15 minutes after iqamah', () => {
  assert.equal(quietWindow(at(11, 39), T, iq), null);
  assert.equal(quietWindow(at(11, 40), T, iq).k, 'dhuhr');
  assert.equal(quietWindow(at(12, 10), T, iq).k, 'dhuhr');
  assert.equal(quietWindow(at(12, 11), T, iq), null);
  assert.equal(quietWindow(at(18, 19), T, iq).k, 'isha', 'no iqamah set: adhan + 10 + 15 minutes');
  assert.equal(quietWindow(at(18, 20), T, iq), null);
  assert.equal(quietWindow(at(6, 44), T, iq), null, 'sunrise is not a prayer');
});

test('morning adhkar from Fajr to Dhuhr, evening from Asr to Isha', () => {
  assert.equal(adhkarTime(at(5, 24), T), null);
  assert.equal(adhkarTime(at(7, 0), T), 'morning');
  assert.equal(adhkarTime(at(12, 0), T), null);
  assert.equal(adhkarTime(at(15, 0), T), 'evening');
  assert.equal(adhkarTime(at(19, 0), T), null);
});

test('rotation: hadith, Quran, names; every other slide a dhikr in its time', () => {
  const all = { hadith: true, quran: true, names: true, adhkar: true };
  assert.deepEqual([0, 1, 2, 3].map((n) => kindFor(n, all, null)), ['hadith', 'quran', 'names', 'hadith']);
  assert.deepEqual([0, 1, 2, 3].map((n) => kindFor(n, all, 'morning')), ['hadith', 'adhkar', 'quran', 'adhkar']);
  assert.equal(kindFor(0, { quran: true }, null), 'quran');
  assert.equal(kindFor(0, { adhkar: true }, null), null, 'only adhkar enabled, outside its time');
  assert.equal(kindFor(0, { adhkar: true }, 'evening'), 'adhkar');
});

test('Friday verses only on Fridays; adhkar match the time of day', () => {
  const friday = new Date(2026, 10, 20, 9), monday = new Date(2026, 10, 16, 9);
  const fri = pool(content, 'quran', friday, null).filter((x) => x.tags.includes('friday'));
  assert.ok(fri.length > 0);
  assert.equal(pool(content, 'quran', monday, null).filter((x) => x.tags.includes('friday')).length, 0);
  const morning = pool(content, 'adhkar', monday, 'morning');
  assert.ok(morning.length > 0 && morning.every((x) => x.when === 'morning' || x.when === 'both'));
  assert.equal(pool(content, 'adhkar', monday, null).length, 0);
});

test('daily order is a shuffle, stable within a day, different across days', () => {
  const a = dayOrder(28, new Date(2026, 10, 17, 0, 5)), b = dayOrder(28, new Date(2026, 10, 17, 23, 55));
  const c = dayOrder(28, new Date(2026, 10, 18, 8));
  assert.deepEqual([...a].sort((x, y) => x - y), Array.from({ length: 28 }, (_, i) => i));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('every slide stays 30 seconds', () => {
  const kursi = content.quran.find((q) => q.ref.includes('2:255'));
  assert.equal(durationFor('quran', kursi), 30);
  assert.equal(durationFor('hadith', { en: 'Purity is half of faith.' }), 30);
  assert.equal(durationFor('names', {}), 30);
});

import { dueReminder } from '../js/features/pre-prayer.js';

test('reminders 30, 15, 10 and 5 minutes before each adhan; the last one lasts until the adhan', () => {
  const all = [30, 15, 10, 5];
  assert.equal(dueReminder(at(11, 10), T, all), null);
  assert.deepEqual([at(11, 11), at(11, 26), at(11, 31), at(11, 36)].map((d) => dueReminder(d, T, all).minutes), [30, 15, 10, 5]);
  assert.equal(dueReminder(at(11, 12), T, all), null, 'each lasts one minute');
  assert.equal(dueReminder(at(11, 40), T, all).minutes, 5, 'the 5 minute one holds until the adhan');
  assert.equal(dueReminder(at(11, 41), T, all), null);
  assert.equal(dueReminder(at(5, 15), T, all).k, 'fajr');
  assert.equal(dueReminder(at(6, 34), T, all), null, 'no reminder before sunrise');
  assert.equal(dueReminder(at(17, 50), T, [30, 15]).minutes, 15, 'with 15 the shortest, it holds until Isha');
});
