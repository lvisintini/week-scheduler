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
    { id: 't-sleep', name: 'Sleep', color: '#3f51b5', icon: 'moon' },
    { id: 't-work', name: 'Work', color: '#2fa66a', icon: 'work' },
    { id: 't-free', name: 'Free time', color: '#12a5b5', icon: 'sun', soft: true },
  ],
  events: [
    { id: 'e-work', title: 'Work', desc: '', color: '#2fa66a', type: 't-work', schedules: ['s-home'], involved: [],
      slots: [
        { day: 0, start: 540, end: 1020, person: 'p-ann', fs: 30, fe: 15 },
        { day: 1, start: 540, end: 1020, person: 'p-ann', flex: true },
        { day: 2, start: 540, end: 1020, person: 'p-ann' },
      ] },
    { id: 'e-school', title: 'School run', desc: 'Bring the lunch box', color: '#3b6df0', schedules: ['s-home', 's-school'], involved: ['p-lucia'],
      slots: [{ day: 0, start: 480, end: 510, person: 'p-luis' }, { day: 2, start: 480, end: 510, person: 'p-ann' }] },
    { id: 'e-clean', title: 'Cleaning', desc: '', color: '#a1662f', oncall: true, schedules: ['s-home'], involved: ['p-ann'],
      slots: [{ day: 3, start: 600, end: 780, person: 'p-marta' }] },
    { id: 'e-night', title: 'Night shift', desc: 'Hospital, ward 3', color: '#8e4ec6', schedules: ['s-weekb'], involved: [],
      slots: [{ day: 6, start: 1320, end: 1800, person: 'p-luis' }] },
    { id: 'e-milk', title: 'Collect milk', desc: '', color: '#e8912d', nest: true, schedules: ['s-home'], involved: [],
      slots: [{ day: 0, start: 495, end: 510, person: 'p-luis' }, { day: 5, start: 540, end: 555, person: 'p-luis' }] },
    { id: 'e-screen', title: 'Screen-free time', desc: '', color: '#607d8b', bg: true, schedules: ['s-home'], involved: [],
      slots: [{ day: 0, start: 1080, end: 1200, person: 'p-lucia' }] },
    { id: 'e-park', title: 'Cumpleaños 🎂 & <park>', desc: 'Línea 1\nLínea 2', color: '#12a5b5', type: 't-free', schedules: ['s-home'], involved: ['p-ann', 'p-lucia'],
      slots: [{ day: 5, start: 600, end: 720, person: '' }, { day: 5, start: 900, end: 960, person: '' }] },
  ],
  rhythms: [{ id: 'r-normal', name: 'Normal rhythm', visible: true }, { id: 'r-holiday', name: 'Holiday rhythm', visible: false }],
  phases: [
    { id: 'ph-lunch', title: 'Lunch', desc: 'Kitchen closed after', color: '#e8912d', rhythms: ['r-normal', 'r-holiday'],
      slots: [0, 1, 2, 3, 4].map(day => ({ day, start: 720, end: 780 })) },
    { id: 'ph-sleep', title: 'Sleep', desc: '', color: '#3f51b5', rhythms: ['r-normal'], slots: [{ day: 6, start: 0, end: 420 }, { day: 6, start: 1320, end: 1440 }] },
  ],
  phaseOpacity: 0.45,
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
  3: h => ({ ...h, events: h.events.filter(e => !e.bg) }),   // event.bg, doesn't keep anyone busy (R-EVT-19)
};
export const householdAt = v => Object.keys(ADDED).map(Number).filter(n => n > v).reduce((h, n) => ADDED[n](h), household);

/** Settings that differ from every default. */
export const prefsSample = {
  w: 320, collapsed: true, showEarly: true, clock12: true, hideWeekend: true, theme: 'dark', rowH: 60, colW: 150, fillW: false, fit: true,
  side: false, sideFix: true, secSch: true, secPpl: true, secTyp: true, secRh: true, secZoom: true, secExt: false,
};
