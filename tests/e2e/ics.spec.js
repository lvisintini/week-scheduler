import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { openApp, seed, blank, ev, slot, person, toolbar, dialogButton } from './helpers.js';

// R-SHARE-09: the calendar file, downloaded for real and read back
const CLOCK = new Date(2026, 9, 21, 10, 0);   // Wednesday 21 October 2026, local time
const family = () => blank({ cycle: 2, people: [person({ id: 'A', name: 'Ann' })], events: [
  ev({ title: 'School run', slots: [0, 1, 2, 3, 4].map(d => slot(d, 450, 510, 'A')) }),
  ev({ id: 'e2', title: 'Swimming', weeks: [2], slots: [slot(0, 1020, 1080, 'A')] }),
  ev({ id: 'e3', title: 'Night shift', slots: [slot(6, 1320, 1560, 'A')] }),
  ev({ id: 'e4', title: 'Quiet hours', bg: true, slots: [slot(2, 1260, 1380)] }),
] });
async function openIcsDialog(page) {
  await toolbar(page, 'save').click(); await page.locator('#xDlg button', { hasText: 'Calendar file (export only)' }).click();
  await expect(page.locator('#xDlg h3')).toHaveText('Which week is it?'); await page.locator('#xDlg select').selectOption('1'); await dialogButton(page, 'Continue').click();
  await expect(page.locator('#xDlg h3')).toHaveText('Calendar file');
}
const vevents = text => text.replace(/\r\n /g, '').split('BEGIN:VEVENT').slice(1).map(b => Object.fromEntries(b.split('\r\n').filter(l => /^[A-Z-]+[:;]/.test(l)).map(l => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1)])));

test.describe('R-SHARE-09 The calendar file, downloaded and read back', () => {
  test.beforeEach(async ({ page }) => { await openApp(page, { clock: CLOCK }); await seed(page, family()); });
  test('Calendar file downloads weekly-schedules-<date>.ics with weekly series from From, in this week of the cycle', async ({ page }) => {
    await openIcsDialog(page); await expect(page.locator('#xDlg .icswk')).toHaveText('The From date is in Week 1.');
    await page.locator('#xDlg input[type=date]').nth(1).fill('2026-12-18');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), dialogButton(page, 'Download').click()]);
    expect(dl.suggestedFilename()).toMatch(/^weekly-schedules-\d{4}-\d{2}-\d{2}\.ics$/);
    const text = fs.readFileSync(await dl.path(), 'utf8'); expect(text.split('\r\n').every(l => Buffer.byteLength(l) <= 75)).toBe(true);
    const [run, swim, night] = vevents(text); expect(vevents(text)).toHaveLength(3); expect(text).not.toContain('Quiet hours');
    expect(run).toMatchObject({ SUMMARY: 'School run · Ann', DTSTART: '20261021T073000', RRULE: 'FREQ=WEEKLY;WKST=MO;BYDAY=MO,TU,WE,TH,FR;UNTIL=20261218T235959' });
    expect(swim).toMatchObject({ DTSTART: '20261026T170000', RRULE: 'FREQ=WEEKLY;WKST=MO;INTERVAL=2;BYDAY=MO;UNTIL=20261218T235959' });
    expect([night.DTSTART, night.DTEND]).toEqual(['20261025T220000', '20261026T020000']);
    await expect(page.locator('#toast')).toContainText('Calendar file downloaded');
  });
  test('after a reload, the next export remembers this one and starts the day after its Until', async ({ page }) => {
    await page.evaluate(() => saveMem('all')); await openIcsDialog(page); await page.locator('#xDlg input[type=date]').nth(1).fill('2026-12-18');
    await Promise.all([page.waitForEvent('download', { timeout: 15000 }), dialogButton(page, 'Download').click()]);
    await page.reload(); await expect(page.locator('.dh:not(.c)').first()).toBeVisible();
    await toolbar(page, 'save').click(); await page.locator('#xDlg button', { hasText: 'Calendar file (export only)' }).click();
    await expect(page.locator('#xDlg .icslast')).toContainText('Last export from this browser: Oct 21, 2026 – Dec 18, 2026.'); await expect(page.locator('#xDlg input[type=date]').first()).toHaveValue('2026-12-19');
  });
  for (const theme of ['light', 'dark']) {
    test(`the calendar dialog, with its Choose… lists, adds no accessibility violation (${theme} theme)`, async ({ page }) => {
      await page.evaluate(t => { prefs.theme = t; applyTheme(); }, theme); await openIcsDialog(page); await page.locator('#xDlg .partsel button', { hasText: 'Choose…' }).click();
      const r = await new AxeBuilder({ page }).include('#xDlg').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.flatMap(v => v.nodes.map(n => v.id + ' ' + n.target))).toEqual([]);
    });
  }
  test('R-UI-14 on a phone the calendar dialog fills the screen and keeps Download in view', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 }); await openIcsDialog(page);
    const d = await page.locator('#xDlg').boundingBox(); expect(d.x).toBeGreaterThanOrEqual(0); expect(d.x + d.width).toBeLessThanOrEqual(393 + 0.5);
    await expect(page.locator('#xDlg button', { hasText: 'Download' })).toBeInViewport(); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(393);
  });
});
