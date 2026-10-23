import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, ev1, workspace, pointer } from '../helpers/app.js';

const fresh = (data, o = {}) => { const a = openApp(o); if (data) setData(a, data); return a; };
const types = () => [{ id: 'tf', name: 'Free time', color: '#12a5b5', icon: 'sun', soft: true }, { id: 'tm', name: 'Meal', color: '#e8912d', icon: 'meal' }];
const iconHTML = (a, k) => a.ev(`(()=>{const d=document.createElement("span");d.innerHTML=tIcon(${JSON.stringify(k)});return d.innerHTML})()`);   // as the browser serialises it
const tySec = a => a.q('#sbin .tysec');
const rows = a => [...tySec(a).querySelectorAll('.sch')];
const data = a => a.ev('JSON.parse(JSON.stringify(state.S))');
const menu = (a, i) => { [...rows(a)[i].querySelectorAll('button.eye')].at(-1).click(); return a.qa('.omenu .oi').map(b => b.textContent.trim()); };
const menuClick = (a, label) => a.qa('.omenu .oi').find(b => b.textContent.trim() === label).click();

describe('R-TYP-01 Activity types are managed in their own sidebar section', () => {
  it('the section is called "Activity types", sits between People and Rhythms and shows the count', () => {
    const a = fresh(blank({ types: types() })); const names = a.qa('#sbin .sec .shbtn span').map(s => s.textContent);
    expect(names.indexOf('Activity types')).toBe(names.indexOf('People') + 1); expect(tySec(a).querySelector('.shbtn em').textContent).toBe('2');
  });
  it('each row shows a grip, an eye, the type icon in its colour, an editable name and the ⋯ menu', () => {
    const a = fresh(blank({ types: types() })); const r = rows(a)[1];
    expect(r.querySelector('.pick').innerHTML).toBe(iconHTML(a, 'meal')); expect(r.querySelector('.pick').style.color).toMatch(/#e8912d|rgb\(232, 145, 45\)/);
    expect(r.querySelector('input').value).toBe('Meal'); expect(r.querySelector('input').getAttribute('aria-label')).toBe('Activity types'); expect([...r.children].map(c => c.className)).toEqual(['grip', 'eye', 'ic pick', '', 'eye']); expect(r.querySelector('.eye').title).toBe(a.ev("L('eyeTip')"));
  });
  it('+ asks for a name and adds a type with the plain dot icon (undoable)', () => {
    const a = fresh(blank({ types: types() }), { promptAnswer: 'Homework' }); tySec(a).querySelector('.sech .eye').click();
    expect(data(a).types.at(-1)).toMatchObject({ name: 'Homework', icon: 'dot' }); a.toolbar('undo').click(); expect(data(a).types).toHaveLength(2);
  });
  it('an empty or cancelled name adds nothing', () => {
    const a = fresh(blank({ types: types() }), { promptAnswer: '  ' }); tySec(a).querySelector('.sech .eye').click(); expect(data(a).types).toHaveLength(2);
  });
  it('renaming in the row changes the name everywhere (event dialog list, hover card)', () => {
    const a = fresh(blank({ types: types(), events: [ev1({ type: 'tm' })] })); const n = rows(a)[1].querySelector('input'); n.value = 'Lunch & dinner'; n.onchange();
    expect(data(a).types[1].name).toBe('Lunch & dinner'); a.ev('openDlg(state.S.events[0])'); expect(a.q('#fTy').selectedOptions[0].textContent).toBe('Lunch & dinner');
  });
  it('clicking the icon opens a grid of all built-in icons with names; picking one changes the type icon (undoable)', () => {
    const a = fresh(blank({ types: types() })); rows(a)[1].querySelector('.pick').click();
    const btns = a.qa('.omenu .igrid button'); expect(btns.length).toBe(a.ev('Object.keys(TICONS).length')); expect(a.q('.omenu .igrid button.on').title).toBe('Cutlery');
    btns.find(b => b.title === 'Coffee' || b.title === 'Cup').click(); expect(data(a).types[1].icon).toBe('coffee'); expect(a.q('.omenu')).toBeNull();
    a.toolbar('undo').click(); expect(data(a).types[1].icon).toBe('meal');
  });
  it('the row menu offers the colour, the icon, the soft look and delete', () => {
    const a = fresh(blank({ types: types() })); expect(menu(a, 0)).toEqual(['Colour…', 'Icon…', 'Soft look', 'Delete']);
  });
  it('the soft-look item is ticked for soft types and toggles the look of their events', () => {
    const a = fresh(blank({ types: types(), events: [ev1({ type: 'tm' })] })); menu(a, 1); expect(a.qa('.omenu .oi')[2].querySelector('svg')).toBeNull();
    expect(a.qa('.omenu .oi')[2].title).toContain('light tint'); menuClick(a, 'Soft look'); expect(data(a).types[1].soft).toBe(true); expect(a.q('.ev').classList.contains('soft')).toBe(true);
    menu(a, 1); expect(a.qa('.omenu .oi')[2].querySelector('svg')).not.toBeNull(); menuClick(a, 'Soft look'); expect('soft' in data(a).types[1]).toBe(false);
  });
  it('by default the type colour is not used on the grid: changing it does not change the event colour', () => {
    const a = fresh(blank({ types: types(), events: [ev1({ type: 'tm', color: '#3b6df0' })] })); a.ev('state.S.types[1].color="#000000";render()');
    expect(a.q('.ev').style.background).toMatch(/#3b6df0|rgb\(59, 109, 240\)/);
  });
  it('deleting a type asks first, says how many events lose it, and leaves those events without a type (undoable)', () => {
    const a = fresh(blank({ types: types(), events: [ev1({ type: 'tm' }), ev1({ id: 'e2', type: 'tm' })] })); menu(a, 1); menuClick(a, 'Delete');
    expect(a.log.confirms.at(-1)).toBe('Delete the activity type "Meal"? 2 event(s) will have no type.'); expect(data(a).types.map(t => t.id)).toEqual(['tf']);
    expect(data(a).events.every(e => !('type' in e))).toBe(true); a.toolbar('undo').click(); expect(data(a).events.map(e => e.type)).toEqual(['tm', 'tm']);
  });
  it('a refused confirmation deletes nothing', () => {
    const a = fresh(blank({ types: types() }), { confirmAnswer: false }); menu(a, 0); menuClick(a, 'Delete'); expect(data(a).types).toHaveLength(2);
  });
  it('types are data: changing them marks the workspace unsaved', () => {
    const a = fresh(blank({ types: types() })); a.ev('saveMem("all")'); expect(a.ev('isDirty()')).toBe(false);
    const n = rows(a)[0].querySelector('input'); n.value = 'Leisure'; n.onchange(); expect(a.ev('isDirty()')).toBe(true);
  });
  it('the section can be collapsed like the others (remembered per browser)', () => {
    const a = fresh(blank({ types: types() })); tySec(a).querySelector('.shbtn').click(); expect(rows(a)).toHaveLength(0); expect(a.ev('state.prefs.secTyp')).toBe(true);
  });
  it('the section, its tooltip and its menu are translated', () => {
    const a = fresh(blank({ types: types() }), { languages: ['es'] });
    expect(tySec(a).querySelector('.shbtn span').textContent).toBe('Tipos de actividad'); expect(tySec(a).querySelector('.tip').title).toContain('estadísticas');
    expect(menu(a, 0)).toEqual(['Color…', 'Icono…', 'Aspecto suave', 'Eliminar']);
  });
});

describe('R-TYP-02 Default activity types and the built-in icon set', () => {
  it('a new workspace has nine types: Sleep, Meal, Work/School, Focus time, Chore, Free time, Social, Personal care and Travel', () => {
    const a = openApp(); expect(a.ev('state.S.types.map(t=>t.name)')).toEqual(['Sleep', 'Meal', 'Work/School', 'Focus time', 'Chore', 'Free time', 'Social', 'Personal care', 'Travel']);
    expect(a.ev("state.S.types.find(t=>t.name==='Social')")).toMatchObject({ icon: 'people', color: '#e5484d' }); expect(a.ev("'soft' in state.S.types.find(t=>t.name==='Social')")).toBe(false);
  });
  it('only Free time has the soft look; every default type has its own icon and a valid colour', () => {
    const a = openApp(); const t = a.ev('JSON.parse(JSON.stringify(state.S.types))');
    expect(t.filter(x => x.soft).map(x => x.name)).toEqual(['Free time']); expect(new Set(t.map(x => x.icon)).size).toBe(9); t.forEach(x => expect(x.color).toMatch(/^#[0-9a-f]{6}$/));
    expect(t.find(x => x.name === 'Free time').icon).toBe('sun'); expect(t.find(x => x.name === 'Sleep').icon).toBe('moon');
  });
  it('in Spanish the default types are Spanish', () => {
    const a = openApp({ languages: ['es'] }); expect(a.ev('state.S.types.map(t=>t.name)')).toEqual(['Dormir', 'Comida', 'Trabajo/Escuela', 'Concentración', 'Tarea doméstica', 'Tiempo libre', 'Vida social', 'Cuidado personal', 'Desplazamiento']);
  });
  it('New workspace and Clear memory start with the default types', () => {
    const a = openApp({ promptAnswer: 'Second' }); a.ev('addWorkspace()'); expect(a.ev('state.S.types.length')).toBe(9);
    a.ev('state.S.types=[];clearMem()'); expect(a.ev('state.S.types.length')).toBe(9);
  });
  it('the icon set has about forty inline SVG icons, each with an English and a Spanish name', () => {
    const a = openApp(); const keys = a.ev('Object.keys(TICONS)'); expect(keys.length).toBeGreaterThanOrEqual(40);
    keys.forEach(k => { expect(a.ev(`TYN.en[${JSON.stringify(k)}]`)).toBeTruthy(); expect(a.ev(`TYN.es[${JSON.stringify(k)}]`)).toBeTruthy(); expect(a.ev(`tIcon(${JSON.stringify(k)})`)).toMatch(/^<svg viewBox="0 0 24 24"/); });
    expect(new Set(keys.map(k => a.ev(`TYN.en[${JSON.stringify(k)}]`))).size).toBe(keys.length);
  });
  it('the icons draw only shapes (no images, links or scripts, which the CSP would block anyway)', () => {
    const a = openApp(); a.ev('Object.values(TICONS)').forEach(p => expect(p).not.toMatch(/<(image|use|script|a|foreignObject)\b|href|on\w+=/i));
  });
});

describe('R-TYP-03 Activity types in saved data, imports and transfers', () => {
  it('types are saved in browser memory, files and links as part of the workspace', () => {
    const a = fresh(blank({ types: types() })); expect(a.ev('buildFile().types.map(t=>t.id)')).toEqual(['tf', 'tm']);
    a.ev('saveMem("all")'); expect(JSON.parse(a.storage()['weekly-schedules-workspaces']).workspaces[0].types).toHaveLength(2);
  });
  it('validation: names are capped, colours must be hex, unknown icons become the dot, soft only counts when true', () => {
    const a = openApp(); const t = a.ev(`parseData(${JSON.stringify(blank({ types: [{ id: 'x', name: 'n'.repeat(300), color: 'red;x', icon: '<script>', soft: 'yes' }] }))}).types[0]`);
    expect(t.name).toHaveLength(200); expect(t.color).toMatch(/^#[0-9a-f]{6}$/); expect(t.icon).toBe('dot'); expect('soft' in t).toBe(false);
  });
  it('an event pointing at a type that does not exist loses the reference', () => {
    const a = openApp(); const e = a.ev(`parseData(${JSON.stringify(blank({ types: types(), events: [ev1({ type: 'nope' }), ev1({ id: 'e2', type: 'tm' })] }))}).events`);
    expect('type' in e[0]).toBe(false); expect(e[1].type).toBe('tm');
  });
  it('imports are refused above 100 types', () => {
    const a = openApp(); const many = Array.from({ length: 101 }, (_, i) => ({ id: 't' + i, name: 'T' + i, color: '#000000', icon: 'dot' }));
    expect(() => a.ev(`parseData(${JSON.stringify(blank({ types: many }))},true)`)).toThrow(/limit/); expect(a.ev('LIM.types')).toBe(100);
  });
  it('inserting a file into the current workspace matches types by name (case-insensitive) and creates the missing ones', async () => {
    const a = fresh(blank({ types: [{ id: 'mine', name: 'meal', color: '#000000', icon: 'cook' }] }));
    a.d.getElementById('file').onchange({ target: { files: [{ name: 'x.json', text: async () => JSON.stringify(workspace({ types: types(), events: [ev1({ id: 'e1', schedules: ['s1'], type: 'tm' }), ev1({ id: 'e2', schedules: ['s1'], type: 'tf' })] })) }], value: '' } });
    await a.sleep(30); a.qa('#xDlg input[name=impm]').find(r => r.value === 'insert').checked = true; a.click('Import');
    const d = data(a); expect(d.types.map(t => t.name)).toEqual(['meal', 'Free time']); expect(d.events.map(e => d.types.find(t => t.id === e.type).name)).toEqual(['meal', 'Free time']);
  });
  it('copying a schedule to another workspace brings the types its events use, matched by name', () => {
    const a = fresh(blank({ types: types(), events: [ev1({ type: 'tf' })] }));
    a.ev('const b=newWs("Other",{schedules:[],people:[],types:[{id:"o1",name:"FREE TIME",color:"#000000",icon:"dot"}],events:[],rhythms:[],phases:[],phaseOpacity:.3},true);state.WS.push(b)');
    a.ev('doTransfer("schedule",state.S.schedules[0],state.WS[1],false)'); const o = a.ev('JSON.parse(JSON.stringify(state.WS[1].data))');
    expect(o.types.map(t => t.id)).toEqual(['o1']); expect(o.events[0].type).toBe('o1');
  });
  it('a type missing in the target workspace is created there; unused types are not copied', () => {
    const a = fresh(blank({ types: types(), events: [ev1({ type: 'tm' })] }));
    a.ev('const b=newWs("Other",{schedules:[],people:[],types:[],events:[],rhythms:[],phases:[],phaseOpacity:.3},true);state.WS.push(b)');
    a.ev('doTransfer("schedule",state.S.schedules[0],state.WS[1],false)'); const o = a.ev('JSON.parse(JSON.stringify(state.WS[1].data))');
    expect(o.types.map(t => [t.name, t.icon])).toEqual([['Meal', 'meal']]); expect(o.events[0].type).toBe(o.types[0].id); expect(o.types[0].id).not.toBe('tm');
  });
  it('anonymised exports keep the type names (like schedule names)', () => {
    const a = fresh(blank({ types: types() })); expect(a.ev('anonymised(buildFile()).types.map(t=>t.name)')).toEqual(['Free time', 'Meal']);
  });
});

describe('R-TYP-04 Activity types can be hidden and shown with their eye (a grid filter, like the people filter)', () => {
  const evs = () => [ev1({ id: 'm', title: 'Lunch', type: 'tm', slots: [{ day: 0, start: 720, end: 780, person: '' }] }), ev1({ id: 'f', title: 'Park', type: 'tf', slots: [{ day: 1, start: 600, end: 660, person: '' }] }),
    ev1({ id: 'u', title: 'Untyped', slots: [{ day: 2, start: 600, end: 660, person: '' }] }), ev1({ id: 'b', title: 'Screens', type: 'tm', bg: true, slots: [{ day: 3, start: 600, end: 660, person: '' }] })];
  const titles = a => a.qa('.ev .t, .bgs span').map(x => x.textContent);
  const eye = (a, i) => rows(a)[i].querySelector('.eye');
  it('every type is shown at first; clicking its eye hides its boxes and strips, and clicking again shows them', () => {
    const a = fresh(blank({ types: types(), events: evs() })); expect(titles(a).sort()).toEqual(['Lunch', 'Park', 'Screens', 'Untyped']);
    eye(a, 1).click(); expect(titles(a).sort()).toEqual(['Park', 'Untyped']); expect(rows(a)[1].classList.contains('off')).toBe(true); expect(data(a).types[1].visible).toBe(false);
    eye(a, 1).click(); expect(titles(a)).toHaveLength(4); expect(rows(a)[1].classList.contains('off')).toBe(false);
  });
  it('events without a type are always shown, even with every type hidden', () => {
    const a = fresh(blank({ types: types(), events: evs() })); eye(a, 0).click(); eye(a, 1).click(); expect(titles(a)).toEqual(['Untyped']);
  });
  it('hidden types are not clickable, not in the day agenda and not counted as "N hidden"', () => {
    const a = fresh(blank({ types: types(), events: evs() })); eye(a, 1).click();
    expect(a.ev('itemsAt(0,750,0.5).length')).toBe(0); a.ev('openAgenda(0)'); expect(a.q('#agBody').textContent).not.toContain('Lunch'); expect(a.q('#hid').style.display).toBe('none');
  });
  it('the statistics still count the events of a hidden type', () => {
    const p = [{ id: 'A', name: 'Ann', color: '#e5484d', visible: true }], e = [ev1({ id: 'm', type: 'tm', slots: [{ day: 0, start: 720, end: 780, person: 'A' }] })];
    const a = fresh(blank({ types: types(), people: p, events: e })); const before = a.ev("personStats('A',true).by.get('tm')");
    eye(a, 1).click(); expect(a.ev("personStats('A',true).by.get('tm')")).toBe(before); expect(before).toBe(60);
  });
  it('the eye is view state: not undoable and not an unsaved change, and undo keeps it', () => {
    const a = fresh(blank({ types: types(), events: evs() })); a.ev('saveMem("all")'); eye(a, 1).click(); expect(a.ev('isDirty()')).toBe(false); expect(a.ev('state.undoSt.length')).toBe(0);
    const n = rows(a)[0].querySelector('input'); n.value = 'Leisure'; n.onchange(); a.toolbar('undo').click(); expect(data(a).types[1].visible).toBe(false);
  });
  it('the eye is saved with the workspace and read back; data without it shows every type', () => {
    const a = fresh(blank({ types: types(), events: evs() })); eye(a, 1).click(); a.ev('saveMem("all")');
    const b = openApp({ storage: a.storage() }); expect(b.ev('state.S.types.map(t=>t.visible)')).toEqual([true, false]); expect(b.qa('.ev .t').map(x => x.textContent).sort()).toEqual(['Park', 'Untyped']);
    expect(a.ev(`parseData(${JSON.stringify(blank({ types: types() }))}).types.map(t=>t.visible)`)).toEqual([true, true]);
  });
  it('a type created by "+" or brought in by an insert is shown', () => {
    const a = fresh(blank({ types: types() }), { promptAnswer: 'Homework' }); tySec(a).querySelector('.sech .eye').click(); expect(data(a).types.at(-1).visible).toBe(true);
    a.ev(`insertInto(parseData(${JSON.stringify(blank({ types: [{ id: 'x', name: 'Music', color: '#000000', icon: 'music', visible: false }] }))}))`); expect(data(a).types.at(-1)).toMatchObject({ name: 'Music', visible: true });
  });
});

describe('R-TYP-05 Activity types can be reordered; the order is used by the statistics and the event dialog', () => {
  const three = () => fresh(blank({ people: [{ id: 'A', name: 'Ann', color: '#e5484d', visible: true }],
    types: [{ id: 'ta', name: 'Sleep', color: '#3f51b5', icon: 'moon' }, { id: 'tb', name: 'Meal', color: '#e8912d', icon: 'meal' }, { id: 'tc', name: 'Work', color: '#2fa66a', icon: 'work' }],
    events: ['ta', 'tb', 'tc'].map((t, i) => ev1({ id: 'e' + i, type: t, slots: [{ day: i, start: 600, end: 660, person: 'A' }] })) }));
  const names = a => a.ev('state.S.types.map(t=>t.name)'), grips = a => rows(a).map(r => r.querySelector('.grip'));
  const key = (g, k) => g.onkeydown({ key: k, preventDefault() {} });
  it('each type row starts with a grip that names the type and says what the order is for', () => {
    const a = three(), g = grips(a); expect(g[0]).toBe(rows(a)[0].firstElementChild); expect(g[1].getAttribute('aria-label')).toBe('Move Meal');
    expect(g[1].title).toMatch(/^Drag to reorder/); expect(g[1].title).toContain('statistics'); expect(g[1].title).not.toContain('lanes');
  });
  it('the arrow keys move a type up or down and keep the focus on its grip; past either end nothing happens', () => {
    const a = three(); key(grips(a)[0], 'ArrowDown'); expect(names(a)).toEqual(['Meal', 'Sleep', 'Work']); expect(a.d.activeElement.getAttribute('aria-label')).toBe('Move Sleep');
    const n = a.ev('state.undoSt.length'); key(grips(a)[0], 'ArrowUp'); expect(names(a)).toEqual(['Meal', 'Sleep', 'Work']); expect(a.ev('state.undoSt.length')).toBe(n);
  });
  it('dragging a grip below the last row moves the type to the end; it is undoable data that marks the workspace unsaved', () => {
    const a = three(); a.ev('saveMem("all")'); grips(a)[0].onpointerdown({ button: 0, preventDefault() {}, stopPropagation() {} });
    pointer(a, 'pointermove', { x: 10, y: 500 }); pointer(a, 'pointerup', { x: 10, y: 500 }); expect(names(a)).toEqual(['Meal', 'Work', 'Sleep']); expect(a.ev('isDirty()')).toBe(true);
    a.toolbar('undo').click(); expect(names(a)).toEqual(['Sleep', 'Meal', 'Work']);
  });
  it('the event dialog lists the types in the new order', () => {
    const a = three(); key(grips(a)[2], 'ArrowUp'); key(grips(a)[1], 'ArrowUp'); a.ev('openDlg(state.S.events[0])');
    expect(a.qa('#fTy option').map(o => o.textContent)).toEqual(['(none)', 'Work', 'Sleep', 'Meal']);
  });
  it('the statistics table, CSV columns and the everyone view follow the new order', () => {
    const a = three(); key(grips(a)[2], 'ArrowUp'); key(grips(a)[1], 'ArrowUp');
    expect(a.ev("statsRows('A',true).slice(1,4).map(r=>r[1])")).toEqual(['Work', 'Sleep', 'Meal']);
    expect(a.ev("statsRows('*',true)[0].slice(1,4)")).toEqual(['Work', 'Sleep', 'Meal']);
  });
});
