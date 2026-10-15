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

describe('R-GRID-07 Zoom changes the grid scale, never the text', () => {
  it('a taller row height makes events and hour labels proportionally taller / further apart', () => {
    const a = fresh(blank({ events: [ev1()] })); a.ev('prefs.rowH=96;render()');
    expect(a.ev('HH')).toBe(96); expect(parseFloat(a.q('.ev').style.height)).toBeCloseTo(95, 0); expect(a.qa('.times span')[1].style.top).toBe('96px');
  });
  it('by default ("Fill the window width" on) columns are at least the slider width and stretch to fill the free space', () => {
    const a = fresh(blank()); expect(a.ev('prefs.fillW')).toBe(true); a.ev('prefs.colW=200;render()'); expect(a.q('#grid').style.gridTemplateColumns).toBe('52px repeat(7,minmax(200px,1fr))');
  });
  it('with "Fill the window width" off the slider sets the exact width of the columns, so nothing is stretched', () => {
    const a = fresh(blank()); a.ev('prefs.fillW=false;prefs.colW=200;render()'); expect(a.q('#grid').style.gridTemplateColumns).toBe('52px repeat(7,200px)');
  });
  it('the "Fill the window width" checkbox applies at once, is remembered per browser and is disabled by "Fit to window"', () => {
    const a = fresh(blank()); const box = () => a.qa('#sbin .zck').find(l => l.textContent.includes('Fill the window width')).querySelector('input');
    expect(box().checked).toBe(true); box().checked = false; box().dispatchEvent(new a.w.Event('change'));
    expect(a.q('#grid').style.gridTemplateColumns).toBe('52px repeat(7,110px)'); expect(JSON.parse(a.w.localStorage.getItem(PREFS_KEY)).fillW).toBe(false);
    a.ev('prefs.fit=true;render()'); expect(box().disabled).toBe(true);
  });
  it('the zoom controls live in a collapsible Zoom section at the bottom of the sidebar, with labelled sliders', () => {
    const a = fresh(); const sec = a.qa('#sbin .sec').at(-1); expect(sec.querySelector('.shbtn span').textContent).toBe('Zoom');
    expect(sec.querySelector('.shbtn em')).toBeNull(); expect(sec.querySelector('.sech .eye')).toBeNull();
    expect([...sec.querySelectorAll('.zrow input')].map(i => i.getAttribute('aria-label'))).toEqual(['Row height', 'Column width']);
    expect([...sec.querySelectorAll('.zck')].map(l => l.textContent)).toEqual(['Fill the window width', 'Fit to window']);
    expect(sec.querySelector('.zck').title).toMatch(/stretch/); sec.querySelector('.shbtn').click();
    expect(a.qa('#sbin .zrow')).toHaveLength(0); expect(JSON.parse(a.w.localStorage.getItem(PREFS_KEY)).secZoom).toBe(true);
  });
  it('the Settings dialog has nothing about zoom any more', () => {
    const a = fresh(); a.ev('openSettings()'); expect(a.qa('#xDlg .zrow, #xDlg .zck, #xDlg input[type=range]')).toHaveLength(0);
    expect(a.qa('#xDlg .stabs button').map(b => b.textContent)).not.toContain('Zoom'); expect(a.dlgText()).not.toMatch(/Row height|Fit to window|Fill the window|Reset zoom/);
  });
  it('printing ignores the exact width and stretches the default 110 px columns over the page', () => {
    const a = fresh(blank()); a.ev('prefs.fillW=false;prefs.colW=200;printMode=true;render()'); expect(a.q('#grid').style.gridTemplateColumns).toBe('52px repeat(7,minmax(110px,1fr))'); a.ev('printMode=false;render()');
  });
  it('the sliders offer 24–120 px per hour and 70–600 px per column (enough to fill a very wide screen)', () => {
    const a = fresh(); const r = a.qa('#sbin .zrow input');
    expect([r[0].min, r[0].max]).toEqual(['24', '120']); expect([r[1].min, r[1].max]).toEqual(['70', '600']);
  });
  it('moving a slider applies at once and is remembered per browser', () => {
    const a = fresh(); const r = a.q('#sbin .zrow input'); r.value = 72; r.oninput();
    expect(a.ev('HH')).toBe(72); expect(JSON.parse(a.w.localStorage.getItem(PREFS_KEY)).rowH).toBe(72);
    expect(openApp({ storage: a.storage() }).ev('HH')).toBe(72);
  });
  it('"Fit to window" sizes the rows so the visible hours fill the window height', () => {
    const a = fresh(); Object.defineProperty(a.q('#wrap'), 'clientHeight', { get: () => 738 });
    a.ev('prefs.fit=true;render()'); expect(a.ev('HH')).toBe(Math.floor((738 - 38) / 19));
  });
  it('with "Fit to window" the columns share the width (small minimum) and the sliders are disabled', () => {
    const a = fresh(blank()); a.ev('prefs.fit=true;render()'); expect(a.q('#grid').style.gridTemplateColumns).toContain('minmax(40px');
    expect(a.qa('#sbin .zrow input').every(i => i.disabled)).toBe(true); expect(a.q('#sbin .zrow input').title).toContain('Fit to window');
  });
  it('"Reset zoom" restores 48 px per hour, 110 px columns, fill-the-width on and fit off', () => {
    const a = fresh(); a.ev('prefs.rowH=100;prefs.colW=200;prefs.fillW=false;prefs.fit=true;render()'); a.q('#sbin .zreset').click();
    expect([a.ev('prefs.rowH'), a.ev('prefs.colW'), a.ev('prefs.fillW'), a.ev('prefs.fit')]).toEqual([48, 110, true, false]);
  });
  it('out-of-range stored zoom values are corrected on start (too large → maximum, too small → minimum, unusable → default)', () => {
    const a = openApp({ storage: { [PREFS_KEY]: JSON.stringify({ rowH: 5000, colW: -1 }) } });
    expect(a.ev('prefs.rowH')).toBe(120); expect(a.ev('prefs.colW')).toBe(70);
    expect(openApp({ storage: { [PREFS_KEY]: JSON.stringify({ colW: 9999 }) } }).ev('prefs.colW')).toBe(600);
    const b = openApp({ storage: { [PREFS_KEY]: JSON.stringify({ rowH: 'x', colW: 0 }) } });
    expect(b.ev('prefs.rowH')).toBe(48); expect(b.ev('prefs.colW')).toBe(110);
  });
  it('a visible rhythm adds its 18 px label lane to every column', () => {
    const a = fresh(); expect(a.q('#grid').style.getPropertyValue('--lane')).toBe('18px'); expect(a.q('#grid').style.gridTemplateColumns).toBe('52px repeat(7,minmax(128px,1fr))');
  });
  it('the text size is not touched by zoom (no font size is set on the grid)', () => {
    const a = fresh(blank({ events: [ev1()] })); a.ev('prefs.rowH=120;render()');
    expect(a.q('.ev').style.fontSize).toBe(''); expect(a.q('#grid').style.fontSize).toBe('');
  });
  it('printing ignores zoom: the printed grid uses the default scale and the screen scale is restored afterwards', () => {
    const a = fresh(blank({ events: [ev1()] })); a.ev('prefs.rowH=96;render()'); a.ev('printSchedule()');
    expect(a.q('#pr .ev').style.height).toBe(`${48 - 1}px`); expect(a.ev('HH')).toBe(96); expect(a.q('#grid').style.getPropertyValue('--hh')).toBe('96px');
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
  it('the focused day fills the window width even when "Fill the window width" is off', () => {
    const a = fresh(); a.ev('prefs.fillW=false;render()'); expect(a.q('#grid').style.gridTemplateColumns).not.toContain('1fr');
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
    expect(a.ev('S.events[0].slots')).toEqual([{ day: 3, start: 600, end: 660, person: '' }]);
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
