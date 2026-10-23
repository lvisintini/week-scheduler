// Staged weeks (docs/requirements/cycle.md, R-CYC-21…23): weeks kept after the cycle, swapped in and out, never shown, counted or changed from the cycle.
import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, ev1, person, dragFrom, sleep } from '../helpers/app.js';

const fresh = (data, o) => { const a = openApp(o); if (data) setData(a, data); return a; };
const week = (a, w) => a.ev(`state.curWk=${w};render()`);
const boxes = (a, d) => a.qa(`.day[data-d="${d}"] .ev`).map(b => b._it.e.id + (b._it.piece ? '+' : ''));
const sl = (day, start, end, o = {}) => ({ day, start, end, person: '', ...o });
const openCycleDlg = a => { a.q('.wsbtn').click(); a.qa('.omenu .oi').find(b => b.textContent.includes('Weeks in the cycle')).click(); };
const chooseLen = (a, n) => { const s = a.q('#xDlg select'); s.value = String(n); s.dispatchEvent(new a.w.Event('change')); };
const rows = a => a.qa('#xDlg .cywr'), grips = a => a.qa('#xDlg .cywr .grip');
const key = (g, k) => g.onkeydown({ key: k, preventDefault() {} });
const get = (a, x) => JSON.parse(a.ev(`JSON.stringify(${x})`));
const pick = (a, name, v) => { a.qa(`#xDlg input[name=${name}]`).find(r => r.value === v).checked = true; };
// a 2-week cycle with week 3 staged: lunch every week, a swim in weeks 1 and 3, a rota with a time of its own in each week
const data = (o = {}) => blank({
  cycle: 2, pool: 3, weekInfo: [{ name: 'Home' }, { name: 'Away' }, { name: 'Exams', color: '#e8912d' }],
  events: [ev1({ id: 'lunch', title: 'Lunch', slots: [sl(0, 720, 780)] }), ev1({ id: 'swim', title: 'Swim', weeks: [1, 3], slots: [sl(2, 1020, 1080)] }),
    ev1({ id: 'rota', title: 'Rota', slots: [sl(1, 600, 660, { wk: 1 }), sl(1, 600, 660, { wk: 2 }), sl(1, 900, 960, { wk: 3 })] })], ...o });

