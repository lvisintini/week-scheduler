// The sample household that every tests/fixtures/v<N>/ folder holds, written in the CURRENT data format.
// When the format changes (FMT goes up), update this to the new format, then run `node tests/fixtures/make.mjs`
// to add the folder for the new version. Never edit or regenerate an existing folder.
export const FIXTURE_PASSWORD = 'k7Qm9-xTa2L-wdR4n-Hy6Be-Zc8Vp';

export const household = {
  schedules: [
    { id: 's-home', name: 'Home', color: '#2fa66a', opacity: 1, locked: false, visible: true },
    { id: 's-school', name: 'School', color: '#3b6df0', opacity: 0.6, locked: true, visible: true },
    { id: 's-weekb', name: 'Week B', color: '#e8912d', opacity: 1, locked: false, visible: false },
  ],
  people: [
    { id: 'p-ann', name: 'Ann', color: '#e5484d', visible: true },
    { id: 'p-luis', name: 'Luis', color: '#3f51b5', visible: false },
    { id: 'p-lucia', name: 'Lucía', color: '#d6409f', visible: true },
    { id: 'p-marta', name: 'Marta', color: '#607d8b', visible: true, external: true },
  ],
  types: [
    { id: 't-sleep', name: 'Sleep', color: '#3f51b5', icon: 'moon', visible: false },
    { id: 't-work', name: 'Work', color: '#2fa66a', icon: 'work', visible: true },
    { id: 't-free', name: 'Free time', color: '#12a5b5', icon: 'sun', soft: true, visible: true },
  ],
  events: [
    { id: 'e-work', title: 'Work', desc: '', color: '#2fa66a', type: 't-work', schedules: ['s-home'], involved: [],
      slots: [
        { day: 0, start: 540, end: 1020, person: 'p-ann', fs: 30, fe: 15 },
        { day: 1, start: 540, end: 1020, person: 'p-ann', flex: true, col: 't' },
        { day: 2, start: 540, end: 1020, person: 'p-ann', col: 'p' },
      ] },
    { id: 'e-school', title: 'School run', desc: 'Bring the lunch box', color: '#3b6df0', owner: 'p-ann', schedules: ['s-home', 's-school'], involved: ['p-lucia'],
      slots: [{ day: 0, start: 480, end: 510, person: 'p-luis', inv: ['p-lucia', 'p-ann'], col: '#ff8800' }, { day: 2, start: 480, end: 510, person: 'p-ann', fo: true }] },
    { id: 'e-clean', title: 'Cleaning', desc: '', color: '#a1662f', oncall: true, bg: true, schedules: ['s-home'], involved: ['p-ann'],
      slots: [{ day: 3, start: 600, end: 780, person: 'p-marta' }] },
    { id: 'e-night', title: 'Night shift', desc: 'Hospital, ward 3', color: '#8e4ec6', schedules: ['s-weekb'], involved: [],
      slots: [{ day: 6, start: 1320, end: 1800, person: 'p-luis' }] },
    { id: 'e-milk', title: 'Collect milk', desc: '', color: '#e8912d', nest: true, schedules: ['s-home'], involved: [],
      slots: [{ day: 0, start: 495, end: 510, person: 'p-luis' }, { day: 5, start: 540, end: 555, person: 'p-luis' }] },
    { id: 'e-screen', title: 'Screen-free time', desc: '', color: '#607d8b', bg: true, schedules: ['s-home'], involved: [],
      slots: [{ day: 0, start: 1080, end: 1200, person: 'p-lucia' }] },
    { id: 'e-park', title: 'Cumpleaños 🎂 & <park>', desc: 'Línea 1\nLínea 2', color: '#12a5b5', type: 't-free', schedules: ['s-home'], involved: ['p-ann', 'p-lucia'],
      slots: [{ day: 5, start: 600, end: 720, person: '' }, { day: 5, start: 900, end: 960, person: '' }] },
    { id: 'e-swim', title: 'Swimming', desc: '', color: '#3b6df0', weeks: [1], turns: true, schedules: ['s-home'], involved: [],
      slots: [{ day: 6, start: 1260, end: 1500, person: 'p-lucia' }] },
    { id: 'e-cook', title: 'Cooking', desc: 'Swap turns in the family chat', color: '#e5484d', owner: 'p-ann', turns: false, schedules: ['s-home'], involved: [],
      slots: [{ day: 0, start: 1080, end: 1140, person: 'p-ann', wk: 1, fo: true }, { day: 0, start: 1080, end: 1140, person: 'p-luis', wk: 2 }, { day: 3, start: 1080, end: 1140, person: 'p-luis', wk: 1 }] },
    { id: 'e-dad', title: "At Dad's", desc: '', color: '#8e4ec6', away: true, weeks: [2], schedules: ['s-home'], involved: ['p-lucia'],
      slots: [{ day: 4, start: 1020, end: 2880, person: '' }, { day: 6, start: 0, end: 1080, person: '' }] },
  ],
  rhythms: [{ id: 'r-normal', name: 'Normal rhythm', visible: true }, { id: 'r-holiday', name: 'Holiday rhythm', visible: false }],
  phases: [
    { id: 'ph-lunch', title: 'Lunch', desc: 'Kitchen closed after', color: '#e8912d', rhythms: ['r-normal', 'r-holiday'],
      slots: [0, 1, 2, 3, 4].map(day => ({ day, start: 720, end: 780 })) },
    { id: 'ph-sleep', title: 'Sleep', desc: '', color: '#3f51b5', rhythms: ['r-normal'], slots: [{ day: 6, start: 0, end: 420 }, { day: 6, start: 1320, end: 1440 }] },
    { id: 'ph-quiet', title: 'Quiet hours', desc: 'Dad sleeps after night shifts', color: '#607d8b', weeks: [2], rhythms: ['r-normal'], slots: [{ day: 5, start: 480, end: 720 }] },
    { id: 'ph-shift', title: 'Shift', desc: '', color: '#a1662f', rhythms: ['r-normal'], slots: [{ day: 0, start: 360, end: 840, wk: 1 }, { day: 0, start: 1320, end: 1440, wk: 2 }] },
  ],
  phaseOpacity: 0.45,
  cycle: 2,
  color: '#2fa66a', desc: 'Our home routine',
  weekInfo: [{ name: 'At home', color: '#2fa66a' }, { name: "At Dad's", desc: 'From Friday school pickup to Sunday evening', color: '#8e4ec6' }],
};

