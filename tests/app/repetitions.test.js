import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, ev1, person, dragFrom, fillDialog, dlgOpen } from '../helpers/app.js';

const fresh = (data, o = {}) => { const a = openApp(o); if (data) setData(a, data); return a; };
const people = [person({ id: 'A', name: 'Ann' }), person({ id: 'B', name: 'Bob', color: '#2fa66a' })];
const slots = a => a.ev('JSON.parse(JSON.stringify(S.events[0].slots))');
const save = a => a.q('#fOk').click();
const rows = a => a.qa('#fDays .dr');
const slot = (day, start = 600, end = 660, person = '') => ({ day, start, end, person });
const three = () => fresh(blank({ events: [ev1({ slots: [slot(0), slot(2), slot(4)] })] }));
const toastButtons = a => [...a.q('#toast').querySelectorAll('button')].map(b => b.textContent);
const toastBtn = (a, t) => [...a.q('#toast').querySelectorAll('button')].find(b => b.textContent === t);

describe('R-REP-01 An event can repeat on chosen days with its own times and people', () => {
  it('ticking Monday, Wednesday and Friday creates three repetitions with the general times', () => {
    const a = fresh(blank()); a.toolbar('add').click(); fillDialog(a, { title: 'Shift', days: { 0: {}, 2: {}, 4: {} } }); save(a);
    expect(slots(a).map(s => [s.day, s.start, s.end])).toEqual([[0, 540, 600], [2, 540, 600], [4, 540, 600]]);
  });
  it('changing the general start/end moves every day that has not been changed by hand', () => {
    const a = fresh(blank()); a.toolbar('add').click(); fillDialog(a, { days: { 0: {}, 1: {} } });
    fillDialog(a, { start: '840', end: '900' });
    expect(rows(a).slice(0, 2).map(r => r.querySelectorAll('select')[0].value)).toEqual(['840', '840']);
  });
  it('a day with its own time keeps it when the general time changes later', () => {
    const a = fresh(blank()); a.toolbar('add').click(); fillDialog(a, { title: 'T', days: { 0: {}, 1: { start: '720', end: '780' } } }); fillDialog(a, { start: '840', end: '900' });
    save(a); expect(slots(a).map(s => [s.day, s.start, s.end])).toEqual([[0, 840, 900], [1, 720, 780]]);
  });
  it('each repetition can have its own responsible person, defaulting to the general one', () => {
    const a = fresh(blank({ people })); a.toolbar('add').click(); fillDialog(a, { title: 'T', person: 'A' }); fillDialog(a, { days: { 0: {}, 1: {}, 2: { person: 'B' } } });
    save(a); expect(slots(a).map(s => s.person)).toEqual(['A', 'A', 'B']);
  });
  it('all repetitions share the colour, title and schedules of the event', () => {
    const a = three(); expect(a.qa('.ev')).toHaveLength(3); expect(new Set(a.qa('.ev').map(b => b.style.background)).size).toBe(1);
  });
  it('a single repetition is removed by unticking its day and saving; the others stay', () => {
    const a = three(); a.ev('openDlg(S.events[0])'); fillDialog(a, { days: { 0: {}, 4: {} } }); save(a);
    expect(slots(a).map(s => s.day)).toEqual([0, 4]);
  });
  it('one repetition can be retimed in the dialog without touching the others', () => {
    const a = three(); a.ev('openDlg(S.events[0])'); const sel = rows(a)[2].querySelectorAll('select')[0]; sel.value = '780'; sel.dispatchEvent(new a.w.Event('change')); save(a);
    expect(slots(a).map(s => s.start)).toEqual([600, 780, 600]);
  });
  it('deleting the event deletes every repetition', () => {
    const a = three(); a.ev('openDlg(S.events[0])'); a.q('#fDel').click(); expect(a.ev('S.events.length')).toBe(0);
  });
});

