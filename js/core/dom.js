/* DOM helpers shared by features. */

export function $(id) { return document.getElementById(id); }

/* Parse an HTML string into a fragment ready to append. */
export function html(str) {
  const t = document.createElement('template');
  t.innerHTML = str.trim();
  return t.content;
}

/* Set textContent / innerHTML only when the value differs, so unchanged text costs nothing. */
export function setText(el, value) {
  const v = String(value);
  if (el.textContent !== v) el.textContent = v;
}
export function setHtml(el, value) {
  if (el._html !== value) { el._html = value; el.innerHTML = value; }
}

/* Number from an input, or the fallback when it is empty or not a number. */
export function readNumber(id, fallback) {
  const v = parseFloat($(id).value);
  return isNaN(v) ? fallback : v;
}
