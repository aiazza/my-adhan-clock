/* The status line under the clock: "Asr in 1:02:09", then "Asr iqamah in 9:41" once the
   adhan has been called. */
import { countdown } from '../core/format.js';
import { $, html, setHtml } from '../core/dom.js';

let ctx = null;

export default {
  id: 'countdown',
  mount(c) {
    ctx = c;
    ctx.slot('center').appendChild(html('<p class="status" id="status"></p>'));
  },
  onTick(now) {
    const times = ctx.use('times');
    const s = times.current(now);
    const t = s.today;
    const show = ctx.cfg.seconds;
    setHtml($('status'), s.live
      ? '<b>' + times.name(s.live.k, t[s.live.k])[0] + '</b> iqamah in <span class="count">' + countdown(s.live.at - now, show) + '</span>'
      : '<b>' + times.name(s.next.k, s.next.at)[0] + '</b> in <span class="count">' + countdown(s.next.at - now, show) + '</span>');
  }
};
