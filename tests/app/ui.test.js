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
  it('dragging the divider changes the sidebar width', () => { const a = fresh(); dragHandle(a, 400); expect(a.ev('state.prefs.w')).toBe(400); });
  it('the sidebar can be no narrower than 230 px and no wider than 560 px', () => {
    const a = fresh(); dragHandle(a, -5000); expect(a.ev('state.prefs.w')).toBe(230); dragHandle(a, 5000); expect(a.ev('state.prefs.w')).toBe(560);
  });
  it('the width is saved when the drag ends', () => { const a = fresh(); dragHandle(a, 300); expect(JSON.parse(a.w.localStorage.getItem(PREFS_KEY)).w).toBe(300); });
});

describe('R-UI-02 Sidebar layout, top to bottom', () => {
  it('top row: favicon, title, help, settings and collapse (plus Live View and its Now, which float on a closed phone sidebar only)', () => {
    const top = fresh().q('.sbtop'); expect([...top.children].map(c => c.tagName.toLowerCase() + (c.className.includes('lvr') ? ':lvr' : c.className.includes('lvnow') ? ':lvnow' : c.title ? ':' + c.title : ''))).toEqual(['img', 'span', 'button:Help', 'button:Settings', 'button:Collapse sidebar', 'button:lvr', 'button:lvnow']);
    expect(top.querySelector('.ttl').textContent).toBe('Weekly Schedules');
  });
  it('a bullet appears after the title while anything is unsaved', () => {
    const a = fresh(); a.ev('state.S.schedules[0].name="x";render()'); expect(a.q('.ttl').textContent).toBe('Weekly Schedules •');
  });
  it('then the workspace switcher, the Events | Phases switch, the seven toolbar buttons (each with a tooltip), and the sections', () => {
    const a = fresh(); expect(before(a, '.wsbtn', '.seg')).toBe(true); expect(before(a, '.seg', '.tbar')).toBe(true); expect(before(a, '.tbar', '#sbin .sec')).toBe(true);
    expect(a.qa('.tbar button')).toHaveLength(7); a.qa('.tbar button').forEach(b => expect(b.title.length).toBeGreaterThan(5));
  });
  it('the sections are Schedules, People, Activity types, Rhythms, Tools and View in that order', () => {
    expect(sections(fresh()).map(s => s.querySelector('.shbtn span').textContent)).toEqual(['Schedules', 'People', 'Activity types', 'Rhythms', 'Tools', 'View']);
  });
  it('the toolbar tooltips mention the keyboard shortcuts for undo and redo', () => {
    const a = fresh(); expect(a.toolbar('undo').title).toContain('Ctrl+Z'); expect(a.toolbar('redo').title).toContain('Ctrl+Y');
  });
  it('the Help button opens a "How to use" dialog with twenty-three tips, among them focusing on a day, nested activities, background events, live view, Away (R-EVT-24), the passphrase (R-DATA-11) and staged weeks (R-CYC-21)', () => {
    const a = fresh(); a.q('.sbtop .help').click(); expect(a.dlgTitle()).toBe('How to use'); expect(a.qa('#xDlg li').length).toBe(23); expect(a.qa('#xDlg li')[22].textContent).toMatch(/^Staged weeks: in Weeks in the cycle…/); expect(a.qa('#xDlg li')[21].textContent).toMatch(/Save… → Calendar file \(export only\)/); expect(a.qa('#xDlg li')[20].textContent).toMatch(/Passphrase… protects what this browser saves/); expect(a.qa('#xDlg li')[19].textContent).toMatch(/Drawn as: Away/); expect(a.qa('#xDlg li')[15].textContent).toMatch(/focus icon/); expect(a.qa('#xDlg li')[16].textContent).toMatch(/Small tasks done along the way/); expect(a.qa('#xDlg li')[17].textContent).toMatch(/In the background/); expect(a.qa('#xDlg li')[18].textContent).toMatch(/Live View/);
  });
});

