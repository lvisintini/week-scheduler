import { describe, it, expect } from 'vitest';
import { openApp, blank, ev1, sched, person, workspace, WS_KEY } from '../helpers/app.js';

const app = openApp();
const parse = (obj, strict = false) => app.ev(`parseData(${JSON.stringify(obj)},${strict})`);
const slotOf = (slot, kind = 'event') => kind === 'event'
  ? parse(blank({ events: [ev1({ slots: [slot] })] })).events[0].slots[0]
  : parse(blank({ rhythms: [{ id: 'r', name: 'R', visible: false }], phases: [{ id: 'p', title: 'P', rhythms: ['r'], slots: [slot] }] })).phases[0].slots[0];

describe('R-DATA-07 Imported workspace data is validated and sanitised (parseData)', () => {
  it.each([[null], [{}], [{ schedules: [] }], [{ events: [] }], [{ schedules: 'x', events: [] }], [[1, 2]]])(
    'refuses %j because it is not a workspace', bad => expect(() => parse(bad)).toThrow());

  it.each([
    [{ day: -3, start: 600, end: 660 }, { day: 0, start: 600, end: 660 }],
    [{ day: 9, start: 600, end: 660 }, { day: 6, start: 600, end: 660 }],
    [{ day: 1, start: -50, end: 60 }, { day: 1, start: 0, end: 60 }],
    [{ day: 1, start: 5000, end: 6000 }, { day: 1, start: 1425, end: 2880 }],
    [{ day: 1, start: 600, end: 600 }, { day: 1, start: 600, end: 615 }],
    [{ day: 1, start: 600, end: 100 }, { day: 1, start: 600, end: 615 }],
    [{ day: 1, start: 600, end: 99999 }, { day: 1, start: 600, end: 2880 }],
    [{ day: 'x', start: 'y', end: 'z' }, { day: 0, start: 0, end: 15 }],
  ])('an event repetition %j is corrected to %j', (input, expected) => {
    expect(slotOf({ person: '', ...input })).toMatchObject(expected);
  });

  it('a phase repetition can never run past the end of its day', () => {
    expect(slotOf({ day: 0, start: 1200, end: 2000 }, 'phase').end).toBe(1440);
  });
  it('phase repetitions carry no person field, event repetitions always have one', () => {
    expect(slotOf({ day: 0, start: 600, end: 660 }, 'phase')).not.toHaveProperty('person');
    expect(slotOf({ day: 0, start: 600, end: 660 })).toHaveProperty('person', '');
  });
  it('events and phases without any usable repetition are dropped', () => {
    const d = parse(blank({ events: [ev1({ slots: [] }), { id: 'x', title: 'old shape', day: 0, start: 600, end: 660 }, ev1({ id: 'ok' })], rhythms: [{ id: 'r', name: 'R', visible: false }], phases: [{ id: 'p', title: 'P', rhythms: ['r'], slots: [] }] }));
    expect(d.events.map(e => e.id)).toEqual(['ok']); expect(d.phases).toHaveLength(0);
  });
  it('earlier development shapes are not interpreted (old period sets, periods, free-text people)', () => {
    const d = parse({ ...blank(), periodSets: [{ id: 'a', name: 'old', visible: true }], periods: [{ id: 'p', title: 'old', sets: ['a'], slots: [{ day: 0, start: 600, end: 660 }] }], events: [{ id: 'e', title: 'x', schedules: ['s1'], person: 'Ann', slots: [{ day: 0, start: 600, end: 660 }] }] });
    expect(d.rhythms).toHaveLength(0); expect(d.phases).toHaveLength(0); expect(d.people).toHaveLength(0);
    expect(d.events[0]).not.toHaveProperty('person');
  });
  it.each([['red'], ['url(https://evil.example/x)'], ['#12'], [''], [null], ['red;background:url(//x)']])(
    'an invalid colour %j on an event falls back to a palette colour', c => {
      expect(parse(blank({ events: [ev1({ color: c })] })).events[0].color).toMatch(/^#[0-9a-f]{6}$/);
    });
  it('short hex colours are expanded and upper case is normalised', () => {
    expect(parse(blank({ schedules: [sched({ color: '#ABC' })] })).schedules[0].color).toBe('#aabbcc');
  });
  it('people without a valid colour get palette colours in turn', () => {
    const cols = parse(blank({ people: [person({ id: 'a', color: 'x' }), person({ id: 'b', color: 'y' })] })).people.map(p => p.color);
    expect(cols[0]).not.toBe(cols[1]); cols.forEach(c => expect(c).toMatch(/^#[0-9a-f]{6}$/));
  });
  it('names and titles are limited to 200 characters and descriptions to 5,000', () => {
    const d = parse(blank({ schedules: [sched({ name: 'n'.repeat(500) })], events: [ev1({ title: 't'.repeat(500), desc: 'd'.repeat(9000) })] }));
    expect(d.schedules[0].name).toHaveLength(200); expect(d.events[0].title).toHaveLength(200); expect(d.events[0].desc).toHaveLength(5000);
  });
  it('numeric ids are turned into strings so references keep matching', () => {
    const d = parse(blank({ schedules: [sched({ id: 7 })], events: [ev1({ schedules: [7] })] }));
    expect(d.schedules[0].id).toBe('7'); expect(d.events[0].schedules).toEqual(['7']);
  });
  it('visibility defaults to shown, locked is a boolean, opacity is limited to 10–100 %', () => {
    const d = parse(blank({ schedules: [{ id: 'a', name: 'A', color: '#3b6df0', opacity: 7 }, { id: 'b', name: 'B', color: '#3b6df0', opacity: 0.01, visible: false, locked: 'yes' }] }));
    expect(d.schedules[0]).toMatchObject({ visible: true, locked: false, opacity: 1 });
    expect(d.schedules[1]).toMatchObject({ visible: false, locked: true, opacity: 0.1 });
  });
  it('the phase opacity defaults to 30 % and is limited to 5–100 %', () => {
    expect(parse({ ...blank(), phaseOpacity: undefined }).phaseOpacity).toBe(0.3);
    expect(parse({ ...blank(), phaseOpacity: 0 }).phaseOpacity).toBe(0.3);
    expect(parse({ ...blank(), phaseOpacity: 0.001 }).phaseOpacity).toBe(0.05);
    expect(parse({ ...blank(), phaseOpacity: 5 }).phaseOpacity).toBe(1);
  });
  it('unknown properties are dropped', () => {
    const d = parse(blank({ events: [{ ...ev1(), evil: '<script>', onclick: 'x' }] }));
    expect(d.events[0]).not.toHaveProperty('evil'); expect(d.events[0]).not.toHaveProperty('onclick');
  });
  it('a hostile __proto__ key cannot pollute objects', () => {
    const result = app.ev(`(()=>{const d=parseData(JSON.parse('{"__proto__":{"polluted":1},"schedules":[],"events":[]}'));return [({}).polluted,d.polluted]})()`);
    expect(result[0]).toBeUndefined(); expect(result[1]).toBeUndefined();
  });
});

describe('R-SEC-03 Import limits protect against huge files and links', () => {
  const many = (n, make) => Array.from({ length: n }, (_, i) => make(i));
  const limits = [
    ['schedules', 100, n => blank({ schedules: many(n, i => sched({ id: 's' + i })) })],
    ['people', 500, n => blank({ people: many(n, i => person({ id: 'p' + i })) })],
    ['events', 5000, n => blank({ events: many(n, i => ev1({ id: 'e' + i })) })],
    ['rhythms', 100, n => blank({ rhythms: many(n, i => ({ id: 'r' + i, name: 'R' + i, visible: false })) })],
    ['phases', 2000, n => blank({ rhythms: [{ id: 'r', name: 'R', visible: false }], phases: many(n, i => ({ id: 'p' + i, title: 'P', rhythms: ['r'], slots: [{ day: 0, start: 0, end: 60 }] })) })],
  ];
  it.each(limits)('more than the allowed number of %s (limit %i) is refused for files and links', (name, max, make) => {
    expect(() => parse(make(max + 1), true)).toThrow('limit');
  });
  it.each(limits)('exactly the allowed number of %s (limit %i) is accepted', (name, max, make) => {
    expect(() => parse(make(max), true)).not.toThrow();
  });
  it('more than 200 repetitions in one event are refused', () => {
    const slots = Array.from({ length: 201 }, () => ({ day: 0, start: 600, end: 660, person: '' }));
    expect(() => parse(blank({ events: [ev1({ slots })] }), true)).toThrow('limit');
  });
  it('data already stored in the browser is never rejected by the limits, so saved work cannot fail to load', () => {
    const store = JSON.stringify({ version: 1, current: 'w', workspaces: [{ id: 'w', name: 'Big', ...blank({ events: many(5200, i => ev1({ id: 'e' + i })) }) }] });
    const big = openApp({ storage: { [WS_KEY]: store } });
    expect(big.ev('state.S.events.length')).toBe(5200); expect(big.ev('cw().name')).toBe('Big');
  });
});

describe('R-DATA-07 A workspace file or link record (parseWorkspace)', () => {
  const pw = (j, fallback) => app.ev(`parseWorkspace(${JSON.stringify(j)}${fallback ? ',' + JSON.stringify(fallback) : ''})`);
  it('a workspace record keeps the id and name it was saved with', () => { const r = pw(workspace()); expect(r.id).toBe('ws-test'); expect(r.name).toBe('Test workspace'); });
  it('without an id the id is empty so it can never match an existing workspace by id', () => {
    expect(pw({ ...workspace(), id: undefined }).id).toBeNull();
  });
  it('without a name the file name is used, then the generic "Imported workspace"', () => {
    expect(pw({ ...workspace(), name: undefined }, 'my-file').name).toBe('my-file');
    expect(pw({ ...workspace(), name: undefined }).name).toBe('Imported workspace');
  });
  it('a very long name is shortened to 200 characters', () => { expect(pw({ ...workspace(), name: 'x'.repeat(400) }).name).toHaveLength(200); });
  it('the data part is validated like any other import', () => {
    expect(pw(workspace({ events: [ev1({ color: 'url(x)' })] })).data.events[0].color).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('R-DATA-01 A damaged or missing browser store never breaks the app', () => {
  it.each([['not json at all'], ['{"workspaces":"x"}'], ['{"workspaces":[]}'], ['null'], ['{"workspaces":[{"id":"a","name":"A"}]}']])(
    'with the stored text %j the app starts with a fresh default workspace', raw => {
      const a = openApp({ storage: { [WS_KEY]: raw } });
      expect(a.ev('state.WS.length')).toBe(1); expect(a.ev('state.S.schedules[0].name')).toBe('Routine');
      expect(a.log.errors).toEqual([]);
    });
});
