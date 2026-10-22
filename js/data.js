// Data: state and history, the data format and its upgrades (MIG, parseData), workspaces, the cycle of weeks, import and transfers. Classic script: shares the global scope with the other files in js/, loaded in the order of index.html (docs/architecture.md).
/* ---------- state, history, persistence ---------- */
const WKEY='weekly-schedules-workspaces',PKEY='weekly-schedules-prefs';
let S={schedules:[],events:[],people:[],types:[],rhythms:[],phases:[],phaseOpacity:.3};
let selK=null,editMode='events',focusD=null;   // focusD: the one day shown in focus mode (R-GRID-11), null = the week; not saved
const isAdv=sl=>new Set(sl.map(s=>(s.wk||0)*7+s.day)).size<sl.length;   // some day has two times (per week of the cycle, R-CYC-09)
const sameDay=(x,y,day=y.day)=>x.day===day&&(x.wk||0)===(y.wk||0);
// moving by days (R-CYC-09): a repetition with its own week moves along the cycle (Sunday of week 1 + 1 = Monday of week 2), any other mod 7
const absD=s=>((s.wk||1)-1)*7+s.day;
function shiftDay(s,dD){if(!s.wk){s.day=((s.day+dD)%7+7)%7;return}const n=cyc()*7,x=((absD(s)+dD)%n+n)%n;s.wk=Math.floor(x/7)+1;s.day=x%7}
const sameSet=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));
let WS=[],curId=null,undoSt=[],redoSt=[],nowOn=true,skipSide=false;
const keyOf=d=>JSON.stringify({cycle:d.cycle||1,weekInfo:wiNorm(d.weekInfo,d.cycle||1),schedules:d.schedules.map(({visible,opacity,...r})=>r),people:d.people.map(({visible,...r})=>r),types:d.types.map(({visible,...r})=>r),events:d.events,rhythms:d.rhythms.map(({visible,...r})=>r),phases:d.phases});
const dataKey=()=>keyOf(S);
const cw=()=>WS.find(w=>w.id===curId);
const wsData=w=>w.id===curId?S:w.data;
const wsDirty=w=>{const k=keyOf(wsData(w));return k!==w.lb&&k!==w.lf};
const isDirty=()=>{const w=cw();return !!w&&wsDirty(w)};
const anyDirty=()=>WS.some(wsDirty);
function syncWs(){const w=cw();if(w){w.data=S;w.undo=undoSt;w.redo=redoSt}}
function newWs(name,data,saved){return {id:uid(),name,data,lb:null,lf:saved?keyOf(data):null,undo:[],redo:[]}}
function switchWs(id){if(id===curId||!WS.some(w=>w.id===id))return;syncWs();curId=id;const w=cw();S=w.data;undoSt=w.undo||[];redoSt=w.redo||[];selK=null;curWk=todayWk()||curWk;render();if(live)setTimeout(liveTick,0)}   // on today's week of that workspace, when known (R-CYC-05)
function pushUndoWs(w){if(w.id===curId){hist();return}w.undo=w.undo||[];w.undo.push(JSON.stringify(w.data));if(w.undo.length>100)w.undo.shift();w.redo=[]}
const uniqueName=(base,names)=>{let n=base,i=2;while(names.includes(n))n=base+' ('+(i++)+')';return n};
function updUR(){const u=$('undoB'),r=$('redoB');if(u)u.disabled=!undoSt.length;if(r)r.disabled=!redoSt.length}
function pushUndo(str){undoSt.push(str);if(undoSt.length>100)undoSt.shift();redoSt=[];updUR()}
const hist=()=>pushUndo(JSON.stringify(S));
function restoreState(str){
  const old=S;S=JSON.parse(str);
  S.schedules.forEach(s=>{const o=old.schedules.find(x=>x.id===s.id);if(o){s.visible=o.visible;s.opacity=o.opacity}});
  S.people.forEach(q=>{const o=old.people.find(x=>x.id===q.id);if(o)q.visible=o.visible});
  S.types.forEach(t=>{const o=old.types.find(x=>x.id===t.id);if(o)t.visible=o.visible});
  S.phaseOpacity=old.phaseOpacity;S.rhythms.forEach(s=>{const o=old.rhythms.find(x=>x.id===s.id);s.visible=o?o.visible:false});
}
// an entry is the state as JSON, or {s, wp} for a new order of the weeks (R-CYC-20): undoing or redoing it also moves the shown week and today's week
function undo(){if(!undoSt.length)return;selK=null;const x=undoSt.pop();redoSt.push(x.wp?{s:JSON.stringify(S),wp:x.wp}:JSON.stringify(S));restoreState(x.s||x);if(x.wp)wkFollow(Object.fromEntries(x.wp.map((o,i)=>[i+1,o])));render()}
function redo(){if(!redoSt.length)return;selK=null;const x=redoSt.pop();undoSt.push(x.wp?{s:JSON.stringify(S),wp:x.wp}:JSON.stringify(S));restoreState(x.s||x);if(x.wp)wkFollow(Object.fromEntries(x.wp.map((o,i)=>[o,i+1])));render()}
/* Data format (R-DATA-08): FMT is the version of a workspace record (files, links, each workspace in browser memory; the store wrapper
   carries the same number). Raise it on ANY change to what is stored, even an added field (an older app would drop it and then save),
   add MIG[FMT-1] and a folder of sample files under tests/fixtures/. Data newer than FMT is refused, never half-read (R-DATA-09). */