/** The second workspace of the browser-memory sample: almost empty. */
export const grandparents = {
  schedules: [{ id: 's-gp', name: 'Visits', color: '#e5484d', opacity: 1, locked: false, visible: true }],
  people: [], types: [], events: [], rhythms: [], phases: [], phaseOpacity: 0.3,
};

// What each format version added to the household above; taking it away again gives the household as version v stored it
// (the sample files of older versions are compared with this). Add an entry whenever FMT goes up.
const ADDED = {
  2: h => ({ ...h, events: h.events.filter(e => !e.nest) }),   // event.nest, nested activities (R-NST-01)
  3: h => ({ ...h, events: h.events.filter(e => e.id !== 'e-screen') }),   // event.bg, in the background (R-EVT-19)
  4: h => ({ ...h, events: h.events.map(e => e.id === 'e-clean' ? (({ bg, ...r }) => r)(e) : e) }),   // strips only from bg: the external-led cleaning gets the mark
  5: h => ({ ...h, events: h.events.map(({ owner, ...e }) => ({ ...e, slots: e.slots.map(({ fo, inv, ...sl }) => sl) })) }),   // event owner, a day following the owner, a day's own With list (R-EVT-20/21)
  6: h => ({ ...h, events: h.events.map(e => ({ ...e, slots: e.slots.map(({ col, ...sl }) => sl) })) }),   // a repetition's own colour (R-EVT-22)
  7: h => ({ ...h, events: h.events.map(e => ({ ...e, slots: e.slots.map(({ col, ...sl }) => col === undefined || col === 't' ? sl : { ...sl, col }) })) }),   // the activity type's colour (R-EVT-22)
  8: h => ({ ...h, types: h.types.map(({ visible, ...t }) => t) }),   // the activity type's eye (R-TYP-04)
  9: ({ cycle, ...h }) => ({ ...h, events: h.events.filter(e => !['e-swim', 'e-cook', 'e-dad'].includes(e.id)) }),   // the cycle of weeks (R-CYC-14) and Away (R-EVT-24)
  10: ({ weekInfo, ...h }) => h,   // the weeks' names, descriptions and colours (R-CYC-17)
  11: h => ({ ...h, phases: h.phases.filter(p => !['ph-quiet', 'ph-shift'].includes(p.id)) }),   // the weeks of phases (R-CYC-16)
  12: h => ({ ...h, events: h.events.map(({ turns, ...e }) => e) }),   // whether an event counts turns (R-CYC-18)
  13: ({ color, desc, ...h }) => h,   // the workspace's colour and description (R-DATA-10)
  14: h => h,   // browser memory protected with a passphrase (R-DATA-11); a workspace is unchanged
};
export const householdAt = v => Object.keys(ADDED).map(Number).filter(n => n > v).reduce((h, n) => ADDED[n](h), household);

/** Settings that differ from every default (of the current app). */
export const prefsSample = {
  w: 320, collapsed: true, showEarly: true, clock12: true, hideWeekend: true, theme: 'dark', rowH: 60, colW: 150, fitW: false, fitH: false, txt: 120,
  secSch: true, secPpl: true, secTyp: true, secRh: true, secZoom: true, secExt: false,
  hlNoType: true, colBy: 't', secTools: true, lanesFix: true,
  lvAnchor: { 'ws-family': '2026-10-05' }, rowHP: 80, fitHP: true, colWP: 140, fitWP: false,
};
// Settings added to the sample after folder v<n> was written (they are back at their defaults in that folder and every older one).
const PREFS_AFTER = [[8, ['hlNoType', 'colBy', 'secTools', 'lanesFix']], [9, ['lvAnchor', 'rowHP', 'fitHP']], [10, ['colWP', 'fitWP']]];   // Tools (R-UI-11, R-EVT-23); today's week per workspace (R-CYC-05); a phone's own row height (R-GRID-07)
// Settings retired after folder v<n> was written: that folder and every older one still hold them (no longer read, but kept in prefs).
const PREFS_RETIRED = [[8, { side: false, sideFix: true }]];   // side by side can no longer be turned off (R-EVT-10/13)

// Settings have no version of their own; the settings sample of folder v<N> is the one current when that folder was written.
// Folders up to 5 were written before the zoom controls became Fit width / Fit height / Text size (R-GRID-07): they hold the
// retired fillW / fit instead, which are no longer read, so the new keys are back at their defaults there.
export const prefsAt = v => {
  const later = PREFS_AFTER.filter(([n]) => v <= n).flatMap(([, ks]) => ks);
  const p = Object.fromEntries(Object.entries(prefsSample).filter(([k]) => !later.includes(k)));
  PREFS_RETIRED.filter(([n]) => v <= n).forEach(([, kv]) => Object.assign(p, kv));
  if (v >= 6) return p;
  const rest = Object.fromEntries(Object.entries(p).filter(([k]) => !['fitW', 'fitH', 'txt'].includes(k)));
  return { ...rest, fillW: false, fit: true };
};
