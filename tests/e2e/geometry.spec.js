import { test, expect } from '@playwright/test';
import { openApp, seed, blank, ev, slot, slots, pt, boxOf, person } from './helpers.js';

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
  const fs = page => page.evaluate(() => [document.querySelector('.ev .t'), document.querySelector('.times span'), document.querySelector('.dh:not(.c)')].map(e => parseFloat(getComputedStyle(e).fontSize)));
  const m = page => page.evaluate(() => { const w = document.getElementById('wrap'); return { day: document.querySelector('.day').getBoundingClientRect().width, scroll: w.scrollWidth - w.clientWidth, over: w.scrollHeight - w.clientHeight, empty: w.clientWidth - document.querySelector('.dw:last-child').getBoundingClientRect().right + w.getBoundingClientRect().left }; });
  test('with "Fit height" off the distance between hour labels equals the row height setting', async ({ page }) => {
    expect(await hourGap(page)).toBeCloseTo(48, 0); await page.evaluate(() => { prefs.rowH = 96; render(); }); expect(await hourGap(page)).toBeCloseTo(96, 0);
  });
  test('the row height and column width change box sizes but never the text size', async ({ page }) => {
    const before = await fs(page); await page.evaluate(() => { prefs.rowH = 120; prefs.colW = 250; render(); }); expect(await fs(page)).toEqual(before);
  });
  test('the text size slider scales box text, hour labels and day names by its percentage', async ({ page }) => {
    const before = await fs(page); expect(before).toEqual([12, 11, 14]);
    await page.evaluate(() => { const i = [...document.querySelectorAll('#sbin .zrow input')].find(x => x.getAttribute('aria-label') === 'Text size'); i.value = 150; i.dispatchEvent(new Event('input')); });
    expect(await fs(page)).toEqual([18, 16.5, 21]);
  });
  test('with "Fit width" off the column width is exact all the way down to 70 px, and up to 1000 px scrolls sideways', async ({ page }) => {
    await page.evaluate(() => { prefs.colW = 70; prefs.collapsed = true; applyPrefs(); render(); });
    let r = await m(page); expect(r.day).toBeCloseTo(70, 0); expect(r.scroll).toBeLessThanOrEqual(0); expect(r.empty).toBeGreaterThan(100);
    await page.evaluate(() => { prefs.colW = 1000; render(); });
    r = await m(page); expect(r.day).toBeCloseTo(1000, 0); expect(r.scroll).toBeGreaterThan(0);
  });
});

