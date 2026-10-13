import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, sched, ev1, person } from '../helpers/app.js';

const fresh = (data, o = {}) => { const a = openApp(o); if (data) setData(a, data); return a; };
const slot = (day, start, end, person = '') => ({ day, start, end, person });
const people = [person({ id: 'A', name: 'Ann' }), person({ id: 'B', name: 'Bob', color: '#2fa66a' })];
const agenda = (a, day = 0) => { a.ev(`openAgenda(${day})`); return a.q('#agBody'); };
const itemTitles = body => [...body.querySelectorAll('.atl')].map(e => e.textContent);
const itemTimes = body => [...body.querySelectorAll('.at')].map(e => e.textContent);

describe('R-PRN-01 Day agenda (click a day header)', () => {
  const day = () => fresh(blank({ people, schedules: [sched({ id: 's1', name: 'Home' })], events: [
    ev1({ id: 'b', title: 'Later', desc: 'Bring papers', involved: ['B'], slots: [slot(0, 840, 900, 'A')] }),
    ev1({ id: 'a', title: 'Earlier', slots: [slot(0, 540, 600)] }),
    ev1({ id: 'c', title: 'Other day', slots: [slot(1, 540, 600)] }),
  ] }));
  it('has the day name in the title and lists only that day\'s events', () => {
    const body = agenda(day()); expect(body.querySelector('h1').textContent).toBe('Monday — agenda'); expect(itemTitles(body)).toEqual(['Earlier', 'Later']);
  });
  it('lists the events in time order whatever order they were created in', () => {
    expect(itemTimes(agenda(day()))).toEqual(['09:00–10:00', '14:00–15:00']);
  });
  it('each item shows responsible person, involved people, schedules and the description', () => {
    const text = agenda(day()).querySelectorAll('.ai')[1].textContent;
    ['Later', 'Responsible:', 'Ann', 'With:', 'Bob', 'Schedules:', 'Home', 'Bring papers'].forEach(t => expect(text).toContain(t));
  });
  it('the left edge of each item uses the event colour', () => {
    const a = fresh(blank({ events: [ev1({ color: '#e5484d' })] })); expect(agenda(a).querySelector('.ai').style.borderLeftColor).toMatch(/#e5484d|rgb\(229, 72, 77\)/);
  });
  it('shows what is currently visible: hidden schedules and people filtered out events are not listed', () => {
    const a = day(); a.ev('S.people[0].visible=false;render()'); expect(itemTitles(agenda(a))).toEqual(['Earlier', 'Later']);   // Later is led by Ann but Bob is involved and visible
    a.ev('S.people[1].visible=false;render()'); expect(itemTitles(agenda(a))).toEqual(['Earlier']);
    a.ev('S.schedules[0].visible=false;render()'); expect(itemTitles(agenda(a))).toEqual([]);
  });
  it('an empty day says "Nothing scheduled."', () => {
    expect(agenda(fresh(blank()), 3).textContent).toContain('Nothing scheduled.');
  });
  it('an event that continues past midnight appears on the next day as "from Fri 22:00" starting at 00:00', () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(4, 1320, 1560)] })] })); const body = agenda(a, 5);
    expect(itemTimes(body)).toEqual(['00:00–02:00']); expect(body.textContent).toContain('from Friday 22:00');
  });
  it('on the first day the overnight event shows its full time range with (Next day)', () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(4, 1320, 1560)] })] })); expect(itemTimes(agenda(a, 4))).toEqual(['22:00–02:00 (Next day)']);
  });
  it('Sunday evening events continue on the Monday agenda', () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(6, 1380, 1500)] })] })); expect(itemTitles(agenda(a, 0))).toEqual(['Event']);
  });
  it('overlapping repetitions are marked with a warning', () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(0, 600, 720), slot(0, 660, 780)] })] })); expect(agenda(a).textContent).toContain('⚠');
  });
  it('lists the visible schedules and people at the top', () => {
    const t = agenda(day()).querySelector('.pm').textContent; expect(t).toContain('Schedules shown:'); expect(t).toContain('Home'); expect(t).toContain('People shown:'); expect(t).toContain('Ann'); expect(t).toContain('Bob');
  });
  it('"Print agenda" prints the list and the day-view button is offered', () => {
    const a = day(); agenda(a); a.q('#agPrint').click(); expect(a.w.__printCount).toBe(1); expect(a.w.__printed).toContain('Monday — agenda'); expect(a.q('#agPrint2').style.display).not.toBe('none');
  });
  it('the agenda dialog closes with its Close button', () => { const a = day(); agenda(a); a.q('#agClose').click(); expect(a.d.getElementById('agDlg').open).toBe(false); });
  it('the agenda is shown in the interface language', () => {
    const a = openApp({ languages: ['es'] }); setData(a, blank()); expect(agenda(a).querySelector('h1').textContent).toBe('Lunes — agenda'); expect(a.q('#agBody').textContent).toContain('Nada programado.');
  });
});

