/* Compares the prototype (reference/azan-clock.html) with index.html: visible text, element
   boxes, and screenshots written to <outdir> as <scenario>-ref.png / -new.png.
   python3 -m http.server 8080, then:  RM=1 node tests/browser/compare-with-prototype.cjs <outdir>
   RM=1 turns on reduced motion so transitions do not blur the pixel comparison. */
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || '.';
const BASE = 'http://localhost:8080/';
const PAGES = { ref: BASE + 'reference/azan-clock.html', new: BASE + 'index.html' };
const VENDOR = fs.readFileSync(require('path').join(__dirname, '../../vendor/adhan.umd.min.js'));

const SCEN = [
  { id: 'afternoon', at: '2026-11-16T13:23:05-05:00' },
  { id: 'asr-live', at: '2026-11-16T14:25:30-05:00' },
  { id: 'night', at: '2026-11-16T23:47:12-05:00' },
  { id: 'predawn', at: '2026-11-17T03:05:00-05:00' },
  { id: 'friday-24h', at: '2026-11-20T12:10:00-05:00', cfg: { hour24: true, jumuah: '13:15', seconds: false } },
  { id: 'settings', at: '2026-11-16T13:23:05-05:00', act: async (p) => { await p.keyboard.press('Shift'); await p.waitForTimeout(100); await p.click('#setBtn'); await p.waitForTimeout(300); } },
  { id: 'adhan', at: '2026-11-16T14:15:10-05:00' },
  { id: 'feed', at: '2026-11-16T13:23:05-05:00', cfg: { feed: BASE + 'tests/fixtures/feed.json', feedTimes: true } },
  { id: 'portrait', at: '2026-11-16T13:23:05-05:00', vp: { width: 800, height: 1280 } },
  { id: 'phone', at: '2026-11-16T13:23:05-05:00', vp: { width: 390, height: 844 } },
];

(async () => {
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
  const report = [];
  for (const s of SCEN) {
    const texts = {};
    for (const [name, url] of Object.entries(PAGES)) {
      const context = await browser.newContext({ viewport: s.vp || { width: 1280, height: 800 }, timezoneId: 'America/New_York', serviceWorkers: 'block', reducedMotion: process.env.RM ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ body: VENDOR, contentType: 'application/javascript' }));
      await page.clock.setFixedTime(new Date(s.at));
      if (s.cfg) await page.addInitScript((c) => localStorage.setItem('azan-clock-config-v1', JSON.stringify(c)), s.cfg);
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1500);
      if (s.act) await s.act(page);
      await page.screenshot({ path: `${OUT}/${s.id}-${name}.png`, animations: 'disabled' });
      texts[name] = await page.evaluate(() => {
        const vis = (el) => el && !el.closest('[hidden]');
        const q = (sel) => Array.from(document.querySelectorAll(sel)).filter(vis).map((e) => e.textContent.trim()).join(' | ');
        return {
          top: q('#gregorian, #place, #hijri, #methodLabel'),
          clock: q('#hm, #ampm, #sec'), status: q('#status'),
          prayers: Array.from(document.querySelectorAll('.prayer')).map((e) => e.className + ':' + e.innerText.replace(/\s+/g, ' ')).join(' | '),
          dim: document.getElementById('dim').className,
          adhan: vis(document.getElementById('adhanEn')) ? q('#adhanAr, #adhanEn, #adhanAt') : '(hidden)',
          nowDot: document.getElementById('nowDot').style.left, span: document.getElementById('span').style.cssText,
          stage: document.getElementById('stage').style.transform,
          sky: getComputedStyle(document.documentElement).getPropertyValue('--sky-top'),
          sheet: document.getElementById('sheet').hidden ? '(hidden)' : document.getElementById('settingsForm').innerText.replace(/\s+/g, ' '),
          engine: (document.getElementById('s-engine') || {}).textContent,
          layout: Array.from(document.querySelectorAll('body *')).filter((e) => !['SCRIPT', 'TEMPLATE'].includes(e.tagName) && e.getClientRects().length)
            .map((e) => { const r = e.getBoundingClientRect(); return e.tagName + (e.id ? '#' + e.id : '') + '.' + e.className + '@' + [r.x, r.y, r.width, r.height].map((v) => v.toFixed(2)).join(','); })
            .filter((x) => !/^DIV\.@/.test(x) || true).join('\n'),
          fonts: document.fonts.check('300 20px Outfit') && document.fonts.check('20px Marcellus'),
        };
      });
      texts[name].errors = errors.join(' ; ');
      await context.close();
    }
    const strip = (t) => t.split('\n').filter((l) => !/^DIV\.@/.test(l)).join('\n');   // slot wrappers exist only in the new page
    texts.ref.layout = strip(texts.ref.layout); texts.new.layout = strip(texts.new.layout);
    const diffs = Object.keys(texts.ref).filter((k) => k !== 'engine' && texts.ref[k] !== texts.new[k]);
    if (diffs.includes('layout')) { const a = texts.ref.layout.split('\n'), b = texts.new.layout.split('\n'); console.log(s.id, 'layout lines', a.length, b.length, a.filter((l) => !b.includes(l)).slice(0, 8), b.filter((l) => !a.includes(l)).slice(0, 8)); }
    report.push({ id: s.id, diffs: diffs.map((k) => ({ k, ref: texts.ref[k], new: texts.new[k] })), sample: { status: texts.new.status, adhan: texts.new.adhan, top: texts.new.top, fonts: texts.new.fonts } });
  }
  await browser.close();
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
  for (const r of report) console.log(r.id, r.diffs.length ? JSON.stringify(r.diffs) : 'text identical', '|', JSON.stringify(r.sample));
})();
