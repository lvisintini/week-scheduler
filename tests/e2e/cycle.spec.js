// Cycles of several weeks and Away strips in a real browser: the sticky week switcher and the size of a 4-week cycle (printing every week is in print.spec.js).
import { test, expect } from '@playwright/test';
import { openApp, seed, blank, ev, slot, person, boxOf } from './helpers.js';

const two = () => blank({ cycle: 2, events: [ev({ id: 'a', title: 'Week one only', weeks: [1] }), ev({ id: 'b', title: 'Week two only', weeks: [2], slots: [slot(3, 1200, 1260)] })] });

test.describe('R-CYC-04 The week switcher sits in the grid corner and stays in view while the grid scrolls', () => {
  test('the corner button stays at the top left of the grid area when the grid is scrolled down and sideways', async ({ page }) => {
    await openApp(page, { prefs: { colW: 400, rowH: 100 } }); await seed(page, two());
    const wrap = await boxOf(page.locator('#wrap')), b0 = await boxOf(page.locator('.wkb'));
    await page.evaluate(() => { const w = document.getElementById('wrap'); w.scrollTop = 600; w.scrollLeft = 900; });
    await expect.poll(() => page.evaluate(() => document.getElementById('wrap').scrollLeft)).toBeGreaterThan(500);
    const b1 = await boxOf(page.locator('.wkb')); expect(Math.abs(b1.x - b0.x)).toBeLessThan(1); expect(Math.abs(b1.y - b0.y)).toBeLessThan(1);
    expect(b1.x).toBeGreaterThanOrEqual(wrap.x); expect(b1.y).toBeGreaterThanOrEqual(wrap.y); expect(b1.x + b1.width).toBeLessThan(wrap.x + 80);
  });
  test('clicking it opens the week menu beside it, and choosing a week redraws the grid for that week', async ({ page }) => {
    await openApp(page); await seed(page, two()); await expect(page.locator('.ev')).toHaveText(/Week one only/);
    await page.locator('.wkb').click(); const b = await boxOf(page.locator('.wkb')), m = await boxOf(page.locator('.omenu'));
    expect(Math.abs(m.y - (b.y + b.height + 4))).toBeLessThan(3);
    await page.locator('.omenu .oi', { hasText: 'Week 2' }).click(); await expect(page.locator('.wkb')).toHaveText('W2'); await expect(page.locator('.ev')).toHaveText(/Week two only/);
  });
  test('the corner button fits its cell at a large text size', async ({ page }) => {
    await openApp(page, { prefs: { txt: 160 } }); await seed(page, blank({ cycle: 4 }));
    const c = await boxOf(page.locator('.dh.c')), b = await boxOf(page.locator('.wkb')); expect(b.x + b.width).toBeLessThanOrEqual(c.x + c.width + 0.5);
  });
});

test.describe('R-CYC-14 A 4-week cycle at the import limit stays usable', () => {
  test('5,000 events in a 4-week cycle, a quarter in each week, are drawn within the budgets of a one-week workspace', async ({ page, browserName }) => {
    await openApp(page);
    const d = blank({ cycle: 4, events: Array.from({ length: 5000 }, (_, i) => { const start = (i * 15) % 1380; return ev({ id: 'e' + i, title: 'Event ' + i, weeks: [1 + (i % 4)], slots: [slot(i % 7, start, start + 30)] }); }) });
    const ms = await page.evaluate(x => { const t = performance.now(); const y = parseData(x, true); S = y; cw().data = y; render(); return performance.now() - t; }, d);
    expect(ms).toBeLessThan(browserName === 'chromium' ? 3000 : 8000); expect(await page.locator('.ev').count()).toBeGreaterThan(200);
    const sw = await page.evaluate(() => { const t = performance.now(); setWeek(3); return performance.now() - t; }); expect(sw).toBeLessThan(browserName === 'chromium' ? 3000 : 8000);
  });
});

