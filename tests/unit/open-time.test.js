import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, sched, person, ev1 } from '../helpers/app.js';

const app = openApp();
const ev = c => app.ev(c);
const people = [person({ id: 'A', name: 'Ann' }), person({ id: 'B', name: 'Bob' })];
const scheds = [sched(), sched({ id: 's2', name: 'Hidden', visible: false })];
const load = (events, o = {}) => setData(app, blank({ schedules: scheds, people, events, ...o }));
/** The open pieces of day di of week w for the people pids at level lv, as [start, end] (minutes of the day). */
const open = (pids, lv, di, w = 1, min = 0) => ev(`(o=>o&&o.day(${w},${di}).map(x=>[x.a,x.b]))(openTime(${JSON.stringify(pids)},${lv},${min}))`);
const pieces = (pids, lv, di, w = 1) => ev(`openTime(${JSON.stringify(pids)},${lv}).day(${w},${di}).map(({st,...o})=>o)`);
/** What was counted as open in the stretch open at minute m of day di: [title, why]. */
const items = (pids, lv, di, m) => ev(`openTime(${JSON.stringify(pids)},${lv}).at(1,${di},${m}).items.map(z=>[z.e.title,z.why])`);
const at = (day, start, end, o = {}) => ({ day, start, end, person: 'A', ...o });

