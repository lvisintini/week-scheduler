// Cycles of several weeks on the screen (docs/requirements/cycle.md): what each week of the cycle draws and finds.
import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, ev1, person, dragFrom, createDrag, workspace, sleep, pointer } from '../helpers/app.js';

const fresh = data => { const a = openApp(); if (data) setData(a, data); return a; };
const week = (a, w) => a.ev(`state.curWk=${w};render()`);
const boxes = (a, d) => a.qa(`.day[data-d="${d}"] .ev`).map(b => b._it.e.id + (b._it.piece ? '+' : ''));
const sl = (day, start, end, o = {}) => ({ day, start, end, person: '', ...o });
const people = [person({ id: 'A', name: 'Ann' }), person({ id: 'B', name: 'Bob', color: '#00a000' })];
const ovl = (a, i = 0) => a.ev(`[...overlapSet(state.S.events[${i}])].map(s=>state.S.events[${i}].slots.indexOf(s))`);

describe('R-CYC-06 The week wrap: Sunday runs into Monday of the next week, the last week into week 1', () => {
  it('a Sunday-night event of week 1 shows its part after midnight on Monday of week 2, not of week 1', () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ weeks: [1], slots: [sl(6, 1320, 1800)] })] }));
    expect(boxes(a, 6)).toEqual(['e1']); expect(boxes(a, 0)).toEqual([]);
    week(a, 2); expect(boxes(a, 6)).toEqual([]); expect(boxes(a, 0)).toEqual(['e1+']);
  });
  it('a Sunday-night event of the last week continues on Monday of week 1', () => {
    const a = fresh(blank({ cycle: 3, events: [ev1({ weeks: [3], slots: [sl(6, 1320, 1800)] })] }));
    expect(boxes(a, 0)).toEqual(['e1+']); week(a, 2); expect(boxes(a, 0)).toEqual([]); week(a, 3); expect(boxes(a, 6)).toEqual(['e1']);
  });
  it('an every-week event still wraps from every Sunday into the following Monday', () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ slots: [sl(6, 1320, 1800)] })] }));
    [1, 2].forEach(w => { week(a, w); expect(boxes(a, 0)).toEqual(['e1+']); expect(boxes(a, 6)).toEqual(['e1']); });
  });
  it('overlapping repetitions are found across the boundary between weeks, and only there', () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ slots: [sl(6, 1320, 1800, { wk: 1 }), sl(0, 300, 360, { wk: 2 }), sl(0, 300, 360, { wk: 1 })] })] }));
    expect(ovl(a).sort()).toEqual([0, 1]);
  });
  it('the last week of a per-week event wraps into week 1 when looking for overlaps', () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ slots: [sl(6, 1320, 1800, { wk: 2 }), sl(0, 300, 360, { wk: 1 })] })] }));
    expect(ovl(a).sort()).toEqual([0, 1]);
  });
  it('with a cycle of one week the wrap is the old Sunday-to-Monday wrap', () => {
    const a = fresh(blank({ events: [ev1({ slots: [sl(6, 1320, 1800), sl(0, 300, 360)] })] }));
    expect(boxes(a, 0).sort()).toEqual(['e1', 'e1+']); expect(ovl(a).sort()).toEqual([0, 1]);
  });
});

describe('R-CYC-07 Each week of the cycle shows, lays out and finds only its own occurrences', () => {
  const two = (o1, o2) => blank({ cycle: 2, people, events: [ev1({ id: 'x', ...o1, slots: [sl(0, 600, 720, { person: 'A' })] }), ev1({ id: 'y', ...o2, slots: [sl(0, 600, 720, { person: 'A' })] })] });
  it('an event of week 1 is drawn in week 1 only, an every-week event in both', () => {
    const a = fresh(two({ weeks: [1] }, {}));
    expect(boxes(a, 0).sort()).toEqual(['x', 'y']); week(a, 2); expect(boxes(a, 0)).toEqual(['y']);
  });
  it('occurrences in different weeks never clash: no stripes in either week', () => {
    const a = fresh(two({ weeks: [1] }, { weeks: [2] }));
    expect(a.qa('.ov')).toHaveLength(0); expect(boxes(a, 0)).toEqual(['x']); week(a, 2); expect(a.qa('.ov')).toHaveLength(0); expect(boxes(a, 0)).toEqual(['y']);
  });
  it('the same two events in the same week still clash with stripes', () => {
    const a = fresh(two({ weeks: [2] }, { weeks: [2] })); expect(a.qa('.ov')).toHaveLength(0); week(a, 2); expect(a.qa('.ov').length).toBeGreaterThan(0);
  });
  it('lanes are worked out per week: parallel events of another week take no lane', () => {
    const d = blank({ cycle: 2, people, events: [ev1({ id: 'x', weeks: [1], slots: [sl(0, 600, 720, { person: 'A' })] }), ev1({ id: 'y', weeks: [2], slots: [sl(0, 600, 720, { person: 'B' })] }), ev1({ id: 'z', slots: [sl(0, 600, 720, { person: 'B' })] })] });
    const a = fresh(d); expect(a.qa('.day[data-d="0"] .ev').map(b => b.dataset.lane)).toEqual(['0/2', '1/2']);
    week(a, 2); expect(a.qa('.day[data-d="0"] .ev').map(b => b.dataset.lane || 'full')).toEqual(['full', 'full']); expect(a.qa('.ov').length).toBeGreaterThan(0);
  });
  it('clicking finds only the shown week\'s occurrence where two weeks have one at the same time', () => {
    const a = fresh(two({ weeks: [1] }, { weeks: [2] }));
    expect(a.ev('piecesAt(0,630,false,null).map(x=>x.e.id)')).toEqual(['x']); week(a, 2); expect(a.ev('piecesAt(0,630,false,null).map(x=>x.e.id)')).toEqual(['y']);
  });
  it('repetitions of a per-week event in different weeks at the same time get no ⚠, in the same week they do', () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ slots: [sl(0, 600, 720, { wk: 1 }), sl(0, 600, 720, { wk: 2 }), sl(2, 600, 720, { wk: 1 }), sl(2, 630, 690, { wk: 1 })] })] }));
    expect(ovl(a).sort()).toEqual([2, 3]); expect(a.q('.day[data-d="0"] .ev').innerHTML).not.toContain('#ffd23f'); expect(a.q('.day[data-d="2"] .ev').innerHTML).toContain('#ffd23f');
  });
  it('a nested activity needs a host in the same week: in another week it stands alone or clashes as usual', () => {
    const a = fresh(blank({ cycle: 3, people, events: [ev1({ id: 'host', weeks: [1], slots: [sl(0, 480, 540, { person: 'A' })] }), ev1({ id: 'milk', nest: true, slots: [sl(0, 510, 525, { person: 'A' })] }), ev1({ id: 'part', weeks: [3], slots: [sl(0, 515, 600, { person: 'A' })] })] }));
    expect(a.qa('.ev.nest').map(b => b._it.e.id)).toEqual(['milk']);
    week(a, 2); expect(a.qa('.ev.nest')).toHaveLength(0); expect(boxes(a, 0)).toEqual(['milk']); expect(a.qa('.ov')).toHaveLength(0);
    week(a, 3); expect(a.qa('.ev.nest')).toHaveLength(0); expect(a.qa('.ov').length).toBeGreaterThan(0);
  });
  it('background strips appear only in the weeks of their event', () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ bg: true, weeks: [2] })] })); expect(a.qa('.bgs')).toHaveLength(0); week(a, 2); expect(a.qa('.bgs')).toHaveLength(1);
  });
  it('fixed lanes give an external person a lane in every week once they have an activity in any week', () => {
    const d = blank({ cycle: 2, people: [person({ id: 'A' }), person({ id: 'X', name: 'Cleaner', external: true })], events: [ev1({ weeks: [2], slots: [sl(0, 600, 660, { person: 'X' })] })] });
    const a = fresh(d); a.ev('state.prefs.lanesFix=true;render()'); expect(a.ev('fixedLayout([{e:state.S.events[0],s:state.S.events[0].slots[0]}]).values().next().value.n')).toBe(2);
  });
});

describe('R-CYC-16 Phases have weeks like events: a rhythm can differ per week of the cycle (shift work)', () => {
  const rh = [{ id: 'r', name: 'R', visible: true }];
  const ph = (o = {}) => ({ id: 'p', title: 'Night shift', desc: '', color: '#3b6df0', rhythms: ['r'], slots: [sl(1, 1260, 1440)], ...o });
  const phx = (a, d) => a.qa(`.day[data-d="${d}"] .phx`).length, lipT = a => a.qa('.lane .lip').map(l => l.textContent);
  it('a phase without weeks is drawn in each week of the cycle, at the same place', () => {
    const a = fresh(blank({ cycle: 3, rhythms: [{ id: 'r', name: 'R', visible: true }], phases: [{ id: 'p', title: 'Lunch', desc: '', color: '#3b6df0', rhythms: ['r'], slots: [sl(1, 720, 780)] }] }));
    [1, 2, 3].forEach(w => { week(a, w); expect(a.qa('.day[data-d="1"] .phx')).toHaveLength(1); expect(a.qa('.lane .lip').length).toBeGreaterThan(0); });
  });
  it('a phase with a week pattern is drawn only in its weeks; its lip says which weeks', () => {
    const a = fresh(blank({ cycle: 3, rhythms: rh, phases: [ph({ weeks: [2] })] }));
    expect([1, 2, 3].map(w => { week(a, w); return phx(a, 1); })).toEqual([0, 1, 0]); week(a, 2); expect(a.q('.lane .lip').title).toContain('Week 2');
  });
  it('a phase with different times per week draws each time in its own week, and lips group only within the week', () => {
    const a = fresh(blank({ cycle: 2, rhythms: rh, phases: [ph({ title: 'Shift', slots: [sl(0, 360, 840, { wk: 1 }), sl(1, 360, 840, { wk: 1 }), sl(0, 1260, 1440, { wk: 2 })] })] }));
    expect(a.qa('.day[data-d="0"] .phx').map(x => x.style.top)).toEqual([a.ev('(360-hrA()*60)/60*state.HH+"px"')]); expect(lipT(a)).toEqual(['Shift']);
    week(a, 2); expect(phx(a, 0)).toBe(1); expect(phx(a, 1)).toBe(0); expect(a.q('.lane .lip').title).toContain('21:00');
  });
  it('the phase dialog has the Weeks row and Different per week, with its own tooltip, and saves weeks like an event', () => {
    const a = fresh(blank({ cycle: 2, rhythms: rh, phases: [ph()] })); a.ev("state.editMode='phases';render();openDlg(state.S.phases[0])");
    expect(a.q('#fWk').style.display).toBe(''); expect(a.q('#fWk b').title).toContain('this phase'); const ch = a.qa('#fWk .chips input');
    ch[0].checked = false; ch[0].dispatchEvent(new a.w.Event('change')); a.q('#fOk').click(); expect(a.ev('state.S.phases[0].weeks')).toEqual([2]);
    a.ev('openDlg(state.S.phases[0])'); a.q('#fPw').checked = true; a.q('#fPw').onchange(); expect(a.q('#paneQ').classList.contains('pw')).toBe(true);
    expect(a.q('#fDays .dr:not(.off) button.wkc').textContent).toBe('2'); a.q('#fOk').click(); expect(a.ev('JSON.stringify(state.S.phases[0])')).toContain('"wk":2'); expect(a.ev('state.S.phases[0].weeks')).toBeUndefined();
  });
  it('dragging a phase with its own week moves it along the cycle; Sunday of week 1 goes to Monday of week 2', () => {
    const a = fresh(blank({ cycle: 2, rhythms: rh, phases: [ph({ slots: [sl(6, 600, 660, { wk: 1 })] })] })); a.ev("state.editMode='phases';render()");
    a.ev('state.S.phases[0].slots.forEach(s=>shiftDay(s,1));render()'); expect(a.ev('JSON.stringify(state.S.phases[0].slots[0])')).toContain('"day":0'); expect(a.ev('state.S.phases[0].slots[0].wk')).toBe(2);
  });
  it('the rhythm agenda names a pattern\'s weeks and gives different times per week a section each', () => {
    const a = fresh(blank({ cycle: 2, rhythms: rh, phases: [ph({ weeks: [2] }), ph({ id: 'q', title: 'Shift', slots: [sl(0, 360, 840, { wk: 1 }), sl(0, 1260, 1440, { wk: 2 })] })] }));
    const h = a.ev('rhythmAgendaHTML(state.S.rhythms[0])'); expect(h).toContain('Week 2'); expect((h.match(/class="pwk"/g) || []).length).toBe(2); expect(h).toContain('06:00–14:00'); expect(h).toContain('21:00–00:00');
  });
  it('lengthening to a multiple in step extends the weeks of phases too; shrinking lists phases and can move them into a rhythm per week', () => {
    const a = fresh(blank({ cycle: 2, rhythms: rh, phases: [ph({ weeks: [2] }), ph({ id: 'q', title: 'Shift', slots: [sl(0, 360, 840, { wk: 1 }), sl(0, 1260, 1440, { wk: 2 })] })] }));
    a.ev('setCycle(4,true)'); expect(a.ev('state.S.phases[0].weeks')).toEqual([2, 4]); expect(a.ev('state.S.phases[1].slots.map(s=>s.wk)')).toEqual([1, 3, 2, 4]);
    a.ev('shrinkCycle(1)'); expect(a.dlgText()).toContain('Night shift'); expect(a.dlgText()).toContain('events and phases');
    a.qa('#xDlg input[type=radio]').find(r => r.value === 'mv').click(); a.click('Apply');
    expect(a.ev('state.S.rhythms.map(r=>r.name)')).toEqual(['R', 'Week 2', 'Week 3', 'Week 4']); expect(a.ev('state.S.rhythms.slice(1).every(r=>!r.visible)')).toBe(true);
    expect(a.ev('state.S.phases.filter(p=>p.rhythms[0]==="r").map(p=>p.title)')).toEqual(['Shift']); expect(a.ev('state.S.phases.every(p=>!p.weeks&&p.slots.every(s=>!s.wk))')).toBe(true);
  });
  it('inserting a workspace whose phases use weeks beyond the cycle asks first, like events', () => {
    const a = fresh(blank({ rhythms: rh })); const src = JSON.stringify(blank({ cycle: 2, rhythms: [{ id: 'x', name: 'Shifts', visible: true }], phases: [ph({ rhythms: ['x'], weeks: [2] })] }));
    a.ev(`openImport({name:'W',data:parseData(${src})},'file')`); a.qa('#xDlg input[type=radio]')[1].click(); a.click('Import');
    return sleep(5).then(() => { expect(a.dlgText()).toContain('events or phases arriving (1)'); a.click('Apply'); return sleep(5); })
      .then(() => { expect(a.ev('state.S.cycle')).toBe(2); expect(a.ev('state.S.phases.at(-1).weeks')).toEqual([2]); });
  });
  it('transferring a rhythm into a workspace with a shorter cycle asks first, like a schedule', () => {
    const a = fresh(blank({ cycle: 2, rhythms: rh, phases: [ph({ weeks: [2] })] })); a.ev("addWorkspace&&0;state.WS.push(newWs('Other',parseData({schedules:[{id:'s',name:'S'}],events:[]}),false))");
    a.ev("doTransfer('rhythm',state.S.rhythms[0],state.WS.at(-1),false)"); return sleep(5).then(() => { expect(a.dlgText()).toContain('events or phases arriving (1)'); a.qa('#xDlg input[type=radio]').find(r => r.value === 'rm').click(); a.click('Apply'); return sleep(5); })
      .then(() => { expect(a.ev('state.WS.at(-1).data.phases.length')).toBe(0); expect(a.ev('state.WS.at(-1).data.rhythms.map(r=>r.name)')).toEqual(['R']); });
  });
});

