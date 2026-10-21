import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openApp, seed, blank, ev, person, toolbar } from './helpers.js';

// KNOWN ISSUES (found by the first scan, see docs/known-issues.md): these tests are a ratchet. They fail if a *new* kind of violation appears or
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
  test('the main screen shows no serious accessibility violation (names, contrast, a grid reachable by keyboard)', async ({ page }) => {
    await openApp(page); await seed(page, blank({ people: [person()], events: [ev({ title: 'Standup' })] }));
    ratchet(await scan(page), {});
  });
  test('the event dialog has no serious accessibility violation (every field, day-row select and the colour button has a name)', async ({ page }) => {
    await openApp(page); await seed(page, blank({ people: [person()] })); await toolbar(page, 'add').click();
    ratchet(await scan(page), {});
  });
  test('R-UI-13 on a phone the day view with its floating buttons, and the open drawer, add no serious accessibility violation', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 }); await openApp(page, { prefs: { collapsed: true } }); await seed(page, blank({ people: [person()], events: [ev()] }));
    await expect(page.locator('#lvR')).toBeVisible(); ratchet(await scan(page), {});
    await page.locator('.sbtop .xpand').click(); await expect(page.locator('#sb')).not.toHaveClass(/collapsed/); ratchet(await scan(page), {});
  });
  test('R-UI-07 on a phone the folded and open day cards, the Add a time menu, and the floating Live View controls add no serious accessibility violation', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 }); await openApp(page, { prefs: { collapsed: true } }); await seed(page, blank({ people: [person()], events: [ev({ slots: [{ day: 0, start: 600, end: 660, person: '' }, { day: 2, start: 600, end: 660, person: '' }] })] }));
    await page.evaluate(() => openDlg(S.events[0])); await page.locator('.dtabs button', { hasText: 'When' }).click(); ratchet(await scan(page), {});
    await page.locator('#fDays .dr').first().locator('.sum').click(); ratchet(await scan(page), {}); await page.locator('#fAddT').click(); ratchet(await scan(page), {});
    await page.keyboard.press('Escape'); await page.locator('#fCancel').click(); await page.locator('#lvR').click(); ratchet(await scan(page), {});
  });
  test('R-UI-14 on a phone each tab of the full-screen event dialog has no serious accessibility violation', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 }); await openApp(page); await seed(page, blank({ people: [person()], events: [ev()] }));
    await page.evaluate(() => openDlg(S.events[0])); await expect(page.locator('.dtabs')).toBeVisible();
    for (const tab of ['Event', 'When', 'More']) { await page.locator('.dtabs button', { hasText: tab }).click(); ratchet(await scan(page), {}); }
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
  test('the dark theme shows no serious accessibility violation either', async ({ page }) => {
    await openApp(page, { prefs: { theme: 'dark' } }); await seed(page, blank({ events: [ev()] }));
    ratchet(await scan(page), {});
  });
  for (const theme of ['light', 'dark']) {
    test(`the first-run workspace (default rhythm with coloured lips) in the ${theme} theme adds no contrast violation`, async ({ page }) => {
      await openApp(page, { prefs: { theme } }); await expect(page.locator('.lip').first()).toBeVisible();
      ratchet(await scan(page), {});
    });
  }
  test('R-CYC-04 a workspace with a cycle of weeks (the corner week switcher and its menu) adds no serious accessibility violation', async ({ page }) => {
    await openApp(page); await seed(page, blank({ cycle: 3, events: [ev({ weeks: [1] })] })); ratchet(await scan(page), {});
    await page.locator('.wkb').click(); const r = await new AxeBuilder({ page }).include('.omenu').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.map(v => v.id)).toEqual([]);
  });
  test('R-CYC-17 the Weeks in the cycle dialog with its week rows, and the week menu with coloured weeks, add no serious accessibility violation', async ({ page }) => {
    await openApp(page); await seed(page, blank({ cycle: 2, weekInfo: [{ name: 'Home', color: '#2fa66a' }, { name: "At Dad's", desc: 'From Friday', color: '#f5c518' }], events: [ev()] }));
    await page.evaluate(() => setWeek(2)); ratchet(await scan(page), {});
    await page.locator('.wkb').click(); let r = await new AxeBuilder({ page }).include('.omenu').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.map(v => v.id)).toEqual([]);
    await page.keyboard.press('Escape'); await page.evaluate(() => openCycle()); r = await new AxeBuilder({ page }).include('#xDlg').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.map(v => v.id)).toEqual([]);
  });
  test('R-CYC-08 R-EVT-24 the event dialog with its Weeks row, the week of every time and Drawn as adds no serious accessibility violation', async ({ page }) => {
    await openApp(page); await seed(page, blank({ cycle: 2, people: [person()], events: [ev({ slots: [{ day: 0, start: 600, end: 660, person: 'p1', wk: 1 }, { day: 0, start: 600, end: 660, person: '', wk: 2 }] })] }));
    await page.evaluate(() => openDlg(S.events[0])); ratchet(await scan(page), {});
    page.once('dialog', d => d.accept()); await page.locator('#fPw').uncheck(); await expect(page.locator('#fWk .chips')).toBeVisible(); ratchet(await scan(page), {});   // the weeks differ: the switch back asks first
  });
  test('R-CYC-10 R-CYC-05 the cycle dialog, the shrinking question and Live View\'s week question add no accessibility violation', async ({ page }) => {
    await openApp(page); await seed(page, blank({ cycle: 3, events: [ev({ weeks: [3] })] }));
    const dlg = async () => { const r = await new AxeBuilder({ page }).include('#xDlg').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.map(v => v.id)).toEqual([]); };
    await page.evaluate(() => openCycle()); await dlg(); await page.locator('#xDlg select').selectOption('1'); await page.locator('#xDlg button', { hasText: 'Apply' }).click(); await expect(page.locator('#xDlg li')).toHaveCount(1); await dlg();
    await page.locator('#xDlg button', { hasText: 'Cancel' }).click(); await page.locator('#lvB').click(); await expect(page.locator('#xDlg h3')).toHaveText('Which week is it?'); await dlg();
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
