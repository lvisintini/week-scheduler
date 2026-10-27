import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, sched, ev1, WS_KEY, PREFS_KEY } from '../helpers/app.js';

const fresh = (o = {}) => openApp({ promptAnswer: 'Second', ...o });
const names = a => a.ev('state.WS.map(w=>w.name)');
const menu = a => a.qa('.omenu .oi').map(b => b.textContent.replace(/\s+/g, ' ').trim());
const menuClick = (a, label) => a.qa('.omenu .oi').find(b => b.textContent.trim().startsWith(label)).click();
const openMenu = a => a.q('.wsbtn').click();
const store = a => JSON.parse(a.w.localStorage.getItem(WS_KEY));
const twoWs = (o = {}) => { const a = fresh(o); a.ev('addWorkspace();switchWs(state.WS[0].id)'); return a; };

describe('R-DATA-01 Workspaces: independent data sets in one browser', () => {
  it('a first start has a single workspace called "Workspace" shown in the switcher under the title', () => {
    const a = fresh(); expect(names(a)).toEqual(['Workspace']); expect(a.q('.wsbtn .wsn').textContent).toBe('Workspace');
  });
  it('the switcher menu lists the workspaces, then the current one\'s actions (Rename, the cycle of weeks, Duplicate, Delete; R-CYC-01), then those for all of them (New, the examples, Workspaces…)', () => {
    const a = twoWs(); openMenu(a); expect(menu(a)).toEqual(['Workspace', 'Second', 'Rename…', 'Weeks in the cycle…', 'Duplicate', 'Delete…', 'New workspace…', 'Open the examples', 'Workspaces…']);
    const parts = [...a.q('.omenu').children].map(c => c.tagName === 'HR' ? '—' : c.classList.contains('omh') ? '# ' + c.textContent : c.textContent.trim());
    expect(parts).toEqual(['Workspace', 'Second', '—', '# Workspace', 'Rename…', 'Weeks in the cycle…', 'Duplicate', 'Delete…', '—', '# All workspaces', 'New workspace…', 'Open the examples', 'Workspaces…']);
  });
  it('the current workspace\'s group is headed by its name, as text; Delete is last there and red; every action has an icon of its own', () => {
    const a = fresh(); a.ev('cw().name="<b>Home</b> & shop";render()'); openMenu(a); const h = a.qa('.omenu .omh');
    expect(h[0].textContent).toBe('<b>Home</b> & shop'); expect(h[0].querySelector('b')).toBeNull();
    const items = a.qa('.omenu .oi'), del = items.find(b => b.textContent.trim() === 'Delete…');
    expect(del.classList.contains('d')).toBe(true); expect(del.nextElementSibling.tagName).toBe('HR');
    const icons = items.slice(1).map(b => b.querySelector('svg').outerHTML); expect(new Set(icons).size).toBe(icons.length);
    expect(items.find(b => b.textContent.trim() === 'Workspaces…').title).toMatch(/order.*colour.*description/);
  });
  it('in Spanish the menu reads Renombrar…, Duplicar, Eliminar… under the workspace\'s name and Todos los espacios de trabajo', () => {
    const a = twoWs(); a.ev("setLang('es');renderSide()"); openMenu(a);
    expect(menu(a).slice(2)).toEqual(['Renombrar…', 'Semanas del ciclo…', 'Duplicar', 'Eliminar…', 'Nuevo espacio de trabajo…', 'Abrir los ejemplos', 'Espacios de trabajo…']);
    expect(a.qa('.omenu .omh').map(h => h.textContent)).toEqual(['Workspace', 'Todos los espacios de trabajo']);
  });
  it('the current workspace is marked with a tick in the menu', () => {
    const a = twoWs(); openMenu(a); expect(a.qa('.omenu .oi')[0].querySelector('svg')).not.toBeNull(); expect(a.qa('.omenu .oi')[1].querySelector('svg')).toBeNull();
  });
  it('"New workspace…" asks for a name, creates a fresh default workspace and switches to it', () => {
    const a = fresh(); openMenu(a); menuClick(a, 'New workspace'); expect(names(a)).toEqual(['Workspace', 'Second']); expect(a.ev('cw().name')).toBe('Second'); expect(a.ev('state.S.schedules[0].name')).toBe('Routine'); expect(a.ev('state.S.phases.length')).toBe(7); expect(a.ev('state.S.types.length')).toBe(9);
  });
  it('a name that already exists is made unique with (2)', () => {
    const a = fresh({ promptAnswer: 'Workspace' }); a.ev('addWorkspace()'); expect(names(a)).toEqual(['Workspace', 'Workspace (2)']);
  });
  it('cancelling the name prompt creates nothing', () => {
    const a = fresh({ promptAnswer: null }); a.ev('addWorkspace()'); expect(names(a)).toEqual(['Workspace']);
  });
  it('workspaces are independent: changes in one never show in another', () => {
    const a = twoWs(); a.ev('state.S.schedules[0].name="Only in first"'); a.ev('switchWs(state.WS[1].id)'); expect(a.ev('state.S.schedules[0].name')).toBe('Routine'); a.ev('switchWs(state.WS[0].id)'); expect(a.ev('state.S.schedules[0].name')).toBe('Only in first');
  });
  it('every workspace keeps its own undo history', () => {
    const a = twoWs(); a.ev('hist();state.S.schedules[0].name="A edited"'); a.ev('switchWs(state.WS[1].id)'); a.toolbar('undo').click(); expect(a.ev('state.S.schedules[0].name')).toBe('Routine');
    a.ev('switchWs(state.WS[0].id)'); a.toolbar('undo').click(); expect(a.ev('state.S.schedules[0].name')).toBe('Routine'); expect(a.ev('state.undoSt.length')).toBe(0);
  });
  it('switching clears the selection and redraws the grid with the other workspace\'s events', () => {
    const a = twoWs(); setData(a, blank({ events: [ev1()] })); expect(a.qa('.ev')).toHaveLength(1); a.ev('switchWs(state.WS[1].id)'); expect(a.qa('.ev')).toHaveLength(0);
  });
  it('"Rename…" renames the current workspace', () => {
    const a = fresh({ promptAnswer: 'Granny care' }); a.ev('renameWorkspace()'); expect(a.ev('cw().name')).toBe('Granny care'); expect(a.q('.wsbtn .wsn').textContent).toContain('Granny care');
  });
  it('"Duplicate" copies all the current workspace\'s data into a new, unsaved workspace', () => {
    const a = fresh(); a.ev('state.S.schedules[0].name="Original"'); a.ev('duplicateWorkspace()');
    expect(names(a)).toEqual(['Workspace', 'Workspace (copy)']); expect(a.ev('state.S.schedules[0].name')).toBe('Original'); expect(a.ev('isDirty()')).toBe(true);
    a.ev('state.S.schedules[0].name="Changed"'); a.ev('switchWs(state.WS[0].id)'); expect(a.ev('state.S.schedules[0].name')).toBe('Original');
  });
  it('"Delete…" asks for confirmation naming the current workspace, deletes it and shows a neighbour', () => {
    const a = twoWs({ promptAnswer: 'Second' }); a.ev('deleteWorkspace()'); expect(a.log.confirms[0]).toContain('Delete workspace "Workspace"'); expect(names(a)).toEqual(['Second']); expect(a.ev('cw().name')).toBe('Second');
  });
  it('declining the confirmation keeps the workspace', () => {
    const a = twoWs({ confirmAnswer: false }); a.ev('deleteWorkspace()'); expect(names(a)).toEqual(['Workspace', 'Second']);
  });
  it('the only workspace cannot be deleted', () => {
    const a = fresh(); a.ev('deleteWorkspace()'); expect(names(a)).toEqual(['Workspace']); expect(a.toast()).toContain("You can't delete the only workspace");
  });
  it('workspaces with unsaved changes are marked with a bullet in the switcher, the menu and the title', () => {
    const a = twoWs(); a.ev('state.S.schedules[0].name="edited"'); a.ev('render()');
    expect(a.q('.wsbtn .wsn').textContent).toContain('•'); expect(a.q('.ttl').textContent).toContain('•'); openMenu(a); expect(menu(a)[0]).toContain('•');
  });
  it('a workspace is no longer marked after it has been saved', () => {
    const a = fresh(); a.ev('state.S.schedules[0].name="edited";saveMem("current")'); expect(a.ev('anyDirty()')).toBe(false); expect(a.q('.ttl').textContent).not.toContain('•');
  });
});

