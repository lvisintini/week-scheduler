import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, sched, person, ev1, PREFS_KEY, sleep } from '../helpers/app.js';

const fresh = (data, o = {}) => { const a = openApp(o); if (data) setData(a, data); return a; };
const tools = (a, name = 'Tools') => [...a.qa('#sbin .sec')].find(s => s.querySelector('.shbtn span').textContent === name);
const sw = (a, label = 'Show open time') => [...tools(a, label === 'Show open time' ? 'Tools' : 'Herramientas').querySelectorAll('label.zck')].find(l => l.textContent === label);
const tick = (a, v = true, label) => { const c = sw(a, label).querySelector('input'); c.checked = v; c.onchange(); };
const levels = a => [...a.qa('.seg.oplv button')].map(b => [b.textContent, b.getAttribute('aria-pressed')]);
const level = (a, name) => [...a.qa('.seg.oplv button')].find(b => b.textContent === name).click();
const mins = a => [...a.qa('.seg.opmn button')].map(b => [b.textContent, b.getAttribute('aria-pressed')]);
const atLeast = (a, name) => [...a.qa('.seg.opmn button')].find(b => b.textContent === name).click();
/** Hovers the mouse over minute min of day column col and returns the hover card's sections (event cards and the open-time card) as text. */
const hover = async (a, col, min) => { a.qa('.day')[col].onpointermove({ pointerType: 'mouse', buttons: 0, clientX: a.x(col), clientY: a.y(min) }); await sleep(420); const p = a.q('#peek'); return p.style.display === 'block' ? [...p.querySelectorAll('.pk')].map(k => k.textContent) : []; };
/** The open-time outlines of day d: [data-open, cut classes, label]. */
const outl = (a, d) => a.qa(`.day[data-d="${d}"] .opn`).map(o => [o.dataset.open, ['ct', 'cb'].filter(c => o.classList.contains(c)).join(' '), o.querySelector('span')?.textContent ?? '']);
const ppl = [person({ id: 'A', name: 'Ann' }), person({ id: 'B', name: 'Bob' }), person({ id: 'X', name: 'Cleaner', external: true })];
const types = [{ id: 'ft', name: 'Free time', color: '#ffb000', icon: 'sun', soft: true }];
const at = (day, start, end, o = {}) => ({ day, start, end, person: 'A', ...o });
const week = () => blank({ schedules: [sched(), sched({ id: 's2', name: 'Clubs', visible: false })], people: ppl, types, events: [
  ev1({ id: 'sc', title: 'School', slots: [at(0, 510, 900)] }),
  ev1({ id: 'sw', title: 'Swimming', schedules: ['s2'], slots: [at(0, 960, 1020)] }),
  ev1({ id: 'pk', title: 'Park', type: 'ft', slots: [at(0, 1080, 1200)] }),
  ev1({ id: 'wk', title: 'Work', slots: [at(0, 540, 1020, { person: 'B', fe: 30 })] }),
  ev1({ id: 'cl', title: 'Cleaning', slots: [at(0, 600, 720, { person: 'X' })] }),
  ev1({ id: 'zz', title: 'Sleep', slots: [0, 1, 2, 3, 4, 5, 6].map(d => at(d, 1380, 1860)), involved: ['B'] }),
] });