const openCycleDlg = a => { a.q('.wsbtn').click(); a.qa('.omenu .oi').find(b => b.textContent.includes('Weeks in the cycle')).click(); };
const chooseLen = (a, n) => { const s = a.q('#xDlg select'); s.value = String(n); s.dispatchEvent(new a.w.Event('change')); };
const evs = a => JSON.parse(a.ev('JSON.stringify(state.S.events.map(e=>({id:e.id,weeks:e.weeks,wk:e.slots.map(s=>s.wk||0),sch:e.schedules})))'));

describe('R-CYC-01 The cycle length is set from the workspace menu and is data', () => {
  it('Weeks in the cycle… sets 1 to 4 weeks for the workspace, as an undoable unsaved change', () => {
    const a = fresh(blank()); a.ev('cw().lb=keyOf(state.S)'); openCycleDlg(a); expect(a.dlgTitle()).toBe('Weeks in the cycle');
    expect(a.qa('#xDlg .cyrow select option').map(o => o.textContent)).toEqual(['1 week', '2 weeks', '3 weeks', '4 weeks']);
    chooseLen(a, 3); a.click('Apply'); expect(a.ev('state.S.cycle')).toBe(3); expect(a.toast()).toBe('The cycle now has 3 weeks'); expect(a.ev('anyDirty()')).toBe(true);
    a.key('z', { ctrlKey: true }); expect(a.ev('state.S.cycle')).toBe(1);
  });
  it('the dialog explains that events happen every week unless their weeks are chosen, and how to keep a rota', () => {
    const a = fresh(blank()); openCycleDlg(a); expect(a.dlgText()).toContain('Events happen every week unless you choose their weeks'); expect(a.dlgText()).toContain('the people in it as involved');
  });
  it('the dialog and its menu entry are translated into Spanish', () => {
    const a = openApp({ languages: ['es-ES'] }); a.q('.wsbtn').click(); expect(a.qa('.omenu .oi').map(b => b.textContent.trim())).toContain('Semanas del ciclo…');
    a.qa('.omenu .oi').find(b => b.textContent.includes('Semanas del ciclo')).click(); expect(a.dlgTitle()).toBe('Semanas del ciclo'); expect(a.qa('#xDlg select option')[1].textContent).toBe('2 semanas');
  });
});

describe('R-CYC-04 The week switcher in the grid corner chooses the week shown, as view state', () => {
  const two = () => fresh(blank({ cycle: 2, events: [ev1({ weeks: [2] })] }));
  const btn = a => a.q('.dh.c .wkb');
  const pick = (a, label) => { btn(a).click(); a.qa('.omenu .oi').find(b => b.textContent.trim() === label).click(); };
  it('the corner shows no switcher while the cycle is one week', () => {
    expect(fresh(blank()).q('.dh.c .wkb')).toBeNull();
  });
  it('with a longer cycle the corner shows the week number, named for screen readers', () => {
    const a = two(); expect(btn(a).textContent).toBe('W1'); expect(btn(a).getAttribute('aria-label')).toBe('Week 1 of 2 is shown. Choose another week of the cycle');
  });
  it('its menu lists every week, ticks the shown one, and offers Weeks in the cycle…', () => {
    const a = two(); btn(a).click(); expect(a.qa('.omenu .oi').map(b => b.textContent.trim())).toEqual(['Week 1', 'Week 2', 'All weeks side by side', 'Weeks in the cycle…']);
    expect(a.qa('.omenu .oi')[0].querySelector('svg')).not.toBeNull(); expect(a.qa('.omenu .oi')[1].querySelector('svg')).toBeNull();
  });
  it('choosing a week redraws the grid for that week', () => {
    const a = two(); expect(boxes(a, 0)).toEqual([]); pick(a, 'Week 2'); expect(btn(a).textContent).toBe('W2'); expect(boxes(a, 0)).toEqual(['e1']);
  });
  it('switching weeks is not an unsaved change and cannot be undone', () => {
    const a = two(); a.ev('cw().lb=keyOf(state.S)'); pick(a, 'Week 2'); expect(a.ev('anyDirty()')).toBe(false); expect(a.ev('state.undoSt.length')).toBe(0);
  });
  it('undo and redo of a data change keep the week that is shown', () => {
    const a = two(); pick(a, 'Week 2'); a.ev("hist();state.S.events[0].title='X';render()"); a.key('z', { ctrlKey: true }); expect(btn(a).textContent).toBe('W2'); expect(a.ev('state.S.events[0].title')).toBe('Event');
  });
  it('the week is never saved: it is not in files or browser memory', () => {
    const a = two(); pick(a, 'Week 2'); expect(JSON.stringify(a.ev('buildFile()'))).not.toMatch(/curWk|"week"/); a.ev("saveMem('all')"); expect(a.storage()['weekly-schedules-workspaces']).not.toMatch(/curWk/);
  });
  it('a shorter cycle brings the shown week back inside it', () => {
    const a = fresh(blank({ cycle: 3 })); week(a, 3); a.ev('setCycle(2)'); expect(btn(a).textContent).toBe('W2');
  });
  it('in the day view ▶ on Sunday goes on to Monday of the next week, and ◀ back again; the header names the week', () => {
    const a = two(); a.ev('setFocus(6)'); expect(a.q('.dh.fo').textContent).toContain('Sunday · W1');
    a.q('.dh .nxt').click(); expect(a.ev('state.focusD')).toBe(0); expect(btn(a).textContent).toBe('W2'); expect(a.q('.dh.fo').textContent).toContain('Monday · W2');
    a.q('.dh .prv').click(); expect(a.ev('[state.focusD,state.curWk]')).toEqual([6, 1]);
  });
  it('stepping forward from Sunday of the last week wraps to week 1, also skipping a hidden weekend', () => {
    const a = two(); a.ev('state.prefs.hideWeekend=true;state.curWk=2;setFocus(4)'); a.q('.dh .nxt').click(); expect(a.ev('[state.focusD,state.curWk]')).toEqual([0, 1]);
    a.q('.dh .prv').click(); expect(a.ev('[state.focusD,state.curWk]')).toEqual([4, 2]);
  });
  it('with a cycle of one week stepping wraps within the week, as before', () => {
    const a = fresh(blank()); a.ev('setFocus(6)'); a.q('.dh .nxt').click(); expect(a.ev('[state.focusD,state.curWk]')).toEqual([0, 1]); expect(a.q('.dh.fo').textContent).not.toContain('·');
  });
});

describe('R-CYC-10 Changing the cycle length keeps meaning where it can and never removes anything silently', () => {
  const data = () => blank({ cycle: 2, events: [ev1({ id: 'every' }), ev1({ id: 'odd', weeks: [1] }), ev1({ id: 'per', slots: [sl(0, 600, 660, { wk: 2 }), sl(1, 600, 660, { wk: 1 })] })] });
  it('lengthening keeps every-week events every week', () => {
    const a = fresh(blank({ events: [ev1()] })); openCycleDlg(a); chooseLen(a, 2); a.click('Apply'); expect(evs(a)[0].weeks).toBeUndefined();
    [1, 2].forEach(w => { week(a, w); expect(boxes(a, 0)).toEqual(['e1']); });
  });
  it('going to a multiple repeats events of chosen weeks in the new weeks, ticked by default', () => {
    const a = fresh(data()); openCycleDlg(a); chooseLen(a, 4); expect(a.q('#xDlg .cyext').style.display).toBe(''); expect(a.q('#xDlg .cyext input').checked).toBe(true);
    a.click('Apply'); const e = evs(a); expect(e[1].weeks).toEqual([1, 3]); expect(e[2].wk).toEqual([2, 4, 1, 3]); expect(e[0].weeks).toBeUndefined();
  });
  it('unticking the option keeps the week numbers as they were', () => {
    const a = fresh(data()); openCycleDlg(a); chooseLen(a, 4); a.q('#xDlg .cyext input').checked = false; a.click('Apply');
    const e = evs(a); expect(e[1].weeks).toEqual([1]); expect(e[2].wk).toEqual([2, 1]);
  });
  it('going to a length that is not a multiple says that every other week cannot be kept', () => {
    const a = fresh(data()); openCycleDlg(a); chooseLen(a, 3); expect(a.q('#xDlg .cyext').style.display).toBe('none'); expect(a.dlgText()).toContain('cannot be kept in a cycle of 3 weeks');
    a.click('Apply'); expect(evs(a)[1].weeks).toEqual([1]);
  });
  it('shrinking lists the events that happen in the weeks that go, and Cancel changes nothing', async () => {
    const a = fresh(data()); openCycleDlg(a); chooseLen(a, 1); a.click('Apply'); await a.sleep(5);
    expect(a.dlgText()).toContain('Week 2 will no longer be part of the cycle'); expect(a.qa('#xDlg li').map(l => l.textContent)).toEqual(['Event · Weeks 1 and 2']);
    a.click('Cancel'); expect(a.ev('state.S.cycle')).toBe(2); expect(evs(a)).toEqual(evs(fresh(data())));
  });
  it('shrinking with Remove drops the occurrences of the removed weeks and keeps the rest, in one undo step', async () => {
    const a = fresh(blank({ cycle: 3, events: [ev1({ id: 'odd', weeks: [1, 3] }), ev1({ id: 'gone', weeks: [3] }), ev1({ id: 'per', slots: [sl(0, 600, 660, { wk: 3 }), sl(1, 600, 660, { wk: 2 })] })] }));
    openCycleDlg(a); chooseLen(a, 2); a.click('Apply'); await a.sleep(5);
    expect(a.qa('#xDlg li').map(l => l.textContent)).toEqual(['Event · Weeks 1 and 3', 'Event · Week 3 · nothing left in the other weeks', 'Event · Weeks 2 and 3']);
    a.qa('#xDlg input[name=cym]').find(r => r.value === 'rm').checked = true; a.click('Apply'); expect(evs(a)).toEqual([{ id: 'odd', weeks: [1], wk: [0], sch: ['s1'] }, { id: 'per', wk: [2], sch: ['s1'] }]);
    a.key('z', { ctrlKey: true }); expect(a.ev('state.S.cycle')).toBe(3); expect(evs(a).map(e => e.id)).toEqual(['odd', 'gone', 'per']);
  });
  it('shrinking with Move keeps those occurrences in a new schedule per removed week, as week 1', async () => {
    const a = fresh(blank({ cycle: 3, events: [ev1({ id: 'odd', weeks: [1, 3] }), ev1({ id: 'per', slots: [sl(0, 600, 660, { wk: 3 }), sl(1, 600, 660, { wk: 2 })] })] }));
    openCycleDlg(a); chooseLen(a, 2); a.click('Apply'); await a.sleep(5); a.qa('#xDlg input[name=cym]').find(r => r.value === 'mv').checked = true; a.click('Apply');
    expect(a.ev('state.S.schedules.map(s=>s.name)')).toEqual(['S1', 'Week 3']); const sid = a.ev('state.S.schedules[1].id'), e = evs(a);
    expect(e.slice(0, 2).map(x => x.id)).toEqual(['odd', 'per']); expect(e.slice(2)).toMatchObject([{ weeks: [1], sch: [sid] }, { wk: [1], sch: [sid] }]);
  });
  it('shrinking to one week with Remove leaves no week marks at all', async () => {
    const a = fresh(data()); openCycleDlg(a); chooseLen(a, 1); a.click('Apply'); await a.sleep(5); a.qa('#xDlg input[name=cym]').find(r => r.value === 'rm').checked = true; a.click('Apply');
    expect(a.ev('state.S.cycle')).toBe(1); expect(evs(a)).toEqual([{ id: 'every', wk: [0], sch: ['s1'] }, { id: 'odd', wk: [0], sch: ['s1'] }, { id: 'per', wk: [0], sch: ['s1'] }]);
    expect(a.toast()).toBe('Every week is the same again (a cycle of one week)');
  });
});

