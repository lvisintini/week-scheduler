import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, ev1, dragFrom, createDrag, pointer, sleep } from '../helpers/app.js';

const fresh = data => { const a = openApp(); if (data) setData(a, data); return a; };
const touchDown = (a, x, y) => ({ clientX: x, clientY: y, pointerType: 'touch' });

describe('R-TOUCH-01 Touch: scrolling stays native, long-press creates/moves/resizes, tap opens', () => {
  it('a mouse starts immediately (no long-press needed)', () => {
    const a = fresh(); let started = 0; a.w.press({ clientX: 1, clientY: 1, pointerType: 'mouse' }, () => { started++; }, null); expect(started).toBe(1);
  });
  it('a touch does not start at once; it starts after holding still for 0.4 s, from where the finger is', async () => {
    const a = fresh(); let started = null; a.w.press(touchDown(a, 10, 10), e => { started = e; }, null); expect(started).toBeNull();
    pointer(a, 'pointermove', { x: 13, y: 12, pointerType: 'touch' }); await sleep(450);
    expect(started).not.toBeNull(); expect([started.clientX, started.clientY, started.pointerType]).toEqual([13, 12, 'touch']);
  });
  it('moving the finger more than 8 px before the hold finishes means scrolling: nothing starts', async () => {
    const a = fresh(); let started = 0, tapped = 0; a.w.press(touchDown(a, 10, 10), () => { started++; }, () => { tapped++; });
    pointer(a, 'pointermove', { x: 10, y: 40, pointerType: 'touch' }); await sleep(450); expect(started).toBe(0); expect(tapped).toBe(0);
  });
  it('a small wobble under 8 px is still a hold', async () => {
    const a = fresh(); let started = 0; a.w.press(touchDown(a, 10, 10), () => { started++; }, null); pointer(a, 'pointermove', { x: 14, y: 14, pointerType: 'touch' }); await sleep(450); expect(started).toBe(1);
  });
  it('lifting the finger before 0.4 s is a tap', async () => {
    const a = fresh(); let started = 0, tapped = 0; a.w.press(touchDown(a, 10, 10), () => { started++; }, () => { tapped++; }); pointer(a, 'pointerup', { x: 10, y: 10, pointerType: 'touch' }); await sleep(450); expect(tapped).toBe(1); expect(started).toBe(0);
  });
  it('a cancelled touch (the browser took over for scrolling) does nothing', async () => {
    const a = fresh(); let started = 0; a.w.press(touchDown(a, 10, 10), () => { started++; }, null); pointer(a, 'pointercancel', { pointerType: 'touch' }); await sleep(450); expect(started).toBe(0);
  });
  it('the phone gives a short vibration when the long-press registers (where supported)', async () => {
    const a = fresh(); let buzz = 0; Object.defineProperty(a.w.navigator, 'vibrate', { value: () => { buzz++; return true; }, configurable: true }); a.w.press(touchDown(a, 1, 1), () => {}, null); await sleep(450); expect(buzz).toBe(1);
  });
  it('while a long-press drag is active, the page is stopped from scrolling', async () => {
    const a = fresh(); const move = () => { const e = new a.w.Event('touchmove', { cancelable: true, bubbles: true }); a.d.dispatchEvent(e); return e.defaultPrevented; };
    expect(move()).toBe(false); a.w.press(touchDown(a, 1, 1), () => {}, null); await sleep(450); expect(move()).toBe(true); pointer(a, 'pointerup', { pointerType: 'touch' }); expect(move()).toBe(false);
  });
  it('the grid columns allow native panning (touch-action: pan-x pan-y) so dragging scrolls', () => {
    const css = fresh().d.querySelector('style').textContent; expect(css).toMatch(/\.day\{[^}]*touch-action:pan-x pan-y/); expect(css).toMatch(/\.lane\{touch-action:pan-x pan-y\}/);
  });
  it('resize handles are taller on touch screens', () => {
    expect(fresh().d.querySelector('style').textContent).toMatch(/@media\(pointer:coarse\)\{\.rz\{height:16px\}\}/);
  });
  it('tapping an event opens it', async () => {
    const a = fresh(blank({ events: [ev1()] })); await dragFrom(a, a.q('.ev'), { col: 0, min: 630 }, { col: 0, min: 630 }, { pointerType: 'touch', move: false });
    expect(a.d.getElementById('dlg').open).toBe(true); expect(a.q('#fT').value).toBe('Event');
  });
  it('tapping where several events overlap offers the list to choose from', async () => {
    const a = fresh(blank({ events: [ev1({ id: 'a', title: 'A' }), ev1({ id: 'b', title: 'B', slots: [{ day: 0, start: 630, end: 700, person: '' }] })] }));
    await dragFrom(a, a.qa('.ev')[0], { col: 0, min: 650 }, { col: 0, min: 650 }, { pointerType: 'touch', move: false }); expect(a.qa('.omenu .oi')).toHaveLength(2);
  });
  it('a quick tap on empty space creates nothing', async () => {
    const a = fresh(blank()); await createDrag(a, { col: 2, min: 600 }, { col: 2, min: 600 }, { pointerType: 'touch', move: false }); expect(a.d.getElementById('dlg').open).toBe(false);
  });
  it('a long-press on empty space followed by a drag creates an event for that range', async () => {
    const a = fresh(blank()); await createDrag(a, { col: 2, min: 600 }, { col: 2, min: 690 }, { pointerType: 'touch', hold: 450 });
    expect(a.d.getElementById('dlg').open).toBe(true); expect([...a.qa('#fDays .dr')[2].querySelectorAll('select')].slice(0, 2).map(x => x.value)).toEqual(['600', '690']);
  });
  it('a long-press on an event followed by a drag moves it', async () => {
    const a = fresh(blank({ events: [ev1()] })); await dragFrom(a, a.q('.ev'), { col: 0, min: 630 }, { col: 1, min: 750 }, { pointerType: 'touch', hold: 450 });
    expect(a.ev('JSON.stringify(S.events[0].slots[0])')).toContain('"day":1');
  });
  it('after a touch, the right-click copy menu does not pop up (a long-press is for moving)', () => {
    const a = fresh(blank({ events: [ev1()] })); const down = new a.w.MouseEvent('pointerdown', { bubbles: true }); Object.defineProperty(down, 'pointerType', { value: 'touch' }); a.q('.day').dispatchEvent(down);
    a.qa('.day')[0].oncontextmenu({ clientX: a.x(0), clientY: a.y(630), preventDefault() {} }); expect(a.qa('.omenu')).toHaveLength(0);
  });
  it('the hover card is never shown for touch input', async () => {
    const a = fresh(blank({ events: [ev1()] })); a.qa('.day')[0].onpointermove({ pointerType: 'touch', buttons: 0, clientX: a.x(0), clientY: a.y(630) }); await sleep(420); expect(a.q('#peek').style.display).not.toBe('block');
  });
});

