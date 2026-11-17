/* Sky gradient behind the clock that follows the real sun for the configured location.
   Repainted once a minute by setting the --sky-top / --sky-bottom tokens. */
import { minutesOfDay } from '../core/format.js';

const SKY = {
  night:   [[9, 13, 36], [24, 28, 74]],
  predawn: [[16, 24, 66], [62, 52, 112]],
  dawn:    [[38, 60, 118], [206, 128, 110]],
  day:     [[18, 68, 118], [62, 128, 174]],
  gold:    [[36, 60, 118], [204, 142, 82]],
  sunset:  [[34, 32, 90], [196, 98, 72]],
  dusk:    [[18, 20, 62], [92, 52, 102]]
};

/* ['rgb(..)', 'rgb(..)'] for the top and bottom of the sky at `now`, given today's times. */
export function skyColors(now, t) {
  const m = minutesOfDay;
  const stops = [
    [0, SKY.night], [m(t.fajr) - 50, SKY.night], [m(t.fajr), SKY.predawn], [m(t.sunrise), SKY.dawn],
    [m(t.sunrise) + 70, SKY.day], [Math.max(m(t.asr), m(t.sunrise) + 71), SKY.day], [m(t.maghrib) - 50, SKY.gold],
    [m(t.maghrib), SKY.sunset], [m(t.isha), SKY.dusk], [m(t.isha) + 40, SKY.night], [1441, SKY.night]
  ].sort((a, b) => a[0] - b[0]);
  const x = m(now);
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (x >= stops[i][0] && x <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const f = b[0] === a[0] ? 0 : (x - a[0]) / (b[0] - a[0]);
  const mix = (i) => 'rgb(' + a[1][i].map((v, j) => Math.round(v + (b[1][i][j] - v) * f)).join(',') + ')';
  return [mix(0), mix(1)];
}

let ctx = null;

export default {
  id: 'sky',
  mount(c) { ctx = c; },
  onMinute(now) {
    const colors = skyColors(now, ctx.use('times').today(now));
    const root = document.documentElement.style;
    root.setProperty('--sky-top', colors[0]);
    root.setProperty('--sky-bottom', colors[1]);
  }
};
