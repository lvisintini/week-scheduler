import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, sched, ev1, person, dragFrom, createDrag, fillDialog, dlgOpen, sleep, pointer, PREFS_KEY } from '../helpers/app.js';

const fresh = (data, o = {}) => { const a = openApp(o); if (data) setData(a, data); return a; };
const people = [person({ id: 'A', name: 'Ann', color: '#e5484d' }), person({ id: 'B', name: 'Bob', color: '#2fa66a' }), person({ id: 'C', name: 'Cy', color: '#8e4ec6' })];
const save = a => a.q('#fOk').click();
const events = a => a.ev('JSON.parse(JSON.stringify(S.events))');
const iconHTML = (a, k) => a.ev(`(()=>{const d=document.createElement("span");d.innerHTML=tIcon(${JSON.stringify(k)});return d.innerHTML})()`);   // as the browser serialises it
const cssRule = (a, selector) => [...a.d.styleSheets[0].cssRules].find(r => r.selectorText === selector);
const rowT = (a, d) => { const r = a.qa('#fDays .dr')[d].querySelectorAll('select'); return [r[0].value, r[1].value]; };   // a day's start and end in the dialog
const change = (a, el, v) => { el.value = v; el.dispatchEvent(new a.w.Event('change')); };

describe('R-EVT-01 Creating, moving, resizing and removing events', () => {
  it('the + button opens a new-event dialog on Monday 09:00–10:00', () => {
    const a = fresh(); a.toolbar('add').click();
    expect(dlgOpen(a)).toBe(true); expect(rowT(a, 0)).toEqual(['540', '600']);
    expect(a.qa('#fDays .dr').map(r => r.querySelector('input').checked)).toEqual([true, false, false, false, false, false, false]);
  });
  it('dragging over empty space creates an event for that time range, snapped to 15 minutes', async () => {
    const a = fresh(blank()); await createDrag(a, { col: 2, min: 607 }, { col: 2, min: 698 });
    expect(dlgOpen(a)).toBe(true); expect(rowT(a, 2)).toEqual(['600', '705']);
    expect(a.qa('#fDays .dr').map(r => r.querySelector('input').checked)).toEqual([false, false, true, false, false, false, false]);
  });
  it('a plain click on empty space creates a one-hour event at that time', async () => {
    const a = fresh(blank()); await createDrag(a, { col: 1, min: 780 }, { col: 1, min: 780 }, { move: false });
    expect(rowT(a, 1)).toEqual(['780', '840']);
  });
  it('a saved event is drawn as a rounded box in its own colour at the right place', () => {
    const a = fresh(blank({ events: [ev1({ color: '#e5484d', slots: [{ day: 3, start: 660, end: 750, person: '' }] })] }));
    const box = a.q('.day[data-d="3"] .ev');
    expect(box.style.background).toMatch(/#e5484d|rgb\(229, 72, 77\)/); expect(box.style.top).toBe(`${(660 - 300) / 60 * 48}px`); expect(parseFloat(box.style.height)).toBeCloseTo(90 / 60 * 48 - 1, 0);
    expect(cssRule(a, '.ev').style.getPropertyValue('border-radius')).toBe('8px');
  });
  it('dragging an event moves it to another day and time (snapped to 15 minutes)', async () => {
    const a = fresh(blank({ events: [ev1()] }));
    await dragFrom(a, a.q('.ev'), { col: 0, min: 630 }, { col: 2, min: 757 });
    expect(events(a)[0].slots[0]).toMatchObject({ day: 2, start: 720, end: 780 });
  });
  it('an event cannot be dragged outside the day: it stops at midnight with its length intact', async () => {
    const a = fresh(blank({ events: [ev1()] }));
    await dragFrom(a, a.q('.ev'), { col: 0, min: 630 }, { col: 0, min: 1439 });
    const s = events(a)[0].slots[0]; expect(s.end - s.start).toBe(60); expect(s.start).toBeLessThanOrEqual(1425);
  });
  it('dragging the bottom edge resizes the event', async () => {
    const a = fresh(blank({ events: [ev1()] })); const box = a.q('.ev');
    await dragFrom(a, box, { col: 0, min: 655 }, { col: 0, min: 706 }, { target: box._rz });
    expect(events(a)[0].slots[0]).toMatchObject({ start: 600, end: 705 });
  });
  it('events may overlap other events and both stay', () => {
    const a = fresh(blank({ events: [ev1({ id: 'a' }), ev1({ id: 'b', title: 'Other' })] })); expect(a.qa('.ev')).toHaveLength(2);
  });
  it('an event is removed with the Delete button of its dialog', () => {
    const a = fresh(blank({ events: [ev1()] })); a.ev('openDlg(S.events[0])'); a.q('#fDel').click();
    expect(events(a)).toHaveLength(0); expect(dlgOpen(a)).toBe(false); expect(a.qa('.ev')).toHaveLength(0);
  });
});

describe('R-EVT-02 Event fields and validation', () => {
  it('a title is required: saving without one shows an error and creates nothing', () => {
    const a = fresh(blank({ people })); a.toolbar('add').click(); save(a);
    expect(a.q('#err').textContent).toBe('Title is required.'); expect(events(a)).toHaveLength(0); expect(dlgOpen(a)).toBe(true);
  });
  it('at least one schedule is required', () => {
    const a = fresh(blank()); a.toolbar('add').click(); fillDialog(a, { title: 'X', schedules: [] }); save(a);
    expect(a.q('#err').textContent).toBe('Pick at least one schedule.'); expect(events(a)).toHaveLength(0);
  });
  it('at least one day is required to save an event', () => {
    const a = fresh(blank()); a.toolbar('add').click(); fillDialog(a, { title: 'X', days: {} }); save(a);
    expect(a.q('#err').textContent).toBe('Pick at least one day.');
  });
  it('an end time at or before the start time is refused with the day named', () => {
    const a = fresh(blank()); a.toolbar('add').click(); fillDialog(a, { title: 'X' });
    a.qa('#fDays .dr')[0].querySelectorAll('select')[1].value = '540'; save(a);
    expect(a.q('#err').textContent).toBe('Monday: end must be after start.'); expect(events(a)).toHaveLength(0);
  });
  it('the description, responsible person and involved people are optional', () => {
    const a = fresh(blank({ people })); a.toolbar('add').click(); fillDialog(a, { title: 'Minimal' }); save(a);
    expect(events(a)[0]).toMatchObject({ title: 'Minimal', desc: '', involved: [] }); expect(events(a)[0].slots[0].person).toBe('');
  });
  it('the owner list offers "none" and every person; each day offers the owner, nobody or anyone; the involved list offers every person', () => {
    const a = fresh(blank({ people })); a.toolbar('add').click();
    expect([...a.q('#fOw').options].map(o => o.textContent)).toEqual(['— none —', 'Ann', 'Bob', 'Cy']);
    expect([...a.qa('#fDays .dr')[0].querySelectorAll('select')[2].options].map(o => o.textContent)).toEqual(['Owner (nobody yet)', 'Nobody (concerns everyone)', 'Ann', 'Bob', 'Cy']);
    expect(a.qa('#fInv label').map(l => l.textContent)).toEqual(['Ann', 'Bob', 'Cy']);
  });
  it('saving stores every field, trimming the title and description', () => {
    const a = fresh(blank({ people, schedules: [sched({ id: 's1' }), sched({ id: 's2', name: 'S2' })] })); a.toolbar('add').click();
    fillDialog(a, { title: '  Planning  ', desc: ' notes ', person: 'A', involved: ['B', 'C'], schedules: ['s1', 's2'] }); save(a);
    expect(events(a)[0]).toMatchObject({ title: 'Planning', desc: 'notes', involved: ['B', 'C'], schedules: ['s1', 's2'] });
    expect(events(a)[0].slots[0].person).toBe('A');
  });
  it('editing an existing event shows its stored values', () => {
    const a = fresh(blank({ people, events: [ev1({ title: 'Existing', desc: 'old', involved: ['B'], slots: [{ day: 1, start: 840, end: 900, person: 'A' }] })] }));
    a.ev('openDlg(S.events[0])');
    expect(a.q('#fT').value).toBe('Existing'); expect(a.q('#fD').value).toBe('old'); expect(a.q('#fOw').value).toBe(''); expect(a.qa('#fDays .dr')[1].querySelectorAll('select')[2].value).toBe('A');
    expect(a.qa('#fInv input').filter(i => i.checked).map(i => i.value)).toEqual(['B']); expect(rowT(a, 1)).toEqual(['840', '900']);
  });
  it('the dialog Cancel button discards changes', () => {
    const a = fresh(blank({ events: [ev1({ title: 'Keep' })] })); a.ev('openDlg(S.events[0])'); a.q('#fT').value = 'Changed'; a.q('#fCancel').click();
    expect(events(a)[0].title).toBe('Keep'); expect(dlgOpen(a)).toBe(false);
  });
  it('every change is one undo step', () => {
    const a = fresh(blank()); a.toolbar('add').click(); fillDialog(a, { title: 'New' }); save(a);
    expect(events(a)).toHaveLength(1); a.toolbar('undo').click(); expect(events(a)).toHaveLength(0);
  });
});

describe('R-EVT-03 What an event box shows', () => {
  const full = () => fresh(blank({ people, events: [ev1({ title: 'Standup', desc: 'Secret description', involved: ['B', 'C'], slots: [{ day: 0, start: 600, end: 720, person: 'A' }] })] }));
  it('row 1: the responsible person\'s icon (in their colour) sits just before the title', () => {
    const t = full().q('.ev .r1 .t'); expect(t.firstElementChild.classList.contains('ic')).toBe(true); expect(t.firstElementChild.style.color).toMatch(/#e5484d|rgb\(229, 72, 77\)/); expect(t.textContent).toBe('Standup');
  });
  it('row 1: the time range is on the right of the title row, before the status icons', () => {
    const r1 = full().q('.ev .r1'); expect([...r1.children].map(c => c.className)).toEqual(['t', 'tm']); expect(r1.querySelector('.tm').textContent).toBe('10:00–12:00');
  });
  it('row 2: "By: <name>" without an icon on the left, "With: <people with icons>" on the right', () => {
    const r2 = full().q('.ev .r2'); expect(r2.querySelector('.by').textContent).toBe('By: Ann'); expect(r2.querySelector('.by .ic')).toBeNull();
    expect(r2.querySelector('.wi').textContent.trim()).toBe('With: Bob, Cy'); expect(r2.querySelectorAll('.wi .ic')).toHaveLength(2);
  });
  it('the description is never shown in the box', () => {
    const a = full(); expect(a.q('.ev').textContent).not.toContain('Secret'); expect(a.q('.ev .r3')).toBeNull();
  });
  it('without a responsible person there is no icon before the title and no "By:"', () => {
    const a = fresh(blank({ people, events: [ev1({ involved: ['B'] })] })); expect(a.q('.ev .t .ic')).toBeNull(); expect(a.q('.ev .by')).toBeNull(); expect(a.q('.ev .wi').textContent).toContain('With: Bob');
  });
  it('without anyone involved or responsible there is no second row at all', () => {
    expect(fresh(blank({ events: [ev1()] })).q('.ev .r2')).toBeNull();
  });
  it('person icons inside event boxes are small (10 px at 100 % text) so they match the text', () => {
    const a = full(); expect(cssRule(a, '.ev .ic svg').style.getPropertyValue('width')).toBe('calc(10px * var(--ts,1))');
  });
  it('an event that continues overnight labels its second piece "from Fri 22:00 · until 02:00"', () => {
    const a = fresh(blank({ events: [ev1({ slots: [{ day: 4, start: 1320, end: 1560, person: '' }] })] })); a.ev('prefs.showEarly=true;render()');
    expect(a.q('.day[data-d="4"] .ev .tm').textContent).toBe('22:00–02:00 (Next day)'); expect(a.q('.day[data-d="5"] .ev .tm').textContent).toBe('from Fri 22:00 · until 02:00');
  });
});

describe('R-EVT-04 Status icons at the top right of the box', () => {
  const flags = a => a.qa('.ev .flags > *').length;
  it('a plain single event has no status icon', () => { expect(flags(fresh(blank({ events: [ev1()] })))).toBe(0); });
  it('an event with several repetitions shows the repeat icon on each piece', () => {
    const a = fresh(blank({ events: [ev1({ slots: [{ day: 0, start: 600, end: 660, person: '' }, { day: 1, start: 600, end: 660, person: '' }] })] }));
    expect(a.qa('.ev').every(b => b.querySelectorAll('.flags > *').length === 1)).toBe(true);
  });
  it('overlapping repetitions of one event additionally show a yellow warning icon', () => {
    const a = fresh(blank({ events: [ev1({ slots: [{ day: 0, start: 600, end: 720, person: '' }, { day: 0, start: 660, end: 780, person: '' }] })] }));
    expect(a.q('.ev .flags b')).not.toBeNull(); expect(a.q('.ev .flags b').style.color).toMatch(/#ffd23f|rgb\(255, 210, 63\)/);
  });
  it('a locked event shows a lock icon', () => {
    expect(fresh(blank({ schedules: [sched({ locked: true })], events: [ev1()] })).qa('.ev .flags > *')).toHaveLength(1);
  });
  it('the title keeps clear of the icons (padding grows with the number of icons and with the text size)', () => {
    const a = fresh(blank({ schedules: [sched({ locked: true })], events: [ev1({ slots: [{ day: 0, start: 600, end: 660, person: '' }, { day: 1, start: 600, end: 660, person: '' }] })] }));
    expect(a.q('.ev .r1').style.paddingRight).toBe('calc(32px * var(--ts,1))');
  });
});

describe('R-EVT-05 Hover card and clipped boxes', () => {
  // (jsdom has no pointer-event handler attributes, so the column's handler is called directly)
  const hover = (a, col, min, o = {}) => a.qa('.day')[col].onpointermove({ pointerType: o.type || 'mouse', buttons: o.buttons || 0, clientX: a.x(col), clientY: a.y(min) });
  const rich = () => fresh(blank({ people, events: [ev1({ title: 'Review', desc: 'Bring the printed report', involved: ['B'], slots: [{ day: 0, start: 600, end: 720, person: 'A' }, { day: 1, start: 600, end: 720, person: 'A' }] })] }));
  it('hovering an event for a moment shows a card with title, time, By, With, full description and schedules', async () => {
    const a = rich(); hover(a, 0, 650); await sleep(420);
    const card = a.q('#peek'); expect(card.style.display).toBe('block');
    ['Review', '10:00–12:00', 'By: Ann', 'With:', 'Bob', 'Bring the printed report', 'Schedules:', 'S1'].forEach(t => expect(card.textContent).toContain(t));
  });
  it('the card also explains the repeat behaviour for repeating events, without the number of repetitions', async () => {
    const a = rich(); hover(a, 0, 650); await sleep(420);
    expect(a.q('#peek').textContent).toContain('Dragging changes all repetitions; hold Shift to change only this one.'); expect(a.q('#peek').textContent).not.toMatch(/2 days|repeats on/i);
  });
  it('moving off the event hides the card again', async () => {
    const a = rich(); hover(a, 0, 650); await sleep(420); hover(a, 3, 650); expect(a.q('#peek').style.display).toBe('none');
  });
  it('no card appears while a mouse button is held (dragging) or for touch input', async () => {
    const a = rich(); hover(a, 0, 650, { buttons: 1 }); await sleep(420); expect(a.q('#peek').style.display).not.toBe('block');
    hover(a, 0, 651, { type: 'touch' }); await sleep(420); expect(a.q('#peek').style.display).not.toBe('block');
  });
  it('the card works over locked events too (they are click-through boxes)', async () => {
    const a = fresh(blank({ schedules: [sched({ locked: true })], events: [ev1({ title: 'Locked one' })] })); hover(a, 0, 630); await sleep(420);
    expect(a.q('#peek').textContent).toContain('Locked one'); expect(a.q('#peek').textContent).toContain("Locked: can't be moved or edited.");
  });
  it('overlapping events are listed together, topmost first, up to three', async () => {
    const a = fresh(blank({ events: ['a', 'b', 'c', 'd'].map(id => ev1({ id, title: 'Event ' + id })) })); a.qa('.day')[0].onpointermove({ pointerType: 'mouse', buttons: 0, clientX: 95, clientY: a.y(630) }); await sleep(420);
    const titles = a.qa('#peek .pt1').map(t => t.textContent); expect(titles).toEqual(['Event d', 'Event c', 'Event b']);
  });
  const stubBox = (H, r2top, r3, titleOverflow = false) => {
    const a = fresh(blank({ events: [] })); const d = a.d.createElement('div'); d.className = 'ev';
    const r1 = a.d.createElement('div'); r1.className = 'r1'; const t = a.d.createElement('span'); t.className = 't'; r1.append(t); const r2 = a.d.createElement('div'); r2.className = 'r2'; d.append(r1, r2);
    const def = (o, p, v) => Object.defineProperty(o, p, { get: () => v, configurable: true });
    def(d, 'clientHeight', H); def(r2, 'offsetTop', r2top); def(r2, 'offsetHeight', 15); def(t, 'scrollWidth', titleOverflow ? 50 : 10); def(t, 'clientWidth', 10);
    a.w.fitBox(d); return d;
  };
  it('a box with room for the By/With row keeps it and shows no marker', () => {
    const d = stubBox(60, 19); expect(d.querySelector('.r2')).not.toBeNull(); expect(d.classList.contains('clipped')).toBe(false);
  });
  it('a box too short for the By/With row drops it and shows the ⋯ marker', () => {
    const d = stubBox(30, 19); expect(d.querySelector('.r2')).toBeNull(); expect(d.classList.contains('clipped')).toBe(true); expect(d.querySelector('.clipm').textContent).toBe('⋯');
  });
  it('a title that has to be cut with an ellipsis also gets the ⋯ marker', () => {
    const d = stubBox(60, 19, null, true); expect(d.classList.contains('clipped')).toBe(true);
  });
  const timedBox = (H, { titleCut, fitsAfter = false, r2 = true }) => {   // a box with a time on row 1; the title is cut until the time moves (fitsAfter)
    const a = fresh(blank({ events: [] })); const d = a.d.createElement('div'); d.className = 'ev';
    const r1 = a.d.createElement('div'); r1.className = 'r1'; const t = a.d.createElement('span'); t.className = 't'; const tm = a.d.createElement('span'); tm.className = 'tm'; tm.textContent = '09:00–17:00'; r1.append(t, tm); d.append(r1);
    if (r2) { const x = a.d.createElement('div'); x.className = 'r2'; x.innerHTML = '<span class="by">By: Ann</span>'; d.append(x); }
    const def = (o, p, f) => Object.defineProperty(o, p, { get: f, configurable: true });
    def(d, 'clientHeight', () => H); def(t, 'clientWidth', () => 10); def(t, 'scrollWidth', () => titleCut && !(fitsAfter && tm.parentNode !== r1) ? 50 : 10);
    const top = () => 19;
    Object.defineProperty(a.w.HTMLElement.prototype, 'offsetTop', { get() { return this.className === 'r2' ? top() : 0; }, configurable: true });
    Object.defineProperty(a.w.HTMLElement.prototype, 'offsetHeight', { get() { return this.className === 'r2' ? 15 : 0; }, configurable: true });
    a.w.fitBox(d); return d;
  };
  it('a title cut short by the time range gets the whole row: the time moves to the start of row 2 (R-EVT-03)', () => {
    const d = timedBox(60, { titleCut: true, fitsAfter: true }); expect(d.querySelector('.r1 .tm')).toBeNull(); expect(d.querySelector('.r2').firstElementChild.className).toBe('tm');
    expect(d.querySelector('.r2 .by')).not.toBeNull(); expect(d.classList.contains('clipped')).toBe(false);   // after the move everything fits
  });
  it('a box without a By/With row gets one for the moved time; a box too short for row 2 loses it and shows ⋯', () => {
    const d = timedBox(60, { titleCut: true, fitsAfter: true, r2: false }); expect(d.querySelector('.r2 .tm').textContent).toBe('09:00–17:00');
    const s = timedBox(30, { titleCut: true, fitsAfter: true }); expect(s.querySelector('.tm')).toBeNull(); expect(s.querySelector('.r2')).toBeNull(); expect(s.classList.contains('clipped')).toBe(true);
  });
  it('a title that fits leaves the time on row 1', () => {
    const d = timedBox(60, { titleCut: false }); expect(d.querySelector('.r1 .tm')).not.toBeNull(); expect(d.classList.contains('clipped')).toBe(false);
  });
});

describe('R-EVT-06 Delete removes the whole event', () => {
  it('Delete removes every repetition at once, closes the dialog and asks no confirmation', () => {
    const a = fresh(blank({ events: [ev1({ slots: [0, 2, 4].map(day => ({ day, start: 600, end: 660, person: '' })) })] }));
    a.ev('openDlg(S.events[0])'); a.q('#fDel').click();
    expect(events(a)).toEqual([]); expect(dlgOpen(a)).toBe(false); expect(a.log.confirms).toEqual([]);
  });
  it('there is a single Delete button (no separate "delete all repeats")', () => {
    const a = fresh(blank({ events: [ev1()] })); a.ev('openDlg(S.events[0])');
    expect(a.qa('#dlg .btns button').map(b => b.textContent)).toEqual(['Delete', 'Copy…', 'Cancel', 'Save']);
  });
  it('a new event has no Delete or Copy button yet', () => {
    const a = fresh(blank()); a.toolbar('add').click(); expect(a.q('#fDel').style.display).toBe('none'); expect(a.q('#fCopy').style.display).toBe('none');
  });
});

describe('R-EVT-07 Copying an event', () => {
  const two = () => fresh(blank({ schedules: [sched({ id: 's1', name: 'Home' }), sched({ id: 's2', name: 'Work', color: '#e5484d' })], events: [ev1({ color: '#3b6df0', schedules: ['s1'] })] }));
  const openCopyDialog = a => { a.ev('openDlg(S.events[0])'); a.q('#fCopy').click(); };
  const mode = a => a.qa('#xDlg input[name=cpm]').find(r => r.checked).value;
  it('"Copy…" in the event dialog opens a separate copy dialog and closes the event dialog', () => {
    const a = two(); openCopyDialog(a); expect(a.dlgOpen()).toBe(true); expect(a.dlgTitle()).toContain('Copy event'); expect(dlgOpen(a)).toBe(false);
  });
  it('the destination defaults to a schedule the event is not in yet, with "same colour" preselected', () => {
    const a = two(); openCopyDialog(a); expect(a.q('#xDlg select').value).toBe('s2'); expect(mode(a)).toBe('same');
  });
  it('copying into a schedule the event is already in preselects "same hue, brighter or darker"', () => {
    const a = two(); openCopyDialog(a); const sel = a.q('#xDlg select'); sel.value = 's1'; sel.onchange(); expect(mode(a)).toBe('tweak');
  });
  it('"same colour" makes an independent copy with the same colour in the chosen schedule', () => {
    const a = two(); openCopyDialog(a); a.click('Copy');
    const evs = events(a); expect(evs).toHaveLength(2); expect(evs[1].schedules).toEqual(['s2']); expect(evs[1].color).toBe('#3b6df0'); expect(evs[1].id).not.toBe(evs[0].id);
    a.ev('S.events[1].title="changed"'); expect(events(a)[0].title).toBe('Event');
  });
  it('"same hue, brighter or darker" changes only the brightness', () => {
    const a = two(); openCopyDialog(a); const sel = a.q('#xDlg select'); sel.value = 's1'; sel.onchange(); a.click('Copy');
    const c = events(a)[1].color; expect(c).not.toBe('#3b6df0'); expect(Math.abs(a.ev(`hexToHsl(${JSON.stringify(c)})[0]-hexToHsl('#3b6df0')[0]`))).toBeLessThan(3);
  });
  it('"random colour" gives a valid colour', () => {
    const a = two(); openCopyDialog(a); a.qa('#xDlg input[name=cpm]').find(r => r.value === 'random').checked = true; a.click('Copy');
    expect(events(a)[1].color).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('"choose a colour" uses the colour picked with the colour picker and its Apply button', () => {
    const a = two(); openCopyDialog(a); a.q('#xDlg .swatch').click();
    const pop = a.q('.cpop'); expect(pop).not.toBeNull(); const hex = pop.querySelector('input[type=text]'); hex.value = '#112233'; hex.oninput();
    [...pop.querySelectorAll('button')].find(b => b.textContent === 'Apply').click(); a.click('Copy');
    expect(events(a)[1].color).toBe('#112233');
  });
  it('the copy dialog explains that a copy is independent (to share one event, tick several schedules)', () => {
    const a = two(); openCopyDialog(a); expect(a.dlgText()).toContain('A copy is independent');
  });
  it('right-clicking an event offers the same copy dialog, even for locked events', () => {
    const a = fresh(blank({ schedules: [sched({ locked: true }), sched({ id: 's2', name: 'Other' })], events: [ev1()] }));
    a.qa('.day')[0].oncontextmenu({ clientX: a.x(0), clientY: a.y(630), preventDefault() {} });
    expect(a.qa('.omenu .oi')).toHaveLength(1); a.q('.omenu .oi').click(); expect(a.dlgTitle()).toContain('Copy event');
  });
  it('the copy is one undo step', () => {
    const a = two(); openCopyDialog(a); a.click('Copy'); a.toolbar('undo').click(); expect(events(a)).toHaveLength(1);
  });
});

describe('R-EVT-09 Overlapping events show diagonal stripes of their colours', () => {
  const overlapped = (c1, c2) => fresh(blank({ events: [ev1({ id: 'a', color: c1, slots: [{ day: 0, start: 600, end: 720, person: '' }] }), ev1({ id: 'b', color: c2, slots: [{ day: 0, start: 660, end: 780, person: '' }] })] }));
  it('exactly the shared time range gets a stripe overlay', () => {
    const o = overlapped('#e5484d', '#2fa66a').q('.day[data-d="0"] .ov'); expect(o).not.toBeNull();
    expect(o.style.top).toBe(`${(660 - 300) / 60 * 48}px`); expect(parseFloat(o.style.height)).toBeCloseTo(60 / 60 * 48 - 1, 0);
  });
  it('events that only touch do not get a stripe', () => {
    const a = fresh(blank({ events: [ev1({ id: 'a', slots: [{ day: 0, start: 600, end: 660, person: '' }] }), ev1({ id: 'b', slots: [{ day: 0, start: 660, end: 720, person: '' }] })] })); expect(a.qa('.ov')).toHaveLength(0);
  });
  it('the stripes use 45° bands that mix both colours', () => {
    const style = overlapped('#e5484d', '#2fa66a').q('.ov').getAttribute('style');
    expect(style).toMatch(/repeating-linear-gradient\(45deg/); expect(style).toMatch(/#e5484d|rgb\(229, 72, 77\)/); expect(style).toMatch(/#2fa66a|rgb\(47, 166, 106\)/);
  });
  it('two events of the same colour still get visibly different stripes (one is lightened)', () => {
    const style = overlapped('#3b6df0', '#3b6df0').q('.ov').getAttribute('style'); const colours = style.match(/#[0-9a-f]{6}|rgb\([^)]*\)/g); expect(new Set(colours).size).toBeGreaterThanOrEqual(2);
  });
  it('the stripes follow the opacity of the most opaque event', () => {
    const a = fresh(blank({ schedules: [sched({ opacity: 0.5 })], events: [ev1({ id: 'a', slots: [{ day: 0, start: 600, end: 720, person: '' }] }), ev1({ id: 'b', slots: [{ day: 0, start: 660, end: 780, person: '' }] })] }));
    expect(parseFloat(a.q('.ov').style.opacity)).toBeCloseTo(0.85 * 0.5, 2);
  });
});

describe('R-EVT-10 Parallel events that share nobody are drawn side by side', () => {
  // Ann leads 'a' (10:00–12:00), Bob leads 'b' (11:00–13:00) on Monday unless overridden
  const pair = (oa = {}, ob = {}, data = {}) => fresh(blank({ people, events: [
    ev1({ id: 'a', title: 'A', color: '#e5484d', slots: [{ day: 0, start: 600, end: 720, person: 'A' }], ...oa }),
    ev1({ id: 'b', title: 'B', color: '#2fa66a', slots: [{ day: 0, start: 660, end: 780, person: 'B' }], ...ob })], ...data }));
  const box = (a, title, day = 0) => a.qa(`.day[data-d="${day}"] .ev`).find(b => b.getAttribute('aria-label').startsWith(title + ','));
  const lane = b => { const v = b.dataset.lane; if (!v) return null; const [l, n] = v.split('/').map(Number); return l / n; };
  const down = (a, el, x, min) => el.onpointerdown({ clientX: x, clientY: a.y(min), button: 0, target: el, pointerType: 'mouse', shiftKey: false, stopPropagation() {}, preventDefault() {} });
  it('overlapping events led by different people get one half of the column each and no stripes', () => {
    const a = pair(); expect([lane(box(a, 'A')), lane(box(a, 'B'))]).toEqual([0, 0.5]);
    expect(box(a, 'A').dataset.lane).toBe('0/2'); expect(box(a, 'A').style.width).not.toBe(''); expect(a.qa('.ov')).toHaveLength(0);
  });
  it('overlapping events led by the same person stay on top of each other with stripes (a conflict)', () => {
    const a = pair({}, { slots: [{ day: 0, start: 660, end: 780, person: 'A' }] });
    expect([lane(box(a, 'A')), lane(box(a, 'B'))]).toEqual([null, null]); expect(a.qa('.ov')).toHaveLength(1);
  });
  it('a person involved in one event and responsible for the other also counts as shared, so they overlap with stripes', () => {
    const a = pair({}, { involved: ['A'] }); expect(lane(box(a, 'B'))).toBeNull(); expect(a.qa('.ov')).toHaveLength(1);
  });
  it('two events that only share an involved person overlap with stripes', () => {
    const a = pair({ involved: ['C'] }, { involved: ['C'] }); expect(a.qa('.ov')).toHaveLength(1);
  });
  it('an event without any people overlaps the other with stripes, as before', () => {
    const a = pair({}, { slots: [{ day: 0, start: 660, end: 780, person: '' }] }); expect(lane(box(a, 'A'))).toBeNull(); expect(a.qa('.ov')).toHaveLength(1);
  });
  it('an event with no responsible person overlaps everyone with stripes, even when it has involved people (they are busy, and nobody else is assigned)', () => {
    const a = pair({}, { involved: ['C'], slots: [{ day: 0, start: 660, end: 780, person: '' }] }); expect(lane(box(a, 'B'))).toBeNull(); expect(a.qa('.ov')).toHaveLength(1);
  });
  it('lanes follow the order of the People list, not the order of the events', () => {
    const a = pair({}, {}, { people: [people[1], people[0], people[2]] }); expect([lane(box(a, 'B')), lane(box(a, 'A'))]).toEqual([0, 0.5]);
  });
  it('lanes are counted per group of overlapping events: an event that overlaps nothing keeps the full width', () => {
    const a = fresh(blank({ people, events: [ev1({ id: 'a', title: 'A', slots: [{ day: 0, start: 600, end: 660, person: 'A' }] }), ev1({ id: 'b', title: 'B', slots: [{ day: 0, start: 600, end: 660, person: 'B' }] }), ev1({ id: 'c', title: 'C', slots: [{ day: 0, start: 900, end: 960, person: 'C' }] })] }));
    expect(lane(box(a, 'C'))).toBeNull(); expect(box(a, 'C').style.width).toBe('');
  });
  it('a clash inside one lane is striped only within that lane', () => {
    const a = fresh(blank({ people, events: [
      ev1({ id: 'a', title: 'A', slots: [{ day: 0, start: 600, end: 720, person: 'A' }] }), ev1({ id: 'a2', title: 'A2', slots: [{ day: 0, start: 660, end: 690, person: 'A' }] }),
      ev1({ id: 'b', title: 'B', slots: [{ day: 0, start: 600, end: 720, person: 'B' }] })] }));
    expect([lane(box(a, 'A')), lane(box(a, 'A2')), lane(box(a, 'B'))]).toEqual([0, 0, 0.5]);
    const ov = a.qa('.ov'); expect(ov).toHaveLength(1); expect(ov[0].dataset.lane).toBe('0/2');
  });
  it('the rule is applied per repetition: each day uses that repetition’s responsible person', () => {
    const a = pair({ slots: [{ day: 0, start: 600, end: 720, person: 'A' }, { day: 1, start: 600, end: 720, person: 'B' }] },
      { slots: [{ day: 0, start: 660, end: 780, person: 'B' }, { day: 1, start: 660, end: 780, person: 'B' }] });
    expect(lane(box(a, 'A', 0))).toBe(0); expect(a.qa('.day[data-d="0"] .ov')).toHaveLength(0);
    expect(lane(box(a, 'A', 1))).toBeNull(); expect(a.qa('.day[data-d="1"] .ov')).toHaveLength(1);
  });
  it('overlapping repetitions of one event performed by people who share nobody go side by side, without stripes or ⚠', () => {
    const a = fresh(blank({ people, events: [ev1({ id: 'a', title: 'A', slots: [{ day: 0, start: 600, end: 720, person: 'A' }, { day: 0, start: 660, end: 780, person: 'B' }] })] }));
    expect(a.qa('.day[data-d="0"] .ev').map(lane).sort()).toEqual([0, 0.5]); expect(a.qa('.ov')).toHaveLength(0);
    expect(a.qa('.ev').some(b => b.getAttribute('aria-label').includes('⚠'))).toBe(false);
  });
  it('overlapping repetitions of one event that share a person (here the default With) still clash: on top, striped, with ⚠', () => {
    const a = fresh(blank({ people, events: [ev1({ id: 'a', title: 'A', involved: ['C'], slots: [{ day: 0, start: 600, end: 720, person: 'A' }, { day: 0, start: 660, end: 780, person: 'B' }] })] }));
    expect(a.qa('.day[data-d="0"] .ev').map(lane)).toEqual([null, null]); expect(a.qa('.ov')).toHaveLength(1);
    expect(a.qa('.ev').every(b => b.getAttribute('aria-label').includes('⚠'))).toBe(true);
  });
  it('overlapping repetitions of one event clash when one has no responsible person, but not through people only on call', () => {
    const lone = fresh(blank({ people, events: [ev1({ id: 'a', title: 'A', slots: [{ day: 0, start: 600, end: 720, person: 'A' }, { day: 0, start: 660, end: 780, person: '' }] })] }));
    expect(lone.qa('.ov')).toHaveLength(1);
    const oc = fresh(blank({ people, events: [ev1({ id: 'a', title: 'A', involved: ['C'], oncall: true, slots: [{ day: 0, start: 600, end: 720, person: 'A' }, { day: 0, start: 660, end: 780, person: 'B' }] })] }));
    expect(oc.qa('.ov')).toHaveLength(0); expect(oc.qa('.day[data-d="0"] .ev').map(lane).sort()).toEqual([0, 0.5]);
  });
  it('only visible occurrences take a lane: hiding a person gives the other event the full width', () => {
    const a = pair({}, {}, { people: [people[0], { ...people[1], visible: false }, people[2]] });
    expect(box(a, 'B')).toBeUndefined(); expect(lane(box(a, 'A'))).toBeNull();
  });
  it('side by side cannot be turned off: Settings has no such option, and an old stored "side: false" is ignored', () => {
    const a = pair(); a.ev('openSettings()'); expect(a.qa('#xDlg .sopt').map(l => l.textContent).join('|')).not.toMatch(/side by side|order of the People list/);
    const b = openApp({ storage: { [PREFS_KEY]: JSON.stringify({ side: false, sideFix: true }) } }); setData(b, a.ev('JSON.parse(JSON.stringify(S))'));
    expect(lane(box(b, 'A'))).toBe(0); expect(lane(box(b, 'B'))).toBe(0.5); expect(b.qa('.ov')).toHaveLength(0);
  });
  it('the help explains the rule and the column-width workaround in both languages', () => {
    const a = pair();
    expect(a.ev("L('help6')")).toMatch(/a shared person.*stripes.*side by side.*column width/s);
    a.ev("setLang('es')"); expect(a.ev("L('help6')")).toMatch(/persona en común.*rayas.*uno al lado del otro.*ancho de columna/s);
  });
  it('a click on the left half opens the left event directly instead of the chooser; the right half opens the other', () => {
    for (const [x, title] of [[25, 'A'], [75, 'B']]) {
      const a = pair(); const b = box(a, title); down(a, b, x, 690); pointer(a, 'pointerup', { x, y: a.y(690) });
      expect(a.qa('.omenu')).toHaveLength(0); expect(dlgOpen(a)).toBe(true); expect(a.q('#fT').value).toBe(title);
    }
  });
  it('dragging a side-by-side event moves it directly, without asking which event was meant', () => {
    const a = pair(); down(a, box(a, 'A'), 25, 690);
    pointer(a, 'pointermove', { x: 25, y: a.y(750) }); pointer(a, 'pointerup', { x: 25, y: a.y(750) });
    expect(a.qa('.omenu')).toHaveLength(0); expect(events(a).map(e => e.slots[0].start)).toEqual([660, 660]);
  });
  it('right-click Copy lists only the event in the lane under the pointer', () => {
    const a = pair(); const col = a.q('.day[data-d="0"]');
    col.oncontextmenu({ clientX: 75, clientY: a.y(690), preventDefault() {} });
    expect(a.qa('.omenu .oi b').map(b => b.textContent)).toEqual(['B']);
  });
});

describe('R-EVT-13 An occurrence that clashes with several parallel ones spans their lanes', () => {
  const P4 = [...people, person({ id: 'D', name: 'Dee', color: '#e8912d' })];
  const at = (id, title, person, start, end, o = {}) => ev1({ id, title, slots: [{ day: 0, start, end, person }], ...o });
  const box = (a, title) => a.qa('.day[data-d="0"] .ev').find(b => b.getAttribute('aria-label').startsWith(title + ','));
  const lanes = (a, ...titles) => titles.map(x => box(a, x).dataset.lane || null);
  const ovLanes = a => a.qa('.day[data-d="0"] .ov').map(o => o.dataset.lane || null).sort();
  const abx = (x = {}, data = {}) => fresh(blank({ people, events: [at('a', 'A', 'A', 600, 720), at('b', 'B', 'B', 600, 720), at('x', 'X', '', 660, 780, x)], ...data }));
  it('two parallel events stay side by side when an unassigned event overlaps both; it covers both lanes', () => {
    const a = abx(); expect(lanes(a, 'A', 'B', 'X')).toEqual(['0/2', '1/2', '0-1/2']);
  });
  it('each overlap is striped on its own, inside the lane of the event it overlaps', () => {
    expect(ovLanes(abx())).toEqual(['0/2', '1/2']);
  });
  it('an event shared by the two people (responsible one, involved the other) spans their lanes too', () => {
    const a = abx({ slots: [{ day: 0, start: 660, end: 780, person: 'A' }], involved: ['B'] }); expect(lanes(a, 'A', 'B', 'X')).toEqual(['0/2', '1/2', '0-1/2']); expect(ovLanes(a)).toEqual(['0/2', '1/2']);
  });
  it('lanes are reordered when needed so that the shared event can span: Ann and Cy become neighbours, Bob moves aside', () => {
    const a = fresh(blank({ people, events: [at('a', 'A', 'A', 600, 720), at('b', 'B', 'B', 600, 720), at('c', 'C', 'C', 600, 720), at('x', 'X', 'A', 660, 780, { involved: ['C'] })] }));
    expect(lanes(a, 'A', 'C', 'B', 'X')).toEqual(['0/3', '1/3', '2/3', '0-1/3']); expect(ovLanes(a)).toEqual(['0/3', '1/3']);
  });
  it('without a need to reorder, the People order is kept', () => {
    const a = fresh(blank({ people, events: [at('a', 'A', 'A', 600, 720), at('b', 'B', 'B', 600, 720), at('c', 'C', 'C', 600, 720), at('x', 'X', 'A', 660, 780, { involved: ['B'] })] }));
    expect(lanes(a, 'A', 'B', 'C', 'X')).toEqual(['0/3', '1/3', '2/3', '0-1/3']);
  });
  it('a layout that no lane order can satisfy falls back to merging everything involved into stripes', () => {
    const a = fresh(blank({ people: P4, events: [at('a', 'A', 'A', 600, 720), at('b', 'B', 'B', 600, 720), at('c', 'C', 'C', 600, 720), at('d', 'D', 'D', 600, 720),
      at('x', 'X', 'A', 660, 780, { involved: ['C'] }), at('y', 'Y', 'B', 660, 780, { involved: ['D'] }), at('z', 'Z', 'A', 660, 780, { involved: ['D'] })] }));
    expect(lanes(a, 'A', 'B', 'C', 'D', 'X', 'Y', 'Z')).toEqual(Array(7).fill(null)); expect(a.qa('.day[data-d="0"] .ov').length).toBeGreaterThan(0);
  });
  it('clicking or hovering uses the lane under the pointer: over the left lane you get A and the spanning event, over the right lane B and it', () => {
    const a = abx(); const ids = fx => a.ev(`piecesAt(0,690,true,${fx}).map(x=>x.e.id).sort()`);
    expect(ids(0.25)).toEqual(['a', 'x']); expect(ids(0.75)).toEqual(['b', 'x']); expect(a.ev('piecesAt(0,750,true,0.75).map(x=>x.e.id)')).toEqual(['x']);
  });
  it('an old stored "Keep lanes in the order of the People list" is ignored: lanes are still reordered when that is needed', () => {
    const a = openApp({ storage: { [PREFS_KEY]: JSON.stringify({ sideFix: true }) } });
    setData(a, blank({ people, events: [at('a', 'A', 'A', 600, 720), at('b', 'B', 'B', 600, 720), at('c', 'C', 'C', 600, 720), at('x', 'X', 'A', 660, 780, { involved: ['C'] })] }));
    expect(lanes(a, 'A', 'C', 'B', 'X')).toEqual(['0/3', '1/3', '2/3', '0-1/3']);
  });
  it('many overlapping events without people are still drawn quickly as one striped lane', () => {
    const a = fresh(blank({ events: Array.from({ length: 300 }, (_, i) => at('e' + i, 'E' + i, '', 600 + (i % 8) * 15, 720)) })); const t0 = Date.now(); a.ev('render()');
    expect(Date.now() - t0).toBeLessThan(3000); expect(a.qa('.day[data-d="0"] .ev[data-lane]')).toHaveLength(0);
  });
});

describe('R-EVT-18 An occurrence also fills the lanes of its people when nothing parallel is in the way', () => {
  const LI = [person({ id: 'L', name: 'Luis', color: '#3f51b5' }), person({ id: 'I', name: 'Ioanna', color: '#d6409f' })];
  const at = (id, title, person, start, end, o = {}) => ev1({ id, title, slots: [{ day: 1, start, end, person }], ...o });
  const box = (a, title) => a.qa('.day[data-d="1"] .ev').find(b => b.getAttribute('aria-label').startsWith(title + ','));
  const lanes = (a, ...titles) => titles.map(x => box(a, x).dataset.lane || null);
  const ovLanes = a => a.qa('.day[data-d="1"] .ov').map(o => o.dataset.lane || null).sort();
  // the user's Tuesday: Luis works 9–12 and 13–17, has lunch 12–13 with Ioanna, who works 10–16
  const tuesday = (o = {}, ppl = LI) => fresh(blank({ people: ppl, events: [
    ev1({ id: 'w', title: 'Work', slots: [{ day: 1, start: 540, end: 720, person: 'L' }, { day: 1, start: 780, end: 1020, person: 'L' }] }),
    at('l', 'Lunch', 'L', 720, 780, { involved: ['I'], ...o }), at('i', 'Ioanna work', 'I', 600, 960)] }));
  const workLanes = a => a.qa('.day[data-d="1"] .ev').filter(b => b.getAttribute('aria-label').startsWith('Work,')).map(b => b.dataset.lane);
  it('Luis\'s lunch with Ioanna spans Luis\'s lane (free between his two work blocks) and Ioanna\'s lane', () => {
    const a = tuesday(); expect(workLanes(a)).toEqual(['0/2', '0/2']); expect(lanes(a, 'Ioanna work', 'Lunch')).toEqual(['1/2', '0-1/2']);
  });
  it('the lunch is striped only where it overlaps Ioanna\'s work, in her lane', () => {
    expect(ovLanes(tuesday())).toEqual(['1/2']);
  });
  it('the same happens when Ioanna comes first in the People list (lanes mirrored)', () => {
    const a = tuesday({}, [LI[1], LI[0]]); expect(workLanes(a)).toEqual(['1/2', '1/2']); expect(lanes(a, 'Ioanna work', 'Lunch')).toEqual(['0/2', '0-1/2']);
  });
  it('people only on call do not pull the occurrence into their lane', () => {
    const call = o => fresh(blank({ people: LI, events: [ev1({ id: 'w', title: 'Work', slots: [{ day: 1, start: 540, end: 720, person: 'L' }, { day: 1, start: 780, end: 1020, person: 'L' }] }),
      at('i', 'Ioanna work', 'I', 600, 960), at('c', 'Call', 'I', 720, 780, { involved: ['L'], ...o })] }));
    expect(lanes(call({}), 'Call')).toEqual(['0-1/2']); expect(lanes(call({ oncall: true }), 'Call')).toEqual(['1/2']);
  });
  it('the occurrence does not grow into its person\'s lane where someone else\'s parallel occurrence is in the way', () => {
    const P3 = [...LI, person({ id: 'C', name: 'Cy', color: '#2fa66a' })];
    const a = fresh(blank({ people: P3, events: [
      ev1({ id: 'w', title: 'Work', slots: [{ day: 1, start: 540, end: 720, person: 'L' }, { day: 1, start: 780, end: 1020, person: 'L' }] }),
      at('l', 'Lunch', 'L', 720, 780, { involved: ['I'] }), at('i', 'Ioanna work', 'I', 600, 960), at('c', 'Cy call', 'C', 720, 780)] }));
    expect(lanes(a, 'Cy call', 'Ioanna work', 'Lunch')).toEqual(['0/2', '1/2', '1/2']); expect(ovLanes(a)).toEqual(['1/2']);
  });
  it('lanes are reordered so that Ioanna\'s lunch with Luis can reach his lane: Ioanna moves next to Luis, Cy aside', () => {
    const P3 = [person({ id: 'L', name: 'Luis', color: '#3f51b5' }), person({ id: 'C', name: 'Cy', color: '#2fa66a' }), person({ id: 'I', name: 'Ioanna', color: '#d6409f' })];
    const a = fresh(blank({ people: P3, events: [
      ev1({ id: 'w', title: 'Work', slots: [{ day: 1, start: 540, end: 720, person: 'L' }, { day: 1, start: 780, end: 1020, person: 'L' }] }),
      at('l', 'Lunch', 'I', 720, 780, { involved: ['L'] }), at('i', 'Ioanna work', 'I', 600, 960), at('c', 'Cy work', 'C', 540, 1020)] }));
    expect(workLanes(a)).toEqual(['0/3', '0/3']); expect(lanes(a, 'Ioanna work', 'Cy work', 'Lunch')).toEqual(['1/3', '2/3', '0-1/3']);
  });
});

describe('R-EVT-18 An occurrence without a responsible person concerns everyone and fills every lane of its group', () => {
  const LIO = [person({ id: 'L', name: 'Luis', color: '#3f51b5' }), person({ id: 'I', name: 'Ioanna', color: '#e8b10c' }), person({ id: 'O', name: 'Olivia', color: '#2fa66a', visible: false })];
  const at = (id, title, person, start, end, o = {}, so = {}) => ev1({ id, title, slots: [{ day: 0, start, end, person, ...so }], ...o });
  const box = (a, title) => a.qa('.day[data-d="0"] .ev').find(b => b.getAttribute('aria-label').startsWith(title + ','));
  // the user's Monday: both work 13–17 (Luis may finish 15 minutes early); the school pickup 16:45–18:00 has no responsible person, Olivia involved
  const monday = () => fresh(blank({ people: LIO, events: [at('lw', 'Luis work', 'L', 780, 1020, {}, { fe: 15 }), at('iw', 'Ioanna work', 'I', 780, 1020), at('p', 'School Pickup', '', 1005, 1080, { involved: ['O'] })] }));
  it('the school pickup spans Luis\'s and Ioanna\'s lanes although it overlaps only Ioanna\'s work', () => {
    const a = monday(); expect(['Luis work', 'Ioanna work', 'School Pickup'].map(t => box(a, t).dataset.lane)).toEqual(['0/2', '1/2', '0-1/2']);
  });
  it('it is striped only over Ioanna\'s work; Luis\'s flexible end lies under it, drawn before every box', () => {
    const a = monday(); expect(a.qa('.day[data-d="0"] .ov').map(o => o.dataset.lane)).toEqual(['1/2']);
    const col = [...a.q('.day[data-d="0"]').children], mg = a.q('.day[data-d="0"] .mg.b'); expect(mg.dataset.lane).toBe('0/2'); expect(col.indexOf(mg)).toBeLessThan(col.indexOf(box(a, 'School Pickup')));
  });
  it('the pickup can be clicked in Luis\'s lane too, and there it covers his flexible end', () => {
    const a = monday(); expect(a.ev('piecesAt(0,1050,true,0.25).map(x=>x.e.id)')).toEqual(['p']); expect(a.ev('piecesAt(0,1010,true,0.25).map(x=>x.e.id)')).toEqual(['p']);
  });
  it('an unassigned event that overlaps only one of two side-by-side events also takes the free lane', () => {
    const a = fresh(blank({ people: LIO, events: [at('a', 'A', 'L', 600, 720), at('b', 'B', 'I', 600, 780), at('x', 'X', '', 720, 780)] }));
    expect(['A', 'B', 'X'].map(t => box(a, t).dataset.lane)).toEqual(['0/2', '1/2', '0-1/2']);
  });
});

describe('R-EVT-11 Activity type: each event has at most one type, shown by its icon; soft-look types stand out', () => {
  const types = [{ id: 'tf', name: 'Free time', color: '#12a5b5', icon: 'sun', soft: true }, { id: 'tm', name: 'Meal', color: '#e8912d', icon: 'meal' }];
  const typed = (o = {}) => ev1({ id: 'f', title: 'Park', color: '#2fa66a', type: 'tf', slots: [{ day: 0, start: 600, end: 720, person: '' }, { day: 2, start: 600, end: 720, person: '' }], ...o });
  const open = (a, i = 0) => a.ev(`openDlg(S.events[${i}])`);
  const pick = (a, v) => { a.q('#fTy').value = v; a.q('#fTy').dispatchEvent(new a.w.Event('change')); };
  it('the event dialog has an "Activity type" list with "(none)" first and the types of the workspace in order', () => {
    const a = fresh(blank({ types, events: [typed(), ev1({ id: 'n' })] })); open(a, 0);
    expect([...a.q('#fTy').options].map(o => o.textContent)).toEqual(['(none)', 'Free time', 'Meal']); expect(a.q('#fTy').value).toBe('tf');
    a.q('#fCancel').click(); open(a, 1); expect(a.q('#fTy').value).toBe('');
  });
  it('the icon of the chosen type is shown next to the list in the type colour', () => {
    const a = fresh(blank({ types, events: [ev1()] })); open(a); expect(a.q('#fTyIc').innerHTML).toBe('');
    pick(a, 'tm'); expect(a.q('#fTyIc svg')).not.toBeNull(); expect(a.q('#fTyIc').style.color).toMatch(/#e8912d|rgb\(232, 145, 45\)/);
  });
  it('choosing a type and saving sets it on the whole event; "(none)" removes it again', () => {
    const a = fresh(blank({ types, events: [ev1()] })); open(a); pick(a, 'tm'); save(a); expect(events(a)[0].type).toBe('tm');
    open(a); pick(a, ''); save(a); expect('type' in events(a)[0]).toBe(false);
  });
  it('a new event can be created with a type', async () => {
    const a = fresh(blank({ types })); await createDrag(a, { col: 1, min: 600 }, { col: 1, min: 660 }); fillDialog(a, { title: 'Nap' }); pick(a, 'tf'); save(a);
    expect(events(a)[0]).toMatchObject({ title: 'Nap', type: 'tf' });
  });
  it('every repetition shows the type icon first among the status icons', () => {
    const a = fresh(blank({ types, events: [typed({ type: 'tm' })] })); const boxes = a.qa('.ev'); expect(boxes).toHaveLength(2);
    boxes.forEach(b => expect(b.querySelector('.flags span').innerHTML).toBe(iconHTML(a, 'meal')));
  });
  it('a type with the soft look draws a soft box in the event colour with a solid colour edge (the event keeps its own colour)', () => {
    const a = fresh(blank({ types, events: [typed()] }));
    a.qa('.ev').forEach(b => { expect(b.classList.contains('soft')).toBe(true); expect(b.style.getPropertyValue('--c')).toBe('#2fa66a'); });
    const rule = cssRule(a, '.ev.soft').style; expect(rule.getPropertyValue('background')).toMatch(/color-mix\(in srgb, ?var\(--c\) 28%, ?var\(--card\)\)/); expect(rule.getPropertyValue('border-left')).toMatch(/4px solid var\(--c\)/);
  });
  it('types without the soft look and events without a type are drawn normally (no icon when there is no type)', () => {
    const a = fresh(blank({ types, events: [typed({ type: 'tm' }), ev1({ id: 'n', slots: [{ day: 4, start: 600, end: 660, person: '' }] })] }));
    expect(a.qa('.ev.soft')).toHaveLength(0); expect(a.q('.day[data-d="4"] .ev .flags')).toBeNull();
  });
  it('screen readers, the hover card and the day agenda name the type', () => {
    const a = fresh(blank({ types, events: [typed()] })); expect(a.q('.ev').getAttribute('aria-label')).toContain('Free time');
    expect(a.ev('peekHTML(piecesAt(0,630,true))')).toContain('Free time');
    a.ev('openAgenda(0)'); expect(a.q('#agBody').textContent).toContain('Free time');
  });
  it('the overlap rules do not change: a soft-look event sharing a person with another overlaps with stripes', () => {
    const a = fresh(blank({ people, types, events: [typed({ slots: [{ day: 0, start: 600, end: 720, person: 'A' }] }), ev1({ id: 'b', slots: [{ day: 0, start: 660, end: 780, person: 'A' }] })] }));
    expect(a.qa('.ov')).toHaveLength(1);
  });
  it('the type survives copying the event to another schedule', () => {
    const a = fresh(blank({ types, schedules: [sched(), sched({ id: 's2', name: 'S2' })], events: [typed()] })); a.ev('openCopy(S.events[0])'); a.click('Copy');
    expect(events(a).map(e => e.type)).toEqual(['tf', 'tf']);
  });
  it('the old free-time flag no longer exists: no checkbox, and "free" in data is dropped', () => {
    const a = fresh(blank({ events: [ev1({ free: true })] })); expect(a.q('#fFree')).toBeNull(); expect('free' in events(a)[0]).toBe(false);
  });
  it('the list is labelled and translated, and hidden for phases', () => {
    const a = fresh(blank({ types, events: [ev1()] })); a.ev("setLang('es')"); open(a); expect(a.q('#fTy').options[0].textContent).toBe('(ninguno)');
    expect(a.q('#fTy').getAttribute('aria-label')).toBe('Tipo de actividad'); expect(a.q('#fTy').closest('.fcell').classList.contains('ev-only')).toBe(true);
    expect([...a.qa('#dlg label')].some(l => l.textContent === 'Tipo de actividad')).toBe(true);
  });
});

describe('R-EVT-12 Around these times: a repetition with approximate timing is drawn and treated as all flexible margin', () => {
  const tsel = (a, day) => a.qa('#fDays .dr')[day].querySelector('.tsel');   // each day's own Timing list
  const open = (a, i = 0) => a.ev(`openDlg(S.events[${i}])`);
  const twoDays = (f0 = false, f2 = false) => ev1({ slots: [{ day: 0, start: 600, end: 660, person: '', ...(f0 ? { flex: true } : {}) }, { day: 2, start: 600, end: 660, person: '', ...(f2 ? { flex: true } : {}) }] });
  const ol = [person({ id: 'O', name: 'Olivia', color: '#e5484d' }), person({ id: 'B', name: 'Bob', color: '#2fa66a' })];
  const hw = (start = 1020, end = 1080, o = {}) => ev1({ id: 'h', title: 'Homework', slots: [{ day: 0, start, end, person: 'O', flex: true, ...o }] });
  const at = (id, title, start, end, p = 'O', o = {}) => ev1({ id, title, color: '#2fa66a', slots: [{ day: 0, start, end, person: p }], ...o });
  const hwBox = a => a.qa('.day[data-d="0"] .ev').find(b => b.querySelector('.t').textContent === 'Homework');
  it('a flexible repetition looks like a margin (translucent tint, dashed border in its colour); the other repetitions stay solid boxes', () => {
    const a = fresh(blank({ events: [twoDays(true, false)] }));
    const [mon, wed] = [a.q('.day[data-d="0"] .ev'), a.q('.day[data-d="2"] .ev')];
    expect(mon.classList.contains('mgo')).toBe(true); expect(wed.classList.contains('mgo')).toBe(false);
    const r = cssRule(a, '.ev.mgo').style; expect(r.getPropertyValue('border')).toMatch(/2px dashed var\(--c\)/); expect(r.getPropertyValue('background')).toMatch(/var\(--c\) 30%/);
  });
  it('a flexible box lies under every core box, so a core of its own person covers it where they meet', () => {
    const a = fresh(blank({ people: ol, events: [at('p', 'Piano', 1050, 1080), hw(1020, 1140)] })), kids = [...a.q('.day[data-d="0"]').children];
    expect(kids.indexOf(hwBox(a))).toBeLessThan(kids.indexOf(a.qa('.ev').find(b => !b.classList.contains('mgo'))));
    expect(a.ev('piecesAt(0,1060,true).map(x=>x.e.id)')).toEqual(['p']); expect(a.ev('piecesAt(0,1030,true).map(x=>x.e.id)')).toEqual(['h']);
  });
  it('a core of its own person over part of its window makes no stripes and no warning, and both share one lane', () => {
    const a = fresh(blank({ people: ol, events: [hw(1020, 1140), at('p', 'Piano', 1080, 1110)] }));
    expect(a.qa('.ov')).toHaveLength(0); expect(a.qa('.ev').map(b => b.dataset.lane)).toEqual([undefined, undefined]);
    expect(hwBox(a).getAttribute('aria-label')).not.toContain('No time left'); expect(hwBox(a).querySelector('.flags')).toBeNull();
  });
  it('squeezed out: when cores of its people cover its whole window it clashes again, with stripes, a warning and a line in the card and agenda', () => {
    const a = fresh(blank({ people: ol, events: [hw(), at('f', 'Football', 1020, 1110)] })), note = 'No time left around these times (Football)';
    expect(a.qa('.ov')).toHaveLength(1); expect(hwBox(a).getAttribute('aria-label')).toContain(note); expect(hwBox(a).querySelector('.flags')).not.toBeNull();
    expect(hwBox(a).classList.contains('mgo')).toBe(true); expect(a.ev('piecesAt(0,1040,true).map(x=>x.e.id).sort()')).toEqual(['f', 'h']);
    expect(a.ev('peekHTML(piecesAt(0,1040,true))')).toContain(note); a.ev('openAgenda(0)'); expect(a.q('#agBody').textContent).toContain('⚠ ' + note);
    a.ev("setLang('es')"); expect(hwBox(a).getAttribute('aria-label')).toContain('No queda tiempo libre alrededor de estas horas (Football)');
  });
  it('several cores back to back and an event without a responsible person squeeze it out together; another person\'s core never does', () => {
    const a = fresh(blank({ people: ol, events: [hw(), at('f', 'Football', 1000, 1050), at('d', 'Dinner', 1050, 1100, '')] }));
    expect(hwBox(a).getAttribute('aria-label')).toContain('(Football, Dinner)');
    const b = fresh(blank({ people: ol, events: [hw(), at('f', 'Football', 1000, 1050), at('d', 'Dinner', 1050, 1100, 'B')] }));
    expect(hwBox(b).getAttribute('aria-label')).not.toContain('No time left'); expect(b.qa('.ov')).toHaveLength(0);
  });
  it('an Away strip of its people that covers its whole window squeezes it out: hatched stripes and an away line', () => {
    const away = ev1({ id: 'aw', title: "At Dad's", color: '#8e4ec6', away: true, involved: ['O'], slots: [{ day: 0, start: 960, end: 1200, person: '' }] });
    const a = fresh(blank({ people: ol, events: [hw(), away] })); expect(a.qa('.awov')).toHaveLength(1);
    expect(hwBox(a).getAttribute('aria-label')).toContain('Olivia is away'); expect(hwBox(a).getAttribute('aria-label')).toContain("No time left around these times (At Dad's)");
    const b = fresh(blank({ people: ol, events: [hw(), { ...away, slots: [{ day: 0, start: 960, end: 1050, person: '' }] }] })); expect(b.qa('.awov')).toHaveLength(0);
  });
  it('past midnight it is squeezed out only when every part is covered: a covered evening with a free morning is fine', () => {
    const late = ev1({ id: 'r', title: 'Reading', slots: [{ day: 0, start: 1380, end: 1500, person: 'O', flex: true }] });
    const mon = a => a.qa('.day[data-d="0"] .ev').find(b => b.querySelector('.t').textContent === 'Reading');
    const a = fresh(blank({ people: ol, events: [late, at('x', 'Call', 1320, 1440)] })); expect(mon(a).getAttribute('aria-label')).not.toContain('No time left'); expect(a.qa('.ov')).toHaveLength(0);
    const b = fresh(blank({ people: ol, events: [late, at('x', 'Call', 1320, 1440), ev1({ id: 'y', title: 'Night call', slots: [{ day: 1, start: 0, end: 90, person: 'O' }] })] }));
    expect(mon(b).getAttribute('aria-label')).toContain('No time left around these times (Call, Night call)');
  });
  it('another person\'s occurrence goes beside it for its whole window, even where it would only reach the flexible part', () => {
    const a = fresh(blank({ people: ol, events: [hw(1020, 1140), at('c', 'Cooking', 1110, 1200, 'B')] }));
    expect(a.qa('.ev').map(b => b.dataset.lane)).toEqual(['0/2', '1/2']); expect(a.qa('.ov')).toHaveLength(0);
  });
  it('marked as done along the way, it is nested when its whole window lies within an activity of its person', () => {
    const a = fresh(blank({ people: ol, events: [at('f', 'Football', 960, 1110), ev1({ id: 'm', title: 'Milk', nest: true, slots: [{ day: 0, start: 1035, end: 1050, person: 'O', flex: true }] })] }));
    expect(a.qa('.ev.nest').map(b => b.querySelector('.t').textContent)).toEqual(['Milk']); expect(a.qa('.ov')).toHaveLength(0);
  });
  it('repetitions of one event: one around these times is warned about only when clashing repetitions leave no minute of it (R-REP-05)', () => {
    const a = fresh(); const set = (s1, s2) => a.ev(`overlapSet({},${JSON.stringify([s1, s2])}).size`);
    expect(set({ day: 0, start: 600, end: 660, flex: true }, { day: 0, start: 630, end: 720 })).toBe(0); expect(set({ day: 0, start: 600, end: 660, flex: true }, { day: 0, start: 600, end: 720 })).toBe(2);
    expect(set({ day: 0, start: 600, end: 660, flex: true, person: 'A' }, { day: 0, start: 540, end: 720, person: 'B' })).toBe(0);
    expect(set({ day: 0, start: 600, end: 660, flex: true }, { day: 0, start: 600, end: 660, flex: true })).toBe(0);
  });
  it('screen readers, the hover card and the agenda say "Flexible time (around these times)"', () => {
    const a = fresh(blank({ events: [twoDays(true)] })); expect(a.q('.ev').getAttribute('aria-label')).toContain('Flexible time (around these times)');
    expect(a.ev('peekHTML(piecesAt(0,630,true))')).toContain('Flexible time'); a.ev('openAgenda(0)'); expect(a.q('#agBody').textContent).toContain('Flexible time');
    a.ev("setLang('es')"); expect(a.q('.ev').getAttribute('aria-label')).toContain('Horas flexibles (alrededor de estas horas)');   // horario is the word for a schedule
  });
  it('each day has its own Timing list; "Around these times" marks only that day as flexible', () => {
    const a = fresh(blank({ events: [twoDays()] })); open(a); expect([tsel(a, 0).value, tsel(a, 2).value]).toEqual(['', '']);
    expect([...tsel(a, 0).options].map(o => o.textContent)).toEqual(['Fixed', 'Flexible start/end', 'Around these times']);
    change(a, tsel(a, 2), 'flex'); save(a); expect(events(a)[0].slots.map(s => !!s.flex)).toEqual([false, true]);
  });
  it('opening an event with some flexible repetitions shows each day\'s own choice', () => {
    const a = fresh(blank({ events: [twoDays(true, false)] })); open(a); expect([tsel(a, 0).value, tsel(a, 2).value]).toEqual(['flex', '']);
  });
  it('choosing Fixed on a day clears only that day', () => {
    const a = fresh(blank({ events: [twoDays(true, true)] })); open(a); change(a, tsel(a, 0), ''); save(a); expect(events(a)[0].slots.map(s => !!s.flex)).toEqual([false, true]);
  });
  it('the copy button of a day gives every other ticked day its timing too', () => {
    const a = fresh(blank({ events: [twoDays()] })); open(a); change(a, tsel(a, 0), 'flex'); a.qa('#fDays .dr')[0].querySelector('.cpy').click(); a.q('.cmenu .oi').click();
    expect(tsel(a, 2).value).toBe('flex'); save(a); expect(events(a)[0].slots.every(s => s.flex)).toBe(true);
  });
  it('a newly ticked day starts fixed, with the times of the nearest ticked day above it', () => {
    const a = fresh(blank({ events: [twoDays(true, true)] })); open(a); const cb = a.qa('#fDays .dr')[4].querySelector('input'); cb.checked = true; cb.onchange();
    expect(tsel(a, 4).value).toBe(''); expect(rowT(a, 4)).toEqual(['600', '660']); save(a); expect(events(a)[0].slots.map(s => [s.day, !!s.flex])).toEqual([[0, true], [2, true], [4, false]]);
  });
  it('a further time on a day has its own Timing list', () => {
    const a = fresh(blank({ events: [twoDays()] })); open(a); a.qa('#fDays .dr')[0].querySelector('.addt').click();
    change(a, a.q('#fDays .dr.dx .tsel'), 'flex'); save(a); expect(events(a)[0].slots.map(s => [s.day, s.start, !!s.flex])).toEqual([[0, 600, false], [0, 660, true], [2, 600, false]]);
  });
  it('dragging a flexible event keeps the mark on every repetition', async () => {
    const a = fresh(blank({ events: [twoDays(true, false)] })); await dragFrom(a, a.q('.day[data-d="0"] .ev'), { col: 0, min: 630 }, { col: 0, min: 690 });
    expect(events(a)[0].slots.map(s => [s.start, !!s.flex])).toEqual([[660, true], [660, false]]);
  });
  it('only a true value is accepted on import, and phases never get the mark', () => {
    const p = a => a.ev('parseData({schedules:[],rhythms:[{id:"r"}],events:[{id:"x",schedules:[],slots:[{day:0,start:0,end:60,flex:true},{day:1,start:0,end:60,flex:1}]}],phases:[{id:"p",rhythms:["r"],slots:[{day:0,start:0,end:60,flex:true}]}]})');
    const d = p(fresh()); expect(d.events[0].slots.map(s => s.flex)).toEqual([true, undefined]); expect(d.phases[0].slots[0].flex).toBeUndefined();
  });
  it('overlapping flexible events with nobody in common sit side by side without stripes', () => {
    const a = fresh(blank({ people, events: [ev1({ id: 'a', slots: [{ day: 0, start: 600, end: 720, person: 'A', flex: true }] }), ev1({ id: 'b', slots: [{ day: 0, start: 660, end: 780, person: 'B', flex: true }] })] }));
    expect(a.qa('.ev').map(b => b.dataset.lane)).toEqual(['0/2', '1/2']); expect(a.qa('.ov')).toHaveLength(0);
  });
  it('the Timing lists are translated when the language changes', () => {
    const a = fresh(blank({ events: [ev1()] })); a.ev("setLang('es')"); open(a);
    expect([...tsel(a, 0).options].map(o => o.textContent)).toEqual(['Fijas', 'Inicio/fin flexible', 'Alrededor de estas horas']);
    expect(tsel(a, 0).getAttribute('aria-label')).toBe('Lunes: horas'); expect(a.qa('#paneQ .dhd span').map(x => x.textContent)).toContain('Horas');
  });
});

describe('R-EVT-15 Flexible start/end: a solid core box with dashed margins; only cores clash, and other people go beside the margins', () => {
  const y = m => `${(m - 300) / 60 * 48}px`;
  const work = (o = {}) => ev1({ id: 'w', title: 'Work', slots: [{ day: 0, start: 540, end: 1020, person: 'A', fs: 30, fe: 15 }], ...o });
  const pickup = (person = 'B', start = 1005, o = {}) => ev1({ id: 'p', title: 'Pickup', color: '#2fa66a', slots: [{ day: 0, start, end: 1050, person, ...o }] });
  const open = (a, i = 0) => a.ev(`openDlg(S.events[${i}])`);
  const row = (a, day) => a.qa('#fDays .dr')[day], tsel = (a, day) => row(a, day).querySelector('.tsel'), sub = (a, day) => row(a, day).querySelector('.dsub');
  const mg = (a, day) => [...sub(a, day).querySelectorAll('select')];   // the day's two margin lists: start, end
  const col0 = a => a.q('.day[data-d="0"]');
  it('the core is a normal box and the margins continue it above and below, with only the outer corners rounded', () => {
    const a = fresh(blank({ people, events: [work()] })), core = a.q('.ev'), t = a.q('.mg.t'), b = a.q('.mg.b');
    expect(core.style.top).toBe(y(570)); expect(parseFloat(core.style.height)).toBeCloseTo((1005 - 570) / 60 * 48, 1);
    expect([t.style.top, t.style.height]).toEqual([y(540), '24px']); expect([b.style.top, b.style.height]).toEqual([y(1005), '12px']);
    expect([core.style.borderRadius, t.style.borderRadius, b.style.borderRadius]).toEqual(['0px 0px 0px 0px', '8px 8px 0px 0px', '0px 0px 8px 8px']);
    expect(core.classList.contains('flex')).toBe(false); expect(core._mg).toEqual([t, b]);
  });
  it('margins have a dashed border in the event colour and a translucent tint, with no border towards the core', () => {
    const a = fresh(blank({ people, events: [work()] })); const r = cssRule(a, '.mg').style;
    expect(r.getPropertyValue('border')).toMatch(/2px dashed var\(--c\)/); expect(r.getPropertyValue('background')).toMatch(/color-mix\(in srgb, ?var\(--c\) 30%, ?transparent\)/);
    expect(cssRule(a, '.mg.t').style.getPropertyValue('border-bottom')).toMatch(/^(0|0px|medium none)/); expect(a.q('.mg').style.getPropertyValue('--c')).toBe('#3b6df0');
  });
  it('every margin comes before every core box in the day column, so a core always covers the margins of other events', () => {
    const a = fresh(blank({ people, events: [pickup('B', 990, { fe: 30 }), work()] })), kids = [...col0(a).children];
    const mg = a.qa('.mg').map(m => kids.indexOf(m)), cores = a.qa('.ev').map(c => kids.indexOf(c));
    expect(mg.length).toBe(3); expect(Math.max(...mg)).toBeLessThan(Math.min(...cores)); expect(kids.indexOf(col0(a).querySelector('.gl'))).toBeLessThan(Math.min(...mg));
  });
  it('where two margins overlap, the one that starts later is drawn on top', () => {
    const a = fresh(blank({ people, events: [ev1({ id: 'x', slots: [{ day: 0, start: 600, end: 690, person: 'A', fe: 30 }] }), ev1({ id: 'z', slots: [{ day: 0, start: 645, end: 720, person: 'B', fs: 30 }] })] }));
    expect(a.qa('.mg').map(m => m.style.top)).toEqual([y(645), y(660)]);
  });
  it('no stripes where a core only overlaps the margin of another event, even when they share a person', () => {
    const a = fresh(blank({ people, events: [work(), pickup('A')] })); expect(a.qa('.ov')).toHaveLength(0);
    const b = fresh(blank({ people, events: [work({ slots: [{ day: 0, start: 540, end: 1020, person: 'A' }] }), pickup('A')] })); expect(b.qa('.ov')).toHaveLength(1);
  });
  it('stripes between two cores cover only the cores, not the margins around them', () => {
    const a = fresh(blank({ people, events: [work({ slots: [{ day: 0, start: 540, end: 1020, person: 'A', fe: 15 }] }), pickup('A', 975)] })), ov = a.qa('.ov');
    expect(ov).toHaveLength(1); expect(ov[0].style.top).toBe(y(975)); expect(parseFloat(ov[0].style.height)).toBeCloseTo(30 / 60 * 48 - 1, 1);
  });
  it('parallel events that touch only through a margin go side by side for their whole length', () => {
    const a = fresh(blank({ people, events: [work(), pickup('B')] })); expect(a.qa('.ev').map(b => b.dataset.lane)).toEqual(['0/2', '1/2']); expect(a.q('.mg.b').dataset.lane).toBe('0/2'); expect(a.qa('.ov')).toHaveLength(0);
    const b = fresh(blank({ people, events: [work({ slots: [{ day: 0, start: 540, end: 1020, person: 'A' }] }), pickup('B')] })); expect(b.qa('.ev').map(x => x.dataset.lane)).toEqual(['0/2', '1/2']);
  });
  it('a piece that is all margin (the text box before a core that starts after midnight) takes a lane beside parallel events', () => {
    // three people go to sleep: Luis may start up to 1 h 30 late, so his core starts at midnight and Monday shows only margin
    const sleep = ev1({ id: 's', title: 'Sleep', slots: [{ day: 0, start: 1350, end: 1875, person: 'A', fs: 90 }, { day: 0, start: 1230, end: 1875, person: 'B', fs: 30 }, { day: 0, start: 1320, end: 1875, person: 'C', fs: 30 }] });
    const a = fresh(blank({ people, events: [sleep] })), mon = [...col0(a).querySelectorAll('.ev')];
    const luis = mon.find(b => b.classList.contains('mgo')); expect(luis.getAttribute('aria-label')).toContain('Ann');
    expect(mon.map(b => b.dataset.lane).sort()).toEqual(['0/3', '1/3', '2/3']); expect(col0(a).querySelectorAll('.ov')).toHaveLength(0);
  });
  it('events of the same person, or without a responsible person, that touch only through a margin share one lane without stripes', () => {
    const a = fresh(blank({ people, events: [work(), pickup('A'), ev1({ id: 'q', title: 'Q', slots: [{ day: 0, start: 900, end: 1050, person: 'B' }] })] }));
    const lane = id => a.qa('.ev').find(b => b._it.e.id === id).dataset.lane; expect([lane('w'), lane('p'), lane('q')]).toEqual(['0/2', '0/2', '1/2']); expect(a.qa('.ov')).toHaveLength(0);
    const b = fresh(blank({ people, events: [work(), pickup('')] })); expect(b.qa('.ev').map(x => x.dataset.lane)).toEqual([undefined, undefined]); expect(b.qa('.ov')).toHaveLength(0);
  });
  it('an all-margin piece that shares a person with an overlapping event stays in that event\'s lane and gets no stripes', () => {
    const a = fresh(blank({ people, events: [ev1({ id: 'x', title: 'X', slots: [{ day: 0, start: 1200, end: 1440, person: 'A' }] }), ev1({ id: 'y', title: 'Y', slots: [{ day: 0, start: 1320, end: 1560, person: 'A', fs: 180 }] })] }));
    expect([...col0(a).querySelectorAll('.ev')].map(b => b.dataset.lane)).toEqual([undefined, undefined]); expect(col0(a).querySelectorAll('.ov')).toHaveLength(0);
  });
  it('when cores overlap and the events go side by side, their margins follow their lanes', () => {
    const a = fresh(blank({ people, events: [work(), pickup('B', 960)] })); expect(a.q('.mg.b').dataset.lane).toBe('0/2'); expect(a.q('.mg.t').dataset.lane).toBe('0/2');
  });
  it('repetitions that overlap only in their margins are not warned about', () => {
    const a = fresh(); const set = (s1, s2) => a.ev(`overlapSet({},${JSON.stringify([s1, s2])}).size`);
    expect(set({ day: 0, start: 600, end: 690, fe: 30 }, { day: 0, start: 660, end: 720 })).toBe(0); expect(set({ day: 0, start: 600, end: 690 }, { day: 0, start: 660, end: 720 })).toBe(2);
    expect(set({ day: 6, start: 1380, end: 1500, fe: 60 }, { day: 0, start: 0, end: 60, fs: 30 })).toBe(0);
  });
  it('the pointer over a margin covered by another core picks that core only; over margins alone it finds the margin', () => {
    const a = fresh(blank({ people, events: [work(), pickup('')] }));
    expect(a.ev('piecesAt(0,1010,true).map(x=>x.e.id)')).toEqual(['p']); expect(a.ev('piecesAt(0,550,true).map(x=>x.e.id)')).toEqual(['w']);
    const b = fresh(blank({ people, events: [work(), pickup('A', 1005, { fs: 15 })] })); expect(b.ev('piecesAt(0,1010,true).map(x=>x.e.id)')).toEqual(['w', 'p']);
  });
  it('dragging a margin moves the whole event and the margins come along', async () => {
    const a = fresh(blank({ people, events: [work()] })); await dragFrom(a, a.q('.mg.t'), { col: 0, min: 550 }, { col: 1, min: 610 });
    expect(events(a)[0].slots[0]).toMatchObject({ day: 1, start: 600, end: 1080, fs: 30, fe: 15 });
  });
  it('resizing keeps the margin lengths and shrinks them (end margin first) when the core would drop below 15 minutes', async () => {
    const a = fresh(blank({ people, events: [work()] })); let box = a.q('.ev');
    await dragFrom(a, box, { col: 0, min: 1017 }, { col: 0, min: 735 }, { target: box._rz }); expect(events(a)[0].slots[0]).toMatchObject({ start: 540, end: 735, fs: 30, fe: 15 });
    box = a.q('.ev'); await dragFrom(a, box, { col: 0, min: 732 }, { col: 0, min: 585 }, { target: box._rz });
    const s = events(a)[0].slots[0]; expect([s.end, s.fs, s.fe]).toEqual([585, 30, undefined]);
  });
  it('the resize handle sits at the outer end of the bottom margin', () => {
    const a = fresh(blank({ people, events: [work()] })); expect(a.q('.ev')._rz.style.top).toBe(y(1020));
  });
  it('a piece past midnight that is all margin is drawn as a dashed box with the title, beside a parallel event in its own lane', () => {
    const a = fresh(blank({ people, events: [ev1({ slots: [{ day: 0, start: 1320, end: 1470, person: 'A', fe: 30 }] }), ev1({ id: 'o', slots: [{ day: 1, start: 0, end: 60, person: 'B' }] })] }));
    a.ev('prefs.showEarly=true;render()'); const tue = a.q('.day[data-d="1"] .ev.mgo');
    expect(tue).not.toBeNull(); expect(tue.dataset.lane).toBe('0/2'); expect(a.q('.day[data-d="1"] .ev:not(.mgo)').dataset.lane).toBe('1/2'); expect(tue.querySelector('.t').textContent).toBe('Event'); expect(tue._rz).toBeTruthy();
    expect(cssRule(a, '.ev.mgo').style.getPropertyValue('border')).toMatch(/2px dashed var\(--c\)/);
  });
  it('screen readers, the hover card and the agenda give the flexible start and end times', () => {
    const a = fresh(blank({ people, events: [work()] })), note = 'Start between 09:00 and 09:30 · Finish between 16:45 and 17:00';
    expect(a.q('.ev').getAttribute('aria-label')).toContain(note); expect(a.ev('peekHTML(piecesAt(0,600,true))')).toContain(note);
    a.ev('openAgenda(0)'); expect(a.q('#agBody').textContent).toContain(note);
    a.ev("setLang('es')"); expect(a.q('.ev').getAttribute('aria-label')).toContain('Empieza entre las 09:00 y las 09:30 · Termina entre las 16:45 y las 17:00');
  });
  it('import snaps margins to 15 minutes, keeps at least 15 minutes of core, ignores them on flexible-time slots and phases', () => {
    const d = fresh().ev('parseData({schedules:[],rhythms:[{id:"r"}],events:[{id:"x",schedules:[],slots:[{day:0,start:600,end:720,fs:31,fe:-5},{day:1,start:600,end:660,fs:45,fe:45},{day:2,start:600,end:660,fs:15,flex:true},{day:3,start:600,end:660,fs:"x"}]}],phases:[{id:"p",rhythms:["r"],slots:[{day:0,start:0,end:60,fs:15}]}]})');
    expect(d.events[0].slots.map(({ fs, fe, flex }) => [fs, fe, flex])).toEqual([[30, undefined, undefined], [45, undefined, undefined], [undefined, undefined, true], [undefined, undefined, undefined]]);
    expect(d.phases[0].slots[0].fs).toBeUndefined();
  });
  it('choosing "Flexible start/end" on a day shows its two margin lists under it (15 min each by default)', () => {
    const a = fresh(blank({ people, events: [ev1({ slots: [{ day: 0, start: 540, end: 1020, person: '' }, { day: 2, start: 540, end: 1020, person: '' }] })] })); open(a);
    expect(sub(a, 2).style.display).toBe('none'); change(a, tsel(a, 2), 'edge'); expect(sub(a, 2).style.display).toBe(''); expect(sub(a, 0).style.display).toBe('none');
    expect(mg(a, 2).map(x => x.value)).toEqual(['15', '15']); expect(mg(a, 2).map(x => x.getAttribute('aria-label'))).toEqual(['Flexible start', 'Flexible end']);
    expect(sub(a, 2).textContent).toContain('May start up to'); change(a, mg(a, 2)[1], '60');
    a.q('#fOk').click(); expect(events(a)[0].slots.map(s => [s.fs, s.fe])).toEqual([[undefined, undefined], [15, 60]]);
  });
  it('a margin of 0 is not stored, and both at 0 means fixed times', () => {
    const a = fresh(blank({ people, events: [ev1({ slots: [{ day: 0, start: 540, end: 1020, person: '' }] })] })); open(a);
    change(a, tsel(a, 0), 'edge'); change(a, mg(a, 0)[1], '0'); a.q('#fOk').click(); expect(events(a)[0].slots[0]).not.toHaveProperty('fe'); expect(events(a)[0].slots[0].fs).toBe(15);
  });
  it('the copy button carries the margins to every other ticked day', () => {
    const a = fresh(blank({ people, events: [ev1({ slots: [{ day: 0, start: 540, end: 1020, person: '' }, { day: 2, start: 540, end: 1020, person: '' }] })] })); open(a);
    change(a, tsel(a, 0), 'edge'); change(a, mg(a, 0)[0], '30'); row(a, 0).querySelector('.cpy').click(); a.q('.cmenu .oi').click(); expect(tsel(a, 2).value).toBe('edge'); expect(mg(a, 2).map(x => x.value)).toEqual(['30', '15']);
    a.q('#fOk').click(); expect(events(a)[0].slots.map(s => [s.fs, s.fe])).toEqual([[30, 15], [30, 15]]);
  });
  it('opening an event with flexible start/end shows it on its day, and saving keeps it', () => {
    const a = fresh(blank({ people, events: [work()] })); open(a);
    expect(tsel(a, 0).value).toBe('edge'); expect(mg(a, 0).map(x => x.value)).toEqual(['30', '15']);
    a.q('#fOk').click(); expect(events(a)[0].slots[0]).toMatchObject({ fs: 30, fe: 15 });
  });
  it('the two kinds of flexible time exclude each other on one repetition', () => {
    const a = fresh(blank({ people, events: [work()] })); open(a); change(a, tsel(a, 0), 'flex'); a.q('#fOk').click();
    expect(events(a)[0].slots[0]).toMatchObject({ flex: true }); expect(events(a)[0].slots[0]).not.toHaveProperty('fs');
  });
  it('saving refuses margins that leave less than 15 minutes of fixed time, naming the day', () => {
    const a = fresh(blank({ people, events: [ev1({ slots: [{ day: 3, start: 540, end: 600, person: '' }] })] })); open(a);
    change(a, tsel(a, 3), 'edge'); change(a, mg(a, 3)[0], '30'); change(a, mg(a, 3)[1], '30'); a.q('#fOk').click();
    expect(a.q('#err').textContent).toBe('Thursday: the flexible start and end must leave at least 15 minutes of fixed time.'); expect(dlgOpen(a)).toBe(true);
  });
});

describe('R-EVT-22 A colour per repetition: the event colour, the performer colour or one of its own', () => {
  const twoDays = (s0 = {}, s1 = {}, o = {}) => fresh(blank({ people, events: [ev1({ id: 'e', title: 'Swim', color: '#3b6df0', owner: 'A', slots: [{ day: 0, start: 600, end: 660, person: 'A', fo: true, ...s0 }, { day: 1, start: 600, end: 660, person: 'B', ...s1 }], ...o })] }));
  const boxC = (a, d) => a.q(`.day[data-d="${d}"] .ev`).style.getPropertyValue('--c');
  const open = a => a.ev('openDlg(S.events[0])');
  const sw = (a, i) => a.qa('#fDays .dr')[i].querySelector('.cbtn');
  const menu = a => a.qa('.cmenu .oi').map(b => b.textContent);
  const pick = (a, i, label) => { sw(a, i).click(); a.qa('.cmenu .oi').find(b => b.textContent.startsWith(label)).click(); };
  it('by default every repetition is drawn in the event colour and stores no colour of its own', () => {
    const a = twoDays(); expect([boxC(a, 0), boxC(a, 1)]).toEqual(['#3b6df0', '#3b6df0']);
    open(a); save(a); expect(events(a)[0].slots.every(s => !('col' in s))).toBe(true);
  });
  it('a repetition with its own colour draws its box, margins and hover card in it; the other days keep the event colour', () => {
    const a = twoDays({ col: '#ff8800', fe: 15 }); expect([boxC(a, 0), boxC(a, 1)]).toEqual(['#ff8800', '#3b6df0']);
    expect(a.q('.day[data-d="0"] .mg').style.getPropertyValue('--c')).toBe('#ff8800');
    expect(a.ev('peekRows({e:S.events[0],s:S.events[0].slots[0],q:{p:0,day:0,a:600,b:660}})')).toContain('background:#ff8800');
  });
  it('"performer colour" follows the person who performs it, also when that person is recoloured; nobody → the event colour', () => {
    const a = twoDays({ col: 'p' }, { col: 'p' }); expect([boxC(a, 0), boxC(a, 1)]).toEqual(['#e5484d', '#2fa66a']);
    a.ev("S.people[0].color='#123456';render()"); expect(boxC(a, 0)).toBe('#123456');
    a.ev("S.events[0].slots[1].person='';render()"); expect(boxC(a, 1)).toBe('#3b6df0');
  });
  it('background strips and the day agenda use the repetition colour too', () => {
    const a = twoDays({ col: '#ff8800' }, {}, { bg: true }); expect(a.q('.day[data-d="0"] .bgs').style.getPropertyValue('--c')).toBe('#ff8800');
    a.ev('openAgenda(0)'); expect(a.q('#agBody .ai').getAttribute('style')).toContain('#ff8800');
  });
  it('the dialog has a Colour swatch per time that shows the colour the box will get, named in its label', () => {
    const a = twoDays({}, { col: 'p' }); open(a);
    expect(sw(a, 0).style.background).toBe('rgb(59, 109, 240)'); expect(sw(a, 0).getAttribute('aria-label')).toBe('Monday: colour: Event colour');
    expect(sw(a, 1).style.background).toBe('rgb(47, 166, 106)'); expect(sw(a, 1).getAttribute('aria-label')).toBe("Tuesday: colour: Performer's colour (Bob)");
    expect(sw(a, 1).querySelector('svg')).not.toBeNull();   // a person icon marks "follows the performer"
  });
  it('the swatch menu offers the event colour, the performer colour (named) and another colour, with the current one ticked', () => {
    const a = twoDays(); open(a); sw(a, 0).click();
    expect(menu(a)).toEqual(['Event colour', "Performer's colour (Ann)", 'Activity type colour (no type, so the event colour)', 'Other colour…']); expect(a.q('.cmenu .oi.on').textContent).toBe('Event colour');
    expect(a.q('.cmenu').parentElement.id).toBe('dlg');   // inside the modal dialog, so it can be clicked
  });
  it('choosing the performer colour saves it as following the performer; choosing the event colour again removes it', () => {
    const a = twoDays(); open(a); pick(a, 0, "Performer's"); save(a); expect(events(a)[0].slots[0].col).toBe('p');
    open(a); pick(a, 0, 'Event colour'); save(a); expect('col' in events(a)[0].slots[0]).toBe(false);
  });
  it('"Other colour…" opens the colour picker; Apply gives the time a colour of its own', () => {
    const a = twoDays(); open(a); pick(a, 1, 'Other colour');
    const pop = a.q('.cpop'); const hex = pop.querySelector('input[type=text]'); hex.value = '#112233'; hex.oninput();
    [...pop.querySelectorAll('button')].find(b => b.textContent === 'Apply').click(); expect(sw(a, 1).getAttribute('aria-label')).toBe('Tuesday: colour: Own colour (#112233)');
    save(a); expect(events(a)[0].slots[1].col).toBe('#112233');
  });
  it('the swatch follows a new performer, a new owner and a new event colour while the dialog is open', () => {
    const a = twoDays({ col: 'p' }); open(a); const ps = a.qa('#fDays .dr')[0].querySelectorAll('select')[2];
    change(a, ps, 'C'); expect(sw(a, 0).getAttribute('aria-label')).toContain('(Cy)');
    change(a, ps, a.ev('OWN')); change(a, a.q('#fOw'), 'B'); expect(sw(a, 0).getAttribute('aria-label')).toContain('(Bob)');
    a.ev("setFC('#00ff00')"); expect(sw(a, 1).style.background).toBe('rgb(0, 255, 0)');
  });
  it('⧉ copies the colour to the other days and + starts a new time in the event colour', () => {
    const a = twoDays({ col: '#ff8800' }); open(a); a.qa('#fDays .dr')[0].querySelector('.cpy').click(); a.q('.cmenu .oi').click();
    a.qa('#fDays .dr')[0].querySelector('.addt').click(); save(a);
    expect(events(a)[0].slots.map(s => s.col)).toEqual(['#ff8800', undefined, '#ff8800']);
  });
  it('the saved data keeps only "p", "t" or a #rrggbb colour, and phases never get one', () => {
    const a = fresh(); const parse = j => JSON.parse(a.ev(`JSON.stringify(parseData(${JSON.stringify(j)}))`));
    const d = parse(blank({ events: [ev1({ slots: [{ day: 0, start: 600, end: 660, person: '', col: 'p' }, { day: 1, start: 600, end: 660, person: '', col: '#ABCDEF' }, { day: 2, start: 600, end: 660, person: '', col: 'red' }, { day: 3, start: 600, end: 660, person: '', col: 't' }] })],
      rhythms: [{ id: 'r', name: 'R', visible: true }], phases: [{ id: 'ph', title: 'P', desc: '', color: '#3b6df0', rhythms: ['r'], slots: [{ day: 0, start: 600, end: 660, col: '#ff8800' }] }] }));
    expect(d.events[0].slots.map(s => s.col)).toEqual(['p', '#abcdef', undefined, 't']); expect('col' in d.phases[0].slots[0]).toBe(false);
  });
  const typed = (s0 = {}, o = {}) => fresh(blank({ people, types: [{ id: 'tw', name: 'Work', color: '#aa5500', icon: 'work' }, { id: 'ts', name: 'Sleep', color: '#0055aa', icon: 'moon' }],
    events: [ev1({ id: 'e', title: 'Job', color: '#3b6df0', type: 'tw', slots: [{ day: 0, start: 600, end: 660, person: 'A', col: 't', ...s0 }, { day: 1, start: 600, end: 660, person: 'A' }], ...o })] }));
  it('"activity type colour" draws the repetition in its type colour and follows a recoloured type; the other days keep the event colour', () => {
    const a = typed(); expect([boxC(a, 0), boxC(a, 1)]).toEqual(['#aa5500', '#3b6df0']);
    a.ev("S.types[0].color='#00aa55';render()"); expect(boxC(a, 0)).toBe('#00aa55');
    a.ev("S.events[0].type='ts';render()"); expect(boxC(a, 0)).toBe('#0055aa');
  });
  it('"activity type colour" on an event without a type (or whose type was deleted) falls back to the event colour', () => {
    const a = typed({}, { type: undefined }); expect(boxC(a, 0)).toBe('#3b6df0');
    const b = typed(); b.ev("delType(S.types[0])"); expect(boxC(b, 0)).toBe('#3b6df0'); expect(b.ev('S.events[0].slots[0].col')).toBe('t');
  });
  it('the dialog offers the type colour by name, its swatch shows the type icon, and it follows a new type chosen in the dialog', () => {
    const a = typed(); open(a); expect(sw(a, 0).getAttribute('aria-label')).toBe('Monday: colour: Activity type colour (Work)');
    expect(sw(a, 0).style.background).toBe('rgb(170, 85, 0)'); expect(sw(a, 0).querySelector('svg')).not.toBeNull();
    change(a, a.q('#fTy'), 'ts'); expect(sw(a, 0).style.background).toBe('rgb(0, 85, 170)'); expect(sw(a, 0).getAttribute('aria-label')).toContain('(Sleep)');
    sw(a, 1).click(); expect(menu(a)).toContain('Activity type colour (Sleep)');
  });
  it('choosing the type colour saves "t", and ⧉ copies it to the other days', () => {
    const a = typed({ col: undefined }); open(a); pick(a, 0, 'Activity type'); a.qa('#fDays .dr')[0].querySelector('.cpy').click(); a.q('.cmenu .oi').click(); save(a);
    expect(events(a)[0].slots.map(s => s.col)).toEqual(['t', 't']);
  });
});

describe('R-EVT-16 Involved people only on call: available, not busy', () => {
  const open = (a, i = 0) => a.ev(`openDlg(S.events[${i}])`);
  const ann = (o = {}) => ev1({ id: 'a', title: 'Homework', slots: [{ day: 0, start: 600, end: 720, person: 'A' }], ...o });
  const bobWithAnn = (o = {}) => ev1({ id: 'b', title: 'Repairs', color: '#2fa66a', involved: ['A'], slots: [{ day: 0, start: 630, end: 690, person: 'B' }], ...o });
  it('the dialog has a labelled checkbox under the involved people; ticking it saves oncall:true, unticking removes it', () => {
    const a = fresh(blank({ people, events: [bobWithAnn()] })); open(a); const cb = a.q('#fOnCall');
    expect(cb.checked).toBe(false); expect(cb.closest('label').textContent).toBe('Involved people are only on call'); expect(cb.closest('label').title).toMatch(/^They are only available/);
    cb.checked = true; save(a); expect(events(a)[0].oncall).toBe(true);
    open(a); expect(a.q('#fOnCall').checked).toBe(true); a.q('#fOnCall').checked = false; save(a); expect(events(a)[0]).not.toHaveProperty('oncall');
  });
  it('people on call never make an event clash: it goes side by side with their own activities, without stripes', () => {
    const a = fresh(blank({ people, events: [ann(), bobWithAnn({ oncall: true })] })); expect(a.qa('.ev').map(b => b.dataset.lane)).toEqual(['0/2', '1/2']); expect(a.qa('.ov')).toHaveLength(0);
    const b = fresh(blank({ people, events: [ann(), bobWithAnn()] })); expect(b.qa('.ov').length).toBeGreaterThan(0);
  });
  it('the responsible person still clashes, and an on-call event without a responsible person still clashes with everything', () => {
    const a = fresh(blank({ people, events: [ann(), bobWithAnn({ oncall: true, slots: [{ day: 0, start: 630, end: 690, person: 'A' }] })] })); expect(a.qa('.ov').length).toBeGreaterThan(0);
    const b = fresh(blank({ people, events: [ann(), bobWithAnn({ oncall: true, slots: [{ day: 0, start: 630, end: 690, person: '' }] })] })); expect(b.qa('.ov').length).toBeGreaterThan(0);
  });
  it('box, screen readers, hover card and agenda say "On call:" instead of "With:"', () => {
    const a = fresh(blank({ people, events: [bobWithAnn({ oncall: true })] })), box = a.q('.ev');
    expect(box.querySelector('.wi').textContent).toBe('On call: Ann'); expect(box.getAttribute('aria-label')).toContain('On call: Ann');
    expect(a.ev('peekHTML(piecesAt(0,640,true))')).toContain('On call:'); a.ev('openAgenda(0)'); expect(a.q('#agBody').textContent).toContain('On call: Ann');
    a.ev("setLang('es')"); expect(a.q('.ev .wi').textContent).toBe('De guardia: Ann');
  });
  it('the people filter still shows the event when only an on-call person is shown', () => {
    const a = fresh(blank({ people: [people[0], { ...people[1], visible: false }], events: [bobWithAnn({ oncall: true })] })); expect(a.qa('.ev')).toHaveLength(1);
  });
  it('import accepts the flag only when it is exactly true', () => {
    const d = fresh().ev('parseData({schedules:[],events:[{id:"x",schedules:[],oncall:true,slots:[{day:0,start:0,end:60}]},{id:"y",schedules:[],oncall:1,slots:[{day:0,start:0,end:60}]}]})');
    expect(d.events.map(e => e.oncall)).toEqual([true, undefined]);
  });
  it('the checkbox is translated', () => {
    const a = fresh(blank({ people, events: [bobWithAnn()] })); a.ev("setLang('es')"); open(a); expect(a.q('#fOnCall').closest('label').textContent).toBe('Las personas implicadas solo están de guardia');
  });
});

describe('R-EVT-17 Background activities are slim strips that never clash', () => {
  const ppl = [...people, person({ id: 'X', name: 'Cleaner', color: '#12a5b5', external: true })];
  const clean = (o = {}) => ev1({ id: 'c', title: 'Cleaning', color: '#12a5b5', bg: true, slots: [{ day: 0, start: 600, end: 780, person: 'X' }], ...o });
  const work = (o = {}) => ev1({ id: 'w', title: 'Work', slots: [{ day: 0, start: 540, end: 1020, person: 'A' }], ...o });
  const col0 = a => a.q('.day[data-d="0"]');
  const at = (a, x, m) => a.ev(`(()=>{const c=document.querySelector('.day[data-d="0"]');return piecesAt(0,${m},true,fxAt(c,${x})).map(i=>i.e.id)})()`);
  it('an activity marked "In the background" is a strip on the right, not a box', () => {
    const a = fresh(blank({ people: ppl, events: [clean()] })), st = a.q('.bgs');
    expect(a.qa('.ev')).toHaveLength(0); expect(st.dataset.strip).toBe('0/1'); expect(st.style.right).toBe('0px'); expect(st.style.top).toBe(`${(600 - 300) / 60 * 48}px`);
    expect(cssRule(a, '.bgs').style.getPropertyValue('width')).toBe('14px'); expect(st.getAttribute('aria-label')).toBe('Cleaning, 10:00–13:00, By: Cleaner (external), In the background');
  });
  it('an external person\'s activity without the mark is an ordinary box with the usual rules, with or without people on call', () => {
    const a = fresh(blank({ people: ppl, events: [clean({ bg: undefined }), work()] })); expect(a.qa('.bgs')).toHaveLength(0); expect(a.qa('.ev')).toHaveLength(2);
    expect(fresh(blank({ people: ppl, events: [clean({ bg: undefined, involved: ['A'], oncall: true })] })).qa('.bgs')).toHaveLength(0);
    const b = fresh(blank({ people: ppl, events: [clean({ bg: undefined, involved: ['A'] }), work()] })); expect(b.qa('.ev')).toHaveLength(2); expect(b.qa('.ov').length).toBeGreaterThan(0);
    expect(fresh(blank({ people: ppl, events: [clean({ involved: ['A'] }), work()] })).qa('.bgs')).toHaveLength(1);   // marked: a strip even with normally involved people
  });
  it('a column with strips reserves a gutter for them; other columns do not', () => {
    const a = fresh(blank({ people: ppl, events: [clean(), work({ slots: [{ day: 0, start: 540, end: 1020, person: 'A' }, { day: 1, start: 540, end: 1020, person: 'A' }] })] }));
    expect(col0(a).style.getPropertyValue('--gut')).toBe('16px'); expect(a.q('.day[data-d="1"]').style.getPropertyValue('--gut')).toBe('');
    expect(cssRule(a, '.ev').style.getPropertyValue('right')).toMatch(/^calc\(3px \+ var\(--gut, ?0px\)\)$/);
  });
  it('a strip never takes a lane or causes stripes, even next to an event without a responsible person', () => {
    const a = fresh(blank({ people: ppl, events: [clean(), work(), ev1({ id: 'n', title: 'Nobody', slots: [{ day: 0, start: 600, end: 660, person: '' }] })] }));
    expect(a.qa('.ov').length).toBeGreaterThan(0); expect(new Set(a.qa('.ov').map(o => o.style.top))).toEqual(new Set([`${(600 - 300) / 60 * 48}px`]));   // only Work × Nobody
    const b = fresh(blank({ people: ppl, events: [clean(), work()] })); expect(b.qa('.ov')).toHaveLength(0); expect(b.q('.ev').dataset.lane).toBeUndefined();
  });
  it('overlapping strips sit next to each other in a wider gutter', () => {
    const a = fresh(blank({ people: ppl, events: [clean(), clean({ id: 'g', title: 'Garden', slots: [{ day: 0, start: 720, end: 840, person: 'X' }] })] }));
    expect(a.qa('.bgs').map(s => [s.dataset.strip, s.style.right])).toEqual([['0/2', '0px'], ['1/2', '16px']]); expect(col0(a).style.getPropertyValue('--gut')).toBe('32px');
  });
  it('the pointer near the right edge finds the strip; elsewhere it finds the boxes, never the strip', () => {
    const a = fresh(blank({ people: ppl, events: [clean(), work()] }));
    expect(at(a, 98, 630)).toEqual(['c']); expect(at(a, 50, 630)).toEqual(['w']); expect(at(a, 88, 630)).toEqual(['c']); expect(at(a, 85, 630)).toEqual(['c']); expect(at(a, 83, 630)).toEqual(['w']);
  });
  it('a strip opens, moves and resizes like an event', async () => {
    const a = fresh(blank({ people: ppl, events: [clean()] })); let st = a.q('.bgs');
    await dragFrom(a, st, { col: 0, min: 610 }, { col: 1, min: 670 }); expect(events(a)[0].slots[0]).toMatchObject({ day: 1, start: 660, end: 840 });
    st = a.q('.bgs'); expect(st._rz).toBeTruthy(); await dragFrom(a, st, { col: 1, min: 835 }, { col: 1, min: 900 }, { target: st._rz }); expect(events(a)[0].slots[0].end).toBe(900);
    st = a.q('.bgs'); await dragFrom(a, st, { col: 1, min: 700 }, { col: 1, min: 700 }, { move: false }); expect(dlgOpen(a)).toBe(true); expect(a.q('#fT').value).toBe('Cleaning');
  });
  it('locked strips are click-through and get no resize handle; in Phases mode strips are inert', () => {
    const a = fresh(blank({ people: ppl, schedules: [sched({ locked: true })], events: [clean()] })); expect(a.q('.bgs').classList.contains('locked')).toBe(true); expect(a.q('.bgs')._rz).toBeUndefined();
    expect(cssRule(a, '.phmode .bgs').style.getPropertyValue('pointer-events')).toBe('none');
  });
  it('flexible start/end shows as a lighter part of the strip, flexible time as a dashed strip', () => {
    const a = fresh(blank({ people: ppl, events: [clean({ slots: [{ day: 0, start: 600, end: 780, person: 'X', fs: 60 }] }), clean({ id: 'f', slots: [{ day: 1, start: 600, end: 780, person: 'X', flex: true }] })] }));
    expect(a.q('.day[data-d="0"] .bgs').style.background).toContain('linear-gradient'); expect(a.q('.day[data-d="1"] .bgs').classList.contains('flex')).toBe(true);
  });
  it('a strip is shaped like a lip (flush right, right corners rounded) and shows its title reading top-to-bottom', () => {
    const a = fresh(blank({ people: ppl, events: [clean()] })), st = a.q('.bgs'), r = cssRule(a, '.bgs').style, sp = cssRule(a, '.bgs span').style;
    expect(r.getPropertyValue('border-radius')).toBe('0 6px 6px 0'); expect(st.querySelector('span').textContent).toBe('Cleaning');
    expect(sp.getPropertyValue('writing-mode')).toBe('vertical-rl'); expect(sp.getPropertyValue('transform')).toBe(''); expect(sp.getPropertyValue('text-overflow')).toBe('ellipsis');
    expect(st.style.color).toBe('rgb(0, 0, 0)');   // ink(): black text on the light teal
  });
  it('a strip title is plain text, never markup', () => {
    const a = fresh(blank({ people: ppl, events: [clean({ title: '<img src=x onerror=alert(1)>' })] })); const sp = a.q('.bgs span');
    expect(sp.querySelector('img')).toBeNull(); expect(sp.textContent).toBe('<img src=x onerror=alert(1)>');
  });
  it('with a flexible start the title begins where the solid part begins; dashed and all-margin strips use the page text colour', () => {
    const a = fresh(blank({ people: ppl, events: [clean({ slots: [{ day: 0, start: 600, end: 780, person: 'X', fs: 60 }] }), clean({ id: 'f', slots: [{ day: 1, start: 600, end: 780, person: 'X', flex: true }] })] }));
    expect(a.q('.day[data-d="0"] .bgs span').style.paddingTop).toBe(`${48 + 3}px`); expect(a.q('.day[data-d="1"] .bgs').style.color).toBe('var(--fg)');
  });
  it('the part before midnight keeps only its top-right corner rounded, the part after only its bottom-right', () => {
    const a = fresh(blank({ people: ppl, events: [clean({ slots: [{ day: 0, start: 1380, end: 1800, person: 'X' }] })] }));   // 23:00 → 06:00, past the hidden early hours
    expect([a.q('.day[data-d="0"] .bgs').style.borderRadius, a.q('.day[data-d="1"] .bgs').style.borderRadius]).toEqual(['0 6px 0 0', '0 0 6px 0']);
  });
  it('a strip draws a background band across its column for its time window, reaching up to the strip', () => {
    const a = fresh(blank({ people: ppl, events: [clean()] })), st = a.q('.bgs'), bb = col0(a).querySelector('.bgb');
    expect(col0(a).querySelectorAll('.bgb')).toHaveLength(1); expect([bb.style.top, bb.style.height]).toEqual([st.style.top, st.style.height]); expect(bb.style.right).toBe('14px');
    expect(bb.style.getPropertyValue('--c')).toBe('#12a5b5'); expect(a.q('.day[data-d="1"] .bgb')).toBeNull();
  });
  it('the band starts in the full event colour next to the strip, fades to transparent at the left, and never takes the pointer', () => {
    const r = cssRule(fresh(), '.bgb').style; expect(r.getPropertyValue('background')).toMatch(/linear-gradient\(to left, ?var\(--c\), ?transparent\)/);
    expect(r.getPropertyValue('pointer-events')).toBe('none'); expect(r.getPropertyValue('left')).toBe('0');
  });
  it('the band lies under the hour lines, the flexible margins and every box', () => {
    const a = fresh(blank({ people: ppl, events: [clean(), work({ slots: [{ day: 0, start: 540, end: 1020, person: 'A', fs: 30 }] })] })), kids = [...col0(a).children], at = sel => kids.findIndex(k => k.matches(sel));
    expect(at('.bgb')).toBeGreaterThanOrEqual(0); expect(at('.bgb')).toBeLessThan(at('.gl')); expect(at('.bgb')).toBeLessThan(at('.mg')); expect(at('.bgb')).toBeLessThan(at('.ev'));
  });
  it('overlapping strips each get a band; each band reaches its own strip', () => {
    const a = fresh(blank({ people: ppl, events: [clean(), clean({ id: 'g', title: 'Garden', slots: [{ day: 0, start: 720, end: 840, person: 'X' }] })] }));
    expect([...col0(a).querySelectorAll('.bgb')].map(b => b.style.right)).toEqual(['14px', '30px']);
  });
  it('flexible start/end makes the band fainter outside the core; flexible time and all-margin pieces give a fainter band', () => {
    const a = fresh(blank({ people: ppl, events: [clean({ slots: [{ day: 0, start: 600, end: 780, person: 'X', fs: 60 }] }), clean({ id: 'f', slots: [{ day: 1, start: 600, end: 780, person: 'X', flex: true }] })] }));
    expect(a.q('.day[data-d="0"] .bgb').style.maskImage).toContain('48px'); expect(a.q('.day[data-d="1"] .bgb').style.maskImage).toBe(''); expect(+a.q('.day[data-d="1"] .bgb').style.opacity).toBe(0.5);
  });
  it('only the lip is interactive: a press on the band area starts a new event, and the strip is not found there', () => {
    const a = fresh(blank({ people: ppl, events: [clean()] })); expect(at(a, 40, 630)).toEqual([]);
    a.ev(`(()=>{const c=document.querySelector('.day[data-d="0"]');c.onpointerdown({button:0,target:c,clientX:40,clientY:300,pointerId:1,pointerType:'mouse',preventDefault(){},stopPropagation(){}})})()`);
    expect(a.q('.ghost')).not.toBeNull(); pointer(a, 'pointerup', { x: 40, y: 300 }); expect(dlgOpen(a)).toBe(true); expect(a.q('#fT').value).toBe('');
  });
  it('a strip shows the hover card with its title, person and times', () => {
    const a = fresh(blank({ people: ppl, events: [clean()] })); const h = a.ev(`(()=>{const c=document.querySelector('.day[data-d="0"]');return peekHTML(piecesAt(0,630,true,fxAt(c,98)))})()`);
    expect(h).toContain('Cleaning'); expect(h).toContain('By: Cleaner'); expect(h).toContain('10:00–13:00');
  });
});

describe('R-EVT-19 Events marked "In the background" are background strips', () => {
  const kids = [...people, person({ id: 'O', name: 'Olivia', color: '#d6409f' })];
  const screen = (o = {}) => ev1({ id: 'sf', title: 'Screen-free time', color: '#607d8b', bg: true, slots: [{ day: 0, start: 1080, end: 1200, person: 'O' }], ...o });
  const homework = (o = {}) => ev1({ id: 'hw', title: 'Homework', slots: [{ day: 0, start: 1080, end: 1140, person: 'O' }], ...o });
  const col0 = a => a.q('.day[data-d="0"]');
  it('a marked event led by one of our people is a strip at the right edge, not a box', () => {
    const a = fresh(blank({ people: kids, events: [screen()] })); expect(a.qa('.ev')).toHaveLength(0); expect(a.qa('.bgs')).toHaveLength(1);
    expect(a.q('.bgs').style.right).toBe('0px'); expect(col0(a).style.getPropertyValue('--gut')).toBe('16px');
  });
  it('it never clashes with the person\'s own activities: no stripes, no lanes', () => {
    const a = fresh(blank({ people: kids, events: [screen(), homework()] })); expect(a.qa('.ov')).toHaveLength(0); expect(a.q('.ev').dataset.lane).toBeUndefined();
    const b = fresh(blank({ people: kids, events: [screen({ bg: undefined }), homework()] })); expect(b.qa('.ov').length).toBeGreaterThan(0);
  });
  it('for the whole family (nobody responsible) or with involved people it is still a strip', () => {
    expect(fresh(blank({ people: kids, events: [screen({ slots: [{ day: 0, start: 1080, end: 1200, person: '' }] })] })).qa('.bgs')).toHaveLength(1);
    expect(fresh(blank({ people: kids, events: [screen({ involved: ['A', 'B'] })] })).qa('.bgs')).toHaveLength(1);
  });
  it('the people filter applies as for any event', () => {
    const a = fresh(blank({ people: [people[0], { ...kids[3], visible: false }], events: [screen()] })); expect(a.qa('.bgs')).toHaveLength(0);
    const b = fresh(blank({ people: [{ ...people[0], visible: false }], events: [screen({ slots: [{ day: 0, start: 1080, end: 1200, person: '' }] })] })); expect(b.qa('.bgs')).toHaveLength(1);
  });
  it('labels: "By:" only with a responsible person, "(external)" only for external people, "With:" unless on call, plus the note', () => {
    const a = fresh(blank({ people: kids, events: [screen({ involved: ['A'] })] }));
    expect(a.q('.bgs').getAttribute('aria-label')).toBe('Screen-free time, 18:00–20:00, By: Olivia, With: Ann, In the background');
    const b = fresh(blank({ people: kids, events: [screen({ slots: [{ day: 0, start: 1080, end: 1200, person: '' }] })] }));
    expect(b.q('.bgs').getAttribute('aria-label')).toBe('Screen-free time, 18:00–20:00, In the background');
    expect(b.ev('peekHTML(piecesAt(0,1100,true))')).toContain('In the background'); b.ev('openAgenda(0)'); expect(b.q('#agBody').textContent).toContain('In the background');
    b.ev("setLang('es')"); expect(b.q('.bgs').getAttribute('aria-label')).toContain('En segundo plano');
  });
  it('the statistics leave it out entirely, also as involved time', () => {
    const a = fresh(blank({ people: kids, events: [screen({ involved: ['A'] }), homework()] }));
    expect(a.ev('personStats("O",true).planned')).toBe(60); expect(a.ev('personStats("A",true).planned')).toBe(0);
  });
  it('it never nests and is never a host of nested activities', () => {
    const a = fresh(blank({ people: kids, events: [screen({ nest: true }), homework(), ev1({ id: 'm', title: 'Tidy', nest: true, slots: [{ day: 0, start: 1150, end: 1165, person: 'O' }] })] }));
    expect(a.qa('.ev.nest')).toHaveLength(0); expect(a.qa('.bgs')).toHaveLength(1);
  });
  it('the dialog checkbox saves and loads the mark, and turns the nesting option off while ticked', () => {
    const a = fresh(blank({ people: kids, events: [homework()] })); a.ev('openDlg(S.events[0])'); const cb = a.q('#fBg');
    expect(cb.closest('label').textContent).toBe("In the background (doesn't keep us busy)"); expect(cb.closest('label').title).toMatch(/^For things that happen in the background.*the cleaner/);
    expect(a.q('#fNest').disabled).toBe(false); cb.checked = true; cb.onchange(); expect(a.q('#fNest').disabled).toBe(true);
    a.q('#fOk').click(); expect(a.ev('S.events[0].bg')).toBe(true); expect(a.qa('.bgs')).toHaveLength(1);
    a.ev('openDlg(S.events[0])'); expect(a.q('#fBg').checked).toBe(true); expect(a.q('#fNest').disabled).toBe(true);
    a.q('#fBg').checked = false; a.q('#fBg').onchange(); a.q('#fOk').click(); expect(a.ev('"bg" in S.events[0]')).toBe(false);
  });
  it('the checkbox and its explanation are translated', () => {
    const a = fresh(blank({ people: kids, events: [homework()] })); a.ev("setLang('es')"); a.ev('openDlg(S.events[0])');
    expect(a.q('#fBg').closest('label').textContent).toBe('En segundo plano (no nos ocupa)'); expect(a.q('#fBg').closest('label').title).toMatch(/^Para lo que ocurre en segundo plano.*tira/);
  });
  it('import accepts the mark only when it is exactly true', () => {
    const d = fresh().ev('parseData({schedules:[],events:[{id:"x",schedules:[],bg:true,slots:[{day:0,start:0,end:60}]},{id:"y",schedules:[],bg:1,slots:[{day:0,start:0,end:60}]}]})');
    expect(d.events.map(e => e.bg)).toEqual([true, undefined]);
  });
});

describe('R-EVT-23 Fixed lanes (Tools): a lane per visible person, in People order, never shared', () => {
  const at = (id, title, person, start, end, o = {}, day = 0) => ev1({ id, title, slots: [{ day, start, end, person }], ...o });
  const fixed = (events, o = {}) => { const a = fresh(blank({ people, events, ...o })); a.ev('prefs.lanesFix=true;render()'); return a; };
  const boxes = (a, t) => a.qa('.ev').filter(b => b.getAttribute('aria-label').startsWith(t + ','));
  const lanesOf = (a, t) => boxes(a, t).map(b => b.dataset.lane);
  it('it is off by default; the Tools switch turns it on and this browser remembers it', () => {
    const a = fresh(blank({ people, events: [at('a', 'Solo', 'A', 600, 660)] })); expect(a.ev('prefs.lanesFix')).toBe(false); expect(lanesOf(a, 'Solo')).toEqual([undefined]);
    const c = [...a.qa('#sbin label.zck')].find(l => l.textContent === 'Fixed lanes, one per person').querySelector('input'); c.checked = true; c.onchange();
    expect(lanesOf(a, 'Solo')).toEqual(['0/3']); expect(openApp({ storage: a.storage() }).ev('prefs.lanesFix')).toBe(true);
  });
  it('every visible person has a lane on every day, also where they have nothing planned: a lone event keeps its person\'s narrow lane', () => {
    const a = fixed([at('a', 'Ann alone', 'A', 600, 660), at('c', 'Cy alone', 'C', 600, 660, {}, 1)]);
    expect(lanesOf(a, 'Ann alone')).toEqual(['0/3']); expect(lanesOf(a, 'Cy alone')).toEqual(['2/3']);
  });
  it('a hidden person has no lane; the lanes follow the People order as shown', () => {
    const a = fixed([at('a', 'Ann alone', 'A', 600, 660), at('c', 'Cy alone', 'C', 600, 660)], { people: [people[2], { ...people[1], visible: false }, people[0]] });
    expect(lanesOf(a, 'Cy alone')).toEqual(['0/2']); expect(lanesOf(a, 'Ann alone')).toEqual(['1/2']);
  });
  it('an event is drawn in the lane of each of its people: neighbouring lanes make one box, separated lanes separate boxes', () => {
    const a = fixed([at('x', 'Ann with Cy', 'A', 600, 660, { involved: ['C'] }), at('y', 'Ann with Bob', 'A', 600, 660, { involved: ['B'] }, 1)]);
    expect(lanesOf(a, 'Ann with Cy')).toEqual(['0/3', '2/3']); expect(lanesOf(a, 'Ann with Bob')).toEqual(['0-1/3']);
  });
  it('people only on call take no lane, unless they are the only visible people of the event', () => {
    const a = fixed([at('x', 'Cleaning', 'A', 600, 660, { involved: ['C'], oncall: true })]); expect(lanesOf(a, 'Cleaning')).toEqual(['0/3']);
    const b = fixed([at('x', 'Cleaning', 'A', 600, 660, { involved: ['C'], oncall: true })], { people: [{ ...people[0], visible: false }, people[1], people[2]] });
    expect(lanesOf(b, 'Cleaning')).toEqual(['1/2']);
  });
  it('an event without a responsible person spans every lane', () => {
    const a = fixed([at('x', 'Family dinner', '', 1200, 1260, { involved: ['B'] })]); expect(lanesOf(a, 'Family dinner')).toEqual(['0-2/3']);
  });
  const gardener = { id: 'G', name: 'Gardener', color: '#607d8b', visible: true, external: true };
  it('an external person gets no lane unless they have an activity that is not in the background', () => {
    const none = fixed([at('a', 'Ann alone', 'A', 600, 660)], { people: [...people, gardener] }); expect(lanesOf(none, 'Ann alone')).toEqual(['0/3']);   // no activity at all
    const bg = fixed([at('a', 'Ann alone', 'A', 600, 660), at('g', 'Mowing', 'G', 600, 720, { bg: true })], { people: [...people, gardener] });
    expect(lanesOf(bg, 'Ann alone')).toEqual(['0/3']); expect(bg.qa('.bgs')).toHaveLength(1);   // only a strip: still no lane
  });
  it('one activity of theirs on the grid gives an external person a lane after our people, on every day', () => {
    const a = fixed([at('a', 'Ann alone', 'A', 600, 660, {}, 1), at('g', 'Hedges', 'G', 600, 720)], { people: [gardener, ...people] });
    expect(lanesOf(a, 'Hedges')).toEqual(['3/4']); expect(lanesOf(a, 'Ann alone')).toEqual(['0/4']);   // Tuesday has the lane too
  });
  it('an activity in a hidden schedule, or only on call, gives an external person no lane', () => {
    const hid = fixed([at('a', 'Ann alone', 'A', 600, 660), at('g', 'Hedges', 'G', 600, 720, { schedules: ['s2'] })], { people: [...people, gardener], schedules: [sched(), sched({ id: 's2', name: 'Hidden', visible: false })] });
    expect(lanesOf(hid, 'Ann alone')).toEqual(['0/3']);
    const oc = fixed([at('x', 'Questions', 'A', 600, 660, { involved: ['G'], oncall: true })], { people: [...people, gardener] }); expect(lanesOf(oc, 'Questions')).toEqual(['0/3']);
  });
  it('stripes appear only in a shared lane: Ann\'s work under her shared event, not Bob\'s work beside it', () => {
    const a = fixed([at('a', 'Ann work', 'A', 540, 720), at('b', 'Bob work', 'B', 540, 720), at('x', 'Ann with Cy', 'A', 600, 660, { involved: ['C'] })]);
    expect(a.qa('.day[data-d="0"] .ov').map(o => o.dataset.lane)).toEqual(['0/3']);
  });
  it('clicking either box of an event finds it, and an empty lane finds nothing', () => {
    const a = fixed([at('x', 'Ann with Cy', 'A', 600, 660, { involved: ['C'] })]); const ids = fx => a.ev(`piecesAt(0,630,true,${fx}).map(x=>x.e.id)`);
    expect(ids(0.1)).toEqual(['x']); expect(ids(0.9)).toEqual(['x']); expect(ids(0.5)).toEqual([]);
  });
  it('dragging the second box of an event moves the event', async () => {
    const a = fixed([at('x', 'Ann with Cy', 'A', 600, 660, { involved: ['C'] })]);
    await dragFrom(a, boxes(a, 'Ann with Cy')[1], { col: 0, min: 630 }, { col: 1, min: 690 }); expect(a.ev('S.events[0].slots[0]')).toMatchObject({ day: 1, start: 660 });
  });
  it('a nested activity sits in its host\'s box that holds its own person\'s lane', () => {
    const a = fixed([at('h', 'School run', 'A', 480, 540, { involved: ['C'] }), at('m', 'Milk', 'C', 495, 510, { nest: true })]);
    expect(lanesOf(a, 'School run')).toEqual(['0/3', '2/3']); expect(boxes(a, 'Milk')[0].classList.contains('nest')).toBe(true); expect(lanesOf(a, 'Milk')).toEqual(['2/3']);
  });
  it('without any visible person everything shares one lane, as before', () => {
    const a = fixed([at('a', 'One', '', 600, 660), at('b', 'Two', '', 600, 660)], { people: [] }); expect([...lanesOf(a, 'One'), ...lanesOf(a, 'Two')]).toEqual([undefined, undefined]);
  });
});
