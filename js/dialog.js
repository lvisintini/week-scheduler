// The event/phase dialog and the copy dialog. ES module (docs/architecture.md).
import {state} from './state.js';
import {DAYS,L,tr} from './i18n.js';
import {$,ICON_RHYTHM,ICON_USER,ICON_WARN,PAL,SNAP,el,esc,normHex,pTag,pickColor,randomColor,sTag,shiftColor,tIcon,uid} from './basics.js';
import {carryEvents,cw,hist,normWk,pushUndoWs,sameSet,wkChip,wkCol,wkDesc,wkI,wkLabel,wkTip,wksText} from './data.js';
import {cyc,cycSl,endLabel,fmt,fmtEnd,fmtMg,inCyc,ink,kept,ourPeople,overlapSet,phone,pname,stgSl,stgWks,toast,vrhythm,xdlg} from './model.js';
import {tuSum,turnsOf} from './stats.js';
import {chip} from './sidebar.js';
import {render} from './grid.js';
/* ---------- event dialog ---------- */
let cur=null;
export function fillSel(sel,vals){sel.innerHTML='';vals.forEach(([v,t])=>{const o=el('option','',sel);o.value=v;o.textContent=t})}
const pOpts=()=>[['',L('none')],...state.S.people.map(q=>[q.id,q.name+(q.external?' ('+L('extSuf')+')':'')])];
const setFC=c=>{$('fC').dataset.v=c;$('fC').style.background=c;updCols()};
let curStl=[],curEtl=[],dkind='event';
/* the day table (R-UI-07, R-REP-02): one row per day; a day's first time sits in its row, further times on lines below it (+ adds, ✕ removes).
   Every time holds that repetition's own values — times, who performs it (the event's owner by default, R-EVT-20), its own With list
   or the event's default (R-EVT-21) and its timing (R-EVT-12/15). Nothing here is an event-level look-alike; ⧉ copies a whole day. */
const MGS=[0,15,30,45,60,75,90,120,150,180,240];
const OWN='@o';   // "Performed by: Owner" (slot.fo)
const ownName=()=>{const q=state.S.people.find(x=>x.id===$('fOw').value);return q?q.name:''};
const ownLbl=()=>ownName()?L('perfOwn',{n:ownName()}):L('perfOwn0');
const perfOpts=()=>[[OWN,ownLbl()],['',L('perfNobody')],...state.S.people.map(q=>[q.id,q.name+(q.external?' ('+L('extSuf')+')':'')])];
const defInv=()=>[...$('fInv').querySelectorAll('input:checked')].map(i=>i.value);
/* weeks in the event dialog (R-CYC-08): a Weeks row with week chips (all = every week) and "Different per week", which gives every time
   its own week (a button in the day cell). dWk: pw = different per week; weeks = the pattern's weeks of the cycle while not pw.
   Staged weeks (R-CYC-21/22) are not shown here and keep what they have: stgW = the staged weeks of the pattern, stgL = the times of staged
   weeks (set aside, saved back unchanged), base = a pattern's times as opened (its staged weeks keep them when it becomes different per week),
   nw = a new event (all its weeks ticked = every week, staged ones too). */
let dWk={pw:false,weeks:new Set([1]),stgW:[],stgL:[],base:[],nw:true};
const patW=()=>{if(dWk.nw&&dWk.weeks.size>=cyc())return {};const w=[...new Set([...dWk.weeks,...dWk.stgW])].sort((a,b)=>a-b);return w.length>=kept()?{}:{weeks:w}};   // a pattern as saved: absent = every kept week
const stgLines=()=>dWk.pw?(dWk.stgL.length?dWk.stgL:dWk.stgW.flatMap(w=>dWk.base.map(x=>({...x,wk:w})))).map(x=>({...x})):[];   // the staged weeks' own times, saved back
function wkCtl(o,c,day){o.wkb=el('button','wkc',c);o.wkb.type='button';o.wkb.onclick=()=>wkPop(o,day);wkSet(o,o.wk||1)}
function wkSet(o,w){o.wk=w||1;if(!o.wkb)return;o.wkb.textContent=o.wk;const t=L('rowWk',{d:o.wbl||'',n:o.wk})+(wkI(o.wk).name?' · '+wkI(o.wk).name:'');o.wkb.title=o.wkb.__t=t;o.wkb.setAttribute('aria-label',t);
  const c=wkCol(o.wk);o.wkb.style.background=c||'';o.wkb.style.color=c?ink(c):'';o.wkb.style.borderColor=c||''}   // the week's colour (R-CYC-17)
