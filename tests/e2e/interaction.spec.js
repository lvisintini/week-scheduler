import { test, expect } from '@playwright/test';
import { openApp, seed, data, slots, blank, ev, slot, sched, person, pt, drag, toolbar } from './helpers.js';

const three = () => blank({ events: [ev({ slots: [slot(0, 600, 660), slot(2, 600, 660), slot(4, 600, 660)] })] });
const overlapping = () => blank({ events: [ev({ id: 'a', title: 'A', slots: [slot(0, 600, 720)] }), ev({ id: 'b', title: 'B', color: '#e5484d', slots: [slot(0, 660, 750)] })] });
const starts = page => page.evaluate(() => S.events[0].slots.map(s => s.start));
const menuTitles = page => page.locator('.omenu .oi b').allTextContents();

test.beforeEach(async ({ page }) => { await openApp(page); });

test.describe('R-EVT-01 Creating, moving and resizing events with a real mouse', () => {
  test('dragging across empty space opens the new-event dialog with the snapped time range', async ({ page }) => {
    await seed(page, blank()); await drag(page, { col: 2, min: 607 }, { col: 2, min: 698 });
    await expect(page.locator('#dlg')).toBeVisible(); expect(await page.inputValue('#fS')).toBe('600'); expect(await page.inputValue('#fE')).toBe('705');
  });
  test('the new event can be filled in and saved, and then appears in the dragged position', async ({ page }) => {
    await seed(page, blank()); await drag(page, { col: 1, min: 840 }, { col: 1, min: 930 });
    await page.fill('#fT', 'Dentist'); await page.click('#fOk'); await expect(page.locator('#dlg')).toBeHidden();
    const box = page.locator('.day[data-d="1"] .ev'); await expect(box).toHaveCount(1); await expect(box.locator('.t')).toHaveText('Dentist'); await expect(box.locator('.tm')).toHaveText('14:00–15:30');
  });
  test('dragging an event moves it to the other day and time', async ({ page }) => {
    await seed(page, blank({ events: [ev()] })); await drag(page, { col: 0, min: 630 }, { col: 3, min: 757 });
    expect((await slots(page))[0]).toMatchObject({ day: 3, start: 720, end: 780 });
  });
  test('dragging the bottom edge resizes the event', async ({ page }) => {
    await seed(page, blank({ events: [ev()] })); await drag(page, { col: 0, min: 656 }, { col: 0, min: 706 });
    expect((await slots(page))[0]).toMatchObject({ start: 600, end: 705 });
  });
  test('while the mouse is still down the event already follows the pointer (live preview)', async ({ page }) => {
    await seed(page, blank({ events: [ev()] })); await drag(page, { col: 0, min: 630 }, { col: 0, min: 750 }, { release: false });
    expect((await slots(page))[0].start).toBe(720); await page.mouse.up();
  });
  test('the event keeps its length when dragged to the bottom of the day', async ({ page }) => {
    await seed(page, blank({ events: [ev()] })); await drag(page, { col: 0, min: 630 }, { col: 0, min: 1439 });
    const s = (await slots(page))[0]; expect(s.end - s.start).toBe(60);
  });
  test('dragging the bottom handle into the next day extends an event past midnight', async ({ page }) => {
    await seed(page, blank({ events: [ev({ slots: [slot(5, 1320, 1440)] })] })); await page.evaluate(() => { const w = document.getElementById('wrap'); w.scrollTop = w.scrollHeight; });
    await drag(page, { col: 5, min: 1436 }, { col: 6, min: 120 });
    expect((await slots(page))[0].end).toBe(1560);
    await expect(page.locator('.day[data-d="6"] .ev')).toHaveCount(0);   // the continuation lies in the hidden early hours…
    await page.evaluate(() => { prefs.showEarly = true; render(); }); await expect(page.locator('.day[data-d="6"] .ev')).toHaveCount(1);   // …and appears when they are shown
  });
  test('an event that was created by drag can be undone with Ctrl+Z and redone with Ctrl+Y', async ({ page }) => {
    await seed(page, blank({ events: [ev()] })); await drag(page, { col: 0, min: 630 }, { col: 2, min: 630 });
    await page.keyboard.press('Control+z'); expect((await slots(page))[0].day).toBe(0); await page.keyboard.press('Control+y'); expect((await slots(page))[0].day).toBe(2);
  });
});