describe('R-CYC-05 Live View asks which week of the cycle today is in, once per workspace, and this browser remembers it', () => {
  const freeze = (a, d, h = 10, m = 0) => a.ev(`Date=class extends Date{constructor(...a){a.length?super(...a):super(2026,9,${12 + d},${h},${m})}}`);   // 12 October 2026 is a Monday
  const on = (d, h = 10) => [2026, 9, 12 + d, h, 0];
  const start = a => a.q('#lvB').click();
  const answer = (a, w, btn = 'Start Live View') => { const s = a.q('#xDlg select'); s.value = String(w); a.click(btn); };
  const corner = a => a.q('.dh.c .wkb');
  const anchors = a => JSON.parse(a.storage()['weekly-schedules-prefs'] || '{}').lvAnchor || {};
  const data = () => blank({ cycle: 3, events: [ev1({ id: 'two', weeks: [2], slots: [sl(2, 600, 660)] })] });
  const stored = (a, prefs) => ({ 'weekly-schedules-workspaces': a.storage()['weekly-schedules-workspaces'], 'weekly-schedules-prefs': JSON.stringify(prefs) });
  const saved = () => { const a = fresh(data()); a.ev("saveMem('all')"); return { a, id: a.ev('state.curId') }; };
  it('starting Live View with a cycle asks the week first, preselecting the week shown', () => {
    const a = fresh(data()); freeze(a, 2); week(a, 2); start(a); expect(a.dlgTitle()).toBe('Which week is it?'); expect(a.ev('state.live')).toBe(false);
    expect(a.q('#xDlg select').value).toBe('2'); expect(a.qa('#xDlg select option').map(o => o.textContent)).toEqual(['Week 1', 'Week 2', 'Week 3']);
  });
  it('the answer starts Live View on today in that week, and the header names the week', () => {
    const a = fresh(data()); freeze(a, 2); start(a); answer(a, 2);
    expect(a.ev('[state.live,state.focusD,state.curWk]')).toEqual([true, 2, 2]); expect(boxes(a, 2)).toEqual(['two']); expect(a.q('.dh:not(.c)').textContent).toBe('Wednesday · W2');
  });
  it('Cancel does not start Live View and remembers nothing', () => {
    const a = fresh(data()); freeze(a, 2); start(a); a.click('Cancel'); expect(a.ev('state.live')).toBe(false); expect(a.ev('state.focusD')).toBeNull(); expect(anchors(a)).toEqual({});
  });
  it('a cycle of one week starts Live View at once, without asking or remembering a date', () => {
    const a = fresh(blank()); freeze(a, 2); start(a); expect(a.ev('state.live')).toBe(true); expect(a.dlgOpen()).toBe(false); expect(anchors(a)).toEqual({});
  });
  it('the answer is remembered in this browser as the Monday of a week 1, for this workspace only', () => {
    const a = fresh(data()); freeze(a, 2); start(a); answer(a, 2); a.ev("saveMem('all')");
    expect(anchors(a)).toEqual({ [a.ev('state.curId')]: '2026-10-05' });   // Wednesday 14 October is in week 2, so week 1 began on Monday 5 October
    expect(a.storage()['weekly-schedules-workspaces']).not.toMatch(/2026|lvAnchor/); expect(JSON.stringify(a.ev('buildFile()'))).not.toMatch(/2026|lvAnchor/);
    expect(a.ev('anyDirty()')).toBe(false); expect(a.ev('state.undoSt.length')).toBe(0);
  });
  it('the week is asked only once: stopping and starting again does not ask', () => {
    const a = fresh(data()); freeze(a, 2); start(a); answer(a, 3); a.ev('setLive(false)'); start(a); expect(a.dlgOpen()).toBe(false); expect(a.ev('[state.live,state.curWk]')).toEqual([true, 3]);
  });
  it('after a reload with Live View remembered, it starts at once on today\'s week, without asking', () => {
    const { a, id } = saved();
    const b = openApp({ now: on(2), storage: stored(a, { live: true, lvAnchor: { [id]: '2026-10-05' } }) }); expect(b.dlgOpen()).toBe(false); expect(b.ev('[state.live,state.focusD,state.curWk]')).toEqual([true, 2, 2]);
    const c = openApp({ now: on(2 + 7), storage: stored(a, { live: true, lvAnchor: { [id]: '2026-10-05' } }) }); expect(c.ev('[state.live,state.focusD,state.curWk]')).toEqual([true, 2, 3]);   // a week later
    const d = openApp({ now: on(2 + 14), storage: stored(a, { live: true, lvAnchor: { [id]: '2026-10-05' } }) }); expect(d.ev('state.curWk')).toBe(1);   // the cycle wraps
  });
  it('after a reload with Live View remembered but no week known, it asks; Cancel leaves it off', () => {
    const { a } = saved();
    const b = openApp({ now: on(2), storage: stored(a, { live: true }) }); expect(b.dlgTitle()).toBe('Which week is it?'); expect(b.ev('state.live')).toBe(false); answer(b, 3); expect(b.ev('[state.live,state.curWk]')).toEqual([true, 3]);
    const c = openApp({ now: on(2), storage: stored(a, { live: true }) }); c.click('Cancel'); expect(c.ev('state.live')).toBe(false); expect(JSON.parse(c.storage()['weekly-schedules-prefs']).live).toBe(false);
  });
  it('outside Live View the page opens on today\'s week, and the week menu and corner tooltip name it', () => {
    const { a, id } = saved(); const b = openApp({ now: on(2), storage: stored(a, { lvAnchor: { [id]: '2026-09-28' } }) });   // week 1 began two weeks earlier: today is in week 3
    expect(b.ev('[state.live,state.focusD,state.curWk]')).toEqual([false, null, 3]); expect(b.q('.dh.c .wkb').title).toBe('Week 3 of 3 is shown. Choose another week of the cycle. Today is in week 3 (remembered in this browser; to correct it, change the week while Live View runs).');
    b.q('.dh.c .wkb').dispatchEvent(new b.w.MouseEvent('click', { bubbles: true, cancelable: true })); expect(b.qa('.omenu .oi').map(x => x.textContent.trim()).slice(0, 3)).toEqual(['Week 1', 'Week 2', 'Week 3 · today']);
    const c = openApp({ now: on(2), storage: stored(a, {}) }); expect(c.ev('state.curWk')).toBe(1); expect(c.q('.dh.c .wkb').title).toBe('Week 1 of 3 is shown. Choose another week of the cycle');
  });
  it('a phone opens on today\'s day view in today\'s week', () => {
    const { a, id } = saved(); const b = openApp({ phone: true, now: on(2), storage: stored(a, { lvAnchor: { [id]: '2026-10-05' } }) }); expect(b.ev('[state.live,state.focusD,state.curWk]')).toEqual([false, 2, 2]);
  });
  it('once today\'s week is known, the now line shows only in that week', () => {
    const { a, id } = saved(); const b = openApp({ now: on(2), storage: stored(a, { lvAnchor: { [id]: '2026-10-05' } }) }); b.ev('drawNow()');
    expect(b.qa('.day[data-d="2"] .now')).toHaveLength(1); week(b, 1); b.ev('drawNow()'); expect(b.qa('.now')).toHaveLength(0);
    const c = openApp({ now: on(2), storage: stored(a, {}) }); c.ev('drawNow()'); expect(c.qa('.day[data-d="2"] .now')).toHaveLength(1);   // not known: in whichever week is shown
  });
  it('each workspace has its own week: switching while live asks for one it does not know yet', async () => {
    const a = fresh(data()); freeze(a, 2); start(a); answer(a, 2); const first = a.ev('state.curId');
    a.ev(`(()=>{const w=newWs('Other',parseData(${JSON.stringify(data())}),false);state.WS.push(w);switchWs(w.id)})()`); await a.sleep(5);
    expect(a.dlgTitle()).toBe('Which week is it?'); answer(a, 3, 'Show this week'); expect(a.ev('[state.live,state.curWk]')).toEqual([true, 3]);
    a.ev(`switchWs('${first}')`); await a.sleep(5); expect(a.dlgOpen()).toBe(false); expect(a.ev('state.curWk')).toBe(2); expect(Object.keys(anchors(a))).toHaveLength(2);
  });
  it('Cancel on that question stops Live View', async () => {
    const a = fresh(data()); freeze(a, 2); start(a); answer(a, 2);
    a.ev(`(()=>{const w=newWs('Other',parseData(${JSON.stringify(data())}),false);state.WS.push(w);switchWs(w.id)})()`); await a.sleep(5); a.click('Cancel'); expect(a.ev('state.live')).toBe(false);
  });
  it('a workspace that gets a cycle while live asks its week at the next tick', () => {
    const a = fresh(blank()); freeze(a, 2); start(a); expect(a.ev('state.live')).toBe(true); a.ev('state.S.cycle=2;render();liveTick()');
    expect(a.dlgTitle()).toBe('Which week is it?'); expect(a.dlgButtons()).toContain('Show this week'); answer(a, 2, 'Show this week'); expect(a.ev('[state.live,state.curWk]')).toEqual([true, 2]);
  });
  it('duplicating a workspace keeps its week; deleting one or clearing the memory forgets it', () => {
    const a = fresh(data()); freeze(a, 2); start(a); answer(a, 2); a.ev('setLive(false)'); const first = a.ev('state.curId');
    a.ev('duplicateWorkspace()'); const copy = a.ev('state.curId'); expect(anchors(a)).toEqual({ [first]: '2026-10-05', [copy]: '2026-10-05' });
    a.ev('deleteWorkspace()'); expect(anchors(a)).toEqual({ [first]: '2026-10-05' }); a.ev('clearMem()'); expect(anchors(a)).toEqual({});
  });
  it('damaged or hostile remembered weeks are ignored, and no workspace id can reach the object prototype', () => {
    const { a, id } = saved(); const b = openApp({ now: on(2), storage: stored(a, { lvAnchor: { [id]: 'soon', other: 5, ['x'.repeat(65)]: '2026-10-05' } }) });
    expect(b.ev('Object.keys(state.prefs.lvAnchor)')).toEqual([]); expect(b.ev('state.curWk')).toBe(1);
    const c = openApp({ now: on(2), storage: { ...stored(a, {}), 'weekly-schedules-prefs': `{"lvAnchor":{"__proto__":"2026-10-05","constructor":"2026-10-05"}}` } });
    expect(c.ev('({}).constructor===Object')).toBe(true); expect(c.ev('state.prefs.lvAnchor.constructor')).toBe('2026-10-05'); expect(c.ev('state.curWk')).toBe(1);
    c.ev(`cw().id='constructor';state.curId='constructor';render()`); expect(c.ev('todayWk()')).toBe(2);
    c.ev(`cw().id='__proto__';state.curId='__proto__';setAnchor(1)`); expect(c.ev('Object.getPrototypeOf(state.prefs.lvAnchor)===null&&({}).constructor===Object&&!("2026-10-12" in {})')).toBe(true); expect(c.ev('todayWk()')).toBe(1);
  });
  it('at midnight after Sunday Live View moves on to Monday of the next week', () => {
    const a = fresh(data()); freeze(a, 6, 23, 50); start(a); answer(a, 1); expect(a.ev('[state.focusD,state.curWk]')).toEqual([6, 1]);
    freeze(a, 7, 0, 5); a.ev('liveTick()'); expect(a.ev('[state.focusD,state.curWk]')).toEqual([0, 2]);
  });
  it('the last week of the cycle moves on to week 1', () => {
    const a = fresh(data()); freeze(a, 6, 23, 50); start(a); answer(a, 3); freeze(a, 7, 0, 5); a.ev('liveTick()'); expect(a.ev('state.curWk')).toBe(1);
  });
  it('a tablet that slept for days still lands on the right week', () => {
    const a = fresh(data()); freeze(a, 2); start(a); answer(a, 1); freeze(a, 2 + 14 + 6); a.ev('liveTick()'); expect(a.ev('[state.focusD,state.curWk]')).toEqual([1, 1]);   // 20 days later: Tuesday, three weeks on
  });
  it('the corner switcher stays pressable while live; correcting the week jumps to today in that week and is remembered', () => {
    const a = fresh(data()); freeze(a, 2); start(a); answer(a, 1); expect(corner(a).textContent).toBe('W1');
    corner(a).dispatchEvent(new a.w.MouseEvent('click', { bubbles: true, cancelable: true })); expect(a.qa('.omenu .oi').map(b => b.textContent.trim())).toEqual(['Week 1 · today', 'Week 2', 'Week 3']);
    a.qa('.omenu .oi')[1].click(); expect(a.ev('[state.live,state.focusD,state.curWk]')).toEqual([true, 2, 2]); expect(boxes(a, 2)).toEqual(['two']); expect(anchors(a)).toEqual({ [a.ev('state.curId')]: '2026-10-05' });
    freeze(a, 3); a.ev('liveTick()'); expect(a.ev('[state.focusD,state.curWk]')).toEqual([3, 2]);
  });
  it('outside Live View choosing a week only changes the week shown, not the remembered one', () => {
    const a = fresh(data()); freeze(a, 2); start(a); answer(a, 1); a.ev('setLive(false)'); a.ev('setWeek(3)'); expect(a.ev('[state.curWk,todayWk()]')).toEqual([3, 1]);
  });
  it('leaving Live View keeps its week on the grid', () => {
    const a = fresh(data()); freeze(a, 2); start(a); answer(a, 3); a.ev('setLive(false)'); expect(a.ev('[state.focusD,state.curWk]')).toEqual([null, 3]);
  });
  it('the question is translated into Spanish', () => {
    const a = openApp({ languages: ['es-ES'] }); setData(a, data()); freeze(a, 2); start(a); expect(a.dlgTitle()).toBe('¿Qué semana es?'); expect(a.dlgButtons()).toContain('Iniciar vista en directo');
    answer(a, 1, 'Iniciar vista en directo'); a.ev('setLive(false)'); expect(a.q('.dh.c .wkb').title).toMatch(/Hoy está en la semana 1 \(lo recuerda este navegador/);
  });
});

describe('R-CYC-08 The event dialog: a Weeks row, and a week for every time when it differs per week', () => {
  const lines = a => a.qa('#fDays .dr:not(.off)');
  const lineOf = r => [r.closest('.dr').querySelector('.wkc').textContent, r.querySelectorAll('select')[0].value];
  const chips = a => a.qa('#fWk .chips input');
  const pw = a => a.q('#fPw');
  const toggle = (el, v) => { el.checked = v; el.dispatchEvent(new (el.ownerDocument.defaultView.Event)('change')); };
  const save = a => a.q('#fOk').click();
  const dayRow = (a, d) => a.qa('#fDays .dr:not(.dx)')[d];
  const tick = (a, d) => { const cb = dayRow(a, d).querySelector('input'); cb.checked = true; cb.dispatchEvent(new a.w.Event('change')); };
  const ev = a => JSON.parse(a.ev('JSON.stringify(state.S.events.at(-1))'));
  it('with a cycle of one week the dialog has no Weeks row and no week buttons', () => {
    const a = fresh(blank()); a.toolbar('add').click(); expect(a.q('#fWk').style.display).toBe('none'); expect(a.q('#paneQ').classList.contains('pw')).toBe(false);
  });
  it('a new event in a cycle of two weeks starts in every week and is saved without a pattern', () => {
    const a = fresh(blank({ cycle: 2 })); a.toolbar('add').click(); expect(a.q('#fWk').style.display).toBe(''); expect(a.q('#fWk b').textContent).toBe('Weeks');
    expect(chips(a).map(i => i.checked)).toEqual([true, true]); a.q('#fT').value = 'Lunch'; save(a); expect(ev(a)).not.toHaveProperty('weeks');
  });
  it('unticking a week chip saves a pattern of the other weeks; the last ticked week cannot be unticked', () => {
    const a = fresh(blank({ cycle: 3 })); a.toolbar('add').click(); a.q('#fT').value = 'Swim'; toggle(chips(a)[1], false); toggle(chips(a)[2], false);
    toggle(chips(a)[0], false); expect(chips(a)[0].checked).toBe(true); save(a); expect(ev(a).weeks).toEqual([1]);
  });
  it('an event with a pattern opens with its weeks ticked', () => {
    const a = fresh(blank({ cycle: 3, events: [ev1({ weeks: [1, 3] })] })); a.ev('openDlg(state.S.events[0])'); expect(chips(a).map(i => i.checked)).toEqual([true, false, true]);
  });
  it('Different per week copies every time into each week of the pattern and shows the week of each time', () => {
    const a = fresh(blank({ cycle: 3, events: [ev1({ weeks: [1, 3] })] })); a.ev('openDlg(state.S.events[0])'); toggle(pw(a), true);
    expect(a.q('#paneQ').classList.contains('pw')).toBe(true); expect(a.q('#fWk .chips')).toBeNull(); expect(lines(a).map(lineOf)).toEqual([['1', '600'], ['3', '600']]);
    save(a); expect(ev(a).slots.map(s => [s.day, s.wk])).toEqual([[0, 1], [0, 3]]); expect(ev(a)).not.toHaveProperty('weeks');
  });
  it('an event with weeks per time opens in that mode, its times in week order', () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ slots: [sl(0, 720, 780, { wk: 2 }), sl(0, 600, 660, { wk: 1 }), sl(2, 600, 660, { wk: 2 })] })] })); a.ev('openDlg(state.S.events[0])');
    expect(pw(a).checked).toBe(true); expect(lines(a).map(lineOf)).toEqual([['1', '600'], ['2', '720'], ['2', '600']]);
  });
  it('+ on a day proposes the same times in the next week that has none on that day yet', () => {
    const a = fresh(blank({ cycle: 3, events: [ev1({ slots: [sl(0, 600, 660, { wk: 1 })] })] })); a.ev('openDlg(state.S.events[0])'); dayRow(a, 0).querySelector('.addt').click();
    expect(lines(a).map(lineOf)).toEqual([['1', '600'], ['2', '600']]); dayRow(a, 0).querySelector('.addt').click(); expect(lines(a).map(lineOf)).toEqual([['1', '600'], ['2', '600'], ['3', '600']]);
    dayRow(a, 0).querySelector('.addt').click(); expect(lines(a).map(lineOf).at(-1)).toEqual(['3', '660']);   // every week has a time: after the day's last time, as before
  });
  it('choosing another week for a time from its button keeps the day\'s times in week order', () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ slots: [sl(0, 600, 660, { wk: 1 }), sl(0, 720, 780, { wk: 1 })] })] })); a.ev('openDlg(state.S.events[0])');
    lines(a)[0].querySelector('.wkc').click(); expect(a.qa('.cmenu .oi').map(b => b.textContent)).toEqual(['Week 1', 'Week 2']); a.qa('.cmenu .oi')[1].click();
    expect(lines(a).map(lineOf)).toEqual([['1', '720'], ['2', '600']]); save(a); expect(ev(a).slots.map(s => [s.start, s.wk])).toEqual([[720, 1], [600, 2]]);
  });
  it('⧉ makes the other ticked days like this one, weeks included', () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ slots: [sl(0, 600, 660, { wk: 1 }), sl(0, 600, 660, { wk: 2, person: '' }), sl(2, 800, 860, { wk: 1 })] })] })); a.ev('openDlg(state.S.events[0])');
    dayRow(a, 0).querySelector('.cpy').click(); a.q('.cmenu .oi').click(); save(a); expect(ev(a).slots.filter(s => s.day === 2).map(s => [s.start, s.wk])).toEqual([[600, 1], [600, 2]]);
  });
  it('a newly ticked day in per-week mode starts in the week shown on the grid', () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ slots: [sl(0, 600, 660, { wk: 1 })] })] })); week(a, 2); a.ev('openDlg(state.S.events[0])'); tick(a, 3);
    expect(dayRow(a, 3).querySelector('.wkc').textContent).toBe('2');
  });
  it('switching back to a pattern when every week has the same times gives the pattern of those weeks', () => {
    const a = fresh(blank({ cycle: 3, events: [ev1({ slots: [sl(0, 600, 660, { wk: 1 }), sl(0, 600, 660, { wk: 3 })] })] })); a.ev('openDlg(state.S.events[0])'); toggle(pw(a), false);
    expect(a.log.confirms).toEqual([]); expect(chips(a).map(i => i.checked)).toEqual([true, false, true]); expect(lines(a)).toHaveLength(1); save(a); expect(ev(a).weeks).toEqual([1, 3]); expect(ev(a).slots[0]).not.toHaveProperty('wk');
  });
  it('switching back when the weeks differ asks first and keeps the times of the first week', () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ slots: [sl(0, 600, 660, { wk: 1 }), sl(1, 600, 660, { wk: 2 })] })] })); a.ev('openDlg(state.S.events[0])'); toggle(pw(a), false);
    expect(a.log.confirms[0]).toContain('Keep only the times of week 1'); save(a); expect(ev(a).slots.map(s => s.day)).toEqual([0]); expect(ev(a)).not.toHaveProperty('weeks');
  });
  it('declining that question stays with different times per week', () => {
    const a = openApp({ confirmAnswer: false }); setData(a, blank({ cycle: 2, events: [ev1({ slots: [sl(0, 600, 660, { wk: 1 }), sl(1, 600, 660, { wk: 2 })] })] })); a.ev('openDlg(state.S.events[0])');
    toggle(pw(a), false); expect(pw(a).checked).toBe(true); expect(lines(a)).toHaveLength(2);
  });
  it('the dialog warns about overlapping times only within one week', () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ slots: [sl(0, 600, 720, { wk: 1 }), sl(0, 630, 690, { wk: 2 })] })] })); a.ev('openDlg(state.S.events[0])'); expect(a.q('#fWarn').textContent).toBe('');
    lines(a)[1].querySelector('.wkc').click(); a.qa('.cmenu .oi')[0].click(); expect(a.q('#fWarn').textContent).toContain('Monday');
  });
  it('opening a time of week 2 from the grid brings its own line into view', () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ slots: [sl(0, 600, 660, { wk: 1 }), sl(0, 600, 660, { wk: 2 })] })] })); a.ev('openDlg(state.S.events[0],null,state.S.events[0].slots[1])');
    expect(a.qa('#fDays .dr.pulse').map(r => r.querySelector('.wkc').textContent)).toEqual(['2']);
  });
  it('the week controls are named for screen readers and translated into Spanish', () => {
    const a = openApp({ languages: ['es-ES'] }); setData(a, blank({ cycle: 2, events: [ev1({ slots: [sl(0, 600, 660, { wk: 2 })] })] })); a.ev('openDlg(state.S.events[0])');
    expect(a.q('#fWk b').textContent).toBe('Semanas'); expect(a.q('#fWk .pwsw').textContent).toBe('Distinto cada semana'); expect(lines(a)[0].querySelector('.wkc').getAttribute('aria-label')).toBe('Lunes: semana 2');
  });
});