const FMT=12;
const MIG={   // MIG[n](record): raw version-n record -> version n+1, plain JSON before parseData. Never delete one.
  1:j=>j,   // 2 added event.nest (R-NST-01); version-1 data has none
  2:j=>j,   // 3 added event.bg (R-EVT-19); version-2 data has none
  3:j=>{   // 4: strips come only from event.bg (R-EVT-19); events that were strips under the old rule (every repetition led by an
    // external person, nobody involved or only on call; R-EVT-17) get the mark so they keep their look
    const arr=x=>Array.isArray(x)?x:[],ext=new Set(arr(j.people).filter(q=>q&&q.external===true).map(q=>String(q.id)));
    arr(j.events).forEach(e=>{if(!e||typeof e!=='object')return;const sl=arr(e.slots);
      if(sl.length&&sl.every(x=>x&&x.person!=null&&ext.has(String(x.person)))&&(!arr(e.involved).length||e.oncall===true))e.bg=true});
    return j},
  4:j=>{   // 5: event.owner, slot.fo (follows the owner), slot.inv (own involved list) (R-EVT-20/21). Guess an owner: the most frequent
    // performer among our people (ties: the earliest repetition); the repetitions they perform follow the owner from now on
    const arr=x=>Array.isArray(x)?x:[],ours=new Set(arr(j.people).filter(q=>q&&q.external!==true).map(q=>String(q.id)));
    arr(j.events).forEach(e=>{if(!e||typeof e!=='object')return;const sl=arr(e.slots).filter(x=>x&&typeof x==='object'),n=new Map();
      sl.forEach(x=>{const p=x.person!=null?String(x.person):'';if(ours.has(p))n.set(p,(n.get(p)||0)+1)});
      let best=null;n.forEach((c,p)=>{if(!best||c>n.get(best))best=p});   // Map keeps first-seen order, so ties go to the earliest repetition
      if(best){e.owner=best;sl.forEach(x=>{if(String(x.person)===best)x.fo=true})}});
    return j},
  5:j=>j,   // 6 added slot.col, a repetition's own colour (R-EVT-22); version-5 data has none
  6:j=>j,   // 7 added slot.col 't', the activity type's colour (R-EVT-22); version-6 data has none
  7:j=>j,   // 8 added types[].visible, the activity type's eye (R-TYP-04); missing = shown
  8:j=>j,   // 9 added the cycle of weeks (cycle, event.weeks, slot.wk; R-CYC-14) and event.away (R-EVT-24); version-8 data has none
  9:j=>j,   // 10 added weekInfo, the name, description and colour of each week of the cycle (R-CYC-17); version-9 data has none
  10:j=>j,   // 11 added the weeks of phases (phase.weeks, phase slot.wk; R-CYC-16); version-10 data has none: every phase is every week
  11:j=>j,   // 12 added event.turns, whether an event counts turns (R-CYC-18); version-11 data has none: automatic
};
const verOf=x=>x&&x.version!=null?+x.version:1;   // no version (hand-written files) = version 1
function migrate(j,v,to=FMT,steps=MIG){   // raw record of version v -> current version (to/steps: for tests only)
  if(!j||typeof j!=='object'||Array.isArray(j))throw new Error('bad');
  if(!Number.isInteger(v)||v<1)throw new Error('bad');
  if(v>to)throw new Error('newer');
  for(;v<to;v++)j=steps[v](j);
  return j;
}
const errKey=(e,fb)=>e&&e.message==='limit'?'tooBig':e&&e.message==='newer'?'newer':fb;
const LIM={schedules:100,people:500,types:100,events:5000,rhythms:100,phases:2000,slots:200};   // applied to imported files and links
/* the weeks of an event in a cycle of n weeks (R-CYC-02/03): a week pattern (event.weeks, absent = every week) or a week on every
   repetition (slot.wk, 1..n); the mode is inferred from the repetitions. Returns the event normalised, or null when nothing is left. */
function normWk(e,n){
  const ok=k=>Number.isInteger(k)&&k>=1&&k<=n,per=e.slots.some(s=>s.wk!=null);
  if(per){delete e.weeks;e.slots=e.slots.filter(s=>{const k=s.wk==null?1:Math.round(+s.wk)||1;if(k>n)return false;if(n>1)s.wk=Math.max(1,k);else delete s.wk;return true})}
  else if(e.weeks!==undefined){const w=Array.isArray(e.weeks)?[...new Set(e.weeks.map(Number).filter(ok))].sort((a,b)=>a-b):[];
    if(!w.length)return null;if(w.length>=n)delete e.weeks;else e.weeks=w}
  return e.slots.length?e:null;
}
/* R-CYC-17: the name, description and colour of each week of a cycle of n weeks, as stored: one entry per week ({} = nothing set), trailing
   empty entries dropped, [] at cycle 1 or when nothing is set. Strings only, trimmed and capped; hex colours only. */
const wiNorm=(x,n)=>{const out=(Array.isArray(x)?x:[]).slice(0,n).map(w=>{const o={};if(!w||typeof w!=='object')return o;
    const s=(v,m)=>typeof v==='string'?v.trim().slice(0,m):'',nm=s(w.name,40),ds=s(w.desc,300),c=normHex(w.color);if(nm)o.name=nm;if(ds)o.desc=ds;if(c)o.color=c;return o});
  while(out.length&&!Object.keys(out.at(-1)).length)out.pop();return n>1?out:[]};
