// Backwards compatibility of saved data (R-DATA-08) and refusal of data from newer versions (R-DATA-09).
// tests/fixtures/v<N>/ holds files written by the app of format version N; they are never edited or regenerated.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { openApp, workspace, blank, WS_KEY, PREFS_KEY, ROOT } from '../helpers/app.js';
import { household, householdAt, grandparents, prefsAt, FIXTURE_PASSWORD } from '../fixtures/household.js';

const FIX = path.join(ROOT, 'tests/fixtures');
const versions = fs.readdirSync(FIX).filter(n => /^v\d+$/.test(n)).map(n => +n.slice(1)).sort((a, b) => a - b);
const read = (v, f) => fs.readFileSync(path.join(FIX, 'v' + v, f), 'utf8');
const FMT = openApp().ev('FMT');
async function waitFor(fn, ms = 10000) { const t0 = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timed out waiting'); await new Promise(r => setTimeout(r, 25)); } }
const openFile = async (a, text, name = 'f.json') => { a.d.getElementById('file').onchange({ target: { files: [{ name, text: async () => text }], value: '' } }); await a.sleep(30); };
const importNew = a => { a.qa('#xDlg input[name=impm]').find(r => r.value === 'new').checked = true; a.click('Import'); };
const typePw = a => { a.q('#xDlg input').value = FIXTURE_PASSWORD; a.click('Open'); };
const loaded = a => JSON.parse(a.ev('JSON.stringify(S)'));
const shapeOf = (x, p = '') => Array.isArray(x) ? x.flatMap(v => shapeOf(v, p + '[]')) : x && typeof x === 'object' ? Object.keys(x).flatMap(k => [p + '.' + k, ...shapeOf(x[k], p + '.' + k)]) : [];
const shape = x => [...new Set(shapeOf(x))].sort();
const bump = (text, f) => { const j = JSON.parse(text); f(j); return JSON.stringify(j); };
const b64 = s => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const u64 = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe.each(versions)('R-DATA-08 Sample files of format version %i still load with the same content', v => {
  it(`the readable JSON file of version ${v} imports through the Load dialog with every detail`, async () => {
    const a = openApp(); await openFile(a, read(v, 'workspace.json')); expect(a.dlgTitle()).toBe('Import'); importNew(a);
    expect(a.ev('cw().name')).toBe('Family week'); expect(a.ev('cw().id')).toBe('ws-family'); expect(loaded(a)).toMatchObject(householdAt(v)); expect(a.log.errors).toEqual([]);
  });
  it(`the encrypted JSON file of version ${v} opens with its password and has the same content`, async () => {
    const a = openApp(); await openFile(a, read(v, 'encrypted.json')); await waitFor(() => a.dlgTitle() === 'Password needed'); typePw(a);
    await waitFor(() => a.dlgTitle() === 'Import'); importNew(a); expect(loaded(a)).toMatchObject(householdAt(v));
  });
  it(`the shareable link of version ${v} opens with its password and has the same content`, async () => {
    const a = openApp({ url: read(v, 'link.txt').trim() }); await waitFor(() => a.dlgTitle() === 'Password needed'); typePw(a);
    await waitFor(() => a.ev('cw().name') === 'Family week'); expect(loaded(a)).toMatchObject(householdAt(v)); expect(a.w.location.hash).toBe('');
  });
  it(`browser memory of version ${v} loads both workspaces at startup, unchanged and not marked unsaved`, () => {
    const a = openApp({ storage: { [WS_KEY]: read(v, 'store.json') } });
    expect(a.ev('WS.map(w=>w.name)')).toEqual(['Family week', 'Grandparents']); expect(a.ev('curId')).toBe('ws-family');
    expect(loaded(a)).toMatchObject(householdAt(v)); expect(JSON.parse(a.ev('JSON.stringify(WS[1].data)'))).toMatchObject(grandparents);
    expect(a.ev('anyDirty()')).toBe(false); expect(a.log.alerts).toEqual([]);
  });
  it(`browser memory of version ${v} is rewritten in the current format only when the user saves`, () => {
    const text = read(v, 'store.json'), a = openApp({ storage: { [WS_KEY]: text } }); expect(a.storage()[WS_KEY]).toBe(text);
    a.ev("saveMem('current')"); const st = JSON.parse(a.storage()[WS_KEY]); expect(st.version).toBe(FMT); expect(st.workspaces.map(w => w.name)).toEqual(['Family week', 'Grandparents']);
    expect(st.workspaces.every(w => !('version' in w))).toBe(true);
  });
  it(`the settings saved by version ${v} are read back with every value`, () => {
    const a = openApp({ storage: { [PREFS_KEY]: read(v, 'prefs.json') } });
    expect(JSON.parse(a.ev('JSON.stringify(prefs)'))).toMatchObject(prefsAt(v)); expect(a.d.documentElement.dataset.theme).toBe('dark');
  });
  it(`all files of version ${v} hold exactly the same workspace (file, encrypted file, link, browser memory)`, async () => {
    const a = openApp(), plain = JSON.parse(read(v, 'workspace.json')), store = JSON.parse(read(v, 'store.json'));
    const dec = async t => JSON.parse(await a.ev(`unseal(unb64u(${JSON.stringify(t)}),${JSON.stringify(FIXTURE_PASSWORD)}).then(JSON.stringify)`));
    const enc = await dec(JSON.parse(read(v, 'encrypted.json')).data), link = await dec(read(v, 'link.txt').trim().split('#data=e1.')[1]);
    expect(enc).toEqual(plain); expect(link).toEqual(plain); const { version, ...rest } = plain; expect(version).toBe(v); expect(store.workspaces[0]).toEqual(rest); expect(store.version).toBe(v);
  });
});

describe('R-DATA-08 The current format is frozen: changing it needs a new version number and sample files', () => {
  // The stored keys of each published version. A change here means: raise FMT in index.html, add MIG[FMT-1],
  // update tests/fixtures/household.js and run `node tests/fixtures/make.mjs` (CLAUDE.md R-DATA-08).
  const SHAPES = {
    1: ['.events', '.events[].color', '.events[].desc', '.events[].id', '.events[].involved', '.events[].oncall', '.events[].schedules', '.events[].slots',
      '.events[].slots[].day', '.events[].slots[].end', '.events[].slots[].fe', '.events[].slots[].flex', '.events[].slots[].fs', '.events[].slots[].person',
      '.events[].slots[].start', '.events[].title', '.events[].type', '.id', '.name', '.people', '.people[].color', '.people[].external', '.people[].id',
      '.people[].name', '.people[].visible', '.phaseOpacity', '.phases', '.phases[].color', '.phases[].desc', '.phases[].id', '.phases[].rhythms',
      '.phases[].slots', '.phases[].slots[].day', '.phases[].slots[].end', '.phases[].slots[].start', '.phases[].title', '.rhythms', '.rhythms[].id',
      '.rhythms[].name', '.rhythms[].visible', '.schedules', '.schedules[].color', '.schedules[].id', '.schedules[].locked', '.schedules[].name',
      '.schedules[].opacity', '.schedules[].visible', '.types', '.types[].color', '.types[].icon', '.types[].id', '.types[].name', '.types[].soft', '.version'],
  };
  SHAPES[2] = [...SHAPES[1], '.events[].nest'].sort();   // 2: nested activities (R-NST-01)
  SHAPES[3] = [...SHAPES[2], '.events[].bg'].sort();   // 3: in the background (R-EVT-19)
  SHAPES[4] = SHAPES[3];   // 4: same keys; strips come only from event.bg (MIG[3])
  SHAPES[5] = [...SHAPES[4], '.events[].owner', '.events[].slots[].fo', '.events[].slots[].inv'].sort();   // 5: owner, follows the owner, a day's own With list (R-EVT-20/21)
  SHAPES[6] = [...SHAPES[5], '.events[].slots[].col'].sort();   // 6: a repetition's own colour (R-EVT-22)
  const record = () => { const a = openApp(); a.ev(`(()=>{const d=parseData(${JSON.stringify(household)});S=d;const w=cw();w.data=d;w.id='ws-family';curId=w.id;w.name='Family week'})()`); return JSON.parse(a.ev('JSON.stringify(buildFile())')); };
  it('there is a folder of sample files for the current format version and for every earlier one', () => {
    expect(versions).toEqual(Array.from({ length: FMT }, (_, i) => i + 1));
  });
  it('the keys the app writes match the frozen list of the current version (otherwise raise FMT)', () => {
    expect(SHAPES[FMT], `add SHAPES[${FMT}]`).toBeDefined(); expect(shape(record())).toEqual(SHAPES[FMT]);
  });
  it('the sample household uses every optional field, so the shape check sees all of them', () => {
    expect(shape(JSON.parse(read(FMT, 'workspace.json')))).toEqual(SHAPES[FMT]);
  });
  it('the sample files of the current version are what this app writes today, byte for byte in content', () => {
    expect(record()).toEqual(JSON.parse(read(FMT, 'workspace.json')));
  });
  it('there is an upgrade step for every older version and none beyond the current one', () => {
    const a = openApp(); expect(a.ev('Object.keys(MIG).map(Number).sort((x,y)=>x-y)')).toEqual(Array.from({ length: FMT - 1 }, (_, i) => i + 1));
  });
  it('the files, links and browser memory written now carry the current version number', () => {
    const a = openApp(); a.ev("saveMem('all')"); expect(JSON.parse(a.storage()[WS_KEY]).version).toBe(FMT); expect(a.ev('buildFile().version')).toBe(FMT);
  });
});

describe('R-DATA-08 Upgrading old data: version-by-version steps before validation', () => {
  const a = openApp();
  const run = (j, v, to, steps) => a.ev(`(()=>{try{return JSON.stringify(migrate(${JSON.stringify(j)},${JSON.stringify(v)},${to},{${steps}}))}catch(e){return 'error:'+e.message}})()`);
  it('every step from the record\'s version up to the current one runs, in order', () => {
    expect(JSON.parse(run({ log: [] }, 1, 3, '1:j=>({log:[...j.log,1]}),2:j=>({log:[...j.log,2]})'))).toEqual({ log: [1, 2] });
    expect(JSON.parse(run({ log: [] }, 2, 3, '1:j=>({log:[...j.log,1]}),2:j=>({log:[...j.log,2]})'))).toEqual({ log: [2] });
  });
  it('a record that is already current is passed through untouched', () => {
    expect(JSON.parse(run({ a: 1 }, 3, 3, ''))).toEqual({ a: 1 });
  });
  it('a newer record is refused as "newer" and an impossible version number as not valid', () => {
    expect(run({}, 4, 3, '')).toBe('error:newer');
    [0, -1, 1.5, null, 'x'].forEach(v => expect(run({}, v, 3, '')).toBe('error:bad'));
  });
  it('a file without a version number (written by hand) is read as version 1', async () => {
    const { version, ...noVersion } = workspace(); expect(version).toBe(1);
    const b = openApp(); await openFile(b, JSON.stringify(noVersion)); expect(b.dlgTitle()).toBe('Import');
  });
  it('the version number may be written as text, like "1"', async () => {
    const b = openApp(); await openFile(b, JSON.stringify(workspace({ version: '1' }))); expect(b.dlgTitle()).toBe('Import');
  });
  it.each([[0], [-3], [1.5], ['one']])('a file with the impossible version %s is refused as not valid', async v => {
    const b = openApp(); await openFile(b, JSON.stringify(workspace({ version: v }))); expect(b.log.alerts[0]).toContain('not a valid'); expect(b.dlgOpen()).toBe(false);
  });
});

describe('R-DATA-08 R-EVT-19 Upgrading to version 4 keeps former external strips as strips', () => {
  const a = openApp();
  const up = (events, people = [{ id: 'X', name: 'Cleaner', external: true }, { id: 'A', name: 'Ann' }]) => JSON.parse(a.ev(`JSON.stringify(MIG[3](${JSON.stringify({ people, events })}).events.map(e=>!!e.bg))`));
  const e = (o = {}) => ({ id: 'e', title: 'Cleaning', involved: [], slots: [{ day: 0, start: 600, end: 660, person: 'X' }], ...o });
  it('an event led by external people in every repetition, with nobody involved or only people on call, gets the mark', () => {
    expect(up([e(), e({ involved: ['A'], oncall: true }), e({ slots: [{ day: 0, start: 600, end: 660, person: 'X' }, { day: 2, start: 600, end: 660, person: 'X' }] })])).toEqual([true, true, true]);
  });
  it('normally involved people, a repetition led by one of us or by nobody, or no external people at all: no mark', () => {
    expect(up([e({ involved: ['A'] }), e({ slots: [{ day: 0, start: 600, end: 660, person: 'X' }, { day: 2, start: 600, end: 660, person: 'A' }] }), e({ slots: [{ day: 0, start: 600, end: 660, person: '' }] })])).toEqual([false, false, false]);
    expect(up([e()], [{ id: 'X', name: 'Cleaner' }])).toEqual([false]);
  });
  it('an event already marked keeps its mark', () => {
    expect(up([e({ involved: ['A'], bg: true })])).toEqual([true]);
  });
  it.each(versions.filter(v => v < 4))('the external-led cleaning in the version %i sample loads as a strip', async v => {
    const b = openApp(); await openFile(b, read(v, 'workspace.json')); importNew(b);
    expect(loaded(b).events.find(x => x.id === 'e-clean').bg).toBe(true); expect(b.qa('.bgs').length).toBeGreaterThan(0);
  });
});

describe('R-DATA-09 Data from a newer version of the app is refused, never half-read', () => {
  const NEWER = 'made with a newer version';
  it('a readable JSON file of a newer format is refused with a message to reload the page', async () => {
    const b = openApp(); await openFile(b, JSON.stringify(workspace({ version: FMT + 1 }))); expect(b.log.alerts[0]).toContain(NEWER); expect(b.log.alerts[0]).toContain('Reload the page'); expect(b.dlgOpen()).toBe(false);
    expect(b.ev('WS.length')).toBe(1);
  });
  it('an encrypted file whose container is of a newer version is refused before the password is asked', async () => {
    const b = openApp(); await openFile(b, bump(read(FMT, 'encrypted.json'), j => { j.version = 2; })); expect(b.log.alerts[0]).toContain(NEWER); expect(b.dlgOpen()).toBe(false);
  });
  it('an encrypted file whose encryption layout is of a newer version is refused before the password is asked', async () => {
    const b = openApp(); await openFile(b, bump(read(FMT, 'encrypted.json'), j => { const x = b64(j.data); x[0] = 2; j.data = u64(x); })); expect(b.log.alerts[0]).toContain(NEWER); expect(b.dlgOpen()).toBe(false);
  });
  it('an encrypted file whose workspace inside is of a newer format is refused after the password', async () => {
    const a = openApp(); const data = await a.ev(`seal(${JSON.stringify(workspace({ version: FMT + 1 }))},${JSON.stringify(FIXTURE_PASSWORD)}).then(b64u)`);
    const b = openApp(); await openFile(b, JSON.stringify({ format: 'weekly-schedules-encrypted', version: 1, data })); await waitFor(() => b.dlgTitle() === 'Password needed'); typePw(b);
    await waitFor(() => b.log.alerts.length); expect(b.log.alerts[0]).toContain(NEWER); expect(b.ev('WS.length')).toBe(1);
  });
  it('a compression flag of a newer version inside the encrypted data is reported as newer', async () => {
    const a = openApp(); const r = await a.ev(`encryptBytes(new Uint8Array([2,123,125]),${JSON.stringify(FIXTURE_PASSWORD)}).then(b=>unseal(b,${JSON.stringify(FIXTURE_PASSWORD)})).then(()=>'ok',e=>e.message)`);
    expect(r).toBe('newer');
  });
  it.each([['e2.AAAA'], ['e17.AAAA']])('a link of a newer link format (#data=%s) is refused with the newer-version message', async frag => {
    const b = openApp({ url: 'https://app.test/#data=' + frag }); await b.sleep(10); expect(b.toast()).toContain(NEWER); expect(b.w.location.hash).toBe(''); expect(b.dlgOpen()).toBe(false);
  });
  it('a link whose encryption layout is of a newer version is refused before the password is asked', async () => {
    const x = b64(read(FMT, 'link.txt').trim().split('#data=e1.')[1]); x[0] = 2;
    const b = openApp({ url: 'https://app.test/#data=e1.' + u64(x) }); await b.sleep(10); expect(b.toast()).toContain(NEWER); expect(b.dlgOpen()).toBe(false);
  });
  it('a link whose workspace inside is of a newer format is refused after the password', async () => {
    const a = openApp(); const data = await a.ev(`seal(${JSON.stringify(workspace({ version: FMT + 1 }))},${JSON.stringify(FIXTURE_PASSWORD)}).then(b64u)`);
    const b = openApp({ url: 'https://app.test/#data=e1.' + data }); await waitFor(() => b.dlgTitle() === 'Password needed'); typePw(b);
    await waitFor(() => b.toast()); expect(b.toast()).toContain(NEWER); expect(b.ev('cw().name')).toBe('Workspace');
  });
});

describe('R-DATA-09 Browser memory written by a newer version is neither loaded nor overwritten', () => {
  const newer = () => JSON.stringify({ version: 99, current: 'n', workspaces: [{ id: 'n', name: 'From the future', ...blank(), wormholes: [1] }] });
  const start = () => { const text = newer(); return { text, a: openApp({ storage: { [WS_KEY]: text } }) }; };
  it('at startup the app explains it and starts with an empty default workspace instead', () => {
    const { a } = start(); expect(a.log.alerts[0]).toContain('newer version'); expect(a.log.alerts[0]).toContain('will not write over it');
    expect(a.ev('WS.map(w=>w.name)')).toEqual(['Workspace']); expect(a.log.errors).toEqual([]);
  });
  it('saving to browser memory is refused and the stored data stays exactly as it was', () => {
    const { a, text } = start(); a.chooseSave('Browser memory'); expect(a.log.alerts[1]).toContain('Not saved'); expect(a.storage()[WS_KEY]).toBe(text);
  });
  it('saving only the current workspace (with several open) is refused as well', () => {
    const { a, text } = start(); a.ev("WS.push(newWs('Two',defaultData(),false))"); a.ev("saveMem('current')"); a.ev("saveMem('all')");
    expect(a.log.alerts.filter(m => /Not saved/.test(m))).toHaveLength(2); expect(a.storage()[WS_KEY]).toBe(text);
  });
  it('Load from browser memory is refused with the explanation instead of reading the data', () => {
    const { a, text } = start(); a.ev('loadMem()'); expect(a.log.alerts[1]).toContain('newer version'); expect(a.ev('S.schedules[0].name')).toBe('Routine'); expect(a.storage()[WS_KEY]).toBe(text);
  });
  it('Restart checks again and still leaves the newer data alone', () => {
    const { a, text } = start(); a.ev('restart()'); expect(a.log.alerts.filter(m => /newer version/.test(m))).toHaveLength(2); expect(a.storage()[WS_KEY]).toBe(text);
  });
  it('if another tab of a newer version writes browser memory later, saving here is refused', () => {
    const a = openApp(); a.w.localStorage.setItem(WS_KEY, newer()); a.chooseSave('Browser memory'); expect(a.log.alerts[0]).toContain('Not saved'); expect(JSON.parse(a.storage()[WS_KEY]).version).toBe(99);
  });
  it('a first-time visitor opening a link does not adopt it over newer browser memory, but gets the import dialog', async () => {
    const link = read(FMT, 'link.txt').trim(), b = openApp({ url: link, storage: { [WS_KEY]: newer() } });
    await waitFor(() => b.dlgTitle() === 'Password needed'); typePw(b); await waitFor(() => b.dlgTitle() === 'Import');
  });
  it('Clear memory (after its confirmation) removes the newer data, and saving works again', () => {
    const { a } = start(); a.ev('clearMem()'); expect(a.storage()[WS_KEY]).toBeUndefined(); a.chooseSave('Browser memory');
    expect(a.toast()).toBe('Saved to browser memory'); expect(JSON.parse(a.storage()[WS_KEY]).version).toBe(FMT);
  });
});