describe('R-CYC-21 Staged weeks: kept after the cycle, ready to swap in', () => {
  it('a workspace keeps up to 8 weeks: pool is stored only above the cycle, and weeks beyond it are dropped on import', () => {
    const a = fresh(); const p = d => get(a, `parseData(${JSON.stringify(d)})`);
    expect(p(blank({ cycle: 2, pool: 3 })).pool).toBe(3); expect(p(blank({ cycle: 2, pool: 2 })).pool).toBeUndefined(); expect(p(blank({ cycle: 2, pool: 1 })).pool).toBeUndefined();
    expect(p(blank({ cycle: 2, pool: 20 })).pool).toBe(8); expect(p(blank({ cycle: 3, pool: 'x' })).pool).toBeUndefined();
    const d = p(blank({ cycle: 2, pool: 3, events: [ev1({ weeks: [1, 3, 4] }), ev1({ id: 'e2', slots: [sl(0, 600, 660, { wk: 3 }), sl(1, 600, 660, { wk: 4 })] })] }));
    expect(d.events[0].weeks).toEqual([1, 3]); expect(d.events[1].slots.map(s => s.wk)).toEqual([3]);
    expect(p(blank({ cycle: 2, pool: 3, events: [ev1({ weeks: [1, 2, 3] })] })).events[0].weeks).toBeUndefined();   // every kept week = every week
    expect(p(blank({ cycle: 2, pool: 3, weekInfo: [{}, {}, { name: 'Exams' }, { name: 'gone' }] })).weekInfo).toEqual([{}, {}, { name: 'Exams' }]);
  });
  it('staged weeks are kept in files and links, and count as a change to save', () => {
    const a = fresh(data()); expect(a.ev('buildFile().pool')).toBe(3); a.ev('cw().lb=keyOf(state.S);state.S.pool=4'); expect(a.ev('anyDirty()')).toBe(true);
  });
  it('the grid shows only the cycle: what was chosen for a staged week is drawn in no week, and never wraps into week 1', () => {
    const a = fresh(data({ events: [ev1({ id: 'late', slots: [sl(6, 1320, 1800, { wk: 3 })] }), ev1({ id: 'only3', weeks: [3], slots: [sl(0, 600, 660)] }), ev1({ id: 'w1', weeks: [1, 3], slots: [sl(2, 600, 660)] })] }));
    expect(boxes(a, 0)).toEqual([]); expect(boxes(a, 6)).toEqual([]); expect(boxes(a, 2)).toEqual(['w1']);
    week(a, 2); expect(boxes(a, 0)).toEqual([]); expect(boxes(a, 2)).toEqual([]);
    expect(a.ev('overlapSet(state.S.events[0]).size')).toBe(0);
  });
  it('a staged week\'s time never clashes with the same time in week 1 (no ⚠), nor gives an external person a fixed lane', () => {
    const a = fresh(data({ people: [person({ id: 'A' }), person({ id: 'X', name: 'Xavi', external: true })],
      events: [ev1({ id: 'c', slots: [sl(0, 600, 660, { wk: 1, person: 'A' }), sl(0, 600, 660, { wk: 3, person: 'A' })] }), ev1({ id: 'x', slots: [sl(1, 600, 660, { wk: 3, person: 'X' })] })] }));
    expect(a.ev('overlapSet(state.S.events[0]).size')).toBe(0); expect(a.ev('fixIds()')).toEqual(['A']);
  });
  it('turns, statistics and the hover note count only the weeks of the cycle', () => {
    const a = fresh(data({ people: [person({ id: 'A' }), person({ id: 'B', name: 'Bob' })],
      events: [ev1({ id: 'rota', turns: true, slots: [sl(1, 600, 660, { wk: 1, person: 'A' }), sl(1, 600, 660, { wk: 2, person: 'B' }), sl(1, 600, 660, { wk: 3, person: 'A' })] }),
        ev1({ id: 'p12', weeks: [1, 2], slots: [sl(3, 600, 660)] })] }));
    expect(a.ev('Object.fromEntries(turnsOf(state.S.events[0]))')).toEqual({ A: [1, 0], B: [0, 1] });
    expect(a.ev('wkNote(state.S.events[1],state.S.events[1].slots[0])')).toBe('');   // weeks 1 and 2 are the whole cycle: no note
  });
  it('the cycle dialog lists the staged weeks under their own heading, saying what was chosen for them', () => {
    const a = fresh(data()); openCycleDlg(a); expect(rows(a).map(r => r.classList.contains('stg'))).toEqual([false, false, true]);
    expect(a.q('#xDlg .cystg').textContent).toBe('Staged weeks'); expect(a.dlgText()).toContain('not shown, printed, counted or exported');
    expect(rows(a)[2].querySelector('.cyholds').textContent).toBe('Chosen for it: 2 event(s), 0 phase(s)'); expect(rows(a)[2].querySelector('.cyname').value).toBe('Exams');
  });
  it('dragging a staged week above the line swaps it into the cycle, with everything chosen for it, in one undo step', () => {
    const a = fresh(data()); openCycleDlg(a); key(grips(a)[2], 'ArrowUp');
    expect(rows(a).map(r => r.querySelector('.cywn').firstChild.textContent)).toEqual(['Week 1', 'Week 2 (was week 3)', 'Week 3 (was week 2)']); a.click('Apply');
    expect(get(a, '[state.S.cycle,kept(),state.S.events[1].weeks,state.S.events[2].slots.map(s=>[s.wk,s.start]),state.S.weekInfo.map(w=>w.name)]'))
      .toEqual([2, 3, [1, 2], [[1, 600], [3, 600], [2, 900]], ['Home', 'Exams', 'Away']]);
    week(a, 2); expect(boxes(a, 2)).toEqual(['swim']); a.toolbar('undo').click(); expect(get(a, 'state.S.events[1].weeks')).toEqual([1, 3]);
  });
  it('when today\'s week is swapped out of the cycle, today keeps its number and shows the week that came in', () => {
    const a = fresh(data()); a.ev('setAnchor(2);state.curWk=2;render()'); openCycleDlg(a); key(grips(a)[2], 'ArrowUp'); a.click('Apply');
    expect(a.ev('[todayWk(),state.curWk]')).toEqual([2, 2]);
  });
  it('a staged week can be added (empty: only what happens every week is in it) and up to 8 weeks are kept', () => {
    const a = fresh(blank({ cycle: 2, events: [ev1({ id: 'all' }), ev1({ id: 'w1', weeks: [1] })] })); openCycleDlg(a);
    expect(a.q('#xDlg .cyadd').title).toContain('swap it in later'); a.q('#xDlg .cyadd').click(); expect(rows(a).at(-1).querySelector('.cywn').textContent).toBe('Week 3 (new)');
    a.click('Apply'); expect(get(a, '[state.S.cycle,kept(),state.S.events[0].weeks||null,state.S.events[1].weeks]')).toEqual([2, 3, null, [1]]);
    const b = fresh(blank({ cycle: 4, pool: 7 })); openCycleDlg(b); b.q('#xDlg .cyadd').click(); expect(b.q('#xDlg .cyadd')).toBeNull(); expect(rows(b)).toHaveLength(8);
  });
  it('a new staged week can start as a copy of a week: its name and colour, its patterns and its own times, in one undo step', () => {
    const a = fresh(data()); openCycleDlg(a); const fs = a.q('#xDlg .cyfrom');
    expect(fs.getAttribute('aria-label')).toBe('Start the new week as'); expect([...fs.options].map(o => o.textContent)).toEqual(['an empty week', 'a copy of Week 1 · Home', 'a copy of Week 2 · Away', 'a copy of Week 3 · Exams']);
    fs.value = '3'; fs.onchange(); a.q('#xDlg .cyadd').click(); expect(rows(a).at(-1).querySelector('.cywn').textContent).toBe('Week 4 (copy of week 3)'); expect(rows(a).at(-1).querySelector('.cyname').value).toBe('Exams');
    a.click('Apply'); expect(get(a, '[kept(),state.S.events[0].weeks||null,state.S.events[1].weeks,state.S.events[2].slots.map(s=>[s.wk,s.start]),state.S.weekInfo[3]]'))
      .toEqual([4, null, [1, 3, 4], [[1, 600], [2, 600], [3, 900], [4, 900]], { name: 'Exams', color: '#e8912d' }]);
    a.toolbar('undo').click(); expect(get(a, '[kept(),state.S.events[2].slots.length]')).toEqual([3, 3]);
    const b = fresh(data()); openCycleDlg(b); b.q('#xDlg .cyfrom').value = '2'; b.q('#xDlg .cyfrom').onchange(); key(grips(b)[1], 'ArrowDown'); b.q('#xDlg .cyadd').click(); b.click('Apply');   // the copy follows week 2 to its new number
    expect(get(b, '[state.S.events[2].slots.map(s=>[s.wk,s.start]),state.S.weekInfo.map(w=>w.name)]')).toEqual([[[1, 600], [3, 600], [2, 900], [4, 600]], ['Home', 'Exams', 'Away', 'Away']]);
  });
  it('deleting a staged week that holds something asks first: remove it, or keep it in a schedule of its own', async () => {
    let a = fresh(data()); openCycleDlg(a); rows(a)[2].querySelector('.cydel').click(); expect(rows(a)).toHaveLength(2); a.click('Apply'); await sleep(5);
    expect(a.dlgText()).toContain('Week 3 · Exams will be deleted'); a.click('Apply');
    expect(get(a, '[kept(),state.S.events.map(e=>e.id),state.S.events[1].weeks||null,state.S.events[2].slots.length,state.S.weekInfo.length]')).toEqual([2, ['lunch', 'swim', 'rota'], [1], 2, 2]);
    a = fresh(data()); openCycleDlg(a); rows(a)[2].querySelector('.cydel').click(); a.click('Apply'); await sleep(5); pick(a, 'cyg', 'mv'); a.click('Apply');
    expect(get(a, 'state.S.schedules.map(s=>s.name)')).toEqual(['S1', 'Week 3']); expect(get(a, 'state.S.events.slice(3).map(e=>[e.title,e.weeks||e.slots.map(s=>s.wk)])')).toEqual([['Swim', [1]], ['Rota', [1]]]);
    a = fresh(blank({ cycle: 2, pool: 3 })); openCycleDlg(a); rows(a)[2].querySelector('.cydel').click(); a.click('Apply'); await sleep(5); expect(a.dlgOpen()).toBe(false); expect(a.ev('kept()')).toBe(2);
  });
  it('shrinking keeps the weeks that leave as staged weeks by default; lengthening brings them back as they were', async () => {
    const a = fresh(blank({ cycle: 3, weekInfo: [{}, {}, { name: 'Exams' }], events: [ev1({ id: 'w3', weeks: [1, 3] }), ev1({ id: 'per', slots: [sl(0, 600, 660, { wk: 3 })] })] }));
    openCycleDlg(a); chooseLen(a, 2); a.click('Apply'); await sleep(5); expect(a.q('#xDlg input[name=cym]:checked').value).toBe('st');
    expect(a.qa('#xDlg .radios label')[0].textContent).toContain('Keep them as staged weeks'); a.click('Apply');
    expect(get(a, '[state.S.cycle,kept(),state.S.events[0].weeks,state.S.events[1].slots[0].wk,state.S.weekInfo[2].name]')).toEqual([2, 3, [1, 3], 3, 'Exams']);
    openCycleDlg(a); chooseLen(a, 4); expect(a.q('#xDlg .cyext').style.display).toBe('none'); a.click('Apply');   // no "in step": week 3 comes back as it is
    expect(get(a, '[state.S.cycle,kept(),state.S.events[0].weeks,state.S.events[1].slots[0].wk]')).toEqual([4, 4, [1, 3], 3]); week(a, 3); expect(boxes(a, 0)).toEqual(['w3', 'per']);
  });
  it('inserting events whose weeks lie beyond the cycle can keep those weeks as staged weeks', async () => {
    const a = fresh(blank({ cycle: 2 })); const src = JSON.stringify(blank({ cycle: 3, events: [ev1({ id: 'x', weeks: [3] })] }));
    a.ev(`openImport({name:'W',data:parseData(${src})},'file')`); a.qa('#xDlg input[name=impm]').find(r => r.value === 'insert').checked = true; a.click('Import'); await sleep(10);
    pick(a, 'icm', 'st'); a.click('Apply'); await sleep(10); expect(get(a, '[state.S.cycle,kept(),state.S.events.at(-1).weeks]')).toEqual([2, 3, [3]]);
  });
  it('in Spanish the staged weeks are "semanas en reserva"', () => {
    const a = fresh(data(), { languages: ['es'] }); a.q('.wsbtn').click(); a.qa('.omenu .oi').find(b => b.textContent.includes('Semanas del ciclo')).click();
    expect(a.q('#xDlg .cystg').textContent).toBe('Semanas en reserva'); expect(a.q('#xDlg .cyadd').textContent).toBe('+ Añadir una semana en reserva');
  });
});