describe('R-CYC-02 Events that are not every week say which weeks, on the grid and in the agenda', () => {
  it('the hover card, the box label and the day agenda name the weeks of a pattern', () => {
    const a = fresh(blank({ cycle: 4, events: [ev1({ title: 'Swim', weeks: [1, 3] })] }));
    expect(a.ev('peekRows({e:state.S.events[0],s:state.S.events[0].slots[0],piece:0})')).toContain('Weeks 1 and 3');
    expect(a.q('.ev').getAttribute('aria-label')).toContain('Weeks 1 and 3'); expect(a.ev('agendaHTML(0)')).toContain('Weeks 1 and 3');
  });
  it('a time with its own week is named by that week', () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ slots: [sl(0, 600, 660, { wk: 2 })] })] })); week(a, 2); expect(a.q('.ev').getAttribute('aria-label')).toContain('Week 2');
  });
  it('an every-week event names no weeks', () => {
    const a = fresh(blank({ cycle: 2, events: [ev1()] })); expect(a.q('.ev').getAttribute('aria-label')).not.toMatch(/Week/);
  });
});

describe('R-CYC-09 Dragging through the cycle: patterns as before, a week per time along the cycle', () => {
  const box = (a, d) => a.q(`.day[data-d="${d}"] .ev`);
  const slots = a => JSON.parse(a.ev('JSON.stringify(state.S.events[0].slots.map(s=>[s.day,s.wk||0]))'));
  it('a patterned event moves by days within the week and keeps its weeks', async () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ weeks: [1], slots: [sl(5, 600, 660), sl(6, 600, 660)] })] }));
    await dragFrom(a, box(a, 5), { col: 5, min: 610 }, { col: 6, min: 610 }); expect(slots(a)).toEqual([[6, 0], [0, 0]]); expect(a.ev('state.S.events[0].weeks')).toEqual([1]);
  });
  it('with a week per time, moving all repetitions a day on takes Sunday of week 1 to Monday of week 2', async () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ slots: [sl(5, 600, 660, { wk: 1 }), sl(6, 600, 660, { wk: 1 })] })] }));
    await dragFrom(a, box(a, 5), { col: 5, min: 610 }, { col: 6, min: 610 }); expect(slots(a)).toEqual([[6, 1], [0, 2]]);
    week(a, 2); expect(boxes(a, 0)).toEqual(['e1']);
  });
  it('dragging a time of the last week a day on moves it to week 1', async () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ slots: [sl(5, 600, 660, { wk: 2 }), sl(6, 600, 660, { wk: 2 })] })] })); week(a, 2);
    await dragFrom(a, box(a, 5), { col: 5, min: 610 }, { col: 6, min: 610 }); expect(slots(a)).toEqual([[6, 2], [0, 1]]);
  });
  it('Shift moves only the grabbed time, which stays in its week', async () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ slots: [sl(5, 600, 660, { wk: 2 }), sl(6, 600, 660, { wk: 1 })] })] })); week(a, 2);
    await dragFrom(a, box(a, 5), { col: 5, min: 610 }, { col: 3, min: 610 }, { shift: true }); expect(slots(a)).toEqual([[3, 2], [6, 1]]);
  });
  it('one time per day is counted per week: a day used only in another week is free', async () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ slots: [sl(0, 600, 660, { wk: 1 }), sl(1, 600, 660, { wk: 2 })] })] }));
    await dragFrom(a, box(a, 0), { col: 0, min: 610 }, { col: 1, min: 610 }, { shift: true }); expect(slots(a)).toEqual([[1, 1], [1, 2]]);
  });
  it('a day used in the same week still blocks the move of a single time', async () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ slots: [sl(0, 600, 660, { wk: 1 }), sl(1, 720, 780, { wk: 1 })] })] }));
    await dragFrom(a, box(a, 0), { col: 0, min: 610 }, { col: 1, min: 610 }, { shift: true }); expect(slots(a)).toEqual([[0, 1], [1, 1]]);
  });
  it('Only this day after a drag of all puts the grabbed time back in its own week', async () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ slots: [sl(5, 600, 660, { wk: 1 }), sl(6, 600, 660, { wk: 1 })] })] }));
    await dragFrom(a, box(a, 5), { col: 5, min: 610 }, { col: 6, min: 610 }); a.qa('#toast button').find(b => b.textContent === 'Only this day').click();
    expect(slots(a)).toEqual([[5, 1], [6, 1]]);
  });
  it('a nested activity follows its host along the cycle', () => {
    const a = fresh(blank({ cycle: 2, people, events: [ev1({ id: 'h', slots: [sl(6, 480, 600, { person: 'A', wk: 1 })] }), ev1({ id: 'n', nest: true, slots: [sl(6, 510, 525, { person: 'A', wk: 1 })] })] }));
    expect(a.qa('.ev.nest')).toHaveLength(1);
    const r = JSON.parse(a.ev(`(()=>{const h=state.S.events[0],n=state.S.events[1],o=h.slots.map(x=>({...x})),c=nestCarry(h);shiftDay(h.slots[0],1);carryMove(c,h.slots,o);return JSON.stringify([h.slots[0],n.slots[0]].map(s=>[s.day,s.wk]))})()`));
    expect(r).toEqual([[0, 2], [0, 2]]);
  });
});

