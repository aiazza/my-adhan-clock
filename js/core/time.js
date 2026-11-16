/* The single clock that drives every feature. It ticks once per second, aligned to the second
   boundary, and on each tick calls, in this order:
     day(now)    when the calendar day changes, or after refresh()
     tick(now)   every second
     minute(now) when the minute changes, or after refresh()
   refresh() re-runs all three straight away (used after settings or the masjid feed change). */
import { dayKey } from './format.js';

export function createTimeline(handlers) {
  let day = '';
  let minute = -1;
  let timer = null;

  function step(now) {
    const key = dayKey(now);
    if (key !== day) { day = key; minute = -1; handlers.day(now); }
    handlers.tick(now);
    const m = Math.floor(now.getTime() / 60000);
    if (m !== minute) { minute = m; handlers.minute(now); }
  }
  function loop() {
    step(new Date());
    /* +2 ms so the timer lands just after the boundary, never just before it */
    timer = setTimeout(loop, 1002 - (Date.now() % 1000));
  }
  return {
    start() { if (timer === null) loop(); },
    refresh() { day = ''; minute = -1; step(new Date()); }
  };
}