test.describe('R-GRID-07 Zoom defaults in a real browser', () => {
  test.beforeEach(async ({ page }) => { await openApp(page, { defaults: true }); await seed(page, blank({ events: [ev()] })); });
  const m = page => page.evaluate(() => { const w = document.getElementById('wrap'); return { scroll: w.scrollWidth - w.clientWidth, over: w.scrollHeight - w.clientHeight, empty: w.clientWidth - document.querySelector('.dw:last-child').getBoundingClientRect().right + w.getBoundingClientRect().left }; });
  test('by default the week fills the window exactly: no scrolling either way and no empty strip on the right', async ({ page }) => {
    const r = await m(page); expect(r.scroll).toBeLessThanOrEqual(0); expect(r.over).toBeLessThanOrEqual(1); expect(Math.abs(r.empty)).toBeLessThan(20);
  });
  test('"Fit height" still fits the whole day at 160 % text, because the taller day header is measured', async ({ page }) => {
    await page.evaluate(() => { prefs.txt = 160; render(); }); const r = await m(page); expect(r.over).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => { const w = document.getElementById('wrap'); return w.clientHeight - document.querySelector('.dh').offsetHeight - HH * 19; })).toBeLessThan(19);
  });
  test('"Fit height" adapts when the browser window is resized', async ({ page }) => {
    const big = await page.evaluate(() => HH);
    await page.setViewportSize({ width: 1400, height: 560 }); await expect.poll(() => page.evaluate(() => HH)).toBeLessThan(big);
    expect((await m(page)).over).toBeLessThanOrEqual(1);
  });
  test('unticking "Fit width" keeps the fitted column width, so the grid does not jump', async ({ page }) => {
    const w0 = await page.evaluate(() => document.querySelector('.day').getBoundingClientRect().width);
    await page.locator('#sbin .zck', { hasText: 'Fit width' }).locator('input').uncheck();
    const w1 = await page.evaluate(() => document.querySelector('.day').getBoundingClientRect().width); expect(Math.abs(w1 - w0)).toBeLessThan(1.5);
    await expect(page.locator('#sbin .zrow input[aria-label="Column width"]')).toBeEnabled();
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

test.describe('R-EVT-11 R-EVT-12 Soft-look activity types and flexible time as drawn by a real browser', () => {
  const look = (page, title) => page.locator('.ev', { hasText: title }).evaluate(b => { const c = getComputedStyle(b); return { bg: c.backgroundColor, left: c.borderLeftWidth + ' ' + c.borderLeftStyle, top: c.borderTopWidth + ' ' + c.borderTopStyle, color: c.color }; });
  test.beforeEach(async ({ page }) => {
    await openApp(page); await seed(page, blank({ types: [{ id: 'tf', name: 'Free time', color: '#12a5b5', icon: 'sun', soft: true }], events: [ev({ id: 'n', title: 'Plain', color: '#2fa66a', slots: [slot(0, 600, 660)] }), ev({ id: 'f', title: 'Park', color: '#2fa66a', type: 'tf', slots: [slot(1, 600, 660)] }),
      ev({ id: 'x', title: 'Homework', color: '#e8912d', slots: [{ ...slot(2, 600, 660), flex: true }] })] }));
  });
  test('a box of a soft-look type (Free time) is a lighter tint of its colour with a 4 px solid edge and dark text', async ({ page }) => {
    const plain = await look(page, 'Plain'), free = await look(page, 'Park');
    expect(free.bg).not.toBe(plain.bg); expect(free.left).toBe('4px solid'); expect(free.color).toBe('rgb(29, 35, 48)');
    const ch = free.bg.match(/[\d.]+/g).slice(0, 3).map(Number), scale = free.bg.startsWith('color(') ? 255 : 1;   // Chrome reports color-mix() as color(srgb r g b) in 0–1
    expect(ch.reduce((t, v) => t + v * scale, 0)).toBeGreaterThan(600);   // much lighter than #2fa66a (sum 433)
  });
  test('a flexible repetition has a 2 px dashed border', async ({ page }) => {
    expect((await look(page, 'Homework')).top).toBe('2px dashed'); expect((await look(page, 'Plain')).top).toBe('1px solid');
  });
});

test.describe('R-EVT-15 Flexible start/end as drawn by a real browser', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page); await seed(page, blank({ people: [person({ id: 'A', name: 'Ann' }), person({ id: 'B', name: 'Bob' })], events: [
      ev({ id: 'w', title: 'Work', slots: [{ ...slot(0, 540, 1020, 'A'), fs: 30, fe: 15 }] }), ev({ id: 'p', title: 'Pickup', color: '#2fa66a', slots: [slot(0, 1005, 1050, 'B')] })] }));
  });
  test('the other event\'s core covers the margin, and the uncovered margin shows a 2 px dashed border', async ({ page }) => {
    const at = async m => { await page.evaluate(n => { document.getElementById('wrap').scrollTop = (n - vs() * 60) / 60 * HH - 150; }, m); const p = await pt(page, 0, m); return page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y).closest('.ev,.mg'); return e && (e.classList.contains('mg') ? 'margin:' + e._ev?.textContent.slice(0, 4) : 'core:' + e.textContent.slice(0, 4)); }, [p.x, p.y]); };
    expect(await at(1008)).toBe('core:Pick');   // (Work's resize handle covers its last ~9 minutes, as for every box) expect(await at(550)).toBe('margin:Work'); expect(await at(700)).toBe('core:Work');
    const st = await page.locator('.mg.t').evaluate(m => { const c = getComputedStyle(m); return [c.borderTopStyle, c.borderTopWidth, c.borderBottomStyle]; });
    expect(st).toEqual(['dashed', '2px', 'none']);
  });
  test('both events keep the full column width although they touch through a margin', async ({ page }) => {
    const w = await boxOf(page.locator('.ev', { hasText: 'Work' })), p = await boxOf(page.locator('.ev', { hasText: 'Pickup' }));
    expect(Math.abs(w.width - p.width)).toBeLessThan(1); expect(Math.abs(w.x - p.x)).toBeLessThan(1); expect(await page.locator('.ov').count()).toBe(0);
  });
});

