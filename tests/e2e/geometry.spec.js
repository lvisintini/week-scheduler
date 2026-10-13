import { test, expect } from '@playwright/test';
import { openApp, seed, blank, ev, slot, pt, boxOf, person } from './helpers.js';

const rhythmData = (extra = {}) => blank({
  events: [ev({ id: 'a', title: 'Morning', slots: [slot(0, 600, 720)] })],
  rhythms: [{ id: 'r', name: 'R', visible: true }],
  phases: [{ id: 'p', title: 'Lunch', desc: '', color: '#2fa66a', rhythms: ['r'], slots: [0, 1, 2, 3, 4].map(d => slot(d, 540, 700)).map(({ day, start, end }) => ({ day, start, end })) }],
  ...extra,
});

test.describe('R-GRID-03 Weekend header hue, as drawn by a real browser', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); });
  test('only the Saturday and Sunday header cells carry the weekend tint', async ({ page }) => {
    const r = await page.evaluate(() => {
      const tinted = e => getComputedStyle(e).backgroundImage.includes('rgb(224, 229, 247)');
      return { weekend: [...document.querySelectorAll('.dh.we')].map(tinted), weekdays: [...document.querySelectorAll('.dh:not(.we):not(.c)')].map(tinted), corner: tinted(document.querySelector('.dh.c')) };
    });
    expect(r.weekend).toEqual([true, true]); expect(r.weekdays.every(x => x === false)).toBe(true); expect(r.corner).toBe(false);
  });
  test('the day columns themselves are not tinted on Saturday and Sunday', async ({ page }) => {
    const bgs = await page.evaluate(() => [...document.querySelectorAll('.day')].map(d => getComputedStyle(d).backgroundColor));
    expect(new Set(bgs).size).toBe(1);
  });
  test('the weekend tint of a header starts after the phase-label lane, matching the day column below it', async ({ page }) => {
    const r = await page.evaluate(() => {
      const h = document.querySelectorAll('.dh:not(.c)')[5], lane = document.querySelectorAll('.lane')[5].getBoundingClientRect(), day = document.querySelectorAll('.day')[5].getBoundingClientRect();
      return { pos: getComputedStyle(h).backgroundPositionX, laneW: lane.width, dayLeft: day.left, laneLeft: lane.left };
    });
    expect(r.laneW).toBeGreaterThan(10); expect(Math.abs(r.dayLeft - (r.laneLeft + r.laneW))).toBeLessThan(1.5); expect(r.pos).toContain('18px');
  });
});

test.describe('R-PHS-04 Phase labels sit flush against the day column in a real browser', () => {
  test('the right edge of every lip touches the left border of its day column', async ({ page }) => {
    await openApp(page); await seed(page, rhythmData());
    const gaps = await page.evaluate(() => [...document.querySelectorAll('.dw')].flatMap(dw => { const day = dw.querySelector('.day').getBoundingClientRect(); return [...dw.querySelectorAll('.lip')].map(l => day.left - l.getBoundingClientRect().right); }));
    expect(gaps.length).toBeGreaterThan(0); gaps.forEach(g => expect(Math.abs(g)).toBeLessThan(1.5));
  });
  test('a lip lies inside its lane and exactly spans the phase\'s time range', async ({ page }) => {
    await openApp(page); await seed(page, rhythmData());
    const r = await page.evaluate(() => { const l = document.querySelector('.dw[data-d="0"] .lip').getBoundingClientRect(), lane = document.querySelector('.dw[data-d="0"] .lane').getBoundingClientRect(); return { l: [l.left, l.right, l.height], lane: [lane.left, lane.right], hh: HH }; });
    expect(r.l[0]).toBeGreaterThanOrEqual(r.lane[0] - 0.5); expect(r.l[1]).toBeLessThanOrEqual(r.lane[1] + 0.5); expect(r.l[2]).toBeCloseTo(160 / 60 * r.hh, 0);
  });
  test('the label text is vertical and readable inside the lip (not clipped to nothing)', async ({ page }) => {
    await openApp(page); await seed(page, rhythmData());
    const r = await page.evaluate(() => { const s = document.querySelector('.dw[data-d="0"] .lip span').getBoundingClientRect(); return { w: s.width, h: s.height, mode: getComputedStyle(document.querySelector('.lip span')).writingMode }; });
    expect(r.mode).toContain('vertical'); expect(r.h).toBeGreaterThan(r.w);
  });
});

