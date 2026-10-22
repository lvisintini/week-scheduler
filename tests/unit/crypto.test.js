import { describe, it, expect } from 'vitest';
import { openApp, PASSWORD } from '../helpers/app.js';

const app = openApp();
const ev = c => app.ev(c);
const OBJ = { name: 'Secret Granny Care', people: ['Ann Müller', '李雷'], n: [1, 2, 3] };
const seal = (obj = OBJ, pw = PASSWORD, w = app) => w.ev(`seal(${JSON.stringify(obj)},${JSON.stringify(pw)}).then(b=>Array.from(b))`).then(a => Uint8Array.from(a));
const unseal = (bytes, pw = PASSWORD, w = app) => w.ev(`unseal(Uint8Array.from(${JSON.stringify(Array.from(bytes))}),${JSON.stringify(pw)})`);
const message = async p => { try { await p; return 'ok'; } catch (e) { return e.message; } };

describe('R-SHARE-03 Generated passwords', () => {
  const batch = Array.from({ length: 300 }, () => ev('genPassword()'));
  it('are 25 random characters in 5 groups of 5 separated by dashes', () => {
    batch.forEach(p => expect(p).toMatch(/^[A-Za-z2-9]{5}(-[A-Za-z2-9]{5}){4}$/));
  });
  it('contain at least 20 characters even without the dashes', () => {
    batch.forEach(p => expect(p.replace(/-/g, '').length).toBeGreaterThanOrEqual(20));
  });
  it('never use look-alike characters (0, O, 1, l, I)', () => {
    batch.forEach(p => expect(p).not.toMatch(/[0O1lI]/));
  });
  it('are all different from each other', () => { expect(new Set(batch).size).toBe(batch.length); });
  it('use the whole alphabet roughly evenly (no obvious bias)', () => {
    const chars = batch.join('').replace(/-/g, ''), counts = {};
    for (const c of chars) counts[c] = (counts[c] || 0) + 1;
    const alphabet = Object.keys(counts); expect(alphabet.length).toBe(56);
    const expected = chars.length / 56;
    alphabet.forEach(c => { expect(counts[c]).toBeGreaterThan(expected * 0.55); expect(counts[c]).toBeLessThan(expected * 1.45); });
  });
});

describe('R-SHARE-04 Encryption (AES-256-GCM with a PBKDF2 key)', () => {
  it('data encrypted with a password comes back identical with the same password', async () => {
    expect(await unseal(await seal())).toEqual(OBJ);
  });
  it('works with Unicode passwords as well', async () => {
    const pw = 'Pässwörd-日本語-кириллица-1234567890';
    expect(await unseal(await seal(OBJ, pw), pw)).toEqual(OBJ);
  });
  it('a wrong password is refused', async () => {
    expect(await message(unseal(await seal(), PASSWORD + 'x'))).toBe('password');
  });
  it('the encrypted bytes contain none of the readable text', async () => {
    const text = Buffer.from(await seal()).toString('latin1');
    expect(text).not.toMatch(/Granny|Secret|Müller/);
  });
  it('every encryption uses a fresh random salt and IV, so identical data gives different output', async () => {
    const a = await seal(), b = await seal();
    expect(Buffer.from(a.slice(5, 33)).equals(Buffer.from(b.slice(5, 33)))).toBe(false);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });
  it.each([['the encrypted payload', b => b.length - 3], ['the authentication tag', b => b.length - 1], ['the salt', () => 6], ['the IV', () => 25]])(
    'changing a single byte of %s is detected', async (_, idx) => {
      const blob = await seal(); blob[idx(blob)] ^= 1;
      expect(await message(unseal(blob))).toBe('password');
    });
  it('truncated data is refused', async () => {
    const blob = await seal();
    expect(await message(unseal(blob.slice(0, 40)))).toBe('format');
    expect(await message(unseal(blob.slice(0, blob.length - 4)))).toBe('password');
  });
  it('a layout byte of a later version is refused as newer, an impossible one (0) as not valid', async () => {
    const blob = await seal(); blob[0] = 9; expect(await message(unseal(blob))).toBe('newer');
    const b2 = await seal(); b2[0] = 0; expect(await message(unseal(b2))).toBe('format');
  });
  it.each([[1], [99999], [2000001], [4294967295]])('a crafted iteration count of %i is refused immediately, without long computation', async iter => {
    const blob = await seal(); new DataView(blob.buffer).setUint32(1, iter);
    const t0 = Date.now(); expect(await message(unseal(blob))).toBe('format'); expect(Date.now() - t0).toBeLessThan(500);
  });
  it('works in a browser without compression support (the data is stored uncompressed, flagged inside)', async () => {
    const plain = openApp({ compression: false });
    const blob = await seal(OBJ, PASSWORD, plain);
    expect(await unseal(blob, PASSWORD, plain)).toEqual(OBJ);
    expect(await unseal(blob, PASSWORD, app)).toEqual(OBJ);
  });
  it('a decompression bomb (tiny encrypted data that expands past 2 MB) is refused as too big', async () => {
    const blob = await ev(`(async()=>{const z=await deflate(new Uint8Array(3e6));const i=new Uint8Array(1+z.length);i[0]=1;i.set(z,1);return Array.from(await encryptBytes(i,${JSON.stringify(PASSWORD)}))})()`);
    expect(blob.length).toBeLessThan(20000);
    expect(await message(unseal(Uint8Array.from(blob)))).toBe('big');
  });
  it('the password is normalised, so visually identical Unicode spellings work', async () => {
    const composed = 'caf\u00e9-caf\u00e9-caf\u00e9-caf\u00e9-caf\u00e9', decomposed = 'cafe\u0301-cafe\u0301-cafe\u0301-cafe\u0301-cafe\u0301';
    expect(await unseal(await seal(OBJ, composed), decomposed)).toEqual(OBJ);
  });
});

describe('R-SHARE-02 "Leave out personal details" (anonymised)', () => {
  const rich = { people: [{ id: 'a', name: 'Granny Rose' }, { id: 'b', name: 'Tom' }], events: [{ id: 'e', desc: 'door code 4711', involved: ['a'], slots: [{ person: 'a' }] }], phases: [{ id: 'p', desc: 'note' }], name: 'Care', schedules: [{ name: 'Home' }] };
  const anon = () => ev(`anonymised(${JSON.stringify(rich)})`);
  it('people are renamed to Person 1, Person 2, …', () => { expect(anon().people.map(p => p.name)).toEqual(['Person 1', 'Person 2']); });
  it('event and phase descriptions are removed', () => { expect(anon().events[0].desc).toBe(''); expect(anon().phases[0].desc).toBe(''); });
  it('references between events and people keep working', () => { expect(anon().events[0].involved).toEqual(['a']); expect(anon().events[0].slots[0].person).toBe('a'); });
  it('titles and schedule and workspace names are deliberately kept', () => { expect(anon().name).toBe('Care'); expect(anon().schedules[0].name).toBe('Home'); });
  it('the original data is not modified', () => { const copy = JSON.parse(JSON.stringify(rich)); ev(`(()=>{const o=${JSON.stringify(rich)};anonymised(o);return o})()`); expect(rich).toEqual(copy); });
  it('in Spanish the people become Persona 1, Persona 2', () => {
    const es = openApp({ languages: ['es-ES'] });
    expect(es.ev(`anonymised(${JSON.stringify(rich)}).people[0].name`)).toBe('Persona 1');
  });
});
