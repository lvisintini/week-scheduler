// Model and view helpers: per-browser prefs, time and pieces, weeks, flexible time, lanes, nesting, Live View, the generic dialog. Classic script: shares the global scope with the other files in js/, loaded in the order of index.html (docs/architecture.md).
let prefs={w:290,collapsed:false,showEarly:false,clock12:false,hideWeekend:false,theme:'auto',rowH:48,colW:110,fitW:true,fitH:true,rowHP:100,fitHP:false,colWP:110,fitWP:true,txt:100,hlNoType:false,colBy:'',lanesFix:false};
try{Object.assign(prefs,JSON.parse(localStorage.getItem(PKEY)||'{}'))}catch(e){}
prefs.rowH=Math.min(120,Math.max(24,+prefs.rowH||48));prefs.colW=Math.min(1000,Math.max(70,+prefs.colW||110));prefs.fitW=prefs.fitW!==false;prefs.fitH=prefs.fitH!==false;prefs.colWP=Math.min(1000,Math.max(70,+prefs.colWP||110));prefs.fitWP=prefs.fitWP!==false;prefs.rowHP=Math.min(120,Math.max(24,+prefs.rowHP||100));prefs.fitHP=prefs.fitHP===true;prefs.txt=Math.min(160,Math.max(80,Math.round((+prefs.txt||100)/10)*10));   // fillW and fit are retired keys: no longer read (R-GRID-07)
// a phone-sized window has its own row height (R-GRID-07): 100 px per hour and Fit height off by default, about 7 hours on the screen
const RH=()=>phone()?'rowHP':'rowH',FH=()=>phone()?'fitHP':'fitH';
// and its own width (R-GRID-07): Fit width follows the view there, on in the day view and off in the week view (the column width kept)
const WK=()=>phone()?'colWP':'colW',FWK=()=>phone()?'fitWP':'fitW';
const phoneFit=()=>{if(phone()&&prefs.fitWP!==(focusD!=null)){prefs.fitWP=focusD!=null;savePrefs()}};
{const o=prefs.lvAnchor,m=Object.create(null);if(o&&typeof o==='object')Object.keys(o).slice(0,200).forEach(k=>{if(k.length<=64&&/^\d{4}-\d{2}-\d{2}$/.test(o[k]))m[k]=o[k]});prefs.lvAnchor=m}   // Live View's week per workspace (R-CYC-05); no prototype, so any workspace id is a plain key
{const o=prefs.icsLast,m=Object.create(null),ok=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);if(o&&typeof o==='object')Object.keys(o).slice(0,200).forEach(k=>{const v=o[k];if(k.length<=64&&v&&ok(v.from)&&(v.until==null||ok(v.until)))m[k]=v.until?{from:v.from,until:v.until}:{from:v.from}});prefs.icsLast=m}   // the last calendar export per workspace (R-SHARE-09), like lvAnchor
prefs.wsOrder=Array.isArray(prefs.wsOrder)?prefs.wsOrder.filter(x=>typeof x==='string'&&x.length<=64).slice(0,200):[];   // the order of the workspace menu (R-DATA-10)
prefs.hlNoType=prefs.hlNoType===true;prefs.lanesFix=prefs.lanesFix===true;if(prefs.colBy!=='t'&&prefs.colBy!=='p')prefs.colBy='';   // Tools (R-UI-11)
const savePrefs=()=>{try{localStorage.setItem(PKEY,JSON.stringify(prefs))}catch(e){}};
function applyTheme(){const h=document.documentElement;if(prefs.theme==='light'||prefs.theme==='dark')h.dataset.theme=prefs.theme;else delete h.dataset.theme}
const phone=()=>!!(window.matchMedia&&matchMedia('(max-width:600px)').matches);   // a phone-sized window (R-UI-13)
function applyPrefs(){$('sb').style.setProperty('--sbw',prefs.w+'px');$('sb').classList.toggle('collapsed',!!prefs.collapsed)}
function toast(m,acts){const t=$('toast');t.textContent=m;t.classList.toggle('act',!!acts);
  (acts||[]).forEach(x=>{const b=el('button','',t);b.textContent=x.label;b.onclick=()=>{t.classList.remove('on');x.fn()}});
  t.classList.add('on');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),acts?7000:2200)}
/* ---------- helpers ---------- */
const qa=s=>[...document.querySelectorAll(s)];
const pad=n=>String(n).padStart(2,'0');
const fileDay=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};   // today's local date, in the names of downloaded files
const fmt=m=>{m=((Math.round(m)%1440)+1440)%1440;if(!prefs.clock12)return pad(Math.floor(m/60))+':'+pad(m%60);const h=Math.floor(m/60);return (h%12||12)+':'+pad(m%60)+' '+(h<12?'AM':'PM')};
const fmtEnd=m=>fmt(m)+(m>1440?' '+L('nextDay'):'');
const endLabel=m=>fmtEnd(m);   // the End list says what boxes, agendas and tooltips say: midnight closes its day, later ends carry (Next day) (R-REP-04)
const hourLabel=h=>prefs.clock12?(h%12||12)+' '+(h<12?'AM':'PM'):fmt(h*60);
const vs=()=>prefs.showEarly?0:5;
const pvis=id=>{const p=S.people.find(x=>x.id===id);return !!p&&p.visible};
const pname=id=>(S.people.find(p=>p.id===id)||{}).name||'';
// no responsible person -> always shown; otherwise shown if the responsible person or any involved person is visible
// the grid's filters: the activity type's eye (R-TYP-04; untyped events always pass) and the people filter (R-PPL-01); statistics use neither
const tvis=e=>{const t=tyOf(e);return !t||t.visible!==false};
const slotVisible=(e,s)=>tvis(e)&&(!s.person||pvis(s.person)||invOf(e,s).some(pvis));
const vrhythm=()=>S.rhythms.find(s=>s.visible);
const phVis=p=>{const v=vrhythm();return !!v&&p.rhythms.includes(v.id)};
const eVis=e=>e.rhythms?phVis(e):visible(e);
const eLock=e=>e.rhythms?false:isLocked(e);
const sVis=(e,s)=>e.rhythms?true:slotVisible(e,s);
const act=()=>editMode==='phases'?S.phases:S.events;
const lum=c=>{const v=[1,3,5].map(i=>{const x=parseInt(c.slice(i,i+2),16)/255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)});return .2126*v[0]+.7152*v[1]+.0722*v[2]};
const ink=c=>{const n=normHex(c)||'#000000',L=lum(n);return (L+.05)/.05>1.05/(L+.05)?'#000':'#fff'};   // black or white, whichever contrasts more: always at least 4.58:1 (WCAG contrast (relative luminance)
const visible=e=>e.schedules.some(id=>{const s=S.schedules.find(x=>x.id===id);return s&&s.visible});
const isLocked=e=>e.schedules.length>0&&e.schedules.every(id=>{const s=S.schedules.find(x=>x.id===id);return s&&s.locked});
const evOp=e=>Math.max(...e.schedules.map(id=>S.schedules.find(x=>x.id===id)).filter(s=>s&&s.visible).map(s=>s.opacity??1),0.1);
const W=10080;
const piecesOf=s=>{const p=[{p:0,day:s.day,a:s.start,b:Math.min(s.end,1440)}];if(s.end>1440)p.push({p:1,day:(s.day+1)%7,a:0,b:s.end-1440});return p};
/* a cycle of several weeks (R-CYC): the grid shows week curWk (view state, never stored, R-CYC-04). An event happens in the weeks of its
   pattern (event.weeks, absent = every week) or each repetition in its own week (slot.wk); phases are weekly (R-CYC-16). */
