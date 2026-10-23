import { test, expect } from '@playwright/test';
import { moduleOrder } from '../helpers/modules.js';
import { openApp, seed, blank, ev, slot, person, toolbar, dialogButton, allowClipboard, PASSWORD } from './helpers.js';

const BASE = 'http://localhost:4173';
// the app's own files, as index.html loads them (R-SEC-01): the page, its stylesheet and its scripts
const SCRIPTS = moduleOrder();   // every file of js/ that main.js brings in
const OWN = [BASE + '/', BASE + '/app.css', ...SCRIPTS.map(f => BASE + '/' + f)].sort();
/** Records every network request and every Content-Security-Policy violation the page produces. */
async function watch(page) {
  const requests = [], consoleErrors = [];
  page.on('request', r => requests.push(r.url())); page.on('console', m => { if (m.type() === 'error' || /Refused to/.test(m.text())) consoleErrors.push(m.text()); }); page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
  await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' → ' + e.blockedURI)); });
  return { requests, consoleErrors };
}
const violations = page => page.evaluate(() => window.__csp);
const rich = () => blank({ people: [person({ id: 'A', name: 'Ann' })], events: [ev({ title: 'Tour', desc: 'x', involved: ['A'], slots: [slot(0, 600, 720, 'A'), slot(0, 660, 780, 'A')] })], rhythms: [{ id: 'r', name: 'R', visible: true }], phases: [{ id: 'p', title: 'Lunch', desc: '', color: '#2fa66a', rhythms: ['r'], slots: [slot(0, 720, 780)].map(({ day, start, end }) => ({ day, start, end })) }] });

