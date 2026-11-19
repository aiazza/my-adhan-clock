/* The date strip: Gregorian date and place on the left; Hijri date and the calculation method
   (or the synced masjid) on the right. The Hijri day rolls over at Maghrib. */
import { $, html, readNumber, setText } from '../core/dom.js';
import { METHOD_LABEL } from './prayer-times.js';

/* Month names come from this list, not from the browser: some Android browsers return the
   Gregorian name ("9 June 1448") for the Hijri month. The browser supplies only the numbers. */
export const HIJRI_MONTHS = ['Muharram', 'Safar', 'Rabiʻ I', 'Rabiʻ II', 'Jumada I', 'Jumada II',
  'Rajab', 'Shaʻban', 'Ramadan', 'Shawwal', 'Dhuʻl-Qiʻdah', 'Dhuʻl-Hijjah'];

/* "6 Jumada II 1448 AH" for the given instant, using the Umm al-Qura calendar. */
export function hijriDate(date) {
  try {
    const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
    if (!/^islamic/.test(f.resolvedOptions().calendar)) return '';
    const p = f.formatToParts(date);
    const get = (t) => { const x = p.filter((q) => q.type === t)[0]; return x ? x.value : ''; };
    const month = HIJRI_MONTHS[Number(get('month')) - 1];
    const year = get('year').replace(/\D/g, '');
    if (!month || !year) return '';
    return Number(get('day')) + ' ' + month + ' ' + year + ' AH';
  } catch (e) { return ''; }
}

/* The Hijri date to show at `now`: one day ahead after Maghrib, plus the manual adjustment. */
export function hijriFor(now, maghrib, adjustDays) {
  const shift = (Number(adjustDays) || 0) + (now >= maghrib ? 1 : 0);
  return hijriDate(new Date(now.getTime() + shift * 86400000));
}

let ctx = null;

export default {
  id: 'dates',
  defaults: { hijriAdjust: 0 },
  mount(c) {
    ctx = c;
    ctx.slot('top-start').appendChild(html(
      '<div class="date-main" id="gregorian"></div><div class="date-sub" id="place"></div>'));
    ctx.slot('top-end').appendChild(html(
      '<div class="date-main" id="hijri"></div><div class="date-sub" id="methodLabel"></div>'));
  },
  onDayChange(now) {
    const cfg = ctx.cfg;
    setText($('gregorian'), now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
    setText($('place'), cfg.place);
    const feedApi = ctx.use('feed');
    const feed = feedApi ? feedApi.forDay(now) : null;
    setText($('methodLabel'), feed && (feed.iq || (cfg.feedTimes && feed.times))
      ? 'Synced with ' + feed.name : (METHOD_LABEL[cfg.method] || cfg.method) + ' method');
  },
  onMinute(now) {
    setText($('hijri'), hijriFor(now, ctx.use('times').today(now).maghrib, ctx.cfg.hijriAdjust));
  },
  settings: [{
    section: 'calculation', order: 30,
    grid: '<label for="s-hijri">Hijri date adjustment (days)<input type="number" id="s-hijri" min="-2" max="2" step="1"></label>',
    fill(cfg) { $('s-hijri').value = cfg.hijriAdjust; },
    read(d) { d.hijriAdjust = Math.round(readNumber('s-hijri', 0)); }
  }]
};