let curWk=1,allWk=false;   // allWk: every week of the cycle side by side (R-CYC-19), view state like curWk
const cyc=()=>S.cycle||1;
const wksOf=(e,s)=>s&&s.wk?[s.wk]:e.weeks||null;   // null = every week (events and phases alike, R-CYC-16)
const prevWk=w=>(w+cyc()-2)%cyc()+1;
// does piece q of repetition s appear in week w? The part after midnight of a Sunday lies in the next week (R-CYC-06)
const inWk=(e,s,q,w=curWk)=>{const ws=wksOf(e,s);return !ws||ws.includes(q.p&&s.day===6?prevWk(w):w)};
/* flexible start/end (R-EVT-15): slot.fs / slot.fe = flexible minutes after the start / before the end (stored only when > 0).
   The slot keeps its outer times; the core is what is left. Only cores count for clashes (stripes, ⚠, double-booked statistics).
   "Around these times" (R-EVT-12) is all margin: it has no core (unless it is squeezed out, see sqPick). */
const coreOf=s=>s.flex?[s.start,s.start]:[s.start+(s.fs||0),s.end-(s.fe||0)];
function fitMg(s){   // keep at least 15 minutes of core: shrink the end margin first, then the start margin
  let fs=s.fs||0,fe=s.fe||0;const over=fs+fe-(s.end-s.start-SNAP);
  if(over>0){const d=Math.min(fe,over);fe-=d;fs=Math.max(0,fs-(over-d))}
  if(fs>0)s.fs=fs;else delete s.fs;if(fe>0)s.fe=fe;else delete s.fe;return s;
}
function setMg(s,k,v){   // k = 'fs' or 'fe': set that margin, keeping 15 minutes of core; 0 removes it
  v=Math.max(0,Math.min(v,s.end-s.start-(s[k==='fs'?'fe':'fs']||0)-SNAP));if(v>0)s[k]=v;else delete s[k];return s;
}
// where the core of a repetition starts ('fs') or ends ('fe') within piece q, when that edge has a margin beside it and lies in q (R-EVT-15)
const coreEdge=(s,q,k)=>{if(s.flex||!s[k])return null;const x=coreOf(s)[k==='fs'?0:1]-1440*q.p;return x>=q.a&&x<=q.b?x:null};
const coreIn=(s,q)=>{const o=q.p*1440,[c0,c1]=coreOf(s);return [Math.max(q.a,c0-o),Math.min(q.b,c1-o)]};   // core within a piece; empty when [0] >= [1]
const fmtMg=m=>m<60?m+' min':Math.floor(m/60)+' h'+(m%60?' '+m%60+' min':'');
const edgeNote=s=>[s.fs&&L('fsNote',{a:fmtEnd(s.start),b:fmtEnd(s.start+s.fs)}),s.fe&&L('feNote',{a:fmtEnd(s.end-s.fe),b:fmtEnd(s.end)})].filter(Boolean).join(' · ');
// the core of a repetition (win: its whole window) on the timeline of the whole cycle (R-CYC-06): one interval per week it happens in, wrapping at the end
const ivs=(s,e,win)=>{const n=cyc(),Wn=W*n,ws=(e&&wksOf(e,s))||[...Array(n).keys()].map(k=>k+1),[c0,c1]=win?[s.start,s.end]:coreOf(s);if(c1<=c0)return [];
  return ws.flatMap(k=>{const a=((k-1)*7+s.day)*1440+c0,b=a+c1-c0;return b>Wn?[[a,Wn],[0,b-Wn]]:[[a,b]]})};
// repetitions of one event whose cores overlap and that clash by the people rule (R-REP-05, R-EVT-10): repetitions performed by
// different people who share nobody are parallel, not a problem; phases have no people, so theirs always clash
function overlapSet(e,slots=e.slots){
  const out=new Set();
  for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++)
    if(ivs(slots[i],e).some(([a,b])=>ivs(slots[j],e).some(([c,d])=>a<d&&c<b))&&clash({e,s:slots[i]},{e,s:slots[j]})){out.add(slots[i]);out.add(slots[j])}
  // "around these times" (R-EVT-12) is warned about only when clashing repetitions leave no minute of its window free
  slots.forEach(s=>{if(!s.flex)return;const w=ivs(s,e,true),sib=slots.filter(x=>x!==s&&clash({e,s},{e,s:x})&&ivs(x,e).some(([a,b])=>w.some(([c,d])=>a<d&&c<b))),iv=sib.flatMap(x=>ivs(x,e));
    if(sib.length&&w.every(([a,b])=>covers(a,b,iv))){out.add(s);sib.forEach(x=>out.add(x))}});
  return out;
}
/* side-by-side layout of one day column. Overlapping occurrences that may clash (a shared person — responsible or
   involved — or either without a responsible person; repetitions of one event follow the same rule) are bundled and drawn on top of each other with stripes; bundles that overlap in time but share
   nobody are placed next to each other in lanes, packed per group of overlapping bundles, ordered by the People list. */
