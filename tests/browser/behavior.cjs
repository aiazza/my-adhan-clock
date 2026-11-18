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

  /* 6. art backgrounds crossfade on schedule */
  {
    const { context, page } = await fresh();
    await page.clock.install({ time: new Date('2026-11-17T09:00:05-05:00') });
    await page.goto(URL_);
    await page.clock.runFor(3000);
    const shown = () => page.$$eval('.bg-layer.show', (l) => l.map((x) => x.getAttribute('src')));
    const first = await shown();
    ok('art mode by default, one image showing', first.length === 1 && /assets\/backgrounds\/.+\.webp$/.test(first[0]) && await page.$eval('body', (b) => b.classList.contains('bg-art')), first.join());
    ok('star lattice hidden over art', await page.$eval('#pattern', (e) => getComputedStyle(e).display === 'none'));
    await page.clock.runFor(10 * 60000 + 2000);
    await page.waitForTimeout(1500);              // the image decodes in real time
    const second = await shown();
    ok('next image after 10 minutes', second.length === 1 && second[0] !== first[0], first[0] + ' -> ' + second[0]);
    ok('crossfade uses an opacity transition', await page.$eval('.bg-layer', (e) => getComputedStyle(e).transitionProperty === 'opacity'));
    ok('no page errors (6)', !page.errors.length, page.errors.join(';'));
    await context.close();
  }

  /* 7. reminder slides: show, close, pause during prayer. The adhan recording plays in real time
     while this test's clock runs fast, so use the short chime here (blocks 14b-c test the mp3). */
  {
    const { context, page } = await fresh();
    await page.route('**/*.mp3', (r) => r.fulfill({ status: 404, body: '' }));
    await page.clock.install({ time: new Date('2026-11-17T09:00:05-05:00') });
    await page.goto(URL_);
    await page.clock.runFor(30000);
    ok('no slide in the first minute', await page.$eval('#slide', (e) => e.hidden));
    await page.clock.runFor(35000);
    const kind = await page.$eval('#slideKind', (e) => e.textContent);
    ok('first slide after a minute', !(await page.$eval('#slide', (e) => e.hidden)) && kind.length > 0, kind);
    await page.waitForTimeout(1000);              // CSS fades run in real time
    ok('clock hidden behind the slide', await page.$eval('#stage', (e) => getComputedStyle(e).opacity === '0'));
    ok('corner clock on the slide', /^9:01 AM$/.test(await page.$eval('#slideTime', (e) => e.textContent)), await page.$eval('#slideTime', (e) => e.textContent));
    await page.clock.runFor(52000);
    await page.waitForTimeout(1000);
    ok('slide closes by itself after 30 s', await page.$eval('#slide', (e) => e.hidden) && await page.$eval('#stage', (e) => getComputedStyle(e).opacity === '1'));
    // a slide closed by a tap must not be followed by another one right away
    await page.clock.runFor(10 * 60000);
    ok('second slide 10 minutes later', !(await page.$eval('#slide', (e) => e.hidden)));
    await page.mouse.click(640, 400);
    await page.waitForTimeout(800);
    let early = false;
    for (let i = 0; i < 9 * 12; i++) { await page.clock.runFor(5000); if (!(await page.$eval('#slide', (e) => e.hidden))) { early = true; break; } }
    ok('after tapping a slide closed, none for the next 9 minutes', !early);
    // jump to just before Dhuhr (11:41): nothing may show until 15 min after iqamah (11:56)
    await page.clock.fastForward('02:19:00');
    let during = false, duaAt = '';
    for (let i = 0; i < 40 * 12; i++) {
      await page.clock.runFor(5000);
      if (await page.$eval('#slide', (e) => e.hidden)) continue;
      const k = await page.$eval('#slideKind', (e) => e.textContent), at = await page.$eval('#slideTime', (e) => e.textContent);
      if (k === 'After the adhan') { duaAt = duaAt || at; continue; }   // allowed: follows the adhan screen
      during = at + ' ' + k; break;
    }
    ok('dua after the Dhuhr adhan at 11:41', duaAt === '11:41 AM', duaAt);
    ok('next slide only 15 minutes after iqamah, an after-prayer dhikr', /^12:11 PM After the prayer$/.test(during), 'first slide: ' + during);
    ok('no page errors (7)', !page.errors.length, page.errors.join(';'));
    await context.close();
  }

  /* 8. the dua after the adhan follows the adhan screen; sky mode still works */
  {
    const { context, page } = await fresh();
    await page.addInitScript(() => localStorage.setItem('azan-clock-config-v1', JSON.stringify({ bgMode: 'sky' })));
    await page.clock.install({ time: new Date('2026-11-17T14:13:40-05:00') });
    await page.goto(URL_);
    await page.clock.runFor(2000);
    ok('sky mode: no art, lattice visible', !(await page.$eval('body', (b) => b.classList.contains('bg-art'))) && await page.$eval('#pattern', (e) => getComputedStyle(e).display !== 'none'));
    let open = false;
    for (let i = 0; i < 60 && !open; i++) { await page.clock.runFor(1000); open = await page.$eval('#adhan', (e) => !e.hidden); }
    ok('Asr adhan screen opens', open);
    await page.click('#silenceBtn');
    await page.clock.runFor(1500);
    const k = await page.$eval('#slideKind', (e) => e.textContent);
    const ref = await page.$eval('#slideRef', (e) => e.textContent);
    ok('dua after the adhan shows when the adhan ends', !(await page.$eval('#slide', (e) => e.hidden)) && k === 'After the adhan' && ref === 'Sahih al-Bukhari 614', k + ' / ' + ref);
    ok('no page errors (8)', !page.errors.length, page.errors.join(';'));
    await context.close();
  }

  /* 9. reminders before a prayer: banner, chime, slides give way, last one counts down */
  {
    const { context, page } = await fresh();
    await page.addInitScript(() => {
      window.__notes = 0;
      const AC = window.AudioContext || window.webkitAudioContext;
      const orig = AC.prototype.createOscillator;
      AC.prototype.createOscillator = function () { window.__notes++; return orig.call(this); };
    });
    await page.clock.install({ time: new Date('2026-11-17T11:09:00-05:00') });   // Dhuhr 11:41
    await page.goto(URL_);
    await page.keyboard.press('Shift');                                            // sound on
    await page.clock.runFor(60000);                                                // 11:10
    ok('no banner 31 minutes before', await page.$eval('#pre', (e) => e.hidden));
    let slideBefore = false;
    for (let i = 0; i < 12 && !(await page.$eval('#pre', (e) => !e.hidden)); i++) {
      slideBefore = slideBefore || !(await page.$eval('#slide', (e) => e.hidden));
      await page.clock.runFor(5000);
    }
    const text = async () => (await page.$eval('#pre', (e) => Array.from(e.children).map((c) => c.textContent).join(' '))).replace(/\s+/g, ' ').trim();
    ok('30 minute banner', /^الظهر Dhuhr in 30 minutes Iqamah 11:56$/.test(await text()), await text());
    ok('soft chime played', await page.evaluate(() => window.__notes) === 3, 'notes: ' + await page.evaluate(() => window.__notes));
    ok('reminder slide closed by the banner', await page.$eval('#slide', (e) => e.hidden), 'slide was open before: ' + slideBefore);
    await page.clock.runFor(61000);
    await page.waitForTimeout(700);
    ok('banner leaves after a minute', await page.$eval('#pre', (e) => e.hidden));
    await page.clock.fastForward('14:00');                                          // 11:26
    await page.clock.runFor(3000);
    ok('15 minute banner', /Dhuhr in 15 minutes/.test(await text()), await text());
    await page.clock.fastForward('04:50');                                          // 11:31
    await page.clock.runFor(10000);
    ok('10 minute banner', /Dhuhr in 10 minutes/.test(await text()), await text());
    await page.clock.fastForward('05:00');                                          // 11:36
    await page.clock.runFor(4000);
    ok('5 minute banner counts down', /Dhuhr in 4:5\d/.test(await text()), await text());
    await page.clock.runFor(120000);
    ok('still up two minutes later', !(await page.$eval('#pre', (e) => e.hidden)) && /Dhuhr in 2:5\d/.test(await text()), await text());
    ok('one chime per reminder (30, 15, 10, 5)', await page.evaluate(() => window.__notes) === 12, 'notes: ' + await page.evaluate(() => window.__notes));
    let gone = false;
    for (let i = 0; i < 40 && !gone; i++) { await page.clock.runFor(5000); gone = await page.$eval('#adhan', (e) => !e.hidden); }
    await page.waitForTimeout(700);
    ok('banner gives way to the adhan screen', gone && await page.$eval('#pre', (e) => e.hidden));
    ok('no page errors (9)', !page.errors.length, page.errors.join(';'));
    await context.close();
  }

  /* 10-12. safe automatic updates: version.json changes, the clock reloads at a quiet time */
  const updatesPage = async (startAt) => {
    const { context, page } = await fresh();
    const v = { version: 'a' };
    await page.route('**/version.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(v) }));
    await page.addInitScript(() => localStorage.setItem('azan-clock-config-v1', JSON.stringify({ slideEvery: 0 })));
    await page.clock.install({ time: new Date(startAt) });
    await page.goto(URL_);
    await page.clock.runFor(2000);
    await page.waitForTimeout(300);                 // the first version.json read
    await page.evaluate(() => { window.__mark = 1; });
    v.version = 'b';
    const reloaded = async () => { try { return await page.evaluate(() => window.__mark !== 1); } catch (e) { return false; } };
    /* Runs a minute at a time; returns the clock time (h:mm) at the end of the minute in which the
       page reloaded (the reload happens on that minute boundary), or ''. */
    const runUntilReload = async (minutes) => {
      for (let i = 0; i < minutes; i++) {
        const end = await page.evaluate(() => { const d = new Date(Date.now() + 60000); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); });
        await page.clock.runFor(60000);
        await page.waitForTimeout(150);
        if (await reloaded()) return end;
      }
      return '';
    };
    return { context, page, reloaded, runUntilReload };
  };
  {
    const { context, page, reloaded, runUntilReload } = await updatesPage('2026-11-17T09:00:05-05:00');
    await page.clock.runFor(25 * 60000);
    await page.waitForTimeout(300);
    ok('no reload before the 30 minute check', !(await reloaded()));
    const when = await runUntilReload(12);
    ok('reloads soon after the next check on a calm morning', /^9:3[1-4]$/.test(when), 'reloaded during ' + when);
    ok('no page errors (10)', !page.errors.length, page.errors.join(';'));
    await context.close();
  }
  {
    const { context, page, runUntilReload } = await updatesPage('2026-11-17T10:45:05-05:00');
    const when = await runUntilReload(100);
    ok('update found at 11:16 waits until 15 minutes after Dhuhr iqamah (12:11)', /^12:1[1-2]$/.test(when), 'reloaded during ' + (when || 'never'));
    ok('no page errors (11)', !page.errors.length, page.errors.join(';'));
    await context.close();
  }
  {
    const { context, page, runUntilReload } = await updatesPage('2026-11-17T09:00:05-05:00');
    await page.mouse.click(640, 300);
    await page.waitForTimeout(500);
    ok('a tap unlocked the sound', await page.$eval('#soundPill', (e) => e.hidden));
    const when = await runUntilReload(45);
    ok('no automatic reload when sound was unlocked by a tap (it would lock again)', when === '', 'reloaded during ' + when);
    await context.close();
  }

  /* 13. settings.json from the site is applied once per change */
  {
    const { context, page } = await fresh();
    const file = { body: JSON.stringify({ place: 'From the file', prayers: { dhuhr: { iqamah: '13:30' } }, _help: 'ignored' }) };
    await page.route('**/settings.json', (r) => r.fulfill({ contentType: 'application/json', body: file.body }));
    await page.clock.setFixedTime(new Date('2026-11-17T09:00:05-05:00'));
    await page.goto(URL_);
    await page.waitForTimeout(800);
    const saved = async () => page.evaluate(() => JSON.parse(localStorage.getItem('azan-clock-config-v1') || '{}'));
    let cfg = await saved();
    ok('settings.json applied', (await text(page, '#place')) === 'From the file' && cfg.prayers.dhuhr.iqamah === '13:30', await text(page, '#place'));
    ok('keys the file leaves out keep their values', cfg.prayers.fajr.iqamah === '20' && cfg.prayers.dhuhr.sound === true && cfg.method === 'ISNA');
    await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('azan-clock-config-v1')); c.place = 'Changed on the tablet'; localStorage.setItem('azan-clock-config-v1', JSON.stringify(c)); });
    await page.reload();
    await page.waitForTimeout(800);
    ok('an unchanged file does not undo a change made on the tablet', (await text(page, '#place')) === 'Changed on the tablet', await text(page, '#place'));
    file.body = JSON.stringify({ place: 'Edited file' });
    await page.reload();
    await page.waitForTimeout(800);
    cfg = await saved();
    ok('an edited file is applied on the next load', (await text(page, '#place')) === 'Edited file' && cfg.prayers.dhuhr.iqamah === '13:30', await text(page, '#place'));
    ok('no page errors (13)', !page.errors.length, page.errors.join(';'));
    await context.close();
  }

  /* 14. a kiosk that allows autoplay needs no tap */
  {
    const auto = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'], proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
    const context = await auto.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'America/New_York', serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.goto(URL_);
    await page.waitForTimeout(800);
    ok('with autoplay allowed, sound is on at start with no tap', await page.$eval('#soundPill', (e) => e.hidden));
    ok('the adhan player is the static audio tag', await page.$eval('#adhanPlayer', (e) => e.tagName === 'AUDIO'));
    await context.close();
    /* 14b-c. the bundled recording plays at Dhuhr, and at Fajr too while there is no adhan-fajr.mp3 */
    for (const [label, start] of [['Dhuhr', '2026-11-17T11:40:50-05:00'], ['Fajr', '2026-11-17T05:24:00-05:00']]) {
      const c = await auto.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'America/New_York', serviceWorkers: 'block' });
      const pg = await c.newPage();
      await pg.clock.install({ time: new Date(start) });
      await pg.goto(URL_);
      let up = false;
      for (let i = 0; i < 40 && !up; i++) { await pg.clock.runFor(5000); up = await pg.$eval('#adhan', (e) => !e.hidden); }
      await pg.waitForTimeout(2500);
      const p = await pg.$eval('#adhanPlayer', (e) => ({ src: e.currentSrc, playing: !e.paused, t: e.currentTime, d: e.duration }));
      ok(label + ' adhan plays assets/audio/adhan.mp3', up && /assets\/audio\/adhan\.mp3$/.test(p.src) && p.playing && p.t > 0.5,
        p.src.split('/').pop() + ' at ' + p.t.toFixed(1) + ' s of ' + Math.round(p.d) + ' s');
      await c.close();
    }
    await auto.close();
  }

  /* 15. large text option: bigger prayer row, everything still fits on an 8.7" tablet */
  {
    const context = await browser.newContext({ viewport: { width: 1005, height: 600 }, timezoneId: 'America/New_York', serviceWorkers: 'block' });
    const page = await context.newPage();
    page.errors = []; page.on('pageerror', (e) => page.errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('azan-clock-config-v1', JSON.stringify({ slideEvery: 0 })));
    await page.clock.setFixedTime(new Date('2026-11-18T13:43:05-05:00'));
    await page.goto(URL_);
    await page.waitForTimeout(500);
    const size = (sel) => page.$eval(sel, (e) => parseFloat(getComputedStyle(e).fontSize));
    const before = { time: await size('#p-dhuhr .time'), iq: await size('#p-dhuhr .iq') };
    await page.click('#setBtn');
    await page.waitForTimeout(500);
    await page.check('#s-largetext');
    await page.click('#settingsForm button[type=submit]');
    await page.waitForTimeout(800);
    const after = { time: await size('#p-dhuhr .time'), iq: await size('#p-dhuhr .iq') };
    ok('large text: prayer times and iqamah get bigger', after.time > before.time * 1.3 && after.iq > before.iq * 1.6,
      'time ' + before.time + ' -> ' + after.time + ', iqamah ' + before.iq + ' -> ' + after.iq);
    const fits = await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight &&
      [...document.querySelectorAll('.prayer')].every((p) => p.scrollWidth <= p.clientWidth + 1) &&
      document.querySelector('.prayers').getBoundingClientRect().right <= innerWidth);
    ok('large text: everything still fits on an 8.7" tablet', fits);
    ok('large text is saved', await page.evaluate(() => JSON.parse(localStorage.getItem('azan-clock-config-v1')).largeText === true));
    ok('no page errors (15)', !page.errors.length, page.errors.join(';'));
    await context.close();
  }

  await browser.close();
  console.log(results.join('\n'));
})();