describe('R-DATA-02 Saving to browser memory: one workspace or all', () => {
  it('the Save dialog offers browser memory, a JSON file, a shareable link and the calendar export', () => {
    const a = fresh(); a.toolbar('save').click(); expect(a.dlgButtons()).toEqual(['Browser memory', 'JSON file', 'Shareable link', 'Calendar file (export only)', 'Cancel']);
  });
  it('with one workspace "Browser memory" saves at once, without a question, and confirms with a toast', () => {
    const a = fresh(); a.chooseSave('Browser memory'); expect(a.toast()).toBe('Saved to browser memory'); expect(store(a).workspaces).toHaveLength(1);
  });
  it('the saved store has the documented shape (version, current, workspaces with id, name and data)', () => {
    const a = fresh(); a.chooseSave('Browser memory'); const s = store(a);
    expect(Object.keys(s).sort()).toEqual(['current', 'version', 'workspaces']); expect(Object.keys(s.workspaces[0]).sort()).toEqual(['events', 'id', 'name', 'people', 'phaseOpacity', 'phases', 'rhythms', 'schedules', 'types']);
  });
  it('with several workspaces it asks: only the current one, or all', async () => {
    const a = twoWs(); a.chooseSave('Browser memory'); await a.sleep(20); expect(a.dlgTitle()).toBe('Save which workspaces?'); expect(a.dlgButtons()).toEqual(['Only "Workspace"', 'All workspaces (2)', 'Cancel']);
  });
  it('"Only <current>" updates just that workspace and leaves the other stored entries as they were', async () => {
    const a = twoWs(); a.chooseSave('Browser memory'); await a.sleep(20); a.click('All workspaces (2)');
    a.ev('switchWs(state.WS[1].id);state.S.schedules[0].name="B changed"'); a.ev('switchWs(state.WS[0].id);state.S.schedules[0].name="A changed"');
    a.chooseSave('Browser memory'); await a.sleep(20); a.click('Only "Workspace"');
    const s = store(a); expect(s.workspaces.map(w => w.schedules[0].name)).toEqual(['A changed', 'Routine']); expect(a.ev('wsDirty(state.WS[1])')).toBe(true); expect(a.ev('wsDirty(state.WS[0])')).toBe(false);
  });
  const three = () => { const a = fresh(); a.ev('addWorkspace();addWorkspace();switchWs(state.WS[0].id)'); return a; };
  it('"All workspaces" saves every workspace and drops workspaces that were deleted', async () => {
    const a = three(); a.chooseSave('Browser memory'); await a.sleep(20); a.click('All workspaces (3)'); expect(store(a).workspaces).toHaveLength(3);
    a.ev('deleteWorkspace()'); a.chooseSave('Browser memory'); await a.sleep(20); a.click('All workspaces (2)'); expect(store(a).workspaces).toHaveLength(2); expect(a.ev('anyDirty()')).toBe(false);
  });
  it('saving only the current workspace keeps a deleted workspace\'s old copy in the store until all are saved', async () => {
    const a = three(); a.chooseSave('Browser memory'); await a.sleep(20); a.click('All workspaces (3)'); a.ev('deleteWorkspace()');
    a.chooseSave('Browser memory'); await a.sleep(20); a.click('Only "Second"'); expect(store(a).workspaces).toHaveLength(3);
  });
  it('with only one workspace left, saving also removes earlier deleted workspaces, so they cannot come back after a reload', async () => {
    const a = twoWs(); a.chooseSave('Browser memory'); await a.sleep(20); a.click('All workspaces (2)'); a.ev('deleteWorkspace()');
    a.chooseSave('Browser memory'); expect(store(a).workspaces).toHaveLength(1); expect(names(openApp({ storage: a.storage() }))).toEqual(['Second']);
  });
  it('a full browser storage is reported instead of failing silently', () => {
    const a = fresh(); a.w.Storage.prototype.setItem = () => { throw new Error('quota'); }; a.ev('saveMem("current")'); expect(a.toast()).toContain('Browser memory is not available');
  });
});