describe('R-REP-02 Quick and Advanced repetition modes', () => {
  const advancedDialog = () => { const a = three(); a.ev('openDlg(S.events[0])'); a.q('#tabA').click(); return a; };
  it('the dialog opens in Quick mode with the Mon–Sun rows', () => {
    const a = three(); a.ev('openDlg(S.events[0])'); expect(a.q('#tabQ').classList.contains('on')).toBe(true); expect(a.q('#paneQ').style.display).not.toBe('none'); expect(a.q('#paneA').style.display).toBe('none'); expect(rows(a)).toHaveLength(7);
  });
  it('switching to Advanced turns the ticked days into blocks with day, start, end and person', () => {
    const a = advancedDialog(); expect(a.qa('#fBlocks .br')).toHaveLength(3); expect(a.qa('#fBlocks .br').map(b => b.querySelector('select').value)).toEqual(['0', '2', '4']);
    expect(a.q('#paneA').style.display).not.toBe('none'); expect(a.q('#paneQ').style.display).toBe('none');
  });
  it('"+ Add block" adds a one-hour block after the last one', () => {
    const a = advancedDialog(); a.q('#fAddBlock').click(); const b = a.qa('#fBlocks .br').at(-1).querySelectorAll('select');
    expect([b[0].value, b[1].value, b[2].value]).toEqual(['4', '660', '720']);
  });
  it('a second block on the same day is allowed in Advanced mode and saved', () => {
    const a = advancedDialog(); a.q('#fAddBlock').click(); save(a);
    expect(slots(a).filter(s => s.day === 4)).toHaveLength(2);
  });
  it('once a day has two blocks the Quick tab is disabled and says why', () => {
    const a = advancedDialog(); a.q('#fAddBlock').click();
    expect(a.q('#tabQ').disabled).toBe(true); expect(a.q('#tabQ').title).toContain("Quick mode can't show several blocks on the same day");
  });
  it('removing the extra block makes the Quick tab available again', () => {
    const a = advancedDialog(); a.q('#fAddBlock').click(); a.qa('#fBlocks .br').at(-1).querySelector('.bx').click(); expect(a.q('#tabQ').disabled).toBe(false);
  });
  it('the last remaining block cannot be removed', () => {
    const a = fresh(blank({ events: [ev1()] })); a.ev('openDlg(S.events[0])'); a.q('#tabA').click(); expect(a.q('#fBlocks .bx').disabled).toBe(true);
  });
  it('an event that already has two blocks on one day opens directly in Advanced mode', () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(0, 540, 600), slot(0, 840, 900)] })] })); a.ev('openDlg(S.events[0])');
    expect(a.q('#tabA').classList.contains('on')).toBe(true); expect(a.qa('#fBlocks .br')).toHaveLength(2); expect(a.q('#tabQ').disabled).toBe(true);
  });
  it('going back from Advanced to Quick restores the day rows', () => {
    const a = advancedDialog(); a.q('#tabQ').click(); expect(rows(a).map(r => r.querySelector('input').checked)).toEqual([true, false, true, false, true, false, false]);
  });
  it('blocks can be edited and are saved in day-and-time order', () => {
    const a = advancedDialog(); const b = a.qa('#fBlocks .br')[0].querySelectorAll('select'); b[0].value = '5'; b[0].dispatchEvent(new a.w.Event('change')); save(a);
    expect(slots(a).map(s => s.day)).toEqual([2, 4, 5]);
  });
  it('end times at or before the start are disabled in the end list', () => {
    const a = fresh(blank()); a.toolbar('add').click(); const end = a.q('#fE'); const disabled = [...end.options].filter(o => o.disabled).map(o => +o.value);
    expect(Math.max(...disabled)).toBe(540); expect(disabled.every(v => v <= 540)).toBe(true);
  });
});

describe('R-REP-03 The end-time list reaches the end of the next day', () => {
  it('lists 192 end times, from 00:15 to 00:00 (Day after next)', () => {
    const a = fresh(blank()); a.toolbar('add').click(); const opts = [...a.q('#fE').options];
    expect(opts.length).toBe(192); expect(opts[0].textContent).toBe('00:15'); expect(opts.at(-1).textContent).toBe('00:00 (Day after next)'); expect(opts.at(-1).value).toBe('2880');
  });
  it('an end of "01:30 (Next day)" saves an event that ends at minute 1530', () => {
    const a = fresh(blank()); a.toolbar('add').click(); fillDialog(a, { title: 'Night', start: '1320', end: '1530' }); save(a);
    expect(slots(a)[0]).toMatchObject({ start: 1320, end: 1530 });
  });
  it('phases (which stay inside a day) only offer end times up to 00:00', () => {
    const a = fresh({ ...blank(), rhythms: [{ id: 'r', name: 'R', visible: true }] }); a.ev("editMode='phases';openDlg(null)");
    const opts = [...a.q('#fE').options]; expect(opts.at(-1).textContent).toBe('00:00'); expect(opts).toHaveLength(96);
  });
});

