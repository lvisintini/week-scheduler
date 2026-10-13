import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openApp, seed, blank, ev, person, toolbar } from './helpers.js';

// KNOWN ISSUES (found by the first scan, see CLAUDE.md §14): these tests are a ratchet. They fail if a *new* kind of violation appears or
// an existing kind spreads to more elements; when an issue is fixed, lower its number here (to 0 and then delete the entry).
// Impacts below are the "serious" and "critical" ones from axe-core (WCAG 2 A/AA).
const scan = async page => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return Object.fromEntries(r.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => [v.id, v.nodes.length]));
};
const ratchet = (found, known) => {
  const newKinds = Object.keys(found).filter(k => !(k in known)); expect(newKinds, 'new kinds of accessibility violation').toEqual([]);
  for (const [k, n] of Object.entries(found)) expect(n, `${k}: more elements than the ${known[k]} known`).toBeLessThanOrEqual(known[k]);
};

test.describe('R-UI-03 Automated accessibility scan (ratchet against the known issues)', () => {
  test('the main screen shows no accessibility violation beyond the known ones: low-contrast hour labels, unlabeled rename fields, a scroll area that cannot take keyboard focus', async ({ page }) => {
    await openApp(page); await seed(page, blank({ people: [person()], events: [ev({ title: 'Standup' })] }));
    ratchet(await scan(page), { 'color-contrast': 19, label: 2, 'scrollable-region-focusable': 1 });
  });
  test('the event dialog shows no accessibility violation beyond the known ones: unlabeled fields, selects and colour button', async ({ page }) => {
    await openApp(page); await seed(page, blank({ people: [person()] })); await toolbar(page, 'add').click();
    ratchet(await scan(page), { 'button-name': 1, label: 2, 'select-name': 24 });
  });
  for (const tab of ['View', 'Data', 'UI']) {
    test(`the ${tab} tab of the settings dialog has no serious accessibility violation`, async ({ page }) => {
      await openApp(page); await page.locator('.sbtop .gear').click(); await page.locator('#xDlg .stabs button', { hasText: tab }).click();
      ratchet(await scan(page), {});
    });
  }
  test('the Zoom section of the sidebar adds no unlabeled controls (sliders have names)', async ({ page }) => {
    await openApp(page); await seed(page, blank());
    const r = await new AxeBuilder({ page }).include('.zsec').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.map(v => v.id)).toEqual([]);
  });
  test('the Activity types section and its icon grid add no accessibility violation (named fields and icon buttons)', async ({ page }) => {
    await openApp(page); await page.locator('.tysec .sch .pick').first().click();
    let r = await new AxeBuilder({ page }).include('.tysec').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.map(v => v.id)).toEqual([]);
    r = await new AxeBuilder({ page }).include('.omenu').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.map(v => v.id)).toEqual([]);
  });
  test('the statistics dialog (one person and Everyone) adds no accessibility violation', async ({ page }) => {
    await openApp(page); await seed(page, blank({ people: [person()], events: [ev({ title: 'Standup', slots: [{ day: 0, start: 600, end: 660, person: 'p1' }] })] })); await page.locator('.tbar button').nth(6).click();
    let r = await new AxeBuilder({ page }).include('#xDlg').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.map(v => v.id)).toEqual([]);
    await page.locator('#xDlg select').selectOption('*'); r = await new AxeBuilder({ page }).include('#xDlg').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.map(v => v.id)).toEqual([]);
  });
  test('the dark theme shows no accessibility violation beyond the known ones: contrast of the selected switch button', async ({ page }) => {
    await openApp(page, { prefs: { theme: 'dark' } }); await seed(page, blank({ events: [ev()] }));
    ratchet(await scan(page), { 'color-contrast': 1, label: 1, 'scrollable-region-focusable': 1 });
  });
  test('the page has a language, a title and landmark structure that screen readers can use', async ({ page }) => {
    await openApp(page); const r = await page.evaluate(() => ({ lang: document.documentElement.lang, title: document.title, main: document.querySelectorAll('main').length }));
    expect(r.lang).toBe('en'); expect(r.title).toBe('Weekly Schedules'); expect(r.main).toBe(1);
  });
  test('events are announced to assistive technology with their title, time, people and schedule (aria-label)', async ({ page }) => {
    await openApp(page); await seed(page, blank({ people: [person({ id: 'A', name: 'Ann' })], events: [ev({ title: 'Standup', slots: [{ day: 0, start: 600, end: 660, person: 'A' }] })] }));
    const label = await page.locator('.ev').first().getAttribute('aria-label'); expect(label).toContain('Standup'); expect(label).toContain('10:00');
  });
});
