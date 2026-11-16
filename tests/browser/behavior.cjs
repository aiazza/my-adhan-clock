/* Behavior checks in Chromium (Playwright) with a fake clock. Start a server first:
     python3 -m http.server 8080
   then run:  node tests/browser/behavior.cjs [url]   Needs the playwright package. */
const { chromium } = require('playwright');
const URL_ = process.argv[2] || 'http://localhost:8080/index.html';
const results = [];
const ok = (name, cond, extra) => { results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };

(async () => {
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
  const fresh = async (opts = {}) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'America/New_York', serviceWorkers: opts.sw ? 'allow' : 'block' });
    const page = await context.newPage();
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(e.message));
    return { context, page };
  };
  const text = (p, sel) => p.$eval(sel, (e) => e.textContent);

  /* 1. ticking, midnight rollover, adhan firing with a running fake clock */
  {
    const { context, page } = await fresh();
    await page.clock.install({ time: new Date('2026-11-16T23:59:57.300-05:00') });
    await page.goto(URL_);
    await page.clock.runFor(200);
    const s0 = await text(page, '#sec');
    await page.clock.runFor(1000);
    const s1 = await text(page, '#sec');
    ok('seconds tick once per second', Number(s1) === (Number(s0) + 1) % 60, s0 + ' -> ' + s1);
    const g0 = await text(page, '#gregorian');
    await page.clock.runFor(4000);
    const g1 = await text(page, '#gregorian');
    ok('day rolls over at midnight', g0.includes('16') && g1.includes('17'), g0 + ' -> ' + g1);
    ok('clock shows 12:00 after midnight', (await text(page, '#hm')) === '12:00' && (await text(page, '#ampm')) === 'AM');
    const fajr = await page.$eval('#p-fajr .time', (e) => e.textContent);
    ok('tomorrow\'s fajr shown after rollover', /^5:2\dAM$/.test(fajr), fajr);
    // jump to just before Fajr on the 17th and let the adhan fire
    await page.clock.fastForward('05:15:00');
    let shown = false, steps = 0;
    while (!shown && steps++ < 200) { await page.clock.runFor(5000); shown = await page.$eval('#adhan', (e) => !e.hidden); }
    const st = await text(page, '#status');
    const clockAt = (await text(page, '#hm')) + ':' + (await text(page, '#sec'));
    ok('adhan overlay appears at Fajr', shown && fajr.startsWith(clockAt.slice(0, 4)), 'fired at ' + clockAt + ', fajr ' + fajr + ', ' + (await text(page, '#adhanEn')));
    ok('overlay fades in (opacity transition, not a pop)', await page.$eval('#adhan', (e) => e.classList.contains('open') && getComputedStyle(e).transitionProperty.includes('opacity')));
    await page.click('#silenceBtn');
    ok('overlay starts fading out on Silence', await page.$eval('#adhan', (e) => !e.classList.contains('open')));
    await page.clock.runFor(600);
    ok('Silence hides the overlay after the fade', await page.$eval('#adhan', (e) => e.hidden));
    ok('status counts down to iqamah during the wait', /Fajr<\/b> iqamah in/.test(await page.$eval('#status', (e) => e.innerHTML)), st);
    ok('no page errors (1)', !page.errors.length, page.errors.join(';'));
    await context.close();
  }

  /* 2. settings: save, persist, reset, failing feed */
  {
    const { context, page } = await fresh();
    await page.clock.setFixedTime(new Date('2026-11-16T13:23:05-05:00'));
    await page.goto(URL_);
    await page.keyboard.press('Shift');
    await page.click('#setBtn');
    await page.check('#s-hour24');
    await page.fill('#s-place', 'Bronx');
    await page.fill('#s-asr-iqamah', '19:30');
    await page.selectOption('#s-asr', '2');
    await page.fill('#s-feed', 'http://localhost:8080/does-not-exist.json');
    await page.click('button[type=submit]');
    await page.waitForTimeout(700);
    ok('sheet closes on save', await page.$eval('#sheet', (e) => e.hidden));
    ok('24h clock applied', (await text(page, '#hm')) === '13:23', await text(page, '#hm'));
    ok('place label applied', (await text(page, '#place')) === 'Bronx');
    ok('Hanafi Asr applied', (await text(page, '#p-asr .time')) === '14:5' + (await text(page, '#p-asr .time')).slice(-1), await text(page, '#p-asr .time'));
    ok('fixed iqamah applied', (await text(page, '#p-asr .iq')) === 'Iqamah 19:30');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('azan-clock-config-v1')));
    ok('config saved to localStorage', saved.hour24 === true && saved.place === 'Bronx' && saved.asr === 2 && saved.prayers.asr.iqamah === '19:30');
    await page.click('#setBtn');
    const fs = await text(page, '#s-feed-status');
    ok('failing feed reports status and falls back', /Could not load the feed \(HTTP 404\)\. Using your manual iqamah times\./.test(fs), fs);
    await page.click('#s-reset');
    await page.click('#s-close');
    await page.waitForTimeout(700);
    ok('reset restores defaults', (await text(page, '#hm')) === '1:23' && (await text(page, '#place')) === 'Queens, New York');
    ok('no page errors (2)', !page.errors.length, page.errors.join(';'));
    await context.close();
  }

  /* 2b. first tap on the gear while sound is locked opens settings (the prototype lost it) */
  {
    const { context, page } = await fresh();
    await page.clock.setFixedTime(new Date('2026-11-16T13:23:05-05:00'));
    await page.goto(URL_);
    const pillBefore = await page.$eval('#soundPill', (e) => !e.hidden);
    await page.click('#setBtn');
    await page.waitForTimeout(600);
    ok('first tap on the gear opens settings while the sound pill is showing', pillBefore && !(await page.$eval('#sheet', (e) => e.hidden)));
    ok('sound unlocked by that tap', await page.$eval('#soundPill', (e) => e.hidden));
    await context.close();
  }

  /* 3. adhan-js missing -> built-in fallback still runs */
  {
    const { context, page } = await fresh();
    await page.route('**/vendor/adhan.umd.min.js', (r) => r.abort());
    await page.clock.setFixedTime(new Date('2026-11-16T13:23:05-05:00'));
    await page.goto(URL_);
    await page.keyboard.press('Shift');
    await page.click('#setBtn');
    ok('fallback engine used when vendor file fails', (await text(page, '#s-engine')) === 'Calculated with built-in fallback.', await text(page, '#s-engine'));
    ok('fallback still shows times', (await text(page, '#p-dhuhr .time')).startsWith('11:4'), await text(page, '#p-dhuhr .time'));
    await context.close();
  }

  /* 4. night dim and tap to undim */
  {
    const { context, page } = await fresh();
    await page.clock.install({ time: new Date('2026-11-16T23:30:00-05:00') });
    await page.goto(URL_);
    await page.clock.runFor(1500);
    ok('dimmed late at night', await page.$eval('#dim', (e) => e.classList.contains('on')));
    await page.mouse.click(640, 300);
    ok('tap lifts dimming', !(await page.$eval('#dim', (e) => e.classList.contains('on'))));
    await page.clock.runFor(61000);
    ok('dims again after the next minute past 30 s', await page.$eval('#dim', (e) => e.classList.contains('on')));
    await context.close();
  }

  /* 5. service worker: second load works offline */
  {
    const { context, page } = await fresh({ sw: true });
    await page.goto(URL_);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(2500);
    const cached = await page.evaluate(() => caches.open('azan-clock-v1').then((c) => c.keys()).then((k) => k.map((r) => r.url)));
    ok('service worker cached the app', cached.some((u) => u.endsWith('/js/features/settings.js')) && cached.some((u) => u.includes('fonts.gstatic.com')), cached.length + ' entries');
    await context.setOffline(true);
    await page.reload();
    await page.waitForTimeout(1000);
    const hm = await text(page, '#hm').catch(() => '');
    ok('page loads offline from the cache', /\d:\d\d/.test(hm), hm);
    ok('fonts available offline', await page.evaluate(() => document.fonts.ready.then(() => document.fonts.check('300 20px Outfit'))));
    await context.close();
  }

  await browser.close();
  console.log(results.join('\n'));
})();
