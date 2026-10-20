import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, ev1, person, fillDialog } from '../helpers/app.js';

const fresh = data => { const a = openApp(); if (data) setData(a, data); return a; };
const people = [person({ id: 'A', name: 'Ann', color: '#e5484d' }), person({ id: 'B', name: 'Bob', color: '#2fa66a' }), person({ id: 'C', name: 'Cy', color: '#8e4ec6' }), person({ id: 'X', name: 'Cleaner', color: '#12a5b5', external: true })];
const events = a => a.ev('JSON.parse(JSON.stringify(S.events))');
const save = a => a.q('#fOk').click();
const row = (a, d) => a.qa('#fDays .dr')[d];
const perf = (a, d) => row(a, d).querySelectorAll('select')[2];
const change = (a, el, v) => { el.value = v; el.dispatchEvent(new a.w.Event('change')); };
const tick = (a, d) => { const cb = row(a, d).querySelector('input'); cb.checked = true; cb.onchange(); };
const parse = (a, d) => a.ev(`parseData(${JSON.stringify(d)})`);

describe('R-EVT-20 An event has an owner (who owns its conception, planning and execution) who performs it by default; any day can have someone stepping in', () => {
  it('the owner is chosen in the dialog; days "Performed by: Owner" follow it, a stand-in stays', () => {
    const a = fresh(blank({ people })); a.toolbar('add').click(); fillDialog(a, { title: 'School run', person: 'A' }); tick(a, 1); tick(a, 2); change(a, perf(a, 2), 'B'); save(a);
    expect(events(a)[0].owner).toBe('A'); expect(events(a)[0].slots.map(s => [s.person, !!s.fo])).toEqual([['A', true], ['A', true], ['B', false]]);
    a.ev('openDlg(S.events[0])'); change(a, a.q('#fOw'), 'C'); save(a);
    expect(events(a)[0].slots.map(s => s.person)).toEqual(['C', 'C', 'B']);   // reassigning the card moves every day the owner performs
  });
  it('without an owner the "Owner" days are performed by nobody; choosing an owner later fills them', () => {
    const a = fresh(blank({ people })); a.toolbar('add').click(); fillDialog(a, { title: 'T' }); save(a); expect(events(a)[0]).not.toHaveProperty('owner');
    expect(events(a)[0].slots[0]).toMatchObject({ person: '', fo: true });
    a.ev('openDlg(S.events[0])'); expect(perf(a, 0).value).toBe('@o'); expect(perf(a, 0).selectedOptions[0].textContent).toBe('Owner (nobody yet)');
    change(a, a.q('#fOw'), 'B'); expect(perf(a, 0).selectedOptions[0].textContent).toBe('Owner (Bob)'); save(a); expect(events(a)[0].slots[0].person).toBe('B');
  });
  it('only our people can own an event; an owner who later became external is kept and marked', () => {
    const a = fresh(blank({ people })); a.toolbar('add').click(); expect([...a.q('#fOw').options].map(o => o.value)).toEqual(['', 'A', 'B', 'C']);
    const b = fresh(blank({ people, events: [ev1({ owner: 'X', slots: [{ day: 0, start: 600, end: 660, person: 'X', fo: true }] })] })); b.ev('openDlg(S.events[0])');
    expect(b.q('#fOw').value).toBe('X'); expect(b.q('#fOw').selectedOptions[0].textContent).toBe('Cleaner (external)');
  });
  it('import keeps the owner only when it names a person, and a day that follows the owner always has the owner as performer', () => {
    const a = fresh(); const d = parse(a, { schedules: [], people: [{ id: 'A', name: 'Ann' }], events: [
      { id: 'x', schedules: [], owner: 'A', slots: [{ day: 0, start: 0, end: 60, person: 'B', fo: true }, { day: 1, start: 0, end: 60, person: 'B', fo: 1 }] },
      { id: 'y', schedules: [], owner: 'nobody-here', slots: [{ day: 0, start: 0, end: 60, person: '', fo: true }] }] });
    expect(d.events[0].owner).toBe('A'); expect(d.events[0].slots.map(s => [s.person, s.fo])).toEqual([['A', true], ['B', undefined]]);
    expect(d.events[1].owner).toBeUndefined(); expect(d.events[1].slots[0]).toMatchObject({ person: '', fo: true });
  });
  it('deleting the owner leaves the event unowned and its owner days with nobody, still following the next owner', () => {
    const a = fresh(blank({ people, events: [ev1({ owner: 'A', slots: [{ day: 0, start: 600, end: 660, person: 'A', fo: true }, { day: 1, start: 600, end: 660, person: 'B' }] })] }));
    a.ev('delPerson(S.people[0])'); expect(events(a)[0]).not.toHaveProperty('owner'); expect(events(a)[0].slots.map(s => [s.person, !!s.fo])).toEqual([['', true], ['B', false]]);
  });
  it('inserting a workspace maps the owner to the newly added person', () => {
    const a = fresh(blank({ people: [] }));
    a.ev(`insertInto(parseData(${JSON.stringify(blank({ people: [people[0], people[1]], events: [ev1({ owner: 'A', involved: ['B'], slots: [{ day: 0, start: 600, end: 660, person: 'A', fo: true, inv: ['A'] }] })] }))}))`);
    const e = events(a)[0], ids = a.ev('Object.fromEntries(S.people.map(q=>[q.name,q.id]))');
    expect(e.owner).toBe(ids.Ann); expect(e.slots[0]).toMatchObject({ person: ids.Ann, fo: true, inv: [ids.Ann] }); expect(e.involved).toEqual([ids.Bob]);
  });
  it('copying a schedule to another workspace maps the owner through the people dialog', async () => {
    const a = fresh(blank({ people, events: [ev1({ owner: 'A', slots: [{ day: 0, start: 600, end: 660, person: 'A', fo: true }] })] }));
    a.ev("const t=newWs('Target',defaultData(),true);t.data.people=[];WS.push(t);render()");
    a.ev('openTransfer("schedule",S.schedules[0])'); a.click('Continue'); await a.sleep(20); expect(a.dlgTitle()).toBe('People'); a.click('Continue'); await a.sleep(20);
    const t = a.ev('JSON.parse(JSON.stringify(WS[1].data))'), ann = t.people.find(q => q.name === 'Ann');
    expect(t.events[0].owner).toBe(ann.id); expect(t.events[0].slots[0]).toMatchObject({ person: ann.id, fo: true });
  });
  it('the hover card, agenda and screen readers name the owner; in Spanish "Titular:"', () => {
    const a = fresh(blank({ people, events: [ev1({ title: 'Laundry', owner: 'A', slots: [{ day: 0, start: 600, end: 660, person: 'B' }] })] }));
    expect(a.q('.ev').getAttribute('aria-label')).toContain('By: Bob'); expect(a.q('.ev').getAttribute('aria-label')).toContain('Owner: Ann');
    expect(a.ev('peekHTML(piecesAt(0,630,true))')).toContain('Owner:'); a.ev('openAgenda(0)'); expect(a.q('#agBody').textContent).toContain('Owner: Ann');
    a.ev("setLang('es')"); expect(a.q('.ev').getAttribute('aria-label')).toContain('Titular: Ann');
  });
  it('clashes follow who performs each day, never the owner', () => {
    const a = fresh(blank({ people, events: [ev1({ id: 'w', title: 'Work', slots: [{ day: 0, start: 540, end: 720, person: 'A' }] }), ev1({ id: 'l', title: 'Laundry', owner: 'A', slots: [{ day: 0, start: 600, end: 660, person: 'B' }] })] }));
    expect(a.qa('.ov')).toHaveLength(0); expect(a.qa('.ev').map(b => b.dataset.lane)).toEqual(['0/2', '1/2']);   // Ann owns the laundry, Bob does it: side by side
  });
});

