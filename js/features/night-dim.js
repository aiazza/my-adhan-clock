/* Dims the screen from an hour after Isha until half an hour before Fajr.
   A tap lifts the dimming for 30 seconds. */
import { $, html } from '../core/dom.js';

let ctx = null;
let dim = null;
let undimUntil = 0;

export default {
  id: 'night-dim',
  defaults: { nightDim: true },
  mount(c) {
    ctx = c;
    ctx.slot('overlays').appendChild(html('<div class="dim" id="dim"></div>'));
    dim = $('dim');
    ctx.provide('nightDim', { isDimmed: () => dim.classList.contains('on') });
    document.addEventListener('pointerdown', () => {
      undimUntil = Date.now() + 30000;
      dim.classList.remove('on');
    });
  },
  onMinute(now) {
    const t = ctx.use('times').today(now);
    const late = now.getTime() > t.isha.getTime() + 3600000 || now.getTime() < t.fajr.getTime() - 1800000;
    dim.classList.toggle('on', !!ctx.cfg.nightDim && late && now.getTime() > undimUntil);
  },
  settings: [{
    section: 'display', order: 30,
    grid: '<label class="check wide" for="s-nightdim"><input type="checkbox" id="s-nightdim">Dim the screen between Isha and Fajr</label>',
    fill(cfg) { $('s-nightdim').checked = !!cfg.nightDim; },
    read(d) { d.nightDim = $('s-nightdim').checked; }
  }]
};
