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

/* Overlays (adhan screen, settings sheet) fade in and out instead of popping.
   The element keeps the `hidden` attribute while closed, so it costs nothing then; the CSS
   animates the `.open` class (opacity / transform only). LAYER_MS matches --t-overlay. */
export const LAYER_MS = 450;
const reducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

export function isOpen(el) { return !el.hidden && el.classList.contains('open'); }

export function openLayer(el) {
  clearTimeout(el._layerTimer);
  if (el.hidden) {
    el.hidden = false;
    el.getBoundingClientRect();   // commit the closed state so the transition runs
  }
  el.classList.add('open');
}

export function closeLayer(el) {
  if (el.hidden) return;
  el.classList.remove('open');
  clearTimeout(el._layerTimer);
  if (reducedMotion()) { el.hidden = true; return; }
  el._layerTimer = setTimeout(() => { el.hidden = true; }, LAYER_MS);
}
