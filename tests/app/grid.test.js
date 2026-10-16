import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, ev1, PREFS_KEY, createDrag, fillDialog } from '../helpers/app.js';

const fresh = (data, o = {}) => { const a = openApp(o); if (data) setData(a, data); return a; };
const headers = a => a.qa('.dh:not(.c)').map(h => h.textContent);
const cssRule = (a, selector) => [...a.d.styleSheets[0].cssRules].find(r => r.selectorText === selector);
const freezeClock = (a, y, m, d, h, min) => a.ev(`Date=class extends Date{constructor(...a){a.length?super(...a):super(${y},${m},${d},${h},${min})}}`);

describe('R-GRID-01 The week runs Monday to Sunday from left to right', () => {
  it('shows seven day columns headed Monday … Sunday in that order', () => {
    expect(headers(fresh())).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    expect(fresh().qa('.day').map(c => c.dataset.d)).toEqual(['0', '1', '2', '3', '4', '5', '6']);
  });
  it('is not tied to dates: headers carry only weekday names', () => {
    expect(headers(fresh()).join(' ')).not.toMatch(/\d/);
  });
  it('an event on day 0 appears in the first column and one on day 6 in the last', () => {
    const a = fresh(blank({ events: [ev1({ id: 'a', slots: [{ day: 0, start: 600, end: 660, person: '' }] }), ev1({ id: 'b', slots: [{ day: 6, start: 600, end: 660, person: '' }] })] }));
    const cols = a.qa('.day');
    expect(cols[0].querySelectorAll('.ev')).toHaveLength(1); expect(cols[6].querySelectorAll('.ev')).toHaveLength(1);
    expect(cols.slice(1, 6).every(c => c.querySelectorAll('.ev').length === 0)).toBe(true);
  });
});

describe('R-GRID-02 Hourly rows from 05:00 to midnight, early hours can be shown', () => {
  it('by default the time column labels run from 05:00 to 23:00', () => {
    const labels = fresh().qa('.times span').map(s => s.textContent);
    expect(labels[0]).toBe('05:00'); expect(labels.at(-1)).toBe('23:00'); expect(labels).toHaveLength(19);
  });
  it('the column is exactly as tall as the visible hours', () => {
    expect(fresh().q('.day').style.height).toBe(`${19 * 48}px`);
  });
  it('showing the early hours adds the rows from 00:00 to 04:00', () => {
    const a = fresh(); a.ev('prefs.showEarly=true;render()');
    const labels = a.qa('.times span').map(s => s.textContent);
    expect(labels[0]).toBe('00:00'); expect(labels).toHaveLength(24);
  });
  it('an event inside the hidden early hours is kept but not drawn until the hours are shown', () => {
    const a = fresh(blank({ events: [ev1({ slots: [{ day: 0, start: 120, end: 240, person: '' }] })] }));
    expect(a.qa('.ev')).toHaveLength(0); expect(a.ev('S.events.length')).toBe(1);
    a.ev('prefs.showEarly=true;render()'); expect(a.qa('.ev')).toHaveLength(1);
  });
  it('an event that starts before 05:00 but ends later is drawn from the top of the visible area', () => {
    const a = fresh(blank({ events: [ev1({ slots: [{ day: 0, start: 240, end: 360, person: '' }] })] }));
    const box = a.q('.ev'); expect(box.style.top).toBe('0px'); expect(parseFloat(box.style.height)).toBeCloseTo(48 - 1, 0);
  });
});

describe('R-GRID-03 Saturday and Sunday: only the header cells have a different hue', () => {
  it('only the Saturday and Sunday headers carry the weekend marker', () => {
    const a = fresh(); expect(a.qa('.dh.we').map(h => h.textContent)).toEqual(['Saturday', 'Sunday']);
  });
  it('the day columns and their lanes are not tinted at all', () => {
    const a = fresh(); expect(a.qa('.day.we, .lane.we')).toHaveLength(0);
    expect(cssRule(a, '.day.we, .lane.we')).toBeUndefined();
  });
  it('the weekend colour fills the header only between the column borders (it starts after the phase-lip lane)', () => {
    const rule = cssRule(fresh(), '.dh.we').style;
    expect(rule.getPropertyValue('background-size')).toContain('calc(100% - var(--lane');
    expect(rule.getPropertyValue('background-position')).toContain('var(--lane');
  });
  it('the Sunday header also fills the lane between Saturday and Sunday so the two weekend headers form one band', () => {
    const a = fresh(); expect(a.qa('.dh.wj').map(h => h.textContent)).toEqual(['Sunday']);
    expect(cssRule(a, '.dh.we.wj').style.getPropertyValue('background-size')).toContain('100% 100%');
  });
  it('a dark-mode weekend colour exists', () => {
    const css = fresh().d.querySelector('style').textContent; expect(css).toMatch(/\[data-theme="dark"\][^}]*--weh/); expect(css).toMatch(/prefers-color-scheme:dark[^}]*--weh/);
  });
  it('with the weekend hidden there are no weekend headers', () => {
    const a = fresh(); a.ev('prefs.hideWeekend=true;render()'); expect(a.qa('.dh.we')).toHaveLength(0);
  });
});

