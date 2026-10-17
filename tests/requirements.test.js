// Traceability: every requirement ID defined in docs/requirements/*.md must be named in at least one test title, and every
// ID named in a test title must be defined there. Also guards the quality of the test descriptions shown on the console.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers/app.js';

const REQ_DIR = path.join(ROOT, 'docs', 'requirements');
const DEF = /\*\*(R-[A-Z0-9]+-\d+)\*\*/g;
const reqFiles = fs.readdirSync(REQ_DIR).filter(f => f.endsWith('.md')).sort();
const definitions = reqFiles.flatMap(f => [...fs.readFileSync(path.join(REQ_DIR, f), 'utf8').matchAll(DEF)].map(m => ({ file: f, id: m[1] })));
const requirementIds = [...new Set(definitions.map(d => d.id))].sort();

function testFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'helpers' ? [] : testFiles(p);
    return /\.(test|spec)\.js$/.test(e.name) && e.name !== 'requirements.test.js' ? [p] : [];
  });
}
const TITLE = /\b(describe|it|test)((?:\.(?:each\((?:[^()]|\([^()]*\))*\)|fails|skip|only|todo|concurrent))*)\(\s*(['"`])((?:\\.|(?!\3)[^\\])*)\3/g;
const titles = testFiles(path.join(ROOT, 'tests')).flatMap(file => {
  const src = fs.readFileSync(file, 'utf8'); const rel = path.relative(ROOT, file);
  return [...src.matchAll(TITLE)].map(m => ({ file: rel, kind: m[1], mods: m[2], title: m[4] }));
});
const idsIn = t => t.match(/R-[A-Z0-9]+-\d+/g) || [];
const tests = titles.filter(t => t.kind !== 'describe');

describe('Requirements traceability (docs/requirements ↔ tests)', () => {
  it('the requirement files define requirement IDs and the test files could be scanned', () => {
    expect(requirementIds.length).toBeGreaterThan(50); expect(titles.length).toBeGreaterThan(200);
  });
  it.each(requirementIds)('requirement %s is named in at least one test or test group', id => {
    const hits = titles.filter(t => idsIn(t.title).includes(id)); expect(hits.length, `No test mentions ${id}`).toBeGreaterThan(0);
  });
  it('each requirement ID is defined exactly once across the requirement files (nothing duplicated or merged)', () => {
    const twice = requirementIds.filter(id => definitions.filter(d => d.id === id).length > 1); expect(twice).toEqual([]);
  });
  it('CLAUDE.md defines no requirement IDs, so the specification stays out of the file loaded into every session', () => {
    const doc = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8'); expect([...doc.matchAll(DEF)].map(m => m[1])).toEqual([]);
  });
  it('every requirement ID mentioned in a test title is defined in a requirement file (no typos, no retired IDs)', () => {
    const unknown = titles.flatMap(t => idsIn(t.title).filter(id => !requirementIds.includes(id)).map(id => `${id} in ${t.file}`)); expect(unknown).toEqual([]);
  });
  it('every group of tests that is tied to a requirement starts with its ID so the console output reads "R-XXX-nn <what is checked>"', () => {
    const bad = titles.filter(t => t.kind === 'describe' && /^R-/.test(t.title) && !/^R-[A-Z0-9]+-\d+ \S/.test(t.title)).map(t => t.title); expect(bad).toEqual([]);
  });
});

describe('Quality of test descriptions (what the console shows)', () => {
  it('no test is skipped, marked "only", or left as a to-do', () => {
    expect(titles.filter(t => /skip|only|todo/.test(t.mods)).map(t => `${t.file}: ${t.title}`)).toEqual([]);
  });
  it('every test description is a readable sentence of at least 25 characters, not a label like "works" or "test 3"', () => {
    const bad = tests.filter(t => t.title.length < 25 || !/\s/.test(t.title) || /^(test\s*\d*|works|ok|should work)$/i.test(t.title)).map(t => `${t.file}: "${t.title}"`); expect(bad).toEqual([]);
  });
  it('no two plain tests in the same file have the same description', () => {
    const seen = new Map(), dup = [];
    tests.filter(t => !/each/.test(t.mods) && !/%/.test(t.title)).forEach(t => { const k = t.file + '|' + t.title; if (seen.has(k)) dup.push(`${t.file}: "${t.title}"`); seen.set(k, 1); });
    expect(dup).toEqual([]);
  });
});