describe('R-CYC-22 Changes made in the cycle leave the staged weeks\' own times as they are', () => {
  const box = (a, d) => a.q(`.day[data-d="${d}"] .ev`);
  it('moving every time of an event with a week per time moves only the cycle\'s times', async () => {
    const a = fresh(data({ events: [ev1({ slots: [sl(1, 600, 660, { wk: 1 }), sl(2, 600, 660, { wk: 1 }), sl(1, 900, 960, { wk: 3 })] })] }));
    await dragFrom(a, box(a, 1), { col: 1, min: 610 }, { col: 1, min: 670 });
    expect(get(a, 'state.S.events[0].slots.map(s=>[s.wk,s.day,s.start])')).toEqual([[1, 1, 660], [1, 2, 660], [3, 1, 900]]); expect(a.toast()).toContain('2');
  });
  it('resizing every time of such an event leaves the staged time alone, and one time in the cycle is moved as a single one', async () => {
    const a = fresh(data({ events: [ev1({ slots: [sl(1, 600, 660, { wk: 1 }), sl(1, 900, 960, { wk: 3 })] })] }));
    await dragFrom(a, box(a, 1), { col: 1, min: 610 }, { col: 1, min: 700 }); expect(a.toast() || '').not.toContain('Applied to');
    expect(get(a, 'state.S.events[0].slots.map(s=>[s.wk,s.start])')).toEqual([[1, 690], [3, 900]]);
  });
  it('a week pattern belongs to the event: moving it moves its times in the staged weeks too', async () => {
    const a = fresh(data({ events: [ev1({ weeks: [1, 3], slots: [sl(2, 600, 660)] })] }));
    await dragFrom(a, box(a, 2), { col: 2, min: 610 }, { col: 3, min: 610 }); expect(get(a, '[state.S.events[0].weeks,state.S.events[0].slots[0].day]')).toEqual([[1, 3], 3]);
  });
  it('the event dialog shows only the cycle\'s weeks and saves the staged weeks back unchanged, saying so', () => {
    const a = fresh(data()); a.ev('openDlg(state.S.events[2])'); expect(a.q('#fWk .wkstg').textContent).toBe('The staged weeks (Week 3 · Exams) keep their own times, which are not shown here.');
    a.q('#fOk').click(); expect(get(a, 'state.S.events[2].slots.map(s=>[s.wk,s.start])')).toEqual([[1, 600], [2, 600], [3, 900]]);
    a.ev('openDlg(state.S.events[0])'); expect(a.qa('#fWk .chips input').map(i => i.value)).toEqual(['1', '2']);
    expect(a.q('#fWk .wkstg').textContent).toBe('Also in the staged weeks (Week 3 · Exams): the times you change here change there too.');
  });
  it('unticking a week of the cycle keeps the event in its staged weeks; a new event ticked in every week is every week', () => {
    const a = fresh(data()); a.ev('openDlg(state.S.events[0])'); const ch = a.qa('#fWk .chips input'); ch[1].checked = false; ch[1].onchange(); a.q('#fOk').click();
    expect(get(a, 'state.S.events[0].weeks')).toEqual([1, 3]);
    a.ev('openDlg(null)'); a.q('#fT').value = 'New'; a.q('#fOk').click(); expect(get(a, 'state.S.events.at(-1).weeks||null')).toBeNull();
    a.ev('openDlg(null)'); a.q('#fT').value = 'Week one'; const c2 = a.qa('#fWk .chips input'); c2[1].checked = false; c2[1].onchange(); a.q('#fOk').click(); expect(get(a, 'state.S.events.at(-1).weeks')).toEqual([1]);
  });
  it('turning on Different per week gives the staged weeks their own copy of the times; turning it off makes them take the pattern again, after a warning', () => {
    const a = fresh(data()); a.ev('openDlg(state.S.events[1])'); a.q('#fPw').click(); a.q('#fOk').click();
    expect(get(a, 'state.S.events[1].slots.map(s=>[s.wk,s.day,s.start])')).toEqual([[1, 2, 1020], [3, 2, 1020]]); expect(get(a, 'state.S.events[1].weeks||null')).toBeNull();
    a.ev('openDlg(state.S.events[2])'); a.q('#fPw').click(); expect(a.log.confirms.at(-1)).toContain('The staged weeks (Week 3 · Exams) will take these times too.'); a.q('#fOk').click();
    expect(get(a, '[state.S.events[2].weeks||null,state.S.events[2].slots.map(s=>[s.wk||0,s.start])]')).toEqual([null, [[0, 600]]]);
  });
});

