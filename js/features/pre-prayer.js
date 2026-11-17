/* Reminders before each prayer: at 30, 15, 10 and 5 minutes before the adhan (each can be
   turned off) a banner drops in at the top, "الظهر  Dhuhr in 15 minutes · Iqamah 11:56", with
   a soft chime. Each banner stays a minute; the last one stays until the adhan with a live
   countdown. Reminder slides close and pause while a banner is up.
   Provides the 'prePrayer' service: { active() }. Bus event: 'prayer:soon' { k, minutes }. */
import { countdown, dayKey, formatTime } from '../core/format.js';
import { $, html, setText, openLayer, closeLayer } from '../core/dom.js';
import { FIVE } from './prayer-times.js';

export const OFFSETS = [30, 15, 10, 5];
const SHOW_MS = 60000;

/* The reminder due at `now`, or null. minutes: enabled offsets. Each reminder is due for one
   minute; the shortest one is due until the adhan, so a page loaded late still shows it. */
export function dueReminder(now, t, minutes) {
  const list = minutes.slice().sort((a, b) => b - a);
  const last = list[list.length - 1];
  for (const k of FIVE) {
    const adhan = t[k].getTime();
    for (const m of list) {
      const start = adhan - m * 60000;
      const end = m === last ? adhan : Math.min(adhan, start + SHOW_MS);
      if (now.getTime() >= start && now.getTime() < end) return { k, minutes: m, at: t[k], last: m === last };
    }
  }
  return null;
}

let ctx = null;
let el = {};
let showing = null;          // { k, minutes, at, last, until }
const fired = {};

const enabled = () => OFFSETS.filter((m) => ctx.cfg.preMinutes['m' + m]);

function show(due, now) {
  const times = ctx.use('times');
  const t = times.today(now);
  const name = times.name(due.k, t[due.k]);
  setText(el.ar, name[1]);
  setText(el.name, name[0]);
  const iq = times.iqamah(due.k, t);
  setText(el.iq, iq ? 'Iqamah ' + formatTime(iq, ctx.cfg.hour24).t : '');
  showing = Object.assign({}, due, { until: due.last ? due.at.getTime() : now.getTime() + SHOW_MS });
  update(now);
  openLayer(el.root);
}

function update(now) {
  if (!showing) return;
  setText(el.count, showing.last
    ? countdown(showing.at - now, ctx.cfg.seconds)
    : showing.minutes + ' minutes');
}

function hide() {
  showing = null;
  closeLayer(el.root);
}

export default {
  id: 'pre-prayer',
  defaults: { preMinutes: { m30: true, m15: true, m10: true, m5: true }, preChime: true },
  mount(c) {
    ctx = c;
    ctx.slot('overlays').appendChild(html(
      '<div class="pre" id="pre" hidden role="status" aria-live="polite">' +
        '<span class="pre-ar" id="preAr" lang="ar" dir="rtl"></span>' +
        '<span class="pre-text"><b id="preName"></b> in <span class="pre-count" id="preCount"></span></span>' +
        '<span class="pre-iq" id="preIq"></span>' +
      '</div>'));
    el = { root: $('pre'), ar: $('preAr'), name: $('preName'), count: $('preCount'), iq: $('preIq') };
    ctx.provide('prePrayer', { active: () => !!showing });
    ctx.bus.on('adhan:start', hide);
    ctx.bus.on('config:change', () => { if (showing && !enabled().length) hide(); });
  },
  onTick(now) {
    if (showing && now.getTime() >= showing.until) hide();
    const mins = enabled();
    if (!mins.length) return;
    const due = dueReminder(now, ctx.use('times').today(now), mins);
    if (!due) { update(now); return; }
    const key = dayKey(now) + due.k + due.minutes;
    if (!fired[key]) {
      fired[key] = true;
      show(due, now);
      ctx.bus.emit('prayer:soon', { k: due.k, minutes: due.minutes });
      const audio = ctx.use('adhan');
      if (ctx.cfg.preChime && audio) audio.remind();
    } else {
      update(now);
    }
  },
  settings: [{
    section: 'before', order: 10,
    grid: OFFSETS.map((m) =>
      '<label class="check" for="s-pre-' + m + '"><input type="checkbox" id="s-pre-' + m + '">' + m + ' minutes before</label>').join('') +
      '<label class="check wide" for="s-pre-chime"><input type="checkbox" id="s-pre-chime">Play a soft chime with each reminder</label>',
    after: '<p class="hint">A banner shows at the top of the clock before each of the five prayers. ' +
      'The 5 minute reminder stays until the adhan, counting down.</p>',
    fill(cfg) {
      OFFSETS.forEach((m) => { $('s-pre-' + m).checked = !!cfg.preMinutes['m' + m]; });
      $('s-pre-chime').checked = !!cfg.preChime;
    },
    read(d) {
      d.preMinutes = {};
      OFFSETS.forEach((m) => { d.preMinutes['m' + m] = $('s-pre-' + m).checked; });
      d.preChime = $('s-pre-chime').checked;
    }
  }]
};