describe('R-GRID-04 View settings: weekend columns, AM/PM clock, now line', () => {
  it('hiding Saturday and Sunday removes both columns and their events from the grid', () => {
    const a = fresh(blank({ events: [ev1({ slots: [{ day: 5, start: 600, end: 660, person: '' }] })] }));
    expect(a.qa('.day')).toHaveLength(7); a.ev('prefs.hideWeekend=true;render()');
    expect(a.qa('.day')).toHaveLength(5); expect(headers(a)).not.toContain('Saturday'); expect(a.qa('.ev')).toHaveLength(0);
  });
  it('the AM/PM clock changes the time labels and the event times', () => {
    const a = fresh(blank({ events: [ev1({ slots: [{ day: 0, start: 810, end: 870, person: '' }] })] }));
    expect(a.q('.ev .tm').textContent).toBe('13:30–14:30'); a.ev('prefs.clock12=true;render()');
    expect(a.q('.ev .tm').textContent).toBe('1:30 PM–2:30 PM'); expect(a.q('.times span').textContent).toBe('5 AM');
  });
  it('the red now line appears on the current weekday at the current time', () => {
    const a = fresh(); freezeClock(a, 2026, 9, 14, 10, 30); a.ev('drawNow()');   // Wednesday 14 Oct 2026, 10:30
    const line = a.q('.day[data-d="2"] .now'); expect(line).not.toBeNull();
    expect(parseFloat(line.style.top)).toBeCloseTo((630 - 300) / 60 * 48, 1);
    expect(a.qa('.now')).toHaveLength(1);
  });
  it('the now line can be switched off and on again', () => {
    const a = fresh(); freezeClock(a, 2026, 9, 14, 10, 30); a.ev('nowOn=false;drawNow()'); expect(a.qa('.now')).toHaveLength(0);
    a.ev('nowOn=true;drawNow()'); expect(a.qa('.now')).toHaveLength(1);
  });
  it('before 05:00 there is no now line while the early hours are hidden, and there is one when they are shown', () => {
    const a = fresh(); freezeClock(a, 2026, 9, 14, 3, 0); a.ev('drawNow()'); expect(a.qa('.now')).toHaveLength(0);
    a.ev('prefs.showEarly=true;render()'); expect(a.qa('.now')).toHaveLength(1);
  });
  it('on a hidden weekend day there is no now line', () => {
    const a = fresh(); freezeClock(a, 2026, 9, 17, 10, 30); a.ev('prefs.hideWeekend=true;render()'); expect(a.qa('.now')).toHaveLength(0);   // Saturday
  });
  it('the Settings dialog offers exactly these view options with explanations', () => {
    const a = fresh(); a.ev('openSettings()');
    const text = a.dlgText(); ['Show early hours', 'Show the "now" line', 'Use AM/PM clock', 'Hide Saturday and Sunday', 'Theme'].forEach(t => expect(text).toContain(t));
  });
  it('view settings are remembered in the browser (not in the workspace data)', () => {
    const a = fresh(); a.ev('openSettings()');
    const boxes = a.qa('#xDlg .sopt input[type=checkbox]'); boxes[0].checked = true; boxes[0].onchange();
    expect(JSON.parse(a.w.localStorage.getItem(PREFS_KEY)).showEarly).toBe(true);
    expect(a.ev('Object.keys(S)')).not.toContain('showEarly');
  });
});

describe('R-GRID-06 Grid basics: hour lines, snapping, header agenda icon', () => {
  it('has 48 px per hour by default', () => { expect(fresh().ev('HH')).toBe(48); expect(fresh().q('#grid').style.getPropertyValue('--hh')).toBe('48px'); });
  it('draws hour lines in an overlay above the phase backgrounds in every column', () => {
    expect(fresh().qa('.day > .gl')).toHaveLength(7);
  });
  it('every day header shows an agenda icon', () => {
    fresh().qa('.dh:not(.c)').forEach(h => expect(h.querySelector('.ic svg')).not.toBeNull());
  });
  it('clicking a day header opens the agenda of that day', () => {
    const a = fresh(); a.qa('.dh:not(.c)')[2].click(); expect(a.d.getElementById('agDlg').open).toBe(true); expect(a.q('#agBody h1').textContent).toBe('Wednesday — agenda');
  });
  it('the day headers and the time column are sticky', () => {
    const a = fresh(); expect(cssRule(a, '.dh').style.getPropertyValue('position')).toBe('sticky'); expect(cssRule(a, '.times').style.getPropertyValue('position')).toBe('sticky');
  });
});

