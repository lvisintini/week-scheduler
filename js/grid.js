// The grid: render(), pointer interactions, touch, the peek card, zoom and dragging. ES module (docs/architecture.md).
import {state} from './state.js';
import {DAY2,DAYS,L} from './i18n.js';
import {$,ICON_AGENDA,ICON_CL,ICON_CR,ICON_FOCUS,ICON_LOCK,ICON_REPEAT,ICON_WARN,ICON_WEEK,SNAP,el,esc,normHex,pIc,pTag,sTag,shiftColor,tIcon,tyOf,tyTag} from './basics.js';
import {absD,isAdv,pushUndo,sameDay,shiftDay,undo,wkCol,wkDesc,wkI,wkMenu,wkNote,wkNoteH,wkShortL,wkTip} from './data.js';
import {FH,FWK,NI,RH,WK,act,awayHits,awayLine,awayOf,awayPpl,colOf,coreEdge,coreIn,cyc,cycSl,dayPieces,descOn,drawNow,eLock,eVis,edgeNote,evOp,fitMg,fixIds,fixedLayout,fmt,fmtEnd,fxAt,gk,gutMap,hiddenInfo,hourLabel,hrA,hrB,inLane,inWk,ink,invOf,isAway,isBg,isExt,isLocked,itemsAt,laneLayout,laneMap,liveBusy,liveScroll,lvDraw,lvOpen,lvRects,nestFirst,nestMap,nestPick,newMaps,nkey,overlapSet,phVis,phone,piecesAt,piecesOf,pname,qa,sVis,setFocus,setMg,slotVisible,sqLine,sqMap,sqOf,stepFocus,stgSl,toast,todayWk,updLive,visible,vrhythm,weekDays} from './model.js';
import {openAgenda,withWk} from './stats.js';
import {renderSide} from './sidebar.js';
import {openCopy,openDlg} from './dialog.js';
/* ---------- grid ---------- */
export function render(){
  if(state.curWk>cyc())state.curWk=cyc();   // a shorter cycle, another workspace, an undo (R-CYC-04)
  if(state.allWk&&(cyc()<2||state.live))state.allWk=false;   // every week side by side: only with a cycle, never live (R-CYC-19)
  if(!state.skipSide)renderSide();
  hidePeek();
  const fitW=!state.printMode&&state.prefs[FWK()],fitH=!state.printMode&&state.prefs[FH()],ts=state.printMode?1:state.prefs.txt/100;
  const colMin=state.printMode?110:fitW?40:state.prefs[WK()];
  const g=$('grid'),a=hrA(),b=hrB(),Z=b*60,hrs=b-a,days=state.focusD!=null?[state.focusD]:weekDays(),lvOn=state.live&&!state.printMode,w0=state.curWk;
  // the columns: the days of the shown week, or with every week side by side the days of each week in turn (R-CYC-19)
  const cols=state.allWk?[...Array(cyc()).keys()].flatMap(k=>days.map(d=>({w:k+1,d}))):days.map(d=>({w:state.curWk,d}));
  document.documentElement.style.setProperty('--ts',ts);g.style.setProperty('--ts',ts);g.classList.toggle('lv',lvOn);g.classList.toggle('fo',state.focusD!=null);
  // Fit height: the visible hours fill the window under the day header, whose height follows the text size. Measured before the grid
  // is emptied (layout of an empty grid would reset the scroll position), on the previous header with the new text size; no layout → the slider
  const wh=fitH?$('wrap').clientHeight:0,dhH=wh&&g.querySelector('.dh')?.offsetHeight||38,ww=$('wrap').clientWidth;   // ww: for narrow week headers
  state.HH=state.printMode?48:wh?Math.max(14,Math.min(200,Math.floor((wh-dhH)/hrs))):state.prefs[RH()];
  g.innerHTML='';g.style.setProperty('--hh',state.HH+'px');g.classList.toggle('phmode',state.editMode==='phases');$('wrap').classList.toggle('phm',state.editMode==='phases');
  const lane=vrhythm()?18:0;g.style.setProperty('--lane',lane+'px');const tw=Math.round(52*ts);g.style.gridTemplateColumns=`${tw}px repeat(${cols.length},${state.printMode||fitW||state.focusD!=null?`minmax(${colMin+lane}px,1fr)`:colMin+lane+'px'})`;g.style.minWidth=(tw+cols.length*(colMin+lane))+'px';   // the time column grows with the text size
  const cc=el('div','dh c',g);
  if(cyc()>1&&state.allWk){const b=el('button','wkb',cc);b.type='button';b.textContent=L('wkAllS',{n:cyc()});const t=L('wkAllTip',{c:cyc()});b.setAttribute('aria-label',t);b.title=t;b.onclick=()=>wkMenu(b)}   // R-CYC-19
  else if(cyc()>1){const b=el('button','wkb',cc);b.type='button';b.textContent=L('wkShort',{n:state.curWk});const nm=wkI(state.curWk).name?' · '+wkI(state.curWk).name+(wkDesc(state.curWk)?': '+wkDesc(state.curWk):''):wkDesc(state.curWk)?': '+wkDesc(state.curWk):'';
    b.setAttribute('aria-label',L('wkTip',{n:state.curWk,c:cyc()})+nm);const tw=todayWk();b.title=L('wkTip',{n:state.curWk,c:cyc()})+nm+(tw?'. '+L('wkTodayTip',{n:tw}):'');b.onclick=()=>wkMenu(b);
    const c=wkCol(state.curWk);if(c){b.classList.add('col');b.style.background=c;b.style.borderColor=c;b.style.color=ink(c)}}   // the week's colour (R-CYC-17)
  {const c=!state.allWk&&wkCol(state.curWk);g.classList.toggle('wkband',!!c);g.style.setProperty('--wkc',c||'transparent');g.classList.toggle('allwk',state.allWk)}   // all weeks: each header carries its own week's band   // a band under the day headers in the shown week's colour
  // narrow week columns (under 70 px, e.g. a phone): a short name and no buttons; a tap opens that day, whose header has the agenda (R-GRID-06)
  const nar=state.focusD==null&&!state.printMode&&(fitW?(ww?(ww-tw)/cols.length-lane:1e9):colMin)<70;
  const wks=k=>state.allWk&&k>0&&cols[k].w!==cols[k-1].w;   // the first column of a week, with every week side by side
  cols.forEach(({w,d:di},k)=>{const h=el('div','dh'+(di>4?' we':'')+(di>4&&k>0&&cols[k-1].d>4&&!wks(k)?' wj':'')+(state.focusD!=null?' fo':'')+(nar&&!lvOn?' nr':'')+(wks(k)?' wks':''),g);h.dataset.d=di;
    if(state.allWk){h.dataset.w=w;const c=wkCol(w);if(c){h.classList.add('wkbd');h.style.setProperty('--wkc',c)}}
    const wn=state.allWk?' · '+L('wkShort',{n:w}):'';   // every week side by side: each header names its week (R-CYC-19)
    if(lvOn){h.textContent=DAYS[di]+(cyc()>1?' · '+(phone()?L('wkShort',{n:state.curWk}):wkShortL(state.curWk)):'');if(wkDesc(state.curWk))h.title=wkTip(state.curWk);return}   // live view: only the day name, nothing to press (R-GRID-12)
    if(nar){h.textContent=DAY2[state.lang][di]+(state.allWk?' '+w:'');h.title=L('focusTip',{d:DAYS[di]});h.setAttribute('aria-label',DAYS[di]+wn);h.onclick=()=>setFocus(di);return}
    h.title=L('agendaTip');h.onclick=()=>openAgenda(di,w);
    const hb=(cls,icon,tip,fn)=>{const b=el('button','dhb '+cls,h);b.type='button';b.innerHTML=icon;b.title=tip;b.setAttribute('aria-label',tip);b.onclick=ev=>{ev.stopPropagation();fn()};return b};
    if(state.focusD!=null)hb('prv',ICON_CL,L('focusPrev'),()=>stepFocus(-1));
    h.insertAdjacentHTML('beforeend',`<span class="ic">${ICON_AGENDA}</span>`+esc(DAYS[di]+(state.allWk?wn:state.focusD!=null&&cyc()>1?' · '+L('wkShort',{n:state.curWk}):'')));
    if(state.focusD==null)hb('foc',ICON_FOCUS,L('focusTip',{d:DAYS[di]}),()=>setFocus(di));
    else{hb('nxt',ICON_CR,L('focusNext'),()=>stepFocus(1));hb('wk',ICON_WEEK,L('focusWeekTip'),()=>setFocus(null)).append(L('focusWeek'))}});
  const tm=el('div','times',g);tm.style.height=hrs*state.HH+'px';
  for(let h=a;h<b;h++){const s=el('span','',tm);s.textContent=hourLabel(h);s.style.top=(h-a)*state.HH+'px';if(h===a)s.style.transform='translateY(2px)'}
  const ovCache=new Map(),ovOf=e=>{if(!ovCache.has(e))ovCache.set(e,overlapSet(e));return ovCache.get(e)};
  const vsel=vrhythm(),fitList=[];newMaps();const sqc=new Map();
  const lanePos=(x,v)=>{if(v.n<2)return;const l1=v.l1??v.l;x.dataset.lane=(l1>v.l?v.l+'-'+l1:v.l)+'/'+v.n;x.style.left=`calc(3px + (100% - 6px - var(--gut,0px)) * ${v.l/v.n})`;x.style.right='auto';x.style.width=`calc((100% - 6px - var(--gut,0px)) * ${(l1-v.l+1)/v.n} - ${l1<v.n-1?2:0}px)`};
  // a nested box (R-NST-02) sits inside its host's lanes, indented on the left by NI px (also in a single-lane column)
  const insetPos=(x,v)=>{const l1=v.l1??v.l,w='(100% - 6px - var(--gut,0px))';if(v.n>1)x.dataset.lane=(l1>v.l?v.l+'-'+l1:v.l)+'/'+v.n;x.style.left=`calc(3px + ${w} * ${v.l/v.n} + ${NI}px)`;x.style.right='auto';x.style.width=`calc(${w} * ${(l1-v.l+1)/v.n} - ${(l1<v.n-1?2:0)+NI}px)`};
  const lipK=new Map();   // the lip of each group of identical phases, for its bands (R-PHS-10)
  const phByCol=cols.map(({w,d:di})=>vsel?state.S.phases.filter(phVis).flatMap(p=>p.slots.map((s,i)=>({p,s,i,key:p.id+'|'+s.start+'|'+s.end})).filter(x=>x.s.day===di&&inWk(p,x.s,{p:0,day:di},w))):[]);   // the column's week's phases (R-CYC-16)
  try{cols.forEach(({w,d:di},k)=>{
    state.curWk=w;   // everything drawn in this column belongs to its week (R-CYC-19)
    const dw=el('div','dw'+(wks(k)?' wks':''),g);dw.dataset.d=di;if(state.allWk)dw.dataset.w=w;
    const ln=el('div','lane',dw);ln.style.height=hrs*state.HH+'px';
    const col=el('div','day',dw);col.style.height=hrs*state.HH+'px';col.dataset.d=di;if(state.allWk)col.dataset.w=w;
    phByCol[k].forEach(x=>{
      const {p,s,i}=x;if(s.end<=a*60||s.start>=Z)return;
      const st=Math.max(s.start,a*60),top=(st-a*60)/60*state.HH,h=(Math.min(s.end,Z)-st)/60*state.HH,wn=wkNote(p,s),range=fmt(s.start)+'–'+fmtEnd(s.end)+(wn?' · '+wn:'');
      const bx=el('div','phx',col);bx.style.top=top+'px';bx.style.height=h+'px';
      const bg=el('div','phbg',bx);bg.style.background=p.color;bg.style.opacity=state.S.phaseOpacity;
      if(state.editMode==='phases'){
        bx.style.outline='2px dashed '+p.color;bx.style.outlineOffset='-2px';
        if(state.selK&&state.selK.id===p.id&&state.selK.i===i)bx.classList.add('sel');
        el('span','pl',bx).textContent=p.title+' · '+range;
        const rz=s.end<=Z?el('div','rz ph',col):null;bx.title=p.title+'\n'+range+(p.desc?'\n'+p.desc:'');if(rz){rz.style.top=top+h+'px';bx._rz=rz;rz.title=bx.title}   // an end past the hours shown has no handle
        bx.onpointerdown=ev=>{if(ev.button)return;ev.stopPropagation();const md=ev.target===rz?'resize':'move';press(ev,e2=>grab(e2,{e:p,s,i,piece:0},md),p2=>tapOpen(p2,p))};if(rz)rz.onpointerdown=bx.onpointerdown;
      }
      if(!(k>0&&phByCol[k-1].some(y=>y.key===x.key))){
        let n=1;while(k+n<cols.length&&phByCol[k+n].some(y=>y.key===x.key))n++;
        const lp=el('div','lip'+(h<12?' s0':''),ln);lp.style.cssText=`top:${top}px;height:${h}px;background:${esc(p.color)};color:${ink(p.color)}`;lipK.set(x.key,lp);   // too short for any text: none (R-PHS-10)
        el('span','',lp).textContent=p.title;
        lp.title=p.title+'\n'+(n>1?DAYS[di].slice(0,3)+'–'+DAYS[cols[k+n-1].d].slice(0,3)+' ':'')+range+(p.desc?'\n'+p.desc:'');
        lp.onpointerdown=ev=>{if(state.editMode==='phases'&&!ev.button){ev.stopPropagation();press(ev,e2=>grab(e2,{e:p,s,i,piece:0},'move'),p2=>tapOpen(p2,p))}};
      }else{
        const lb=el('div','lbg',ln);lb.style.top=top+'px';lb.style.height=h+'px';lb.style.background=p.color;lb.style.opacity=state.S.phaseOpacity;lb.dataset.title=p.title;lb.dataset.col=p.color;lb._lip=lipK.get(x.key);
      }
    });
    el('div','gl',col);
    col.onpointerdown=ev=>{if(ev.button===0&&ev.target===col){atCol(col);if(state.selK){state.selK=null;qa('.ev.sel').forEach(x=>x.classList.remove('sel'))}press(ev,e2=>startCreate(e2,di,col),null)}};
    col.oncontextmenu=ev=>{ev.preventDefault();if(lastPtrType==='touch')return;atCol(col);const its=piecesAt(di,minAt(col,ev.clientY),true,fxAt(col,ev.clientX));
      if(its.length)overlapMenu(ev.clientX,ev.clientY,its,openCopy,L('ctxCopy'))};
    col.onpointermove=ev=>{atCol(col);peekMove(ev,di,col)};col.onpointerleave=hidePeek;
    // cs/ce = the visible core of the piece (R-EVT-15): lanes and stripes only look at cores; a piece that is all margin has an empty core
    const bgs=[],evs=state.S.events.filter(visible).flatMap(e=>e.slots.flatMap(s=>piecesOf(s).filter(q=>q.day===di&&q.b>a*60&&q.a<Z&&inWk(e,s,q)&&slotVisible(e,s)).map(q=>{const [c0,c1]=coreIn(s,q),cs=Math.min(Math.max(c0,a*60),Z),ce=Math.min(c1,Z);
      return {e,s,piece:q.p,cont:s.end>1440,start:q.a,end:q.b,c0,c1,cs,ce:ce>cs?ce:cs,color:colOf(e,s),op:evOp(e)}}))).filter(it=>!isBg(it.e,it.s)||!bgs.push(it));
    // strips (R-EVT-17): packed into sub-lanes by their whole window; the gutter is reserved only when the column has any
    const sl=[],SW=14;bgs.forEach(it=>{let k=sl.findIndex(ln=>ln.every(x=>x.end<=Math.max(it.start,a*60)||Math.max(x.start,a*60)>=it.end));if(k<0){k=sl.length;sl.push([])}sl[k].push(it);it.k=k});
    const gut=sl.length*(SW+2);gutMap[gk(di)]=gut;if(gut)col.style.setProperty('--gut',gut+'px');
    // nested pieces (R-NST-01) are drawn inside their host and take no part in lanes or stripes
    const nst=nestPick(evs),flat=evs.filter(it=>!nst.has(it));nst.forEach((h,x)=>nestMap.set(gk(nkey(x.e,x.s,x.piece)),{x,h}));
    // "around these times" with no minute left counts as a core over its whole window (R-EVT-12)
    flat.forEach(it=>{const ts=sqOf(it.e,it.s,it.piece,state.curWk,sqc);if(!ts)return;it.sq=ts;it.c0=it.start;it.c1=it.end;it.cs=Math.max(it.start,a*60);it.ce=Math.min(it.end,Z);sqMap.add(gk(nkey(it.e,it.s,it.piece)))});
    const aws=bgs.filter(it=>isAway(it.e)),awc=new Map();if(aws.length)evs.forEach(it=>{const h=awayHits(it,aws);if(h.length)awc.set(it,h)});   // Away clashes (R-EVT-24)
    // lanes look at whole windows, margins included (R-EVT-15): another person's occurrence goes beside a margin, never over it; occurrences that
    // clash share a lane, where a core covers the margins and stripes only mark core on core
    const lay=(state.prefs.lanesFix?fixedLayout:laneLayout)(flat.map(it=>({...it,start:Math.max(it.start,a*60),src:it}))),lv=new Map([...lay].map(([k,v])=>[k.src,v]));
    const px=m=>(Math.min(m,Z)-a*60)/60*state.HH,mgEls=[];   // cut at the last hour shown like the first (R-GRID-02); margins are inserted below every core box once the column is drawn (later-starting on top)
    [...flat,...nst.keys()].forEach(it=>{   // nested boxes last, so they lie above their host
      const hst=nst.get(it),v0=lv.get(hst||it),sg=v0.segs;
      // fixed lanes (R-EVT-23): a box for each run of neighbouring lanes; a nested box sits in the host's box that holds its person's lane
      const vs=!sg?[v0]:hst?[(q=>({...v0,l:q[0],l1:q[1]}))(sg.find(([x,y])=>{const k=v0.ids.indexOf(it.s.person);return x<=k&&k<=y})||sg[0])]:sg.map(([x,y])=>({...v0,l:x,l1:y}));
      laneMap.set(gk(it.e.id+'|'+it.e.slots.indexOf(it.s)+'|'+it.piece),hst?['n',vs[0].l,vs[0].l1??vs[0].l,v0.n]:vs.length>1?['m',sg,v0.n]:[vs[0].l,vs[0].l1,v0.n]);
      vs.forEach(v=>drawBox(it,hst,v));
    });
    function drawBox(it,hst,v){
      const e=it.e,s=it.s,pos=hst?insetPos:lanePos,core=it.ce>it.cs,vs0=Math.max(it.start,a*60),lk=isLocked(e),aw=awc.get(it)||[],warn=ovOf(e).has(s)||aw.length>0||!!it.sq,ty=tyOf(e);
      const d=el('div','ev'+(hst?' nest':''),col);pos(d,v);d._it=it;fitList.push(d);
      const mgs=core?[['t',vs0,it.cs],['b',it.ce,Math.min(it.end,Z)]].filter(([,x,y])=>y>x).map(([k,x,y])=>{const m=el('div','mg '+k+(hst?' nest':''),col);pos(m,v);m.style.top=px(x)+'px';m.style.height=px(y)-px(x)+'px';
        m.style.setProperty('--c',it.color);m.style.opacity=it.op;if(ty&&ty.soft)m.classList.add('soft');if(lk)m.classList.add('locked');mgEls.push([x,m]);return [k,m]}):[];
      const mt=mgs.find(x=>x[0]==='t'),mb=mgs.find(x=>x[0]==='b');
      if(core){d.style.top=px(it.cs)+'px';d.style.height=Math.max(14,px(it.ce)-px(it.cs)-(mb?0:1))+'px'}
      else{d.classList.add('mgo');mgEls.push([vs0,d]);d.style.top=px(vs0)+'px';d.style.height=Math.max(14,px(it.end)-px(vs0)-1)+'px'}
      if(s.flex)d.classList.add('mgo');   // "around these times" looks like a margin (R-EVT-12); squeezed out, it is drawn among the cores
      // rounded outer corners only; a piece that continues past midnight has a flat edge there
      const rT=it.cont&&it.piece?0:8,rB=it.cont&&!it.piece?0:8,rad=(x,t,b)=>{x.style.borderRadius=`${t}px ${t}px ${b}px ${b}px`};
      rad(d,mt?0:rT,mb?0:rB);if(mt)rad(mt[1],rT,0);if(mb)rad(mb[1],0,rB);
      d.style.background=it.color;d.style.opacity=it.op;if(lk)d.classList.add('locked');if(state.prefs.hlNoType&&!ty)d.classList.add('noty');   // Tools: untyped events pulse (R-UI-11)
      d.style.setProperty('--c',it.color);if(ty&&ty.soft)d.classList.add('soft');if(state.selK&&e.id===state.selK.id&&state.selK.i===e.slots.indexOf(s))d.classList.add('sel');
      const fl=[];if(ty)fl.push(tIcon(ty.icon));if(e.slots.length>1)fl.push(ICON_REPEAT);if(warn)fl.push('<b style="color:#ffd23f;display:flex">'+ICON_WARN+'</b>');if(lk)fl.push(ICON_LOCK);
      if(fl.length){const f=el('span','flags',d);f.innerHTML=fl.map(x=>x.startsWith('<b')?x:'<span>'+x+'</span>').join('')}
      const r1=el('div','r1',d);if(fl.length)r1.style.paddingRight=`calc(${fl.length*16}px * var(--ts,1))`;   // room for the status icons, which grow with the text size
      const tt=el('span','t',r1);tt.innerHTML=(s.person?pIc(s.person):'')+esc(e.title);
      const timeTxt=it.piece?L('contFrom',{d:DAYS[s.day].slice(0,3),t:fmt(s.start)})+' · '+L('contUntil',{t:fmt(s.end)}):fmt(s.start)+'–'+fmtEnd(s.end);
      el('span','tm',r1).textContent=timeTxt;
      const by=s.person?pname(s.person):'',invTags=invOf(e,s).map(pTag).filter(Boolean),invNames=invOf(e,s).map(pname).filter(Boolean);
      if(by||invTags.length){const r2=el('div','r2',d);if(by)el('span','by',r2).textContent=L('byl')+' '+by;if(invTags.length){const wi=el('span','wi',r2);wi.innerHTML=esc(L(e.oncall?'oncl':'withl'))+' '+invTags.join(', ')}}
      if(e.desc&&descOn(state.curId))el('div','ds',d).textContent=e.desc;   // Show descriptions (R-EVT-25): the last row, dropped first
      const info=[e.title,timeTxt];if(by)info.push(L('byl')+' '+by);if(invNames.length)info.push(L(e.oncall?'oncl':'withl')+' '+invNames.join(', '));if(e.owner)info.push(L('ownl')+' '+pname(e.owner));
      if(ty)info.push(ty.name);if(s.flex)info.push(L('flexNote'));if(s.fs||s.fe)info.push(edgeNote(s));
      if(hst)info.push(L('nestDur',{t:hst.e.title}));if(wkNote(e,s))info.push(wkNote(e,s));aw.forEach(x=>info.push(awayLine(x)));if(it.sq)info.push(sqLine(it.sq));if(e.desc)info.push(e.desc);if(ovOf(e).has(s))info.push('⚠ '+L('ovTip'));
      // stripes where an Away strip of its people meets it, in its own lanes: its colour and the Away colour (R-EVT-24)
      aw.forEach(x=>{const p=Math.max(it.cs,x.c0,a*60),q=Math.min(it.ce,x.c1);if(q<=p)return;const o=el('div','ov awov',col);pos(o,v);o.style.top=px(p)+'px';o.style.height=px(q)-px(p)-1+'px';
        let c2=normHex(x.color)||x.color;if(c2===(normHex(it.color)||it.color))c2=shiftColor(c2,[c2]);o.style.background=`repeating-linear-gradient(45deg,${it.color} 0 7px,${c2} 7px 14px)`;o.style.opacity=.85*Math.max(it.op,x.op)});
      d.setAttribute('aria-label',info.join(', '));
      const rz=(!it.cont||it.piece)&&it.end<=Z&&!lk&&state.editMode==='events'?el('div','rz',col):null;
      if(rz){rz.style.top=(mb||!core?px(it.end):parseFloat(d.style.top)+parseFloat(d.style.height))+'px';pos(rz,v);d._rz=rz}
      // the core's own edges, where a margin is beside them: dragging one changes that margin (R-EVT-15); each at most half the core, so both fit
      const eh=[];if(core&&!lk&&state.editMode==='events')[['fs',it.cs,it.cs===it.c0],['fe',it.ce,it.ce===it.c1]].forEach(([k,y,whole])=>{if(!whole||coreEdge(s,{p:it.piece,a:it.start,b:it.end},k)!==y)return;
        const h=el('div','rz '+(k==='fs'?'cs':'ce'),col);h.style.top=px(y)+'px';h.style.maxHeight=(px(it.ce)-px(it.cs))/2+'px';pos(h,v);h.title=h.__t=L(k==='fs'?'csTip':'ceTip');h._k=k;d['_'+(k==='fs'?'cs':'ce')]=h;eh.push(h)});
      if(!lk&&state.editMode==='events')d.onpointerdown=ev=>{if(ev.button)return;ev.stopPropagation();const md=rz&&rz===ev.target?'resize':ev.target._k&&eh.includes(ev.target)?ev.target._k:'move';press(ev,e2=>grab(e2,it,md),p2=>tapOpen(p2,e))};
      if(rz)rz.onpointerdown=d.onpointerdown;eh.forEach(h=>{h.onpointerdown=d.onpointerdown});
      mgs.forEach(([,m])=>{m.onpointerdown=d.onpointerdown;m._ev=d});d._mg=mgs.map(x=>x[1]);
    }
    bgs.forEach(it=>{
      const e=it.e,s=it.s,lk=isLocked(e),ty=tyOf(e),top=Math.max(it.start,a*60),r0=it.k*(SW+2),d=el('div','bgs',col);d._it=it;   // flush with the right edge, shaped like a lip (R-EVT-17)
      laneMap.set(gk(e.id+'|'+e.slots.indexOf(s)+'|'+it.piece),['s',r0,r0+SW+2]);d.dataset.strip=it.k+'/'+sl.length;   // sub-lanes tile the gutter: [k*16, (k+1)*16) px from the right edge
      d.style.cssText=`top:${px(top)}px;height:${Math.max(6,px(it.end)-px(top)-1)}px;right:${r0}px;opacity:${it.op}`;d.style.setProperty('--c',it.color);
      const lb=el('span','',d);lb.textContent=e.title;d.style.color=ink(it.color);   // the title reads top-to-bottom
      const awy=isAway(e);if(awy){const k=ink(it.color);d.classList.add('aw');d.style.background=`repeating-linear-gradient(45deg,${it.color} 0 5px,color-mix(in srgb,${it.color} 70%,${k==='#000'?'#fff':'#000'}) 5px 9px)`}   // Away: hatched (R-EVT-24)
      if(awy){/* Away keeps its hatch: no flexible or core shading */}else if(s.flex){d.classList.add('flex');d.style.color='var(--fg)'}else if(it.ce>it.cs&&(it.cs>top||it.ce<Math.min(it.end,Z))){const t=`color-mix(in srgb,${it.color} 40%,transparent)`,c0=px(it.cs)-px(top),c1=px(it.ce)-px(top);d.style.background=`linear-gradient(${t} 0 ${c0}px,${it.color} ${c0}px ${c1}px,${t} ${c1}px)`;
        if(c0>0)lb.style.paddingTop=c0+3+'px'}   // the text starts where the solid core starts
      else if(it.ce<=it.cs){d.style.background=`color-mix(in srgb,${it.color} 40%,transparent)`;d.style.color='var(--fg)'}
      if(it.cont)d.style.borderRadius=it.piece?'0 0 6px 0':'0 6px 0 0';
      // the band: the strip's colour fading leftwards across the column, under the hour lines and every box; purely visual (only the lip takes the pointer)
      const bb=el('div','bgb');bb.style.cssText=`top:${d.style.top};height:${d.style.height};right:${r0+SW}px;opacity:${it.op*(s.flex?.5:it.ce<=it.cs?.45:1)}`;bb.style.setProperty('--c',it.color);
      if(!s.flex&&it.ce>it.cs&&(it.cs>top||it.ce<Math.min(it.end,Z))){const c0=px(it.cs)-px(top),c1=px(it.ce)-px(top),mk=`linear-gradient(#00000073 0 ${c0}px,#000 ${c0}px ${c1}px,#00000073 ${c1}px)`;bb.style.maskImage=mk;bb.style.webkitMaskImage=mk}
      if(!awy){col.insertBefore(bb,col.querySelector('.gl'));d._bb=bb}   // no band for Away: it would say the whole household is away
      if(awy&&state.prefs.lanesFix){const ids=fixIds(),n=Math.max(1,ids.length);awayPpl(e,s).forEach(p=>{const k=ids.indexOf(p);if(k<0)return;const h=el('div','awl');lanePos(h,{l:k,l1:k,n});if(n<2){h.style.left='3px';h.style.right='calc(3px + var(--gut,0px))'}
        h.style.top=d.style.top;h.style.height=d.style.height;h.style.setProperty('--c',it.color);col.insertBefore(h,col.querySelector('.gl'))})}   // fixed lanes: the away person's lane is hatched
      if(lk)d.classList.add('locked');if(state.prefs.hlNoType&&!ty)d.classList.add('noty');if(state.selK&&e.id===state.selK.id&&state.selK.i===e.slots.indexOf(s))d.classList.add('sel');
      const info=[e.title,it.piece?L('contFrom',{d:DAYS[s.day].slice(0,3),t:fmt(s.start)})+' · '+L('contUntil',{t:fmt(s.end)}):fmt(s.start)+'–'+fmtEnd(s.end),...(s.person?[L('byl')+' '+pname(s.person)+(isExt(s.person)?' ('+L('extSuf')+')':'')]:[])];
      const invNames=invOf(e,s).map(pname).filter(Boolean);if(invNames.length)info.push(L(e.oncall?'oncl':'withl')+' '+invNames.join(', '));if(e.owner)info.push(L('ownl')+' '+pname(e.owner));if(e.bg)info.push(L('bgNote'));if(awy)info.push(L('awNote'));if(ty)info.push(ty.name);if(s.flex)info.push(L('flexNote'));if(s.fs||s.fe)info.push(edgeNote(s));if(wkNote(e,s))info.push(wkNote(e,s));
      d.setAttribute('aria-label',info.join(', '));
      const rz=(!it.cont||it.piece)&&it.end<=Z&&!lk&&state.editMode==='events'?el('div','rz',col):null;
      if(rz){rz.style.cssText=`top:${px(it.end)}px;left:auto;right:${r0}px;width:${SW}px`;d._rz=rz}
      if(!lk&&state.editMode==='events')d.onpointerdown=ev=>{if(ev.button)return;ev.stopPropagation();const md=rz&&rz===ev.target?'resize':'move';press(ev,e2=>grab(e2,it,md),p2=>tapOpen(p2,e))};
      if(rz)rz.onpointerdown=d.onpointerdown;
    });
    {const set=new Set(mgEls.map(x=>x[1]));let ref=col.querySelector('.gl').nextSibling;while(ref&&set.has(ref))ref=ref.nextSibling;mgEls.sort((x,y)=>x[0]-y[0]).forEach(([,m])=>col.insertBefore(m,ref))}
    // stripes: per group and lane, where at least two occurrences of that lane overlap; identical neighbouring lanes are joined
    const byG=new Map();flat.forEach(it=>{const v=lv.get(it);if(!byG.has(v.g))byG.set(v.g,[]);byG.get(v.g).push(it)});
    byG.forEach(mem=>{const N=lv.get(mem[0]).n,segs=new Map(),all=[];
      for(let k=0;k<N;k++){
        const bev=mem.filter(it=>{const v=lv.get(it);return (v.segs?v.segs.some(([x,y])=>x<=k&&k<=y):v.l<=k&&k<=v.l1)&&it.ce>it.cs}),pts=[...new Set(bev.flatMap(e=>[e.cs,e.ce]))].sort((x,y)=>x-y);
        for(let i=0;i<pts.length-1;i++){const p=pts[i],q=pts[i+1],cov=bev.filter(e=>e.cs<=p&&e.ce>=q);if(cov.length<2)continue;
          const key=p+'|'+q+'|'+cov.map(c=>evs.indexOf(c)).join(','),sg=segs.get(key);if(sg&&sg.l1===k-1)sg.l1=k;else{const ns={p,q,cov,l:k,l1:k};segs.set(key,ns);all.push(ns)}}
      }
      all.forEach(({p,q,cov,l,l1})=>{
        const o=el('div','ov',col);lanePos(o,{l,l1,n:N});
        o.style.top=(p-a*60)/60*state.HH+'px';o.style.height=(q-p)/60*state.HH-1+'px';
        const st=[],seen=[],w=7;
        cov.forEach((c,k)=>{let cc=normHex(c.color)||c.color;if(seen.includes(cc))cc=shiftColor(cc,seen);seen.push(cc);st.push(`${cc} ${k*w}px ${(k+1)*w}px`)});
        o.style.background=`repeating-linear-gradient(45deg,${st.join(',')})`;
        o.style.opacity=.85*Math.max(...cov.map(c=>c.op));
      });
    });
  })}finally{state.curWk=w0}
  fitAll(fitList);fitLips(g);
  drawNow();
  const hi=state.allWk?[...Array(cyc()).keys()].map(k=>withWk(k+1,hiddenInfo)).reduce((x,y)=>({wk:x.wk+y.wk,er:x.er+y.er,n:x.n+y.n}),{wk:0,er:0,n:0}):hiddenInfo(),hb=$('hid');hb._hrs=hi.er>0;hb.style.display=hi.n&&!lvOn?'':'none';hb.textContent=L('hidN',{n:hi.n});   // never in live view
  hb.title=[hi.wk&&L('hidWk',{n:hi.wk}),hi.er&&L('hidEr',{n:hi.er}),L(hi.er?'hidClickH':'hidClick')].filter(Boolean).join('\n');
  updLive();if(lvOn){lvRects.length=0;lvOpen.slice().forEach(o=>lvDraw(o,false));if(!state.livePaused&&!liveBusy())liveScroll()}
  if(!state.printMode)updZoomUI();
}
/* ---------- pointer interactions ---------- */
function colAt(x){const cs=[...document.querySelectorAll('.day')];let c=cs.find(c=>x<c.getBoundingClientRect().right)||cs[cs.length-1];atCol(c);return c}
const atCol=c=>{if(state.allWk&&c&&c.dataset.w)state.curWk=+c.dataset.w};   // with every week side by side the column under the pointer is the week (R-CYC-19)
export const minAt=(c,y)=>hrA()*60+(y-c.getBoundingClientRect().top)/state.HH*60;
const snapM=m=>Math.round(m/SNAP)*SNAP;
const rzMin=()=>((window.matchMedia&&matchMedia('(pointer:coarse)').matches)?16:7)/state.HH*60+1;
/* touch: scroll natively; long-press (0.4 s) starts create / move / resize; tap opens */
let touchDrag=false,lastPtrType='mouse';
document.addEventListener('touchmove',e=>{if(touchDrag&&e.cancelable)e.preventDefault()},{passive:false});
document.addEventListener('pointerdown',e=>{lastPtrType=e.pointerType},true);
['pointerup','pointercancel'].forEach(k=>document.addEventListener(k,()=>{touchDrag=false},true));
function press(ev,onStart,onTap){
  if(ev.pointerType!=='touch'){onStart(ev);return}
  const x0=ev.clientX,y0=ev.clientY;let last={x:x0,y:y0};
  const off=()=>{clearTimeout(tm);document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',off)};
  const tm=setTimeout(()=>{off();touchDrag=true;try{document.body.setPointerCapture(ev.pointerId)}catch(_){}   // keep receiving this finger's pointer events after the grid is redrawn
    // Touch events keep going to the element the finger started on even after a redraw removes it from the page, so the
    // listener that blocks scrolling during the drag must sit on that element itself (a document listener would miss them and the browser would start scrolling).
    const tgt=ev.target;if(tgt&&tgt.addEventListener){const stop=e=>{if(e.cancelable)e.preventDefault()},end=()=>{tgt.removeEventListener('touchmove',stop);document.removeEventListener('pointerup',end,true);document.removeEventListener('pointercancel',end,true)};tgt.addEventListener('touchmove',stop,{passive:false});document.addEventListener('pointerup',end,true);document.addEventListener('pointercancel',end,true)}
    if(navigator.vibrate)navigator.vibrate(12);onStart({clientX:last.x,clientY:last.y,shiftKey:false,pointerType:'touch',preventDefault(){},stopPropagation(){}})},400);
  const mv=p=>{last={x:p.clientX,y:p.clientY};if(Math.hypot(p.clientX-x0,p.clientY-y0)>8)off()};
  const up=p=>{off();if(onTap)onTap(p)};
  document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',off);
}
// swipe between days in the day view on a touch screen (R-UI-13): a quick sideways swipe (moving within the long-press time,
// more than 60 px and over twice as far sideways as up or down), not starting at a screen edge (the browser's back gesture)
{let sw=null;
 document.addEventListener('pointerdown',e=>{sw=null;if(e.pointerType!=='touch'||state.focusD==null||state.live||!(e.target.closest&&e.target.closest('#grid')))return;
   if(e.clientX<24||e.clientX>innerWidth-24)return;sw={x:e.clientX,y:e.clientY,t:Date.now(),go:false}},true);
 document.addEventListener('pointermove',e=>{if(!sw||sw.go!==false)return;if(Math.hypot(e.clientX-sw.x,e.clientY-sw.y)>8)sw.go=Date.now()-sw.t<400?true:null},true);   // null: a long press took it
 document.addEventListener('pointercancel',()=>{sw=null},true);
 document.addEventListener('pointerup',e=>{const w=sw;sw=null;if(!w||!w.go||state.focusD==null||state.live)return;const dx=e.clientX-w.x,dy=e.clientY-w.y;
   if(Math.abs(dx)>60&&Math.abs(dx)>2*Math.abs(dy))stepFocus(dx<0?1:-1)},true)}
function tapOpen(p,owner){
  const col=colAt(p.clientX),di=+col.dataset.d,items=itemsAt(di,minAt(col,p.clientY),fxAt(col,p.clientX));
  if(new Set(items.map(i=>i.e)).size>1)overlapMenu(p.clientX,p.clientY,items);else openDlg(owner,null,(items.find(i=>i.e===owner)||{}).s);
}
/* event box: render only the rows that fit completely, mark clipped content */
// Clipping is measured for every box first and applied afterwards: reading the layout after a change forces a new layout,
// which made drawing a crowded week slow down with every box (R-EVT-05).
// A title cut short while the time range shares its row: the time moves to the start of row 2, so the title gets the whole row
// (R-EVT-03); the boxes that moved one are measured again, all together.
function fitMeasure(d){
  const H=d.clientHeight;if(!H)return null;
  const r2=d.querySelector('.r2'),t=d.querySelector('.r1 .t'),title=!!t&&t.scrollWidth>t.clientWidth+1,drop=!!r2&&r2.offsetTop+r2.offsetHeight>H-4;
  // the description gets the whole lines that fit under the rows above it, or is dropped, as it is in a box too narrow to read it (about 8 characters wide; R-EVT-25)
  const ds=d.querySelector('.ds');let dl=null;if(ds){const cs=getComputedStyle(ds),fs=parseFloat(cs.fontSize)||12,lh=(/px$/.test(cs.lineHeight)?parseFloat(cs.lineHeight):fs*(parseFloat(cs.lineHeight)||1.25))||15,n=drop||d.clientWidth<8*fs?0:Math.floor((H-4-ds.offsetTop)/lh);dl=n<1?0:ds.scrollHeight>n*lh+1?n*lh:-1}
  return {drop,title,mv:title&&!!d.querySelector('.r1 .tm'),dl};
}
function fitMove(d,m){
  if(!m||!m.mv)return;
  const tm=d.querySelector('.r1 .tm');let r2=d.querySelector('.r2');if(!r2){r2=document.createElement('div');r2.className='r2';d.querySelector('.r1').after(r2)}
  r2.prepend(tm);
}
function fitApply(d,m){
  if(!m)return;
  if(m.drop)d.querySelector('.r2').remove();
  const ds=m.dl!=null&&d.querySelector('.ds');if(ds){if(!m.dl)ds.remove();else if(m.dl>0)ds.style.maxHeight=m.dl+'px'}   // -1: it fits whole
  if(m.drop||m.title||(ds&&m.dl>=0)){d.classList.add('clipped');el('span','clipm',d).textContent='⋯'}
}
function fitAll(list){
  const m1=list.map(fitMeasure);list.forEach((d,i)=>fitMove(d,m1[i]));
  const m2=list.map((d,i)=>m1[i]&&m1[i].mv?fitMeasure(d):m1[i]);list.forEach((d,i)=>fitApply(d,m2[i]));
}
export function fitBox(d){fitAll([d])}   // one box at a time: only tests/e2e/perf.spec.js uses it, to compare with fitAll
// lip text that does not fit its phase gets smaller, 8 px and then 7 px, before it is cut short (R-PHS-10); every lip is measured before any of them changes
function fitLips(g){
  let ls=[...g.querySelectorAll('.lip:not(.s0)')];
  for(const c of ['s1','s2']){ls=ls.filter(l=>{const sp=l.firstElementChild;return sp&&sp.scrollHeight>sp.clientHeight+1});ls.forEach(l=>l.classList.add(c))}
  g.querySelectorAll('.lbg').forEach(b=>{if(b._lip)b.dataset.fs=['s0','s1','s2'].filter(c=>b._lip.classList.contains(c)).join(' ')});   // a printed day view draws its lip from the band
}
/* hover peek card (mouse only) */
let peekT=null,peekKey='';
function hidePeek(){clearTimeout(peekT);peekKey='';const p=$('peek');if(p)p.style.display='none'}
export function peekRows({e,s,piece},lv){   // the hover card's lines; lv = a live card (R-GRID-12): no schedules, warnings or how-to lines
    const time=piece?L('contFrom',{d:DAYS[s.day].slice(0,3),t:fmt(s.start)})+' · '+L('contUntil',{t:fmt(s.end)}):fmt(s.start)+'–'+fmtEnd(s.end);
    const inv=invOf(e,s).map(pTag).filter(Boolean),rows=[`<div class="pt1"><i style="background:${esc(colOf(e,s))}"></i>${s.person?pIc(s.person):''}${esc(e.title)}</div>`,`<div>${esc(time)}</div>`];
    if(wkNote(e,s))rows.push(`<div>${wkNoteH(e,s)}</div>`);
    const ty=tyOf(e);if(ty)rows.push(`<div>${tyTag(ty)}</div>`);if(e.bg)rows.push(`<div>${esc(L('bgNote'))}</div>`);if(isAway(e))rows.push(`<div>${esc(L('awNote'))}</div>`);
    awayOf(e,s,{p:piece||0,day:piece?(s.day+1)%7:s.day,a:piece?0:s.start,b:piece?s.end-1440:Math.min(s.end,1440)}).forEach(x=>rows.push(`<div>⚠ ${esc(awayLine(x))}</div>`));const sq=sqOf(e,s,piece||0);if(sq)rows.push(`<div>⚠ ${esc(sqLine(sq))}</div>`);if(s.flex)rows.push(`<div>${esc(L('flexNote'))}</div>`);if(s.fs||s.fe)rows.push(`<div>${esc(edgeNote(s))}</div>`);
    if(s.person)rows.push(`<div>${esc(L('byl'))} ${esc(pname(s.person))}</div>`);
    if(inv.length)rows.push(`<div>${esc(L(e.oncall?'oncl':'withl'))} ${inv.join(', ')}</div>`);
    if(e.owner)rows.push(`<div>${esc(L('ownl'))} ${pTag(e.owner)}</div>`);
    {const k=gk(nkey(e,s,piece||0)),nh=nestMap.get(k),ins=[...nestMap].filter(([x,v])=>x.startsWith(state.curWk+'#')&&v.h.e===e&&v.h.s===s&&v.h.piece===(piece||0)).map(([,v])=>v);   // nested activities (R-NST-02)
     if(nh)rows.push(`<div>${esc(L('nestDur',{t:nh.h.e.title}))}</div>`);
     if(ins.length)rows.push(`<div>${esc(L('nestAlso'))} ${ins.map(v=>esc(v.x.e.title+' '+fmt(v.x.s.start)+'–'+fmtEnd(v.x.s.end))).join(', ')}</div>`)}
    if(e.desc)rows.push(`<div style="white-space:pre-wrap;margin-top:4px">${esc(e.desc)}</div>`);
    if(lv)return rows.join('');
    rows.push(`<div class="mut" style="margin-top:4px">${esc(L('schl'))} ${e.schedules.map(id=>state.S.schedules.find(x=>x.id===id)).filter(Boolean).map(sTag).join(', ')}</div>`);
    if(overlapSet(e).has(s))rows.push(`<div>⚠ ${esc(L('ovTip'))}</div>`);
    if(isLocked(e))rows.push(`<div><span class="ic">${ICON_LOCK}</span>${esc(L('lockedNote'))}</div>`);
    if(e.slots.length>1)rows.push(`<div class="how">${esc(L('repTip'))}</div>`);
    return rows.join('');
}
function peekHTML(items){
  return items.slice(-3).reverse().map(it=>`<div class="pk">${peekRows(it)}</div>`).join('<hr>');
}
function showPeek(items,x,y){
  const p=$('peek');p.innerHTML=peekHTML(items);p.style.display='block';
  p.style.left=Math.max(8,Math.min(x+14,innerWidth-p.offsetWidth-8))+'px';p.style.top=Math.max(8,Math.min(y+16,innerHeight-p.offsetHeight-8))+'px';
}
function peekMove(ev,di,col){
  if(ev.pointerType!=='mouse'||ev.buttons||state.editMode!=='events')return hidePeek();
  const its=piecesAt(di,minAt(col,ev.clientY),true,fxAt(col,ev.clientX)),key=its.map(i=>i.e.id+':'+i.i).join();
  if(key===peekKey)return;
  hidePeek();peekKey=key;if(!its.length)return;
  const x=ev.clientX,y=ev.clientY;peekT=setTimeout(()=>showPeek(its,x,y),350);
}
/* zoom: grid scale and grid text size (R-GRID-07) */
// the size a Fit box produced: the drawn row height, or the drawn width of a week's day column (without the lip lane); clamped to its slider
export function fitted(k){const v=k.startsWith('rowH')?state.HH:state.focusD==null&&Math.round($('grid').querySelector('.day')?.getBoundingClientRect().width||0)||state.prefs[WK()];   // a focused day is not a week column
return k.startsWith('rowH')?Math.min(120,Math.max(24,v)):Math.min(1000,Math.max(70,v))}
export function updZoomUI(){document.querySelectorAll('#sbin .zrow input[data-z]').forEach(i=>{if(!i.disabled)return;const k=i.dataset.z,h=k.startsWith('rowH'),v=h?state.HH:fitted(k);i.value=v;i.nextElementSibling.textContent=v+(h?' px/h':' px')})}
export function zoomRender(){
  const w=$('wrap'),hrs=(w.scrollTop+w.clientHeight/2)/state.HH,fx=(w.scrollLeft+w.clientWidth/2)/Math.max(1,w.scrollWidth);
  state.skipSide=true;render();state.skipSide=false;
  w.scrollTop=hrs*state.HH-w.clientHeight/2;w.scrollLeft=fx*w.scrollWidth-w.clientWidth/2;if(state.live&&!state.livePaused)liveScroll();
}
export function withPrintScale(fn){
  const w=$('wrap'),st=w.scrollTop,sl=w.scrollLeft;state.printMode=true;state.skipSide=true;
  try{render();return fn()}finally{state.printMode=false;render();state.skipSide=false;w.scrollTop=st;w.scrollLeft=sl}
}
const handlesAt=(di,m,fx)=>nestFirst(act().filter(e=>eVis(e)&&!eLock(e)).flatMap(e=>e.slots.flatMap((s,i)=>piecesOf(s).filter(q=>q.day===di&&(q.p===1||s.end<=1440)&&q.b-rzMin()<=m&&m<q.b&&inWk(e,s,q)&&sVis(e,s)&&inLane(e,i,q.p,fx,di)).map(q=>({e,s,i,piece:q.p})))));
// the core edges under the pointer (R-EVT-15): k = 'fs' (the top of a core with a start margin) or 'fe' (the bottom of one with an end margin)
const edgesAt=(di,m,fx,k)=>nestFirst(act().filter(e=>eVis(e)&&!eLock(e)&&!e.rhythms).flatMap(e=>e.slots.flatMap((s,i)=>piecesOf(s).filter(q=>{if(q.day!==di||isBg(e,s)||!inWk(e,s,q)||!sVis(e,s)||!inLane(e,i,q.p,fx,di))return false;
  const x=coreEdge(s,q,k);return x!=null&&(k==='fs'?x<=m&&m<x+rzMin():x-rzMin()<=m&&m<x)}).map(q=>({e,s,i,piece:q.p})))));
// a long press released without moving (touch): the right-click list of what is under the finger, to copy it (R-TOUCH-02); false when nothing is there
function touchCopy(ev,x,y,di,m,fx){if(ev.pointerType!=='touch')return false;const its=piecesAt(di,m,true,fx);if(!its.length)return false;overlapMenu(x,y,its,openCopy,L('ctxCopy'));return true}
function grab(ev,it,mode){
  const col=colAt(ev.clientX),cDay=+col.dataset.d,m=minAt(col,ev.clientY),fx=fxAt(col,ev.clientX);
  const cands=mode==='resize'?handlesAt(cDay,m,fx):mode==='fs'||mode==='fe'?edgesAt(cDay,m,fx,mode):piecesAt(cDay,m,false,fx);
  const sel=state.selK&&cands.find(c=>c.e.id===state.selK.id&&c.i===state.selK.i);
  if(sel){startDrag(ev,sel,mode);return}
  if(cands.length>1){
    ev.preventDefault();const x0=ev.clientX,y0=ev.clientY;
    const off=()=>{document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up)};
    const mv=p=>{if(Math.hypot(p.clientX-x0,p.clientY-y0)<4)return;off();
      overlapMenu(p.clientX,p.clientY,cands,(e,it)=>{state.selK={id:e.id,i:it.i};render();toast(L('selHint',{t:e.title+' · '+DAYS[it.s.day].slice(0,3)+' '+fmt(it.s.start)+'–'+fmtEnd(it.s.end)}))},L(mode==='resize'?'pickResize':mode==='move'?'pickMove':'pickEdge'),false)};
    const up=p=>{off();if(touchCopy(ev,p.clientX,p.clientY,cDay,m,fx))return;const items=itemsAt(cDay,m,fx);if(new Set(items.map(i=>i.e)).size>1)overlapMenu(p.clientX,p.clientY,items);else if(items.length)openDlg(items[0].e,null,items[0].s)};
    document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up);return;
  }
  startDrag(ev,it,mode);
}
/* moving an activity carries the nested activities done during it (R-NST-03): each follows the shift of its own host repetition */
function nestCarry(owner){
  const out=[],seen=new Set();
  for(let w=1;w<=cyc();w++)for(let d=0;d<7;d++)nestPick(dayPieces(d,true,w)).forEach((h,x)=>{if(h.e!==owner||seen.has(x.s)||isLocked(x.e))return;seen.add(x.s);out.push({ev:x.e,s:x.s,o:{...x.s},hi:owner.slots.indexOf(h.s)})});
  return out;
}
function carryMove(cs,hs,ho,only){   // hs/ho: the host's slots now / before the drag; only: carry for that repetition alone
  cs.forEach(c=>Object.assign(c.s,c.o));
  const to=cs.map(c=>{if(only!=null&&c.hi!==only)return null;const h=hs[c.hi],o=ho[c.hi],dD=absD(h)-absD(o),dS=h.start-o.start;if(!dD&&!dS)return null;   // the host's shift, its week included
    const du=c.s.end-c.s.start,start=Math.max(0,Math.min(1425,2880-du,c.s.start+dS)),t={day:c.s.day,...(c.s.wk?{wk:c.s.wk}:{})};shiftDay(t,dD);return {...t,start,end:start+du}});
  const at=x=>{const k=cs.findIndex(c=>c.s===x);return k>=0&&to[k]?to[k]:x};
  cs.forEach((c,k)=>{if(to[k]&&(isAdv(c.ev.slots)||!c.ev.slots.some(x=>x!==c.s&&sameDay(at(x),to[k]))))Object.assign(c.s,to[k])});   // an event with at most one time per day keeps it that way
}
function startDrag(ev,it,mode){
  const e=it.s,owner=it.e,pc=it.piece||0,edge=mode==='fs'||mode==='fe';ev.preventDefault();state.MAXEND=owner.rhythms?1440:2880;
  const col=colAt(ev.clientX),cDay=+col.dataset.d,cW=state.curWk,cMin=minAt(col,ev.clientY),cFx=fxAt(col,ev.clientX),off=cMin+1440*pc-e.start,dur=e.end-e.start;
  const before=JSON.stringify(state.S),orig=owner.slots.map(x=>({...x})),idx=owner.slots.indexOf(e),o0={...e},nC=cycSl(orig).length,multi=nC>1,adv=isAdv(orig);   // nC: the times in the cycle's weeks; staged ones never move (R-CYC-22)
  const ovB=overlapSet(owner,orig).size,carry=mode==='move'&&!owner.rhythms?nestCarry(owner):[];
  let moved=false,single=false,final=null;const x0=ev.clientX,y0=ev.clientY;
  const mv=p=>{
    if(!moved&&Math.hypot(p.clientX-x0,p.clientY-y0)<4)return;moved=true;single=p.shiftKey;
    const c=colAt(p.clientX),m=minAt(c,p.clientY),cd=+c.dataset.d,t={day:o0.day,start:o0.start,end:o0.end};
    // with every week side by side a move can cross into another week: the shift is counted along the cycle (R-CYC-19)
    const aD=state.allWk&&mode==='move'?((state.curWk-cW)*7+cd-cDay):null;
    if(mode==='move'){t.day=(cd-pc+7)%7;t.start=Math.max(0,Math.min(1425,state.MAXEND-dur,snapM(m+1440*pc-off)));t.end=t.start+dur;
      if(aD!=null&&o0.wk){const x={day:o0.day,wk:o0.wk};shiftDay(x,aD);t.day=x.day;t.wk=x.wk}}
    else{let rel=(cd-o0.day+7)%7;rel=rel>1?(rel===6?0:1):rel;const x=snapM(m+1440*rel);if(edge)t.mg=setMg({...o0},mode,mode==='fs'?x-o0.start:o0.end-x)[mode]||0;else t.end=Math.max(o0.start+SNAP,Math.min(state.MAXEND,x))}
    owner.slots.forEach((s,i)=>Object.assign(s,orig[i]));
    // a core edge: the margin on that side; with all repetitions, each one that has that margin changes by the same minutes (R-EVT-15, R-REP-06)
    if(edge){if(!multi||single)setMg(e,mode,t.mg);else{const dM=t.mg-(o0[mode]||0);owner.slots.forEach((s,i)=>{if(orig[i][mode]&&!stgSl(s))setMg(s,mode,orig[i][mode]+dM)})}}
    else if(!multi||single){
      if(mode==='move'&&!adv&&owner.slots.some(x=>x!==e&&sameDay(x,{...e,...t})))Object.assign(t,{day:o0.day,...(o0.wk?{wk:o0.wk}:{})});
      Object.assign(e,t);if(!owner.rhythms)fitMg(e);
    }else{
      const dD=aD!=null?aD:t.day-o0.day,dS=t.start-o0.start,dE=t.end-o0.end;
      owner.slots.forEach(s=>{if(stgSl(s))return;
        if(mode==='move'){const du=s.end-s.start;shiftDay(s,dD);s.start=Math.max(0,Math.min(1425,state.MAXEND-du,s.start+dS));s.end=s.start+du}
        else{s.end=Math.max(s.start+SNAP,Math.min(state.MAXEND,s.end+dE));if(!owner.rhythms)fitMg(s)}
      });
    }
    carryMove(carry,owner.slots,orig);final=t;render();
  };
  const up=p=>{
    document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);
    if(!moved){if(touchCopy(ev,p.clientX,p.clientY,cDay,cMin,cFx))return;const items=itemsAt(cDay,cMin,cFx);if(new Set(items.map(i=>i.e)).size>1)overlapMenu(p.clientX,p.clientY,items);else openDlg(owner,null,it.s);return}
    const changed=JSON.stringify(state.S)!==before;if(changed)pushUndo(before);render();
    if(!changed)return;
    const warn=overlapSet(owner).size>ovB,mark=state.undoSt.length,fin={...final};
    const undoBtn={label:L('undo'),fn:()=>{if(state.undoSt.length===mark)undo()}};
    if(multi&&!single){
      toast(L('rpApplied',{n:nC})+(warn?' · ⚠ '+L('rpWarn'):''),[
        {label:L('rpOnly'),fn:()=>{
          if(state.undoSt.length!==mark||!act().includes(owner))return;
          owner.slots=orig.map(x=>({...x}));const s=owner.slots[idx];
          if(mode==='move'){if(adv||!owner.slots.some(x=>x!==s&&sameDay(x,{...s,...fin})))Object.assign(s,{day:fin.day,...(fin.wk?{wk:fin.wk}:{})});s.start=fin.start;s.end=fin.end}else if(edge)setMg(s,mode,fin.mg);else{s.end=fin.end;fitMg(s)}
          carryMove(carry,owner.slots,orig,idx);render()}},undoBtn]);
    }else if(warn)toast('⚠ '+L('rpWarn'),[undoBtn]);
  };
  document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up);
}
function overlapMenu(x,y,items,onPick=(e,it)=>openDlg(e,null,it.s),title=L('ovTitle'),group=true){
  if(group){const seen=new Set();items=items.filter(i=>!seen.has(i.e)&&seen.add(i.e))}
  document.querySelectorAll('.omenu').forEach(m=>m.remove());
  const m=el('div','omenu',document.body);el('div','oh',m).textContent=title;
  const close=()=>{m.remove();document.removeEventListener('pointerdown',out,true);document.removeEventListener('keydown',key,true)};
  const out=e=>{if(!m.contains(e.target))close()},key=e=>{if(e.key==='Escape')close()};
  items.forEach(it=>{const {e,s}=it;const b=el('button','oi',m);b.innerHTML=`<i style="background:${esc(group?e.color:colOf(e,s))}"></i><b>${esc(e.title)}</b><small>${esc((group?'':DAYS[s.day].slice(0,3)+' ')+fmt(s.start)+'–'+fmtEnd(s.end))}</small>`;b.onclick=()=>{close();onPick(e,it)}});
  m.style.left=Math.max(6,Math.min(x,innerWidth-m.offsetWidth-6))+'px';m.style.top=Math.max(6,Math.min(y,innerHeight-m.offsetHeight-6))+'px';
  setTimeout(()=>{document.addEventListener('pointerdown',out,true);document.addEventListener('keydown',key,true)});
}
function startCreate(ev,di,col){
  ev.preventDefault();
  const a=Math.max(0,Math.min(1440-SNAP,Math.floor(minAt(col,ev.clientY)/SNAP)*SNAP));
  let b=a+SNAP,moved=false;
  const gh=el('div','ghost',col);
  const draw=()=>{const lo=Math.min(a,b),hi=Math.max(a,b);gh.style.top=(lo-hrA()*60)/60*state.HH+'px';gh.style.height=(hi-lo)/60*state.HH+'px'};
  draw();
  const mv=p=>{if(!moved&&Math.hypot(p.clientX-ev.clientX,p.clientY-ev.clientY)<4)return;moved=true;b=snapM(minAt(col,p.clientY));if(b===a)b=a+SNAP;b=Math.max(0,Math.min(1440,b));draw()};
  const up=()=>{document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);gh.remove();
    if(!moved&&touchCopy(ev,ev.clientX,ev.clientY,di,minAt(col,ev.clientY),fxAt(col,ev.clientX)))return;   // a locked event lets the finger through to the column
    let lo=Math.min(a,b),hi=Math.max(a,b);if(!moved||hi-lo<SNAP)hi=Math.min(1440,lo+60);
    openDlg(null,{day:di,start:lo,end:hi,...(state.allWk?{wk:state.curWk}:{})})};   // with every week side by side: an event of that week (R-CYC-19)
  document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up);
}
