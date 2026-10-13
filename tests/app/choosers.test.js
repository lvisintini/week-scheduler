import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, ev1, dragFrom, dlgOpen } from '../helpers/app.js';

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
    expect(a.ev('S.events.map(e=>e.slots[0].start)')).toEqual([600, 660]);
  });
  it('picking an entry selects exactly that repetition (outlined) and tells you to drag it', async () => {
    const a = fresh(blank({ events: [A(), B()] })); await press(a, 0, 690, true); a.qa('.omenu .oi')[1].click();
    expect(a.qa('.ev.sel')).toHaveLength(1); expect(a.q('.ev.sel .t').textContent).toBe('B'); expect(a.toast()).toContain('"B · Mon 11:00–12:30" selected: now drag it');
  });
  it('the selected repetition takes the next drag directly, without asking again', async () => {
    const a = fresh(blank({ events: [A(), B()] })); await press(a, 0, 690, true); a.qa('.omenu .oi')[1].click();
    const box = a.q('.ev.sel'); await dragFrom(a, box, { col: 0, min: 690 }, { col: 0, min: 780 });
    expect(a.qa('.omenu')).toHaveLength(0); expect(a.ev('S.events.map(e=>e.slots[0].start)')).toEqual([600, 750]);
  });
  it('Escape clears the selection', async () => {
    const a = fresh(blank({ events: [A(), B()] })); await press(a, 0, 690, true); a.qa('.omenu .oi')[0].click(); expect(a.ev('selK')).not.toBeNull();
    a.key('Escape'); expect(a.ev('selK')).toBeNull(); expect(a.qa('.ev.sel')).toHaveLength(0);
  });
  it('clicking empty space clears the selection', async () => {
    const a = fresh(blank({ events: [A(), B()] })); await press(a, 0, 690, true); a.qa('.omenu .oi')[0].click();
    const col = a.qa('.day')[3]; col.onpointerdown({ button: 0, target: col, clientX: a.x(3), clientY: a.y(600), pointerType: 'mouse', preventDefault() {} });
    expect(a.ev('selK')).toBeNull();
  });
  it('undo clears the selection', async () => {
    const a = fresh(blank({ events: [A(), B()] })); await press(a, 0, 690, true); a.qa('.omenu .oi')[0].click(); a.ev('hist()'); a.toolbar('undo').click(); expect(a.ev('selK')).toBeNull();
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

describe('R-SEL-03 Right-click lists what is under the pointer and offers Copy', () => {
  const rightClick = (a, col, min) => a.qa('.day')[col].oncontextmenu({ clientX: a.x(col), clientY: a.y(min), preventDefault() {} });
  it('right-clicking where two events overlap lists both for copying', () => {
    const a = fresh(blank({ events: [A(), B()] })); rightClick(a, 0, 690); expect(menuTitle(a)).toBe('Copy event…'); expect(menuItems(a)).toHaveLength(2);
  });
  it('right-clicking empty space does nothing', () => {
    const a = fresh(blank({ events: [A()] })); rightClick(a, 3, 600); expect(a.qa('.omenu')).toHaveLength(0);
  });
  it('repetitions of one event appear once in the copy list', () => {
    const a = fresh(blank({ events: [A({ slots: [slot(0, 600, 720), slot(0, 660, 780)] })] })); rightClick(a, 0, 690); expect(menuItems(a)).toHaveLength(1);
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
