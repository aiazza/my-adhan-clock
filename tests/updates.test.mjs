/* Safe automatic updates and settings from settings.json. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeToReload, nextAdhan, BEFORE_ADHAN_MS } from '../js/features/updates.js';
import { applyFile } from '../js/features/settings-file.js';

const at = (h, m) => new Date(2026, 10, 17, h, m);
const today = { fajr: at(5, 20), sunrise: at(6, 40), dhuhr: at(11, 41), asr: at(14, 20), maghrib: at(16, 35), isha: at(17, 55) };
const tomorrow = { fajr: new Date(2026, 10, 18, 5, 21) };

test('the next adhan skips sunrise and rolls over to tomorrow\'s Fajr', () => {
  assert.equal(nextAdhan(at(6, 0), today, tomorrow), today.dhuhr);
  assert.equal(nextAdhan(at(20, 0), today, tomorrow), tomorrow.fajr);
});

test('reload only at a quiet time', () => {
  const calm = { nextAdhan: today.dhuhr, quiet: false, showing: false, sound: 'locked' };
  assert.equal(safeToReload(at(9, 0), calm), true);
  assert.equal(safeToReload(at(9, 0), { ...calm, sound: 'autoplay' }), true);
  assert.equal(safeToReload(at(9, 0), { ...calm, sound: 'tapped' }), false, 'a tap-unlocked sound would be lost');
  assert.equal(safeToReload(at(9, 0), { ...calm, showing: true }), false);
  assert.equal(safeToReload(at(11, 40), { ...calm, nextAdhan: today.asr, quiet: true }), false, 'between adhan and iqamah');
  assert.equal(safeToReload(new Date(today.dhuhr - BEFORE_ADHAN_MS), calm), false, 'exactly 30 minutes before');
  assert.equal(safeToReload(new Date(today.dhuhr - BEFORE_ADHAN_MS - 60000), calm), true);
});

test('settings.json overrides only the keys it names, nested ones too', () => {
  const current = {
    place: 'Home', jumuah: '',
    prayers: { fajr: { sound: true, iqamah: '20', adjust: 0 }, dhuhr: { sound: true, iqamah: '15', adjust: 0 } }
  };
  const out = applyFile(current, { jumuah: '13:15', prayers: { dhuhr: { iqamah: '13:30' } }, _help: 'x', unknown: 1 });
  assert.deepEqual(out, {
    place: 'Home', jumuah: '13:15',
    prayers: { fajr: { sound: true, iqamah: '20', adjust: 0 }, dhuhr: { sound: true, iqamah: '13:30', adjust: 0 } }
  });
});
