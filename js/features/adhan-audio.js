/* Adhan at each prayer time: the full-screen adhan overlay and the sound.
   Sound source order: a recording chosen in settings (kept in IndexedDB on this device), then
   assets/audio/adhan.mp3 (adhan-fajr.mp3 for Fajr), then a synthesized chime.
   Browsers block sound until a user gesture; while blocked, a "Tap to enable" pill is shown.
   Provides the 'adhan' service: { fire(k, withSound), hide(), unlock() }.
   Bus events: 'adhan:start' { k } when the screen opens, 'adhan:end' { k } when it closes. */
import { dayKey, formatTime } from '../core/format.js';
import { $, html, readNumber, openLayer, closeLayer, isOpen } from '../core/dom.js';
import { FIVE } from './prayer-times.js';

const ADHAN_URL = 'assets/audio/adhan.mp3';
const ADHAN_FAJR_URL = 'assets/audio/adhan-fajr.mp3';
const OVERLAY_MS = 6 * 60000;     // longest the overlay stays up
const SILENT_MS = 60000;          // overlay time when the prayer's sound is off
const CHIME_MS = 12000;           // overlay time after the chime

let ctx = null;
let audioCtx = null;
let unlocked = false;
const player = new Audio();
player.preload = 'auto';
const blobUrls = { main: null, fajr: null };
let chimeTimer = null, hideTimer = null;
let firing = null;              // prayer whose adhan screen is up
const fired = {};

function getCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) { try { audioCtx = new AC(); } catch (e) {} }
  }
  return audioCtx;
}

/* A tenth of a second of silence, played on the first gesture to unlock the media element. */
function silentUrl() {
  const n = 2205, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, 22050, true); v.setUint32(28, 44100, true); v.setUint16(32, 2, true);
  v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

function showSoundState() {
  $('soundPill').hidden = unlocked;
  ctx.slot('controls').classList.toggle('alert', !unlocked);
}

/* Called from user gestures. Sound counts as enabled only once the silent clip really plays:
   on a touch screen Chrome accepts the gesture on pointerup, not pointerdown, and a refused
   play() must leave the "Tap to enable" pill showing. */
let silent = null;
function unlock() {
  if (unlocked) return;
  const c = getCtx();
  if (c && c.state !== 'running') { try { const r = c.resume(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
  const done = () => { if (!unlocked) { unlocked = true; showSoundState(); } };
  try {
    if (!silent) silent = silentUrl();
    player.src = silent;
    const p = player.play();
    if (p && p.then) p.then(done, () => { if (c && c.state === 'running') done(); });
    else done();
  } catch (e) {}
}

function chime() {
  const c = getCtx(); if (!c) return;
  const notes = [392, 523.25, 659.25, 783.99, 659.25, 523.25], t0 = c.currentTime + 0.05;
  notes.forEach((f, i) => {
    const o = c.createOscillator(), g = c.createGain(), at = t0 + i * 1.1;
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.28 * ctx.cfg.volume, at + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 2.4);
    o.connect(g); g.connect(c.destination); o.start(at); o.stop(at + 2.5);
  });
  chimeTimer = setTimeout(hide, CHIME_MS);
}

function tryPlay(list, i) {
  if (i >= list.length) { chime(); return; }
  try {
    player.src = list[i]; player.volume = ctx.cfg.volume; player.currentTime = 0;
    const p = player.play();
    if (p && p.catch) p.catch(() => { tryPlay(list, i + 1); });
  } catch (e) { tryPlay(list, i + 1); }
}

function fire(k, withSound) {
  const times = ctx.use('times');
  const t = times.today(new Date());
  const name = times.name(k, t[k]);
  const at = formatTime(t[k], ctx.cfg.hour24);
  $('adhanAr').textContent = name[1];
  $('adhanEn').textContent = 'Time for ' + name[0];
  $('adhanAt').textContent = at.t + ' ' + at.ap;
  openLayer($('adhan'));
  firing = k;
  ctx.bus.emit('adhan:start', { k });
  clearTimeout(hideTimer); clearTimeout(chimeTimer);
  hideTimer = setTimeout(hide, OVERLAY_MS);
  if (!withSound) { chimeTimer = setTimeout(hide, SILENT_MS); return; }
  const list = [];
  if (k === 'fajr') { if (blobUrls.fajr) list.push(blobUrls.fajr); else if (!blobUrls.main) list.push(ADHAN_FAJR_URL); }
  list.push(blobUrls.main || ADHAN_URL);
  tryPlay(list, 0);
}

function hide() {
  clearTimeout(hideTimer); clearTimeout(chimeTimer);
  try { player.pause(); } catch (e) {}
  const was = isOpen($('adhan'));
  closeLayer($('adhan'));
  if (was) { ctx.bus.emit('adhan:end', { k: firing }); firing = null; }
}

/* Recordings chosen in settings are kept in IndexedDB on this device. */
function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('azan-clock', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('audio'); };
    r.onsuccess = () => { res(r.result); };
    r.onerror = () => { rej(r.error); };
  });
}
function dbDo(mode, fn) {
  return db().then((d) => new Promise((res, rej) => {
    const q = fn(d.transaction('audio', mode).objectStore('audio'));
    q.onsuccess = () => { res(q.result); };
    q.onerror = () => { rej(q.error); };
  })).catch(() => null);
}
function loadRecordings() {
  return Promise.all(['main', 'fajr'].map((k) =>
    dbDo('readonly', (s) => s.get(k)).then((blob) => {
      if (blobUrls[k]) URL.revokeObjectURL(blobUrls[k]);
      blobUrls[k] = blob ? URL.createObjectURL(blob) : null;
    })));
}
/* Saves a file picked in settings and records its name in the settings draft. */
function storeFile(inputId, key, draft) {
  const file = $(inputId).files[0];
  if (!file) return Promise.resolve();
  draft.audioNames[key] = file.name;
  return dbDo('readwrite', (s) => s.put(file, key));
}

