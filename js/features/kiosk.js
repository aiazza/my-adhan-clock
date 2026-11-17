/* Kiosk details: full screen button, hidden cursor when idle, screen wake lock. */
import { $, html } from '../core/dom.js';

const IDLE_MS = 5000;

export default {
  id: 'kiosk',
  mount(ctx) {
    ctx.slot('controls').appendChild(html(
      '<button class="icon-btn" id="fsBtn" type="button" aria-label="Toggle full screen" title="Full screen">' +
        '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>' +
      '</button>'));
    $('fsBtn').addEventListener('click', () => {
      try {
        if (document.fullscreenElement) document.exitFullscreen();
        else { const p = document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); }
      } catch (e) {}
    });

    let idleTimer = null;
    const awake = () => {
      document.body.classList.remove('idle');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { document.body.classList.add('idle'); }, IDLE_MS);
    };
    document.addEventListener('pointermove', awake);
    document.addEventListener('pointerdown', awake);

    const lock = () => {
      try {
        if (navigator.wakeLock && document.visibilityState === 'visible') navigator.wakeLock.request('screen').catch(() => {});
      } catch (e) {}
    };
    document.addEventListener('visibilitychange', lock);
    lock();
  }
};
