import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { openApp, seed, data, blank, ev, slot, sched, person, toolbar, dialogButton, allowClipboard, readClipboard, PASSWORD } from './helpers.js';

const rich = () => blank({ people: [person({ id: 'A', name: 'Granny Rose' })], schedules: [sched({ id: 's1', name: 'Care' })], events: [ev({ title: 'Doctor visit', desc: 'door code 4711', involved: ['A'], slots: [slot(1, 600, 660, 'A')] })] });
const BASE = 'http://localhost:4173';

async function startProtect(page, kind) {
  await toolbar(page, 'save').click(); await dialogButton(page, kind === 'link' ? 'Shareable link' : 'JSON file').click();
  await expect(page.locator('#xDlg input[type=text]')).toBeVisible();
}
async function makeLink(page, { anon = false } = {}) {
  await startProtect(page, 'link'); if (anon) await page.locator('#xDlg input[type=checkbox]').check();
  await page.locator('#xDlg input[type=text]').fill(PASSWORD); await dialogButton(page, 'Create link').click();
  const ta = page.locator('#xDlg textarea'); await expect(ta).toBeVisible({ timeout: 15000 }); return ta.inputValue();
}
async function saveFile(page, { anon = false } = {}) {
  await startProtect(page, 'file'); if (anon) await page.locator('#xDlg input[type=checkbox]').check();
  await page.locator('#xDlg input[type=text]').fill(PASSWORD);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), dialogButton(page, 'Save file').click()]);
  return dl;
}
async function visitor(browser) { const ctx = await browser.newContext({ locale: 'en-US' }); const page = await ctx.newPage(); return { ctx, page }; }

test.describe('R-SHARE-06 Encrypted JSON files, downloaded and opened for real', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); await seed(page, rich()); });
  test('Save → JSON file downloads weekly-schedules-<date>-encrypted.json without any readable data', async ({ page }) => {
    const dl = await saveFile(page); expect(dl.suggestedFilename()).toMatch(/^weekly-schedules-\d{4}-\d{2}-\d{2}-encrypted\.json$/);
    const text = fs.readFileSync(await dl.path(), 'utf8'); expect(JSON.parse(text)).toMatchObject({ format: 'weekly-schedules-encrypted', version: 1 }); expect(text).not.toMatch(/Granny|Doctor|4711|Care/);
  });
  test('the downloaded file opens in another browser profile with the password and imports every detail', async ({ page, browser }) => {
    const dl = await saveFile(page); const file = await dl.path(); const { ctx, page: other } = await visitor(browser);
    await openApp(other); await other.locator('#file').setInputFiles(file);
    await expect(other.locator('#xDlg h3')).toHaveText('Password needed'); await other.locator('#xDlg input[type=password]').fill(PASSWORD); await dialogButton(other, 'Open').click();
    await expect(other.locator('#xDlg h3')).toHaveText('Import'); await dialogButton(other, 'Import').click();
    const d = await data(other); expect(d.events[0]).toMatchObject({ title: 'Doctor visit', desc: 'door code 4711' }); expect(d.people[0].name).toBe('Granny Rose'); await ctx.close();
  });
  test('a wrong password is refused and the file can be opened with the right one afterwards', async ({ page, browser }) => {
    const file = await (await saveFile(page)).path(); const { ctx, page: other } = await visitor(browser); await openApp(other); await other.locator('#file').setInputFiles(file);
    await other.locator('#xDlg input[type=password]').fill('not the password'); await dialogButton(other, 'Open').click(); await expect(other.locator('#xDlg')).toContainText('Wrong password');
    await other.locator('#xDlg input[type=password]').fill(PASSWORD); await dialogButton(other, 'Open').click(); await expect(other.locator('#xDlg h3')).toHaveText('Import'); await ctx.close();
  });
  test('an anonymised file contains no names or descriptions when opened', async ({ page, browser }) => {
    const file = await (await saveFile(page, { anon: true })).path(); const { ctx, page: other } = await visitor(browser); await openApp(other); await other.locator('#file').setInputFiles(file);
    await other.locator('#xDlg input[type=password]').fill(PASSWORD); await dialogButton(other, 'Open').click(); await dialogButton(other, 'Import').click();
    const d = await data(other); expect(d.people[0].name).toBe('Person 1'); expect(d.events[0].desc).toBe(''); await ctx.close();
  });
});