test.describe('R-SEC-04 A full tour of the app talks to nobody', () => {
  test('creating, saving, sharing, downloading, importing and printing make no request except loading the page itself', async ({ page, context, browserName }) => {
    const w = await watch(page); await allowClipboard(context, browserName, BASE); await openApp(page); await seed(page, rich()); await page.evaluate(() => { window.print = () => {}; });
    await toolbar(page, 'add').click(); await page.fill('#fT', 'Created in tour'); await page.click('#fOk');
    await page.locator('.dh:not(.c)').first().click(); await page.locator('#agPrint').click(); await page.locator('#agClose').click();
    await toolbar(page, 'print').click(); await page.locator('.sbtop .gear').click(); await page.locator('#xDlg .stabs button', { hasText: 'About' }).click(); await dialogButton(page, 'Close').click(); await page.locator('.sbtop .help').click(); await dialogButton(page, 'Close').click();
    await toolbar(page, 'save').click(); await dialogButton(page, 'Browser memory').click();
    await toolbar(page, 'save').click(); await dialogButton(page, 'Shareable link').click(); await page.locator('#xDlg input[type=text]').fill(PASSWORD); await dialogButton(page, 'Create link').click(); await expect(page.locator('#xDlg textarea')).toBeVisible({ timeout: 15000 }); await dialogButton(page, 'Copy link').click(); await dialogButton(page, 'Close').click();
    await toolbar(page, 'save').click(); await dialogButton(page, 'JSON file').click(); await page.locator('#xDlg input[type=text]').fill(PASSWORD); await Promise.all([page.waitForEvent('download'), dialogButton(page, 'Save file').click()]);
    const outside = w.requests.filter(u => !u.startsWith(BASE + '/') && !u.startsWith('data:') && !u.startsWith('blob:')); expect(outside).toEqual([]); expect([...new Set(w.requests.filter(u => u.startsWith(BASE + '/')))].sort()).toEqual(OWN);
    expect(w.consoleErrors).toEqual([]); expect(await violations(page)).toEqual([]);
  });
  test('the About tab\'s GitHub link opens only when clicked, in a new tab that gets no opener and no referrer', async ({ page }) => {
    const w = await watch(page); await openApp(page); await page.context().route('https://github.com/**', r => r.fulfill({ contentType: 'text/html', body: '<p>repo</p>' }));
    await page.locator('.sbtop .gear').click(); await page.locator('#xDlg .stabs button', { hasText: 'About' }).click();
    expect(w.requests.filter(u => !u.startsWith(BASE + '/') && !u.startsWith('data:'))).toEqual([]);
    const [pop] = await Promise.all([page.waitForEvent('popup'), page.locator('#xDlg a').click()]); await pop.waitForLoadState();
    expect(pop.url()).toBe('https://github.com/lvisintini/week-scheduler'); expect(await pop.evaluate(() => ({ opener: window.opener, referrer: document.referrer }))).toEqual({ opener: null, referrer: '' });
    expect(page.url()).toMatch(/^http:\/\/localhost:4173\//); expect(w.consoleErrors).toEqual([]); expect(await violations(page)).toEqual([]);
  });
  test('only the two documented browser-storage keys are written; no cookies, databases, caches or service workers exist', async ({ page }) => {
    await openApp(page, { defaults: true }); await seed(page, rich()); await page.evaluate(() => { saveMem('all'); state.prefs.theme = 'dark'; savePrefs(); });
    const r = await page.evaluate(async () => ({ keys: Object.keys(localStorage).sort(), session: Object.keys(sessionStorage), cookie: document.cookie, dbs: (await indexedDB.databases()).length, caches: (await caches.keys()).length, workers: (await navigator.serviceWorker.getRegistrations()).length }));
    expect(r).toEqual({ keys: ['weekly-schedules-prefs', 'weekly-schedules-workspaces'], session: [], cookie: '', dbs: 0, caches: 0, workers: 0 });
  });
  test('the data of a shared link never appears in any network request (it stays in the fragment)', async ({ page, browser }) => {
    await openApp(page); await seed(page, rich()); await toolbar(page, 'save').click(); await dialogButton(page, 'Shareable link').click(); await page.locator('#xDlg input[type=text]').fill(PASSWORD); await dialogButton(page, 'Create link').click();
    const link = await page.locator('#xDlg textarea').inputValue(); const ctx = await browser.newContext(); const other = await ctx.newPage(); const w = await watch(other);
    await other.goto(link); await other.locator('#xDlg input[type=password]').fill(PASSWORD); await dialogButton(other, 'Open').click(); await expect(other.locator('#toast')).toHaveText('Shared schedule loaded');
    expect(w.requests.filter(u => u.includes('data=e1') || u.includes('#'))).toEqual([]); await ctx.close();
  });
});

test.describe('R-SEC-01 The Content-Security-Policy is enforced by the browser', () => {
  test.beforeEach(async ({ page }) => { await watch(page); await openApp(page); });
  test('requests to other sites are blocked before they reach the network (fetch, XHR, WebSocket, image, stylesheet, iframe, form)', async ({ page }) => {
    const seen = []; await page.route(/example\.(org|net)/, route => { seen.push(route.request().url()); route.abort(); });
    const r = await page.evaluate(async () => {
      const out = {};
      out.fetch = await fetch('https://example.org/f').then(() => 'sent', () => 'blocked');
      out.xhr = await new Promise(res => { const x = new XMLHttpRequest(); x.open('GET', 'https://example.org/x'); x.onerror = () => res('blocked'); x.onload = () => res('sent'); try { x.send(); } catch { res('blocked'); } });
      out.ws = await new Promise(res => { try { const s = new WebSocket('wss://example.org/'); s.onerror = () => res('blocked'); s.onopen = () => res('sent'); } catch { res('blocked'); } });
      out.img = await new Promise(res => { const i = new Image(); i.onload = () => res('loaded'); i.onerror = () => res('blocked'); i.src = 'https://example.org/i.png'; });
      out.css = await new Promise(res => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://example.org/s.css'; l.onload = () => res('loaded'); l.onerror = () => res('blocked'); document.head.append(l); });
      const f = document.createElement('iframe'); f.src = 'https://example.org/frame'; document.body.append(f);
      const form = document.createElement('form'); form.action = 'https://example.net/post'; form.method = 'post'; document.body.append(form); form.requestSubmit?.call(form);
      await new Promise(res => setTimeout(res, 600)); out.violations = window.__csp.length; return out;
    });
    expect(r).toMatchObject({ fetch: 'blocked', xhr: 'blocked', ws: 'blocked', img: 'blocked', css: 'blocked' }); expect(r.violations).toBeGreaterThanOrEqual(7); expect(seen).toEqual([]); expect(page.url()).toBe(BASE + '/');
  });
  test('code-from-text is refused: eval and new Function throw (tested from a script file of the site, as Playwright\'s own evaluate bypasses the policy)', async ({ page }) => {
    await page.route(BASE + '/js/probe.js', route => route.fulfill({ contentType: 'text/javascript', body: "setTimeout(function(){window.__r={ev:(function(){try{eval('1+1');return 'ran'}catch(e){return e.name}})(),fn:(function(){try{return String(new Function('return 1')())}catch(e){return e.name}})()}},0)" }));
    await page.evaluate(() => { const s = document.createElement('script'); s.src = 'js/probe.js'; document.body.append(s); });   // a file of the site may run ('self'); its eval may not
    await page.waitForFunction(() => window.__r); const r = await page.evaluate(() => window.__r); expect(r).toEqual({ ev: 'EvalError', fn: 'EvalError' });
  });
  test('injected code never runs: an inline script, an inline event handler and a javascript: link are refused', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const s = document.createElement('script'); s.textContent = 'window.__inl=1'; document.body.append(s);
      const i = document.createElement('img'); i.setAttribute('onerror', 'window.__h=1'); i.src = 'data:,x'; document.body.append(i);
      const a = document.createElement('a'); a.href = 'javascript:window.__j=1'; document.body.append(a); a.click();
      await new Promise(res => setTimeout(res, 400)); return { inl: window.__inl, h: window.__h, j: window.__j, v: window.__csp.filter(x => /script-src/.test(x)).length };
    });
    expect(r).toMatchObject({ inl: undefined, h: undefined, j: undefined }); expect(r.v).toBeGreaterThanOrEqual(3);
  });
  test('the page cannot be turned into another page: a base tag and an object/embed load nothing', async ({ page }) => {
    const r = await page.evaluate(async () => { const b = document.createElement('base'); b.href = 'https://example.org/'; document.head.append(b); const o = document.createElement('object'); o.data = 'https://example.org/o'; document.body.append(o); await new Promise(res => setTimeout(res, 300)); return window.__csp.length; });
    expect(r).toBeGreaterThanOrEqual(1);
  });
});

