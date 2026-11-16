/* Small pure helpers for dates and times. No DOM, safe to import from Node tests. */

export function pad2(n) { return (n < 10 ? '0' : '') + n; }

/* Key for a local calendar day. Month is zero based; the masjid feed cache stores this form. */
export function dayKey(d) { return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }

export function minutesOfDay(d) { return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; }

/* { t: '5:07', ap: 'PM' } in 12 hour mode, { t: '17:07', ap: '' } in 24 hour mode. */
export function formatTime(d, hour24) {
  const h = d.getHours();
  const mm = pad2(d.getMinutes());
  if (hour24) return { t: pad2(h) + ':' + mm, ap: '' };
  return { t: (h % 12 || 12) + ':' + mm, ap: h < 12 ? 'AM' : 'PM' };
}

export function formatTimeHtml(d, hour24) {
  const f = formatTime(d, hour24);
  return f.t + (f.ap ? '<small>' + f.ap + '</small>' : '');
}

/* "13:15", "1:15 pm", "13.15" on the given day, or null. */
export function parseClock(str, day) {
  const m = /^\s*(\d{1,2})[:.](\d{2})\s*([ap]m)?\s*$/i.exec(str == null ? '' : String(str));
  if (!m) return null;
  let h = Number(m[1]);
  const mi = Number(m[2]);
  if (m[3]) h = h % 12 + (/p/i.test(m[3]) ? 12 : 0);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, mi, 0, 0);
}

/* "1:02:09" / "4:05" with seconds, "1 h 3 min" / "5 min" without. */
export function countdown(ms, showSeconds) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor(s % 3600 / 60);
  const ss = s % 60;
  if (!showSeconds) {
    const mins = Math.ceil(s / 60);
    return mins >= 60 ? Math.floor(mins / 60) + ' h ' + (mins % 60) + ' min' : mins + ' min';
  }
  return h ? h + ':' + pad2(m) + ':' + pad2(ss) : m + ':' + pad2(ss);
}
