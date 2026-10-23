// Cycles of several weeks (docs/requirements/cycle.md): the stored shape and its validation.
import { describe, it, expect } from 'vitest';
import { openApp, blank, ev1 } from '../helpers/app.js';

const app = openApp();
const parse = (obj, strict = false) => app.ev(`parseData(${JSON.stringify(obj)},${strict})`);
const sl = (o = {}) => ({ day: 0, start: 600, end: 660, person: '', ...o });

describe('R-CYC-14 The cycle length is stored on the workspace and validated', () => {
  it.each([[undefined, 1], [1, 1], [2, 2], [4, 4], [7, 4], [0, 1], [-2, 1], [2.5, 1], ['3', 3], ['x', 1], [null, 1]])(
    'a stored cycle of %j weeks is read as %i', (cycle, n) => {
      expect(parse(blank({ cycle })).cycle).toBe(n);
    });
  it('a cycle of one week is not written to files, a longer one is', () => {
    const a = openApp();
    expect(a.ev('buildFile()')).not.toHaveProperty('cycle');
    a.ev('state.S.cycle=3'); expect(a.ev('buildFile().cycle')).toBe(3);
  });
  it('the cycle length is data: changing it counts as an unsaved change', () => {
    const a = openApp(); a.ev("cw().lb=keyOf(state.S)"); expect(a.ev('anyDirty()')).toBe(false);
    a.ev('state.S.cycle=2'); expect(a.ev('anyDirty()')).toBe(true);
  });
  it('R-CYC-16 phases carry weeks with the rules of events: a per-repetition phase drops its pattern, weeks beyond the cycle go', () => {
    const ph = o => ({ id: 'p', title: 'P', rhythms: ['r'], ...o });
    const d = parse(blank({ cycle: 2, rhythms: [{ id: 'r', name: 'R', visible: true }], phases: [ph({ weeks: [1], slots: [{ day: 0, start: 600, end: 660, wk: 2 }, { day: 1, start: 600, end: 660 }, { day: 2, start: 600, end: 660, wk: 3 }] }), ph({ id: 'q', weeks: [2, 9], slots: [{ day: 0, start: 600, end: 660 }] }), ph({ id: 'z', weeks: [1, 2], slots: [{ day: 0, start: 600, end: 660 }] })] }));
    expect(d.phases[0]).not.toHaveProperty('weeks'); expect(d.phases[0].slots.map(x => x.wk)).toEqual([2, 1]); expect(d.phases[1].weeks).toEqual([2]); expect(d.phases[2]).not.toHaveProperty('weeks');
  });
  it('R-CYC-16 at a cycle of one week a phase keeps no weeks; a phase left without occurrences is dropped', () => {
    const d = parse(blank({ rhythms: [{ id: 'r', name: 'R', visible: true }], phases: [{ id: 'p', title: 'P', rhythms: ['r'], slots: [{ day: 0, start: 600, end: 660, wk: 1 }] }, { id: 'q', title: 'Q', rhythms: ['r'], slots: [{ day: 0, start: 600, end: 660, wk: 2 }] }] }));
    expect(d.phases).toHaveLength(1); expect(d.phases[0].slots[0]).not.toHaveProperty('wk');
  });
});

describe('R-CYC-02 An event\'s week pattern: absent means every week', () => {
  const evOf = (weeks, cycle = 4) => parse(blank({ cycle, events: [ev1({ weeks })] })).events[0];
  it('an event without a pattern happens every week and stays that way', () => {
    expect(evOf(undefined)).not.toHaveProperty('weeks');
  });
  it('a pattern is kept sorted and without repeated weeks', () => {
    expect(evOf([3, 1, 3]).weeks).toEqual([1, 3]);
  });
  it('a pattern naming every week of the cycle is stored as absent (every week)', () => {
    expect(evOf([1, 2], 2)).not.toHaveProperty('weeks'); expect(evOf([2, 1, 3, 4])).not.toHaveProperty('weeks');
  });
  it('weeks beyond the cycle and values that are not week numbers are dropped from the pattern', () => {
    expect(evOf([1, 5, 0, 'x', 2.5, 3], 3).weeks).toEqual([1, 3]);
  });
  it('an event whose pattern names no week of the cycle is dropped, like an event without repetitions', () => {
    expect(parse(blank({ cycle: 2, events: [ev1({ weeks: [3] }), ev1({ id: 'ok' })] })).events.map(e => e.id)).toEqual(['ok']);
    expect(parse(blank({ cycle: 2, events: [ev1({ weeks: [] })] })).events).toHaveLength(0);
  });
  it('at a cycle of one week every pattern collapses to every week', () => {
    expect(evOf([1], 1)).not.toHaveProperty('weeks');
  });
});

describe('R-CYC-03 Weeks per repetition: the mode is inferred from the repetitions and normalised', () => {
  const evOf = (slots, o = {}, cycle = 2) => parse(blank({ cycle, events: [ev1({ slots, ...o })] })).events[0];
  it('repetitions that carry a week keep it and the event has no pattern', () => {
    const e = evOf([sl({ wk: 1 }), sl({ wk: 2, day: 1 })], { weeks: [1] });
    expect(e.slots.map(s => s.wk)).toEqual([1, 2]); expect(e).not.toHaveProperty('weeks');
  });
  it('in an event with weeks per repetition, a repetition without a week is put in week 1', () => {
    expect(evOf([sl({ wk: 2 }), sl({ day: 1 })]).slots.map(s => s.wk)).toEqual([2, 1]);
  });
  it('repetitions in a week beyond the cycle are dropped, and the event with them when none is left', () => {
    expect(evOf([sl({ wk: 3 }), sl({ wk: 2, day: 3 })]).slots.map(s => s.day)).toEqual([3]);
    expect(parse(blank({ cycle: 2, events: [ev1({ slots: [sl({ wk: 4 })] })] })).events).toHaveLength(0);
  });
  it('week numbers written as text are read as numbers, and impossible ones as week 1', () => {
    expect(evOf([sl({ wk: '2' }), sl({ wk: 0, day: 1 }), sl({ wk: 'x', day: 2 })]).slots.map(s => s.wk)).toEqual([2, 1, 1]);
  });
  it('at a cycle of one week the repetitions carry no week at all', () => {
    expect(evOf([sl({ wk: 1 }), sl({ wk: 1, day: 2 })], {}, 1).slots.every(s => !('wk' in s))).toBe(true);
  });
});

describe('R-EVT-24 Away is stored as a mark that excludes In the background', () => {
  const evOf = o => parse(blank({ events: [ev1(o)] })).events[0];
  it('the Away mark is kept only when it is exactly true', () => {
    expect(evOf({ away: true }).away).toBe(true); expect(evOf({ away: 'yes' })).not.toHaveProperty('away'); expect(evOf({})).not.toHaveProperty('away');
  });
  it('an event marked both In the background and Away keeps only In the background', () => {
    const e = evOf({ away: true, bg: true }); expect(e.bg).toBe(true); expect(e).not.toHaveProperty('away');
  });
});
