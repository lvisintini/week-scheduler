import { describe, it, expect } from 'vitest';
import { openApp } from '../helpers/app.js';

const app = openApp();
const ev = c => app.ev(c);

describe('R-GRID-05 Midnight is shown as 00:00 and never as 24:00', () => {
  it.each([[0, '00:00'], [1440, '00:00'], [60, '01:00'], [600, '10:00'], [1425, '23:45'], [1500, '01:00']])(
    'in the 24-hour clock, minute %i is shown as %s', (m, text) => { ev('prefs.clock12=false'); expect(ev(`fmt(${m})`)).toBe(text); });
  it.each([[0, '12:00 AM'], [1440, '12:00 AM'], [720, '12:00 PM'], [780, '1:00 PM'], [60, '1:00 AM'], [1425, '11:45 PM']])(
    'in the AM/PM clock, minute %i is shown as %s', (m, text) => { ev('prefs.clock12=true'); expect(ev(`fmt(${m})`)).toBe(text); ev('prefs.clock12=false'); });
  it('hour labels in the time column follow the clock setting', () => {
    ev('prefs.clock12=false'); expect(ev('hourLabel(13)')).toBe('13:00');
    ev('prefs.clock12=true'); expect(ev('hourLabel(13)')).toBe('1 PM'); expect(ev('hourLabel(0)')).toBe('12 AM'); ev('prefs.clock12=false');
  });
});

describe('R-REP-04 End times: select labels and compact displays', () => {
  it('end-time options run …23:45, 00:00 (the midnight closing the start day), 00:15 (Next day) … 23:45 (Next day), 00:00 (Next day)', () => {
    ev('MAXEND=2880');
    expect(ev('endLabel(1425)')).toBe('23:45');
    expect(ev('endLabel(1440)')).toBe('00:00');
    expect(ev('endLabel(1455)')).toBe('00:15 (Next day)');
    expect(ev('endLabel(2865)')).toBe('23:45 (Next day)');
    expect(ev('endLabel(2880)')).toBe('00:00 (Next day)');
  });
  it('every label of the End list is exactly what boxes, agendas and tooltips show for that end (one notation, no "Day after next")', () => {
    ev('MAXEND=2880'); expect(ev('[...Array(192).keys()].map(k=>(k+1)*15).every(m=>endLabel(m)===fmtEnd(m))')).toBe(true);
    expect(ev('[...Array(192).keys()].some(k=>/after/i.test(endLabel((k+1)*15)))')).toBe(false); expect(ev("'day2' in D.en || 'day2' in D.es")).toBe(false);
  });
  it('with the AM/PM clock the list reads 11:45 PM, 12:00 AM, 12:15 AM (Next day) … 12:00 AM (Next day)', () => {
    ev('prefs.clock12=true;MAXEND=2880');
    expect([1425, 1440, 1455, 2880].map(m => ev(`endLabel(${m})`))).toEqual(['11:45 PM', '12:00 AM', '12:15 AM (Next day)', '12:00 AM (Next day)']); ev('prefs.clock12=false');
  });
  it('for phases (which stay within a day) the end of the day is plain 00:00', () => {
    ev('MAXEND=1440'); expect(ev('endLabel(1440)')).toBe('00:00'); ev('MAXEND=2880');
  });
  it('compact displays: a plain midnight end shows 00:00 and any later end carries (Next day)', () => {
    expect(ev('fmtEnd(1380)')).toBe('23:00');
    expect(ev('fmtEnd(1440)')).toBe('00:00');
    expect(ev('fmtEnd(1500)')).toBe('01:00 (Next day)');
    expect(ev('fmtEnd(2880)')).toBe('00:00 (Next day)');
  });
  it('the Spanish interface says (día siguiente)', () => {
    const es = openApp({ languages: ['es-ES'] });
    expect(es.ev('fmtEnd(1500)')).toBe('01:00 (día siguiente)');
  });
});

describe('R-REP-03 Events can run past midnight, Sunday wraps into Monday', () => {
  it('a slot that ends before midnight is a single piece', () => {
    expect(ev('piecesOf({day:2,start:600,end:720})')).toEqual([{ p: 0, day: 2, a: 600, b: 720 }]);
  });
  it('a slot that ends exactly at midnight is still a single piece', () => {
    expect(ev('piecesOf({day:2,start:1320,end:1440})')).toHaveLength(1);
  });
  it('a slot ending after midnight is split into the part before and the part after midnight on the next day', () => {
    expect(ev('piecesOf({day:4,start:1320,end:1560})')).toEqual([{ p: 0, day: 4, a: 1320, b: 1440 }, { p: 1, day: 5, a: 0, b: 120 }]);
  });
  it('a Sunday evening slot continues on Monday (the week wraps)', () => {
    expect(ev('piecesOf({day:6,start:1380,end:1500})').map(p => p.day)).toEqual([6, 0]);
  });
  it('a slot that runs to the end of the next day fills that whole next day', () => {
    expect(ev('piecesOf({day:1,start:1200,end:2880})')[1]).toEqual({ p: 1, day: 2, a: 0, b: 1440 });
  });
});

describe('R-REP-05 Overlapping repetitions of the same event are detected', () => {
  const overlaps = slots => ev(`overlapSet({},${JSON.stringify(slots)}).size`);
  it('two blocks on the same day that share time overlap', () => {
    expect(overlaps([{ day: 0, start: 600, end: 720 }, { day: 0, start: 660, end: 780 }])).toBe(2);
  });
  it('blocks that merely touch (one ends when the next starts) do not overlap', () => {
    expect(overlaps([{ day: 0, start: 600, end: 660 }, { day: 0, start: 660, end: 720 }])).toBe(0);
  });
  it('blocks on different days do not overlap', () => {
    expect(overlaps([{ day: 0, start: 600, end: 720 }, { day: 1, start: 600, end: 720 }])).toBe(0);
  });
  it('an overnight block overlaps a block on the following morning', () => {
    expect(overlaps([{ day: 2, start: 1380, end: 1500 }, { day: 3, start: 30, end: 120 }])).toBe(2);
  });
  it('an overnight block overlaps across the Sunday→Monday wrap', () => {
    expect(overlaps([{ day: 6, start: 1380, end: 1500 }, { day: 0, start: 30, end: 120 }])).toBe(2);
  });
  it('identical blocks overlap each other', () => {
    expect(overlaps([{ day: 0, start: 600, end: 660 }, { day: 0, start: 600, end: 660 }])).toBe(2);
  });
  it('a single block never overlaps itself', () => {
    expect(overlaps([{ day: 0, start: 600, end: 2880 }])).toBe(0);
  });
});