describe('R-REP-05 Overlapping repetitions are allowed but warned about', () => {
  it('in the dialog an overnight repetition that runs into the next day\'s repetition shows ⚠ on both rows and a summary line', () => {
    const a = fresh(blank()); a.toolbar('add').click(); fillDialog(a, { title: 'T', days: { 0: { start: '1320', end: '1530' }, 1: { start: '30', end: '120' } } });
    expect(rows(a).slice(0, 2).map(r => r.querySelector('.wn').style.visibility)).toEqual(['visible', 'visible']);
    expect(a.q('#fWarn').textContent).toBe('⚠ Some repetitions overlap: Monday, Tuesday');
  });
  it('rows that do not overlap show no warning and the summary line is empty', () => {
    const a = fresh(blank()); a.toolbar('add').click(); fillDialog(a, { days: { 0: {}, 1: {} } });
    expect(a.q('#fWarn').textContent).toBe(''); expect(rows(a).every(r => r.querySelector('.wn').style.visibility !== 'visible')).toBe(true);
  });
  it('in Advanced mode two overlapping blocks of the same day are flagged', () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(0, 600, 720), slot(0, 660, 780)] })] })); a.ev('openDlg(S.events[0])');
    expect(a.qa('#fBlocks .br .wn').map(w => w.style.visibility)).toEqual(['visible', 'visible']); expect(a.q('#fWarn').textContent).toContain('Monday');
  });
  it('an event with overlapping repetitions can still be saved', () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(0, 600, 720), slot(0, 660, 780)] })] })); a.ev('openDlg(S.events[0])'); save(a);
    expect(dlgOpen(a)).toBe(false); expect(slots(a)).toHaveLength(2);
  });
  it('dragging a repetition so that it newly overlaps another one shows a warning toast with Undo', async () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(5, 1320, 1440), slot(6, 30, 90)] })] }));
    const box = a.q('.day[data-d="5"] .ev'); await dragFrom(a, box, { col: 5, min: 1435 }, { col: 6, min: 420 }, { target: box.querySelector('.rz') });
    expect(slots(a)[0].end).toBe(1860); expect(a.toast()).toContain('⚠ Some repetitions now overlap'); expect(toastButtons(a)).toContain('Undo');
  });
});

