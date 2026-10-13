import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, ev1, dragFrom, createDrag, fillDialog, dlgOpen } from '../helpers/app.js';

const fresh = (data, o = {}) => { const a = openApp(o); if (data) setData(a, data); return a; };
const rhythm = (o = {}) => ({ id: 'r1', name: 'Normal', visible: true, ...o });
const phase = (o = {}) => ({ id: 'p1', title: 'Lunch', desc: '', color: '#3b6df0', rhythms: ['r1'], slots: [{ day: 0, start: 720, end: 780 }], ...o });
const days = (list, start, end) => list.map(day => ({ day, start, end }));
const data = (o = {}) => blank({ rhythms: [rhythm()], phases: [phase({ slots: days([0, 1, 2, 3, 4], 720, 780) })], ...o });
const lane = (a, d) => a.q(`.dw[data-d="${d}"] .lane`);
const lips = (a, d) => [...lane(a, d).querySelectorAll('.lip')];
const bands = (a, d) => [...lane(a, d).querySelectorAll('.lbg')];
const sections = a => a.qa('#sbin .sec');
const phaseList = a => a.ev('JSON.parse(JSON.stringify(S.phases))');
const modeBtn = (a, label) => a.qa('.seg button').find(b => b.textContent === label);

describe('R-PHS-01 Rhythms and phases in the interface', () => {
  it('the sidebar has a Rhythms section and an Events | Phases switch', () => {
    const a = fresh(data()); expect(a.qa('.seg button').map(b => b.textContent)).toEqual(['Events', 'Phases']);
    expect(sections(a)[3].querySelector('.shbtn span').textContent).toBe('Rhythms');
  });
  it('in Spanish they are called Ritmos and Franjas', () => {
    const a = openApp({ languages: ['es'] }); expect(a.qa('.seg button').map(b => b.textContent)).toEqual(['Eventos', 'Franjas']); expect(sections(a)[3].querySelector('.shbtn span').textContent).toBe('Ritmos');
  });
  it('a rhythm has a name; a phase belongs to one or more rhythms (stored as ids)', () => {
    const a = fresh(data({ rhythms: [rhythm(), rhythm({ id: 'r2', name: 'Holiday', visible: false })], phases: [phase({ rhythms: ['r1', 'r2'] })] })); expect(phaseList(a)[0].rhythms).toEqual(['r1', 'r2']);
  });
});

describe('R-PHS-02 One rhythm shown at a time and one opacity control for all', () => {
  it('there is a single opacity slider under the rhythm list, for all rhythms together', () => {
    const a = fresh(data({ rhythms: [rhythm(), rhythm({ id: 'r2', name: 'Holiday', visible: false })] })); expect(sections(a)[3].querySelectorAll('input[type=range]')).toHaveLength(1);
  });
  it('moving the slider fades every phase background but not the lips', () => {
    const a = fresh(data()); const slider = sections(a)[3].querySelector('input[type=range]'); slider.value = 0.6; slider.oninput();
    expect(a.ev('S.phaseOpacity')).toBe(0.6); a.qa('.phbg').forEach(b => expect(b.style.opacity).toBe('0.6')); lips(a, 0).forEach(l => expect(l.style.opacity).toBe(''));
  });
  it('the slider runs from 5 % to 100 %', () => {
    const s = sections(fresh(data()))[3].querySelector('input[type=range]'); expect([s.min, s.max]).toEqual(['0.05', '1']);
  });
  it('the rhythm opacity and visibility are view state (no undo step)', () => {
    const a = fresh(data()); const depth = a.ev('undoSt.length'); const s = sections(a)[3].querySelector('input[type=range]'); s.value = 0.5; s.oninput(); sections(a)[3].querySelector('.sch .eye').click(); expect(a.ev('undoSt.length')).toBe(depth);
  });
  it('a hidden rhythm draws nothing and removes the label lane', () => {
    const a = fresh(data()); sections(a)[3].querySelector('.sch .eye').click(); expect(a.qa('.phx, .lip, .lbg')).toHaveLength(0); expect(a.q('#grid').style.getPropertyValue('--lane')).toBe('0px');
  });
});