test.describe('R-SHARE-08 A partial file, downloaded and opened for real', () => {
  test('a file with only the chosen schedule opens in another profile with only that schedule, its events and the people they use', async ({ page, browser }) => {
    await openApp(page); await seed(page, blank({ people: [person({ id: 'A', name: 'Ann' }), person({ id: 'B', name: 'Bob', color: '#00a000' })], schedules: [sched({ id: 's1', name: 'Home' }), sched({ id: 's2', name: 'Work', color: '#e5484d' })],
      events: [ev({ id: 'h', title: 'Dinner', schedules: ['s1'], slots: [slot(0, 1080, 1140, 'A')] }), ev({ id: 'w', title: 'Office', schedules: ['s2'], slots: [slot(0, 540, 1020, 'B')] })] }));
    await startProtect(page, 'file'); await page.locator('#xDlg .partsel button', { hasText: 'Choose…' }).click();
    await page.locator('#xDlg .partg label', { hasText: 'Work' }).locator('input').uncheck(); await expect(page.locator('#xDlg .partsum')).toContainText('1 of 2 events');
    await page.locator('#xDlg input[type=text]').fill(PASSWORD); const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), dialogButton(page, 'Save file').click()]);
    const { ctx, page: other } = await visitor(browser); await openApp(other); await other.locator('#file').setInputFiles(await dl.path());
    await other.locator('#xDlg input[type=password]').fill(PASSWORD); await dialogButton(other, 'Open').click(); await dialogButton(other, 'Import').click();
    const d = await data(other); expect(d.schedules.map(s => s.name)).toEqual(['Home']); expect(d.events.map(e => e.title)).toEqual(['Dinner']); expect(d.people.map(q => q.name)).toEqual(['Ann']); await ctx.close();
  });
});

test.describe('R-SHARE-05 Shareable links, opened in a second browser profile', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); await seed(page, rich()); });
  test('the link has the data only in the part after #, and shows the password that was set', async ({ page }) => {
    const link = await makeLink(page); expect(link).toMatch(/^http:\/\/localhost:4173\/#data=e1\.[A-Za-z0-9_-]+$/); await expect(page.locator('#xDlg p b')).toHaveText(PASSWORD);
  });
  test('a first-time visitor opens the link, enters the password and sees the shared schedule', async ({ page, browser }) => {
    const link = await makeLink(page); const { ctx, page: other } = await visitor(browser); await other.goto(link);
    await expect(other.locator('#xDlg h3')).toHaveText('Password needed'); await other.locator('#xDlg input[type=password]').fill(PASSWORD); await dialogButton(other, 'Open').click();
    await expect(other.locator('#toast')).toHaveText('Shared schedule loaded'); expect((await data(other)).events[0].title).toBe('Doctor visit'); await expect(other.locator('.day[data-d="1"] .ev')).toHaveCount(1); await ctx.close();
  });
  test('a wrong password asks again; cancelling loads nothing; in both cases the address bar ends up clean', async ({ page, browser }) => {
    const link = await makeLink(page); const { ctx, page: other } = await visitor(browser); await other.goto(link);
    await other.locator('#xDlg input[type=password]').fill('wrong wrong wrong'); await dialogButton(other, 'Open').click(); await expect(other.locator('#xDlg')).toContainText('Wrong password');
    await dialogButton(other, 'Cancel').click(); await expect(other).toHaveURL(BASE + '/'); expect((await data(other)).events).toHaveLength(0); await ctx.close();
  });
  test('after the right password the data is removed from the address bar and from history', async ({ page, browser }) => {
    const link = await makeLink(page); const { ctx, page: other } = await visitor(browser); await other.goto(link); await other.locator('#xDlg input[type=password]').fill(PASSWORD); await dialogButton(other, 'Open').click();
    await expect(other.locator('#toast')).toHaveText('Shared schedule loaded'); expect(other.url()).toBe(BASE + '/'); await ctx.close();
  });
  test('a visitor who already has saved data gets the import choices instead of an overwrite', async ({ page, browser }) => {
    const link = await makeLink(page); const { ctx, page: other } = await visitor(browser); await openApp(other); await other.evaluate(() => saveMem('all'));
    await other.goto(link); await other.locator('#xDlg input[type=password]').fill(PASSWORD); await dialogButton(other, 'Open').click(); await expect(other.locator('#xDlg h3')).toHaveText('Import'); await ctx.close();
  });
  test('a damaged link is refused with a message and cleaned from the address bar', async ({ browser }) => {
    const { ctx, page: other } = await visitor(browser); await other.goto(BASE + '/#data=e1.@@@@'); await expect(other.locator('#toast')).toHaveText('The shared link is invalid or damaged.'); expect(other.url()).toBe(BASE + '/'); await ctx.close();
  });
  test('pasting a link into an already open page (hash change) asks for the password too', async ({ page, browser }) => {
    const link = await makeLink(page); const { ctx, page: other } = await visitor(browser); await openApp(other); await other.evaluate(h => { location.hash = h; }, link.slice(link.indexOf('#'))); await expect(other.locator('#xDlg h3')).toHaveText('Password needed'); await ctx.close();
  });
  test('"Copy link" and "Copy password" really put the text on the clipboard', async ({ page, context, browserName }) => {
    await allowClipboard(context, browserName, BASE); const link = await makeLink(page);
    await dialogButton(page, 'Copy link').click(); expect(await readClipboard(page, browserName)).toBe(link);
    await dialogButton(page, 'Copy password').click(); expect(await readClipboard(page, browserName)).toBe(PASSWORD);
  });
});