test.describe('R-GRID-12 Live View in a real browser', () => {
  const busy = () => blank({ people: [person({ id: 'O', name: 'Olivia' }), person({ id: 'B', name: 'Bob' })], events: [
    ev({ id: 'sc', title: 'School', desc: 'Room 4', slots: [slot(2, 540, 900, 'O')] }), ev({ id: 'gy', title: 'Gym', color: '#2fa66a', slots: [slot(2, 600, 720, 'B')] }),
    ev({ id: 'sf', title: 'Screen-free time', color: '#607d8b', bg: true, slots: [slot(2, 480, 720, 'O')] }), ev({ id: 'sat', title: 'Hidden', slots: [slot(5, 600, 660)] })] });
  const hit = (p, q) => p.x < q.x + q.width - 0.5 && q.x < p.x + p.width - 0.5 && p.y < q.y + q.height - 0.5 && q.y < p.y + p.height - 0.5;
  const live = async page => { await page.evaluate(() => { prefs.collapsed = true; applyPrefs(); setLive(true); }); };
  const clickAt = async (page, title, fy = 0.5, fx = 0.5) => { const b = await boxOf(page.locator('.day .ev, .day .bgs', { hasText: title }).first()); const p = { x: b.x + b.width * fx, y: b.y + Math.min(b.height - 4, Math.max(30, b.height * fy)) }; await page.mouse.click(p.x, p.y); return p; };
  test('nothing pops up by itself; clicking a box fades in a bubble pointing at the click, inside the day and clear of the click row', async ({ page }) => {
    await openApp(page, { clock: new Date(2026, 9, 14, 11, 0) }); await seed(page, busy()); await live(page); await expect(page.locator('.lvb')).toHaveCount(0);
    const p = await clickAt(page, 'School'); await expect(page.locator('.lvb')).toHaveCount(1); await expect(page.locator('.lvb')).toHaveClass(/\bin\b/);
    expect(await page.locator('.lvb').evaluate(e => getComputedStyle(e).animationName)).toBe('lvin');
    const [day, r] = [await boxOf(page.locator('.day')), await boxOf(page.locator('.lvb'))], ax = await page.locator('.lvb').evaluate(e => +e.dataset.ax);
    expect(Math.abs(day.x + ax - p.x)).toBeLessThan(7);   // at the click, or up to 6 px from it near the column edges expect(r.y > p.y || r.y + r.height < p.y).toBe(true);
    expect(r.x).toBeGreaterThanOrEqual(day.x - 1); expect(r.x + r.width).toBeLessThanOrEqual(day.x + day.width + 1);
  });
  test('several open bubbles never overlap; clicking empty space fades them all out', async ({ page }) => {
    await openApp(page, { clock: new Date(2026, 9, 14, 11, 0) }); await seed(page, busy()); await live(page);
    await clickAt(page, 'School', 0.5, 0.7); await clickAt(page, 'School', 0.5, 0.3); await clickAt(page, 'Gym'); await clickAt(page, 'Screen-free time', 0.3); await expect(page.locator('.lvb')).toHaveCount(4);   // two taps on one row of one box want the same spot (a bubble never covers the tapped row)
    const bs = await Promise.all((await page.locator('.lvb').all()).map(boxOf)); bs.forEach((r, i) => bs.slice(i + 1).forEach(q => expect(hit(r, q)).toBe(false)));
    const [day, wrap] = [await boxOf(page.locator('.day')), await boxOf(page.locator('#wrap'))]; await page.mouse.click(day.x + 40, wrap.y + wrap.height - 40); await expect(page.locator('.lvb')).toHaveCount(0);   // empty space in the evening
  });
  test('no bubble covers the title or the people line of a box, even when boxes start right below the click', async ({ page }) => {
    await openApp(page, { clock: new Date(2026, 9, 14, 11, 0) }); await seed(page, blank({ people: [person({ id: 'O', name: 'Olivia' }), person({ id: 'B', name: 'Bob' })], events: [
      ev({ id: 'a', title: 'School', slots: [slot(2, 480, 900, 'O')] }), ev({ id: 'b', title: 'Work', color: '#8e4ec6', slots: [slot(2, 480, 1020, 'B')] }),
      ev({ id: 'c', title: 'Lunch', color: '#e8912d', slots: [slot(2, 675, 720, 'O')] }), ev({ id: 'd', title: 'Meeting', color: '#12a5b5', slots: [slot(2, 675, 720, 'B')] })] }));
    await live(page); await clickAt(page, 'School', 0.25); await clickAt(page, 'Work', 0.25); await expect(page.locator('.lvb')).toHaveCount(2);
    const bs = await Promise.all((await page.locator('.lvb').all()).map(boxOf)), rows = await Promise.all((await page.locator('.ev .r1, .ev .r2').all()).map(boxOf));
    bs.forEach(r => rows.forEach(q => expect(hit(r, q)).toBe(false)));
  });
  test('the now line stays a third of the way down; a wheel scroll pauses it and the sidebar Now button returns', async ({ page }) => {
    await openApp(page, { clock: new Date(2026, 9, 14, 11, 0) }); await page.locator('#lvB').click(); await expect(page.locator('#lvB')).toHaveText('Stop Live View');
    const [wrap, hd] = [await boxOf(page.locator('#wrap')), await boxOf(page.locator('.dh').first())], third = hd.y + hd.height + (wrap.y + wrap.height - hd.y - hd.height) / 3;
    expect(Math.abs((await boxOf(page.locator('.now'))).y - third)).toBeLessThan(10); await expect(page.locator('#lvC')).toBeHidden();
    await page.mouse.move(wrap.x + wrap.width / 3, wrap.y + wrap.height / 2); await page.mouse.wheel(0, 300); await expect(page.locator('#lvC')).toBeVisible();
    await page.locator('#lvC').click(); await expect(page.locator('#lvC')).toBeHidden(); expect(Math.abs((await boxOf(page.locator('.now'))).y - third)).toBeLessThan(10);
  });
  test('clicking or dragging an event, or clicking the day header, does nothing while live', async ({ page }) => {
    await openApp(page, { clock: new Date(2026, 9, 14, 11, 0) }); await seed(page, busy()); await page.locator('#lvB').click();
    const b = await boxOf(page.locator('.ev', { hasText: 'School' })); await page.mouse.click(b.x + 20, b.y + 20); await expect(page.locator('#dlg')).toBeHidden();
    await page.mouse.move(b.x + 20, b.y + 20); await page.mouse.down(); await page.mouse.move(b.x + 20, b.y + 120, { steps: 5 }); await page.mouse.up();
    expect((await slots(page, 0))[0].start).toBe(540); const h = await boxOf(page.locator('.dh').nth(1)); await page.mouse.click(h.x + h.width / 2, h.y + h.height / 2); await expect(page.locator('#agDlg')).toBeHidden();
  });
  test('the Live View Mode pill pulses, the N hidden pill stays away, a reload stays live and the pill leaves it', async ({ page }) => {
    await openApp(page, { clock: new Date(2026, 9, 14, 11, 0), prefs: { hideWeekend: true } }); await seed(page, busy()); await expect(page.locator('#hid')).toBeVisible();
    await page.locator('#lvB').click(); await expect(page.locator('#lvPill')).toHaveText('Live View Mode'); await expect(page.locator('#hid')).toBeHidden();
    expect(await page.locator('#lvPill i').evaluate(e => getComputedStyle(e).animationName)).toBe('lvp');
    await page.reload(); await expect(page.locator('.day')).toHaveCount(1); await expect(page.locator('#lvPill')).toBeVisible();
    await page.locator('#lvPill').click(); await expect(page.locator('.day')).toHaveCount(5); await expect(page.locator('#lvPill')).toBeHidden();
  });
});