describe('R-PHS-03 Phase fields and the phase dialog', () => {
  const open = (extra = {}) => { const a = fresh(data(extra)); a.ev("editMode='phases';render()"); return a; };
  it('the dialog has no person fields; it lists rhythms instead of schedules', () => {
    const a = open(); a.ev('openDlg(null)');
    expect(a.q('#dlg').classList.contains('ph')).toBe(true); expect(a.qa('#dlg .ev-only').length).toBeGreaterThan(3); expect(a.d.querySelector('style').textContent).toContain('#dlg.ph .ev-only{display:none!important}');
    const labels = a.qa('#dlg label').map(l => l.textContent); expect(labels.some(t => /Rhythms \* \(at least one\)/.test(t))).toBe(true); expect(a.qa('#fSch label')[0].textContent).toBe('Normal');
  });
  it('a name is required and at least one rhythm must be ticked', () => {
    const a = open(); a.ev('openDlg(null)'); a.q('#fOk').click(); expect(a.q('#err').textContent).toBe('Title is required.');
    a.q('#fT').value = 'Nap'; a.qa('#fSch input').forEach(i => { i.checked = false; }); a.q('#fOk').click(); expect(a.q('#err').textContent).toBe('Pick at least one rhythm.');
  });
  it('saving creates a phase with name, optional description, colour, rhythms and repetitions but no people', () => {
    const a = open(); a.ev('openDlg(null)'); fillDialog(a, { title: 'Nap', desc: 'after lunch', days: { 0: { start: '780', end: '840' }, 1: { start: '780', end: '840' } } }); a.q('#fOk').click();
    const p = phaseList(a).at(-1); expect(p).toMatchObject({ title: 'Nap', desc: 'after lunch', rhythms: ['r1'] }); expect(p.slots).toEqual([{ day: 0, start: 780, end: 840 }, { day: 1, start: 780, end: 840 }]); expect(JSON.stringify(p)).not.toContain('person');
  });
  it('a phase can belong to several rhythms', () => {
    const a = open({ rhythms: [rhythm(), rhythm({ id: 'r2', name: 'Holiday', visible: false })] }); a.ev('openDlg(null)'); fillDialog(a, { title: 'Both', schedules: ['r1', 'r2'] }); a.q('#fOk').click();
    expect(phaseList(a).at(-1).rhythms).toEqual(['r1', 'r2']);
  });
  it('phases support the same Quick and Advanced repetition modes (several blocks per day)', () => {
    const a = open(); a.ev('openDlg(P)'.replace('P', 'S.phases[0]')); a.q('#tabA').click(); a.q('#fAddBlock').click(); expect(a.q('#tabQ').disabled).toBe(true); a.q('#fOk').click();
    expect(phaseList(a)[0].slots.filter(s => s.day === 4)).toHaveLength(2);
  });
  it('a phase never runs past the end of its day', () => {
    const a = open(); a.ev('openDlg(null)'); expect(Math.max(...[...a.q('#fE').options].map(o => +o.value))).toBe(1440);
  });
  it('a phase can be deleted from its dialog and copied to another rhythm of this workspace', () => {
    const a = open({ rhythms: [rhythm(), rhythm({ id: 'r2', name: 'Holiday', visible: false })] }); a.ev('openDlg(S.phases[0])'); a.q('#fCopy').click();
    expect([...a.q('#xDlg select').options].map(o => o.textContent)).toEqual(['Normal', 'Holiday']); a.click('Copy');
    expect(phaseList(a)).toHaveLength(2); expect(phaseList(a)[1].rhythms).toEqual(['r2']);
    a.ev('openDlg(S.phases[0])'); a.q('#fDel').click(); expect(phaseList(a)).toHaveLength(1);
  });
  it('individual phases cannot be copied or moved to another workspace (only whole rhythms can)', () => {
    const a = open(); a.ev("addWorkspace();switchWs(WS[0].id);editMode='phases';render();openCopy(S.phases[0])");
    expect(a.qa('#xDlg select')).toHaveLength(1); expect(a.dlgText()).not.toMatch(/Workspace|Move/); expect(a.q('#xDlg label').textContent).toBe('Destination rhythm');
  });
  it('without any rhythm a new phase cannot be created and the user is told what to do', () => {
    const a = fresh(blank()); a.ev("editMode='phases';render()"); a.toolbar('add').click(); expect(dlgOpen(a)).toBe(false); expect(a.toast()).toContain('Create a rhythm first');
  });
});

