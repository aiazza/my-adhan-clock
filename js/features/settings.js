/* Settings sheet (gear icon). The form is assembled from the `settings` contributions of every
   enabled feature, so a feature brings its own fields. A contribution looks like:

     { section: 'display',        // one of SECTIONS below, or a new id (then give `title`)
       order: 20,                 // position inside the section
       grid: '<label>…</label>',  // fields placed in the section's two column grid
       after: '<p>…</p>',         // anything placed after the grid (tables, hints, buttons)
       fill(cfg),                 // put the saved values into the fields
       read(draft),               // copy the fields into the draft config
       commit(draft),             // optional, async work before saving (returns a Promise)
       wire(sheet) }              // optional, attach listeners; sheet = { apply, close, fill }
*/
import { $, html } from '../core/dom.js';

const SECTIONS = [
  ['location', 'Location'],
  ['calculation', 'Calculation'],
  ['feed', 'Masjid sync (optional)'],
  ['prayers', 'Prayers'],
  ['audio', 'Adhan audio'],
  ['display', 'Display']
];

let ctx = null;
let parts = [];

function buildForm() {
  const titles = new Map(SECTIONS);
  const order = SECTIONS.map((s) => s[0]);
  parts.forEach((p) => {
    if (!titles.has(p.section)) { titles.set(p.section, p.title || p.section); order.push(p.section); }
  });
  const sections = order.map((id) => {
    const items = parts.filter((p) => p.section === id);
    if (!items.length) return '';
    const grid = items.filter((p) => p.grid).map((p) => p.grid).join('');
    const after = items.filter((p) => p.after).map((p) => p.after).join('');
    return '<section><h3>' + titles.get(id) + '</h3>' + (grid ? '<div class="grid">' + grid + '</div>' : '') + after + '</section>';
  }).join('');
  return '<div class="sheet" id="sheet" hidden>' +
    '<form id="settingsForm" autocomplete="off">' +
      '<div class="head"><h2>Settings</h2><button class="btn" type="button" id="s-close">Close</button></div>' +
      sections +
      '<div class="actions">' +
        '<button class="btn primary" type="submit">Save</button>' +
        '<button class="btn" type="button" id="s-reset">Reset to defaults</button>' +
      '</div>' +
    '</form>' +
  '</div>';
}

function fill() { parts.forEach((p) => { if (p.fill) p.fill(ctx.cfg, ctx); }); }
function open() { fill(); $('sheet').hidden = false; $('s-close').focus(); }
function close() { $('sheet').hidden = true; }

/* Read every field into a draft, run async commits, then apply (and by default save) it. */
function apply(opts) {
  const draft = ctx.config.draft();
  parts.forEach((p) => { if (p.read) p.read(draft); });
  return Promise.all(parts.map((p) => (p.commit ? p.commit(draft) : null)))
    .then(() => { ctx.config.replace(draft, opts); });
}

export default {
  id: 'settings',
  mount(c) {
    ctx = c;
    parts = [];
    ctx.features.forEach((f) => (f.settings || []).forEach((p) => parts.push(p)));
    parts = parts.map((p, i) => ({ p, i }))
      .sort((a, b) => ((a.p.order || 0) - (b.p.order || 0)) || (a.i - b.i))
      .map((x) => x.p);

    ctx.slot('controls').appendChild(html(
      '<button class="icon-btn" id="setBtn" type="button" aria-label="Open settings" title="Settings">' +
        '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>' +
      '</button>'));
    ctx.slot('overlays').appendChild(html(buildForm()));

    $('setBtn').addEventListener('click', open);
    $('s-close').addEventListener('click', close);
    $('sheet').addEventListener('click', (e) => { if (e.target === $('sheet')) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    $('settingsForm').addEventListener('submit', (e) => {
      e.preventDefault();
      apply({ save: true }).then(close);
    });
    $('s-reset').addEventListener('click', () => { ctx.config.reset(); fill(); });

    const sheet = { apply, close, fill };
    parts.forEach((p) => { if (p.wire) p.wire(sheet); });
  }
};
