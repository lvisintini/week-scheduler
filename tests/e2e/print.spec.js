import { test, expect } from '@playwright/test';
import { openApp, seed, blank, ev, slot, person, toolbar } from './helpers.js';

const rich = () => blank({ people: [person({ id: 'A', name: 'Ann' })], events: [ev({ title: 'Standup', slots: [slot(0, 600, 660, 'A'), slot(2, 600, 660, 'A')] })], rhythms: [{ id: 'r', name: 'R', visible: true }], phases: [{ id: 'p', title: 'Lunch', desc: '', color: '#2fa66a', rhythms: ['r'], slots: [0, 1, 2, 3, 4].map(d => ({ day: d, start: 720, end: 780 })) }] });
const pdfInfo = buf => {
  const text = buf.toString('latin1'); const m = text.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/); const pages = text.match(/\/Count\s+(\d+)/);
  return { header: text.slice(0, 5), width: m ? Number(m[1]) : 0, height: m ? Number(m[2]) : 0, pages: pages ? Number(pages[1]) : 0, size: buf.length };
};
test.beforeEach(async ({ page }) => { await openApp(page); await seed(page, rich()); await page.evaluate(() => { window.print = () => {}; }); });

test.describe('R-PRN-02 Print schedule in print media', () => {
  test('only the print area is visible: the sidebar, grid and buttons are hidden', async ({ page }) => {
    await page.evaluate(() => printSchedule()); await page.emulateMedia({ media: 'print' });
    const r = await page.evaluate(() => ({ visible: [...document.body.children].filter(e => e.tagName !== 'SCRIPT' && e.id !== 'pr' && getComputedStyle(e).display !== 'none').map(e => e.tagName + '#' + e.id), pr: getComputedStyle(document.getElementById('pr')).display }));
    expect(r.visible).toEqual([]); expect(r.pr).toBe('block');
  });
  test('the print area holds a titled page with the visible schedules, people and the whole week', async ({ page }) => {
    await page.evaluate(() => printSchedule());
    await expect(page.locator('#pr h1')).toHaveText('Weekly schedule'); await expect(page.locator('#pr .pm')).toContainText('S1'); await expect(page.locator('#pr .pm')).toContainText('Ann'); await expect(page.locator('#pr .dh:not(.c)')).toHaveCount(7); await expect(page.locator('#pr .ev')).toHaveCount(2);
  });
  test('the PDF is one A4 portrait page with content', async ({ page }) => {
    await page.evaluate(() => printSchedule()); await page.emulateMedia({ media: 'print' }); const info = pdfInfo(await page.pdf({ preferCSSPageSize: true }));
    expect(info.header).toBe('%PDF-'); expect(info.width).toBeGreaterThan(593); expect(info.width).toBeLessThan(597); expect(info.height).toBeGreaterThan(840); expect(info.height).toBeLessThan(844); expect(info.pages).toBe(1); expect(info.size).toBeGreaterThan(8000);
  });
  test('printing ignores the zoom settings: the printed grid has the default scale', async ({ page }) => {
    const measure = async () => { await page.evaluate(() => printSchedule()); await page.emulateMedia({ media: 'print' }); const r = await page.evaluate(() => { const l = document.querySelectorAll('#pr .times span'); return { gap: l[2].getBoundingClientRect().top - l[1].getBoundingClientRect().top, w: document.querySelector('#pr .grid').getBoundingClientRect().width }; }); await page.emulateMedia({ media: 'screen' }); return r; };
    const normal = await measure(); await page.evaluate(() => { state.prefs.rowH = 110; state.prefs.colW = 250; render(); }); const zoomed = await measure();
    expect(zoomed.gap).toBeCloseTo(normal.gap, 1); expect(zoomed.w).toBeCloseTo(normal.w, 0);
  });
  test('the printed grid shows the hours shown, cut at the end like the screen', async ({ page }) => {
    await seed(page, blank({ events: [ev({ slots: [slot(0, 960, 1200)] })] })); await page.evaluate(() => { state.prefs.hours[state.curId] = [8, 17]; render(); printSchedule(); }); await page.emulateMedia({ media: 'print' });
    const r = await page.evaluate(() => { const c = document.querySelector('#pr .day').getBoundingClientRect(), b = document.querySelector('#pr .day[data-d="0"] .ev').getBoundingClientRect(); return { labels: [...document.querySelectorAll('#pr .times span')].map(x => x.textContent), h: c.height, cut: b.bottom - c.bottom }; });
    expect(r.labels[0]).toBe('08:00'); expect(r.labels.at(-1)).toBe('16:00'); expect(r.cut).toBeLessThanOrEqual(0.5);
  });
  test('the screen is left exactly as it was: zoom restored and the print area emptied afterwards', async ({ page }) => {
    await page.evaluate(() => { state.prefs.rowH = 110; render(); }); await page.evaluate(() => { printSchedule(); window.onafterprint(); });
    expect(await page.evaluate(() => state.HH)).toBe(110); await expect(page.locator('#pr > *')).toHaveCount(0);
  });
  test('colours are printed exactly (backgrounds are not dropped by the browser)', async ({ page }) => {
    await page.evaluate(() => printSchedule()); await page.emulateMedia({ media: 'print' });
    const v = await page.evaluate(() => { const cs = getComputedStyle(document.querySelector('#pr .ev')); return cs.getPropertyValue('print-color-adjust') || cs.getPropertyValue('-webkit-print-color-adjust'); }); expect(v).toBe('exact');
  });
  test('even in dark mode the paper is white with dark text', async ({ page }) => {
    await page.evaluate(() => { state.prefs.theme = 'dark'; applyTheme(); printSchedule(); }); await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
    const r = await page.evaluate(() => { const cs = getComputedStyle(document.getElementById('pr')); return { bg: cs.backgroundColor, fg: cs.color }; }); expect(r.bg).toBe('rgb(255, 255, 255)'); expect(r.fg).toBe('rgb(17, 17, 17)');
  });
  test('hidden early hours and the hidden weekend stay hidden on paper', async ({ page }) => {
    await page.evaluate(() => { state.prefs.days[state.curId] = [0, 4]; render(); printSchedule(); }); await expect(page.locator('#pr .dh:not(.c)')).toHaveCount(5); await expect(page.locator('#pr .times span').first()).toHaveText('05:00');
  });
});