const invOf=(e,s)=>s&&s.inv||e.involved||[];   // the occurrence's involved people: its own list, else the event's default (R-EVT-21)
// an occurrence's colour (R-EVT-22): its own, the performer's ('p', the event's when nobody performs it), the activity type's ('t', the
// event's when it has no type), else the event's
const colRaw=(e,s)=>{const c=s&&s.col;if(c==='p'){const q=s.person&&S.people.find(x=>x.id===s.person);return q?q.color:e.color}if(c==='t'){const t=tyOf(e);return t?t.color:e.color}return c||e.color};
// what is drawn: Tools can colour every occurrence by its activity type or by its performer for a while (R-UI-11); without one, the
// statistics' "No type" grey. The stored colours (colRaw, which the dialog shows) are untouched.
const NOTY='#9aa0a6';
const colOf=(e,s)=>{if(prefs.colBy==='t'){const t=tyOf(e);return t?t.color:NOTY}if(prefs.colBy==='p'){const q=s&&s.person&&S.people.find(x=>x.id===s.person);return q?q.color:NOTY}return colRaw(e,s)};
const pplOf=it=>[it.s.person,...(it.e.oncall?[]:invOf(it.e,it.s))].filter(Boolean);   // people on call (R-EVT-16) are available, not busy: they never make it clash
// two occurrences clash (R-EVT-10) when either has no responsible person (it concerns everyone) or they share a person; being the same event does not count
const clash=(x,y)=>!x.s.person||!y.s.person||(p=>pplOf(y).some(q=>p.includes(q)))(pplOf(x));
const isExt=id=>{const q=S.people.find(x=>x.id===id);return !!q&&!!q.external};
const ourPeople=()=>S.people.filter(q=>!q.external);   // external people (R-PPL-03) are left out of the statistics
const isBg=(e,s)=>!e.rhythms&&(!!e.bg||!!e.away);   // drawn as a strip (R-EVT-17): marked "In the background" (R-EVT-19) or "Away" (R-EVT-24)
/* Away (R-EVT-24): its performer and involved people are not at home. An Away strip clashes with an occurrence whose core overlaps its core
   and that names an away person (performer or involved, on call too) or has no responsible person (it concerns everyone). */
const isAway=e=>!e.rhythms&&!!e.away;
const awayPpl=(e,s)=>[s.person,...invOf(e,s)].filter(Boolean);
const awayHits=(it,aws)=>aws.filter(a=>a.e!==it.e&&a.c0<a.c1&&it.c0<it.c1&&a.c0<it.c1&&it.c0<a.c1&&(!it.s.person||[it.s.person,...invOf(it.e,it.s)].some(p=>awayPpl(a.e,a.s).includes(p))));
// the Away pieces of a day of week w as drawn (visible schedules, people and type filters)
const awayPieces=(di,w=curWk)=>S.events.filter(e=>isAway(e)&&visible(e)).flatMap(e=>e.slots.flatMap(s=>piecesOf(s).filter(q=>q.day===di&&inWk(e,s,q,w)&&slotVisible(e,s)).map(q=>{const [c0,c1]=coreIn(s,q);return {e,s,piece:q.p,c0,c1}})));
const awayOf=(e,s,q,w=curWk)=>{if(isBg(e,s))return [];const [c0,c1]=sqOf(e,s,q.p,w)?[q.a,q.b]:coreIn(s,q);return awayHits({e,s,c0,c1},awayPieces(q.day,w))};
const awayLine=a=>L('awHit',{n:awayPpl(a.e,a.s).map(pname).filter(Boolean).join(', '),t:a.e.title});
/* nested activities (R-NST-01): an occurrence of an event marked "nest" whose core lies entirely within the windows of other activities of
   its responsible person (responsible or involved, not on call; one or several back to back) is done during them: drawn inside, never a clash.
   its = the pieces of one day {e,s,start,end,c0,c1} without background strips; returns Map nested piece -> host (the one covering the core's start).
   Hosts are never nested events themselves (no chains). */
function nestPick(its){
  const out=new Map();
  its.forEach(x=>{
    const [c0,c1]=x.s.flex?[x.start,x.end]:[x.c0,x.c1];   // "around these times" has no core: its whole window must be covered (R-EVT-12)
    if(!x.e.nest||!x.s.person||c1<=c0)return;
    const hs=its.filter(y=>!y.e.nest&&pplOf(y).includes(x.s.person)&&y.start<c1&&y.end>c0).sort((p,q)=>p.start-q.start);
    let t=c0,host=null;
    for(const y of hs){if(y.start>t)break;if(y.end>t){host=host||y;t=y.end}if(t>=c1)break}
    if(host&&t>=c1)out.set(x,host);
  });
  return out;
}
const nkey=(e,s,p)=>e.id+'|'+e.slots.indexOf(s)+'|'+p;
// the pieces of a day for nestPick: visible schedules; vis = also the people filter (as drawn)
const dayPieces=(di,vis,w=curWk)=>S.events.filter(visible).flatMap(e=>e.slots.flatMap(s=>piecesOf(s).filter(q=>q.day===di&&inWk(e,s,q,w)&&(!vis||slotVisible(e,s))&&!isBg(e,s)).map(q=>{const [c0,c1]=coreIn(s,q);return {e,s,piece:q.p,start:q.a,end:q.b,c0,c1}})));
const nestOfDay=(di,vis,w=curWk)=>new Map([...nestPick(dayPieces(di,vis,w))].map(([x,h])=>[nkey(x.e,x.s,x.piece),{x,h}]));
/* "around these times" (R-EVT-12) is all margin, so what overlaps it does not clash with it, until no minute is left: an occurrence whose
   every piece is covered by the cores of occurrences it clashes with (R-EVT-10) and by Away strips of its people (R-EVT-24) is squeezed out
   and counts as a core again (stripes, ⚠). its = the pieces of one day {e,s,piece,start,end,c0,c1}, aws = its Away pieces; returns
   Map flexible piece -> the titles of what covers it. Only real cores cover: a squeezed piece never squeezes another. */