function parseData(j,strict){
  if(!j||!Array.isArray(j.schedules)||!Array.isArray(j.events))throw new Error('bad');
  const arr=x=>Array.isArray(x)?x:[],clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const lim=(x,n)=>{const a=arr(x);if(strict&&a.length>n)throw new Error('limit');return a};
  lim(j.schedules,LIM.schedules);lim(j.people,LIM.people);lim(j.types,LIM.types);lim(j.events,LIM.events);lim(j.rhythms,LIM.rhythms);lim(j.phases,LIM.phases);
  const slot=(x,max,person)=>{const st=clamp(+x.start||0,0,1425),o={day:clamp(+x.day||0,0,6),start:st,end:Math.min(max,Math.max(st+SNAP,+x.end||0))};if(person){o.person=x.person!=null?String(x.person):'';if(x.fo===true)o.fo=true;if(Array.isArray(x.inv))o.inv=[...new Set(x.inv.map(String))].slice(0,LIM.people);if(x.col==='p'||x.col==='t')o.col=x.col;else if(normHex(x.col))o.col=normHex(x.col);if(x.flex===true)o.flex=true;else{const mg=v=>clamp(Math.round((+v||0)/SNAP)*SNAP,0,1440);o.fs=mg(x.fs);o.fe=mg(x.fe);fitMg(o)}}return o};
  const item=v=>({id:String(v.id||uid()),title:String(v.title||'Untitled').slice(0,200),desc:String(v.desc||'').slice(0,5000),color:normHex(v.color)||PAL[0]});
  const types=arr(j.types).map((t,i)=>({id:String(t.id),name:String(t.name).slice(0,200),color:normHex(t.color)||PAL[i%PAL.length],icon:Object.hasOwn(TICONS,t.icon)?t.icon:'dot',...(t.soft===true?{soft:true}:{}),visible:t.visible!==false})),tids=new Set(types.map(t=>t.id));
  const rhythms=arr(j.rhythms).map(s=>({id:String(s.id),name:String(s.name).slice(0,200),visible:!!s.visible}));
  const pids=new Set(arr(j.people).map(q=>String(q.id)));
  const own=ev=>{ev.slots.forEach(sl=>{if(sl.fo)sl.person=ev.owner||'';if(sl.inv&&sameSet(sl.inv,ev.involved))delete sl.inv});return ev};   // R-EVT-20/21
  const cyc=Number.isInteger(+j.cycle)?clamp(+j.cycle,1,4):1;
  {let seen=false;rhythms.forEach(s=>{if(s.visible&&seen)s.visible=false;if(s.visible)seen=true})}
  return {
    schedules:j.schedules.map(s=>({id:String(s.id),name:String(s.name).slice(0,200),color:normHex(s.color)||PAL[0],opacity:s.opacity==null?1:clamp(+s.opacity||1,.1,1),locked:!!s.locked,visible:s.visible!==false})),
    people:arr(j.people).map((q,i)=>({id:String(q.id),name:String(q.name).slice(0,200),color:normHex(q.color)||PAL[i%PAL.length],visible:q.visible!==false,...(q.external===true?{external:true}:{})})),
    types,
    events:arr(j.events).map(v=>({...item(v),...(v.type!=null&&tids.has(String(v.type))?{type:String(v.type)}:{}),schedules:arr(v.schedules).map(String),involved:arr(v.involved).map(String),...(v.owner!=null&&pids.has(String(v.owner))?{owner:String(v.owner)}:{}),...(v.oncall===true?{oncall:true}:{}),...(v.nest===true?{nest:true}:{}),...(typeof v.turns==='boolean'?{turns:v.turns}:{}),...(v.bg===true?{bg:true}:v.away===true?{away:true}:{}),...(Array.isArray(v.weeks)?{weeks:v.weeks}:{}),slots:lim(v.slots,LIM.slots).map(x=>({...slot(x,MAXEND,true),...(x.wk!=null?{wk:x.wk}:{})}))})).map(own).map(e=>normWk(e,cyc)).filter(e=>e&&e.slots.length),
    rhythms,
    phases:arr(j.phases).map(v=>({...item(v),rhythms:arr(v.rhythms).map(String),...(Array.isArray(v.weeks)?{weeks:v.weeks}:{}),slots:lim(v.slots,LIM.slots).map(x=>({...slot(x,1440,false),...(x.wk!=null?{wk:x.wk}:{})}))})).map(p=>normWk(p,cyc)).filter(p=>p&&p.slots.length),   // phases have weeks like events (R-CYC-16)
    phaseOpacity:j.phaseOpacity==null?.3:clamp(+j.phaseOpacity||.3,.05,1),
    cycle:cyc,weekInfo:wiNorm(j.weekInfo,cyc)
  };
}
function defaultRhythm(){
  const rid=uid(),all=[0,1,2,3,4,5,6];
  const ph=(k,col,days,blocks,desc)=>({id:uid(),title:L(k),desc:desc||'',color:col,rhythms:[rid],slots:days.flatMap(d=>blocks.map(([a,b])=>({day:d,start:a,end:b})))});
  return {rhythms:[{id:rid,name:L('dRh'),visible:true}],phases:[
    ph('dMid','#3f51b5',all,[[0,300]]),ph('dEarly','#f5c518',all,[[300,480]]),ph('dMorn','#2fa66a',all,[[480,720]]),ph('dNoon','#e8912d',all,[[720,840]]),
    ph('dAft','#12a5b5',all,[[840,1080]]),ph('dEve','#e5484d',all,[[1080,1260]]),ph('dNight','#8e4ec6',all,[[1260,1440]])]};
}
function defaultTypes(){
  return [['tSleep','#3f51b5','moon'],['tMeal','#e8912d','meal'],['tWork','#2fa66a','work'],['tFocus','#8e4ec6','target'],['tChore','#a1662f','broom'],['tFree','#12a5b5','sun',true],['tSocial','#e5484d','people'],['tCare','#d6409f','drop'],['tTravel','#607d8b','car']]
    .map(([k,color,icon,soft])=>({id:uid(),name:L(k),color,icon,...(soft?{soft:true}:{}),visible:true}));
}
function defaultData(){return {schedules:[{id:uid(),name:L('sched1'),color:PAL[0],opacity:1,locked:false,visible:true}],events:[],people:[],types:defaultTypes(),...defaultRhythm(),phaseOpacity:.3,cycle:1,weekInfo:[]}}
function initDefault(){const w=newWs(L('wsDefault'),defaultData(),true);WS=[w];curId=w.id;S=w.data;undoSt=w.undo;redoSt=w.redo}
/* ---------- workspaces: several named data sets in browser memory ---------- */
const readStore=()=>{try{const s=localStorage.getItem(WKEY);return s?JSON.parse(s):null}catch(e){return null}};
const memGet=()=>{try{return localStorage.getItem(WKEY)}catch(e){return null}};
const pickData=d=>{const wi=wiNorm(d.weekInfo,d.cycle||1);return {schedules:d.schedules,people:d.people,types:d.types,events:d.events,rhythms:d.rhythms,phases:d.phases,phaseOpacity:d.phaseOpacity,...(d.cycle>1?{cycle:d.cycle}:{}),...(wi.length?{weekInfo:wi}:{})}};
const wsEntry=w=>({id:w.id,name:w.name,...pickData(wsData(w))});
function buildFile(){syncWs();const w=cw();return {version:FMT,id:w.id,name:w.name,...pickData(w.data)}}   // file / link = one workspace
const parseWorkspace=(j,fallbackName)=>{j=migrate(j,verOf(j));return {id:j.id?String(j.id):null,name:String(j.name||fallbackName||L('wsImported')).slice(0,200),data:parseData(j,true)}};
const memNewer=()=>{const st=readStore();return !!st&&verOf(st)>FMT};   // browser memory written by a newer app: never read or overwritten (R-DATA-09)
function loadStore(){  // fills WS from browser memory; falls back to the default workspace
  try{
    const st=readStore();
    if(!st||!Array.isArray(st.workspaces)||!st.workspaces.length)throw 0;
    if(verOf(st)>FMT){alert(L('memNewer'));throw 0}
    WS=st.workspaces.map(e=>{const d=parseData(migrate(e,verOf(st))),w=newWs(String(e.name||L('wsDefault')).slice(0,200),d,false);if(e.id)w.id=String(e.id);w.lb=keyOf(d);return w});
    curId=WS.some(w=>w.id===st.current)?st.current:WS[0].id;
    const w=cw();S=w.data;undoSt=w.undo;redoSt=w.redo;
  }catch(e){initDefault()}
}
function saveMem(scope){
  syncWs();
  if(memNewer()){alert(L('memNewerSave'));return}
  try{
    let st=readStore();if(!st||!Array.isArray(st.workspaces))st={version:FMT,workspaces:[]};
    if(scope==='all')st={version:FMT,current:curId,workspaces:WS.map(wsEntry)};
    else{const sv=verOf(st);st.workspaces=st.workspaces.map(x=>{const {version,...r}=migrate(x,sv);return r});st.version=FMT;   // the other stored workspaces move to the current format too
      const e=wsEntry(cw()),i=st.workspaces.findIndex(x=>x.id===e.id);if(i>=0)st.workspaces[i]=e;else st.workspaces.push(e);st.current=curId}
    localStorage.setItem(WKEY,JSON.stringify(st));
    (scope==='all'?WS:[cw()]).forEach(w=>{w.lb=keyOf(wsData(w))});
    toast(L('savedMem'));renderSide();
  }catch(e){toast(L('memFail'))}
}
function saveTo(target){   // files and links always hold just the current workspace; browser memory can save one or all
  if(target==='file'||target==='link'){setTimeout(()=>openProtect(target),0);return}   // open after the Save dialog has closed (a dialog opened from inside a button handler would be closed again by it)
  if(WS.length<2){saveMem('all');return}   // with a single workspace "current" and "all" are the same, and saving all also drops deleted workspaces from the store
  setTimeout(()=>xdlg({title:L('scopeTitle'),body:`<p>${esc(L('scopeBody'))}</p>`,buttons:[{label:L('scopeCur',{n:cw().name}),cls:'p',fn:()=>saveMem('current')},{label:L('scopeAll',{n:WS.length}),fn:()=>saveMem('all')},{label:L('cancel'),dismiss:true}]}),0);
}
function addWorkspace(){
  const n=prompt(L('pWs'),uniqueName(L('wsDefault'),WS.map(w=>w.name)));if(!n)return;
  syncWs();const w=newWs(uniqueName(n.trim().slice(0,200),WS.map(x=>x.name)),defaultData(),true);WS.push(w);switchWs(w.id);
}
function renameWorkspace(){const n=prompt(L('pWs'),cw().name);if(!n)return;cw().name=n.trim().slice(0,200);render()}
function duplicateWorkspace(){syncWs();const w=newWs(uniqueName(cw().name+L('wsCopySuffix'),WS.map(x=>x.name)),JSON.parse(JSON.stringify(S)),false),t=prefs.lvAnchor[curId];if(t){prefs.lvAnchor[w.id]=t;savePrefs()}WS.push(w);switchWs(w.id)}   // the copy keeps today's week
function deleteWorkspace(){
  if(WS.length<2){toast(L('wsLast'));return}
  if(!confirm(L('confWs',{n:cw().name})))return;
  delete prefs.lvAnchor[curId];savePrefs();const i=WS.indexOf(cw());WS.splice(i,1);const nx=WS[Math.min(i,WS.length-1)];curId=nx.id;S=nx.data;undoSt=nx.undo||[];redoSt=nx.redo||[];selK=null;render();
}
/* the cycle of weeks (R-CYC-01/10): its length is data. Lengthening keeps every-week events every week; going to a multiple can repeat the
   events of chosen weeks in the new weeks, so their rhythm stays (week 1 of 2 → weeks 1 and 3 of 4). Shrinking asks first (shrinkCycle). */
