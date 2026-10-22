// R-DATA-11: browser memory protected with a passphrase (encrypted in localStorage, asked when the page opens).
import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, sched, ev1, person, WS_KEY, PREFS_KEY } from '../helpers/app.js';

const PASS = 'correct horse battery';
const data = () => blank({ people: [person({ id: 'A', name: 'Granny Rose' })], schedules: [sched({ name: 'Care' })], events: [ev1({ title: 'Doctor visit', desc: 'door code 4711', slots: [{ day: 0, start: 600, end: 660, person: 'A' }] })] });
async function waitFor(fn, ms = 15000) { const t0 = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timed out waiting'); await new Promise(r => setTimeout(r, 25)); } }
const fresh = (o = {}) => { const a = openApp(o); setData(a, data()); a.ev('cw().name="Family"'); return a; };
const stored = a => JSON.parse(a.storage()[WS_KEY]);
const settingsData = a => { a.ev('openSettings()'); [...a.d.querySelectorAll('#xDlg .stabs button')].find(b => b.textContent === 'Data').click(); };
const settingsBtn = async (a, label) => { settingsData(a); a.click(label); await a.sleep(5); };
const fill = (a, values) => { const ins = a.qa('#xDlg input[type=password], #xDlg input[type=text]').filter(i => i.closest('.pwl')); values.forEach((v, i) => { ins[i].value = v; }); return ins; };
const err = a => a.q('#xDlg .err').textContent;
// protect browser memory with PASS: saved first, so there is something to protect
async function protect(a, pw = PASS) {
  a.ev("saveMem('all')"); await settingsBtn(a, 'Passphrase…'); expect(a.dlgTitle()).toBe('Protect browser memory'); fill(a, [pw, pw]); a.click('Protect');
  await waitFor(() => a.toast() === 'Browser memory is now protected');
}
const reopen = a => openApp({ storage: a.storage() });
async function unlock(a, pw = PASS) { a.q('#xDlg .pwl input').value = pw; a.click('Open'); }
const opened = async a => { await waitFor(() => !a.dlgOpen() && a.ev('S.events.length') === 1); };

describe('R-DATA-11 Protecting browser memory with a passphrase encrypts what is stored', { timeout: 30000 }, () => {
  it('Settings → Data offers "Passphrase…" with a tooltip line, and the dialog asks twice, warns and can suggest one', async () => {
    const a = fresh(); settingsData(a); expect(a.dlgText()).toContain('Protect browser memory with a passphrase'); a.click('Passphrase…'); await a.sleep(5);
    expect(a.qa('#xDlg .pwl')).toHaveLength(2); expect(a.dlgText()).toContain('A forgotten passphrase cannot be recovered'); expect(a.dlgButtons()).toEqual(['Suggest one', 'Protect', 'Cancel']); expect(a.dlgText()).toContain('Show passphrase');
    a.click('Suggest one'); const [p1, p2] = a.qa('#xDlg .pwl input'); expect(p1.value).toMatch(/^([A-Za-z0-9]{5}-){4}[A-Za-z0-9]{5}$/); expect(p2.value).toBe(p1.value); expect(p1.type).toBe('text');
  });
  it('the stored value becomes {version, sealed} and holds no names, titles or descriptions', async () => {
    const a = fresh(); await protect(a); const raw = a.storage()[WS_KEY], st = JSON.parse(raw);
    expect(Object.keys(st).sort()).toEqual(['sealed', 'version']); expect(st.version).toBe(a.ev('FMT')); expect(raw).not.toMatch(/Granny|Doctor|4711|Care|Family/);
  });
  it('a passphrase shorter than 8 characters, or two that differ, is refused with a message and nothing is stored', async () => {
    const a = fresh(); a.ev("saveMem('all')"); const before = a.storage()[WS_KEY]; await settingsBtn(a, 'Passphrase…');
    fill(a, ['short', 'short']); a.click('Protect'); expect(err(a)).toBe('The passphrase needs at least 8 characters.');
    fill(a, ['long enough one', 'long enough two']); a.click('Protect'); expect(err(a)).toBe('The two passphrases are different.');
    await a.sleep(50); expect(a.storage()[WS_KEY]).toBe(before); expect(a.ev('memKey')).toBe(null);
  });
  it('with nothing saved yet, protecting stores an empty protected memory, so the protection is kept', async () => {
    const a = fresh(); await settingsBtn(a, 'Passphrase…'); fill(a, [PASS, PASS]); a.click('Protect'); await waitFor(() => a.toast() === 'Browser memory is now protected');
    expect(Object.keys(stored(a)).sort()).toEqual(['sealed', 'version']); expect(a.ev('isDirty()')).toBe(true);
    const b = reopen(a); expect(b.dlgTitle()).toBe('Browser memory is protected'); await unlock(b); await waitFor(() => !b.dlgOpen()); expect(b.ev('S.events.length')).toBe(0);
  });
  it('saving the current workspace or all of them while protected keeps it sealed and keeps the other workspaces', async () => {
    const a = fresh(); a.ev('addWorkspace()'); a.ev('cw().name="Work"'); a.ev("switchWs(WS[0].id)"); await protect(a);
    a.ev('S.events[0].title="Changed"'); await a.ev("saveMem('current')"); expect(a.storage()[WS_KEY]).not.toMatch(/Changed/);
    const c = reopen(a); await unlock(c); await waitFor(() => !c.dlgOpen() && c.ev('WS.length') === 2);
    expect(c.ev('WS.map(w=>w.name)')).toEqual(['Family', 'Work']); expect(c.ev('S.events[0].title')).toBe('Changed'); expect(c.ev('anyDirty()')).toBe(false);
  });
  it('the Save and Load dialogs say "Browser memory (protected)" while it is protected', async () => {
    const a = fresh(); a.toolbar('save').click(); expect(a.dlgButtons()).toContain('Browser memory'); a.click('Cancel');
    await protect(a); a.toolbar('save').click(); expect(a.dlgButtons()).toContain('Browser memory (protected)'); a.click('Cancel');
    a.toolbar('load').click(); expect(a.dlgButtons()).toContain('Browser memory (protected)');
  });
  it('Load → Browser memory and Restart work with the open passphrase without asking again', async () => {
    const a = fresh(); await protect(a); a.ev('hist();S.events[0].title="Unsaved"'); await a.ev('loadMem()'); expect(a.ev('S.events[0].title')).toBe('Doctor visit');
    a.ev('hist();S.events[0].title="Unsaved"'); await a.ev('restart()'); expect(a.ev('S.events[0].title')).toBe('Doctor visit'); expect(a.dlgOpen()).toBe(false);
  });
});

describe('R-DATA-11 Opening the page with protected browser memory asks for the passphrase first', { timeout: 30000 }, () => {
  it('the unlock dialog shows over an empty grid; the right passphrase restores every workspace, the current one and the saved state', async () => {
    const a = fresh(); a.ev('addWorkspace()'); a.ev('cw().name="Work"'); await protect(a); const b = reopen(a);
    expect(b.dlgTitle()).toBe('Browser memory is protected'); expect(b.ev('S.events.length')).toBe(0); expect(b.dlgButtons()).toEqual(['Forgot it? Erase browser memory…', 'Open']);
    await unlock(b); await waitFor(() => !b.dlgOpen() && b.ev('WS.length') === 2); expect(b.ev('WS.map(w=>w.name)')).toEqual(['Family', 'Work']); expect(b.ev('cw().name')).toBe('Work'); expect(b.ev('anyDirty()')).toBe(false);
  });
  it('a wrong passphrase says so and lets you try again; nothing is shown until it is right', async () => {
    const a = fresh(); await protect(a); const b = reopen(a); await unlock(b, 'not the passphrase');
    await waitFor(() => err(b) === 'Wrong passphrase. Try again.'); expect(b.dlgOpen()).toBe(true); expect(b.ev('S.events.length')).toBe(0);
    await unlock(b); await opened(b);
  });
  it('Escape does not close the unlock dialog, and if the browser closes it anyway it comes back', async () => {
    const a = fresh(); await protect(a); const b = reopen(a), dlg = b.q('#xDlg');
    const esc = new b.w.Event('cancel', { cancelable: true }); dlg.dispatchEvent(esc); expect(esc.defaultPrevented).toBe(true);
    dlg.close(); await waitFor(() => b.dlgOpen() && b.dlgTitle() === 'Browser memory is protected'); expect(b.ev('S.events.length')).toBe(0);
  });
  it('"Erase browser memory…" asks first, then removes everything and starts with an empty workspace', async () => {
    const a = fresh(); await protect(a); const b = openApp({ storage: a.storage(), confirmAnswer: m => !/Erase everything/.test(m) });
    b.click('Forgot it? Erase browser memory…'); expect(b.log.confirms.at(-1)).toMatch(/cannot be recovered/); expect(b.dlgOpen()).toBe(true); expect(b.storage()[WS_KEY]).toBeDefined();
    const c = openApp({ storage: a.storage() }); c.click('Forgot it? Erase browser memory…'); await waitFor(() => !c.dlgOpen());
    expect(c.storage()[WS_KEY]).toBeUndefined(); expect(c.ev('memKey')).toBe(null); expect(c.ev('S.events.length')).toBe(0); expect(c.toast()).toBe('Browser memory cleared and app restarted');
  });
  it('a shared link opened with the page asks for its password only after the passphrase', async () => {
    const a = fresh(); await protect(a); const link = await a.ev(`seal(buildFile(),"link-password-123").then(b=>"https://app.test/#data=e1."+b64u(b))`);
    const b = openApp({ url: link, storage: a.storage() }); await b.sleep(20); expect(b.dlgTitle()).toBe('Browser memory is protected');
    await unlock(b); await waitFor(() => b.dlgTitle() === 'Password needed');
  });
  it('Live View remembered by this browser starts after the passphrase, not before', async () => {
    const a = fresh(); await protect(a); const prefs = JSON.stringify({ live: true });
    const b = openApp({ storage: { ...a.storage(), [PREFS_KEY]: prefs } }); expect(b.ev('live')).toBe(false); expect(b.dlgTitle()).toBe('Browser memory is protected');
    await unlock(b); await waitFor(() => b.ev('live') === true);
  });
  it('a protected store from a newer version gets the newer-version message, no unlock dialog, and is never overwritten', async () => {
    const a = fresh(); await protect(a); const st = stored(a); st.version = a.ev('FMT') + 1; const text = JSON.stringify(st);
    const b = openApp({ storage: { [WS_KEY]: text } }); expect(b.log.alerts[0]).toContain('newer version'); expect(b.dlgOpen()).toBe(false);
    b.ev("saveMem('all')"); expect(b.storage()[WS_KEY]).toBe(text);
  });
  it('the unlock dialog is translated into Spanish', async () => {
    const a = fresh(); await protect(a); const b = openApp({ storage: a.storage(), languages: ['es-ES'] });
    expect(b.dlgTitle()).toBe('La memoria del navegador está protegida'); expect(b.dlgButtons()).toEqual(['¿La olvidaste? Borrar la memoria del navegador…', 'Abrir']);
  });
});

describe('R-DATA-11 Changing or removing the passphrase, and Lock now', { timeout: 40000 }, () => {
  it('while protected, Settings → Data says so and offers Change passphrase…, Lock now and Remove passphrase…', async () => {
    const a = fresh(); await protect(a); settingsData(a); expect(a.dlgText()).toContain('Browser memory is protected with a passphrase.');
    expect(a.dlgButtons()).toEqual(expect.arrayContaining(['Change passphrase…', 'Lock now', 'Remove passphrase…'])); expect(a.dlgButtons()).not.toContain('Passphrase…');
  });
  it('changing it needs the current passphrase; afterwards the new one opens the page and the old one does not', async () => {
    const a = fresh(); await protect(a); await settingsBtn(a, 'Change passphrase…'); expect(a.qa('#xDlg .pwl')).toHaveLength(3);
    fill(a, ['wrong passphrase', 'brand new phrase', 'brand new phrase']); a.click('Change'); await waitFor(() => err(a) === 'Wrong passphrase.');
    fill(a, [PASS, 'brand new phrase', 'brand new phrase']); a.click('Change'); await waitFor(() => a.toast() === 'Passphrase changed');
    const b = reopen(a); await unlock(b); await waitFor(() => err(b) === 'Wrong passphrase. Try again.'); await unlock(b, 'brand new phrase'); await opened(b);
  });
  it('removing it needs the passphrase and stores browser memory as readable JSON again', async () => {
    const a = fresh(); await protect(a); await settingsBtn(a, 'Remove passphrase…'); expect(a.dlgText()).toContain('anyone using this browser can read it');
    fill(a, ['wrong passphrase']); a.click('Remove'); await waitFor(() => err(a) === 'Wrong passphrase.'); expect(stored(a).sealed).toBeDefined();
    fill(a, [PASS]); a.click('Remove'); await waitFor(() => a.toast() === 'Browser memory is no longer protected');
    expect(stored(a).workspaces[0].events[0].title).toBe('Doctor visit'); expect(a.ev('memKey')).toBe(null); expect(reopen(a).dlgOpen()).toBe(false);
  });
  it('Lock now asks when there are unsaved changes, then hides the data until the passphrase is typed again', async () => {
    const a = fresh({ confirmAnswer: false }); await protect(a); a.ev('hist();S.events[0].title="Unsaved"'); await settingsBtn(a, 'Lock now');
    expect(a.log.confirms.at(-1)).toBe('Lock now? Unsaved changes will be lost.'); expect(a.ev('S.events[0].title')).toBe('Unsaved');
    const b = fresh(); await protect(b); await settingsBtn(b, 'Lock now'); expect(b.ev('memKey')).toBe(null); expect(b.ev('S.events.length')).toBe(0); expect(b.dlgTitle()).toBe('Browser memory is protected');
    await unlock(b); await opened(b); expect(b.ev('S.events[0].title')).toBe('Doctor visit');
  });
  it('a passphrase changed in another tab makes saving here refuse with the reload message, leaving it as it is', async () => {
    const a = fresh(); await protect(a); const other = await a.ev(`(async()=>{const st=readStore(),k=await newKey("other tab phrase");const plain=await unseal(unb64u(st.sealed),null,memKey);return JSON.stringify({version:FMT,sealed:b64u(await seal(plain,null,k))})})()`);
    a.w.localStorage.setItem(WS_KEY, other); await a.ev("saveMem('all')"); await waitFor(() => a.log.alerts.length); expect(a.log.alerts[0]).toContain('changed in another tab'); expect(a.storage()[WS_KEY]).toBe(other);
  });
  it('protection turned on in another tab makes a page that opened it plain refuse to save over it', async () => {
    const a = fresh(); await protect(a); const b = fresh(); b.w.localStorage.setItem(WS_KEY, a.storage()[WS_KEY]); b.ev("saveMem('all')");
    expect(b.log.alerts[0]).toContain('changed in another tab'); expect(b.storage()[WS_KEY]).toBe(a.storage()[WS_KEY]);
  });
  it('the passphrase dialogs and Settings rows are translated into Spanish', async () => {
    const a = fresh({ languages: ['es-ES'] }); a.ev('openSettings()'); [...a.d.querySelectorAll('#xDlg .stabs button')].find(b => b.textContent === 'Datos').click();
    expect(a.dlgButtons()).toContain('Frase de contraseña…'); a.click('Frase de contraseña…'); await a.sleep(5); expect(a.dlgTitle()).toBe('Proteger la memoria del navegador'); expect(a.dlgButtons()).toEqual(['Sugerir una', 'Proteger', 'Cancelar']);
  });
});

describe('R-SEC-04 Protected browser memory still uses only the two documented keys, and its key never leaves the page', { timeout: 30000 }, () => {
  it('after protecting, saving and unlocking, localStorage holds only the workspaces key and the settings key', async () => {
    const a = fresh(); await protect(a); await a.ev("saveMem('all')"); const b = reopen(a); await unlock(b); await opened(b); await b.ev("saveMem('all')");
    expect(Object.keys(b.storage()).sort()).toEqual([PREFS_KEY, WS_KEY].filter(k => k in b.storage()).sort()); expect(Object.keys(b.storage()).every(k => k === WS_KEY || k === PREFS_KEY)).toBe(true);
    expect(b.storage()[PREFS_KEY] || '').not.toMatch(/correct horse|Granny|Doctor/);
  });
  it('the derived key is a non-extractable AES-GCM key made with 600,000 PBKDF2 iterations', async () => {
    const a = fresh(); await protect(a); expect(a.ev('memKey.key.extractable')).toBe(false); expect(a.ev('memKey.key.algorithm.name')).toBe('AES-GCM'); expect(a.ev('memKey.iter')).toBe(600000);
    await expect(a.ev('crypto.subtle.exportKey("raw",memKey.key).then(()=>"exported",()=>"refused")')).resolves.toBe('refused');
  });
});
