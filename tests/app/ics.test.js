// R-SHARE-09: Save… → Calendar file (export only): the dialog, its periods, what it includes and what this browser remembers.
import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, ev1, person, PREFS_KEY } from '../helpers/app.js';

const NOW = [2026, 9, 21, 10, 0];   // Wednesday 21 October 2026
const data = (o = {}) => blank({
  people: [person({ id: 'A', name: 'Ann' }), person({ id: 'B', name: 'Ben' })],
  events: [ev1({ id: 'a', title: 'Piano', desc: 'Room 4', slots: [{ day: 0, start: 1020, end: 1080, person: 'A' }] }), ev1({ id: 'b', title: 'Football', slots: [{ day: 1, start: 1020, end: 1080, person: 'B' }] })], ...o });
const fresh = (d = data(), o = {}) => { const a = openApp({ now: NOW, ...o }); setData(a, d); a.ev('cw().name="Family"'); return a; };
const open = async a => { a.chooseSave('Calendar file (export only)'); await a.sleep(5); };
const dates = a => a.qa('#xDlg input[type=date]');
const err = a => a.q('#xDlg .err').textContent;
const file = a => (a.w.__file || '').replace(/\r\n /g, '');
const prefsOf = a => JSON.parse(a.storage()[PREFS_KEY] || '{}');
const download = async (a, { from, until } = {}) => { await open(a); const [f, u] = dates(a); if (from) f.value = from; if (until) u.value = until; a.click('Download'); };

describe('R-SHARE-09 Save… offers a calendar file, an export that is never a backup', () => {
  it('the Save dialog lists "Calendar file (export only)" after the shareable link', () => {
    const a = fresh(); a.toolbar('save').click(); expect(a.dlgButtons()).toEqual(['Browser memory', 'JSON file', 'Shareable link', 'Calendar file (export only)', 'Cancel']);
  });
  it('the dialog says it is export only, gives four steps, and warns that the file and the calendar provider can read it', async () => {
    const a = fresh(); await open(a); expect(a.dlgTitle()).toBe('Calendar file');
    expect(a.dlgText()).toContain('it cannot be opened in Weekly Schedules again'); expect(a.qa('#xDlg .icsteps li')).toHaveLength(4);
    expect(a.qa('#xDlg .icsteps li')[0].textContent).toMatch(/^Create a new calendar/); expect(a.q('#xDlg .parth .tip').title).toMatch(/Removing that calendar removes every exported event at once/);
    expect(a.q('#xDlg .plainwarn').textContent).toMatch(/not encrypted.*keeps these plans on its servers/); expect(a.dlgButtons().slice(-2)).toEqual(['Download', 'Cancel']);
  });
  it('From starts on today, Until is empty and the reminder is None', async () => {
    const a = fresh(); await open(a); const [f, u] = dates(a); expect([f.value, u.value]).toEqual(['2026-10-21', '']);
    expect(a.q('#xDlg select').value).toBe('0'); expect(a.qa('#xDlg select option').map(o => o.textContent)).toEqual(['None', '5 minutes before', '10 minutes before', '15 minutes before', '30 minutes before', '60 minutes before']);
  });
  it('Download saves weekly-schedules-<date>.ics, says it is not encrypted, and the workspace stays unsaved', async () => {
    const a = fresh(); a.ev("cw().lb=keyOf(state.S)"); a.ev('state.S.events[0].title="Piano lesson"'); expect(a.ev('anyDirty()')).toBe(true); const lf = a.ev('cw().lf');
    await download(a); expect(a.dlgOpen()).toBe(false); expect(a.w.__download).toBe('weekly-schedules-2026-10-21.ics');
    expect(a.toast()).toBe('Calendar file downloaded. It is not encrypted: it contains titles, names and times.'); expect(file(a)).toContain('SUMMARY:Piano lesson · Ann');
    expect(a.ev('anyDirty()')).toBe(true); expect(a.ev('cw().lf')).toBe(lf);
  });
  it('a reminder chosen in the dialog goes into the file', async () => {
    const a = fresh(); await open(a); a.q('#xDlg select').value = '30'; a.click('Download'); expect(file(a)).toContain('TRIGGER:-PT30M');
  });
});

