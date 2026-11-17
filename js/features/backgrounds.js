/* Backgrounds behind the clock. Two modes:
     sky  the gradient that follows the sun (js/features/sky.js) with the star lattice
     art  Islamic art from assets/backgrounds/, crossfading every few minutes
   Art mode stacks two <img> layers and fades between them with opacity only. The next image is
   decoded before the fade starts, so the fade never stalls on a decode. A dark scrim over the
   art keeps the clock readable. The list of images is assets/backgrounds/index.json.
   Provides the 'background' service: { current() } returns the index.json entry on screen. */
import { $, html, readNumber } from '../core/dom.js';

const BASE = 'assets/backgrounds/';
const SEEN_KEY = 'azan-clock-bg-index';

let ctx = null;
let list = [];
let layers = [];
let front = 0;          // which layer is showing
let index = -1;         // which image is showing
let shownAt = 0;
let busy = false;

const artMode = () => ctx.cfg.bgMode === 'art' && list.length > 0;

function loadInto(img, item) {
  img.src = BASE + item.file;
  /* decode() resolves once the pixels are ready; older engines fall back to onload */
  if (img.decode) return img.decode();
  return new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
}

/* Show image i (or the next one), trying further images if one fails to load. */
function show(i, tries) {
  if (busy || !list.length) return;
  busy = true;
  const n = ((i % list.length) + list.length) % list.length;
  const back = layers[1 - front];
  loadInto(back, list[n]).then(() => {
    back.classList.add('show');
    layers[front].classList.remove('show');
    front = 1 - front;
    index = n;
    shownAt = Date.now();
    try { localStorage.setItem(SEEN_KEY, String(n)); } catch (e) {}
    busy = false;
  }, () => {
    busy = false;
    if ((tries || 0) < list.length) show(n + 1, (tries || 0) + 1);
  });
}

function applyMode() {
  document.body.classList.toggle('bg-art', artMode());
  if (artMode() && index < 0) {
    let last = -1;
    try { last = Number(localStorage.getItem(SEEN_KEY)); } catch (e) {}
    show(isNaN(last) ? 0 : last + 1);
  }
}

export default {
  id: 'backgrounds',
  defaults: { bgMode: 'art', bgMinutes: 10 },
  mount(c) {
    ctx = c;
    ctx.slot('backdrop').prepend(html(
      '<div class="bg" aria-hidden="true">' +
        '<img class="bg-layer" alt="" decoding="async"><img class="bg-layer" alt="" decoding="async">' +
        '<div class="bg-scrim"></div>' +
      '</div>'));
    layers = Array.from(document.querySelectorAll('.bg-layer'));
    ctx.provide('background', { current: () => (artMode() && index >= 0 ? list[index] : null) });
    ctx.bus.on('config:change', applyMode);
  },
  start() {
    fetch(BASE + 'index.json').then((r) => r.json()).then((items) => {
      list = Array.isArray(items) ? items.filter((x) => x && x.file) : [];
      ctx.precache(list.map((x) => BASE + x.file));
      applyMode();
    }).catch(() => { list = []; applyMode(); });
  },
  onMinute(now) {
    if (!artMode() || busy || index < 0) return;
    const every = Math.max(1, Number(ctx.cfg.bgMinutes) || 10) * 60000;
    /* checked once a minute, so allow half a minute of slack: change on the minute it is due */
    if (now.getTime() - shownAt >= every - 30000) show(index + 1);
  },
  settings: [{
    section: 'reminders', title: 'Background and reminders', order: 10,
    grid: '<label for="s-bgmode">Background <select id="s-bgmode">' +
        '<option value="art">Islamic art, changing</option>' +
        '<option value="sky">Sky that follows the sun</option>' +
      '</select></label>' +
      '<label for="s-bgminutes">Change the art every <select id="s-bgminutes">' +
        '<option value="5">5 minutes</option><option value="10">10 minutes</option>' +
        '<option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">hour</option>' +
      '</select></label>',
    fill(cfg) { $('s-bgmode').value = cfg.bgMode; $('s-bgminutes').value = String(cfg.bgMinutes); },
    read(d) { d.bgMode = $('s-bgmode').value; d.bgMinutes = readNumber('s-bgminutes', 10); }
  }]
};