test.describe('R-GRID-08 Sticky headers and always-visible scrollbars', () => {
  test.beforeEach(async ({ page }) => { await openApp(page, { prefs: { rowH: 120, colW: 260 } }); await seed(page, blank({ events: [ev()] })); });
  test('after scrolling down and right, the time column, day headers and corner cell stay where they were', async ({ page }) => {
    const rects = () => page.evaluate(() => { const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top)]; }; return { times: r('.times'), head: r('.dh:not(.c)'), corner: r('.dh.c'), wrap: r('#wrap'), hourLabel: r('.times span:nth-child(5)'), firstDay: r('.day') }; });
    const before = await rects();
    await page.evaluate(() => { const w = document.getElementById('wrap'); w.scrollTop = 400; w.scrollLeft = 250; });
    const after = await rects();
    expect(after.times[0]).toBe(before.times[0]); expect(after.corner).toEqual(before.corner); expect(after.head[1]).toBe(before.head[1]);
    expect(after.firstDay[0]).toBeLessThan(before.firstDay[0]); expect(after.hourLabel[1]).toBeLessThan(before.hourLabel[1]);
  });
  test('the time column and headers are drawn above the events that scroll underneath', async ({ page }) => {
    await page.evaluate(() => { const w = document.getElementById('wrap'); w.scrollTop = 300; });
    const top = await page.evaluate(() => { const h = document.querySelector('.dh:not(.c)').getBoundingClientRect(); const el = document.elementFromPoint(h.left + 20, h.top + 8); return el.closest('.dh') !== null; });
    expect(top).toBe(true);
  });
  test('scrollbars are real and visible, taking up space in both directions', async ({ page }) => {
    const sizes = await page.evaluate(() => { const w = document.getElementById('wrap'); return { v: w.offsetWidth - w.clientWidth, h: w.offsetHeight - w.clientHeight }; });
    expect(sizes.v).toBeGreaterThan(4); expect(sizes.h).toBeGreaterThan(4);
  });
  test('scrollbars are shown even when everything fits in the window', async ({ page }) => {
    await page.evaluate(() => { prefs.rowH = 24; prefs.colW = 70; render(); });
    const sizes = await page.evaluate(() => { const w = document.getElementById('wrap'); return { fits: w.scrollHeight <= w.clientHeight, v: w.offsetWidth - w.clientWidth, h: w.offsetHeight - w.clientHeight }; });
    expect(sizes.fits).toBe(true); expect(sizes.v).toBeGreaterThan(4); expect(sizes.h).toBeGreaterThan(4);
  });
});

