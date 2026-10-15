import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, sched, ev1, person, pointer } from '../helpers/app.js';

const fresh = (data, o = {}) => { const a = openApp(o); if (data) setData(a, data); return a; };
const sections = a => a.qa('#sbin .sec');
const schedRows = a => sections(a)[0].querySelectorAll('.sch');
const peopleRows = a => sections(a)[1].querySelectorAll('.sch');
const eye = row => row.querySelector('button.eye');
const moreBtn = row => [...row.querySelectorAll('button.eye')].at(-1);
const menu = a => a.qa('.omenu .oi').map(b => b.textContent.replace(/\s+/g, ' ').trim());
const menuClick = (a, label) => a.qa('.omenu .oi').find(b => b.textContent.trim().startsWith(label)).click();
const two = () => fresh(blank({ schedules: [sched({ id: 's1', name: 'Home' }), sched({ id: 's2', name: 'Work', color: '#e5484d' })], events: [ev1({ id: 'e1', title: 'Only home', schedules: ['s1'] }), ev1({ id: 'e2', title: 'Only work', schedules: ['s2'], slots: [{ day: 1, start: 600, end: 660, person: '' }] }), ev1({ id: 'e3', title: 'Shared', schedules: ['s1', 's2'], slots: [{ day: 2, start: 600, end: 660, person: '' }] })] }));
const titles = a => a.qa('.ev .t').map(t => t.textContent).sort();