describe('R-GRID-07 Zoom: Fit width / Fit height with their sliders, and the grid text size', () => {
  const sec = a => a.qa('#sbin .sec').at(-1);
  const box = (a, label) => a.qa('#sbin .zck').find(l => l.textContent === label).querySelector('input');
  const slider = (a, label) => a.qa('#sbin .zrow input').find(i => i.getAttribute('aria-label') === label);
  const tick = (a, label, on) => { const c = box(a, label); c.checked = on; c.dispatchEvent(new a.w.Event('change')); };
  const stored = a => JSON.parse(a.w.localStorage.getItem(PREFS_KEY));
  const wrapH = (a, h) => Object.defineProperty(a.q('#wrap'), 'clientHeight', { configurable: true, get: () => h });
  it('by default both Fit boxes are ticked, their two sliders are disabled and the text size slider is enabled', () => {
    const a = fresh(); expect([box(a, 'Fit width').checked, box(a, 'Fit height').checked]).toEqual([true, true]);
    expect([slider(a, 'Column width').disabled, slider(a, 'Row height').disabled, slider(a, 'Text size').disabled]).toEqual([true, true, false]);
  });
  it('the Zoom section lists Fit width + Column width, Fit height + Row height, then Text size and Reset, each slider under its box', () => {
    const a = fresh(); const s = sec(a); expect(s.querySelector('.shbtn span').textContent).toBe('Zoom');
    expect([...s.querySelectorAll('.zck, .zrow > span:first-child, .zsep, .zreset')].map(e => e.className === 'zsep' ? '—' : e.textContent))
      .toEqual(['Fit width', 'Column width', 'Fit height', 'Row height', '—', 'Text size', 'Reset zoom']);
    expect([...s.querySelectorAll('.zrow')].map(r => r.classList.contains('zsub'))).toEqual([true, true, false]);
    expect(box(a, 'Fit width').parentElement.title).toMatch(/sideways/); expect(box(a, 'Fit height').parentElement.title).toMatch(/height of the window/);
    s.querySelector('.shbtn').click(); expect(a.qa('#sbin .zrow')).toHaveLength(0); expect(stored(a).secZoom).toBe(true);
  });
  it('with "Fit width" on the columns share the window width with a 40 px minimum, whatever the slider says', () => {
    const a = fresh(blank()); a.ev('prefs.colW=600;render()'); expect(a.q('#grid').style.gridTemplateColumns).toBe('52px repeat(7,minmax(40px,1fr))');
  });
  it('with "Fit width" off the slider sets the exact width of the columns, so nothing is stretched', () => {
    const a = fresh(blank()); a.ev('prefs.fitW=false;prefs.colW=200;render()'); expect(a.q('#grid').style.gridTemplateColumns).toBe('52px repeat(7,200px)');
    a.ev('prefs.colW=70;render()'); expect(a.q('#grid').style.gridTemplateColumns).toBe('52px repeat(7,70px)');
  });
  it('a disabled slider shows the size the fit produced, and its tooltip says how to choose the size yourself', () => {
    const a = fresh(blank()); wrapH(a, 738); a.ev('render()');   // the fake day columns are 100 px wide
    const c = slider(a, 'Column width'), r = slider(a, 'Row height');
    expect([c.value, c.nextElementSibling.textContent]).toEqual(['100', '100 px']); expect(r.nextElementSibling.textContent).toBe(`${Math.floor((738 - 38) / 19)} px/h`);
    expect(c.title).toContain('Untick "Fit width"'); expect(r.title).toContain('Untick "Fit height"');
  });
  it('unticking "Fit width" keeps the fitted column width, enables the slider and is remembered per browser', () => {
    const a = fresh(blank()); tick(a, 'Fit width', false);
    expect(a.q('#grid').style.gridTemplateColumns).toBe('52px repeat(7,100px)'); expect(slider(a, 'Column width').disabled).toBe(false);
    expect([stored(a).fitW, stored(a).colW]).toEqual([false, 100]); expect(openApp({ storage: a.storage() }).ev('prefs.fitW')).toBe(false);
  });
  it('"Fit height" sizes the rows so the visible hours fill the window under the measured day header', () => {
    const a = fresh(); wrapH(a, 738); a.ev('render()'); expect(a.ev('HH')).toBe(Math.floor((738 - 38) / 19));   // no layout: the usual 38 px header
    Object.defineProperty(a.w.HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return this.classList.contains('dh') ? 60 : 0; } });
    a.ev('render()'); expect(a.ev('HH')).toBe(Math.floor((738 - 60) / 19));
  });
  it('unticking "Fit height" keeps the fitted row height, so the grid does not jump', () => {
    const a = fresh(); wrapH(a, 738); a.ev('render()'); const hh = a.ev('HH'); tick(a, 'Fit height', false);
    expect([a.ev('HH'), stored(a).rowH, stored(a).fitH]).toEqual([hh, hh, false]); expect(slider(a, 'Row height').disabled).toBe(false);
  });
  it('without a laid-out window (height 0) "Fit height" falls back to the row height slider', () => {
    const a = fresh(); a.ev('prefs.rowH=72;render()'); expect(a.ev('HH')).toBe(72);
  });
  it('with "Fit height" off a taller row height makes events and hour labels proportionally taller / further apart', () => {
    const a = fresh(blank({ events: [ev1()] })); wrapH(a, 738); a.ev('prefs.fitH=false;prefs.rowH=96;render()');
    expect(a.ev('HH')).toBe(96); expect(parseFloat(a.q('.ev').style.height)).toBeCloseTo(95, 0); expect(a.qa('.times span')[1].style.top).toBe('96px');
  });
  it('the sliders offer 70–1000 px per column, 24–120 px per hour and 80–160 % text', () => {
    const a = fresh(); expect(['Column width', 'Row height', 'Text size'].map(l => { const i = slider(a, l); return [i.min, i.max]; }))
      .toEqual([['70', '1000'], ['24', '120'], ['80', '160']]);
  });
  it('moving an enabled slider applies at once and is remembered per browser', () => {
    const a = fresh(); tick(a, 'Fit height', false); const r = slider(a, 'Row height'); r.value = 72; r.oninput();
    expect(a.ev('HH')).toBe(72); expect(stored(a).rowH).toBe(72); expect(openApp({ storage: a.storage() }).ev('HH')).toBe(72);
  });
  it('the text size slider scales the grid text through --ts, widens the time column to match and is remembered per browser', () => {
    const a = fresh(blank()); const t = slider(a, 'Text size'); expect(t.nextElementSibling.textContent).toBe('100 %'); t.value = 150; t.oninput();
    expect(a.d.documentElement.style.getPropertyValue('--ts')).toBe('1.5'); expect(a.q('#grid').style.getPropertyValue('--ts')).toBe('1.5');
    expect(t.nextElementSibling.textContent).toBe('150 %'); expect(stored(a).txt).toBe(150);
    expect(a.q('#grid').style.gridTemplateColumns).toBe('78px repeat(7,minmax(40px,1fr))'); expect(a.q('#grid').style.minWidth).toBe(`${78 + 7 * 40}px`);
  });
  it('box text, hour labels, day names, phase labels, box icons and hover cards follow the text size; lips and strip titles do not', () => {
    const a = fresh(); const fs = s => cssRule(a, s).style.getPropertyValue('font-size');
    ['.ev', '.times span', '.phx .pl', '#peek', '.pk .pt1', '.lvb'].forEach(s => expect(fs(s)).toMatch(/var\(--ts,1\)/));
    expect(cssRule(a, '.dh').style.getPropertyValue('font-size')).toBe('calc(14px * var(--ts,1))'); expect(cssRule(a, '.ev .flags svg').style.getPropertyValue('width')).toMatch(/var\(--ts/);
    expect(fs('.lip')).toBe('10px'); expect(fs('.bgs span')).toBe('10px');
  });
  it('"Reset zoom" ticks both Fit boxes again and restores 48 px per hour, 110 px columns and 100 % text', () => {
    const a = fresh(); a.ev('prefs.rowH=100;prefs.colW=200;prefs.fitW=false;prefs.fitH=false;prefs.txt=140;render()'); a.q('#sbin .zreset').click();
    expect(a.ev('[prefs.rowH,prefs.colW,prefs.fitW,prefs.fitH,prefs.txt]')).toEqual([48, 110, true, true, 100]);
  });
  it('out-of-range stored zoom values are corrected on start (too large → maximum, too small → minimum, unusable → default)', () => {
    const a = openApp({ storage: { [PREFS_KEY]: JSON.stringify({ rowH: 5000, colW: -1, txt: 500 }) } });
    expect(a.ev('[prefs.rowH,prefs.colW,prefs.txt]')).toEqual([120, 70, 160]);
    expect(openApp({ storage: { [PREFS_KEY]: JSON.stringify({ colW: 9999, txt: 10 }) } }).ev('[prefs.colW,prefs.txt]')).toEqual([1000, 80]);
    const b = openApp({ storage: { [PREFS_KEY]: JSON.stringify({ rowH: 'x', colW: 0, txt: 'big' }) } });
    expect(b.ev('[prefs.rowH,prefs.colW,prefs.txt]')).toEqual([48, 110, 100]);
    expect(openApp({ storage: { [PREFS_KEY]: JSON.stringify({ txt: 93 }) } }).ev('prefs.txt')).toBe(90);
  });
  it('the retired settings "fit" and "fillW" of earlier versions are ignored: both Fit boxes start ticked', () => {
    const a = openApp({ storage: { [PREFS_KEY]: JSON.stringify({ fit: false, fillW: false }) } }); expect(a.ev('[prefs.fitW,prefs.fitH]')).toEqual([true, true]);
  });
  it('a visible rhythm adds its 18 px label lane to every column', () => {
    const a = fresh(); expect(a.q('#grid').style.getPropertyValue('--lane')).toBe('18px'); expect(a.q('#grid').style.gridTemplateColumns).toBe('52px repeat(7,minmax(58px,1fr))');
  });
  it('the Settings dialog has nothing about zoom any more', () => {
    const a = fresh(); a.ev('openSettings()'); expect(a.qa('#xDlg .zrow, #xDlg .zck, #xDlg input[type=range]')).toHaveLength(0);
    expect(a.qa('#xDlg .stabs button').map(b => b.textContent)).not.toContain('Zoom'); expect(a.dlgText()).not.toMatch(/Row height|Fit height|Text size|Reset zoom/);   // "Fit width" is named in the side-by-side explanation
  });
  it('printing ignores the exact width and stretches the default 110 px columns over the page', () => {
    const a = fresh(blank()); a.ev('prefs.fitW=false;prefs.colW=200;printMode=true;render()'); expect(a.q('#grid').style.gridTemplateColumns).toBe('52px repeat(7,minmax(110px,1fr))'); a.ev('printMode=false;render()');
  });
  it('printing ignores zoom: the printed grid uses the default scale and the screen scale is restored afterwards', () => {
    const a = fresh(blank({ events: [ev1()] })); a.ev('prefs.fitH=false;prefs.rowH=96;render()'); a.ev('printSchedule()');
    expect(a.q('#pr .ev').style.height).toBe(`${48 - 1}px`); expect(a.ev('HH')).toBe(96); expect(a.q('#grid').style.getPropertyValue('--hh')).toBe('96px');
  });
  it('printing ignores the text size: the printed grid is at 100 % and the screen text size comes back afterwards', () => {
    const a = fresh(blank({ events: [ev1()] })); a.ev('prefs.txt=150;render()'); a.ev('printSchedule()');
    expect(a.q('#pr .grid').style.getPropertyValue('--ts')).toBe('1'); expect(a.q('#grid').style.getPropertyValue('--ts')).toBe('1.5');
    expect(a.d.documentElement.style.getPropertyValue('--ts')).toBe('1.5');
  });
});