test.describe('R-DATA-03 Browser memory across real page reloads', () => {
  test('saved work is still there after a reload, and unsaved work is not', async ({ page }) => {
    await openApp(page); await seed(page, rich()); await toolbar(page, 'save').click(); await dialogButton(page, 'Browser memory').click(); await expect(page.locator('#toast')).toHaveText('Saved to browser memory');
    await page.evaluate(() => { state.S.events[0].title = 'Edited but not saved'; }); await page.evaluate(() => { window.onbeforeunload = null; });
    page.once('dialog', d => d.accept()); await page.reload(); await expect(page.locator('.dh:not(.c)').first()).toBeVisible();
    expect((await data(page)).events[0].title).toBe('Doctor visit');
  });
  test('the app starts on the workspace that was current when it was last saved', async ({ page }) => {
    await openApp(page); await page.evaluate(() => { window.prompt = () => 'Second one'; addWorkspace(); saveMem('all'); });
    page.once('dialog', d => d.accept()); await page.reload(); await expect(page.locator('.wsbtn .wsn')).toContainText('Second one');
  });
});

test.describe('R-DATA-05 Leaving the page, clearing and failing storage', () => {
  // (Headless Chromium never shows the real leave-page dialog, so these fire the real beforeunload event and look at whether the page asks for the warning.)
  const asksToStay = page => page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  test('with unsaved changes the page asks the browser for its leave-page warning', async ({ page }) => {
    await openApp(page); await seed(page, rich()); expect(await asksToStay(page)).toBe(true);
  });
  test('after saving to browser memory the page no longer asks', async ({ page }) => {
    await openApp(page); await seed(page, rich()); expect(await asksToStay(page)).toBe(true);
    await toolbar(page, 'save').click(); await dialogButton(page, 'Browser memory').click(); expect(await asksToStay(page)).toBe(false);
  });
  test('closing the tab when everything is saved never shows a dialog', async ({ page }) => {
    await openApp(page); await page.locator('.sbtop .ttl').click(); const types = []; page.on('dialog', d => { types.push(d.type()); d.dismiss(); });
    await page.close({ runBeforeUnload: true }); expect(types).toEqual([]);
  });
  test('Clear memory (after confirmation) wipes the saved data and restarts with the default workspace', async ({ page }) => {
    await openApp(page); await seed(page, rich()); await page.evaluate(() => saveMem('all')); await page.locator('.sbtop .gear').click(); page.once('dialog', d => d.accept());
    await page.locator('#xDlg .stabs button', { hasText: 'Data' }).click(); await dialogButton(page, 'Clear memory').click(); await expect(page.locator('#toast')).toContainText('restarted');
    expect(await page.evaluate(() => localStorage.getItem('weekly-schedules-workspaces'))).toBeNull(); expect((await data(page)).events).toHaveLength(0);
  });
  test('when the browser refuses to store more data, the user is told instead of nothing happening', async ({ page }) => {
    await openApp(page); await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); }; });
    await toolbar(page, 'save').click(); await dialogButton(page, 'Browser memory').click(); await expect(page.locator('#toast')).toContainText('Browser memory is not available');
  });
});

