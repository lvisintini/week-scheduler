// The shared state: everything that several files read or change, in one object (docs/architecture.md). State that one file owns stays a
// private variable of that file. Data = the workspaces and their history; view = this browser's view of them (not undoable, not an
// unsaved change, ignored by keyOf). ES module with no imports, so it is ready before any other file runs.
export const state={
  // data
  S:{schedules:[],events:[],people:[],types:[],rhythms:[],phases:[],phaseOpacity:.3},   // the current workspace's data
  WS:[],             // every workspace open in this page: {id, name, data, lb, lf, undo, redo} (newWs)
  curId:null,        // id of the current workspace
  undoSt:[],         // undo entries: the data as JSON, or {s, wp} for a new order of weeks (R-CYC-20)
  redoSt:[],
  memKey:null,       // the key of a protected browser memory while this page has it open, {key,salt,iter} (R-DATA-11)
  // view
  prefs:{w:290,collapsed:false,showEarly:false,clock12:false,hideWeekend:false,theme:'auto',rowH:48,colW:110,fitW:true,fitH:true,rowHP:100,fitHP:false,colWP:110,fitWP:true,txt:100,hlNoType:false,colBy:'',lanesFix:false},   // per-browser view settings, saved under their own key
  lang:/^es/i.test((navigator.languages&&navigator.languages[0])||navigator.language||'')?'es':'en',   // 'en' or 'es'
  curWk:1,           // the week of the cycle shown (R-CYC-04)
  allWk:false,       // every week of the cycle side by side (R-CYC-19)
  focusD:null,       // the one day shown in focus mode (R-GRID-11), null = the week
  selK:null,         // the selected repetition, {id, i} (arrow keys and Delete act on it)
  editMode:'events', // 'events' or 'phases'
  live:false,        // Live View is on (R-GRID-12)
  livePaused:false,  // Live View stopped following the clock after a manual scroll
  nowOn:true,        // Settings: show the "now" line
  skipSide:false,    // render() leaves the sidebar alone (while dragging an opacity slider, printing)
  printMode:false,   // render() draws for printing
  HH:48,             // px per hour of the grid as drawn now
  MAXEND:2880,       // the latest end a time can have: 1440 for phases, 2880 (past midnight) for events
};