describe('R-UI-03 Settings dialog', () => {
  const tabs = a => a.qa('#xDlg .stabs button');
  const shown = a => a.qa('#xDlg .ssec').filter(p => !p.classList.contains('off'));
  it('has three tabs, UI, Data and About, and opens on UI', () => {
    const a = fresh(); a.q('.sbtop .gear').click(); expect(tabs(a).map(b => b.textContent)).toEqual(['UI', 'Data', 'About']);
    expect(tabs(a).map(b => b.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']); expect(shown(a)).toHaveLength(1); expect(shown(a)[0].textContent).toContain('Use AM/PM clock');
  });
  it('Settings no longer holds the now line or the days shown: they are in Tools and View', () => {
    const a = fresh(); a.q('.sbtop .gear').click(); expect(a.dlgText()).not.toMatch(/"now" line|Saturday/); expect(a.q('.tsec').textContent).toContain('Show the "now" line'); expect(a.q('.zsec').textContent).toContain('Days shown');
  });
  it('the UI tab holds the AM/PM clock, then the theme and the language (all three about how the app reads)', () => {
    const a = fresh(); a.q('.sbtop .gear').click(); const ui = shown(a)[0]; expect(ui.textContent).toContain('Theme'); expect(ui.querySelector('select')).not.toBeNull();
    expect(ui.querySelectorAll('.seg.theme button')).toHaveLength(3); expect([...ui.querySelectorAll('.sopt b')].map(b => b.textContent)).toEqual(['Use AM/PM clock', 'Theme', 'Language']);
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
    const a = fresh(); a.q('.sbtop .gear').click(); tabs(a)[1].click(); tabs(a)[0].click(); const sel = a.q('#xDlg select'); sel.value = 'es'; sel.onchange();
    expect(tabs(a).map(b => b.textContent)).toEqual(['Interfaz', 'Datos', 'Acerca de']); expect(tabs(a)[0].getAttribute('aria-selected')).toBe('true'); expect(sel.getAttribute('aria-label')).toBeTruthy();
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

describe('R-UI-15 Settings → About: disclaimer, credits, licence and the link to the source code', () => {
  const about = a => { a.q('.sbtop .gear').click(); const t = a.qa('#xDlg .stabs button'); t[t.length - 1].click(); return a.qa('#xDlg .ssec').find(p => !p.classList.contains('off')); };
  it('the About tab is the last tab and says the app has no warranty, that the data stays on this device and that backups are the user\'s', () => {
    const a = fresh(); const p = about(a); expect(a.q('#xDlg .stabs button.on').textContent).toBe('About');
    expect(p.textContent).toContain('No warranty'); expect(p.textContent).toContain('without any warranty'); expect(p.textContent).toContain('Nothing is sent anywhere');
    expect(p.textContent).toContain('erases browser memory, so keep a JSON file as a backup'); expect(p.textContent).not.toContain('Backups are yours'); expect(p.textContent).toContain('personal details you enter about others');
  });
  it('credits Luis Visintini and Claude, and names the MIT licence and the current data format', () => {
    const a = fresh(); const p = about(a); expect(p.textContent).toContain('Made by Luis Visintini, written together with Claude, Anthropic\'s AI assistant.');
    expect(p.textContent).toContain('MIT licence'); expect(p.textContent).toContain('Data format ' + a.ev('FMT') + '.');
  });
  it('has exactly one link, to the GitHub repository, opening in a new tab without opener or referrer', () => {
    const a = fresh(); const p = about(a); const ls = p.querySelectorAll('a'); expect(ls).toHaveLength(1); expect(a.qa('#xDlg a')).toHaveLength(1);
    expect(ls[0].getAttribute('href')).toBe('https://github.com/lvisintini/week-scheduler'); expect(ls[0].target).toBe('_blank');
    expect(ls[0].rel.split(' ').sort()).toEqual(['noopener', 'noreferrer']); expect(ls[0].title).toContain('Nothing from this app is sent');
  });
  it('is translated into Spanish, including the link\'s tooltip, which keeps its translation after the language changes', () => {
    const a = fresh(null, { languages: ['es-ES'] }); const p = about(a); expect(a.q('#xDlg .stabs button.on').textContent).toBe('Acerca de');
    expect(p.textContent).toContain('Sin garantía'); expect(p.textContent).toContain('Hecho por Luis Visintini, escrito junto con Claude'); expect(p.textContent).toContain('licencia MIT');
    const lk = p.querySelector('a'); expect(lk.title).toBe('Abre el código fuente en GitHub en una pestaña nueva. No se envía nada de esta aplicación.'); expect(lk.__t).toBe(lk.title);
    a.ev('applyStatic()'); expect(lk.title).toBe('Abre el código fuente en GitHub en una pestaña nueva. No se envía nada de esta aplicación.');
  });
});

describe('R-UI-16 The Save and Load dialogs list their choices one per line', () => {
  it('Save… stacks its buttons in a column, from browser memory to Cancel', () => {
    const a = fresh(); a.toolbar('save').click(); expect(a.q('#xDlg .btns').classList.contains('stack')).toBe(true);
    expect(a.dlgButtons()).toEqual(['Browser memory', 'JSON file', 'Shareable link', 'Calendar file (export only)', 'Cancel']);
    const css = [...a.d.styleSheets[0].cssRules].map(r => r.cssText).join('\n'); expect(css).toMatch(/\.btns\.stack ?\{[^}]*flex-direction: ?column/);
  });
  it('Load… stacks its buttons in a column too, while other dialogs keep a row of buttons', () => {
    const a = fresh(); a.toolbar('load').click(); expect(a.q('#xDlg .btns').classList.contains('stack')).toBe(true); expect(a.dlgButtons()).toEqual(['Browser memory', 'JSON file', 'Cancel']);
    a.click('Cancel'); a.q('.sbtop .gear').click(); expect(a.q('#xDlg .btns').classList.contains('stack')).toBe(false);
  });
});

describe('R-UI-04 Colour picker', () => {
  const open = () => { const a = fresh(); sections(a)[0].querySelector('.sch .pick').click(); return a; };
  const pop = a => a.q('.cpop'), hex = a => pop(a).querySelector('input[type=text]'), sliders = a => [...pop(a).querySelectorAll('input[type=range]')];
  it('has colour swatches, hue / saturation / lightness sliders, a hex field and Cancel / Apply buttons', () => {
    const a = open(); expect(pop(a).querySelectorAll('.sw').length).toBeGreaterThanOrEqual(12); expect(sliders(a).map(s => [s.min, s.max])).toEqual([['0', '359'], ['0', '100'], ['8', '92']]); expect([...pop(a).querySelectorAll('button:not(.sw)')].map(b => b.textContent)).toEqual(['Cancel', 'Apply']);
  });
  it('starts with the current colour in the hex field', () => { expect(hex(open()).value).toBe('#3b6df0'); });
  it('clicking a swatch puts its colour in the hex field without applying it yet', () => {
    const a = open(); a.qa('.cpop .sw')[1].click(); expect(hex(a).value).toBe('#e5484d'); expect(a.ev('state.S.schedules[0].color')).toBe('#3b6df0');
  });
  it('moving a slider updates the hex field', () => {
    const a = open(); const before = hex(a).value; sliders(a)[0].value = 10; sliders(a)[0].oninput(); expect(hex(a).value).not.toBe(before);
  });
  it('typing a valid hex colour moves the sliders to match', () => {
    const a = open(); hex(a).value = '#ff0000'; hex(a).oninput(); expect(+sliders(a)[0].value).toBe(0); expect(+sliders(a)[1].value).toBe(100);
  });
  it('Apply uses the chosen colour and closes the picker', () => {
    const a = open(); hex(a).value = '#0a0b0c'; hex(a).oninput(); [...pop(a).querySelectorAll('button')].find(b => b.textContent === 'Apply').click(); expect(a.ev('state.S.schedules[0].color')).toBe('#0a0b0c'); expect(pop(a)).toBeNull();
  });
  it('an invalid hex value is never applied', () => {
    const a = open(); hex(a).value = 'url(x)'; hex(a).oninput(); [...pop(a).querySelectorAll('button')].find(b => b.textContent === 'Apply').click(); expect(a.ev('state.S.schedules[0].color')).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('the same picker is used for events, people and phases', () => {
    const a = fresh(blank({ people: [person()] })); sections(a)[1].querySelector('.sch .pick').click(); expect(pop(a)).not.toBeNull(); pop(a).querySelectorAll('button')[0].click();
    a.toolbar('add').click(); a.q('#fC').click(); expect(pop(a)).not.toBeNull();
  });
});

describe('R-UI-05 Undo and redo', () => {
  const change = (a, name) => { a.ev(`hist();state.S.schedules[0].name=${JSON.stringify(name)}`); a.ev('renderSide()'); };
  it('both buttons start disabled', () => { const a = fresh(); expect([a.toolbar('undo').disabled, a.toolbar('redo').disabled]).toEqual([true, true]); });
  it('a change enables Undo; undoing enables Redo; a new change after an undo clears Redo', () => {
    const a = fresh(); change(a, 'one'); expect(a.toolbar('undo').disabled).toBe(false); a.toolbar('undo').click(); expect(a.toolbar('redo').disabled).toBe(false); change(a, 'two'); expect(a.toolbar('redo').disabled).toBe(true);
  });
  it('Undo and Redo walk back and forth through the changes', () => {
    const a = fresh(); change(a, 'one'); change(a, 'two'); a.toolbar('undo').click(); expect(a.ev('state.S.schedules[0].name')).toBe('one'); a.toolbar('undo').click(); expect(a.ev('state.S.schedules[0].name')).toBe('Routine'); a.toolbar('redo').click(); expect(a.ev('state.S.schedules[0].name')).toBe('one');
  });
  it.each([['Ctrl+Z', { ctrlKey: true }, 'z'], ['Cmd+Z', { metaKey: true }, 'z']])('the keyboard shortcut %s undoes the last change', (_, mod, key) => {
    const a = fresh(); change(a, 'one'); a.key(key, mod); expect(a.ev('state.S.schedules[0].name')).toBe('Routine');
  });
  it.each([['Ctrl+Y', { ctrlKey: true }, 'y'], ['Ctrl+Shift+Z', { ctrlKey: true, shiftKey: true }, 'z']])('the keyboard shortcut %s redoes the undone change', (_, mod, key) => {
    const a = fresh(); change(a, 'one'); a.toolbar('undo').click(); a.key(key, mod); expect(a.ev('state.S.schedules[0].name')).toBe('one');
  });
  it('the shortcuts are ignored while typing in a field, so text editing keeps its own undo', () => {
    const a = fresh(); change(a, 'one'); const input = a.q('#sbin input[type=text]'); input.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })); expect(a.ev('state.S.schedules[0].name')).toBe('one');
  });
  it('the shortcuts are ignored while a dialog is open', () => {
    const a = fresh(); change(a, 'one'); a.toolbar('add').click(); a.key('z', { ctrlKey: true }); expect(a.ev('state.S.schedules[0].name')).toBe('one');
  });
  it('the undo history keeps the most recent 100 steps and drops older ones', () => {
    const a = fresh(); for (let i = 0; i < 120; i++) a.ev('hist()'); expect(a.ev('state.undoSt.length')).toBe(100);
  });
  it('undo and redo do nothing harmful when there is nothing to undo', () => {
    const a = fresh(); a.ev('undo();redo()'); expect(a.ev('state.S.schedules.length')).toBe(1);
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
  const dialog = (o = {}) => { const a = fresh(blank({ events: [ev1(o)], people: [person(), person({ id: 'B', name: 'Bob', color: '#2fa66a' })] })); a.ev('openDlg(state.S.events[0])'); return a; };
  const shown = (a, n) => ![n, ...(n.closest('.ev-only,.ph-only,.fsec') ? [n.closest('.ev-only,.ph-only,.fsec')] : [])].some(x => a.w.getComputedStyle(x).display === 'none');
  it('title and colour swatch share the first cell, followed by description, type, Who, When, How it fits in and the schedules', () => {
    const a = dialog(); expect(a.q('#fT').closest('.fcell')).toBe(a.q('#fC').closest('.fcell'));
    [['#fT', '#fD'], ['#fD', '#fTy'], ['#fTy', '#fOw'], ['#fOw', '#fInv'], ['#fInv', '#fDays'], ['#fDays', '#fFit'], ['#fFit', '#fSch']].forEach(([x, y]) => expect(before(a, x, y), `${x} before ${y}`).toBe(true));
  });
  it('fields have visible labels tied to them, and the colour swatch has a name', () => {
    const a = dialog(); ['fT', 'fD', 'fTy', 'fOw'].forEach(id => expect(a.q(`#dlg label[for="${id}"]`), id).not.toBeNull()); expect(a.q('#fC').getAttribute('aria-label')).toBe('Colour');
    expect(a.q('#dlg label[for="fOw"]').textContent).toBe('Owner'); expect(a.q('#dlg label[for="fOw"]').title).toMatch(/^The person who owns the task's conception, planning and execution, not necessarily the one who performs it/); expect(a.q('#dlg label[for="fOw"]').title).not.toMatch(/Fair Play/); expect(a.q('#fInv').closest('.fg').querySelector('label:not([for])').textContent).toBe('With');
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
  it('the day table has a header row: Days, (Week, shown only with different times per week), Start, End, Performed by, With, Colour, Timing', () => {
    const a = dialog(); expect(a.qa('#paneQ .dhd span').map(x => x.textContent).filter(Boolean)).toEqual(['Days', 'Week', 'Start', 'End', 'Performed by', 'With', 'Colour', 'Timing']);
    expect(a.q('#paneQ .dhd span').title).toMatch(/nearest ticked day.*\+ adds another time/);
  });
  it('a day row holds its day (with the week button of R-CYC-08), times, performer, With button, colour, timing, copy button and warning; flexible margins on a line below', () => {
    const r = dialog().qa('#fDays .dr')[0]; expect(r.children[0].querySelector('label input[type=checkbox]')).not.toBeNull(); expect(r.querySelector('.wcell .wkc')).not.toBeNull();
    expect([...r.children].filter(c => !c.classList.contains('cl') && !c.classList.contains('rx')).map(c => c.classList.contains('wcell') ? 'week' : c.classList.contains('dcell') ? 'day' : ['wbtn', 'cbtn', 'tsel', 'cpy', 'addt', 'wn', 'dsub'].find(k => c.classList.contains(k)) || c.tagName.toLowerCase()))
      .toEqual(['day', 'week', 'select', 'select', 'select', 'wbtn', 'cbtn', 'tsel', 'cpy', 'addt', 'wn', 'dsub']);
  });
  it('the day rows and the further-time lines share one grid (each line a subgrid box), so their columns line up with the header', () => {
    const css = dialog().d.querySelector('style').textContent; expect(css).toContain('#paneQ{display:grid;grid-template-columns:var(--dc)'); expect(css).toContain('.dhd,#fDays{display:contents}');
    expect(css).toContain('.dr{display:grid;grid-template-columns:subgrid;grid-column:1/-1;');
    expect(css).toContain('.dhd>:first-child,.dr>:first-child{grid-column-start:1}');
  });
  it('every time and person select of the day rows and blocks has a spoken name, also in Spanish', () => {
    const a = dialog(), r = a.qa('#fDays .dr')[0];
    expect([...r.querySelectorAll('select')].map(x => x.getAttribute('aria-label'))).toEqual(['Monday: start', 'Monday: end', 'Monday: performed by', 'Monday: timing', 'Flexible start', 'Flexible end']);
    expect(r.querySelector('.wbtn').getAttribute('aria-label')).toMatch(/^Monday: with: Default/); expect(r.querySelector('.cpy').getAttribute('aria-label')).toMatch(/^Copy this day to the other ticked days/);
    r.querySelector('.addt').click(); const x = a.q('#fDays .dr.dx');
    expect([...x.querySelectorAll('select')].slice(0, 4).map(y => y.getAttribute('aria-label'))).toEqual(['Monday, time 2: start', 'Monday, time 2: end', 'Monday, time 2: performed by', 'Monday, time 2: timing']); expect(x.querySelector('.bx').getAttribute('aria-label')).toBe('Remove this time');
    a.ev("setLang('es')"); const wed = a.qa('#fDays .dr:not(.dx)')[2]; expect(wed.querySelector('select').getAttribute('aria-label')).toBe('Miércoles: inicio'); expect(wed.querySelectorAll('select')[2].getAttribute('aria-label')).toBe('Miércoles: lo hace');
    expect(a.q('#fDays .dr.dx select').getAttribute('aria-label')).toBe('Lunes, hora 2: inicio');
  });
  it('on narrow screens the label column folds away (labels above their fields); on a phone each ticked day is a card with labelled fields', () => {
    const css = dialog().d.querySelector('style').textContent; expect(css).toMatch(/@media \(max-width:560px\)\{\.fg\{grid-template-columns:minmax\(0,1fr\)/);
    expect(css).toContain('@media (max-width:600px){#paneQ{display:block}.dhd{display:none}#fAddT{display:block;'); expect(css).toContain('grid-template-areas:"d d n c x" "ls le le le le" "s e e e e" "lp lw lw lw lw" "p w w w w" "lt lk lk lk lk" "t k k k k" "m m m m m"');
  });
  it('R-CYC-08 with different times per week the week has a column and a header of its own; on a phone card it reads Week [1] – Monday', () => {
    const a = openApp(); setData(a, blank({ cycle: 2, events: [ev1({ slots: [{ day: 0, start: 600, end: 660, person: '', wk: 2 }] })] })); a.ev('openDlg(state.S.events[0])');
    const css = a.d.querySelector('style').textContent; expect(a.q('#paneQ').classList.contains('pw')).toBe(true);
    expect(css).toContain('#paneQ.pw .wcell,#paneQ.pw .dhd>.wkh{display:block}'); expect(css).toContain('#paneQ.pw{--dc:auto auto minmax(68px,1fr)');
    const r = a.qa('#fDays .dr')[0]; expect(r.children[1].classList.contains('wcell')).toBe(true); expect(r.querySelector('.wcell .wkc').textContent).toBe('2'); expect(r.querySelector('.wcell .wkw').textContent).toBe('Week');
    expect(r.querySelector('.dcell .wkc')).toBeNull(); expect(css).toContain(".wcell::after{content:'–'}"); a.ev("setLang('es')"); expect(r.querySelector('.wcell .wkw').textContent).toBe('Semana');
  });
  it('a darker 2 px line separates the days and a thin line the times of one day', () => {
    const css = dialog().d.querySelector('style').textContent; expect(css).toContain('.dr:not(.dx){border-top:2px solid color-mix(in srgb,var(--fg) 25%,transparent)}.dr.dx{border-top:1px solid var(--line)}');
  });
  it('the buttons are Delete, Copy…, Cancel, Save in that order', () => { expect(dialog().qa('#dlg .btns button').map(b => b.textContent)).toEqual(['Delete', 'Copy…', 'Cancel', 'Save']); });
});

describe('R-UI-13 R-UI-01 A phone gets floating buttons; its drawer has the computer\'s top row', () => {
  const rules = a => [...a.d.styleSheets[0].cssRules].filter(r => r.media && /max-width: ?600px/.test(r.media.mediaText)).flatMap(r => [...r.cssRules]);
  const rule = (a, sel) => rules(a).find(r => r.selectorText === sel);
  it('the top row reads favicon, title, help, settings and the chevron, in that order, on every screen', () => {
    const a = openApp(); expect([...a.q('.sbtop').children].map(c => c.className.split(' ').find(k => ['fav', 'ttl', 'help', 'gear', 'xpand', 'lvr', 'lvnow'].includes(k)))).toEqual(['fav', 'ttl', 'help', 'gear', 'xpand', 'lvr', 'lvnow']);
    const b = openApp({ phone: true }); expect(rules(b).some(r => /^aside:not\(\.collapsed\)/.test(r.selectorText || '') && r.selectorText !== 'aside:not(.collapsed)' && !r.selectorText.includes('#sbBack'))).toBe(false);   // a phone draws the same open row
  });
  it('closed on a phone, the sidebar floats at the bottom-left as ? · Live View · › (no gear), so the grid has the whole width', () => {
    const a = openApp({ phone: true }), r = rule(a, 'aside.collapsed');
    expect([r.style.position, r.style.left, r.style.width]).toEqual(['fixed', '4px', 'auto']); expect(r.style.bottom).toContain('safe-area-inset-bottom');
    expect(['aside.collapsed .sbtop .help', 'aside.collapsed .lvr', 'aside.collapsed .sbtop .xpand'].map(s => rule(a, s).style.order)).toEqual(['1', '2', '3']);
    expect(rule(a, 'aside.collapsed .gear').style.display).toBe('none'); expect(rule(a, 'aside.collapsed .sbtop .eye').style.getPropertyValue('border-radius')).toBe('50%');
  });
  it('open on a phone, the drawer is up to 360 px wide with the computer\'s top row and no Live View button; the Tools Live View row is hidden', () => {
    const a = openApp({ phone: true }); expect(rules(a).find(r => r.selectorText === 'aside:not(.collapsed)').style.width).toMatch(/^min\(90vw, ?360px\)$/);
    expect([...a.d.styleSheets[0].cssRules].find(r => r.selectorText === 'aside .sbtop .lvr,aside .sbtop .lvnow').style.display).toBe('none'); expect(rule(a, '#sbin .lvrow').style.display).toBe('none');
  });
  it('in Live View on a phone only the stop button floats, with Now above it after a manual scroll', () => {
    const a = openApp({ phone: true }); expect(rule(a, 'aside.collapsed.lv .sbtop .help,aside.collapsed.lv .sbtop .xpand').style.display).toBe('none');
    expect(rule(a, 'aside.collapsed.lv.paused .lvnow').style.display).toBe('inline-flex'); expect(rule(a, 'aside.collapsed.lv.paused .lvnow').style.order).toBe('1');
    a.q('#lvR').click(); expect(a.q('#sb').classList.contains('lv')).toBe(true); expect(a.q('#sb').classList.contains('paused')).toBe(false);
    a.ev("state.livePaused=true;updLive()"); expect(a.q('#sb').classList.contains('paused')).toBe(true); expect(a.q('#lvF').getAttribute('aria-label')).toBe('Now');
    a.q('#lvF').click(); expect(a.ev('state.livePaused')).toBe(false); expect(a.q('#sb').classList.contains('paused')).toBe(false);
    a.q('#lvR').click(); expect(a.q('#sb').classList.contains('lv')).toBe(false);
  });
});

describe('R-UI-08 Light and dark theme', () => {
  const root = a => a.d.documentElement.getAttribute('data-theme');
  it('"System" (the default) sets nothing, so the device\'s own preference decides', () => { expect(root(fresh())).toBeNull(); });
  it('"Dark" and "Light" force the theme and are remembered', () => {
    const a = fresh(); a.q('.sbtop .gear').click(); a.click('Dark'); expect(root(a)).toBe('dark'); expect(JSON.parse(a.w.localStorage.getItem(PREFS_KEY)).theme).toBe('dark');
    a.click('Light'); expect(root(a)).toBe('light'); a.click('System'); expect(root(a)).toBeNull();
  });
  it('the chosen theme is applied again at the next visit', () => { const a = fresh(); a.ev('state.prefs.theme="dark";savePrefs()'); expect(root(openApp({ storage: a.storage() }))).toBe('dark'); });
  it('the dark palette exists both for the forced theme and for the system preference', () => {
    const css = fresh().d.querySelector('style').textContent; expect(css).toContain(':root[data-theme="dark"]'); expect(css).toContain('@media(prefers-color-scheme:dark)');
  });
  it('the current theme button is highlighted in the dialog', () => { const a = fresh(); a.ev('state.prefs.theme="dark"'); a.q('.sbtop .gear').click(); expect(a.qa('#xDlg .seg button').find(b => b.textContent === 'Dark').classList.contains('on')).toBe(true); });
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
    a.ev('openDlg(state.S.events[0])'); return a;
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
    drag(a, a.q('#dGrip'), [500, 108], [800, 208]); a.q('#dlg').close(); a.ev('openDlg(state.S.phases[0])');
    expect(a.q('#dlg').classList.contains('moved')).toBe(false); expect(pos(a)).toEqual(['', '']);
  });
});

describe('R-UI-11 Tools: Live View, highlighting untyped events and colouring the week by type or by person', () => {
  it('the View and Tools switches are real checkboxes announced as switches and drawn as sliding toggles', () => {
    const a = fresh(); const sw = a.qa('#sbin .zck input'); expect(sw.length).toBe(8);
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
  it('the section holds the Live View row and five switches, each with an explanatory tooltip: the now line on, the others off at first', () => {
    const a = fresh(week()), t = tools(a); expect(t.querySelector('.lvrow #lvB')).not.toBeNull(); expect(a.q('.sbbody > .lvrow')).toBeNull();
    expect([...t.querySelectorAll('label.zck')].map(l => [l.textContent, l.querySelector('input').checked])).toEqual([['Show the "now" line', true], ['Highlight events without an activity type', false], ['Colour by activity type', false], ['Colour by person', false], ['Fixed lanes, one per person', false]]);
    expect([...t.querySelectorAll('label.zck')].every(l => l.title.length > 40)).toBe(true); expect(t.querySelector('.tip').title).toContain('Live View');
  });
  it('Live View still starts and stops from its new place', () => {
    const a = fresh(week()); a.q('#lvB').click(); expect(a.ev('state.live')).toBe(true); expect(a.q('#lvB').textContent).toBe('Stop Live View'); a.q('#lvB').click(); expect(a.ev('state.live')).toBe(false);
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
    expect(box(a, 'Colour by activity type').checked).toBe(false); expect(a.ev('state.prefs.colBy')).toBe('p');
    tick(a, 'Colour by person', false); expect([0, 1].map(d => col(a, d))).toEqual(['#123456', '#8e4ec6']); expect(a.ev('state.S.events[0].slots[0].col')).toBe('#123456');
  });
  it('the event dialog still shows each time\'s stored colour while the week is coloured by type, and nothing becomes unsaved', () => {
    const a = fresh(week()); a.ev('saveMem("all")'); tick(a, 'Colour by activity type'); expect(a.ev('isDirty()')).toBe(false); a.ev('openDlg(state.S.events[0])');
    expect(a.qa('#fDays .dr')[0].querySelector('.cbtn').getAttribute('aria-label')).toBe('Monday: colour: Own colour (#123456)');
  });
  it('every switch and the folded section are remembered by this browser', () => {
    const a = fresh(week()); tick(a, 'Highlight events without an activity type'); tick(a, 'Colour by person'); tick(a, 'Show the "now" line', false);
    const b = openApp({ storage: a.storage() }); expect(b.ev('[state.prefs.hlNoType,state.prefs.colBy,state.prefs.nowLine]')).toEqual([true, 'p', false]);
    tools(b).querySelector('.shbtn').click(); expect(b.ev('state.prefs.secTools')).toBe(true); expect(b.q('#lvB')).toBeNull(); expect(openApp({ storage: b.storage() }).ev('state.prefs.secTools')).toBe(true);
    expect(openApp({ storage: { [PREFS_KEY]: JSON.stringify({ colBy: 'x', hlNoType: 'yes' }) } }).ev('[state.prefs.colBy,state.prefs.hlNoType]')).toEqual(['', false]);
  });
  it('printing keeps the colouring on screen but never the highlight', () => {
    const a = fresh(week()); tick(a, 'Highlight events without an activity type'); a.ev('printSchedule()');
    expect(a.w.__printed).toContain('noty'); expect(a.ev("[...document.styleSheets[0].cssRules].some(r=>r.selectorText==='#pr .noty'&&r.style.outlineStyle!=='solid')")).toBe(true);
  });
  it('the section and its switches are translated', () => {
    const a = fresh(week(), { languages: ['es'] });
    const t = sections(a).find(s => s.querySelector('.shbtn span').textContent === 'Herramientas'); expect([...t.querySelectorAll('label.zck')].map(l => l.textContent)).toEqual(['Mostrar la línea de "ahora"', 'Resaltar los eventos sin tipo de actividad', 'Colorear por tipo de actividad', 'Colorear por persona', 'Carriles fijos, uno por persona']);
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
    const a = openApp({ phone: true }); expect(a.ev('state.focusD')).toBe(a.ev('today()')); expect(a.qa('.day')).toHaveLength(1); expect(a.q('.dh.fo')).not.toBeNull();
    expect(openApp().ev('state.focusD')).toBeNull();
    const l = openApp({ phone: true, storage: saved({ live: true }) }); expect(l.ev('state.live')).toBe(true); expect(l.ev('state.focusD')).toBe(l.ev('today()'));
  });
  it('the phone stylesheet lays the open sidebar over the grid, above a backdrop, and hides the resize edge', () => {
    const css = openApp().q('style').textContent;
    expect(css).toContain('@media (max-width:600px){aside:not(.collapsed){position:fixed;'); expect(css).toContain('aside:not(.collapsed)~#sbBack{display:block;position:fixed;inset:0;'); expect(css).toContain('aside .rs{display:none}');
  });
});

describe('R-UI-14 Large dialogs on a phone: full screen, and the event dialog in tabs', () => {
  const ppl = [person({ id: 'A', name: 'Ann' })];
  const open = (o = {}, data = blank({ people: ppl, events: [ev1({ slots: [{ day: 0, start: 600, end: 660, person: 'A' }, { day: 2, start: 600, end: 660, person: 'A' }] })] })) => { const a = fresh(data, o); a.ev('openDlg(state.S.events[0])'); return a; };
  const tabs = a => a.qa('#dlg .dtabs button'), pane = (a, k) => a.q(`#dlg .dpane[data-p="${k}"]`);
  const shown = a => a.qa('#dlg .dpane').filter(p => !p.classList.contains('off')).map(p => p.dataset.p);
  const sel = a => tabs(a).map(b => b.getAttribute('aria-selected'));
  it('the event dialog has a tab row (Event, When, More) and three panes holding its sections', () => {
    const a = open(); expect(tabs(a).map(b => b.textContent)).toEqual(['EventPhase', 'When', 'MoreRhythms']);
    expect(a.q('#dlg .dtabs').getAttribute('role')).toBe('tablist'); expect(tabs(a).every(b => b.getAttribute('role') === 'tab' && b.type === 'button')).toBe(true);
    expect(['#fT', '#fD', '#fTy', '#fOw', '#fInv'].every(s => pane(a, 'ev').contains(a.q(s)))).toBe(true);
    expect(['#fWk', '#paneQ', '#fWarn'].every(s => pane(a, 'wh').contains(a.q(s)))).toBe(true);
    expect(['#fFit', '#fSch'].every(s => pane(a, 'mo').contains(a.q(s)))).toBe(true);
    expect(a.qa('#dlg .dpane').some(p => p.contains(a.q('#err')) || p.contains(a.q('#fOk')))).toBe(false);
  });
  it('on a desktop the tab row is hidden and every pane is shown; on a phone only the active pane is', () => {
    const a = open(), css = [...a.d.styleSheets[0].cssRules];
    expect(css.find(r => r.selectorText === '.dtabs').style.display).toBe('none');
    const ph = css.filter(r => r.media && /max-width: ?600px/.test(r.media.mediaText)).flatMap(r => [...r.cssRules]);
    expect(ph.find(r => r.selectorText === '#dlg .dpane.off').style.display).toBe('none'); expect(ph.find(r => r.selectorText === '#dlg .dtabs').style.display).toBe('flex');
    expect(css.some(r => !r.media && r.selectorText && /\.dpane\.off/.test(r.selectorText))).toBe(false);
  });
  it('every open starts on Event; clicking a tab or the arrow keys switch, with aria-selected and a roving tab stop', () => {
    const a = open({ phone: true }); expect(shown(a)).toEqual(['ev']); expect(sel(a)).toEqual(['true', 'false', 'false']);
    tabs(a)[1].click(); expect(shown(a)).toEqual(['wh']); expect(tabs(a).map(b => b.tabIndex)).toEqual([-1, 0, -1]);
    a.q('#dlg .dtabs').dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); expect(shown(a)).toEqual(['mo']); expect(a.d.activeElement).toBe(tabs(a)[2]);
    a.q('#dlg .dtabs').dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); expect(shown(a)).toEqual(['ev']);
    a.q('#fCancel').click(); a.ev('openDlg(state.S.events[0])'); expect(shown(a)).toEqual(['ev']);
  });
  it('a failed save shows the tab with the field it is about and marks that tab', () => {
    const a = open({ phone: true }); tabs(a)[2].click(); a.q('#fT').value = ''; a.q('#fOk').click();
    expect(shown(a)).toEqual(['ev']); expect(tabs(a)[0].classList.contains('bad')).toBe(true); expect(a.q('#err').textContent).toBe('Title is required.');
    a.q('#fT').value = 'Event'; a.q('#fSch input').checked = false; a.q('#fOk').click(); expect(shown(a)).toEqual(['mo']);
    expect(tabs(a).map(b => b.classList.contains('bad'))).toEqual([false, false, true]);
    a.q('#fSch input').checked = true; a.q('#fOk').click(); expect(a.q('#dlg').open).toBe(false); a.ev('openDlg(state.S.events[0])'); expect(tabs(a).some(b => b.classList.contains('bad'))).toBe(false);
  });
  it('the When tab shows ⚠ while repetitions in the table clash', () => {
    const a = open({ phone: true }, blank({ people: ppl, events: [ev1({ slots: [{ day: 0, start: 600, end: 720, person: 'A' }, { day: 0, start: 660, end: 780, person: 'A' }] })] }));
    expect(a.q('#fWarn').textContent).toContain('⚠'); expect(tabs(a)[1].classList.contains('warn')).toBe(true);
    const b = open({ phone: true }); expect(tabs(b)[1].classList.contains('warn')).toBe(false);
  });
  it('the jump to the clicked repetition waits until the When tab is shown on a phone', () => {
    const a = fresh(blank({ people: ppl, events: [ev1({ slots: [{ day: 0, start: 600, end: 660, person: 'A' }, { day: 4, start: 600, end: 660, person: 'A' }] })] }), { phone: true });
    a.ev('openDlg(state.S.events[0],null,state.S.events[0].slots[1])'); const fri = a.qa('#fDays .dr')[4]; expect(fri.classList.contains('pulse')).toBe(false);
    tabs(a)[1].click(); expect(fri.classList.contains('pulse')).toBe(true);
    const b = fresh(blank({ people: ppl, events: [ev1({ slots: [{ day: 0, start: 600, end: 660, person: 'A' }, { day: 4, start: 600, end: 660, person: 'A' }] })] }));
    b.ev('openDlg(state.S.events[0],null,state.S.events[0].slots[1])'); expect(b.qa('#fDays .dr')[4].classList.contains('pulse')).toBe(true);
  });
  it('a phase dialog names its tabs Phase, When and Rhythms, and Spanish translates them all', () => {
    const a = fresh(blank({ rhythms: [{ id: 'r', name: 'R', visible: true }], phases: [{ id: 'p', title: 'P', color: '#3b6df0', rhythms: ['r'], slots: [{ day: 0, start: 0, end: 60 }] }] }), { phone: true });
    a.ev("state.editMode='phases';openDlg(state.S.phases[0])"); expect(a.q('#dlg').classList.contains('ph')).toBe(true);
    expect(tabs(a).map(b => [...b.querySelectorAll('.ph-only')].map(s => s.textContent).join('') || b.textContent)).toEqual(['Phase', 'When', 'Rhythms']);
    a.ev("setLang('es')"); expect(tabs(a).map(b => b.textContent)).toEqual(['EventoFranja', 'Cuándo', 'MásRitmos']);
  });
  it('on a phone the dialog cannot be dragged, by its grip, an empty part or the arrow keys', () => {
    const a = open({ phone: true }), dl = a.q('#dlg');
    dl.dispatchEvent(new a.w.MouseEvent('pointerdown', { clientX: 300, clientY: 110, button: 0, bubbles: true, cancelable: true })); pointer(a, 'pointermove', { x: 100, y: 300 }); pointer(a, 'pointerup', { x: 100, y: 300 });
    a.q('#dGrip').dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); expect(dl.classList.contains('moved')).toBe(false); expect(dl.style.top).toBe('');
  });
  it('Settings, Help, Statistics, Copy and Weeks in the cycle fill the screen on a phone; small dialogs such as the Live View week question stay floating', () => {
    const a = open({ phone: true }); a.q('#fCancel').click();
    a.ev('openSettings()'); expect(a.q('#xDlg').classList.contains('full')).toBe(true); a.click('Close');
    a.ev('openHelp()'); expect(a.q('#xDlg').classList.contains('full')).toBe(true); a.click('Close');
    a.ev('openStats("A")'); expect(a.q('#xDlg').classList.contains('full')).toBe(true); a.click('Close');
    a.ev('openCopy(state.S.events[0])'); expect(a.q('#xDlg').classList.contains('full')).toBe(true); a.click('Cancel');
    a.ev('openCycle()'); expect(a.q('#xDlg').classList.contains('full')).toBe(true); a.click('Cancel');
    a.ev('askLiveWeek(()=>{})'); expect(a.q('#xDlg').classList.contains('full')).toBe(false);
    const ph = [...a.d.styleSheets[0].cssRules].filter(r => r.media).flatMap(r => [...r.cssRules]).find(r => r.selectorText === '#dlg,#agDlg,#xDlg.full');
    expect(ph.style.width).toBe('100vw'); expect(ph.style.height).toBe('100dvh');
  });
});
