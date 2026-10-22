import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, ev1, person, workspace } from '../helpers/app.js';

const fresh = (o = {}) => openApp(o);
const radios = a => a.qa('#xDlg input[name=impm]');
const labels = a => a.qa('#xDlg .radios label').map(l => l.textContent.replace(/\s+/g, ' ').trim());
async function importFile(a, obj, name = 'x.json') {
  a.d.getElementById('file').onchange({ target: { files: [{ name, text: async () => (typeof obj === 'string' ? obj : JSON.stringify(obj)) }], value: '' } });
  await a.sleep(30);
}
const choose = (a, value) => { radios(a).find(r => r.value === value).checked = true; a.click('Import'); };
/** Alpha (id a1, active) and Beta (id b1) workspaces */
const alphaBeta = (o = {}) => {
  const a = fresh(o); a.ev("cw().name='Alpha';cw().id='a1';curId='a1';const b=newWs('Beta',defaultData(),true);b.id='b1';b.data.schedules[0].name='beta-data';WS.push(b);S.schedules[0].name='alpha-data';render()");
  return a;
};
const wsNames = a => a.ev('WS.map(w=>w.name)');

describe('R-DATA-03 Import dialog for files and links (one workspace per file)', () => {
  it('shows what the file contains and offers exactly three choices: new workspace, insert, replace an existing one', async () => {
    const a = fresh(); await importFile(a, workspace({ name: 'Imported one' }));
    expect(a.dlgTitle()).toBe('Import'); expect(a.dlgText()).toContain('Imported one'); expect(a.dlgText()).toContain('1 schedules, 1 events, 1 people, 1 rhythms, 1 phases');
    expect(labels(a).map(t => t.slice(0, 28))).toEqual(['Import as a new workspace', 'Insert into the current work', 'Replace an existing workspac']);
  });
  it('"Import as a new workspace" is preselected', async () => {
    const a = fresh(); await importFile(a, workspace()); expect(radios(a).find(r => r.checked).value).toBe('new');
  });
  it('there is no separate "replace current" or "replace matching" option', async () => {
    const a = fresh(); await importFile(a, workspace()); expect(a.dlgText()).not.toMatch(/Replace the current|Replace the matching/);
  });
  it('a file that is not a workspace is refused with a message and nothing changes', async () => {
    const a = fresh(); await importFile(a, '{"hello":1}'); expect(a.log.alerts[0]).toContain('not a valid'); expect(a.dlgOpen()).toBe(false);
    await importFile(a, 'not json'); expect(a.log.alerts).toHaveLength(2); expect(wsNames(a)).toEqual(['Workspace']);
  });
  it('a file with too many items is refused with a specific message', async () => {
    const a = fresh(); const big = workspace({ events: Array.from({ length: 5001 }, (_, i) => ev1({ id: 'e' + i })) }); await importFile(a, big);
    expect(a.log.alerts[0]).toContain('too many items');
  });
  it('cancelling the import changes nothing', async () => {
    const a = fresh(); await importFile(a, workspace()); a.click('Cancel'); expect(wsNames(a)).toEqual(['Workspace']);
  });
});