describe('R-GRID-08 Scrolling: sticky time column and headers, visible scrollbars', () => {
  it('the grid area always shows scrollbars (overflow: scroll) and styles them', () => {
    const a = fresh(); expect(cssRule(a, '.wrap').style.getPropertyValue('overflow')).toBe('scroll');
    expect(a.d.querySelector('style').textContent).toContain('.wrap::-webkit-scrollbar');
  });
  it('the time column sticks to the left and the top-left corner sticks both ways above the other cells', () => {
    const a = fresh(); expect(cssRule(a, '.times').style.getPropertyValue('left')).toBe('0');
    const corner = cssRule(a, '.dh.c').style; expect(corner.getPropertyValue('left')).toBe('0'); expect(Number(corner.getPropertyValue('z-index'))).toBeGreaterThan(Number(cssRule(a, '.times').style.getPropertyValue('z-index')));
  });
  it('the page uses the dynamic viewport height so phone browser bars do not hide the bottom', () => {
    expect(fresh().d.querySelector('style').textContent).toContain('height:100dvh');
  });
});

describe('R-GRID-10 Layer order inside a day column', () => {
  it('phase background, then hour lines, then events, then overlap stripes', () => {
    const a = fresh({
      ...blank({ events: [ev1({ id: 'a', title: 'A', color: '#3b6df0' }), ev1({ id: 'b', title: 'B', color: '#e5484d' })] }),
      rhythms: [{ id: 'r', name: 'R', visible: true }],
      phases: [{ id: 'p', title: 'Lunch', desc: '', color: '#2fa66a', rhythms: ['r'], slots: [{ day: 0, start: 540, end: 700 }] }],
    });
    const kids = [...a.q('.day[data-d="0"]').children].map(c => c.className.split(' ')[0]);
    const idx = n => kids.indexOf(n);
    expect(idx('phx')).toBeLessThan(idx('gl')); expect(idx('gl')).toBeLessThan(idx('ev')); expect(idx('ev')).toBeLessThan(idx('ov'));
    const z = sel => +[...a.d.styleSheets[0].cssRules].find(r => (r.selectorText || "").replace(/\s*,\s*/g, ',') === sel).style.getPropertyValue('z-index'); expect(z('.ov')).toBeLessThan(z('.ev .r1,.ev .r2'));
  });
});