describe('R-SHARE-09 Periods: From and Until, checked before downloading', () => {
  it('From and Until go into the file', async () => {
    const a = fresh(); await download(a, { from: '2026-11-02', until: '2026-12-18' });
    expect(file(a)).toContain('DTSTART:20261102T170000'); expect(file(a)).toContain(';UNTIL=20261218T235959');
  });
  it('an Until before From is refused and nothing is downloaded', async () => {
    const a = fresh(); await open(a); const [f, u] = dates(a); f.value = '2026-11-02'; u.value = '2026-11-01'; a.click('Download');
    expect(err(a)).toBe('Until must not be before From.'); expect(a.dlgOpen()).toBe(true); expect(a.w.__file).toBeUndefined();
  });
  it('an empty From is refused with a message, nothing downloaded', async () => {
    const a = fresh(); await open(a); dates(a)[0].value = ''; a.click('Download'); expect(err(a)).toBe('Choose the date the calendar starts from.'); expect(a.w.__file).toBeUndefined();
  });
  it('nothing for a calendar (only things in the background) is refused with a message', async () => {
    const a = fresh(blank({ events: [ev1({ bg: true })] })); await open(a); a.click('Download');
    expect(err(a)).toMatch(/^Nothing to export/); expect(a.w.__file).toBeUndefined();
  });
});

describe('R-SHARE-09 What to include and personal details work as for files', () => {
  it('Choose… has Schedules and people but no Rhythms, and a summary of events only', async () => {
    const a = fresh(data({ rhythms: [{ id: 'r', name: 'Normal', visible: true }] })); await open(a); a.click('Choose…');
    expect(a.qa('#xDlg .partgh').map(h => h.textContent.replace(' ⓘ', ''))).toEqual(['Schedules', 'Only the activities of']); expect(a.q('#xDlg .partsum').textContent).toBe('2 of 2 events.');
  });
  it('ticking one person exports only that person\'s times', async () => {
    const a = fresh(); await open(a); a.click('Choose…'); const ben = a.qa('#xDlg .partg label').find(l => l.textContent.trim() === 'Ben').querySelector('input'); ben.checked = true; ben.onchange();
    a.click('Download'); expect(file(a)).toContain('Football · Ben'); expect(file(a)).not.toContain('Piano');
  });
  it('Leave out personal details turns people into Person 1, 2… and drops descriptions', async () => {
    const a = fresh(); await open(a); a.q('#xDlg .sopt input').checked = true; a.click('Download');
    expect(file(a)).toContain('SUMMARY:Piano · Person 1'); expect(file(a)).not.toMatch(/Ann|Ben|Room 4/);
  });
  it('names are text everywhere: a person called <b>x</b> is no markup in the dialog and literal in the file', async () => {
    const a = fresh(data({ people: [person({ id: 'A', name: '<b>x</b>' }), person({ id: 'B', name: 'Ben' })] })); await open(a); a.click('Choose…');
    expect(a.qa('#xDlg b').map(b => b.textContent)).not.toContain('x'); a.click('Download'); expect(file(a)).toContain('Piano · <b>x</b>');
  });
});

describe('R-SHARE-09 This browser remembers the last export of each workspace', () => {
  it('after a download with Until, the dialog shows that period and From follows the day after it', async () => {
    const a = fresh(); await download(a, { from: '2026-10-21', until: '2026-12-18' }); expect(a.ev('state.prefs.icsLast[state.curId]')).toEqual({ from: '2026-10-21', until: '2026-12-18' });
    await open(a); expect(a.q('#xDlg .icslast').textContent).toMatch(/^Last export from this browser: Oct 21, 2026 – Dec 18, 2026\./); expect(dates(a)[0].value).toBe('2026-12-19');
  });
  it('an earlier export without Until is said to never stop, with how to end it, and From is today', async () => {
    const a = fresh(); await download(a); await open(a);
    expect(a.q('#xDlg .icslast').textContent).toMatch(/– no end date\. It never stops: .*"this and following events"/); expect(dates(a)[0].value).toBe('2026-10-21');
    expect(a.q('#xDlg .icslast .tip').title).toMatch(/Exports made on another device are not known here/);
  });
  it('an Until already past gives From today, never a date in the past', async () => {
    const a = fresh(); a.ev('state.prefs.icsLast[state.curId]={from:"2026-01-05",until:"2026-06-30"}'); await open(a); expect(dates(a)[0].value).toBe('2026-10-21');
  });
  it('it is per browser view state: kept in prefs, never in the data, a file or undo', async () => {
    const a = fresh(); a.ev("cw().lb=keyOf(state.S)"); await download(a); const id = a.ev('state.curId'); expect(prefsOf(a).icsLast).toEqual({ [id]: { from: '2026-10-21' } });
    expect(a.ev('anyDirty()')).toBe(false); expect(JSON.stringify(a.ev('buildFile()'))).not.toContain('icsLast'); expect(a.ev('state.undoSt.length')).toBe(0);
  });
  it('deleting the workspace, clearing memory or erasing it drops it; duplicating does not copy it', async () => {
    const a = fresh(); await download(a); const id = a.ev('state.curId');
    a.ev('duplicateWorkspace()'); expect(a.ev('state.prefs.icsLast[state.curId]')).toBeUndefined(); expect(a.ev(`state.prefs.icsLast['${id}']`)).toBeDefined();
    a.ev(`switchWs('${id}')`); a.ev('deleteWorkspace()'); expect(prefsOf(a).icsLast).toEqual({});
    await download(a); a.ev('clearMem()'); expect(prefsOf(a).icsLast).toEqual({});
  });
  it('a damaged or hostile icsLast in prefs is ignored at load', () => {
    const a = openApp({ storage: { [PREFS_KEY]: JSON.stringify({ icsLast: { w1: { from: 'soon' }, w2: { from: '2026-10-21', until: 5 }, w3: '2026-10-21', ['x'.repeat(65)]: { from: '2026-10-21' }, w4: { from: '2026-10-21', until: '2026-12-18', extra: 1 } } }) } });
    expect(a.ev('JSON.stringify(state.prefs.icsLast)')).toBe('{"w4":{"from":"2026-10-21","until":"2026-12-18"}}');
    const b = openApp({ storage: { [PREFS_KEY]: '{"icsLast":{"__proto__":{"from":"2026-10-21"}}}' } }); expect(b.ev('Object.getPrototypeOf(state.prefs.icsLast)')).toBeNull(); expect(b.ev('({}).from')).toBeUndefined();
  });
});