describe('R-CYC-13 Inserting or transferring events whose weeks lie beyond the cycle asks first', () => {
  const file = (o = {}) => workspace({ version: 9, cycle: 4, events: [ev1({ id: 'f', schedules: ['s1'], weeks: [1, 3] }), ev1({ id: 'g', schedules: ['s1'], slots: [sl(1, 600, 660, { wk: 4 })] }), ev1({ id: 'w', schedules: ['s1'] })], ...o });
  const importFile = async (a, obj) => { a.d.getElementById('file').onchange({ target: { files: [{ name: 'x.json', text: async () => JSON.stringify(obj) }], value: '' } }); await a.sleep(30); };
  const insert = async a => { a.qa('#xDlg input[name=impm]').find(r => r.value === 'insert').checked = true; a.click('Import'); await a.sleep(10); };
  const pickIc = (a, v) => { a.qa('#xDlg input[name=icm]').find(r => r.value === v).checked = true; a.click('Apply'); };
  const mine = () => blank({ cycle: 2, events: [ev1({ id: 'mine', weeks: [2] })] });
  it('an insert whose weeks fit the current cycle asks nothing', async () => {
    const a = fresh(blank({ cycle: 4 })); await importFile(a, file()); await insert(a); expect(a.dlgOpen()).toBe(false); expect(a.ev('state.S.events.length')).toBe(3);
  });
  it('otherwise it offers to lengthen the cycle (the default), keep those weeks as staged weeks, remove those occurrences, or keep them in a schedule per week', async () => {
    const a = fresh(mine()); await importFile(a, file()); await insert(a);
    expect(a.dlgText()).toContain('Some of the events or phases arriving (2) happen in weeks beyond this workspace\'s cycle (2 weeks)');
    expect(a.qa('#xDlg .radios label').map(l => l.textContent.trim())).toEqual(["Make this workspace's cycle 4 weeks long", 'Keep those weeks as staged weeks of this workspace (outside its cycle, ready to swap in)', 'Remove what happens in those weeks', 'Move it into a schedule (for phases, a rhythm) of its own for each of those weeks (as week 1), to keep it']);
    expect(a.q('#xDlg input[name=icm]:checked').value).toBe('len');
  });
  it('lengthening to a multiple keeps the workspace\'s own rhythm and the arriving weeks as they are, in one undo step', async () => {
    const a = fresh(mine()); await importFile(a, file()); await insert(a); pickIc(a, 'len'); await a.sleep(10);
    expect(a.ev('state.S.cycle')).toBe(4); expect(evs(a).map(e => [e.weeks || e.wk])).toEqual([[[2, 4]], [[1, 3]], [[4]], [[0]]]);
    a.key('z', { ctrlKey: true }); expect(a.ev('[state.S.cycle,state.S.events.length]')).toEqual([2, 1]);
  });
  it('removing keeps only the arriving occurrences inside the cycle', async () => {
    const a = fresh(mine()); await importFile(a, file()); await insert(a); pickIc(a, 'rm'); await a.sleep(10);
    expect(a.ev('state.S.cycle')).toBe(2); expect(evs(a).map(e => e.weeks || e.wk)).toEqual([[2], [1], [0]]);
  });
  it('keeping them puts each week beyond the cycle into a schedule of its own', async () => {
    const a = fresh(mine()); await importFile(a, file()); await insert(a); pickIc(a, 'mv'); await a.sleep(10);
    expect(a.ev('state.S.schedules.map(s=>s.name)')).toEqual(['S1', 'Team', 'Week 3', 'Week 4']);
  });
  it('Cancel inserts nothing and leaves the schedules as they were', async () => {
    const a = fresh(mine()); await importFile(a, file()); await insert(a); a.click('Cancel'); await a.sleep(10); expect(a.ev('state.S.events.length')).toBe(1); expect(a.ev('state.S.schedules.length')).toBe(1);
  });
  it('copying a schedule to a workspace with a shorter cycle asks the same and lengthens the target', async () => {
    const a = fresh(blank({ cycle: 3, events: [ev1({ weeks: [3] })] })); a.ev("const t=newWs('Target',defaultData(),true);state.WS.push(t);render()");
    a.ev('openTransfer("schedule",state.S.schedules[0])'); a.click('Continue'); await a.sleep(20); expect(a.dlgTitle()).toBe('Weeks in the cycle'); pickIc(a, 'len'); await a.sleep(20);
    expect(a.ev('state.WS[1].data.cycle')).toBe(3); expect(a.ev('state.WS[1].data.events[0].weeks')).toEqual([3]);
  });
});

describe('R-CYC-11 Statistics per cycle: each week, their average and the cycle total', () => {
  const data = () => blank({ cycle: 2, people, events: [ev1({ id: 'odd', weeks: [1], slots: [sl(0, 600, 720, { person: 'A' })] }), ev1({ id: 'all', slots: [sl(1, 600, 660, { person: 'A' })] })] });
  const rowOf = (a, label) => [...a.qa('#xDlg .sttab tr')].find(r => r.cells[0].textContent.startsWith(label));
  it('each week of the cycle counts only its own occurrences', () => {
    const a = fresh(data()); expect(a.ev('[personStats("A",true,1).planned,personStats("A",true,2).planned]')).toEqual([180, 60]);
  });
  it('time after Sunday midnight counts on Monday of the next week', () => {
    const a = fresh(blank({ cycle: 2, people, events: [ev1({ slots: [sl(6, 1320, 1560, { person: 'A', wk: 1 })] })] }));
    expect(a.ev('[personStats("A",true,1).perDay[6].get(""),personStats("A",true,2).perDay[0].get("")]')).toEqual([120, 120]);
  });
  it('the dialog shows the average week by default, with a column per week, the average and the cycle total', () => {
    const a = fresh(data()); a.ev('openStats("A")');
    expect(a.qa('#xDlg .stbar select')[1].value).toBe('avg'); expect(a.qa('#xDlg .stbar select')[1].getAttribute('aria-label')).toBe('Week to show');
    expect([...a.qa('#xDlg .sttab thead th')].map(t => t.textContent)).toEqual(['Activity type', 'Hours', '% of week', '% of planned', 'W1', 'W2', 'Average', 'Cycle total']);
    expect([...rowOf(a, 'Planned').cells].map(c => c.textContent)).toEqual(['Planned', '2:00', '1 %', '', '3:00', '1:00', '2:00', '4:00']);
  });
  it('choosing a week shows that week alone in the bars and the Hours column', () => {
    const a = fresh(data()); a.ev('openStats("A")'); const w = a.qa('#xDlg .stbar select')[1]; w.value = '2'; w.dispatchEvent(new a.w.Event('change'));
    expect(rowOf(a, 'Planned').cells[1].textContent).toBe('1:00'); expect(a.q('#xDlg .stwk').getAttribute('aria-label')).toContain('Planned 1:00');
  });
  it('Everyone shows each person\'s planned hours per week, where fairness shows', () => {
    const a = fresh(data()); a.ev('openStats("*")'); expect(a.q('#xDlg .stpw').textContent).toBe('W1 3:00 · W2 1:00');
  });
  it('the copied table and the CSV carry the per-week, average and cycle columns', () => {
    const a = fresh(data()); a.ev('stW="avg"'); const r = a.ev('statsRows("A",true)');
    expect(r[0].slice(-4)).toEqual(['W1', 'W2', 'Average', 'Cycle total']); expect(r.find(x => x[1] === 'Planned').slice(-4)).toEqual(['3.00', '1.00', '2.00', '4.00']);
    const e = a.ev('statsRows("*",true)'); expect(e[0].slice(-4)).toEqual(['Planned W1', 'Planned W2', 'Planned Average', 'Planned Cycle total']);
  });
  it('with a cycle of one week the dialog has no week list and no extra columns', () => {
    const a = fresh(blank({ people, events: [ev1({ slots: [sl(0, 600, 660, { person: 'A' })] })] })); a.ev('openStats("A")');
    expect(a.qa('#xDlg .stbar select')).toHaveLength(1); expect([...a.qa('#xDlg .sttab thead th')].map(t => t.textContent)).toEqual(['Activity type', 'Hours', '% of week', '% of planned']);
  });
});

describe('R-CYC-12 Print, agendas and N hidden follow the week shown, and every week can be printed', () => {
  const data = () => blank({ cycle: 2, events: [ev1({ id: 'one', title: 'Only one', weeks: [1] }), ev1({ id: 'two', title: 'Only two', weeks: [2], slots: [sl(1, 600, 660)] })] });
  const printed = a => a.w.__printed || '';
  const menuItems = a => a.qa('.omenu .oi').map(b => b.textContent.trim());
  it('with a cycle of one week Print prints at once, as before', () => {
    const a = fresh(blank({ events: [ev1()] })); a.toolbar('print').click(); expect(a.w.__printCount).toBe(1); expect(a.q('.omenu')).toBeNull();
  });
  it('with a cycle Print offers this week or every week', () => {
    const a = fresh(data()); week(a, 2); a.toolbar('print').click(); expect(a.w.__printCount).toBeUndefined();
    expect(menuItems(a)).toEqual(['Print this week (week 2)', 'Print every week (one page each)']);
  });
  it('this week prints the week shown, titled with its week', () => {
    const a = fresh(data()); week(a, 2); a.toolbar('print').click(); a.qa('.omenu .oi')[0].click();
    expect(printed(a)).toContain('Weekly schedule — Week 2'); expect(printed(a)).toContain('Only two'); expect(printed(a)).not.toContain('Only one');
  });
  it('every week prints one page per week, each titled, and the grid stays on its week', () => {
    const a = fresh(data()); week(a, 2); a.toolbar('print').click(); a.qa('.omenu .oi')[1].click();
    const pr = a.q('#pr'); expect([...pr.querySelectorAll('h1')].map(h => h.textContent)).toEqual(['Weekly schedule — Week 1', 'Weekly schedule — Week 2']);
    expect(pr.querySelectorAll('.pgb')).toHaveLength(1); expect(printed(a)).toContain('Only one'); expect(printed(a)).toContain('Only two'); expect(a.ev('state.curWk')).toBe(2);
  });
  it('every week in the day view prints that day of each week', () => {
    const a = fresh(data()); a.ev('setFocus(1)'); a.toolbar('print').click(); a.qa('.omenu .oi')[1].click();
    expect([...a.q('#pr').querySelectorAll('h1')].map(h => h.textContent)).toEqual(['Tuesday — Week 1', 'Tuesday — Week 2']);
  });
  it('the day agenda shows the week shown and names it', () => {
    const a = fresh(data()); week(a, 2); expect(a.ev('agendaHTML(1)')).toContain('Tuesday — Week 2'); expect(a.ev('agendaHTML(1)')).toContain('Only two'); expect(a.ev('agendaHTML(0)')).not.toContain('Only one');
  });
  it('N hidden counts only the occurrences of the week shown', () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ weeks: [2], slots: [sl(2, 120, 180)] })] }));
    expect(a.q('#hid').style.display).toBe('none'); week(a, 2); expect(a.q('#hid').textContent).toBe('1 hidden');
  });
});