test.describe('R-SEC-02 Hostile text in every field never runs in a real browser', () => {
  const payloads = ['<img src=x onerror="window.__pwned=1">', '"><script>window.__pwned=1</script>', "'><svg onload=window.__pwned=1>", '<a href="javascript:window.__pwned=1">x</a>', '" onmouseover="window.__pwned=1" x="'];
  for (const [i, payload] of payloads.entries()) test(`payload ${i + 1} (${payload.slice(0, 22)}…) is shown as text on every screen and does nothing`, async ({ page }) => {
    const w = await watch(page); await openApp(page);
    const hostile = { schedules: [{ id: 's1', name: payload, color: '#3b6df0', opacity: 1, locked: false, visible: true }], people: [{ id: 'p1', name: payload, color: '#f00000', visible: true }], events: [{ id: 'e1', title: payload, desc: payload, color: '#3b6df0', schedules: ['s1'], involved: ['p1'], slots: [{ day: 0, start: 600, end: 720, person: 'p1' }, { day: 0, start: 660, end: 780, person: 'p1' }] }], rhythms: [{ id: 'r1', name: payload, visible: true }], phases: [{ id: 'ph1', title: payload, desc: payload, color: '#3b6df0', rhythms: ['r1'], slots: [{ day: 0, start: 720, end: 780 }, { day: 1, start: 720, end: 780 }] }], phaseOpacity: 0.3 };
    await seed(page, hostile); await page.evaluate(() => { window.print = () => {}; });
    const p = await page.evaluate(() => { const c = document.querySelector('.day').getBoundingClientRect(); return { x: c.left + c.width / 2, y: c.top + (650 - vs() * 60) / 60 * state.HH }; });
    await page.mouse.move(p.x, p.y); await expect(page.locator('#peek')).toBeVisible();
    for (const open of [() => page.locator('.dh:not(.c)').first().click(), () => page.locator('#agClose').click(), () => page.evaluate(() => openRhythmAgenda(state.S.rhythms[0])), () => page.locator('#agClose').click(), () => page.evaluate(() => openDlg(state.S.events[0])), () => page.locator('#fCancel').click(), () => page.evaluate(() => openCopy(state.S.events[0])), () => dialogButton(page, 'Cancel').click(), () => page.evaluate(() => printSchedule()), () => page.locator('.wsbtn').click(), () => page.keyboard.press('Escape')]) { await open(); await page.waitForTimeout(40); }
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ pwned: window.__pwned, scripts: document.scripts.length, handlers: document.querySelectorAll('[onerror],[onload],[onmouseover],[onclick]').length, jsLinks: document.querySelectorAll('a[href^="javascript"]').length, badImgs: document.querySelectorAll('img[src="x"]').length, text: document.querySelector('#agBody') ? document.body.textContent.includes('onerror') : false }));
    expect(r).toMatchObject({ pwned: undefined, scripts: 1, handlers: 0, jsLinks: 0, badImgs: 0 }); expect(await violations(page)).toEqual([]); expect(w.consoleErrors).toEqual([]);
    expect(await page.evaluate(t => [...document.querySelectorAll('#sbin input[type=text]')].some(i => i.value === t), payload)).toBe(true);   // …and the text really is there, as plain text
  });
});