const covers=(a,b,iv)=>{let t=a;for(const [x,y] of [...iv].sort((p,q)=>p[0]-q[0])){if(x>t)break;if(y>t)t=y}return t>=b};   // does the union of the intervals cover [a, b]?
function sqPick(its,aws){
  const out=new Map(),on=(x,a,b)=>a<b&&a<x.end&&x.start<b;
  its.forEach(x=>{if(!x.s.flex||isBg(x.e,x.s))return;
    const by=[...its.filter(y=>y!==x&&on(x,y.c0,y.c1)&&clash(x,y)).map(y=>[y.c0,y.c1,y.e.title]),
      ...aws.filter(a=>a.e!==x.e&&on(x,a.c0,a.c1)&&(!x.s.person||awayPpl(x.e,x.s).some(p=>awayPpl(a.e,a.s).includes(p)))).map(a=>[a.c0,a.c1,a.e.title])];
    if(by.length&&covers(x.start,x.end,by))out.set(x,[...new Set(by.map(b=>b[2]))])});
  return out;
}
// is the occurrence of s whose piece `piece` is shown in week w squeezed out? Every piece must be (past midnight too), and a nested one never is
// (R-NST-01). Returns the titles of what covers it, or null; cache: day|week -> that day's pieces, shared by the calls of one redraw
const sqOf=(e,s,piece,w=curWk,cache=new Map())=>{
  if(!s.flex||isBg(e,s))return null;const w0=piece&&s.day===6?prevWk(w):w,ts=new Set();
  for(const q of piecesOf(s)){const wq=q.p&&s.day===6?w0%cyc()+1:w0,k=q.day+'|'+wq;
    if(!cache.has(k)){const its=dayPieces(q.day,true,wq);cache.set(k,{its,sq:sqPick(its,awayPieces(q.day,wq)),nst:nestOfDay(q.day,true,wq)})}
    const c=cache.get(k),x=c.its.find(y=>y.e===e&&y.s===s&&y.piece===q.p),hit=x&&!c.nst.has(nkey(e,s,q.p))&&c.sq.get(x);
    if(!hit)return null;hit.forEach(v=>ts.add(v))}
  return [...ts];
};
const sqLine=ts=>L('sqNote',{t:ts.join(', ')});
function laneLayout(its){
  // R-EVT-10: occurrences that clash (shared person, or either without a responsible person) overlap with stripes;
  // the rest go side by side. Each occurrence gets a range of lanes [l..l1]: parallel ones never share a lane, clashing ones share
  // at least one, so an occurrence that clashes with several parallel ones spans their lanes. Impossible cases fall back to merging.
  const n=its.length,ppl=its.map(pplOf),O=[],C=[];
  const ov=(x,y)=>x.start<x.end&&y.start<y.end&&x.start<y.end&&y.start<x.end;   // an empty range overlaps nothing
  for(let i=0;i<n;i++){O[i]=[];C[i]=[]}
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const o=ov(its[i],its[j]),c=o&&(!its[i].s.person||!its[j].s.person||ppl[i].some(p=>ppl[j].includes(p)));O[i][j]=O[j][i]=o;C[i][j]=C[j][i]=c}
  const uf=(ids,edge)=>{const par=new Map(ids.map(i=>[i,i])),f=i=>par.get(i)===i?i:(par.set(i,f(par.get(i))),par.get(i));
    ids.forEach((i,a)=>ids.slice(a+1).forEach(j=>{if(edge(i,j))par.set(f(i),f(j))}));const m=new Map();ids.forEach(i=>{const r=f(i);if(!m.has(r))m.set(r,[]);m.get(r).push(i)});return [...m.values()]};
  const pOrd=[...ourPeople(),...S.people.filter(q=>q.external)],pIdx=id=>{const k=pOrd.findIndex(p=>p.id===id);return k<0?1e9:k};   // the order shown in the sidebar (external people last, R-PPL-04)
  // bundles of clashing occurrences packed into lanes (ordered by the People list, then start time)
  const pack=ids=>{
    const bs=uf(ids,(i,j)=>C[i][j]).map(m=>({m,ord:Math.min(1e9,...m.filter(x=>its[x].s.person).map(x=>pIdx(its[x].s.person))),st:Math.min(...m.map(x=>its[x].start))}));
    bs.sort((x,y)=>x.ord-y.ord||x.st-y.st);const lanes=[],lane=new Map();
    bs.forEach(b=>{let l=lanes.findIndex(ln=>!ln.some(x=>b.m.some(y=>O[x][y])));if(l<0){l=lanes.length;lanes.push([])}lanes[l].push(...b.m);b.m.forEach(x=>lane.set(x,l))});
    const own=new Set(bs.filter(b=>{const ps=new Set(b.m.map(x=>its[x].s.person));return ps.size===1&&!ps.has('')}).flatMap(b=>b.m));   // bundles led by one person alone: that person's own lanes
    return {lane,m:lanes.length,own};
  };
  const valid=(G,sp)=>G.every((x,a)=>G.slice(a+1).every(y=>{if(!O[x][y])return true;const [a0,a1]=sp.get(x),[b0,b1]=sp.get(y),meet=a0<=b1&&b0<=a1;return C[x][y]?meet:!meet}));
  const perms=m=>{const out=[],a=[...Array(m).keys()],rec=k=>{if(k===m){out.push([...a]);return}for(let i=k;i<m;i++){[a[k],a[i]]=[a[i],a[k]];rec(k+1);[a[k],a[i]]=[a[i],a[k]]}};rec(0);
    return out.sort((x,y)=>{for(let i=0;i<m;i++)if(x[i]!==y[i])return x[i]-y[i];return 0})};   // identity (People order) first
  // R-EVT-18: an occurrence also reaches its people's own lanes (responsible or involved, not on call; a person's own lanes hold
  // bundles led by that person alone), as far as no parallel occurrence is in the way; returns how many could not (0 = all did).
  // One without a responsible person concerns everyone (R-EVT-10): it takes every lane, which always fits since it clashes with all it overlaps.
  const fits=(G,sp,x,r)=>G.every(y=>y===x||!O[x][y]||C[x][y]||(([b0,b1])=>r[1]<b0||b1<r[0])(sp.get(y)));
  const join=(G,own,sp,m)=>{
    const want=G.map(x=>{if(!its[x].s.person)return [x,0,m-1];const ls=G.filter(y=>y!==x&&own.has(y)&&ppl[x].includes(its[y].s.person)).map(y=>sp.get(y)[0]),[l,l1]=sp.get(x);
      return ls.length?[x,Math.min(l,...ls),Math.max(l1,...ls)]:null}).filter(w=>w&&(w[1]!==sp.get(w[0])[0]||w[2]!==sp.get(w[0])[1]));
    return want.filter(([x,a,b])=>{if(!fits(G,sp,x,[a,b]))return true;sp.set(x,[a,b]);return false}).length;
  };
  function arrange(G){
    if(!G.some(x=>G.some(y=>O[x][y]&&!C[x][y]))){const sp=new Map(G.map(x=>[x,[0,0]]));return {sp,m:1}}   // nothing in parallel: one lane
    if(G.length>60)return null;
    const spn=new Set(G.filter(x=>{const cs=G.filter(y=>C[x][y]);return cs.some(y=>cs.some(z=>O[y][z]&&!C[y][z]))}));
    const base=G.filter(x=>!spn.has(x));if(!base.length)return null;
    const {lane,m,own}=pack(base),orders=m>6?[[...Array(m).keys()]]:perms(m);let best=null;
    for(const pm of orders){
      const sp=new Map(base.map(x=>[x,[pm[lane.get(x)],pm[lane.get(x)]]]));
      let todo=[...spn];
      for(let pass=0;todo.length&&pass<=spn.size;pass++)todo=todo.filter(x=>{const ls=G.filter(y=>C[x][y]&&sp.has(y)).flatMap(y=>sp.get(y));if(!ls.length)return true;sp.set(x,[Math.min(...ls),Math.max(...ls)]);return false});
      if(!todo.length&&valid(G,sp)){const miss=join(G,own,sp,m);if(!miss)return {sp,m};if(!best||miss<best.miss)best={sp,m,miss}}   // the first order (closest to the People list) where every occurrence reaches its people's lanes, else the one where most do
    }
    return best;
  }
  const out=new Map();
  uf([...Array(n).keys()],(i,j)=>O[i][j]).forEach((G,gi)=>{
    let r=arrange(G);
    if(!r){const {lane,m}=pack(G);r={sp:new Map(G.map(x=>[x,[lane.get(x),lane.get(x)]])),m}}   // fallback: merge into stripes
    G.forEach(x=>{const [l,l1]=r.sp.get(x);out.set(its[x],{l,l1,n:r.m,g:gi})});
  });
  return out;
}
// R-EVT-23 fixed lanes (Tools): every person whose eye is open has a lane of their own in every day column, in the order of the People
// list (ours, then external people), never shared with anyone else even when it is empty. An occurrence is drawn in the lane of each of
// its people (performer and involved, not on call; failing that, its on-call people), runs of neighbouring lanes joined into one box;
// one without a responsible person concerns everyone and takes every lane. Overlapping in a lane then always means sharing a person,
// so stripes stay where clashes are.
// our visible people always have a lane; an external one only when they have an activity on the grid that is not in the background (a strip)
function fixIds(){const busy=new Set(S.events.filter(e=>visible(e)&&!e.bg&&!e.away).flatMap(e=>e.slots.filter(s=>slotVisible(e,s)).flatMap(s=>pplOf({e,s}))));
  return [...ourPeople(),...S.people.filter(q=>q.external&&busy.has(q.id))].filter(q=>q.visible).map(q=>q.id)}