describe('R-CYC-05 The calendar export uses today\'s week of the cycle, asking for it once like Live View', () => {
  const cyc = () => data({ cycle: 2, events: [ev1({ id: 'w2', title: 'Swim', weeks: [2], slots: [{ day: 0, start: 600, end: 660, person: 'A' }] })] });
  it('with a cycle whose week is not known, "Which week is it?" comes first, then the export dialog', async () => {
    const a = fresh(cyc()); a.chooseSave('Calendar file (export only)'); await a.sleep(5);
    expect(a.dlgTitle()).toBe('Which week is it?'); expect(a.dlgText()).toContain('The calendar\'s dates follow it'); expect(a.dlgButtons()).toEqual(['Continue', 'Cancel']);
    a.q('#xDlg select').value = '2'; a.click('Continue'); await a.sleep(5); expect(a.dlgTitle()).toBe('Calendar file'); expect(a.q('#xDlg .icswk').textContent).toBe('The From date is in Week 2.');
  });
  it('the answer is the anchor Live View uses: Live View then starts without asking', async () => {
    const a = fresh(cyc()); a.chooseSave('Calendar file (export only)'); await a.sleep(5); a.q('#xDlg select').value = '2'; a.click('Continue'); await a.sleep(5); a.click('Cancel');
    expect(a.ev('state.prefs.lvAnchor[state.curId]')).toBe('2026-10-12'); a.q('#lvB').click(); expect(a.ev('[state.live,state.curWk]')).toEqual([true, 2]);
  });
  it('a From three weeks ahead falls in the right week, and the file starts there', async () => {
    const a = fresh(cyc()); a.ev('setAnchor(2)'); await open(a); const f = dates(a)[0]; f.value = '2026-11-09'; f.oninput();
    expect(a.q('#xDlg .icswk').textContent).toBe('The From date is in Week 1.'); a.click('Download'); expect(file(a)).toContain('DTSTART:20261116T100000');
  });
  it('wkAt gives today\'s week for today, as todayWk does', () => {
    const a = fresh(cyc()); a.ev('setAnchor(2)'); expect(a.ev('wkAt(ymd(new Date()))')).toBe(2); expect(a.ev('todayWk()')).toBe(2); expect(a.ev('wkAt(ymd(new Date())+7)')).toBe(1);
  });
  it('Cancel on "Which week is it?" opens nothing and remembers nothing', async () => {
    const a = fresh(cyc()); a.chooseSave('Calendar file (export only)'); await a.sleep(5); a.click('Cancel'); await a.sleep(5); expect(a.dlgOpen()).toBe(false); expect(a.ev('state.prefs.lvAnchor[state.curId]')).toBeUndefined();
  });
});

describe('R-SHARE-09 The calendar export in Spanish', () => {
  it('the button, the dialog and the file speak Spanish', async () => {
    const a = fresh(data(), { languages: ['es-ES'] }); a.toolbar('save').click(); expect(a.dlgButtons()).toContain('Archivo de calendario (solo exportar)'); a.click('Archivo de calendario (solo exportar)'); await a.sleep(5);
    expect(a.dlgTitle()).toBe('Archivo de calendario'); expect(a.dlgText()).toContain('Cómo usarlo'); expect(a.dlgButtons().slice(-2)).toEqual(['Descargar', 'Cancelar']);
    a.ev('state.prefs.icsLast[state.curId]={from:"2026-10-21"}'); a.click('Cancelar'); await a.sleep(5); a.chooseSave('Archivo de calendario (solo exportar)'); await a.sleep(5);
    expect(a.q('#xDlg .icslast').textContent).toMatch(/^Última exportación desde este navegador: 21 oct 2026 – sin fecha de fin\. No termina nunca/);
  });
});
