import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, sched, ev1, person, sleep } from '../helpers/app.js';

const fresh = (data, o = {}) => { const a = openApp(o); if (data) setData(a, data); return a; };
const people = [person({ id: 'A', name: 'Ann', color: '#e5484d' }), person({ id: 'B', name: 'Bob', color: '#2fa66a' })];
const types = [{ id: 'ts', name: 'Sleep', color: '#3f51b5', icon: 'moon' }, { id: 'tw', name: 'Work', color: '#2fa66a', icon: 'work' }, { id: 'tf', name: 'Free time', color: '#12a5b5', icon: 'sun', soft: true }];
const at = (id, day, start, end, person = 'A', o = {}) => ev1({ id, title: id, slots: [{ day, start, end, person }], ...o });
const stats = (a, pid = 'A', inv = true) => a.ev(`(()=>{const s=personStats(${JSON.stringify(pid)},${inv});return {by:Object.fromEntries(s.by),fx:Object.fromEntries(s.fx),days:s.perDay.map(m=>Object.fromEntries(m)),planned:s.planned,overlap:s.overlap,places:s.places,flex:s.flex}})()`);
const W = 7 * 1440;

describe('R-STAT-01 Opening the statistics dialog', () => {
  it('the toolbar has a statistics button (seventh) with an explanatory tooltip', () => {
    const a = fresh(blank({ people })); const b = a.qa('.tbar button')[6]; expect(b.title).toContain('Statistics'); b.click(); expect(a.dlgTitle()).toBe('Statistics');
  });
  it('a person row menu has "Statistics…", which opens the dialog on that person', () => {
    const a = fresh(blank({ people })); [...a.qa('#sbin .sec')[1].querySelectorAll('.sch')[1].querySelectorAll('button')].find(b => b.title === 'More actions').click();
    a.qa('.omenu .oi').find(b => b.textContent.trim() === 'Statistics…').click(); expect(a.q('#xDlg select').value).toBe('B');
  });
  it('without people it explains that people are needed instead of opening', () => {
    const a = fresh(blank()); a.ev('openStats()'); expect(a.dlgOpen()).toBe(false); expect(a.toast()).toContain('Add people');
  });
  it('the picker lists every person and "Everyone"; the first visible person is shown first', () => {
    const a = fresh(blank({ people: [{ ...people[0], visible: false }, people[1]] })); a.ev('openStats()');
    expect([...a.q('#xDlg select').options].map(o => o.textContent)).toEqual(['Ann', 'Bob', 'Everyone']); expect(a.q('#xDlg select').value).toBe('B');
  });
  it('the dialog is wide and remembers the last person and the involved toggle while the page is open', () => {
    const a = fresh(blank({ people })); a.ev('openStats()'); expect(a.q('#xDlg').classList.contains('wide')).toBe(true);
    const sel = a.q('#xDlg select'); sel.value = '*'; sel.onchange(); const cb = a.q('#xDlg .stbar input'); cb.checked = false; cb.onchange();
    a.click('Close'); a.ev('openStats()'); expect(a.q('#xDlg select').value).toBe('*'); expect(a.q('#xDlg .stbar input').checked).toBe(false);
  });
  it('the dialog and its explanation are translated', () => {
    const a = fresh(blank({ people }), { languages: ['es'] }); a.ev('openStats()'); expect(a.dlgTitle()).toBe('Estadísticas'); expect(a.dlgText()).toContain('Solo cuentan los horarios visibles');
    expect(a.qa('#xDlg .btns button').map(b => b.textContent)).toEqual(['Copiar tabla', 'Descargar CSV', 'Imprimir', 'Cerrar']);
  });
});

