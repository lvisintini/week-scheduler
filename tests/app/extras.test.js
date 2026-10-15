import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, ev1, sched, person, dragFrom, dlgOpen } from '../helpers/app.js';

const fresh = (data, o = {}) => { const a = openApp(o); if (data) setData(a, data); return a; };
const data = a => a.ev('JSON.parse(JSON.stringify(S))');
const xs = (a, e = 0, i = 0) => data(a).events[e].slots[i].extras;
// the drop-off on Monday and Wednesday (Monday has two extras) and a separate supermarket run on Tuesday
const home = (o = {}) => blank({
  people: [person({ id: 'L', name: 'Luis' })],
  events: [
    ev1({ id: 'e1', title: 'Drop-off', slots: [{ day: 0, start: 480, end: 540, person: 'L', extras: ['Bring milk', 'Sports kit'] }, { day: 2, start: 480, end: 540, person: 'L' }] }),
    ev1({ id: 'e2', title: 'Supermarket', color: '#2fa66a', slots: [{ day: 1, start: 600, end: 660, person: 'L' }] }),
  ], ...o,
});
const box = (a, day) => a.q(`.day[data-d="${day}"] .ev`);
const btn = (a, day) => box(a, day).querySelector('.xb');
const openPop = (a, day) => { btn(a, day).click(); return a.q('.xpop'); };
const enter = (a, input, v) => { input.value = v; input.onkeydown({ key: 'Enter', preventDefault() {} }); };
/** pointer event on the document, with modifier keys */
const fire = (a, type, x, y, o = {}) => { const e = new a.w.MouseEvent(type, { clientX: x, clientY: y, bubbles: true, ...o }); Object.defineProperty(e, 'pointerType', { value: 'mouse' }); a.d.dispatchEvent(e); };
/** drags the k-th extra of the open list onto (col, min) of the grid */
const dragX = (a, k, col, min, o = {}) => {
  const g = a.qa('.xpop .xg')[k]; g.onpointerdown({ button: 0, clientX: 5, clientY: 5, preventDefault() {}, stopPropagation() {} });
  const x = o.x ?? a.x(col), y = a.y(min); fire(a, 'pointermove', x, y); if (!o.noUp) fire(a, 'pointerup', x, y, o.keys || {});
};
const toastBtn = (a, label) => a.qa('#toast button').find(b => b.textContent === label);

