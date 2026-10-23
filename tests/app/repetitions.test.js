import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, ev1, person, dragFrom, fillDialog, dlgOpen } from '../helpers/app.js';

const fresh = (data, o = {}) => { const a = openApp(o); if (data) setData(a, data); return a; };
const people = [person({ id: 'A', name: 'Ann' }), person({ id: 'B', name: 'Bob', color: '#2fa66a' })];
const slots = a => a.ev('JSON.parse(JSON.stringify(state.S.events[0].slots))');
const save = a => a.q('#fOk').click();
const rows = a => a.qa('#fDays .dr');
const slot = (day, start = 600, end = 660, person = '') => ({ day, start, end, person });
const three = () => fresh(blank({ events: [ev1({ slots: [slot(0), slot(2), slot(4)] })] }));
const toastButtons = a => [...a.q('#toast').querySelectorAll('button')].map(b => b.textContent);
const toastBtn = (a, t) => [...a.q('#toast').querySelectorAll('button')].find(b => b.textContent === t);

describe('R-REP-01 An event can repeat on chosen days with its own times and people', () => {
  it('ticking Wednesday and Friday after Monday gives them Monday\'s times (a new day copies the nearest ticked day above it)', () => {
    const a = fresh(blank()); a.toolbar('add').click(); fillDialog(a, { title: 'Shift', days: { 0: {}, 2: {}, 4: {} } }); save(a);
    expect(slots(a).map(s => [s.day, s.start, s.end])).toEqual([[0, 540, 600], [2, 540, 600], [4, 540, 600]]);
  });
  it('each day keeps its own times; changing one day never moves another', () => {
    const a = fresh(blank()); a.toolbar('add').click(); fillDialog(a, { title: 'T', days: { 0: {}, 1: { start: '720', end: '780' } } });
    const s0 = rows(a)[0].querySelectorAll('select'); s0[0].value = '840'; s0[0].onchange(); s0[1].value = '900'; s0[1].onchange();
    save(a); expect(slots(a).map(s => [s.day, s.start, s.end])).toEqual([[0, 840, 900], [1, 720, 780]]);
  });
  it('the copy button of a day gives every other ticked day its times', () => {
    const a = fresh(blank()); a.toolbar('add').click(); fillDialog(a, { title: 'T', days: { 0: { start: '840', end: '900' }, 1: { start: '720', end: '780' }, 3: {} } });
    rows(a)[0].querySelector('.cpy').click(); a.q('.cmenu .oi').click(); save(a); expect(slots(a).map(s => [s.day, s.start, s.end])).toEqual([[0, 840, 900], [1, 840, 900], [3, 840, 900]]);
    expect(a.toast()).toBe('Copied to Tuesday, Thursday');
  });
  it('each repetition can have its own performer, defaulting to the owner', () => {
    const a = fresh(blank({ people })); a.toolbar('add').click(); fillDialog(a, { title: 'T', person: 'A' }); fillDialog(a, { days: { 0: {}, 1: {}, 2: { person: 'B' } } });
    save(a); expect(slots(a).map(s => s.person)).toEqual(['A', 'A', 'B']);
  });
  it('all repetitions share the colour, title and schedules of the event', () => {
    const a = three(); expect(a.qa('.ev')).toHaveLength(3); expect(new Set(a.qa('.ev').map(b => b.style.background)).size).toBe(1);
  });
  it('a single repetition is removed by unticking its day and saving; the others stay', () => {
    const a = three(); a.ev('openDlg(state.S.events[0])'); fillDialog(a, { days: { 0: {}, 4: {} } }); save(a);
    expect(slots(a).map(s => s.day)).toEqual([0, 4]);
  });
  it('one repetition can be retimed in the dialog without touching the others', () => {
    const a = three(); a.ev('openDlg(state.S.events[0])'); const sel = rows(a)[2].querySelectorAll('select')[0]; sel.value = '780'; sel.dispatchEvent(new a.w.Event('change')); save(a);
    expect(slots(a).map(s => s.start)).toEqual([600, 780, 600]);
  });
  it('deleting the event deletes every repetition', () => {
    const a = three(); a.ev('openDlg(state.S.events[0])'); a.q('#fDel').click(); expect(a.ev('state.S.events.length')).toBe(0);
  });
});

