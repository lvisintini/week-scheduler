import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, ev1, sched, dragFrom, dlgOpen, sleep } from '../helpers/app.js';

const fresh = data => { const a = openApp(); setData(a, data); return a; };
const slot = (day, start, end) => ({ day, start, end, person: '' });
const A = (o = {}) => ev1({ id: 'a', title: 'A', slots: [slot(0, 600, 720)], ...o });
const B = (o = {}) => ev1({ id: 'b', title: 'B', color: '#e5484d', slots: [slot(0, 660, 750)], ...o });
const press = async (a, col, min, move = false) => {
  const box = a.qa('.day')[col].querySelector('.ev');
  const fake = { clientX: a.x(col), clientY: a.y(min), button: 0, target: box, pointerType: 'mouse', stopPropagation() {}, preventDefault() {} };
  box.onpointerdown(fake);
  const to = move ? a.y(min + 90) : a.y(min);
  for (const type of move ? ['pointermove', 'pointerup'] : ['pointerup']) { const e = new a.w.MouseEvent(type, { clientX: a.x(col), clientY: to, bubbles: true }); Object.defineProperty(e, 'pointerType', { value: 'mouse' }); a.d.dispatchEvent(e); }
};
const menuItems = a => a.qa('.omenu .oi').map(b => b.textContent.replace(/\s+/g, ' ').trim());
const menuTitles = a => a.qa('.omenu .oi b').map(b => b.textContent);
const menuTitle = a => (a.q('.omenu .oh') || { textContent: '' }).textContent;
const dialogTitle = a => a.q('#fT').value;

describe('R-SEL-01 Clicking where things overlap', () => {
  it('a click that hits only one event opens it directly', async () => {
    const a = fresh(blank({ events: [A(), B()] })); await press(a, 0, 630);
    expect(dlgOpen(a)).toBe(true); expect(dialogTitle(a)).toBe('A'); expect(a.qa('.omenu')).toHaveLength(0);
  });
  it('a click where two different events overlap lists each event once', async () => {
    const a = fresh(blank({ events: [A(), B()] })); await press(a, 0, 690);
    expect(menuTitles(a)).toEqual(['A', 'B']); expect(menuTitle(a)).toBe('Several events here — pick one'); expect(dlgOpen(a)).toBe(false);
  });
  it('choosing an entry from the list opens that event', async () => {
    const a = fresh(blank({ events: [A(), B()] })); await press(a, 0, 690); a.qa('.omenu .oi')[1].click();
    expect(dlgOpen(a)).toBe(true); expect(dialogTitle(a)).toBe('B');
  });
  it('overlapping repetitions of the same event go straight to the event dialog, no list', async () => {
    const a = fresh(blank({ events: [A({ slots: [slot(0, 600, 720), slot(0, 660, 780)] })] })); await press(a, 0, 690);
    expect(dlgOpen(a)).toBe(true); expect(a.qa('.omenu')).toHaveLength(0);
  });
  it('when repetitions of one event and another event overlap, the event appears once in the list (repetitions grouped)', async () => {
    const a = fresh(blank({ events: [A({ slots: [slot(0, 600, 720), slot(0, 660, 780)] }), B()] })); await press(a, 0, 690);
    expect(menuItems(a)).toHaveLength(2);
  });
  it('the list closes with Escape', async () => {
    const a = fresh(blank({ events: [A(), B()] })); await press(a, 0, 690); await a.sleep(5); a.d.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); expect(a.qa('.omenu')).toHaveLength(0);
  });
});

