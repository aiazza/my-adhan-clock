/* Config store. Defaults come from the features (each exports `defaults`); the saved copy in
   localStorage is merged over them, so new settings pick up their default automatically.
   Every change is announced on the bus as 'config:change' with { saved, reset }. */

/* Deep merge of b over a, keeping only keys that exist in a (same as the prototype). */
export function merge(a, b) {
  const o = {};
  for (const k in a) {
    if (a[k] && typeof a[k] === 'object') o[k] = merge(a[k], (b && b[k]) || {});
    else o[k] = (b && b[k] !== undefined && b[k] !== null) ? b[k] : a[k];
  }
  return o;
}

export function createConfig(storageKey, defaults, bus) {
  const read = () => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (e) { return {}; }
  };
  const persist = () => { try { localStorage.setItem(storageKey, JSON.stringify(data)); } catch (e) {} };
  let data = merge(defaults, read());

  return {
    get data() { return data; },
    defaults,
    /* A deep copy to edit, e.g. as a settings draft. */
    draft() { return JSON.parse(JSON.stringify(data)); },
    /* Replace the whole config. { save: false } applies it without writing it to storage. */
    replace(next, opts) {
      const save = !opts || opts.save !== false;
      data = merge(defaults, next);
      if (save) persist();
      bus.emit('config:change', { saved: save, reset: false });
    },
    /* Change a few top-level keys and save. */
    patch(part) {
      data = merge(defaults, Object.assign({}, data, part));
      persist();
      bus.emit('config:change', { saved: true, reset: false });
    },
    reset() {
      data = merge(defaults, {});
      persist();
      bus.emit('config:change', { saved: true, reset: true });
    }
  };
}
