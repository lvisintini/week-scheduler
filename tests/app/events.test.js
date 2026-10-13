import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, sched, ev1, person, dragFrom, createDrag, fillDialog, dlgOpen, sleep } from '../helpers/app.js';

const fresh = (data, o = {}) => { const a = openApp(o); if (data) setData(a, data); return a; };
const people = [person({ id: 'A', name: 'Ann', color: '#e5484d' }), person({ id: 'B', name: 'Bob', color: '#2fa66a' }), person({ id: 'C', name: 'Cy', color: '#8e4ec6' })];
const save = a => a.q('#fOk').click();
const events = a => a.ev('JSON.parse(JSON.stringify(S.events))');
const cssRule = (a, selector) => [...a.d.styleSheets[0].cssRules].find(r => r.selectorText === selector);

describe('R-EVT-01 Creating, moving, resizing and removing events', () => {
  it('the + button opens a new-event dialog on Monday 09:00–10:00', () => {
    const a = fresh(); a.toolbar('add').click();
    expect(dlgOpen(a)).toBe(true); expect(a.q('#fS').value).toBe('540'); expect(a.q('#fE').value).toBe('600');
    expect(a.qa('#fDays .dr').map(r => r.querySelector('input').checked)).toEqual([true, false, false, false, false, false, false]);
  });
  it('dragging over empty space creates an event for that time range, snapped to 15 minutes', async () => {
    const a = fresh(blank()); await createDrag(a, { col: 2, min: 607 }, { col: 2, min: 698 });
    expect(dlgOpen(a)).toBe(true); expect(a.q('#fS').value).toBe('600'); expect(a.q('#fE').value).toBe('705');
    expect(a.qa('#fDays .dr').map(r => r.querySelector('input').checked)).toEqual([false, false, true, false, false, false, false]);
  });
  it('a plain click on empty space creates a one-hour event at that time', async () => {
    const a = fresh(blank()); await createDrag(a, { col: 1, min: 780 }, { col: 1, min: 780 }, { move: false });
    expect([a.q('#fS').value, a.q('#fE').value]).toEqual(['780', '840']);
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
    await dragFrom(a, box, { col: 0, min: 655 }, { col: 0, min: 706 }, { target: box.querySelector('.rz') });
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
  it('at least one day is required in Quick mode', () => {
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
  it('the responsible-person list offers "none" and every person; the involved list offers every person', () => {
    const a = fresh(blank({ people })); a.toolbar('add').click();
    expect([...a.q('#fP').options].map(o => o.textContent)).toEqual(['— none —', 'Ann', 'Bob', 'Cy']);
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
    expect(a.q('#fT').value).toBe('Existing'); expect(a.q('#fD').value).toBe('old'); expect(a.q('#fP').value).toBe('A');
    expect(a.qa('#fInv input').filter(i => i.checked).map(i => i.value)).toEqual(['B']); expect(a.q('#fS').value).toBe('840'); expect(a.q('#fE').value).toBe('900');
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
  it('person icons inside event boxes are small (10 px) so they match the text', () => {
    const a = full(); expect(cssRule(a, '.ev .ic svg').style.getPropertyValue('width')).toBe('10px');
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
  it('the title keeps clear of the icons (padding grows with the number of icons)', () => {
    const a = fresh(blank({ schedules: [sched({ locked: true })], events: [ev1({ slots: [{ day: 0, start: 600, end: 660, person: '' }, { day: 1, start: 600, end: 660, person: '' }] })] }));
    expect(a.q('.ev .r1').style.paddingRight).toBe('32px');
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
    const a = fresh(blank({ events: ['a', 'b', 'c', 'd'].map(id => ev1({ id, title: 'Event ' + id })) })); hover(a, 0, 630); await sleep(420);
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
