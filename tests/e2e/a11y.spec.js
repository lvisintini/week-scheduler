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
  test('R-DATA-11 the passphrase dialogs (protect, the Data tab while protected, unlock) have no serious accessibility violation', async ({ page }) => {
    await openApp(page); await seed(page, blank({ people: [person()], events: [ev()] })); await page.evaluate(() => saveMem('all'));
    const data = async () => { await page.evaluate(() => openSettings()); await page.locator('#xDlg .stabs button', { hasText: 'Data' }).click(); };
    await data(); await page.locator('#xDlg button', { hasText: 'Passphrase…' }).click(); ratchet(await scan(page), {});
    const [p1, p2] = await page.locator('#xDlg .pwl input').all(); await p1.fill('correct horse battery'); await p2.fill('correct horse battery'); await page.locator('#xDlg button', { hasText: 'Protect' }).click();
    await expect(page.locator('#toast')).toHaveText('Browser memory is now protected'); await data(); ratchet(await scan(page), {});
    await page.reload(); await expect(page.locator('#xDlg h3')).toHaveText('Browser memory is protected'); ratchet(await scan(page), {});
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
  for (const tab of ['View', 'Data', 'UI', 'About']) {
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
  for (const theme of ['light', 'dark']) {
    test(`R-STAT-05 R-STAT-06 R-STAT-07 R-CYC-18 the statistics with labelled bars, a percent unit, a type filter, named weeks and rota turns add no accessibility violation (${theme} theme)`, async ({ page }) => {
      const types = [{ id: 'ts', name: 'Sleep', color: '#3f51b5', icon: 'moon' }, { id: 'tw', name: 'Work', color: '#f2c94c', icon: 'work' }];
      await openApp(page, { prefs: { theme } }); await seed(page, blank({ cycle: 2, weekInfo: [{ name: 'At home' }, { name: "At Dad's", desc: 'From Friday', color: '#8e4ec6' }], people: [person(), person({ id: 'p2', name: 'Bob', color: '#0060c0' })], types,
        events: [ev({ id: 'r', title: 'Cook', slots: [{ day: 0, start: 1080, end: 1140, person: 'p1', wk: 1 }, { day: 0, start: 1080, end: 1140, person: 'p2', wk: 2 }] }), ev({ id: 's', type: 'ts', slots: [0, 1, 2, 3, 4, 5, 6].map(day => ({ day, start: 0, end: 480, person: 'p1' })) }), ev({ id: 'w', type: 'tw', weeks: [1], slots: [0, 1, 2, 3, 4].map(day => ({ day, start: 540, end: 1020, person: 'p1' })) })] }));
      await page.locator('.tbar button').nth(6).click(); await expect(page.locator('#xDlg .stwk b').first()).toBeVisible();
      let r = await new AxeBuilder({ page }).include('#xDlg').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.map(v => v.id)).toEqual([]);
      await page.locator('#xDlg .stu button', { hasText: '% of planned' }).click(); await page.locator('#xDlg .sttyb').click(); await page.locator('.typop .oi', { hasText: 'Work' }).click();
      r = await new AxeBuilder({ page }).include('.typop').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.map(v => v.id)).toEqual([]); await page.keyboard.press('Escape');
      r = await new AxeBuilder({ page }).include('#xDlg').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.map(v => v.id)).toEqual([]);
      await page.locator('#xDlg select').first().selectOption('*'); r = await new AxeBuilder({ page }).include('#xDlg').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.map(v => v.id)).toEqual([]);
      await page.locator('#xDlg .tuadd').click(); await expect(page.locator('.tupop')).toBeVisible(); r = await new AxeBuilder({ page }).include('.tupop').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.map(v => v.id)).toEqual([]);
    });
  }
  test('R-STAT-06 the labels of the 168-hour bar are drawn at their normal size, inside their part', async ({ page }) => {
    await openApp(page); await seed(page, blank({ people: [person()], events: [ev({ slots: [0, 1, 2, 3, 4, 5, 6].map(day => ({ day, start: 0, end: 480, person: 'p1' })) })] }));
    await page.locator('.tbar button').nth(6).click();
    const m = await page.evaluate(() => [...document.querySelectorAll('#xDlg .stwk > span')].filter(s => s.querySelector('b')).map(s => { const a = s.getBoundingClientRect(), b = s.querySelector('b').getBoundingClientRect(); return { h: b.height, inside: b.left >= a.left - 0.5 && b.right <= a.right + 0.5, fs: getComputedStyle(s).fontSize }; }));
    expect(m.length).toBe(2); for (const x of m) { expect(x.inside).toBe(true); expect(x.h).toBeLessThan(18); expect(x.fs).toBe('11px'); }
  });
  for (const theme of ['light', 'dark']) {
    test(`R-PRN-04 the day agenda with phase headings adds no accessibility violation (${theme} theme)`, async ({ page }) => {
      const ph = (id, title, start, end, color) => ({ id, title, desc: '', color, rhythms: ['r'], slots: [{ day: 0, start, end }] });
      await openApp(page, { prefs: { theme } }); await seed(page, blank({ rhythms: [{ id: 'r', name: 'Normal', visible: true }], phases: [ph('a', 'Morning', 480, 720, '#f2c94c'), ph('b', 'Noon', 720, 840, '#1d2330'), ph('c', 'Evening', 1080, 1260, '#3b6df0')],
        events: [ev({ title: 'Standup', slots: [{ day: 0, start: 540, end: 555, person: '' }] }), ev({ id: 'e2', title: 'Late', slots: [{ day: 0, start: 1300, end: 1330, person: '' }] })] }));
      await page.evaluate(() => openAgenda(0)); await expect(page.locator('#agBody .aph').first()).toBeVisible();
      const r = await new AxeBuilder({ page }).include("#agDlg").withTags(["wcag2a", "wcag2aa"]).analyze(); expect(r.violations.flatMap(v => v.nodes.map(n => v.id + " " + n.target + " " + n.failureSummary))).toEqual([]);
    });
  }
  test('R-CYC-16 the phase dialog with its Weeks row and a week for every time adds no accessibility violation', async ({ page }) => {
    await openApp(page); await seed(page, blank({ cycle: 2, weekInfo: [{}, { name: 'Nights', color: '#8e4ec6' }], rhythms: [{ id: 'r', name: 'Shifts', visible: true }],
      phases: [{ id: 'p', title: 'Shift', desc: '', color: '#a1662f', rhythms: ['r'], slots: [{ day: 0, start: 360, end: 840, wk: 1 }, { day: 0, start: 1260, end: 1440, wk: 2 }] }, { id: 'q', title: 'Quiet', desc: '', color: '#607d8b', rhythms: ['r'], weeks: [2], slots: [{ day: 0, start: 480, end: 720 }] }] }));
    await page.evaluate(() => { setWeek(2); openDlg(S.phases[0]); }); await expect(page.locator('#fWk')).toBeVisible();
    let r = await new AxeBuilder({ page }).include('#dlg').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.map(v => v.id)).toEqual([]);
    await page.evaluate(() => { document.getElementById('dlg').close(); openDlg(S.phases[1]); }); await expect(page.locator('#fWk .chips')).toBeVisible();
    r = await new AxeBuilder({ page }).include('#dlg').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.map(v => v.id)).toEqual([]);
  });
  test('R-CYC-19 every week of the cycle side by side adds no serious accessibility violation', async ({ page }) => {
    await openApp(page); await seed(page, blank({ cycle: 2, weekInfo: [{}, { name: 'Nights', color: '#8e4ec6' }], events: [ev({ title: 'Standup', weeks: [2] })] }));
    await page.evaluate(() => setAllWk(true)); await expect(page.locator('#grid .day')).toHaveCount(14);
    ratchet(await scan(page), {});
  });
  for (const theme of ['light', 'dark']) {
    test(`R-SHARE-08 the save dialog with What to include and its Choose… lists adds no accessibility violation (${theme} theme)`, async ({ page }) => {
      await openApp(page, { prefs: { theme } }); await seed(page, blank({ people: [person()], rhythms: [{ id: 'r', name: 'R', visible: true }], events: [ev({ title: 'Standup' })] }));
      await toolbar(page, 'save').click(); await page.locator('#xDlg .btns button', { hasText: 'JSON file' }).click(); await page.locator('#xDlg .partsel button', { hasText: 'Choose…' }).click();
      await expect(page.locator('#xDlg .partl')).toBeVisible(); const r = await new AxeBuilder({ page }).include('#xDlg').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.flatMap(v => v.nodes.map(n => v.id + ' ' + n.target))).toEqual([]);
    });
  }
  test('R-DATA-04 the copy dialog with a workspace choice adds no accessibility violation', async ({ page }) => {
    await openApp(page); await seed(page, blank({ events: [ev({ title: 'Dishes' })] })); await page.evaluate(() => { WS.push(newWs('Work', defaultData(), true)); openCopy(S.events[0]); });
    await page.locator('#xDlg select').first().selectOption({ label: 'Work' }); const r = await new AxeBuilder({ page }).include('#xDlg').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.flatMap(v => v.nodes.map(n => v.id + ' ' + n.target))).toEqual([]);
  });
  test('R-DATA-04 the dialog that copies people to another workspace adds no accessibility violation', async ({ page }) => {
    await openApp(page); await seed(page, blank({ people: [person(), person({ id: 'p2', name: 'Bob', color: '#0060c0', external: true })] })); await page.evaluate(() => { WS.push(newWs('Work', defaultData(), true)); openPeopleCopy(S.people[0]); });
    await expect(page.locator('#xDlg .pcl')).toBeVisible(); const r = await new AxeBuilder({ page }).include('#xDlg').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.flatMap(v => v.nodes.map(n => v.id + ' ' + n.target))).toEqual([]);
  });
  for (const theme of ['light', 'dark']) {
    test(`R-DATA-10 the Workspaces dialog, and the workspace menu with colours and descriptions, add no accessibility violation (${theme} theme)`, async ({ page }) => {
      await openApp(page, { prefs: { theme } }); await seed(page, blank({ events: [ev()] }));
      await page.evaluate(() => { S.color = '#2fa66a'; S.desc = 'Our routine'; WS.push(newWs('Work', defaultData(), true)); render(); });
      await page.locator('.wsbtn').click(); let r = await new AxeBuilder({ page }).include('.omenu').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.flatMap(v => v.nodes.map(n => v.id + ' ' + n.target))).toEqual([]);
      await page.locator('.omenu .oi', { hasText: 'Workspaces…' }).click(); await expect(page.locator('#xDlg .wsr')).toHaveCount(2);
      r = await new AxeBuilder({ page }).include('#xDlg').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.flatMap(v => v.nodes.map(n => v.id + ' ' + n.target))).toEqual([]);
    });
  }
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
    await page.evaluate(() => openCycle()); await dlg(); await page.locator('#xDlg .cyrow select').selectOption('1'); await page.locator('#xDlg button', { hasText: 'Apply' }).click(); await expect(page.locator('#xDlg li')).toHaveCount(1); await dlg();
    await page.locator('#xDlg button', { hasText: 'Cancel' }).click(); await page.locator('#lvB').click(); await expect(page.locator('#xDlg h3')).toHaveText('Which week is it?'); await dlg();
  });
  test('R-CYC-21 R-CYC-23 the cycle dialog with staged weeks, the delete-week question and the delete-event question add no accessibility violation', async ({ page }) => {
    await openApp(page); await seed(page, blank({ cycle: 2, pool: 3, weekInfo: [{}, {}, { name: 'Exams', color: '#e8912d' }], events: [ev({ weeks: [1, 3] })] }));
    const dlg = async () => { const r = await new AxeBuilder({ page }).include('#xDlg').withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.map(v => v.id)).toEqual([]); };
    await page.evaluate(() => openCycle()); await expect(page.locator('#xDlg .cystg')).toBeVisible(); await dlg();
    await page.locator('#xDlg .cydel').click(); await page.locator('#xDlg button', { hasText: 'Apply' }).click(); await expect(page.locator('#xDlg li')).toHaveCount(1); await dlg();
    await page.locator('#xDlg button', { hasText: 'Cancel' }).click(); await page.evaluate(() => openDlg(S.events[0])); ratchet(await scan(page), {});
    await page.locator('#fDel').click(); await expect(page.locator('#xDlg .btns.stack')).toBeVisible(); await dlg();
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