describe('R-SEL-02 Dragging where things overlap asks which one you mean', () => {
  it('a drag over two overlapping events shows a list titled "pick the one to move"', async () => {
    const a = fresh(blank({ events: [A(), B()] })); await press(a, 0, 690, true);
    expect(menuTitle(a)).toBe('Several events or repetitions here — pick the one to move'); expect(menuItems(a)).toHaveLength(2);
  });
  it('for a drag every repetition is listed separately, with its day and times', async () => {
    const a = fresh(blank({ events: [A({ slots: [slot(0, 600, 720), slot(0, 660, 780)] }), B()] })); await press(a, 0, 690, true);
    expect(menuItems(a)).toHaveLength(3); expect(menuItems(a)[0]).toMatch(/Mon 10:00–12:00/); expect(menuItems(a)[1]).toMatch(/Mon 11:00–13:00/);
  });
  it('even two repetitions of the same event are listed when you drag where they overlap', async () => {
    const a = fresh(blank({ events: [A({ slots: [slot(0, 600, 720), slot(0, 660, 780)] })] })); await press(a, 0, 690, true);
    expect(menuItems(a)).toHaveLength(2);
  });
  it('nothing moves while the list is shown', async () => {
    const a = fresh(blank({ events: [A(), B()] })); await press(a, 0, 690, true);
    expect(a.ev('state.S.events.map(e=>e.slots[0].start)')).toEqual([600, 660]);
  });
  it('picking an entry selects exactly that repetition (outlined) and tells you to drag it', async () => {
    const a = fresh(blank({ events: [A(), B()] })); await press(a, 0, 690, true); a.qa('.omenu .oi')[1].click();
    expect(a.qa('.ev.sel')).toHaveLength(1); expect(a.q('.ev.sel .t').textContent).toBe('B'); expect(a.toast()).toContain('"B · Mon 11:00–12:30" selected: now drag it');
  });
  it('the selected repetition takes the next drag directly, without asking again', async () => {
    const a = fresh(blank({ events: [A(), B()] })); await press(a, 0, 690, true); a.qa('.omenu .oi')[1].click();
    const box = a.q('.ev.sel'); await dragFrom(a, box, { col: 0, min: 690 }, { col: 0, min: 780 });
    expect(a.qa('.omenu')).toHaveLength(0); expect(a.ev('state.S.events.map(e=>e.slots[0].start)')).toEqual([600, 750]);
  });
  it('Escape clears the selection', async () => {
    const a = fresh(blank({ events: [A(), B()] })); await press(a, 0, 690, true); a.qa('.omenu .oi')[0].click(); expect(a.ev('state.selK')).not.toBeNull();
    a.key('Escape'); expect(a.ev('state.selK')).toBeNull(); expect(a.qa('.ev.sel')).toHaveLength(0);
  });
  it('clicking empty space clears the selection', async () => {
    const a = fresh(blank({ events: [A(), B()] })); await press(a, 0, 690, true); a.qa('.omenu .oi')[0].click();
    const col = a.qa('.day')[3]; col.onpointerdown({ button: 0, target: col, clientX: a.x(3), clientY: a.y(600), pointerType: 'mouse', preventDefault() {} });
    expect(a.ev('state.selK')).toBeNull();
  });
  it('undo clears the selection', async () => {
    const a = fresh(blank({ events: [A(), B()] })); await press(a, 0, 690, true); a.qa('.omenu .oi')[0].click(); a.ev('hist()'); a.toolbar('undo').click(); expect(a.ev('state.selK')).toBeNull();
  });
  it('two events whose bottom edges are close together ask which one to resize', async () => {
    const a = fresh(blank({ events: [A({ slots: [slot(0, 600, 720)] }), B({ slots: [slot(0, 660, 724)] })] }));
    const box = a.qa('.day')[0].querySelector('.ev');
    box.onpointerdown({ clientX: a.x(0), clientY: a.y(718), button: 0, target: box._rz, pointerType: 'mouse', stopPropagation() {}, preventDefault() {} });
    const e = new a.w.MouseEvent('pointermove', { clientX: a.x(0), clientY: a.y(780), bubbles: true }); Object.defineProperty(e, 'pointerType', { value: 'mouse' }); a.d.dispatchEvent(e);
    expect(menuTitle(a)).toBe('Several events or repetitions here — pick the one to resize'); expect(menuItems(a)).toHaveLength(2);
  });
  it('a selected event is raised above its neighbours so its bottom edge can be reached', () => {
    const a = fresh(blank({ events: [A(), B()] })); const rule = [...a.d.styleSheets[0].cssRules].find(r => r.selectorText === '.ev.sel');
    expect(Number(rule.style.getPropertyValue('z-index'))).toBeGreaterThanOrEqual(1);
  });
});