describe('R-CYC-15 Rotas are kept by people: owner plus involved people, explained in the help, no turn helper', () => {
  const rota = () => blank({ cycle: 2, people: [...people, person({ id: 'C', name: 'Cy', color: '#8e4ec6' })],
    events: [ev1({ title: 'Cooking', owner: 'A', involved: ['B', 'C'], desc: 'Swap turns in the family chat', slots: [sl(0, 1080, 1140, { person: 'A', fo: true })] })] });
  it('the help explains how to keep a rota and that it counts for each person in it', () => {
    const a = fresh(); a.ev('openHelp()'); const t = a.dlgText();
    expect(t).toContain('Weeks in the cycle'); expect(t).toContain('the person who set the rota as owner, the people in it as involved'); expect(t).toContain('counts for each of them');
  });
  it('the old two-schedule workaround is no longer suggested anywhere in the app', () => {
    const a = fresh(); a.ev('openHelp()'); expect(a.dlgText()).not.toMatch(/Week A|Show only this one/);
    expect(a.d.documentElement.innerHTML).not.toMatch(/Week A|Semana A|two-week rota|rotación de dos semanas/);
  });
  it('the Weeks row of the dialog points to the same way of keeping a rota', () => {
    const a = fresh(rota()); a.ev('openDlg(state.S.events[0])'); expect(a.q('#fWk b').title).toContain('A rota whose turns change is better kept as one event');
  });
  it('a rota counts in full for each person in it while involved time is included, and only for the performer otherwise', () => {
    const a = fresh(rota()); expect(a.ev('["A","B","C"].map(p=>personStats(p,true).planned)')).toEqual([60, 60, 60]);
    expect(a.ev('["A","B","C"].map(p=>personStats(p,false).planned)')).toEqual([60, 0, 0]);
  });
  it('the people in a rota clash with their own other activities, shown as stripes that ask for a decision', () => {
    const d = rota(); d.events.push(ev1({ id: 'gym', slots: [sl(0, 1080, 1140, { person: 'C' })] }));
    const a = fresh(d); expect(a.qa('.ov').length).toBeGreaterThan(0);
  });
  it('the app offers no helper that assigns turns', () => {
    const a = fresh(rota()); a.ev('openDlg(state.S.events[0])'); expect(a.d.getElementById('dlg').textContent).not.toMatch(/Rotate/);
    expect([...a.d.querySelectorAll('#dlg button, #dlg select:not(#fTuM) option')].map(b => b.textContent).filter(t => /turn|rota/i.test(t))).toEqual([]);   // turns are only counted (R-CYC-18)
  });
});