describe('R-GRID-12 Live View: a read-only screen of today that follows the current time', () => {
  const at = (a, d, h, m) => freezeClock(a, 2026, 9, 12 + d, h, m);   // 12 October 2026 is a Monday
  const btn = a => a.q('#lvB'), now = a => a.q('#lvC'), pill = a => a.q('#lvPill');
  const start = a => btn(a).click();
  const fakeScroll = (a, height = 600) => a.ev(`(()=>{const w=document.getElementById('wrap');let t=0;Object.defineProperty(w,'scrollTop',{configurable:true,get:()=>t,set:v=>{t=Math.max(0,Math.round(v))}});Object.defineProperty(w,'clientHeight',{configurable:true,value:${height}});prefs.fitH=false})()`);   // a fixed 48 px/h, so the scroll positions are easy to check
  const scrollBy = (a, y) => a.ev(`(()=>{const w=document.getElementById('wrap');w.scrollTop=${y};w.dispatchEvent(new Event('scroll'))})()`);
  const kids = [{ id: 'O', name: 'Olivia', color: '#d6409f', visible: true }, { id: 'B', name: 'Bob', color: '#2fa66a', visible: true }];
  const day = () => blank({ people: kids, events: [
    ev1({ id: 'sc', title: 'School', desc: 'Room 4', slots: [{ day: 2, start: 540, end: 900, person: 'O' }] }),
    ev1({ id: 'sf', title: 'Screen-free time', bg: true, slots: [{ day: 2, start: 480, end: 720, person: 'O' }] }),
    ev1({ id: 'gy', title: 'Gym', slots: [{ day: 2, start: 660, end: 720, person: 'B' }] }),
    ev1({ id: 'lu', title: 'Lunch', slots: [{ day: 2, start: 750, end: 810, person: 'O' }, { day: 3, start: 750, end: 810, person: 'O' }] }),
  ] });
  const bubbles = a => a.qa('.lvl .lvb:not(.out)').map(b => [...b.querySelectorAll('.lvs .pt1')].map(t => t.textContent));   // open bubbles, sections in start order
  const boxOf = (a, title) => a.qa('.day .ev, .day .bgs').find(b => b._it.e.title === title);
  const tap = (a, target, x, min) => { const y = a.y(min); ['pointerdown', 'pointerup', 'click'].forEach(t => target.dispatchEvent(new a.w.MouseEvent(t, { clientX: x, clientY: y, bubbles: true, cancelable: true }))); };   // live: the one day column spans x 0..100
  it('the sidebar has a Live View button with a camera icon under the toolbar; the Now button is hidden', () => {
    const a = fresh(); expect(btn(a).textContent).toBe('Live View'); expect(btn(a).querySelector('svg')).not.toBeNull(); expect(btn(a).parentElement.previousElementSibling.classList.contains('tbar')).toBe(true);
    expect(now(a).style.display).toBe('none'); expect(pill(a).style.display).toBe('none');
  });
  it('it jumps to today\'s day view from the week or another day; the button becomes "Stop Live View"', () => {
    const a = fresh(); at(a, 2, 10, 0); a.ev('setFocus(5)'); start(a); expect(a.qa('.day').map(c => c.dataset.d)).toEqual(['2']);
    expect(btn(a).textContent).toBe('Stop Live View'); expect(btn(a).getAttribute('aria-pressed')).toBe('true'); expect(a.q('#grid').classList.contains('lv')).toBe(true);
  });
  it('the big "Live View Mode" pill with its red dot shows, and the "N hidden" pill never does', () => {
    const a = fresh(blank({ events: [ev1({ slots: [{ day: 2, start: 120, end: 180, person: '' }] })] })); at(a, 2, 10, 0); expect(a.q('#hid').style.display).toBe('');
    start(a); expect(pill(a).style.display).toBe(''); expect(pill(a).textContent).toBe('Live View Mode'); expect(pill(a).querySelector('i')).not.toBeNull(); expect(a.q('#hid').style.display).toBe('none');
  });
  it('the day header shows only the day name: no arrows, Week, agenda or focus buttons, and a click opens nothing', () => {
    const a = fresh(); at(a, 2, 10, 0); start(a); const h = a.q('.dh:not(.c):not(.lvh)');
    expect(h.textContent).toBe('Wednesday'); expect(h.querySelectorAll('button, .ic')).toHaveLength(0); h.click(); expect(a.q('#agDlg').open).toBeFalsy();
  });
  it('the text of the compact view is larger while live, and only then', () => {
    const a = fresh(); const r = sel => [...a.d.styleSheets[0].cssRules].find(x => x.selectorText === sel);
    expect(r('#grid.lv .ev').style.getPropertyValue('font-size')).toBe('calc(15px * var(--ts,1))'); expect(r('#grid.lv .times span').style.getPropertyValue('font-size')).toBe('calc(13px * var(--ts,1))');
  });
  it('nothing pops up by itself: a tap on a box fades in a bubble whose arrow points at the tap', () => {
    const a = fresh(day()); at(a, 2, 11, 30); start(a); expect(a.qa('.lvb')).toHaveLength(0);
    tap(a, boxOf(a, 'School'), 20, 690); expect(bubbles(a)).toEqual([['School']]); const b = a.q('.lvb');
    expect(b.classList.contains('in')).toBe(true); expect(+b.dataset.ax).toBe(20); expect(b.parentElement.classList.contains('lvl')).toBe(true); expect(b.parentElement.parentElement.classList.contains('day')).toBe(true);
    expect(b.textContent).toContain('Room 4'); expect(b.textContent).not.toMatch(/Schedules|Dragging/); expect(a.q('.lvl').getAttribute('aria-live')).toBe('polite');
  });
  it('a tap where boxes overlap opens one bubble with a section each; strips and nested boxes open their own', () => {
    const a = fresh(day()); at(a, 2, 12, 45); start(a); tap(a, boxOf(a, 'Lunch'), 20, 765); expect(bubbles(a)).toEqual([['School', 'Lunch']]);
    tap(a, boxOf(a, 'Screen-free time'), 95, 600); expect(bubbles(a)).toEqual([['School', 'Lunch'], ['Screen-free time']]);
    const b = fresh(blank({ people: kids, events: [ev1({ id: 'r', title: 'School run', slots: [{ day: 2, start: 630, end: 720, person: 'O' }] }), ev1({ id: 'm', title: 'Collect milk', nest: true, slots: [{ day: 2, start: 645, end: 690, person: 'O' }] })] }));
    at(b, 2, 11, 0); start(b); tap(b, boxOf(b, 'Collect milk'), 50, 660); expect(bubbles(b)).toEqual([['Collect milk']]); expect(b.q('.lvb').textContent).toContain('During: School run');
  });
  it('several bubbles can be open; a tap on a bubble closes it, a tap on empty space closes them all', () => {
    const a = fresh(day()); at(a, 2, 11, 30); start(a); tap(a, boxOf(a, 'School'), 20, 690); tap(a, boxOf(a, 'Gym'), 60, 690); expect(bubbles(a)).toEqual([['School'], ['Gym']]);
    tap(a, a.q('.lvb'), 20, 700); expect(bubbles(a)).toEqual([['Gym']]); expect(a.ev('lvOpen.length')).toBe(1);
    tap(a, boxOf(a, 'School'), 20, 690); tap(a, a.q('.day'), 20, 1200); expect(bubbles(a)).toEqual([]); expect(a.ev('lvOpen.length')).toBe(0);
  });
  it('each bubble fades away a minute after it opened', () => {
    const a = fresh(day()); at(a, 2, 11, 30); start(a); a.ev('window.__to=[];const st=setTimeout;setTimeout=(f,d)=>{__to.push([f,d]);return st(()=>{},0)}');
    tap(a, boxOf(a, 'School'), 20, 690); const [f, d] = a.ev('__to.find(x=>x[1]===60000)'); expect(d).toBe(60000); f(); expect(bubbles(a)).toEqual([]); expect(a.q('.lvb').classList.contains('out')).toBe(true);
  });
  it('open bubbles survive redraws (another person hidden) and all close when Live View ends', () => {
    const a = fresh(day()); at(a, 2, 11, 30); start(a); tap(a, boxOf(a, 'School'), 20, 690); a.ev('S.people[1].visible=false;render()');
    expect(bubbles(a)).toEqual([['School']]); expect(a.q('.lvb').classList.contains('in')).toBe(false); expect(a.ev('live')).toBe(true);
    btn(a).click(); expect(a.qa('.lvb')).toHaveLength(0); expect(a.ev('lvOpen.length')).toBe(0);
  });
  it('taps never edit while live: no dialog, no drag, no new event, no hover card, no resize handles', async () => {
    const a = fresh(day()); at(a, 2, 11, 30); start(a); const box = boxOf(a, 'School');
    tap(a, box, 20, 690); expect(a.q('#dlg').open).toBeFalsy();
    const ev = (t, x, m, tg = box) => tg.dispatchEvent(new a.w.MouseEvent(t, { clientX: x, clientY: a.y(m), bubbles: true, cancelable: true }));
    ev('pointerdown', 20, 690); ev('pointermove', 20, 780); ev('pointerup', 20, 780); expect(a.ev('S.events[0].slots[0].start')).toBe(540);
    tap(a, a.q('.day'), 20, 1200); expect(a.q('#dlg').open).toBeFalsy(); expect(a.qa('.rz').every(r => a.w.getComputedStyle(r).display === 'none')).toBe(true);
    expect([...a.d.styleSheets[0].cssRules].some(r => (r.selectorText || '').includes('#grid.lv .dh') && r.style.getPropertyValue('pointer-events') === 'none')).toBe(true);
  });
  it('bubble titles and descriptions are escaped, never markup', () => {
    const a = fresh(blank({ events: [ev1({ title: '<img src=x onerror=alert(1)>', desc: '<b>x</b>', slots: [{ day: 2, start: 540, end: 660, person: '' }] })] })); at(a, 2, 10, 0); start(a);
    tap(a, a.q('.day .ev'), 50, 600); expect(a.q('.lvl img')).toBeNull(); expect(a.q('.lvl b')).toBeNull(); expect(a.q('.lvl').textContent).toContain('<b>x</b>');
  });
  it('it keeps the now line a third of the way down the visible grid, or shows the top before the visible hours', () => {
    const a = fresh(); fakeScroll(a); at(a, 2, 10, 0); start(a); expect(a.ev('wrap.scrollTop')).toBe((600 - 300) / 60 * 48 - 600 / 3);
    at(a, 2, 13, 0); a.ev('liveTick()'); expect(a.ev('wrap.scrollTop')).toBe((780 - 300) / 60 * 48 - 600 / 3);
    at(a, 2, 4, 0); a.ev('liveTick()'); expect(a.ev('wrap.scrollTop')).toBe(0);
  });
  it('the now line is drawn while live even when "Show now line" is switched off', () => {
    const a = fresh(); at(a, 2, 10, 0); a.ev('nowOn=false;render()'); expect(a.qa('.now')).toHaveLength(0); start(a); expect(a.qa('.now')).toHaveLength(1);
  });
  it('scrolling by hand pauses it and shows the Now button, which scrolls back at once', () => {
    const a = fresh(); fakeScroll(a); at(a, 2, 10, 0); start(a); scrollBy(a, 900); expect(now(a).style.display).toBe(''); expect(now(a).textContent).toBe('Now');
    at(a, 2, 13, 0); a.ev('liveTick()'); expect(a.ev('wrap.scrollTop')).toBe(900);
    now(a).click(); expect(now(a).style.display).toBe('none'); expect(a.ev('wrap.scrollTop')).toBe((780 - 300) / 60 * 48 - 600 / 3);
  });
  it('a minute after the last manual scroll it goes back to now by itself; a scroll that live view made never pauses it', async () => {
    const a = fresh(); fakeScroll(a); at(a, 2, 10, 0); start(a); a.ev("document.getElementById('wrap').dispatchEvent(new Event('scroll'))"); expect(now(a).style.display).toBe('none');
    a.ev('window.__to=[];setTimeout=(f,d)=>{__to.push([f,d]);return __to.length}');   // capture the timer the scroll starts
    scrollBy(a, 900); scrollBy(a, 950); const [f, d] = a.ev('__to[__to.length-1]'); expect(d).toBe(60000); expect(now(a).style.display).toBe('');
    f(); expect(now(a).style.display).toBe('none'); expect(a.ev('wrap.scrollTop')).toBe(240 - 200);
  });
  it('it never scrolls while a dialog is open or a pointer is held down (a drag)', () => {
    const a = fresh(); fakeScroll(a); at(a, 2, 10, 0); start(a); const y = a.ev('wrap.scrollTop');
    a.ev('openSettings()'); at(a, 2, 13, 0); a.ev('liveTick()'); expect(a.ev('wrap.scrollTop')).toBe(y); a.ev("document.getElementById('xDlg').close()");
    a.ev("document.dispatchEvent(new Event('pointerdown'))"); a.ev('liveTick()'); expect(a.ev('wrap.scrollTop')).toBe(y);
    a.ev("document.dispatchEvent(new Event('pointerup'))"); a.ev('liveTick()'); expect(a.ev('wrap.scrollTop')).toBeGreaterThan(y);
  });
  it('at midnight it moves on to the next day, also onto a hidden weekend day', () => {
    const a = fresh(); at(a, 2, 23, 59); start(a); at(a, 3, 0, 0); a.ev('liveTick()'); expect(a.qa('.day').map(c => c.dataset.d)).toEqual(['3']);
    const b = fresh(); b.ev('prefs.hideWeekend=true;render()'); at(b, 4, 23, 59); start(b); at(b, 5, 0, 0); b.ev('liveTick()'); expect(b.qa('.day').map(c => c.dataset.d)).toEqual(['5']);
  });
  it('the Live View Mode pill, Stop Live View and Esc each leave it for the week; Esc under a dialog does not', () => {
    const a = fresh(); at(a, 2, 10, 0); start(a); pill(a).click(); expect(a.ev('live')).toBe(false); expect(a.qa('.day')).toHaveLength(7); expect(btn(a).textContent).toBe('Live View');
    start(a); btn(a).click(); expect(a.ev('live')).toBe(false); expect(a.qa('.day')).toHaveLength(7); expect(a.q('#grid').classList.contains('lv')).toBe(false);
    start(a); a.ev('openSettings()'); a.key('Escape'); expect(a.ev('live')).toBe(true); a.ev("document.getElementById('xDlg').close()"); a.key('Escape'); expect(a.ev('live')).toBe(false); expect(a.qa('.day')).toHaveLength(7);
  });
  it('this browser remembers it: a reload opens straight into today\'s Live View', () => {
    const a = fresh(); start(a); expect(JSON.parse(a.storage()[PREFS_KEY]).live).toBe(true);
    const b = openApp({ storage: { [PREFS_KEY]: JSON.stringify({ live: true }) } }); expect(b.ev('live')).toBe(true); expect(b.ev('focusD')).toBe(b.ev('(new Date().getDay()+6)%7')); expect(b.qa('.day')).toHaveLength(1); expect(b.q('#lvPill').style.display).toBe('');
    b.q('#lvB').click(); expect(JSON.parse(b.storage()[PREFS_KEY]).live).toBe(false);
    expect(openApp().ev('live')).toBe(false);
  });
  it('buttons, pill and tooltips are translated', () => {
    const a = fresh(); a.ev("setLang('es')"); expect(btn(a).textContent).toBe('Vista en directo'); expect(btn(a).title).toMatch(/^Para una pantalla/);
    start(a); expect(btn(a).textContent).toBe('Detener vista en directo'); expect(pill(a).textContent).toBe('Modo vista en directo'); expect(now(a).textContent).toBe('Ahora');
  });
});