describe('R-XTR-01 Extras: free-text tasks stored on one occurrence, carried along with it', () => {
  it('extras are kept per repetition, trimmed, without empty entries or duplicates (ignoring case)', () => {
    const a = fresh(blank({ events: [ev1({ slots: [{ day: 0, start: 600, end: 660, person: '', extras: ['  Bring milk ', '', 'bring MILK', 'Kit', 7] }, { day: 1, start: 600, end: 660, person: '' }] })] }));
    expect(xs(a, 0, 0)).toEqual(['Bring milk', 'Kit', '7']); expect('extras' in data(a).events[0].slots[1]).toBe(false);
  });
  it('an empty list is not stored at all, and each extra is cut to 200 characters', () => {
    const a = fresh(blank({ events: [ev1({ slots: [{ day: 0, start: 600, end: 660, person: '', extras: ['x'.repeat(300)] }, { day: 1, start: 600, end: 660, person: '', extras: [] }] })] }));
    expect(xs(a, 0, 0)[0]).toHaveLength(200); expect('extras' in data(a).events[0].slots[1]).toBe(false);
  });
  it('at most 20 extras per occurrence: more are cut in browser memory and refuse an import', () => {
    const many = Array.from({ length: 25 }, (_, i) => 'Task ' + i), d = blank({ events: [ev1({ slots: [{ day: 0, start: 600, end: 660, person: '', extras: many }] })] });
    const a = fresh(d); expect(xs(a)).toHaveLength(20);
    expect(a.ev(`(()=>{try{parseData(${JSON.stringify(d)},true);return 'ok'}catch(e){return e.message}})()`)).toBe('limit');
  });
  it('phases never carry extras, even when a file has them', () => {
    const a = fresh(blank({ rhythms: [{ id: 'r', name: 'R', visible: true }], phases: [{ id: 'p', title: 'Lunch', desc: '', color: '#3b6df0', rhythms: ['r'], slots: [{ day: 0, start: 720, end: 780, extras: ['x'] }] }] }));
    expect('extras' in data(a).phases[0].slots[0]).toBe(false);
  });
  it('moving a repeating event by dragging carries every repetition\'s extras with it', async () => {
    const a = fresh(home()); await dragFrom(a, box(a, 0), { col: 0, min: 500 }, { col: 0, min: 620 });
    const sl = data(a).events[0].slots; expect(sl[0]).toMatchObject({ start: 600, extras: ['Bring milk', 'Sports kit'] }); expect(sl[1].extras).toBeUndefined();
  });
  it('moving one repetition to another day with Shift keeps its extras on it', async () => {
    const a = fresh(home()); await dragFrom(a, box(a, 0), { col: 0, min: 500 }, { col: 3, min: 500 }, { shift: true });
    expect(data(a).events[0].slots[0]).toMatchObject({ day: 3, extras: ['Bring milk', 'Sports kit'] });
  });
  it('resizing and "Only this day" keep the extras on their repetition', async () => {
    const a = fresh(home()); await dragFrom(a, box(a, 0)._rz, { col: 0, min: 535 }, { col: 0, min: 600 });
    expect(xs(a)).toEqual(['Bring milk', 'Sports kit']); toastBtn(a, 'Only this day').click(); expect(data(a).events[0].slots[0]).toMatchObject({ end: 600, extras: ['Bring milk', 'Sports kit'] });
  });
  it('a copy made with the Copy dialog has the same extras, independent of the original', () => {
    const a = fresh(home({ schedules: [sched(), sched({ id: 's2', name: 'S2' })] })); a.ev('openDlg(S.events[0])'); a.q('#fCopy').click(); a.click('Copy');
    expect(xs(a, 2)).toEqual(['Bring milk', 'Sports kit']); a.ev('S.events[2].slots[0].extras.push("Other")'); expect(xs(a, 0)).toHaveLength(2);
  });
  it('inserting a workspace and anonymised exports keep the extras (like titles)', () => {
    const a = fresh(home()); expect(a.ev('anonymised(buildFile()).events[0].slots[0].extras')).toEqual(['Bring milk', 'Sports kit']);
    expect(a.ev('anonymised(buildFile()).people[0].name')).not.toBe('Luis');
    a.ev('insertInto(parseData(buildFile()))'); expect(data(a).events.filter(e => e.slots[0].extras)).toHaveLength(2);
    expect(a.d.getElementById('xDlg') && a.ev('L("anonTip")')).toContain('Titles, extras and the names');
  });
  it('extras change nothing in the statistics, the lanes or the overlap stripes', () => {
    const plain = home(); plain.events[0].slots[0].extras = undefined;
    const a = fresh(home()), b = fresh(plain), st = x => x.ev('JSON.stringify([...personStats("L",true).by])');
    expect(st(a)).toBe(st(b)); expect(a.qa('.ev').map(e => e.dataset.lane)).toEqual(b.qa('.ev').map(e => e.dataset.lane));
  });
});

