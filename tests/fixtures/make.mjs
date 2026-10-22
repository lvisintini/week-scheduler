// Writes the sample files of the CURRENT data format into tests/fixtures/v<FMT>/, using the app itself
// (index.html in jsdom, through its real save functions). Run it once per format version:
//   node tests/fixtures/make.mjs
// It refuses to touch a folder that already exists: published formats are frozen (docs/requirements/data.md, R-DATA-08).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openApp, setData, WS_KEY, PREFS_KEY } from '../helpers/app.js';
import { household, grandparents, prefsSample, FIXTURE_PASSWORD } from './household.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const a = openApp();
const FMT = a.ev('FMT'), dir = path.join(here, 'v' + FMT);
if (fs.existsSync(dir)) { console.error(`${dir} already exists; published sample files are never regenerated.`); process.exit(1); }
const waitFor = async fn => { for (let i = 0; i < 400; i++) { const v = fn(); if (v) return v; await new Promise(r => setTimeout(r, 25)); } throw new Error('timed out'); };

setData(a, household);
a.ev("(()=>{const w=cw();w.id='ws-family';curId=w.id;w.name='Family week';const g=newWs('Grandparents',parseData(" + JSON.stringify(grandparents) + "),false);g.id='ws-gp';WS.push(g)})()");
const out = {};
a.ev("saveMem('all')"); out['store.json'] = a.storage()[WS_KEY];
if (a.ev('typeof protectMem') === 'function') { await a.ev(`protectMem(${JSON.stringify(FIXTURE_PASSWORD)})`); out['store-protected.json'] = a.storage()[WS_KEY]; await a.ev(`unprotectMem(${JSON.stringify(FIXTURE_PASSWORD)})`); }   // R-DATA-11, from format 14
a.ev('saveFile(null,false)'); out['workspace.json'] = await waitFor(() => a.w.__file);
a.w.__file = undefined; a.ev(`saveFile(${JSON.stringify(FIXTURE_PASSWORD)},false)`); out['encrypted.json'] = await waitFor(() => a.w.__file);
a.ev(`openShare(${JSON.stringify(FIXTURE_PASSWORD)},false)`); out['link.txt'] = (await waitFor(() => a.q('#xDlg textarea'))).value;
a.ev(`Object.assign(prefs,${JSON.stringify(prefsSample)});savePrefs()`); out['prefs.json'] = a.storage()[PREFS_KEY];
if (a.log.errors.length) throw new Error(a.log.errors.join('\n'));

fs.mkdirSync(dir);
for (const [name, text] of Object.entries(out)) fs.writeFileSync(path.join(dir, name), text);
console.log(`Wrote ${Object.keys(out).join(', ')} to ${path.relative(process.cwd(), dir)}`);
process.exit(0);   // the app keeps timers running (now line)