describe('R-UI-19 Open time: a Tools switch that outlines when the shown people have nothing planned', () => {
  it('the switch is in Tools after the highlight of untyped events, off at first, with an explanatory tooltip', () => {
    const a = fresh(week()), l = sw(a); expect(l.querySelector('input').checked).toBe(false);
    expect(l.previousElementSibling.textContent).toBe('Highlight events without an activity type');
    expect(l.title).toMatch(/eye is open.*every schedule, including hidden ones.*not on call.*nobody responsible.*Away.*background.*Not printed/s);
    expect(a.qa('.opn')).toHaveLength(0); expect(a.q('.seg.oplv')).toBeNull();
  });
  it('switched on it offers the three levels under it, Unplanned first and chosen, each with its tooltip', () => {
    const a = fresh(week()); tick(a);
    expect(levels(a)).toEqual([['Unplanned', 'true'], ['+ Flexible', 'false'], ['+ Free time', 'false']]);
    expect(a.q('.seg.oplv').getAttribute('role')).toBe('group'); expect(a.q('.seg.oplv').getAttribute('aria-label')).toBe('Counts as open');
    expect([...a.qa('.seg.oplv button')].map(b => b.title)).toEqual([expect.stringMatching(/nothing planned/), expect.stringMatching(/flexible start and end/), expect.stringMatching(/counts as free time/)]);
  });
  it('with everybody shown the outlines are the time when Ann and Bob are both free, the cleaner (external) not counted', () => {
    const a = fresh(week()); tick(a);
    expect(outl(a, 0)).toEqual([['420-510', '', '1 h 30'], ['1020-1080', '', '1 h'], ['1200-1380', '', '3 h']]);   // both sleep till 07:00; Ann's school from 08:30, Bob's work and Ann's swimming till 17:00
  });
  it('they follow the eyes: with only Ann shown, her open time, a hidden schedule still taking its time', () => {
    const a = fresh(week()); a.ev("state.S.people[1].visible=false;render()"); tick(a);
    expect(outl(a, 0)).toEqual([['420-510', '', '1 h 30'], ['900-960', '', '1 h'], ['1020-1080', '', '1 h'], ['1200-1380', '', '3 h']]);
    expect(a.qa('.day[data-d="0"] .ev').map(b => b._it.e.title)).not.toContain('Swimming');
  });
  it('+ Flexible frees Bob\'s flexible end of work; + Free time also frees Ann\'s Park', () => {
    const a = fresh(week()); tick(a); level(a, '+ Flexible');
    expect(a.ev('state.prefs.openLv')).toBe(2); expect(levels(a).map(x => x[1])).toEqual(['false', 'true', 'false']);
    expect(outl(a, 0)).toEqual([['420-510', '', '1 h 30'], ['1020-1080', '', '1 h'], ['1200-1380', '', '3 h']]);   // Ann's Swimming still covers 16:00–17:00
    a.ev("state.S.people[0].visible=false;render()"); expect(outl(a, 0).map(o => o[0])).toEqual(['420-540', '990-1380']);
    a.ev("state.S.people[0].visible=true;state.S.people[1].visible=false;render()"); level(a, '+ Free time');
    expect(outl(a, 0)).toEqual([['420-510', '', '1 h 30'], ['900-960', '', '1 h'], ['1020-1380', '', '6 h']]);
  });
  it('with nobody of ours shown nothing is outlined', () => {
    const a = fresh(week()); a.ev("state.S.people[0].visible=false;state.S.people[1].visible=false;render()"); tick(a); expect(a.qa('.opn')).toHaveLength(0);
  });
  it('a stretch cut by the hours shown is open at that end and still labelled with its whole length; a short one has no label', () => {
    const a = fresh(blank({ people: [ppl[0]], events: [ev1({ id: 'a', slots: [at(0, 0, 1080), at(0, 1095, 1440), ...[1, 2, 3, 4, 5, 6].map(d => at(d, 0, 1440))] })] })); tick(a);
    expect(outl(a, 0)).toEqual([['1080-1095', '', '']]);
    a.ev("state.S.events[0].slots[1].start=1320;render()"); expect(outl(a, 0)).toEqual([['1080-1320', '', '4 h']]);
    a.ev("state.prefs.hours[state.curId]=[5,20];render()"); expect(outl(a, 0)).toEqual([['1080-1320', 'cb', '4 h']]);
  });
  it('a stretch from Sunday evening to Monday morning is open at midnight on both days, each labelled with the whole stretch', () => {
    const a = fresh(blank({ people: [ppl[0]], events: [ev1({ id: 'a', slots: [at(0, 600, 1440), ...[1, 2, 3, 4, 5].map(d => at(d, 0, 1440)), at(6, 0, 1260)] })] })); tick(a);
    expect(outl(a, 6)).toEqual([['1260-1440', 'cb', '13 h']]); expect(outl(a, 0)).toEqual([['0-600', 'ct', '13 h']]);
  });
  it('the outlines are only drawn over the grid: none in Live View, in Phases mode or in print', () => {
    const a = fresh(week()); tick(a); expect(a.qa('.opn').length).toBeGreaterThan(0);
    a.ev("state.editMode='phases';render()"); expect(a.qa('.opn')).toHaveLength(0); a.ev("state.editMode='events';render()");
    a.ev('printSchedule()'); expect(a.w.__printed).not.toContain('opn');
    a.q('#lvB').click(); expect(a.ev('state.live')).toBe(true); expect(a.qa('.opn')).toHaveLength(0);
  });
  it('the outlines are decoration: hidden from assistive technology, letting the pointer through, and they change no data', () => {
    const a = fresh(week()); a.ev('saveMem("all")'); tick(a); level(a, '+ Free time');
    expect(a.qa('.opn').every(o => o.getAttribute('aria-hidden') === 'true')).toBe(true); expect(a.ev('isDirty()')).toBe(false); expect(a.ev('state.undoSt.length')).toBe(0);
    const css = a.q('style').textContent; expect(css).toContain('pointer-events:none;z-index:5;animation:opn 1.4s ease-in-out infinite}');
  });
  it('the dashed outline pulses like the highlight of untyped events, stands still for reduced motion and never prints', () => {
    const css = fresh().q('style').textContent; expect(css).toContain('border:2px dashed var(--open)'); expect(css).toContain('@keyframes opn{50%{border-color:transparent}}');
    expect(css).toContain('@media (prefers-reduced-motion:reduce){#grid .opn{animation:none}}'); expect(css).toContain('#pr .opn{display:none}@media print{.opn{display:none}}');
    expect(css).toContain('#grid .opn span{position:absolute;bottom:2px;right:4px;');   // the length sits in the bottom-right corner, clear of the titles at the top of boxes
    expect(css).toMatch(/:root\{[^}]*--open:#157a3c\}/); expect(css.match(/--open:#5fd68a/g)).toHaveLength(2);
  });
  it('the switch and the level are remembered by this browser, and a stored value that makes no sense is dropped', () => {
    const a = fresh(week()); tick(a); level(a, '+ Free time'); atLeast(a, '1 h'); tick(a, false); expect(a.q('.seg.oplv')).toBeNull(); expect(a.q('.seg.opmn')).toBeNull();
    const b = openApp({ storage: a.storage() }); expect(b.ev('[state.prefs.hlOpen,state.prefs.openLv,state.prefs.openMin]')).toEqual([false, 3, 60]);
    expect(openApp({ storage: { [PREFS_KEY]: JSON.stringify({ hlOpen: 'yes', openLv: 7, openMin: 45 }) } }).ev('[state.prefs.hlOpen,state.prefs.openLv,state.prefs.openMin]')).toEqual([false, 1, 0]);
  });
  it('the switch, its tooltip and the levels are translated', async () => {
    const a = fresh(week(), { languages: ['es'] }), l = sw(a, 'Mostrar el tiempo disponible'); expect(l.title).toMatch(/también los ocultos/);
    tick(a, true, 'Mostrar el tiempo disponible'); expect(levels(a).map(x => x[0])).toEqual(['Sin planificar', '+ Flexible', '+ Tiempo libre']); expect(a.q('.seg.oplv').getAttribute('aria-label')).toBe('Cuenta como disponible');
    expect(a.q('.opmin > span').textContent).toBe('Al menos'); expect(mins(a).map(x => x[0])).toEqual(['Cualquiera', '30 min', '1 h', '2 h']);
    a.ev('state.prefs.hlOpen=true;state.prefs.openLv=3;render()'); expect((await hover(a, 0, 1100)).at(-1)).toMatch(/^Tiempo disponible · 6 h17:00–23:00Disponible para: Ann, BobCuenta como disponible: \+ Tiempo libreCuenta como disponible aquí:Park/);
  });
  it('an activity type\'s menu says it counts as free time, and its tooltip ties it to open time', () => {
    const a = fresh(week()); expect(a.ev("L('mSoft')")).toBe('Counts as free time'); expect(a.ev("L('softTip')")).toMatch(/Show open time \(Tools\).*\+ Free time/);
  });
  it('At least offers Any, 30 min, 1 h and 2 h under the level, Any at first, and hides the shorter stretches', () => {
    const a = fresh(week()); tick(a);
    expect(a.q('.opmin > span').textContent).toBe('At least'); expect(a.q('.opmin').title).toMatch(/at least this long.*whole stretch/s);
    expect(a.q('.seg.opmn').getAttribute('aria-label')).toBe('Shortest open stretch shown'); expect(mins(a)).toEqual([['Any', 'true'], ['30 min', 'false'], ['1 h', 'false'], ['2 h', 'false']]);
    atLeast(a, '2 h'); expect(a.ev('state.prefs.openMin')).toBe(120); expect(mins(a).map(x => x[1])).toEqual(['false', 'false', 'false', 'true']);
    expect(outl(a, 0)).toEqual([['1200-1380', '', '3 h']]); atLeast(a, '1 h'); expect(outl(a, 0).map(o => o[0])).toEqual(['420-510', '1020-1080', '1200-1380']);
  });
  it('hovering empty open time shows its card: the stretch, its length, whom it is open for (not external people) and the level', async () => {
    const a = fresh(week()); tick(a);
    expect(await hover(a, 0, 1050)).toEqual(['Open time · 1 h17:00–18:00Open for: Ann, BobCounts as open: Unplanned']);
    expect(await hover(a, 0, 1000)).not.toContainEqual(expect.stringMatching(/^Open time/));   // busy: no open-time card
  });
  it('the card lists what was counted as open in the stretch: + Flexible names a flexible end', async () => {
    const a = fresh(week()); a.ev('state.S.people[0].visible=false;render()'); tick(a); level(a, '+ Flexible');
    const [card] = await hover(a, 0, 1000); expect(card).toMatch(/^Open time · 6 h 3016:30–23:00Open for: BobCounts as open: \+ FlexibleCounted as open here:Work.*09:00–17:00 · Flexible end$/);
  });
  it('over a free-time box inside a stretch, the card of the box comes first and then the open time naming it as Free time', async () => {
    const a = fresh(week()); a.ev('state.S.people[1].visible=false;render()'); tick(a); level(a, '+ Free time');
    const cards = await hover(a, 0, 1100); expect(cards).toHaveLength(2); expect(cards[0]).toMatch(/^Park/);
    expect(cards[1]).toMatch(/^Open time · 6 h17:00–23:00Open for: AnnCounts as open: \+ Free timeCounted as open here:Park.*18:00–20:00 · Free time$/);
    level(a, 'Unplanned'); const c2 = await hover(a, 0, 1100); expect(c2).toHaveLength(1);   // at Unplanned the Park is busy
  });
  it('a stretch past midnight names its days; nothing shows when the tool is off', async () => {
    const a = fresh(blank({ people: [ppl[0]], events: [ev1({ id: 'a', slots: [at(0, 600, 1440), ...[1, 2, 3, 4, 5].map(d => at(d, 0, 1440)), at(6, 0, 1260)] })] })); tick(a);
    expect(await hover(a, 0, 400)).toEqual(['Open time · 13 hSun 21:00 – Mon 10:00Open for: AnnCounts as open: Unplanned']);
    tick(a, false); expect(await hover(a, 0, 400)).toEqual([]);
  });
});
