/* The large clock: hours and minutes, AM/PM and seconds. */
import { formatTime, pad2 } from '../core/format.js';
import { $, html, setText } from '../core/dom.js';

let ctx = null;
let lastHm = '';

export default {
  id: 'clock',
  defaults: { hour24: false, seconds: true },
  mount(c) {
    ctx = c;
    ctx.slot('center').appendChild(html(
      '<div class="clock" role="timer" aria-label="Current time">' +
        '<div class="hm" id="hm"></div>' +
        '<div class="side"><span class="ampm" id="ampm"></span><span class="sec" id="sec"></span></div>' +
      '</div>'));
  },
  onDayChange() { lastHm = ''; },
  onTick(now) {
    const f = formatTime(now, ctx.cfg.hour24);
    if (f.t !== lastHm) {
      lastHm = f.t;
      $('hm').innerHTML = f.t.split('').map((ch) =>
        '<span class="' + (ch === ':' ? 'c' : 'd') + '">' + ch + '</span>').join('');
    }
    setText($('ampm'), f.ap);
    setText($('sec'), ctx.cfg.seconds ? pad2(now.getSeconds()) : '');
  },
  settings: [{
    section: 'display', order: 10,
    grid: '<label class="check" for="s-hour24"><input type="checkbox" id="s-hour24">24 hour clock</label>' +
      '<label class="check" for="s-seconds"><input type="checkbox" id="s-seconds">Show seconds</label>',
    fill(cfg) { $('s-hour24').checked = !!cfg.hour24; $('s-seconds').checked = !!cfg.seconds; },
    read(d) { d.hour24 = $('s-hour24').checked; d.seconds = $('s-seconds').checked; }
  }]
};