describe('R-STAT-02 How the week is counted', () => {
  it('time as responsible person and as involved person both count, by activity type', () => {
    const a = fresh(blank({ people, types, events: [at('w', 0, 540, 1020, 'A', { type: 'tw' }), at('f', 1, 600, 720, 'B', { type: 'tf', involved: ['A'] })] }));
    expect(stats(a).by).toEqual({ tw: 480, tf: 120 }); expect(stats(a).planned).toBe(600);
  });
  it('with the toggle off only time as responsible person counts', () => {
    const a = fresh(blank({ people, types, events: [at('w', 0, 540, 1020, 'A', { type: 'tw' }), at('f', 1, 600, 720, 'B', { type: 'tf', involved: ['A'] })] }));
    expect(stats(a, 'A', false).by).toEqual({ tw: 480 });
  });
  it('events without any people count for nobody', () => {
    const a = fresh(blank({ people, events: [at('x', 0, 600, 660, '')] })); expect(stats(a, 'A').planned).toBe(0); expect(stats(a, 'B').planned).toBe(0);
  });
  it('an event with involved people but no responsible person counts for the involved people', () => {
    const a = fresh(blank({ people, events: [at('x', 0, 600, 660, '', { involved: ['B'] })] })); expect(stats(a, 'B').planned).toBe(60); expect(stats(a, 'A').planned).toBe(0);
  });
  it('only visible schedules count (solo one week of a two-week rota)', () => {
    const a = fresh(blank({ people, schedules: [sched(), sched({ id: 's2', name: 'Week B', visible: false })], events: [at('a', 0, 600, 660), at('b', 0, 700, 760, 'A', { schedules: ['s2'] })] }));
    expect(stats(a).planned).toBe(60);
  });
  it('hidden early hours and a hidden weekend still count; the people filter does not matter', () => {
    const a = fresh(blank({ people: [{ ...people[0], visible: false }], events: [at('n', 6, 0, 300)] })); a.ev('prefs.hideWeekend=true;render()'); expect(stats(a).planned).toBe(300);
  });
  it('events without a type go to "No type"; types deleted later are "No type" too', () => {
    const a = fresh(blank({ people, types, events: [at('x', 0, 600, 660)] })); expect(stats(a).by).toEqual({ '': 60 });
  });
  it('double-booked time counts once and is split evenly between the overlapping events', () => {
    const a = fresh(blank({ people, types, events: [at('w', 0, 600, 720, 'A', { type: 'tw' }), at('f', 0, 660, 780, 'A', { type: 'tf' })] }));
    const s = stats(a); expect(s.planned).toBe(180); expect(s.by).toEqual({ tw: 90, tf: 90 }); expect(s.overlap).toBe(60); expect(s.places).toBe(1);
  });
  it('separate overlaps are counted as separate places', () => {
    const a = fresh(blank({ people, events: [at('a', 0, 600, 660), at('b', 0, 630, 690), at('c', 2, 600, 660), at('d', 2, 600, 615)] }));
    expect(stats(a).places).toBe(2); expect(stats(a).overlap).toBe(45);
  });
  it('flexible repetitions count fully and are reported as "of which flexible"', () => {
    const a = fresh(blank({ people, types, events: [ev1({ id: 'h', type: 'tw', slots: [{ day: 0, start: 600, end: 720, person: 'A', flex: true }, { day: 1, start: 600, end: 660, person: 'A' }] })] }));
    expect(stats(a).by).toEqual({ tw: 180 }); expect(stats(a).flex).toBe(120); expect(stats(a).fx).toEqual({ tw: 120 });
  });
  it('time past midnight counts on the day it falls on, and Sunday night continues on Monday', () => {
    const a = fresh(blank({ people, events: [at('n', 6, 1320, 1680)] })); const d = stats(a).days; expect(d[6]['']).toBe(120); expect(d[0]['']).toBe(240);
  });
  it('the week has 168 hours: planned + not planned = 168 h', () => {
    const a = fresh(blank({ people, events: [at('a', 0, 600, 660)] })); a.ev('openStats("A")');
    const rows = a.qa('#xDlg .sttab tr').map(r => [...r.children].map(c => c.textContent));
    expect(rows.find(r => r[0] === 'Planned')[1]).toBe('1:00'); expect(rows.find(r => r[0] === 'Not planned')[1]).toBe('167:00'); expect(W).toBe(10080);
  });
});