describe('R-CYC-23 Deleting an event or phase that also happens in staged weeks asks whether those go too', () => {
  it('an event without staged occurrences is deleted at once, as before', () => {
    const a = fresh(data({ events: [ev1({ id: 'w1', weeks: [1, 2] })] })); a.ev('openDlg(state.S.events[0])'); a.q('#fDel').click(); expect(a.ev('state.S.events.length')).toBe(0);
  });
  it('otherwise the question offers to keep it in the staged weeks (the first choice) or to delete it everywhere', async () => {
    let a = fresh(data()); a.ev('openDlg(state.S.events[2])'); a.q('#fDel').click(); await sleep(5);
    expect(a.dlgText()).toContain('“Rota” also happens in the staged weeks (Week 3 · Exams)'); expect(a.dlgButtons()).toEqual(['Delete it from the cycle only; keep it in Week 3 · Exams', 'Delete it everywhere, staged weeks included', 'Cancel']);
    a.click('Delete it from the cycle only; keep it in Week 3 · Exams'); expect(get(a, 'state.S.events[2].slots.map(s=>s.wk)')).toEqual([3]); expect(boxes(a, 1)).toEqual([]);
    a.toolbar('undo').click(); expect(get(a, 'state.S.events[2].slots.length')).toBe(3);
    a = fresh(data()); a.ev('openDlg(state.S.events[0])'); a.q('#fDel').click(); await sleep(5); a.click('Delete it from the cycle only; keep it in Week 3 · Exams'); expect(get(a, 'state.S.events[0].weeks')).toEqual([3]);
    a = fresh(data()); a.ev('openDlg(state.S.events[1])'); a.q('#fDel').click(); await sleep(5); a.click('Delete it everywhere, staged weeks included'); expect(get(a, 'state.S.events.map(e=>e.id)')).toEqual(['lunch', 'rota']);
    a = fresh(data()); a.ev('openDlg(state.S.events[1])'); a.q('#fDel').click(); await sleep(5); a.click('Cancel'); expect(a.ev('state.S.events.length')).toBe(3);
  });
  it('a phase asks the same, and the question is translated', async () => {
    const ph = { id: 'p', title: 'Quiet', desc: '', color: '#607d8b', rhythms: ['r'], weeks: [2, 3], slots: [sl(5, 480, 720)] };
    const a = fresh(data({ rhythms: [{ id: 'r', name: 'R', visible: true }], phases: [ph] }), { languages: ['es'] }); a.ev('openDlg(state.S.phases[0])'); a.q('#fDel').click(); await sleep(5);
    expect(a.q('#xDlg h3').textContent).toBe('Eliminar la franja'); a.click('Eliminar solo del ciclo; conservar en Semana 3 · Exams'); expect(get(a, 'state.S.phases[0].weeks')).toEqual([3]);
  });
});