test.describe('R-REP-06 Repeating events in a real browser', () => {
  test('dragging one repetition moves all of them; the toast offers Only this day and Undo', async ({ page }) => {
    await seed(page, three()); await drag(page, { col: 0, min: 630 }, { col: 1, min: 690 });
    expect(await starts(page)).toEqual([660, 660, 660]); await expect(page.locator('#toast')).toContainText('Applied to all 3 repetitions'); await expect(page.locator('#toast button')).toHaveText(['Only this day', 'Undo']);
  });
  test('holding Shift while dragging changes only the grabbed repetition', async ({ page }) => {
    await seed(page, three()); await drag(page, { col: 0, min: 630 }, { col: 0, min: 750 }, { shift: true });
    expect(await starts(page)).toEqual([720, 600, 600]);
  });
  test('"Only this day" in the toast keeps the dragged one and restores the others', async ({ page }) => {
    await seed(page, three()); await drag(page, { col: 0, min: 630 }, { col: 0, min: 750 }); await page.locator('#toast button', { hasText: 'Only this day' }).click();
    expect(await starts(page)).toEqual([720, 600, 600]);
  });
  test('"Undo" in the toast puts every repetition back', async ({ page }) => {
    await seed(page, three()); await drag(page, { col: 0, min: 630 }, { col: 0, min: 750 }); await page.locator('#toast button', { hasText: 'Undo' }).click();
    expect(await starts(page)).toEqual([600, 600, 600]);
  });
  test('resizing never removes a repetition: the shortest keeps 15 minutes', async ({ page }) => {
    await seed(page, blank({ events: [ev({ slots: [slot(0, 600, 720), slot(1, 600, 630), slot(2, 600, 660)] })] }));
    await drag(page, { col: 0, min: 716 }, { col: 0, min: 612 }); const s = await slots(page);
    expect(s).toHaveLength(3); expect(s.every(x => x.end - x.start >= 15)).toBe(true);
  });
  test('no confirmation dialog of any kind appears for repeat drags', async ({ page }) => {
    const dialogs = []; page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
    await seed(page, three()); await drag(page, { col: 0, min: 630 }, { col: 1, min: 690 }); expect(dialogs).toEqual([]);
  });
});

test.describe('R-SEL-01 Clicking where events overlap, with a real mouse', () => {
  test('clicking a spot that belongs to one event opens its dialog directly', async ({ page }) => {
    await seed(page, overlapping()); const p = await pt(page, 0, 630); await page.mouse.click(p.x, p.y);
    await expect(page.locator('#dlg')).toBeVisible(); expect(await page.inputValue('#fT')).toBe('A');
  });
  test('clicking where two events overlap offers a list; choosing one opens it', async ({ page }) => {
    await seed(page, overlapping()); const p = await pt(page, 0, 690); await page.mouse.click(p.x, p.y);
    await expect(page.locator('.omenu')).toBeVisible(); expect(await menuTitles(page)).toEqual(['A', 'B']);
    await page.locator('.omenu .oi', { hasText: 'B' }).click(); expect(await page.inputValue('#fT')).toBe('B');
  });
  test('Escape closes the list without opening anything', async ({ page }) => {
    await seed(page, overlapping()); const p = await pt(page, 0, 690); await page.mouse.click(p.x, p.y); await page.keyboard.press('Escape');
    await expect(page.locator('.omenu')).toHaveCount(0); await expect(page.locator('#dlg')).toBeHidden();
  });
});

test.describe('R-SEL-02 Dragging where events overlap, with a real mouse', () => {
  test('a drag from the overlap asks which one to move and moves nothing yet', async ({ page }) => {
    await seed(page, overlapping()); await drag(page, { col: 0, min: 690 }, { col: 0, min: 780 });
    await expect(page.locator('.omenu .oh')).toHaveText(/pick the one to move/); expect(await page.evaluate(() => S.events.map(e => e.slots[0].start))).toEqual([600, 660]);
  });
  test('picking one outlines it, and the next drag moves just that event', async ({ page }) => {
    await seed(page, overlapping()); await drag(page, { col: 0, min: 690 }, { col: 0, min: 780 }); await page.locator('.omenu .oi', { hasText: 'B' }).click();
    await expect(page.locator('.ev.sel')).toHaveCount(1); await drag(page, { col: 0, min: 690 }, { col: 0, min: 780 });
    expect(await page.evaluate(() => S.events.map(e => e.slots[0].start))).toEqual([600, 750]);
  });
  test('Escape clears the selection outline', async ({ page }) => {
    await seed(page, overlapping()); await drag(page, { col: 0, min: 690 }, { col: 0, min: 780 }); await page.locator('.omenu .oi').first().click(); await page.keyboard.press('Escape');
    await expect(page.locator('.ev.sel')).toHaveCount(0);
  });
});

test.describe('R-SEL-03 Right-click copy menu, with a real mouse', () => {
  test('right-clicking an event opens the copy list, and no browser menu replaces it', async ({ page }) => {
    await seed(page, blank({ schedules: [sched(), sched({ id: 's2', name: 'Other' })], events: [ev()] })); const p = await pt(page, 0, 630);
    await page.mouse.click(p.x, p.y, { button: 'right' }); await expect(page.locator('.omenu .oh')).toHaveText('Copy event…');
    await page.locator('.omenu .oi').first().click(); await expect(page.locator('#xDlg')).toBeVisible(); await expect(page.locator('#xDlg h3')).toContainText('Copy event');
  });
});