describe('R-UI-13 Swiping sideways in the day view changes the day', () => {
  const down = (a, x, y, type = 'touch') => { const e = new a.w.MouseEvent('pointerdown', { clientX: x, clientY: y, bubbles: true }); Object.defineProperty(e, 'pointerType', { value: type }); a.q('#grid .day').dispatchEvent(e); };
  const swipe = (a, x, y, dx, dy, type = 'touch') => { down(a, x, y, type); pointer(a, 'pointermove', { x: x + dx / 2, y: y + dy / 2, pointerType: type }); pointer(a, 'pointerup', { x: x + dx, y: y + dy, pointerType: type }); };
  const at = d => { const a = openApp(); a.ev(`setFocus(${d})`); return a; };
  it('a swipe to the left shows the next day, a swipe to the right the previous one (Sunday wraps to Monday)', () => {
    const a = at(2); swipe(a, 500, 300, -120, 10); expect(a.ev('focusD')).toBe(3); swipe(a, 500, 300, 120, -10); swipe(a, 500, 300, 120, 0); expect(a.ev('focusD')).toBe(1);
    const s = at(6); swipe(s, 500, 300, -120, 0); expect(s.ev('focusD')).toBe(0);
  });
  it('short, mostly vertical, mouse and edge swipes change nothing, and nor does the week view', () => {
    const a = at(2); swipe(a, 500, 300, -50, 0); swipe(a, 500, 300, -100, 60); swipe(a, 500, 300, -120, 0, 'mouse'); swipe(a, 10, 300, 120, 0); swipe(a, 1015, 300, -120, 0);
    expect(a.ev('focusD')).toBe(2);
    const w = openApp(); swipe(w, 500, 300, -120, 0); expect(w.ev('focusD')).toBeNull();
  });
  it('a finger that held still for the long-press time is moving an event, not swiping', async () => {
    const a = at(2); down(a, 500, 300); await sleep(450); pointer(a, 'pointermove', { x: 440, y: 300, pointerType: 'touch' }); pointer(a, 'pointerup', { x: 380, y: 300, pointerType: 'touch' }); expect(a.ev('focusD')).toBe(2);
  });
  it('the day view lets the browser scroll only up and down, so sideways moves reach the app', () => {
    const a = at(2); expect(a.q('#grid').classList.contains('fo')).toBe(true); expect(a.q('style').textContent).toContain('#grid.fo .day,#grid.fo .lane{touch-action:pan-y}');
    a.ev('setFocus(null)'); expect(a.q('#grid').classList.contains('fo')).toBe(false);
  });
});