describe('R-DATA-03 The app starts from browser memory; Load reverts a workspace', () => {
  const wsRec = (id, name, sc) => ({ id, name, ...blank({ schedules: [sched({ name: sc })] }) });
  it('at start every saved workspace is loaded and the last current one is shown', () => {
    const a = openApp({ storage: { [WS_KEY]: JSON.stringify({ version: 1, current: 'b', workspaces: [wsRec('a', 'Alpha', 'sa'), wsRec('b', 'Beta', 'sb')] }) } });
    expect(names(a)).toEqual(['Alpha', 'Beta']); expect(a.ev('cw().name')).toBe('Beta'); expect(a.ev('state.S.schedules[0].name')).toBe('sb'); expect(a.ev('anyDirty()')).toBe(false);
  });
  it('an unknown "current" id falls back to the first workspace', () => {
    const a = openApp({ storage: { [WS_KEY]: JSON.stringify({ version: 1, current: 'zzz', workspaces: [wsRec('a', 'Alpha', 'sa')] }) } }); expect(a.ev('cw().id')).toBe('a');
  });
  it('workspace ids and names survive a save and reload', () => {
    const a = fresh(); a.ev('addWorkspace()'); a.ev('saveMem("all")'); const b = openApp({ storage: a.storage() }); expect(names(b)).toEqual(['Workspace', 'Second']); expect(b.ev('cw().id')).toBe(a.ev('cw().id'));
  });
  it('Load → Browser memory reverts the current workspace to its saved copy (and can be undone)', () => {
    const a = fresh(); a.ev('saveMem("current")'); a.ev('state.S.schedules[0].name="unsaved edit"'); a.toolbar('load').click(); a.click('Browser memory');
    expect(a.ev('state.S.schedules[0].name')).toBe('Routine'); expect(a.toast()).toBe('Loaded from browser memory'); a.toolbar('undo').click(); expect(a.ev('state.S.schedules[0].name')).toBe('unsaved edit');
  });
  it('Load → Browser memory says so when nothing has been saved yet', () => {
    const a = fresh(); a.toolbar('load').click(); a.click('Browser memory'); expect(a.toast()).toBe('Nothing is saved in browser memory yet.');
  });
  it('Load → JSON file opens the file chooser', () => {
    const a = fresh(); let opened = false; a.d.getElementById('file').click = () => { opened = true; }; a.toolbar('load').click(); a.click('JSON file'); expect(opened).toBe(true);
  });
  it('the Load dialog offers browser memory and JSON file only', () => {
    const a = fresh(); a.toolbar('load').click(); expect(a.dlgButtons()).toEqual(['Browser memory', 'JSON file', 'Cancel']);
  });
});

