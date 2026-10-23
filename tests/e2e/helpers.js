import { expect } from '@playwright/test';
import { moduleOrder } from '../helpers/modules.js';

export const PASSWORD = 'k7Qm9-xTa2L-wdR4n-Hy6Be-Zc8Vp';
export const sched = (o = {}) => ({ id: 's1', name: 'S1', color: '#3b6df0', opacity: 1, locked: false, visible: true, ...o });
export const ev = (o = {}) => ({ id: 'e1', title: 'Event', desc: '', color: '#3b6df0', schedules: ['s1'], involved: [], slots: [{ day: 0, start: 600, end: 660, person: '' }], ...o });
export const person = (o = {}) => ({ id: 'p1', name: 'Ann', color: '#f00000', visible: true, ...o });
export const blank = (o = {}) => ({ schedules: [sched()], people: [], events: [], rhythms: [], phases: [], phaseOpacity: 0.3, ...o });
export const slot = (day, start, end, person = '') => ({ day, start, end, person });

/** Opens the app with empty browser storage (optionally with prefs / a fixed clock) and waits until it is drawn.
 *  Both Fit boxes start off (48 px per hour, 110 px columns, so geometry is predictable and the grid scrolls);
 *  pass `defaults: true` to get the app's own zoom defaults (both on, R-GRID-07). */
export async function openApp(page, { prefs, clock, storage, defaults = false } = {}) {
  if (!defaults) prefs = { fitW: false, fitH: false, ...prefs };
  await bridge(page);
  if (clock) await page.clock.setFixedTime(clock);
  if (prefs || storage) await page.addInitScript(({ p, st }) => {
    if (sessionStorage.getItem('seeded')) return;   // seed only on the first load, so reloads keep what the app saved
    if (p) localStorage.setItem('weekly-schedules-prefs', JSON.stringify(p));
    for (const [k, v] of Object.entries(st || {})) localStorage.setItem(k, v);
    sessionStorage.setItem('seeded', '1');
  }, { p: prefs, st: storage });
  await page.goto('/');
  await expect(page.locator('.dh:not(.c)').first()).toBeVisible(); await bridged(page);
}

/** The test bridge (not part of the app). The app's ES modules keep their names to themselves, so on every load of the page (reloads too)
 *  this imports the same modules again, which gives the page's own instances, and puts each name they export on window, read live: then
 *  page.evaluate(() => openDlg(state.S.events[0])) works. Modules run before DOMContentLoaded, so they are complete by then. The addresses
 *  are absolute because WebKit resolves an init script's relative import against web-inspector://, not the page. */
export async function bridge(page) {
  if (page.__bridge) return; page.__bridge = true;
  await page.addInitScript(files => addEventListener('DOMContentLoaded', () => Promise.all(files.map(f => import(new URL(f, location.href).href))).then(ms => {
    for (const m of ms) for (const k of Object.keys(m)) Object.defineProperty(window, k, { get: () => m[k], configurable: true });
    window.__bridged = true;
  })), moduleOrder());
}
/** Waits until the bridge is in place after a load (openApp does this; call it after page.reload() before evaluating app names). */
export const bridged = page => page.waitForFunction(() => window.__bridged === true);

/** Replaces the current workspace's data with validated data and redraws. */
export const seed = async (page, data) => { await bridged(page); return page.evaluate(d => { const x = parseData(d); state.S = x; cw().data = x; render(); }, data); };
export const data = async page => { await bridged(page); return page.evaluate(() => JSON.parse(JSON.stringify(state.S))); };
export const slots = async (page, i = 0) => { await bridged(page); return page.evaluate(n => JSON.parse(JSON.stringify(state.S.events[n].slots)), i); };

/** Viewport coordinates of minute `min` in the n-th displayed day column (x = middle of the column). */
export async function pt(page, col, min) {
  return page.evaluate(([c, m]) => {
    const day = document.querySelectorAll('.day')[c], r = day.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + (m - hrA() * 60) / 60 * state.HH };
  }, [col, min]);
}

/** Lets the page read and write the real clipboard. Only Chromium knows these permissions; Firefox is allowed by prefs in
 *  playwright.config.js, and WebKit lets a page write the clipboard after a click without a grant. */
export const allowClipboard = (context, browserName, origin) =>
  browserName === 'chromium' ? context.grantPermissions(['clipboard-read', 'clipboard-write'], origin ? { origin } : {}) : Promise.resolve();

/** The text on the real clipboard. WebKit never lets a script read it, so there it is pasted into a scratch text area
 *  (inside the open dialog, if any: the rest of the page is inert behind a modal dialog). */
export async function readClipboard(page, browserName) {
  if (browserName !== 'webkit') return page.evaluate(() => navigator.clipboard.readText());
  await page.evaluate(() => { const t = document.createElement('textarea'); t.id = 'clipTest'; (document.querySelector('dialog[open]') || document.body).append(t); t.focus(); });
  await page.keyboard.press('ControlOrMeta+V');
  const text = await page.inputValue('#clipTest'); await page.evaluate(() => document.getElementById('clipTest').remove()); return text;
}

/** Real mouse drag between two (column, minute) positions. */
export async function drag(page, from, to, { shift = false, steps = 6, release = true } = {}) {
  const a = await pt(page, from.col, from.min), b = await pt(page, to.col, to.min);
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps });
  if (release) { await page.mouse.up(); if (shift) await page.keyboard.up('Shift'); }
}

/** Touch gesture through the browser's own input pipeline: down, optional hold, moves, up. */
export async function touch(page, points, { hold = 0 } = {}) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
  await send('touchStart', points[0]); if (hold) await page.waitForTimeout(hold);
  for (const p of points.slice(1)) { await send('touchMove', p); await page.waitForTimeout(40); }
  await page.waitForTimeout(120);   // a real finger rests for a moment before lifting
  await send('touchEnd');
}

/** A finger swipe (many small moves, like a real finger) that the browser turns into scrolling. dx/dy = finger movement. */
export async function swipe(page, from, dx, dy, steps = 12) {
  const points = [from]; for (let i = 1; i <= steps; i++) points.push({ x: from.x + dx * i / steps, y: from.y + dy * i / steps });
  await touch(page, points);
}

export const toolbar = (page, name) => page.locator(`.tbar button:nth-child(${{ add: 1, undo: 2, redo: 3, save: 4, load: 5, print: 6 }[name]})`);
export const dialogButton = (page, label) => page.locator('#xDlg button', { hasText: new RegExp(`^${label}$`) });
export const boxOf = async loc => { const b = await loc.boundingBox(); expect(b).not.toBeNull(); return b; };