describe('R-TOUCH-02 Copy by touch: a long press released without moving offers the right-click Copy list', () => {
  const locked = () => blank({ schedules: [{ id: 's1', name: 'S1', color: '#3b6df0', opacity: 1, locked: true, visible: true }], events: [ev1()] });
  it('a long press on an event, lifted without moving, opens the Copy list instead of moving anything', async () => {
    const a = fresh(blank({ events: [ev1()] })); const before = a.ev('JSON.stringify(S)');
    await dragFrom(a, a.q('.ev'), { col: 0, min: 630 }, { col: 0, min: 630 }, { pointerType: 'touch', hold: 450, move: false });
    expect(a.q('.omenu .oh').textContent).toBe('Copy event…'); expect(a.qa('.omenu .oi b').map(b => b.textContent)).toEqual(['Event']);
    expect(a.d.getElementById('dlg').open).toBe(false); expect(a.ev('JSON.stringify(S)')).toBe(before); expect(a.ev('undoSt.length')).toBe(0);
  });
  it('choosing an event in the list opens its Copy dialog', async () => {
    const a = fresh(blank({ events: [ev1()] })); await dragFrom(a, a.q('.ev'), { col: 0, min: 630 }, { col: 0, min: 630 }, { pointerType: 'touch', hold: 450, move: false });
    a.q('.omenu .oi').click(); expect(a.dlgTitle()).toBe('Copy event: Event');
  });
  it('where events overlap, the list names each of them', async () => {
    const a = fresh(blank({ events: [ev1({ id: 'a', title: 'A' }), ev1({ id: 'b', title: 'B', slots: [{ day: 0, start: 630, end: 700, person: '' }] })] }));
    await dragFrom(a, a.qa('.ev')[0], { col: 0, min: 650 }, { col: 0, min: 650 }, { pointerType: 'touch', hold: 450, move: false });
    expect(a.q('.omenu .oh').textContent).toBe('Copy event…'); expect(a.qa('.omenu .oi b').map(b => b.textContent).sort()).toEqual(['A', 'B']);
  });
  it('a locked event can be copied by touch too: the long press reaches the column under it, and nothing is created', async () => {
    const a = fresh(locked()); await createDrag(a, { col: 0, min: 630 }, { col: 0, min: 630 }, { pointerType: 'touch', hold: 450, move: false });
    expect(a.qa('.omenu .oi b').map(b => b.textContent)).toEqual(['Event']); expect(a.d.getElementById('dlg').open).toBe(false);
  });
  it('a long press on empty space, lifted without moving, still starts a new event', async () => {
    const a = fresh(blank({ events: [ev1()] })); await createDrag(a, { col: 2, min: 600 }, { col: 2, min: 600 }, { pointerType: 'touch', hold: 450, move: false });
    expect(a.qa('.omenu')).toHaveLength(0); expect(a.d.getElementById('dlg').open).toBe(true);
  });
  it('a long press that then moves still moves the event; a mouse click without moving still opens it', async () => {
    const a = fresh(blank({ events: [ev1()] })); await dragFrom(a, a.q('.ev'), { col: 0, min: 630 }, { col: 1, min: 630 }, { pointerType: 'touch', hold: 450 });
    expect(a.qa('.omenu')).toHaveLength(0); expect(a.ev('S.events[0].slots[0].day')).toBe(1);
    await dragFrom(a, a.q('.ev'), { col: 1, min: 630 }, { col: 1, min: 630 }, { move: false }); expect(a.d.getElementById('dlg').open).toBe(true);
  });
  it('in Phases mode a phase is copied the same way', async () => {
    const a = fresh(blank({ rhythms: [{ id: 'r1', name: 'Normal', visible: true }], phases: [{ id: 'p1', title: 'Lunch', desc: '', color: '#2fa66a', rhythms: ['r1'], slots: [{ day: 0, start: 720, end: 780 }] }] }));
    a.ev("editMode='phases';render()"); await dragFrom(a, a.q('.phx'), { col: 0, min: 750 }, { col: 0, min: 750 }, { pointerType: 'touch', hold: 450, move: false });
    expect(a.qa('.omenu .oi b').map(b => b.textContent)).toEqual(['Lunch']); a.q('.omenu .oi').click(); expect(a.dlgOpen()).toBe(true);
  });
});