function fixedLayout(its){
  const ids=fixIds(),n=Math.max(1,ids.length),all=[...Array(n).keys()],out=new Map();
  const at=ps=>[...new Set(ps.map(p=>ids.indexOf(p)).filter(k=>k>=0))].sort((x,y)=>x-y);
  its.forEach(it=>{let ks=!it.s.person||!ids.length?all:at(pplOf(it));if(!ks.length)ks=at(invOf(it.e,it.s));if(!ks.length)ks=all;
    const segs=[];ks.forEach(k=>{const q=segs.at(-1);if(q&&q[1]===k-1)q[1]=k;else segs.push([k,k])});
    out.set(it,{l:segs[0][0],l1:segs.at(-1)[1],n,g:0,segs,ids})});
  return out;
}
const NI=14;   // left indent of a nested box inside its host (px)
let laneMap=new Map(),gutMap={},fxW=0,nestMap=new Map(),sqMap=new Set();
const gk=k=>curWk+'#'+k;   // a key of the last drawn grid: with every week side by side (R-CYC-19) a piece appears in several columns   // sqMap: nkeys of the squeezed-out pieces of the last drawn grid (R-EVT-12)
   // nestMap: nkey of a nested piece -> {x, h: its host} in the last drawn grid (R-NST-01)
   // gutMap: day -> strip gutter (px); fxW: width of the column last measured by fxAt   // 'eventId|slotIndex|piece' -> [first lane, last lane, lanes] of the last drawn grid, for hit-testing by x
const inLane=(e,i,p,fx,di)=>{if(fx==null||e.rhythms)return true;const v=laneMap.get(gk(e.id+'|'+i+'|'+p));if(!v)return true;
  const fr=(1-fx)*fxW,g=gutMap[gk(di)]||0;   // distance from the right edge (px): strips live there, boxes stop before the gutter
  if(v[0]==='s')return fr>=v[1]&&fr<v[2];
  if(g&&fxW){if(fr<g)return false;fx=fx*fxW/(fxW-g)}
  if(v[0]==='m')return v[1].some(([x,y])=>fx>=x/v[2]&&fx<(y+1)/v[2]);   // fixed lanes: one box per run of lanes (R-EVT-23)
  if(v[0]==='n')return fx>=v[1]/v[3]+(fxW>g?NI/(fxW-g):0)&&fx<(v[2]+1)/v[3];   // a nested box: its host's lanes minus the indent (R-NST-02)
  return fx>=v[0]/v[2]&&fx<(v[1]+1)/v[2]};
const fxAt=(c,x)=>{const r=c.getBoundingClientRect();fxW=r.width;return r.width?(x-r.left)/r.width:null};
const isNestK=x=>(laneMap.get(gk(x.e.id+'|'+x.i+'|'+x.piece))||[])[0]==='n';
const nestFirst=its=>{const nb=its.filter(isNestK);return nb.length?nb:its};   // a nested box lies on top of its host (R-NST-02)
const piecesAt=(di,m,all,fx,list=act())=>{
  let its=list.filter(e=>eVis(e)&&(all||!eLock(e))).flatMap(e=>e.slots.flatMap((s,i)=>piecesOf(s).filter(q=>q.day===di&&q.a<=m&&m<q.b&&inWk(e,s,q)&&sVis(e,s)&&inLane(e,i,q.p,fx,di)).map(q=>({e,s,i,piece:q.p,core:sqMap.has(gk(nkey(e,s,q.p)))||(([a,b])=>a<=m&&m<b)(coreIn(s,q))}))));
  its=nestFirst(its);
  return its.some(x=>x.core)?its.filter(x=>x.core):its;   // a core covers the flexible margins of other events (R-EVT-15)
};
const itemsAt=(di,m,fx)=>piecesAt(di,m,false,fx);
const weekDays=()=>prefs.hideWeekend?[0,1,2,3,4]:[0,1,2,3,4,5,6];
function setFocus(di){if(live){clearTimeout(lvRet);lvCloseAll(true);live=false;livePaused=false;prefs.live=false;savePrefs()}focusD=di;phoneFit();render()}   // leaving ends live view (R-GRID-12)
function stepFocus(d){const ds=weekDays();let x=focusD;do{const nx=(x+d+7)%7;if(d>0&&nx<x)curWk=curWk%cyc()+1;else if(d<0&&nx>x)curWk=prevWk(curWk);x=nx}while(!ds.includes(x));setFocus(x)}   // wraps around the week (into the next or previous week of a cycle, R-CYC-04), skipping a hidden weekend
function hiddenInfo(){
  // counts only occurrences that are not shown purely because of the hidden weekend / hidden early hours (never partially visible ones)
  let wk=0,er=0;
  S.events.filter(visible).forEach(e=>e.slots.forEach(s=>{
    if(!slotVisible(e,s))return;
    if(focusD!=null){const fs=piecesOf(s).filter(q=>q.day===focusD&&inWk(e,s,q));if(fs.length&&fs.every(q=>q.b<=vs()*60))er++;return}   // focus: only the focused day's early hours
    const ps=piecesOf(s).filter(q=>inWk(e,s,q));if(!ps.length)return;   // only the shown week of a cycle (R-CYC-12)
    if(ps.some(q=>!(prefs.hideWeekend&&q.day>4)&&q.b>vs()*60))return;
    if(ps.some(q=>prefs.hideWeekend&&q.day>4))wk++;else er++;
  }));
  return {wk,er,n:wk+er};
}
function drawNow(){
  document.querySelectorAll('.now').forEach(n=>n.remove());if(!nowOn&&!live)return;   // live view always shows the line (R-GRID-12)
  const d=new Date(),m=d.getHours()*60+d.getMinutes(),a=vs()*60;if(m<a)return;
  const tw=todayWk();if(tw&&!allWk&&tw!==curWk)return;   // with today's week known, only in that week (R-CYC-05); all weeks side by side: in its column (R-CYC-19)
  document.querySelectorAll('.day[data-d="'+((d.getDay()+6)%7)+'"]').forEach(col=>{if(allWk&&tw&&+col.dataset.w!==tw)return;
    const n=el('div','now',col);n.style.top=(m-a)/60*HH+'px';n.title=fmt(m)});
}
setInterval(()=>{drawNow();liveTick()},30000);
/* live view (R-GRID-12), for a public screen: today's day view, read-only, following the now line a third of the way down, with live
   cards of what the line is over. A manual scroll pauses it; it comes back after a minute or with the Now button. Remembered per browser;
   left only with the Live View Mode pill, Stop Live View or Esc (back to the week). */