test.describe('R-GRID-07 Zoom in a real browser', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); await seed(page, blank({ events: [ev()] })); });
  const hourGap = page => page.evaluate(() => { const l = document.querySelectorAll('.times span'); return l[2].getBoundingClientRect().top - l[1].getBoundingClientRect().top; });
  test('the distance between hour labels equals the row height setting', async ({ page }) => {
    expect(await hourGap(page)).toBeCloseTo(48, 0); await page.evaluate(() => { prefs.rowH = 96; render(); }); expect(await hourGap(page)).toBeCloseTo(96, 0);
  });
  test('zooming changes box sizes but never the text size', async ({ page }) => {
    const fs = () => page.evaluate(() => [getComputedStyle(document.querySelector('.ev .t')).fontSize, getComputedStyle(document.querySelector('.times span')).fontSize, getComputedStyle(document.querySelector('.dh:not(.c)')).fontSize]);
    const before = await fs(); await page.evaluate(() => { prefs.rowH = 120; prefs.colW = 250; render(); }); expect(await fs()).toEqual(before);
  });
  const m = page => page.evaluate(() => { const w = document.getElementById('wrap'); return { day: document.querySelector('.day').getBoundingClientRect().width, scroll: w.scrollWidth - w.clientWidth, empty: w.clientWidth - document.querySelector('.dw:last-child').getBoundingClientRect().right + w.getBoundingClientRect().left }; });
  test('by default the columns fill the window width (no empty strip), and a large column width still scrolls sideways', async ({ page }) => {
    await page.evaluate(() => { prefs.colW = 70; prefs.collapsed = true; applyPrefs(); render(); });
    let r = await m(page); expect(r.day).toBeGreaterThan(100); expect(r.scroll).toBeLessThanOrEqual(0); expect(Math.abs(r.empty)).toBeLessThan(20);
    await page.evaluate(() => { prefs.colW = 600; render(); });
    r = await m(page); expect(r.day).toBeCloseTo(600, 0); expect(r.scroll).toBeGreaterThan(0);
  });
  test('with "Fill the window width" off the column width is exact: wide weeks scroll sideways, narrow ones are not stretched', async ({ page }) => {
    await page.evaluate(() => { prefs.fillW = false; prefs.colW = 260; prefs.collapsed = true; applyPrefs(); render(); });
    let r = await m(page); expect(r.day).toBeCloseTo(260, 0); expect(r.scroll).toBeGreaterThan(0);
    await page.evaluate(() => { prefs.colW = 70; render(); });
    r = await m(page); expect(r.day).toBeCloseTo(70, 0); expect(r.scroll).toBeLessThanOrEqual(0); expect(r.empty).toBeGreaterThan(100);
  });
  test('"Fit to window" makes the whole day fit without vertical scrolling', async ({ page }) => {
    await page.evaluate(() => { prefs.fit = true; render(); });
    const r = await page.evaluate(() => { const w = document.getElementById('wrap'); return { over: w.scrollHeight - w.clientHeight, hh: HH }; }); expect(r.over).toBeLessThanOrEqual(1); expect(r.hh).toBeGreaterThan(24);
  });
  test('"Fit to window" adapts when the browser window is resized', async ({ page }) => {
    await page.evaluate(() => { prefs.fit = true; render(); }); const big = await page.evaluate(() => HH);
    await page.setViewportSize({ width: 1400, height: 560 }); await expect.poll(() => page.evaluate(() => HH)).toBeLessThan(big);
    const over = await page.evaluate(() => { const w = document.getElementById('wrap'); return w.scrollHeight - w.clientHeight; }); expect(over).toBeLessThanOrEqual(1);
  });
});

test.describe('R-GRID-04 The now line in a real browser', () => {
  test('is drawn on the current weekday at the current time (Wednesday 10:30)', async ({ page }) => {
    await openApp(page, { clock: new Date(2026, 9, 14, 10, 30) });
    const r = await page.evaluate(() => { const n = document.querySelector('.now'); const col = n.closest('.day'); return { day: col.dataset.d, y: n.getBoundingClientRect().top - col.getBoundingClientRect().top, hh: HH }; });
    expect(r.day).toBe('2'); expect(r.y).toBeCloseTo((630 - 300) / 60 * r.hh, 0);
  });
  test('is a red line that spans the width of its column', async ({ page }) => {
    await openApp(page, { clock: new Date(2026, 9, 14, 10, 30) });
    const r = await page.evaluate(() => { const n = document.querySelector('.now'); return { color: getComputedStyle(n).borderTopColor, w: n.getBoundingClientRect().width, col: n.closest('.day').getBoundingClientRect().width }; });
    expect(r.color).toMatch(/rgb\(2[0-9]{2}, [0-9]{1,2}, [0-9]{1,2}\)/); expect(r.w).toBeGreaterThan(r.col - 3);
  });
});

test.describe('R-GRID-10 Layer order in a real browser', () => {
  test('phase background is under the hour lines, which are under events (checked by painting order)', async ({ page }) => {
    await openApp(page); await seed(page, rhythmData());
    const order = await page.evaluate(() => { const day = document.querySelector('.day[data-d="0"]'); const idx = sel => [...day.children].indexOf(day.querySelector(sel)); const z = sel => getComputedStyle(day.querySelector(sel)).zIndex; return { phx: idx('.phx'), gl: idx('.gl'), ev: idx('.ev'), zgl: z('.gl'), zev: z('.ev'), zphx: z('.phx') }; });
    expect(order.phx).toBeLessThan(order.gl); expect(order.gl).toBeLessThan(order.ev);
    const num = v => (v === 'auto' ? 0 : Number(v)); expect(num(order.zphx)).toBeLessThanOrEqual(num(order.zgl)); expect(num(order.zgl)).toBeLessThanOrEqual(num(order.zev));
  });
  test('the phase underneath an event does not take the pointer: dragging on the event still grabs the event', async ({ page }) => {
    await openApp(page); await seed(page, rhythmData());
    const p = await pt(page, 0, 650); const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y).closest('.ev') !== null, [p.x, p.y]); expect(top).toBe(true);
  });
});

