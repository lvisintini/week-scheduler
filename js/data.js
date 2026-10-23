// Data: state and history, the data format and its upgrades (MIG, parseData), workspaces, the cycle of weeks, import and transfers. ES module (docs/architecture.md).
import {state} from './state.js';
import {L} from './i18n.js';
import {$,ICON_CHECK,ICON_PLUS,ICON_WEEK,ICON_WS,PAL,SNAP,TICONS,el,esc,normHex,pIcon,pickColor,uid} from './basics.js';
import {b64u,openProtect,seal,unb64u,unseal} from './share.js';
import {openIcs} from './ics.js';
import {cyc,fitMg,kept,liveTick,lvCloseAll,lvRet,poolOf,savePrefs,setAnchor,toast,today,todayWk,updLive,wksOf,xdlg} from './model.js';
import {renderSide,rowGrip,rowMenu} from './sidebar.js';
import {render} from './grid.js';
import {fillSel} from './dialog.js';
/* ---------- state, history, persistence ---------- */
export const WKEY='weekly-schedules-workspaces',PKEY='weekly-schedules-prefs';
export const isAdv=sl=>new Set(sl.map(s=>(s.wk||0)*7+s.day)).size<sl.length;   // some day has two times (per week of the cycle, R-CYC-09)
export const sameDay=(x,y,day=y.day)=>x.day===day&&(x.wk||0)===(y.wk||0);
// moving by days (R-CYC-09): a repetition with its own week moves along the cycle (Sunday of week 1 + 1 = Monday of week 2), any other mod 7
export const absD=s=>((s.wk||1)-1)*7+s.day;
export function shiftDay(s,dD){if(!s.wk){s.day=((s.day+dD)%7+7)%7;return}const n=cyc()*7,x=((absD(s)+dD)%n+n)%n;s.wk=Math.floor(x/7)+1;s.day=x%7}
export const sameSet=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));
export const keyOf=d=>JSON.stringify({wsc:d.color||'',wsd:d.desc||'',cycle:d.cycle||1,pool:poolOf(d),weekInfo:wiNorm(d.weekInfo,poolOf(d)),schedules:d.schedules.map(({visible,opacity,...r})=>r),people:d.people.map(({visible,...r})=>r),types:d.types.map(({visible,...r})=>r),events:d.events,rhythms:d.rhythms.map(({visible,...r})=>r),phases:d.phases});
export const cw=()=>state.WS.find(w=>w.id===state.curId);
const wsData=w=>w.id===state.curId?state.S:w.data;
const wsDirty=w=>{const k=keyOf(wsData(w));return k!==w.lb&&k!==w.lf};
export const isDirty=()=>{const w=cw();return !!w&&wsDirty(w)};
export const anyDirty=()=>state.WS.some(wsDirty);
function syncWs(){const w=cw();if(w){w.data=state.S;w.undo=state.undoSt;w.redo=state.redoSt}}
export function newWs(name,data,saved){return {id:uid(),name,data,lb:null,lf:saved?keyOf(data):null,undo:[],redo:[]}}
function switchWs(id){if(id===state.curId||!state.WS.some(w=>w.id===id))return;syncWs();state.curId=id;const w=cw();state.S=w.data;state.undoSt=w.undo||[];state.redoSt=w.redo||[];state.selK=null;state.curWk=todayWk()||state.curWk;render();if(state.live)setTimeout(liveTick,0)}   // on today's week of that workspace, when known (R-CYC-05)
export function pushUndoWs(w){if(w.id===state.curId){hist();return}w.undo=w.undo||[];w.undo.push(JSON.stringify(w.data));if(w.undo.length>100)w.undo.shift();w.redo=[]}
const uniqueName=(base,names)=>{let n=base,i=2;while(names.includes(n))n=base+' ('+(i++)+')';return n};
export function updUR(){const u=$('undoB'),r=$('redoB');if(u)u.disabled=!state.undoSt.length;if(r)r.disabled=!state.redoSt.length}
export function pushUndo(str){state.undoSt.push(str);if(state.undoSt.length>100)state.undoSt.shift();state.redoSt=[];updUR()}
export const hist=()=>pushUndo(JSON.stringify(state.S));
function restoreState(str){
  const old=state.S;state.S=JSON.parse(str);
  state.S.schedules.forEach(s=>{const o=old.schedules.find(x=>x.id===s.id);if(o){s.visible=o.visible;s.opacity=o.opacity}});
  state.S.people.forEach(q=>{const o=old.people.find(x=>x.id===q.id);if(o)q.visible=o.visible});
  state.S.types.forEach(t=>{const o=old.types.find(x=>x.id===t.id);if(o)t.visible=o.visible});
  state.S.phaseOpacity=old.phaseOpacity;state.S.rhythms.forEach(s=>{const o=old.rhythms.find(x=>x.id===s.id);s.visible=o?o.visible:false});
}
// an entry is the state as JSON, or {s, wp} for a new order of the weeks (R-CYC-20): undoing or redoing it also moves the shown week and today's week
export function undo(){if(!state.undoSt.length)return;state.selK=null;const x=state.undoSt.pop();state.redoSt.push(x.wp?{s:JSON.stringify(state.S),wp:x.wp}:JSON.stringify(state.S));restoreState(x.s||x);if(x.wp)wkFollow(Object.fromEntries(x.wp.map((o,i)=>[i+1,o])));render()}
export function redo(){if(!state.redoSt.length)return;state.selK=null;const x=state.redoSt.pop();state.undoSt.push(x.wp?{s:JSON.stringify(state.S),wp:x.wp}:JSON.stringify(state.S));restoreState(x.s||x);if(x.wp)wkFollow(Object.fromEntries(x.wp.map((o,i)=>[o,i+1])));render()}
/* Data format (R-DATA-08): FMT is the version of a workspace record (files, links, each workspace in browser memory; the store wrapper
   carries the same number). Raise it on ANY change to what is stored, even an added field (an older app would drop it and then save),
   add MIG[FMT-1] and a folder of sample files under tests/fixtures/. Data newer than FMT is refused, never half-read (R-DATA-09). */
export const FMT=15;
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
  12:j=>j,   // 13 added a workspace's color and desc (R-DATA-10); version-12 data has none
  13:j=>j,   // 14 added browser memory protected with a passphrase (R-DATA-11); a workspace record is unchanged
  14:j=>j,   // 15 added pool, the staged weeks kept after the cycle (R-CYC-21); version-14 data has none
};
export const verOf=x=>x&&x.version!=null?+x.version:1;   // no version (hand-written files) = version 1
export function migrate(j,v,to=FMT,steps=MIG){   // raw record of version v -> current version (to/steps: for tests only)
  if(!j||typeof j!=='object'||Array.isArray(j))throw new Error('bad');
  if(!Number.isInteger(v)||v<1)throw new Error('bad');
  if(v>to)throw new Error('newer');
  for(;v<to;v++)j=steps[v](j);
  return j;
}
export const errKey=(e,fb)=>e&&e.message==='limit'?'tooBig':e&&e.message==='newer'?'newer':fb;
const LIM={schedules:100,people:500,types:100,events:5000,rhythms:100,phases:2000,slots:200};   // applied to imported files and links
/* the weeks of an event in a cycle of n weeks (R-CYC-02/03): a week pattern (event.weeks, absent = every week) or a week on every
   repetition (slot.wk, 1..n); the mode is inferred from the repetitions. Returns the event normalised, or null when nothing is left. */