let live=false,livePaused=false,liveTop=-1,liveWant=0,ptrHeld=false,lvRet=null;   // liveTop: the scroll position live view last set; liveWant: the one it aimed for
const LV_BACK=60000;   // a manual scroll pauses following for this long
const today=()=>(new Date().getDay()+6)%7;
/* Today's week of the cycle (R-CYC-05), one of the two dates the app keeps (the other: the last calendar export, R-SHARE-09): the first Live View of a workspace with a cycle asks which week today
   is in, and the answer is remembered in this browser as an anchor, the Monday of a week 1 (local date YYYY-MM-DD), in prefs.lvAnchor by
   workspace id; never in the data, files or links. The week is worked out from today's date, so midnight, Sunday and a tablet that slept
   for days need nothing more. Days are counted as days since 1970 of the local date (clock changes cannot move them). */
const ymd=d=>Math.round(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5);
const dnum=t=>{const [y,m,d]=t.split('-').map(Number);return Math.round(Date.UTC(y,m-1,d)/864e5)};
const thisMon=()=>ymd(new Date())-today();
const wkAt=dn=>{if(cyc()<2)return 1;const t=prefs.lvAnchor[curId];if(!t)return null;const n=cyc(),k=Math.floor((dn-(dn+3)%7-dnum(t))/7);return (k%n+n)%n+1};   // the week of the cycle of local day dn (1 Jan 1970 was a Thursday); null: not known in this browser
const todayWk=()=>wkAt(ymd(new Date()));
const liveWk=()=>todayWk()||1;
function setAnchor(w){prefs.lvAnchor[curId]=new Date((thisMon()-(w-1)*7)*864e5).toISOString().slice(0,10);savePrefs()}
function askLiveWeek(onYes,onNo,o={}){   // which week of the cycle is today in? (R-CYC-05); o.body, o.btn: the calendar export asks it too (R-SHARE-09)
  const body=el('div');el('p','',body).textContent=L(o.body||'lwBody');
  const row=el('label','cyrow',body);row.append(L('lwToday')+' ');const sel=el('select','',row);fillSel(sel,[...Array(cyc()).keys()].map(k=>[k+1,wkLabel(k+1)]));sel.value=curWk;
  xdlg({title:L('lwTitle'),body,onDismiss:onNo,buttons:[{label:L(o.btn||(live?'lwSet':'lwStart')),cls:'p',fn:()=>{setAnchor(+sel.value);onYes()}},{label:L('cancel'),dismiss:true}]});
}
const liveBusy=()=>ptrHeld||!!document.querySelector('dialog[open],.omenu');   // never move under a dialog, a menu or a held pointer (drag)
function liveScroll(){
  const w=$('wrap'),d=new Date(),m=d.getHours()*60+d.getMinutes(),a=vs()*60,hd=document.querySelector('#grid .dh'),hh=hd?hd.offsetHeight:0;
  liveWant=m<a?0:Math.max(0,Math.round((m-a)/60*HH-(w.clientHeight-hh)/3));w.scrollTop=liveWant;liveTop=w.scrollTop;
}
function setLive(on){
  if(on&&todayWk()==null){askLiveWeek(()=>setLive(true));return}   // which week of the cycle is today in? (R-CYC-05)
  clearTimeout(lvRet);lvCloseAll(true);live=on;livePaused=false;prefs.live=on;savePrefs();if(on){selK=null;focusD=today();curWk=liveWk()}else if(!phone())focusD=null;phoneFit();render()}   // a phone stays on the day it showed (R-GRID-12)
function liveBack(){clearTimeout(lvRet);if(!live)return;livePaused=false;liveScroll();updLive()}
function liveTick(){if(!live||liveBusy())return;if(todayWk()==null){askLiveWeek(()=>{curWk=liveWk();render()},()=>setLive(false));return}   // another workspace or a new cycle: which week is it?
  if(focusD!==today()||curWk!==liveWk()){lvCloseAll(true);focusD=today();curWk=liveWk();render();return}if(!livePaused)liveScroll()}   // midnight: on to the next day (after Sunday, the next week of a cycle, R-CYC-05)
function updLive(){
  const pl=$('lvPill');pl.style.display=live?'':'none';pl.querySelector('span').textContent=L('lvMode');pl.title=L('lvModeTip');pl.__t=pl.title;
  {const s=$('sb');if(s){s.classList.toggle('lv',live);s.classList.toggle('paused',live&&livePaused)}const f=$('lvF');if(f){f.title=L('lvNowTip');f.setAttribute('aria-label',L('lvNow'))}}
  {const r=$('lvR');if(r){r.innerHTML=live?ICON_STOP:ICON_CAM;r.title=L(live?'lvStopTip':'lvStartTip');r.setAttribute('aria-label',L(live?'lvStop':'lvStart'));r.classList.toggle('on',live);r.setAttribute('aria-pressed',String(live))}}
  const b=$('lvB'),c=$('lvC');if(!b)return;
  b.innerHTML=(live?ICON_STOP:ICON_CAM)+'<span></span>';b.querySelector('span').textContent=L(live?'lvStop':'lvStart');b.title=L(live?'lvStopTip':'lvStartTip');b.__t=b.title;
  b.classList.toggle('on',live);b.setAttribute('aria-pressed',String(live));c.style.display=live&&livePaused?'':'none';
}
/* live bubbles (R-GRID-12): tapping a box (or a place where boxes overlap) fades in a speech bubble whose arrow points at the tap, one section
   per occurrence there. Several may be open; each fades out after a minute, or at a tap on it or on empty space. They survive redraws.
   Placement: above or below the tap, never over another bubble if possible, covering as little of the boxes' text as possible. */