describe('R-PHS-04 Lips: the label tab left of each day column', () => {
  it('lips sit in a lane outside and to the left of the day column, never inside it', () => {
    const a = fresh(data()); expect(a.qa('.dw > .lane')).toHaveLength(7); expect(a.qa('.day .lip')).toHaveLength(0); expect(lips(a, 0)).toHaveLength(1);
    const kids = [...a.q('.dw[data-d="0"]').children].map(c => c.className.split(' ')[0]); expect(kids).toEqual(['lane', 'day']);
  });
  it('the lip fills the lane up to the column border (flush) and has the phase name as vertical text', () => {
    const a = fresh(data()); const rule = [...a.d.styleSheets[0].cssRules].find(r => r.selectorText === '.lip').style; expect(rule.getPropertyValue('left')).toBe('0'); expect(rule.getPropertyValue('right')).toBe('0');
    expect(lips(a, 0)[0].textContent).toBe('Lunch'); expect(a.d.querySelector('style').textContent).toContain('writing-mode:vertical-rl');
  });
  it('a lip is positioned exactly on the time range of its phase', () => {
    const l = lips(fresh(data()), 0)[0]; expect(l.style.top).toBe(`${(720 - 300) / 60 * 48}px`); expect(parseFloat(l.style.height)).toBeCloseTo(48, 0);
  });
  it('identical repetitions on adjacent days share one lip, on the first day of the group', () => {
    const a = fresh(data()); expect([0, 1, 2, 3, 4, 5, 6].map(d => lips(a, d).length)).toEqual([1, 0, 0, 0, 0, 0, 0]);
  });
  it('where no lip is drawn the lane shows the phase colour as a band with the rhythm opacity, so the colour stays continuous', () => {
    const a = fresh(data()); expect([0, 1, 2, 3, 4].map(d => bands(a, d).length)).toEqual([0, 1, 1, 1, 1]); expect(bands(a, 1)[0].style.opacity).toBe('0.3');
    a.ev('S.phaseOpacity=0.7;render()'); expect(bands(a, 2)[0].style.opacity).toBe('0.7');
  });
  it('a day with different times starts a new group with its own lip', () => {
    const a = fresh(data({ phases: [phase({ slots: [...days([0, 1], 720, 780), ...days([2, 3, 4], 750, 810)] })] }));
    expect([0, 1, 2, 3, 4].map(d => lips(a, d).length)).toEqual([1, 0, 1, 0, 0]);
  });
  it('the lip tooltip names the phase, the day range, the times and the description', () => {
    const a = fresh(data({ phases: [phase({ desc: 'Eat something', slots: days([0, 1, 2, 3, 4], 720, 780) })] })); expect(lips(a, 0)[0].title).toBe('Lunch\nMon–Fri 12:00–13:00\nEat something');
  });
  it('with the weekend hidden, Friday and Monday are not neighbours, so a group never wraps around', () => {
    const a = fresh(data({ phases: [phase({ slots: days([0, 4], 720, 780) })] })); a.ev('prefs.hideWeekend=true;render()');
    expect([0, 1, 2, 3, 4].map(d => lips(a, d).length)).toEqual([1, 0, 0, 0, 1]);
  });
  it('the lane exists (18 px) only while a rhythm is shown', () => {
    const a = fresh(data()); expect(a.q('#grid').style.getPropertyValue('--lane')).toBe('18px'); a.ev('S.rhythms[0].visible=false;render()'); expect(a.q('#grid').style.getPropertyValue('--lane')).toBe('0px');
  });
  it('lip text is dark on light colours and white on dark colours', () => {
    const a = fresh(data({ phases: [phase({ color: '#fafafa' })] })); expect(lips(a, 0)[0].style.color).toMatch(/#1d2330|rgb\(29, 35, 48\)/);
    a.ev('S.phases[0].color="#1d2330";render()'); expect(lips(a, 0)[0].style.color).toMatch(/#fff|rgb\(255, 255, 255\)/);
  });
});

describe('R-PHS-05 Phases are not "hidden events"', () => {
  it('a phase in the hidden early hours or on the hidden weekend never adds to the N hidden pill', () => {
    const a = fresh(data({ phases: [phase({ slots: [{ day: 5, start: 120, end: 240 }] })] })); a.ev('prefs.hideWeekend=true;render()'); expect(a.q('#hid').style.display).toBe('none');
  });
  it('a phase that starts before 05:00 is drawn from the top of the visible hours like any other box', () => {
    const a = fresh(data({ phases: [phase({ slots: [{ day: 0, start: 180, end: 360 }] })] })); expect(a.q('.dw[data-d="0"] .phx').style.top).toBe('0px');
  });
});

describe('R-PHS-06 Events | Phases edit mode', () => {
  const phasesMode = (extra = {}) => { const a = fresh(data({ events: [ev1()], ...extra })); modeBtn(a, 'Phases').click(); return a; };
  it('in Phases mode events are dimmed and cannot be grabbed, and the grid is marked as being in phase mode', () => {
    const a = phasesMode(); expect(a.q('#grid').classList.contains('phmode')).toBe(true); expect(a.q('.ev').onpointerdown).toBeFalsy(); expect(a.d.querySelector('style').textContent).toMatch(/\.phmode \.ev\{[^}]*opacity:\.35!important/);
  });
  it('phase boxes become interactive: dashed outline in their colour, a label and a resize handle', () => {
    const a = phasesMode(); const box = a.q('.dw[data-d="0"] .phx'); expect(box.onpointerdown).toBeTruthy(); expect(box.style.outline).toContain('dashed'); expect(box.querySelector('.pl').textContent).toBe('Lunch · 12:00–13:00'); expect(box._rz).not.toBeNull();
    expect(a.q('#wrap').classList.contains('phm')).toBe(true);
  });
  it('in Events mode phases are pure background: no handlers, no outline', () => {
    const a = fresh(data({ events: [ev1()] })); const box = a.q('.dw[data-d="0"] .phx'); expect(box.onpointerdown).toBeFalsy(); expect(box.style.outline).toBe(''); expect(a.q('.ev').onpointerdown).toBeTruthy();
  });
  it('switching to Phases mode shows the first rhythm if none is visible', () => {
    const a = fresh(data({ rhythms: [rhythm({ visible: false })] })); modeBtn(a, 'Phases').click(); expect(a.ev('S.rhythms[0].visible')).toBe(true);
  });
  it('the + button creates a phase (not an event) while in Phases mode', () => {
    const a = phasesMode(); a.toolbar('add').click(); expect(a.q('#dlg').classList.contains('ph')).toBe(true);
  });
  it('dragging on empty space creates a phase for that time range', async () => {
    const a = phasesMode(); await createDrag(a, { col: 5, min: 600 }, { col: 5, min: 690 }); expect(a.q('#dlg').classList.contains('ph')).toBe(true); expect([a.q('#fS').value, a.q('#fE').value]).toEqual(['600', '690']);
  });
  it('dragging a phase moves all its repetitions together; Shift moves only one; a toast offers Only this day / Undo', async () => {
    const a = phasesMode(); await dragFrom(a, a.q('.dw[data-d="0"] .phx'), { col: 0, min: 750 }, { col: 0, min: 810 });
    expect(phaseList(a)[0].slots.map(s => s.start)).toEqual([780, 780, 780, 780, 780]); expect([...a.q('#toast').querySelectorAll('button')].map(b => b.textContent)).toEqual(['Only this day', 'Undo']);
    const b = phasesMode(); await dragFrom(b, b.q('.dw[data-d="0"] .phx'), { col: 0, min: 750 }, { col: 0, min: 810 }, { shift: true }); expect(phaseList(b)[0].slots.map(s => s.start)).toEqual([780, 720, 720, 720, 720]);
  });
  it('resizing a phase handle changes every repetition by the same amount', async () => {
    const a = phasesMode(); const box = a.q('.dw[data-d="0"] .phx'); await dragFrom(a, box, { col: 0, min: 775 }, { col: 0, min: 805 }, { target: box._rz });
    expect(phaseList(a)[0].slots.map(s => s.end - s.start)).toEqual([90, 90, 90, 90, 90]);
  });
  it('the lip is a drag handle for the phase in Phases mode', async () => {
    const a = phasesMode(); expect(lips(a, 0)[0].onpointerdown).toBeTruthy();
    const b = fresh(data()); expect(lips(b, 0)[0].onpointerdown).toBeTruthy();   // handler exists but only acts in phase mode
  });
  it('right-clicking a phase in Phases mode offers to copy that phase', () => {
    const a = phasesMode({ rhythms: [rhythm(), rhythm({ id: 'r2', name: 'Holiday', visible: false })] });
    a.qa('.day')[0].oncontextmenu({ clientX: a.x(0), clientY: a.y(750), preventDefault() {} }); a.q('.omenu .oi').click(); expect(a.dlgTitle()).toContain('Copy event: Lunch'.replace('event', 'event')); 
  });
  it('editing phases never changes events and editing events never changes phases', async () => {
    const a = phasesMode(); const before = a.ev('JSON.stringify(S.events)'); await dragFrom(a, a.q('.dw[data-d="0"] .phx'), { col: 0, min: 750 }, { col: 0, min: 810 }); expect(a.ev('JSON.stringify(S.events)')).toBe(before);
    modeBtn(a, 'Events').click(); const phasesBefore = a.ev('JSON.stringify(S.phases)'); await dragFrom(a, a.q('.ev'), { col: 0, min: 630 }, { col: 0, min: 690 }); expect(a.ev('JSON.stringify(S.phases)')).toBe(phasesBefore);
  });
});

describe('R-PHS-07 Rhythm agenda', () => {
  const lunch = phase({ id: 'l', title: 'Lunch Time', desc: 'Eat something', slots: [...days([0, 1, 2, 3], 720, 780), ...days([4], 780, 840), ...days([5, 6], 720, 780)] });
  const agenda = (rows) => { const a = fresh(data({ phases: rows })); a.ev('openRhythmAgenda(S.rhythms[0])'); return a; };
  const lines = a => a.qa('#agBody .atl, #agBody .pg b, #agBody .pt').map(e => e.textContent);
  it('lists the days with identical times as runs, always from Monday and without wrapping from Sunday to Monday', () => {
    expect(lines(agenda([lunch]))).toEqual(['Lunch Time', 'Monday to Thursday', '12:00–13:00', 'Friday', '13:00–14:00', 'Saturday to Sunday', '12:00–13:00']);
  });
  it('shows the description under the phase name', () => { expect(agenda([lunch]).q('#agBody .ad').textContent).toBe('Eat something'); });
  it('Sunday and Monday with the same times are two separate groups (no wrap-around)', () => {
    expect(lines(agenda([phase({ title: 'Edge', slots: days([0, 6], 600, 660) })]))).toEqual(['Edge', 'Monday', '10:00–11:00', 'Sunday', '10:00–11:00']);
  });
  it('a phase with the same times every day is "Monday to Sunday"', () => {
    expect(lines(agenda([phase({ title: 'Always', slots: days([0, 1, 2, 3, 4, 5, 6], 0, 360) })]))[1]).toBe('Monday to Sunday');
  });
  it('phases are sorted by their earliest start time', () => {
    const a = agenda([phase({ id: 'b', title: 'Evening', slots: days([0], 1200, 1260) }), phase({ id: 'a', title: 'Morning', slots: days([0], 420, 480) })]);
    expect(a.qa('#agBody .atl').map(e => e.textContent)).toEqual(['Morning', 'Evening']);
  });
  it('several blocks on one day are listed under that day', () => {
    expect(lines(agenda([phase({ title: 'Work', slots: [{ day: 0, start: 495, end: 720 }, { day: 0, start: 780, end: 1005 }] })]))).toEqual(['Work', 'Monday', '08:15–12:00', '13:00–16:45']);
  });
  it('is opened with the agenda icon of the rhythm row and can be printed', () => {
    const a = fresh(data()); sections(a)[3].querySelector('.sch button[title*="Agenda"]').click(); expect(a.d.getElementById('agDlg').open).toBe(true);
    a.q('#agPrint').click(); expect(a.w.__printCount).toBe(1); expect(a.w.__printed).toContain('Lunch');
  });
  it('is shown in Spanish as "Lunes a Jueves"', () => {
    const a = openApp({ languages: ['es'] }); setData(a, data({ phases: [lunch] })); a.ev('openRhythmAgenda(S.rhythms[0])'); expect(a.qa('#agBody .pg b').map(e => e.textContent)).toEqual(['Lunes a Jueves', 'Viernes', 'Sábado a Domingo']);
  });
  it('shows "Nothing scheduled" for a rhythm without phases', () => {
    expect(agenda([]).q('#agBody').textContent).toContain('Nothing scheduled.');
  });
});

describe('R-PHS-08 The default first-run rhythm: seven parts of the day', () => {
  const a = openApp(); const byTitle = t => a.ev('JSON.parse(JSON.stringify(S.phases))').filter(p => p.title === t);
  it('a new installation has one visible rhythm called "Normal rhythm" with seven phases', () => {
    expect(a.ev('S.rhythms.map(r=>[r.name,r.visible])')).toEqual([['Normal rhythm', true]]); expect(a.ev('S.phases.length')).toBe(7);
  });
  it('the phases are Midnight, Early morning, Morning, Noon, Afternoon, Evening and Night, covering the whole day without gaps', () => {
    const ph = a.ev('JSON.parse(JSON.stringify(S.phases))').sort((x, y) => x.slots[0].start - y.slots[0].start);
    expect(ph.map(p => p.title)).toEqual(['Midnight', 'Early morning', 'Morning', 'Noon', 'Afternoon', 'Evening', 'Night']);
    expect(ph.map(p => [p.slots[0].start, p.slots[0].end])).toEqual([[0, 300], [300, 480], [480, 720], [720, 840], [840, 1080], [1080, 1260], [1260, 1440]]);
  });
  it('every phase has the same times on all seven days and no description', () => {
    a.ev('JSON.parse(JSON.stringify(S.phases))').forEach(p => { expect(p.slots.map(s => s.day)).toEqual([0, 1, 2, 3, 4, 5, 6]); expect(new Set(p.slots.map(s => s.start + '-' + s.end)).size).toBe(1); expect(p.desc).toBe(''); });
  });
  it('the old phases (Sleep time, Work/School time, Free time …) are gone', () => {
    ['Sleep time', 'Work/School time', 'Free time', 'Bed time'].forEach(t => expect(byTitle(t)).toHaveLength(0));
  });
  it('the phases are drawn at first start: lips on Monday only, since every day has the same times', () => {
    const lips = a.qa('.lip'); expect(lips.length).toBe(6);   // Midnight lies in the hidden early hours
    expect(lips.every(l => l.closest('.dw') === a.qa('.dw')[0])).toBe(true); expect(a.q('#grid').style.getPropertyValue('--lane')).toBe('18px');
  });
  it('all default phases belong to the rhythm and use valid colours', () => {
    const rid = a.ev('S.rhythms[0].id'); expect(a.ev('S.phases.every(p=>p.rhythms[0]===' + JSON.stringify(rid) + ')')).toBe(true); a.ev('S.phases.map(p=>p.color)').forEach(c => expect(c).toMatch(/^#[0-9a-f]{6}$/));
  });
  it('in Spanish the default phase names are Spanish (Madrugada … Noche)', () => {
    const es = openApp({ languages: ['es'] }); expect(new Set(es.ev('S.phases.map(p=>p.title)'))).toEqual(new Set(['Madrugada', 'Primera hora', 'Mañana', 'Mediodía', 'Tarde', 'Atardecer', 'Noche']));
  });
  it('Clear memory restarts with the same default rhythm', () => {
    const b = openApp(); b.ev('S.phases=[];S.rhythms=[];render()'); b.ev('clearMem()'); expect(b.ev('S.phases.length')).toBe(7);
  });
});

describe('R-PHS-06 Clicking a phase in Phases mode opens its edit dialog', () => {
  const people = [{ id: 'A', name: 'Ann', color: '#e5484d', visible: true }];
  for (const [what, extra] of [['without people', {}], ['when the workspace has people (phases have no involved list)', { people }]]) {
    it(`a plain click on a phase opens the edit dialog for that phase ${what}`, async () => {
      const a = fresh(data(extra)); modeBtn(a, 'Phases').click();
      await dragFrom(a, a.q('.dw[data-d="0"] .phx'), { col: 0, min: 750 }, { col: 0, min: 750 }, { move: false });
      expect(a.log.errors).toEqual([]); expect(dlgOpen(a)).toBe(true); expect(a.q('#fT').value).toBe('Lunch'); expect(a.q('#fDel').style.display).toBe('');
    });
  }
  it('a click on the phase label (lip) also opens the edit dialog when the workspace has people', async () => {
    const a = fresh(data({ people })); modeBtn(a, 'Phases').click();
    await dragFrom(a, lips(a, 0)[0], { col: 0, min: 750 }, { col: 0, min: 750 }, { move: false });
    expect(a.log.errors).toEqual([]); expect(dlgOpen(a)).toBe(true); expect(a.q('#fT').value).toBe('Lunch');
  });
  it('saving an edited phase in a workspace with people keeps it free of people fields', async () => {
    const a = fresh(data({ people })); modeBtn(a, 'Phases').click();
    await dragFrom(a, a.q('.dw[data-d="0"] .phx'), { col: 0, min: 750 }, { col: 0, min: 750 }, { move: false });
    a.q('#fT').value = 'Long lunch'; a.q('#fOk').click();
    const p = phaseList(a)[0]; expect(p.title).toBe('Long lunch'); expect(p.involved).toBeUndefined(); expect(p.slots.every(s => s.person === undefined)).toBe(true);
  });
});
