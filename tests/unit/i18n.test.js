import { describe, it, expect } from 'vitest';
import { openApp, html } from '../helpers/app.js';

const app = openApp();
const D = app.ev('JSON.parse(JSON.stringify(D))');
const script = html.slice(html.indexOf('<script>'), html.lastIndexOf('</script>'));
const enKeys = Object.keys(D.en), esKeys = Object.keys(D.es);

describe('R-I18N-01 English and Spanish translations are complete and consistent', () => {
  it('Spanish has exactly the same keys as English', () => {
    expect(esKeys.filter(k => !enKeys.includes(k))).toEqual([]);
    expect(enKeys.filter(k => !esKeys.includes(k))).toEqual([]);
  });
  it('every text key used by the code exists in the translations', () => {
    const used = new Set([...script.matchAll(/\bL\('([A-Za-z0-9_]+)'/g)].map(m => m[1]));
    [...script.matchAll(/\bL\([^'()]*\?\s*'([A-Za-z0-9_]+)'\s*:\s*'([A-Za-z0-9_]+)'/g)].forEach(m => { used.add(m[1]); used.add(m[2]); });
    [...used].filter(k => !(k in D.en) && !/^help$/.test(k)).forEach(k => expect.soft(D.en, `missing key ${k}`).toHaveProperty(k));
  });
  it('no translation text is unused (dead strings are removed)', () => {
    const rest = script.replace(/const D=\{en:\{[\s\S]*?\n\};?\nconst ES=/, 'const ES=');
    const unused = enKeys.filter(k => !new RegExp(`['"]${k}['"]`).test(rest) && !/^help\d+$/.test(k));
    expect(unused).toEqual([]);
  });
  it('placeholders such as {n} are the same in English and Spanish for every text', () => {
    const ph = s => (s.match(/\{[a-z]+\}/g) || []).sort().join();
    enKeys.forEach(k => expect.soft(ph(D.es[k]), `placeholders of ${k}`).toBe(ph(D.en[k])));
  });
  it('almost all Spanish texts differ from the English ones (nothing was forgotten untranslated)', () => {
    const same = enKeys.filter(k => D.en[k] === D.es[k] && /[a-z]{4,}/i.test(D.en[k]));
    expect(same.length).toBeLessThanOrEqual(6);
  });
  it('the fixed texts of the event dialog are translated when the language is Spanish', () => {
    const es = openApp({ languages: ['es-ES'] });
    es.ev('openDlg(null)');
    const labels = es.qa('#dlg label').map(l => l.textContent);
    expect(labels).toContain('Título *'); expect(labels).toContain('Descripción'); expect(labels).toContain('Titular'); expect(labels).toContain('Con');
    expect(es.qa('#dlg .fsec span').map(x => x.textContent)).toEqual(['Quién', 'Cuándo', 'Cómo encaja', 'Horarios *', 'Ritmos *']); expect(es.qa('#paneQ .dhd span').map(x => x.textContent).filter(Boolean)).toEqual(['Días', 'Semana', 'Inicio', 'Fin', 'Lo hace', 'Con', 'Color', 'Horas']);
    expect(es.q('#fOk').textContent).toBe('Guardar');
  });
  it('every static Spanish phrase in the dialog table matches some text that is really in the page', () => {
    const rows = app.ev('ES.map(r=>r[0])');
    const dialogHtml = html.slice(html.indexOf('<dialog id="dlg">'), html.indexOf('<div id="pr">'));
    rows.filter(k => !/Language/.test(k)).forEach(k => expect.soft(dialogHtml.includes(k), `static phrase "${k}" is not in the dialogs`).toBe(true));
  });
});

describe('R-I18N-01 The interface language follows the browser and can be switched', () => {
  it.each([[['es-ES'], 'Eventos'], [['es'], 'Eventos'], [['en-US'], 'Events'], [['fr-FR'], 'Events'], [['en-GB', 'es'], 'Events'], [['es-MX', 'en'], 'Eventos']])(
    'with browser languages %j the Events/Phases switch reads "%s"', (langs, word) => {
      expect(openApp({ languages: langs }).q('.seg button').textContent).toBe(word);
    });
  it('switching the language in Settings re-translates the sidebar and the day headers at once', () => {
    const a = openApp(); a.ev('openSettings()');
    const select = a.q('#xDlg select'); select.value = 'es'; select.onchange();
    expect(a.q('.seg button').textContent).toBe('Eventos');
    expect(a.q('.dh:not(.c)').textContent).toBe('Lunes');
    expect(a.q('#xDlg h3').textContent).toBe('Ajustes');
    expect(a.d.documentElement.lang).toBe('es');
  });
  it('the Spanish week starts on Lunes and ends on Domingo', () => {
    const es = openApp({ languages: ['es-ES'] });
    expect(es.qa('.dh:not(.c)').map(h => h.textContent)).toEqual(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']);
  });
  it('the default workspace content is created in the interface language', () => {
    const es = openApp({ languages: ['es-ES'] });
    expect(es.ev('state.S.schedules[0].name')).toBe('Rutina'); expect(es.ev('state.S.rhythms[0].name')).toBe('Ritmo normal'); expect(es.ev('cw().name')).toBe('Espacio de trabajo');
  });
});

describe('R-I18N-02 Descriptions, tooltips and help are household/workplace agnostic', () => {
  const ES = app.ev('JSON.parse(JSON.stringify(ES))');
  const titles = [...html.matchAll(/\stitle="([^"]*)"/g)].map(m => m[1]);
  const en = [...Object.values(D.en), ...titles], es = [...Object.values(D.es), ...ES.map(r => r[1])];
  const hits = (texts, re) => texts.filter(t => re.test(t));
  it('English texts never speak of the household alone, only of the "household/workplace"', () => {
    expect(hits(en, /\bhousehold\b(?!\/workplace)|\b(not at home|school run|gardener|of the household)\b/i)).toEqual([]);
  });
  it('Spanish texts never speak of the home alone, only of the "hogar o lugar de trabajo"', () => {
    expect(hits(es, /\bhogar\b(?! o lugar de trabajo)|los de casa|no es de casa|personas de casa|de fuera de casa|no están? en casa|jardiner/i)).toEqual([]);
  });
  it('the household/workplace wording is really used where the household used to be named', () => {
    expect(D.en.extTip).toMatch(/^For someone from outside the household\/workplace/); expect(D.es.extTip).toMatch(/^Para alguien de fuera del hogar o lugar de trabajo/);
    expect(D.en.help18).toContain('household/workplace'); expect(D.es.help18).toContain('hogar o lugar de trabajo');
  });
});