const chosenWk=e=>!!e.weeks||e.slots.some(s=>s.wk);
const normAll=d=>{const n=d.cycle||1;d.events=d.events.map(e=>normWk(e,n)).filter(Boolean);d.phases=d.phases.map(p=>normWk(p,n)).filter(Boolean)};   // events and phases (R-CYC-16)
function extendWeeks(evs,n0,n){   // periodic extension from n0 to a multiple n
  evs.forEach(e=>{if(e.weeks)e.weeks=[...new Set(e.weeks.flatMap(k=>[...Array(n/n0).keys()].map(r=>k+r*n0)))].sort((a,b)=>a-b);
    else if(e.slots.some(s=>s.wk))e.slots=e.slots.flatMap(s=>[...Array(n/n0).keys()].map(r=>({...s,wk:s.wk+r*n0})))});
}
// R-CYC-17: the weeks' names, descriptions and colours follow a change of the cycle from n0 to n weeks: the weeks that go lose theirs;
// extending to a multiple repeats them (week 3 takes week 1's), any other lengthening leaves the new weeks blank
const wiResize=(wi,n0,n,extend)=>{const a=wiNorm(wi,n0);return wiNorm(extend&&n>n0&&n%n0===0?[...Array(n).keys()].map(k=>a[k%n0]||{}):a,n)};
// R-CYC-20: the weeks of the cycle in a new order (ord[i] = the week that becomes week i+1). Every event, phase and time moves with its week, and so
// do its name, description and colour (wiNew, as edited in the dialog); the shown week and today's week follow their content. One undo step that keeps the order.
function reorderWeeks(ord,wiNew){
  const mp={};ord.forEach((o,i)=>mp[o]=i+1);
  hist();undoSt[undoSt.length-1]={s:undoSt.at(-1),wp:[...ord]};
  [...S.events,...S.phases].forEach(e=>{if(e.weeks)e.weeks=e.weeks.map(k=>mp[k]).sort((a,b)=>a-b);e.slots.forEach(x=>{if(x.wk)x.wk=mp[x.wk]})});
  S.weekInfo=wiNorm(wiNew,cyc());wkFollow(mp);render();
}
const wkFollow=mp=>{const t=prefs.lvAnchor[curId]&&todayWk();curWk=mp[curWk]||curWk;if(t)setAnchor(mp[t])};   // mp: old week -> new week
function setCycle(n,extend,wi){   // wi: the weeks' info as edited in the dialog (else resized from the current one)
  const n0=cyc();hist();S.weekInfo=wi?wiNorm(wi,n):wiResize(S.weekInfo,n0,n,extend);if(extend&&n>n0&&n%n0===0){extendWeeks(S.events,n0,n);extendWeeks(S.phases,n0,n)}S.cycle=n;normAll(S);render();
  toast(n>1?L('cyDone',{n}):L('cyDone1'));
}
function openCycle(){
  const body=el('div'),n0=cyc(),used=S.events.some(chosenWk)||S.phases.some(chosenWk),cur=wiNorm(S.weekInfo,n0);
  // R-CYC-17: the weeks' names, descriptions and colours as edited here; weeks beyond the current cycle follow the extension rule until edited
  const wi=[0,1,2,3].map(k=>({...(cur[k]||{})})),touched=new Set([...Array(n0).keys()]),ord=[...Array(n0).keys()].map(k=>k+1);   // ord: the order of the weeks (R-CYC-20)
  el('p','',body).textContent=L('cyBody');
  const row=el('label','cyrow',body);row.append(L('cyLen')+' ');const sel=el('select','',row);fillSel(sel,[1,2,3,4].map(k=>[k,L(k>1?'cyWn':'cyW1',{n:k})]));sel.value=n0;
  const ext=el('label','cyext',body),cb=el('input','',ext);cb.type='checkbox';cb.checked=true;const et=el('span','',ext),note=el('p','note',body),wb=el('div','cywk',body);
  const draw=()=>{wb.innerHTML='';const n=+sel.value;if(n<2)return;
    el('div','cyh',wb).textContent=L('cyWkH');el('p','note',wb).textContent=L('cyWkNote');const canMv=n===n0;
    if(canMv)el('p','note',wb).textContent=L('cyOrdNote');
    for(let k=0;k<n;k++){const w=wi[k],r=el('div','cywr',wb),edit=()=>touched.add(k);
      if(canMv)gripRow(r,k);else el('span','',r);   // the existing weeks can be reordered while the length stays (R-CYC-20)
      el('span','cywn',r).textContent=L('wkName',{n:k+1})+(k<n0&&ord[k]!==k+1?' '+L('cyWas',{n:ord[k]}):'');
      const sw=el('button','swatch cysw',r),cl=el('button','cyclr',r);sw.type=cl.type='button';cl.textContent='✕';
      const setSw=()=>{sw.style.background=w.color||'';sw.classList.toggle('none',!w.color);cl.disabled=!w.color;
        const t=L('cyWkCol',{n:k+1,c:w.color||L('cyNoCol')});sw.title=sw.__t=t;sw.setAttribute('aria-label',t);const u=L('cyWkClr',{n:k+1});cl.title=cl.__t=u;cl.setAttribute('aria-label',u)};
      sw.onclick=()=>pickColor(sw,w.color||PAL[k%PAL.length],c=>{w.color=c;edit();setSw()});cl.onclick=()=>{delete w.color;edit();setSw()};setSw();
      const tx=(key,max,ph,lab)=>{const i=el('input','cy'+key,r);i.type='text';i.maxLength=max;i.value=w[key]||'';i.placeholder=L(ph);i.setAttribute('aria-label',L(lab,{n:k+1}));i.oninput=()=>{w[key]=i.value;edit()}};
      tx('name',40,'cyNamePh','cyWkName');tx('desc',300,'cyDescPh','cyWkDesc');
    }};
  // a week's grip: drag it, or focus it and use the arrow keys; the row's name, colour and description go with it
  const mvRow=(i,j)=>{if(i===j||j<0||j>=n0)return;[wi,ord].forEach(a=>{const [x]=a.splice(i,1);a.splice(j,0,x)});upd();const g=wb.querySelectorAll('.cywr .grip')[j];if(g)g.focus()};
  const gripRow=(r,k)=>{const g=el('button','grip',r);g.type='button';g.innerHTML=ICON_GRIP;g.title=g.__t=L('cyGripTip');g.setAttribute('aria-label',L('cyGripLbl',{n:k+1}));
    g.onkeydown=ev=>{const d=ev.key==='ArrowUp'?-1:ev.key==='ArrowDown'?1:0;if(!d)return;ev.preventDefault();mvRow(k,k+d)};
    g.onpointerdown=ev=>{if(ev.button)return;ev.preventDefault();const rows=[...wb.querySelectorAll('.cywr')].slice(0,n0);let to=k;r.classList.add('dragging');
      const clear=()=>rows.forEach(x=>x.classList.remove('dropb','dropa'));
      const mv=e=>{let i=rows.findIndex(x=>{const b=x.getBoundingClientRect();return e.clientY<b.top+b.height/2});if(i<0)i=rows.length;to=i>k?i-1:i;clear();if(to!==k)(rows[i]||rows.at(-1)).classList.add(rows[i]?'dropb':'dropa')};
      const up=()=>{document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);clear();r.classList.remove('dragging');mvRow(k,to)};
      document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up)}};
  const upd=()=>{const n=+sel.value,mul=n0>1&&n>n0&&n%n0===0;ext.style.display=(used||cur.length)&&mul?'':'none';et.textContent=' '+L('cyExtend',{a:1+n0});
    note.textContent=used&&n0>1&&n>n0&&!mul?L('cyOdd',{n}):'';
    for(let k=n0;k<4;k++)if(!touched.has(k))wi[k]=mul&&cb.checked?{...wi[k%n0]}:{};   // the new weeks repeat the old ones when kept in step
    draw()};
  sel.onchange=upd;cb.onchange=upd;upd();
  xdlg({title:L('cyTitle'),full:true,body,buttons:[{label:L('cyApply'),cls:'p',fn:()=>{const n=+sel.value,w=wi.slice(0,n),moved=ord.some((o,i)=>o!==i+1);
    if(moved)reorderWeeks(ord,wi.slice(0,n0));   // a new order first, as its own undo step (R-CYC-20)
    if(n===n0){if(!moved&&JSON.stringify(wiNorm(w,n))!==JSON.stringify(cur)){hist();S.weekInfo=wiNorm(w,n);render()}return}
    if(n<n0&&[...S.events,...S.phases].some(e=>(e.weeks||e.slots.map(s=>s.wk||0)).some(k=>k>n))){setTimeout(()=>shrinkCycle(n,w),0);return}
    setCycle(n,cb.checked,w)}},{label:L('cancel'),dismiss:true}]});
}
// "Weeks 1 and 3" (R-CYC-02); ws = sorted week numbers
// R-CYC-17: a week's name, description and colour (only while the cycle is longer than one week); wkLabel = "Week 2 · At Dad's",
// wkShortL = "W2 At Dad's" (table headers), wkChip = a small swatch of its colour (HTML), wkTip = label and description
const wkI=w=>cyc()>1&&(S.weekInfo||[])[w-1]||{};
const wkCol=w=>wkI(w).color||null,wkDesc=w=>wkI(w).desc||'';
const wkLabel=w=>L('wkName',{n:w})+(wkI(w).name?' · '+wkI(w).name:''),wkShortL=w=>L('wkShort',{n:w})+(wkI(w).name?' '+wkI(w).name:'');
const wkTip=w=>wkLabel(w)+(wkDesc(w)?': '+wkDesc(w):'');
const wkChip=w=>wkCol(w)?`<i class="wkchip" style="background:${esc(wkCol(w))}"></i>`:'';
const wksText=ws=>ws.some(w=>wkI(w).name)?ws.map(wkLabel).join(', '):ws.length===1?L('wkName',{n:ws[0]}):L('wksName',{l:ws.slice(0,-1).join(', '),z:ws.at(-1)});
const wksHTML=ws=>ws.map(wkChip).join('')+esc(wksText(ws));   // the peek card and agenda: chips before the weeks
const wkNote=(e,s)=>{const ws=cyc()>1&&wksOf(e,s);return ws?wksText(ws):''};
const wkNoteH=(e,s)=>{const ws=cyc()>1&&wksOf(e,s);return ws?wksHTML(ws):''};   // with the weeks' colour chips (R-CYC-17)   // the weeks of an occurrence that is not every week (R-CYC-02/03)
const evWks=e=>e.weeks||[...new Set(e.slots.map(s=>s.wk).filter(Boolean))].sort((a,b)=>a-b);
function moveWeeks(d,lost,n,n0){   // a copy per week above n, in a schedule (events) or a rhythm (phases, R-CYC-16) of its own, holding that week's occurrences as week 1 (R-CYC-10/13)
  for(let k=n+1;k<=n0;k++){
    const cps=lost.flatMap(e=>{const c=JSON.parse(JSON.stringify(e));c.id=uid();
      if(e.weeks){if(!e.weeks.includes(k))return[];c.weeks=[1]}else{c.slots=c.slots.filter(s=>s.wk===k).map(s=>({...s,wk:1}));if(!c.slots.length)return[]}
      return [c]});
    const ev=cps.filter(c=>!c.rhythms),ph=cps.filter(c=>c.rhythms);
    if(ev.length){const sc={id:uid(),name:uniqueName(L('wkName',{n:k}),d.schedules.map(x=>x.name)),color:PAL[(d.schedules.length+k)%PAL.length],opacity:1,locked:false,visible:true};
      d.schedules.push(sc);ev.forEach(c=>{c.schedules=[sc.id];d.events.push(c)})}
    if(ph.length){const rh={id:uid(),name:uniqueName(L('wkName',{n:k}),d.rhythms.map(x=>x.name)),visible:false};   // shown only by choice: one rhythm at a time (R-PHS-02)
      d.rhythms.push(rh);ph.forEach(c=>{c.rhythms=[rh.id];d.phases.push(c)})}
  }
}
/* events arriving in workspace d from a cycle of srcN weeks (insert, schedule transfer; R-CYC-13): when some use weeks beyond d's cycle, ask
   whether to lengthen d's cycle, remove those occurrences or keep them in a schedule per week; cb gets 'len' / 'rm' / 'mv' (or '' if nothing to ask) */
