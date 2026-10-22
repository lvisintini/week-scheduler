import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, sched, ev1, WS_KEY, PREFS_KEY } from '../helpers/app.js';

const fresh = (o = {}) => openApp({ promptAnswer: 'Second', ...o });
const names = a => a.ev('WS.map(w=>w.name)');
const menu = a => a.qa('.omenu .oi').map(b => b.textContent.replace(/\s+/g, ' ').trim());
const menuClick = (a, label) => a.qa('.omenu .oi').find(b => b.textContent.trim().startsWith(label)).click();
const openMenu = a => a.q('.wsbtn').click();
const store = a => JSON.parse(a.w.localStorage.getItem(WS_KEY));
const twoWs = (o = {}) => { const a = fresh(o); a.ev('addWorkspace();switchWs(WS[0].id)'); return a; };

describe('R-DATA-01 Workspaces: independent data sets in one browser', () => {
  it('a first start has a single workspace called "Workspace" shown in the switcher under the title', () => {
    const a = fresh(); expect(names(a)).toEqual(['Workspace']); expect(a.q('.wsbtn .wsn').textContent).toBe('Workspace');
  });
  it('the switcher menu lists the workspaces and offers New, Rename, Duplicate, the cycle of weeks and Delete (R-CYC-01)', () => {
    const a = twoWs(); openMenu(a); expect(menu(a)).toEqual(['Workspace', 'Second', 'Workspaces…', 'New workspace…', 'Rename current…', 'Duplicate current', 'Weeks in the cycle…', 'Delete current…']);
  });
  it('the current workspace is marked with a tick in the menu', () => {
    const a = twoWs(); openMenu(a); expect(a.qa('.omenu .oi')[0].querySelector('svg')).not.toBeNull(); expect(a.qa('.omenu .oi')[1].querySelector('svg')).toBeNull();
  });
  it('"New workspace…" asks for a name, creates a fresh default workspace and switches to it', () => {
    const a = fresh(); openMenu(a); menuClick(a, 'New workspace'); expect(names(a)).toEqual(['Workspace', 'Second']); expect(a.ev('cw().name')).toBe('Second'); expect(a.ev('S.schedules[0].name')).toBe('Routine'); expect(a.ev('S.phases.length')).toBe(7); expect(a.ev('S.types.length')).toBe(9);
  });
  it('a name that already exists is made unique with (2)', () => {
    const a = fresh({ promptAnswer: 'Workspace' }); a.ev('addWorkspace()'); expect(names(a)).toEqual(['Workspace', 'Workspace (2)']);
  });
  it('cancelling the name prompt creates nothing', () => {
    const a = fresh({ promptAnswer: null }); a.ev('addWorkspace()'); expect(names(a)).toEqual(['Workspace']);
  });
  it('workspaces are independent: changes in one never show in another', () => {
    const a = twoWs(); a.ev('S.schedules[0].name="Only in first"'); a.ev('switchWs(WS[1].id)'); expect(a.ev('S.schedules[0].name')).toBe('Routine'); a.ev('switchWs(WS[0].id)'); expect(a.ev('S.schedules[0].name')).toBe('Only in first');
  });
  it('every workspace keeps its own undo history', () => {
    const a = twoWs(); a.ev('hist();S.schedules[0].name="A edited"'); a.ev('switchWs(WS[1].id)'); a.toolbar('undo').click(); expect(a.ev('S.schedules[0].name')).toBe('Routine');
    a.ev('switchWs(WS[0].id)'); a.toolbar('undo').click(); expect(a.ev('S.schedules[0].name')).toBe('Routine'); expect(a.ev('undoSt.length')).toBe(0);
  });
  it('switching clears the selection and redraws the grid with the other workspace\'s events', () => {
    const a = twoWs(); setData(a, blank({ events: [ev1()] })); expect(a.qa('.ev')).toHaveLength(1); a.ev('switchWs(WS[1].id)'); expect(a.qa('.ev')).toHaveLength(0);
  });
  it('"Rename current…" renames the workspace', () => {
    const a = fresh({ promptAnswer: 'Granny care' }); a.ev('renameWorkspace()'); expect(a.ev('cw().name')).toBe('Granny care'); expect(a.q('.wsbtn .wsn').textContent).toContain('Granny care');
  });
  it('"Duplicate current" copies all data into a new, unsaved workspace', () => {
    const a = fresh(); a.ev('S.schedules[0].name="Original"'); a.ev('duplicateWorkspace()');
    expect(names(a)).toEqual(['Workspace', 'Workspace (copy)']); expect(a.ev('S.schedules[0].name')).toBe('Original'); expect(a.ev('isDirty()')).toBe(true);
    a.ev('S.schedules[0].name="Changed"'); a.ev('switchWs(WS[0].id)'); expect(a.ev('S.schedules[0].name')).toBe('Original');
  });
  it('"Delete current…" asks for confirmation naming the workspace, deletes it and shows a neighbour', () => {
    const a = twoWs({ promptAnswer: 'Second' }); a.ev('deleteWorkspace()'); expect(a.log.confirms[0]).toContain('Delete workspace "Workspace"'); expect(names(a)).toEqual(['Second']); expect(a.ev('cw().name')).toBe('Second');
  });
  it('declining the confirmation keeps the workspace', () => {
    const a = twoWs({ confirmAnswer: false }); a.ev('deleteWorkspace()'); expect(names(a)).toEqual(['Workspace', 'Second']);
  });
  it('the only workspace cannot be deleted', () => {
    const a = fresh(); a.ev('deleteWorkspace()'); expect(names(a)).toEqual(['Workspace']); expect(a.toast()).toContain("You can't delete the only workspace");
  });
  it('workspaces with unsaved changes are marked with a bullet in the switcher, the menu and the title', () => {
    const a = twoWs(); a.ev('S.schedules[0].name="edited"'); a.ev('render()');
    expect(a.q('.wsbtn .wsn').textContent).toContain('•'); expect(a.q('.ttl').textContent).toContain('•'); openMenu(a); expect(menu(a)[0]).toContain('•');
  });
  it('a workspace is no longer marked after it has been saved', () => {
    const a = fresh(); a.ev('S.schedules[0].name="edited";saveMem("current")'); expect(a.ev('anyDirty()')).toBe(false); expect(a.q('.ttl').textContent).not.toContain('•');
  });
});