describe('R-GRID-11 Focus on one day: only that day is shown, and the week comes back', () => {
  const two = () => blank({ events: [ev1({ id: 'a', title: 'Tue thing', slots: [{ day: 1, start: 600, end: 660, person: '' }] }), ev1({ id: 'b', title: 'Wed thing', slots: [{ day: 2, start: 600, end: 660, person: '' }] })] });
  const hdr = (a, d) => a.q(`.dh[data-d="${d}"]`);
  const focus = (a, d) => hdr(a, d).querySelector('.foc').click();
  const shown = a => a.qa('.day').map(c => +c.dataset.d);
  const btn = (a, cls) => a.q('.dh.fo .' + cls);
  it('every day header has a focus button whose tooltip names the day and explains how to get back', () => {
    const a = fresh(); expect(a.qa('.dh:not(.c) .foc')).toHaveLength(7); expect(headers(a)[1]).toBe('Tuesday');
    expect(hdr(a, 1).querySelector('.foc').title).toMatch(/^Show only Tuesday.*Week.*Esc/); expect(hdr(a, 1).querySelector('.foc').getAttribute('aria-label')).toMatch(/Show only Tuesday/);
  });
  it('clicking it shows only that day with its events, without opening the agenda', () => {
    const a = fresh(two()); focus(a, 1); expect(shown(a)).toEqual([1]); expect(a.qa('.ev').map(e => e.getAttribute('aria-label').split(',')[0])).toEqual(['Tue thing']);
    expect(a.q('#agDlg').open).toBeFalsy();
  });
  it('the focused header has previous / next buttons around the day name and a Week button; the name still opens the agenda', () => {
    const a = fresh(); focus(a, 1); const h = hdr(a, 1); expect([...h.querySelectorAll('.dhb')].map(b => b.className.split(' ')[1])).toEqual(['prv', 'nxt', 'wk']);
    expect(h.textContent).toBe('TuesdayWeek'); expect(btn(a, 'prv').title).toBe('Previous day'); expect(btn(a, 'wk').title).toBe('Show the whole week again (Esc)');
    h.onclick(); expect(a.q('#agDlg').open).toBe(true); expect(a.q('#agBody').textContent).toContain('Tuesday');
  });
  it('next and previous step through the days and wrap around the week (Sunday → Monday, Monday → Sunday)', () => {
    const a = fresh(); focus(a, 5); btn(a, 'nxt').click(); expect(shown(a)).toEqual([6]); btn(a, 'nxt').click(); expect(shown(a)).toEqual([0]);
    btn(a, 'prv').click(); expect(shown(a)).toEqual([6]); btn(a, 'prv').click(); btn(a, 'prv').click(); expect(shown(a)).toEqual([4]);
  });
  it('with the weekend hidden, stepping skips Saturday and Sunday (Friday → Monday)', () => {
    const a = fresh(); a.ev('prefs.hideWeekend=true;render()'); focus(a, 4); btn(a, 'nxt').click(); expect(shown(a)).toEqual([0]); btn(a, 'prv').click(); expect(shown(a)).toEqual([4]);
  });
  it('the Week button brings all days back', () => {
    const a = fresh(); focus(a, 3); btn(a, 'wk').click(); expect(shown(a)).toEqual([0, 1, 2, 3, 4, 5, 6]); expect(a.qa('.dh.fo')).toHaveLength(0);
  });
  it('Esc brings the week back; with an event selected it first clears the selection, and it does nothing while a dialog is open', () => {
    const a = fresh(two()); focus(a, 1); a.ev("selK={id:'a',i:0};render()"); a.key('Escape'); expect(a.ev('selK')).toBeNull(); expect(shown(a)).toEqual([1]);
    a.ev('openSettings()'); a.key('Escape'); expect(shown(a)).toEqual([1]); a.q('#xDlg').close();
    a.key('Escape'); expect(shown(a)).toHaveLength(7);
  });
  it('the focused day fills the window width even when "Fit width" is off', () => {
    const a = fresh(); a.ev('prefs.fitW=false;render()'); expect(a.q('#grid').style.gridTemplateColumns).not.toContain('1fr');
    focus(a, 2); expect(a.q('#grid').style.gridTemplateColumns).toMatch(/^52px repeat\(1,\s*minmax\(.*1fr\)\)$/);
  });
  it('focus is view state: not remembered in the settings, not undoable and not an unsaved change', () => {
    const a = fresh(); a.ev('savePrefs()'); focus(a, 2); a.ev('savePrefs()');
    expect(Object.keys(JSON.parse(a.storage()[PREFS_KEY]))).not.toContain('focusD'); expect(a.ev('undoSt.length')).toBe(0); expect(a.ev('isDirty()')).toBe(false);
  });
  it('a reload shows the whole week again', () => {
    const a = fresh(); focus(a, 2); const b = openApp({ storage: a.storage() }); expect(b.qa('.day')).toHaveLength(7);
  });
  it('the "N hidden" pill counts only the focused day\'s events in the hidden early hours', () => {
    const a = fresh(blank({ events: [ev1({ id: 'a', slots: [{ day: 1, start: 120, end: 180, person: '' }, { day: 2, start: 120, end: 180, person: '' }, { day: 2, start: 180, end: 240, person: '' }] })] }));
    expect(a.q('#hid').textContent).toBe('3 hidden'); focus(a, 2); expect(a.q('#hid').textContent).toBe('2 hidden'); btn(a, 'nxt').click(); btn(a, 'nxt').click(); expect(a.q('#hid').style.display).toBe('none');
  });
  it('an event running past midnight shows its continuation on the focused next day', () => {
    const a = fresh(blank({ events: [ev1({ id: 'n', title: 'Night', slots: [{ day: 0, start: 1320, end: 1740, person: '' }] })] })); a.ev('prefs.showEarly=true;render()'); focus(a, 1);
    expect(a.qa('.day .ev')).toHaveLength(1); expect(a.q('.day .ev').textContent).toContain('from Mon 22:00');
  });
  it('a new event dragged out on the focused day lands on that day', async () => {
    const a = fresh(); focus(a, 3); await createDrag(a, { col: 0, min: 600 }, { col: 0, min: 660 }); fillDialog(a, { title: 'Focused' }); a.q('#fOk').click();
    expect(a.ev('S.events[0].slots')).toEqual([{ day: 3, start: 600, end: 660, person: '', fo: true }]);   // performed by the owner (none yet)
  });
  it('the Print button prints the focused day view, and the whole week otherwise', () => {
    const a = fresh(two()); focus(a, 1); a.toolbar('print').click(); expect(a.w.__printed).toContain('<h1>Tuesday</h1>'); expect(a.w.__printed).toContain('Tue thing'); expect(a.w.__printed).not.toContain('Wed thing');
    btn(a, 'wk').click(); a.toolbar('print').click(); expect(a.w.__printed).toContain('Wed thing');
  });
  it('the printout leaves out the focus buttons', () => {
    expect(fresh().d.documentElement.outerHTML).toContain('#pr .dh .ic,#pr .dh .dhb{display:none}');
  });
  it('the now line appears only when the focused day is today', () => {
    const a = fresh(); freezeClock(a, 2026, 9, 14, 10, 30); focus(a, 2); a.ev('drawNow()'); expect(a.qa('.now')).toHaveLength(1);   // Wednesday
    btn(a, 'nxt').click(); a.ev('drawNow()'); expect(a.qa('.now')).toHaveLength(0);
  });
  it('the buttons and tooltips are translated into Spanish', () => {
    const a = fresh(); a.ev("setLang('es')"); expect(hdr(a, 1).querySelector('.foc').title).toMatch(/^Mostrar solo el Martes.*Semana.*Esc/);
    focus(a, 1); expect(btn(a, 'wk').textContent).toBe('Semana'); expect(btn(a, 'prv').title).toBe('Día anterior'); expect(btn(a, 'nxt').title).toBe('Día siguiente');
  });
});