describe('R-CYC-17 Each week of a cycle can have a name, a description and a colour', () => {
  const info = [{ name: 'At home', color: '#2fa66a' }, { name: "At Dad's", desc: 'From Friday pickup', color: '#8e4ec6' }];
  const data = (o = {}) => blank({ cycle: 2, weekInfo: info, people, events: [ev1({ id: 'w2', title: 'Swim', weeks: [2], slots: [sl(0, 600, 660, { person: 'A' })] })], ...o });
  const wi = a => JSON.parse(a.ev('JSON.stringify(state.S.weekInfo)'));
  const rows = a => a.qa('#xDlg .cywr');
  const typeIn = (a, k, cls, v) => { const i = rows(a)[k].querySelector('.cy' + cls); i.value = v; i.dispatchEvent(new a.w.Event('input')); };
  it('import keeps names, descriptions and hex colours, trims and caps them, drops anything else and trailing empty weeks', () => {
    const p = x => fresh().ev(`parseData(${JSON.stringify(blank({ cycle: 3, weekInfo: x }))}).weekInfo`);
    expect(p([{ name: '  At home  ', desc: 'x'.repeat(400), color: '#ABC', bad: 1 }, { name: 5, color: 'red' }, {}])).toEqual([{ name: 'At home', desc: 'x'.repeat(300), color: '#aabbcc' }]);
    expect(p([{}, { name: 'n'.repeat(60) }, { color: '#112233' }, { name: 'week 4 of a 3-week cycle' }])).toEqual([{}, { name: 'n'.repeat(40) }, { color: '#112233' }]);
    expect(p('nonsense')).toEqual([]); expect(fresh().ev(`parseData(${JSON.stringify(blank({ weekInfo: info }))}).weekInfo`)).toEqual([]);   // a 1-week cycle has none
  });
  it('it is stored only when something is set, counts as an unsaved change and is undoable', () => {
    const a = fresh(blank({ cycle: 2 })); expect('weekInfo' in a.ev('buildFile()')).toBe(false); a.ev('cw().lb=keyOf(state.S)');
    openCycleDlg(a); typeIn(a, 1, 'name', "At Dad's"); a.click('Apply'); expect(wi(a)).toEqual([{}, { name: "At Dad's" }]);
    expect(a.ev('buildFile()').weekInfo).toEqual([{}, { name: "At Dad's" }]); expect(a.ev('anyDirty()')).toBe(true);
    a.ev('undo()'); expect(wi(a)).toEqual([]); expect(a.ev('anyDirty()')).toBe(false);
  });
  it('the cycle dialog has a row per week: colour swatch (with a clear button), name and description, all named for screen readers', () => {
    const a = fresh(data()); openCycleDlg(a); expect(rows(a)).toHaveLength(2); expect(a.q('#xDlg').classList.contains('full')).toBe(true);
    const r = rows(a)[1]; expect(r.querySelector('.cywn').textContent).toBe('Week 2'); expect(r.querySelector('.cyname').value).toBe("At Dad's"); expect(r.querySelector('.cydesc').value).toBe('From Friday pickup');
    expect(r.querySelector('.cysw').getAttribute('aria-label')).toBe('Week 2: colour (#8e4ec6). Click to choose it'); expect(r.querySelector('.cyname').getAttribute('aria-label')).toBe('Week 2: name');
    r.querySelector('.cyclr').click(); expect(r.querySelector('.cysw').classList.contains('none')).toBe(true); a.click('Apply'); expect(wi(a)[1]).toEqual({ name: "At Dad's", desc: 'From Friday pickup' });
    const b = fresh(data()); openCycleDlg(b); chooseLen(b, 1); expect(rows(b).map(r => r.classList.contains('stg'))).toEqual([false, true]);   // week 2 would be staged (R-CYC-21)
  });
  it('Cancel changes nothing; editing the weeks without changing the length is one undo step', () => {
    const a = fresh(data()); openCycleDlg(a); typeIn(a, 0, 'name', 'Home'); a.click('Cancel'); expect(wi(a)[0].name).toBe('At home');
    openCycleDlg(a); typeIn(a, 0, 'desc', 'School week'); a.click('Apply'); expect(wi(a)[0]).toEqual({ name: 'At home', desc: 'School week', color: '#2fa66a' }); a.ev('undo()'); expect(wi(a)[0].desc).toBeUndefined();
  });
  it('doubling the cycle in step repeats the names and colours (week 3 = week 1); unticking leaves the new weeks blank; shrinking keeps the weeks that go as staged, or drops them', async () => {
    let a = fresh(data()); openCycleDlg(a); chooseLen(a, 4); expect(rows(a)[2].querySelector('.cyname').value).toBe('At home'); a.click('Apply');
    expect(wi(a).map(w => w.name)).toEqual(['At home', "At Dad's", 'At home', "At Dad's"]);
    a = fresh(data()); openCycleDlg(a); chooseLen(a, 4); const cb = a.q('#xDlg .cyext input'); cb.checked = false; cb.dispatchEvent(new a.w.Event('change'));
    expect(rows(a)[2].querySelector('.cyname').value).toBe(''); typeIn(a, 3, 'name', 'Exams'); a.click('Apply'); expect(wi(a).map(w => w.name)).toEqual(['At home', "At Dad's", undefined, 'Exams']);
    a = fresh(data()); openCycleDlg(a); chooseLen(a, 3); a.click('Apply'); expect(wi(a)).toEqual(info);
    a = fresh(data({ events: [], weekInfo: [] })); openCycleDlg(a); chooseLen(a, 1); a.click('Apply'); expect(a.ev('[state.S.cycle,kept()]')).toEqual([1, 1]);   // an empty week that leaves is dropped
    a = fresh(data({ events: [] })); openCycleDlg(a); chooseLen(a, 1); a.click('Apply'); await sleep(0); a.click('Apply'); expect(a.ev('[state.S.cycle,kept()]')).toEqual([1, 2]); expect(wi(a)).toEqual(info);   // a named week is kept as staged by default
    a = fresh(data()); openCycleDlg(a); chooseLen(a, 1); a.click('Apply'); await sleep(0); a.qa('#xDlg input[name=cym]').find(r => r.value === 'rm').checked = true; a.click('Apply');
    expect(a.ev('[state.S.cycle,kept()]')).toEqual([1, 1]); expect(wi(a)).toEqual([]);
  });
  it('the week switcher is filled with the week colour, its tooltip names the week, and the menu shows chips, names and descriptions', () => {
    const a = fresh(data()); week(a, 2); const b = a.q('.dh.c .wkb');
    expect(b.textContent).toBe('W2'); expect(b.classList.contains('col')).toBe(true); expect(b.style.background).toMatch(/#8e4ec6|rgb\(142, 78, 198\)/);
    expect(b.getAttribute('aria-label')).toBe("Week 2 of 2 is shown. Choose another week of the cycle · At Dad's: From Friday pickup");
    b.click(); const items = a.qa('.omenu .oi'); expect(items[0].textContent).toBe('Week 1 · At home'); expect(items[1].querySelector('.wkchip')).not.toBeNull();
    expect(items[1].querySelector('.wkd').textContent).toBe('From Friday pickup');
    const c = fresh(blank({ cycle: 2 })); expect(c.q('.dh.c .wkb').classList.contains('col')).toBe(false);
  });
  it('the grid gets a band in the shown week colour under the day headers, and none without a colour', () => {
    const a = fresh(data()); const g = a.q('#grid'); expect(g.classList.contains('wkband')).toBe(true); expect(g.style.getPropertyValue('--wkc')).toBe('#2fa66a');
    week(a, 2); expect(g.style.getPropertyValue('--wkc')).toBe('#8e4ec6');
    const b = fresh(data({ weekInfo: [{ name: 'No colour' }] })); expect(b.q('#grid').classList.contains('wkband')).toBe(false);
    const c = fresh(blank({ weekInfo: info })); expect(c.q('#grid').classList.contains('wkband')).toBe(false);   // a 1-week workspace shows none of it
  });
  it('the event dialog colours the Weeks chips and the week of each time, and names the weeks', () => {
    const a = fresh(data()); a.ev('openDlg(state.S.events[0])'); const ch = a.qa('#fWk .chips label');
    expect(ch.map(l => l.textContent)).toEqual(['Week 1 · At home', "Week 2 · At Dad's"]); expect(ch[1].classList.contains('wcol')).toBe(true); expect(ch[1].title).toBe("Week 2 · At Dad's: From Friday pickup");
    a.q('#fPw').checked = true; a.q('#fPw').onchange(); const wb = a.q('#fDays .dr button.wkc'); expect(wb.textContent).toBe('2'); expect(wb.style.background).toMatch(/#8e4ec6|rgb\(142, 78, 198\)/);
    wb.click(); expect(a.qa('.cmenu .oi').map(x => x.textContent)).toEqual(['Week 1 · At home', "Week 2 · At Dad's"]);
  });
  it('the hover card and the agenda show the weeks with their chips and names', () => {
    const a = fresh(data()); week(a, 2); expect(a.ev('peekHTML(piecesAt(0,630,true))')).toContain('class="wkchip"'); expect(a.ev('peekHTML(piecesAt(0,630,true))')).toContain("Week 2 · At Dad&#39;s");
    expect(a.q('.ev').getAttribute('aria-label')).toContain("Week 2 · At Dad's"); a.ev('openAgenda(0)'); expect(a.q('#agBody').innerHTML).toContain('class="wkchip"');
    expect(a.q('#agBody h1').textContent).toContain("Monday — Week 2 · At Dad's"); expect(a.q('#agBody h1').classList.contains('wkh')).toBe(true);
  });
  it('printouts name the week and carry its colour; statistics name the weeks in the list, table, CSV and the Everyone view', () => {
    const a = fresh(data()); week(a, 2); a.ev('printSchedule()'); expect(a.w.__printed).toContain("Week 2 · At Dad's"); expect(a.w.__printed).toContain('class="wkh"');
    a.ev('stW="avg";openStats("A")'); expect(a.qa('#xDlg select').flatMap(s => [...s.options].map(o => o.textContent))).toContain("Week 2 · At Dad's");
    const th = a.qa('#xDlg .sttab thead th').find(t => t.textContent.startsWith('W2')); expect(th.textContent).toBe('W2ⓘ'); expect(th.querySelector('.wkchip')).not.toBeNull();
    expect(th.querySelector('.tip').title).toBe("Week 2 · At Dad's: From Friday pickup"); expect(th.querySelector('.tip').getAttribute('aria-label')).toBe("Week 2 · At Dad's: From Friday pickup");
    expect(a.ev('statsRows("*",true)[0]')).toContain("Planned W2 At Dad's");
  });
  it('Live View names the week in the day header and asks for today\'s week by name', () => {
    const a = fresh(data()); a.ev('setLive(true)'); expect([...a.q('#xDlg select').options].map(o => o.textContent)).toEqual(['Week 1 · At home', "Week 2 · At Dad's"]);
    a.click('Start Live View'); expect(a.q('.dh:not(.c)').textContent).toMatch(/· W\d (At home|At Dad's)$/);
  });
  it('an insert or transfer that lengthens the cycle keeps the target\'s own weeks, repeated when the new length is a multiple (R-CYC-13)', () => {
    const run = (n0, srcN) => fresh().ev(`(()=>{const d={cycle:${n0},weekInfo:[{name:'A'},{name:'B',color:'#112233'}],events:[]};placeWeeks(d,[{id:'x',weeks:[${n0 + 1}],slots:[{day:0,start:600,end:660}]}],${srcN},'len');return d.weekInfo})()`);
    expect(run(2, 4)).toEqual([{ name: 'A' }, { name: 'B', color: '#112233' }, { name: 'A' }, { name: 'B', color: '#112233' }]);
    expect(run(2, 3)).toEqual([{ name: 'A' }, { name: 'B', color: '#112233' }]);
  });
  it('leaving out personal details removes the week descriptions and keeps their names', () => {
    const a = fresh(data()); const f = a.ev('anonymised(buildFile())'); expect(f.weekInfo).toEqual([{ name: 'At home', color: '#2fa66a' }, { name: "At Dad's", color: '#8e4ec6' }]);
  });
  it('Spanish names the weeks and translates the dialog', () => {
    const a = fresh(data()); a.ev("setLang('es')"); a.ev('openCycle()'); expect(rows(a)[1].querySelector('.cyname').getAttribute('aria-label')).toBe('Semana 2: nombre');
    expect(a.q('#xDlg .cyh').textContent).toBe('Las semanas'); a.click('Cancelar'); week(a, 2); expect(a.q('.dh.c .wkb').textContent).toBe('S2');
  });
});

describe('R-CYC-18 Rota turns: how many times each person is responsible over the cycle', () => {
  const three = [...people, person({ id: 'C', name: 'Cat', color: '#0000c0' })];
  const rota = (o = {}) => ev1({ id: 'r', title: 'Cook', slots: [sl(0, 1080, 1140, { person: 'A', wk: 1 }), sl(1, 1080, 1140, { person: 'B', wk: 1 }), sl(0, 1080, 1140, { person: 'B', wk: 2 }), sl(1, 1080, 1140, { person: 'B', wk: 2 })], ...o });
  const turns = (a, i = 0) => a.ev(`(t=>t&&Object.fromEntries(t))(turnsOf(state.S.events[${i}]))`);
  it('a per-week rota counts each person\'s turns per week; a pattern counts a repetition once in each of its weeks', () => {
    const a = fresh(blank({ cycle: 2, people, events: [rota(), ev1({ id: 'p', weeks: [1, 2], slots: [sl(0, 600, 660, { person: 'A' }), sl(2, 600, 660, { person: 'B' }), sl(4, 600, 660, { person: 'B' })] })] }));
    expect(turns(a)).toEqual({ A: [1, 0], B: [1, 2] }); expect(turns(a, 1)).toEqual({ A: [1, 1], B: [2, 2] });
  });
  it('an event with one responsible person, or a rota kept as owner plus involved people, has no turns', () => {
    const a = fresh(blank({ people, events: [ev1({ slots: [sl(0, 600, 660, { person: 'A' }), sl(1, 600, 660, { person: 'A' })] }), ev1({ id: 'o', owner: 'A', involved: ['B'], slots: [sl(0, 600, 660, { person: 'A', fo: true })] })] }));
    expect(turns(a)).toBeNull(); expect(turns(a, 1)).toBeNull();
  });
  it('the event dialog shows the turns under Who and updates them while the table is edited', () => {
    const a = fresh(blank({ cycle: 2, people: three, events: [rota()] })); a.ev('openDlg(state.S.events[0])');
    expect(a.q('#fTu').textContent).toBe('Ann 1 · Bob 3 turns in the cycle'); expect(a.q('#fTu').title).toBe('Week 1: Ann 1 · Bob 1\nWeek 2: Ann 0 · Bob 2'); expect(a.q('#fTuL').style.display).toBe('');
    const ps = a.qa('#fDays .dr select.ev-only').find(s => s.value === 'B'); ps.value = 'C'; ps.onchange(); expect(a.q('#fTu').textContent).toBe('Ann 1 · Bob 2 · Cat 1 turns in the cycle');
  });
  it('the dialog shows no counts when fewer than two people have turns (Automatic), and says "a week" with a one-week cycle', () => {
    const a = fresh(blank({ people, events: [ev1({ slots: [sl(0, 600, 660, { person: 'A' })] }), ev1({ id: 't', slots: [sl(0, 600, 660, { person: 'A' }), sl(1, 600, 660, { person: 'B' })] })] }));
    a.ev('openDlg(state.S.events[0])'); expect(a.q('#fTu').textContent).toBe(''); expect(a.q('#fTuM').value).toBe(''); a.ev('$("dlg").close()');
    a.ev('openDlg(state.S.events[1])'); expect(a.q('#fTu').textContent).toBe('Ann 1 · Bob 1 turns a week'); expect(a.q('#fTuL').title).toContain('has no turns to count');
  });
  it('the statistics list a person\'s rotas with their turns per week, their total and all turns', () => {
    const a = fresh(blank({ cycle: 2, people, events: [rota()] })); a.ev('openStats("A")');
    expect(a.q('#xDlg .sttuh').textContent).toContain('Turns in rotas');
    expect(a.qa('#xDlg .sttu tr').map(r => [...r.children].map(c => c.textContent.replace('✕', '')))).toEqual([['Rota', 'W1', 'W2', 'Turns', 'Of all turns'], ['Cook', '1', '0', '1', '4']]);
  });
  it('Everyone shows a rota per row and a column per person; the CSV and Copy table carry the same block', () => {
    const a = fresh(blank({ cycle: 2, people, events: [rota()] })); a.ev('openStats("*")');
    expect(a.qa('#xDlg .sttu tr').map(r => [...r.children].map(c => c.textContent.replace('✕', '')))).toEqual([['Rota', 'Ann', 'Bob', 'All turns'], ['Cook', '1', '3', '4']]);
    expect(a.ev('statsRows("*",true)').slice(-2)).toEqual([['Rota', 'Ann', 'Bob', 'All turns'], ['Cook', 1, 3, 4]]);
    expect(a.ev('statsRows("A",true)').slice(-2)).toEqual([['Person', 'Rota', 'W1', 'W2', 'Turns', 'Of all turns'], ['Ann', 'Cook', 1, 0, 1, 4]]);
  });
  it('rotas of hidden schedules are not counted, and the turn labels are translated', () => {
    const a = fresh(blank({ cycle: 2, people, events: [rota()] })); a.ev('state.S.schedules[0].visible=false;openStats("A")'); expect(a.q('#xDlg .sttu')).toBeNull();
    const b = openApp({ languages: ['es'] }); setData(b, blank({ cycle: 2, people, events: [rota()] })); b.ev('openDlg(state.S.events[0])');
    expect(b.q('#fTuL').textContent).toBe('Turnos'); expect(b.q('#fTu').textContent).toContain('turnos en el ciclo');
  });
});

describe('R-CYC-20 The weeks of a cycle can be reordered; everything in a week moves with it, and today stays today', () => {
  const data = () => blank({ cycle: 3, weekInfo: [{ name: 'A' }, { name: 'B', color: '#8e4ec6' }, { name: 'C', desc: 'third' }], rhythms: [{ id: 'r', name: 'R', visible: true }],
    phases: [{ id: 'p', title: 'Quiet', desc: '', color: '#607d8b', rhythms: ['r'], weeks: [2], slots: [sl(5, 480, 720)] }],
    events: [ev1({ id: 'pat', weeks: [1, 3], slots: [sl(0, 600, 660)] }), ev1({ id: 'per', slots: [sl(1, 600, 660, { wk: 1 }), sl(2, 600, 660, { wk: 2 }), sl(3, 600, 660, { wk: 3 })] })] });
  const rows = a => a.qa('#xDlg .cywr'), grips = a => a.qa('#xDlg .cywr .grip');
  const key = (g, k) => g.onkeydown({ key: k, preventDefault() {} });
  const state = a => a.ev('JSON.stringify([state.S.events[0].weeks,state.S.events[1].slots.map(s=>s.wk),state.S.phases[0].weeks,state.S.weekInfo.map(w=>w.name)])');
  it('each week of the dialog has a grip with a name and a tooltip, and a note explains what moves', () => {
    const a = fresh(data()); openCycleDlg(a); expect(grips(a)).toHaveLength(3); expect(grips(a)[1].getAttribute('aria-label')).toBe('Move week 2');
    expect(grips(a)[0].title).toContain('order of the weeks'); expect(a.dlgText()).toContain('Today stays the week you are in');
  });
  it('the arrow keys move a week with its name, colour and description, and the row says which week it was', () => {
    const a = fresh(data()); openCycleDlg(a); key(grips(a)[0], 'ArrowDown');
    expect(rows(a).map(r => [r.querySelector('.cywn').textContent, r.querySelector('.cyname').value])).toEqual([['Week 1 (was week 2)', 'B'], ['Week 2 (was week 1)', 'A'], ['Week 3', 'C']]);
    expect(a.d.activeElement.getAttribute('aria-label')).toBe('Move week 2');
  });
  it('dragging a grip moves the week too', () => {
    const a = fresh(data()); openCycleDlg(a); grips(a)[2].onpointerdown({ button: 0, preventDefault() {} }); pointer(a, 'pointermove', { x: 10, y: -500 }); pointer(a, 'pointerup', { x: 10, y: -500 });
    expect(rows(a).map(r => r.querySelector('.cyname').value)).toEqual(['C', 'A', 'B']);
  });
  it('Apply renumbers week patterns, the week of every time, phases and the week names, in one undo step', () => {
    const a = fresh(data()); openCycleDlg(a); key(grips(a)[0], 'ArrowDown'); a.click('Apply');
    expect(JSON.parse(state(a))).toEqual([[2, 3], [2, 1, 3], [1], ['B', 'A', 'C']]);
    a.toolbar('undo').click(); expect(JSON.parse(state(a))).toEqual([[1, 3], [1, 2, 3], [2], ['A', 'B', 'C']]);
    a.toolbar('redo').click(); expect(JSON.parse(state(a))).toEqual([[2, 3], [2, 1, 3], [1], ['B', 'A', 'C']]);
  });
  it('today\'s week and the shown week follow their content; undo and redo move them back and forth', () => {
    const a = fresh(data()); a.ev('setAnchor(2);state.curWk=2;render()'); openCycleDlg(a); key(grips(a)[1], 'ArrowUp'); a.click('Apply');
    expect(a.ev('[todayWk(),state.curWk]')).toEqual([1, 1]); expect(a.q('.wkb').textContent).toBe('W1'); expect(a.qa('.day[data-d="5"] .phx')).toHaveLength(1);
    a.toolbar('undo').click(); expect(a.ev('[todayWk(),state.curWk]')).toEqual([2, 2]); a.toolbar('redo').click(); expect(a.ev('[todayWk(),state.curWk]')).toEqual([1, 1]);
  });
  it('without a known today\'s week nothing is remembered; a plain change of names is still a single step', () => {
    const a = fresh(data()); openCycleDlg(a); key(grips(a)[2], 'ArrowUp'); a.click('Apply'); expect(a.ev('state.prefs.lvAnchor[state.curId]')).toBeUndefined(); expect(a.ev('state.undoSt.length')).toBe(1);
  });
  it('the grips stay while the length changes (a new week has none); an order made before is applied first, then the new length', () => {
    const a = fresh(data()); openCycleDlg(a); key(grips(a)[0], 'ArrowDown'); chooseLen(a, 4); expect(grips(a).length).toBe(3); expect(rows(a).length).toBe(4);
    a.click('Apply'); expect(a.ev('state.S.cycle')).toBe(4); expect(a.ev('state.S.events[0].weeks')).toEqual([2, 3]); expect(a.ev('state.undoSt.length')).toBe(2);
  });
  it('in Spanish the grips and the note are translated', () => {
    const b = openApp({ languages: ['es'] }); setData(b, data()); openCycleDlg2(b); expect(b.qa('#xDlg .cywr .grip')[0].getAttribute('aria-label')).toBe('Mover la semana 1');
  });
});
const openCycleDlg2 = a => { a.q('.wsbtn').click(); a.qa('.omenu .oi').find(b => b.textContent.includes('Semanas del ciclo')).click(); };

describe('R-CYC-19 All weeks side by side: every week of the cycle in one row, chosen in the week switcher', () => {
  const data = (o = {}) => blank({ cycle: 2, weekInfo: [{}, { name: 'Nights', color: '#8e4ec6' }], people, events: [ev1({ id: 'w2', title: 'Week two', weeks: [2], slots: [sl(0, 600, 660)] }),
    ev1({ id: 'per', title: 'Per', slots: [sl(6, 1320, 1800, { wk: 1 })] }), ev1({ id: 'all', title: 'All', slots: [sl(2, 600, 660)] })], ...o });
  const all = a => { a.q('.dh.c .wkb').click(); a.qa('.omenu .oi').find(b => b.textContent.trim() === 'All weeks side by side').click(); };
  const cell = (a, w, d) => a.q(`.day[data-w="${w}"][data-d="${d}"]`);
  const ids = (a, w, d) => [...cell(a, w, d).querySelectorAll('.ev')].map(b => b._it.e.id + (b._it.piece ? '+' : ''));
  it('the week menu offers it with a tooltip; the grid then has a column for every day of every week, each headed with its week', () => {
    const a = fresh(data()); a.q('.dh.c .wkb').click(); expect(a.qa('.omenu .oi').find(b => b.textContent.trim() === 'All weeks side by side').title).toContain('every week of the cycle in one row');
    a.d.body.click(); all(a); expect(a.q('.wkb').textContent).toBe('W1–2'); expect(a.q('.wkb').getAttribute('aria-label')).toContain('All 2 weeks'); expect(a.qa('.day')).toHaveLength(14);
    expect(a.qa('.dh:not(.c)').map(h => h.textContent.trim()).slice(6, 8)).toEqual(['Sunday · W1', 'Monday · W2']);
    expect(a.qa('.dh.wks').map(h => h.dataset.w)).toEqual(['2']); expect(a.q('.dh[data-w="2"]').classList.contains('wkbd')).toBe(true); expect(a.q('#grid').classList.contains('wkband')).toBe(false);
  });
  it('each column draws only its own week: patterns, per-week times, and Sunday night running into Monday of the next week', () => {
    const a = fresh(data()); all(a);
    expect([ids(a, 1, 0), ids(a, 2, 0), ids(a, 1, 6), ids(a, 2, 6), ids(a, 1, 2), ids(a, 2, 2)]).toEqual([[], ['w2', 'per+'], ['per'], [], ['all'], ['all']]);
  });
  it('choosing a week goes back to one week; it is view state, not undoable and not an unsaved change', () => {
    const a = fresh(data()); a.ev('saveMem("all")'); all(a); expect(a.ev('[isDirty(),state.undoSt.length]')).toEqual([false, 0]);
    a.q('.dh.c .wkb').click(); expect(a.q('.omenu .oi.on, .omenu .oi svg') !== null).toBe(true); a.qa('.omenu .oi').find(b => b.textContent.trim().startsWith('Week 2')).click();
    expect(a.qa('.day')).toHaveLength(7); expect(a.q('.wkb').textContent).toBe('W2');
  });
  it('lanes, clicks and the hover card follow the week of the column', async () => {
    const a = fresh(data({ events: [ev1({ id: 'w2', title: 'Week two', weeks: [2], slots: [sl(0, 600, 660, { person: 'A' })] }), ev1({ id: 'x', title: 'Every week', slots: [sl(0, 600, 660, { person: 'B' })] })] })); all(a);
    expect([...cell(a, 1, 0).querySelectorAll('.ev')].map(b => b.dataset.lane || '')).toEqual(['']); expect([...cell(a, 2, 0).querySelectorAll('.ev')].map(b => b.dataset.lane)).toEqual(['0/2', '1/2']);
    expect(a.ev(`(atCol(document.querySelectorAll('.day')[7]),piecesAt(0,630,false,0.25).map(x=>x.e.id))`)).toEqual(['w2']);
    expect(a.ev(`(atCol(document.querySelectorAll('.day')[0]),piecesAt(0,630,false,0.25).map(x=>x.e.id))`)).toEqual(['x']);   // week 1 has one lane, whatever week 2 has
    await dragFrom(a, cell(a, 1, 0).querySelector('.ev'), { col: 0, min: 630 }, { col: 0, min: 630 }, { move: false }); expect(a.q('#fT').value).toBe('Every week');
  });
  it('a header opens the agenda of that day in its own week', () => {
    const a = fresh(data()); all(a); a.qa('.dh:not(.c)')[7].click(); expect(a.q('#agBody h1').textContent).toContain('Monday — Week 2 · Nights'); expect(a.q('#agBody').textContent).toContain('Week two');
  });
  it('dragging a time with its own week across the week edge moves it along the cycle', async () => {
    const a = fresh(data()); all(a); await dragFrom(a, cell(a, 1, 6).querySelector('.ev'), { col: 6, min: 1350 }, { col: 7, min: 1350 });
    expect(a.ev('JSON.stringify(state.S.events[1].slots[0])')).toMatch(/"day":0,"start":1320.*"wk":2|"wk":2.*"day":0/);
  });
  it('creating in a week\'s column makes an event of that week', async () => {
    const a = fresh(data()); all(a); await createDrag(a, { col: 9, min: 600 }, { col: 9, min: 660 });
    expect(a.qa('#fWk .chips input').map(i => i.checked)).toEqual([false, true]); a.q('#fT').value = 'New'; a.q('#fOk').click(); expect(a.ev('state.S.events.at(-1).weeks')).toEqual([2]);
  });
  it('the day view shows that day of every week, which also suits a phone', () => {
    const a = fresh(data()); all(a); a.ev('setFocus(0)'); expect(a.qa('.dh:not(.c)').map(h => h.textContent.trim().replace(/\s+/g, ' '))).toEqual(expect.arrayContaining([expect.stringContaining('Monday · W1'), expect.stringContaining('Monday · W2')]));
    expect(a.qa('.day')).toHaveLength(2);
  });
  it('Live View turns it off, and a cycle of one week does not offer it', () => {
    const a = fresh(data()); all(a); a.ev('setAnchor(1);setLive(true)'); expect(a.ev('state.allWk')).toBe(false); a.ev('setLive(false)');
    const b = fresh(blank()); expect(b.q('.dh.c .wkb')).toBeNull(); b.ev('setAllWk(true)'); expect(b.ev('state.allWk')).toBe(false);
  });
  it('Print offers this view (across the page) or every week, one week per page', () => {
    const a = fresh(data()); all(a); a.toolbar('print').click(); expect(a.qa('.omenu .oi').map(b => b.textContent.trim())).toEqual(['Print this view (all weeks side by side)', 'Print every week (one page each)']);
    a.qa('.omenu .oi')[1].click(); expect((a.w.__printed.match(/class="day"/g) || []).length).toBe(14); expect(a.ev('state.allWk')).toBe(true); expect(a.qa('#grid .day')).toHaveLength(14);
  });
  it('in Spanish the menu item and the corner button are translated', () => {
    const b = openApp({ languages: ['es'] }); setData(b, data()); b.ev('setAllWk(true)'); expect(b.q('.wkb').textContent).toBe('S1–2'); expect(b.q('.dh[data-w="2"]').textContent).toContain('· S2');
  });
});

describe('R-CYC-18 Choosing which events count turns: automatic, always or never, from the event dialog and the statistics', () => {
  const rota = (o = {}) => ev1({ id: 'r', title: 'Cook', slots: [sl(0, 1080, 1140, { person: 'A' }), sl(1, 1080, 1140, { person: 'B' })], ...o });
  const solo = (o = {}) => ev1({ id: 's', title: 'Bins', slots: [sl(2, 1200, 1215, { person: 'A' }), sl(5, 1200, 1215, { person: 'A' })], ...o });
  const rows = a => a.qa('#xDlg .sttu tbody tr').map(r => r.cells[0].textContent.replace('✕', ''));
  it('the data keeps the mark only as true or false; absent means automatic', () => {
    const a = fresh(blank({ people, events: [rota({ turns: false }), solo({ turns: true }), ev1({ id: 'x', turns: 'yes' })] }));
    expect(a.ev('state.S.events.map(e=>e.turns)')).toEqual([false, true, undefined]);
  });
  it('never takes an automatic rota out; always counts an event that only one person does', () => {
    const a = fresh(blank({ people, events: [rota({ turns: false }), solo({ turns: true })] }));
    expect(a.ev('turnsOf(state.S.events[0])')).toBeNull(); expect(a.ev('Object.fromEntries(turnsOf(state.S.events[1]))')).toEqual({ A: [2] });
  });
  it('the event dialog chooses Automatic, Count turns or Don\'t count, shows the counts while it applies and saves the mark', () => {
    const a = fresh(blank({ people, events: [solo()] })); a.ev('openDlg(state.S.events[0])'); const m = a.q('#fTuM');
    expect([...m.options].map(o => o.textContent)).toEqual(['Automatic (two or more people)', 'Count turns', "Don't count"]); expect(m.getAttribute('aria-label')).toBe('Count turns');
    expect(a.q('#fTu').textContent).toBe(''); m.value = 'y'; m.onchange(); expect(a.q('#fTu').textContent).toBe('Ann 2 turns a week');
    a.q('#fOk').click(); expect(a.ev('state.S.events[0].turns')).toBe(true);
    a.ev('openDlg(state.S.events[0])'); expect(a.q('#fTuM').value).toBe('y'); a.q('#fTuM').value = ''; a.q('#fOk').click(); expect(a.ev('"turns" in state.S.events[0]')).toBe(false);
  });
  it('Don\'t count hides the counts of a rota in the dialog', () => {
    const a = fresh(blank({ people, events: [rota()] })); a.ev('openDlg(state.S.events[0])'); expect(a.q('#fTu').textContent).toContain('Ann 1 · Bob 1');
    a.q('#fTuM').value = 'n'; a.q('#fTuM').onchange(); expect(a.q('#fTu').textContent).toBe(''); a.q('#fOk').click(); expect(a.ev('state.S.events[0].turns')).toBe(false);
  });
  it('in the statistics ✕ leaves a rota out, as an undoable change that marks the workspace unsaved', () => {
    const a = fresh(blank({ people, events: [rota(), solo()] })); a.ev('saveMem("all");openStats("*")'); expect(rows(a)).toEqual(['Cook']);
    const x = a.q('#xDlg .sttu .tux'); expect(x.getAttribute('aria-label')).toBe('Leave Cook out of the turns'); x.click();
    expect(a.q('#xDlg .sttu')).toBeNull(); expect(a.dlgText()).toContain('No rotas yet.'); expect(a.ev('[state.S.events[0].turns,isDirty()]')).toEqual([false, true]);
    a.ev('undo()'); expect(a.ev('"turns" in state.S.events[0]')).toBe(false);
  });
  it('Add an event… lists the other events one per line and adds the one picked; one left out says so and can come back', () => {
    const a = fresh(blank({ people, events: [rota({ turns: false }), solo(), ev1({ id: 'z', title: 'Away', away: true, slots: [sl(0, 0, 60, { person: 'A' })] })] })); a.ev('openStats("A")');
    a.q('#xDlg .tuadd').click(); expect(a.qa('.tupop .oi').map(b => b.textContent)).toEqual(['Bins', 'Cookleft out']); expect(a.q('.tupop .oh').textContent).toBe('Count the turns of');
    a.qa('.tupop .oi')[0].click(); expect(a.q('.tupop')).toBeNull(); expect(rows(a)).toEqual(['Bins']); expect(a.ev('state.S.events[1].turns')).toBe(true);
    a.q('#xDlg .tuadd').click(); a.qa('.tupop .oi')[0].click(); expect(a.ev('state.S.events[0].turns')).toBe(true);
  });
  it('when every event counts, the list says so; the buttons are not printed', () => {
    const a = fresh(blank({ people, events: [rota()] })); a.ev('openStats("*")'); a.q('#xDlg .tuadd').click();
    expect(a.q('.tupop .oi').textContent).toBe('Every event already counts its turns'); expect(a.q('.tupop .oi').disabled).toBe(true);
    expect(a.d.querySelector('style').textContent).toContain('#pr .tip,#pr .tux,#pr .tuadd{display:none}');
  });
  it('the turns of a person with no rota say so, and the new labels are translated', () => {
    const a = fresh(blank({ people, events: [solo()] })); a.ev('openStats("B")'); expect(a.dlgText()).toContain('Bob takes no turns in a rota.');
    const b = openApp({ languages: ['es'] }); setData(b, blank({ people, events: [solo()] })); b.ev('openDlg(state.S.events[0])');
    expect([...b.q('#fTuM').options].map(o => o.textContent)).toEqual(['Automático (dos o más personas)', 'Contar turnos', 'No contar']);
  });
});