describe('R-DATA-02 Saving to browser memory: one workspace or all', () => {
  it('the Save dialog offers browser memory, a JSON file and a shareable link', () => {
    const a = fresh(); a.toolbar('save').click(); expect(a.dlgButtons()).toEqual(['Browser memory', 'JSON file', 'Shareable link', 'Cancel']);
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
    a.ev('switchWs(WS[1].id);S.schedules[0].name="B changed"'); a.ev('switchWs(WS[0].id);S.schedules[0].name="A changed"');
    a.chooseSave('Browser memory'); await a.sleep(20); a.click('Only "Workspace"');
    const s = store(a); expect(s.workspaces.map(w => w.schedules[0].name)).toEqual(['A changed', 'Routine']); expect(a.ev('wsDirty(WS[1])')).toBe(true); expect(a.ev('wsDirty(WS[0])')).toBe(false);
  });
  const three = () => { const a = fresh(); a.ev('addWorkspace();addWorkspace();switchWs(WS[0].id)'); return a; };
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
    expect(names(a)).toEqual(['Alpha', 'Beta']); expect(a.ev('cw().name')).toBe('Beta'); expect(a.ev('S.schedules[0].name')).toBe('sb'); expect(a.ev('anyDirty()')).toBe(false);
  });
  it('an unknown "current" id falls back to the first workspace', () => {
    const a = openApp({ storage: { [WS_KEY]: JSON.stringify({ version: 1, current: 'zzz', workspaces: [wsRec('a', 'Alpha', 'sa')] }) } }); expect(a.ev('cw().id')).toBe('a');
  });
  it('workspace ids and names survive a save and reload', () => {
    const a = fresh(); a.ev('addWorkspace()'); a.ev('saveMem("all")'); const b = openApp({ storage: a.storage() }); expect(names(b)).toEqual(['Workspace', 'Second']); expect(b.ev('cw().id')).toBe(a.ev('cw().id'));
  });
  it('Load → Browser memory reverts the current workspace to its saved copy (and can be undone)', () => {
    const a = fresh(); a.ev('saveMem("current")'); a.ev('S.schedules[0].name="unsaved edit"'); a.toolbar('load').click(); a.click('Browser memory');
    expect(a.ev('S.schedules[0].name')).toBe('Routine'); expect(a.toast()).toBe('Loaded from browser memory'); a.toolbar('undo').click(); expect(a.ev('S.schedules[0].name')).toBe('unsaved edit');
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
    expect(a.w.localStorage.getItem(WS_KEY)).toBeNull(); expect(names(a)).toEqual(['Workspace']); expect(a.ev('undoSt.length')).toBe(0); expect(a.toast()).toContain('restarted');
  });
  it('declining Clear memory changes nothing', () => {
    const a = twoWs({ confirmAnswer: false }); a.ev('saveMem("all");clearMem()'); expect(a.w.localStorage.getItem(WS_KEY)).not.toBeNull(); expect(names(a)).toEqual(['Workspace', 'Second']);
  });
  it('Clear memory keeps the view preferences (theme, zoom, sidebar)', () => {
    const a = fresh(); a.ev('prefs.theme="dark";savePrefs();saveMem("current");clearMem()'); expect(a.w.localStorage.getItem(PREFS_KEY)).toContain('dark');
  });
  it('Restart asks only when there are unsaved changes, and then reloads what is saved in browser memory', () => {
    const a = fresh(); a.ev('saveMem("current")'); a.ev('restart()'); expect(a.log.confirms).toEqual([]);
    a.ev('S.schedules[0].name="unsaved"'); a.ev('restart()'); expect(a.log.confirms[0]).toContain('Discard all unsaved changes'); expect(a.ev('S.schedules[0].name')).toBe('Routine');
  });
  it('declining Restart keeps the unsaved changes', () => {
    const a = fresh({ confirmAnswer: false }); a.ev('S.schedules[0].name="unsaved";restart()'); expect(a.ev('S.schedules[0].name')).toBe('unsaved');
  });
  it('leaving the page is blocked with the browser warning while any workspace has unsaved changes', () => {
    const a = twoWs(); expect(quit(a)).toBe(false); a.ev('S.schedules[0].name="x"'); expect(quit(a)).toBe(true);
  });
  it('the warning also covers a workspace that is not the one currently shown', () => {
    const a = twoWs(); a.ev('S.schedules[0].name="x";switchWs(WS[1].id)'); expect(quit(a)).toBe(true);
  });
  it('after saving everything the warning disappears', () => {
    const a = twoWs(); a.ev('S.schedules[0].name="x";saveMem("all")'); expect(quit(a)).toBe(false);
  });
  it('changing only view settings (eyes, zoom, theme) never triggers the warning', () => {
    const a = fresh(); a.ev('saveMem("current")'); a.ev('S.schedules[0].visible=false;prefs.rowH=90;prefs.theme="dark";render()'); expect(quit(a)).toBe(false);
  });
});