export function normWk(e,n){
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
export function parseData(j,strict){
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
  const cyc=Number.isInteger(+j.cycle)?clamp(+j.cycle,1,4):1,pl=Number.isInteger(+j.pool)?clamp(+j.pool,cyc,8):cyc;   // the weeks kept: the cycle and its staged weeks (R-CYC-21)
  {let seen=false;rhythms.forEach(s=>{if(s.visible&&seen)s.visible=false;if(s.visible)seen=true})}
  return {
    schedules:j.schedules.map(s=>({id:String(s.id),name:String(s.name).slice(0,200),color:normHex(s.color)||PAL[0],opacity:s.opacity==null?1:clamp(+s.opacity||1,.1,1),locked:!!s.locked,visible:s.visible!==false})),
    people:arr(j.people).map((q,i)=>({id:String(q.id),name:String(q.name).slice(0,200),color:normHex(q.color)||PAL[i%PAL.length],visible:q.visible!==false,...(q.external===true?{external:true}:{})})),
    types,
    events:arr(j.events).map(v=>({...item(v),...(v.type!=null&&tids.has(String(v.type))?{type:String(v.type)}:{}),schedules:arr(v.schedules).map(String),involved:arr(v.involved).map(String),...(v.owner!=null&&pids.has(String(v.owner))?{owner:String(v.owner)}:{}),...(v.oncall===true?{oncall:true}:{}),...(v.nest===true?{nest:true}:{}),...(typeof v.turns==='boolean'?{turns:v.turns}:{}),...(v.bg===true?{bg:true}:v.away===true?{away:true}:{}),...(Array.isArray(v.weeks)?{weeks:v.weeks}:{}),slots:lim(v.slots,LIM.slots).map(x=>({...slot(x,state.MAXEND,true),...(x.wk!=null?{wk:x.wk}:{})}))})).map(own).map(e=>normWk(e,pl)).filter(e=>e&&e.slots.length),
    rhythms,
    phases:arr(j.phases).map(v=>({...item(v),rhythms:arr(v.rhythms).map(String),...(Array.isArray(v.weeks)?{weeks:v.weeks}:{}),slots:lim(v.slots,LIM.slots).map(x=>({...slot(x,1440,false),...(x.wk!=null?{wk:x.wk}:{})}))})).map(p=>normWk(p,pl)).filter(p=>p&&p.slots.length),   // phases have weeks like events (R-CYC-16)
    phaseOpacity:j.phaseOpacity==null?.3:clamp(+j.phaseOpacity||.3,.05,1),
    cycle:cyc,...(pl>cyc?{pool:pl}:{}),weekInfo:wiNorm(j.weekInfo,pl),
    ...(normHex(j.color)?{color:normHex(j.color)}:{}),...(typeof j.desc==='string'&&j.desc.trim()?{desc:j.desc.trim().slice(0,300)}:{})   // the workspace's colour and description (R-DATA-10)
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
export function defaultData(){return {schedules:[{id:uid(),name:L('sched1'),color:PAL[0],opacity:1,locked:false,visible:true}],events:[],people:[],types:defaultTypes(),...defaultRhythm(),phaseOpacity:.3,cycle:1,weekInfo:[]}}
export function initDefault(){const w=newWs(L('wsDefault'),defaultData(),true);state.WS=[w];state.curId=w.id;state.S=w.data;state.undoSt=w.undo;state.redoSt=w.redo}
/* ---------- workspaces: several named data sets in browser memory ---------- */
export const readStore=()=>{try{const s=localStorage.getItem(WKEY);return s?JSON.parse(s):null}catch(e){return null}};   // as stored: plain, protected or newer
export const memGet=()=>{try{return localStorage.getItem(WKEY)}catch(e){return null}};
// R-DATA-11: browser memory may be protected with a passphrase, {version, sealed:<base64url blob of the plain store>} under the same key.
// The key is derived when it is opened and lives only in this page (state.memKey, {key,salt,iter}); every save reuses it with a new IV.
export const isSealed=st=>!!st&&typeof st.sealed==='string';
// runs fn with the plain store (null when nothing is stored; a newer one as it is, for its own checks). When another tab has protected,
// unprotected or re-protected browser memory since this page opened it, nothing is read or written: the page has to be reloaded
export function withStore(fn){
  const st=readStore();
  if(st&&verOf(st)>FMT)return fn(st);
  if(st&&isSealed(st)!==!!state.memKey){alert(L('memTab'));return}
  if(!isSealed(st))return fn(st);
  return unseal(unb64u(st.sealed),null,state.memKey).then(fn,e=>alert(L(e&&e.message==='salt'?'memTab':'badFile')));
}
// the outer version is always this app's, so an older cached page refuses a protected store instead of saving over it (R-DATA-09)
export const writeStore=st=>state.memKey?seal(st,null,state.memKey).then(b=>localStorage.setItem(WKEY,JSON.stringify({version:FMT,sealed:b64u(b)}))):localStorage.setItem(WKEY,JSON.stringify(st));
const pickData=d=>{const wi=wiNorm(d.weekInfo,poolOf(d));return {...(d.color?{color:d.color}:{}),...(d.desc?{desc:d.desc}:{}),schedules:d.schedules,people:d.people,types:d.types,events:d.events,rhythms:d.rhythms,phases:d.phases,phaseOpacity:d.phaseOpacity,...(d.cycle>1?{cycle:d.cycle}:{}),...(poolOf(d)>(d.cycle||1)?{pool:poolOf(d)}:{}),...(wi.length?{weekInfo:wi}:{})}};
const wsEntry=w=>({id:w.id,name:w.name,...pickData(wsData(w))});
export function buildFile(){syncWs();const w=cw();return {version:FMT,id:w.id,name:w.name,...pickData(w.data)}}   // file / link = one workspace
export const parseWorkspace=(j,fallbackName)=>{j=migrate(j,verOf(j));return {id:j.id?String(j.id):null,name:String(j.name||fallbackName||L('wsImported')).slice(0,200),data:parseData(j,true)}};
const memNewer=()=>{const st=readStore();return !!st&&verOf(st)>FMT};   // browser memory written by a newer app: never read or overwritten (R-DATA-09)
export function loadStore(st=readStore()){  // fills WS from the plain store of browser memory; falls back to the default workspace
  try{
    if(st&&verOf(st)>FMT){alert(L('memNewer'));throw 0}   // also a protected one (R-DATA-11), which has no list outside
    if(!st||!Array.isArray(st.workspaces)||!st.workspaces.length)throw 0;
    state.WS=st.workspaces.map(e=>{const d=parseData(migrate(e,verOf(st))),w=newWs(String(e.name||L('wsDefault')).slice(0,200),d,false);if(e.id)w.id=String(e.id);w.lb=keyOf(d);return w});orderWs();
    state.curId=state.WS.some(w=>w.id===st.current)?st.current:state.WS[0].id;
    const w=cw();state.S=w.data;state.undoSt=w.undo;state.redoSt=w.redo;
  }catch(e){initDefault()}
}
export function saveMem(scope){   // synchronous for plain browser memory; a promise when it is protected (R-DATA-11)
  syncWs();
  if(memNewer()){alert(L('memNewerSave'));return}
  return withStore(st=>{try{
    if(!st||!Array.isArray(st.workspaces))st={version:FMT,workspaces:[]};
    if(scope==='all')st={version:FMT,current:state.curId,workspaces:state.WS.map(wsEntry)};
    else{const sv=verOf(st);st.workspaces=st.workspaces.map(x=>{const {version,...r}=migrate(x,sv);return r});st.version=FMT;   // the other stored workspaces move to the current format too
      const e=wsEntry(cw()),i=st.workspaces.findIndex(x=>x.id===e.id);if(i>=0)st.workspaces[i]=e;else st.workspaces.push(e);st.current=state.curId}
    const ks=(scope==='all'?state.WS:[cw()]).map(w=>[w,keyOf(wsData(w))]),done=()=>{ks.forEach(([w,k])=>{w.lb=k});toast(L('savedMem'));renderSide()};   // what was saved, even if it changes meanwhile
    const p=writeStore(st);if(p)return p.then(done,()=>toast(L('memFail')));done();
  }catch(e){toast(L('memFail'))}});
}
export function saveTo(target){   // files and links always hold just the current workspace; browser memory can save one or all
  if(target==='file'||target==='link'){setTimeout(()=>openProtect(target),0);return}
  if(target==='ics'){setTimeout(openIcs,0);return}   // a calendar file: an export, not a save (R-SHARE-09)   // open after the Save dialog has closed (a dialog opened from inside a button handler would be closed again by it)
  if(state.WS.length<2){saveMem('all');return}   // with a single workspace "current" and "all" are the same, and saving all also drops deleted workspaces from the store
  setTimeout(()=>xdlg({title:L('scopeTitle'),body:`<p>${esc(L('scopeBody'))}</p>`,buttons:[{label:L('scopeCur',{n:cw().name}),cls:'p',fn:()=>saveMem('current')},{label:L('scopeAll',{n:state.WS.length}),fn:()=>saveMem('all')},{label:L('cancel'),dismiss:true}]}),0);
}
export function addWorkspace(){
  const n=prompt(L('pWs'),uniqueName(L('wsDefault'),state.WS.map(w=>w.name)));if(!n)return;
  syncWs();const w=newWs(uniqueName(n.trim().slice(0,200),state.WS.map(x=>x.name)),defaultData(),true);state.WS.push(w);switchWs(w.id);
}
// R-DATA-10: every workspace in one list: its place in this browser's order (grip), its colour, name and description; Apply changes them together.
// Colour and description are workspace data (an undo step in each workspace that changes); the name is the workspace's own, as with Rename
function openWorkspaces(){
  syncWs();const rows=state.WS.map(w=>({w,name:w.name,color:w.data.color||'',desc:w.data.desc||''}));
  const body=el('div');el('p','note',body).textContent=L('wsMgNote');const wb=el('div','cywk',body);
  const mv=(i,j)=>{if(i===j||j<0||j>=rows.length)return;const [x]=rows.splice(i,1);rows.splice(j,0,x);draw();const g=wb.querySelectorAll('.wsr .grip')[j];if(g)g.focus()};
  const draw=()=>{wb.innerHTML='';rows.forEach((x,k)=>{const r=el('div','cywr wsr',wb);
    rowGrip(r,k,()=>[...wb.querySelectorAll('.wsr')],mv,L('wsMgGrip'),L('wsMgGripLbl',{n:x.name}));
    const sw=el('button','swatch cysw',r),cl=el('button','cyclr',r);sw.type=cl.type='button';cl.textContent='✕';
    const setSw=()=>{sw.style.background=x.color;sw.classList.toggle('none',!x.color);cl.disabled=!x.color;const t=L('wsMgCol',{n:x.name,c:x.color||L('cyNoCol')});sw.title=sw.__t=t;sw.setAttribute('aria-label',t);const u=L('wsMgClr',{n:x.name});cl.title=cl.__t=u;cl.setAttribute('aria-label',u)};
    sw.onclick=()=>pickColor(sw,x.color||PAL[k%PAL.length],c=>{x.color=c;setSw()});cl.onclick=()=>{x.color='';setSw()};setSw();
    const tx=(key,max,ph,lab)=>{const i=el('input','cy'+key,r);i.type='text';i.maxLength=max;i.value=x[key];i.placeholder=L(ph);i.setAttribute('aria-label',L(lab,{n:x.name}));i.oninput=()=>{x[key]=i.value}};
    tx('name',200,'wsMgNamePh','wsMgName');tx('desc',300,'wsMgDescPh','wsMgDesc')})};
  draw();
  xdlg({title:L('wsMgTitle'),full:true,body,buttons:[{label:L('cyApply'),cls:'p',fn:()=>{
    rows.forEach(x=>{const w=x.w,nm=x.name.trim().slice(0,200)||w.name,d=x.desc.trim().slice(0,300);w.name=nm;
      if(x.color!==(w.data.color||'')||d!==(w.data.desc||'')){pushUndoWs(w);if(x.color)w.data.color=x.color;else delete w.data.color;if(d)w.data.desc=d;else delete w.data.desc}});
    state.WS=rows.map(x=>x.w);state.prefs.wsOrder=state.WS.map(w=>w.id);savePrefs();state.S=cw().data;render()}},{label:L('cancel'),dismiss:true}]});
}
function renameWorkspace(){const n=prompt(L('pWs'),cw().name);if(!n)return;cw().name=n.trim().slice(0,200);render()}
function duplicateWorkspace(){syncWs();const w=newWs(uniqueName(cw().name+L('wsCopySuffix'),state.WS.map(x=>x.name)),JSON.parse(JSON.stringify(state.S)),false),t=state.prefs.lvAnchor[state.curId];if(t){state.prefs.lvAnchor[w.id]=t;savePrefs()}state.WS.push(w);switchWs(w.id)}   // the copy keeps today's week
function deleteWorkspace(){
  if(state.WS.length<2){toast(L('wsLast'));return}
  if(!confirm(L('confWs',{n:cw().name})))return;
  delete state.prefs.lvAnchor[state.curId];delete state.prefs.icsLast[state.curId];savePrefs();const i=state.WS.indexOf(cw());state.WS.splice(i,1);const nx=state.WS[Math.min(i,state.WS.length-1)];state.curId=nx.id;state.S=nx.data;state.undoSt=nx.undo||[];state.redoSt=nx.redo||[];state.selK=null;render();
}
/* the cycle of weeks (R-CYC-01/10): its length is data. Lengthening keeps every-week events every week; going to a multiple can repeat the
   events of chosen weeks in the new weeks, so their rhythm stays (week 1 of 2 → weeks 1 and 3 of 4). Shrinking asks first (shrinkCycle). */
const chosenWk=e=>!!e.weeks||e.slots.some(s=>s.wk);
const chosen=e=>e.weeks||e.slots.map(s=>s.wk).filter(Boolean);   // the weeks chosen for an event or phase ([] = every week)
const lostIn=(d,ks)=>[...d.events,...d.phases].filter(e=>chosen(e).some(k=>ks.includes(k)));   // what was chosen for some week of ks
const normAll=d=>{const n=poolOf(d);d.events=d.events.map(e=>normWk(e,n)).filter(Boolean);d.phases=d.phases.map(p=>normWk(p,n)).filter(Boolean)};   // events and phases (R-CYC-16), over every kept week (R-CYC-21)
function extendWeeks(evs,n0,n){   // periodic extension from n0 to a multiple n
  evs.forEach(e=>{if(e.weeks)e.weeks=[...new Set(e.weeks.flatMap(k=>[...Array(n/n0).keys()].map(r=>k+r*n0)))].sort((a,b)=>a-b);
    else if(e.slots.some(s=>s.wk))e.slots=e.slots.flatMap(s=>[...Array(n/n0).keys()].map(r=>({...s,wk:s.wk+r*n0})))});
}
// R-CYC-17: the weeks' names, descriptions and colours follow a change of the cycle from n0 to n weeks: extending to a multiple repeats them
// (week 3 takes week 1's), any other lengthening leaves the new weeks blank; p0 = the weeks kept before, staged ones keep theirs (R-CYC-21)
const wiResize=(wi,n0,n,extend,p0=n0)=>{const a=wiNorm(wi,p0);return wiNorm(extend&&n>n0&&n%n0===0?[...Array(n).keys()].map(k=>a[k%n0]||{}):a,Math.max(n,p0))};
// R-CYC-20/21: the kept weeks in a new order (ord[i] = the week that becomes week i+1; 0 = a staged week added in the dialog, cp[i] = the week
// it starts as a copy of, if any). A kept week left out of ord is deleted with what was chosen for it (ch 'mv': kept in a schedule or rhythm of
// its own, moveWeeks). Every event, phase and time moves with its week, and so do its name, description and colour (wiNew, as edited in the
// dialog, in the new order); the shown week and today's week follow their content. One undo step that keeps the order.
function reorderWeeks(ord,wiNew,ch,cp=[]){
  const p0=kept(),t=state.prefs.lvAnchor[state.curId]&&todayWk(),gone=[...Array(p0).keys()].map(k=>k+1).filter(k=>!ord.includes(k)),tmp=ord.map((o,i)=>o||p0+1+i),mp={};tmp.forEach((o,i)=>mp[o]=i+1);   // tmp: a new week's number until renumbered
  hist();state.undoSt[state.undoSt.length-1]={s:state.undoSt.at(-1),wp:[...ord]};
  cp.forEach((f,i)=>{if(f&&!ord[i])copyWeek(state.S,f,tmp[i])});
  if(ch==='mv'&&gone.length)moveWeeks(state.S,lostIn(state.S,gone),gone);
  remapWk(state.S,mp,ord.length);state.S.weekInfo=wiNorm(wiNew,kept());wkFollow(mp,t);render();
}
// week k starts as a copy of week f (R-CYC-21): the patterns that include f include k, and f's own times are repeated in k
function copyWeek(d,f,k){[...d.events,...d.phases].forEach(e=>{if(e.weeks){if(e.weeks.includes(f))e.weeks=[...e.weeks,k].sort((a,b)=>a-b)}else e.slots.push(...e.slots.filter(s=>s.wk===f).map(s=>({...s,wk:k})))})}
// renumbers the kept weeks of d: mp[k] = the new number of week k; a week missing from mp goes, with what was chosen for it. pool: the weeks kept after
function remapWk(d,mp,pool){
  [...d.events,...d.phases].forEach(e=>{if(e.weeks)e.weeks=e.weeks.map(k=>mp[k]).filter(Boolean).sort((a,b)=>a-b);
    e.slots=e.slots.filter(x=>!x.wk||mp[x.wk]);e.slots.forEach(x=>{if(x.wk)x.wk=mp[x.wk]})});
  const a=wiNorm(d.weekInfo,poolOf(d)),b=[...Array(pool)].map(()=>({}));Object.entries(mp).forEach(([k,v])=>{b[v-1]=a[k-1]||{}});
  d.cycle=Math.min(d.cycle||1,pool);d.pool=pool;d.weekInfo=wiNorm(b,pool);normAll(d);
}
// mp: old week -> new week. t: today's week before the change. A week that leaves the cycle leaves today and the shown week at their number (R-CYC-21)
const wkFollow=(mp,t=state.prefs.lvAnchor[state.curId]&&todayWk())=>{const n=cyc(),f=k=>{const x=mp[k];return x&&x<=n?x:Math.min(k,n)};state.curWk=f(state.curWk);if(t)setAnchor(f(t))};
function setCycle(n,extend,wi){   // wi: the weeks' info as edited in the dialog (else resized from the current one)
  const n0=cyc(),p0=kept(),ext=extend&&p0===n0&&n>n0&&n%n0===0;hist();   // in step only when the new weeks are all new: staged weeks come back as they are (R-CYC-21)
  state.S.weekInfo=wi?wiNorm(wi,Math.max(n,p0)):wiResize(state.S.weekInfo,n0,n,ext,p0);if(ext){extendWeeks(state.S.events,n0,n);extendWeeks(state.S.phases,n0,n)}
  state.S.pool=Math.max(n,p0);
  if(n<n0){const mp={};let j=0;for(let k=1;k<=p0;k++)if(k<=n||k>n0)mp[k]=++j;remapWk(state.S,mp,j)}   // weeks that leave the cycle holding nothing are dropped
  state.S.cycle=n;normAll(state.S);render();
  toast(n>1?L('cyDone',{n}):L('cyDone1'));
}
export function openCycle(){
  const body=el('div'),n0=cyc(),p0=kept(),used=state.S.events.some(chosenWk)||state.S.phases.some(chosenWk),cur=wiNorm(state.S.weekInfo,p0);
  // rows: the kept weeks in their order as edited here (o = the week it was, 0 = a staged week added here; w = its name, description and colour,
  // R-CYC-17); more[k]: week k+1 when a longer cycle adds it beyond the rows, which follows the extension rule until edited (touched)
  const rows=[...Array(p0).keys()].map(k=>({o:k+1,w:{...(cur[k]||{})}})),more=[...Array(8)].map(()=>({})),touched=new Set();
  const holds=k=>[state.S.events,state.S.phases].map(a=>a.filter(e=>chosen(e).includes(k)).length);let fromO=0;   // fromO: the week a new staged week starts as a copy of
  el('p','',body).textContent=L('cyBody');
  const row=el('label','cyrow',body);row.append(L('cyLen')+' ');const sel=el('select','',row);fillSel(sel,[1,2,3,4].map(k=>[k,L(k>1?'cyWn':'cyW1',{n:k})]));sel.value=n0;
  const ext=el('label','cyext',body),cb=el('input','',ext);cb.type='checkbox';cb.checked=true;const et=el('span','',ext),note=el('p','note',body),wb=el('div','cywk',body);
  const draw=()=>{wb.innerHTML='';const n=+sel.value,R=rows.length,tot=Math.max(n,R);
    if(tot>1){el('div','cyh',wb).textContent=L('cyWkH');el('p','note',wb).textContent=L('cyWkNote');if(R>1)el('p','note',wb).textContent=L('cyOrdNote')}
    for(let k=0;k<tot&&tot>1;k++){
      if(k===n){el('div','cyh cystg',wb).textContent=L('cyStgH');el('p','note',wb).textContent=L('cyStgNote')}   // the staged weeks, after the cycle (R-CYC-21)
      const old=k<R?rows[k]:null,w=old?old.w:more[k],r=el('div','cywr'+(k>=n?' stg':''),wb),edit=()=>{if(!old)touched.add(k)};
      if(old&&R>1)gripRow(r,k);else el('span','',r);   // the kept weeks can be reordered, and swapped in and out of the cycle (R-CYC-20/21)
      const nm=el('span','cywn',r);nm.textContent=L('wkName',{n:k+1})+(old&&old.o!==k+1?' '+(old.o?L('cyWas',{n:old.o}):old.from?L('cyCopyOf',{n:old.from}):L('cyNew')):'');
      const sw=el('button','swatch cysw',r),cl=el('button','cyclr',r);sw.type=cl.type='button';cl.textContent='✕';
      const setSw=()=>{sw.style.background=w.color||'';sw.classList.toggle('none',!w.color);cl.disabled=!w.color;
        const t=L('cyWkCol',{n:k+1,c:w.color||L('cyNoCol')});sw.title=sw.__t=t;sw.setAttribute('aria-label',t);const u=L('cyWkClr',{n:k+1});cl.title=cl.__t=u;cl.setAttribute('aria-label',u)};
      sw.onclick=()=>pickColor(sw,w.color||PAL[k%PAL.length],c=>{w.color=c;edit();setSw()});cl.onclick=()=>{delete w.color;edit();setSw()};setSw();
      const tx=(key,max,ph,lab)=>{const i=el('input','cy'+key,r);i.type='text';i.maxLength=max;i.value=w[key]||'';i.placeholder=L(ph);i.setAttribute('aria-label',L(lab,{n:k+1}));i.oninput=()=>{w[key]=i.value;edit()}};
      tx('name',40,'cyNamePh','cyWkName');tx('desc',300,'cyDescPh','cyWkDesc');
      if(old&&old.o&&k>=n){const [e,p]=holds(old.o);if(e||p)el('small','cyholds',r).textContent=L('cyHolds',{e,p})}   // on a line of its own, under the fields
      if(old&&k>=n){const dl=el('button','cydel',r);dl.type='button';dl.textContent='✕';const t=L('cyStgDel',{n:k+1});dl.title=dl.__t=t;dl.setAttribute('aria-label',t);dl.onclick=()=>{rows.splice(k,1);upd()}}
      else el('span','',r);
    }
    if(n<=R&&R<8){const ar=el('div','cyaddr',wb),ad=el('button','cyadd',ar),fs=el('select','cyfrom',ar);ad.type='button';ad.textContent=L('cyStgAdd');ad.title=ad.__t=L('cyStgAddTip');
      // a new staged week starts empty or as a copy of a kept week: its name, description and colour, and what was chosen for it
      fs.setAttribute('aria-label',L('cyFromLbl'));fs.title=fs.__t=L('cyFromLbl');fillSel(fs,[['',L('cyFrom0')],...rows.flatMap((x,k)=>x.o?[[String(x.o),L('cyFromK',{w:L('wkName',{n:k+1})+(x.w.name?' · '+x.w.name:'')})]]:[])]);
      fs.value=rows.some(x=>x.o===fromO)?String(fromO):'';fs.onchange=()=>{fromO=+fs.value||0};   // the choice is the week itself, so it survives a redraw
      ad.onclick=()=>{const src=rows.find(x=>x.o&&x.o===+fs.value);rows.push(src?{o:0,w:{...src.w},from:src.o}:{o:0,w:{}});upd()}}
  };
  // a week's grip: drag it, or focus it and use the arrow keys; the row's name, colour and description go with it
  const mvRow=(i,j)=>{if(i===j||j<0||j>=rows.length)return;const [x]=rows.splice(i,1);rows.splice(j,0,x);upd();const g=wb.querySelectorAll('.cywr .grip')[j];if(g)g.focus()};
  const gripRow=(r,k)=>rowGrip(r,k,()=>[...wb.querySelectorAll('.cywr')].slice(0,rows.length),mvRow,L('cyGripTip'),L('cyGripLbl',{n:k+1}));
  const upd=()=>{const n=+sel.value,R=rows.length,mul=n0>1&&n>n0&&n%n0===0&&p0===n0&&R===n0;   // in step: only when the new weeks are all new (R-CYC-21)
    ext.style.display=(used||cur.length)&&mul?'':'none';et.textContent=' '+L('cyExtend',{a:1+n0});
    note.textContent=used&&n0>1&&n>n0&&p0===n0&&!mul?L('cyOdd',{n}):'';
    for(let k=R;k<8;k++)if(!touched.has(k))more[k]=mul&&cb.checked?{...rows[k%n0].w}:{};   // the new weeks repeat the old ones when kept in step
    draw()};
  sel.onchange=upd;cb.onchange=upd;upd();
  xdlg({title:L('cyTitle'),full:true,body,buttons:[{label:L('cyApply'),cls:'p',fn:()=>{const n=+sel.value,R=rows.length;
    applyWeeks(rows.map(r=>r.o),n,[...rows.map(r=>r.w),...more.slice(R,Math.max(R,n))],cb.checked,cur,rows.map(r=>r.from||0))}},{label:L('cancel'),dismiss:true}]});
}
// the cycle dialog's Apply: a new order of the kept weeks first, as its own undo step (R-CYC-20/21), then the length (R-CYC-10). Questions open
// once the dialog has closed: deleting staged weeks that hold something (askGone), and shrinking (weeks that leave the cycle holding something)
function applyWeeks(ord,n,wi,extend,cur,cp){
  const p0=kept(),moved=ord.length!==p0||ord.some((o,i)=>o!==i+1),gone=[...Array(p0).keys()].map(k=>k+1).filter(k=>!ord.includes(k)),lost=lostIn(state.S,gone);
  const len=()=>{const c=cyc(),ks=[...Array(Math.max(0,c-n)).keys()].map(k=>k+n+1),w=wiNorm(wi,kept());
    if(n===c){if(!moved&&JSON.stringify(w)!==JSON.stringify(cur)){hist();state.S.weekInfo=w;render()}return}
    if(ks.length&&(lostIn(state.S,ks).length||ks.some(k=>Object.keys(w[k-1]||{}).length))){setTimeout(()=>shrinkCycle(n,wi),0);return}
    setCycle(n,extend,wi)};
  if(!moved){len();return}
  const go=ch=>{reorderWeeks(ord,wi.slice(0,ord.length),ch,cp);len()};
  if(lost.length)setTimeout(()=>askGone(gone,lost,go),0);else go('rm');
}
// deleting staged weeks that hold events or phases (R-CYC-21): remove what was chosen for them, or keep it in a schedule or rhythm per week
function askGone(ks,lost,cb){
  const body=el('div');el('p','',body).textContent=L('cyDelBody',{w:wksText(ks)});
  const ul=el('ul','cyl',body);lost.forEach(e=>{el('li','',ul).textContent=e.title+' · '+wksText(evWks(e))});
  const rd=el('div','radios',body),opt=(v,t)=>{const l=el('label','',rd),i=el('input','',l);i.type='radio';i.name='cyg';i.value=v;l.append(' '+t);return i};
  const rm=opt('rm',L('cyRm'));opt('mv',L('cyMv'));rm.checked=true;
  xdlg({title:L('cyTitle'),body,buttons:[{label:L('cyApply'),cls:'p',fn:()=>cb(rm.checked?'rm':'mv')},{label:L('cancel'),dismiss:true}]});
}
// "Weeks 1 and 3" (R-CYC-02); ws = sorted week numbers
// R-CYC-17: a week's name, description and colour (only while the cycle is longer than one week); wkLabel = "Week 2 · At Dad's",
// wkShortL = "W2 At Dad's" (table headers), wkChip = a small swatch of its colour (HTML), wkTip = label and description
export const wkI=w=>(cyc()>1||w>cyc())&&(state.S.weekInfo||[])[w-1]||{};   // a staged week keeps its name also beside a cycle of one week (R-CYC-21)
export const wkCol=w=>wkI(w).color||null,wkDesc=w=>wkI(w).desc||'';
export const wkLabel=w=>L('wkName',{n:w})+(wkI(w).name?' · '+wkI(w).name:''),wkShortL=w=>L('wkShort',{n:w})+(wkI(w).name?' '+wkI(w).name:'');
export const wkTip=w=>wkLabel(w)+(wkDesc(w)?': '+wkDesc(w):'');
export const wkChip=w=>wkCol(w)?`<i class="wkchip" style="background:${esc(wkCol(w))}"></i>`:'';
export const wksText=ws=>ws.some(w=>wkI(w).name)?ws.map(wkLabel).join(', '):ws.length===1?L('wkName',{n:ws[0]}):L('wksName',{l:ws.slice(0,-1).join(', '),z:ws.at(-1)});
export const wksHTML=ws=>ws.map(wkChip).join('')+esc(wksText(ws));   // the peek card and agenda: chips before the weeks
export const wkNote=(e,s)=>{const ws=cyc()>1&&wksOf(e,s);return ws&&ws.length<cyc()?wksText(ws):''};
export const wkNoteH=(e,s)=>{const ws=cyc()>1&&wksOf(e,s);return ws&&ws.length<cyc()?wksHTML(ws):''};   // with the weeks' colour chips (R-CYC-17)   // the weeks of an occurrence that is not every week (R-CYC-02/03)
const evWks=e=>e.weeks||[...new Set(e.slots.map(s=>s.wk).filter(Boolean))].sort((a,b)=>a-b);
function moveWeeks(d,lost,ks){   // a copy per week of ks, in a schedule (events) or a rhythm (phases, R-CYC-16) of its own, holding that week's occurrences as week 1 (R-CYC-10/13/21)
  ks.forEach(k=>{
    const cps=lost.flatMap(e=>{const c=JSON.parse(JSON.stringify(e));c.id=uid();
      if(e.weeks){if(!e.weeks.includes(k))return[];c.weeks=[1]}else{c.slots=c.slots.filter(s=>s.wk===k).map(s=>({...s,wk:1}));if(!c.slots.length)return[]}
      return [c]});
    const ev=cps.filter(c=>!c.rhythms),ph=cps.filter(c=>c.rhythms);
    if(ev.length){const sc={id:uid(),name:uniqueName(L('wkName',{n:k}),d.schedules.map(x=>x.name)),color:PAL[(d.schedules.length+k)%PAL.length],opacity:1,locked:false,visible:true};
      d.schedules.push(sc);ev.forEach(c=>{c.schedules=[sc.id];d.events.push(c)})}
    if(ph.length){const rh={id:uid(),name:uniqueName(L('wkName',{n:k}),d.rhythms.map(x=>x.name)),visible:false};   // shown only by choice: one rhythm at a time (R-PHS-02)
      d.rhythms.push(rh);ph.forEach(c=>{c.rhythms=[rh.id];d.phases.push(c)})}
  });
}
/* events arriving in workspace d from a cycle of srcN weeks keeping srcP (insert, schedule transfer; R-CYC-13): when some use weeks beyond d's
   cycle, ask whether to lengthen d's cycle, keep them as staged weeks (R-CYC-21), remove those occurrences or keep them in a schedule per week;
   cb gets 'len' / 'st' / 'rm' / 'mv' (or '' if nothing to ask) */
function askCycle(d,evs,srcN,cb,srcP=srcN){
  const tn=d.cycle||1,over=evs.filter(e=>chosen(e).some(k=>k>tn));
  if(!over.length){cb('');return}
  setTimeout(()=>{const body=el('div');el('p','',body).textContent=L('icBody',{n:over.length,c:L(tn>1?'cyWn':'cyW1',{n:tn})});
    const rd=el('div','radios',body),opt=(v,t)=>{const l=el('label','',rd),i=el('input','',l);i.type='radio';i.name='icm';i.value=v;l.append(' '+t);return i};
    const r=[...(srcN>tn?[opt('len',L('icLen',{m:srcN}))]:[]),opt('st',L('icSt')),opt('rm',L('cyRm')),opt('mv',L('cyMv'))];r[0].checked=true;
    xdlg({title:L('cyTitle'),body,buttons:[{label:L('cyApply'),cls:'p',fn:()=>{const v=r.find(x=>x.checked).value;setTimeout(()=>cb(v),0)}},{label:L('cancel'),dismiss:true}]})},0);
}
function placeWeeks(d,inc,srcN,ch,srcP=srcN){   // add the incoming events and phases to d as the choice of askCycle says
  const tn=d.cycle||1,tp=poolOf(d);
  if(ch==='len'&&srcN>tn){const ext=tn>1&&srcN%tn===0&&tp===tn;d.weekInfo=wiResize(d.weekInfo,tn,srcN,ext,tp);if(ext){extendWeeks(d.events,tn,srcN);extendWeeks(d.phases||[],tn,srcN)}d.cycle=srcN}   // the target keeps its own week names (R-CYC-17)   // a multiple keeps d's own rhythm (R-CYC-10)
  if(ch==='len'||ch==='st')d.pool=Math.max(poolOf(d),srcP);   // weeks beyond the cycle arrive as staged weeks (R-CYC-21)
  const n=d.cycle||1,cut=e=>{if(e.weeks)e.weeks=e.weeks.filter(k=>k<=n);e.slots=e.slots.filter(s=>!s.wk||s.wk<=n);return e};
  const lost=ch==='mv'?inc.filter(e=>chosen(e).some(k=>k>n)).map(e=>JSON.parse(JSON.stringify(e))):[];   // before those weeks are cut
  inc.forEach(c=>{const x=normWk(ch==='rm'||ch==='mv'?cut(c):c,poolOf(d));if(x)(x.rhythms?d.phases:d.events).push(x)});
  if(lost.length)moveWeeks(d,lost,[...Array(Math.max(0,srcP-n)).keys()].map(k=>k+n+1));
}
function shrinkCycle(n,wi){   // wi: the weeks' info as edited in the cycle dialog   // R-CYC-10/21: the weeks that leave the cycle become staged (the default), or go with what was chosen for them: removed, or moved to a schedule per week
  const n0=cyc(),ks=[...Array(n0-n).keys()].map(k=>k+n+1),lost=lostIn(state.S,ks),body=el('div');
  el('p','',body).textContent=L('cyShrinkBody',{w:wksText(ks)});
  const ul=el('ul','cyl',body);lost.forEach(e=>{el('li','',ul).textContent=e.title+' · '+wksText(evWks(e))+(chosen(e).every(k=>ks.includes(k))?' · '+L('cyAllGone'):'')});
  const rd=el('div','radios',body),opt=(v,t)=>{const l=el('label','',rd),i=el('input','',l);i.type='radio';i.name='cym';i.value=v;l.append(' '+t);return i};
  const st=opt('st',L('cySt')),rm=opt('rm',L('cyRm'));opt('mv',L('cyMv'));st.checked=true;
  xdlg({title:L('cyTitle'),body,buttons:[{label:L('cyApply'),cls:'p',fn:()=>{
    hist();const p0=kept();state.S.weekInfo=wiNorm(wi||state.S.weekInfo,p0);state.S.pool=p0;   // the weeks that leave stay kept, as staged weeks
    if(!st.checked){if(!rm.checked)moveWeeks(state.S,lost,ks);const mp={};let j=0;for(let k=1;k<=p0;k++)if(!ks.includes(k))mp[k]=++j;remapWk(state.S,mp,j)}
    state.S.cycle=n;normAll(state.S);render();toast(n>1?L('cyDone',{n}):L('cyDone1'));
  }},{label:L('cancel'),dismiss:true}]});
}
// the week switcher (R-CYC-04) in the grid's corner cell: which week of the cycle the grid shows
export function setWeek(w){
  if(state.live){setAnchor(w);clearTimeout(lvRet);lvCloseAll(true);state.livePaused=false;state.focusD=today()}   // correcting Live View's week: today's day and now point in that week
  state.curWk=w;state.allWk=false;render();updLive()}
export function setAllWk(on){state.allWk=on&&cyc()>1&&!state.live;render()}   // every week of the cycle side by side (R-CYC-19)
export function wkMenu(anchor){rowMenu(anchor,(m,mi)=>{
  for(let w=1;w<=cyc();w++){mi((w===state.curWk?ICON_CHECK:'<span class="ic" style="margin:0"></span>')+wkChip(w),wkLabel(w)+(w===todayWk()?' · '+L('wkLiveMark'):''),()=>setWeek(w));
    if(wkDesc(w)){const b=m.lastElementChild;b.title=wkDesc(w);el('small','wkd',b).textContent=wkDesc(w)}}   // the description under its name (R-CYC-17)
  if(!state.live){mi((state.allWk?ICON_CHECK:'<span class="ic" style="margin:0"></span>'),L('wkAllM'),()=>setAllWk(true));m.lastElementChild.title=L('wkAllMTip');   // R-CYC-19
    el('hr','',m);mi(ICON_WEEK,L('cyMenu'),openCycle)}
})}
// R-DATA-10: the order of the workspaces is this browser's (prefs.wsOrder: ids); unknown ones keep their place after the known ones
function orderWs(){const o=state.prefs.wsOrder||[],at=w=>{const i=o.indexOf(w.id);return i<0?1e9:i};state.WS=state.WS.map((w,i)=>[w,i]).sort((a,b)=>at(a[0])-at(b[0])||a[1]-b[1]).map(x=>x[0])}
export function wsMenu(anchor){rowMenu(anchor,(m,mi)=>{
  state.WS.forEach(w=>{const d=wsData(w);mi((w.id===state.curId?ICON_CHECK:'<span class="ic" style="margin:0"></span>')+(d.color?`<i class="wkchip" style="background:${esc(d.color)}"></i>`:''),w.name+(wsDirty(w)?' •':''),()=>switchWs(w.id));
    if(d.desc){const b=m.lastElementChild;b.title=d.desc;el('small','wkd',b).textContent=d.desc}});   // its colour and description (R-DATA-10)
  el('hr','',m);mi(ICON_WS,L('wsMg'),()=>setTimeout(openWorkspaces,0));
  mi(ICON_PLUS,L('wsNew'),addWorkspace);mi(ICON_WS,L('wsRename'),renameWorkspace);mi(ICON_WS,L('wsDup'),duplicateWorkspace);mi(ICON_WEEK,L('cyMenu'),openCycle);mi(ICON_WS,L('wsDel'),deleteWorkspace,'d');
})}
/* import: files and links share one dialog (new workspace / insert / replace matching); nothing is ever merged */
const matchesOf=w=>{const out=[],byId=w.id&&state.WS.find(x=>x.id===w.id);if(byId)out.push(byId);state.WS.forEach(x=>{if(x.name.toLowerCase()===w.name.toLowerCase()&&!out.includes(x))out.push(x)});return out};
const flagLbl=(w,t)=>{const f=[];if(t.id===state.curId)f.push(L('flagActive'));if(w.id&&t.id===w.id)f.push(L('flagId'));if(t.name.toLowerCase()===w.name.toLowerCase())f.push(L('flagName'));return t.name+(f.length?'  ('+f.join(', ')+')':'')};
export function adoptWs(w,source){   // first-time visitor with an untouched default workspace: the imported workspace takes its place
  const r=newWs(w.name,w.data,source==='file');if(w.id)r.id=w.id;state.WS=[r];state.curId=r.id;state.S=r.data;state.undoSt=r.undo;state.redoSt=r.redo;state.selK=null;render();
}
function applyImport(w,target,source){   // target = existing workspace to replace, or null = import as a new workspace
  syncWs();let rec;
  if(target){pushUndoWs(target);if(target.id===state.curId)state.S=w.data;else target.data=w.data;if(source==='file')target.lf=keyOf(w.data);rec=target;toast(L('impReplaced',{n:target.name}))}
  else{rec=newWs(uniqueName(w.name,state.WS.map(x=>x.name)),w.data,source==='file');if(w.id&&!state.WS.some(x=>x.id===w.id))rec.id=w.id;state.WS.push(rec);toast(L('impDone'))}
  if(rec.id!==state.curId)switchWs(rec.id);else render();
}
function mapTypes(src,td){   // activity types travel by name (case-insensitive): an existing type of that name is used, otherwise it is created
  const m={};src.forEach(t=>{const same=td.types.find(x=>x.name.toLowerCase()===t.name.toLowerCase());if(same)m[t.id]=same.id;else{const n={...t,id:uid(),visible:true};td.types.push(n);m[t.id]=n.id}});return m;
}
function retype(c,tm){if(c.type&&tm[c.type])c.type=tm[c.type];else delete c.type}
function insertInto(src,ch){
  hist();const d=state.S,mp={s:{},p:{},r:{}},inc=[];
  const tm=mapTypes(src.types,d);
  src.people.forEach(q=>{const id=uid();mp.p[q.id]=id;d.people.push({...q,id,name:uniqueName(q.name,d.people.map(x=>x.name))})});
  src.schedules.forEach(s=>{const id=uid();mp.s[s.id]=id;d.schedules.push({...s,id,name:uniqueName(s.name,d.schedules.map(x=>x.name)),visible:true})});
  src.events.forEach(e=>{const c=JSON.parse(JSON.stringify(e));c.id=uid();c.schedules=c.schedules.map(i=>mp.s[i]).filter(Boolean);c.involved=c.involved.map(i=>mp.p[i]).filter(Boolean);if(c.owner)c.owner=mp.p[c.owner];if(!c.owner)delete c.owner;c.slots.forEach(sl=>{sl.person=mp.p[sl.person]||'';if(sl.inv)sl.inv=sl.inv.map(i=>mp.p[i]).filter(Boolean)});retype(c,tm);if(c.schedules.length)inc.push(c)});
  const had=d.rhythms.some(r=>r.visible);
  src.rhythms.forEach((r,i)=>{const id=uid();mp.r[r.id]=id;d.rhythms.push({...r,id,name:uniqueName(r.name,d.rhythms.map(x=>x.name)),visible:!had&&i===0})});
  src.phases.forEach(p=>{const c=JSON.parse(JSON.stringify(p));c.id=uid();c.rhythms=c.rhythms.map(i=>mp.r[i]).filter(Boolean);if(c.rhythms.length)inc.push(c)});
  placeWeeks(d,inc,src.cycle||1,ch,poolOf(src));   // weeks beyond the current cycle, events and phases (R-CYC-13, R-CYC-16)
}
function pickReplace(w,source){   // choose which workspace to replace (flags: active / same id / same name), then confirm
  const m=matchesOf(w),cands=[...m,...state.WS.filter(x=>!m.includes(x)).sort((a,b)=>(b.id===state.curId)-(a.id===state.curId))];
  const body=el('div');el('p','',body).textContent=L('impPickBody',{s:w.name});
  const rd=el('div','radios',body),radios=cands.map(t=>{const l=el('label','',rd),i=el('input','',l);i.type='radio';i.name='tgt';i.value=t.id;l.append(' '+flagLbl(w,t));return i});
  radios[0].checked=true;
  xdlg({title:L('impPickTitle'),body,buttons:[{label:L('mapCont'),cls:'p',fn:()=>{const tg=state.WS.find(x=>x.id===radios.find(r=>r.checked).value);setTimeout(()=>confirmReplace(w,tg,source),0)}},{label:L('cancel'),dismiss:true}]});
}
function confirmReplace(w,tg,source){
  const body=el('div');el('p','',body).textContent=L('impConf1',{t:tg.name,s:w.name});el('p','note',body).textContent=L('impConfUndo');
  xdlg({title:L('impConfTitle'),body,buttons:[{label:L('impReplace'),cls:'p',fn:()=>applyImport(w,tg,source)},{label:L('cancel'),dismiss:true}]});
}
export function openImport(w,source){   // files and links hold one workspace: import as new, insert into the current one, or replace an existing one
  const body=el('div'),d=w.data;
  el('p','',body).textContent=L('impBodyOne',{n:w.name,c:L('impCounts',{s:d.schedules.length,e:d.events.length,p:d.people.length,r:d.rhythms.length,h:d.phases.length})});
  const rd=el('div','radios',body);
  const opt=(v,label)=>{const l=el('label','',rd),i=el('input','',l);i.type='radio';i.name='impm';i.value=v;l.append(' '+label);return i};
  const rNew=opt('new',L('impNew')),rIns=opt('insert',L('impInsert')),rRep=opt('replace',L('impOverPick'));rNew.checked=true;
  xdlg({title:L('impTitle'),body,buttons:[{label:L('impDo'),cls:'p',fn:()=>{
    const mode=[rNew,rIns,rRep].find(r=>r.checked).value;
    if(mode==='insert')askCycle(state.S,[...d.events,...d.phases],d.cycle||1,ch=>{insertInto(d,ch);render();toast(L('impInserted'))},poolOf(d));
    else if(mode==='new')applyImport(w,null,source);
    else setTimeout(()=>pickReplace(w,source),0)}},{label:L('cancel'),dismiss:true}]});
}
/* copy / move schedules (with their events) and rhythms (with their phases) to another workspace */
function removeSchedule(d,s){d.schedules=d.schedules.filter(x=>x!==s);d.events.forEach(e=>e.schedules=e.schedules.filter(i=>i!==s.id));d.events=d.events.filter(e=>e.schedules.length)}
function removeRhythm(d,r){d.rhythms=d.rhythms.filter(x=>x!==r);d.phases.forEach(p=>p.rhythms=p.rhythms.filter(i=>i!==r.id));d.phases=d.phases.filter(p=>p.rhythms.length)}
export function openTransfer(kind,obj){
  const others=state.WS.filter(w=>w.id!==state.curId);
  if(!others.length){toast(L('trNeed'));return}
  const body=el('div');el('label','',body).textContent=L('trTarget');
  const sel=el('select','',body);fillSel(sel,others.map(w=>[w.id,w.name]));
  const rd=el('div','radios',body);
  const mk=(v,k,c)=>{const l=el('label','',rd),i=el('input','',l);i.type='radio';i.name='trop';i.value=v;i.checked=c;l.append(' '+L(k));return i};
  mk('copy','trCopy',true);const rm=mk('move','trMove',false);
  xdlg({title:L('trTitle')+': '+(obj.name||obj.title),full:true,body,buttons:[{label:L('trGo'),cls:'p',fn:()=>{const tw=state.WS.find(w=>w.id===sel.value),mv=rm.checked;setTimeout(()=>doTransfer(kind,obj,tw,mv),0)}},{label:L('cancel'),dismiss:true}]});
}
// R-DATA-04: people copied to another workspace (name, colour, external mark); a name the target already has is shown and skipped. Copy only.
export function openPeopleCopy(q){
  const others=state.WS.filter(w=>w.id!==state.curId);if(!others.length){toast(L('trNeed'));return}
  const body=el('div');el('label','',body).textContent=L('trTarget');const sel=el('select','',body);fillSel(sel,others.map(w=>[w.id,w.name]));sel.setAttribute('aria-label',L('trTarget'));
  el('div','partgh',body).textContent=L('pcWho');const list=el('div','partg pcl',body),pick=new Set([q.id]);
  const tw=()=>state.WS.find(w=>w.id===sel.value),there=p=>tw().data.people.some(x=>x.name.toLowerCase()===p.name.toLowerCase());
  const draw=()=>{list.innerHTML='';state.S.people.forEach(p=>{const l=el('label','',list),i=el('input','',l),t=there(p);i.type='checkbox';i.checked=pick.has(p.id)&&!t;i.disabled=t;
    l.append(' '+p.name+(p.external?' ('+L('extSuf')+')':'')+(t?' · '+L('pcThere'):''));i.onchange=()=>{i.checked?pick.add(p.id):pick.delete(p.id)}})};
  sel.onchange=draw;draw();
  xdlg({title:L('pcTitle'),full:true,body,buttons:[{label:L('cpDo'),cls:'p',fn:()=>{const t=tw(),ps=state.S.people.filter(p=>pick.has(p.id)&&!there(p));if(!ps.length){toast(L('pcNone'));return}
    pushUndoWs(t);ps.forEach(p=>t.data.people.push({id:uid(),name:p.name,color:p.color,visible:true,...(p.external?{external:true}:{})}));render();toast(L('pcDone',{n:ps.length,w:t.name}))}},{label:L('cancel'),dismiss:true}]});
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
export function carryEvents(evs,tw,place,done){
  syncWs();const src=state.S,td=tw.data,ids=new Set();
  evs.forEach(e=>{e.involved.forEach(i=>ids.add(i));if(e.owner)ids.add(e.owner);e.slots.forEach(s=>{if(s.person)ids.add(s.person);(s.inv||[]).forEach(i=>ids.add(i))})});
  const pids=[...ids].filter(i=>src.people.some(q=>q.id===i));
  const run=(map,ch)=>{
    pushUndoWs(tw);const pm={},inc=[];
    Object.entries(map).forEach(([pid,v])=>{if(v==='__new__'){const q=src.people.find(x=>x.id===pid),nq={id:uid(),name:q.name,color:q.color,visible:true,...(q.external?{external:true}:{})};td.people.push(nq);pm[pid]=nq.id}else pm[pid]=v});
    const sid=place(td),tm=mapTypes(src.types.filter(t=>evs.some(e=>e.type===t.id)),td);
    evs.forEach(e=>{const c=JSON.parse(JSON.stringify(e));c.id=uid();c.schedules=[sid];c.involved=c.involved.map(i=>pm[i]).filter(Boolean);if(c.owner)c.owner=pm[c.owner];if(!c.owner)delete c.owner;c.slots.forEach(sl=>{sl.person=sl.fo?c.owner||'':sl.person?(pm[sl.person]||''):'';if(sl.inv)sl.inv=sl.inv.map(i=>pm[i]).filter(Boolean)});retype(c,tm);inc.push(c)});
    placeWeeks(td,inc,src.cycle||1,ch,poolOf(src));   // weeks beyond the target's cycle (R-CYC-13)
    done();
  };
  askCycle(td,evs,src.cycle||1,ch=>{if(!pids.length)run({},ch);else askPeople(src,tw,pids,m=>run(m,ch))},poolOf(src));
}
function doTransfer(kind,obj,tw,move){
  syncWs();const src=state.S,td=tw.data;
  if(kind==='schedule'){
    carryEvents(src.events.filter(e=>e.schedules.includes(obj.id)),tw,td=>{const ns={...obj,id:uid(),name:uniqueName(obj.name,td.schedules.map(x=>x.name)),visible:true};td.schedules.push(ns);return ns.id},
      ()=>{if(move){pushUndoWs(cw());removeSchedule(state.S,obj)}render();toast(L(move?'trMoved':'trDone',{n:tw.name}))});
  }else{
    const phs=src.phases.filter(p=>p.rhythms.includes(obj.id));
    askCycle(td,phs,src.cycle||1,ch=>{   // weeks beyond the target's cycle (R-CYC-13, R-CYC-16, R-CYC-21)
      pushUndoWs(tw);const had=td.rhythms.some(r=>r.visible);
      const nr={id:uid(),name:uniqueName(obj.name,td.rhythms.map(x=>x.name)),visible:!had};td.rhythms.push(nr);
      placeWeeks(td,phs.map(p=>{const c=JSON.parse(JSON.stringify(p));c.id=uid();c.rhythms=[nr.id];return c}),src.cycle||1,ch,poolOf(src));
      if(move){pushUndoWs(cw());removeRhythm(state.S,obj)}
      render();toast(L(move?'trMoved':'trDone',{n:tw.name}));
    },poolOf(src));
  }
}