const wkOfEv=e=>e.weeks||e.slots.map(s=>s.wk||1);
function askCycle(d,evs,srcN,cb){
  const tn=d.cycle||1,over=evs.filter(e=>wkOfEv(e).some(k=>k>tn));
  if(!over.length){cb('');return}
  setTimeout(()=>{const body=el('div');el('p','',body).textContent=L('icBody',{n:over.length,c:L(tn>1?'cyWn':'cyW1',{n:tn})});
    const rd=el('div','radios',body),opt=(v,t)=>{const l=el('label','',rd),i=el('input','',l);i.type='radio';i.name='icm';i.value=v;l.append(' '+t);return i};
    const r=[opt('len',L('icLen',{m:srcN})),opt('rm',L('cyRm')),opt('mv',L('cyMv'))];r[0].checked=true;
    xdlg({title:L('cyTitle'),body,buttons:[{label:L('cyApply'),cls:'p',fn:()=>{const v=r.find(x=>x.checked).value;setTimeout(()=>cb(v),0)}},{label:L('cancel'),dismiss:true}]})},0);
}
function placeWeeks(d,inc,srcN,ch){   // add the incoming events and phases to d as the choice of askCycle says
  const tn=d.cycle||1;
  if(ch==='len'&&srcN>tn){d.weekInfo=wiResize(d.weekInfo,tn,srcN,tn>1&&srcN%tn===0);if(tn>1&&srcN%tn===0){extendWeeks(d.events,tn,srcN);extendWeeks(d.phases||[],tn,srcN)}d.cycle=srcN}   // the target keeps its own week names (R-CYC-17)   // a multiple keeps d's own rhythm (R-CYC-10)
  const lost=ch==='mv'?inc.filter(e=>wkOfEv(e).some(k=>k>d.cycle)).map(e=>JSON.parse(JSON.stringify(e))):[];   // before normWk drops those weeks
  inc.forEach(c=>{const x=normWk(c,d.cycle);if(x)(x.rhythms?d.phases:d.events).push(x)});
  if(lost.length)moveWeeks(d,lost,d.cycle,srcN);
}
function shrinkCycle(n,wi){   // wi: the weeks' info as edited in the cycle dialog   // R-CYC-10: the events with occurrences in the weeks that go: remove those occurrences, or move them to a schedule per week
  const n0=cyc(),wk=e=>e.weeks||e.slots.map(s=>s.wk||1),lost=[...S.events,...S.phases].filter(e=>wk(e).some(k=>k>n)),body=el('div');
  el('p','',body).textContent=L('cyShrinkBody',{w:wksText([...Array(n0-n).keys()].map(k=>k+n+1))});
  const ul=el('ul','cyl',body);lost.forEach(e=>{el('li','',ul).textContent=e.title+' · '+wksText(evWks(e))+(wk(e).every(k=>k>n)?' · '+L('cyAllGone'):'')});
  const rd=el('div','radios',body),opt=(v,t)=>{const l=el('label','',rd),i=el('input','',l);i.type='radio';i.name='cym';i.value=v;l.append(' '+t);return i};
  const rm=opt('rm',L('cyRm'));opt('mv',L('cyMv'));rm.checked=true;
  xdlg({title:L('cyTitle'),body,buttons:[{label:L('cyApply'),cls:'p',fn:()=>{
    hist();
    if(!rm.checked)moveWeeks(S,lost,n,n0);
    S.weekInfo=wiNorm(wi||S.weekInfo,n);S.cycle=n;normAll(S);render();toast(n>1?L('cyDone',{n}):L('cyDone1'));
  }},{label:L('cancel'),dismiss:true}]});
}
// the week switcher (R-CYC-04) in the grid's corner cell: which week of the cycle the grid shows
function setWeek(w){
  if(live){setAnchor(w);clearTimeout(lvRet);lvCloseAll(true);livePaused=false;focusD=today()}   // correcting Live View's week: today's day and now point in that week
  curWk=w;allWk=false;render();updLive()}