const LV_AR=9,LV_PEEK=60000,LV_SLACK=6;   // arrow height; how long a bubble stays; how far the arrow tip may sit from the tap (room at the column edges)
let lvOpen=[],lvRects=[],lvDown=null;   // lvOpen: {keys, fx, m, timer, el}; lvRects: bubbles drawn in this redraw
function lvClose(o,now){clearTimeout(o.timer);lvOpen=lvOpen.filter(x=>x!==o);const b=o.el;if(!b)return;if(b._st)b._st.remove();if(now){b.remove();return}b.classList.add('out');setTimeout(()=>b.remove(),300)}
function lvTime(o){clearTimeout(o.timer);const t=setTimeout(()=>{if(o.timer===t)lvClose(o)},LV_PEEK);o.timer=t}   // a minute from now; only the latest timer counts
function lvCloseAll(now){lvOpen.slice().forEach(o=>lvClose(o,now))}
function lvDraw(o,fresh){
  const col=document.querySelector(`#grid .day[data-d="${focusD}"]`);if(!col)return;
  const its=o.keys.map(k=>{const [id,i,p]=k.split('|'),e=S.events.find(x=>x.id===id),s=e&&e.slots[+i];return s&&{e,s,piece:+p}}).filter(Boolean).sort((x,y)=>x.s.start-y.s.start);
  if(!its.length){lvClose(o,true);return}
  const L0=col.querySelector('.lvl')||el('div','lvl',col);L0.setAttribute('aria-live','polite');L0.setAttribute('aria-label',L('lvCards'));
  const cr=col.getBoundingClientRect(),W=cr.width,H=col.offsetHeight||parseFloat(col.style.height)||0,ax=o.fx*W,y=(o.m-vs()*60)/60*HH,bw=Math.max(120,Math.min(300,W-8));
  const b=el('div','lvb'+(fresh?' in':''),L0),inn=el('div','lvin',b);b.style.width=bw+'px';b._o=o;o.el=b;
  its.forEach(it=>{const sc=el('div','lvs',inn);sc.style.setProperty('--c',colOf(it.e,it.s));sc.innerHTML=peekRows(it,true)});
  // the text of the boxes is what a bubble should not cover (half as bad over its own boxes, whose text it repeats)
  const rel=r=>({x:r.left-cr.left,y:r.top-cr.top,w:r.width,h:r.height}),mine=new Set(its.map(it=>it.s));
  const info=[...col.querySelectorAll('.ev .r1,.ev .r2,.bgs span')].map(t=>({...rel(t.getBoundingClientRect()),it:t.closest('.ev,.bgs')._it})).filter(r=>r.w&&r.h);
  const area=(p,q)=>Math.max(0,Math.min(p.x+p.w,q.x+q.w)-Math.max(p.x,q.x))*Math.max(0,Math.min(p.y+p.h,q.y+q.h)-Math.max(p.y,q.y));
  const h=b.offsetHeight;let best=null;
  const cl=Math.max(0,Math.min(W-bw,ax-bw/2));   // as centred on the tap as the column allows
  for(let tier=0;tier<9;tier++)for(const side of ['b','t'])for(const af of [.5,16,bw-16,'c']){
    const ax0=af==='c'?ax-cl:af<1?bw*af:af,left=Math.max(0,Math.min(W-bw,ax-ax0)),axT=Math.max(ax-LV_SLACK,Math.min(ax+LV_SLACK,left+ax0)),axb=axT-left;if(axb<12||axb>bw-10)continue;
    const off=LV_AR+tier*24,top=side==='b'?y+off:y-off-h;if(top<2||top+h>H-2)continue;
    const r={x:left,y:top,w:bw,h},sc=lvRects.reduce((t,p)=>t+area(r,p)*1000,0)+info.reduce((t,q)=>t+area(r,q)*(q.it&&mine.has(q.it.s)?.5:1),0)+tier*500+(side==='t'?40:0)+Math.abs(axb-bw/2)*.3+Math.abs(axT-ax)*30;   // the tip as close to the tap as possible
    if(!best||sc<best.sc)best={sc,r,side,axb,axT,tier};
  }
  if(!best){const top=Math.max(2,Math.min(H-h-2,y+LV_AR)),left=Math.max(0,Math.min(W-bw,ax-bw/2)),axb=Math.max(12,Math.min(bw-10,ax-left));best={r:{x:left,y:top,w:bw,h},side:'b',axb,axT:left+axb,tier:0}}   // no room: below, clamped
  const {r,side,axb,axT,tier}=best;b.classList.add(side);b.style.left=r.x+'px';b.style.top=r.y+'px';b.style.setProperty('--ax',axb+'px');b.dataset.ax=axT;lvRects.push(r);o.r=r;
  if(tier){const st=el('div','lvstem',L0),y0=side==='b'?y:r.y+h+LV_AR,y1=side==='b'?r.y-LV_AR:y;st.style.cssText=`left:${axT-1}px;top:${y0}px;height:${Math.max(0,y1-y0)}px`;b._st=st}
}
function liveTap(x,y,tg){
  const bb=tg&&tg.closest&&tg.closest('.lvb');if(bb&&bb._o){lvClose(bb._o);return}   // a tap on a bubble closes it
  const col=tg&&tg.closest&&tg.closest('.day');if(!col){lvCloseAll();return}
  const di=+col.dataset.d,m=minAt(col,y),fx=fxAt(col,x),its=piecesAt(di,m,true,fx,S.events);
  if(!its.length){lvCloseAll();return}   // empty space closes them all
  const keys=its.map(it=>it.e.id+'|'+it.i+'|'+it.piece),same=lvOpen.find(o=>o.keys.length===keys.length&&o.keys.every(k=>keys.includes(k)));
  if(same){   // the same occurrences again: that bubble moves to the new tap and gets a new minute, no duplicate
    lvTime(same);same.fx=fx;same.m=m;
    if(same.el){same.el.remove();if(same.el._st)same.el._st.remove()}lvRects=lvRects.filter(r=>r!==same.r);lvDraw(same,false);return}
  const o={keys,fx,m};lvOpen.push(o);lvTime(o);lvDraw(o,true);
}
// while live the grid is read-only: presses only open bubbles (taps) or scroll; nothing reaches the boxes' own handlers
{const g=$('grid'),stop=ev=>{if(!live||ev.target.closest&&ev.target.closest('.wkb'))return false;ev.stopPropagation();return true};   // the corner week switcher stays pressable (R-CYC-05)
 g.addEventListener('pointerdown',ev=>{if(stop(ev))lvDown={x:ev.clientX,y:ev.clientY,tg:ev.target}},true);
 g.addEventListener('pointerup',ev=>{if(!stop(ev))return;const d=lvDown;lvDown=null;if(d&&Math.hypot(ev.clientX-d.x,ev.clientY-d.y)<=8)liveTap(ev.clientX,ev.clientY,d.tg)},true);
 ['pointermove','click','dblclick','contextmenu'].forEach(t=>g.addEventListener(t,ev=>{if(stop(ev)&&t!=='pointermove')ev.preventDefault()},true))}
