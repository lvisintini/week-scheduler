import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, sched, person, ev1 } from '../helpers/app.js';

const app = openApp();
const ev = c => app.ev(c);

/** Event "title" is visible to the people filter when the occurrence passes slotVisible and its schedule is visible. */
const shownTitles = () => ev('state.S.events.filter(e=>visible(e)&&e.slots.some(s=>slotVisible(e,s))).map(e=>e.title).join("|")');
const setPeople = (ann, bob) => ev(`state.S.people[0].visible=${ann};state.S.people[1].visible=${bob}`);

describe('R-PPL-01 The people filter shows whose calendar you see', () => {
  const people = [person({ id: 'A', name: 'Ann' }), person({ id: 'B', name: 'Bob' })];
  const events = [
    ev1({ id: 'e1', title: 'led by Ann', involved: [], slots: [{ day: 0, start: 600, end: 660, person: 'A' }] }),
    ev1({ id: 'e2', title: 'led by Bob, Ann involved', involved: ['A'], slots: [{ day: 0, start: 600, end: 660, person: 'B' }] }),
    ev1({ id: 'e3', title: 'nobody leads, Ann involved', involved: ['A'], slots: [{ day: 0, start: 600, end: 660, person: '' }] }),
    ev1({ id: 'e4', title: 'nobody leads, nobody involved', slots: [{ day: 0, start: 600, end: 660, person: '' }] }),
    ev1({ id: 'e5', title: 'led by Bob', involved: [], slots: [{ day: 0, start: 600, end: 660, person: 'B' }] }),
  ];
  const setup = () => { setData(app, blank({ people, events })); };

  it('with everybody shown, every event is shown', () => {
    setup(); setPeople(true, true);
    expect(shownTitles().split('|')).toHaveLength(5);
  });
  it('viewing only Ann hides just the event led by Bob in which Ann is not involved', () => {
    setup(); setPeople(true, false);
    expect(shownTitles()).toBe('led by Ann|led by Bob, Ann involved|nobody leads, Ann involved|nobody leads, nobody involved');
  });
  it('viewing only Bob hides the event led by Ann (Bob is not involved) and nothing else', () => {
    setup(); setPeople(false, true);
    expect(shownTitles()).toBe('led by Bob, Ann involved|nobody leads, Ann involved|nobody leads, nobody involved|led by Bob');
  });
  it('with nobody shown, only events without a responsible person remain', () => {
    setup(); setPeople(false, false);
    expect(shownTitles()).toBe('nobody leads, Ann involved|nobody leads, nobody involved');
  });
  it('an event without a responsible person is always shown, even when all its involved people are hidden', () => {
    setup(); setPeople(false, false);
    expect(ev('slotVisible(state.S.events[2],state.S.events[2].slots[0])')).toBe(true);
  });
  it('the rule is applied per repetition, because each repetition has its own responsible person', () => {
    setData(app, blank({ people, events: [ev1({ title: 'split', slots: [{ day: 0, start: 600, end: 660, person: 'A' }, { day: 1, start: 600, end: 660, person: 'B' }] })] }));
    setPeople(true, false);
    expect(ev('state.S.events[0].slots.map(s=>slotVisible(state.S.events[0],s))')).toEqual([true, false]);
  });
  it('a hidden schedule hides its events whatever the people filter says', () => {
    setup(); setPeople(true, true); ev('state.S.schedules[0].visible=false');
    expect(shownTitles()).toBe('');
  });
});

describe('R-SCH-02 Locked schedules', () => {
  const lockedData = (a, b) => blank({ schedules: [sched({ id: 'a', locked: a }), sched({ id: 'b', locked: b })], events: [ev1({ schedules: ['a', 'b'] })] });
  it('an event in a single locked schedule is locked', () => {
    setData(app, blank({ schedules: [sched({ locked: true })], events: [ev1()] }));
    expect(ev('isLocked(state.S.events[0])')).toBe(true);
  });
  it('an event shared by two schedules is locked only when both are locked', () => {
    setData(app, lockedData(true, true)); expect(ev('isLocked(state.S.events[0])')).toBe(true);
    setData(app, lockedData(true, false)); expect(ev('isLocked(state.S.events[0])')).toBe(false);
    setData(app, lockedData(false, true)); expect(ev('isLocked(state.S.events[0])')).toBe(false);
  });
  it('locked events are click-through boxes (they cannot be grabbed) and show a lock icon', () => {
    setData(app, blank({ schedules: [sched({ locked: true })], events: [ev1()] }));
    const box = app.q('.day[data-d="0"] .ev');
    expect(box.classList.contains('locked')).toBe(true);
    expect(box.onpointerdown).toBeFalsy();
    expect(box.querySelector('.flags svg')).not.toBeNull();
  });
});

describe('R-EVT-08 Event opacity is the highest opacity among its visible schedules', () => {
  const op = (aOp, aVis, bOp, bVis) => {
    setData(app, blank({ schedules: [sched({ id: 'a', opacity: aOp, visible: aVis }), sched({ id: 'b', opacity: bOp, visible: bVis })], events: [ev1({ schedules: ['a', 'b'] })] }));
    return ev('evOp(state.S.events[0])');
  };
  it('uses the larger of the two when both schedules are visible', () => { expect(op(0.4, true, 0.8, true)).toBe(0.8); });
  it('ignores the opacity of a hidden schedule', () => { expect(op(0.3, true, 1, false)).toBe(0.3); });
  it('event opacity never drops below 10 % even when schedules are set lower', () => { expect(op(0.1, true, 0.1, true)).toBeGreaterThanOrEqual(0.1); });
  it('is applied to the drawn event box', () => {
    setData(app, blank({ schedules: [sched({ opacity: 0.5 })], events: [ev1()] }));
    expect(app.q('.day[data-d="0"] .ev').style.opacity).toBe('0.5');
  });
});