const rightClick = (a, col, min) => a.qa('.day')[col].oncontextmenu({ clientX: a.x(col), clientY: a.y(min), preventDefault() {} });
const ctxRows = a => a.qa('.ctxm .cxr b').map(b => b.textContent);
const newTimes = a => { const r = a.qa('#fDays .dr:not(.dx)').find(x => x.querySelector('input').checked); return [a.qa('#fDays .dr:not(.dx)').indexOf(r), ...[...r.querySelectorAll('select')].slice(0, 2).map(s => s.value)]; };   // the new event's day and times
describe('R-SEL-03 Right-click opens the day\'s menu: each event under the pointer with Copy… and its lock, then + New event here', () => {
  it('right-clicking where two events overlap lists both under the day and time, each with Copy… and a lock button', () => {
    const a = fresh(blank({ events: [A(), B()] })); rightClick(a, 0, 690); expect(menuTitle(a)).toBe('Monday 11:30'); expect(ctxRows(a)).toEqual(['A', 'B']);
    expect(a.qa('.ctxm .cxr').map(r => [...r.querySelectorAll('button')].map(b => b.textContent || b.getAttribute('aria-pressed')))).toEqual([['Copy…', 'false'], ['Copy…', 'false']]);
    expect(a.q('.ctxm .cxk').getAttribute('aria-label')).toMatch(/^Lock "A": it can't be moved or opened/); expect(a.d.activeElement).toBe(a.q('.ctxm button'));
  });
  it('right-clicking empty space offers only "+ New event here", at the time under the pointer (snapped down to 15 minutes), for an hour', () => {
    const a = fresh(blank({ events: [A()] })); rightClick(a, 3, 607); expect(menuTitle(a)).toBe('Thursday 10:00'); expect(ctxRows(a)).toEqual([]);
    expect(a.q('.ctxm .cxn').textContent).toBe('+ New event here (10:00)'); a.q('.ctxm .cxn').click(); expect(a.qa('.omenu')).toHaveLength(0);
    expect(dlgOpen(a)).toBe(true); expect(newTimes(a)).toEqual([3, '600', '660']);
  });
  it('repetitions of one event appear once in the menu', () => {
    const a = fresh(blank({ events: [A({ slots: [slot(0, 600, 720), slot(0, 660, 780)] })] })); rightClick(a, 0, 690); expect(ctxRows(a)).toEqual(['A']);
  });
  it('Copy… opens the event\'s Copy dialog; Esc closes the menu', async () => {
    const a = fresh(blank({ events: [A()] })); rightClick(a, 0, 630); a.q('.ctxm .cxc').click(); expect(a.dlgTitle()).toBe('Copy event: A');
    a.click('Cancel'); rightClick(a, 0, 630); await sleep(0); a.d.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); expect(a.qa('.omenu')).toHaveLength(0);
  });
  it('R-EVT-26 the lock button locks the event (one undo step) and, once locked, unlocks it from the same menu', () => {
    const a = fresh(blank({ events: [A()] })); rightClick(a, 0, 630); a.q('.ctxm .cxk').click();
    expect(a.ev('state.S.events[0].locked')).toBe(true); expect(a.toast()).toBe('Locked: A'); expect(a.q('.ev').classList.contains('locked')).toBe(true); expect(a.qa('.omenu')).toHaveLength(0);
    rightClick(a, 0, 630); const lk = a.q('.ctxm .cxk'); expect(lk.getAttribute('aria-pressed')).toBe('true'); expect(lk.getAttribute('aria-label')).toBe('Unlock "A"'); lk.click();
    expect(a.ev('state.S.events[0].locked')).toBeUndefined(); expect(a.toast()).toBe('Unlocked: A'); expect(a.q('.ev').classList.contains('locked')).toBe(false);
    a.toolbar('undo').click(); expect(a.ev('state.S.events[0].locked')).toBe(true); a.toolbar('undo').click(); expect(a.ev('state.S.events[0].locked')).toBeUndefined();
  });
  it('R-SCH-02 an event locked by its schedule shows its lock pressed and disabled, saying the schedule is to be unlocked', () => {
    const a = fresh(blank({ schedules: [sched({ locked: true })], events: [A()] })); rightClick(a, 0, 630); const lk = a.q('.ctxm .cxk');
    expect(lk.disabled).toBe(true); expect(lk.getAttribute('aria-pressed')).toBe('true'); expect(lk.title).toBe('Locked by its schedule: unlock the schedule in the sidebar (its ⋯ menu)');
  });
  it('the menu\'s place, Copy…, + New event here and the lock\'s tooltip are translated into Spanish', () => {
    const a = fresh(blank({ events: [A()] })); a.ev("setLang('es')"); rightClick(a, 0, 630);
    expect(menuTitle(a)).toBe('Lunes 10:30'); expect(a.q('.ctxm .cxc').textContent).toBe('Copiar…'); expect(a.q('.ctxm .cxn').textContent).toBe('+ Nuevo evento aquí (10:30)'); expect(a.q('.ctxm .cxk').title).toMatch(/^Bloquear "A"/);
  });
  it('the browser\'s own context menu is suppressed on the grid', () => {
    const a = fresh(blank({ events: [A()] })); let prevented = false; a.qa('.day')[0].oncontextmenu({ clientX: 10, clientY: 10, preventDefault() { prevented = true; } }); expect(prevented).toBe(true);
  });
  it('a right-click press on an event does not start a drag or open the edit dialog (only the copy list)', async () => {
    const a = fresh(blank({ events: [A()] })); const box = a.q('.ev');
    box.onpointerdown({ clientX: a.x(0), clientY: a.y(630), button: 2, target: box, pointerType: 'mouse', stopPropagation() {}, preventDefault() {} });
    const up = new a.w.MouseEvent('pointerup', { clientX: a.x(0), clientY: a.y(630), bubbles: true }); Object.defineProperty(up, 'pointerType', { value: 'mouse' }); a.d.dispatchEvent(up);
    expect(dlgOpen(a)).toBe(false);
  });
  it('a middle-button press on an event does nothing either', async () => {
    const a = fresh(blank({ events: [A()] })); const box = a.q('.ev'); box.onpointerdown({ clientX: a.x(0), clientY: a.y(630), button: 1, target: box, pointerType: 'mouse', stopPropagation() {}, preventDefault() {} });
    const up = new a.w.MouseEvent('pointerup', { clientX: a.x(0), clientY: a.y(630), bubbles: true }); Object.defineProperty(up, 'pointerType', { value: 'mouse' }); a.d.dispatchEvent(up); expect(dlgOpen(a)).toBe(false);
  });
});

