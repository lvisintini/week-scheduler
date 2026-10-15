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
