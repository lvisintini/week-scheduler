// Test harness: opens index.html in jsdom with the browser features the app needs stubbed
// (dialogs, Web Crypto, downloads, clipboard, printing) and a fake layout so drags can be simulated.
import { JSDOM, VirtualConsole } from 'jsdom';
import { webcrypto } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '../..');
export const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const WS_KEY = 'weekly-schedules-workspaces';
export const PREFS_KEY = 'weekly-schedules-prefs';
export const PASSWORD = 'k7Qm9-xTa2L-wdR4n-Hy6Be-Zc8Vp';   // a valid (>= 20 characters) test password

/** Opens the app. Options: url, storage (localStorage seed), languages, promptAnswer, confirmAnswer, compression, crypto. */
export function openApp(opts = {}) {
  const { url = 'https://app.test/', storage = {}, languages = ['en-US'], promptAnswer = 'x', confirmAnswer = true, compression = true, crypto = true } = opts;
  const log = { errors: [], alerts: [], prompts: [], confirms: [] };
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => log.errors.push(String(e.message)));
  const dom = new JSDOM(html, {
    url, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      Object.defineProperty(w.navigator, 'languages', { value: languages, configurable: true });
      w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
      w.confirm = m => { log.confirms.push(m); return typeof confirmAnswer === 'function' ? confirmAnswer(m) : confirmAnswer; };
      w.prompt = (m, d) => { log.prompts.push([m, d]); return typeof promptAnswer === 'function' ? promptAnswer(m, d) : promptAnswer; };
      w.alert = m => { log.alerts.push(m); };
      w.print = () => { w.__printed = w.document.getElementById('pr').innerHTML; w.__printCount = (w.__printCount || 0) + 1; };
      w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.Response = Response;
      if (compression) { w.CompressionStream = CompressionStream; w.DecompressionStream = DecompressionStream; }
      if (crypto) Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });
      w.Blob = class { constructor(p) { this.text = p.join(''); } };
      w.URL.createObjectURL = b => { w.__file = b.text; return 'blob:test'; };
      w.URL.revokeObjectURL = () => {};
      w.HTMLAnchorElement.prototype.click = function () { w.__download = this.download; };
      Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async t => { w.__clip = t; } }, configurable: true });
      Object.entries(storage).forEach(([k, v]) => w.localStorage.setItem(k, v));
      // fake geometry: day column i occupies x in [100i, 100i+100), top = 0
      w.Element.prototype.getBoundingClientRect = function () {
        if (this.classList && this.classList.contains('day')) {
          const i = [...w.document.querySelectorAll('.day')].indexOf(this), h = parseFloat(this.style.height) || 0;
          return { left: i * 100, right: i * 100 + 100, top: 0, bottom: h, width: 100, height: h, x: i * 100, y: 0 };
        }
        return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };
      };
    },
  });
  const w = dom.window, d = w.document;
  const api = {
    w, d, log, dom,
    ev: code => w.eval(code),
    q: s => d.querySelector(s),
    qa: s => [...d.querySelectorAll(s)],
    sleep,
    /** text of the generic dialog */
    dlgText: () => d.getElementById('xDlg').textContent,
    dlgOpen: () => d.getElementById('xDlg').open,
    dlgTitle: () => (d.querySelector('#xDlg h3') || { textContent: '' }).textContent,
    /** buttons currently in the generic dialog */
    dlgButtons: () => [...d.querySelectorAll('#xDlg button')].map(b => b.textContent.trim()),
    /** click a button of the generic dialog by its exact label */
    click(label) {
      const b = [...d.querySelectorAll('#xDlg button')].find(x => x.textContent.trim() === label);
      if (!b) throw new Error(`No dialog button "${label}" (have: ${api.dlgButtons().join(' | ')})`);
      b.click();
    },
    toast: () => d.getElementById('toast').textContent,
    /** sidebar toolbar buttons: add undo redo save load print */
    toolbar(name) {
      const i = { add: 1, undo: 2, redo: 3, save: 4, load: 5, print: 6 }[name];
      return d.querySelector(`.tbar button:nth-child(${i})`);
    },
    /** keyboard shortcut on the document */
    key(key, o = {}) { d.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...o })); },
    /** y coordinate (px) of a minute-of-day inside a day column */
    y: min => w.eval(`(${min}-vs()*60)/60*HH`),
    /** x coordinate of the middle of the n-th displayed day column */
    x: n => n * 100 + 50,
    /** open the Save dialog and choose a target by its label */
    chooseSave(label) { api.toolbar('save').click(); api.click(label); },
    storage: () => Object.fromEntries(Object.keys(w.localStorage).map(k => [k, w.localStorage.getItem(k)])),
  };
  return api;
}

/** Dispatch a pointer-like event on the document. */
export function pointer(app, type, { x = 0, y = 0, shift = false, pointerType = 'mouse', buttons = 0 } = {}) {
  const e = new app.w.MouseEvent(type, { clientX: x, clientY: y, shiftKey: shift, bubbles: true, buttons });
  Object.defineProperty(e, 'pointerType', { value: pointerType });
  app.d.dispatchEvent(e);
}

