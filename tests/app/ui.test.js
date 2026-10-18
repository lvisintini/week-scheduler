import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, ev1, person, pointer, dragFrom, PREFS_KEY } from '../helpers/app.js';

const fresh = (data, o = {}) => { const a = openApp(o); if (data) setData(a, data); return a; };
const sections = a => a.qa('#sbin .sec');
const before = (a, s1, s2) => !!(a.q(s1).compareDocumentPosition(a.q(s2)) & 4);   // true when s1 comes before s2 in the document

describe('R-UI-01 Everything lives in a collapsible, resizable sidebar', () => {
  it('there is no page header: all controls are in the sidebar', () => {
    const a = fresh(); expect(a.q('header')).toBeNull(); expect(a.q('#sb .sbtop')).not.toBeNull(); expect(a.q('#sb .tbar')).not.toBeNull();
  });
  it('the collapse button hides the sidebar and a second click brings it back; the choice is remembered', () => {
    const a = fresh(); const btn = a.q('.sbtop button[title="Collapse sidebar"]'); btn.click(); expect(a.q('#sb').classList.contains('collapsed')).toBe(true);
    expect(JSON.parse(a.w.localStorage.getItem(PREFS_KEY)).collapsed).toBe(true); expect(openApp({ storage: a.storage() }).q('#sb').classList.contains('collapsed')).toBe(true);
    a.q('.sbtop button[title="Expand sidebar"], .sbtop button:last-child').click(); expect(a.q('#sb').classList.contains('collapsed')).toBe(false);
  });
  const dragHandle = (a, dx) => { a.q('#rs').onpointerdown({ preventDefault() {}, clientX: 300 }); pointer(a, 'pointermove', { x: 300 + dx }); pointer(a, 'pointerup', { x: 300 + dx }); };
  it('dragging the divider changes the sidebar width', () => { const a = fresh(); dragHandle(a, 400); expect(a.ev('prefs.w')).toBe(400); });
  it('the sidebar can be no narrower than 230 px and no wider than 560 px', () => {
    const a = fresh(); dragHandle(a, -5000); expect(a.ev('prefs.w')).toBe(230); dragHandle(a, 5000); expect(a.ev('prefs.w')).toBe(560);
  });
  it('the width is saved when the drag ends', () => { const a = fresh(); dragHandle(a, 300); expect(JSON.parse(a.w.localStorage.getItem(PREFS_KEY)).w).toBe(300); });
});

describe('R-UI-02 Sidebar layout, top to bottom', () => {
  it('top row: favicon, title, help, settings and collapse (plus the rail\'s Live View button, shown only when collapsed)', () => {
    const top = fresh().q('.sbtop'); expect([...top.children].map(c => c.tagName.toLowerCase() + (c.className.includes('lvr') ? ':lvr' : c.title ? ':' + c.title : ''))).toEqual(['img', 'span', 'button:Help', 'button:Settings', 'button:Collapse sidebar', 'button:lvr']);
    expect(top.querySelector('.ttl').textContent).toBe('Weekly Schedules');
  });
  it('a bullet appears after the title while anything is unsaved', () => {
    const a = fresh(); a.ev('S.schedules[0].name="x";render()'); expect(a.q('.ttl').textContent).toBe('Weekly Schedules •');
  });
  it('then the workspace switcher, the Events | Phases switch, the seven toolbar buttons (each with a tooltip), and the sections', () => {
    const a = fresh(); expect(before(a, '.wsbtn', '.seg')).toBe(true); expect(before(a, '.seg', '.tbar')).toBe(true); expect(before(a, '.tbar', '#sbin .sec')).toBe(true);
    expect(a.qa('.tbar button')).toHaveLength(7); a.qa('.tbar button').forEach(b => expect(b.title.length).toBeGreaterThan(5));
  });
  it('the sections are Schedules, People, Activity types, Rhythms, Tools and Zoom in that order', () => {
    expect(sections(fresh()).map(s => s.querySelector('.shbtn span').textContent)).toEqual(['Schedules', 'People', 'Activity types', 'Rhythms', 'Tools', 'Zoom']);
  });
  it('the toolbar tooltips mention the keyboard shortcuts for undo and redo', () => {
    const a = fresh(); expect(a.toolbar('undo').title).toContain('Ctrl+Z'); expect(a.toolbar('redo').title).toContain('Ctrl+Y');
  });
  it('the Help button opens a "How to use" dialog with twenty tips, among them focusing on a day, nested activities, background events, live view and Away (R-EVT-24)', () => {
    const a = fresh(); a.q('.sbtop .help').click(); expect(a.dlgTitle()).toBe('How to use'); expect(a.qa('#xDlg li').length).toBe(20); expect(a.qa('#xDlg li')[19].textContent).toMatch(/Drawn as: Away/); expect(a.qa('#xDlg li')[15].textContent).toMatch(/focus icon/); expect(a.qa('#xDlg li')[16].textContent).toMatch(/Small tasks done along the way/); expect(a.qa('#xDlg li')[17].textContent).toMatch(/In the background/); expect(a.qa('#xDlg li')[18].textContent).toMatch(/Live View/);
  });
});

