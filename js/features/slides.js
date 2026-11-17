/* Reminder slides: every few minutes the clock steps aside for a full-screen hadith, Quran
   verse, dhikr or Name of Allah over the background, with a small clock and countdown in the
   corner. Content lives in assets/content/*.json (see the README there).

   When slides show:
   - every `slideEvery` minutes (0 turns them off), rotating hadith, Quran and Names of Allah;
     in the morning (Fajr to Dhuhr) and evening (Asr to Isha) every other slide is a dhikr
   - not while a reminder before a prayer is showing (js/features/pre-prayer.js)
   - never from a minute before an adhan until 15 minutes after its iqamah (people are
     praying), nor while the screen is dimmed at night or settings are open
   - the dua after the adhan as soon as the adhan screen closes
   - an after-prayer dhikr when that quiet time ends
   A tap or Escape closes a slide early. */
import { countdown, formatTime } from '../core/format.js';
import { $, html, setText, openLayer, closeLayer, isOpen } from '../core/dom.js';
import { FIVE } from './prayer-times.js';

const CONTENT = 'assets/content/';
const KINDS = ['hadith', 'quran', 'names', 'adhkar'];
const BEFORE_ADHAN_MS = 60000;
const AFTER_IQAMAH_MS = 15 * 60000;
const NO_IQAMAH_MS = 10 * 60000;      // assumed wait when a prayer has no iqamah set
const FIRST_SLIDE_MS = 60000;         // first slide one minute after the page starts

/* ---------- pure helpers (tested in tests/slides.test.mjs) ---------- */

/* If `now` falls in a prayer's quiet time, the end of it and the prayer; else null.
   t: today's times, iqamahOf(k) -> Date or null. */
export function quietWindow(now, t, iqamahOf) {
  for (const k of FIVE) {
    const start = t[k].getTime() - BEFORE_ADHAN_MS;
    const q = iqamahOf(k);
    const end = (q ? q.getTime() : t[k].getTime() + NO_IQAMAH_MS) + AFTER_IQAMAH_MS;
    if (now.getTime() >= start && now.getTime() < end) return { k, until: end };
  }
  return null;
}

/* 'morning' from Fajr to Dhuhr, 'evening' from Asr to Isha, else null. */
export function adhkarTime(now, t) {
  if (now >= t.fajr && now < t.dhuhr) return 'morning';
  if (now >= t.asr && now < t.isha) return 'evening';
  return null;
}

/* The kind for the n-th slide. kinds: enabled kinds; dhikrTime: adhkarTime() result. */
export function kindFor(n, kinds, dhikrTime) {
  const rotating = KINDS.filter((k) => k !== 'adhkar' && kinds[k]);
  const dhikr = kinds.adhkar && dhikrTime;
  if (dhikr && (n % 2 === 1 || !rotating.length)) return 'adhkar';
  if (!rotating.length) return null;
  return rotating[(dhikr ? Math.floor(n / 2) : n) % rotating.length];
}

/* Items of a kind that may show now. */
export function pool(content, kind, now, dhikrTime) {
  const all = content[kind] || [];
  if (kind === 'quran') return all.filter((x) => !(x.tags || []).includes('friday') || now.getDay() === 5);
  if (kind === 'adhkar') return all.filter((x) => x.when === dhikrTime || (x.when === 'both' && dhikrTime));
  return all;
}

/* Days since 1970 by the local calendar, so the order changes at local midnight. */
export function localDay(now) { return Math.round(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000); }

/* Same order all day, a different order each day, so nothing repeats until a list runs out. */
export function dayOrder(length, now) {
  const order = Array.from({ length }, (_, i) => i);
  let seed = localDay(now) * 2654435761 % 4294967296;
  for (let i = length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const j = seed % (i + 1);
    const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
  }
  return order;
}

/* Seconds a slide stays up, longer for longer texts. */
export function durationFor(kind, item) {
  if (kind === 'names') return 15;
  const en = Array.isArray(item.en) ? item.en.join(' ') : String(item.en || '');
  return Math.round(Math.min(50, Math.max(18, 14 + en.length * 0.075)));
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const arabicNumber = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[d]);

/* ---------- feature ---------- */

let ctx = null;
let content = null;
let el = {};
let count = 0;                 // slides shown, drives the kind rotation
const cursors = {};            // position in each list's daily order
let nextAt = 0;
let closeAt = 0;
let pendingAfterPrayer = null; // prayer whose after-prayer dhikr is due when its quiet ends

const LABEL = {
  hadith: 'Hadith', quran: 'Quran', names: 'Names of Allah',
  morning: 'Morning remembrance', evening: 'Evening remembrance',
  'after-adhan': 'After the adhan', 'after-prayer': 'After the prayer'
};