test.describe('R-EVT-19 An event marked "In the background" as drawn by a real browser', () => {
  test('it is a strip at the right edge of the day, and the person\'s own box beside it keeps almost the full width', async ({ page }) => {
    await openApp(page); await seed(page, blank({ people: [person({ id: 'O', name: 'Olivia' })], events: [
      ev({ id: 'hw', title: 'Homework', slots: [slot(0, 1080, 1140, 'O')] }), ev({ id: 'sf', title: 'Screen-free time', color: '#607d8b', bg: true, slots: [slot(0, 1080, 1200, 'O')] })] }));
    await page.evaluate(() => { document.getElementById('wrap').scrollTop = 12 * HH; });
    const col = await boxOf(page.locator('.day[data-d="0"]')), st = await boxOf(page.locator('.bgs')), hw = await boxOf(page.locator('.ev', { hasText: 'Homework' }));
    expect(Math.round(st.width)).toBe(14); expect(Math.abs((col.x + col.width) - (st.x + st.width))).toBeLessThan(1.5);
    expect(hw.x + hw.width).toBeLessThanOrEqual(st.x - 1); expect(hw.width).toBeGreaterThan(col.width - 6 - 16 - 2); await expect(page.locator('.ov')).toHaveCount(0);
  });
});

test.describe('R-EVT-17 Background strips as drawn by a real browser', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page); await seed(page, blank({ people: [person({ id: 'A', name: 'Ann' }), person({ id: 'X', name: 'Cleaner', external: true })], events: [
      ev({ id: 'w', title: 'Work', slots: [slot(0, 540, 1020, 'A')] }), ev({ id: 'c', title: 'Cleaning', color: '#12a5b5', bg: true, slots: [slot(0, 600, 780, 'X')] })] }));
  });
  test('the strip is 14 px wide, flush with the right edge of the day, and the box beside it stops before the gutter', async ({ page }) => {
    const col = await boxOf(page.locator('.day[data-d="0"]')), st = await boxOf(page.locator('.bgs')), w = await boxOf(page.locator('.ev', { hasText: 'Work' }));
    expect(Math.round(st.width)).toBe(14); expect(Math.abs((col.x + col.width) - (st.x + st.width))).toBeLessThan(1.5);
    expect(w.x + w.width).toBeLessThanOrEqual(st.x - 1); expect(w.width).toBeGreaterThan(col.width - 6 - 16 - 2);
  });
  test('the strip title is drawn vertically inside the strip, and only the right corners are rounded', async ({ page }) => {
    const st = await boxOf(page.locator('.bgs')), sp = await boxOf(page.locator('.bgs span'));
    expect(sp.height).toBeGreaterThan(sp.width * 3); expect(sp.x).toBeGreaterThanOrEqual(st.x - 0.5); expect(sp.x + sp.width).toBeLessThanOrEqual(st.x + st.width + 0.5); expect(sp.y).toBeLessThan(st.y + 8);
    const r = await page.locator('.bgs').evaluate(e => { const c = getComputedStyle(e); return [c.borderTopLeftRadius, c.borderTopRightRadius, c.borderBottomRightRadius, c.borderBottomLeftRadius]; });
    expect(r).toEqual(['0px', '6px', '6px', '0px']);
  });
  test('the band spans from the left edge of the column to the strip, and the pointer reaches the box through it', async ({ page }) => {
    const col = await boxOf(page.locator('.day[data-d="0"]')), st = await boxOf(page.locator('.bgs')), bb = await boxOf(page.locator('.bgb'));
    expect(Math.abs(bb.x - col.x)).toBeLessThan(1.5); expect(Math.abs((bb.x + bb.width) - st.x)).toBeLessThan(1.5); expect(Math.abs(bb.y - st.y)).toBeLessThan(1);
    const top = await page.evaluate(() => { const b = document.querySelector('.bgb').getBoundingClientRect(), w = document.querySelector('.ev').getBoundingClientRect(); return [document.elementFromPoint(w.left + 10, b.top + 20).className, document.elementFromPoint(b.right - 4, b.top + 20).className]; });
    expect(top[0]).toMatch(/\bev\b|\br1\b|\bt\b/); expect(top[1]).not.toContain('bgb');
  });
  test('only the lip is interactive: a real press-and-drag on the band area beside the box creates a new event', async ({ page }) => {
    await seed(page, blank({ people: [person({ id: 'X', name: 'Cleaner', external: true })], events: [ev({ id: 'c', title: 'Cleaning', color: '#12a5b5', bg: true, slots: [slot(0, 600, 780, 'X')] })] }));
    const bb = await boxOf(page.locator('.bgb')); await page.mouse.move(bb.x + 20, bb.y + 10); await page.mouse.down(); await page.mouse.move(bb.x + 20, bb.y + 60, { steps: 4 }); await page.mouse.up();
    await expect(page.locator('#dlg')).toBeVisible(); await expect(page.locator('#fT')).toHaveValue('');
  });
  test('clicking the strip with a real mouse opens its event, clicking the box beside it opens the box', async ({ page }) => {
    await page.locator('.bgs').click(); await expect(page.locator('#fT')).toHaveValue('Cleaning'); await page.keyboard.press('Escape');
    await page.locator('.ev', { hasText: 'Work' }).click({ position: { x: 20, y: 200 } }); await expect(page.locator('#fT')).toHaveValue('Work');
  });
});