const snapRow=o=>({...rowSlot(o),wk:o.wk,src:o.src});
function loadRow(o,v){rowLoad(o,v);wkSet(o,v.wk);o.src=v.src}
function sortDay(o){   // a day's times in week, then start order
  const ls=[o,...o.more],v=ls.map(snapRow).sort((a,b)=>a.wk-b.wk||a.start-b.start);v.forEach((x,k)=>loadRow(ls[k],x));
}
function wkPop(o,day){   // the week of one time
  document.querySelectorAll('.wpop,.cpop,.cmenu').forEach(x=>x.remove());
  const b=o.wkb,m=el('div','omenu cmenu',b.closest('dialog')||document.body);el('div','oh',m).textContent=L('rowWkH',{d:o.wbl||''});
  const close=()=>{m.remove();document.removeEventListener('pointerdown',out,true)},out=e=>{if(!m.contains(e.target)&&e.target!==b)close()};
  for(let w=1;w<=cyc();w++){const x=el('button','oi'+(o.wk===w?' on':''),m);x.type='button';x.setAttribute('aria-pressed',o.wk===w);x.innerHTML=wkChip(w)+`<span>${esc(wkLabel(w))}</span>`;if(wkDesc(w))x.title=wkDesc(w);
    x.onclick=()=>{wkSet(o,w);close();sortDay(day);updWarn();b.focus()}}
  m.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();b.focus()}};
  const rc=b.getBoundingClientRect();
  m.style.left=Math.max(6,Math.min(rc.left,innerWidth-m.offsetWidth-6))+'px';m.style.top=Math.max(6,Math.min(rc.bottom+4,innerHeight-m.offsetHeight-6))+'px';
  setTimeout(()=>document.addEventListener('pointerdown',out,true));(m.querySelector('.oi.on')||m.querySelector('.oi')).focus();
}
function setPW(on){   // switch between a week pattern and different times per week
  if(on){   // every time is copied into each week of the pattern
    const ws=[...dWk.weeks].sort((a,b)=>a-b);
    rows.forEach(o=>{if(!o.cb.checked)return;const v=[o,...o.more].map(snapRow),all=ws.flatMap(w=>v.map(x=>({...x,wk:w})));
      o.more.forEach(x=>x.r.remove());o.more=[];loadRow(o,all[0]);all.slice(1).forEach(x=>{addTime(o,x).src=x.src})});
    dWk.pw=true;
  }else{   // back to a pattern: the weeks that have times; if the weeks differ, the first week's times are kept (after a confirmation)
    const on=rows.filter(o=>o.cb.checked),ws=[...new Set(on.flatMap(o=>[o,...o.more].map(x=>x.wk)))].sort((a,b)=>a-b);
    const key=(o,w)=>JSON.stringify([o,...o.more].filter(x=>x.wk===w).map(x=>{const {wk,src,...r}=snapRow(x);return r}));
    const same=on.every(o=>ws.every(w=>key(o,w)===key(o,ws[0])));
    const sg=[...new Set(dWk.stgL.map(x=>x.wk))].sort((a,b)=>a-b);   // staged weeks with times of their own take the pattern's times (R-CYC-22)
    if((!same||sg.length)&&!confirm([!same&&L('pwBack',{n:ws[0]}),sg.length&&L('pwBackStg',{w:wksText(sg)})].filter(Boolean).join(' '))){$('fPw').checked=true;return}
    on.forEach(o=>{const v=[o,...o.more].filter(x=>x.wk===ws[0]).map(snapRow);o.more.forEach(x=>x.r.remove());o.more=[];
      if(!v.length){o.cb.checked=false;o.upd();return}loadRow(o,v[0]);v.slice(1).forEach(x=>{addTime(o,x).src=x.src})});
    dWk={...dWk,pw:false,weeks:new Set(ws.length?ws:[1]),stgW:[...new Set([...dWk.stgW,...sg])].sort((a,b)=>a-b)};
  }
  drawWk();rows.forEach(o=>o.upd());updWarn();
}
function drawWk(){   // the Weeks row (only while the cycle is longer than one week)
  const c=$('fWk'),n=cyc();c.innerHTML='';c.style.display=n>1?'':'none';$('paneQ').classList.toggle('pw',n>1&&dWk.pw);if(n<2)return;
  const lb=el('b','',c);lb.textContent=L('wkRow');lb.title=lb.__t=L(dkind==='phase'?'wkRowTipPh':'wkRowTip');
  if(!dWk.pw){const ch=el('div','chips',c);ch.setAttribute('role','group');ch.setAttribute('aria-label',L('wkRow'));
    for(let w=1;w<=n;w++){const l=el('label','',ch),i=el('input','',l);i.type='checkbox';i.value=w;i.checked=dWk.weeks.has(w);l.append(wkLabel(w));
      const c=wkCol(w);if(c){l.classList.add('wcol');l.style.setProperty('--wc',c)}if(wkDesc(w))l.title=l.__t=wkTip(w);   // the week's colour and description (R-CYC-17)
      i.onchange=()=>{if(!i.checked&&dWk.weeks.size<2){i.checked=true;return}i.checked?dWk.weeks.add(w):dWk.weeks.delete(w);updWarn()}}}   // at least one week
  const sw=el('label','pwsw',c),x=el('input','',sw);x.type='checkbox';x.id='fPw';x.checked=dWk.pw;sw.append(L('wkPer'));sw.title=sw.__t=L('wkPerTip');x.onchange=()=>setPW(x.checked);
  const sg=dWk.pw?[...new Set(stgLines().map(x=>x.wk))].sort((a,b)=>a-b):dWk.stgW;   // what the staged weeks keep (R-CYC-22)
  if(sg.length)el('small','wkstg note',c).textContent=L(dWk.pw?'wkStgPer':'wkStgPat',{w:wksText(sg)});
}
function rowCtl(o,r,day){   // the cells of one time: start, end, performer, With, colour, timing, then ⧉ and + (a day's first time) or ✕ (a further time), ⚠
  // field labels of the phone cards (R-UI-07); on a desktop the header row names the columns
  o.lb=[['ls',''],['le',''],['lp','ev-only'],['lw','ev-only'],['lk','ev-only'],['lt','ev-only']].map(([a,c])=>el('span','cl '+a+(c?' '+c:''),r));
  o.s=el('select','',r);o.en=el('select','',r);
  o.s.onchange=()=>{if(+o.en.value<=+o.s.value)o.en.value=Math.min(state.MAXEND,+o.s.value+60);updEnd(o.s,o.en);updWarn()};o.en.onchange=updWarn;
  o.ps=el('select','ev-only',r);o.ps.onchange=()=>{cSet(o,o.col);updWarn()};o.wb=el('button','wbtn ev-only',r);o.wb.type='button';o.wb.onclick=()=>wPop(o);
  o.cl=el('button','cbtn ev-only',r);o.cl.type='button';o.cl.onclick=()=>cPop(o);
  o.tsel=el('select','tsel ev-only',r);o.tsel.onchange=()=>{tmSet(o,o.tsel.value,15,15);updWarn()};
  if(o===day){o.rx=el('button','rx',r);o.rx.type='button';o.rx.textContent='✕';o.rx.onclick=()=>rmFirst(o);o.cp=el('button','cpy',r);o.cp.type='button';o.cp.textContent='⧉';o.cp.setAttribute('aria-haspopup','menu');o.cp.onclick=()=>cpyPop(o);o.ad=el('button','addt',r);o.ad.type='button';o.ad.textContent='+';o.ad.onclick=()=>{addTime(o);updWarn()}}
  else{el('span','cpx',r);o.x=el('button','bx',r);o.x.type='button';o.x.textContent='✕';o.x.onclick=()=>{o.r.remove();day.more=day.more.filter(z=>z!==o);day.more.forEach((z,k)=>rowTexts(z,day,k));updWarn();updOc()}}
  o.wn=el('span','wn',r);o.wn.innerHTML=ICON_WARN;
}
function rowSub(o,r){   // the margins of flexible start/end, on a line of their own under the row
  o.sub=el('div','dsub ev-only',r);o.subA=el('span','',o.sub);o.fsS=el('select','',o.sub);o.subB=el('span','',o.sub);o.feS=el('select','',o.sub);o.subC=el('span','',o.sub);
  [o.fsS,o.feS].forEach(x=>{fillSel(x,MGS.map(m=>[m,fmtMg(m)]));x.onchange=()=>{tmSet(o,'edge',+o.fsS.value,+o.feS.value);updWarn()}});
  tmSet(o,'');o.inv=null;   // texts come from rowTexts once the day is known
}
export function rowTexts(o,day,k){   // labels and tooltips (also after a language change); k = the index of a further time of that day
  fillSel(o.tsel,[['',L('tmFixed')],['edge',L('tmEdge')],['flex',L('tmAround')]]);o.tsel.value=o.tm||'';
  o.subA.textContent=L('tmLate');o.subB.textContent=L('tmLate2');o.subC.textContent=L('tmEarly');o.fsS.setAttribute('aria-label',L('tmFsA'));o.feS.setAttribute('aria-label',L('tmFeA'));
  const t=(b,txt)=>{if(b){b.title=b.__t=txt;b.setAttribute('aria-label',txt)}};t(o.cp,L('cpyTip'));t(o.ad,L('addTime',{d:DAYS[day.i]}));t(o.x,L('rmTime'));t(o.rx,L('rmTime'));o.wn.title=L('ovRowTip');
  const n=k==null?DAYS[day.i]:L('dayN',{d:DAYS[day.i],n:k+2});
  ['clS','clE','clP','clW','clC','clT'].forEach((key,j)=>{o.lb[j].textContent=L(key)});if(o.dn)o.dn.textContent=n;o.wkb.parentNode.firstChild.textContent=L('wkWord');[[o.s,'rowS'],[o.en,'rowE'],[o.ps,'rowP'],[o.tsel,'rowT']].forEach(([x,key])=>x.setAttribute('aria-label',L(key,{d:n})));o.wbl=n;wSet(o,o.inv);cSet(o,o.col);wkSet(o,o.wk);   // (the labels and title are those of the phone card)
}
function tmSet(o,tm,fs,fe){o.tm=tm==='flex'||tm==='edge'?tm:'';o.fs=o.tm==='edge'?+fs||0:0;o.fe=o.tm==='edge'?+fe||0:0;o.tsel.value=o.tm;o.fsS.value=o.fs;o.feS.value=o.fe;
  o.sub.style.display=o.tm==='edge'&&!o.tsel.disabled?'':'none'}