describe('R-UI-19 Open time: when the people shown all have nothing planned, counting every schedule', () => {
  it('without anybody to look for there is no open time to show at all', () => {
    load([]); expect(open([], 1, 0)).toBeNull();
  });
  it('a week with nothing planned is one open stretch of the whole week, going on through every midnight', () => {
    load([]); expect(pieces(['A'], 1, 2)).toEqual([{ a: 0, b: 1440, len: 10080, ct: true, cb: true }]);
  });
  it('an event of a hidden schedule takes the time just like a shown one (the grid filters play no part)', () => {
    load([ev1({ id: 'h', schedules: ['s2'], slots: [at(0, 600, 660)] })]); expect(open(['A'], 1, 0)).toEqual([[0, 600], [660, 1440]]);
  });
  it('an activity type whose eye is closed still takes the time', () => {
    load([ev1({ id: 't', type: 'ty', slots: [at(0, 600, 660)] })], { types: [{ id: 'ty', name: 'Work', color: '#aa5500', icon: 'dot', visible: false }] });
    expect(open(['A'], 1, 0)).toEqual([[0, 600], [660, 1440]]);
  });
  it('with two people, the time is open only where both of them have nothing planned', () => {
    load([ev1({ id: 'a', slots: [at(0, 600, 660)] }), ev1({ id: 'b', slots: [at(0, 720, 780, { person: 'B' })] })]);
    expect(open(['A', 'B'], 1, 0)).toEqual([[0, 600], [660, 720], [780, 1440]]);
    expect(open(['A'], 1, 0)).toEqual([[0, 600], [660, 1440]]); expect(open(['B'], 1, 0)).toEqual([[0, 720], [780, 1440]]);
  });
  it('being involved takes the time, being only on call does not (on call is available, not busy)', () => {
    load([ev1({ id: 'i', involved: ['A'], slots: [at(0, 600, 660, { person: 'B' })] })]); expect(open(['A'], 1, 0)).toEqual([[0, 600], [660, 1440]]);
    load([ev1({ id: 'i', involved: ['A'], oncall: true, slots: [at(0, 600, 660, { person: 'B' })] })]); expect(open(['A'], 1, 0)).toEqual([[0, 1440]]);
  });
  it('a time involving someone through its own With list follows that day\'s list', () => {
    load([ev1({ id: 'i', involved: ['A'], slots: [at(0, 600, 660, { person: 'B', inv: [] })] })]); expect(open(['A'], 1, 0)).toEqual([[0, 1440]]);
  });
  it('an event with nobody responsible takes everybody\'s time, like the clash rule', () => {
    load([ev1({ id: 'n', slots: [at(0, 600, 660, { person: '' })] })]); expect(open(['A'], 1, 0)).toEqual([[0, 600], [660, 1440]]); expect(open(['B'], 1, 0)).toEqual([[0, 600], [660, 1440]]);
  });
  it('an activity of another person leaves the time open', () => {
    load([ev1({ id: 'o', slots: [at(0, 600, 660, { person: 'B' })] })]); expect(open(['A'], 1, 0)).toEqual([[0, 1440]]);
  });
  it('In the background takes nobody\'s time, even with nobody responsible', () => {
    load([ev1({ id: 'g', bg: true, slots: [at(0, 600, 660)] }), ev1({ id: 'g2', bg: true, slots: [at(0, 700, 760, { person: '' })] })]); expect(open(['A'], 1, 0)).toEqual([[0, 1440]]);
  });
  it('Away takes the time of everyone away (who performs it and who is involved), on call or not', () => {
    load([ev1({ id: 'w', away: true, oncall: true, involved: ['B'], slots: [at(0, 600, 660)] })]);
    expect(open(['A'], 1, 0)).toEqual([[0, 600], [660, 1440]]); expect(open(['B'], 1, 0)).toEqual([[0, 600], [660, 1440]]);
  });
  it('Unplanned counts flexible margins and "around these times" as busy; + Flexible leaves only the cores busy', () => {
    load([ev1({ id: 'f', slots: [at(0, 540, 1020, { fs: 30, fe: 15 })] }), ev1({ id: 'r', slots: [at(1, 600, 660, { flex: true })] })]);
    expect(open(['A'], 1, 0)).toEqual([[0, 540], [1020, 1440]]); expect(open(['A'], 2, 0)).toEqual([[0, 570], [1005, 1440]]);
    expect(open(['A'], 1, 1)).toEqual([[0, 600], [660, 1440]]); expect(open(['A'], 2, 1)).toEqual([[0, 1440]]);
  });
  it('+ Free time also leaves open the events whose activity type counts as free time; the lower levels do not', () => {
    load([ev1({ id: 'p', type: 'ft', slots: [at(0, 600, 720)] }), ev1({ id: 'f', slots: [at(1, 540, 600, { fs: 15 })] })], { types: [{ id: 'ft', name: 'Free time', color: '#ffb000', icon: 'sun', soft: true }] });
    expect(open(['A'], 1, 0)).toEqual([[0, 600], [720, 1440]]); expect(open(['A'], 2, 0)).toEqual([[0, 600], [720, 1440]]); expect(open(['A'], 3, 0)).toEqual([[0, 1440]]);
    expect(open(['A'], 3, 1)).toEqual([[0, 555], [600, 1440]]);   // the level includes + Flexible
  });
  it('Away with a free-time type still takes the time at + Free time (being away is not free time)', () => {
    load([ev1({ id: 'w', away: true, type: 'ft', slots: [at(0, 600, 660)] })], { types: [{ id: 'ft', name: 'Free time', color: '#ffb000', icon: 'sun', soft: true }] });
    expect(open(['A'], 3, 0)).toEqual([[0, 600], [660, 1440]]);
  });
  it('with a cycle, each week has its own open time', () => {
    load([ev1({ id: 'c', weeks: [2], slots: [at(0, 600, 660)] })], { cycle: 2 });
    expect(open(['A'], 1, 0, 1)).toEqual([[0, 1440]]); expect(open(['A'], 1, 0, 2)).toEqual([[0, 600], [660, 1440]]);
  });
  it('a stretch past midnight is one stretch: both pieces carry its whole length and say where it goes on', () => {
    load([ev1({ id: 's', slots: [at(6, 1200, 1260), at(0, 600, 660)] })]);
    expect(pieces(['A'], 1, 6)).toEqual([{ a: 0, b: 1200, len: 8640 - 660 + 1200, ct: true, cb: false }, { a: 1260, b: 1440, len: 780, ct: false, cb: true }]);
    expect(pieces(['A'], 1, 0)[0]).toEqual({ a: 0, b: 600, len: 780, ct: true, cb: false });   // Sunday 21:00 → Monday 10:00
  });
  it('an occurrence running past midnight takes the next morning, in the next week of a cycle', () => {
    load([ev1({ id: 'm', weeks: [1], slots: [at(6, 1320, 1560)] })], { cycle: 2 });
    expect(open(['A'], 1, 0, 2)).toEqual([[120, 1440]]); expect(open(['A'], 1, 0, 1)).toEqual([[0, 1440]]);
  });
  it('At least keeps only the stretches at least that long, measured over the whole stretch', () => {
    load([ev1({ id: 'a', slots: [at(0, 600, 660), at(0, 690, 900), at(0, 960, 1380), at(1, 600, 1440), ...[2, 3, 4, 5, 6].map(d => at(d, 0, 1440))] })]);
    expect(open(['A'], 1, 0)).toEqual([[0, 600], [660, 690], [900, 960], [1380, 1440]]); expect(open(['A'], 1, 0, 1, 30)).toEqual([[0, 600], [660, 690], [900, 960], [1380, 1440]]);
    expect(open(['A'], 1, 0, 1, 60)).toEqual([[0, 600], [900, 960], [1380, 1440]]); expect(open(['A'], 1, 0, 1, 120)).toEqual([[0, 600], [1380, 1440]]);
    expect(open(['A'], 1, 1, 1, 120)).toEqual([[0, 600]]);
    load([ev1({ id: 'w', slots: [at(0, 60, 1440), ...[1, 2, 3, 4, 5].map(d => at(d, 0, 1440)), at(6, 0, 1380)] })]);   // Sunday 23:00 → Monday 01:00, across the end of the week
    expect(open(['A'], 1, 6, 1, 120)).toEqual([[1380, 1440]]); expect(open(['A'], 1, 0, 1, 120)).toEqual([[0, 60]]); expect(open(['A'], 1, 0, 1, 121)).toEqual([]);   // Monday 23:00 → Tuesday 10:00 is one stretch of 11 hours, not 1 hour then 10: its Monday hour stays
  });
  it('the stretch under a minute knows its whole extent; with nothing at that minute there is none', () => {
    load([ev1({ id: 'a', slots: [at(0, 600, 660), at(6, 1200, 1260)] })]);
    expect(ev("(s=>[s.x,s.y,s.len])(openTime(['A'],1).at(1,0,300))")).toEqual([8640 + 1260, 10080 + 600, 780]); expect(ev("openTime(['A'],1).at(1,0,630)")).toBeNull();
    load([]); expect(ev("(s=>[s.x,s.y,s.len,s.all])(openTime(['A'],1).at(1,3,0))")).toEqual([0, 10080, 10080, true]);
  });
  it('a stretch lists what was counted as open in it: flexible parts from + Flexible, free-time activities from + Free time', () => {
    load([ev1({ id: 'w', title: 'Work', slots: [at(0, 540, 1020, { fs: 30, fe: 15 })] }), ev1({ id: 'r', title: 'Football', slots: [at(0, 1080, 1140, { flex: true })] }),
      ev1({ id: 'p', title: 'Park', type: 'ft', slots: [at(0, 1200, 1260)] }), ev1({ id: 'o', title: 'Ben', slots: [at(0, 1300, 1320, { person: 'B' })] })], { types: [{ id: 'ft', name: 'Free time', color: '#ffb000', icon: 'sun', soft: true }] });
    expect(items(['A'], 2, 0, 1100)).toEqual([['Work', 'fe'], ['Football', 'fx']]); expect(items(['A'], 2, 0, 500)).toEqual([['Work', 'fs']]);
    expect(items(['A'], 3, 0, 1100)).toEqual([['Work', 'fs'], ['Work', 'fe'], ['Football', 'fx'], ['Park', 'ty']]);   // round the week to next Monday's flexible start
    expect(ev("openTime(['A'],1).at(1,0,1300).items")).toEqual([]);   // Unplanned counts nothing as open; Ben's activity is not Ann's
  });
  it('lengths are written as hours and minutes', () => {
    expect(ev('[fmtLen(30),fmtLen(60),fmtLen(105),fmtLen(65),fmtLen(600),fmtLen(10080)]')).toEqual(['30 min', '1 h', '1 h 45', '1 h 05', '10 h', '168 h']);
  });
});
