// R-SHARE-09: the calendar file (.ics) itself: its structure, dates, series, mapping, people, reminders and ids (icsText).
import { describe, it, expect } from 'vitest';
import { openApp, blank, ev1, person } from '../helpers/app.js';

const app = openApp({ now: [2026, 9, 21, 10, 0] });   // Wednesday 21 October 2026
const ppl = [person({ id: 'A', name: 'Ann' }), person({ id: 'B', name: 'Ben' })];
const sl = (day, start, end, o = {}) => ({ day, start, end, person: 'A', ...o });
// the text for the workspace record f (already a valid record, as shareOf gives it); cycle weeks from an anchor (a Monday of week 1)
function ics(f, { from = '2026-10-19', until = null, rem = 0, anchor = '2026-10-12' } = {}) {
  const rec = { name: 'Family', types: [], weekInfo: [], ...f };
  return app.ev(`icsText(${JSON.stringify(rec)},{from:dnum('${from}'),until:${until ? `dnum('${until}')` : 'null'},rem:${rem},now:new Date(Date.UTC(2026,9,21,8)),
    wk:d=>{const n=${rec.cycle || 1},k=Math.floor((d-(d+3)%7-dnum('${anchor}'))/7);return (k%n+n)%n+1}})`);
}
const unfold = t => t.replace(/\r\n /g, '');
// VEVENTs as objects: property name -> value (VALARM lines under alarm)
function events(t) {
  const out = []; let cur = null, inAl = false;
  unfold(t).split('\r\n').forEach(l => {
    if (l === 'BEGIN:VEVENT') { cur = { alarm: null }; return; } if (l === 'END:VEVENT') { out.push(cur); cur = null; return; }
    if (!cur) return; if (l === 'BEGIN:VALARM') { inAl = true; cur.alarm = {}; return; } if (l === 'END:VALARM') { inAl = false; return; }
    const i = l.indexOf(':'); (inAl ? cur.alarm : cur)[l.slice(0, i)] = l.slice(i + 1);
  });
  return out;
}
const one = (evs, o = {}) => blank({ people: ppl, ...o, events: evs });
const byTitle = (t, title) => events(t).filter(e => e.SUMMARY.startsWith(title));