$('lvPill').onclick=()=>setLive(false);
$('wrap').addEventListener('scroll',()=>{if(!live||Math.abs($('wrap').scrollTop-liveTop)<=2)return;if(!livePaused){livePaused=true;updLive()}clearTimeout(lvRet);lvRet=setTimeout(liveBack,LV_BACK)},{passive:true});
document.addEventListener('pointerdown',()=>{ptrHeld=true},true);['pointerup','pointercancel'].forEach(t=>document.addEventListener(t,()=>{ptrHeld=false},true));
/* generic dialog */
let xTok=0;   // identifies the dialog currently shown, so a button handler that opens another dialog doesn't get it closed again
function xdlg(o){
  const d=$('xDlg');d.innerHTML='';let done=false;const tok=++xTok;
  el('h3','',d).textContent=o.title;
  if(o.body){const b=el('div','xb',d);if(typeof o.body==='string')b.innerHTML=o.body;else b.append(o.body)}
  d.classList.toggle('wide',!!o.wide);d.classList.toggle('full',!!o.full);   // full: fills the screen on a phone (R-UI-14)
  const bt=el('div','btns',d);
  o.buttons.forEach(b=>{const x=el('button',b.cls||'',bt);x.textContent=b.label;
    x.onclick=()=>{if(b.dismiss){d.close();return}if(b.fn&&b.fn()===false)return;if(tok!==xTok)return;done=true;d.close()}});
  d.onclose=()=>{if(!done&&o.onDismiss)o.onDismiss()};d.oncancel=o.keep?e=>e.preventDefault():null;   // keep: Escape does not close it
  if(!d.open)d.showModal();
}
let setTab='viewH';   // last Settings tab shown (kept while the page is open)
function openSettings(){
  // tabs keep one size: all panes share a grid cell, the hidden ones are invisible (not removed), so the largest decides the size
  const body=el('div','settings'),tabs=el('div','stabs',body),wrap=el('div','spanes',body),panes={};tabs.setAttribute('role','tablist');
  const show=k=>{setTab=k;Object.entries(panes).forEach(([n,p])=>{const on=n===k;p.classList.toggle('off',!on);p.toggleAttribute('inert',!on);p.setAttribute('aria-hidden',String(!on));p._b.classList.toggle('on',on);p._b.setAttribute('aria-selected',String(on));p._b.tabIndex=on?0:-1})};
  const sec=k=>{const s=el('div','ssec',wrap);s.setAttribute('role','tabpanel');const b=el('button','',tabs);b.type='button';b.textContent=L(k);b.setAttribute('role','tab');b.onclick=()=>show(k);s._b=b;panes[k]=s;return s};
  tabs.onkeydown=ev=>{const ks=Object.keys(panes),d=ev.key==='ArrowRight'?1:ev.key==='ArrowLeft'?-1:0;if(!d)return;const k=ks[(ks.indexOf(setTab)+d+ks.length)%ks.length];show(k);panes[k]._b.focus()};
  const opt=(p,label,desc,get,set,cls)=>{const l=el('label','sopt'+(cls?' '+cls:''),p),i=el('input','',l);i.type='checkbox';i.checked=get();
    const s=el('span','',l);s.innerHTML=`<b>${esc(L(label))}</b><small>${esc(L(desc))}</small>`;i.onchange=()=>{set(i.checked);savePrefs();render()};return i};
  const v=sec('viewH');el('small','note',v).textContent=L('viewNote');
  opt(v,'setEarly','earlyTip',()=>prefs.showEarly,x=>{prefs.showEarly=x;if(!x)$('wrap').scrollTop=0});
  opt(v,'setNow','nowTip',()=>nowOn,x=>{nowOn=x});
  opt(v,'setClock','clockTip',()=>prefs.clock12,x=>{prefs.clock12=x});
  opt(v,'setWE','weTip',()=>prefs.hideWeekend,x=>{prefs.hideWeekend=x});
  const dt=sec('dataH');
  [['restart','restartTip',restart,''],['clear','clearTip',clearMem,'d']].forEach(([lb,tp,fn,cls])=>{
    const r=el('div','sopt',dt),b=el('button',cls,r);b.textContent=L(lb);b.style.cssText='flex:0 0 140px';b.onclick=()=>{$('xDlg').close();fn()};
    el('small','',r).textContent=L(tp)});
  // a passphrase for browser memory (R-DATA-11); each opens its own dialog once Settings has closed
  if(memKey)el('small','note',dt).textContent=L('protState');
  (memKey?[['chPass','chPassTip',()=>openPassphrase('change'),''],['lockNow','lockTip',lockNow,''],['unprot','unprotTip',()=>openPassphrase('off'),'d']]:[['protB','protTip',()=>openPassphrase('on'),'']]).forEach(([lb,tp,fn,cls])=>{
    const r=el('div','sopt',dt),b=el('button',cls,r);b.textContent=L(lb);b.style.cssText='flex:0 0 140px';b.onclick=()=>{$('xDlg').close();setTimeout(fn,0)};
    el('small','',r).textContent=L(tp)});
  const ui=sec('uiH');el('small','note',ui).textContent=L('viewNote');
  {const tw=el('div','sopt col',ui),tb=el('span','',tw);tb.innerHTML=`<b>${esc(L('setTheme'))}</b><small>${esc(L('themeTip'))}</small>`;
   const sg=el('div','seg theme',tw);sg.setAttribute('role','group');sg.setAttribute('aria-label',L('setTheme'));
   [['auto','themeAuto'],['light','themeLight'],['dark','themeDark']].forEach(([m,k])=>{const b=el('button',(prefs.theme||'auto')===m?'on':'',sg);b.type='button';b.textContent=L(k);b.setAttribute('aria-pressed',String((prefs.theme||'auto')===m));
     b.onclick=()=>{prefs.theme=m;savePrefs();applyTheme();[...sg.children].forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',String(x===b))})}})}
  {const lw=el('div','sopt col',ui),lt=el('span','',lw);lt.innerHTML=`<b>${esc(L('lang'))}</b><small>${esc(L('langTip'))}</small>`;
   const ls=el('select','',lw);
   [['en','English'],['es','Español']].forEach(([c,n])=>{const o=el('option','',ls);o.value=c;o.textContent=n});
   ls.value=lang;ls.onchange=()=>{setLang(ls.value);openSettings()};ls.setAttribute('aria-label',L('lang'))}
  show(panes[setTab]?setTab:'viewH');
  xdlg({title:L('settings'),full:true,body,buttons:[{label:L('closeB'),cls:'p'}]});
}
function openHelp(){
  const ul=el('ul');ul.style.cssText='margin:0;padding-left:18px;line-height:1.55';
  for(let i=1;i<=22;i++)el('li','',ul).textContent=L('help'+i);
  xdlg({title:L('helpTitle'),full:true,body:ul,buttons:[{label:L('closeB'),cls:'p'}]});
}
