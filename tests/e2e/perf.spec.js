import { test, expect } from '@playwright/test';
import { openApp, PASSWORD } from './helpers.js';

const big = n => ({ schedules: [{ id: 's1', name: 'Big', color: '#3b6df0', opacity: 1, locked: false, visible: true }], people: [], rhythms: [], phases: [], phaseOpacity: 0.3,
  events: Array.from({ length: n }, (_, i) => { const start = (i * 15) % 1380; return { id: 'e' + i, title: 'Event ' + i, desc: 'description of event ' + i, color: '#3b6df0', schedules: ['s1'], involved: [], slots: [{ day: i % 7, start, end: start + 30, person: '' }] }; }) });

test.describe('R-SEC-03 The largest allowed data set (5,000 events) stays usable', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); });
  test('importing and drawing 5,000 events finishes within 3 seconds in Chromium, 8 in Firefox and WebKit (measured alone: about 0.6 / 1.2 s) and never hangs the page', async ({ page, browserName }) => {
    const ms = await page.evaluate(d => { const t = performance.now(); const x = parseData(d, true); state.S = x; cw().data = x; render(); return performance.now() - t; }, big(5000));
    expect(ms).toBeLessThan(browserName === 'chromium' ? 3000 : 8000); expect(await page.locator('.ev').count()).toBeGreaterThan(500);   // looser where all three browsers' suites share the machine
  });
  test('encrypting 5,000 events for a file or link completes within 10 seconds and compresses the data', async ({ page }) => {
    await page.evaluate(d => { const x = parseData(d, true); state.S = x; cw().data = x; }, big(5000));
    const r = await page.evaluate(async pw => { const f = buildFile(); const t = performance.now(); const blob = await seal(f, pw); return { ms: performance.now() - t, plain: JSON.stringify(f).length, sealed: blob.length }; }, PASSWORD);
    expect(r.ms).toBeLessThan(10000); expect(r.sealed).toBeLessThan(r.plain / 3);
  });
  test('decrypting and re-validating a 5,000-event file completes within 10 seconds', async ({ page }) => {
    await page.evaluate(d => { const x = parseData(d, true); state.S = x; cw().data = x; }, big(5000));
    const ms = await page.evaluate(async pw => { const blob = await seal(buildFile(), pw); const t = performance.now(); const obj = await unseal(blob, pw); parseWorkspace(obj, 'x'); return performance.now() - t; }, PASSWORD);
    expect(ms).toBeLessThan(10000);
  });
  test('a typical large week of 1,000 events is drawn in under 1 second in Chromium, 2 in Firefox and WebKit (measured: about 0.1 / 0.25 s), so dragging stays responsive', async ({ page, browserName }) => {
    await page.evaluate(d => { const x = parseData(d, true); state.S = x; cw().data = x; render(); }, big(1000));
    const ms = await page.evaluate(() => { const t = performance.now(); render(); return performance.now() - t; }); expect(ms).toBeLessThan(browserName === 'chromium' ? 1000 : 2000);
  });
  test('the key derivation that protects files takes between 0.05 and 5 seconds on this machine (a work factor, not instant)', async ({ page }) => {
    const ms = await page.evaluate(async pw => { const t = performance.now(); await seal({ a: 1 }, pw); return performance.now() - t; }, PASSWORD);
    expect(ms).toBeGreaterThan(50); expect(ms).toBeLessThan(5000);
  });
});

test.describe('R-EVT-05 Clipped boxes are measured all together, with the same result as measuring one box at a time', () => {
  test('a crowded week gets exactly the clipped boxes, moved times and dropped By/With rows that box-by-box measuring gives', async ({ page }) => {
    await openApp(page);
    const d = big(600); d.people = [{ id: 'p1', name: 'Ann', color: '#e5484d', visible: true }, { id: 'p2', name: 'Luis', color: '#3f51b5', visible: true }];
    d.events.forEach((e, i) => { e.title = i % 3 ? 'Event ' + i : 'A rather long title for event number ' + i + ', much too long to fit on one line of a box'; e.slots[0].end = e.slots[0].start + [15, 30, 45, 60, 90][i % 5]; e.slots[0].person = i % 4 ? 'p1' : ''; e.involved = i % 2 ? ['p2'] : []; });
    const state = () => [...document.querySelectorAll('.ev')].map(b => (b.classList.contains('clipped') ? 'c' : '-') + (b.querySelector('.r2') ? 'r' : '-') + (b.querySelector('.clipm') ? 'm' : '-') + (b.querySelector('.r2 .tm') ? '2' : b.querySelector('.r1 .tm') ? '1' : '0')).join('');
    const now = await page.evaluate(([d, f]) => { state.prefs.colW = 220; state.prefs.rowH = 120; const x = parseData(d, true); state.S = x; cw().data = x; render(); return (0, eval)('(' + f + ')')(); }, [d, state.toString()]);
    const old = await page.evaluate(f => {   // the same steps, box by box: read and change each box in turn
      const keep = window.fitAll; window.fitAll = () => {}; render(); window.fitAll = keep;
      document.querySelectorAll('.ev').forEach(d => window.fitBox(d));
      return (0, eval)('(' + f + ')')();
    }, state.toString());
    expect(now.length).toBeGreaterThan(300); expect(now).toContain('-r-1'); expect(now).toContain('crm2'); expect(now).toContain('c-m0'); expect(now).toBe(old);   // kept, time moved to row 2, time dropped with row 2
  });
});