test.describe('R-UI-03 The settings dialog in a real browser', () => {
  test('switching tabs never changes the size of the dialog (the largest tab sets it)', async ({ page }) => {
    await openApp(page); await page.locator('.sbtop .gear').click(); const sizes = [];
    for (const tab of ['View', 'Data', 'UI']) { await page.locator('#xDlg .stabs button', { hasText: tab }).click(); const b = await page.locator('#xDlg').boundingBox(); sizes.push([Math.round(b.width), Math.round(b.height)]); }
    expect(new Set(sizes.map(String)).size).toBe(1);
  });
  test('the theme switch spans the full width of its pane', async ({ page }) => {
    await openApp(page); await page.locator('.sbtop .gear').click(); await page.locator('#xDlg .stabs button', { hasText: 'UI' }).click();
    const sw = await page.locator('#xDlg .seg.theme').boundingBox(), pane = await page.locator('#xDlg .ssec:not(.off)').boundingBox();
    expect(Math.abs(sw.width - pane.width)).toBeLessThan(2);
  });
});

test.describe('R-EVT-13 Spanning lanes in a real browser', () => {
  test('an unassigned event over two parallel ones is as wide as both lanes together, and they keep their own lanes', async ({ page }) => {
    await openApp(page); await seed(page, blank({ people: [person({ id: 'A', name: 'Ann' }), person({ id: 'B', name: 'Bob' })], events: [ev({ id: 'a', title: 'Ann task', slots: [slot(0, 600, 720, 'A')] }), ev({ id: 'b', title: 'Bob task', slots: [slot(0, 600, 720, 'B')] }), ev({ id: 'x', title: 'Family', slots: [slot(0, 660, 780)] })] }));
    const a = await boxOf(page.locator('.ev', { hasText: 'Ann task' })), b = await boxOf(page.locator('.ev', { hasText: 'Bob task' })), x = await boxOf(page.locator('.ev', { hasText: 'Family' }));
    expect(a.x + a.width).toBeLessThanOrEqual(b.x + 1); expect(Math.abs(x.x - a.x)).toBeLessThan(2); expect(Math.abs((x.x + x.width) - (b.x + b.width))).toBeLessThan(2);
  });
});