function next(kind, list, now) {
  if (!list.length) return null;
  const key = kind + ':' + list.length;
  const order = dayOrder(list.length, now);
  const c = cursors[key] === undefined ? localDay(now) % list.length : cursors[key];
  cursors[key] = (c + 1) % list.length;
  return list[order[c % list.length]];
}

function render(kind, item, label) {
  const lenClass = (n) => (n < 40 ? 's' : n < 120 ? 'm' : n < 260 ? 'l' : 'xl');
  el.root.dataset.kind = kind;
  setText(el.kind, label);
  el.en.textContent = '';
  if (kind === 'quran') {
    const ar = item.ar.map((v, i) => v + ' ۝' + arabicNumber(item.first + i)).join(' ');
    el.ar.textContent = ar;
    el.ar.className = 'slide-ar quran len-' + lenClass(ar.length);
    item.en.forEach((v, i) => {
      if (item.en.length > 1) { const s = document.createElement('sup'); s.textContent = String(item.first + i); el.en.appendChild(s); }
      el.en.appendChild(document.createTextNode(v + (i < item.en.length - 1 ? ' ' : '')));
    });
    el.ref.textContent = item.ref + ' · translation: Pickthall';
  } else if (kind === 'names') {
    el.ar.textContent = item.ar;
    el.ar.className = 'slide-ar name';
    el.en.textContent = item.translit + ' — ' + item.en;
    el.ref.textContent = item.ref;
  } else {
    el.ar.textContent = item.ar;
    el.ar.className = 'slide-ar len-' + lenClass(item.ar.length);
    el.en.textContent = item.en;
    el.ref.textContent = item.ref + (item.grade ? ' · ' + item.grade : '');
  }
  setText(el.count, item.count > 1 ? '× ' + item.count : '');
  const bg = ctx.use('background');
  const art = bg ? bg.current() : null;
  setText(el.credit, art ? [art.title, art.place, art.date, 'The Met'].filter(Boolean).join(' · ') : '');
}

function blocked() {
  const dim = ctx.use('nightDim');
  const sheet = $('sheet');
  const adhan = $('adhan');
  const pre = ctx.use('prePrayer');
  return (dim && dim.isDimmed()) || (sheet && !sheet.hidden) || (adhan && !adhan.hidden) || (pre && pre.active());
}

function open(kind, item, label, now) {
  if (!item) return false;
  render(kind, item, label);
  renderCorner(now);
  document.body.classList.add('slide-on');
  openLayer(el.root);
  closeAt = now.getTime() + (label === LABEL['after-adhan'] ? 40 : durationFor(kind, item)) * 1000;
  return true;
}

function close() {
  if (el.root.hidden) return;
  document.body.classList.remove('slide-on');
  closeLayer(el.root);
  closeAt = 0;
}

function renderCorner(now) {
  const f = formatTime(now, ctx.cfg.hour24);
  setText(el.time, f.t + (f.ap ? ' ' + f.ap : ''));
  const times = ctx.use('times');
  const s = times.current(now);
  const seconds = ctx.cfg.seconds;
  setText(el.next, s.live
    ? times.name(s.live.k, s.today[s.live.k])[0] + ' iqamah in ' + countdown(s.live.at - now, seconds)
    : times.name(s.next.k, s.next.at)[0] + ' in ' + countdown(s.next.at - now, seconds));
}

function everyMs() { return (Number(ctx.cfg.slideEvery) || 0) * 60000; }

/* Pick and show the next rotating slide. */
function showNext(now) {
  if (!content) return false;
  const times = ctx.use('times');
  const t = times.today(now);
  const dhikr = adhkarTime(now, t);
  const kinds = ctx.cfg.slideKinds;
  for (let tries = 0; tries < KINDS.length; tries++) {
    const kind = kindFor(count++, kinds, dhikr);
    if (!kind) return false;
    const item = next(kind + (kind === 'adhkar' ? '-' + dhikr : ''), pool(content, kind, now, dhikr), now);
    if (item) return open(kind, item, kind === 'adhkar' ? LABEL[dhikr] : LABEL[kind], now);
  }
  return false;
}

function showAdhkar(when, now) {
  if (!content || !ctx.cfg.slideKinds.adhkar || !everyMs()) return;
  const item = next('adhkar-' + when, (content.adhkar || []).filter((x) => x.when === when), now);
  if (item) open('adhkar', item, LABEL[when], now);
}