describe('R-REP-02 One day table: each day can hold several times, without modes', () => {
  const dlg = () => { const a = three(); a.ev('openDlg(state.S.events[0])'); return a; };   // Mon, Wed, Fri 10:00–11:00
  const lines = a => a.qa('#fDays .dr');   // day rows and the further-time lines, in order
  const days = a => a.qa('#fDays .dr:not(.dx)');   // the seven day rows only
  const times = el => [...el.querySelectorAll('select')].slice(0, 2).map(x => x.value);
  it('the dialog shows the Mon–Sun rows directly; there are no Quick/Advanced tabs any more', () => {
    const a = dlg(); expect(rows(a).filter(r => !r.classList.contains('dx'))).toHaveLength(7); expect(a.q('#dlg .tabs')).toBeNull(); expect(a.q('#tabA')).toBeNull(); expect(a.q('#fBlocks')).toBeNull();
  });
  it('+ adds another time on that day, starting where its last time ends, for an hour, performed by the owner', () => {
    const a = dlg(); days(a)[4].querySelector('.addt').click(); const x = lines(a)[5];
    expect(x.classList.contains('dx')).toBe(true); expect(times(x)).toEqual(['660', '720']); expect(x.querySelectorAll('select')[2].value).toBe('@o'); expect(x.querySelector('.addt')).toBeNull();
    expect(days(a)[4].querySelector('.addt').title).toBe('Add another time on Friday');
  });
  it('two times on a day are saved as two repetitions of that day, in time order', () => {
    const a = dlg(); days(a)[0].querySelector('.addt').click(); const x = a.q('#fDays .dr.dx').querySelectorAll('select'); x[0].value = '480'; x[0].onchange(); x[1].value = '540'; x[1].onchange();
    save(a); expect(slots(a).map(s => [s.day, s.start, s.end])).toEqual([[0, 480, 540], [0, 600, 660], [2, 600, 660], [4, 600, 660]]);
  });
  it('✕ removes a further time; a day\'s first time has no ✕ (untick the day instead)', () => {
    const a = dlg(); days(a)[2].querySelector('.addt').click(); expect(days(a)[2].querySelector('.bx')).toBeNull();
    a.q('#fDays .dr.dx .bx').click(); expect(a.q('#fDays .dr.dx')).toBeNull(); save(a); expect(slots(a)).toHaveLength(3);
  });
  it('an event with two times on one day opens with both lines, in time order', () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(0, 840, 900), slot(0, 540, 600)] })] })); a.ev('openDlg(state.S.events[0])');
    expect(times(days(a)[0])).toEqual(['540', '600']); expect(times(a.q('#fDays .dr.dx'))).toEqual(['840', '900']); expect(lines(a)[1].classList.contains('dx')).toBe(true);
  });
  it('a time added late at night starts with the day\'s last time instead of after it', () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(0, 1380, 1440)] })] })); a.ev('openDlg(state.S.events[0])'); days(a)[0].querySelector('.addt').click();
    expect(times(a.q('#fDays .dr.dx'))).toEqual(['1380', '1440']);
  });
  it('unticking a day greys out all its lines and drops them on save; ticking it again brings its further times back', () => {
    const a = dlg(); days(a)[4].querySelector('.addt').click(); const cb = days(a)[4].querySelector('input'); cb.checked = false; cb.onchange();
    const x = a.q('#fDays .dr.dx'); expect(x.classList.contains('off')).toBe(true); expect(x.querySelector('select').disabled).toBe(true);
    cb.checked = true; cb.onchange(); expect(a.q('#fDays .dr.dx').classList.contains('off')).toBe(false); cb.checked = false; cb.onchange();
    save(a); expect(slots(a).map(s => s.day)).toEqual([0, 2]);
  });
  it('the copy button of a day makes every other ticked day like it, adding or removing their further times', () => {
    const a = dlg(); days(a)[0].querySelector('.addt').click(); days(a)[2].querySelector('.addt').click(); days(a)[2].querySelector('.addt').click();
    const x = a.q('#fDays .dr.dx').querySelectorAll('select'); x[0].value = '900'; x[0].onchange(); x[1].value = '960'; x[1].onchange();   // Monday 10:00–11:00 and 15:00–16:00
    days(a)[0].querySelector('.cpy').click(); a.q('.cmenu .oi').click(); expect(a.qa('#fDays .dr.dx')).toHaveLength(3); save(a);
    expect(slots(a).map(s => [s.day, s.start, s.end])).toEqual([[0, 600, 660], [0, 900, 960], [2, 600, 660], [2, 900, 960], [4, 600, 660], [4, 900, 960]]);
  });
  const setT = (a, d, s, e) => { const x = days(a)[d].querySelectorAll('select'); x[0].value = s; x[0].onchange(); x[1].value = e; x[1].onchange(); };
  const menu = a => a.qa('.cmenu .oi').map(b => [b.textContent, b.disabled]);
  it('the copy button opens a menu: all other ticked days, the ones below or the ones above, naming them; a direction with none is greyed out', () => {
    const a = dlg(); const cp = days(a)[2].querySelector('.cpy'); expect(cp.getAttribute('aria-haspopup')).toBe('menu'); cp.click();
    expect(a.q('.cmenu .oh').textContent).toBe('Wednesday: copy to'); expect(a.q('.cmenu').closest('dialog')).toBe(a.q('#dlg'));
    expect(menu(a)).toEqual([['All other days (Mon, Fri)', false], ['The days below (Fri)', false], ['The days above (Mon)', false]]);
    expect(a.d.activeElement).toBe(a.q('.cmenu .oi'));
    a.q('.cmenu').dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); expect(a.q('.cmenu')).toBeNull(); expect(a.d.activeElement).toBe(cp);
    days(a)[0].querySelector('.cpy').click(); expect(menu(a)).toEqual([['All other days (Wed, Fri)', false], ['The days below (Wed, Fri)', false], ['The days above (none ticked)', true]]);
  });
  it('copying to the days below changes only the ticked days after this one; to the days above only those before it', () => {
    let a = dlg(); setT(a, 2, '900', '960'); days(a)[2].querySelector('.cpy').click(); a.qa('.cmenu .oi')[1].click();
    expect(a.toast()).toBe('Copied to Friday'); expect([0, 2, 4].map(d => times(days(a)[d]))).toEqual([['600', '660'], ['900', '960'], ['900', '960']]);
    a = dlg(); setT(a, 2, '900', '960'); days(a)[2].querySelector('.cpy').click(); a.qa('.cmenu .oi')[2].click();
    expect(a.toast()).toBe('Copied to Monday'); expect([0, 2, 4].map(d => times(days(a)[d]))).toEqual([['900', '960'], ['900', '960'], ['600', '660']]);
    save(a); expect(slots(a).map(s => [s.day, s.start])).toEqual([[0, 900], [2, 900], [4, 600]]);
  });
  it('the copy menu and its message are translated', () => {
    const a = dlg(); a.ev("setLang('es')"); days(a)[2].querySelector('.cpy').click();
    expect(a.q('.cmenu .oh').textContent).toBe('Miércoles: copiar a'); expect(menu(a).map(x => x[0])).toEqual(['Todos los demás días (Lun, Vie)', 'Los días de abajo (Vie)', 'Los días de arriba (Lun)']);
    a.qa('.cmenu .oi')[1].click(); expect(a.toast()).toBe('Copiado a: Viernes');
  });
  const addOn = (a, d, w) => { a.q('#fAddT').click(); if (w) a.qa('.addm .addw button')[w - 1].click(); a.qa('.addm .addd .oi')[d].click(); };
  const open = a => a.qa('#fDays .dr.open');
  it('on a phone "+ Add a time" asks for a day: an unticked day gets its first time, a ticked one another time, and that card opens', () => {
    const a = dlg(); a.q('#fAddT').click(); expect(a.q('.addm .oh').textContent).toBe('Add a time on'); expect(a.qa('.addm .addd .oi').map(b => b.textContent)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    expect(a.q('.addm .addw')).toBeNull(); a.qa('.addm .addd .oi')[1].click(); expect(a.q('.addm')).toBeNull();
    expect(days(a)[1].classList.contains('off')).toBe(false); expect(times(days(a)[1])).toEqual(['600', '660']); expect(open(a)).toEqual([days(a)[1]]);
    addOn(a, 1); const x = a.q('#fDays .dr.dx'); expect(times(x)).toEqual(['660', '720']); expect(open(a)).toEqual([x]); expect(x.querySelector('.sum').getAttribute('aria-expanded')).toBe('true');
    save(a); expect(slots(a).map(s => [s.day, s.start])).toEqual([[0, 600], [1, 600], [1, 660], [2, 600], [4, 600]]);
  });
  it('on a phone ✕ removes any time: a day\'s next time moves up, and removing its only time unticks the day', () => {
    const a = dlg(); addOn(a, 0); const x = a.q('#fDays .dr.dx').querySelectorAll('select'); x[0].value = '900'; x[0].onchange(); x[1].value = '960'; x[1].onchange();
    expect(days(a)[0].querySelector('.rx').getAttribute('aria-label')).toBe('Remove this time'); days(a)[0].querySelector('.rx').click();
    expect(a.qa('#fDays .dr.dx')).toHaveLength(0); expect(times(days(a)[0])).toEqual(['900', '960']); expect(days(a)[0].classList.contains('off')).toBe(false);
    days(a)[2].querySelector('.rx').click(); expect(days(a)[2].classList.contains('off')).toBe(true);
    save(a); expect(slots(a).map(s => [s.day, s.start])).toEqual([[0, 900], [4, 600]]);
  });
  it('the cards fold to a header with their title and a summary; a tap opens one card at a time', () => {
    const a = dlg(); expect(open(a)).toHaveLength(0); const sum = d => days(a)[d].querySelector('.sum');
    expect(sum(0).querySelector('.dn').textContent).toBe('Monday'); expect(sum(0).querySelector('.sm').textContent).toBe('10:00–11:00 · Nobody (concerns everyone)');
    sum(2).click(); expect(open(a)).toEqual([days(a)[2]]); expect(sum(2).getAttribute('aria-expanded')).toBe('true'); sum(4).click(); expect(open(a)).toEqual([days(a)[4]]); expect(sum(2).getAttribute('aria-expanded')).toBe('false');
    sum(4).click(); expect(open(a)).toHaveLength(0);
    const tsel = days(a)[0].querySelector('.tsel'); tsel.value = 'flex'; tsel.onchange(); expect(sum(0).querySelector('.sm').textContent).toBe('10:00–11:00 · Nobody (concerns everyone) · Around these times');
    const css = a.d.querySelector('style').textContent; expect(css).toContain('.dr:not(.open)>:not(.dcell):not(.dl):not(.wcell)'); expect(css).toContain('.cl,.sum,.rx,.wkw,#fAddT,.wcell,.dhd>.wkh{display:none}');
  });
  it('opening the dialog opens the clicked repetition\'s card, or the only card', () => {
    const a = dlg(); a.ev('document.getElementById("dlg").close();openDlg(state.S.events[0],null,state.S.events[0].slots[1])'); expect(open(a)).toEqual([days(a)[2]]);
    const b = fresh(blank({ events: [ev1()] })); b.ev('openDlg(state.S.events[0])'); expect(b.qa('#fDays .dr.open')).toHaveLength(1);
  });
  it('each line has the labels of its phone card, translated; days alternate in bands that their further times share', () => {
    const a = dlg(); days(a)[2].querySelector('.addt').click();
    expect([...days(a)[0].querySelectorAll('.cl')].map(x => x.textContent)).toEqual(['Start', 'End', 'Performed by', 'With', 'Colour', 'Timing']);
    expect(a.q('#fDays .dr.dx .dn').textContent).toBe('Wednesday, time 2');
    expect(days(a).map(r => r.classList.contains('alt'))).toEqual([false, true, false, true, false, true, false]); expect(a.q('#fDays .dr.dx').classList.contains('alt')).toBe(false);
    a.ev("setLang('es')"); expect(days(a)[0].querySelector('.cl.lp').textContent).toBe('Lo hace'); expect(days(a)[0].querySelector('.dn').textContent).toBe('Lunes');
    expect(a.q('#fAddT').textContent).toBe('+ Añadir una hora'); a.q('#fAddT').click(); expect(a.qa('.addm .addd .oi')[0].textContent).toBe('Lunes');
  });
  it('end times at or before the start are disabled in the end list', () => {
    const a = fresh(blank()); a.toolbar('add').click(); const end = a.qa('#fDays .dr')[0].querySelectorAll('select')[1]; const disabled = [...end.options].filter(o => o.disabled).map(o => +o.value);
    expect(Math.max(...disabled)).toBe(540); expect(disabled.every(v => v <= 540)).toBe(true);
  });
});