describe('R-DATA-05 Clear memory, Restart and the unsaved-changes warning', () => {
  const quit = a => { const e = new a.w.Event('beforeunload', { cancelable: true }); a.w.dispatchEvent(e); return e.defaultPrevented; };
  it('Clear memory asks for confirmation that mentions all workspaces', () => {
    const a = fresh(); a.ev('openSettings()'); a.click('Clear memory'); expect(a.log.confirms[0]).toContain('all workspaces'); expect(a.log.confirms[0]).toContain('restart the app');
  });
  it('after confirming, the stored data is deleted and the app restarts with one default workspace and no undo history', () => {
    const a = twoWs(); a.ev('saveMem("all");hist()'); a.ev('clearMem()');
    expect(a.w.localStorage.getItem(WS_KEY)).toBeNull(); expect(names(a)).toEqual(['Workspace']); expect(a.ev('state.undoSt.length')).toBe(0); expect(a.toast()).toContain('restarted');
  });
  it('declining Clear memory changes nothing', () => {
    const a = twoWs({ confirmAnswer: false }); a.ev('saveMem("all");clearMem()'); expect(a.w.localStorage.getItem(WS_KEY)).not.toBeNull(); expect(names(a)).toEqual(['Workspace', 'Second']);
  });
  it('Clear memory keeps the view preferences (theme, zoom, sidebar)', () => {
    const a = fresh(); a.ev('state.prefs.theme="dark";savePrefs();saveMem("current");clearMem()'); expect(a.w.localStorage.getItem(PREFS_KEY)).toContain('dark');
  });
  it('Restart asks only when there are unsaved changes, and then reloads what is saved in browser memory', () => {
    const a = fresh(); a.ev('saveMem("current")'); a.ev('restart()'); expect(a.log.confirms).toEqual([]);
    a.ev('state.S.schedules[0].name="unsaved"'); a.ev('restart()'); expect(a.log.confirms[0]).toContain('Discard all unsaved changes'); expect(a.ev('state.S.schedules[0].name')).toBe('Routine');
  });
  it('declining Restart keeps the unsaved changes', () => {
    const a = fresh({ confirmAnswer: false }); a.ev('state.S.schedules[0].name="unsaved";restart()'); expect(a.ev('state.S.schedules[0].name')).toBe('unsaved');
  });
  it('leaving the page is blocked with the browser warning while any workspace has unsaved changes', () => {
    const a = twoWs(); expect(quit(a)).toBe(false); a.ev('state.S.schedules[0].name="x"'); expect(quit(a)).toBe(true);
  });
  it('the warning also covers a workspace that is not the one currently shown', () => {
    const a = twoWs(); a.ev('state.S.schedules[0].name="x";switchWs(state.WS[1].id)'); expect(quit(a)).toBe(true);
  });
  it('after saving everything the warning disappears', () => {
    const a = twoWs(); a.ev('state.S.schedules[0].name="x";saveMem("all")'); expect(quit(a)).toBe(false);
  });
  it('changing only view settings (eyes, zoom, theme) never triggers the warning', () => {
    const a = fresh(); a.ev('saveMem("current")'); a.ev('state.S.schedules[0].visible=false;state.prefs.rowH=90;state.prefs.theme="dark";render()'); expect(quit(a)).toBe(false);
  });
});

