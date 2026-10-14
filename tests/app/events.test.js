import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, sched, ev1, person, dragFrom, createDrag, fillDialog, dlgOpen, sleep, pointer } from '../helpers/app.js';

const fresh = (data, o = {}) => { const a = openApp(o); if (data) setData(a, data); return a; };
const people = [person({ id: 'A', name: 'Ann', color: '#e5484d' }), person({ id: 'B', name: 'Bob', color: '#2fa66a' }), person({ id: 'C', name: 'Cy', color: '#8e4ec6' })];
const save = a => a.q('#fOk').click();
const events = a => a.ev('JSON.parse(JSON.stringify(S.events))');
const iconHTML = (a, k) => a.ev(`(()=>{const d=document.createElement("span");d.innerHTML=tIcon(${JSON.stringify(k)});return d.innerHTML})()`);   // as the browser serialises it
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
  it('overlapping repetitions of the same event stay on top of each other even with different people', () => {
    const a = fresh(blank({ people, events: [ev1({ id: 'a', title: 'A', slots: [{ day: 0, start: 600, end: 720, person: 'A' }, { day: 0, start: 660, end: 780, person: 'B' }] })] }));
    expect(a.qa('.day[data-d="0"] .ev').map(lane)).toEqual([null, null]); expect(a.qa('.ov')).toHaveLength(1);
  });
  it('only visible occurrences take a lane: hiding a person gives the other event the full width', () => {
    const a = pair({}, {}, { people: [people[0], { ...people[1], visible: false }, people[2]] });
    expect(box(a, 'B')).toBeUndefined(); expect(lane(box(a, 'A'))).toBeNull();
  });
  it('turning the setting off brings back the overlapping view with stripes, and it is remembered per browser', () => {
    const a = pair(); expect(a.ev('prefs.side')).toBe(true);
    a.ev('openSettings()'); const cb = a.qa('#xDlg .sopt').find(l => l.textContent.includes('Show parallel events side by side')).querySelector('input');
    expect(cb.checked).toBe(true); cb.checked = false; cb.dispatchEvent(new a.w.Event('change'));
    expect(lane(box(a, 'A'))).toBeNull(); expect(a.qa('.ov')).toHaveLength(1);
    expect(JSON.parse(a.storage()['weekly-schedules-prefs']).side).toBe(false);
  });
  it('the settings tooltip explains the rule and the column-width workaround in both languages', () => {
    const a = pair();
    expect(a.ev("L('sideTip')")).toMatch(/share a person.*stripes.*column width/s);
    a.ev("setLang('es')"); expect(a.ev("L('sideTip')")).toMatch(/comparten una persona.*rayas.*ancho de columna/s);
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
  it('with "Keep lanes in the order of the People list" the order is fixed, and what cannot span is merged into one lane with stripes', () => {
    const a = fresh(blank({ people, events: [at('a', 'A', 'A', 600, 720), at('b', 'B', 'B', 600, 720), at('c', 'C', 'C', 600, 720), at('x', 'X', 'A', 660, 780, { involved: ['C'] })] }));
    a.ev('prefs.sideFix=true;render()'); expect(lanes(a, 'A', 'C', 'X', 'B')).toEqual(['0/2', '0/2', '0/2', '1/2']); expect(a.qa('.day[data-d="0"] .ov').length).toBeGreaterThan(0);
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
  it('the setting sits under "Show parallel events side by side", is off by default, is disabled while that is off and is remembered per browser', () => {
    const a = abx(); expect(a.ev('prefs.sideFix')).toBe(false); a.ev('openSettings()');
    const row = t => a.qa('#xDlg .sopt').find(l => l.textContent.includes(t)), fix = row('Keep lanes in the order of the People list');
    expect(fix.classList.contains('sub')).toBe(true); expect(row('Show parallel events side by side').nextElementSibling).toBe(fix);
    const side = row('Show parallel events side by side').querySelector('input'); side.checked = false; side.dispatchEvent(new a.w.Event('change')); expect(fix.querySelector('input').disabled).toBe(true);
    side.checked = true; side.dispatchEvent(new a.w.Event('change')); fix.querySelector('input').checked = true; fix.querySelector('input').dispatchEvent(new a.w.Event('change'));
    expect(JSON.parse(a.storage()['weekly-schedules-prefs']).sideFix).toBe(true);
  });
  it('many overlapping events without people are still drawn quickly as one striped lane', () => {
    const a = fresh(blank({ events: Array.from({ length: 300 }, (_, i) => at('e' + i, 'E' + i, '', 600 + (i % 8) * 15, 720)) })); const t0 = Date.now(); a.ev('render()');
    expect(Date.now() - t0).toBeLessThan(3000); expect(a.qa('.day[data-d="0"] .ev[data-lane]')).toHaveLength(0);
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

describe('R-EVT-12 Flexible time: events or single repetitions with approximate timing get a dashed border', () => {
  const tim = a => a.q('#fTim'), timV = a => tim(a).dataset.v;   // segmented control: data-v holds '' | 'edge' | 'flex' | 'mix'
  const setTim = (a, v) => tim(a).querySelector(`button[data-tm="${v}"]`).click();
  const pressed = a => [...tim(a).querySelectorAll('button')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.tm);
  const pick = (a, btn, k) => { btn.click(); a.q(`.tmpop .oi[data-tm="${k}"]`).click(); };
  const rowBtn = (a, day) => a.qa('#fDays .dr')[day].querySelector('.fxt');
  const open = (a, i = 0) => a.ev(`openDlg(S.events[${i}])`);
  const twoDays = (f0 = false, f2 = false) => ev1({ slots: [{ day: 0, start: 600, end: 660, person: '', ...(f0 ? { flex: true } : {}) }, { day: 2, start: 600, end: 660, person: '', ...(f2 ? { flex: true } : {}) }] });
  it('a flexible repetition is drawn with a dashed border; the other repetitions keep the normal border', () => {
    const a = fresh(blank({ events: [twoDays(true, false)] }));
    const [mon, wed] = [a.q('.day[data-d="0"] .ev'), a.q('.day[data-d="2"] .ev')];
    expect(mon.classList.contains('flex')).toBe(true); expect(mon.style.getPropertyValue('--dash')).not.toBe(''); expect(wed.classList.contains('flex')).toBe(false);
    expect(cssRule(a, '.ev.flex').style.getPropertyValue('border')).toMatch(/2px dashed var\(--dash\)/);
  });
  it('the dashed border colour contrasts with the box: light on dark colours, dark on light ones', () => {
    const a = fresh(blank({ events: [ev1({ id: 'd', color: '#1d2330', slots: [{ day: 0, start: 600, end: 660, person: '', flex: true }] }), ev1({ id: 'y', color: '#f5c518', slots: [{ day: 1, start: 600, end: 660, person: '', flex: true }] })] }));
    expect(a.q('.day[data-d="0"] .ev').style.getPropertyValue('--dash')).toMatch(/^#fff/); expect(a.q('.day[data-d="1"] .ev').style.getPropertyValue('--dash')).toMatch(/^#1d2330/);
  });
  it('screen readers, the hover card and the agenda say "Flexible time (around these times)"', () => {
    const a = fresh(blank({ events: [twoDays(true)] })); expect(a.q('.ev').getAttribute('aria-label')).toContain('Flexible time (around these times)');
    expect(a.ev('peekHTML(piecesAt(0,630,true))')).toContain('Flexible time'); a.ev('openAgenda(0)'); expect(a.q('#agBody').textContent).toContain('Flexible time');
  });
  it('the Timing list set to "Flexible (around these times)" makes every repetition flexible when saved', () => {
    const a = fresh(blank({ events: [twoDays()] })); open(a); expect(timV(a)).toBe('');
    setTim(a, 'flex'); save(a); expect(events(a)[0].slots.map(s => s.flex)).toEqual([true, true]);
  });
  it('the per-day toggle opens a popover; choosing flexible there marks only that repetition and the Timing list shows "Mixed"', () => {
    const a = fresh(blank({ events: [twoDays()] })); open(a); pick(a, rowBtn(a, 2), 'flex');
    expect(rowBtn(a, 2).getAttribute('aria-pressed')).toBe('true'); expect(a.q('.tmpop')).toBeNull(); expect(timV(a)).toBe('mix'); expect(pressed(a)).toEqual([]); expect(a.q('#fTimMix').textContent).toBe('Mixed (set per day)');
    save(a); expect(events(a)[0].slots.map(s => !!s.flex)).toEqual([false, true]);
  });
  it('opening an event with some flexible repetitions shows them pressed and the Timing list "Mixed"', () => {
    const a = fresh(blank({ events: [twoDays(true, false)] })); open(a);
    expect([rowBtn(a, 0), rowBtn(a, 2)].map(b => b.classList.contains('on'))).toEqual([true, false]); expect(timV(a)).toBe('mix');
  });
  it('setting the Timing list to Fixed clears every repetition', () => {
    const a = fresh(blank({ events: [twoDays(true, true)] })); open(a); expect(timV(a)).toBe('flex'); expect(pressed(a)).toEqual(['flex']); expect(a.q('#fTimMix').textContent).toBe('');
    setTim(a, ''); save(a); expect(events(a)[0].slots.some(s => s.flex)).toBe(false);
  });
  it('a day ticked while the whole event is flexible becomes flexible too', () => {
    const a = fresh(blank({ events: [twoDays(true, true)] })); open(a); const cb = a.qa('#fDays .dr')[4].querySelector('input'); cb.checked = true; cb.onchange();
    save(a); expect(events(a)[0].slots.map(s => [s.day, !!s.flex])).toEqual([[0, true], [2, true], [4, true]]);
  });
  it('Advanced mode has the same toggle on each block, and switching modes keeps the choice', () => {
    const a = fresh(blank({ events: [twoDays(false, true)] })); open(a); a.q('#tabA').click();
    const bt = a.qa('#fBlocks .br .fxt'); expect(bt.map(b => b.classList.contains('on'))).toEqual([false, true]); pick(a, bt[0], 'flex'); expect(timV(a)).toBe('flex');
    a.q('#tabQ').click(); expect([rowBtn(a, 0), rowBtn(a, 2)].map(b => b.classList.contains('on'))).toEqual([true, true]);
    save(a); expect(events(a)[0].slots.every(s => s.flex)).toBe(true);
  });
  it('dragging a flexible event keeps the mark on every repetition', async () => {
    const a = fresh(blank({ events: [twoDays(true, false)] })); await dragFrom(a, a.q('.day[data-d="0"] .ev'), { col: 0, min: 630 }, { col: 0, min: 690 });
    expect(events(a)[0].slots.map(s => [s.start, !!s.flex])).toEqual([[660, true], [660, false]]);
  });
  it('only a true value is accepted on import, and phases never get the mark', () => {
    const p = a => a.ev('parseData({schedules:[],rhythms:[{id:"r"}],events:[{id:"x",schedules:[],slots:[{day:0,start:0,end:60,flex:true},{day:1,start:0,end:60,flex:1}]}],phases:[{id:"p",rhythms:["r"],slots:[{day:0,start:0,end:60,flex:true}]}]})');
    const d = p(fresh()); expect(d.events[0].slots.map(s => s.flex)).toEqual([true, undefined]); expect(d.phases[0].slots[0].flex).toBeUndefined();
  });
  it('the overlap rules do not change: overlapping flexible events with nobody in common still sit side by side', () => {
    const a = fresh(blank({ people, events: [ev1({ id: 'a', slots: [{ day: 0, start: 600, end: 720, person: 'A', flex: true }] }), ev1({ id: 'b', slots: [{ day: 0, start: 660, end: 780, person: 'B', flex: true }] })] }));
    expect(a.qa('.ev').map(b => b.dataset.lane)).toEqual(['0/2', '1/2']); expect(a.qa('.ov')).toHaveLength(0);
  });
  it('the per-day toggles and the Timing list are translated when the language changes', () => {
    const a = fresh(blank({ events: [ev1()] })); a.ev("setLang('es')"); expect(rowBtn(a, 0).title).toMatch(/^Horas solo de esta repetición/);
    open(a); expect([...tim(a).querySelectorAll('button')].map(o => o.textContent)).toEqual(['Fijas', 'Inicio/fin flexible', 'Flexibles (alrededor de estas horas)']);
    expect([...a.qa('#dlg label')].some(l => l.textContent === 'Horas')).toBe(true); expect(tim(a).getAttribute('aria-label')).toBe('Horas');
  });
});

describe('R-EVT-15 Flexible start/end: a solid core box with dashed margins that never cause stripes or lanes', () => {
  const y = m => `${(m - 300) / 60 * 48}px`;
  const work = (o = {}) => ev1({ id: 'w', title: 'Work', slots: [{ day: 0, start: 540, end: 1020, person: 'A', fs: 30, fe: 15 }], ...o });
  const pickup = (person = 'B', start = 1005, o = {}) => ev1({ id: 'p', title: 'Pickup', color: '#2fa66a', slots: [{ day: 0, start, end: 1050, person, ...o }] });
  const open = (a, i = 0) => a.ev(`openDlg(S.events[${i}])`);
  const tim = a => a.q('#fTim'), timV = a => tim(a).dataset.v, setTim = (a, v) => tim(a).querySelector(`button[data-tm="${v}"]`).click();
  const rowBtn = (a, day) => a.qa('#fDays .dr')[day].querySelector('.fxt');
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
  it('parallel events that touch only through a margin both keep the full column width (no side-by-side lanes)', () => {
    const a = fresh(blank({ people, events: [work(), pickup('B')] })); expect(a.qa('.ev').map(b => b.dataset.lane)).toEqual([undefined, undefined]);
    const b = fresh(blank({ people, events: [work({ slots: [{ day: 0, start: 540, end: 1020, person: 'A' }] }), pickup('B')] })); expect(b.qa('.ev').map(x => x.dataset.lane)).toEqual(['0/2', '1/2']);
  });
  it('when cores overlap and the events go side by side, their margins follow their lanes', () => {
    const a = fresh(blank({ people, events: [work(), pickup('B', 960)] })); expect(a.q('.mg.b').dataset.lane).toBe('0/2'); expect(a.q('.mg.t').dataset.lane).toBe('0/2');
  });
  it('repetitions that overlap only in their margins are not warned about', () => {
    const a = fresh(); const set = (s1, s2) => a.ev(`overlapSet(${JSON.stringify([s1, s2])}).size`);
    expect(set({ day: 0, start: 600, end: 690, fe: 30 }, { day: 0, start: 660, end: 720 })).toBe(0); expect(set({ day: 0, start: 600, end: 690 }, { day: 0, start: 660, end: 720 })).toBe(2);
    expect(set({ day: 6, start: 1380, end: 1500, fe: 60 }, { day: 0, start: 0, end: 60, fs: 30 })).toBe(0);
  });
  it('the pointer over a margin covered by another core picks that core only; over margins alone it finds the margin', () => {
    const a = fresh(blank({ people, events: [work(), pickup('B')] }));
    expect(a.ev('piecesAt(0,1010,true).map(x=>x.e.id)')).toEqual(['p']); expect(a.ev('piecesAt(0,550,true).map(x=>x.e.id)')).toEqual(['w']);
    const b = fresh(blank({ people, events: [work(), pickup('B', 1005, { fs: 15 })] })); expect(b.ev('piecesAt(0,1010,true).map(x=>x.e.id)')).toEqual(['w', 'p']);
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
  it('a piece past midnight that is all margin is drawn as a dashed box with the title and keeps the full width', () => {
    const a = fresh(blank({ people, events: [ev1({ slots: [{ day: 0, start: 1320, end: 1470, person: 'A', fe: 30 }] }), ev1({ id: 'o', slots: [{ day: 1, start: 0, end: 60, person: 'B' }] })] }));
    a.ev('prefs.showEarly=true;render()'); const tue = a.q('.day[data-d="1"] .ev.mgo');
    expect(tue).not.toBeNull(); expect(tue.dataset.lane).toBeUndefined(); expect(tue.querySelector('.t').textContent).toBe('Event'); expect(tue._rz).toBeTruthy();
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
  it('the Timing list "Flexible start/end" shows two lists (15 min each by default) and applies them to every repetition', () => {
    const a = fresh(blank({ people, events: [ev1({ slots: [{ day: 0, start: 540, end: 1020, person: '' }, { day: 2, start: 540, end: 1020, person: '' }] })] })); open(a);
    expect(a.q('#fEdge').style.display).toBe('none'); setTim(a, 'edge'); expect(a.q('#fEdge').style.display).toBe('');
    expect([a.q('#fFs').value, a.q('#fFe').value]).toEqual(['15', '15']); a.q('#fFs').value = '30'; a.q('#fFs').onchange();
    expect(rowBtn(a, 2).textContent).toBe('+30−15'); a.q('#fOk').click(); expect(events(a)[0].slots.map(s => [s.fs, s.fe])).toEqual([[30, 15], [30, 15]]);
  });
  it('a margin of 0 is not stored, and both at 0 means fixed times', () => {
    const a = fresh(blank({ people, events: [ev1({ slots: [{ day: 0, start: 540, end: 1020, person: '' }] })] })); open(a);
    setTim(a, 'edge'); a.q('#fFe').value = '0'; a.q('#fFe').onchange(); a.q('#fOk').click(); expect(events(a)[0].slots[0]).not.toHaveProperty('fe'); expect(events(a)[0].slots[0].fs).toBe(15);
  });
  it('the per-day popover sets flexible start/end for one repetition only, and the Timing list then shows "Mixed"', () => {
    const a = fresh(blank({ people, events: [ev1({ slots: [{ day: 0, start: 540, end: 1020, person: '' }, { day: 2, start: 540, end: 1020, person: '' }] })] })); open(a);
    rowBtn(a, 2).click(); a.q('.tmpop .oi[data-tm="edge"]').click(); const [fs, fe] = a.qa('.tmpop select');
    expect([fs.value, fe.value]).toEqual(['15', '15']); expect([fs.getAttribute('aria-label'), fe.getAttribute('aria-label')]).toEqual(['Flexible start', 'Flexible end']);
    fe.value = '60'; fe.onchange(); expect(timV(a)).toBe('mix'); expect(rowBtn(a, 2).title).toContain('may start up to 15 min late and finish up to 1 h early');
    a.q('#fOk').click(); expect(events(a)[0].slots.map(s => [s.fs, s.fe])).toEqual([[undefined, undefined], [15, 60]]);
  });
  it('opening an event with flexible start/end shows it in the list and in the day toggles; Advanced mode keeps it', () => {
    const a = fresh(blank({ people, events: [work()] })); open(a);
    expect(timV(a)).toBe('edge'); expect([a.q('#fFs').value, a.q('#fFe').value]).toEqual(['30', '15']); expect(rowBtn(a, 0).classList.contains('on')).toBe(true);
    a.q('#tabA').click(); expect(a.q('#fBlocks .fxt').textContent).toBe('+30−15'); a.q('#fOk').click(); expect(events(a)[0].slots[0]).toMatchObject({ fs: 30, fe: 15 });
  });
  it('the two kinds of flexible time exclude each other on one repetition', () => {
    const a = fresh(blank({ people, events: [work()] })); open(a); setTim(a, 'flex'); a.q('#fOk').click();
    expect(events(a)[0].slots[0]).toMatchObject({ flex: true }); expect(events(a)[0].slots[0]).not.toHaveProperty('fs');
  });
  it('saving refuses margins that leave less than 15 minutes of fixed time, naming the day', () => {
    const a = fresh(blank({ people, events: [ev1({ slots: [{ day: 3, start: 540, end: 600, person: '' }] })] })); open(a);
    setTim(a, 'edge'); a.q('#fFs').value = '30'; a.q('#fFs').onchange(); a.q('#fFe').value = '30'; a.q('#fFe').onchange(); a.q('#fOk').click();
    expect(a.q('#err').textContent).toBe('Thursday: the flexible start and end must leave at least 15 minutes of fixed time.'); expect(dlgOpen(a)).toBe(true);
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

describe('R-EVT-17 Background activities of external people are slim strips that never clash', () => {
  const ppl = [...people, person({ id: 'X', name: 'Cleaner', color: '#12a5b5', external: true })];
  const clean = (o = {}) => ev1({ id: 'c', title: 'Cleaning', color: '#12a5b5', slots: [{ day: 0, start: 600, end: 780, person: 'X' }], ...o });
  const work = (o = {}) => ev1({ id: 'w', title: 'Work', slots: [{ day: 0, start: 540, end: 1020, person: 'A' }], ...o });
  const col0 = a => a.q('.day[data-d="0"]');
  const at = (a, x, m) => a.ev(`(()=>{const c=document.querySelector('.day[data-d="0"]');return piecesAt(0,${m},true,fxAt(c,${x})).map(i=>i.e.id)})()`);
  it('an activity led by an external person without involved people is a strip on the right, not a box', () => {
    const a = fresh(blank({ people: ppl, events: [clean()] })), st = a.q('.bgs');
    expect(a.qa('.ev')).toHaveLength(0); expect(st.dataset.strip).toBe('0/1'); expect(st.style.right).toBe('0px'); expect(st.style.top).toBe(`${(600 - 300) / 60 * 48}px`);
    expect(cssRule(a, '.bgs').style.getPropertyValue('width')).toBe('14px'); expect(st.getAttribute('aria-label')).toBe('Cleaning, 10:00–13:00, By: Cleaner (external)');
  });
  it('with involved people on call it is still a strip; with normally involved people it is a normal box with the usual rules', () => {
    expect(fresh(blank({ people: ppl, events: [clean({ involved: ['A'], oncall: true })] })).qa('.bgs')).toHaveLength(1);
    const a = fresh(blank({ people: ppl, events: [clean({ involved: ['A'] }), work()] })); expect(a.qa('.bgs')).toHaveLength(0); expect(a.qa('.ev')).toHaveLength(2); expect(a.qa('.ov').length).toBeGreaterThan(0);
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
    expect(st.style.color).toBe('rgb(29, 35, 48)');   // ink(): dark text on the light teal
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
