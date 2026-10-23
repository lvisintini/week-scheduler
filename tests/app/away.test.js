// Away (R-EVT-24): strips for people who are away, which clash with their activities.
import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, ev1, person } from '../helpers/app.js';

const fresh = data => { const a = openApp(); if (data) setData(a, data); return a; };
const sl = (day, start, end, o = {}) => ({ day, start, end, person: '', ...o });
const people = [person({ id: 'O', name: 'Olivia', color: '#d6409f' }), person({ id: 'B', name: 'Bob', color: '#2fa66a' }), person({ id: 'X', name: 'Cleaner', color: '#607d8b', external: true })];
const dad = (o = {}) => ev1({ id: 'dad', title: "At Dad's", color: '#8e4ec6', away: true, involved: ['O'], slots: [sl(4, 600, 1200)], ...o });
const data = (...evs) => blank({ people, events: [dad(), ...evs] });
const boxOf = (a, id) => a.qa('.day .ev').find(b => b._it.e.id === id);
const warned = b => b.innerHTML.includes('#ffd23f');

describe('R-EVT-24 Away is drawn as a hatched strip without a band, out of the lanes', () => {
  it('an Away event is a strip in the gutter, hatched, with its title', () => {
    const a = fresh(data()); const st = a.q('.day[data-d="4"] .bgs');
    expect(st.classList.contains('aw')).toBe(true); expect(st.style.background).toContain('repeating-linear-gradient'); expect(st.textContent).toBe("At Dad's");
  });
  it('it tints no band across the column, unlike a background strip', () => {
    const a = fresh(data()); expect(a.qa('.day[data-d="4"] .bgb')).toHaveLength(0);
    const b = fresh(blank({ people, events: [ev1({ bg: true, slots: [sl(4, 600, 700)] })] })); expect(b.qa('.day[data-d="4"] .bgb')).toHaveLength(1);
  });
  it('it takes no lane: two parallel activities keep their halves of the column', () => {
    const a = fresh(data(ev1({ id: 'o', slots: [sl(4, 660, 720, { person: 'O' })] }), ev1({ id: 'b', slots: [sl(4, 660, 720, { person: 'B' })] })));
    expect(a.qa('.day[data-d="4"] .ev').map(b => b.dataset.lane)).toEqual(['0/2', '1/2']);
  });
  it('the strip says Away in its label, and its hover card too', () => {
    const a = fresh(data()); expect(a.q('.bgs.aw').getAttribute('aria-label')).toContain('Away'); expect(a.ev('peekRows({e:state.S.events[0],s:state.S.events[0].slots[0],piece:0})')).toContain('Away');
  });
  it('an Away event is never nested and never hosts a nested activity', () => {
    const a = fresh(data(ev1({ id: 'n', nest: true, slots: [sl(4, 660, 675, { person: 'O' })] }))); expect(a.qa('.ev.nest')).toHaveLength(0);
  });
});

describe('R-EVT-24 An Away strip clashes with the activities of its people, on call too, and with activities without a responsible person', () => {
  it('an activity performed by the away person gets stripes, a ⚠ and a note naming who is away', () => {
    const a = fresh(data(ev1({ id: 'swim', slots: [sl(4, 660, 720, { person: 'O' })] }))); const b = boxOf(a, 'swim');
    expect(a.qa('.day[data-d="4"] .ov.awov')).toHaveLength(1); expect(warned(b)).toBe(true); expect(b.getAttribute('aria-label')).toContain("Olivia is away (At Dad's)");
  });
  it('the stripes cover only the time both share', () => {
    const a = fresh(data(ev1({ id: 'late', slots: [sl(4, 1140, 1260, { person: 'O' })] }))); const o = a.q('.ov.awov');
    expect(o.style.top).toBe(a.y(1140) + 'px'); expect(parseFloat(o.style.height)).toBeCloseTo(a.y(1200) - a.y(1140) - 1, 5);
  });
  it('an activity in which the away person is involved clashes as well', () => {
    const a = fresh(data(ev1({ id: 'tea', involved: ['O'], slots: [sl(4, 660, 720, { person: 'B' })] }))); expect(warned(boxOf(a, 'tea'))).toBe(true);
  });
  it('being only on call does not help: the away person cannot be at hand', () => {
    const a = fresh(data(ev1({ id: 'clean', oncall: true, involved: ['O'], slots: [sl(4, 660, 720, { person: 'X' })] }))); expect(warned(boxOf(a, 'clean'))).toBe(true); expect(a.qa('.ov.awov')).toHaveLength(1);
  });
  it('an activity without a responsible person concerns everyone, so it clashes too', () => {
    const a = fresh(data(ev1({ id: 'dinner', slots: [sl(4, 1140, 1200)] }))); expect(warned(boxOf(a, 'dinner'))).toBe(true);
  });
  it('an activity of somebody else, without the away person, does not clash', () => {
    const a = fresh(data(ev1({ id: 'gym', slots: [sl(4, 660, 720, { person: 'B' })] }))); expect(warned(boxOf(a, 'gym'))).toBe(false); expect(a.qa('.ov')).toHaveLength(0);
  });
  it('background strips never clash with an Away strip', () => {
    const a = fresh(data(ev1({ id: 'sf', bg: true, slots: [sl(4, 660, 720, { person: 'O' })] }))); expect(a.qa('.ov')).toHaveLength(0);
  });
  it('a flexible margin that touches the away time is no clash: only cores count', () => {
    const a = fresh(data(ev1({ id: 'm', slots: [sl(4, 480, 660, { person: 'O', fe: 60 })] }))); expect(warned(boxOf(a, 'm'))).toBe(false);
  });
  it('with a cycle of weeks an Away strip clashes only in its own weeks', () => {
    const a = fresh(blank({ cycle: 2, people, events: [dad({ weeks: [2] }), ev1({ id: 'swim', slots: [sl(4, 660, 720, { person: 'O' })] })] }));
    expect(warned(boxOf(a, 'swim'))).toBe(false); a.ev('state.curWk=2;render()'); expect(warned(boxOf(a, 'swim'))).toBe(true);
  });
  it('the hover card and the day agenda name who is away', () => {
    const a = fresh(data(ev1({ id: 'swim', title: 'Swim', slots: [sl(4, 660, 720, { person: 'O' })] })));
    expect(a.ev('peekRows({e:state.S.events[1],s:state.S.events[1].slots[0],piece:0})')).toContain("⚠ Olivia is away (At Dad&#39;s)"); expect(a.ev('agendaHTML(4)')).toContain('Olivia is away');
  });
  it('under fixed lanes the away person\'s own lane is hatched for the window', () => {
    const a = fresh(data()); a.ev('state.prefs.lanesFix=true;render()'); const h = a.qa('.day[data-d="4"] .awl');
    expect(h).toHaveLength(1); expect(h[0].style.left).toContain('* 0)'); expect(h[0].style.top).toBe(a.y(600) + 'px');
  });
});