test.describe('R-UI-07 The sectioned event dialog as drawn by a real browser', () => {
  const data2 = () => blank({ people: [person({ id: 'A', name: 'Ann' }), person({ id: 'B', name: 'Bob', color: '#2fa66a' })], events: [ev({ title: 'Swim', slots: [slot(0, 1020, 1080, 'A'), slot(2, 1020, 1080, 'B')] })] });
  test('on a wide screen labels sit left of their fields; day rows line up with the header columns', async ({ page }) => {
    await openApp(page); await seed(page, data2()); await page.evaluate(() => openDlg(S.events[0]));
    const lb = await boxOf(page.locator('label[for="fT"]')), f = await boxOf(page.locator('#fT'));
    expect(lb.x + lb.width).toBeLessThan(f.x); expect(Math.abs((lb.y + lb.height / 2) - (f.y + f.height / 2))).toBeLessThan(4);
    const col = async (sel, d) => boxOf(page.locator('#fDays .dr').nth(d).locator(sel).first());   // the columns line up: header, Monday and Wednesday
    for (const [k, sel] of [[1, 'select'], [3, 'select:nth-of-type(3)'], [4, '.wbtn'], [5, '.cbtn'], [6, '.tsel']]) {
      const hd = await boxOf(page.locator('#paneQ .dhd span').nth(k)), mon = await col(sel, 0), wed = await col(sel, 2);
      expect(Math.abs(hd.x - mon.x), `column ${k}`).toBeLessThan(1); expect(Math.abs(wed.x - mon.x), `column ${k}`).toBeLessThan(1);
    }
  });
  test('on a phone the labels move above their fields and the dialog does not scroll sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); await openApp(page); await seed(page, data2()); await page.evaluate(() => openDlg(S.events[0]));
    const lb = await boxOf(page.locator('label[for="fT"]')), f = await boxOf(page.locator('#fT')); expect(lb.y + lb.height).toBeLessThanOrEqual(f.y + 1);
    expect(await page.locator('#dlg').evaluate(d => d.scrollWidth <= d.clientWidth + 1)).toBe(true);
    const mon = page.locator('#fDays .dr').first(), sel = await boxOf(mon.locator('select').first()), wb = await boxOf(mon.locator('.wbtn')); expect(sel.width).toBeGreaterThanOrEqual(67);
    expect(wb.y).toBeGreaterThan(sel.y + sel.height - 1);   // each day folds onto two lines: day, times, performer / With, timing, copy
  });
  const many = async (page, n) => { const add = page.locator('#fDays .dr').first().locator('.addt'); for (let i = 0; i < n; i++) await add.click(); };
  const geo = page => page.evaluate(() => { const q = document.getElementById('paneQ'), r = q.getBoundingClientRect(), h = document.querySelector('#paneQ .dhd span').getBoundingClientRect();
    return { dlg: document.getElementById('dlg').getBoundingClientRect().height, pane: r.height, top: r.top, bottom: r.bottom, scroll: q.scrollHeight - q.clientHeight, head: h.top, vh: innerHeight }; });
  test('a long list of times scrolls inside the day table, so the dialog stops growing', async ({ page }) => {
    await openApp(page); await seed(page, data2()); await page.evaluate(() => openDlg(S.events[0]));
    expect((await geo(page)).scroll).toBeLessThanOrEqual(0);   // a normal week fits without a scroll bar
    await many(page, 12); const g12 = await geo(page); await many(page, 8); const g20 = await geo(page);
    expect(g12.scroll).toBeGreaterThan(0); expect(g12.pane).toBeLessThanOrEqual(Math.min(420, g12.vh / 2) + 1);
    expect(g20.dlg).toBeCloseTo(g12.dlg, 0); expect(g20.dlg).toBeLessThan(g20.vh);
  });
  test('the header row stays visible while the times scroll, and a time added with + is scrolled into view', async ({ page }) => {
    await openApp(page); await seed(page, data2()); await page.evaluate(() => openDlg(S.events[0])); await many(page, 20);
    const last = await boxOf(page.locator('#fDays .dr.dx').last().locator('select').first()), g = await geo(page);
    expect(last.y).toBeGreaterThanOrEqual(g.top - 1); expect(last.y + last.height).toBeLessThanOrEqual(g.bottom + 1);   // the newest time is visible
    await page.evaluate(() => { document.getElementById('paneQ').scrollTop = 1e6; }); const g2 = await geo(page);
    expect(Math.abs(g2.head - g2.top)).toBeLessThan(2);
  });
  test('on a phone the day table also scrolls under a header that stays put', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); await openApp(page); await seed(page, data2()); await page.evaluate(() => openDlg(S.events[0])); await many(page, 12);
    await page.evaluate(() => { document.getElementById('paneQ').scrollTop = 1e6; }); const g = await geo(page);
    expect(g.scroll).toBeGreaterThan(0); expect(Math.abs(g.head - g.top)).toBeLessThan(2);
    expect(await page.locator('#dlg').evaluate(d => d.scrollWidth <= d.clientWidth + 1)).toBe(true);
  });
  test('R-EVT-22 the colour swatch menu works with the mouse inside the modal dialog, and the box takes the chosen colour', async ({ page }) => {
    await openApp(page); await seed(page, data2()); await page.evaluate(() => openDlg(S.events[0]));
    await page.locator('#fDays .dr').nth(2).locator('.cbtn').click(); await page.locator('.cmenu .oi', { hasText: "Performer's colour (Bob)" }).click();
    await expect(page.locator('.cmenu')).toHaveCount(0); await page.click('#fOk');
    expect(await page.locator('.day[data-d="2"] .ev').evaluate(b => getComputedStyle(b).backgroundColor)).toBe('rgb(47, 166, 106)');
    expect(await page.locator('.day[data-d="0"] .ev').evaluate(b => getComputedStyle(b).backgroundColor)).toBe('rgb(59, 109, 240)');
  });
  test('clicking a person chip with the mouse ticks it and shows "only on call"; clicking again unticks it', async ({ page }) => {
    await openApp(page); await seed(page, data2()); await page.evaluate(() => openDlg(S.events[0]));
    await expect(page.locator('#fOcRow')).toBeHidden(); await page.locator('#fInv label', { hasText: 'Bob' }).click();
    expect(await page.locator('#fInv input[value="B"]').isChecked()).toBe(true); await expect(page.locator('#fOcRow')).toBeVisible();
    await page.locator('#fInv label', { hasText: 'Bob' }).click(); expect(await page.locator('#fInv input[value="B"]').isChecked()).toBe(false);
  });
});