/**
 * Simulates a mouse drag that starts on `el` (an event box, phase box or handle) and ends elsewhere.
 * `from` / `to` are { col: displayed column index, min: minute of day }.
 */
export async function dragFrom(app, el, from, to, { shift = false, pointerType = 'mouse', hold = 0, target = null, move = true } = {}) {
  const fromXY = { x: app.x(from.col), y: app.y(from.min) }, toXY = { x: app.x(to.col), y: app.y(to.min) };
  el.onpointerdown({ clientX: fromXY.x, clientY: fromXY.y, button: 0, target: target || el, pointerType, shiftKey: shift, stopPropagation() {}, preventDefault() {} });
  if (hold) await sleep(hold);
  if (move) pointer(app, 'pointermove', { ...toXY, shift, pointerType });
  pointer(app, 'pointerup', { ...toXY, shift, pointerType });
}

/** A small, valid workspace record for imports / files / links. */
export function workspace(overrides = {}) {
  return {
    version: 1, id: 'ws-test', name: 'Test workspace',
    schedules: [{ id: 's1', name: 'Team', color: '#e5484d', opacity: 1, locked: false, visible: true }],
    people: [{ id: 'p1', name: 'Ann', color: '#f00000', visible: true }],
    events: [{ id: 'e1', title: 'Standup', desc: 'Daily sync', color: '#e5484d', schedules: ['s1'], involved: ['p1'], slots: [{ day: 0, start: 600, end: 660, person: 'p1' }] }],
    rhythms: [{ id: 'r1', name: 'Normal', visible: true }],
    phases: [{ id: 'ph1', title: 'Lunch', desc: '', color: '#3b6df0', rhythms: ['r1'], slots: [{ day: 0, start: 720, end: 780 }] }],
    phaseOpacity: 0.3,
    ...overrides,
  };
}

/** Replaces the current workspace's data (no dialogs) – used to set up scenarios. */
export function setData(app, data) {
  app.ev(`(()=>{const d=parseData(${JSON.stringify(data)});S=d;cw().data=d;render()})()`);
}

export const ev1 = (o = {}) => ({ id: 'e1', title: 'Event', desc: '', color: '#3b6df0', schedules: ['s1'], involved: [], slots: [{ day: 0, start: 600, end: 660, person: '' }], ...o });
export const sched = (o = {}) => ({ id: 's1', name: 'S1', color: '#3b6df0', opacity: 1, locked: false, visible: true, ...o });
export const person = (o = {}) => ({ id: 'p1', name: 'Ann', color: '#f00000', visible: true, ...o });
/** Data with a single schedule 's1' and no phases or rhythms, plus the given parts. */
export const blank = (o = {}) => ({ schedules: [sched()], people: [], events: [], rhythms: [], phases: [], phaseOpacity: 0.3, ...o });

/** Drag on empty space of a day column to create an event (the column element receives the pointer-down). */
export async function createDrag(app, from, to, opts = {}) {
  const col = app.qa('.day')[from.col];
  await dragFrom(app, col, from, to, { ...opts, target: col });
}

/** Fill the (already open) event dialog. days: { 0: {start,end,person}, 2: {...} } replaces the ticked Quick rows. */
export function fillDialog(app, f = {}) {
  const set = (sel, v) => { app.q(sel).value = v; app.q(sel).dispatchEvent(new app.w.Event('change')); };
  const fire = (el, v) => { el.value = v; el.dispatchEvent(new app.w.Event('change')); };
  if (f.title !== undefined) app.q('#fT').value = f.title;
  if (f.desc !== undefined) app.q('#fD').value = f.desc;
  if (f.person !== undefined) set('#fOw', f.person);   // the owner: every day "Performed by: Owner" follows it (R-EVT-20)
  if (f.involved) app.qa('#fInv input').forEach(i => { i.checked = f.involved.includes(i.value); });
  if (f.schedules) app.qa('#fSch input').forEach(i => { i.checked = f.schedules.includes(i.value); });
  if (f.days) app.qa('#fDays .dr').forEach((row, i) => {
    const cb = row.querySelector('input'), sel = row.querySelectorAll('select'), d = f.days[i];   // selects: start, end, performed by, timing, margins
    cb.checked = !!d; cb.dispatchEvent(new app.w.Event('change'));
    if (d && d.start !== undefined) fire(sel[0], d.start);
    if (d && d.end !== undefined) fire(sel[1], d.end);
    if (d && d.person !== undefined) fire(sel[2], d.person);
  });
  // there are no event-level times any more: start/end are set on every ticked day (Quick) or block (Advanced)
  const tick = () => [...app.qa('#fDays .dr').filter(r => r.querySelector('input').checked), ...app.qa('#fBlocks .br')].filter(r => r.offsetParent !== undefined);
  if (f.start !== undefined) tick().forEach(r => { const s = r.querySelectorAll('select'), k = r.classList.contains('br') ? 1 : 0; fire(s[k], f.start); });
  if (f.end !== undefined) tick().forEach(r => { const s = r.querySelectorAll('select'), k = r.classList.contains('br') ? 2 : 1; fire(s[k], f.end); });
}
export const dlgOpen = app => app.d.getElementById('dlg').open;
