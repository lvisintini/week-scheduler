// The structure of the code (R-CODE-01): ES modules in js/, one entry, imports that resolve, and no use of another file at load.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import * as espree from 'espree';
import * as escope from 'eslint-scope';
import { moduleOrder, readJs, IMPORT } from '../helpers/modules.js';
import { rawHtml } from '../helpers/app.js';

const files = fs.readdirSync(new URL('../../js', import.meta.url)).filter(f => f.endsWith('.js')).sort();
const parse = f => { const ast = espree.parse(readJs(f), { ecmaVersion: 'latest', sourceType: 'module', range: true, loc: true }); return { ast, sm: escope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' }) }; };
const exportsOf = ast => new Set(ast.body.filter(s => s.type === 'ExportNamedDeclaration').flatMap(s => s.declaration.type === 'VariableDeclaration' ? s.declaration.declarations.map(d => d.id.name) : [s.declaration.id.name]));

/** The names a module uses at load (outside any function), directly or through one of its own functions that it calls at load, that come
 *  from another file other than state.js. */
function usedAtLoad(f) {
  const { ast, sm } = parse(f), src = readJs(f), called = r => src[r.identifier.range[1]] === '(', mod = sm.scopes.find(s => s.type === 'module');
  const imported = new Map(mod.variables.filter(v => v.defs.some(d => d.type === 'ImportBinding')).map(v => [v, v.defs[0].parent.source.value]));
  const fns = new Map();   // own top-level functions: name -> node
  for (const s of ast.body) {
    const d = s.type === 'ExportNamedDeclaration' ? s.declaration : s;
    if (d && d.type === 'FunctionDeclaration') fns.set(d.id.name, d);
    if (d && d.type === 'VariableDeclaration') for (const x of d.declarations) if (x.init && /Function/.test(x.init.type)) fns.set(x.id.name, x.init);
  }
  const inside = (r, n) => r.identifier.range[0] >= n.range[0] && r.identifier.range[1] <= n.range[1];
  const refs = sm.scopes.flatMap(s => s.references);
  const reach = (node, seen) => refs.filter(r => inside(r, node) && r.resolved).flatMap(r => {
    if (imported.has(r.resolved)) return imported.get(r.resolved) === './state.js' ? [] : [r.identifier.name];
    const fn = fns.get(r.resolved.name);
    return fn && r.resolved.scope === mod && called(r) && !seen.has(fn) ? (seen.add(fn), reach(fn, seen)) : [];
  });
  // code that runs at load: references made in the module scope or its blocks, not inside a function
  const atLoad = sm.scopes.filter(s => s.type === 'module' || ((s.type === 'block' || s.type === 'for' || s.type === 'catch') && !s.variableScope.block.type.includes('Function')));
  return [...new Set(atLoad.flatMap(s => s.references).filter(r => r.resolved).flatMap(r => {
    if (imported.has(r.resolved)) return imported.get(r.resolved) === './state.js' ? [] : [r.identifier.name];
    const fn = fns.get(r.resolved.name);
    return fn && r.resolved.scope === mod && called(r) ? reach(fn, new Set([fn])).map(n => n + ' (through ' + r.identifier.name + ')') : [];
  }))];
}

describe('R-CODE-01 The code is ES modules: one entry, imports that resolve, the shared state in one object', () => {
  it('index.html loads one script, the module js/main.js, and main.js brings in every file of js/', () => {
    expect([...rawHtml.matchAll(/<script\b[^>]*>/g)].map(m => m[0])).toEqual(['<script type="module" src="js/main.js">']);
    expect(moduleOrder().map(f => f.slice(3)).sort()).toEqual(files);
  });
  it('state.js has no imports and runs first; main.js runs last', () => {
    expect(readJs('state.js')).not.toMatch(/^import /m);
    const order = moduleOrder(); expect(order[0]).toBe('js/state.js'); expect(order.at(-1)).toBe('js/main.js');
  });
  it('imports are one line each at the top of a file, of named bindings from a file of js/', () => {
    for (const f of files) {
      const { ast } = parse(f), src = readJs(f), imports = ast.body.filter(s => s.type === 'ImportDeclaration');
      expect(ast.body.slice(0, imports.length).every(s => s.type === 'ImportDeclaration'), f).toBe(true);
      expect(src.match(/^import .*$/gm) || [], f).toEqual(imports.map(s => src.slice(s.range[0], s.range[1])));
      expect(imports.every(s => s.specifiers.every(x => x.type === 'ImportSpecifier' && x.imported.name === x.local.name)), f).toBe(true);
      expect((src.match(IMPORT) || []).length, f).toBe(imports.length);
    }
  });
  it('every imported name is exported by the file it is imported from', () => {
    const ex = Object.fromEntries(files.map(f => [f, exportsOf(parse(f).ast)])), missing = [];
    for (const f of files) for (const m of readJs(f).matchAll(IMPORT)) for (const n of m[1].split(',')) if (!ex[m[2]] || !ex[m[2]].has(n)) missing.push(`${f}: ${n} from ${m[2]}`);
    expect(missing).toEqual([]);
  });
  it('an imported name is never assigned: state that other files change lives in state.js', () => {
    const bad = [];
    for (const f of files) { const { sm } = parse(f), mod = sm.scopes.find(s => s.type === 'module');
      for (const v of mod.variables) if (v.defs.some(d => d.type === 'ImportBinding')) for (const r of v.references) if (r.isWrite()) bad.push(`${f}:${r.identifier.loc.start.line} ${v.name}`); }
    expect(bad).toEqual([]);
  });
  it('code that runs at load uses nothing from another file but state; the rest waits for main.js to call it', () => {
    const bad = Object.fromEntries(files.filter(f => f !== 'main.js').map(f => [f, usedAtLoad(f)]).filter(([, v]) => v.length));
    expect(bad).toEqual({});
  });
});