test.describe('R-SHARE-07 Unencrypted JSON files, downloaded and opened for real', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); await seed(page, rich()); });
  test('choosing Unencrypted shows the warning, hides the password and downloads readable weekly-schedules-<date>.json', async ({ page }) => {
    await startProtect(page, 'file'); await page.locator('#xDlg .encsel button', { hasText: 'Unencrypted' }).click();
    await expect(page.locator('#xDlg .plainwarn')).toBeVisible(); await expect(page.locator('#xDlg input[type=text]')).toBeHidden();
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), dialogButton(page, 'Save file').click()]);
    expect(dl.suggestedFilename()).toMatch(/^weekly-schedules-\d{4}-\d{2}-\d{2}\.json$/);
    const w = JSON.parse(fs.readFileSync(await dl.path(), 'utf8')); expect(w.people[0].name).toBe('Granny Rose'); expect(w.events[0].desc).toBe('door code 4711');
  });
  test('the unencrypted file opens in another browser profile without a password and imports every detail', async ({ page, browser }) => {
    await startProtect(page, 'file'); await page.locator('#xDlg .encsel button', { hasText: 'Unencrypted' }).click();
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), dialogButton(page, 'Save file').click()]);
    const { ctx, page: other } = await visitor(browser); await openApp(other); await other.locator('#file').setInputFiles(await dl.path());
    await expect(other.locator('#xDlg h3')).toHaveText('Import'); await dialogButton(other, 'Import').click();
    const d = await data(other); expect(d.events[0].title).toBe('Doctor visit'); expect(d.people[0].name).toBe('Granny Rose'); await ctx.close();
  });
});

test.describe('R-STAT-04 Statistics exports in a real browser', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); await seed(page, rich()); await page.locator('.tbar button').nth(6).click(); });
  test('"Download CSV" really downloads weekly-schedules-stats-<date>.csv with the person and the hours', async ({ page }) => {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), dialogButton(page, 'Download CSV').click()]);
    expect(dl.suggestedFilename()).toMatch(/^weekly-schedules-stats-\d{4}-\d{2}-\d{2}\.csv$/);
    const text = fs.readFileSync(await dl.path(), 'utf8'); expect(text.charCodeAt(0)).toBe(0xfeff); expect(text).toContain('Granny Rose,No type,1.00');
  });
  test('"Copy table" really puts the table on the clipboard', async ({ page, context, browserName }) => {
    await allowClipboard(context, browserName); await dialogButton(page, 'Copy table').click();
    await expect(page.locator('#xDlg .ststat')).toContainText('Table copied'); expect(await readClipboard(page, browserName)).toContain('Granny Rose\tNo type\t1.00');
  });
});

test.describe('R-DATA-08 Sample files of every published format open in a real browser', () => {
  const FIX = new URL('../fixtures/', import.meta.url).pathname;
  const versions = fs.readdirSync(FIX).filter(n => /^v\d+$/.test(n));
  for (const v of versions) {
    const read = f => fs.readFileSync(FIX + v + '/' + f, 'utf8');
    test(`the ${v} link (encrypted outside the browser) opens with its password in Chromium`, async ({ browser }) => {
      const { householdAt, FIXTURE_PASSWORD } = await import('../fixtures/household.js');
      const link = read('link.txt').trim(), { ctx, page } = await visitor(browser); await page.goto(BASE + '/' + link.slice(link.indexOf('#')));
      await page.locator('#xDlg input[type=password]').fill(FIXTURE_PASSWORD); await dialogButton(page, 'Open').click();
      await expect(page.locator('#toast')).toHaveText('Shared schedule loaded'); expect(await data(page)).toMatchObject(householdAt(+v.slice(1))); await ctx.close();
    });
    test(`the ${v} browser memory loads after a real page load with both workspaces`, async ({ page }) => {
      await openApp(page, { storage: { 'weekly-schedules-workspaces': read('store.json') } });
      await expect(page.locator('.wsbtn .wsn')).toContainText('Family week'); expect(await page.evaluate(() => state.WS.map(w => w.name))).toEqual(['Family week', 'Grandparents']);
    });
  }
});