describe('R-PRN-02 Print schedule (the visible grid on paper)', () => {
  const printed = (a) => { a.toolbar('print').click(); return a.q('#pr'); };
  it('the toolbar print button prints a titled page with the grid', () => {
    const a = fresh(blank({ events: [ev1()] })); const pr = printed(a); expect(a.w.__printCount).toBe(1); expect(pr.querySelector('h1').textContent).toBe('Weekly schedule'); expect(pr.querySelectorAll('.ev')).toHaveLength(1); expect(pr.querySelectorAll('.dh:not(.c)')).toHaveLength(7);
  });
  it('lists the schedules and people that are shown, and none that are hidden', () => {
    const a = fresh(blank({ people, schedules: [sched({ id: 's1', name: 'Home' }), sched({ id: 's2', name: 'Work', visible: false })] })); a.ev('S.people[1].visible=false;render()');
    const meta = printed(a).querySelector('.pm').textContent; expect(meta).toContain('Home'); expect(meta).not.toContain('Work'); expect(meta).toContain('Ann'); expect(meta).not.toContain('Bob');
  });
  it('says "none" when everything is hidden and "(no people defined)" when there are no people', () => {
    const a = fresh(blank()); a.ev('S.schedules[0].visible=false;render()'); const meta = printed(a).querySelector('.pm').textContent; expect(meta).toContain('none'); expect(meta).toContain('(no people defined)');
  });
  it('is A4 portrait with a 10 mm margin', () => {
    const a = fresh(blank()); printed(a); expect(a.q('#pgStyle').textContent).toBe('@page{size:A4 portrait;margin:10mm}');
  });
  it('the red now line is left out of the print', () => {
    const a = fresh(blank()); a.ev('Date=class extends Date{constructor(...x){x.length?super(...x):super(2026,9,14,10,30)}};drawNow()'); expect(a.qa('.now')).toHaveLength(1); expect(printed(a).querySelectorAll('.now')).toHaveLength(0);
  });
  it('printing leaves the screen exactly as it was (zoom restored, print area emptied afterwards)', () => {
    const a = fresh(blank({ events: [ev1()] })); a.ev('prefs.rowH=90;render()'); printed(a); expect(a.ev('HH')).toBe(90); a.w.onafterprint(); expect(a.q('#pr').childElementCount).toBe(0);
  });
  it('only the print area is shown on paper and colours are printed exactly', () => {
    const css = fresh().d.querySelector('style').textContent; expect(css).toContain('body>*:not(#pr){display:none!important}'); expect(css).toContain('print-color-adjust:exact');
  });
  it('the printed grid keeps hidden early hours hidden and the hidden weekend hidden', () => {
    const a = fresh(blank({ events: [ev1()] })); a.ev('prefs.hideWeekend=true;render()'); const pr = printed(a); expect(pr.querySelectorAll('.dh:not(.c)')).toHaveLength(5); expect(pr.querySelector('.times span').textContent).toBe('05:00');
  });
});

describe('R-PRN-03 Print day view (one day on a page)', () => {
  const dayView = a => { agenda(a, 1); a.q('#agPrint2').click(); return a.q('#pr'); };
  const data = () => blank({ events: [ev1({ id: 'a', title: 'Monday event' }), ev1({ id: 'b', title: 'Tuesday event', slots: [slot(1, 600, 660)] })], rhythms: [{ id: 'r', name: 'R', visible: true }], phases: [{ id: 'p', title: 'Lunch', desc: '', color: '#3b6df0', rhythms: ['r'], slots: [0, 1, 2].map(d => ({ day: d, start: 720, end: 780 })) }] });
  it('prints a single day column with the time column and the day name as the title', () => {
    const pr = dayView(fresh(data())); expect(pr.querySelector('h1').textContent).toBe('Tuesday'); expect(pr.querySelectorAll('.dh:not(.c)')).toHaveLength(1); expect([...pr.querySelectorAll('.ev .t')].map(t => t.textContent)).toEqual(['Tuesday event']);
  });
  it('the single column fills the page width', () => {
    const grid = dayView(fresh(data())).querySelector('.grid'); expect(grid.style.gridTemplateColumns).toBe('52px 1fr'); expect(grid.classList.contains('one')).toBe(true);
  });
  it('phase labels that were bands (grouped across days) become proper labels again on the printed day', () => {
    const pr = dayView(fresh(data())); expect(pr.querySelectorAll('.lane .lbg')).toHaveLength(0); expect(pr.querySelector('.lane .lip span').textContent).toBe('Lunch');
  });
  it('is only offered in a day agenda, not in a rhythm agenda', () => {
    const a = fresh(data()); a.ev('openRhythmAgenda(S.rhythms[0])'); expect(a.q('#agPrint2').style.display).toBe('none');
  });
  it('the weekend join between the Saturday and Sunday headers is not printed on a single column', () => {
    const a = fresh(data()); agenda(a, 6); a.q('#agPrint2').click(); expect(a.q('#pr .dh.wj')).toBeNull();
  });
});
