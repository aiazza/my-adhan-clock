/* The midnight-to-midnight bar: daylight band, a tick for each prayer, the span from the last
   event to the next one, and a marker for now. */
import { minutesOfDay } from '../core/format.js';
import { $ } from '../core/dom.js';
import { SIX } from './prayer-times.js';

let ctx = null;
const pct = (d) => minutesOfDay(d) / 14.4;

export default {
  id: 'day-bar',
  mount(c) {
    ctx = c;
    ctx.slot('daybar').innerHTML = '<div class="track"></div><div class="daylight" id="daylight"></div>' +
      '<div class="span" id="span"></div><div id="ticks"></div><div class="now" id="nowDot"></div>';
  },
  onDayChange(now) {
    const t = ctx.use('times').today(now);
    $('ticks').innerHTML = SIX.map((k) =>
      '<div class="tick" style="left:' + pct(t[k]).toFixed(3) + '%"></div>').join('');
    const a = pct(t.sunrise), b = pct(t.maghrib);
    $('daylight').style.left = a + '%';
    $('daylight').style.width = (b - a) + '%';
  },
  onTick(now) {
    const s = ctx.use('times').current(now);
    const from = s.prev ? pct(s.prev) : 0;
    const to = s.next.at.getDate() === now.getDate() ? pct(s.next.at) : 100;
    $('nowDot').style.left = pct(now) + '%';
    $('span').style.left = from + '%';
    $('span').style.width = Math.max(0, to - from) + '%';
  }
};
