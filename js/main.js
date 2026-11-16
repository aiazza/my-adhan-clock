/* Entry point. Builds the shared context, mounts every feature, and starts the clock.

   A feature is a plain object; every field is optional except id:
     id            unique name
     defaults      config keys this feature owns, with their default values
     mount(ctx)    build DOM into slots, add listeners, provide services
     start(ctx)    called once after the first tick (network work, intervals)
     onDayChange(now)   new calendar day, or settings / feed changed (ctx.refresh())
     onTick(now)        every second, on the second
     onMinute(now)      every minute, and after onDayChange
     settings      fields for the settings sheet, see js/features/settings.js

   ctx gives each feature:
     ctx.cfg              current config (read it fresh each time, it is replaced on save)
     ctx.config           the store: draft(), replace(cfg, { save }), patch(part), reset()
     ctx.bus              on(type, fn) / emit(type, detail); 'config:change' fires on every change
     ctx.slot(name)       layout slot element: backdrop, stage, top-start, controls, top-end,
                          center, daybar, prayers, overlays (see index.html)
     ctx.provide(name, api) / ctx.use(name)   share a service ('times', 'feed', 'adhan')
     ctx.refresh()        recompute and re-render everything now
     ctx.rev              bumps on every refresh, for memo keys
     ctx.features         the enabled feature list */
import { createBus } from './core/bus.js';
import { createConfig } from './core/config.js';
import { createTimeline } from './core/time.js';
import features from './features/index.js';

const CONFIG_KEY = 'azan-clock-config-v1';

const bus = createBus();
const defaults = {};
features.forEach((f) => {
  Object.keys(f.defaults || {}).forEach((k) => {
    if (k in defaults) console.warn('[config] ' + f.id + ' redefines default "' + k + '"');
    defaults[k] = f.defaults[k];
  });
});
const config = createConfig(CONFIG_KEY, defaults, bus);
const services = {};

/* Run one hook on every feature; one feature failing does not stop the others. */
function each(hook, arg) {
  features.forEach((f) => {
    if (!f[hook]) return;
    try { f[hook](arg); } catch (e) { console.error('[' + f.id + '] ' + hook, e); }
  });
}

const timeline = createTimeline({
  day: (now) => each('onDayChange', now),
  tick: (now) => each('onTick', now),
  minute: (now) => each('onMinute', now)
});

const ctx = {
  get cfg() { return config.data; },
  config,
  bus,
  rev: 0,
  features,
  slot: (name) => document.querySelector('[data-slot="' + name + '"]'),
  provide: (name, api) => { services[name] = api; },
  use: (name) => services[name] || null,
  refresh() { ctx.rev++; timeline.refresh(); }
};

each('mount', ctx);
/* Features listen first (they may need to drop cached data), then everything re-renders. */
bus.on('config:change', () => ctx.refresh());
timeline.start();
each('start', ctx);

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      /* Ask the worker to keep everything this page loaded, so the next start works offline. */
      const send = (w) => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name).concat(location.href);
        if (w) w.postMessage({ type: 'cache-urls', urls });
      };
      const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
      Promise.all([navigator.serviceWorker.ready, fontsReady]).then((r) => send(r[0].active || reg.active));
    }).catch(() => {});
  });
}