describe('R-EVT-21 Involved people: the event has a default list, and a day can have its own', () => {
  const two = (inv0) => blank({ people, events: [ev1({ id: 'm', title: 'Meeting', involved: ['B'], slots: [{ day: 0, start: 600, end: 660, person: 'A', ...(inv0 ? { inv: inv0 } : {}) }] }), ev1({ id: 'g', title: 'Gym', slots: [{ day: 0, start: 600, end: 660, person: 'B' }] })] });
  it('the day\'s own list decides the clashes: without Bob that day the two events sit side by side', () => {
    expect(fresh(two()).qa('.ov').length).toBeGreaterThan(0);
    const a = fresh(two([])); expect(a.qa('.ov')).toHaveLength(0); expect(a.qa('.ev').map(b => b.dataset.lane)).toEqual(['0/2', '1/2']);
  });
  it('labels, the hover card and the agenda show the day\'s own list', () => {
    const a = fresh(two(['C'])); const b = a.qa('.ev').find(x => x._it.e.id === 'm');
    expect(b.querySelector('.wi').textContent).toBe('With: Cy'); expect(a.ev('peekHTML(piecesAt(0,630,true,.25))')).toContain('Cy'); a.ev('openAgenda(0)'); expect(a.q('#agBody').textContent).toContain('With: Cy');
  });
  it('the people filter and the statistics use the day\'s own list', () => {
    const a = fresh({ ...two(['C']), people: [{ ...people[0], visible: false }, { ...people[1], visible: false }, people[2], people[3]] });
    expect(a.qa('.ev').map(b => b._it.e.id)).toEqual(['m']);   // Cy is involved that day only through the day's own list
    expect(a.ev('personStats("C",true).planned')).toBe(60); expect(a.ev('personStats("B",true).planned')).toBe(60);   // Bob: only his gym
  });
  it('a day\'s list equal to the default is not stored; an empty list means nobody that day', () => {
    const d = parse(fresh(), { schedules: [], events: [{ id: 'x', schedules: [], involved: ['B'], slots: [{ day: 0, start: 0, end: 60, inv: ['B'] }, { day: 1, start: 0, end: 60, inv: [] }, { day: 2, start: 0, end: 60, inv: 'B' }] }] });
    expect(d.events[0].slots.map(s => s.inv)).toEqual([undefined, [], undefined]);
  });
  it('the With button shows "Default"; its popover gives the day its own list, saved with the day', () => {
    const a = fresh(two()); a.ev('openDlg(S.events[0])'); const wb = row(a, 0).querySelector('.wbtn');
    expect(wb.textContent).toBe('Default'); expect(wb.classList.contains('def')).toBe(true); expect(wb.title).toContain('Bob'); wb.click();
    const sw = a.q('.wpop .wdef input'); expect(sw.checked).toBe(true); expect(a.qa('.wpop .chips input').every(i => i.disabled)).toBe(true);
    sw.checked = false; sw.onchange(); const cy = a.qa('.wpop .chips input').find(i => i.value === 'C'); cy.checked = true; cy.onchange();
    expect(wb.textContent).toBe('Bob, Cy'); save(a); expect(events(a)[0].slots[0].inv).toEqual(['B', 'C']);
  });
  it('"only on call" is offered while a day has its own involved people, even with an empty default', () => {
    const a = fresh(blank({ people, events: [ev1({ slots: [{ day: 0, start: 600, end: 660, person: 'A', inv: ['B'] }] })] })); a.ev('openDlg(S.events[0])'); expect(a.q('#fOcRow').style.display).toBe('');
  });
  it('the copy button gives every other ticked day the same performer and own list', () => {
    const a = fresh(blank({ people, events: [ev1({ owner: 'A', slots: [{ day: 0, start: 600, end: 660, person: 'B', inv: ['C'] }, { day: 2, start: 600, end: 660, person: 'A', fo: true }] })] }));
    a.ev('openDlg(S.events[0])'); row(a, 0).querySelector('.cpy').click(); save(a); expect(events(a)[0].slots.map(s => [s.person, s.inv])).toEqual([['B', ['C']], ['B', ['C']]]);
  });
  it('deleting a person removes them from the days\' own lists', () => {
    const a = fresh(two(['B', 'C'])); a.ev('delPerson(S.people.find(q=>q.id==="C"))'); expect(events(a)[0].slots[0].inv).toEqual(['B']);
  });
});

describe('R-DATA-08 R-EVT-20 Upgrading to version 5 guesses an owner', () => {
  const a = openApp(), up = (events, ppl = people) => JSON.parse(a.ev(`JSON.stringify(MIG[4](${JSON.stringify({ people: ppl, events })}).events)`));
  const e = slots => ({ id: 'e', involved: [], slots: slots.map(([day, person]) => ({ day, start: 600, end: 660, person })) });
  it('the most frequent performer among our people becomes the owner, and the days they perform follow the owner', () => {
    const [x] = up([e([[0, 'B'], [1, 'A'], [2, 'B']])]); expect(x.owner).toBe('B'); expect(x.slots.map(s => !!s.fo)).toEqual([true, false, true]);
  });
  it('a tie goes to the earliest repetition; external people and nobody are never guessed', () => {
    expect(up([e([[0, 'A'], [1, 'B']])])[0].owner).toBe('A'); expect(up([e([[0, 'X'], [1, 'X'], [2, 'C']])])[0].owner).toBe('C');
    const [n] = up([e([[0, ''], [1, 'X']])]); expect(n.owner).toBeUndefined(); expect(n.slots.some(s => s.fo)).toBe(false);
  });
});