describe('R-STAT-03 What the dialog shows', () => {
  const week = () => fresh(blank({ people, types, events: [at('s', 0, 0, 480, 'A', { type: 'ts' }), at('w', 0, 540, 1020, 'A', { type: 'tw' }), at('f', 0, 1020, 1080, 'A', { type: 'tf' }), at('x', 1, 600, 630, 'A'), at('b', 0, 600, 660, 'B', { type: 'tw' })] }));
  it('a 168-hour bar shows the activity types in list order in their colours, then "No type", then "Not planned"', () => {
    const a = week(); a.ev('openStats("A")'); const r = a.qa('#xDlg .stwk > span');
    expect(r.map(x => x.className || x.style.background)).toEqual(['rgb(63, 81, 181)', 'rgb(47, 166, 106)', 'rgb(18, 165, 181)', 'rgb(154, 160, 166)', 'stnp']);
    expect(r[0].title).toBe('Sleep 8:00'); expect(parseFloat(r[0].style.width)).toBeCloseTo(480 / W * 100, 3);
  });
  it('seven day bars show each day stacked by type, labelled with the day', () => {
    const a = week(); a.ev('openStats("A")'); expect(a.qa('#xDlg .stday text:not(.stv)').map(t => t.textContent)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(a.qa('#xDlg .stday rect title').map(t => t.textContent)).toContain('Monday: Work 8:00');
  });
  it('the table lists hours, % of the week and % of planned time for each type with time, then the totals', () => {
    const a = week(); a.ev('openStats("A")'); const rows = a.qa('#xDlg .sttab tbody tr').map(r => [...r.children].map(c => c.textContent.trim()));
    expect(rows.map(r => r[0])).toEqual(['Sleep', 'Work', 'Free time', 'No type', 'Planned', 'Not planned']);
    expect(rows[1]).toEqual(['Work', '8:00', '5 %', '46 %']); expect(rows[4][1]).toBe('17:30');
  });
  it('the type rows show the type icon in its colour', () => {
    const a = week(); a.ev('openStats("A")'); expect(a.q('#xDlg .sttab tbody tr .ic svg')).not.toBeNull();
  });
  it('the overlapping time, the number of places and the flexible time are shown under the table', () => {
    const a = fresh(blank({ people, events: [at('a', 0, 600, 720), at('b', 0, 660, 780), ev1({ id: 'h', slots: [{ day: 2, start: 600, end: 660, person: 'A', flex: true }] })] })); a.ev('openStats("A")');
    expect(a.q('#xDlg .stfoot').textContent).toBe('Overlapping: 1:00 in 1 place(s) · of which flexible: 1:00');
  });
  it('a person with nothing planned gets a clear message', () => {
    const a = fresh(blank({ people })); a.ev('openStats("B")'); expect(a.dlgText()).toContain('Nothing planned for Bob in the visible schedules.');
  });
  it('choosing another person or switching the toggle redraws at once', () => {
    const a = week(); a.ev('openStats("A")'); const sel = a.q('#xDlg select'); sel.value = 'B'; sel.onchange();
    expect(a.qa('#xDlg .sttab tbody tr')[0].textContent).toContain('Work');
  });
  it('"Everyone" shows one 168-hour bar per person with their planned hours, and a legend of the types used', () => {
    const a = week(); a.ev('openStats()'); const sel = a.q('#xDlg select'); sel.value = '*'; sel.onchange();
    expect(a.qa('#xDlg .stp .stn').map(n => n.textContent)).toEqual(['Ann', 'Bob']); expect(a.qa('#xDlg .stp > b').map(b => b.textContent)).toEqual(['17:30', '1:00']);
    expect(a.qa('#xDlg .stleg span').map(s => s.textContent)).toEqual(['Sleep', 'Work', 'Free time', 'No type', 'Not planned']);
  });
});

describe('R-STAT-04 Copying, downloading and printing the statistics', () => {
  const two = () => fresh(blank({ people, types, events: [at('w', 0, 540, 1020, 'A', { type: 'tw' }), at('b', 1, 600, 660, 'B')] }));
  it('"Copy table" puts a tab-separated table on the clipboard, ready to paste into a spreadsheet', async () => {
    const a = two(); a.ev('openStats("A")'); a.click('Copy table'); await sleep(10);
    const lines = a.w.__clip.split('\n'); expect(lines[0].split('\t')).toEqual(['Person', 'Activity type', 'Hours', '% of week', '% of planned', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Flexible hours']);
    expect(lines[1].split('\t').slice(0, 6)).toEqual(['Ann', 'Work', '8.00', '5 %', '100 %', '8.00']); expect(a.dlgOpen()).toBe(true); expect(a.q('#xDlg .ststat').textContent).toContain('Table copied');
  });
  it('"Download CSV" saves weekly-schedules-stats-<date>.csv with a UTF-8 marker and says it is not encrypted', () => {
    const a = two(); a.ev('openStats("A")'); a.click('Download CSV');
    expect(a.w.__download).toMatch(/^weekly-schedules-stats-\d{4}-\d{2}-\d{2}\.csv$/); expect(a.w.__file.startsWith('﻿Person,Activity type,Hours')).toBe(true);
    expect(a.q('#xDlg .ststat').textContent).toContain('not encrypted');
  });
  it('the Everyone table has one row per person and a column per activity type', () => {
    const a = two(); a.ev('stP="*";openStats()'); a.click('Download CSV'); const rows = a.w.__file.slice(1).split('\r\n').map(r => r.split(','));
    expect(rows[0]).toEqual(['Person', 'Sleep', 'Work', 'Free time', 'No type', 'Planned', 'Not planned', 'Overlapping hours', 'Flexible hours']);
    expect(rows.slice(1).map(r => [r[0], r[2], r[4]])).toEqual([['Ann', '8.00', '0.00'], ['Bob', '0.00', '1.00']]);
  });
  it('names that look like spreadsheet formulas are neutralised, and commas and quotes are escaped', () => {
    const a = fresh(blank({ people: [person({ id: 'A', name: '=HYPERLINK("x")' }), person({ id: 'B', name: 'Smith, "Jo"' })], events: [at('w', 0, 600, 660)] }));
    a.ev('stP="*";openStats()'); a.click('Download CSV'); const lines = a.w.__file.split('\r\n');
    expect(lines[1].startsWith('"\'=HYPERLINK(""x"")"')).toBe(true); expect(lines[2].startsWith('"Smith, ""Jo"""')).toBe(true);
  });
  it('"Print" prints the charts and table with a title naming the person, and the dialog stays open', () => {
    const a = two(); a.ev('openStats("A")'); a.click('Print'); expect(a.w.__printed).toContain('Statistics — Ann'); expect(a.w.__printed).toContain('sttab'); expect(a.dlgOpen()).toBe(true);
  });
});

describe('R-EVT-15 R-STAT-02 Flexible start/end in the statistics', () => {
  it('flexible margins count as planned time and are added to the hatched "of which flexible" part', () => {
    const a = fresh(blank({ people, types, events: [ev1({ id: 'w', type: 'tw', slots: [{ day: 0, start: 540, end: 1020, person: 'A', fs: 30, fe: 15 }] })] }));
    const s = stats(a); expect(s.planned).toBe(480); expect(s.by).toEqual({ tw: 480 }); expect(s.fx).toEqual({ tw: 45 }); expect(s.flex).toBe(45);
  });
  it('a core beats a margin: the overlapped margin time goes to the other event and is not counted as overlapping', () => {
    const a = fresh(blank({ people, types, events: [ev1({ id: 'w', type: 'tw', slots: [{ day: 0, start: 540, end: 1020, person: 'A', fe: 15 }] }), at('p', 0, 1005, 1050)] }));
    const s = stats(a); expect(s.planned).toBe(510); expect(s.by).toEqual({ tw: 465, '': 45 }); expect(s.overlap).toBe(0); expect(s.places).toBe(0); expect(s.flex).toBe(0);
  });
  it('margin against margin is split evenly, counts as flexible and is not counted as overlapping', () => {
    const a = fresh(blank({ people, types, events: [ev1({ id: 'x', type: 'tw', slots: [{ day: 0, start: 540, end: 600, person: 'A', fe: 30 }] }), ev1({ id: 'z', type: 'tf', slots: [{ day: 0, start: 570, end: 630, person: 'A', fs: 30 }] })] }));
    const s = stats(a); expect(s.by).toEqual({ tw: 45, tf: 45 }); expect(s.fx).toEqual({ tw: 15, tf: 15 }); expect(s.overlap).toBe(0);
  });
  it('cores that overlap are still double-booked and counted as overlapping', () => {
    const a = fresh(blank({ people, types, events: [ev1({ id: 'w', type: 'tw', slots: [{ day: 0, start: 540, end: 1020, person: 'A', fe: 15 }] }), at('p', 0, 960, 1050)] }));
    const s = stats(a); expect(s.overlap).toBe(45); expect(s.places).toBe(1); expect(s.by).toEqual({ tw: 420 + 22.5, '': 45 + 22.5 });
  });
});

describe('R-EVT-12 R-STAT-02 Around these times in the statistics: all flexible margin, unless squeezed out', () => {
  const hw = (start = 1020, end = 1080, o = {}) => ev1({ id: 'h', type: 'tf', slots: [{ day: 0, start, end, person: 'A', flex: true }], ...o });
  it('it counts as planned and flexible time, and a core of the same person at the same time takes that time', () => {
    const a = fresh(blank({ people, types, events: [hw(1020, 1140), ev1({ id: 'p', type: 'tw', slots: [{ day: 0, start: 1080, end: 1110, person: 'A' }] })] }));
    const s = stats(a); expect(s.by).toEqual({ tf: 90, tw: 30 }); expect(s.fx).toEqual({ tf: 90 }); expect(s.overlap).toBe(0); expect(s.places).toBe(0);
  });
  it('two of them at the same time are split evenly and are not counted as overlapping', () => {
    const a = fresh(blank({ people, types, events: [hw(), ev1({ id: 'r', type: 'tw', slots: [{ day: 0, start: 1020, end: 1080, person: 'A', flex: true }] })] }));
    const s = stats(a); expect(s.by).toEqual({ tf: 30, tw: 30 }); expect(s.flex).toBe(60); expect(s.overlap).toBe(0);
  });
  it('squeezed out by cores of the same person it is a core again: the time is split and counted as overlapping', () => {
    const a = fresh(blank({ people, types, events: [hw(), ev1({ id: 'f', type: 'tw', slots: [{ day: 0, start: 1020, end: 1110, person: 'A' }] })] }));
    const s = stats(a); expect(s.by).toEqual({ tf: 30, tw: 60 }); expect(s.overlap).toBe(60); expect(s.places).toBe(1); expect(s.fx).toEqual({ tf: 30 });
  });
  it('a nested one done during another activity takes its time, as nested activities do', () => {
    const a = fresh(blank({ people, types, events: [ev1({ id: 'f', type: 'tw', slots: [{ day: 0, start: 960, end: 1110, person: 'A' }] }), hw(1020, 1035, { nest: true })] }));
    const s = stats(a); expect(s.by).toEqual({ tw: 135, tf: 15 }); expect(s.overlap).toBe(0);
  });
});

describe('R-PPL-03 R-EVT-16 R-STAT-02 External people and on-call involvement in the statistics', () => {
  const ppl = [...people, person({ id: 'X', name: 'Cleaner', color: '#12a5b5', external: true })];
  it('external people are not in the person picker, the Everyone view or the table behind it', () => {
    const a = fresh(blank({ people: ppl, events: [at('c', 0, 600, 720, 'X')] })); a.ev('openStats()');
    expect([...a.q('#xDlg select').options].map(o => o.textContent)).toEqual(['Ann', 'Bob', 'Everyone']);
    expect(a.ev('statsRows("*",true).map(r=>r[0])')).toEqual(['Person', 'Ann', 'Bob']);
    const sel = a.q('#xDlg select'); sel.value = '*'; sel.onchange(); expect(a.qa('#xDlg .stp .stn').map(x => x.textContent)).toEqual(['Ann', 'Bob']);
  });
  it('with only external people the dialog explains that people are needed', () => {
    const a = fresh(blank({ people: [ppl[2]] })); a.ev('openStats()'); expect(a.dlgOpen()).toBe(false); expect(a.toast()).toContain('Add people');
  });
  it('on-call involvement does not count, even with "Include time as involved person" on; normal involvement does', () => {
    const a = fresh(blank({ people: ppl, events: [ev1({ id: 'c', oncall: true, involved: ['A'], slots: [{ day: 0, start: 600, end: 720, person: 'X' }] }), ev1({ id: 'm', involved: ['A'], slots: [{ day: 1, start: 600, end: 660, person: 'B' }] })] }));
    expect(stats(a, 'A', true).planned).toBe(60); expect(stats(a, 'B', true).planned).toBe(60);
  });
});

const unit = (a, label) => a.qa('#xDlg .stu button').find(b => b.textContent === label).click();
const chip = (a, name) => { if (!a.q('.typop')) a.q('#xDlg .sttyb').click(); return a.qa('.typop .oi[role=menuitemcheckbox]').find(b => b.textContent === name); };
const tbl = a => a.qa('#xDlg .sttab tbody tr').map(r => [...r.children].map(c => c.textContent.trim()));
const day = () => fresh(blank({ people, types, events: [at('s', 0, 0, 480, 'A', { type: 'ts' }), at('w', 0, 540, 1020, 'A', { type: 'tw' }), at('f', 0, 1020, 1080, 'A', { type: 'tf' }), at('x', 1, 600, 630, 'A')] }));

describe('R-STAT-05 The figures can be shown as hours, % of the week or % of the planned time', () => {
  it('a three-way switch Hours | % of week | % of planned sits in the bar, Hours by default, with an explanatory tooltip', () => {
    const a = day(); a.ev('stU="h";openStats("A")'); const g = a.q('#xDlg .stbar .stu');
    expect([...g.children].map(b => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([['Hours', 'true'], ['% of week', 'false'], ['% of planned', 'false']]);
    expect(g.getAttribute('role')).toBe('group'); expect(g.title).toContain('168-hour week');
  });
  it('% of week labels the bar parts with their share of the 168 hours; % of planned with their share of the planned time', () => {
    const a = day(); a.ev('stU="h";openStats("A")'); const labels = () => a.qa('#xDlg .stwk > span b').map(b => b.textContent);
    expect(labels()).toEqual(['8:00', '8:00', '150:30']);
    unit(a, '% of week'); expect(labels()).toEqual(['5 %', '5 %', '90 %']);
    unit(a, '% of planned'); expect(labels()).toEqual(['46 %', '46 %']); expect(a.q('#xDlg .stwk .stnp').title).toBe('Not planned 150:30');
  });
  it('the tooltips keep the hours and add the percentage', () => {
    const a = day(); a.ev('stU="h";openStats("A")'); unit(a, '% of planned'); expect(a.q('#xDlg .stwk > span').title).toBe('Sleep 8:00 (46 %)');
  });
  it('the day bars follow the unit: share of the day, or of that day\'s planned time, and the day total as a share of the week\'s planned time', () => {
    const a = day(); a.ev('stU="h";openStats("A")'); const tot = () => a.qa('#xDlg .stday .stdt').map(t => t.textContent);
    expect(tot()).toEqual(['17:00', '0:30']); unit(a, '% of week'); expect(tot()).toEqual(['71 %', '2 %']); unit(a, '% of planned'); expect(tot()).toEqual(['97 %', '3 %']);
    expect(a.qa('#xDlg .stday .stv:not(.stdt)').map(t => t.textContent)).toEqual(['47 %', '47 %']);
  });
  it('the table keeps its hours and percent columns whatever the unit', () => {
    const a = day(); a.ev('stU="h";openStats("A")'); const before = tbl(a); unit(a, '% of planned'); expect(tbl(a)).toEqual(before);
  });
  it('with a cycle the week columns use the unit, and the cycle total is left out in a percent unit', () => {
    const a = fresh(blank({ cycle: 2, people, types, events: [ev1({ id: 'o', weeks: [1], type: 'tw', slots: [{ day: 0, start: 600, end: 720, person: 'A' }] }), ev1({ id: 'e', type: 'ts', slots: [{ day: 1, start: 600, end: 660, person: 'A' }] })] }));
    a.ev('stU="h";stW="avg";openStats("A")'); unit(a, '% of planned');
    expect(a.qa('#xDlg .sttab thead th').map(t => t.textContent)).toEqual(['Activity type', 'Hours', '% of week', '% of planned', 'W1', 'W2', 'Average']);
    expect(tbl(a)[0]).toEqual(['Sleep', '1:00', '1 %', '50 %', '33 %', '100 %', '50 %']); expect(tbl(a).find(r => r[0] === 'Not planned').slice(-3)).toEqual(['–', '–', '–']);
    const r = a.ev('statsRows("A",true)'); expect(r[0].slice(-3)).toEqual(['W1 (% of planned)', 'W2 (% of planned)', 'Average (% of planned)']);
  });
  it('Everyone shows each person\'s planned time as a share of the week in a percent unit', () => {
    const a = day(); a.ev('stU="h";openStats("*")'); unit(a, '% of planned'); expect(a.qa('#xDlg .stp > b').map(b => b.textContent)).toEqual(['10 %', '0 %']);
  });
  it('the unit is remembered while the page is open', () => {
    const a = day(); a.ev('stU="h";openStats("A")'); unit(a, '% of week'); a.click('Close'); a.ev('openStats("A")');
    expect(a.q('#xDlg .stu button.on').textContent).toBe('% of week');
  });
});

describe('R-STAT-06 The bars are labelled with their figures', () => {
  it('the 168-hour bar is drawn in HTML so its labels are not stretched, and only parts at least 4 % wide carry a label', () => {
    const a = day(); a.ev('stU="h";openStats("A")'); const r = a.qa('#xDlg .stwk > span');
    expect(a.q('#xDlg .stwk').tagName).toBe('DIV'); expect(a.q('#xDlg .stwk').getAttribute('role')).toBe('img');
    expect(r.map(x => !!x.querySelector('b'))).toEqual([true, true, false, false, true]);
  });
  it('a part with flexible time keeps its hatching over the flexible share', () => {
    const a = fresh(blank({ people, types, events: [ev1({ type: 'tw', slots: [{ day: 0, start: 600, end: 720, person: 'A', flex: true }, { day: 1, start: 600, end: 720, person: 'A' }] })] }));
    a.ev('stU="h";openStats("A")'); expect(a.q('#xDlg .stwk .sth').style.width).toBe('50%');
  });
  it('day bar parts tall enough carry their value, in black or white for contrast', () => {
    const a = day(); a.ev('stU="h";openStats("A")'); const v = a.qa('#xDlg .stday .stv:not(.stdt)');
    expect(v.map(t => t.textContent)).toEqual(['8:00', '8:00']); expect(v[0].getAttribute('style')).toMatch(/fill:#(fff|000)/);
  });
  it('the printed statistics keep the labels', () => {
    const a = day(); a.ev('stU="h";openStats("A")'); a.click('Print'); expect(a.w.__printed).toContain('<b>8:00</b>'); expect(a.w.__printed).toContain('class="stv stdt"');
  });
});

describe('R-STAT-07 The activity types shown can be filtered inside the statistics dialog, from a list that pops up', () => {
  const lines = a => a.qa('.typop .oi[role=menuitemcheckbox]').map(b => [b.textContent, b.getAttribute('aria-checked')]);
  it('one button in the bar says how many types are shown; its tooltip says it is independent of the sidebar', () => {
    const a = day(); a.ev('stHide.clear();openStats("A")'); const b = a.q('#xDlg .stbar .sttyb');
    expect(b.textContent).toBe('Activity types: all'); expect(b.getAttribute('aria-haspopup')).toBe('menu'); expect(b.title).toContain('independent of the eyes'); expect(a.q('#xDlg .stty')).toBeNull();
  });
  it('it opens a list with one type per line, No type last, all ticked at first, under Show all and Hide all', () => {
    const a = day(); a.ev('stHide.clear();openStats("A")'); a.q('#xDlg .sttyb').click();
    expect(lines(a)).toEqual([['Sleep', 'true'], ['Work', 'true'], ['Free time', 'true'], ['No type', 'true']]); expect(a.qa('.typop .tyall').map(b => b.textContent)).toEqual(['Show all', 'Hide all']);
    expect(a.q('.typop .oi[role=menuitemcheckbox] .ic svg')).not.toBeNull(); expect(a.q('.typop').getAttribute('role')).toBe('menu');
  });
  it('ticking lines filters at once and keeps the list open; the button counts the types shown; Esc closes the list', () => {
    const a = day(); a.ev('stHide.clear();openStats("A")'); chip(a, 'Sleep').click(); chip(a, 'Free time').click();
    expect(a.q('.typop')).not.toBeNull(); expect(lines(a).map(l => l[1])).toEqual(['false', 'true', 'false', 'true']); expect(a.q('#xDlg .sttyb').textContent).toBe('Activity types: 2 of 4');
    a.q('.typop').onkeydown({ key: 'Escape', preventDefault() {}, stopPropagation() {} }); expect(a.q('.typop')).toBeNull();
  });
  it('filtered-out types become one grey Filtered out part after the shown types, so Not planned stays the same', () => {
    const a = day(); a.ev('stU="h";stHide.clear();openStats("A")'); chip(a, 'Sleep').click(); chip(a, 'Free time').click();
    expect(a.qa('#xDlg .stwk > span').map(x => x.className || x.title)).toEqual(['Work 8:00', 'No type 0:30', 'stf', 'stnp']);
    expect(a.q('#xDlg .stwk .stf').title).toBe('Filtered out 9:00'); expect(tbl(a).map(r => r[0])).toEqual(['Work', 'No type', 'Filtered out (2 type(s))', 'Planned', 'Not planned']);
    expect(tbl(a).find(r => r[0] === 'Not planned')[1]).toBe('150:30'); expect(tbl(a)[0][3]).toBe('46 %');
  });
  it('Hide all and Show all switch every type at once', () => {
    const a = day(); a.ev('stHide.clear();openStats("A")'); a.q('#xDlg .sttyb').click(); a.qa('.typop .tyall')[1].click();
    expect(lines(a).every(l => l[1] === 'false')).toBe(true); expect(a.q('#xDlg .sttyb').textContent).toBe('Activity types: 0 of 4');
    a.qa('.typop .tyall')[0].click(); expect(a.q('#xDlg .stwk .stf')).toBeNull(); expect(a.q('#xDlg .sttyb').textContent).toBe('Activity types: all');
  });
  it('the filter does not touch the eyes of the activity types in the sidebar, and the sidebar eyes do not touch it', () => {
    const a = day(); a.ev('stHide.clear();openStats("A")'); chip(a, 'Work').click(); expect(a.ev('S.types.map(t=>t.visible!==false)')).toEqual([true, true, true]);
    a.ev('S.types[0].visible=false'); a.click('Close'); a.ev('openStats("A")'); expect(chip(a, 'Sleep').getAttribute('aria-checked')).toBe('true');
  });
  it('the filter is remembered while the page is open', () => {
    const a = day(); a.ev('stHide.clear();openStats("A")'); chip(a, 'Work').click(); a.click('Close'); a.ev('openStats("A")');
    expect(a.q('#xDlg .sttyb').textContent).toBe('Activity types: 3 of 4'); expect(chip(a, 'Work').getAttribute('aria-checked')).toBe('false');
  });
  it('Everyone, its legend, the copied table and the CSV merge the filtered types the same way', () => {
    const a = day(); a.ev('stHide.clear();openStats("*")'); chip(a, 'Sleep').click(); chip(a, 'Work').click();
    expect(a.qa('#xDlg .stleg span').map(s => s.textContent)).toEqual(['Free time', 'No type', 'Filtered out', 'Not planned']);
    const r = a.ev('statsRows("*",true)'); expect(r[0].slice(0, 6)).toEqual(['Person', 'Free time', 'No type', 'Filtered out (2 type(s))', 'Planned', 'Not planned']); expect(r[1][3]).toBe('16.00');
  });
  it('the button, the list and the new labels are translated', () => {
    const a = fresh(blank({ people, types }), { languages: ['es'] }); a.ev('stHide.clear();openStats("A")');
    expect(a.q('#xDlg .sttyb').textContent).toBe('Tipos de actividad: todos'); a.q('#xDlg .sttyb').click(); expect(a.q('.typop .oh').textContent).toBe('Tipos de actividad que se muestran');
    expect(a.qa('.typop .tyall').map(b => b.textContent)).toEqual(['Mostrar todos', 'Ocultar todos']); expect(a.qa('#xDlg .stu button').map(b => b.textContent)).toEqual(['Horas', '% de la semana', '% de lo planificado']);
  });
});