describe('R-REP-03 The end-time list reaches the end of the next day', () => {
  it('lists 192 end times, from 00:15 to 00:00 (Next day), with a plain 00:00 for the midnight closing the start day', () => {
    const a = fresh(blank()); a.toolbar('add').click(); const opts = [...a.qa('#fDays .dr')[0].querySelectorAll('select')[1].options];
    expect(opts.length).toBe(192); expect(opts[0].textContent).toBe('00:15'); expect(opts.at(-1).textContent).toBe('00:00 (Next day)'); expect(opts.at(-1).value).toBe('2880');
    expect(opts.find(o => o.value === '1440').textContent).toBe('00:00');
  });
  it('R-REP-04 the end picked in the list reads the same on the saved box: 22:00–00:00 and 22:00–00:00 (Next day)', () => {
    for (const end of ['1440', '2880']) {
      const a = fresh(blank()); a.toolbar('add').click(); fillDialog(a, { title: 'Late', start: '1320', end }); const label = [...a.qa('#fDays .dr')[0].querySelectorAll('select')[1].options].find(o => o.value === end).textContent; save(a);
      a.ev('state.prefs.hours[state.curId]=[0,24];render()'); expect(a.q('.ev').textContent).toContain('22:00–' + label);
    }
  });
  it('an end of "01:30 (Next day)" saves an event that ends at minute 1530', () => {
    const a = fresh(blank()); a.toolbar('add').click(); fillDialog(a, { title: 'Night', start: '1320', end: '1530' }); save(a);
    expect(slots(a)[0]).toMatchObject({ start: 1320, end: 1530 });
  });
  it('phases (which stay inside a day) only offer end times up to 00:00', () => {
    const a = fresh({ ...blank(), rhythms: [{ id: 'r', name: 'R', visible: true }] }); a.ev("state.editMode='phases';openDlg(null)");
    const opts = [...a.qa('#fDays .dr')[0].querySelectorAll('select')[1].options]; expect(opts.at(-1).textContent).toBe('00:00'); expect(opts).toHaveLength(96);
  });
});