describe('R-UI-03 Settings dialog', () => {
  const tabs = a => a.qa('#xDlg .stabs button');
  const shown = a => a.qa('#xDlg .ssec').filter(p => !p.classList.contains('off'));
  it('has three tabs, View, Data and UI, and opens on View', () => {
    const a = fresh(); a.q('.sbtop .gear').click(); expect(tabs(a).map(b => b.textContent)).toEqual(['View', 'Data', 'UI']);
    expect(tabs(a).map(b => b.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']); expect(shown(a)).toHaveLength(1); expect(shown(a)[0].textContent).toContain('Show early hours');
  });
  it('the UI tab holds the theme and the language (both start from the browser), and View no longer has the theme', () => {
    const a = fresh(); a.q('.sbtop .gear').click(); tabs(a)[2].click(); expect(shown(a)[0].textContent).toContain('Theme'); expect(shown(a)[0].querySelector('select')).not.toBeNull();
    expect(shown(a)[0].querySelectorAll('.seg.theme button')).toHaveLength(3); expect(a.qa('#xDlg .ssec')[0].textContent).not.toContain('Theme');
  });
  it('clicking a tab shows only that section, and the last tab is shown again when Settings is reopened', () => {
    const a = fresh(); a.q('.sbtop .gear').click(); tabs(a)[1].click();
    expect(shown(a)).toHaveLength(1); expect(shown(a)[0].textContent).toContain('Clear memory'); expect(tabs(a)[1].classList.contains('on')).toBe(true);
    a.click('Close'); a.q('.sbtop .gear').click(); expect(tabs(a)[1].getAttribute('aria-selected')).toBe('true'); expect(shown(a)[0].textContent).toContain('Restart');
  });
  it('the dialog keeps one size: every tab stays in the layout (hidden tabs are invisible and inert, not removed), stacked in one grid cell', () => {
    const a = fresh(); a.q('.sbtop .gear').click(); const ps = a.qa('#xDlg .ssec'); expect(ps).toHaveLength(3); expect(ps.every(p => !p.hidden)).toBe(true);
    expect(ps.filter(p => p.hasAttribute('inert'))).toHaveLength(2); expect(a.q('#xDlg .spanes').contains(ps[0])).toBe(true);
    const css = [...a.d.styleSheets[0].cssRules].map(r => r.cssText).join('\n'); expect(css).toMatch(/\.spanes ?> ?\.ssec ?\{[^}]*grid-area: ?1 ?\/ ?1/); expect(css).toMatch(/\.spanes ?> ?\.ssec\.off ?\{[^}]*visibility: ?hidden/);
  });
  it('tabs look like tabs (underlined, not a boxed button group) and can be switched with the arrow keys', () => {
    const a = fresh(); a.q('.sbtop .gear').click(); expect(a.q('#xDlg .stabs').classList.contains('seg')).toBe(false);
    a.q('#xDlg .stabs').onkeydown({ key: 'ArrowRight' }); expect(tabs(a)[1].getAttribute('aria-selected')).toBe('true'); a.q('#xDlg .stabs').onkeydown({ key: 'ArrowLeft' }); a.q('#xDlg .stabs').onkeydown({ key: 'ArrowLeft' });
    expect(tabs(a)[2].getAttribute('aria-selected')).toBe('true');
  });
  it('switching the language from the UI tab keeps that tab open, now in the new language', () => {
    const a = fresh(); a.q('.sbtop .gear').click(); tabs(a)[2].click(); const sel = a.q('#xDlg select'); sel.value = 'es'; sel.onchange();
    expect(tabs(a).map(b => b.textContent)).toEqual(['Vista', 'Datos', 'Interfaz']); expect(tabs(a)[2].getAttribute('aria-selected')).toBe('true'); expect(sel.getAttribute('aria-label')).toBeTruthy();
  });
  it('the Data section has Restart and Clear memory, each with an explanation', () => {
    const a = fresh(); a.q('.sbtop .gear').click(); expect(a.dlgButtons()).toEqual(expect.arrayContaining(['Restart', 'Clear memory'])); expect(a.dlgText()).toContain('Discard all unsaved changes and reload what is in browser memory.');
  });
  it('the Language section offers English and Español and the current language is selected', () => {
    const a = fresh(); a.q('.sbtop .gear').click(); const sel = a.q('#xDlg select'); expect([...sel.options].map(o => o.textContent)).toEqual(['English', 'Español']); expect(sel.value).toBe('en');
  });
  it('the language is not remembered between visits (it follows the browser)', () => {
    const a = fresh(); a.q('.sbtop .gear').click(); const sel = a.q('#xDlg select'); sel.value = 'es'; sel.onchange(); expect(a.w.localStorage.getItem(PREFS_KEY) || '').not.toMatch(/"lang"|es/);
  });
  it('every control has an explanation underneath so its effect is clear', () => {
    const a = fresh(); a.q('.sbtop .gear').click(); expect(a.qa('#xDlg .sopt small').length).toBeGreaterThanOrEqual(5);
  });
  it('the Close button of the Settings dialog closes it', () => { const a = fresh(); a.q('.sbtop .gear').click(); a.click('Close'); expect(a.dlgOpen()).toBe(false); });
});

describe('R-UI-04 Colour picker', () => {
  const open = () => { const a = fresh(); sections(a)[0].querySelector('.sch .pick').click(); return a; };
  const pop = a => a.q('.cpop'), hex = a => pop(a).querySelector('input[type=text]'), sliders = a => [...pop(a).querySelectorAll('input[type=range]')];
  it('has colour swatches, hue / saturation / lightness sliders, a hex field and Cancel / Apply buttons', () => {
    const a = open(); expect(pop(a).querySelectorAll('.sw').length).toBeGreaterThanOrEqual(12); expect(sliders(a).map(s => [s.min, s.max])).toEqual([['0', '359'], ['0', '100'], ['8', '92']]); expect([...pop(a).querySelectorAll('button:not(.sw)')].map(b => b.textContent)).toEqual(['Cancel', 'Apply']);
  });
  it('starts with the current colour in the hex field', () => { expect(hex(open()).value).toBe('#3b6df0'); });
  it('clicking a swatch puts its colour in the hex field without applying it yet', () => {
    const a = open(); a.qa('.cpop .sw')[1].click(); expect(hex(a).value).toBe('#e5484d'); expect(a.ev('S.schedules[0].color')).toBe('#3b6df0');
  });
  it('moving a slider updates the hex field', () => {
    const a = open(); const before = hex(a).value; sliders(a)[0].value = 10; sliders(a)[0].oninput(); expect(hex(a).value).not.toBe(before);
  });
  it('typing a valid hex colour moves the sliders to match', () => {
    const a = open(); hex(a).value = '#ff0000'; hex(a).oninput(); expect(+sliders(a)[0].value).toBe(0); expect(+sliders(a)[1].value).toBe(100);
  });
  it('Apply uses the chosen colour and closes the picker', () => {
    const a = open(); hex(a).value = '#0a0b0c'; hex(a).oninput(); [...pop(a).querySelectorAll('button')].find(b => b.textContent === 'Apply').click(); expect(a.ev('S.schedules[0].color')).toBe('#0a0b0c'); expect(pop(a)).toBeNull();
  });
  it('an invalid hex value is never applied', () => {
    const a = open(); hex(a).value = 'url(x)'; hex(a).oninput(); [...pop(a).querySelectorAll('button')].find(b => b.textContent === 'Apply').click(); expect(a.ev('S.schedules[0].color')).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('the same picker is used for events, people and phases', () => {
    const a = fresh(blank({ people: [person()] })); sections(a)[1].querySelector('.sch .pick').click(); expect(pop(a)).not.toBeNull(); pop(a).querySelectorAll('button')[0].click();
    a.toolbar('add').click(); a.q('#fC').click(); expect(pop(a)).not.toBeNull();
  });
});

describe('R-UI-05 Undo and redo', () => {
  const change = (a, name) => { a.ev(`hist();S.schedules[0].name=${JSON.stringify(name)}`); a.ev('renderSide()'); };
  it('both buttons start disabled', () => { const a = fresh(); expect([a.toolbar('undo').disabled, a.toolbar('redo').disabled]).toEqual([true, true]); });
  it('a change enables Undo; undoing enables Redo; a new change after an undo clears Redo', () => {
    const a = fresh(); change(a, 'one'); expect(a.toolbar('undo').disabled).toBe(false); a.toolbar('undo').click(); expect(a.toolbar('redo').disabled).toBe(false); change(a, 'two'); expect(a.toolbar('redo').disabled).toBe(true);
  });
  it('Undo and Redo walk back and forth through the changes', () => {
    const a = fresh(); change(a, 'one'); change(a, 'two'); a.toolbar('undo').click(); expect(a.ev('S.schedules[0].name')).toBe('one'); a.toolbar('undo').click(); expect(a.ev('S.schedules[0].name')).toBe('Routine'); a.toolbar('redo').click(); expect(a.ev('S.schedules[0].name')).toBe('one');
  });
  it.each([['Ctrl+Z', { ctrlKey: true }, 'z'], ['Cmd+Z', { metaKey: true }, 'z']])('the keyboard shortcut %s undoes the last change', (_, mod, key) => {
    const a = fresh(); change(a, 'one'); a.key(key, mod); expect(a.ev('S.schedules[0].name')).toBe('Routine');
  });
  it.each([['Ctrl+Y', { ctrlKey: true }, 'y'], ['Ctrl+Shift+Z', { ctrlKey: true, shiftKey: true }, 'z']])('the keyboard shortcut %s redoes the undone change', (_, mod, key) => {
    const a = fresh(); change(a, 'one'); a.toolbar('undo').click(); a.key(key, mod); expect(a.ev('S.schedules[0].name')).toBe('one');
  });
  it('the shortcuts are ignored while typing in a field, so text editing keeps its own undo', () => {
    const a = fresh(); change(a, 'one'); const input = a.q('#sbin input[type=text]'); input.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })); expect(a.ev('S.schedules[0].name')).toBe('one');
  });
  it('the shortcuts are ignored while a dialog is open', () => {
    const a = fresh(); change(a, 'one'); a.toolbar('add').click(); a.key('z', { ctrlKey: true }); expect(a.ev('S.schedules[0].name')).toBe('one');
  });
  it('the undo history keeps the most recent 100 steps and drops older ones', () => {
    const a = fresh(); for (let i = 0; i < 120; i++) a.ev('hist()'); expect(a.ev('undoSt.length')).toBe(100);
  });
  it('undo and redo do nothing harmful when there is nothing to undo', () => {
    const a = fresh(); a.ev('undo();redo()'); expect(a.ev('S.schedules.length')).toBe(1);
  });
});

describe('R-UI-06 Toasts', () => {
  const delays = a => { const d = []; a.w.setTimeout = (f, ms) => { d.push(ms); return 1; }; return d; };
  it('a plain message disappears after 2.2 seconds', () => { const a = fresh(); const d = delays(a); a.ev('toast("Saved")'); expect(a.toast()).toBe('Saved'); expect(d).toContain(2200); });
  it('a message with action buttons stays for 7 seconds', () => { const a = fresh(); const d = delays(a); a.ev('toast("Applied",[{label:"Undo",fn(){}}])'); expect(d).toContain(7000); });
  it('action buttons run their action and dismiss the toast', () => {
    const a = fresh(); let ran = 0; a.w.__act = () => { ran++; }; a.ev('toast("Applied",[{label:"Do it",fn:()=>window.__act()}])'); [...a.q('#toast').querySelectorAll('button')].find(b => b.textContent === 'Do it').click(); expect(ran).toBe(1); expect(a.q('#toast').classList.contains('on')).toBe(false);
  });
  it('a new toast replaces the one that is showing', () => { const a = fresh(); a.ev('toast("first");toast("second")'); expect(a.toast()).toBe('second'); });
});

describe('R-UI-07 Event dialog layout: a label column and sections (Who, When, How it fits in, Schedules)', () => {
  const dialog = (o = {}) => { const a = fresh(blank({ events: [ev1(o)], people: [person(), person({ id: 'B', name: 'Bob', color: '#2fa66a' })] })); a.ev('openDlg(S.events[0])'); return a; };
  const shown = (a, n) => ![n, ...(n.closest('.ev-only,.ph-only,.fsec') ? [n.closest('.ev-only,.ph-only,.fsec')] : [])].some(x => a.w.getComputedStyle(x).display === 'none');
  it('title and colour swatch share the first cell, followed by description, type, Who, When, How it fits in and the schedules', () => {
    const a = dialog(); expect(a.q('#fT').closest('.fcell')).toBe(a.q('#fC').closest('.fcell'));
    [['#fT', '#fD'], ['#fD', '#fTy'], ['#fTy', '#fOw'], ['#fOw', '#fInv'], ['#fInv', '#fDays'], ['#fDays', '#fFit'], ['#fFit', '#fSch']].forEach(([x, y]) => expect(before(a, x, y), `${x} before ${y}`).toBe(true));
  });
  it('fields have visible labels tied to them, and the colour swatch has a name', () => {
    const a = dialog(); ['fT', 'fD', 'fTy', 'fOw'].forEach(id => expect(a.q(`#dlg label[for="${id}"]`), id).not.toBeNull()); expect(a.q('#fC').getAttribute('aria-label')).toBe('Colour');
    expect(a.q('#dlg label[for="fOw"]').textContent).toBe('Owner'); expect(a.q('#dlg label[for="fOw"]').title).toMatch(/Fair Play/); expect(a.q('#fInv').closest('.fg').querySelector('label:not([for])').textContent).toBe('With');
  });
  it('section headers read Who, When, How it fits in and Schedules for events', () => {
    const a = dialog(); expect(a.qa('#dlg .fsec span').filter(x => shown(a, x)).map(x => x.textContent)).toEqual(['Who', 'When', 'How it fits in', 'Schedules *']);
    expect([...a.qa('#dlg .fsec span.ev-only')].at(-1).title).toMatch(/^At least one\. Tick several/);
  });
  it('involved people and schedules are toggle chips that hold real checkboxes', () => {
    const a = dialog({ involved: ['B'] }); expect(a.q('#fInv').classList.contains('chips')).toBe(true); expect(a.q('#fSch').classList.contains('chips')).toBe(true);
    expect(a.qa('#fInv input[type=checkbox]').map(i => [i.value, i.checked])).toEqual([['p1', false], ['B', true]]);
    const css = a.d.querySelector('style').textContent; expect(css).toContain('.chips label:has(input:checked)'); expect(css).toContain('.chips label:has(input:focus-visible)');
  });
  it('"only on call" is shown only while someone is involved, and keeps its value meanwhile', () => {
    const a = dialog(); expect(a.q('#fOcRow').style.display).toBe('none');
    const cb = a.q('#fInv input'); cb.checked = true; cb.dispatchEvent(new a.w.Event('change', { bubbles: true })); expect(a.q('#fOcRow').style.display).toBe('');
    a.q('#fOnCall').checked = true; cb.checked = false; cb.dispatchEvent(new a.w.Event('change', { bubbles: true })); expect(a.q('#fOcRow').style.display).toBe('none'); expect(a.q('#fOnCall').checked).toBe(true);
  });
  it('nothing event-level pretends to set the days: no general times, no By list, no Timing switch', () => {
    const a = dialog(); ['#fS', '#fE', '#fP', '#fTim', '#fEdge', '.dall', '.fxt'].forEach(sel => expect(a.q(sel), sel).toBeNull());
    expect([...a.qa('#fFit input')].map(i => i.id)).toEqual(['fOnCall', 'fNest', 'fBox', 'fBg', 'fAw']);   // How it fits in: the event-wide switches together, Drawn as: Box / In the background / Away (R-EVT-24)
  });
  it('the day table has a header row: Days, Start, End, Performed by, With, Colour, Timing', () => {
    const a = dialog(); expect(a.qa('#paneQ .dhd span').map(x => x.textContent).filter(Boolean)).toEqual(['Days', 'Start', 'End', 'Performed by', 'With', 'Colour', 'Timing']);
    expect(a.q('#paneQ .dhd span').title).toMatch(/nearest ticked day.*\+ adds another time/);
  });
  it('a day row holds its day (with the week button of R-CYC-08), times, performer, With button, colour, timing, copy button and warning; flexible margins on a line below', () => {
    const r = dialog().qa('#fDays .dr')[0]; expect(r.children[0].querySelector('label input[type=checkbox]')).not.toBeNull(); expect(r.children[0].querySelector('.wkc')).not.toBeNull();
    expect([...r.children].map(c => c.classList.contains('dcell') ? 'day' : ['wbtn', 'cbtn', 'tsel', 'cpy', 'addt', 'wn', 'dsub'].find(k => c.classList.contains(k)) || c.tagName.toLowerCase()))
      .toEqual(['day', 'select', 'select', 'select', 'wbtn', 'cbtn', 'tsel', 'cpy', 'addt', 'wn', 'dsub']);
  });
  it('the day rows and the further-time lines share one grid, so their columns line up with the header', () => {
    const css = dialog().d.querySelector('style').textContent; expect(css).toContain('#paneQ{display:grid;grid-template-columns:var(--dc)'); expect(css).toContain('.dr,.dhd,#fDays{display:contents}');
    expect(css).toContain('.dhd>:first-child,.dr>:first-child{grid-column-start:1}');
  });
  it('every time and person select of the day rows and blocks has a spoken name, also in Spanish', () => {
    const a = dialog(), r = a.qa('#fDays .dr')[0];
    expect([...r.querySelectorAll('select')].map(x => x.getAttribute('aria-label'))).toEqual(['Monday: start', 'Monday: end', 'Monday: performed by', 'Monday: timing', 'Flexible start', 'Flexible end']);
    expect(r.querySelector('.wbtn').getAttribute('aria-label')).toMatch(/^Monday: with: Default/); expect(r.querySelector('.cpy').getAttribute('aria-label')).toMatch(/^Copy this day to all the other days/);
    r.querySelector('.addt').click(); const x = a.q('#fDays .dr.dx');
    expect([...x.querySelectorAll('select')].slice(0, 4).map(y => y.getAttribute('aria-label'))).toEqual(['Monday, time 2: start', 'Monday, time 2: end', 'Monday, time 2: performed by', 'Monday, time 2: timing']); expect(x.querySelector('.bx').getAttribute('aria-label')).toBe('Remove this time');
    a.ev("setLang('es')"); const wed = a.qa('#fDays .dr:not(.dx)')[2]; expect(wed.querySelector('select').getAttribute('aria-label')).toBe('Miércoles: inicio'); expect(wed.querySelectorAll('select')[2].getAttribute('aria-label')).toBe('Miércoles: lo hace');
    expect(a.q('#fDays .dr.dx select').getAttribute('aria-label')).toBe('Lunes, hora 2: inicio');
  });
  it('on narrow screens the label column folds away (labels above their fields) and each day folds onto two lines', () => {
    const css = dialog().d.querySelector('style').textContent; expect(css).toMatch(/@media \(max-width:560px\)\{\.fg\{grid-template-columns:minmax\(0,1fr\)/); expect(css).toMatch(/@media \(max-width:560px\)\{[^]*\.dhd,\.dr\{display:grid;[^}]*grid-template-areas:"d s e c x" "p p w w n" "t t t k \."/);
  });
  it('the buttons are Delete, Copy…, Cancel, Save in that order', () => { expect(dialog().qa('#dlg .btns button').map(b => b.textContent)).toEqual(['Delete', 'Copy…', 'Cancel', 'Save']); });
});

describe('R-UI-08 Light and dark theme', () => {
  const root = a => a.d.documentElement.getAttribute('data-theme');
  it('"System" (the default) sets nothing, so the device\'s own preference decides', () => { expect(root(fresh())).toBeNull(); });
  it('"Dark" and "Light" force the theme and are remembered', () => {
    const a = fresh(); a.q('.sbtop .gear').click(); a.click('Dark'); expect(root(a)).toBe('dark'); expect(JSON.parse(a.w.localStorage.getItem(PREFS_KEY)).theme).toBe('dark');
    a.click('Light'); expect(root(a)).toBe('light'); a.click('System'); expect(root(a)).toBeNull();
  });
  it('the chosen theme is applied again at the next visit', () => { const a = fresh(); a.ev('prefs.theme="dark";savePrefs()'); expect(root(openApp({ storage: a.storage() }))).toBe('dark'); });
  it('the dark palette exists both for the forced theme and for the system preference', () => {
    const css = fresh().d.querySelector('style').textContent; expect(css).toContain(':root[data-theme="dark"]'); expect(css).toContain('@media(prefers-color-scheme:dark)');
  });
  it('the current theme button is highlighted in the dialog', () => { const a = fresh(); a.ev('prefs.theme="dark"'); a.q('.sbtop .gear').click(); expect(a.qa('#xDlg .seg button').find(b => b.textContent === 'Dark').classList.contains('on')).toBe(true); });
});

describe('R-UI-09 Icons', () => {
  it('schedules use a calendar icon and people use a user icon, both in the item\'s colour', () => {
    const a = fresh(blank({ people: [person({ color: '#2fa66a' })] })); const s = sections(a)[0].querySelector('.sch .pick'), p = sections(a)[1].querySelector('.sch .pick');
    expect(s.querySelector('svg')).not.toBeNull(); expect(p.querySelector('svg')).not.toBeNull(); expect(s.querySelector('svg').innerHTML).not.toBe(p.querySelector('svg').innerHTML); expect(p.style.color).toMatch(/#2fa66a|rgb\(47, 166, 106\)/);
  });
  it('the page has a calendar favicon (an embedded image, no file) that is also used beside the title', () => {
    const a = fresh(); expect(a.q('link[rel=icon]').href).toMatch(/^data:image\/svg\+xml/); expect(a.q('.sbtop img.fav').src).toBe(a.q('link[rel=icon]').href);
  });
});

describe('R-UI-10 The event/phase dialog can be dragged aside to see the grid behind it', () => {
  // jsdom has no layout: give the dialog a rectangle that follows its left/top once it has been moved (centred at 132,100 on a 1024×768 window)
  const open = (data = blank({ events: [ev1()] })) => {
    const a = fresh(data), dl = a.q('#dlg');
    dl.getBoundingClientRect = () => { const l = dl.classList.contains('moved') ? parseFloat(dl.style.left) : 132, t = dl.classList.contains('moved') ? parseFloat(dl.style.top) : 100;
      return { left: l, top: t, width: 760, height: 500, right: l + 760, bottom: t + 500, x: l, y: t }; };
    a.ev('openDlg(S.events[0])'); return a;
  };
  const press = (a, target, x, y) => target.dispatchEvent(new a.w.MouseEvent('pointerdown', { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true }));
  const drag = (a, target, [x0, y0], [x1, y1]) => { press(a, target, x0, y0); pointer(a, 'pointermove', { x: x1, y: y1 }); pointer(a, 'pointerup', { x: x1, y: y1 }); };
  const pos = a => [a.q('#dlg').style.left, a.q('#dlg').style.top];
  it('the dialog has a grip bar at the top whose tooltip explains dragging, the arrow keys and the reset', () => {
    const a = open(), g = a.q('#dlg > .dgrip'); expect(g).not.toBeNull(); expect(g.type).toBe('button');
    expect(g.title).toMatch(/^Drag to move this window and see what is behind it/); expect(g.title).toContain('arrow keys'); expect(a.q('#dlg').firstElementChild).toBe(g);
  });
  it('dragging the grip bar moves the dialog by the distance dragged', () => {
    const a = open(); drag(a, a.q('#dGrip'), [500, 108], [800, 208]); expect(pos(a)).toEqual(['432px', '200px']);
  });
  it('dragging an empty part of the dialog moves it too, but pressing a field, a button or the day table does not', () => {
    const a = open(); drag(a, a.q('#dlg'), [140, 300], [40, 350]); expect(pos(a)).toEqual(['32px', '150px']);
    for (const sel of ['#fT', '#fD', '#fTy', '#dlg .btns button', '#paneQ']) { drag(a, a.q(sel), [300, 300], [600, 500]); expect(pos(a), sel).toEqual(['32px', '150px']); }
  });
  it('the dialog stays reachable: at least 120 px of it and its grip bar remain inside the window', () => {
    const a = open(); drag(a, a.q('#dGrip'), [500, 108], [-3000, -3000]); expect(pos(a)).toEqual([`${120 - 760}px`, '0px']);
    drag(a, a.q('#dGrip'), [-300, 5], [9000, 9000]); expect(pos(a)).toEqual([`${1024 - 120}px`, `${768 - 40}px`]);
  });
  it('the arrow keys on the focused grip move the dialog 20 px per press', () => {
    const a = open(), g = a.q('#dGrip'), k = key => g.onkeydown({ key, preventDefault() {} });
    k('ArrowRight'); k('ArrowRight'); k('ArrowDown'); expect(pos(a)).toEqual(['172px', '120px']); k('ArrowLeft'); k('ArrowUp'); expect(pos(a)).toEqual(['152px', '100px']);
  });
  it('every time the dialog opens (event or phase) it is back in the middle of the window', () => {
    const a = open(blank({ events: [ev1()], rhythms: [{ id: 'r', name: 'R', visible: true }], phases: [{ id: 'ph', title: 'P', desc: '', color: '#3b6df0', rhythms: ['r'], slots: [{ day: 0, start: 600, end: 660 }] }] }));
    drag(a, a.q('#dGrip'), [500, 108], [800, 208]); a.q('#dlg').close(); a.ev('openDlg(S.phases[0])');
    expect(a.q('#dlg').classList.contains('moved')).toBe(false); expect(pos(a)).toEqual(['', '']);
  });
});

describe('R-UI-11 Tools: Live View, highlighting untyped events and colouring the week by type or by person', () => {
  it('the Zoom and Tools switches are real checkboxes announced as switches and drawn as sliding toggles', () => {
    const a = fresh(); const sw = a.qa('#sbin .zck input'); expect(sw.length).toBe(6);
    expect(sw.every(c => c.type === 'checkbox' && c.getAttribute('role') === 'switch')).toBe(true);
    const css = a.q('style').textContent; expect(css).toContain('.zck input{appearance:none;'); expect(css).toContain('.zck input:checked::before{transform:translateX(12px)}');
    expect(css).toContain('.zck input:focus-visible{outline:'); expect(css).toContain('@media(prefers-reduced-motion:reduce){.zck input,.zck input::before{transition:none}}');
  });
  const ppl = [person({ id: 'A', name: 'Ann', color: '#e5484d' }), person({ id: 'B', name: 'Bob', color: '#2fa66a' })];
  const tys = [{ id: 'tw', name: 'Work', color: '#aa5500', icon: 'work' }];
  const week = () => blank({ people: ppl, types: tys, events: [
    ev1({ id: 'w', title: 'Job', color: '#3b6df0', type: 'tw', slots: [{ day: 0, start: 600, end: 660, person: 'A', col: '#123456' }] }),
    ev1({ id: 'u', title: 'Loose', color: '#8e4ec6', slots: [{ day: 1, start: 600, end: 660, person: 'B' }, { day: 2, start: 600, end: 660, person: '' }] }),
    ev1({ id: 's', title: 'Screens', color: '#607d8b', bg: true, slots: [{ day: 3, start: 600, end: 660, person: 'A' }] })] });
  const tools = a => sections(a).find(s => s.querySelector('.shbtn span').textContent === 'Tools');
  const box = (a, label) => [...tools(a).querySelectorAll('label.zck')].find(l => l.textContent === label).querySelector('input');
  const tick = (a, label, v = true) => { const c = box(a, label); c.checked = v; c.onchange(); };
  const col = (a, d) => a.q(`.day[data-d="${d}"] .ev, .day[data-d="${d}"] .bgs`).style.getPropertyValue('--c');
  it('the section holds the Live View row and four switches, each with an explanatory tooltip, all off at first', () => {
    const a = fresh(week()), t = tools(a); expect(t.querySelector('.lvrow #lvB')).not.toBeNull(); expect(a.q('.sbbody > .lvrow')).toBeNull();
    expect([...t.querySelectorAll('label.zck')].map(l => [l.textContent, l.querySelector('input').checked])).toEqual([['Highlight events without an activity type', false], ['Colour by activity type', false], ['Colour by person', false], ['Fixed lanes, one per person', false]]);
    expect([...t.querySelectorAll('label.zck')].every(l => l.title.length > 40)).toBe(true); expect(t.querySelector('.tip').title).toContain('Live View');
  });
  it('Live View still starts and stops from its new place', () => {
    const a = fresh(week()); a.q('#lvB').click(); expect(a.ev('live')).toBe(true); expect(a.q('#lvB').textContent).toBe('Stop Live View'); a.q('#lvB').click(); expect(a.ev('live')).toBe(false);
  });
  it('highlighting marks only the boxes and strips of events without an activity type', () => {
    const a = fresh(week()); expect(a.qa('.noty')).toHaveLength(0); tick(a, 'Highlight events without an activity type');
    expect(a.qa('.noty').map(x => x._it.e.title)).toEqual(['Loose', 'Loose', 'Screens']); tick(a, 'Highlight events without an activity type', false); expect(a.qa('.noty')).toHaveLength(0);
  });
  it('colour by activity type draws every occurrence in its type colour, untyped ones in the statistics grey', () => {
    const a = fresh(week()); tick(a, 'Colour by activity type'); expect([0, 1, 2, 3].map(d => col(a, d))).toEqual(['#aa5500', '#9aa0a6', '#9aa0a6', '#9aa0a6']);
  });
  it('colour by person draws every occurrence in its performer\'s colour, nobody performing in grey', () => {
    const a = fresh(week()); tick(a, 'Colour by person'); expect([0, 1, 2, 3].map(d => col(a, d))).toEqual(['#e5484d', '#2fa66a', '#9aa0a6', '#e5484d']);
  });
  it('the two colour switches exclude each other, and unticking brings back the stored colours unchanged', () => {
    const a = fresh(week()); tick(a, 'Colour by activity type'); tick(a, 'Colour by person');
    expect(box(a, 'Colour by activity type').checked).toBe(false); expect(a.ev('prefs.colBy')).toBe('p');
    tick(a, 'Colour by person', false); expect([0, 1].map(d => col(a, d))).toEqual(['#123456', '#8e4ec6']); expect(a.ev('S.events[0].slots[0].col')).toBe('#123456');
  });
  it('the event dialog still shows each time\'s stored colour while the week is coloured by type, and nothing becomes unsaved', () => {
    const a = fresh(week()); a.ev('saveMem("all")'); tick(a, 'Colour by activity type'); expect(a.ev('isDirty()')).toBe(false); a.ev('openDlg(S.events[0])');
    expect(a.qa('#fDays .dr')[0].querySelector('.cbtn').getAttribute('aria-label')).toBe('Monday: colour: Own colour (#123456)');
  });
  it('every switch and the folded section are remembered by this browser', () => {
    const a = fresh(week()); tick(a, 'Highlight events without an activity type'); tick(a, 'Colour by person');
    const b = openApp({ storage: a.storage() }); expect(b.ev('[prefs.hlNoType,prefs.colBy]')).toEqual([true, 'p']);
    tools(b).querySelector('.shbtn').click(); expect(b.ev('prefs.secTools')).toBe(true); expect(b.q('#lvB')).toBeNull(); expect(openApp({ storage: b.storage() }).ev('prefs.secTools')).toBe(true);
    expect(openApp({ storage: { [PREFS_KEY]: JSON.stringify({ colBy: 'x', hlNoType: 'yes' }) } }).ev('[prefs.colBy,prefs.hlNoType]')).toEqual(['', false]);
  });
  it('printing keeps the colouring on screen but never the highlight', () => {
    const a = fresh(week()); tick(a, 'Highlight events without an activity type'); a.ev('printSchedule()');
    expect(a.w.__printed).toContain('noty'); expect(a.ev("[...document.styleSheets[0].cssRules].some(r=>r.selectorText==='#pr .noty'&&r.style.outlineStyle!=='solid')")).toBe(true);
  });
  it('the section and its switches are translated', () => {
    const a = fresh(week(), { languages: ['es'] });
    const t = sections(a).find(s => s.querySelector('.shbtn span').textContent === 'Herramientas'); expect([...t.querySelectorAll('label.zck')].map(l => l.textContent)).toEqual(['Resaltar los eventos sin tipo de actividad', 'Colorear por tipo de actividad', 'Colorear por persona', 'Carriles fijos, uno por persona']);
  });
});

describe('R-UI-12 Opening a repeating event from the grid jumps to the clicked repetition in the day table', () => {
  // Monday has two times (10:00 and 14:00), Wednesday one; the 14:00 line is a further-time line under Monday
  const rep = (o = {}) => blank({ events: [ev1({ id: 'r', title: 'Swim', slots: [{ day: 0, start: 600, end: 660, person: '' }, { day: 0, start: 840, end: 900, person: '' }, { day: 2, start: 600, end: 660, person: '' }], ...o })] });
  const pulsed = a => a.qa('#fDays .dr.pulse').map(r => [...a.qa('#fDays .dr')].indexOf(r));
  const boxAt = (a, d, min) => a.qa(`.day[data-d="${d}"] .ev`).find(b => b._it.s.start === min);
  const click = (a, d, min) => dragFrom(a, boxAt(a, d, min), { col: d, min: min + 15 }, { col: d, min: min + 15 }, { move: false });
  it('clicking a repetition on the grid opens the dialog with that day\'s line pulsing', async () => {
    const a = fresh(rep()); await click(a, 2, 600); expect(a.q('#dlg').open).toBe(true); expect(pulsed(a)).toEqual([3]);   // lines: Mon, Mon 14:00, Tue, Wed…
  });
  it('a further time on the same day is found too: its own line pulses, not the day\'s first line', async () => {
    const a = fresh(rep()); await click(a, 0, 840); expect(pulsed(a)).toEqual([1]); expect(a.qa('#fDays .dr')[1].classList.contains('dx')).toBe(true);
  });
  it('the pulse is removed again after a moment, so it can play the next time', async () => {
    const a = fresh(rep()); await click(a, 2, 600); await new Promise(r => setTimeout(r, 1700)); expect(pulsed(a)).toEqual([]);
  });
  it('an event with a single repetition, the + button and the chooser\'s own pick behave as before (no pulse) or pulse the picked one', async () => {
    const a = fresh(blank({ events: [ev1()] })); await dragFrom(a, a.q('.ev'), { col: 0, min: 620 }, { col: 0, min: 620 }, { move: false }); expect(pulsed(a)).toEqual([]);
    a.q('#dlg').close(); a.toolbar('add').click(); expect(pulsed(a)).toEqual([]);
    const b = fresh(blank({ events: [ev1({ id: 'x', title: 'Other', slots: [{ day: 2, start: 600, end: 660, person: '' }] }), ...rep().events] }));
    b.ev('overlapMenu(10,10,itemsAt(2,630,0.5))'); b.qa('.omenu .oi').find(x => x.textContent.startsWith('Swim')).click(); expect(pulsed(b)).toEqual([3]);
  });
});

describe('R-UI-13 On a phone the sidebar is a drawer over the grid', () => {
  const saved = prefs => ({ [PREFS_KEY]: JSON.stringify(prefs) });
  it('a phone-sized window starts with the sidebar closed even when it was left open', () => {
    const a = openApp({ phone: true, storage: saved({ collapsed: false }) }); expect(a.q('#sb').classList.contains('collapsed')).toBe(true);
    const d = openApp({ storage: saved({ collapsed: false }) }); expect(d.q('#sb').classList.contains('collapsed')).toBe(false);   // a desktop window keeps what was saved
  });
  it('opened on a phone, a tap on the dimmed backdrop closes it again', () => {
    const a = openApp({ phone: true }); a.q('.sbtop .xpand').click(); expect(a.q('#sb').classList.contains('collapsed')).toBe(false);
    a.q('#sbBack').click(); expect(a.q('#sb').classList.contains('collapsed')).toBe(true); expect(a.q('.sbtop .xpand').title).toBe('Expand sidebar');
  });
  it('a phone opens on today\'s day view; a desktop window opens on the week; a remembered Live View still wins', () => {
    const a = openApp({ phone: true }); expect(a.ev('focusD')).toBe(a.ev('today()')); expect(a.qa('.day')).toHaveLength(1); expect(a.q('.dh.fo')).not.toBeNull();
    expect(openApp().ev('focusD')).toBeNull();
    const l = openApp({ phone: true, storage: saved({ live: true }) }); expect(l.ev('live')).toBe(true); expect(l.ev('focusD')).toBe(l.ev('today()'));
  });
  it('the phone stylesheet lays the open sidebar over the grid, above a backdrop, and hides the resize edge', () => {
    const css = openApp().q('style').textContent;
    expect(css).toContain('@media (max-width:600px){aside:not(.collapsed){position:fixed;'); expect(css).toContain('aside:not(.collapsed)~#sbBack{display:block;position:fixed;inset:0;'); expect(css).toContain('aside .rs{display:none}');
  });
});