describe('R-DATA-06 View settings belong to the browser, not to the workspace data', () => {
  it('prefs are stored under their own key and are not part of the saved workspaces', () => {
    const a = fresh(); a.ev('prefs.showEarly=true;prefs.clock12=true;prefs.theme="dark";savePrefs();saveMem("all")');
    const p = JSON.parse(a.w.localStorage.getItem(PREFS_KEY)); expect(p).toMatchObject({ showEarly: true, clock12: true, theme: 'dark' });
    expect(a.w.localStorage.getItem(WS_KEY)).not.toMatch(/showEarly|clock12|theme|hideWeekend|rowH/);
  });
  it('the preferences come back after a reload', () => {
    const a = fresh(); a.ev('prefs.showEarly=true;prefs.hideWeekend=true;prefs.clock12=true;savePrefs()'); const b = openApp({ storage: a.storage() });
    expect([b.ev('prefs.showEarly'), b.ev('prefs.hideWeekend'), b.ev('prefs.clock12')]).toEqual([true, true, true]);
  });
  it('exported files never contain view preferences', async () => {
    const a = fresh(); a.ev('prefs.showEarly=true;prefs.theme="dark"'); const f = a.ev('buildFile()'); expect(Object.keys(f)).not.toContain('prefs'); expect(JSON.stringify(f)).not.toMatch(/showEarly|theme|clock12|hideWeekend/);
  });
  it('a corrupt preferences entry is ignored and defaults are used', () => {
    const a = openApp({ storage: { [PREFS_KEY]: '{not json' } }); expect(a.ev('prefs.theme')).toBe('auto'); expect(a.ev('prefs.rowH')).toBe(48);
  });
  it('the sidebar width and collapsed state, and the collapsed sections, are remembered too', () => {
    const a = fresh(); a.ev('prefs.w=333;prefs.collapsed=true;prefs.secPpl=true;savePrefs()'); const b = openApp({ storage: a.storage() });
    expect(b.ev('prefs.w')).toBe(333); expect(b.q('#sb').classList.contains('collapsed')).toBe(true); expect(b.ev('prefs.secPpl')).toBe(true);
  });
});