describe('R-REP-05 Overlapping repetitions are allowed but warned about', () => {
  it('in the dialog an overnight repetition that runs into the next day\'s repetition shows ⚠ on both rows and a summary line', () => {
    const a = fresh(blank()); a.toolbar('add').click(); fillDialog(a, { title: 'T', days: { 0: { start: '1320', end: '1530' }, 1: { start: '30', end: '120' } } });
    expect(rows(a).slice(0, 2).map(r => r.querySelector('.wn').style.visibility)).toEqual(['visible', 'visible']);
    expect(a.q('#fWarn').textContent).toBe('⚠ Some repetitions overlap: Monday, Tuesday');
  });
  it('rows that do not overlap show no warning and the summary line is empty', () => {
    const a = fresh(blank()); a.toolbar('add').click(); fillDialog(a, { days: { 0: {}, 1: {} } });
    expect(a.q('#fWarn').textContent).toBe(''); expect(rows(a).every(r => r.querySelector('.wn').style.visibility !== 'visible')).toBe(true);
  });
  it('two overlapping times on the same day are both flagged', () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(0, 600, 720), slot(0, 660, 780)] })] })); a.ev('openDlg(state.S.events[0])');
    expect(a.qa('#fDays .dr').slice(0, 2).map(r => r.querySelector('.wn').style.visibility)).toEqual(['visible', 'visible']); expect(a.q('#fWarn').textContent).toContain('Monday');
  });
  it('overlapping times performed by people who share nobody are not flagged; making them share a person flags both at once', () => {
    const a = fresh(blank({ people, events: [ev1({ slots: [slot(0, 600, 720, 'A'), slot(0, 660, 780, 'B')] })] })); a.ev('openDlg(state.S.events[0])');
    const wn = () => rows(a).slice(0, 2).map(r => r.querySelector('.wn').style.visibility);
    expect(wn()).toEqual(['hidden', 'hidden']); expect(a.q('#fWarn').textContent).toBe('');
    const ps = rows(a)[1].querySelectorAll('select')[2]; ps.value = 'A'; ps.dispatchEvent(new a.w.Event('change'));
    expect(wn()).toEqual(['visible', 'visible']); expect(a.q('#fWarn').textContent).toContain('Monday');
  });
  it('the dialog warning follows the default With list and "only on call"', () => {
    const a = fresh(blank({ people, events: [ev1({ slots: [slot(0, 600, 720, 'A'), slot(0, 660, 780, 'B')] })] })); a.ev('openDlg(state.S.events[0])');
    const chip = a.q('#fInv input[value="A"]'); chip.checked = true; a.q('#fInv').dispatchEvent(new a.w.Event('change', { bubbles: true }));
    expect(a.q('#fWarn').textContent).toContain('Monday');   // Ann performs one and is involved in the other
    const oc = a.q('#fOnCall'); oc.checked = true; oc.dispatchEvent(new a.w.Event('change')); expect(a.q('#fWarn').textContent).toBe('');
  });
  it('a drag that makes repetitions of different people overlap gives no warning toast', async () => {
    const a = fresh(blank({ people, events: [ev1({ slots: [slot(0, 600, 660, 'A'), slot(0, 780, 840, 'B')] })] }));
    const box = a.qa('.day[data-d="0"] .ev')[1]; await dragFrom(a, box, { col: 0, min: 790 }, { col: 0, min: 640 }, { shift: true });
    expect(slots(a)[1].start).toBe(630); expect(a.toast()).not.toContain('overlap');
  });
  it('an event with overlapping repetitions can still be saved', () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(0, 600, 720), slot(0, 660, 780)] })] })); a.ev('openDlg(state.S.events[0])'); save(a);
    expect(dlgOpen(a)).toBe(false); expect(slots(a)).toHaveLength(2);
  });
  it('dragging a repetition so that it newly overlaps another one shows a warning toast with Undo', async () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(5, 1320, 1440), slot(6, 30, 90)] })] }));
    const box = a.q('.day[data-d="5"] .ev'); await dragFrom(a, box, { col: 5, min: 1435 }, { col: 6, min: 420 }, { target: box._rz });
    expect(slots(a)[0].end).toBe(1860); expect(a.toast()).toContain('⚠ Some repetitions now overlap'); expect(toastButtons(a)).toContain('Undo');
  });
});

