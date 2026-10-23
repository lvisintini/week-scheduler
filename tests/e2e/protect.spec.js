import { test, expect } from '@playwright/test';
import { openApp, seed, blank, ev, person } from './helpers.js';

const PASS = 'correct horse battery';
const settingsData = async page => { await page.evaluate(() => openSettings()); await page.locator('#xDlg .stabs button', { hasText: 'Data' }).click(); };
async function protect(page) {
  await openApp(page); await seed(page, blank({ people: [person({ name: 'Granny Rose' })], events: [ev({ title: 'Doctor visit', desc: 'door code 4711' })] }));
  await page.evaluate(() => saveMem('all')); await settingsData(page); await page.locator('#xDlg button', { hasText: 'Passphrase…' }).click();
  const [p1, p2] = await page.locator('#xDlg .pwl input').all(); await p1.fill(PASS); await p2.fill(PASS); await page.locator('#xDlg button', { hasText: 'Protect' }).click();
  await expect(page.locator('#toast')).toHaveText('Browser memory is now protected');
}

test.describe('R-DATA-11 Browser memory protected with a passphrase, in a real browser', () => {
  test('after a reload the page asks for the passphrase, Escape keeps it, and the right one brings everything back', async ({ page }) => {
    await protect(page); const raw = await page.evaluate(() => localStorage.getItem('weekly-schedules-workspaces')); expect(raw).toMatch(/"sealed"/); expect(raw).not.toMatch(/Granny|Doctor|4711/);
    await page.reload(); await expect(page.locator('#xDlg h3')).toHaveText('Browser memory is protected'); expect(await page.evaluate(() => state.S.events.length)).toBe(0);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await expect(page.locator('#xDlg')).toBeVisible(); await expect(page.locator('#xDlg h3')).toHaveText('Browser memory is protected');
    await page.locator('#xDlg .pwl input').fill('not the passphrase'); await page.keyboard.press('Enter'); await expect(page.locator('#xDlg .err')).toHaveText('Wrong passphrase. Try again.');
    await page.locator('#xDlg .pwl input').fill(PASS); await page.locator('#xDlg button', { hasText: 'Open' }).click();
    await expect(page.locator('#xDlg')).toBeHidden(); await expect(page.locator('.ev', { hasText: 'Doctor visit' })).toBeVisible();
    expect(await page.evaluate(() => anyDirty())).toBe(false);
  });
  test('saving while open keeps browser memory encrypted, and Lock now hides the data again', async ({ page }) => {
    await protect(page); await page.evaluate(() => { hist(); state.S.events[0].title = 'Dentist visit'; render(); }); await page.evaluate(() => saveMem('all'));
    await expect(page.locator('#toast')).toHaveText('Saved to browser memory'); expect(await page.evaluate(() => localStorage.getItem('weekly-schedules-workspaces'))).not.toMatch(/Dentist/);
    await settingsData(page); await page.locator('#xDlg button', { hasText: 'Lock now' }).click();
    await expect(page.locator('#xDlg h3')).toHaveText('Browser memory is protected'); await expect(page.locator('.ev')).toHaveCount(0);
    await page.locator('#xDlg .pwl input').fill(PASS); await page.keyboard.press('Enter'); await expect(page.locator('.ev', { hasText: 'Dentist visit' })).toBeVisible();
  });
  test('R-UI-14 on a phone the unlock dialog fits the screen with its field and buttons in view', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 }); await protect(page); await page.reload();
    const d = await page.locator('#xDlg').boundingBox(); expect(d.x).toBeGreaterThanOrEqual(0); expect(d.x + d.width).toBeLessThanOrEqual(393 + 0.5);
    await expect(page.locator('#xDlg .pwl input')).toBeInViewport(); await expect(page.locator('#xDlg button', { hasText: 'Open' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(393);
  });
});