// a time's colour (R-EVT-22): null = the event's, 'p' = the performer's, 't' = the activity type's, or '#rrggbb'; the swatch shows the colour the box will get
const rowPerf=o=>o.ps.value===OWN?$('fOw').value:o.ps.value,dlgTy=()=>state.S.types.find(t=>t.id===$('fTy').value);   // the type chosen in the dialog
function cSet(o,col){
  o.col=col==='p'||col==='t'||normHex(col)?col:null;if(!o.cl)return;const ev=$('fC').dataset.v,q=state.S.people.find(x=>x.id===rowPerf(o)),ty=dlgTy(),c=o.col==='p'?(q?q.color:ev):o.col==='t'?(ty?ty.color:ev):o.col||ev;
  o.cl.style.background=c||'';o.cl.style.color=ink(normHex(c)||'#3b6df0');o.cl.innerHTML=o.col==='p'?ICON_USER:o.col==='t'&&ty?tIcon(ty.icon):'';
  const st=o.col==='p'?L('colPer',{n:q?q.name:L('colNoP')}):o.col==='t'?L('colTy',{n:ty?ty.name:L('colNoT')}):o.col?L('colOwnS',{c:o.col}):L('colEv'),t=L('rowC',{d:o.wbl||''})+': '+st;o.cl.title=o.cl.__t=t;o.cl.setAttribute('aria-label',t);
}
const updCols=()=>rows.flatMap(o=>[o,...o.more]).forEach(o=>cSet(o,o.col));
function cPop(o){   // the colour of one time: the event's, the performer's or its own
  document.querySelectorAll('.wpop,.cpop').forEach(x=>x.remove());
  const b=o.cl,m=el('div','omenu cmenu',b.closest('dialog')||document.body),q=state.S.people.find(x=>x.id===rowPerf(o));el('div','oh',m).textContent=L('rowC',{d:o.wbl||''});
  const close=()=>{m.remove();document.removeEventListener('pointerdown',out,true)},out=e=>{if(!m.contains(e.target)&&e.target!==b&&!e.target.closest('.cpop'))close()};
  const item=(col,c,label,fn)=>{const x=el('button','oi'+(o.col===col?' on':''),m);x.type='button';x.setAttribute('aria-pressed',o.col===col);x.innerHTML=chip(c)+`<span>${esc(label)}</span>`;x.onclick=fn;return x};
  const set=col=>{cSet(o,col);close();b.focus()};
  item(null,$('fC').dataset.v,L('colEv'),()=>set(null));
  item('p',q?q.color:$('fC').dataset.v,L('colPer',{n:q?q.name:L('colNoP')}),()=>set('p'));
  const ty=dlgTy();item('t',ty?ty.color:$('fC').dataset.v,L('colTy',{n:ty?ty.name:L('colNoT')}),()=>set('t'));
  const own=normHex(o.col);item(own?o.col:'#',own||'#ffffff00',L('colOwn'),()=>{close();pickColor(b,own||$('fC').dataset.v,c=>{cSet(o,c);b.focus()})});
  m.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();b.focus()}};
  const rc=b.getBoundingClientRect();
  m.style.left=Math.max(6,Math.min(rc.left,innerWidth-m.offsetWidth-6))+'px';m.style.top=Math.max(6,Math.min(rc.bottom+4,innerHeight-m.offsetHeight-6))+'px';
  setTimeout(()=>document.addEventListener('pointerdown',out,true));
  (m.querySelector('.oi.on')||m.querySelector('.oi')).focus();
}
function wSet(o,inv){   // inv: null = the event's default list, or the row's own list
  o.inv=inv?[...inv]:null;const b=o.wb,nm=ids=>ids.map(pname).filter(Boolean).join(', ');
  b.classList.toggle('def',!o.inv);b.textContent=o.inv?(nm(o.inv)||L('wNone')):L('wDef');
  const t=o.inv?L('wOwnTip',{n:nm(o.inv)||L('wNone')}):L('wDefTip',{n:nm(defInv())||L('wNone')});b.title=b.__t=t;b.setAttribute('aria-label',L('rowW',{d:o.wbl||''})+': '+t);
}
const tmOf=sl=>sl.flex?{tm:'flex'}:sl.fs||sl.fe?{tm:'edge',fs:sl.fs||0,fe:sl.fe||0}:{tm:''};
const tmSlot=o=>o&&o.tm==='flex'?{flex:true}:o&&o.tm==='edge'?{...(o.fs?{fs:o.fs}:{}),...(o.fe?{fe:o.fe}:{})}:{};
const tmItems=()=>rows.filter(o=>o.cb.checked).flatMap(o=>[o,...o.more]);   // every time of every ticked day
function rowLoad(o,sl){   // a repetition's values into a row
  o.s.value=sl.start;o.en.value=sl.end;updEnd(o.s,o.en);
  o.ps.value=sl.fo?OWN:sl.person||'';if(o.ps.value!==(sl.fo?OWN:sl.person||''))o.ps.value='';
  wSet(o,sl.inv||null);cSet(o,sl.col);const t=tmOf(sl);tmSet(o,t.tm,t.fs,t.fe);
}
function rowSlot(o){   // a row's values as a repetition
  const fo=o.ps.value===OWN;
  return {...(dWk.pw?{wk:o.wk}:{}),start:+o.s.value,end:+o.en.value,person:fo?$('fOw').value:o.ps.value,...(fo?{fo:true}:{}),...(o.inv&&!sameSet(o.inv,defInv())?{inv:[...o.inv]}:{}),...(o.col?{col:o.col}:{}),...tmSlot(o)};
}
function copyVals(y,x){y.s.value=x.s.value;y.en.value=x.en.value;updEnd(y.s,y.en);y.ps.value=x.ps.value;wSet(y,x.inv);cSet(y,x.col);tmSet(y,x.tm,x.fs,x.fe);wkSet(y,x.wk)}
// ⧉ (R-REP-02): the other ticked days in a direction — all of them, the ones below (later in the week) or the ones above (earlier)
const cpyTo=(o,dir)=>rows.filter(t=>t!==o&&t.cb.checked&&(dir==='all'||(dir==='down'?t.i>o.i:t.i<o.i)));
function copyDay(o,dir='all'){   // those days become like this one — all its times, performers, With lists, colours and timing
  const ts=cpyTo(o,dir);if(!ts.length)return;
  ts.forEach(t=>{while(t.more.length>o.more.length)t.more.pop().r.remove();while(t.more.length<o.more.length)addTime(t);
    copyVals(t,o);o.more.forEach((x,k)=>copyVals(t.more[k],x))});
  updWarn();updOc();toast(L('cpyDone',{d:ts.map(x=>DAYS[x.i]).join(', ')}));
}
function cpyPop(o){   // ⧉'s menu: to all other ticked days, to the ones below or to the ones above; a direction without ticked days is greyed out
  document.querySelectorAll('.wpop,.cpop,.cmenu').forEach(x=>x.remove());
  const b=o.cp,m=el('div','omenu cmenu',b.closest('dialog')||document.body);m.setAttribute('role','menu');el('div','oh',m).textContent=L('cpyH',{d:DAYS[o.i]});
  const close=()=>{m.remove();document.removeEventListener('pointerdown',out,true)},out=e=>{if(!m.contains(e.target)&&e.target!==b)close()};
  [['all','cpyAll'],['down','cpyDown'],['up','cpyUp']].forEach(([dir,k])=>{const ts=cpyTo(o,dir),x=el('button','oi',m);x.type='button';x.setAttribute('role','menuitem');
    x.textContent=L(k,{d:ts.length?ts.map(t=>DAYS[t.i].slice(0,3)).join(', '):L('cpyNone')});x.disabled=!ts.length;x.onclick=()=>{close();copyDay(o,dir);b.focus()}});
  m.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();b.focus()}};
  const rc=b.getBoundingClientRect();
  m.style.left=Math.max(6,Math.min(rc.left,innerWidth-m.offsetWidth-6))+'px';m.style.top=Math.max(6,Math.min(rc.bottom+4,innerHeight-m.offsetHeight-6))+'px';
  setTimeout(()=>document.addEventListener('pointerdown',out,true));
  (m.querySelector('.oi:not(:disabled)')||m.querySelector('.oi')).focus();
}
function wPop(o){   // a row's own With list: "Use the event's list" or chips
  document.querySelectorAll('.wpop').forEach(x=>x.remove());
  const b=o.wb,pop=el('div','cpop wpop',b.closest('dialog')||document.body);
  const close=()=>{pop.remove();document.removeEventListener('pointerdown',out,true)},out=e=>{if(!pop.contains(e.target)&&e.target!==b)close()};
  const draw=()=>{
    pop.innerHTML='';el('div','oh',pop).textContent=L('wPopH',{d:o.wbl||''});
    const sw=el('label','wdef',pop),c=el('input','',sw);c.type='checkbox';c.checked=!o.inv;sw.append(L('wUseDef'));
    c.onchange=()=>{wSet(o,c.checked?null:defInv());draw();updWarn()};
    const ch=el('div','chips',pop),list=o.inv||defInv();
    if(!ourPeople().length)ch.textContent=L('noPeople');
    ourPeople().forEach(q=>{const l=el('label','',ch),i=el('input','',l);i.type='checkbox';i.value=q.id;i.checked=list.includes(q.id);i.disabled=!o.inv;l.insertAdjacentHTML('beforeend',pTag(q.id));
      i.onchange=()=>{wSet(o,[...ch.querySelectorAll('input:checked')].map(x=>x.value));refreshDlg()}});
  };
  draw();
  pop.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();b.focus()}};
  const rc=b.getBoundingClientRect();
  pop.style.left=Math.max(6,Math.min(rc.left,innerWidth-pop.offsetWidth-6))+'px';pop.style.top=Math.max(6,Math.min(rc.bottom+4,innerHeight-pop.offsetHeight-6))+'px';
  setTimeout(()=>document.addEventListener('pointerdown',out,true));
  const f=pop.querySelector('input');if(f)f.focus();
}
export let rows=[];   // the seven days of the day table (dayRow), built by initDialog
const dayRow=(n,i)=>{
  const r=el('div','dr'+(i%2?' alt':''),$('fDays')),dc=el('span','dcell',r),l=el('label','',dc),cb=el('input','',l);cb.type='checkbox';const lt=document.createTextNode(n.slice(0,3));l.append(lt);
  const o={r,cb,lt,i,more:[],wk:1};cardHead(o,dc);wkCtl(o,wcell(r),o);rowCtl(o,r,o);rowSub(o,r);   // alt: the day band (R-UI-07)
  o.upd=()=>{const on=cb.checked;[o,...o.more].forEach(x=>{x.r.classList.toggle('off',!on);[x.s,x.en,x.ps,x.wb,x.tsel,x.cp,x.ad,x.x,x.wkb].forEach(c=>{if(c)c.disabled=!on});x.sub.style.display=on&&x.tm==='edge'?'':'none'})};
  cb.onchange=()=>{if(cb.checked)newDay(o);o.upd();updWarn();updOc()};
  return o};