test.describe('R-GRID-02 Hidden early hours in a real browser', () => {
  test('showing the early hours makes the day taller by exactly five rows', async ({ page }) => {
    await openApp(page); const h0 = await boxOf(page.locator('.day').first());
    await page.evaluate(() => { prefs.showEarly = true; render(); }); const h1 = await boxOf(page.locator('.day').first());
    expect(h1.height - h0.height).toBeCloseTo(5 * 48, 0);
  });
});

test.describe('R-EVT-10 Side-by-side events in a real browser', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, { prefs: { colW: 240 } });
    await seed(page, blank({ people: [person({ id: 'A', name: 'Ann' }), person({ id: 'B', name: 'Bob', color: '#2fa66a' })], events: [
      ev({ id: 'a', title: 'Swimming', color: '#e5484d', slots: [slot(0, 600, 720, 'A')] }), ev({ id: 'b', title: 'Homework', color: '#2fa66a', slots: [slot(0, 660, 780, 'B')] })] }));
  });
  test('the two boxes share the column width without covering each other and stay inside the column', async ({ page }) => {
    const col = await boxOf(page.locator('.day').first()), a = await boxOf(page.locator('.ev', { hasText: 'Swimming' })), b = await boxOf(page.locator('.ev', { hasText: 'Homework' }));
    expect(a.x + a.width).toBeLessThanOrEqual(b.x); expect(a.x).toBeGreaterThanOrEqual(col.x); expect(b.x + b.width).toBeLessThanOrEqual(col.x + col.width + 0.5);
    expect(a.width).toBeGreaterThan(col.width * 0.4); expect(b.width).toBeGreaterThan(col.width * 0.4); expect(await page.locator('.ov').count()).toBe(0);
  });
  test('a real click on each box opens that event directly, with no chooser', async ({ page }) => {
    for (const t of ['Swimming', 'Homework']) {
      const b = await boxOf(page.locator('.ev', { hasText: t })); await page.mouse.click(b.x + b.width / 2, b.y + b.height - 12);
      await expect(page.locator('#dlg')).toBeVisible(); expect(await page.locator('.omenu').count()).toBe(0); await expect(page.locator('#fT')).toHaveValue(t);
      await page.keyboard.press('Escape'); await expect(page.locator('#dlg')).toBeHidden();
    }
  });
});

test.describe('R-EVT-11 R-EVT-12 Free time and flexible time as drawn by a real browser', () => {
  const look = (page, title) => page.locator('.ev', { hasText: title }).evaluate(b => { const c = getComputedStyle(b); return { bg: c.backgroundColor, left: c.borderLeftWidth + ' ' + c.borderLeftStyle, top: c.borderTopWidth + ' ' + c.borderTopStyle, color: c.color }; });
  test.beforeEach(async ({ page }) => {
    await openApp(page); await seed(page, blank({ events: [ev({ id: 'n', title: 'Plain', color: '#2fa66a', slots: [slot(0, 600, 660)] }), ev({ id: 'f', title: 'Park', color: '#2fa66a', free: true, slots: [slot(1, 600, 660)] }),
      ev({ id: 'x', title: 'Homework', color: '#e8912d', slots: [{ ...slot(2, 600, 660), flex: true }] })] }));
  });
  test('a free-time box is a lighter tint of its colour with a 4 px solid edge and dark text', async ({ page }) => {
    const plain = await look(page, 'Plain'), free = await look(page, 'Park');
    expect(free.bg).not.toBe(plain.bg); expect(free.left).toBe('4px solid'); expect(free.color).toBe('rgb(29, 35, 48)');
    const ch = free.bg.match(/[\d.]+/g).slice(0, 3).map(Number), scale = free.bg.startsWith('color(') ? 255 : 1;   // Chrome reports color-mix() as color(srgb r g b) in 0–1
    expect(ch.reduce((t, v) => t + v * scale, 0)).toBeGreaterThan(600);   // much lighter than #2fa66a (sum 433)
  });
  test('a flexible repetition has a 2 px dashed border', async ({ page }) => {
    expect((await look(page, 'Homework')).top).toBe('2px dashed'); expect((await look(page, 'Plain')).top).toBe('1px solid');
  });
});
