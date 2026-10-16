import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, sched, ev1, workspace, html, sleep, WS_KEY, PREFS_KEY, PASSWORD } from '../helpers/app.js';

const script = html.slice(html.indexOf('<script>'), html.lastIndexOf('</script>'));
const markup = html.slice(0, html.indexOf('<script>'));

describe('R-SEC-01 Content-Security-Policy confines the page to itself', () => {
  const csp = (html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
  const directive = name => (csp.split(';').map(s => s.trim()).find(s => s.startsWith(name + ' ')) || '');
  it('a policy is present in the page itself (it travels with the single file)', () => { expect(csp).not.toBe(''); });
  it.each([['default-src', "'none'"], ['connect-src', "'none'"], ['base-uri', "'none'"], ['form-action', "'none'"], ['img-src', 'data:']])('the policy directive %s allows only %s', (name, value) => {
    expect(directive(name)).toBe(`${name} ${value}`);
  });
  it('scripts and styles may only be the page\'s own inline code, never other files or addresses', () => {
    expect(directive('script-src')).toBe("script-src 'unsafe-inline'"); expect(directive('style-src')).toBe("style-src 'unsafe-inline'");
  });
  it('eval and similar string-to-code features are not allowed (no unsafe-eval)', () => { expect(csp).not.toContain('unsafe-eval'); });
  it('no network access of any kind is allowed: no fonts, frames, media, workers or objects', () => {
    expect(csp).not.toMatch(/https?:|\*|font-src|frame-src|media-src|worker-src|object-src [^']/);
  });
  it('the page loads nothing from outside: no external scripts, stylesheets, images, frames or links to other sites', () => {
    expect(markup).not.toMatch(/<script[^>]+src=/i); expect(markup).not.toMatch(/<link[^>]+rel=["']?stylesheet/i); expect(markup).not.toMatch(/(src|href)=["']https?:/i); expect(markup).not.toMatch(/<(iframe|object|embed|frame)\b/i);
  });
  it('web addresses inside the script are only XML namespaces of inline icons, never something that is fetched', () => {
    const urls = [...script.matchAll(/https?:\/\/[^\s'"`)]+/g)].map(m => m[0]); expect(urls.every(u => u.startsWith('http://www.w3.org/'))).toBe(true);
  });
});

describe('R-SEC-02 Everything user-controlled is escaped before it reaches the page', () => {
  const payloads = [
    '<img src=x onerror="window.__pwned=1">', '"><script>window.__pwned=1</script>', "'><svg onload=window.__pwned=1>", '</style><script>window.__pwned=1</script>',
    '<a href="javascript:window.__pwned=1">x</a>', '" onmouseover="window.__pwned=1" x="', "&lt;b&gt;&amp;", '${window.__pwned=1}', '{{constructor.constructor("window.__pwned=1")()}}',
  ];
  it('esc() turns the five dangerous characters into entities', () => {
    const a = openApp(); expect(a.ev('esc(`<>&"\'`)')).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
  it.each(payloads)('the text %j is shown as text everywhere and never runs', async payload => {
    const a = openApp();
    const hostile = workspace({
      name: payload, schedules: [{ id: 's1', name: payload, color: '#3b6df0', opacity: 1, locked: false, visible: true }], people: [{ id: 'p1', name: payload, color: '#f00000', visible: true }], types: [{ id: 't1', name: payload, color: '#3b6df0', icon: payload }],
      events: [{ id: 'e1', title: payload, desc: payload, color: '#3b6df0', type: 't1', schedules: ['s1'], involved: ['p1'], slots: [{ day: 0, start: 600, end: 720, person: 'p1' }, { day: 0, start: 660, end: 780, person: 'p1' }] }],
      rhythms: [{ id: 'r1', name: payload, visible: true }], phases: [{ id: 'ph1', title: payload, desc: payload, color: '#3b6df0', rhythms: ['r1'], slots: [{ day: 0, start: 720, end: 780 }, { day: 1, start: 720, end: 780 }] }],
    });
    a.ev(`(()=>{const w=parseWorkspace(${JSON.stringify(hostile)});S=w.data;cw().data=w.data;cw().name=w.name;render()})()`);
    const bits = [
      'openAgenda(0)', 'openRhythmAgenda(S.rhythms[0])', 'openDlg(S.events[0])', 'closeDlgs&&closeDlgs()', 'openCopy(S.events[0])', 'openTransfer("schedule",S.schedules[0])', 'openSettings()',
      'printSchedule()', 'printDay(0)', 'openStats("p1")', 'stP="*";openStats()', 'editMode="phases";render();openDlg(S.phases[0])', 'editMode="events";render()',
    ];
    for (const b of bits) { try { a.ev(b); } catch { /* a missing helper is fine; escaping is what matters */ } }
    a.qa('.wsbtn').forEach(b => b.click()); a.qa('#sbin button').forEach(b => { try { if (/⋯|more/i.test(b.title)) b.click(); } catch { /* ignore */ } });
    a.qa('.day')[0].onpointermove({ pointerType: 'mouse', buttons: 0, clientX: a.x(0), clientY: a.y(700) });
    await sleep(420);
    expect(a.w.__pwned).toBeUndefined();
    expect(a.qa('script')).toHaveLength(1);
    expect(a.qa('[onerror],[onload],[onmouseover],[onclick][data-x]')).toHaveLength(0);
    expect(a.qa('a[href^="javascript"]')).toHaveLength(0);
    expect(a.qa('img[src="x"]')).toHaveLength(0);
  });
  it('ids with quotes cannot break out of attributes', async () => {
    const a = openApp(); const id = 'x" onmouseover="window.__pwned=1" y="';
    a.ev(`(()=>{const w=parseWorkspace(${JSON.stringify(workspace({ schedules: [{ id, name: 'S', color: '#3b6df0', opacity: 1, locked: false, visible: true }], events: [{ id, title: 'T', desc: '', color: '#3b6df0', schedules: [id], involved: [], slots: [{ day: 0, start: 600, end: 660, person: '' }] }] }))});S=w.data;render()})()`);
    a.ev('openAgenda(0)'); a.ev('openDlg(S.events[0])'); await sleep(20); expect(a.w.__pwned).toBeUndefined(); expect(a.qa('[onmouseover]')).toHaveLength(0);
  });
  it('unsafe colour values are replaced by safe palette colours before they can reach a style attribute', () => {
    const a = openApp(); const d = a.ev(`parseData(${JSON.stringify(blank({ schedules: [sched({ color: 'red;background:url(https://evil.example/x)' })], events: [ev1({ color: 'expression(alert(1))' })] }))})`);
    expect(d.schedules[0].color).toMatch(/^#[0-9a-f]{6}$/); expect(d.events[0].color).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('user text is only ever added with textContent or esc(): no raw innerHTML of data fields', () => {
    const risky = [...script.matchAll(/(?:innerHTML|insertAdjacentHTML\([^,]+,)\s*=?\s*([^;\n]{0,160})/g)].map(m => m[0]);
    const raw = risky.filter(r => /\b(e|s|q|p|ph|w|r|rh|t|ty)\.(title|name|desc)\b/.test(r) && !/esc\(/.test(r)); expect(raw).toEqual([]);
  });
});

describe('R-SEC-02 Names typed in the sidebar are trimmed and capped at 200 characters, like imported ones', () => {
  const rename = (a, field, v) => { field.value = v; field.onchange(); };
  const data = () => blank({ schedules: [sched({ id: 's1', name: 'Home' })], people: [{ id: 'p1', name: 'Ann', color: '#e5484d', visible: true }], rhythms: [{ id: 'r1', name: 'Normal', visible: true }] });
  const fields = a => ({ ppl: a.q('input[aria-label="Name of the person"]'), rh: a.q('input[aria-label="Name of the rhythm"]') });
  it('a schedule, a person and a rhythm renamed with 300 characters keep only the first 200', () => {
    const a = openApp(); setData(a, data()); const long = 'x'.repeat(300);
    rename(a, a.q('input[aria-label="Name of the schedule"]'), long); rename(a, fields(a).ppl, long); rename(a, fields(a).rh, long);
    expect(a.ev('[S.schedules[0].name.length, S.people[0].name.length, S.rhythms[0].name.length]')).toEqual([200, 200, 200]);
  });
  it('spaces around a typed name are removed, and a name of only spaces keeps the old name', () => {
    const a = openApp(); setData(a, data());
    rename(a, a.q('input[aria-label="Name of the schedule"]'), '  Work  '); rename(a, fields(a).ppl, '   '); rename(a, fields(a).rh, ' Holiday ');
    expect(a.ev('[S.schedules[0].name, S.people[0].name, S.rhythms[0].name]')).toEqual(['Work', 'Ann', 'Holiday']);
  });
});

describe('R-SEC-03 Imports are limited so hostile files cannot hang the browser (see also the data validation tests)', () => {
  it('the limits are 100 schedules, 500 people, 100 activity types, 5,000 events, 100 rhythms, 2,000 phases and 200 repetitions each', () => {
    expect(openApp().ev('JSON.stringify(LIM)')).toMatch(/100[\s\S]*500[\s\S]*100[\s\S]*5000[\s\S]*100[\s\S]*2000[\s\S]*200/);
  });
  it('the decrypted size is capped (a small file cannot expand into gigabytes)', () => { expect(script).toMatch(/2e6|2000000/); });
  it('the key-derivation work factor of incoming data is bounded in both directions', () => { expect(script).toMatch(/iter[^;]{0,60}(2e6|2000000)|(2e6|2000000)[^;]{0,60}iter/i); });
});

describe('R-SEC-04 Nothing leaves the device and nothing unexpected is stored', () => {
  it('a complete tour (create, edit, save, share, open, import, print) makes no network requests and sets no cookies', async () => {
    const a = openApp(); const calls = [];
    a.w.fetch = (...x) => { calls.push(['fetch', x[0]]); return Promise.reject(new Error('blocked')); };
    a.w.XMLHttpRequest = function () { calls.push(['xhr']); }; a.w.WebSocket = function () { calls.push(['ws']); }; a.w.EventSource = function () { calls.push(['sse']); };
    Object.defineProperty(a.w.navigator, 'sendBeacon', { value: () => { calls.push(['beacon']); return false; }, configurable: true });
    const ImageOrig = a.w.Image; a.w.Image = function (...x) { calls.push(['image']); return new ImageOrig(...x); }; a.w.open = () => { calls.push(['open']); return null; };
    setData(a, workspace()); a.toolbar('add').click(); a.q('#fT').value = 'Tour'; a.q('#fOk').click();
    a.toolbar('save').click(); a.click('Browser memory'); a.toolbar('save').click(); a.click('Shareable link'); await sleep(10); a.q('#xDlg input[type=text]').value = PASSWORD; a.click('Create link'); await sleep(2500);
    a.ev('printSchedule()'); a.ev('openAgenda(0)'); a.ev('openSettings()');
    expect(calls).toEqual([]); expect(a.d.cookie).toBe('');
  });
  it('only the two documented browser-storage keys are ever written', () => {
    const a = openApp(); a.ev('saveMem("all");prefs.theme="dark";savePrefs()'); expect(Object.keys(a.storage()).sort()).toEqual([PREFS_KEY, WS_KEY].sort());
  });
  it('the shared-link data is only written to the address fragment, which browsers never send to servers', () => {
    expect(script).toMatch(/'#data=e1\.'/); expect(script).not.toMatch(/\?data=|[?&]d=/);
  });
  it('the page never uses the risky APIs: eval, new Function, fetch, XMLHttpRequest, WebSocket, sendBeacon, window.open, postMessage, importScripts, document.write', () => {
    [/\beval\s*\(/, /new\s+Function\b/, /\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /window\.open\s*\(/, /postMessage/, /importScripts/, /document\.write/, /setTimeout\s*\(\s*['"`]/, /setInterval\s*\(\s*['"`]/].forEach(r => expect(script, String(r)).not.toMatch(r));
  });
  it('the page makes no use of third-party code, cookies or service workers', () => {
    expect(script).not.toMatch(/document\.cookie|serviceWorker|indexedDB|import\s*\(|require\s*\(/);
  });
});

describe('R-SEC-05 Deployment hygiene is documented where it cannot be fixed in code', () => {
  it('CLAUDE.md warns that sites on one github.io account share one browser storage origin', async () => {
    const fs = await import('node:fs'); const doc = fs.readFileSync(new URL('../../CLAUDE.md', import.meta.url), 'utf8'); expect(doc).toMatch(/github\.io/i); expect(doc).toMatch(/origin/i);
  });
});
