import { test, expect } from '@playwright/test';
import { openApp, seed, slots, blank, ev, slot, pt, touch, swipe } from './helpers.js';

const phonePrefs = { collapsed: true, rowH: 60 };
test.beforeEach(async ({ page }) => { await openApp(page, { prefs: phonePrefs }); });
const week = page => page.evaluate(() => setFocus(null));   // a phone opens on today's day view (R-UI-13); these tests need the week

test.describe('R-TOUCH-01 Touch on a phone-sized screen', () => {
  test.beforeEach(async ({ page }) => { await week(page); });
  test('tapping an event opens its dialog', async ({ page }) => {
    await seed(page, blank({ events: [ev()] })); const p = await pt(page, 0, 630); await page.touchscreen.tap(p.x, p.y);
    await expect(page.locator('#dlg')).toBeVisible(); expect(await page.inputValue('#fT')).toBe('Event');
  });
  test('tapping empty space creates nothing', async ({ page }) => {
    await seed(page, blank()); const p = await pt(page, 1, 700); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(600); await expect(page.locator('#dlg')).toBeHidden();
  });
  test('a long press on empty space and a drag creates an event for that time range', async ({ page }) => {
    await seed(page, blank()); const a = await pt(page, 0, 600), b = await pt(page, 0, 690);
    await touch(page, [a, { x: a.x, y: (a.y + b.y) / 2 }, b], { hold: 550 });
    await expect(page.locator('#dlg')).toBeVisible(); const r = page.locator('#fDays .dr:has(input:checked)').locator('select'); expect(await r.nth(0).inputValue()).toBe('600'); expect(await r.nth(1).inputValue()).toBe('690');
  });
  test('a long press on an event and a drag moves it to the neighbouring day', async ({ page }) => {
    await seed(page, blank({ events: [ev()] })); const a = await pt(page, 0, 630), b = await pt(page, 1, 750);
    await touch(page, [a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, b], { hold: 550 });
    expect((await slots(page))[0]).toMatchObject({ day: 1, start: 720 });
  });
  test('a long press on the bottom edge of an event and a drag resizes it', async ({ page }) => {
    await seed(page, blank({ events: [ev()] })); const a = await pt(page, 0, 656), b = await pt(page, 0, 716);
    await touch(page, [a, { x: a.x, y: (a.y + b.y) / 2 }, b], { hold: 550 });
    expect((await slots(page))[0]).toMatchObject({ start: 600, end: 720 });
  });
  test('swiping vertically scrolls the grid and neither creates nor moves anything', async ({ page }) => {
    await seed(page, blank({ events: [ev()] })); const a = await pt(page, 1, 900); await swipe(page, a, 0, -250);
    await expect.poll(() => page.evaluate(() => document.getElementById('wrap').scrollTop)).toBeGreaterThan(20);
    await expect(page.locator('#dlg')).toBeHidden(); expect((await slots(page))[0]).toMatchObject({ day: 0, start: 600 });
  });
  test('swiping horizontally scrolls the days sideways', async ({ page }) => {
    await seed(page, blank({ events: [ev()] })); const a = await pt(page, 1, 900); await swipe(page, a, -200, 0);
    await expect.poll(() => page.evaluate(() => document.getElementById('wrap').scrollLeft)).toBeGreaterThan(20); await expect(page.locator('#dlg')).toBeHidden();
  });
  test('a swipe that starts on an event scrolls instead of moving the event', async ({ page }) => {
    await seed(page, blank({ events: [ev()] })); const a = await pt(page, 0, 630); await swipe(page, a, 0, -200);
    await expect.poll(() => page.evaluate(() => document.getElementById('wrap').scrollTop)).toBeGreaterThan(20);
    expect((await slots(page))[0]).toMatchObject({ day: 0, start: 600, end: 660 }); await expect(page.locator('#dlg')).toBeHidden();
  });
  test('a long press never pops up the browser or copy menu, and no hover card appears', async ({ page }) => {
    await seed(page, blank({ events: [ev()] })); const a = await pt(page, 0, 630); await touch(page, [a, { x: a.x, y: a.y + 1 }], { hold: 700 });
    await expect(page.locator('.omenu')).toHaveCount(0); await expect(page.locator('#peek')).toBeHidden();
  });
  test('tapping where events overlap offers the list to choose from', async ({ page }) => {
    await seed(page, blank({ events: [ev({ id: 'a', title: 'A' }), ev({ id: 'b', title: 'B', slots: [slot(0, 630, 700)] })] })); const p = await pt(page, 0, 650); await page.touchscreen.tap(p.x, p.y);
    await expect(page.locator('.omenu .oi')).toHaveCount(2);
  });
  test('resize handles are taller on touch screens so a finger can hit them', async ({ page }) => {
    await seed(page, blank({ events: [ev()] })); const h = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.rz')).height)); expect(h).toBeGreaterThanOrEqual(16);
  });
  test('the page itself does not scroll or zoom sideways: the grid area does the scrolling', async ({ page }) => {
    const r = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, body: getComputedStyle(document.body).overflow }));
    expect(r.doc).toBeLessThanOrEqual(1); expect(r.body).toBe('hidden');
  });
});