describe('R-DATA-03 Import as a new workspace', () => {
  it('adds a workspace with the file\'s name and switches to it', async () => {
    const a = fresh(); await importFile(a, workspace({ name: 'Granny care' })); choose(a, 'new');
    expect(wsNames(a)).toEqual(['Workspace', 'Granny care']); expect(a.ev('cw().name')).toBe('Granny care'); expect(a.ev('S.events[0].title')).toBe('Standup');
  });
  it('a name that already exists gets (2)', async () => {
    const a = fresh(); await importFile(a, workspace({ name: 'Workspace' })); choose(a, 'new'); expect(wsNames(a)).toEqual(['Workspace', 'Workspace (2)']);
  });
  it('the file\'s id is kept when free and replaced when it would collide', async () => {
    const a = fresh(); await importFile(a, workspace({ id: 'keep-me' })); choose(a, 'new'); expect(a.ev('cw().id')).toBe('keep-me');
    await importFile(a, workspace({ id: 'keep-me' })); choose(a, 'new'); expect(a.ev('WS.map(w=>w.id).filter(i=>i==="keep-me").length')).toBe(1);
  });
  it('a workspace imported from a file counts as saved (the file is the backup)', async () => {
    const a = fresh(); await importFile(a, workspace()); choose(a, 'new'); expect(a.ev('isDirty()')).toBe(false);
  });
  it('the data is validated while importing (unsafe colours are replaced)', async () => {
    const a = fresh(); await importFile(a, workspace({ events: [ev1({ color: 'url(https://evil.example)', schedules: ['s1'] })] })); choose(a, 'new'); expect(a.ev('S.events[0].color')).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('the existing workspaces are untouched', async () => {
    const a = alphaBeta(); await importFile(a, workspace({ name: 'Third' })); choose(a, 'new'); expect(a.ev('wsData(WS[0]).schedules[0].name')).toBe('alpha-data'); expect(a.ev('wsData(WS[1]).schedules[0].name')).toBe('beta-data');
  });
});

describe('R-DATA-03 Insert into the current workspace', () => {
  const insertInto = async (a, ws) => { await importFile(a, ws); choose(a, 'insert'); };
  it('adds the file\'s schedules, people, events, rhythms and phases as new items', async () => {
    const a = fresh(); await insertInto(a, workspace());
    expect(a.ev('S.schedules.map(s=>s.name)')).toEqual(['Routine', 'Team']); expect(a.ev('S.people.map(p=>p.name)')).toEqual(['Ann']); expect(a.ev('S.events.map(e=>e.title)')).toEqual(['Standup']);
    expect(a.ev('S.rhythms.map(r=>r.name)')).toEqual(['Normal rhythm', 'Normal']); expect(a.ev('S.phases.length')).toBe(8);
  });
  it('gives everything new ids and keeps the references between them correct', async () => {
    const a = fresh(); await insertInto(a, workspace());
    const e = a.ev('JSON.parse(JSON.stringify(S.events[0]))'), team = a.ev('S.schedules.find(s=>s.name==="Team").id'), ann = a.ev('S.people[0].id');
    expect(team).not.toBe('s1'); expect(e.schedules).toEqual([team]); expect(e.involved).toEqual([ann]); expect(e.slots[0].person).toBe(ann);
  });
  it('names that clash get (2) instead of being merged', async () => {
    const a = fresh(); a.ev('S.people=[{id:"x",name:"Ann",color:"#00f000",visible:true}]'); await insertInto(a, workspace());
    expect(a.ev('S.people.map(p=>p.name)')).toEqual(['Ann', 'Ann (2)']);
  });
  it('nothing existing is replaced or merged: existing events keep their ids and the inserted ones are added', async () => {
    const a = fresh(); setData(a, blank({ events: [ev1({ id: 'mine', title: 'Mine' })] })); await insertInto(a, workspace());
    expect(a.ev('S.events.map(e=>e.title)')).toEqual(['Mine', 'Standup']); expect(a.ev('S.events[0].id')).toBe('mine');
  });
  it('an inserted rhythm stays hidden when another rhythm is already shown (only one can be shown)', async () => {
    const a = fresh(); await insertInto(a, workspace()); expect(a.ev('S.rhythms.map(r=>r.visible)')).toEqual([true, false]);
  });
  it('an inserted rhythm is shown when no rhythm was shown before', async () => {
    const a = fresh(); a.ev('S.rhythms.forEach(r=>r.visible=false)'); await insertInto(a, workspace()); expect(a.ev('S.rhythms.filter(r=>r.visible).length')).toBe(1);
  });
  it('inserting into the current workspace is a single undo step that removes everything inserted', async () => {
    const a = fresh(); await insertInto(a, workspace()); a.toolbar('undo').click(); expect(a.ev('S.schedules.length')).toBe(1); expect(a.ev('S.events.length')).toBe(0);
  });
  it('shows a confirmation toast', async () => {
    const a = fresh(); await insertInto(a, workspace()); expect(a.toast()).toBe('Inserted into the current workspace');
  });
});

describe('R-DATA-03 Replace an existing workspace (pick, then confirm)', () => {
  const start = async (a, obj) => { await importFile(a, obj); choose(a, 'replace'); await a.sleep(10); };
  it('first lists every workspace with flags: active, same id, same name – best candidates first', async () => {
    const a = alphaBeta(); await start(a, workspace({ id: 'b1', name: 'Alpha' }));
    expect(a.dlgTitle()).toBe('Which workspace should be replaced?'); expect(labels(a)).toEqual(['Beta (same id)', 'Alpha (active, same name)']);
  });
  it('without any match the active workspace comes first, then the others', async () => {
    const a = alphaBeta(); await start(a, workspace({ id: 'zzz', name: 'Gamma' })); expect(labels(a)).toEqual(['Alpha (active)', 'Beta']);
  });
  it('the best match is preselected', async () => {
    const a = alphaBeta(); await start(a, workspace({ id: 'b1', name: 'Alpha' })); expect(a.qa('#xDlg input[name=tgt]').findIndex(r => r.checked)).toBe(0);
  });
  it('after picking, a confirmation names the workspace that will be replaced and the file\'s workspace', async () => {
    const a = alphaBeta(); await start(a, workspace({ id: 'zzz', name: 'Gamma' })); a.click('Continue'); await a.sleep(10);
    expect(a.dlgTitle()).toBe('Replace workspace?'); expect(a.dlgText()).toContain('Replace everything in the workspace "Alpha" with "Gamma"?');
  });
  it('cancelling at the confirmation replaces nothing', async () => {
    const a = alphaBeta(); await start(a, workspace({ id: 'zzz', name: 'Gamma' })); a.click('Continue'); await a.sleep(10); a.click('Cancel');
    expect(a.ev('S.schedules[0].name')).toBe('alpha-data'); expect(a.ev('cw().name')).toBe('Alpha');
  });
  it('cancelling at the picker replaces nothing', async () => {
    const a = alphaBeta(); await start(a, workspace({ id: 'zzz', name: 'Gamma' })); a.click('Cancel'); expect(a.ev('S.schedules[0].name')).toBe('alpha-data');
  });
  it('confirming replaces the chosen workspace\'s data but keeps its name', async () => {
    const a = alphaBeta(); await start(a, workspace({ id: 'zzz', name: 'Gamma' })); a.click('Continue'); await a.sleep(10); a.click('Replace');
    expect(a.ev('cw().name')).toBe('Alpha'); expect(a.ev('S.events[0].title')).toBe('Standup'); expect(a.ev('S.schedules[0].name')).toBe('Team'); expect(a.toast()).toContain('Replaced workspace "Alpha"');
  });
  it('replacing another (not active) workspace works and switches to it; the active workspace is untouched', async () => {
    const a = alphaBeta(); await start(a, workspace({ id: 'zzz', name: 'Gamma' })); a.qa('#xDlg input[name=tgt]')[1].checked = true; a.click('Continue'); await a.sleep(10); a.click('Replace');
    expect(a.ev('cw().name')).toBe('Beta'); expect(a.ev('S.schedules[0].name')).toBe('Team'); expect(a.ev('wsData(WS[0]).schedules[0].name')).toBe('alpha-data');
  });
  it('a replacement can be undone in the workspace that was replaced', async () => {
    const a = alphaBeta(); await start(a, workspace({ id: 'zzz', name: 'Gamma' })); a.click('Continue'); await a.sleep(10); a.click('Replace'); a.toolbar('undo').click(); expect(a.ev('S.schedules[0].name')).toBe('alpha-data');
  });
  it('undoing a replacement of a workspace that is not shown works once you switch to it', async () => {
    const a = alphaBeta(); await start(a, workspace({ id: 'zzz', name: 'Gamma' })); a.qa('#xDlg input[name=tgt]')[1].checked = true; a.click('Continue'); await a.sleep(10); a.click('Replace');
    a.toolbar('undo').click(); expect(a.ev('S.schedules[0].name')).toBe('beta-data');
  });
});

describe('R-DATA-04 Copying and moving schedules and rhythms to another workspace', () => {
  const people = [person({ id: 'A', name: 'Ann', color: '#e5484d' }), person({ id: 'B', name: 'Bob', color: '#2fa66a' }), person({ id: 'C', name: 'Cy', color: '#8e4ec6' })];
  const source = () => blank({ people, events: [
    ev1({ id: 'm', title: 'Meeting', involved: ['B', 'C'], slots: [{ day: 0, start: 600, end: 660, person: 'A' }] }),
    ev1({ id: 'x', title: 'No people', slots: [{ day: 1, start: 600, end: 660, person: '' }] }),
  ] });
  const setup = (targetPeople = [], o = {}) => {
    const a = fresh(o); setData(a, source());
    a.ev(`const t=newWs('Target',defaultData(),true);t.data.people=${JSON.stringify(targetPeople)};WS.push(t);render()`); return a;
  };
  const transfer = async (a, kind, op = 'copy') => {
    a.ev(`openTransfer(${JSON.stringify(kind)},${kind === 'schedule' ? 'S.schedules[0]' : 'S.rhythms[0]'})`);
    a.qa('#xDlg input[name=trop]').find(r => r.value === op).checked = true; a.click('Continue'); await a.sleep(20);
  };
  const target = a => a.ev('JSON.parse(JSON.stringify(WS[1].data))');
  it('the schedule and rhythm menus offer "Copy or move to workspace…"', () => {
    const a = setup(); a.qa('#sbin .sec')[0].querySelector('.sch button.eye:last-of-type').click(); expect(a.qa('.omenu .oi').map(b => b.textContent.trim())).toContain('Copy or move to workspace…');
  });
  it('with only one workspace the user is told to create another one first', () => {
    const a = fresh(); a.ev('openTransfer("schedule",S.schedules[0])'); expect(a.toast()).toContain('Create a second workspace first'); expect(a.dlgOpen()).toBe(false);
  });
  it('the dialog offers the other workspaces and the choice between Copy and Move', () => {
    const a = setup(); a.ev('openTransfer("schedule",S.schedules[0])'); expect([...a.q('#xDlg select').options].map(o => o.textContent)).toEqual(['Target']); expect(a.qa('#xDlg input[name=trop]').map(r => r.value)).toEqual(['copy', 'move']);
  });
  it('events without people need no questions: the schedule and its events are simply copied', async () => {
    const a = setup(); a.ev('S.events.shift()'); a.ev('render()'); await transfer(a, 'schedule'); expect(a.dlgOpen()).toBe(false); expect(target(a).events.map(e => e.title)).toEqual(['No people']);
  });
  it('with people involved, a mapping dialog lists exactly the people the events refer to', async () => {
    const a = setup(); await transfer(a, 'schedule'); expect(a.dlgTitle()).toBe('People'); expect(a.qa('#xDlg .mrow').map(r => r.firstElementChild.textContent).sort()).toEqual(['Ann', 'Bob', 'Cy']);
  });
  it('a person that exists in the target under the same name (any case) is preselected; others default to "create"', async () => {
    const a = setup([person({ id: 'TA', name: 'ann', color: '#111111' })]); await transfer(a, 'schedule');
    const choice = Object.fromEntries(a.qa('#xDlg .mrow').map(r => [r.firstElementChild.textContent, r.querySelector('select').selectedOptions[0].textContent]));
    expect(choice).toEqual({ Ann: 'Use existing: ann', Bob: 'Create "Bob" in the target workspace', Cy: 'Create "Cy" in the target workspace' });
  });
  it('"create" adds the person to the target with the same name and colour; "use existing" re-links; "leave blank" removes the link', async () => {
    const a = setup([person({ id: 'TX', name: 'Xavier', color: '#222222' })]); await transfer(a, 'schedule');
    const pick = n => a.qa('#xDlg .mrow').find(r => r.firstElementChild.textContent === n).querySelector('select'); pick('Ann').value = 'TX'; pick('Bob').value = '__new__'; pick('Cy').value = ''; a.click('Continue'); await a.sleep(20);
    const t = target(a), bob = t.people.find(p => p.name === 'Bob'); const meeting = t.events.find(e => e.title === 'Meeting');
    expect(bob.color).toBe('#2fa66a'); expect(meeting.slots[0].person).toBe('TX'); expect(meeting.involved).toEqual([bob.id]); expect(t.people.map(p => p.name)).toEqual(['Xavier', 'Bob']);
  });
  it('the copied events belong only to the new schedule in the target and the source stays complete', async () => {
    const a = setup(); await transfer(a, 'schedule'); a.click('Continue'); await a.sleep(20);
    const t = target(a); expect(t.schedules.map(s => s.name)).toEqual(['Routine', 'S1']); expect(t.events.every(e => e.schedules.length === 1 && e.schedules[0] === t.schedules[1].id)).toBe(true);
    expect(a.ev('S.events.length')).toBe(2); expect(a.ev('S.schedules.length')).toBe(1);
  });
  it('the copy gets a unique name when the target already has a schedule of that name', async () => {
    const a = setup(); a.ev('WS[1].data.schedules[0].name="S1"'); await transfer(a, 'schedule'); a.click('Continue'); await a.sleep(20); expect(target(a).schedules.map(s => s.name)).toEqual(['S1', 'S1 (2)']);
  });
  it('moving removes the schedule from the source afterwards (its events go too)', async () => {
    const a = setup(); await transfer(a, 'schedule', 'move'); a.click('Continue'); await a.sleep(20);
    expect(a.ev('S.schedules.length')).toBe(0); expect(a.ev('S.events.length')).toBe(0); expect(target(a).events).toHaveLength(2);
  });
  it('moving a schedule keeps events that are shared with another schedule, only detaching them', async () => {
    const a = setup(); a.ev('S.schedules.push({id:"s2",name:"Other",color:"#e5484d",opacity:1,locked:false,visible:true});S.events[1].schedules=["s1","s2"];render()');
    await transfer(a, 'schedule', 'move'); a.click('Continue'); await a.sleep(20); expect(a.ev('S.events.map(e=>[e.title,e.schedules])')).toEqual([['No people', ['s2']]]);
  });
  it('copy and move give both workspaces an undo step', async () => {
    const a = setup(); await transfer(a, 'schedule', 'move'); a.click('Continue'); await a.sleep(20);
    a.toolbar('undo').click(); expect(a.ev('S.schedules.length')).toBe(1); a.ev('switchWs(WS[1].id)'); a.toolbar('undo').click(); expect(a.ev('S.schedules.length')).toBe(1);
  });
  it('cancelling the people mapping transfers nothing', async () => {
    const a = setup(); await transfer(a, 'schedule'); a.click('Cancel'); expect(target(a).events).toHaveLength(0); expect(target(a).schedules).toHaveLength(1);
  });
  const withPhases = () => { const a = fresh(); a.ev(`S.rhythms=[{id:'r1',name:'Normal',visible:true},{id:'r2',name:'Other',visible:false}];S.phases=[{id:'p1',title:'Lunch',desc:'d',color:'#3b6df0',rhythms:['r1'],slots:[{day:0,start:720,end:780}]},{id:'p2',title:'Both',desc:'',color:'#e5484d',rhythms:['r1','r2'],slots:[{day:1,start:600,end:660}]},{id:'p3',title:'Elsewhere',desc:'',color:'#2fa66a',rhythms:['r2'],slots:[{day:2,start:600,end:660}]}];render()`);
    a.ev('const t=newWs("Target",defaultData(),true);t.data.rhythms=[];t.data.phases=[];WS.push(t)'); return a; };
  it('copying a rhythm brings all its phases (attached only to the new rhythm) and leaves the source alone', async () => {
    const a = withPhases(); await transfer(a, 'rhythm'); const t = target(a);
    expect(t.rhythms.map(r => r.name)).toEqual(['Normal']); expect(t.phases.map(p => p.title)).toEqual(['Lunch', 'Both']); expect(t.phases.every(p => p.rhythms.length === 1 && p.rhythms[0] === t.rhythms[0].id)).toBe(true); expect(a.ev('S.phases.length')).toBe(3);
  });
  it('a copied rhythm is shown in the target when nothing else is shown there, and hidden otherwise', async () => {
    const a = withPhases(); await transfer(a, 'rhythm'); expect(target(a).rhythms[0].visible).toBe(true);
    const b = withPhases(); b.ev('WS[1].data.rhythms=[{id:"x",name:"Existing",visible:true}]'); await transfer(b, 'rhythm'); expect(target(b).rhythms.map(r => r.visible)).toEqual([true, false]);
  });
  it('moving a rhythm removes it; phases that belong only to it go too, phases shared with another rhythm stay', async () => {
    const a = withPhases(); await transfer(a, 'rhythm', 'move'); expect(a.ev('S.rhythms.map(r=>r.name)')).toEqual(['Other']); expect(a.ev('S.phases.map(p=>p.title)')).toEqual(['Both', 'Elsewhere']); expect(a.ev('S.phases[0].rhythms')).toEqual(['r2']);
  });
  it('rhythm transfers need no people questions', async () => {
    const a = withPhases(); await transfer(a, 'rhythm'); expect(a.dlgOpen()).toBe(false);
  });
});

describe('R-PPL-03 External people keep their flag when inserted or copied to another workspace', () => {
  async function importFile(a, obj) {
    a.d.getElementById('file').onchange({ target: { files: [{ name: 'x.json', text: async () => JSON.stringify(obj) }], value: '' } });
    await a.sleep(30);
  }
  it('"Insert into the current workspace" keeps an external person external', async () => {
    const a = fresh(); await importFile(a, workspace({ people: [{ id: 'p1', name: 'Cleaner', color: '#f00000', visible: true, external: true }] }));
    a.qa('#xDlg input[name=impm]').find(r => r.value === 'insert').checked = true; a.click('Import');
    expect(a.ev('S.people.map(q=>[q.name,!!q.external])')).toEqual([['Cleaner', true]]);
  });
  it('a schedule transfer that creates the person in the target keeps the flag', async () => {
    const a = fresh(); setData(a, blank({ people: [person({ id: 'C', name: 'Cleaner', external: true })], events: [ev1({ slots: [{ day: 0, start: 600, end: 660, person: 'C' }] })] }));
    a.ev("const t=newWs('Target',defaultData(),true);WS.push(t);render()"); a.ev('openTransfer("schedule",S.schedules[0])');
    a.click('Continue'); await a.sleep(20); a.click('Continue'); await a.sleep(20);
    expect(a.ev('WS[1].data.people.map(q=>[q.name,!!q.external])')).toEqual([['Cleaner', true]]);
  });
});

describe('R-DATA-04 Copying or moving a single event to another workspace', () => {
  const people = [person({ id: 'A', name: 'Ann', color: '#e5484d' }), person({ id: 'B', name: 'Bob', color: '#2fa66a' })];
  const setup = (o = {}) => {
    const a = fresh(); setData(a, blank({ people, types: [{ id: 'tc', name: 'Chore', color: '#a1662f', icon: 'broom' }], events: [ev1({ id: 'm', title: 'Dishes', type: 'tc', involved: ['B'], slots: [{ day: 0, start: 1200, end: 1230, person: 'A' }] }), ev1({ id: 'k', title: 'Keep', slots: [{ day: 1, start: 600, end: 660, person: '' }] })], ...o }));
    a.ev("cw().name='Home';const t=newWs('Work',defaultData(),true);t.data.people=[{id:'tA',name:'ann',color:'#123456',visible:true}];t.data.schedules[0].name='Office';WS.push(t);render()"); return a;
  };
  const copyDlg = a => { a.ev('openCopy(S.events[0])'); };
  const toWork = a => { const w = a.q('#xDlg select'); w.value = a.ev('WS[1].id'); w.dispatchEvent(new a.w.Event('change')); };
  const btn = (a, label) => a.qa('#xDlg .btns button').find(b => b.textContent === label);
  const target = a => a.ev('JSON.parse(JSON.stringify(WS[1].data))');
  it('with several workspaces the copy dialog first asks for the workspace (this one first); Move shows only for another workspace', () => {
    const a = setup(); copyDlg(a); const w = a.q('#xDlg select');
    expect([...w.options].map(o => o.textContent)).toEqual(['Home (this workspace)', 'Work']); expect(w.getAttribute('aria-label')).toBe('Workspace'); expect(btn(a, 'Move').style.display).toBe('none');
    toWork(a); expect([...a.qa('#xDlg select')[1].options].map(o => o.textContent)).toEqual(['Office']); expect(btn(a, 'Move').style.display).toBe(''); expect(btn(a, 'Move').title).toContain('removed here');
  });
  it('with one workspace, and for phases, there is no workspace choice', () => {
    const a = fresh(); setData(a, blank({ events: [ev1()], rhythms: [{ id: 'r', name: 'R', visible: true }], phases: [{ id: 'p', title: 'P', desc: '', color: '#3b6df0', rhythms: ['r'], slots: [{ day: 0, start: 600, end: 660 }] }] }));
    a.ev('openCopy(S.events[0])'); expect(a.qa('#xDlg select')).toHaveLength(1); a.ev("WS.push(newWs('Other',defaultData(),true))"); a.ev('openCopy(S.phases[0])'); expect(a.qa('#xDlg select')).toHaveLength(1);
  });
  it('Copy carries the event over with the people mapping (same name = that person), its activity type by name, and an undo step there', async () => {
    const a = setup(); copyDlg(a); toWork(a); a.click('Copy'); await a.sleep(20);
    expect(a.dlgTitle()).toBe(a.ev("L('mapTitle')")); a.click(a.ev("L('mapCont')")); await a.sleep(20);
    const t = target(a), e = t.events.find(x => x.title === 'Dishes'); expect(e.slots[0].person).toBe('tA'); expect(t.people.map(q => q.name)).toEqual(['ann', 'Bob']);
    expect(e.schedules).toEqual([t.schedules[0].id]); expect(t.types.find(x => x.id === e.type).name).toBe('Chore'); expect(a.ev('S.events.length')).toBe(2); expect(a.ev('WS[1].undo.length')).toBe(1);
  });
  it('Move removes the event here, as an undoable step in this workspace', async () => {
    const a = setup(); copyDlg(a); toWork(a); btn(a, 'Move').click(); await a.sleep(20); a.click(a.ev("L('mapCont')")); await a.sleep(20);
    expect(a.ev('S.events.map(e=>e.title)')).toEqual(['Keep']); expect(target(a).events.some(e => e.title === 'Dishes')).toBe(true); a.ev('undo()'); expect(a.ev('S.events.map(e=>e.title)')).toEqual(['Dishes', 'Keep']);
  });
  it('an event using weeks beyond the other workspace\'s cycle asks first, as for schedules', async () => {
    const a = setup({ cycle: 2, events: [ev1({ id: 'w', title: 'Fortnightly', weeks: [2], slots: [{ day: 0, start: 600, end: 660, person: '' }] })] }); copyDlg(a); toWork(a); a.click('Copy'); await a.sleep(20);
    expect(a.dlgText()).toContain('events or phases arriving (1)'); a.click(a.ev("L('cyApply')")); await a.sleep(20); expect(target(a).cycle).toBe(2); expect(target(a).events.at(-1).weeks).toEqual([2]);
  });
  it('copying within this workspace works as before', () => {
    const a = setup(); copyDlg(a); a.click('Copy'); expect(a.ev('S.events.length')).toBe(3); expect(a.ev('WS[1].undo.length')).toBe(0);
  });
  it('the workspace choice is translated', () => {
    const a = setup(); a.ev("lang='es';applyStatic&&applyStatic()"); copyDlg(a); expect(a.q('#xDlg select').options[0].textContent).toBe('Home (este espacio de trabajo)');
  });
});
