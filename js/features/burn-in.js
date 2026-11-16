/* Shifts the whole layout by a few pixels each minute so a static layout does not burn into
   the panel. */
let stage = null;

export default {
  id: 'burn-in',
  mount(ctx) { stage = ctx.slot('stage'); },
  onMinute(now) {
    const m = now.getMinutes();
    stage.style.transform = 'translate(' + ((m % 5) - 2) * 2 + 'px,' + ((m % 3) - 1) * 2 + 'px)';
  }
};
