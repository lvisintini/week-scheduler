// The app's ES modules (js/): the order in which a browser runs them, and the classic-script form that jsdom needs (jsdom does not run
// <script type="module">). Imports are one line each, `import {a,b} from './x.js';`, at the top of a file (tests/unit/modules.test.js).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const IMPORT = /^import \{([^}]*)\} from '\.\/([a-z0-9]+\.js)';$/gm;
const EXPORT = /(^|[;}])(\s*)export (?=(?:const|let|function|async)\b)/gm;
export const readJs = f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');

/** The files of js/ in the order a browser evaluates them, starting from the entry main.js: depth first, each file after its imports,
 *  in the order of its import lines (a file already started is skipped), as 'js/x.js'. */
export function moduleOrder(entry = 'main.js') {
  const out = [], seen = new Set();
  const visit = f => { if (seen.has(f)) return; seen.add(f); for (const m of readJs(f).matchAll(IMPORT)) visit(m[2]); out.push(f); };
  visit(entry);
  return out.map(f => 'js/' + f);
}

/** A module as a classic script: strict like a module, the import lines left empty (so line numbers stay) and `export ` removed.
 *  Run one after another in moduleOrder(), the files then share one global scope, so the tests can reach any name with a.ev('…'). */
export const classic = src => "'use strict';" + src.replace(IMPORT, '').replace(EXPORT, '$1$2');
