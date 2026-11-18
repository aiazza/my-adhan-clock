/* Large text: an option for reading the clock from further away on a small screen. It makes
   the prayer times, iqamah times, names and countdown bigger and the big clock a little
   smaller to make room. The sizes are in css/text-size.css (body.text-large). */
import { $ } from '../core/dom.js';

let ctx = null;
const apply = () => { document.body.classList.toggle('text-large', !!ctx.cfg.largeText); };

export default {
  id: 'text-size',
  defaults: { largeText: false },
  mount(c) {
    ctx = c;
    apply();
    ctx.bus.on('config:change', apply);
  },
  settings: [{
    section: 'display', order: 15,
    grid: '<label class="check wide" for="s-largetext"><input type="checkbox" id="s-largetext">Large text, easier to read from across the room</label>',
    fill(cfg) { $('s-largetext').checked = !!cfg.largeText; },
    read(d) { d.largeText = $('s-largetext').checked; }
  }]
};