describe('R-REP-06 Dragging a repeating event changes all repetitions; Shift changes one', () => {
  it('moving one repetition moves every repetition by the same number of days and minutes', async () => {
    const a = three(); await dragFrom(a, a.q('.day[data-d="0"] .ev'), { col: 0, min: 630 }, { col: 1, min: 690 });
    expect(slots(a).map(s => [s.day, s.start, s.end])).toEqual([[1, 660, 720], [3, 660, 720], [5, 660, 720]]);
  });
  it('the other repetitions already follow while the mouse is still moving (live preview)', async () => {
    const a = three(); const box = a.q('.day[data-d="0"] .ev'); const w = a.w;
    box.onpointerdown({ clientX: a.x(0), clientY: a.y(630), button: 0, target: box, pointerType: 'mouse', stopPropagation() {}, preventDefault() {} });
    const move = new w.MouseEvent('pointermove', { clientX: a.x(0), clientY: a.y(750), bubbles: true }); Object.defineProperty(move, 'pointerType', { value: 'mouse' }); a.d.dispatchEvent(move);
    expect(slots(a).map(s => s.start)).toEqual([720, 720, 720]);
    const up = new w.MouseEvent('pointerup', { clientX: a.x(0), clientY: a.y(750), bubbles: true }); Object.defineProperty(up, 'pointerType', { value: 'mouse' }); a.d.dispatchEvent(up);
  });
  it('holding Shift changes only the grabbed repetition', async () => {
    const a = three(); await dragFrom(a, a.q('.day[data-d="0"] .ev'), { col: 0, min: 630 }, { col: 0, min: 750 }, { shift: true });
    expect(slots(a).map(s => s.start)).toEqual([720, 600, 600]);
  });
  it('Shift can also be pressed in the middle of the drag', async () => {
    const a = three(); const box = a.q('.day[data-d="0"] .ev');
    box.onpointerdown({ clientX: a.x(0), clientY: a.y(630), button: 0, target: box, pointerType: 'mouse', shiftKey: false, stopPropagation() {}, preventDefault() {} });
    for (const type of ['pointermove', 'pointerup']) { const e = new a.w.MouseEvent(type, { clientX: a.x(0), clientY: a.y(750), shiftKey: true, bubbles: true }); Object.defineProperty(e, 'pointerType', { value: 'mouse' }); a.d.dispatchEvent(e); }
    expect(slots(a).map(s => s.start)).toEqual([720, 600, 600]);
  });
  it('after an all-repetitions drop a toast offers "Only this day" and "Undo"', async () => {
    const a = three(); await dragFrom(a, a.q('.day[data-d="0"] .ev'), { col: 0, min: 630 }, { col: 0, min: 750 });
    expect(a.toast()).toContain('Applied to all 3 repetitions'); expect(toastButtons(a)).toEqual(['Only this day', 'Undo']);
  });
  it('"Only this day" keeps the change for the grabbed repetition and puts the others back', async () => {
    const a = three(); await dragFrom(a, a.q('.day[data-d="0"] .ev'), { col: 0, min: 630 }, { col: 0, min: 750 }); toastBtn(a, 'Only this day').click();
    expect(slots(a).map(s => s.start)).toEqual([720, 600, 600]);
  });
  it('"Undo" in the toast restores all repetitions', async () => {
    const a = three(); await dragFrom(a, a.q('.day[data-d="0"] .ev'), { col: 0, min: 630 }, { col: 0, min: 750 }); toastBtn(a, 'Undo').click();
    expect(slots(a).map(s => s.start)).toEqual([600, 600, 600]);
  });
  it('the toast buttons do nothing once something else has changed in between', async () => {
    const a = three(); await dragFrom(a, a.q('.day[data-d="0"] .ev'), { col: 0, min: 630 }, { col: 0, min: 750 });
    a.ev('hist();S.events[0].title="Renamed"'); toastBtn(a, 'Only this day').click(); toastBtn(a, 'Undo').click();
    expect(slots(a).map(s => s.start)).toEqual([720, 720, 720]); expect(a.ev('S.events[0].title')).toBe('Renamed');
  });
  it('resizing one repetition lengthens or shortens all of them by the same amount', async () => {
    const a = three(); const box = a.q('.day[data-d="0"] .ev'); await dragFrom(a, box, { col: 0, min: 655 }, { col: 0, min: 690 }, { target: box.querySelector('.rz') });
    expect(slots(a).map(s => s.end - s.start)).toEqual([90, 90, 90]);
  });
  it('resizing never removes a repetition: every one keeps at least 15 minutes', async () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(0, 600, 720), slot(1, 600, 630), slot(2, 600, 660)] })] }));
    const box = a.q('.day[data-d="0"] .ev'); await dragFrom(a, box, { col: 0, min: 715 }, { col: 0, min: 612 }, { target: box.querySelector('.rz') });
    expect(slots(a)).toHaveLength(3); expect(slots(a).every(s => s.end - s.start >= 15)).toBe(true); expect(slots(a)[1].end - slots(a)[1].start).toBe(15);
  });
  it('when the whole set is moved a Sunday repetition wraps to Monday', async () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(3), slot(6)] })] })); await dragFrom(a, a.q('.day[data-d="3"] .ev'), { col: 3, min: 630 }, { col: 4, min: 630 });
    expect(slots(a).map(s => s.day)).toEqual([4, 0]);
  });
  it('dragging the bottom handle into the next day\'s column extends the event past midnight', async () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(5, 1320, 1440)] })] })); const box = a.q('.day[data-d="5"] .ev');
    await dragFrom(a, box, { col: 5, min: 1435 }, { col: 6, min: 120 }, { target: box.querySelector('.rz') });
    expect(slots(a)[0].end).toBe(1560);
  });
  it('a single-day quick event moves freely; a quick event will not let one repetition land on a day that already has one', async () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(0), slot(1)] })] })); await dragFrom(a, a.q('.day[data-d="0"] .ev'), { col: 0, min: 630 }, { col: 1, min: 750 }, { shift: true });
    expect(slots(a)[0].day).toBe(0); expect(slots(a)[0].start).toBe(720);
  });
  it('an Advanced event (already having two blocks on a day) may place a repetition on a day that has one', async () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(0, 540, 600), slot(0, 840, 900), slot(1)] })] }));
    await dragFrom(a, a.q('.day[data-d="0"] .ev'), { col: 0, min: 570 }, { col: 1, min: 750 }, { shift: true });
    expect(slots(a).filter(s => s.day === 1)).toHaveLength(2);
  });
  it('each repetition stays within the day when everything is moved late: starts are capped at 23:45', async () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(0, 600, 660), slot(1, 960, 1020)] })] })); await dragFrom(a, a.q('.day[data-d="0"] .ev'), { col: 0, min: 630 }, { col: 0, min: 1435 });
    expect(slots(a).every(s => s.start <= 1425)).toBe(true);
  });
});

describe('R-REP-07 Dragging repeating events never asks for confirmation', () => {
  it('no dialog opens and no confirm box appears while moving or resizing repetitions', async () => {
    const a = three(); await dragFrom(a, a.q('.day[data-d="0"] .ev'), { col: 0, min: 630 }, { col: 1, min: 750 });
    const box = a.q('.day[data-d="1"] .ev'); await dragFrom(a, box, { col: 1, min: 790 }, { col: 1, min: 820 }, { target: box.querySelector('.rz') });
    expect(a.dlgOpen()).toBe(false); expect(a.log.confirms).toEqual([]); expect(a.log.alerts).toEqual([]);
  });
});
