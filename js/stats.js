// Statistics, agendas and printing. Classic script: shares the global scope with the other files in js/, loaded in the order of index.html (docs/architecture.md).
/* ---------- statistics: how a person's week is spent, by activity type (R-STAT-01..04) ---------- */
function personStats(pid,inv,w=1){   // w: the week of the cycle (R-CYC-11)
  // occurrences of the visible schedules the person leads (or is involved in); events without any people count for nobody.
  // Every minute counts once: double-booked time is split evenly between the occurrences at that time.
  const days=[...Array(7)].map(()=>[]),nk=new Set(days.flatMap((_,di)=>[...nestOfDay(di,false,w).keys()]));   // nested pieces (R-NST-04)
  const aw=[...Array(7)].map(()=>[]);   // the person's Away windows per day (R-EVT-24)
  S.events.filter(visible).forEach(e=>e.slots.forEach(s=>{
    if(e.away){if(awayPpl(e,s).includes(pid))piecesOf(s).filter(q=>inWk(e,s,q,w)).forEach(q=>aw[q.day].push([q.a,q.b]));return}
    if(e.bg)return;   // in the background: counts for nobody (R-EVT-19)
    if(s.person!==pid&&!(inv&&!e.oncall&&invOf(e,s).includes(pid)))return;   // on-call involvement is not busy time (R-EVT-16)
    const t=e.type&&S.types.some(x=>x.id===e.type)?e.type:'';
    // flexible margins (R-EVT-15) count as planned and flexible time, but a core at the same time takes it
    // "around these times" (R-EVT-12) is all margin; nested, it takes the time of what it is done during. sq groups the pieces of one occurrence
    piecesOf(s).filter(q=>inWk(e,s,q,w)).forEach(q=>{const [c0,c1]=coreIn(s,q),ns=nk.has(nkey(e,s,q.p));
      if(s.flex){days[q.day].push(ns?{a:q.a,b:q.b,t,fx:true,ns}:{a:q.a,b:q.b,t,fx:true,mg:true,sq:e.id+'|'+e.slots.indexOf(s)+(q.p&&s.day===6&&cyc()>1?'|p':'')});return}
      if(c1<=c0){days[q.day].push({a:q.a,b:q.b,t,fx:true,mg:true});return}
      days[q.day].push({a:c0,b:c1,t,fx:false,ns});if(q.a<c0)days[q.day].push({a:q.a,b:c0,t,fx:true,mg:true});if(c1<q.b)days[q.day].push({a:c1,b:q.b,t,fx:true,mg:true})})}));
  // squeezed out: an occurrence around these times that the person's other cores and Away windows leave no minute of is a core again (R-EVT-12)
  const grp=new Map();days.forEach((its,di)=>its.forEach(x=>{if(x.sq){if(!grp.has(x.sq))grp.set(x.sq,[]);grp.get(x.sq).push([x,di])}}));
  [...grp.values()].filter(xs=>xs.every(([x,di])=>covers(x.a,x.b,[...days[di].filter(y=>!y.mg).map(y=>[y.a,y.b]),...aw[di]]))).forEach(xs=>xs.forEach(([x])=>delete x.mg));
  const by=new Map(),fx=new Map(),perDay=days.map(()=>new Map()),add=(m,k,v)=>m.set(k,(m.get(k)||0)+v);let planned=0,overlap=0,places=0,away=0,awPl=0;
  days.forEach((its,di)=>{
    const pts=[...new Set([...its.flatMap(x=>[x.a,x.b]),...aw[di].flat()])].sort((x,y)=>x-y);let inOv=false;
    for(let i=0;i<pts.length-1;i++){
      const p=pts[i],q=pts[i+1],all=its.filter(x=>x.a<=p&&x.b>=q),cores=all.filter(x=>!x.mg),ns=cores.filter(x=>x.ns),act=ns.length?ns:cores.length?cores:all,d=q-p;   // a nested activity takes the time of what it is done during
      if(aw[di].some(([x,y])=>x<=p&&y>=q)){if(act.length)awPl+=d;else away+=d}   // away and not planned / planned while away (R-EVT-24)
      if(!act.length){inOv=false;continue}
      planned+=d;act.forEach(x=>{const v=d/act.length;add(by,x.t,v);add(perDay[di],x.t,v);if(x.fx)add(fx,x.t,v)});
      if((ns.length?ns:cores).length>1){overlap+=d;if(!inOv)places++;inOv=true}else inOv=false;   // only core on core is double-booked (a nested one with its host is not)
    }
  });
  return {by,fx,perDay,planned,overlap,places,away,awPl,flex:[...fx.values()].reduce((a,b)=>a+b,0)};
}
// the statistics of the week shown in the dialog (stW): a week of the cycle, or 'avg' = the mean of all of them (R-CYC-11)
function stOf(pid,inv,w){
  const n=cyc();if(n<2||w!=='avg')return personStats(pid,inv,n<2?1:+w);
  const ws=stWeeks(pid,inv),avgM=ms=>{const m=new Map();ms.forEach(x=>x.forEach((v,k)=>m.set(k,(m.get(k)||0)+v/n)));return m},sum=f=>ws.reduce((a,x)=>a+f(x),0);
  return {by:avgM(ws.map(x=>x.by)),fx:avgM(ws.map(x=>x.fx)),perDay:[...Array(7).keys()].map(d=>avgM(ws.map(x=>x.perDay[d]))),planned:sum(x=>x.planned)/n,overlap:sum(x=>x.overlap)/n,flex:sum(x=>x.flex)/n,away:sum(x=>x.away)/n,awPl:sum(x=>x.awPl)/n,
    ovTot:sum(x=>x.overlap),places:sum(x=>x.places),avg:true};
}
const stWeeks=(pid,inv)=>[...Array(cyc()).keys()].map(k=>personStats(pid,inv,k+1));
// rota turns (R-CYC-18): the occurrences over the cycle each person is responsible for, per week; null unless two or more people take turns
// mode = the event's turns mark: true counts always, false never, absent (automatic) when two or more people take turns
function turnsOf(e,slots=e.slots,mode=e.turns){
  if(mode===false)return null;const n=cyc(),m=new Map();
  slots.forEach(s=>{if(!s.person)return;if(!m.has(s.person))m.set(s.person,Array(n).fill(0));(wksOf(e,s)||[...Array(n).keys()].map(k=>k+1)).forEach(w=>{if(w<=n)m.get(s.person)[w-1]++})});
  return m.size>1||mode===true?new Map(S.people.filter(q=>m.has(q.id)).map(q=>[q.id,m.get(q.id)])):null;   // in the order of the People list
}
const tuSum=a=>a.reduce((x,y)=>x+y,0);
const stRotas=()=>S.events.filter(e=>visible(e)&&!isAway(e)).map(e=>[e,turnsOf(e)]).filter(([,t])=>t);   // the rotas of the visible schedules
function statsTurnsHTML(pid){   // a table of the rotas: one person's turns, or (Everyone) each person's (R-CYC-18); each can be left out, others added
  if(!S.events.some(e=>visible(e)&&!isAway(e)))return '';
  const ro=stRotas().filter(([,t])=>pid==='*'||t.has(pid)),n=cyc();
  const wh=n>1?[...Array(n).keys()].map(k=>wkTh(k+1)).join(''):'',ppl=ourPeople();
  const name=e=>`<td><button type="button" class="tux" data-id="${esc(e.id)}" title="${esc(L('tuOutTip',{t:e.title}))}" aria-label="${esc(L('tuOutTip',{t:e.title}))}">✕</button>${esc(e.title)}</td>`;
  let h=`<h4 class="sttuh">${esc(L('stTurnsH'))}<span class="tip" title="${esc(L('stTurnsTip'))}"> ⓘ</span></h4>`;
  if(!ro.length)h+=`<p class="note">${esc(L(pid==='*'?'tuNone':'tuNoneP',{n:(S.people.find(q=>q.id===pid)||{}).name}))}</p>`;
  else{h+=`<table class="sttab sttu"><thead><tr><th>${esc(L('stRota'))}</th>`;
    if(pid==='*'){h+=ppl.map(q=>`<th>${esc(q.name)}</th>`).join('')+`<th>${esc(L('stTuAll'))}</th></tr></thead><tbody>`;
      ro.forEach(([e,t])=>{h+=`<tr>${name(e)}`+ppl.map(q=>`<td>${t.has(q.id)?tuSum(t.get(q.id)):0}</td>`).join('')+`<td>${tuSum([...t.values()].flat())}</td></tr>`})}
    else{h+=wh+`<th>${esc(L('stTurns'))}</th><th>${esc(L('stTuOf'))}</th></tr></thead><tbody>`;
      ro.forEach(([e,t])=>{const a=t.get(pid);h+=`<tr>${name(e)}`+(n>1?a.map(x=>`<td>${x}</td>`).join(''):'')+`<td>${tuSum(a)}</td><td>${tuSum([...t.values()].flat())}</td></tr>`})}
    h+='</tbody></table>'}
  return h+`<button type="button" class="tuadd" aria-haspopup="menu" title="${esc(L('tuAddTip'))}">${esc(L('tuAdd'))}</button>`;
}
function setTurns(e,v){hist();if(v==null)delete e.turns;else e.turns=v;render()}   // an event's turns mark (R-CYC-18): data, undoable
function tuAddPop(b,done){   // the events of the visible schedules that count no turns, one per line: picking one makes it count (R-CYC-18)
  document.querySelectorAll('.tupop').forEach(x=>x.remove());
  const m=el('div','omenu cmenu typop tupop',b.closest('dialog')||document.body);m.setAttribute('role','menu');m.setAttribute('aria-label',L('tuAdd'));el('div','oh',m).textContent=L('tuAddH');
  const close=()=>{m.remove();document.removeEventListener('pointerdown',out,true)},out=e=>{if(!m.contains(e.target)&&!b.contains(e.target))close()};
  const evs=S.events.filter(e=>visible(e)&&!isAway(e)&&!turnsOf(e)).sort((x,y)=>x.title.localeCompare(y.title));
  if(!evs.length){const x=el('button','oi',m);x.type='button';x.disabled=true;x.setAttribute('role','menuitem');x.textContent=L('tuAddNone')}
  evs.forEach(e=>{const x=el('button','oi',m);x.type='button';x.setAttribute('role','menuitem');x.innerHTML=`<i style="background:${esc(e.color)}"></i><span>${esc(e.title)}</span>`+(e.turns===false?`<small>${esc(L('tuWasOut'))}</small>`:'');
    x.onclick=()=>{close();setTurns(e,true);done()}});
  m.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();b.focus()}};
  const rc=b.getBoundingClientRect();
  m.style.left=Math.max(6,Math.min(rc.left,innerWidth-m.offsetWidth-6))+'px';m.style.top=Math.max(6,Math.min(rc.bottom+4,innerHeight-m.offsetHeight-6))+'px';
  setTimeout(()=>document.addEventListener('pointerdown',out,true));m.querySelector('.oi').focus();
}
function statsTurnsRows(pid){   // the same, for the clipboard and CSV
  const ro=stRotas().filter(([,t])=>pid==='*'||t.has(pid)),n=cyc(),ppl=ourPeople();if(!ro.length)return [];
  if(pid==='*')return [[],[L('stRota'),...ppl.map(q=>q.name),L('stTuAll')],...ro.map(([e,t])=>[e.title,...ppl.map(q=>t.has(q.id)?tuSum(t.get(q.id)):0),tuSum([...t.values()].flat())])];
  const q=S.people.find(x=>x.id===pid);
  return [[],[L('stPerson'),L('stRota'),...(n>1?[...Array(n).keys()].map(k=>wkShortL(k+1)):[]),L('stTurns'),L('stTuOf')],...ro.map(([e,t])=>{const a=t.get(pid);return [q.name,e.title,...(n>1?a:[]),tuSum(a),tuSum([...t.values()].flat())]})];
}
const fmtDur=m=>{m=Math.round(m);return Math.floor(m/60)+':'+String(m%60).padStart(2,'0')};
const pctOf=(x,t)=>t?Math.round(x/t*100)+' %':'–';
// the dialog's view of the numbers: the unit of the figures (R-STAT-05) and the activity types filtered out (R-STAT-07), kept while the page is open
let stU='h',stHide=new Set();
const stFK='#';   // the key of "Filtered out"
const stOrder=()=>[...S.types.map(t=>t.id),''].filter(k=>!stHide.has(k)).concat(stHide.size?[stFK]:[]);   // activity types in list order, "No type", then "Filtered out"
const stKeys=st=>stOrder().filter(k=>(st.by.get(k)||0)>0);
const stInfo=k=>{if(k===stFK)return {name:L('stFilt'),color:'#e2e5ea',cls:'stf',fill:'url(#stf)'};const t=S.types.find(x=>x.id===k);return t||{name:L('stNoType'),color:NOTY,icon:'dot'}};
const stNF=()=>[...stHide].filter(k=>k===''||S.types.some(t=>t.id===k)).length;   // how many activity types are filtered out
// the hidden activity types merged into one "Filtered out" entry: the planned time and the 168-hour scale stay as they are (R-STAT-07)
function stView(st){
  if(!stHide.size)return st;
  const mg=m=>{const o=new Map();let f=0;m.forEach((v,k)=>{if(stHide.has(k))f+=v;else o.set(k,v)});if(f)o.set(stFK,f);return o};
  return {...st,by:mg(st.by),fx:mg(st.fx),perDay:st.perDay.map(mg)};
}
// a figure in the chosen unit (R-STAT-05): h:mm, % of base (the week or the day), or % of pl (the planned time; falsy: no share of it, "–")
const stVal=(m,base,pl)=>stU==='h'?fmtDur(m):pctOf(m,stU==='w'?base:pl);
const stTip=(name,m,v)=>name+' '+fmtDur(m)+(stU!=='h'&&v!=='–'?' ('+v+')':'');
const wkInfoTip=w=>wkI(w).name||wkDesc(w)?`<span class="tip" role="img" title="${esc(wkTip(w))}" aria-label="${esc(wkTip(w))}">ⓘ</span>`:'';   // W2 ⓘ: its name and description (R-CYC-17)
const wkTh=w=>`<th>${wkChip(w)}${esc(L('wkShort',{n:w}))}${wkInfoTip(w)}</th>`;
const stSvgDefs='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><pattern id="sth" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="6" fill="#fff" fill-opacity=".5"/></pattern><pattern id="sta" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#8a909c"/><rect width="4" height="8" fill="#c3c7cf"/></pattern><pattern id="stf" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="8" height="8" fill="#d3d7de"/><rect width="4" height="8" fill="#eceef2"/></pattern></defs></svg>';
// one bar for the 168-hour week: activity types, "No type", "Filtered out", then "Away" and "Not planned"; every part wide enough carries its figure (R-STAT-06)
function stWeekBar(st,h){
  const W=7*1440;let r='';
  const seg=(m,i,fxw,pl)=>{if(m<=0)return;const v=stVal(m,W,pl),bg=i.cls?'':`background:${esc(i.color)};color:${ink(i.color)};`;
    r+=`<span class="${i.cls||''}" style="${bg}width:${m/W*100}%" title="${esc(stTip(i.name,m,v))}">${fxw>0?`<i class="sth" style="width:${Math.min(100,fxw/m*100)}%"></i>`:''}${m/W>=.04&&v!=='–'?`<b>${esc(v)}</b>`:''}</span>`};
  stKeys(st).forEach(k=>seg(st.by.get(k),stInfo(k),st.fx.get(k)||0,st.planned));
  const aw=st.away||0,np=W-st.planned-aw;seg(aw,{name:L('stAway'),cls:'sta'},0,0);   // Away, hatched (R-EVT-24)
  {const v=stVal(np,W,0);r+=`<span class="stnp" title="${esc(stTip(L('stNotPl'),np,v))}">${np/W>=.04&&v!=='–'?`<b>${esc(v)}</b>`:''}</span>`}
  return `<div class="stwk" style="height:${h}px" role="img" aria-label="${esc(L('stPlanned')+' '+fmtDur(st.planned)+', '+(aw?L('stAway')+' '+fmtDur(aw)+', ':'')+L('stNotPl')+' '+fmtDur(np))}">${r}</div>`;
}
// a stacked 24-hour bar per day, with the day's planned time above it and the figure of every part tall enough inside it (R-STAT-06)
function stDayBars(st){
  let r='';const H=120,T=14;
  st.perDay.forEach((m,di)=>{let y=T+H;const x=di*40+8,tot=[...m.values()].reduce((a,b)=>a+b,0);r+=`<rect class="stnp" x="${x}" y="${T}" width="24" height="${H}"/>`;
    stKeys(st).forEach(k=>{const v=m.get(k)||0;if(!v)return;const hh=v/1440*H,i=stInfo(k),lab=stVal(v,1440,tot);y-=hh;
      r+=`<rect x="${x}" y="${y}" width="24" height="${hh}" fill="${i.fill||esc(i.color)}"><title>${esc(DAYS[di]+': '+stTip(i.name,v,lab))}</title></rect>`;
      if(hh>=11)r+=`<text class="stv" x="${x+12}" y="${y+hh/2+2.6}" text-anchor="middle" style="fill:${i.cls?'#1b1f27':ink(i.color)}">${esc(lab)}</text>`});
    if(tot)r+=`<text class="stv stdt" x="${x+12}" y="${T-4}" text-anchor="middle">${esc(stU==='h'?fmtDur(tot):pctOf(tot,stU==='w'?1440:st.planned))}</text>`;   // % of planned: the day's share of the week's planned time
    r+=`<text x="${x+12}" y="${T+H+14}" text-anchor="middle">${esc(DAYS[di].slice(0,3))}</text>`});
  return `<svg class="stday" viewBox="0 0 280 ${T+H+20}" role="img" aria-label="${esc(L('stDays'))}">${r}</svg>`;
}
function statsOneHTML(pid,inv){
  const q=S.people.find(x=>x.id===pid),st=stView(stOf(pid,inv,stW)),W=7*1440,ws=cyc()>1?stWeeks(pid,inv).map(stView):null;
  if(!st.planned&&!st.away&&!(ws&&ws.some(x=>x.planned||x.away)))return `<p>${esc(L('stNothing',{n:q.name}))}</p>`+stWeekBar(st,22)+statsTurnsHTML(pid);
  // with a cycle (R-CYC-11): a column per week, the average and (in hours) the cycle's total, in the chosen unit (R-STAT-05); pl: a share of the planned time makes sense
  const avgOf=f=>ws.reduce((a,x)=>a+f(x),0)/ws.length;
  const wc=(f,pl)=>ws?ws.map(x=>`<td>${stVal(f(x),W,pl&&x.planned)}</td>`).join('')+`<td>${stVal(avgOf(f),W,pl&&avgOf(x=>x.planned))}</td>`+(stU==='h'?`<td>${fmtDur(ws.reduce((a,x)=>a+f(x),0))}</td>`:''):'';
  const wh=ws?ws.map((_,k)=>wkTh(k+1)).join('')+`<th>${esc(L('stAvg'))}</th>`+(stU==='h'?`<th>${esc(L('stCyc'))}</th>`:''):'';
  const keys=ws?stOrder().filter(k=>ws.some(x=>(x.by.get(k)||0)>0)):stKeys(st);
  let h=stWeekBar(st,22)+stDayBars(st)+`<table class="sttab"><thead><tr><th>${esc(L('tyLbl'))}</th><th>${esc(L('stHours'))}</th><th>${esc(L('stPctW'))}</th><th>${esc(L('stPctP'))}</th>${wh}</tr></thead><tbody>`;
  keys.forEach(k=>{const i=stInfo(k),m=st.by.get(k)||0,f=st.fx.get(k)||0;
    h+=`<tr${k===stFK?' class="stfr"':''}><td>${k===stFK?esc(L('stFiltN',{n:stNF()})):k?tyTag(i):esc(i.name)}${f?` <small>(${esc(L('stFlex',{h:fmtDur(f)}))})</small>`:''}</td><td>${fmtDur(m)}</td><td>${pctOf(m,W)}</td><td>${pctOf(m,st.planned)}</td>${wc(x=>x.by.get(k)||0,true)}</tr>`});
  const anyAw=st.away||(ws&&ws.some(x=>x.away));
  h+=`<tr class="sttot"><td>${esc(L('stPlanned'))}</td><td>${fmtDur(st.planned)}</td><td>${pctOf(st.planned,W)}</td><td></td>${wc(x=>x.planned,true)}</tr>`;
  if(anyAw)h+=`<tr class="staw"><td>${esc(L('stAway'))}</td><td>${fmtDur(st.away)}</td><td>${pctOf(st.away,W)}</td><td></td>${wc(x=>x.away)}</tr>`;   // R-EVT-24
  h+=`<tr class="stnpr"><td>${esc(L('stNotPl'))}</td><td>${fmtDur(W-st.planned-st.away)}</td><td>${pctOf(W-st.planned-st.away,W)}</td><td></td>${wc(x=>W-x.planned-x.away)}</tr></tbody></table>`;
  const notes=[];if(st.avg&&st.ovTot)notes.push(L('stOverCyc',{h:fmtDur(st.ovTot),n:st.places}));else if(st.overlap)notes.push(L('stOver',{h:fmtDur(st.overlap),n:st.places}));if(st.flex)notes.push(L('stFlex',{h:fmtDur(st.flex)}));if(st.awPl)notes.push(L('stAwPl',{h:fmtDur(st.awPl)}));
  if(notes.length)h+=`<p class="stfoot">${esc(notes.join(' · '))}</p>`;
  return h+statsTurnsHTML(pid);
}
function statsAllHTML(inv){
  let h='<div class="stall">';const W=7*1440,pv=m=>stU==='h'?fmtDur(m):pctOf(m,W);   // planned time: in a percent unit, of the week (of the planned time it would always be 100 %)
  const sts=ourPeople().map(q=>[q,stView(stOf(q.id,inv,stW))]);
  sts.forEach(([q,st])=>{const ws=cyc()>1?stWeeks(q.id,inv):null;h+=`<div class="stp"><span class="stn">${pIcon(q)}${esc(q.name)}</span>${stWeekBar(st,14)}<b>${pv(st.planned)}</b></div>`;
    if(ws)h+=`<div class="stpw">${ws.map((x,k)=>wkChip(k+1)+esc(L('wkShort',{n:k+1}))+wkInfoTip(k+1)+' '+esc(pv(x.planned))).join(' · ')}</div>`});   // fairness: each week's hours (R-CYC-11)
  const used=stOrder().filter(k=>sts.some(([,st])=>(st.by.get(k)||0)>0));
  h+='</div><div class="stleg">'+used.map(k=>{const i=stInfo(k);return `<span><i${i.cls?` class="${i.cls}"`:` style="background:${esc(i.color)}"`}></i>${esc(i.name)}</span>`}).join('')+(sts.some(([,st])=>st.away)?`<span><i class="sta"></i>${esc(L('stAway'))}</span>`:'')+`<span><i class="stnpi"></i>${esc(L('stNotPl'))}</span></div>`;
  return h+statsTurnsHTML('*');
}
function statsRows(pid,inv){   // the table behind the current view, for the clipboard and CSV (hours as decimal numbers; the week columns in the chosen unit, R-STAT-05)
  const hrs=m=>(Math.round(m)/60).toFixed(2),W=7*1440,pc=stU!=='h';
  if(pid==='*'){
    const keys=stOrder(),uS=pc?' ('+L('stPctW')+')':'',pv=m=>pc?pctOf(m,W):hrs(m);
    // with a cycle (R-CYC-11): each week's planned time, their average and (in hours) the cycle's total
    const wH=cyc()>1?[...[...Array(cyc()).keys()].map(k=>L('stPlanned')+' '+wkShortL(k+1)+uS),L('stPlanned')+' '+L('stAvg')+uS,...(pc?[]:[L('stPlanned')+' '+L('stCyc')])]:[];
    const wV=ws=>ws?[...ws.map(x=>pv(x.planned)),pv(ws.reduce((a,x)=>a+x.planned,0)/ws.length),...(pc?[]:[hrs(ws.reduce((a,x)=>a+x.planned,0))])]:[];
    const sts=ourPeople().map(q=>[q,stView(stOf(q.id,inv,stW))]),anyAw=sts.some(([,st])=>st.away);   // an Away column only when somebody is away (R-EVT-24)
    return [[L('stPerson'),...keys.map(k=>k===stFK?L('stFiltN',{n:stNF()}):stInfo(k).name),L('stPlanned'),...(anyAw?[L('stAway')]:[]),L('stNotPl'),L('stOverH'),L('stFlexH'),...wH],...sts.map(([q,st])=>
      [q.name,...keys.map(k=>hrs(st.by.get(k)||0)),hrs(st.planned),...(anyAw?[hrs(st.away)]:[]),hrs(W-st.planned-st.away),hrs(st.overlap),hrs(st.flex),...wV(cyc()>1&&stWeeks(q.id,inv))]),...statsTurnsRows('*')];
  }
  const st=stView(stOf(pid,inv,stW)),q=S.people.find(x=>x.id===pid),ws=cyc()>1?stWeeks(pid,inv).map(stView):null,uS=pc?' ('+L(stU==='w'?'stPctW':'stPctP')+')':'';
  const avgOf=f=>ws.reduce((a,x)=>a+f(x),0)/ws.length,cv=(m,pl)=>pc?stVal(m,W,pl):hrs(m);
  const wH=ws?[...ws.map((_,k)=>wkShortL(k+1)+uS),L('stAvg')+uS,...(pc?[]:[L('stCyc')])]:[],wV=(f,pl)=>ws?[...ws.map(x=>cv(f(x),pl&&x.planned)),cv(avgOf(f),pl&&avgOf(x=>x.planned)),...(pc?[]:[hrs(ws.reduce((a,x)=>a+f(x),0))])]:[];
  const keys=ws?stOrder().filter(k=>ws.some(x=>(x.by.get(k)||0)>0)):stKeys(st);
  return [[L('stPerson'),L('tyLbl'),L('stHours'),L('stPctW'),L('stPctP'),...DAYS,L('stFlexH'),...wH],
    ...keys.map(k=>[q.name,k===stFK?L('stFiltN',{n:stNF()}):stInfo(k).name,hrs(st.by.get(k)||0),pctOf(st.by.get(k)||0,W),pctOf(st.by.get(k)||0,st.planned),...st.perDay.map(m=>hrs(m.get(k)||0)),hrs(st.fx.get(k)||0),...wV(x=>x.by.get(k)||0,true)]),
    [q.name,L('stPlanned'),hrs(st.planned),pctOf(st.planned,W),'',...st.perDay.map(m=>hrs([...m.values()].reduce((a,b)=>a+b,0))),hrs(st.flex),...wV(x=>x.planned,true)],
    ...(st.away||ws&&ws.some(x=>x.away)?[[q.name,L('stAway'),hrs(st.away),pctOf(st.away,W),'',...DAYS.map(()=>''),'',...wV(x=>x.away)]]:[]),
    [q.name,L('stNotPl'),hrs(W-st.planned-st.away),pctOf(W-st.planned-st.away,W),'',...st.perDay.map(m=>hrs(1440-[...m.values()].reduce((a,b)=>a+b,0))),'',...wV(x=>W-x.planned-x.away)],
    [q.name,L('stOverH'),hrs(st.overlap),'','',...DAYS.map(()=>''),'',...wV(x=>x.overlap)],...statsTurnsRows(pid)];
}
const cellSafe=v=>{v=String(v);return /^[=+\-@\t\r]/.test(v)?"'"+v:v};   // a name like "=HYPERLINK(…)" must not run as a spreadsheet formula
const toCsv=rows=>rows.map(r=>r.map(c=>{c=cellSafe(c);return /[",\r\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')).join('\r\n');
const toTsv=rows=>rows.map(r=>r.map(c=>cellSafe(c).replace(/[\t\r\n]+/g,' ')).join('\t')).join('\n');
const stTyKeys=()=>[...S.types.map(t=>t.id),''];   // every activity type, then "No type"
function tyPop(b,changed){   // R-STAT-07: the activity types shown in the statistics, one per line (like a time's colour menu); ticking keeps the list open
  document.querySelectorAll('.typop').forEach(x=>x.remove());
  const m=el('div','omenu cmenu typop',b.closest('dialog')||document.body);m.setAttribute('role','menu');m.setAttribute('aria-label',L('stTyF'));el('div','oh',m).textContent=L('stTyF');
  const close=()=>{m.remove();document.removeEventListener('pointerdown',out,true)},out=e=>{if(!m.contains(e.target)&&!b.contains(e.target))close()};
  const lines=[],upd=()=>lines.forEach(([x,k])=>{const on=!stHide.has(k);x.classList.toggle('on',on);x.setAttribute('aria-checked',String(on));x.title=L(on?'stTyOn':'stTyOff',{n:stInfo(k).name})});
  [['stShowAll',()=>stHide.clear()],['stHideAll',()=>stTyKeys().forEach(k=>stHide.add(k))]].forEach(([t,fn])=>{const x=el('button','oi tyall',m);x.type='button';x.setAttribute('role','menuitem');x.textContent=L(t);x.onclick=()=>{fn();upd();changed()}});
  stTyKeys().forEach(k=>{const i=stInfo(k),x=el('button','oi',m);x.type='button';x.setAttribute('role','menuitemcheckbox');x.innerHTML=`<span class="ic" style="color:${esc(i.color)}">${tIcon(i.icon)}</span><span>${esc(i.name)}</span>`;
    x.onclick=()=>{if(stHide.has(k))stHide.delete(k);else stHide.add(k);upd();changed()};lines.push([x,k])});upd();
  m.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();b.focus()}};
  const rc=b.getBoundingClientRect();
  m.style.left=Math.max(6,Math.min(rc.left,innerWidth-m.offsetWidth-6))+'px';m.style.top=Math.max(6,Math.min(rc.bottom+4,innerHeight-m.offsetHeight-6))+'px';
  setTimeout(()=>document.addEventListener('pointerdown',out,true));m.querySelector('.oi').focus();
}
let stP=null,stInv=true,stW='avg';   // last statistics view (person id, or '*' for everyone), the involved toggle and the week (R-CYC-11), kept while the page is open
function openStats(pid){
  const ppl=ourPeople();if(!ppl.length){toast(L('stNoPpl'));return}
  if(pid)stP=pid;if(!stP||(stP!=='*'&&!ppl.some(q=>q.id===stP)))stP=(ppl.find(q=>q.visible)||ppl[0]).id;
  const body=el('div','stats'),bar=el('div','stbar',body);
  const sel=el('select','',bar);fillSel(sel,[...ppl.map(q=>[q.id,q.name]),['*',L('stAll')]]);sel.value=stP;sel.setAttribute('aria-label',L('stWho'));
  if(cyc()>1){const ws=el('select','',bar);fillSel(ws,[['avg',L('stAvgW')],...[...Array(cyc()).keys()].map(k=>[k+1,wkLabel(k+1)])]);if(stW!=='avg'&&+stW>cyc())stW='avg';ws.value=stW;ws.setAttribute('aria-label',L('stWk'));ws.onchange=()=>{stW=ws.value;draw()}}
  const cl=el('label','',bar),cb=el('input','',cl);cb.type='checkbox';cb.checked=stInv;cl.append(' '+L('stInv'));cl.title=L('stInvTip');
  // the unit of the figures (R-STAT-05)
  const us=el('div','seg stu',bar);us.setAttribute('role','group');us.setAttribute('aria-label',L('stUnit'));us.title=L('stUnitTip');
  [['h','stHours'],['w','stPctW'],['p','stPctP']].forEach(([u,k])=>{const b=el('button',stU===u?'on':'',us);b.type='button';b.textContent=L(k);b.setAttribute('aria-pressed',String(stU===u));
    b.onclick=()=>{stU=u;[...us.children].forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',String(x===b))});draw()}});
  // the activity types shown, in this dialog only (R-STAT-07): a button that opens the list, one type per line
  const tb=el('button','sttyb',bar);tb.type='button';tb.setAttribute('aria-haspopup','menu');tb.title=L('stTyFTip');
  const drawTy=()=>{const ks=stTyKeys(),on=ks.filter(k=>!stHide.has(k)).length;tb.textContent=on===ks.length?L('stTyAll'):L('stTyN',{a:on,n:ks.length});tb.insertAdjacentHTML('beforeend',`<span class="ic">${ICON_CD}</span>`);tb.classList.toggle('on',on<ks.length)};
  tb.onclick=()=>tyPop(tb,()=>{drawTy();draw()});
  const out=el('div','stout',body);
  const draw=()=>{out.innerHTML=stSvgDefs+(stP==='*'?statsAllHTML(stInv):statsOneHTML(stP,stInv));
    out.querySelectorAll('.tux').forEach(b=>b.onclick=()=>{const e=S.events.find(x=>x.id===b.dataset.id);if(e){setTurns(e,false);draw()}});   // leave a rota out (R-CYC-18)
    const ad=out.querySelector('.tuadd');if(ad)ad.onclick=()=>tuAddPop(ad,draw)};
  sel.onchange=()=>{stP=sel.value;draw()};cb.onchange=()=>{stInv=cb.checked;draw()};drawTy();draw();
  el('p','note',body).textContent=L('stNote');
  const stat=el('p','ststat',body);stat.setAttribute('role','status');const msg=k=>{stat.textContent=L(k)};   // a toast would be hidden behind the dialog
  const who=()=>(stP==='*'?L('stAll'):S.people.find(x=>x.id===stP).name)+(cyc()>1?' — '+(stW==='avg'?L('stAvgW'):wkLabel(+stW)):'');
  const copy=()=>{const txt=toTsv(statsRows(stP,stInv)),ok=()=>msg('stCopied'),fb=()=>{const t=el('textarea','',body);t.value=txt;t.select();let r=false;try{r=document.execCommand('copy')}catch(e){}t.remove();msg(r?'stCopied':'stCopyFail')};
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(ok,fb);else fb()};
  const csv=()=>{const a=el('a');a.href=URL.createObjectURL(new Blob(['﻿'+toCsv(statsRows(stP,stInv))],{type:'text/csv'}));a.download='weekly-schedules-stats-'+fileDay()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);msg('stCsvDone')};
  const print=()=>{const w=el('div','stats');w.innerHTML=`<h1>${esc(L('stTitle')+' — '+who())}</h1>`+metaLine()+out.innerHTML+`<p class="note">${esc(L('stNote'))}</p>`;doPrint(w,false)};
  xdlg({title:L('stTitle'),body,wide:true,full:true,buttons:[{label:L('stCopy'),fn:()=>{copy();return false}},{label:L('stCsv'),fn:()=>{csv();return false}},{label:L('stPrint'),fn:()=>{print();return false}},{label:L('closeB'),cls:'p'}]});
}
/* agenda / print */
function metaLine(){
  const sch=S.schedules.filter(s=>s.visible).map(sTag),ppl=S.people.filter(q=>q.visible).map(q=>pIcon(q)+esc(q.name));
  return `<div class="pm"><b>${esc(L('wsShown'))}</b> ${S.color?`<i class="wkchip" style="background:${esc(S.color)}"></i>`:''}${esc(cw().name)}<br><b>${esc(L('schShown'))}</b> ${sch.join(' &nbsp; ')||esc(L('none2'))}<br><b>${esc(L('pplShown'))}</b> ${S.people.length?(ppl.join(' &nbsp; ')||esc(L('none2'))):esc(L('noPpl'))}</div>`;
}
function agendaHTML(di){
  const items=S.events.filter(visible).flatMap(e=>e.slots.flatMap(s=>piecesOf(s).filter(q=>q.day===di&&inWk(e,s,q)&&slotVisible(e,s)).map(q=>({e,s,q})))).sort((x,y)=>x.q.a-y.q.a||x.q.b-y.q.b);
  let h=wkH1(L('agTitle',{d:DAYS[di]+wkSuf()}))+metaLine();const nm=nestOfDay(di,true);
  const one=({e,s,q})=>{let h='';
    const bits=[];
    if(q.p)bits.push(`<i>${esc(L('contFrom',{d:DAYS[s.day],t:fmt(s.start)}))}</i>`);
    const ty=tyOf(e);if(ty)bits.push(tyTag(ty));if(wkNote(e,s))bits.push(wkNoteH(e,s));if(e.bg)bits.push(esc(L('bgNote')));if(isAway(e))bits.push(esc(L('awNote')));awayOf(e,s,q).forEach(x=>bits.push('⚠ '+esc(awayLine(x))));const sq=sqOf(e,s,q.p);if(sq)bits.push('⚠ '+esc(sqLine(sq)));if(s.flex)bits.push(esc(L('flexNote')));if(s.fs||s.fe)bits.push(esc(edgeNote(s)));
    if(s.person)bits.push(`<b>${esc(L('resp'))}</b> `+pTag(s.person));
    const inv=invOf(e,s).map(pTag).filter(Boolean);if(inv.length)bits.push(`<b>${esc(L(e.oncall?'oncl':'withl'))}</b> `+inv.join(', '));
    if(e.owner)bits.push(`<b>${esc(L('ownl'))}</b> `+pTag(e.owner));
    {const nh=nm.get(nkey(e,s,q.p));if(nh)bits.push(esc(L('nestDur',{t:nh.h.e.title})))}
    bits.push(`<b>${esc(L('schl'))}</b> `+e.schedules.map(id=>S.schedules.find(x=>x.id===id)).filter(Boolean).map(sTag).join(', '));
    if(overlapSet(e).has(s))bits.push('⚠ '+esc(L('ovTip')));
    const tt=q.p?`${fmt(0)}–${fmt(q.b)}`:`${fmt(s.start)}–${fmtEnd(s.end)}`;
    h+=`<div class="ai" style="border-left-color:${esc(colOf(e,s))}"><div class="at">${tt}</div><div class="ab"><div class="atl">${esc(e.title)}</div><div class="am">${bits.join(' &nbsp;·&nbsp; ')}</div>${e.desc?`<div class="ad">${esc(e.desc)}</div>`:''}</div></div>`;
    return h;
  };
  // with a rhythm shown, its phases of the day are headings, in start order, each with the events that start in it (R-PRN-04)
  const phs=S.phases.filter(phVis).flatMap(p=>p.slots.filter(s=>s.day===di&&inWk(p,s,{p:0,day:di})).map(s=>({p,s}))).sort((x,y)=>x.s.start-y.s.start||x.s.end-y.s.end);
  if(!phs.length){h+=items.length?items.map(one).join(''):`<p>${esc(L('nothing'))}</p>`;return h}
  const inPh=(it,x)=>it.q.a>=x.s.start&&it.q.a<x.s.end,blocks=phs.map(x=>({t:x.s.start,x,its:items.filter(it=>inPh(it,x))}));
  // events that start outside every phase: one "Outside the rhythm" group per gap between phase starts, at its place in time
  const outs=new Map();items.filter(it=>!phs.some(x=>inPh(it,x))).forEach(it=>{const k=phs.filter(x=>x.s.start<=it.q.a).length;if(!outs.has(k))outs.set(k,{t:it.q.a,its:[]});outs.get(k).its.push(it)});
  [...blocks,...outs.values()].sort((a,b)=>a.t-b.t||(a.x?-1:1)).forEach(b=>{
    h+=b.x?`<div class="aph" style="--c:${esc(b.x.p.color)}"${b.x.p.desc?` title="${esc(b.x.p.desc)}"`:''}><b>${esc(b.x.p.title)}</b> <span>${fmt(b.x.s.start)}–${fmtEnd(b.x.s.end)}</span></div>`:`<div class="aph out"><b>${esc(L('agOut'))}</b></div>`;
    h+=`<div class="apg">${b.its.length?b.its.map(one).join(''):`<p class="ae">${esc(L('agNone'))}</p>`}</div>`});
  return h;
}
let agDay=0;
let agFn=null;
function showAgenda(fn,day){agFn=fn;agDay=day;$('agBody').innerHTML=fn();$('agPrint2').style.display=day==null?'none':'';$('agPrint2').textContent=L('agPrintDay');$('agDlg').showModal()}
let agWk=1;
const withWk=(w,fn)=>{const c=curWk,a=allWk;curWk=w;allWk=false;try{return fn()}finally{curWk=c;allWk=a}};   // fn as if week w alone were shown (no redraw)
function openAgenda(di,w=curWk){agWk=w;showAgenda(()=>withWk(w,()=>agendaHTML(di)),di)}   // the day of the header's week (R-CYC-19)
function openRhythmAgenda(rh){showAgenda(()=>rhythmAgendaHTML(rh),null)}
function rhythmAgendaHTML(rh){
  const lst=S.phases.filter(p=>p.rhythms.includes(rh.id)).map(p=>({p,sl:cycSl(p.slots).filter(s=>!p.weeks||wksOf(p).length)})).filter(x=>x.sl.length).map(({p,sl})=>({p,sl,min:Math.min(...sl.map(s=>s.start))})).sort((x,y)=>x.min-y.min||x.p.title.localeCompare(y.p.title));
  let h=`<h1>${esc(L('agTitle',{d:rh.name}))}</h1>`;
  if(!lst.length)h+=`<p>${esc(L('nothing'))}</p>`;
  lst.forEach(({p,sl})=>{   // sl: its times in the cycle's weeks (staged weeks are left out, R-CYC-22)
    h+=`<div class="ai" style="border-left-color:${esc(p.color)}"><div class="ab"><div class="atl">${esc(p.title)}</div>${p.desc?`<div class="ad">${esc(p.desc)}</div>`:''}`;
    if(cyc()>1&&wksOf(p))h+=`<div class="am">${wksHTML(wksOf(p))}</div>`;   // a week pattern (R-CYC-16)
    const per=cyc()>1&&sl.some(s=>s.wk);
    (per?[...new Set(sl.map(s=>s.wk))].sort((a,b)=>a-b):[0]).forEach(w=>{   // different times per week: a section per week
      if(w)h+=`<div class="pwk">${wksHTML([w])}</div>`;
      const sig=d=>sl.filter(s=>s.day===d&&(!w||s.wk===w)).sort((a,b)=>a.start-b.start).map(s=>fmt(s.start)+'–'+fmtEnd(s.end)).join('|');
      const groups=[];
      for(let d=0;d<7;d++){const g=sig(d);if(!g)continue;const last=groups[groups.length-1];if(last&&last.sig===g&&last.to===d-1)last.to=d;else groups.push({sig:g,from:d,to:d})}
      groups.forEach(g=>{const days=g.from===g.to?DAYS[g.from]:L('dayTo',{a:DAYS[g.from],b:DAYS[g.to]});
        h+=`<div class="pg"><b>${esc(days)}</b>${g.sig.split('|').map(x=>`<div class="pt">${esc(x)}</div>`).join('')}</div>`})});
    h+='</div></div>';
  });
  return h;
}
function printDay(di){doPrint(dayPage(di),false)}
function dayPage(di){
  const c=withPrintScale(()=>$('grid').cloneNode(true));c.removeAttribute('id');c.querySelectorAll('.now').forEach(n=>n.remove());
  [...c.children].forEach(ch=>{if(ch.classList.contains('times')||ch.classList.contains('c'))return;if(ch.dataset.d!==String(di)||(ch.dataset.w&&ch.dataset.w!==String(curWk)))ch.remove()});
  c.querySelectorAll('.lane .lbg').forEach(b=>{const l=document.createElement('div');l.className=('lip '+(b.dataset.fs||'')).trim();l.style.cssText=`top:${b.style.top};height:${b.style.height};background:${b.dataset.col};color:${ink(b.dataset.col)}`;const s=document.createElement('span');s.textContent=b.dataset.title;l.append(s);b.replaceWith(l)});
  c.querySelectorAll('.dh.wj').forEach(h=>h.classList.remove('wj'));
  c.style.gridTemplateColumns='52px 1fr';c.style.minWidth='0';c.classList.add('one');
  const w=el('div');w.innerHTML=wkH1(DAYS[di]+wkSuf())+metaLine();w.append(c);return w;
}
function doPrint(node,landscape){
  $('pr').replaceChildren(node);
  $('pgStyle').textContent='@page{size:A4 '+(landscape?'landscape':'portrait')+';margin:10mm}';
  window.print();
}
window.onafterprint=()=>$('pr').replaceChildren();