export default {
  id: 'slides',
  defaults: { slideEvery: 10, slideKinds: { hadith: true, quran: true, adhkar: true, names: true } },
  mount(c) {
    ctx = c;
    ctx.slot('overlays').appendChild(html(
      '<div class="slide" id="slide" hidden role="dialog" aria-label="Reminder">' +
        '<div class="slide-top">' +
          '<div class="slide-clock"><span class="slide-time" id="slideTime"></span><span class="slide-next" id="slideNext"></span></div>' +
          '<div class="slide-kind" id="slideKind"></div>' +
        '</div>' +
        '<figure class="slide-body">' +
          '<p class="slide-ar" id="slideAr" lang="ar" dir="rtl"></p>' +
          '<p class="slide-count" id="slideCount"></p>' +
          '<p class="slide-en" id="slideEn"></p>' +
          '<figcaption class="slide-ref" id="slideRef"></figcaption>' +
        '</figure>' +
        '<div class="slide-credit" id="slideCredit"></div>' +
      '</div>'));
    el = {
      root: $('slide'), time: $('slideTime'), next: $('slideNext'), kind: $('slideKind'),
      ar: $('slideAr'), count: $('slideCount'), en: $('slideEn'), ref: $('slideRef'), credit: $('slideCredit')
    };
    el.root.addEventListener('pointerdown', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    ctx.bus.on('adhan:start', close);
    ctx.bus.on('prayer:soon', close);
    ctx.bus.on('adhan:end', () => showAdhkar('after-adhan', new Date()));
    nextAt = Date.now() + FIRST_SLIDE_MS;
  },
  start() {
    const load = (name) => fetch(CONTENT + name + '.json').then((r) => r.json()).catch(() => []);
    Promise.all(['hadith', 'quran', 'adhkar', 'names'].map(load)).then((lists) => {
      content = { hadith: lists[0], quran: lists[1], adhkar: lists[2], names: lists[3] };
    });
  },
  onTick(now) {
    const ms = now.getTime();
    if (!el.root.hidden) {
      if (isOpen(el.root)) renderCorner(now);
      if (closeAt && ms >= closeAt) { close(); nextAt = ms + everyMs(); }
      return;
    }
    if (!everyMs() || !content) return;
    const times = ctx.use('times');
    const t = times.today(now);
    const quiet = quietWindow(now, t, (k) => times.iqamah(k, t));
    if (quiet) { pendingAfterPrayer = quiet.k; return; }
    if (blocked()) return;
    if (pendingAfterPrayer) {
      pendingAfterPrayer = null;
      showAdhkar('after-prayer', now);
      return;
    }
    if (ms >= nextAt && !showNext(now)) nextAt = ms + everyMs();
  },
  settings: [
    {
      section: 'reminders', title: 'Background and reminders', order: 30,
      grid: '<label class="wide" for="s-slideevery">Show a reminder <select id="s-slideevery">' +
          '<option value="0">Never</option><option value="5">Every 5 minutes</option>' +
          '<option value="10">Every 10 minutes</option><option value="15">Every 15 minutes</option>' +
          '<option value="30">Every 30 minutes</option>' +
        '</select></label>' +
        '<label class="check" for="s-kind-hadith"><input type="checkbox" id="s-kind-hadith">Hadith</label>' +
        '<label class="check" for="s-kind-quran"><input type="checkbox" id="s-kind-quran">Quran verses</label>' +
        '<label class="check" for="s-kind-adhkar"><input type="checkbox" id="s-kind-adhkar">Duas and adhkar</label>' +
        '<label class="check" for="s-kind-names"><input type="checkbox" id="s-kind-names">Names of Allah</label>',
      after: '<div class="actions" style="margin-top:10px"><button class="btn" type="button" id="s-slide-test">Show a reminder now</button></div>' +
        '<p class="hint">Reminders pause from a minute before each adhan until 15 minutes after its iqamah, ' +
        'and at night while the screen is dimmed. The dua after the adhan shows when the adhan ends; ' +
        'morning and evening adhkar show from Fajr to Dhuhr and from Asr to Isha. Tap a reminder to close it.</p>',
      fill(cfg) {
        $('s-slideevery').value = String(cfg.slideEvery);
        KINDS.forEach((k) => { $('s-kind-' + k).checked = !!cfg.slideKinds[k]; });
      },
      read(d) {
        d.slideEvery = Number($('s-slideevery').value) || 0;
        d.slideKinds = {};
        KINDS.forEach((k) => { d.slideKinds[k] = $('s-kind-' + k).checked; });
      },
      wire(sheet) {
        $('s-slide-test').addEventListener('click', () => {
          sheet.apply({ save: false }).then(() => {
            sheet.close();
            setTimeout(() => showNext(new Date()), 500);
          });
        });
      }
    }
  ]
};