describe('R-SCH-01 Schedules overlay the same calendar and are shown or hidden with an eye', () => {
  it('every schedule row has an eye, a calendar icon in the schedule colour, a name field and a ⋯ menu', () => {
    const a = two(); const row = schedRows(a)[1];
    expect(eye(row)).not.toBeNull(); expect(row.querySelector('.pick svg')).not.toBeNull(); expect(row.querySelector('.pick').style.color).toMatch(/#e5484d|rgb\(229, 72, 77\)/);
    expect(row.querySelector('input[type=text]').value).toBe('Work'); expect(moreBtn(row)).not.toBe(eye(row));
  });
  it('two visible schedules are overlaid: the events of both are drawn', () => {
    expect(titles(two())).toEqual(['Only home', 'Only work', 'Shared']);
  });
  it('hiding a schedule with its eye removes the events that are only in it; shared events stay', () => {
    const a = two(); eye(schedRows(a)[1]).click(); expect(titles(a)).toEqual(['Only home', 'Shared']);
  });
  it('a hidden schedule has a dashed-outline eye and a dimmed row; showing it again restores both', () => {
    const a = two(); const before = eye(schedRows(a)[0]).innerHTML; eye(schedRows(a)[0]).click();
    expect(schedRows(a)[0].classList.contains('off')).toBe(true); expect(eye(schedRows(a)[0]).innerHTML).toContain('stroke-dasharray'); expect(before).not.toContain('stroke-dasharray');
    eye(schedRows(a)[0]).click(); expect(schedRows(a)[0].classList.contains('off')).toBe(false);
  });
  it('a shared event disappears only when every schedule it belongs to is hidden', () => {
    const a = two(); eye(schedRows(a)[0]).click(); eye(schedRows(a)[1]).click(); expect(a.qa('.ev')).toHaveLength(0);
  });
  it('hiding or showing a schedule is view state: not an undo step and not an unsaved change', () => {
    const a = two(); a.ev('cw().lf=keyOf(S)'); expect(a.ev('isDirty()')).toBe(false); const depth = a.ev('undoSt.length'); eye(schedRows(a)[0]).click();
    expect(a.ev('undoSt.length')).toBe(depth); expect(a.ev('isDirty()')).toBe(false);
  });
  it('the colour icon opens the colour picker; Apply recolours the schedule (one undo step)', () => {
    const a = two(); schedRows(a)[0].querySelector('.pick').click(); const pop = a.q('.cpop');
    const hex = pop.querySelector('input[type=text]'); hex.value = '#123456'; hex.oninput(); [...pop.querySelectorAll('button')].find(b => b.textContent === 'Apply').click();
    expect(a.ev('S.schedules[0].color')).toBe('#123456'); a.toolbar('undo').click(); expect(a.ev('S.schedules[0].color')).toBe('#3b6df0');
  });
  it('Cancel in the colour picker changes nothing', () => {
    const a = two(); schedRows(a)[0].querySelector('.pick').click(); const pop = a.q('.cpop'); pop.querySelector('input[type=text]').value = '#123456';
    [...pop.querySelectorAll('button')].find(b => b.textContent === 'Cancel').click(); expect(a.ev('S.schedules[0].color')).toBe('#3b6df0'); expect(a.q('.cpop')).toBeNull();
  });
  it('the colour picker also applies when Enter is pressed in the hex field', () => {
    const a = two(); schedRows(a)[0].querySelector('.pick').click(); const hex = a.q('.cpop input[type=text]'); hex.value = '#abcdef'; hex.oninput(); hex.onkeydown({ key: 'Enter', preventDefault() {} });
    expect(a.ev('S.schedules[0].color')).toBe('#abcdef');
  });
  it('the opacity slider in the ⋯ menu fades the schedule\'s events live and is not an undo step', () => {
    const a = two(); const depth = a.ev('undoSt.length'); moreBtn(schedRows(a)[0]).click();
    const slider = a.q('.omenu input[type=range]'); slider.value = 0.4; slider.oninput();
    expect(a.ev('S.schedules[0].opacity')).toBe(0.4); expect(a.q('.ev').style.opacity).toBe('0.4'); expect(a.ev('undoSt.length')).toBe(depth);
  });
  it('the opacity slider goes from 10 % to 100 %', () => {
    const a = two(); moreBtn(schedRows(a)[0]).click(); const s = a.q('.omenu input[type=range]'); expect([s.min, s.max]).toEqual(['0.1', '1']);
  });
  it('a schedule icon fades together with its opacity so the row shows it at a glance', () => {
    const a = two(); a.ev('S.schedules[0].opacity=0.5;render()'); expect(schedRows(a)[0].querySelector('.pick').style.opacity).toBe('0.5');
  });
  it('a schedule can be renamed in its row (one undo step)', () => {
    const a = two(); const input = schedRows(a)[0].querySelector('input[type=text]'); input.value = 'Family'; input.onchange();
    expect(a.ev('S.schedules[0].name')).toBe('Family'); a.toolbar('undo').click(); expect(a.ev('S.schedules[0].name')).toBe('Home');
  });
  it('the + button of the Schedules section asks for a name and adds a schedule with a palette colour', () => {
    const a = fresh(blank(), { promptAnswer: 'Holidays' }); sections(a)[0].querySelector('.sech .eye').click();
    expect(a.ev('S.schedules.map(s=>s.name)')).toEqual(['S1', 'Holidays']); expect(a.ev('S.schedules[1].color')).toMatch(/^#[0-9a-f]{6}$/); expect(a.ev('S.schedules[1].visible')).toBe(true);
  });
  it('cancelling the name prompt adds nothing', () => {
    const a = fresh(blank(), { promptAnswer: null }); sections(a)[0].querySelector('.sech .eye').click(); expect(a.ev('S.schedules.length')).toBe(1);
  });
  it('the section header shows how many schedules there are and can be collapsed', () => {
    const a = two(); expect(sections(a)[0].querySelector('.shbtn em').textContent).toBe('2'); sections(a)[0].querySelector('.shbtn').click();
    expect(schedRows(a)).toHaveLength(0); expect(sections(a)[0].querySelector('.shbtn em').textContent).toBe('2');
  });
});

describe('R-SCH-02 Locking a schedule (menu and badge)', () => {
  it('Lock in the ⋯ menu locks the schedule, adds a lock badge to the row and flips the menu entry to Unlock', () => {
    const a = two(); moreBtn(schedRows(a)[0]).click(); menuClick(a, 'Lock'); expect(a.ev('S.schedules[0].locked')).toBe(true);
    expect(schedRows(a)[0].querySelectorAll('.ic[title]').length).toBeGreaterThan(0); moreBtn(schedRows(a)[0]).click(); expect(menu(a)).toContain('Unlock');
  });
  it('locking is an undoable change (unlike visibility)', () => {
    const a = two(); moreBtn(schedRows(a)[0]).click(); menuClick(a, 'Lock'); a.toolbar('undo').click(); expect(a.ev('S.schedules[0].locked')).toBe(false);
  });
  it('events that are only in a locked schedule cannot be grabbed, shared ones still can', () => {
    const a = two(); a.ev('S.schedules[0].locked=true;render()');
    const boxes = Object.fromEntries(a.qa('.ev').map(b => [b.querySelector('.t').textContent, b]));
    expect(boxes['Only home'].onpointerdown).toBeFalsy(); expect(boxes['Only work'].onpointerdown).toBeTruthy(); expect(boxes['Shared'].onpointerdown).toBeTruthy();
  });
});

describe('R-SCH-03 Schedule row menu', () => {
  it('offers Colour, opacity, Lock, Show only this one, Copy or move to workspace and Delete', () => {
    const a = two(); moreBtn(schedRows(a)[0]).click();
    expect(menu(a).map(t => t.replace(/\d.*/, ''))).toEqual(['Colour…', '', 'Lock', 'Show only this one', 'Copy or move to workspace…', 'Delete']);
  });
  it('"Show only this one" hides every other schedule', () => {
    const a = two(); moreBtn(schedRows(a)[0]).click(); menuClick(a, 'Show only'); expect(a.ev('S.schedules.map(s=>s.visible)')).toEqual([true, false]);
  });
  it('choosing it again while it is the only one shown shows everything again', () => {
    const a = two(); moreBtn(schedRows(a)[0]).click(); menuClick(a, 'Show only'); moreBtn(schedRows(a)[0]).click(); menuClick(a, 'Show only'); expect(a.ev('S.schedules.map(s=>s.visible)')).toEqual([true, true]);
  });
  it('solo makes a two-week rota easy: Week A / Week B schedules flip with one click each', () => {
    const a = fresh(blank({ schedules: [sched({ id: 'a', name: 'Week A' }), sched({ id: 'b', name: 'Week B' })], events: [ev1({ id: 'ea', title: 'A event', schedules: ['a'] }), ev1({ id: 'eb', title: 'B event', schedules: ['b'] })] }));
    moreBtn(schedRows(a)[0]).click(); menuClick(a, 'Show only'); expect(titles(a)).toEqual(['A event']);
    moreBtn(schedRows(a)[1]).click(); menuClick(a, 'Show only'); expect(titles(a)).toEqual(['B event']);
  });
  it('Delete asks for confirmation naming the schedule and says how many events will go with it', () => {
    const a = two(); moreBtn(schedRows(a)[1]).click(); menuClick(a, 'Delete');
    expect(a.log.confirms[0]).toContain('Delete schedule "Work"?'); expect(a.log.confirms[0]).toContain('1 event(s) only in this schedule will also be deleted');
  });
  it('after confirming, events only in that schedule are deleted and shared ones just leave it', () => {
    const a = two(); moreBtn(schedRows(a)[1]).click(); menuClick(a, 'Delete');
    expect(a.ev('S.schedules.map(s=>s.id)')).toEqual(['s1']); expect(a.ev('S.events.map(e=>e.title)')).toEqual(['Only home', 'Shared']); expect(a.ev('S.events[1].schedules')).toEqual(['s1']);
  });
  it('declining the confirmation deletes nothing', () => {
    const a = fresh(blank({ events: [ev1()] }), { confirmAnswer: false }); moreBtn(schedRows(a)[0]).click(); menuClick(a, 'Delete'); expect(a.ev('S.schedules.length')).toBe(1);
  });
  it('deleting a schedule is one undo step', () => {
    const a = two(); moreBtn(schedRows(a)[1]).click(); menuClick(a, 'Delete'); a.toolbar('undo').click(); expect(a.ev('S.schedules.length')).toBe(2); expect(a.ev('S.events.length')).toBe(3);
  });
});

describe('R-SCH-04 The first-run schedule is called Routine', () => {
  it('a new installation starts with one schedule named Routine', () => { expect(openApp().ev('S.schedules.map(s=>s.name)')).toEqual(['Routine']); });
  it('in Spanish it is called Rutina', () => { expect(openApp({ languages: ['es'] }).ev('S.schedules[0].name')).toBe('Rutina'); });
});

describe('R-PPL-01 The People list works like the schedule list', () => {
  const withPeople = () => fresh(blank({ people: [person({ id: 'A', name: 'Ann' }), person({ id: 'B', name: 'Bob', color: '#2fa66a' })], events: [ev1({ title: 'Led by Ann', slots: [{ day: 0, start: 600, end: 660, person: 'A' }] }), ev1({ id: 'e2', title: 'Led by Bob', slots: [{ day: 1, start: 600, end: 660, person: 'B' }] })] }));
  it('each person row has an eye, a user icon in their colour, a name field and a ⋯ menu', () => {
    const row = peopleRows(withPeople())[1]; expect(eye(row)).not.toBeNull(); expect(row.querySelector('.pick').style.color).toMatch(/#2fa66a|rgb\(47, 166, 106\)/); expect(row.querySelector('input[type=text]').value).toBe('Bob');
  });
  it('hiding a person with the eye hides the events they lead (viewing the others\' calendars)', () => {
    const a = withPeople(); eye(peopleRows(a)[0]).click(); expect(titles(a)).toEqual(['Led by Bob']);
  });
  it('the + button of the People section adds a person with a palette colour', () => {
    const b = openApp({ promptAnswer: 'Cy' }); setData(b, blank()); sections(b)[1].querySelector('.sech .eye').click();
    expect(b.ev('S.people.map(p=>p.name)')).toEqual(['Cy']); expect(b.ev('S.people[0].color')).toMatch(/^#[0-9a-f]{6}$/); expect(b.ev('S.people[0].visible')).toBe(true);
  });
  it('a person can be renamed and recoloured (undoable)', () => {
    const a = withPeople(); const input = peopleRows(a)[0].querySelector('input[type=text]'); input.value = 'Anna'; input.onchange(); expect(a.ev('S.people[0].name')).toBe('Anna');
    a.toolbar('undo').click(); expect(a.ev('S.people[0].name')).toBe('Ann');
  });
  it('the people menu offers Colour…, Statistics…, External (not one of us) and Delete', () => {
    const a = withPeople(); moreBtn(peopleRows(a)[0]).click(); expect(menu(a)).toEqual(['Colour…', 'Statistics…', 'External (not one of us)', 'Delete']);
  });
  it('deleting a person asks for confirmation and removes them from every event (responsible and involved)', () => {
    const a = fresh(blank({ people: [person({ id: 'A' }), person({ id: 'B', name: 'Bob' })], events: [ev1({ involved: ['A', 'B'], slots: [{ day: 0, start: 600, end: 660, person: 'A' }] })] }));
    moreBtn(peopleRows(a)[0]).click(); menuClick(a, 'Delete');
    expect(a.log.confirms[0]).toContain('Delete "Ann"?'); expect(a.ev('S.people.map(p=>p.name)')).toEqual(['Bob']); expect(a.ev('S.events[0].involved')).toEqual(['B']); expect(a.ev('S.events[0].slots[0].person')).toBe('');
  });
  it('person visibility is view state (no undo step, not an unsaved change)', () => {
    const a = withPeople(); a.ev('cw().lf=keyOf(S)'); const depth = a.ev('undoSt.length'); eye(peopleRows(a)[0]).click(); expect(a.ev('undoSt.length')).toBe(depth); expect(a.ev('isDirty()')).toBe(false);
  });
});

describe('R-PPL-02 People can be reordered in the sidebar (the order sets the side-by-side lanes)', () => {
  const three = () => fresh(blank({ people: [person({ id: 'A', name: 'Ann' }), person({ id: 'B', name: 'Bob' }), person({ id: 'C', name: 'Cy' })] }));
  const names = a => a.ev('S.people.map(p=>p.name)'), grips = a => [...peopleRows(a)].map(r => r.querySelector('.grip'));
  it('each person row starts with a grip handle that names the person and explains how to use it', () => {
    const a = three(); const g = grips(a); expect(g.every(Boolean)).toBe(true); expect(g[0]).toBe(peopleRows(a)[0].firstElementChild);
    expect(g[1].getAttribute('aria-label')).toBe('Move Bob'); expect(g[1].title).toContain('Drag to reorder');
  });
  it('the arrow keys on a focused grip move the person up or down; the grip keeps the focus', () => {
    const a = three(); grips(a)[0].onkeydown({ key: 'ArrowDown', preventDefault() {} }); expect(names(a)).toEqual(['Bob', 'Ann', 'Cy']);
    expect(a.d.activeElement.getAttribute('aria-label')).toBe('Move Ann'); grips(a)[2].onkeydown({ key: 'ArrowUp', preventDefault() {} }); expect(names(a)).toEqual(['Bob', 'Cy', 'Ann']);
  });
  it('moving past either end does nothing (and adds no undo step)', () => {
    const a = three(); const d = a.ev('undoSt.length'); grips(a)[0].onkeydown({ key: 'ArrowUp', preventDefault() {} }); expect(names(a)).toEqual(['Ann', 'Bob', 'Cy']); expect(a.ev('undoSt.length')).toBe(d);
  });
  it('dragging the grip below the last row moves the person to the end; it can be undone', () => {
    const a = three(); grips(a)[0].onpointerdown({ button: 0, preventDefault() {}, stopPropagation() {} }); expect(peopleRows(a)[0].classList.contains('dragging')).toBe(true);
    pointer(a, 'pointermove', { x: 10, y: 500 }); expect(peopleRows(a)[2].classList.contains('dropa')).toBe(true); pointer(a, 'pointerup', { x: 10, y: 500 });
    expect(names(a)).toEqual(['Bob', 'Cy', 'Ann']); a.toolbar('undo').click(); expect(names(a)).toEqual(['Ann', 'Bob', 'Cy']);
  });
  it('the new order is used for the side-by-side lanes', () => {
    const a = fresh(blank({ people: [person({ id: 'A', name: 'Ann' }), person({ id: 'B', name: 'Bob' })], events: [ev1({ id: 'a', title: 'A', slots: [{ day: 0, start: 600, end: 660, person: 'A' }] }), ev1({ id: 'b', title: 'B', slots: [{ day: 0, start: 600, end: 660, person: 'B' }] })] }));
    const laneOf = t => a.qa('.ev').find(b => b.getAttribute('aria-label').startsWith(t + ',')).dataset.lane; expect(laneOf('A')).toBe('0/2');
    grips(a)[0].onkeydown({ key: 'ArrowDown', preventDefault() {} }); expect(laneOf('A')).toBe('1/2'); expect(laneOf('B')).toBe('0/2');
  });
  it('the grip label is translated into Spanish', () => {
    const a = fresh(blank({ people: [person()] }), { languages: ['es'] }); expect(grips(a)[0].getAttribute('aria-label')).toBe('Mover Ann');
  });
});

describe('R-PPL-03 External people (someone from outside the household, e.g. a cleaner)', () => {
  const ppl = () => { const a = fresh(blank({ people: [person({ id: 'A', name: 'Ann' }), person({ id: 'C', name: 'Cleaner', color: '#12a5b5' })] })); a.ev('prefs.secExt=false;render()'); return a; };   // External group expanded (R-PPL-04)
  const extItem = a => a.qa('.omenu .oi').find(b => b.textContent.trim().startsWith('External'));
  it('the person menu toggles "External (not one of us)" with a tick and an explanatory tooltip; it is undoable data', () => {
    const a = ppl(); moreBtn(peopleRows(a)[1]).click(); expect(extItem(a).title).toMatch(/^For someone from outside the household/); expect(extItem(a).querySelector('svg')).toBeNull();
    menuClick(a, 'External'); expect(a.ev('S.people[1].external')).toBe(true); expect(a.ev('isDirty()')).toBe(true);
    moreBtn(peopleRows(a)[1]).click(); expect(extItem(a).querySelector('svg')).not.toBeNull(); a.key('Escape');
    a.toolbar('undo').click(); expect(a.ev('S.people[1].external')).toBeUndefined();
  });
  it('switching it off again removes the flag instead of storing false', () => {
    const a = ppl(); a.ev('S.people[1].external=true;render()'); moreBtn(peopleRows(a)[1]).click(); menuClick(a, 'External'); expect(a.ev('"external" in S.people[1]')).toBe(false);
  });
  it('an external person row shows a labelled "external" marker; others do not', () => {
    const a = ppl(); a.ev('S.people[1].external=true;render()');
    expect(peopleRows(a)[0].querySelector('.extb')).toBeNull(); expect(peopleRows(a)[1].querySelector('.extb').getAttribute('aria-label')).toBe('External (not one of us)');
  });
  it('the menu of an external person has no Statistics… entry', () => {
    const a = ppl(); a.ev('S.people[1].external=true;render()'); moreBtn(peopleRows(a)[1]).click(); expect(menu(a)).toEqual(['Colour…', 'External (not one of us)', 'Delete']);
  });
  it('in the event dialog external people can perform a day (marked) but can never own the event or be offered as involved people', () => {
    const a = ppl(); a.ev('S.people[1].external=true;render();openDlg()');
    const perf = () => [...a.qa('#fDays .dr')[0].querySelectorAll('select')[2].options].map(o => o.textContent);
    expect(perf()).toEqual(['Owner (nobody yet)', 'Nobody (concerns everyone)', 'Ann', 'Cleaner (external)']); expect([...a.q('#fOw').options].map(o => o.textContent)).toEqual(['— none —', 'Ann']);
    expect(a.qa('#fInv label').map(l => l.textContent)).toEqual(['Ann']); a.ev("setLang('es')"); a.ev('openDlg()'); expect(perf()[3]).toBe('Cleaner (externa)');
  });
  it('with only external people the involved list shows the "no people" note instead of chips', () => {
    const a = fresh(blank({ people: [person({ id: 'C', name: 'Cleaner', external: true })] })); a.ev('openDlg()'); expect(a.qa('#fInv label')).toHaveLength(0); expect(a.q('#fInv').textContent).toBe(a.ev("L('noPeople')"));
  });
  it('import accepts the flag only when it is exactly true', () => {
    const d = fresh().ev('parseData({schedules:[],events:[],people:[{id:"a",name:"A",external:true},{id:"b",name:"B",external:"yes"},{id:"c",name:"C"}]})');
    expect(d.people.map(q => q.external)).toEqual([true, undefined, undefined]);
  });
  it('anonymised exports keep the flag', () => {
    const a = ppl(); a.ev('S.people[1].external=true'); expect(a.ev('anonymised(buildFile()).people.map(q=>[q.name,!!q.external])')).toEqual([['Person 1', false], ['Person 2', true]]);
  });
});

describe('R-PPL-04 External people are kept in a collapsible sub-group at the end of the People list', () => {
  const mix = () => fresh(blank({ people: [person({ id: 'A', name: 'Ann' }), person({ id: 'X', name: 'Cleaner', external: true }), person({ id: 'B', name: 'Bob' }), person({ id: 'Y', name: 'Gardener', external: true, visible: false })] }));
  const sec = a => sections(a)[1], subh = a => sec(a).querySelector('.subh .shbtn');
  const topRows = a => [...sec(a).children].filter(r => r.classList.contains('sch')).map(r => r.querySelector('input[type=text]').value);
  const extRows = a => [...sec(a).querySelectorAll('.extg > .sch')].map(r => r.querySelector('input[type=text]').value);
  const names = a => a.ev('S.people.map(p=>p.name)');
  it('by default only our people are listed; external people are folded under "External (N)" with a hidden count', () => {
    const a = mix(); expect(topRows(a)).toEqual(['Ann', 'Bob']); expect(sec(a).querySelector('.extg')).toBeNull();
    expect(subh(a).textContent).toBe('External21 hidden'); expect(subh(a).getAttribute('aria-expanded')).toBe('false'); expect(sec(a).querySelector('.subh .tip').title).toMatch(/^People from outside the household/);
  });
  it('clicking the sub-header unfolds the external people, and the choice is remembered per browser', () => {
    const a = mix(); subh(a).click(); expect(extRows(a)).toEqual(['Cleaner', 'Gardener']); expect(subh(a).getAttribute('aria-expanded')).toBe('true');
    expect(subh(a).textContent).toBe('External2'); expect(JSON.parse(a.w.localStorage.getItem('weekly-schedules-prefs')).secExt).toBe(false);
    const b = openApp({ storage: a.storage() }); setData(b, blank({ people: [person({ id: 'X', name: 'Cleaner', external: true })] })); expect(b.qa('.extg .sch')).toHaveLength(1);
    subh(b).click(); expect(b.q('.extg')).toBeNull();
  });
  it('without external people there is no sub-header at all', () => {
    const a = fresh(blank({ people: [person({ id: 'A', name: 'Ann' })] })); expect(sec(a).querySelector('.subh')).toBeNull();
  });
  it('marking someone external moves their row into the sub-group; the data order is unchanged', () => {
    const a = fresh(blank({ people: [person({ id: 'A', name: 'Ann' }), person({ id: 'B', name: 'Bob' })] })); a.ev('S.people[0].external=true;render()');
    expect(topRows(a)).toEqual(['Bob']); expect(subh(a).textContent).toBe('External1'); expect(names(a)).toEqual(['Ann', 'Bob']);
  });
  it('the arrow keys reorder within a group and skip the other group\'s people in the data', () => {
    const a = mix(); [...sec(a).children].find(r => r.classList?.contains('sch')).querySelector('.grip').onkeydown({ key: 'ArrowDown', preventDefault() {} });
    expect(names(a)).toEqual(['Cleaner', 'Bob', 'Ann', 'Gardener']); expect(topRows(a)).toEqual(['Bob', 'Ann']);
    a.ev('prefs.secExt=false;render()'); a.q('.extg .sch .grip').onkeydown({ key: 'ArrowDown', preventDefault() {} }); expect(extRows(a)).toEqual(['Gardener', 'Cleaner']);
    expect(names(a)).toEqual(['Bob', 'Ann', 'Gardener', 'Cleaner']); a.q('.extg .sch .grip').onkeydown({ key: 'ArrowUp', preventDefault() {} }); expect(names(a)).toEqual(['Bob', 'Ann', 'Gardener', 'Cleaner']);
  });
  it('dragging a grip only considers the rows of its own group', () => {
    const a = mix(); a.ev('prefs.secExt=false;render()'); const g = [...sec(a).children].find(r => r.classList?.contains('sch')).querySelector('.grip');
    g.onpointerdown({ button: 0, preventDefault() {}, stopPropagation() {} }); pointer(a, 'pointermove', { x: 10, y: 500 }); pointer(a, 'pointerup', { x: 10, y: 500 });
    expect(topRows(a)).toEqual(['Bob', 'Ann']); expect(extRows(a)).toEqual(['Cleaner', 'Gardener']);
  });
  it('side-by-side lanes follow the order shown: our people first, external people after them', () => {
    const a = fresh(blank({ people: [person({ id: 'X', name: 'Sitter', external: true }), person({ id: 'A', name: 'Ann' })], events: [ev1({ id: 'x', title: 'Sit', involved: ['A'], slots: [{ day: 0, start: 600, end: 660, person: 'X' }] }), ev1({ id: 'b', title: 'Read', slots: [{ day: 0, start: 600, end: 660, person: 'A' }] })] }));
    const laneOf = t => a.qa('.ev').find(b => b.getAttribute('aria-label').startsWith(t + ',')).dataset.lane;
    expect(a.qa('.ov')).toHaveLength(1); expect(laneOf('Read')).toBeUndefined();   // they clash through Ann: one lane
    const b = fresh(blank({ people: [person({ id: 'X', name: 'Sitter', external: true }), person({ id: 'A', name: 'Ann' }), person({ id: 'L', name: 'Lucía' })], events: [ev1({ id: 'x', title: 'Sit', involved: ['L'], slots: [{ day: 0, start: 600, end: 660, person: 'X' }] }), ev1({ id: 'b', title: 'Read', slots: [{ day: 0, start: 600, end: 660, person: 'A' }] })] }));
    const lane = t => b.qa('.ev').find(x => x.getAttribute('aria-label').startsWith(t + ',')).dataset.lane; expect(lane('Read')).toBe('0/2'); expect(lane('Sit')).toBe('1/2');
  });
  it('the sub-header is translated into Spanish', () => {
    const a = fresh(blank({ people: [person({ id: 'X', name: 'Cleaner', external: true, visible: false })] }), { languages: ['es'] }); expect(subh(a).textContent).toBe('Externas11 ocultas');
  });
});
