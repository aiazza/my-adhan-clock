/* Built-in prayer time calculation, used only when adhan-js (vendor/) has not loaded.
   Pure functions, no DOM. Standard solar position approximation (accurate to well under a
   minute for this purpose). The math is unchanged from the prototype. */

const R = Math.PI / 180;
const sin = (d) => Math.sin(d * R);
const cos = (d) => Math.cos(d * R);
const tan = (d) => Math.tan(d * R);
const asin = (x) => Math.asin(x) / R;
const acos = (x) => Math.acos(x) / R;
const atan2 = (y, x) => Math.atan2(y, x) / R;
const acot = (x) => Math.atan(1 / x) / R;
function fix(a, b) { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; }

export const METHODS = {
  ISNA:    { fajr: 15,   isha: 15 },
  MWL:     { fajr: 18,   isha: 17 },
  Egypt:   { fajr: 19.5, isha: 17.5 },
  Karachi: { fajr: 18,   isha: 18 },
  Makkah:  { fajr: 18.5, ishaMinutes: 90 },
  Moonsighting: { fajr: 18, isha: 18 }
};

function julian(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}
function sun(jd) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = atan2(cos(e) * sin(L), cos(L)) / 15;
  return { decl: asin(sin(e) * sin(L)), eqt: q / 15 - fix(RA, 24) };
}

/* Returns epoch milliseconds for each event on the given civil date (m is 1-12). */
export function compute(y, m, d, lat, lng, opt) {
  const meth = METHODS[opt.method] || METHODS.ISNA;
  const jd = julian(y, m, d) - lng / (15 * 24);
  const noon = (t) => fix(12 - sun(jd + t).eqt, 24);
  function angleTime(angle, t, before) {
    const decl = sun(jd + t).decl;
    const x = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
    const T = acos(x) / 15;
    return noon(t) + (before ? -T : T);
  }
  function asrTime(factor, t) {
    const decl = sun(jd + t).decl;
    const angle = -acot(factor + tan(Math.abs(lat - decl)));
    return angleTime(angle, t, false);
  }
  let h = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };
  for (let i = 0; i < 3; i++) {
    h = {
      fajr: angleTime(meth.fajr, h.fajr / 24, true),
      sunrise: angleTime(0.833, h.sunrise / 24, true),
      dhuhr: noon(h.dhuhr / 24),
      asr: asrTime(opt.asrFactor || 1, h.asr / 24),
      maghrib: angleTime(0.833, h.maghrib / 24, false),
      isha: meth.ishaMinutes ? h.isha : angleTime(meth.isha, h.isha / 24, false)
    };
  }
  /* High latitude fallback: split the night by angle when twilight never ends. */
  const night = 24 - (h.maghrib - h.sunrise);
  if (isNaN(h.fajr)) h.fajr = h.sunrise - night * meth.fajr / 60;
  if (meth.ishaMinutes) h.isha = h.maghrib + meth.ishaMinutes / 60;
  else if (isNaN(h.isha)) h.isha = h.maghrib + night * meth.isha / 60;

  const base = Date.UTC(y, m - 1, d), out = {};
  for (const k in h) out[k] = base + (h[k] - lng / 15) * 3600000;
  return out;
}
