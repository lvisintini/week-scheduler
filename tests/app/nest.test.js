import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, sched, ev1, person, dragFrom } from '../helpers/app.js';

const fresh = data => { const a = openApp(); if (data) setData(a, data); return a; };
const people = [person({ id: 'A', name: 'Ann', color: '#e5484d' }), person({ id: 'B', name: 'Bob', color: '#2fa66a' }), person({ id: 'X', name: 'Cleaner', color: '#12a5b5', external: true })];
const run = (o = {}) => ev1({ id: 'run', title: 'School run', color: '#3b6df0', slots: [{ day: 0, start: 480, end: 510, person: 'A' }], ...o });
const milk = (o = {}) => ev1({ id: 'milk', title: 'Collect milk', color: '#e8912d', nest: true, slots: [{ day: 0, start: 495, end: 510, person: 'A' }], ...o });
const box = (a, id, d = 0) => a.qa(`.day[data-d="${d}"] .ev`).find(b => b._it.e.id === id);
const nested = a => a.qa('.ev.nest').map(b => b._it.e.id + '@' + b._it.s.day);
const slots = (a, id) => a.ev(`JSON.parse(JSON.stringify(S.events.find(e=>e.id==="${id}").slots.map(({day,start,end})=>({day,start,end}))))`);
const at = (a, x, m) => a.ev(`(()=>{const c=document.querySelector('.day[data-d="0"]');return piecesAt(0,${m},true,fxAt(c,${x})).map(i=>i.e.id)})()`);
const toastBtn = (a, t) => [...a.q('#toast').querySelectorAll('button')].find(b => b.textContent === t);
const stats = (a, pid = 'A') => a.ev(`(()=>{const s=personStats(${JSON.stringify(pid)},true);return {by:Object.fromEntries(s.by),planned:s.planned,overlap:s.overlap,places:s.places}})()`);

describe('R-NST-01 An activity marked "can be done during other activities" nests in its person\'s activities', () => {
  it('inside an activity of its responsible person it is nested: no stripes, and the host keeps the whole column', () => {
    const a = fresh(blank({ people, events: [run(), milk()] }));
    expect(nested(a)).toEqual(['milk@0']); expect(a.qa('.ov')).toHaveLength(0); expect(box(a, 'run').dataset.lane).toBeUndefined(); expect(box(a, 'run').classList.contains('nest')).toBe(false);
  });
  it('without the mark the same overlap is still a clash drawn with stripes', () => {
    const a = fresh(blank({ people, events: [run(), milk({ nest: undefined })] })); expect(nested(a)).toEqual([]); expect(a.qa('.ov').length).toBeGreaterThan(0);
  });
  it('several activities of the person back to back may cover it together', () => {
    const a = fresh(blank({ people, events: [run({ slots: [{ day: 0, start: 480, end: 500, person: 'A' }] }), ev1({ id: 'walk', title: 'Walk', slots: [{ day: 0, start: 500, end: 540, person: 'A' }] }), milk()] }));
    expect(nested(a)).toEqual(['milk@0']); expect(a.qa('.ov')).toHaveLength(0);
  });
  it('only partly covered it is not nested and clashes as usual, so the overlap stands out', () => {
    const a = fresh(blank({ people, events: [run({ slots: [{ day: 0, start: 480, end: 500, person: 'A' }] }), milk()] }));
    expect(nested(a)).toEqual([]); expect(a.qa('.ov').length).toBeGreaterThan(0);
  });
  it('alone (on Saturday, with no school run) it is an ordinary box', () => {
    const a = fresh(blank({ people, events: [run(), milk({ slots: [{ day: 0, start: 495, end: 510, person: 'A' }, { day: 5, start: 540, end: 555, person: 'A' }] })] }));
    expect(nested(a)).toEqual(['milk@0']); expect(box(a, 'milk', 5).classList.contains('nest')).toBe(false);
  });
  it('another person\'s activity is no host, but one where the person is involved (not on call) is', () => {
    const bob = o => run({ slots: [{ day: 0, start: 480, end: 510, person: 'B' }], ...o });
    expect(nested(fresh(blank({ people, events: [bob(), milk()] })))).toEqual([]);
    expect(nested(fresh(blank({ people, events: [bob({ involved: ['A'] }), milk()] })))).toEqual(['milk@0']);
    expect(nested(fresh(blank({ people, events: [bob({ involved: ['A'], oncall: true }), milk()] })))).toEqual([]);
  });
  it('never nested without a responsible person, inside another marked activity, or inside a background strip', () => {
    expect(nested(fresh(blank({ people, events: [run(), milk({ slots: [{ day: 0, start: 495, end: 510, person: '' }] })] })))).toEqual([]);
    expect(nested(fresh(blank({ people, events: [run({ nest: true }), milk()] })))).toEqual([]);
    const c = fresh(blank({ people, events: [ev1({ id: 'cl', title: 'Cleaning', bg: true, slots: [{ day: 0, start: 480, end: 600, person: 'X' }] }), milk({ slots: [{ day: 0, start: 495, end: 510, person: 'X' }] })] }));
    expect(nested(c)).toEqual([]); expect(c.qa('.bgs')).toHaveLength(1); expect(c.qa('.ev')).toHaveLength(1);
  });
  it('a host in a hidden schedule does not count: the activity is drawn on its own', () => {
    const a = fresh(blank({ people, schedules: [sched(), sched({ id: 's2', name: 'S2', visible: false })], events: [run({ schedules: ['s2'] }), milk()] }));
    expect(nested(a)).toEqual([]); expect(a.qa('.ev')).toHaveLength(1);
  });
  it('import accepts the mark only when it is exactly true', () => {
    const d = fresh().ev('parseData({schedules:[],events:[{id:"x",schedules:[],nest:true,slots:[{day:0,start:0,end:60}]},{id:"y",schedules:[],nest:"yes",slots:[{day:0,start:0,end:60}]}]})');
    expect(d.events.map(e => e.nest)).toEqual([true, undefined]);
  });
});