describe('R-DATA-10 Workspaces have a colour and a description, and this browser keeps their order', () => {
  const threeWs = () => { const a = fresh(); a.ev("addWorkspace();WS[1].name='Work';const t=newWs('Club',defaultData(),true);WS.push(t);switchWs(WS[0].id);cw().name='Home'"); return a; };
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
    a.click('Apply'); expect(names(a)).toEqual(['Club', 'Home', 'Office']); expect(a.ev('S.desc')).toBe('Our routine'); expect(a.ev('undoSt.length')).toBe(1); expect(a.ev('WS[2].undo.length')).toBe(0);
    expect(JSON.parse(a.w.localStorage.getItem(PREFS_KEY)).wsOrder).toEqual(a.ev('WS.map(w=>w.id)')); expect(a.ev('isDirty()')).toBe(true);
    a.ev('undo()'); expect(a.ev('S.desc')).toBeUndefined();
  });
  it('the order survives a reload of browser memory; workspaces it does not know go last', () => {
    const a = threeWs(); a.ev("saveMem('all');prefs.wsOrder=[WS[2].id,WS[0].id];savePrefs();loadStore();render()"); expect(names(a)).toEqual(['Club', 'Home', 'Work']);
  });
  it('the colour marks the workspace button, the menu and printouts; the description is the button\'s tooltip and is shown in the menu', () => {
    const a = threeWs(); a.ev("hist();S.color='#e5484d';S.desc='Our routine';render()");
    expect(a.q('.wsbtn').classList.contains('wscol')).toBe(true); expect(a.q('.wsbtn').title).toContain('Our routine');
    openMenu(a); const b = a.qa('.omenu .oi')[0]; expect(b.querySelector('.wkchip')).not.toBeNull(); expect(b.querySelector('.wkd').textContent).toBe('Our routine');
    a.ev('printSchedule()'); expect(a.w.__printed).toContain('class="wkchip" style="background:#e5484d"');
  });
  it('colour and description travel in files; parsing keeps a hex colour and a trimmed text only; anonymised copies drop the description', () => {
    const a = threeWs(); a.ev("S.color='#e5484d';S.desc='  Our routine  '"); expect(a.ev('buildFile().color')).toBe('#e5484d');
    expect(a.ev("JSON.stringify(parseData({schedules:[],events:[],color:'red;x',desc:'  hi  '}))")).toContain('"desc":"hi"'); expect(a.ev("parseData({schedules:[],events:[],color:'red;x'}).color")).toBeUndefined();
    expect(a.ev('anonymised(buildFile()).desc')).toBeUndefined(); expect(a.ev('anonymised(buildFile()).color')).toBe('#e5484d');
  });
  it('the Workspaces dialog and its menu item are translated into Spanish', async () => {
    const a = threeWs(); a.ev("lang='es'"); openMenu(a); menuClick(a, 'Espacios de trabajo…'); await a.sleep(5); expect(a.dlgTitle()).toBe('Espacios de trabajo');
  });
});