test.describe('R-UI-10 Dragging the event dialog aside, in a real browser', () => {
  const box = () => blank({ events: [ev({ id: 'a', title: 'Behind', slots: [slot(2, 600, 720), slot(3, 600, 720)] })] });
  const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  test('dragging the grip bar moves the dialog off a box it was hiding; menus inside it still open at their button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 }); await openApp(page, { prefs: { fitW: true } }); await seed(page, box());
    await page.evaluate(() => { document.getElementById('wrap').scrollTop = (10 - vs()) * HH - 100; openDlg(S.events[0]); });
    const ev0 = await boxOf(page.locator('.day[data-d="2"] .ev')), d0 = await boxOf(page.locator('#dlg'));
    expect(overlaps(ev0, d0)).toBe(true);
    const g = await boxOf(page.locator('#dGrip')), dx = ev0.x + ev0.width + 10 - d0.x;
    await page.mouse.move(g.x + 40, g.y + g.height / 2); await page.mouse.down(); await page.mouse.move(g.x + 40 + dx, g.y + g.height / 2 + 30, { steps: 8 }); await page.mouse.up();
    const d1 = await boxOf(page.locator('#dlg')); expect(Math.round(d1.x - d0.x)).toBe(Math.round(dx)); expect(Math.round(d1.y - d0.y)).toBe(30);
    expect(overlaps(ev0, d1)).toBe(false); await expect(page.locator('#dlg')).toHaveAttribute('open', '');
    const sw = page.locator('#fDays .dr').nth(2).locator('.cbtn'); await sw.click(); const s = await boxOf(sw), m = await boxOf(page.locator('.cmenu'));
    expect(Math.abs(m.y - (s.y + s.height + 4))).toBeLessThan(2);
  });
});

test.describe('R-UI-11 The Tools highlight in a real browser', () => {
  const data = () => blank({ types: [{ id: 't', name: 'Work', color: '#aa5500', icon: 'work' }],
    events: [ev({ id: 'a', title: 'Typed', type: 't', slots: [slot(0, 600, 660)] }), ev({ id: 'b', title: 'Loose', slots: [slot(1, 600, 660)] })] });
  const look = page => page.evaluate(() => [...document.querySelectorAll('.ev')].map(b => { const c = getComputedStyle(b); return [b.textContent.startsWith('Typed') ? 'typed' : 'loose', c.outlineStyle, c.animationName]; }));
  test('only the untyped box gets a pulsing red outline; with reduced motion the outline stays but does not pulse', async ({ page }) => {
    await openApp(page, { prefs: { hlNoType: true } }); await seed(page, data());
    expect((await look(page)).sort()).toEqual([['loose', 'solid', 'noty'], ['typed', 'none', 'none']]);
    await page.emulateMedia({ reducedMotion: 'reduce' }); expect((await look(page)).sort()).toEqual([['loose', 'solid', 'none'], ['typed', 'none', 'none']]);
  });
});