describe('R-REP-06 R-EVT-15 Dragging a core edge of a repeating flexible event changes that margin on every repetition that has it', () => {
  const flex = (fs = [30, 30, 30]) => fresh(blank({ events: [ev1({ slots: [0, 2, 4].map((d, k) => ({ ...slot(d, 540, 1020), ...(fs[k] ? { fs: fs[k] } : {}), fe: 15 })) })] }));
  const top = a => a.q('.day[data-d="0"] .ev');
  const drag = (a, to = 600, o = {}) => dragFrom(a, top(a), { col: 0, min: 570 }, { col: 0, min: to }, { target: top(a)._cs, ...o });
  it('every repetition\'s latest start moves by the same minutes, and the outer times stay', async () => {
    const a = flex(); await drag(a); expect(slots(a).map(s => [s.start, s.end, s.fs, s.fe])).toEqual([[540, 1020, 60, 15], [540, 1020, 60, 15], [540, 1020, 60, 15]]);
  });
  it('repetitions with a different margin change by the same amount, and one without that margin is left alone', async () => {
    const a = flex([30, 60, 0]); await drag(a, 615); expect(slots(a).map(s => s.fs)).toEqual([75, 105, undefined]);
  });
  it('removing the dragged margin removes it on repetitions where the same shift reaches zero, and keeps longer ones', async () => {
    const a = flex([30, 60, 30]); await drag(a, 520); expect(slots(a).map(s => s.fs)).toEqual([undefined, 30, undefined]);
  });
  it('with Shift only the grabbed repetition changes and no toast appears', async () => {
    const a = flex(); await drag(a, 600, { shift: true }); expect(slots(a).map(s => s.fs)).toEqual([60, 30, 30]); expect(toastButtons(a)).toEqual([]);
  });
  it('after an all-repetitions edge drag the toast offers "Only this day" and "Undo"', async () => {
    const a = flex(); await drag(a); expect(a.toast()).toContain('Applied to all 3 repetitions'); expect(toastButtons(a)).toEqual(['Only this day', 'Undo']);
  });
  it('"Only this day" keeps the new margin on the grabbed repetition and puts the others back', async () => {
    const a = flex(); await drag(a); toastBtn(a, 'Only this day').click(); expect(slots(a).map(s => s.fs)).toEqual([60, 30, 30]);
  });
  it('"Undo" in the toast puts every margin back', async () => {
    const a = flex(); await drag(a); toastBtn(a, 'Undo').click(); expect(slots(a).map(s => s.fs)).toEqual([30, 30, 30]);
  });
  it('a smaller core that now overlaps another repetition is reported with the overlap warning', async () => {
    const a = fresh(blank({ events: [ev1({ slots: [{ ...slot(0, 540, 720), fe: 60 }, slot(0, 690, 780)] })] }));
    const b = a.q('.day[data-d="0"] .ev'); expect(a.ev('overlapSet(state.S.events[0]).size')).toBe(0);
    await dragFrom(a, b, { col: 0, min: 659 }, { col: 0, min: 705 }, { target: b._ce, shift: true }); expect(slots(a)[0].fe).toBe(15); expect(a.toast()).toContain('⚠');
  });
});

