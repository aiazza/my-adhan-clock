/* The midnight-to-midnight bar: daylight band, a tick for each prayer, the span from the last
   event to the next one, and a marker for now. The marker moves with transform (half-pixel
   steps, so it is only touched every half minute or so); everything else changes a few times
   a day and is written only when its value changes. */
import { minutesOfDay } from '../core/format.js';
import { $ } from '../core/dom.js';
import { SIX } from './prayer-times.js';

let ctx = null;
let bar = null, dot = null, span = null;
let width = 0;          // bar width in px, kept current by a ResizeObserver
let nowPct = 0;
let lastX = '', lastSpan = '';
const pct = (d) => minutesOfDay(d) / 14.4;

function placeDot() {
  const x = (Math.round(nowPct / 100 * width * 2) / 2) + 'px';
  if (x !== lastX) { lastX = x; dot.style.transform = 'translateX(' + x + ')'; }
}

export default {
  id: 'day-bar',
  mount(c) {
    ctx = c;
    bar = ctx.slot('daybar');
    bar.innerHTML = '<div class="track"></div><div class="daylight" id="daylight"></div>' +
      '<div class="span" id="span"></div><div id="ticks"></div><div class="now" id="nowDot"></div>';
    dot = $('nowDot');
    span = $('span');
    width = bar.clientWidth;
    if (window.ResizeObserver) {
      new ResizeObserver(() => { width = bar.clientWidth; placeDot(); }).observe(bar);
    } else {
      window.addEventListener('resize', () => { width = bar.clientWidth; placeDot(); });
    }
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
    nowPct = pct(now);
    placeDot();
    const key = from + '/' + to;
    if (key !== lastSpan) {
      lastSpan = key;
      span.style.left = from + '%';
      span.style.width = Math.max(0, to - from) + '%';
    }
  }
};
