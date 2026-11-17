/* Settings from the site: an optional settings.json next to index.html, edited on GitHub (or
   from any computer) instead of on the tablet. It holds any part of the config, for example
     { "place": "Queens, New York", "jumuah": "13:15",
       "prayers": { "dhuhr": { "iqamah": "13:30" } } }
   Keys it leaves out keep their current value; unknown keys (such as "_help") are ignored.

   The file is applied when its content changes, then saved like a change made on the tablet.
   So a change made later with the gear icon stays until the file is edited again.
   settings.example.json lists every key. */
import { merge } from '../core/config.js';

const FILE_URL = 'settings.json';
const SEEN_KEY = 'azan-clock-settings-file';

/* The current config with the file's values laid over it (nested keys too). */
export function applyFile(current, file) { return merge(current, file); }

export default {
  id: 'settings-file',
  start(ctx) {
    fetch(FILE_URL, { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : null))
      .then((text) => {
        if (!text) return;
        let file;
        try { file = JSON.parse(text); } catch (e) { console.warn('[settings-file] settings.json is not valid JSON', e); return; }
        if (!file || typeof file !== 'object' || Array.isArray(file)) return;
        const sig = JSON.stringify(file);
        let seen = null;
        try { seen = localStorage.getItem(SEEN_KEY); } catch (e) {}
        if (seen === sig) return;
        ctx.config.replace(applyFile(ctx.cfg, file));
        try { localStorage.setItem(SEEN_KEY, sig); } catch (e) {}
      })
      .catch(() => {});
  }
};
