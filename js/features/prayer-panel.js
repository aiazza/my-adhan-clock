/* The panel of six prayer columns: Arabic and English name, adhan time, iqamah.
   The column of the next prayer, or the one waiting for iqamah, is highlighted. */
import { formatTime, formatTimeHtml } from '../core/format.js';
import { $, setText } from '../core/dom.js';
import { SIX } from './prayer-times.js';

let ctx = null;
const cols = {};

export default {
  id: 'prayer-panel',
  mount(c) {
    ctx = c;
    const panel = ctx.slot('prayers');
    panel.innerHTML = SIX.map((k) =>
      '<article class="prayer" id="p-' + k + '"><div class="ar" lang="ar" dir="rtl"></div><div class="en"></div>' +
      '<div class="time"></div><div class="iq"></div></article>').join('');
    SIX.forEach((k) => {
      const el = $('p-' + k);
      cols[k] = { el, ar: el.querySelector('.ar'), en: el.querySelector('.en'), time: el.querySelector('.time'), iq: el.querySelector('.iq') };
    });
  },
  onDayChange(now) {
    const times = ctx.use('times');
    const t = times.today(now);
    const hour24 = ctx.cfg.hour24;
    SIX.forEach((k) => {
      const c = cols[k], name = times.name(k, t[k]);
      setText(c.ar, name[1]);
      setText(c.en, name[0]);
      c.time.innerHTML = formatTimeHtml(t[k], hour24);
      const iq = k === 'sunrise' ? null : times.iqamah(k, t);
      setText(c.iq, iq ? 'Iqamah ' + formatTime(iq, hour24).t : (k === 'sunrise' ? 'Fajr ends' : ''));
    });
  },
  onTick(now) {
    const s = ctx.use('times').current(now);
    const t = s.today;
    SIX.forEach((k) => {
      const el = cols[k].el, isLive = !!(s.live && s.live.k === k);
      el.classList.toggle('live', isLive);
      el.classList.toggle('next', !s.live && s.next.k === k && s.next.at === t[k]);
      el.classList.toggle('past', t[k] <= now && !isLive);
    });
  }
};