test.describe('R-CYC-19 All weeks side by side in a real browser', () => {
  const data = () => blank({ cycle: 2, weekInfo: [{}, { name: 'Nights', color: '#8e4ec6' }], events: [ev({ id: 'a', title: 'Week one only', weeks: [1] }), ev({ id: 'p', title: 'Late', slots: [{ day: 6, start: 1260, end: 1320, person: '', wk: 1 }] })] });
  test('the grid has a column per day of each week, in order, with a separator at each new week, and the corner button stays in view', async ({ page }) => {
    await openApp(page); await seed(page, data()); await page.locator('.wkb').click(); await page.locator('.omenu .oi', { hasText: 'All weeks side by side' }).click();
    await expect(page.locator('.wkb')).toHaveText('W1–2'); const xs = await page.locator('#grid .day').evaluateAll(cs => cs.map(c => c.getBoundingClientRect().left));
    expect(xs).toHaveLength(14); xs.slice(1).forEach((x, i) => expect(x).toBeGreaterThan(xs[i]));
    const sep = await page.locator('.dh.wks').evaluate(h => getComputedStyle(h).boxShadow); expect(sep).toContain('inset');
    await page.evaluate(() => { document.getElementById('wrap').scrollLeft = 900; }); const b = await boxOf(page.locator('.wkb')), w = await boxOf(page.locator('#wrap')); expect(b.x).toBeLessThan(w.x + 80);
  });
  test('a mouse drag of a time with its own week from Sunday of week 1 to Monday of week 2 moves it along the cycle', async ({ page }) => {
    await openApp(page, { prefs: { colW: 110 } }); await seed(page, data()); await page.evaluate(() => setAllWk(true));
    const box = page.locator('.day[data-w="1"][data-d="6"] .ev'); await box.scrollIntoViewIfNeeded(); const b = await boxOf(box);
    const t = await boxOf(page.locator('.day[data-w="2"][data-d="0"]'));
    await page.mouse.move(b.x + b.width / 2, b.y + 5); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2 + 40, b.y + 5, { steps: 4 }); await page.mouse.move(t.x + t.width / 2, b.y + 5, { steps: 8 }); await page.mouse.up();
    const s = await page.evaluate(() => S.events[1].slots[0]); expect([s.day, s.wk, s.start]).toEqual([0, 2, 1260]);
    await expect(page.locator('.day[data-w="2"][data-d="0"] .ev')).toHaveText(/Late/);
  });
  test('a 4-week cycle at the import limit is drawn side by side within the budget of one week', async ({ page, browserName }) => {
    await openApp(page);
    const d = blank({ cycle: 4, events: Array.from({ length: 5000 }, (_, i) => { const start = (i * 15) % 1380; return ev({ id: 'e' + i, title: 'Event ' + i, weeks: [1 + (i % 4)], slots: [slot(i % 7, start, start + 30)] }); }) });
    await page.evaluate(x => { const y = parseData(x, true); S = y; cw().data = y; render(); }, d);
    const ms = await page.evaluate(() => { const t = performance.now(); setAllWk(true); return performance.now() - t; });
    expect(ms).toBeLessThan(browserName === 'chromium' ? 3000 : 8000); expect(await page.locator('#grid .day').count()).toBe(28);
  });
});

test.describe('R-EVT-24 Away strips in a real browser', () => {
  test('the hatched strip sits flush with the right edge, and the stripes on a clashing box stay inside the box', async ({ page }) => {
    await openApp(page);
    await seed(page, blank({ people: [person({ id: 'O', name: 'Olivia' })], events: [ev({ id: 'dad', title: "At Dad's", away: true, involved: ['O'], color: '#8e4ec6', slots: [slot(1, 600, 1080)] }), ev({ id: 'swim', title: 'Swim', slots: [slot(1, 660, 780, 'O')] })] }));
    const col = await boxOf(page.locator('.day').nth(1)), st = await boxOf(page.locator('.bgs.aw')), bx = await boxOf(page.locator('.ev')), ov = await boxOf(page.locator('.ov.awov'));
    expect(Math.abs(st.x + st.width - col.x - col.width)).toBeLessThan(1.5); expect(ov.x).toBeGreaterThanOrEqual(bx.x - 0.5); expect(ov.x + ov.width).toBeLessThanOrEqual(bx.x + bx.width + 0.5);
    expect(await page.locator('.bgs.aw').evaluate(e => getComputedStyle(e).backgroundImage)).toContain('repeating-linear-gradient');
  });
});