describe('R-XTR-02 Each box has an extras button that opens a small list to add, change and remove them', () => {
  it('a box with extras shows the checklist icon with the count and names them in its label', () => {
    const a = fresh(home()); const b = btn(a, 0);
    expect(b.tagName).toBe('BUTTON'); expect(b.classList.contains('add')).toBe(false); expect(b.querySelector('em').textContent).toBe('2');
    expect(b.getAttribute('aria-label')).toBe('Extras: Bring milk, Sports kit');
  });
  it('a box without extras has a "+" button for adding one (shown on hover, always on touch screens)', () => {
    const a = fresh(home()); const b = btn(a, 1); expect(b.classList.contains('add')).toBe(true); expect(b.getAttribute('aria-label')).toBe('Add an extra');
    const css = a.d.querySelector('style').textContent; expect(css).toContain('.ev:hover .xb.add'); expect(css).toMatch(/@media \(hover:none\)\{\.ev \.xb\.add\{opacity:\.85\}/);
  });
  it('pressing the button never starts moving the box or creating an event', () => {
    const a = fresh(home()); let stopped = false; btn(a, 0).onpointerdown({ stopPropagation() { stopped = true; } }); expect(stopped).toBe(true);
  });
  it('locked boxes and Phases mode show the count without a button, and offer no "+"', () => {
    const a = fresh(home({ schedules: [sched({ locked: true })] })); expect(btn(a, 0).tagName).toBe('SPAN'); expect(btn(a, 1)).toBeNull();
    const b = fresh(home()); b.ev("editMode='phases';render()"); expect(btn(b, 0).tagName).toBe('SPAN'); expect(btn(b, 1)).toBeNull();
  });
  it('the list names the occurrence and shows each extra with a grip, its text and ✕, then "Add an extra…"', () => {
    const a = fresh(home()); const p = openPop(a, 0);
    expect(p.querySelector('.oh').textContent).toBe('Extras · Mon 08:00 · Drop-off'); expect(a.qa('.xpop .xr input').map(i => i.value)).toEqual(['Bring milk', 'Sports kit']);
    expect(a.qa('.xpop .xg')).toHaveLength(2); expect(a.qa('.xpop .xx')).toHaveLength(2); expect(p.querySelector('.xadd').placeholder).toBe('Add an extra… (Enter)');
  });
  it('typing in "Add an extra…" and pressing Enter adds it (undoable, marks the workspace unsaved)', () => {
    const a = fresh(home()); a.ev('cw().lb=keyOf(S)'); const p = openPop(a, 2); enter(a, p.querySelector('.xadd'), '  Library book ');
    expect(xs(a, 0, 1)).toEqual(['Library book']); expect(a.q('.xpop .xr input').value).toBe('Library book'); expect(btn(a, 2).querySelector('em').textContent).toBe('1');
    expect(a.ev('anyDirty()')).toBe(true); a.toolbar('undo').click(); expect(xs(a, 0, 1)).toBeUndefined();
  });
  it('adding an extra that is already there (any case) changes nothing and says so', () => {
    const a = fresh(home()); enter(a, openPop(a, 0).querySelector('.xadd'), 'BRING MILK'); expect(xs(a)).toHaveLength(2); expect(a.toast()).toBe('"BRING MILK" is already there.');
  });
  it('editing the text renames the extra; clearing it removes it; a duplicate name is refused', () => {
    const a = fresh(home()); openPop(a, 0); let i = a.qa('.xpop .xr input')[0]; i.value = 'Bring oat milk'; i.onchange(); expect(xs(a)).toEqual(['Bring oat milk', 'Sports kit']);
    i = a.qa('.xpop .xr input')[1]; i.value = 'bring oat milk'; i.onchange(); expect(xs(a)).toEqual(['Bring oat milk', 'Sports kit']); expect(i.value).toBe('Sports kit');
    i = a.qa('.xpop .xr input')[0]; i.value = ' '; i.onchange(); expect(xs(a)).toEqual(['Sports kit']);
  });
  it('Enter and the change that follows it make one change, not two undo steps', () => {
    const a = fresh(home()); openPop(a, 0); const i = a.qa('.xpop .xr input')[0], n = a.ev('undoSt.length');
    i.value = 'Milk'; i.onkeydown({ key: 'Enter', preventDefault() {} }); i.onchange(); expect(a.ev('undoSt.length')).toBe(n + 1);
  });
  it('✕ removes an extra; removing the last one leaves no extras field and turns the button into "+"', () => {
    const a = fresh(home()); openPop(a, 0); a.q('.xpop .xx').click(); a.q('.xpop .xx').click();
    expect(data(a).events[0].slots[0].extras).toBeUndefined(); expect(btn(a, 0).classList.contains('add')).toBe(true); expect(a.q('.xpop .xe').textContent).toMatch(/Small tasks or reminders/);
  });
  it('with 20 extras the add field is disabled and says why', () => {
    const many = Array.from({ length: 20 }, (_, i) => 'Task ' + i), a = fresh(blank({ events: [ev1({ slots: [{ day: 0, start: 600, end: 660, person: '', extras: many }] })] }));
    const add = openPop(a, 0).querySelector('.xadd'); expect(add.disabled).toBe(true); expect(add.placeholder).toBe('No more than 20 extras per occurrence.');
  });
  it('Esc closes the list without leaving the one-day focus, and undo closes a list whose occurrence changed', () => {
    const a = fresh(home()); a.ev('setFocus(0)'); openPop(a, 0); a.key('Escape'); expect(a.q('.xpop')).toBeNull(); expect(a.ev('focusD')).toBe(0);
    openPop(a, 0); a.q('.xpop .xx').click(); a.toolbar('undo').click(); expect(a.q('.xpop')).toBeNull(); expect(xs(a)).toHaveLength(2);
  });
});

describe('R-XTR-03 An extra is dragged by its grip onto any other occurrence (Ctrl/Alt copies)', () => {
  it('dropping on another event\'s box moves it there, with a toast that offers Undo', () => {
    const a = fresh(home()); openPop(a, 0); dragX(a, 0, 1, 630);
    expect(xs(a, 0)).toEqual(['Sports kit']); expect(xs(a, 1)).toEqual(['Bring milk']); expect(a.q('.xpop')).toBeNull();
    expect(a.toast()).toContain('Moved "Bring milk" to Tue 10:00 · Supermarket'); toastBtn(a, 'Undo').click(); expect(xs(a, 0)).toHaveLength(2); expect(xs(a, 1)).toBeUndefined();
  });
  it('dropping on another repetition of the same event moves it there', () => {
    const a = fresh(home()); openPop(a, 0); dragX(a, 1, 2, 500); expect(xs(a, 0, 0)).toEqual(['Bring milk']); expect(xs(a, 0, 1)).toEqual(['Sports kit']);
  });
  it.each([['ctrlKey'], ['altKey'], ['metaKey']])('holding %s at the drop copies the extra instead', key => {
    const a = fresh(home()); openPop(a, 0); dragX(a, 0, 1, 630, { keys: { [key]: true } });
    expect(xs(a, 0)).toEqual(['Bring milk', 'Sports kit']); expect(xs(a, 1)).toEqual(['Bring milk']); expect(a.toast()).toContain('Copied "Bring milk"');
  });
  it('the box under the pointer is highlighted while dragging, and a ghost shows the text', () => {
    const a = fresh(home()); openPop(a, 0); dragX(a, 0, 1, 630, { noUp: true });
    expect(box(a, 1).classList.contains('xdrop')).toBe(true); expect(a.q('.xghost').textContent).toBe('Bring milk');
    a.key('Escape'); expect(a.q('.xghost')).toBeNull(); expect(a.q('.xdrop')).toBeNull(); expect(xs(a)).toHaveLength(2);
  });
  it('dropping on empty space, on its own occurrence or outside the grid changes nothing', () => {
    const a = fresh(home()); const before = JSON.stringify(data(a));
    openPop(a, 0); dragX(a, 0, 4, 900); openPop(a, 0); dragX(a, 0, 0, 500); openPop(a, 0); dragX(a, 0, 1, 630, { x: 5000 });
    expect(JSON.stringify(data(a))).toBe(before);
  });
  it('locked occurrences are not drop targets', () => {
    const a = fresh(home({ schedules: [sched(), sched({ id: 's2', name: 'Locked', locked: true })] })); a.ev("S.events[1].schedules=['s2'];render()");
    openPop(a, 0); dragX(a, 0, 1, 630); expect(xs(a, 1)).toBeUndefined(); expect(xs(a, 0)).toHaveLength(2);
  });
  it('moving onto an occurrence that already has it just removes it here; copying there says it is already there', () => {
    const a = fresh(home()); a.ev("S.events[1].slots[0].extras=['bring milk'];render()");
    openPop(a, 0); dragX(a, 0, 1, 630, { keys: { ctrlKey: true } }); expect(a.toast()).toBe('"Bring milk" is already there.'); expect(xs(a, 0)).toHaveLength(2);
    openPop(a, 0); dragX(a, 0, 1, 630); expect(xs(a, 0)).toEqual(['Sports kit']); expect(xs(a, 1)).toEqual(['bring milk']);
  });
  it('where several occurrences are under the pointer, a chooser asks which one gets the extra', () => {
    const a = fresh(home()); a.ev("S.events.push({...S.events[1],id:'e3',title:'Bakery',slots:[{day:1,start:600,end:660,person:''}]});render()");
    openPop(a, 0); dragX(a, 0, 1, 630); expect(a.q('.omenu .oh').textContent).toBe('Put the extra on…');
    a.qa('.omenu .oi').find(b => b.textContent.includes('Bakery')).click(); expect(xs(a, 2)).toEqual(['Bring milk']); expect(xs(a, 1)).toBeUndefined();
  });
  it('an extra can be dropped on a background strip (an external person\'s activity)', () => {
    const a = fresh(home({ people: [person({ id: 'L', name: 'Luis' }), person({ id: 'X', name: 'Cleaner', external: true })] }));
    a.ev("S.events[1].slots[0].person='X';render()"); expect(a.q('.day[data-d="1"] .bgs')).not.toBeNull();
    openPop(a, 0); dragX(a, 0, 1, 630, { x: 195 }); expect(xs(a, 1)).toEqual(['Bring milk']);
  });
});

describe('R-XTR-04 Extras are shown in the hover card, the day agenda and the box labels', () => {
  it('the hover card lists the occurrence\'s extras', () => {
    const a = fresh(home()); expect(a.ev('peekHTML(piecesAt(0,500,true))')).toContain('Extras: Bring milk · Sports kit');
    expect(a.ev('peekHTML(piecesAt(2,500,true))')).not.toContain('Extras');
  });
  it('the day agenda lists them under the event as a checklist to tick on paper', () => {
    const a = fresh(home()); a.ev('openAgenda(0)'); expect(a.qa('#agBody .axs li').map(l => l.textContent)).toEqual(['Bring milk', 'Sports kit']);
    expect(a.d.querySelector('style').textContent).toContain(".axs li::before{content:'☐'");
  });
  it('the box and a background strip name their extras in their accessible label', () => {
    const a = fresh(home({ people: [person({ id: 'L', name: 'Luis' }), person({ id: 'X', name: 'Cleaner', external: true })] }));
    a.ev("S.events[1].slots[0].person='X';S.events[1].slots[0].extras=['Leave the key'];render()");
    expect(box(a, 0).getAttribute('aria-label')).toContain('Extras: Bring milk, Sports kit'); expect(a.q('.bgs').getAttribute('aria-label')).toContain('Extras: Leave the key');
  });
  it('printing shows the count of extras but never the "+" buttons', () => {
    const a = fresh(home()); a.toolbar('print').click(); expect(a.w.__printed).toContain('class="xb"'); expect(a.d.querySelector('style').textContent).toContain('#pr .xb.add{display:none!important}');
  });
});

describe('R-XTR-05 The event dialog lists each repetition\'s extras with ✕ (adding and moving happen on the grid)', () => {
  const chips = (a, sel = '#fDays .dr') => a.qa(sel).map(r => [...r.querySelectorAll('.xl .xc')].map(c => c.firstChild.textContent));
  it('each Quick row shows its repetition\'s extras, and rows without extras show nothing', () => {
    const a = fresh(home()); a.ev('openDlg(S.events[0])'); expect(chips(a)).toEqual([['Bring milk', 'Sports kit'], [], [], [], [], [], []]);
    expect(a.qa('#fDays .xl').filter(x => x.style.display !== 'none')).toHaveLength(1);
  });
  it('✕ in the dialog removes an extra when saving; Cancel keeps it', () => {
    const a = fresh(home()); a.ev('openDlg(S.events[0])'); a.q('#fDays .xl .xc button').click(); expect(chips(a)[0]).toEqual(['Sports kit']);
    a.q('#fCancel').click(); expect(xs(a)).toHaveLength(2);
    a.ev('openDlg(S.events[0])'); a.q('#fDays .xl .xc button').click(); a.q('#fOk').click(); expect(dlgOpen(a)).toBe(false); expect(xs(a)).toEqual(['Sports kit']);
  });
  it('saving the dialog without touching the extras keeps them, also after Quick → Advanced → Quick', () => {
    const a = fresh(home()); a.ev('openDlg(S.events[0])'); a.q('#tabA').click(); expect(chips(a, '#fBlocks .br')).toEqual([['Bring milk', 'Sports kit'], []]);
    a.q('#tabQ').click(); a.q('#fOk').click(); expect(xs(a)).toEqual(['Bring milk', 'Sports kit']);
  });
  it('an event with two blocks on one day opens in Advanced with each block\'s own extras', () => {
    const a = fresh(blank({ events: [ev1({ slots: [{ day: 0, start: 480, end: 540, person: '', extras: ['Milk'] }, { day: 0, start: 900, end: 960, person: '', extras: ['Kit'] }] })] }));
    a.ev('openDlg(S.events[0])'); expect(chips(a, '#fBlocks .br')).toEqual([['Milk'], ['Kit']]); a.q('#fOk').click(); expect(data(a).events[0].slots.map(s => s.extras)).toEqual([['Milk'], ['Kit']]);
  });
  it('unticking a day drops its extras with the repetition on saving; ticking it again before saving keeps them', () => {
    const a = fresh(home()); a.ev('openDlg(S.events[0])'); const cb = a.q('#fDays .dr input');
    cb.checked = false; cb.onchange(); cb.checked = true; cb.onchange(); a.q('#fOk').click(); expect(xs(a)).toEqual(['Bring milk', 'Sports kit']);
    a.ev('openDlg(S.events[0])'); cb.checked = false; cb.onchange(); a.q('#fOk').click(); expect(data(a).events[0].slots.map(s => s.day)).toEqual([2]); expect(xs(a)).toBeUndefined();
  });
  it('new blocks and new events start without extras; the phase dialog never shows them', () => {
    const a = fresh(home({ rhythms: [{ id: 'r', name: 'R', visible: true }], phases: [{ id: 'p', title: 'Lunch', desc: '', color: '#3b6df0', rhythms: ['r'], slots: [{ day: 0, start: 720, end: 780 }] }] }));
    a.ev('openDlg(S.events[0])'); a.q('#tabA').click(); a.q('#fAddBlock').click(); expect(chips(a, '#fBlocks .br').at(-1)).toEqual([]); a.q('#fCancel').click();
    a.ev('openDlg(S.phases[0])'); expect(a.qa('#fDays .xl').every(x => x.style.display === 'none')).toBe(true); expect(a.q('#fDays .xl').classList.contains('ev-only')).toBe(true);
  });
});

describe('R-XTR-06 A background strip with extras carries a ⚠, because its extras are easy to miss', () => {
  const ppl = [person({ id: 'L', name: 'Luis' }), person({ id: 'X', name: 'Cleaner', external: true })];
  const strip = (slot = {}) => fresh(blank({ people: ppl, events: [ev1({ id: 'c', title: 'Cleaning', slots: [{ day: 1, start: 600, end: 720, person: 'X', ...slot }] }), ev1({ id: 'b', title: 'Box', slots: [{ day: 0, start: 600, end: 660, person: 'L', extras: ['Milk'] }] })] }));
  it('a strip with extras shows the ⚠ at its top and its title starts below it; a strip without extras has none', () => {
    const a = strip({ extras: ['Leave the key'] }), s = a.q('.bgs');
    expect(s.classList.contains('xw')).toBe(true); expect(s.firstElementChild.className).toBe('xwn'); expect(s.querySelector('.xwn').innerHTML).toBe(a.ev('(()=>{const d=document.createElement("b");d.innerHTML=ICON_WARN;return d.innerHTML})()'));
    expect(s.querySelector('span').style.paddingTop).toBe('17px');
    const b = strip(); expect(b.q('.bgs .xwn')).toBeNull(); expect(b.q('.bgs').classList.contains('xw')).toBe(false);
  });
  it('boxes with extras never get the strip warning (they have their extras button)', () => {
    const a = strip({ extras: ['Leave the key'] }); expect(a.q('.ev .xwn')).toBeNull(); expect(a.q('.ev .xb em').textContent).toBe('1');
  });
  it('on a strip with a flexible start the title still starts where the solid part starts, below the ⚠', () => {
    const a = strip({ extras: ['Leave the key'], fs: 60 }); expect(parseFloat(a.q('.bgs span').style.paddingTop)).toBeGreaterThan(17);
  });
  it('both pieces of a strip that runs past midnight show the ⚠', () => {
    const a = strip({ extras: ['Leave the key'], start: 1320, end: 1800 }); expect(a.qa('.bgs .xwn')).toHaveLength(2);
  });
  it('the strip\'s label and hover card say its extras are easy to miss; a box\'s hover card does not', () => {
    const a = strip({ extras: ['Leave the key'] }); expect(a.q('.bgs').getAttribute('aria-label')).toContain('⚠ Has extras: easy to miss on a background activity, Extras: Leave the key');
    expect(a.ev('peekHTML(piecesAt(1,630,true))')).toContain('Has extras: easy to miss on a background activity'); expect(a.ev('peekHTML(piecesAt(0,630,true))')).not.toContain('easy to miss');
  });
  it('dropping an extra on a strip makes the ⚠ appear; Undo takes it away again', () => {
    const a = strip(); openPop(a, 0); dragX(a, 0, 1, 630, { x: 195 }); expect(a.q('.bgs .xwn')).not.toBeNull();
    toastBtn(a, 'Undo').click(); expect(a.q('.bgs .xwn')).toBeNull();
  });
});