describe('R-DATA-06 View settings belong to the browser, not to the workspace data', () => {
  it('prefs are stored under their own key and are not part of the saved workspaces', () => {
    const a = fresh(); a.ev('state.prefs.nowLine=false;state.prefs.clock12=true;state.prefs.theme="dark";savePrefs();saveMem("all")');
    const p = JSON.parse(a.w.localStorage.getItem(PREFS_KEY)); expect(p).toMatchObject({ nowLine: false, clock12: true, theme: 'dark' });
    expect(a.w.localStorage.getItem(WS_KEY)).not.toMatch(/nowLine|clock12|theme|rowH/);
  });
  it('the preferences come back after a reload', () => {
    const a = fresh(); a.ev('state.prefs.nowLine=false;state.prefs.days[state.curId]=[0,4];state.prefs.clock12=true;savePrefs()'); const b = openApp({ storage: a.storage() });
    expect([b.ev('state.prefs.nowLine'), b.ev('Object.values(state.prefs.days)'), b.ev('state.prefs.clock12')]).toEqual([false, [[0, 4]], true]);
  });
  it('exported files never contain view preferences', async () => {
    const a = fresh(); a.ev('state.prefs.nowLine=false;state.prefs.theme="dark"'); const f = a.ev('buildFile()'); expect(Object.keys(f)).not.toContain('prefs'); expect(JSON.stringify(f)).not.toMatch(/nowLine|theme|clock12|hideWeekend|hours/);
  });
  it('a corrupt preferences entry is ignored and defaults are used', () => {
    const a = openApp({ storage: { [PREFS_KEY]: '{not json' } }); expect(a.ev('state.prefs.theme')).toBe('auto'); expect(a.ev('state.prefs.rowH')).toBe(48);
  });
  it('the sidebar width and collapsed state, and the collapsed sections, are remembered too', () => {
    const a = fresh(); a.ev('state.prefs.w=333;state.prefs.collapsed=true;state.prefs.secPpl=true;savePrefs()'); const b = openApp({ storage: a.storage() });
    expect(b.ev('state.prefs.w')).toBe(333); expect(b.q('#sb').classList.contains('collapsed')).toBe(true); expect(b.ev('state.prefs.secPpl')).toBe(true);
  });
});