describe('R-PHS-02 Only one rhythm can be shown at a time', () => {
  const rh = (a, b) => blank({ rhythms: [{ id: 'r1', name: 'One', visible: a }, { id: 'r2', name: 'Two', visible: b }] });
  it('loading data in which several rhythms are visible keeps only the first visible', () => {
    expect(ev(`parseData(${JSON.stringify(rh(true, true))}).rhythms.map(r=>r.visible)`)).toEqual([true, false]);
  });
  it('showing a rhythm through its eye hides the others', () => {
    setData(app, rh(true, false));
    app.qa('#sbin .sec')[3].querySelectorAll('.sch')[1].querySelector('.eye').click();
    expect(ev('state.S.rhythms.map(r=>r.visible)')).toEqual([false, true]);
  });
  it('clicking the eye of the visible rhythm hides it, leaving none visible', () => {
    setData(app, rh(true, false));
    app.qa('#sbin .sec')[3].querySelectorAll('.sch')[0].querySelector('.eye').click();
    expect(ev('state.S.rhythms.every(r=>!r.visible)')).toBe(true);
  });
});

describe('R-GRID-09 The "N hidden" pill counts only what is hidden purely by the hours or the days not shown', () => {
  const hidden = (events, prefs = '') => {
    setData(app, blank({ events }));
    ev(`state.prefs.hours={};state.prefs.days={};${prefs};render()`);
    return ev('hiddenInfo()');
  };
  const at = (day, start, end, extra = {}) => ev1({ id: `e-${day}-${start}`, slots: [{ day, start, end, person: '' }], ...extra });
  it('an event entirely before 05:00 is counted while early hours are hidden', () => {
    expect(hidden([at(0, 120, 240)]).er).toBe(1);
  });
  it('an event that is only partly before 05:00 is still partly visible and is not counted', () => {
    expect(hidden([at(0, 240, 360)]).n).toBe(0);
  });
  it('an event on Saturday is counted while only Monday to Friday are shown', () => {
    expect(hidden([at(5, 600, 660)], 'state.prefs.days[state.curId]=[0,4]').wk).toBe(1);
  });
  it('an overnight event from Friday to Saturday is partly visible (Friday) and is not counted', () => {
    expect(hidden([at(4, 1320, 1560)], 'state.prefs.days[state.curId]=[0,4]').n).toBe(0);
  });
  it('an overnight event from Saturday to Sunday is hidden completely and is counted', () => {
    expect(hidden([at(5, 1320, 1560)], 'state.prefs.days[state.curId]=[0,4]').wk).toBe(1);
  });
  it('an event hidden by the people filter is not counted', () => {
    setData(app, blank({ people: [person({ id: 'A' }), person({ id: 'B', name: 'Bob' })], events: [ev1({ slots: [{ day: 0, start: 120, end: 240, person: 'B' }] })] }));
    ev('state.S.people[1].visible=false;render()');
    expect(ev('hiddenInfo().n')).toBe(0);
  });
  it('an event entirely after the end of the hours shown is counted, one only partly after it is not', () => {
    expect(hidden([at(0, 1080, 1140)], 'state.prefs.hours[state.curId]=[8,17]').er).toBe(1);
    expect(hidden([at(0, 960, 1080)], 'state.prefs.hours[state.curId]=[8,17]').n).toBe(0);
  });
  it('nothing is counted once every hour and every day are shown again', () => {
    expect(hidden([at(0, 120, 240), at(5, 600, 660)], 'state.prefs.hours[state.curId]=[0,24]').n).toBe(0);
  });
  it('phases are never counted as hidden events, even on days not shown', () => {
    setData(app, blank({ rhythms: [{ id: 'r', name: 'R', visible: true }], phases: [{ id: 'p', title: 'Sleep', desc: '', color: '#3b6df0', rhythms: ['r'], slots: [{ day: 0, start: 0, end: 120 }] }] }));
    expect(ev('hiddenInfo().n')).toBe(0);
  });
  it('the pill is visible with the number and its tooltip lists the days-not-shown and the hours-not-shown counts', () => {
    hidden([at(0, 120, 240), at(5, 600, 660)], 'state.prefs.days[state.curId]=[0,4]');
    const pill = app.q('#hid');
    expect(pill.style.display).not.toBe('none'); expect(pill.textContent).toBe('2 hidden');
    expect(pill.title).toMatch(/1 on the days not shown/); expect(pill.title).toMatch(/1 outside the hours shown/); expect(pill.title).toMatch(/change the hours shown/);
  });
  it('clicking the pill opens View on the start knob of the hours shown; with only days hiding something, on the first-day knob', () => {
    hidden([at(0, 120, 240)], 'state.prefs.secZoom=true;state.prefs.collapsed=true;applyPrefs();renderSide()'); app.q('#hid').click();
    expect(ev('[state.prefs.collapsed,state.prefs.secZoom]')).toEqual([false, false]); expect(app.d.activeElement).toBe(app.qa('#sbin .zhrs .hrs2 input')[0]); expect(app.dlgOpen()).toBeFalsy();
    hidden([at(5, 600, 660)], 'state.prefs.days[state.curId]=[0,4];state.prefs.secZoom=true;renderSide()'); expect(app.q('#hid').title).toMatch(/change the days shown/); app.q('#hid').click();
    expect(ev('state.prefs.secZoom')).toBe(false); expect(app.d.activeElement).toBe(app.qa('#sbin .zdays .hrs2 input')[0]); expect(app.dlgOpen()).toBeFalsy();
  });
  it('the pill disappears when nothing is hidden', () => {
    hidden([at(0, 600, 660)]); expect(app.q('#hid').style.display).toBe('none');
  });
});