test.describe('R-GRID-12 Live View on a phone', () => {
  test('tapping the same box three times keeps one bubble, moved to the last tap, instead of opening duplicates', async ({ page }) => {
    const d = await page.evaluate(() => today());
    await seed(page, blank({ events: [ev({ title: 'Gym', slots: [slot(d, 300, 1380)] })] })); await page.evaluate(() => setLive(true));
    const vh = page.viewportSize().height;
    for (const f of [0.3, 0.5, 0.7]) { const b = await page.locator('.ev').first().boundingBox(); await page.touchscreen.tap(b.x + b.width * f, vh * 0.6); }   // the box runs all day; mid-screen is inside it
    await expect(page.locator('.lvb')).toHaveCount(1); expect(await page.evaluate(() => lvOpen.length)).toBe(1);
  });
});

test.describe('R-UI-13 The sidebar as a drawer on a phone', () => {
  test('in the day view a sideways swipe shows the next or previous day, while an up-and-down swipe still scrolls', async ({ page }) => {
    const t = await page.evaluate(() => today()), d = () => page.evaluate(() => focusD);
    await swipe(page, { x: 250, y: 450 }, -160, 0); await expect.poll(d).toBe((t + 1) % 7);
    await swipe(page, { x: 150, y: 450 }, 160, 0); await swipe(page, { x: 150, y: 450 }, 160, 0); await expect.poll(d).toBe((t + 6) % 7);
    const top = await page.evaluate(() => document.getElementById('wrap').scrollTop); await swipe(page, { x: 200, y: 600 }, 0, -300);
    await expect.poll(() => page.evaluate(() => document.getElementById('wrap').scrollTop)).toBeGreaterThan(top); expect(await d()).toBe((t + 6) % 7);
  });
  test('the phone week shows short day names that fit their columns; tapping one opens that day', async ({ page }) => {
    await page.evaluate(() => { prefs.fitW = true; setFocus(null); });
    const hs = page.locator('.dh.nr'); await expect(hs).toHaveCount(7); await expect(hs.first()).toHaveText('Mo');
    for (const h of await hs.all()) expect(await h.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);   // nothing cut off or overlapping
    await hs.nth(3).tap(); await expect(page.locator('.dh.fo')).toContainText('Thursday');
  });
  test('the app opens on today\'s day view, filling the width; Week brings the seven days back', async ({ page }) => {
    const name = await page.evaluate(() => DAYS[today()]); await expect(page.locator('.dh.fo')).toContainText(name); await expect(page.locator('.day')).toHaveCount(1);
    await page.locator('.dh.fo .wk').tap(); await expect(page.locator('.day')).toHaveCount(7);
  });
  test('it starts closed even when it was left open; opened, it lies over the full-width grid and a tap beside it closes it', async ({ page }) => {
    await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('weekly-schedules-prefs')); p.collapsed = false; localStorage.setItem('weekly-schedules-prefs', JSON.stringify(p)); });
    await page.reload(); await expect(page.locator('#sb')).toHaveClass(/collapsed/);   // left open, yet closed after the reload
    const vw = page.viewportSize().width; await page.locator('#sbin .xpand').tap();
    const sb = await page.locator('#sb').boundingBox(), wrap = await page.locator('#wrap').boundingBox();
    expect(sb.x).toBe(0); expect(sb.width).toBeGreaterThan(200); expect(wrap.width).toBeGreaterThan(vw - 5);   // over the grid, not beside it
    await expect(page.locator('#sbBack')).toBeVisible(); await page.touchscreen.tap(vw - 15, 400);
    await expect(page.locator('#sb')).toHaveClass(/collapsed/); await expect(page.locator('#sbBack')).toBeHidden();
  });
});

test.describe('R-CYC-04 On a phone the week switcher is at hand and a swipe crosses into the next week', () => {
  test('the corner shows the week in the day view, and swiping on from Sunday shows Monday of the next week', async ({ page }) => {
    await seed(page, blank({ cycle: 2 })); await page.evaluate(() => { curWk = 1; setFocus(6); });
    const b = await page.locator('.wkb').boundingBox(); expect(b).not.toBeNull(); expect(b.width).toBeGreaterThan(20);
    await swipe(page, { x: 250, y: 450 }, -160, 0); await expect.poll(() => page.evaluate(() => [focusD, curWk])).toEqual([0, 2]);
    await expect(page.locator('.wkb')).toHaveText('W2'); await expect(page.locator('.dh.fo')).toContainText('Monday · W2');
    await page.locator('.wkb').tap(); await expect(page.locator('.omenu .oi')).toHaveCount(3);
  });
});