describe('R-NST-02 A nested activity is a small box inside its host, at its own time', () => {
  it('the box sits at its own time and length, indented inside the host', () => {
    const a = fresh(blank({ people, events: [run({ slots: [{ day: 0, start: 480, end: 540, person: 'A' }] }), milk({ slots: [{ day: 0, start: 495, end: 525, person: 'A' }] })] })), m = box(a, 'milk');
    expect(m.style.top).toBe(`${(495 - 300) / 60 * 48}px`); expect(m.style.height).toBe(`${30 / 60 * 48 - 1}px`);
    expect(m.style.left).toContain('+ 14px'); expect(a.ev("[...document.styleSheets[0].cssRules].find(r=>(r.selectorText||'').split(/,\\s*/).includes('.ev.nest')).style.getPropertyValue('z-index')")).toBe('5');   // above stripes (2) and the host's text
  });
  it('when the host has a lane of its own, the nested box stays within that lane', () => {
    const a = fresh(blank({ people, events: [run(), milk(), ev1({ id: 'bob', title: 'Gym', slots: [{ day: 0, start: 450, end: 540, person: 'B' }] })] }));
    expect(box(a, 'run').dataset.lane).toBe('0/2'); expect(box(a, 'milk').dataset.lane).toBe('0/2'); expect(box(a, 'milk').style.left).toMatch(/\* 0\) \+ 14px|\* 0 \+ 14px/);
  });
  it('the pointer over the nested box finds only it; beside it, the host', () => {
    const a = fresh(blank({ people, events: [run(), milk()] }));
    expect(at(a, 50, 500)).toEqual(['milk']); expect(at(a, 8, 500)).toEqual(['run']); expect(at(a, 50, 485)).toEqual(['run']);
  });
  it('hover card, screen readers and agenda say what it is done during; the host\'s card lists it', () => {
    const a = fresh(blank({ people, events: [run(), milk()] }));
    expect(box(a, 'milk').getAttribute('aria-label')).toContain('During: School run');
    expect(a.ev('peekHTML(piecesAt(0,500,true,.5))')).toContain('During: School run');
    expect(a.ev('peekHTML(piecesAt(0,485,true,.5))')).toContain('Also during this: Collect milk 08:15–08:30');
    a.ev('openAgenda(0)'); expect(a.q('#agBody').textContent).toContain('During: School run');
    a.ev("setLang('es')"); expect(a.ev('peekHTML(piecesAt(0,500,true,.5))')).toContain('Durante: School run');
  });
  it('the host\'s title is escaped in the hover card and the agenda', () => {
    const a = fresh(blank({ people, events: [run({ title: '<img src=x onerror=alert(1)>' }), milk()] }));
    expect(a.ev('peekHTML(piecesAt(0,500,true,.5))')).not.toContain('<img'); a.ev('openAgenda(0)'); expect(a.q('#agBody img')).toBeNull();
  });
});

