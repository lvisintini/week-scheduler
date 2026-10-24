// Takes the pictures of How to use (R-UI-17) from the Examples workspace (R-DATA-12), in English and Spanish, into img/help/<language>/<name>.png.
// Run with `npm run shots`; the sizes in HELP (js/model.js) must then match the files (tests/unit/help-images.test.js checks them).
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bridge, bridged } from '../e2e/helpers.js';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../img/help');
// wide columns and fixed rows, so the boxes have room for their text; descriptions only where they are the point (R-EVT-25)
const prefs = { theme: 'light', collapsed: true, fitW: false, fitH: false, colW: 240, rowH: 56, nowLine: false };
async function open(page, lang, o = {}) {
  await bridge(page);
  await page.addInitScript(p => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('weekly-schedules-prefs', JSON.stringify(p)); sessionStorage.setItem('seeded', '1'); } }, { ...prefs, ...o });
  await page.goto('/'); await bridged(page);
  await page.evaluate(l => { setLang(l); openExamples(); state.prefs.desc[state.curId] = false; render(); renderSide(); }, lang);
  await expect(page.locator('.ev').first()).toBeVisible();
}
const desc = (page, on) => page.evaluate(v => { state.prefs.desc[state.curId] = v; render(); }, on);
// the part of the grid from day d0 to day d1 (with the phase lane of d0 when lane is set), from minute m0 to minute m1
const gridClip = (page, d0, d1, m0, m1, lane = false) => page.evaluate(([d0, d1, m0, m1, lane]) => {
  const a = document.querySelector(`.day[data-d="${d0}"]`).getBoundingClientRect(), b = document.querySelector(`.day[data-d="${d1}"]`).getBoundingClientRect();
  const l = lane ? document.querySelectorAll('.lane')[d0].getBoundingClientRect().left : a.left, y = m => a.top + (m - hrA() * 60) / 60 * state.HH;
  return { x: Math.round(l) - 2, y: Math.round(y(m0)) - 2, width: Math.round(b.right - l) + 4, height: Math.round(y(m1) - y(m0)) + 4 };
}, [d0, d1, m0, m1, lane]);
// the event dialog from section k0 (0 Who, 1 When) down to How it fits in (section 2)
const dlgClip = (page, k0) => page.evaluate(k => {
  const d = document.getElementById('dlg').getBoundingClientRect(), s = document.querySelectorAll('#dlg .fsec'), t = s[k].getBoundingClientRect(), b = s[2].getBoundingClientRect();
  return { x: Math.round(d.left), y: Math.round(t.top) - 10, width: Math.round(d.width), height: Math.round(b.top - t.top) };
}, k0);
const shot = async (page, lang, name, clip) => { await page.mouse.move(0, 0); await page.screenshot({ path: `${OUT}/${lang}/${name}.png`, clip }); };
const evt = (page, id) => page.evaluate(i => { openDlg(state.S.events.find(e => e.id === i)); }, id);
const locale = lang => lang === 'en' ? 'en-US' : 'es-ES';

for (const lang of ['en', 'es']) {
  test.describe(`R-UI-17 The pictures of How to use, in ${lang === 'en' ? 'English' : 'Spanish'}`, () => {
    test.use({ locale: locale(lang) });
    test('the week pictures: overlaps, activity types and rhythms', async ({ page }) => {
      await open(page, lang); await page.evaluate(() => { state.prefs.colW = 300; render(); });
      await shot(page, lang, 'ov', await gridClip(page, 0, 2, 15 * 60 + 45, 21 * 60));
      await page.evaluate(() => { state.prefs.colBy = 't'; state.prefs.colW = 130; render(); }); await shot(page, lang, 'ty', await gridClip(page, 0, 6, 7 * 60, 21 * 60));
      await page.evaluate(() => { state.prefs.colBy = ''; state.prefs.colW = 240; state.editMode = 'phases'; render(); renderSide(); }); await shot(page, lang, 'rh', await gridClip(page, 0, 2, 7 * 60, 14 * 60, true));
    });
    test('the day pictures: boxes with descriptions, flexible times, Away and a task done along the way', async ({ page }) => {
      await page.setViewportSize({ width: 780, height: 1100 }); await open(page, lang, { fitW: true });
      // shop: the eye of the Shop schedule (view state), closed where the shop's shift would only take room
      const day = async (d, name, m0, m1, { on = false, shop = true } = {}) => { await page.evaluate(([x, v, sh]) => { state.prefs.desc[state.curId] = v; state.S.schedules[1].visible = sh; setFocus(x); }, [d, on, shop]); await shot(page, lang, name, await gridClip(page, d, d, m0, m1)); };
      await day(0, 'edit', 8 * 60, 15 * 60 + 15, { on: true });
      await day(0, 'flex', 14 * 60 + 45, 18 * 60 + 5, { shop: false });
      await day(5, 'bg', 9 * 60 + 45, 12 * 60 + 15, { shop: false });
    });
    test('the dialog pictures: an event\'s times, an owner with a stand-in, and the Save choices', async ({ page }) => {
      await open(page, lang);
      await evt(page, 'exSchool'); await shot(page, lang, 'rep', await dlgClip(page, 1)); await page.locator('#fCancel').click();
      await evt(page, 'exRun'); await shot(page, lang, 'ppl', await dlgClip(page, 0)); await page.locator('#fCancel').click();
      await page.evaluate(() => { state.prefs.collapsed = false; applyPrefs(); renderSide(); }); await page.locator('.tbar button:nth-child(4)').click();
      await page.locator('#xDlg').screenshot({ path: `${OUT}/${lang}/save.png` });
    });
    test('the phone picture: Monday afternoon in the day view, with its descriptions', async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 700 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true, locale: locale(lang), colorScheme: 'light' });
      const page = await ctx.newPage(); await open(page, lang, { colW: 110, rowH: 100 }); await desc(page, true); await page.evaluate(() => { setFocus(0); });
      await page.evaluate(() => { document.getElementById('wrap').scrollTop = (16.75 - hrA()) * state.HH; }); await page.waitForTimeout(200);
      await page.screenshot({ path: `${OUT}/${lang}/look.png` }); await ctx.close();
    });
  });
}