/* a phone (R-UI-07): each time is a card that folds to its header — a button with its title and, folded, a summary (10:00–11:00 · Ann);
   one card is open at a time. Times are added with "+ Add a time" (a day, and a week with different times per week) and removed with ✕. */
function cardHead(x,c){x.sb=el('button','sum',c);x.sb.type='button';x.dn=el('b','dn',x.sb);x.sm=el('span','sm',x.sb);x.sb.setAttribute('aria-expanded','false');x.sb.onclick=()=>cardOpen(x.r.classList.contains('open')?null:x)}
function wcell(r){const c=el('span','wcell',r);el('span','wkw',c);return c}   // the week of a time: its own column on a computer, "Week [1] – Monday" on a phone card
function allLines(){return rows.flatMap(o=>[o,...o.more])}
function cardOpen(x){allLines().forEach(y=>{const on=y===x;y.r.classList.toggle('open',on);y.sb.setAttribute('aria-expanded',String(on))})}
function cardSums(){allLines().forEach(x=>{const ps=dkind==='event'&&x.ps.selectedOptions[0];
  x.sm.textContent=[fmt(+x.s.value)+'–'+fmtEnd(+x.en.value),ps&&ps.textContent,x.tm==='flex'?L('tmAround'):x.tm==='edge'?L('tmEdge'):''].filter(Boolean).join(' · ')})}