describe('R-NST-03 Moving an activity carries what is done during it', () => {
  const week = () => blank({ people, events: [
    run({ slots: [{ day: 0, start: 480, end: 510, person: 'A' }, { day: 2, start: 480, end: 510, person: 'A' }] }),
    milk({ slots: [{ day: 0, start: 495, end: 510, person: 'A' }, { day: 2, start: 495, end: 510, person: 'A' }, { day: 5, start: 540, end: 555, person: 'A' }] }),
  ] });
  it('dragging the host moves the nested activity by the same amount; Undo puts both back in one step', async () => {
    const a = fresh(blank({ people, events: [run(), milk()] })); await dragFrom(a, box(a, 'run'), { col: 0, min: 485 }, { col: 1, min: 545 });
    expect(slots(a, 'run')).toEqual([{ day: 1, start: 540, end: 570 }]); expect(slots(a, 'milk')).toEqual([{ day: 1, start: 555, end: 570 }]); expect(nested(a)).toEqual(['milk@1']);
    a.ev('undo()'); expect(slots(a, 'run')).toEqual([{ day: 0, start: 480, end: 510 }]); expect(slots(a, 'milk')).toEqual([{ day: 0, start: 495, end: 510 }]);
  });
  it('moving all repetitions carries each nested repetition; the one standing alone stays', async () => {
    const a = fresh(week()); await dragFrom(a, box(a, 'run'), { col: 0, min: 485 }, { col: 0, min: 515 });
    expect(slots(a, 'milk')).toEqual([{ day: 0, start: 525, end: 540 }, { day: 2, start: 525, end: 540 }, { day: 5, start: 540, end: 555 }]);
  });
  it('Shift moves one repetition and carries only its own nested activity; "Only this day" puts the others back', async () => {
    const a = fresh(week()); await dragFrom(a, box(a, 'run'), { col: 0, min: 485 }, { col: 0, min: 515 }, { shift: true });
    expect(slots(a, 'milk')).toEqual([{ day: 0, start: 525, end: 540 }, { day: 2, start: 495, end: 510 }, { day: 5, start: 540, end: 555 }]);
    const b = fresh(week()); await dragFrom(b, box(b, 'run'), { col: 0, min: 485 }, { col: 0, min: 515 }); toastBtn(b, 'Only this day').click();
    expect(slots(b, 'milk')).toEqual([{ day: 0, start: 525, end: 540 }, { day: 2, start: 495, end: 510 }, { day: 5, start: 540, end: 555 }]);
  });
  it('resizing the host carries nothing, and dragging the nested activity moves only it', async () => {
    const a = fresh(blank({ people, events: [run(), milk()] })), r = box(a, 'run');
    await dragFrom(a, r, { col: 0, min: 509 }, { col: 0, min: 540 }, { target: r._rz }); expect(slots(a, 'milk')).toEqual([{ day: 0, start: 495, end: 510 }]);
    await dragFrom(a, box(a, 'milk'), { col: 0, min: 500 }, { col: 0, min: 515 }); expect(slots(a, 'milk')).toEqual([{ day: 0, start: 510, end: 525 }]); expect(slots(a, 'run')).toEqual([{ day: 0, start: 480, end: 540 }]);
  });
});

describe('R-NST-04 Statistics give the shared time to the nested activity', () => {
  const types = [{ id: 'tw', name: 'Work/School', color: '#3b6df0', icon: 'school' }, { id: 'tc', name: 'Chore', color: '#e8912d', icon: 'broom' }];
  it('the minutes go to the nested activity and the host loses them; that is not overlapping time', () => {
    const s = stats(fresh(blank({ people, types, events: [run({ type: 'tw' }), milk({ type: 'tc' })] })));
    expect(s.by).toEqual({ tw: 15, tc: 15 }); expect(s.planned).toBe(30); expect(s.overlap).toBe(0);
  });
  it('without the mark the same time is split evenly and reported as overlapping', () => {
    const s = stats(fresh(blank({ people, types, events: [run({ type: 'tw' }), milk({ type: 'tc', nest: undefined })] })));
    expect(s.by).toEqual({ tw: 22.5, tc: 7.5 }); expect(s.overlap).toBe(15);
  });
});

describe('R-NST-05 The event dialog has the "can be done during" checkbox', () => {
  const open = a => a.ev('openDlg(S.events.find(e=>e.id==="milk"))');
  it('a labelled checkbox under Timing; ticking saves nest:true and unticking removes it', () => {
    const a = fresh(blank({ people, events: [milk({ nest: undefined })] })); open(a); const cb = a.q('#fNest');
    expect(cb.closest('label').textContent).toBe("Can be done during the person's other activities"); expect(cb.closest('label').title).toMatch(/^For small tasks done along the way/);
    expect(cb.checked).toBe(false); cb.checked = true; a.q('#fOk').click(); expect(a.ev('S.events[0].nest')).toBe(true);
    open(a); expect(a.q('#fNest').checked).toBe(true); a.q('#fNest').checked = false; a.q('#fOk').click(); expect(a.ev('"nest" in S.events[0]')).toBe(false);
  });
  it('the checkbox and its explanation are translated', () => {
    const a = fresh(blank({ people, events: [milk()] })); a.ev("setLang('es')"); open(a);
    expect(a.q('#fNest').closest('label').textContent).toBe('Se puede hacer durante otras actividades de la persona'); expect(a.q('#fNest').closest('label').title).toMatch(/^Para tareas pequeñas/);
  });
});