function setAllWk(on){allWk=on&&cyc()>1&&!live;render()}   // every week of the cycle side by side (R-CYC-19)
function wkMenu(anchor){rowMenu(anchor,(m,mi)=>{
  for(let w=1;w<=cyc();w++){mi((w===curWk?ICON_CHECK:'<span class="ic" style="margin:0"></span>')+wkChip(w),wkLabel(w)+(w===todayWk()?' · '+L('wkLiveMark'):''),()=>setWeek(w));
    if(wkDesc(w)){const b=m.lastElementChild;b.title=wkDesc(w);el('small','wkd',b).textContent=wkDesc(w)}}   // the description under its name (R-CYC-17)
  if(!live){mi((allWk?ICON_CHECK:'<span class="ic" style="margin:0"></span>'),L('wkAllM'),()=>setAllWk(true));m.lastElementChild.title=L('wkAllMTip');   // R-CYC-19
    el('hr','',m);mi(ICON_WEEK,L('cyMenu'),openCycle)}
})}
function wsMenu(anchor){rowMenu(anchor,(m,mi)=>{
  WS.forEach(w=>mi(w.id===curId?ICON_CHECK:'<span class="ic" style="margin:0"></span>',w.name+(wsDirty(w)?' •':''),()=>switchWs(w.id)));
  el('hr','',m);
  mi(ICON_PLUS,L('wsNew'),addWorkspace);mi(ICON_WS,L('wsRename'),renameWorkspace);mi(ICON_WS,L('wsDup'),duplicateWorkspace);mi(ICON_WEEK,L('cyMenu'),openCycle);mi(ICON_WS,L('wsDel'),deleteWorkspace,'d');
})}
/* import: files and links share one dialog (new workspace / insert / replace matching); nothing is ever merged */
const matchesOf=w=>{const out=[],byId=w.id&&WS.find(x=>x.id===w.id);if(byId)out.push(byId);WS.forEach(x=>{if(x.name.toLowerCase()===w.name.toLowerCase()&&!out.includes(x))out.push(x)});return out};
const flagLbl=(w,t)=>{const f=[];if(t.id===curId)f.push(L('flagActive'));if(w.id&&t.id===w.id)f.push(L('flagId'));if(t.name.toLowerCase()===w.name.toLowerCase())f.push(L('flagName'));return t.name+(f.length?'  ('+f.join(', ')+')':'')};
function adoptWs(w,source){   // first-time visitor with an untouched default workspace: the imported workspace takes its place
  const r=newWs(w.name,w.data,source==='file');if(w.id)r.id=w.id;WS=[r];curId=r.id;S=r.data;undoSt=r.undo;redoSt=r.redo;selK=null;render();
}
function applyImport(w,target,source){   // target = existing workspace to replace, or null = import as a new workspace
  syncWs();let rec;
  if(target){pushUndoWs(target);if(target.id===curId)S=w.data;else target.data=w.data;if(source==='file')target.lf=keyOf(w.data);rec=target;toast(L('impReplaced',{n:target.name}))}
  else{rec=newWs(uniqueName(w.name,WS.map(x=>x.name)),w.data,source==='file');if(w.id&&!WS.some(x=>x.id===w.id))rec.id=w.id;WS.push(rec);toast(L('impDone'))}
  if(rec.id!==curId)switchWs(rec.id);else render();
}
function mapTypes(src,td){   // activity types travel by name (case-insensitive): an existing type of that name is used, otherwise it is created
  const m={};src.forEach(t=>{const same=td.types.find(x=>x.name.toLowerCase()===t.name.toLowerCase());if(same)m[t.id]=same.id;else{const n={...t,id:uid(),visible:true};td.types.push(n);m[t.id]=n.id}});return m;
}
function retype(c,tm){if(c.type&&tm[c.type])c.type=tm[c.type];else delete c.type}
function insertInto(src,ch){
  hist();const d=S,mp={s:{},p:{},r:{}},inc=[];
  const tm=mapTypes(src.types,d);
  src.people.forEach(q=>{const id=uid();mp.p[q.id]=id;d.people.push({...q,id,name:uniqueName(q.name,d.people.map(x=>x.name))})});
  src.schedules.forEach(s=>{const id=uid();mp.s[s.id]=id;d.schedules.push({...s,id,name:uniqueName(s.name,d.schedules.map(x=>x.name)),visible:true})});
  src.events.forEach(e=>{const c=JSON.parse(JSON.stringify(e));c.id=uid();c.schedules=c.schedules.map(i=>mp.s[i]).filter(Boolean);c.involved=c.involved.map(i=>mp.p[i]).filter(Boolean);if(c.owner)c.owner=mp.p[c.owner];if(!c.owner)delete c.owner;c.slots.forEach(sl=>{sl.person=mp.p[sl.person]||'';if(sl.inv)sl.inv=sl.inv.map(i=>mp.p[i]).filter(Boolean)});retype(c,tm);if(c.schedules.length)inc.push(c)});
  const had=d.rhythms.some(r=>r.visible);
  src.rhythms.forEach((r,i)=>{const id=uid();mp.r[r.id]=id;d.rhythms.push({...r,id,name:uniqueName(r.name,d.rhythms.map(x=>x.name)),visible:!had&&i===0})});
  src.phases.forEach(p=>{const c=JSON.parse(JSON.stringify(p));c.id=uid();c.rhythms=c.rhythms.map(i=>mp.r[i]).filter(Boolean);if(c.rhythms.length)inc.push(c)});
  placeWeeks(d,inc,src.cycle||1,ch);   // weeks beyond the current cycle, events and phases (R-CYC-13, R-CYC-16)
}
function pickReplace(w,source){   // choose which workspace to replace (flags: active / same id / same name), then confirm
  const m=matchesOf(w),cands=[...m,...WS.filter(x=>!m.includes(x)).sort((a,b)=>(b.id===curId)-(a.id===curId))];
  const body=el('div');el('p','',body).textContent=L('impPickBody',{s:w.name});
  const rd=el('div','radios',body),radios=cands.map(t=>{const l=el('label','',rd),i=el('input','',l);i.type='radio';i.name='tgt';i.value=t.id;l.append(' '+flagLbl(w,t));return i});
  radios[0].checked=true;
  xdlg({title:L('impPickTitle'),body,buttons:[{label:L('mapCont'),cls:'p',fn:()=>{const tg=WS.find(x=>x.id===radios.find(r=>r.checked).value);setTimeout(()=>confirmReplace(w,tg,source),0)}},{label:L('cancel'),dismiss:true}]});
}
function confirmReplace(w,tg,source){
  const body=el('div');el('p','',body).textContent=L('impConf1',{t:tg.name,s:w.name});el('p','note',body).textContent=L('impConfUndo');
  xdlg({title:L('impConfTitle'),body,buttons:[{label:L('impReplace'),cls:'p',fn:()=>applyImport(w,tg,source)},{label:L('cancel'),dismiss:true}]});
}
function openImport(w,source){   // files and links hold one workspace: import as new, insert into the current one, or replace an existing one
  const body=el('div'),d=w.data;
  el('p','',body).textContent=L('impBodyOne',{n:w.name,c:L('impCounts',{s:d.schedules.length,e:d.events.length,p:d.people.length,r:d.rhythms.length,h:d.phases.length})});
  const rd=el('div','radios',body);
  const opt=(v,label)=>{const l=el('label','',rd),i=el('input','',l);i.type='radio';i.name='impm';i.value=v;l.append(' '+label);return i};
  const rNew=opt('new',L('impNew')),rIns=opt('insert',L('impInsert')),rRep=opt('replace',L('impOverPick'));rNew.checked=true;
  xdlg({title:L('impTitle'),body,buttons:[{label:L('impDo'),cls:'p',fn:()=>{
    const mode=[rNew,rIns,rRep].find(r=>r.checked).value;
    if(mode==='insert')askCycle(S,[...d.events,...d.phases],d.cycle||1,ch=>{insertInto(d,ch);render();toast(L('impInserted'))});
    else if(mode==='new')applyImport(w,null,source);
    else setTimeout(()=>pickReplace(w,source),0)}},{label:L('cancel'),dismiss:true}]});
}
/* copy / move schedules (with their events) and rhythms (with their phases) to another workspace */
function removeSchedule(d,s){d.schedules=d.schedules.filter(x=>x!==s);d.events.forEach(e=>e.schedules=e.schedules.filter(i=>i!==s.id));d.events=d.events.filter(e=>e.schedules.length)}
function removeRhythm(d,r){d.rhythms=d.rhythms.filter(x=>x!==r);d.phases.forEach(p=>p.rhythms=p.rhythms.filter(i=>i!==r.id));d.phases=d.phases.filter(p=>p.rhythms.length)}
function openTransfer(kind,obj){
  const others=WS.filter(w=>w.id!==curId);
  if(!others.length){toast(L('trNeed'));return}
  const body=el('div');el('label','',body).textContent=L('trTarget');
  const sel=el('select','',body);fillSel(sel,others.map(w=>[w.id,w.name]));
  const rd=el('div','radios',body);
  const mk=(v,k,c)=>{const l=el('label','',rd),i=el('input','',l);i.type='radio';i.name='trop';i.value=v;i.checked=c;l.append(' '+L(k));return i};
  mk('copy','trCopy',true);const rm=mk('move','trMove',false);
  xdlg({title:L('trTitle')+': '+(obj.name||obj.title),full:true,body,buttons:[{label:L('trGo'),cls:'p',fn:()=>{const tw=WS.find(w=>w.id===sel.value),mv=rm.checked;setTimeout(()=>doTransfer(kind,obj,tw,mv),0)}},{label:L('cancel'),dismiss:true}]});
}
function askPeople(src,tw,pids,cb){
  const body=el('div');el('p','note',body).textContent=L('mapBody',{t:tw.name});
  const rows=pids.map(pid=>{const q=src.people.find(x=>x.id===pid),r=el('div','mrow',body);el('span','',r).innerHTML=pIcon(q)+esc(q.name);
    const s=el('select','',r);fillSel(s,[['__new__',L('mapNew',{n:q.name})],...tw.data.people.map(x=>[x.id,L('mapUse',{n:x.name})]),['',L('mapBlank')]]);
    const same=tw.data.people.find(x=>x.name.toLowerCase()===q.name.toLowerCase());s.value=same?same.id:'__new__';return [pid,s]});
  xdlg({title:L('mapTitle'),full:true,body,buttons:[{label:L('mapCont'),cls:'p',fn:()=>{const map={};rows.forEach(([pid,s])=>map[pid]=s.value);setTimeout(()=>cb(map),0)}},{label:L('cancel'),dismiss:true}]});
}
// events of the current workspace carried into workspace tw (R-DATA-04): the people they use are mapped first (askPeople), activity types go by
// name, weeks beyond tw's cycle are asked about (R-CYC-13). place(td) gives the target schedule's id (creating it when needed); done() runs after
function carryEvents(evs,tw,place,done){
  syncWs();const src=S,td=tw.data,ids=new Set();
  evs.forEach(e=>{e.involved.forEach(i=>ids.add(i));if(e.owner)ids.add(e.owner);e.slots.forEach(s=>{if(s.person)ids.add(s.person);(s.inv||[]).forEach(i=>ids.add(i))})});
  const pids=[...ids].filter(i=>src.people.some(q=>q.id===i));
  const run=(map,ch)=>{
    pushUndoWs(tw);const pm={},inc=[];
    Object.entries(map).forEach(([pid,v])=>{if(v==='__new__'){const q=src.people.find(x=>x.id===pid),nq={id:uid(),name:q.name,color:q.color,visible:true,...(q.external?{external:true}:{})};td.people.push(nq);pm[pid]=nq.id}else pm[pid]=v});
    const sid=place(td),tm=mapTypes(src.types.filter(t=>evs.some(e=>e.type===t.id)),td);
    evs.forEach(e=>{const c=JSON.parse(JSON.stringify(e));c.id=uid();c.schedules=[sid];c.involved=c.involved.map(i=>pm[i]).filter(Boolean);if(c.owner)c.owner=pm[c.owner];if(!c.owner)delete c.owner;c.slots.forEach(sl=>{sl.person=sl.fo?c.owner||'':sl.person?(pm[sl.person]||''):'';if(sl.inv)sl.inv=sl.inv.map(i=>pm[i]).filter(Boolean)});retype(c,tm);inc.push(c)});
    placeWeeks(td,inc,src.cycle||1,ch);   // weeks beyond the target's cycle (R-CYC-13)
    done();
  };
  askCycle(td,evs,src.cycle||1,ch=>{if(!pids.length)run({},ch);else askPeople(src,tw,pids,m=>run(m,ch))});
}
function doTransfer(kind,obj,tw,move){
  syncWs();const src=S,td=tw.data;
  if(kind==='schedule'){
    carryEvents(src.events.filter(e=>e.schedules.includes(obj.id)),tw,td=>{const ns={...obj,id:uid(),name:uniqueName(obj.name,td.schedules.map(x=>x.name)),visible:true};td.schedules.push(ns);return ns.id},
      ()=>{if(move){pushUndoWs(cw());removeSchedule(S,obj)}render();toast(L(move?'trMoved':'trDone',{n:tw.name}))});
  }else{
    const phs=src.phases.filter(p=>p.rhythms.includes(obj.id));
    askCycle(td,phs,src.cycle||1,ch=>{   // weeks beyond the target's cycle (R-CYC-13, R-CYC-16)
      pushUndoWs(tw);const had=td.rhythms.some(r=>r.visible);
      const nr={id:uid(),name:uniqueName(obj.name,td.rhythms.map(x=>x.name)),visible:!had};td.rhythms.push(nr);
      placeWeeks(td,phs.map(p=>{const c=JSON.parse(JSON.stringify(p));c.id=uid();c.rhythms=[nr.id];return c}),src.cycle||1,ch);
      if(move){pushUndoWs(cw());removeRhythm(S,obj)}
      render();toast(L(move?'trMoved':'trDone',{n:tw.name}));
    });
  }
}
