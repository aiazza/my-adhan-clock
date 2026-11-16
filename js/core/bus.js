/* Tiny event bus shared by all features.
   bus.on(type, fn) returns a function that removes the listener. A listener that throws is
   logged and does not stop the others. */
export function createBus() {
  const map = new Map();
  return {
    on(type, fn) {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
      return () => map.get(type).delete(fn);
    },
    emit(type, detail) {
      const set = map.get(type);
      if (!set) return;
      Array.from(set).forEach((fn) => {
        try { fn(detail); } catch (e) { console.error('[bus] ' + type, e); }
      });
    }
  };
}
