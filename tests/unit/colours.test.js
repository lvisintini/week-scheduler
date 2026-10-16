import { describe, it, expect } from 'vitest';
import { openApp } from '../helpers/app.js';

const app = openApp();
const ev = c => app.ev(c);
const lightness = hex => ev(`hexToHsl(${JSON.stringify(hex)})[2]`);
const hue = hex => ev(`hexToHsl(${JSON.stringify(hex)})[0]`);

describe('R-SEC-02 Colours are reduced to safe #rrggbb values (normHex)', () => {
  it.each([['#abc', '#aabbcc'], ['ABCDEF', '#abcdef'], ['#3B6DF0', '#3b6df0'], ['  #ffffff ', '#ffffff'], ['#000', '#000000']])(
    'accepts %j and returns %j', (input, out) => expect(ev(`normHex(${JSON.stringify(input)})`)).toBe(out));
  it.each([['red'], ['url(https://evil.example/x)'], ['#12'], ['#gggggg'], ['rgb(1,2,3)'], ['red;background:url(//x)'], [''], ['#3b6df0"><img src=x>']])(
    'the unsafe or malformed colour value %j is rejected (nothing is returned)', input => expect(ev(`normHex(${JSON.stringify(input)})`)).toBeNull());
});

describe('R-EVT-07 Copy colours: same hue, brighter or darker', () => {
  it('colour maths round-trips: hex → hue/saturation/lightness → hex', () => {
    for (const c of ['#3b6df0', '#e5484d', '#2fa66a', '#8e4ec6', '#f5c518', '#808080']) {
      expect(ev(`(([h,s,l])=>hslToHex(h,s,l))(hexToHsl(${JSON.stringify(c)}))`)).toBe(c);
    }
  });
  it('a dark colour is made lighter and a light colour is made darker', () => {
    expect(lightness(ev('shiftColor("#1d2330",[])'))).toBeGreaterThan(lightness('#1d2330'));
    expect(lightness(ev('shiftColor("#f5c518",[])'))).toBeLessThan(lightness('#f5c518'));
  });
  it('the hue stays the same (within rounding) when only brightness changes', () => {
    const shifted = ev('shiftColor("#3b6df0",[])');
    expect(Math.abs(hue(shifted) - hue('#3b6df0'))).toBeLessThan(3);
  });
  it('the new colour is never identical to the original', () => {
    for (const c of ['#3b6df0', '#ffffff', '#000000', '#808080']) expect(ev(`shiftColor(${JSON.stringify(c)},[])`)).not.toBe(c);
  });
  it('colours already used in the destination are avoided when possible', () => {
    const first = ev('shiftColor("#3b6df0",[])');
    const second = ev(`shiftColor("#3b6df0",[${JSON.stringify(first)}])`);
    expect(second).not.toBe(first);
  });
  it('the result stays readable: lightness is kept between 22% and 78%', () => {
    for (const c of ['#101010', '#fafafa', '#3b6df0']) { const l = lightness(ev(`shiftColor(${JSON.stringify(c)},[])`)); expect(l).toBeGreaterThanOrEqual(0.21); expect(l).toBeLessThanOrEqual(0.79); }
  });
  it('random colours are valid hex values and avoid colours that are already used', () => {
    const used = ['#336699'];
    for (let i = 0; i < 20; i++) { const c = ev(`randomColor(${JSON.stringify(used)})`); expect(c).toMatch(/^#[0-9a-f]{6}$/); expect(used).not.toContain(c); }
  });
});

describe('R-PHS-04 Lip text colour contrasts with the lip background', () => {
  const ratio = (bg, fg) => { const L = c => app.ev(`lum(${JSON.stringify(c)})`); const [a, b] = [L(bg), L(fg)].sort((x, y) => y - x); return (a + 0.05) / (b + 0.05); };
  it('white and very light backgrounds get dark text', () => {
    expect(ev('ink("#ffffff")')).toBe('#1d2330');
    expect(ev('ink("#fafafa")')).toBe('#1d2330');
  });
  it('dark and mid-tone backgrounds get white text', () => {
    expect(ev('ink("#1d2330")')).toBe('#fff');
    expect(ev('ink("#3b6df0")')).toBe('#fff');
    expect(ev('ink("#8e4ec6")')).toBe('#fff');
  });
  it('bright yellows, light greens and oranges get dark text, as their luminance is high', () => {
    for (const c of ['#f5c518', '#7bc043', '#e8912d', '#12a5b5']) expect.soft(ev(`ink(${JSON.stringify(c)})`), c).toBe('#1d2330');
  });
  it('whichever text colour is chosen, the contrast with the background is at least 3:1 for every palette colour', () => {
    const palette = ['#3b6df0', '#e5484d', '#2fa66a', '#e8912d', '#8e4ec6', '#12a5b5', '#d6409f', '#6b7385', '#1d2330', '#f5c518', '#7bc043'];
    for (const c of palette) expect.soft(ratio(c, ev(`ink(${JSON.stringify(c)})`) === '#fff' ? '#ffffff' : '#1d2330'), c).toBeGreaterThanOrEqual(3);
  });
  it('an invalid colour falls back safely instead of throwing', () => { expect(ev('ink("nonsense")')).toBe('#fff'); });
});

describe('R-GRID-06 Hour labels and other muted text are readable (WCAG AA, 4.5:1)', () => {
  const ratio = (x, y) => { const L = c => app.ev(`lum(${JSON.stringify(c)})`); const [a, b] = [L(x), L(y)].sort((p, q) => q - p); return (a + 0.05) / (b + 0.05); };
  const css = () => [...app.qa('style')].map(s => s.textContent).join('');
  const theme = re => Object.fromEntries([...css().match(re)[1].matchAll(/--(\w+):(#[0-9a-f]{3,6})\b/g)].map(m => [m[1], app.ev(`normHex(${JSON.stringify(m[2])})`)]));
  it('in the light theme the muted grey of the hour labels has at least 4.5:1 on the page and card backgrounds', () => {
    const t = theme(/:root\{color-scheme:light;([^}]*)\}/); expect(ratio(t.mut, t.bg)).toBeGreaterThanOrEqual(4.5); expect(ratio(t.mut, t.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('in the dark theme the muted grey has at least 4.5:1 on the page and card backgrounds', () => {
    const t = theme(/:root\[data-theme="dark"\]\{([^}]*)\}/); expect(ratio(t.mut, t.bg)).toBeGreaterThanOrEqual(4.5); expect(ratio(t.mut, t.card)).toBeGreaterThanOrEqual(4.5);
  });
});