describe('R-EVT-24 Away time is a line of its own in the statistics', () => {
  it('away time is counted apart from planned and not-planned time', () => {
    const a = fresh(data(ev1({ id: 'swim', slots: [sl(4, 660, 720, { person: 'O' })] })));
    const st = a.ev('(()=>{const s=personStats("O",true);return [s.planned,s.away,s.awPl]})()'); expect(st).toEqual([60, 540, 60]);
  });
  it('the table shows an Away row, a smaller Not planned and the time planned while away', () => {
    const a = fresh(data(ev1({ id: 'swim', slots: [sl(4, 660, 720, { person: 'O' })] }))); a.ev('openStats("O")');
    const row = l => [...a.qa('#xDlg .sttab tr')].find(r => r.cells[0].textContent === l);
    expect(row('Away').cells[1].textContent).toBe('9:00'); expect(row('Not planned').cells[1].textContent).toBe('158:00'); expect(a.q('#xDlg .stfoot').textContent).toContain('Planned while away: 1:00');
  });
  it('people who are not away get no Away row or column', () => {
    const a = fresh(data(ev1({ slots: [sl(0, 600, 660, { person: 'B' })] }))); a.ev('openStats("B")'); expect(a.dlgText()).not.toContain('Away');
    expect(a.ev('statsRows("*",true)[0]')).toContain('Away');
    const b = fresh(blank({ people, events: [ev1({ slots: [sl(0, 600, 660, { person: 'B' })] })] })); expect(b.ev('statsRows("*",true)[0]')).not.toContain('Away');
  });
});

describe('R-EVT-24 The dialog: Drawn as Box / In the background / Away', () => {
  const save = a => a.q('#fOk').click();
  const pick = (a, id) => { const r = a.q('#' + id); r.checked = true; r.dispatchEvent(new a.w.Event('change')); };
  it('a new event is drawn as a box; the three choices are radio buttons of one group', () => {
    const a = fresh(blank({ people })); a.toolbar('add').click(); expect(['fBox', 'fBg', 'fAw'].map(k => a.q('#' + k).checked)).toEqual([true, false, false]);
    expect(new Set(['fBox', 'fBg', 'fAw'].map(k => a.q('#' + k).name)).size).toBe(1); expect(a.q('#fDraw').getAttribute('role')).toBe('radiogroup');
  });
  it('an Away event opens with Away chosen, nesting off and the on-call switch hidden', () => {
    const a = fresh(data()); a.ev('openDlg(state.S.events[0])'); expect(a.q('#fAw').checked).toBe(true); expect(a.q('#fNest').disabled).toBe(true); expect(a.q('#fOcRow').style.display).toBe('none');
  });
  it('choosing Away saves the mark, and choosing Box again removes it', () => {
    const a = fresh(blank({ people, events: [ev1({ involved: ['O'] })] })); a.ev('openDlg(state.S.events[0])'); pick(a, 'fAw'); save(a); expect(a.ev('state.S.events[0].away')).toBe(true);
    a.ev('openDlg(state.S.events[0])'); pick(a, 'fBox'); save(a); expect(a.ev('state.S.events[0].away')).toBeUndefined(); expect(a.ev('state.S.events[0].bg')).toBeUndefined();
  });
  it('an Away event with nobody in it is refused, saying why', () => {
    const a = fresh(blank({ people, events: [ev1()] })); a.ev('openDlg(state.S.events[0])'); pick(a, 'fAw'); save(a);
    expect(a.q('#err').textContent).toContain('Away needs at least one person'); expect(a.ev('state.S.events[0].away')).toBeUndefined();
  });
  it('the choices and the error are translated into Spanish', () => {
    const a = openApp({ languages: ['es-ES'] }); setData(a, blank({ people, events: [ev1()] })); a.ev('openDlg(state.S.events[0])');
    expect(a.q('#fDrawL').textContent).toBe('Dibujado como'); expect(a.q('#fAw').parentElement.textContent).toBe('Ausente'); expect(a.q('#fBox').parentElement.textContent).toBe('Caja'); expect(a.q('#fAw').parentElement.title).toMatch(/^Para personas que están fuera durante un tiempo/);
    pick(a, 'fAw'); save(a); expect(a.q('#err').textContent).toContain('Ausente necesita al menos una persona');
  });
});