function rmFirst(o){   // ✕ on a day's first time: its next time moves up, or the day is unticked
  if(o.more.length){const x=o.more.shift();copyVals(o,x);o.src=x.src;x.r.remove();o.more.forEach((z,k)=>rowTexts(z,o,k))}else{o.cb.checked=false;o.cb.onchange();return}
  o.upd();updWarn();updOc()}
function addPop(){   // "+ Add a time": the week (with different times per week) and the day
  document.querySelectorAll('.wpop,.cpop,.cmenu').forEach(x=>x.remove());
  const b=$('fAddT'),m=el('div','omenu cmenu addm',b.closest('dialog')||document.body);m.setAttribute('role','menu');el('div','oh',m).textContent=L('addTH');let wk=state.curWk>cyc()?1:state.curWk;
  const close=()=>{m.remove();document.removeEventListener('pointerdown',out,true)},out=e=>{if(!m.contains(e.target)&&e.target!==b)close()};
  if(dWk.pw){const wr=el('div','addw',m),wbs=[];el('span','',wr).textContent=L('addTW');
    for(let w=1;w<=cyc();w++){const x=el('button','',wr);x.type='button';x.textContent=w;x.setAttribute('aria-label',wkLabel(w));wbs.push(x);x.onclick=()=>{wk=w;wbs.forEach((y,k)=>y.setAttribute('aria-pressed',String(k+1===w)))}}
    wbs.forEach((y,k)=>y.setAttribute('aria-pressed',String(k+1===wk)))}
  const dr=el('div','addd',m);rows.forEach((o,i)=>{const x=el('button','oi',dr);x.type='button';x.setAttribute('role','menuitem');x.textContent=DAYS[i];
    x.onclick=()=>{close();let line;if(!o.cb.checked){o.cb.checked=true;o.cb.onchange();line=o}else line=addTime(o);
      if(dWk.pw){wkSet(line,wk);sortDay(o)}o.upd();updWarn();cardOpen(line);line.r.scrollIntoView?.({block:'nearest'});b.focus()}});
  m.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();b.focus()}};
  const rc=b.getBoundingClientRect();m.style.left=Math.max(6,Math.min(rc.left,innerWidth-m.offsetWidth-6))+'px';m.style.top=Math.max(6,Math.min(rc.top-m.offsetHeight-4,innerHeight-m.offsetHeight-6))+'px';
  setTimeout(()=>document.addEventListener('pointerdown',out,true));m.querySelector('.addd .oi').focus();
}
function addTime(o,sl){   // a further time on day o, on a line of its own below the day's last line
  const last=[o,...o.more].at(-1),x={wk:sl&&sl.wk||last.wk},r=document.createElement('div');r.className='dr dx'+(o.i%2?' alt':'');last.r.after(r);x.r=r;const dl=el('span','dl',r);cardHead(x,dl);wkCtl(x,wcell(r),o);
  rowCtl(x,r,o);rowSub(x,r);fillSel(x.s,curStl);fillSel(x.en,curEtl);fillSel(x.ps,perfOpts());o.more.push(x);rowTexts(x,o,o.more.length-1);
  // by default it starts where the day's last time ends (or with it, late at night), for an hour, performed by the owner; with different
  // times per week (R-CYC-08), the same times in the next week that has none on that day yet
  const used=new Set([o,...o.more].map(y=>y.wk)),nx=dWk.pw&&!sl?[...Array(cyc()).keys()].map(k=>(last.wk+k)%cyc()+1).find(w=>!used.has(w)):null;
  const st=sl?sl.start:nx?+last.s.value:+last.en.value<=1380?+last.en.value:+last.s.value;
  if(nx)wkSet(x,nx);rowLoad(x,sl||{start:st,end:nx?+last.en.value:Math.min(state.MAXEND,st+60),fo:true});o.upd();if(!sl)x.s.scrollIntoView?.({block:'nearest'});return x;   // a time added with + is scrolled into view
}
function newDay(o){   // a newly ticked day: the times of the nearest ticked day above it (else below), the owner, the default With, fixed
  const t=[...rows.slice(0,o.i).reverse(),...rows.slice(o.i+1)].find(x=>x.cb.checked);
  rowLoad(o,{start:t?+t.s.value:540,end:t?+t.en.value:600,fo:true});wkSet(o,Math.min(state.curWk,cyc()));   // with different times per week, in the week shown
}
function updTyIc(){const t=state.S.types.find(x=>x.id===$('fTy').value);$('fTyIc').innerHTML=t?tIcon(t.icon):'';$('fTyIc').style.color=t?t.color:''}
function updEnd(sSel,eSel){[...eSel.options].forEach(o=>{o.disabled=+o.value<=+sSel.value})}
function formSlots(){const a=[];rows.forEach((o,i)=>{if(o.cb.checked)[o,...o.more].forEach(x=>a.push({day:i,...rowSlot(x)}))});return a}
function updWarn(){
  const ev=dkind==='event',items=rows.filter(o=>o.cb.checked).flatMap(o=>[o,...o.more].map(x=>({o:x,day:o.i,...(ev?rowSlot(x):{start:+x.s.value,end:+x.en.value,person:'',...(dWk.pw?{wk:x.wk}:{})})})));
  rows.forEach(o=>[o,...o.more].forEach(x=>x.wn.style.visibility='hidden'));
  const set=overlapSet({oncall:ev&&$('fOnCall').checked,involved:ev?defInv():[],...(!dWk.pw&&dWk.weeks.size<cyc()?{weeks:[...dWk.weeks]}:{})},items);   // as it would be saved: performers and With lists count (R-REP-05)
  items.forEach(s=>{if(set.has(s))s.o.wn.style.visibility='visible'});
  if(ev)updTurns(items);
  const n=[...new Set(items.filter(s=>set.has(s)).map(s=>DAYS[s.day]))];$('fWarn').textContent=n.length?'⚠ '+L('ovDlg',{d:n.join(', ')}):'';cardSums();dTabs()[1].classList.toggle('warn',!!n.length);   // the When tab on a phone (R-UI-14)
}
function refreshDlg(){updWarn();updOc()}
function updTurns(items){   // the rota's turns per person while the table is edited (R-CYC-18)
  const md=$('fTuM').value,t=turnsOf({...(!dWk.pw&&dWk.weeks.size<cyc()?{weeks:[...dWk.weeks]}:{})},items,md==='y'?true:md==='n'?false:undefined),c=$('fTu');c.textContent='';c.title='';if(!t)return;
  if(!t.size){c.textContent=L('tuNobody');return}
  const nm=id=>(state.S.people.find(q=>q.id===id)||{}).name;c.textContent=[...t].map(([id,a])=>nm(id)+' '+tuSum(a)).join(' · ');el('small','',c).textContent=' '+L(cyc()>1?'tuCyc':'tuWk');
  c.title=cyc()>1?[...Array(cyc()).keys()].map(k=>wkLabel(k+1)+': '+[...t].map(([id,a])=>nm(id)+' '+a[k]).join(' · ')).join('\n'):'';
}
function updOwn(){   // the owner's icon, and "Owner (name)" in every performer list
  const q=state.S.people.find(x=>x.id===$('fOw').value);$('fOwIc').innerHTML=q?ICON_USER:'';$('fOwIc').style.color=q?q.color:'';
  rows.flatMap(o=>[o,...o.more]).forEach(o=>{const op=o.ps.querySelector(`option[value="${OWN}"]`);if(op)op.textContent=ownLbl()});
}
const updBg=()=>{$('fNest').disabled=$('fBg').checked||$('fAw').checked;updOc()};   // strips never nest (R-EVT-19, R-EVT-24)
// "only on call" matters only while somebody is involved, by default or on some day
const updOc=()=>{$('fOcRow').style.display=!$('fAw').checked&&(defInv().length||tmItems().some(o=>o.inv&&o.inv.length))?'':'none'};   // on call does not apply to Away (R-EVT-24)
// R-UI-10: the event/phase dialog can be dragged aside (by its grip bar or an empty part of it) to look at the grid behind it. It is placed
// with left/top, not a transform, so the fixed-position menus inside it keep their viewport coordinates; it opens in the middle every time.
function dlgPlace(x,y){const d=$('dlg');if(x==null){d.classList.remove('moved');d.style.left=d.style.top='';return}
  const r=d.getBoundingClientRect(),w=r.width||0,k=120;   // at least 120 px of it (and the grip bar's height) stay in the window
  d.classList.add('moved');d.style.left=Math.round(Math.max(k-w,Math.min(innerWidth-k,x)))+'px';d.style.top=Math.round(Math.max(0,Math.min(innerHeight-40,y)))+'px'}