test.describe('R-PRN-01 Day agenda printing', () => {
  test('the agenda dialog prints the list as a portrait A4 PDF', async ({ page }) => {
    await page.locator('.dh:not(.c)').first().click(); await expect(page.locator('#agBody h1')).toHaveText('Monday — agenda'); await page.locator('#agPrint').click();
    await expect(page.locator('#pr .ai')).toHaveCount(1); await page.emulateMedia({ media: 'print' }); const info = pdfInfo(await page.pdf({ preferCSSPageSize: true }));
    expect(info.header).toBe('%PDF-'); expect(info.height).toBeGreaterThan(info.width); expect(info.pages).toBe(1);
  });
});

test.describe('R-PRN-03 Print day view', () => {
  test('prints one day column with its phase labels, on one A4 page', async ({ page }) => {
    await page.locator('.dh:not(.c)').nth(1).click(); await page.locator('#agPrint2').click();
    await expect(page.locator('#pr h1')).toHaveText('Tuesday'); await expect(page.locator('#pr .dh:not(.c)')).toHaveCount(1); await expect(page.locator('#pr .lane .lip span')).toHaveText('Lunch');
    await page.emulateMedia({ media: 'print' }); const info = pdfInfo(await page.pdf({ preferCSSPageSize: true })); expect(info.pages).toBe(1); expect(info.height).toBeGreaterThan(info.width);
  });
  test('the single column uses the page width instead of a narrow strip', async ({ page }) => {
    await page.locator('.dh:not(.c)').nth(1).click(); await page.locator('#agPrint2').click(); await page.emulateMedia({ media: 'print' });
    const w = await page.evaluate(() => ({ grid: document.querySelector('#pr .grid').getBoundingClientRect().width, day: document.querySelector('#pr .day').getBoundingClientRect().width })); expect(w.day).toBeGreaterThan(w.grid * 0.7);
  });
});

test.describe('R-CYC-12 Printing every week of the cycle', () => {
  const two = () => blank({ cycle: 2, events: [ev({ id: 'a', title: 'Week one only', weeks: [1] }), ev({ id: 'b', title: 'Week two only', weeks: [2], slots: [slot(3, 1200, 1260)] })] });
  test.beforeEach(async ({ page }) => { await seed(page, two()); });
  test('Print every week gives one A4 page per week of the cycle', async ({ page }) => {
    await toolbar(page, 'print').click(); await page.locator('.omenu .oi', { hasText: 'Print every week' }).click();
    await expect(page.locator('#pr h1')).toHaveText(['Weekly schedule — Week 1', 'Weekly schedule — Week 2']);
    await page.emulateMedia({ media: 'print' }); expect(pdfInfo(await page.pdf({ preferCSSPageSize: true })).pages).toBe(2);
  });
  test('Print this week gives one page of the week shown', async ({ page }) => {
    await page.evaluate(() => setWeek(2)); await toolbar(page, 'print').click(); await page.locator('.omenu .oi', { hasText: 'Print this week' }).click();
    await expect(page.locator('#pr h1')).toHaveText('Weekly schedule — Week 2'); await page.emulateMedia({ media: 'print' }); expect(pdfInfo(await page.pdf({ preferCSSPageSize: true })).pages).toBe(1);
  });
  test('the week switcher is never printed', async ({ page }) => {
    await page.evaluate(() => printSchedule()); await page.emulateMedia({ media: 'print' }); expect(await page.locator('#pr .wkb').evaluate(e => getComputedStyle(e).display)).toBe('none');
  });
});

test.describe('R-CYC-17 A coloured week in print', () => {
  test('the printed title names the week and has a band in its colour, printed exactly, and the grid keeps the band under its headers', async ({ page }) => {
    await seed(page, blank({ cycle: 2, weekInfo: [{}, { name: "At Dad's", color: '#8e4ec6' }], events: [ev()] }));
    await page.evaluate(() => { state.curWk = 2; render(); printSchedule(); }); await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#pr h1')).toHaveText("Weekly schedule — Week 2 · At Dad's");
    const s = await page.locator('#pr h1').evaluate(h => { const c = getComputedStyle(h); return [c.borderBottomWidth, c.borderBottomColor, c.printColorAdjust || c.webkitPrintColorAdjust]; });
    expect(s).toEqual(['4px', 'rgb(142, 78, 198)', 'exact']);
    expect(await page.locator('#pr .dh').first().evaluate(h => getComputedStyle(h).boxShadow)).toContain('rgb(142, 78, 198)');
  });
});