describe('R-DATA-10 Workspaces have a colour and a description, and this browser keeps their order', () => {
  const threeWs = () => { const a = fresh(); a.ev("addWorkspace();state.WS[1].name='Work';const t=newWs('Club',defaultData(),true);state.WS.push(t);switchWs(state.WS[0].id);cw().name='Home'"); return a; };
  const dlg = a => { openMenu(a); menuClick(a, 'Workspaces…'); return a.sleep(5); };
  const rows = a => a.qa('#xDlg .wsr');
  const type = (i, v) => { i.value = v; i.oninput(); };
  it('the workspace menu opens Workspaces…, a row per workspace with a grip, a colour, a name and a description', async () => {
    const a = threeWs(); await dlg(a); expect(a.dlgTitle()).toBe('Workspaces'); expect(rows(a)).toHaveLength(3);
    const r = rows(a)[1]; expect(r.querySelector('.grip').getAttribute('aria-label')).toBe('Move Work'); expect(r.querySelector('.cyname').value).toBe('Work');
    expect(r.querySelector('.cydesc').getAttribute('aria-label')).toBe('Work: description'); expect(r.querySelector('.cysw').classList.contains('none')).toBe(true);
  });
  it('Apply renames, sets colours and descriptions (an undo step in each changed workspace) and saves the order in this browser', async () => {
    const a = threeWs(); await dlg(a); const r = rows(a);
    type(r[0].querySelector('.cydesc'), 'Our routine'); type(r[1].querySelector('.cyname'), 'Office'); const up = i => rows(a)[i].querySelector('.grip').onkeydown({ key: 'ArrowUp', preventDefault() {} }); up(2); up(1);   // Club to the top
    a.click('Apply'); expect(names(a)).toEqual(['Club', 'Home', 'Office']); expect(a.ev('state.S.desc')).toBe('Our routine'); expect(a.ev('state.undoSt.length')).toBe(1); expect(a.ev('state.WS[2].undo.length')).toBe(0);
    expect(JSON.parse(a.w.localStorage.getItem(PREFS_KEY)).wsOrder).toEqual(a.ev('state.WS.map(w=>w.id)')); expect(a.ev('isDirty()')).toBe(true);
    a.ev('undo()'); expect(a.ev('state.S.desc')).toBeUndefined();
  });
  it('the order survives a reload of browser memory; workspaces it does not know go last', () => {
    const a = threeWs(); a.ev("saveMem('all');state.prefs.wsOrder=[state.WS[2].id,state.WS[0].id];savePrefs();loadStore();render()"); expect(names(a)).toEqual(['Club', 'Home', 'Work']);
  });
  it('the colour marks the workspace button, the menu and printouts; the description is the button\'s tooltip and is shown in the menu', () => {
    const a = threeWs(); a.ev("hist();state.S.color='#e5484d';state.S.desc='Our routine';render()");
    expect(a.q('.wsbtn').classList.contains('wscol')).toBe(true); expect(a.q('.wsbtn').title).toContain('Our routine');
    openMenu(a); const b = a.qa('.omenu .oi')[0]; expect(b.querySelector('.wkchip')).not.toBeNull(); expect(b.querySelector('.wkd').textContent).toBe('Our routine');
    a.ev('printSchedule()'); expect(a.w.__printed).toContain('class="wkchip" style="background:#e5484d"');
  });
  it('colour and description travel in files; parsing keeps a hex colour and a trimmed text only; anonymised copies drop the description', () => {
    const a = threeWs(); a.ev("state.S.color='#e5484d';state.S.desc='  Our routine  '"); expect(a.ev('buildFile().color')).toBe('#e5484d');
    expect(a.ev("JSON.stringify(parseData({schedules:[],events:[],color:'red;x',desc:'  hi  '}))")).toContain('"desc":"hi"'); expect(a.ev("parseData({schedules:[],events:[],color:'red;x'}).color")).toBeUndefined();
    expect(a.ev('anonymised(buildFile()).desc')).toBeUndefined(); expect(a.ev('anonymised(buildFile()).color')).toBe('#e5484d');
  });
  it('the Workspaces dialog and its menu item are translated into Spanish', async () => {
    const a = threeWs(); a.ev("state.lang='es'"); openMenu(a); menuClick(a, 'Espacios de trabajo…'); await a.sleep(5); expect(a.dlgTitle()).toBe('Espacios de trabajo');
  });
});