describe('R-SHARE-09 The calendar file is valid iCalendar text', () => {
  const long = ev1({ title: 'Ñandú ' + 'émoji 😀 '.repeat(20), desc: 'a; b, c\\d\nsecond line', slots: [sl(0, 600, 660)] });
  const t = ics(one([long]));
  it('every line ends with CRLF and no line is longer than 75 octets', () => {
    expect(t.endsWith('\r\n')).toBe(true); expect(t.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    t.split('\r\n').forEach(l => expect(Buffer.byteLength(l, 'utf8')).toBeLessThanOrEqual(75));
  });
  it('folding never splits a multi-byte character: the unfolded lines give the title back whole', () => {
    expect(t.split('\r\n').some(l => l.includes('�'))).toBe(false); expect(events(t)[0].SUMMARY).toBe(long.title + ' · Ann');
  });
  it('text is escaped: backslashes, semicolons, commas and line breaks', () => {
    expect(events(t)[0].DESCRIPTION).toBe('a\\; b\\, c\\\\d\\nsecond line');
  });
  it('the calendar is named after the workspace and every BEGIN has its END', () => {
    expect(t).toMatch(/^BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-\/\/Weekly Schedules\/\/EN\r\n/); expect(t).toContain('X-WR-CALNAME:Family\r\n');
    const ls = unfold(t).split('\r\n'); expect(ls.filter(l => l.startsWith('BEGIN:')).length).toBe(ls.filter(l => l.startsWith('END:')).length); expect(ls.filter(l => l.startsWith('BEGIN:')).length).toBe(2);
  });
  it('a record with nothing for a calendar gives no file at all', () => {
    expect(ics(one([ev1({ bg: true, slots: [sl(0, 600, 660)] })]))).toBeNull();
  });
});

describe('R-SHARE-09 Days that share times, people and timing become one weekly series', () => {
  const week = ev1({ title: 'School run', slots: [0, 1, 2, 3, 4].map(d => sl(d, 450, 510)).concat([sl(5, 540, 600)]) });
  it('Mon–Fri at 07:30 is one series starting on the From Monday; Saturday at 09:00 is another', () => {
    const [a, b] = events(ics(one([week])));
    expect(a.RRULE).toBe('FREQ=WEEKLY;WKST=MO;BYDAY=MO,TU,WE,TH,FR'); expect(a.DTSTART).toBe('20261019T073000'); expect(a.DTEND).toBe('20261019T083000');
    expect(b.RRULE).toBe('FREQ=WEEKLY;WKST=MO;BYDAY=SA'); expect(b.DTSTART).toBe('20261024T090000');
  });
  it('a day with another performer, another With list or another timing is a series of its own', () => {
    const e = ev1({ title: 'Dinner', involved: ['B'], slots: [sl(0, 1140, 1200), sl(1, 1140, 1200), sl(2, 1140, 1200, { person: 'B' }), sl(3, 1140, 1200, { inv: [] }), sl(4, 1140, 1200, { flex: true })] });
    expect(events(ics(one([e]))).map(x => x.RRULE.split('BYDAY=')[1])).toEqual(['MO,TU', 'WE', 'TH', 'FR']);
  });
  it('a From in the middle of the week starts every series on its first day from then on, never before', () => {
    const [a, b] = events(ics(one([week]), { from: '2026-10-21' }));
    expect(a.DTSTART).toBe('20261021T073000'); expect(a.RRULE).toContain('BYDAY=MO,TU,WE,TH,FR'); expect(b.DTSTART).toBe('20261024T090000');
  });
  it('a time past midnight on Sunday ends on Monday morning', () => {
    const [a] = events(ics(one([ev1({ slots: [sl(6, 1320, 1560)] })])));
    expect([a.DTSTART, a.DTEND]).toEqual(['20261025T220000', '20261026T020000']);
  });
  it('Until ends every series on that day; a series whose first day is after Until is left out', () => {
    const t = ics(one([week]), { until: '2026-10-23' }); const evs = events(t);
    expect(evs).toHaveLength(1); expect(evs[0].RRULE).toBe('FREQ=WEEKLY;WKST=MO;BYDAY=MO,TU,WE,TH,FR;UNTIL=20261023T235959');
  });
});

describe('R-SHARE-09 A cycle of several weeks: each week of the cycle repeats every n weeks from the right date', () => {
  // cycle of 3, week 1 began on 12 October: From Monday 19 October is in week 2
  const cyc = evs => ics(one(evs, { cycle: 3 }));
  it('a pattern of week 1 starts on the next round (2 November) and repeats every 3 weeks', () => {
    const [a] = events(cyc([ev1({ weeks: [1], slots: [sl(0, 600, 660)] })]));
    expect(a.DTSTART).toBe('20261102T100000'); expect(a.RRULE).toBe('FREQ=WEEKLY;WKST=MO;INTERVAL=3;BYDAY=MO');
  });
  it('weeks 2 and 3 are two series, this week and next, with ids of their own', () => {
    const evs = events(cyc([ev1({ weeks: [2, 3], slots: [sl(0, 600, 660)] })]));
    expect(evs.map(x => x.DTSTART)).toEqual(['20261019T100000', '20261026T100000']); expect(evs.every(x => x.RRULE.includes('INTERVAL=3'))).toBe(true);
    expect(evs[0].UID).not.toBe(evs[1].UID);
  });
  it('a time with its own week starts in that week; an event of every week has no interval', () => {
    const [a] = events(cyc([ev1({ slots: [sl(1, 600, 660, { wk: 3 })] })])); expect(a.DTSTART).toBe('20261027T100000'); expect(a.RRULE).toContain('INTERVAL=3');
    const [b] = events(cyc([ev1({ slots: [sl(1, 600, 660)] })])); expect(b.DTSTART).toBe('20261020T100000'); expect(b.RRULE).not.toContain('INTERVAL');
  });
  it('the details name the week of the cycle, with its name', () => {
    const [a] = events(ics(one([ev1({ weeks: [2], slots: [sl(0, 600, 660)] })], { cycle: 3, weekInfo: [{}, { name: 'At Dad\'s' }] })));
    expect(a.DESCRIPTION).toBe('Week 2 · At Dad\'s');
  });
});

describe('R-SHARE-09 What each kind of event becomes: busy, free or left out', () => {
  const t = ics(one([
    ev1({ id: 'n', title: 'Normal', slots: [sl(0, 600, 660)] }), ev1({ id: 'f', title: 'Flexible', slots: [sl(1, 600, 660, { flex: true })] }),
    ev1({ id: 'aw', title: 'At Dad\'s', away: true, slots: [sl(2, 600, 900)] }), ev1({ id: 'bg', title: 'Quiet hours', bg: true, slots: [sl(3, 600, 660)] }),
    ev1({ id: 'ne', title: 'Post', nest: true, slots: [sl(4, 600, 615)] }), ev1({ id: 'm', title: 'Margins', slots: [sl(5, 540, 1020, { fs: 30, fe: 15 })] }),
  ], { rhythms: [{ id: 'r', name: 'R', visible: true }], phases: [{ id: 'ph', title: 'Morning', desc: '', color: '#3b6df0', rhythms: ['r'], slots: [{ day: 0, start: 480, end: 720 }] }] }), { rem: 15 });
  it('normal and nested events are busy over their whole time', () => {
    expect(byTitle(t, 'Normal')[0].TRANSP).toBe('OPAQUE'); expect(byTitle(t, 'Post')[0].TRANSP).toBe('OPAQUE');
    expect([byTitle(t, 'Margins')[0].DTSTART, byTitle(t, 'Margins')[0].DTEND]).toEqual(['20261024T090000', '20261024T170000']);
  });
  it('"Around these times" and Away are free, and Away says so in the title', () => {
    const f = byTitle(t, 'Flexible')[0], a = byTitle(t, 'Away: At Dad\'s')[0];
    expect(f.TRANSP).toBe('TRANSPARENT'); expect(f.DESCRIPTION).toBe('Around these times'); expect(a.TRANSP).toBe('TRANSPARENT');
  });
  it('things in the background and the phases of rhythms are left out', () => {
    expect(t).not.toContain('Quiet hours'); expect(t).not.toContain('Morning'); expect(events(t)).toHaveLength(5);
  });
  it('flexible margins are explained in the details', () => {
    expect(byTitle(t, 'Margins')[0].DESCRIPTION).toBe('Start between 9:00 and 9:30 · Finish between 16:45 and 17:00'.replace(/9:/g, '09:'));
  });
  it('a reminder is an alarm on busy events only', () => {
    expect(byTitle(t, 'Normal')[0].alarm).toEqual({ ACTION: 'DISPLAY', TRIGGER: '-PT15M', DESCRIPTION: 'Normal · Ann' });
    expect(byTitle(t, 'Flexible')[0].alarm).toBeNull(); expect(byTitle(t, 'Away')[0].alarm).toBeNull();
    expect(ics(one([ev1({ slots: [sl(0, 600, 660)] })]))).not.toContain('VALARM');
  });
});

describe('R-SHARE-09 People are text: the performer in the title, the rest in the details, never attendees', () => {
  it('the title carries the performer, and nothing when nobody performs it', () => {
    const t = ics(one([ev1({ title: 'Cook', slots: [sl(0, 600, 660)] }), ev1({ id: 'x', title: 'Bins', slots: [sl(1, 600, 660, { person: '' })] })]));
    expect(events(t).map(e => e.SUMMARY)).toEqual(['Cook · Ann', 'Bins']); expect(t).not.toMatch(/ATTENDEE|ORGANIZER/);
  });
  it('the details hold the event description, the owner when someone else performs it, With and On call', () => {
    const t = ics(one([ev1({ title: 'Cook', desc: 'Recipes on the fridge', owner: 'B', involved: ['B'], slots: [sl(0, 600, 660)] }), ev1({ id: 'oc', title: 'Nap', oncall: true, involved: ['B'], slots: [sl(1, 600, 660)] })]));
    expect(byTitle(t, 'Cook')[0].DESCRIPTION).toBe('Recipes on the fridge\\nOwner: Ben\\nWith: Ben'); expect(byTitle(t, 'Nap')[0].DESCRIPTION).toBe('On call: Ben');
  });
  it('the activity type is the category', () => {
    const t = ics(one([ev1({ type: 'ty', slots: [sl(0, 600, 660)] })], { types: [{ id: 'ty', name: 'Meal, family', color: '#e8912d', icon: 'meal', visible: true }] }));
    expect(events(t)[0].CATEGORIES).toBe('Meal\\, family');
  });
});

describe('R-SHARE-09 Ids stay the same within a period and change with another From', () => {
  const e = ev1({ slots: [sl(0, 600, 660), sl(1, 600, 660), sl(2, 700, 760)] });
  const uids = (t) => events(t).map(x => x.UID);
  it('exporting the same data for the same From gives the same ids', () => {
    expect(uids(ics(one([e])))).toEqual(uids(ics(one([e])))); expect(uids(ics(one([e])))[0]).toBe('e1-w0-600-660-20261019@weekly-schedules');
  });
  it('another From gives every series a new id', () => {
    const a = uids(ics(one([e]))), b = uids(ics(one([e]), { from: '2026-12-21' })); expect(a.filter(u => b.includes(u))).toEqual([]);
  });
  it('removing or adding another day keeps the ids of the series that remain', () => {
    const fewer = { ...e, slots: [e.slots[0], e.slots[2]] }; expect(uids(ics(one([fewer])))).toEqual(uids(ics(one([e]))));
  });
  it('series with the same times but different people get distinct ids, and every id in a file is unique', () => {
    const t = ics(one([ev1({ slots: [sl(0, 600, 660), sl(1, 600, 660, { person: 'B' })] }), ev1({ id: 'e2', slots: [sl(0, 600, 660)] })]));
    const u = uids(t); expect(u).toEqual(['e1-w0-600-660-20261019@weekly-schedules', 'e1-w0-600-660-20261019-2@weekly-schedules', 'e2-w0-600-660-20261019@weekly-schedules']); expect(new Set(u).size).toBe(u.length);
  });
});