describe('R-REP-06 Dragging a repeating event changes all repetitions; Shift changes one', () => {
  it('moving one repetition moves every repetition by the same number of days and minutes', async () => {
    const a = three(); await dragFrom(a, a.q('.day[data-d="0"] .ev'), { col: 0, min: 630 }, { col: 1, min: 690 });
    expect(slots(a).map(s => [s.day, s.start, s.end])).toEqual([[1, 660, 720], [3, 660, 720], [5, 660, 720]]);
  });
  it('the other repetitions already follow while the mouse is still moving (live preview)', async () => {
    const a = three(); const box = a.q('.day[data-d="0"] .ev'); const w = a.w;
    box.onpointerdown({ clientX: a.x(0), clientY: a.y(630), button: 0, target: box, pointerType: 'mouse', stopPropagation() {}, preventDefault() {} });
    const move = new w.MouseEvent('pointermove', { clientX: a.x(0), clientY: a.y(750), bubbles: true }); Object.defineProperty(move, 'pointerType', { value: 'mouse' }); a.d.dispatchEvent(move);
    expect(slots(a).map(s => s.start)).toEqual([720, 720, 720]);
    const up = new w.MouseEvent('pointerup', { clientX: a.x(0), clientY: a.y(750), bubbles: true }); Object.defineProperty(up, 'pointerType', { value: 'mouse' }); a.d.dispatchEvent(up);
  });
  it('holding Shift changes only the grabbed repetition', async () => {
    const a = three(); await dragFrom(a, a.q('.day[data-d="0"] .ev'), { col: 0, min: 630 }, { col: 0, min: 750 }, { shift: true });
    expect(slots(a).map(s => s.start)).toEqual([720, 600, 600]);
  });
  it('Shift can also be pressed in the middle of the drag', async () => {
    const a = three(); const box = a.q('.day[data-d="0"] .ev');
    box.onpointerdown({ clientX: a.x(0), clientY: a.y(630), button: 0, target: box, pointerType: 'mouse', shiftKey: false, stopPropagation() {}, preventDefault() {} });
    for (const type of ['pointermove', 'pointerup']) { const e = new a.w.MouseEvent(type, { clientX: a.x(0), clientY: a.y(750), shiftKey: true, bubbles: true }); Object.defineProperty(e, 'pointerType', { value: 'mouse' }); a.d.dispatchEvent(e); }
    expect(slots(a).map(s => s.start)).toEqual([720, 600, 600]);
  });
  it('after an all-repetitions drop a toast offers "Only this day" and "Undo"', async () => {
    const a = three(); await dragFrom(a, a.q('.day[data-d="0"] .ev'), { col: 0, min: 630 }, { col: 0, min: 750 });
    expect(a.toast()).toContain('Applied to all 3 repetitions'); expect(toastButtons(a)).toEqual(['Only this day', 'Undo']);
  });
  it('"Only this day" keeps the change for the grabbed repetition and puts the others back', async () => {
    const a = three(); await dragFrom(a, a.q('.day[data-d="0"] .ev'), { col: 0, min: 630 }, { col: 0, min: 750 }); toastBtn(a, 'Only this day').click();
    expect(slots(a).map(s => s.start)).toEqual([720, 600, 600]);
  });
  it('"Undo" in the toast restores all repetitions', async () => {
    const a = three(); await dragFrom(a, a.q('.day[data-d="0"] .ev'), { col: 0, min: 630 }, { col: 0, min: 750 }); toastBtn(a, 'Undo').click();
    expect(slots(a).map(s => s.start)).toEqual([600, 600, 600]);
  });
  it('the toast buttons do nothing once something else has changed in between', async () => {
    const a = three(); await dragFrom(a, a.q('.day[data-d="0"] .ev'), { col: 0, min: 630 }, { col: 0, min: 750 });
    a.ev('hist();state.S.events[0].title="Renamed"'); toastBtn(a, 'Only this day').click(); toastBtn(a, 'Undo').click();
    expect(slots(a).map(s => s.start)).toEqual([720, 720, 720]); expect(a.ev('state.S.events[0].title')).toBe('Renamed');
  });
  it('resizing one repetition lengthens or shortens all of them by the same amount', async () => {
    const a = three(); const box = a.q('.day[data-d="0"] .ev'); await dragFrom(a, box, { col: 0, min: 655 }, { col: 0, min: 690 }, { target: box._rz });
    expect(slots(a).map(s => s.end - s.start)).toEqual([90, 90, 90]);
  });
  it('resizing never removes a repetition: every one keeps at least 15 minutes', async () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(0, 600, 720), slot(1, 600, 630), slot(2, 600, 660)] })] }));
    const box = a.q('.day[data-d="0"] .ev'); await dragFrom(a, box, { col: 0, min: 715 }, { col: 0, min: 612 }, { target: box._rz });
    expect(slots(a)).toHaveLength(3); expect(slots(a).every(s => s.end - s.start >= 15)).toBe(true); expect(slots(a)[1].end - slots(a)[1].start).toBe(15);
  });
  it('when the whole set is moved a Sunday repetition wraps to Monday', async () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(3), slot(6)] })] })); await dragFrom(a, a.q('.day[data-d="3"] .ev'), { col: 3, min: 630 }, { col: 4, min: 630 });
    expect(slots(a).map(s => s.day)).toEqual([4, 0]);
  });
  it('dragging the bottom handle into the next day\'s column extends the event past midnight', async () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(5, 1320, 1440)] })] })); const box = a.q('.day[data-d="5"] .ev');
    await dragFrom(a, box, { col: 5, min: 1435 }, { col: 6, min: 120 }, { target: box._rz });
    expect(slots(a)[0].end).toBe(1560);
  });
  it('a single-day quick event moves freely; a quick event will not let one repetition land on a day that already has one', async () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(0), slot(1)] })] })); await dragFrom(a, a.q('.day[data-d="0"] .ev'), { col: 0, min: 630 }, { col: 1, min: 750 }, { shift: true });
    expect(slots(a)[0].day).toBe(0); expect(slots(a)[0].start).toBe(720);
  });
  it('an event that already has two times on a day may place a repetition on a day that has one', async () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(0, 540, 600), slot(0, 840, 900), slot(1)] })] }));
    await dragFrom(a, a.q('.day[data-d="0"] .ev'), { col: 0, min: 570 }, { col: 1, min: 750 }, { shift: true });
    expect(slots(a).filter(s => s.day === 1)).toHaveLength(2);
  });
  it('each repetition stays within the day when everything is moved late: starts are capped at 23:45', async () => {
    const a = fresh(blank({ events: [ev1({ slots: [slot(0, 600, 660), slot(1, 960, 1020)] })] })); await dragFrom(a, a.q('.day[data-d="0"] .ev'), { col: 0, min: 630 }, { col: 0, min: 1435 });
    expect(slots(a).every(s => s.start <= 1425)).toBe(true);
  });
});

describe('R-REP-07 Dragging repeating events never asks for confirmation', () => {
  it('no dialog opens and no confirm box appears while moving or resizing repetitions', async () => {
    const a = three(); await dragFrom(a, a.q('.day[data-d="0"] .ev'), { col: 0, min: 630 }, { col: 1, min: 750 });
    const box = a.q('.day[data-d="1"] .ev'); await dragFrom(a, box, { col: 1, min: 790 }, { col: 1, min: 820 }, { target: box._rz });
    expect(a.dlgOpen()).toBe(false); expect(a.log.confirms).toEqual([]); expect(a.log.alerts).toEqual([]);
  });
});
