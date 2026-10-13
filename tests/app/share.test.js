import { describe, it, expect } from 'vitest';
import { openApp, setData, blank, sched, ev1, person, workspace, WS_KEY, PASSWORD, html } from '../helpers/app.js';

const rich = () => blank({ people: [person({ id: 'A', name: 'Granny Rose' })], schedules: [sched({ id: 's1', name: 'Care' })], events: [ev1({ title: 'Doctor visit', desc: 'door code 4711', involved: ['A'], slots: [{ day: 1, start: 600, end: 660, person: 'A' }] })] });
const fresh = (o = {}) => { const a = openApp(o); setData(a, rich()); a.ev('cw().name="Granny care"'); return a; };
async function waitFor(fn, ms = 8000) { const t0 = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timed out waiting'); await new Promise(r => setTimeout(r, 25)); } }
const protectDialog = async (a, kind) => { a.toolbar('save').click(); a.click(kind === 'link' ? 'Shareable link' : 'JSON file'); await a.sleep(10); };
const setPw = (a, pw) => { a.q('#xDlg input[type=text]').value = pw; };
const tick = a => { a.q('#xDlg input[type=checkbox]').checked = true; };
async function makeLink(a, { pw = PASSWORD, anon = false } = {}) {
  await protectDialog(a, 'link'); setPw(a, pw); if (anon) tick(a); a.click('Create link');
  const ta = await waitFor(() => a.q('#xDlg textarea')); return ta.value;
}
async function makeFile(a, { pw = PASSWORD, anon = false } = {}) {
  await protectDialog(a, 'file'); setPw(a, pw); if (anon) tick(a); a.click('Save file'); await waitFor(() => a.w.__file); return a.w.__file;
}
const footer = a => a.qa('#xDlg .btns button').map(b => b.textContent.trim());
const decrypt = (a, b64) => a.ev(`unseal(unb64u(${JSON.stringify(b64)}),${JSON.stringify(PASSWORD)})`);
const dataOf = link => link.split('#data=e1.')[1];

describe('R-SHARE-01 Links and files are always password-protected', () => {
  it('the Save dialog has no plain (unencrypted) export option', () => {
    const a = fresh(); a.toolbar('save').click(); expect(a.dlgButtons()).toEqual(['Browser memory', 'JSON file', 'Shareable link', 'Cancel']);
  });
  it.each([['link', 'Create link'], ['file', 'Save file']])('the %s dialog explains the protection and only offers "%s" and Cancel (no way to skip the password)', async (kind, label) => {
    const a = fresh(); await protectDialog(a, kind); expect(footer(a)).toEqual([label, 'Cancel']); expect(a.dlgText()).toMatch(/always password-protected/);
  });
  it('an empty password is refused', async () => {
    const a = fresh(); await protectDialog(a, 'file'); setPw(a, ''); a.click('Save file'); expect(a.q('#xDlg .err').textContent).toBe('The password must be at least 20 characters long.'); expect(a.w.__file).toBeUndefined();
  });
  it('the only place that creates a downloadable file in the whole app is the encrypted export', () => {
    expect((html.match(/new Blob\(/g) || []).length).toBe(1); expect(html).toMatch(/async function saveFile[\s\S]*?new Blob/);
  });
  it('the data that is exported is never written in the clear anywhere (no readable text in the file)', async () => {
    const a = fresh(); const text = await makeFile(a); expect(text).not.toMatch(/Granny|Doctor|4711|Care/);
  });
  it('in a browser without Web Crypto exporting is refused with an explanation instead of falling back to plain data', () => {
    const a = openApp({ crypto: false }); a.toolbar('save').click(); a.click('JSON file'); return a.sleep(10).then(() => { expect(a.log.alerts[0]).toContain('Encryption is not available here'); expect(a.w.__file).toBeUndefined(); expect(a.dlgOpen()).toBe(false); });
  });
});

describe('R-SHARE-02 "Leave out personal details" option', () => {
  it('is an unticked checkbox with an explanation in both the link and the file dialog', async () => {
    const a = fresh(); await protectDialog(a, 'link'); expect(a.q('#xDlg input[type=checkbox]').checked).toBe(false); expect(a.dlgText()).toContain('Leave out personal details'); expect(a.dlgText()).toMatch(/people are renamed|descriptions/i);
  });
  it('ticked: the exported link contains people as Person 1… and no descriptions, but keeps the events', async () => {
    const a = fresh(); const link = await makeLink(a, { anon: true }); const w = await decrypt(a, dataOf(link));
    expect(w.people.map(p => p.name)).toEqual(['Person 1']); expect(w.events[0].desc).toBe(''); expect(w.events[0].title).toBe('Doctor visit'); expect(JSON.stringify(w)).not.toMatch(/Rose|4711/);
  });
  it('ticked: the same applies to files', async () => {
    const a = fresh(); const text = await makeFile(a, { anon: true }); const w = await decrypt(a, JSON.parse(text).data); expect(w.people[0].name).toBe('Person 1'); expect(w.events[0].desc).toBe('');
  });
  it('unticked: everything is included', async () => {
    const a = fresh(); const w = await decrypt(a, dataOf(await makeLink(a))); expect(w.people[0].name).toBe('Granny Rose'); expect(w.events[0].desc).toBe('door code 4711');
  });
  it('the app\'s own data is not altered by an anonymised export', async () => {
    const a = fresh(); await makeFile(a, { anon: true }); expect(a.ev('S.people[0].name')).toBe('Granny Rose'); expect(a.ev('S.events[0].desc')).toBe('door code 4711');
  });
  it('an anonymised file is not counted as a backup: the workspace stays marked as unsaved', async () => {
    const a = fresh(); await makeFile(a, { anon: true }); expect(a.ev('isDirty()')).toBe(true);
  });
  it('a complete (not anonymised) file does count as a backup', async () => {
    const a = fresh(); await makeFile(a); expect(a.ev('isDirty()')).toBe(false);
  });
});

describe('R-SHARE-03 Passwords: strong by default, minimum 20 characters', () => {
  it('the password field is pre-filled with a generated 25-character password in five groups', async () => {
    const a = fresh(); await protectDialog(a, 'link'); expect(a.q('#xDlg input[type=text]').value).toMatch(/^[A-Za-z2-9]{5}(-[A-Za-z2-9]{5}){4}$/);
  });
  it('"New password" replaces it with another generated one', async () => {
    const a = fresh(); await protectDialog(a, 'link'); const first = a.q('#xDlg input[type=text]').value; a.qa('#xDlg .row button')[0].click(); expect(a.q('#xDlg input[type=text]').value).not.toBe(first);
  });
  it('a password shorter than 20 characters is refused with a message and the dialog stays open', async () => {
    const a = fresh(); await protectDialog(a, 'link'); setPw(a, 'a'.repeat(19)); a.click('Create link'); expect(a.q('#xDlg .err').textContent).toContain('at least 20 characters'); expect(a.dlgOpen()).toBe(true);
  });
  it('surrounding spaces do not count towards the length', async () => {
    const a = fresh(); await protectDialog(a, 'link'); setPw(a, '   ' + 'a'.repeat(19) + '   '); a.click('Create link'); expect(a.q('#xDlg .err').textContent).toContain('at least 20 characters');
  });
  it('exactly 20 characters is accepted', async () => {
    const a = fresh(); const link = await makeLink(a, { pw: 'p'.repeat(20) }); expect(link).toContain('#data=e1.');
  });
  it('the dialog warns to hand over the password by a different route than the link', async () => {
    const a = fresh(); await protectDialog(a, 'link'); expect(a.dlgText()).toContain('by a different route than the link or file');
  });
  it('after creating a link the dialog shows the password that was used', async () => {
    const a = fresh(); await makeLink(a, { pw: PASSWORD }); expect(a.q('#xDlg p b').textContent).toBe(PASSWORD);
  });
  it('"Copy link" and "Copy password" copy to the clipboard and confirm on the button', async () => {
    const a = fresh(); const link = await makeLink(a); const [copyLink, copyPw] = a.qa('#xDlg .btns button');
    copyLink.click(); await a.sleep(10); expect(a.w.__clip).toBe(link); expect(copyLink.textContent).toBe('Copied ✓');
    copyPw.click(); await a.sleep(10); expect(a.w.__clip).toBe(PASSWORD); expect(copyPw.textContent).toBe('Copied ✓');
  });
  it('the password is also accepted with Unicode characters and when typed with the show-password option', async () => {
    const a = fresh(); const pw = 'Zażółć-gęślą-jaźń-1234567'; const link = await makeLink(a, { pw });
    const b = openApp({ url: 'https://app.test/#data=e1.' + dataOf(link) }); await b.sleep(10); b.q('#xDlg input[type=password]').value = pw; b.q('#xDlg input[type=checkbox]').click(); b.click('Open');
    await waitFor(() => b.toast() === 'Shared schedule loaded'); expect(b.ev('S.events[0].title')).toBe('Doctor visit');
  });
});

describe('R-SHARE-05 Shareable links (the data lives in the URL fragment)', () => {
  it('a link is the page address plus #data=e1.<encrypted text>', async () => {
    const a = fresh(); const link = await makeLink(a); expect(link).toMatch(/^https:\/\/app\.test\/#data=e1\.[A-Za-z0-9_-]+$/);
  });
  it('the data is only in the fragment (after #), so it is never sent to a server', async () => {
    const a = fresh({ url: 'https://app.test/planner/?x=1' }); const link = await makeLink(a); expect(link.split('#')[0]).toBe('https://app.test/planner/?x=1'); expect(link.split('#')[0]).not.toMatch(/data=/);
  });
  it('the link contains none of the readable data', async () => {
    const a = fresh(); expect(await makeLink(a)).not.toMatch(/Granny|Doctor|4711/);
  });
  it('the dialog shows the link length and, when the app is opened from a local file, says the link only works on this computer', async () => {
    const a = fresh({ url: 'file:///home/me/index.html' }); await makeLink(a); expect(a.dlgText()).toMatch(/\d+ characters\./); expect(a.dlgText()).toContain('only works on this computer');
  });
  it('very long links (over 8,000 characters) come with a warning', async () => {
    const a = openApp(); const noise = () => Array.from({ length: 5000 }, () => String.fromCharCode(33 + Math.floor(Math.random() * 90))).join('');
    setData(a, blank({ events: Array.from({ length: 20 }, (_, i) => ev1({ id: 'e' + i, desc: noise() })) })); await makeLink(a);
    expect(a.dlgText()).toContain('This link is very long');
  });
  it('opening a link asks for the password', async () => {
    const a = fresh(); const link = await makeLink(a); const b = openApp({ url: link }); await b.sleep(10); expect(b.dlgTitle()).toBe('Password needed'); expect(b.q('#xDlg input').type).toBe('password');
  });
  it('a wrong password shows a message and lets you try again', async () => {
    const a = fresh(); const b = openApp({ url: await makeLink(a) }); await b.sleep(10); b.q('#xDlg input').value = PASSWORD + 'x'; b.click('Open');
    await waitFor(() => /Wrong password/.test(b.dlgText())); expect(b.dlgOpen()).toBe(true); expect(b.ev('S.events.length')).toBe(0);
  });
  it('the right password opens the shared workspace directly for a first-time visitor (nothing saved yet)', async () => {
    const a = fresh(); const b = openApp({ url: await makeLink(a) }); await b.sleep(10); b.q('#xDlg input').value = PASSWORD; b.click('Open');
    await waitFor(() => b.toast() === 'Shared schedule loaded'); expect(b.ev('S.events[0].title')).toBe('Doctor visit'); expect(b.ev('WS.length')).toBe(1); expect(b.ev('cw().name')).toBe('Granny care');
  });
  it('a visitor who already has data gets the import dialog instead, so nothing is overwritten silently', async () => {
    const a = fresh(); const link = await makeLink(a); const b = openApp({ url: link, storage: { [WS_KEY]: JSON.stringify({ version: 1, current: 'w', workspaces: [{ id: 'w', name: 'Mine', ...blank() }] }) } });
    await b.sleep(10); b.q('#xDlg input').value = PASSWORD; b.click('Open'); await waitFor(() => b.dlgTitle() === 'Import'); expect(b.ev('cw().name')).toBe('Mine');
  });
  it('after the password has been entered the data is gone from the address bar', async () => {
    const a = fresh(); const b = openApp({ url: await makeLink(a) }); await b.sleep(10); b.q('#xDlg input').value = PASSWORD; b.click('Open'); await waitFor(() => b.toast() === 'Shared schedule loaded'); expect(b.w.location.hash).toBe('');
  });
  it('cancelling the password dialog also removes the data from the address bar and loads nothing', async () => {
    const a = fresh(); const b = openApp({ url: await makeLink(a) }); await b.sleep(10); b.click('Cancel'); expect(b.w.location.hash).toBe(''); expect(b.ev('S.events.length')).toBe(0);
  });
  it.each([['#data=e1.@@@@'], ['#data=plain-old-link'], ['#data=e2.AAAA']])('a damaged or unknown link %s is refused with a message and cleaned from the address', async hash => {
    const b = openApp({ url: 'https://app.test/' + hash }); await b.sleep(10); expect(b.toast()).toBe('The shared link is invalid or damaged.'); expect(b.w.location.hash).toBe(''); expect(b.dlgOpen()).toBe(false);
  });
  it('a link with an empty payload still asks for a password and then reports that it is not a valid save', async () => {
    const b = openApp({ url: 'https://app.test/#data=e1.' }); await b.sleep(10); b.q('#xDlg input').value = PASSWORD; b.click('Open'); await waitFor(() => /not a valid schedule save file/.test(b.dlgText()));
  });
  it('a damaged encrypted link asks for the password but then says the data was altered', async () => {
    const a = fresh(); const data = dataOf(await makeLink(a)); const broken = data.slice(0, -6) + (data.at(-6) === 'A' ? 'B' : 'A') + data.slice(-5);
    const b = openApp({ url: 'https://app.test/#data=e1.' + broken }); await b.sleep(10); b.q('#xDlg input').value = PASSWORD; b.click('Open'); await waitFor(() => /altered/.test(b.dlgText()));
  });
  it('a link opened in a browser without Web Crypto says that encryption is not available', async () => {
    const b = openApp({ url: 'https://app.test/#data=e1.AAAA', crypto: false }); await b.sleep(10); expect(b.toast()).toContain('Encryption is not available here');
  });
  it('a link pasted into an already running page (hash change) is handled too', async () => {
    const a = fresh(); const link = await makeLink(a); const b = openApp(); b.w.location.hash = '#data=e1.' + dataOf(link); await waitFor(() => b.dlgTitle() === 'Password needed');
  });
  it('a link with too many items is refused after decryption with the size message', async () => {
    const a = openApp(); const huge = JSON.stringify(workspace({ events: Array.from({ length: 5001 }, (_, i) => ev1({ id: 'e' + i })) }));
    const blob = await a.ev(`seal(JSON.parse(${JSON.stringify(huge)}),${JSON.stringify(PASSWORD)}).then(b=>b64u(b))`);
    const b = openApp({ url: 'https://app.test/#data=e1.' + blob }); await b.sleep(10); b.q('#xDlg input').value = PASSWORD; b.click('Open'); await waitFor(() => /too many items/.test(b.toast()));
  });
});

describe('R-SHARE-06 Encrypted JSON files', () => {
  it('the file is named weekly-schedules-<date>-encrypted.json', async () => {
    const a = fresh(); await makeFile(a); expect(a.w.__download).toMatch(/^weekly-schedules-\d{4}-\d{2}-\d{2}-encrypted\.json$/);
  });
  it('the file is a small container with format, version and the encrypted data', async () => {
    const a = fresh(); const f = JSON.parse(await makeFile(a)); expect(Object.keys(f).sort()).toEqual(['data', 'format', 'version']); expect(f).toMatchObject({ format: 'weekly-schedules-encrypted', version: 1 });
  });
  it('a toast confirms the save', async () => {
    const a = fresh(); await makeFile(a); expect(a.toast()).toBe('Saved to JSON file');
  });
  it('contains only the current workspace, and never asks which workspaces to save', async () => {
    const a = fresh(); a.ev('addWorkspace()'); a.ev('switchWs(WS[0].id)'); a.toolbar('save').click(); a.click('JSON file'); await a.sleep(10); expect(a.dlgTitle()).toBe('Save encrypted file');
    setPw(a, PASSWORD); a.click('Save file'); await waitFor(() => a.w.__file); const w = await decrypt(a, JSON.parse(a.w.__file).data); expect(w.name).toBe('Granny care'); expect(w.events).toHaveLength(1);
  });
  it('opening it asks for the password, then offers the import choices', async () => {
    const a = fresh(); const text = await makeFile(a); const b = openApp({ promptAnswer: 'x', storage: { [WS_KEY]: JSON.stringify({ version: 1, current: 'w', workspaces: [{ id: 'w', name: 'Mine', ...blank() }] }) } });
    b.d.getElementById('file').onchange({ target: { files: [{ name: 'f.json', text: async () => text }], value: '' } }); await waitFor(() => b.dlgTitle() === 'Password needed');
    b.q('#xDlg input').value = PASSWORD; b.click('Open'); await waitFor(() => b.dlgTitle() === 'Import'); expect(b.dlgText()).toContain('Granny care');
  });
  it('the password is asked again after a mistake and the file stays unopened until it is right', async () => {
    const a = fresh(); const text = await makeFile(a); const b = openApp();
    b.d.getElementById('file').onchange({ target: { files: [{ name: 'f.json', text: async () => text }], value: '' } }); await waitFor(() => b.dlgTitle() === 'Password needed');
    b.q('#xDlg input').value = 'wrong'; b.click('Open'); await waitFor(() => /Wrong password/.test(b.dlgText())); expect(b.ev('S.events.length')).toBe(0);
  });
  it('plain JSON files from earlier versions can still be opened (only creating them is gone)', async () => {
    const b = openApp(); b.d.getElementById('file').onchange({ target: { files: [{ name: 'old.json', text: async () => JSON.stringify(workspace()) }], value: '' } }); await b.sleep(30); expect(b.dlgTitle()).toBe('Import'); expect(b.dlgText()).toContain('Test workspace');
  });
  it('an encrypted file whose inner format version is unknown is refused after the password step', async () => {
    const a = fresh(); const f = JSON.parse(await makeFile(a)); const bytes = Buffer.from(f.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64'); bytes[0] = 9;
    f.data = bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const b = openApp(); b.d.getElementById('file').onchange({ target: { files: [{ name: 'f.json', text: async () => JSON.stringify(f) }], value: '' } }); await waitFor(() => b.dlgTitle() === 'Password needed');
    b.q('#xDlg input').value = PASSWORD; b.click('Open'); await waitFor(() => /not a valid schedule save file/.test(b.dlgText()));
  });
  it('an encrypted file opened without Web Crypto explains why it cannot be read', async () => {
    const a = fresh(); const text = await makeFile(a); const b = openApp({ crypto: false });
    b.d.getElementById('file').onchange({ target: { files: [{ name: 'f.json', text: async () => text }], value: '' } }); await b.sleep(30); expect(b.log.alerts[0]).toContain('Encryption is not available here');
  });
});
