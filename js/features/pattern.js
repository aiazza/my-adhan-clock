/* Faint eight-point star lattice drawn once on a canvas over the sky, masked away from the
   centre. Redrawn only when the window size changes. */
import { html } from '../core/dom.js';

let canvas = null;

function draw() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  g.strokeStyle = 'rgba(247,242,231,0.085)';
  g.lineWidth = 1;
  const s = Math.max(84, Math.min(w, h) / 6), r = s / 2;
  for (let y = -s; y < h + s; y += s) {
    for (let x = -s; x < w + s; x += s) {
      const cx = x + r, cy = y + r;
      let i, a;
      for (let k = 0; k < 2; k++) {
        g.beginPath();
        for (i = 0; i < 4; i++) {
          a = Math.PI / 2 * i + (k ? Math.PI / 4 : 0);
          g[i ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a), cy + r * Math.sin(a));
        }
        g.closePath(); g.stroke();
      }
      g.beginPath();
      for (i = 0; i < 8; i++) {
        a = Math.PI / 4 * i + Math.PI / 8;
        g[i ? 'lineTo' : 'moveTo'](cx + r * 0.4 * Math.cos(a), cy + r * 0.4 * Math.sin(a));
      }
      g.closePath(); g.stroke();
    }
  }
}

export default {
  id: 'pattern',
  mount(ctx) {
    ctx.slot('backdrop').appendChild(html('<canvas id="pattern" aria-hidden="true"></canvas>'));
    canvas = document.getElementById('pattern');
    draw();
    window.addEventListener('resize', draw);
  }
};