describe('R-DATA-12 The Examples workspace: a sample week that shows what the app can do, opened on demand', () => {
  const opened = () => { const a = fresh(); openMenu(a); menuClick(a, 'Open the examples'); return a; };
  const evt = (a, k) => a.ev(`JSON.parse(JSON.stringify(state.S.events.find(e=>e.id==='ex${k}')))`);
  const box = (a, d, title) => a.qa(`.day[data-d="${d}"] .ev`).find(b => b.getAttribute('aria-label').startsWith(title + ','));
  it('the workspace menu opens it: a workspace named Examples with its colour and description, shown at once and not an unsaved change', () => {
    const a = opened(); expect(names(a)).toEqual(['Workspace', 'Examples']); expect(a.ev('state.curId')).toBe('examples');
    expect(a.ev('state.S.desc')).toMatch(/^A sample week/); expect(a.ev('state.S.color')).toMatch(/^#[0-9a-f]{6}$/); expect(a.ev('anyDirty()')).toBe(false);
    expect(a.qa('.omenu .oi').length).toBe(0); expect(a.w.localStorage.getItem(WS_KEY) || '').not.toContain('examples');   // not written to browser memory until saved
  });
  it('the menu entry explains itself in its tooltip', () => {
    const a = fresh(); openMenu(a); expect(a.qa('.omenu .oi').find(b => b.textContent.includes('Open the examples')).title).toMatch(/not saved unless you save it/);
  });
  it('it starts with Show descriptions on and the hours 07:00 to 22:00, and every event has a description', () => {
    const a = opened(); expect(a.ev("descOn('examples')")).toBe(true); expect(a.ev("hrsOf('examples')")).toEqual([7, 22]); expect(a.qa('.ev .ds').length).toBeGreaterThan(10);
    expect(a.ev('state.S.events.every(e=>e.desc.length>40)')).toBe(true);
  });
  it('opening it again switches to it instead of making a second one; deleted, it can be opened again afresh', () => {
    const a = opened(); a.ev('switchWs(state.WS[0].id);state.S.events.length=0'); a.ev('switchWs("examples");state.S.events.length=0;switchWs(state.WS[0].id)');
    a.ev('openExamples()'); expect(names(a)).toEqual(['Workspace', 'Examples']); expect(a.ev('state.curId')).toBe('examples'); expect(a.ev('state.S.events.length')).toBe(0);
    a.w.confirm = () => true; a.ev('deleteWorkspace()'); a.ev('openExamples()'); expect(a.ev('state.S.events.length')).toBe(20);
  });
  it('a workspace of the user already named Examples is kept: the sample gets a name of its own', () => {
    const a = fresh({ promptAnswer: 'Examples' }); a.ev('addWorkspace()'); a.ev('openExamples()'); expect(names(a)).toEqual(['Workspace', 'Examples', 'Examples (2)']);
  });
  it('the data passes parseData unchanged: nothing it shows is clamped away', () => {
    const a = fresh(); expect(a.ev('(()=>{const x=exampleData();return JSON.stringify(parseData(x))===JSON.stringify(x)})()')).toBe(true);
    expect(a.ev('exampleData().events.filter(e=>e.slots.some(s=>s.fs||s.fe)).map(e=>e.slots.map(s=>[s.fs||0,s.fe||0]))')).toEqual([[[30, 0]], [[0, 60]]]);
  });
  it('owner and who does it: Alex owns the school drop-off and does it, except on Thursday, when Sam stands in', () => {
    const a = opened(); const e = evt(a, 'Run'); expect(e.owner).toBe('exA');
    expect(e.slots.map(s => [s.day, s.person, !!s.fo])).toEqual([[0, 'exA', true], [1, 'exA', true], [2, 'exA', true], [3, 'exS', false], [4, 'exA', true]]);
    expect(box(a, 3, 'School drop-off').getAttribute('aria-label')).toContain('By: Sam');
  });
  it('a rota: the shop shift alternates Alex and Sam, three turns each, each day in the colour of whoever does it', () => {
    const a = opened(); expect(a.ev("[...turnsOf(state.S.events.find(e=>e.id==='exShift')).entries()]")).toEqual([['exA', [3]], ['exS', [3]]]);
    expect(evt(a, 'Shift').slots.every(s => s.col === 'p')).toBe(true);
  });
  it('clashes: Dentist and Football share Olivia on Wednesday, Stock-taking meets the dinner nobody is responsible for on Tuesday; both are striped', () => {
    const a = opened(); expect(a.qa('.day[data-d="2"] .ov:not(.awov)')).toHaveLength(1); expect(a.qa('.day[data-d="1"] .ov:not(.awov)')).toHaveLength(1);
    expect(box(a, 2, 'Dentist').dataset.lane).toBe(box(a, 2, 'Football').dataset.lane); expect(box(a, 1, 'Family dinner').dataset.lane).toBeUndefined();
  });
  it('no clash: Gym and Cooking share nobody and sit side by side on Monday; the delivery, with Sam only on call, sits beside Sam\'s shift', () => {
    const a = opened(); expect([box(a, 0, 'Gym').dataset.lane, box(a, 0, 'Cooking').dataset.lane].sort()).toEqual(['0/2', '1/2']);
    expect(a.qa('.day[data-d="0"] .ov')).toHaveLength(0); expect(evt(a, 'Deliv')).toMatchObject({ oncall: true, involved: ['exS'] });
    expect(box(a, 1, 'Delivery').dataset.lane).not.toBe(box(a, 1, 'Shop shift').dataset.lane); expect(a.ev("state.S.people.filter(p=>p.external).map(p=>p.name)")).toEqual(['Rosa', 'Dan']);
  });
  it('flexible times: Homework is Around these times, the delivery has a flexible start and the laundry a flexible end', () => {
    const a = opened(); expect(evt(a, 'Hw').slots.every(s => s.flex)).toBe(true); expect(box(a, 0, 'Homework').getAttribute('aria-label')).toContain('Flexible time (around these times)');
    expect(box(a, 1, 'Delivery').getAttribute('aria-label')).toContain('Start between 10:00 and 10:30'); expect(box(a, 0, 'Laundry').getAttribute('aria-label')).toContain('Finish between 16:00 and 17:00');
  });
  it('background strips, Away and its clash: Screen-free time and the cleaner are strips; Swimming, planned while Olivia is away, is striped with ⚠', () => {
    const a = opened(); expect(a.qa('.day[data-d="3"] .bgs').map(b => b.textContent)).toEqual(['Screen-free time', 'Cleaner at work']);
    expect(a.q('.day[data-d="5"] .bgs.aw').textContent).toBe("At grandma's"); expect(a.qa('.day[data-d="5"] .awov')).toHaveLength(1);
    expect(box(a, 5, 'Swimming').getAttribute('aria-label')).toContain("Olivia is away (At grandma's)"); expect(box(a, 5, 'Swimming').querySelector('.flags b')).not.toBeNull();
  });
  it('a small task done along the way: Buy bread is drawn inside the dog walk on Saturday and stands alone on Wednesday', () => {
    const a = opened(); expect(box(a, 5, 'Buy bread').classList.contains('nest')).toBe(true); expect(box(a, 2, 'Buy bread').classList.contains('nest')).toBe(false);
  });
  it('a day of its own With: on Sunday Olivia helps with the cooking', () => {
    const a = opened(); expect(box(a, 6, 'Cooking').getAttribute('aria-label')).toContain('With: Olivia'); expect(box(a, 5, 'Cooking').getAttribute('aria-label')).not.toContain('With:');
  });
  it('activity types: every default type is used, and Water the plants has none, for the highlight and the No type line', () => {
    const a = opened(); expect(a.ev('state.S.types.every(t=>state.S.events.some(e=>e.type===t.id))')).toBe(true); expect(evt(a, 'Plant').type).toBeUndefined();
  });
  it('built in Spanish, the workspace, its schedules and events are in Spanish', () => {
    const a = fresh({ languages: ['es-ES'] }); a.ev('openExamples()'); expect(names(a)).toEqual(['Espacio de trabajo', 'Ejemplos']);
    expect(a.ev('state.S.schedules.map(s=>s.name)')).toEqual(['Casa', 'Tienda']); expect(evt(a, 'Run').title).toBe('Llevar al colegio'); expect(evt(a, 'Run').desc).toMatch(/^Titular y quién lo hace/);
  });
});