const DLG_NODRAG='input,select,textarea,label,a,button:not(.dgrip),.chips,#paneQ,.omenu,.cpop,.wpop';
function dragDlg(ev){const d=$('dlg');if(phone()||ev.button||ev.target.closest(DLG_NODRAG))return;   // full screen on a phone (R-UI-14)
  ev.preventDefault();const r=d.getBoundingClientRect(),ox=ev.clientX-r.left,oy=ev.clientY-r.top,g=ev.target.closest('.dgrip');if(g)g.focus();
  const mv=e=>dlgPlace(e.clientX-ox,e.clientY-oy),up=()=>{document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',up)};
  document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up)}
function gripKey(ev){const v={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[ev.key];if(!v||phone())return;ev.preventDefault();
  const r=$('dlg').getBoundingClientRect();dlgPlace(r.left+v[0],r.top+v[1])}
// R-UI-14: on a phone the event dialog shows one tab at a time (Event · When · More; the CSS hides the other panes and, on a desktop, the
// tab row). Every open starts on Event; the jump to the clicked repetition (R-UI-12) waits until When is first shown, as a hidden pane can't scroll
let dJump=null;
const dTabs=()=>[...$('dlg').querySelectorAll('.dtabs button')];
function dlgTab(k,focus){
  $('dlg').querySelectorAll('.dpane').forEach(p=>p.classList.toggle('off',p.dataset.p!==k));
  dTabs().forEach(b=>{const on=b.dataset.p===k;b.classList.toggle('on',on);b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;if(on&&focus)b.focus()});
  if(k==='wh'&&dJump){const s=dJump;dJump=null;dlgJump(s)}
}
function tabKey(ev){const d=ev.key==='ArrowRight'?1:ev.key==='ArrowLeft'?-1:0;if(!d)return;ev.preventDefault();
  const bs=dTabs(),i=bs.findIndex(b=>b.classList.contains('on'));dlgTab(bs[(i+d+bs.length)%bs.length].dataset.p,true)}
// a failed save shows its message on the tab with the field it is about, and marks that tab until the next save or open
const dErr=(k,msg)=>{$('err').textContent=msg;dlgTab(k);dTabs().find(b=>b.dataset.p===k).classList.add('bad')};
// R-UI-12: opening a repeating event (or phase) from the grid brings the clicked repetition's line into view, centred in the day table only
// when it is not fully visible below the sticky header, and makes it pulse once
function dlgJump(s){
  const ln=rows.flatMap(o=>[o,...o.more]).find(l=>l.src===s);if(!ln)return;
  const p=$('paneQ'),rs=[...ln.r.children].map(c=>c.getBoundingClientRect()).filter(r=>r.height);
  if(rs.length){const dh=p.querySelector('.dhd'),hd=getComputedStyle(dh).display==='contents'?dh.firstElementChild:dh,pr=p.getBoundingClientRect(),
    top=Math.min(...rs.map(r=>r.top)),bot=Math.max(...rs.map(r=>r.bottom)),v0=pr.top+hd.getBoundingClientRect().height,v1=pr.top+p.clientHeight;
    if(top<v0-1||bot>v1+1)p.scrollTop+=(top+bot)/2-(v0+v1)/2}
  const r=ln.r;r.classList.remove('pulse');void r.offsetWidth;r.classList.add('pulse');clearTimeout(r._pt);r._pt=setTimeout(()=>r.classList.remove('pulse'),1600);
}
export function openDlg(e,def,src){   // src: the repetition that was clicked, to jump to in the day table (R-UI-12)
  const kind=e?(e.rhythms?'phase':'event'):(state.editMode==='phases'?'phase':'event');
  if(kind==='phase'&&!e&&!state.S.rhythms.length){toast(L('noRh'));return}
  dkind=kind;state.MAXEND=kind==='phase'?1440:2880;$('dlg').classList.toggle('ph',kind==='phase');
  cur=e;const d=e||(kind==='phase'?{title:'',desc:'',color:PAL[state.S.phases.length%PAL.length],involved:[],rhythms:[(vrhythm()||state.S.rhythms[0]).id]}:{title:'',desc:'',color:PAL[state.S.events.length%PAL.length],involved:[],schedules:state.S.schedules.filter(s=>s.visible).slice(0,1).map(s=>s.id)});
  const slots=e?cycSl(e.slots):[{day:0,start:540,end:600,person:'',fo:true,...def}];   // the times of the cycle's weeks; staged weeks' own times wait aside (R-CYC-22)
  {const n=cyc(),pw=!!(e&&e.slots.some(x=>x.wk)),cw=e&&e.weeks&&e.weeks.filter(inCyc);
   dWk={pw,weeks:new Set(cw&&cw.length?cw:def&&def.wk?[def.wk]:[...Array(n).keys()].map(k=>k+1)),   // R-CYC-08; created in a week's column, that week (R-CYC-19)
     stgW:e&&!pw?(e.weeks||[...Array(kept()).keys()].map(k=>k+1)).filter(k=>k>n):[],stgL:pw?e.slots.filter(stgSl).map(x=>({...x})):[],base:e&&!pw?e.slots.map(x=>({...x})):[],nw:!e}}
  curStl=[];curEtl=[];for(let m=0;m<=1425;m+=SNAP)curStl.push([m,fmt(m)]);for(let m=SNAP;m<=state.MAXEND;m+=SNAP)curEtl.push([m,endLabel(m)]);
  $('fT').value=d.title;$('fD').value=d.desc||'';setFC(d.color);
  // the owner: our people, plus a current owner who has since become external (kept, marked)
  fillSel($('fOw'),[['',L('none')],...state.S.people.filter(q=>!q.external||q.id===d.owner).map(q=>[q.id,q.name+(q.external?' ('+L('extSuf')+')':'')])]);$('fOw').value=d.owner||'';
  const iv=$('fInv');iv.innerHTML='';
  if(!ourPeople().length)iv.textContent=L('noPeople');   // external people are never offered as involved (R-PPL-03)
  ourPeople().forEach(q=>{const l=el('label','',iv);const i=el('input','',l);i.type='checkbox';i.value=q.id;i.checked=(d.involved||[]).includes(q.id);l.insertAdjacentHTML('beforeend',pTag(q.id))});
  rows.forEach((o,i)=>{o.more.forEach(x=>x.r.remove());o.more=[];const sl=slots.filter(x=>x.day===i).sort((a,b)=>(a.wk||0)-(b.wk||0)||a.start-b.start);
    fillSel(o.s,curStl);fillSel(o.en,curEtl);fillSel(o.ps,perfOpts());o.cb.checked=!!sl.length;rowLoad(o,sl[0]||{start:540,end:600,fo:true});wkSet(o,sl[0]&&sl[0].wk||state.curWk);o.src=sl[0]||null;sl.slice(1).forEach(x=>{addTime(o,x).src=x});o.upd()});
  drawWk();
  updOwn();
  const c=$('fSch');c.innerHTML='';
  (kind==='phase'?state.S.rhythms:state.S.schedules).forEach(s=>{const l=el('label','',c);const i=el('input','',l);i.type='checkbox';i.value=s.id;i.checked=(kind==='phase'?d.rhythms:d.schedules).includes(s.id);
    l.insertAdjacentHTML('beforeend',kind==='phase'?`<span class="ic">${ICON_RHYTHM}</span>${esc(s.name)}`:sTag(s))});
  fillSel($('fTuM'),[['',L('tuAuto')],['y',L('tuYes')],['n',L('tuNo')]]);$('fTuM').value=d.turns===true?'y':d.turns===false?'n':'';$('fTuM').setAttribute('aria-label',L('tuMode'));   // R-CYC-18
  $('fOnCall').checked=!!d.oncall;$('fNest').checked=!!d.nest;$('fBg').checked=!!d.bg;$('fAw').checked=!d.bg&&!!d.away;$('fBox').checked=!d.bg&&!d.away;updBg();$('fC').setAttribute('aria-label',tr('Colour'));
  $('fTy').setAttribute('aria-label',L('tyLbl'));fillSel($('fTy'),[['',L('tyNone')],...state.S.types.map(t=>[t.id,t.name])]);$('fTy').value=d.type&&state.S.types.some(t=>t.id===d.type)?d.type:'';updTyIc();updCols();
  $('fDel').style.display=e?'':'none';$('fCopy').style.display=e?'':'none';$('err').textContent='';
  refreshDlg();
  dTabs().forEach(b=>b.classList.remove('bad'));dJump=null;dlgTab('ev');
  {const on=allLines().filter(x=>rows[0]&&!x.r.classList.contains('off')),s=on.find(x=>src&&x.src===src);cardOpen(s||(on.length===1?on[0]:null))}   // the card that opens on a phone
  dlgPlace(null);$('dlg').showModal();$('fT').focus();if(e&&src&&e.slots.length>1){if(phone())dJump=src;else dlgJump(src)}
}
function saveDlg(){
  const title=$('fT').value.trim(),sch=[...$('fSch').querySelectorAll('input:checked')].map(i=>i.value);dTabs().forEach(b=>b.classList.remove('bad'));
  const slots=formSlots().sort((a,b)=>a.day-b.day||(a.wk||0)-(b.wk||0)||a.start-b.start);
  if(!title)return dErr('ev',L('errTitle'));
  if(!slots.length)return dErr('wh',L('errDay'));
  const bad=slots.find(s=>s.end<=s.start);
  if(bad)return dErr('wh',L('errEnd',{d:DAYS[bad.day]}));
  const thin=dkind==='event'&&slots.find(s=>(s.fs||0)+(s.fe||0)>s.end-s.start-SNAP);
  if(thin)return dErr('wh',L('errCore',{d:DAYS[thin.day]}));
  if(!sch.length)return dErr('mo',L(dkind==='phase'?'errRh':'errSch'));
  const wks=dWk.pw?{}:patW(),all=[...slots,...stgLines()];   // R-CYC-02/03; staged weeks keep theirs (R-CYC-22)
  const d=dkind==='phase'?{title,desc:$('fD').value.trim(),color:$('fC').dataset.v,...wks,rhythms:sch,slots:all.map(({day,start,end,wk})=>({day,start,end,...(wk?{wk}:{})}))}
    :{title,desc:$('fD').value.trim(),color:$('fC').dataset.v,...($('fTy').value?{type:$('fTy').value}:{}),...($('fOw').value?{owner:$('fOw').value}:{}),...($('fOnCall').checked?{oncall:true}:{}),...($('fTuM').value?{turns:$('fTuM').value==='y'}:{}),...($('fNest').checked?{nest:true}:{}),...($('fBg').checked?{bg:true}:$('fAw').checked?{away:true}:{}),...wks,schedules:sch,slots:all,involved:defInv()};
  if(d.away&&!slots.some(x=>x.person||(x.inv||defInv()).length))return dErr('wh',L('errAway'));   // somebody must be away (R-EVT-24)
  hist();
  if(cur&&dkind==='event'){delete cur.type;delete cur.owner;delete cur.oncall;delete cur.nest;delete cur.bg;delete cur.away;delete cur.turns}if(cur)delete cur.weeks;
  if(cur)Object.assign(cur,d);else (dkind==='phase'?state.S.phases:state.S.events).push({id:uid(),...d});
  normWk(cur||(dkind==='phase'?state.S.phases:state.S.events).at(-1),kept());
  $('dlg').close();render();
}
// R-CYC-23: an event or phase that also happens in staged weeks asks whether those go too, or stay as they are
function delDlg(){const e=cur,ph=dkind==='phase',del=()=>{hist();if(ph)state.S.phases=state.S.phases.filter(x=>x!==e);else state.S.events=state.S.events.filter(x=>x!==e);render()};$('dlg').close();
  const sg=stgWks(e);if(!sg.length){del();return}
  const keep=()=>{hist();if(e.slots.some(x=>x.wk))e.slots=e.slots.filter(stgSl);else e.weeks=sg;normWk(e,kept());render()};
  setTimeout(()=>xdlg({title:L(ph?'delPhT':'delEvT'),body:`<p>${esc(L('delStgBody',{t:e.title,w:wksText(sg)}))}</p>`,stack:true,
    buttons:[{label:L('delCyc',{w:wksText(sg)}),cls:'p',fn:keep},{label:L('delAll'),fn:del},{label:L('cancel'),dismiss:true}]}),0)}
// wiring of the dialog's own controls (called once by main.js; handlers are set here, never as inline handlers, which the CSP forbids: R-SEC-01)
export function initDialog(){
  $('f').onsubmit=()=>false;   // the dialog's form never submits
  $('fC').onclick=()=>pickColor($('fC'),$('fC').dataset.v,setFC);
  rows=DAYS.map(dayRow);
  $('fAddT').onclick=addPop;
  $('fTy').onchange=()=>{updTyIc();updCols()};
  $('fOw').onchange=()=>{updOwn();updCols();updWarn()};$('fOnCall').onchange=updWarn;$('fTuM').onchange=updWarn;
  ['fBox','fBg','fAw'].forEach(k=>$(k).onchange=updBg);
  $('fInv').onchange=()=>{rows.flatMap(o=>[o,...o.more]).forEach(o=>wSet(o,o.inv));refreshDlg()};
  $('dlg').addEventListener('pointerdown',dragDlg);$('dGrip').onkeydown=gripKey;
  dTabs().forEach(b=>b.onclick=()=>dlgTab(b.dataset.p));$('dlg').querySelector('.dtabs').onkeydown=tabKey;
  $('fOk').onclick=saveDlg;$('fCancel').onclick=()=>$('dlg').close();$('fDel').onclick=delDlg;
  $('fCopy').onclick=()=>{const e=cur;$('dlg').close();openCopy(e)};
}
/* ---------- copy dialog ---------- */
export function openCopy(src){
  const isPh=!!src.rhythms,mem=isPh?src.rhythms:src.schedules;let lst=isPh?state.S.rhythms:state.S.schedules,tw=null;   // tw: another workspace (events only, R-DATA-04)
  const body=el('div');el('p','note',body).textContent=L('cpNote');
  let wsel=null;if(!isPh&&state.WS.length>1){el('label','',body).textContent=L('cpWs');wsel=el('select','',body);fillSel(wsel,state.WS.map(w=>[w.id,w.id===state.curId?L('cpThis',{n:w.name}):w.name]));wsel.value=state.curId;wsel.setAttribute('aria-label',L('cpWs'))}
  el('label','',body).textContent=L(isPh?'cpDestR':'cpDest');
  const sel=el('select','',body);sel.setAttribute('aria-label',L(isPh?'cpDestR':'cpDest'));   // its label above is not tied to it
  const fillDest=()=>{tw=wsel&&wsel.value!==state.curId?state.WS.find(w=>w.id===wsel.value):null;lst=tw?tw.data.schedules:isPh?state.S.rhythms:state.S.schedules;fillSel(sel,lst.map(s=>[s.id,s.name]));
    const o=!tw&&lst.find(s=>!mem.includes(s.id));if(o)sel.value=o.id;const mv=$('xDlg').querySelectorAll('.btns button')[1];if(mv&&mv.dataset.mv)mv.style.display=tw?'':'none'};
  fillDest();
  el('label','',body).textContent=L('cpColor');
  const rd=el('div','radios',body);let pv=src.color;
  const modes=[['same','cpSame'],['tweak','cpHue'],['random','cpRandom'],['pick','cpPick']],rad={};
  modes.forEach(([m,k])=>{const l=el('label','',rd),i=el('input','',l);i.type='radio';i.name='cpm';i.value=m;rad[m]=i;l.append(L(k));
    if(m==='pick'){const sw=el('button','swatch',l);sw.type='button';sw.style.cssText='width:44px;height:22px;margin-left:6px;background:'+pv;
      sw.onclick=e=>{e.preventDefault();pickColor(sw,pv,c=>{pv=c;sw.style.background=c;rad.pick.checked=true})}}});
  const auto=()=>{rad[!tw&&mem.includes(sel.value)?'tweak':'same'].checked=true};
  sel.onchange=auto;if(wsel)wsel.onchange=()=>{fillDest();auto()};auto();
  const go=move=>{
      const tid=sel.value,mode=Object.keys(rad).find(m=>rad[m].checked);
      const used=(isPh?state.S.phases:(tw?tw.data:state.S).events).filter(e=>(isPh?e.rhythms:e.schedules).includes(tid)).map(e=>normHex(e.color));
      const col=mode==='tweak'?shiftColor(src.color,used):mode==='random'?randomColor(used):mode==='pick'?pv:src.color;
      if(tw){const t=tw;setTimeout(()=>carryEvents([{...src,color:col}],t,()=>tid,()=>{if(move){pushUndoWs(cw());state.S.events=state.S.events.filter(e=>e!==src)}render();toast(L(move?'trMoved':'trDone',{n:t.name}))}),0);return}   // to another workspace (R-DATA-04)
      hist();const c=JSON.parse(JSON.stringify(src));c.id=uid();if(isPh)c.rhythms=[tid];else c.schedules=[tid];c.color=col;(isPh?state.S.phases:state.S.events).push(c);render();toast(L('copied'))};
  xdlg({title:L('cpTitle')+': '+src.title,full:true,body,buttons:[
    {label:L('cpDo'),cls:'p',fn:()=>go(false)},
    ...(wsel?[{label:L('cpMove'),fn:()=>go(true)}]:[]),
    {label:L('cancel'),dismiss:true}]});
  if(wsel){const mv=$('xDlg').querySelectorAll('.btns button')[1];mv.dataset.mv='1';mv.title=L('cpMoveTip');mv.style.display='none'}   // Move: only to another workspace
}