export default {
  id: 'adhan-audio',
  defaults: { volume: 0.9, audioNames: { main: '', fajr: '' } },
  mount(c) {
    ctx = c;
    ctx.slot('controls').appendChild(html(
      '<button class="pill" id="soundPill" type="button" hidden>Tap to enable adhan sound</button>'));
    ctx.slot('overlays').appendChild(html(
      '<div class="adhan" id="adhan" hidden role="alertdialog" aria-labelledby="adhanEn">' +
        '<div class="ring">' +
          '<div class="ar" id="adhanAr"></div>' +
          '<div class="en" id="adhanEn"></div>' +
          '<div class="at" id="adhanAt"></div>' +
          '<button class="pill" id="silenceBtn" type="button">Silence</button>' +
        '</div>' +
      '</div>'));
    $('silenceBtn').addEventListener('click', hide);
    $('soundPill').addEventListener('click', unlock);
    player.addEventListener('ended', () => { if (isOpen($('adhan'))) hide(); });
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('pointerup', unlock);
    document.addEventListener('keydown', (e) => {
      unlock();
      if (e.key === 'Escape') hide();
    });
    const probe = getCtx();
    unlocked = !!(probe && probe.state === 'running');
    showSoundState();
    loadRecordings();
    ctx.provide('adhan', { fire, hide, unlock });
  },
  onTick(now) {
    const t = ctx.use('times').today(now), day = dayKey(now);
    FIVE.forEach((k) => {
      const d = now - t[k], id = day + k;
      if (d >= 0 && d < 45000 && !fired[id]) { fired[id] = true; fire(k, !!ctx.cfg.prayers[k].sound); }
    });
  },
  settings: [{
    section: 'audio', order: 10,
    grid: '<label class="wide" for="s-file-main">Adhan recording (MP3, stored on this device)<input type="file" id="s-file-main" accept="audio/*"><span id="s-file-main-name"></span></label>' +
      '<label class="wide" for="s-file-fajr">Fajr adhan recording, optional<input type="file" id="s-file-fajr" accept="audio/*"><span id="s-file-fajr-name"></span></label>' +
      '<label class="wide" for="s-volume">Volume<input type="range" id="s-volume" min="0" max="1" step="0.05"></label>',
    after: '<div class="actions" style="margin-top:10px">' +
        '<button class="btn" type="button" id="s-test">Play test adhan</button>' +
        '<button class="btn" type="button" id="s-clear-audio">Remove recordings</button>' +
      '</div>' +
      '<p class="hint">With no recording chosen, the clock looks for adhan.mp3 and adhan-fajr.mp3 in assets/audio/, then falls back to a soft chime.</p>',
    fill(cfg) {
      $('s-volume').value = cfg.volume;
      $('s-file-main-name').textContent = cfg.audioNames.main ? 'In use: ' + cfg.audioNames.main : '';
      $('s-file-fajr-name').textContent = cfg.audioNames.fajr ? 'In use: ' + cfg.audioNames.fajr : '';
    },
    read(d) { d.volume = readNumber('s-volume', 0.9); },
    commit(d) {
      return Promise.all([storeFile('s-file-main', 'main', d), storeFile('s-file-fajr', 'fajr', d)]).then(loadRecordings);
    },
    wire(sheet) {
      /* Tries the form's current values without saving them. */
      $('s-test').addEventListener('click', () => {
        unlock();
        sheet.apply({ save: false }).then(() => {
          sheet.close();
          fire(ctx.use('times').current(new Date()).next.k, true);
        });
      });
      $('s-clear-audio').addEventListener('click', () => {
        ctx.config.patch({ audioNames: { main: '', fajr: '' } });
        Promise.all(['main', 'fajr'].map((k) => dbDo('readwrite', (s) => s.delete(k))))
          .then(loadRecordings).then(sheet.fill);
      });
    }
  }]
};
