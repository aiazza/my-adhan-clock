/* The status line under the clock: "Asr in 1:02:09", then "Asr iqamah in 9:41" once the
   adhan has been called. The sentence is rebuilt only when the prayer or the mode changes;
   each second only the number's text changes. */
import { countdown } from '../core/format.js';
import { $, html, setText } from '../core/dom.js';

let ctx = null;
let status = null, count = null;
let mode = '';

export default {
  id: 'countdown',
  mount(c) {
    ctx = c;
    ctx.slot('center').appendChild(html('<p class="status" id="status"></p>'));
    status = $('status');
  },
  onTick(now) {
    const times = ctx.use('times');
    const s = times.current(now);
    const live = s.live;
    const label = live ? times.name(live.k, s.today[live.k])[0] : times.name(s.next.k, s.next.at)[0];
    const key = (live ? 'iqamah ' : '') + label;
    if (key !== mode) {
      mode = key;
      status.innerHTML = '<b>' + label + '</b> ' + (live ? 'iqamah in ' : 'in ') + '<span class="count"></span>';
      count = status.lastChild;
    }
    setText(count, countdown((live ? live.at : s.next.at) - now, ctx.cfg.seconds));
  }
};