describe('R-SEL-04 Creating where editable events are in the way: Alt+drag over them, or "+ New event here"', () => {
  const altPress = (a, target, min, to = min) => {   // Alt held on an event (or its resize handle), then dragged to another time
    a.qa('.day')[0].querySelector('.ev').onpointerdown({ clientX: a.x(0), clientY: a.y(min), button: 0, altKey: true, target, pointerType: 'mouse', stopPropagation() {}, preventDefault() {} });
    for (const type of to !== min ? ['pointermove', 'pointerup'] : ['pointerup']) { const e = new a.w.MouseEvent(type, { clientX: a.x(0), clientY: a.y(to), bubbles: true }); Object.defineProperty(e, 'pointerType', { value: 'mouse' }); a.d.dispatchEvent(e); }
  };
  it('Alt+drag over an event draws a new event\'s range instead of moving it', () => {
    const a = fresh(blank({ events: [A()] })), box = a.q('.ev'); altPress(a, box, 630, 720);
    expect(dlgOpen(a)).toBe(true); expect(a.q('#fT').value).toBe(''); expect(newTimes(a)).toEqual([0, '630', '720']); expect(a.ev('JSON.stringify(state.S.events[0].slots)')).toBe(JSON.stringify([slot(0, 600, 720)]));
    a.q('#fT').value = 'New'; a.q('#fOk').click(); expect(a.ev('state.S.events.length')).toBe(2);
  });
  it('Alt+click on an event, without dragging, opens a new event there for an hour', () => {
    const a = fresh(blank({ events: [A()] })); altPress(a, a.q('.ev'), 660); expect(dlgOpen(a)).toBe(true); expect(a.q('#fT').value).toBe(''); expect(newTimes(a)).toEqual([0, '660', '720']);
  });
  it('Alt on an event\'s resize handle creates too, and leaves the event\'s end alone', () => {
    const a = fresh(blank({ events: [A()] })), box = a.q('.ev'); altPress(a, box._rz, 705, 765);
    expect(newTimes(a)).toEqual([0, '705', '765']); expect(a.ev('state.S.events[0].slots[0].end')).toBe(720);
  });
  it('"+ New event here" in the right-click menu over an event opens a new event at that time', () => {
    const a = fresh(blank({ events: [A(), B()] })); rightClick(a, 0, 700); a.q('.ctxm .cxn').click(); expect(newTimes(a)).toEqual([0, '690', '750']);
  });
});