test.describe('R-UI-14 Large dialogs fill a phone screen; the event dialog shows one tab at a time', () => {
  const many = () => blank({ events: [ev({ slots: [0, 1, 2, 3, 4, 5, 6].map(d => slot(d, 600, 660)) })] });
  const fills = async (page, sel) => { const b = await page.locator(sel).boundingBox(), v = page.viewportSize(); expect(Math.abs(b.x) + Math.abs(b.y)).toBeLessThan(1); expect(Math.abs(b.width - v.width)).toBeLessThan(1); expect(Math.abs(b.height - v.height)).toBeLessThan(1); };
  test('the event dialog fills the screen, has no grip and cannot be dragged; tabs and the footer stay while the When pane scrolls', async ({ page }) => {
    await seed(page, many()); await page.evaluate(() => openDlg(S.events[0])); await fills(page, '#dlg'); await expect(page.locator('#dGrip')).toBeHidden();
    await page.locator('.dtabs button', { hasText: 'When' }).tap(); await expect(page.locator('#fT')).toBeHidden(); await expect(page.locator('#paneQ')).toBeVisible();
    const tabs0 = await page.locator('.dtabs').boundingBox(), ok0 = await page.locator('#fOk').boundingBox();
    await swipe(page, { x: 200, y: 600 }, 0, -300); await expect.poll(() => page.locator('#paneQ').evaluate(p => p.scrollTop)).toBeGreaterThan(20);
    expect(await page.locator('.dtabs').boundingBox()).toEqual(tabs0); expect(await page.locator('#fOk').boundingBox()).toEqual(ok0);
    expect(ok0.y + ok0.height).toBeLessThanOrEqual(page.viewportSize().height); await fills(page, '#dlg');
    await touch(page, [{ x: 200, y: 20 }, { x: 200, y: 200 }, { x: 200, y: 300 }]); await fills(page, '#dlg');
  });
  test('the tabs are finger-sized and tapping More shows the switches and schedules', async ({ page }) => {
    await seed(page, many()); await page.evaluate(() => openDlg(S.events[0]));
    for (const b of await page.locator('.dtabs button').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await page.locator('.dtabs button', { hasText: 'More' }).tap(); await expect(page.locator('#fSch')).toBeVisible(); await expect(page.locator('#paneQ')).toBeHidden();
  });
  test('Settings, Statistics and the day agenda fill the screen; Weeks in the cycle stays a floating window', async ({ page }) => {
    await seed(page, blank({ people: [{ id: 'A', name: 'Ann', color: '#e5484d', visible: true }] }));
    await page.evaluate(() => openSettings()); await fills(page, '#xDlg'); await page.evaluate(() => document.getElementById('xDlg').close());
    await page.evaluate(() => openStats('A')); await fills(page, '#xDlg'); await page.evaluate(() => document.getElementById('xDlg').close());
    await page.evaluate(() => openAgenda(0)); await fills(page, '#agDlg'); await page.evaluate(() => document.getElementById('agDlg').close());
    await page.evaluate(() => openCycle()); const b = await page.locator('#xDlg').boundingBox(); expect(b.width).toBeLessThan(page.viewportSize().width); expect(b.height).toBeLessThan(page.viewportSize().height / 2);
  });
  test('opening a repetition from the grid shows it in the When tab, scrolled into view and pulsing', async ({ page }) => {
    await seed(page, many()); await page.evaluate(() => openDlg(S.events[0], null, S.events[0].slots[6]));
    await page.locator('.dtabs button', { hasText: 'When' }).tap(); const sun = page.locator('#fDays .dr').nth(6);
    await expect(sun).toHaveClass(/pulse/); const r = await sun.locator('input').first().boundingBox(), p = await page.locator('#paneQ').boundingBox();
    expect(r.y).toBeGreaterThanOrEqual(p.y); expect(r.y + r.height).toBeLessThanOrEqual(p.y + p.height);
  });
});

test.describe('R-REP-02 The day copy menu on a phone', () => {
  test('tapping ⧉ in the full-screen dialog opens the menu on screen, and tapping "The days above" copies upwards', async ({ page }) => {
    await seed(page, blank({ events: [ev({ slots: [slot(0, 600, 660), slot(2, 720, 780), slot(4, 600, 660)] })] })); await page.evaluate(() => openDlg(S.events[0]));
    await page.locator('.dtabs button', { hasText: 'When' }).tap(); await page.locator('#fDays .dr:not(.dx)').nth(2).locator('.cpy').tap();
    const m = page.locator('#dlg .cmenu'); await expect(m).toBeVisible(); const r = await m.boundingBox(), v = page.viewportSize();
    expect(r.x).toBeGreaterThanOrEqual(0); expect(r.x + r.width).toBeLessThanOrEqual(v.width); expect(r.y + r.height).toBeLessThanOrEqual(v.height);
    await m.locator('.oi', { hasText: 'The days above' }).tap(); await page.locator('#fOk').tap();
    expect((await slots(page)).map(s => [s.day, s.start])).toEqual([[0, 720], [2, 720], [4, 600]]);
  });
});