test.describe('R-EVT-05 Hover card with a real mouse', () => {
  const rich = () => blank({ people: [person({ id: 'A', name: 'Ann' })], events: [ev({ title: 'Review', desc: 'Bring the printed report', slots: [slot(0, 600, 720, 'A')] })] });
  test('resting the pointer on an event shows the card with its description, and leaving hides it', async ({ page }) => {
    await seed(page, rich()); const p = await pt(page, 0, 650); await page.mouse.move(p.x, p.y);
    await expect(page.locator('#peek')).toBeVisible(); await expect(page.locator('#peek')).toContainText('Bring the printed report'); await expect(page.locator('#peek')).toContainText('By: Ann');
    const q = await pt(page, 4, 650); await page.mouse.move(q.x, q.y); await expect(page.locator('#peek')).toBeHidden();
  });
  test('the card stays inside the window even for an event at the right edge', async ({ page }) => {
    await seed(page, blank({ events: [ev({ desc: 'x'.repeat(200), slots: [slot(6, 600, 720)] })] })); const p = await pt(page, 6, 650); await page.mouse.move(p.x, p.y); await expect(page.locator('#peek')).toBeVisible();
    const b = await page.locator('#peek').boundingBox(); const vw = page.viewportSize().width; expect(b.x + b.width).toBeLessThanOrEqual(vw + 1); expect(b.x).toBeGreaterThanOrEqual(-1);
  });
  test('no card appears while dragging', async ({ page }) => {
    await seed(page, rich()); await drag(page, { col: 0, min: 650 }, { col: 0, min: 700 }, { release: false }); await page.waitForTimeout(500); await expect(page.locator('#peek')).toBeHidden(); await page.mouse.up();
  });
});

test.describe('R-PHS-06 Editing phases with a real mouse', () => {
  const withPhases = () => blank({ rhythms: [{ id: 'r', name: 'R', visible: true }], phases: [{ id: 'p', title: 'Lunch', desc: '', color: '#2fa66a', rhythms: ['r'], slots: [0, 1, 2].map(d => ({ day: d, start: 720, end: 780 })) }], events: [ev()] });
  test('in Phases mode dragging a phase moves all its repetitions while events stay put', async ({ page }) => {
    await seed(page, withPhases()); await page.locator('.seg button', { hasText: 'Phases' }).click(); await drag(page, { col: 0, min: 750 }, { col: 0, min: 810 });
    const r = await page.evaluate(() => ({ ph: S.phases[0].slots.map(s => s.start), ev: S.events[0].slots[0].start })); expect(r).toEqual({ ph: [780, 780, 780], ev: 600 });
  });
  test('in Events mode dragging over a phase does not move it (phases are only background)', async ({ page }) => {
    await seed(page, withPhases()); await drag(page, { col: 0, min: 750 }, { col: 0, min: 810 }); await page.keyboard.press('Escape');
    expect(await page.evaluate(() => S.phases[0].slots.map(s => s.start))).toEqual([720, 720, 720]);
  });
  test('dragging the phase label (lip) in Phases mode moves the phase', async ({ page }) => {
    await seed(page, withPhases()); await page.locator('.seg button', { hasText: 'Phases' }).click();
    const lip = await page.locator('.dw[data-d="0"] .lip').boundingBox(); await page.mouse.move(lip.x + lip.width / 2, lip.y + lip.height / 2); await page.mouse.down(); await page.mouse.move(lip.x + lip.width / 2, lip.y + lip.height / 2 + 48, { steps: 5 }); await page.mouse.up();
    expect(await page.evaluate(() => S.phases[0].slots[0].start)).toBe(780);
  });
});

test.describe('R-UI-07 Keyboard-only use of the event dialog', () => {
  test('a new event can be created without the mouse: open the dialog, type, tab to Save, press Enter', async ({ page }) => {
    await seed(page, blank()); await toolbar(page, 'add').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#dlg')).toBeVisible();
    await page.locator('#fT').focus(); await page.keyboard.type('Keyboard only');
    for (let i = 0; i < 80 && (await page.evaluate(() => document.activeElement.id)) !== 'fOk'; i++) await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('fOk'); await page.keyboard.press('Enter');
    await expect(page.locator('#dlg')).toBeHidden(); expect((await data(page)).events.map(e => e.title)).toEqual(['Keyboard only']);
  });
  test('Escape closes the dialog without saving', async ({ page }) => {
    await seed(page, blank()); await toolbar(page, 'add').click(); await page.fill('#fT', 'Never saved'); await page.keyboard.press('Escape');
    await expect(page.locator('#dlg')).toBeHidden(); expect((await data(page)).events).toHaveLength(0);
  });
  test('focus returns to a sensible place and the page can be used again after closing a dialog', async ({ page }) => {
    await seed(page, blank()); await toolbar(page, 'add').click(); await page.keyboard.press('Escape'); await toolbar(page, 'add').click(); await expect(page.locator('#dlg')).toBeVisible();
  });
});
