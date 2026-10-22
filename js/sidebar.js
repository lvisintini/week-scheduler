// The sidebar. Classic script: shares the global scope with the other files in js/, loaded in the order of index.html (docs/architecture.md).
/* ---------- sidebar ---------- */
function eyeBtn(parent,vis,toggle){const b=el('button','eye'+(vis?'':' off'),parent);b.innerHTML=vis?ICON_EYE:ICON_EYE_OFF;b.title=L('eyeTip');b.onclick=toggle;return b}
function sbtn(parent,label,tip,fn,cls,icon){const b=el('button',cls||'',parent);if(icon)b.innerHTML=icon;b.append(label);b.title=tip;b.onclick=fn;return b}
function h2(parent,text,tip){const h=el('h2','',parent);h.append(text+' ');if(tip){const t=el('span','tip',h);t.textContent='ⓘ';t.title=tip}return h}
function rowMenu(anchor,build){
  document.querySelectorAll('.omenu').forEach(x=>x.remove());
  const m=el('div','omenu',document.body);
  const close=()=>{m.remove();document.removeEventListener('pointerdown',out,true);document.removeEventListener('keydown',key,true);renderSide()};
  const out=e=>{if(!m.contains(e.target))close()},key=e=>{if(e.key==='Escape')close()};
  const mi=(html,label,fn,cls)=>{const b=el('button','oi '+(cls||''),m);b.innerHTML=html+`<span>${esc(label)}</span>`;b.onclick=()=>{close();fn()}};
  build(m,mi,close);
  const r=anchor.getBoundingClientRect();
  m.style.left=Math.max(6,Math.min(r.right-m.offsetWidth,innerWidth-m.offsetWidth-6))+'px';
  m.style.top=Math.max(6,Math.min(r.bottom+4,innerHeight-m.offsetHeight-6))+'px';
  setTimeout(()=>{document.addEventListener('pointerdown',out,true);document.addEventListener('keydown',key,true)});
}
const chip=c=>`<i style="background:${esc(c)}"></i>`;
function schMenu(anchor,s){rowMenu(anchor,(m,mi)=>{
  mi(chip(s.color),L('mColor'),()=>pickColor(anchor,s.color,v=>{hist();s.color=v;render()}));
  const ow=el('div','oi opw',m);ow.title=L('opTip');ow.innerHTML=ICON_OPAC;
  const sl=el('input','',ow);sl.type='range';sl.min=.1;sl.max=1;sl.step=.05;sl.value=s.opacity??1;
  sl.oninput=()=>{s.opacity=+sl.value;skipSide=true;render();skipSide=false};
  mi(s.locked?ICON_UNLOCK:ICON_LOCK,L(s.locked?'mUnlock':'mLock'),()=>{hist();s.locked=!s.locked;render()});
  mi(ICON_EYE,L('mSolo'),()=>{const only=S.schedules.every(x=>x===s?x.visible:!x.visible);S.schedules.forEach(x=>x.visible=only?true:x===s);render()});
  mi(ICON_WS,L('mTransfer'),()=>openTransfer('schedule',s));
  mi('<span class="ic" style="margin:0">'+ICON_CAL+'</span>',L('mDelete'),()=>delSchedule(s),'d');
})}
function perMenu(anchor,q){rowMenu(anchor,(m,mi)=>{
  mi(chip(q.color),L('mColor'),()=>pickColor(anchor,q.color,v=>{hist();q.color=v;render()}));
  if(!q.external)mi(ICON_STATS,L('stMenu'),()=>openStats(q.id));
  mi(q.external?ICON_CHECK:'<span class="ic" style="margin:0"></span>',L('mExt'),()=>{hist();if(q.external)delete q.external;else q.external=true;render()});m.lastChild.title=L('extTip');
  mi(ICON_WS,L('pcMenu'),()=>openPeopleCopy(q));   // R-DATA-04
  mi('<span class="ic" style="margin:0">'+ICON_USER+'</span>',L('mDelete'),()=>delPerson(q),'d');
})}
function iconMenu(anchor,t){rowMenu(anchor,(m,mi,close)=>{
  el('div','oh',m).textContent=L('iconTitle');
  const g=el('div','igrid',m);
  Object.keys(TICONS).forEach(k=>{const b=el('button',k===t.icon?'on':'',g);b.type='button';b.innerHTML=tIcon(k);b.title=iconName(k);b.setAttribute('aria-label',iconName(k));
    b.onclick=()=>{close();if(k!==t.icon){hist();t.icon=k;render()}}});
})}
function tyMenu(anchor,t){rowMenu(anchor,(m,mi)=>{
  mi(chip(t.color),L('mStatColor'),()=>pickColor(anchor,t.color,v=>{hist();t.color=v;render()}));
  mi(tIcon(t.icon),L('mIcon'),()=>iconMenu([...document.querySelectorAll('.tysec .pick')].find(x=>x._ty===t.id)||anchor,t));   // the menu closed and the sidebar was redrawn: anchor on the new row
  mi(t.soft?ICON_CHECK:'<span class="ic" style="margin:0"></span>',L('mSoft'),()=>{hist();if(t.soft)delete t.soft;else t.soft=true;render()});m.lastChild.title=L('softTip');
  mi(tIcon(t.icon),L('mDelete'),()=>delType(t),'d');
})}
function delType(t){
  const lost=S.events.filter(e=>e.type===t.id).length;
  if(!confirm(L('confTy',{n:t.name})+(lost?L('confTyLost',{k:lost}):'')))return;hist();
  S.types=S.types.filter(x=>x!==t);S.events.forEach(e=>{if(e.type===t.id)delete e.type});render();
}
function gripFor(row,list,item,grp=list,tip='gripTip'){   // reorder a sidebar list by dragging the grip (or with the arrow keys while it has focus); grp = the rows shown together (a sub-group of list)
  const g=el('button','grip',row);g.type='button';g.innerHTML=ICON_GRIP;g.title=L(tip);g.setAttribute('aria-label',L('gripLbl',{n:item.name}));g._item=item;
  const move=to=>{const i=grp.indexOf(item);if(to===i||to<0||to>=grp.length)return false;const tg=grp[to];hist();
    list.splice(list.indexOf(item),1);list.splice(list.indexOf(tg)+(to>i?1:0),0,item);render();return true};   // lands just before/after the group neighbour it replaces
  g.onkeydown=ev=>{const d=ev.key==='ArrowUp'?-1:ev.key==='ArrowDown'?1:0;if(!d)return;ev.preventDefault();
    if(move(grp.indexOf(item)+d)){const b=[...document.querySelectorAll('#sbin .grip')].find(x=>x._item===item);if(b)b.focus()}};
  g.onpointerdown=ev=>{if(ev.button)return;ev.preventDefault();ev.stopPropagation();
    const rows=[...row.parentNode.children].filter(r=>r.classList.contains('sch')&&r.querySelector('.grip')),from=rows.indexOf(row);let to=from;row.classList.add('dragging');
    const clear=()=>rows.forEach(r=>r.classList.remove('dropb','dropa'));
    const mv=e=>{let k=rows.findIndex(r=>{const b=r.getBoundingClientRect();return e.clientY<b.top+b.height/2});if(k<0)k=rows.length;to=k>from?k-1:k;clear();
      if(to!==from)(rows[k]||rows[rows.length-1]).classList.add(rows[k]?'dropb':'dropa')};
    const up=()=>{document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);clear();row.classList.remove('dragging');if(to!==from)move(to)};
    document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up)};
  return g;
}
function secHead(parent,key,count,tipKey,ck,addFn,addTip){
  const h=el('div','sech',parent);
  const b=el('button','shbtn',h);b.innerHTML=(prefs[ck]?ICON_CR:ICON_CD)+`<span>${esc(L(key))}</span>`+(count==null?'':`<em>${count}</em>`);
  b.onclick=()=>{prefs[ck]=!prefs[ck];savePrefs();renderSide()};
  const tp=el('span','tip',h);tp.textContent='ⓘ';tp.title=L(tipKey);
  if(addFn){const a=el('button','eye',h);a.innerHTML=ICON_PLUS;a.title=L(addTip);a.onclick=addFn}
}
function renderSide(){
  const sb=$('sbin'),st=sb.scrollTop;sb.innerHTML='';
  const top=el('div','sbtop',sb);
  const fav=el('img','fav',top);fav.src=FAV;fav.alt='';
  const ttl=el('span','ttl',top);ttl.textContent=L('appTitle')+(anyDirty()?' •':'');if(anyDirty())ttl.title=L('unsaved');
  const hb=el('button','eye help',top);hb.innerHTML=ICON_HELP;hb.title=L('helpTip');hb.onclick=openHelp;
  const gb=el('button','eye gear',top);gb.innerHTML=ICON_GEAR;gb.title=L('settings');gb.onclick=openSettings;
  const cl=el('button','eye xpand',top);cl.innerHTML=prefs.collapsed?ICON_CR:ICON_CL;cl.title=L(prefs.collapsed?'expandTip':'collapseTip');
  cl.onclick=()=>{prefs.collapsed=!prefs.collapsed;savePrefs();applyPrefs();renderSide()};
  {const lb=el('button','eye lvr',top);lb.id='lvR';lb.type='button';lb.onclick=()=>setLive(!live);
   const nb=el('button','eye lvnow',top);nb.id='lvF';nb.type='button';nb.innerHTML=ICON_NOW;nb.onclick=liveBack;updLive()}   // a phone: Live View and its Now float (R-GRID-12)   // Live View one tap away on the collapsed rail (R-GRID-12)
  const body=el('div','sbbody',sb);
  const wb=el('button','wsbtn',body);wb.innerHTML=`<span class="ic">${ICON_WS}</span><span class="wsn"></span><span class="chev">${ICON_CD}</span>`;
  wb.querySelector('.wsn').textContent=cw().name+(isDirty()?' •':'');wb.title=L('wsMenuTip');wb.onclick=()=>wsMenu(wb);
  const sg=el('div','seg',body);
  [['events','modeEv'],['phases','modePh']].forEach(([m,k])=>{const b=el('button',editMode===m?'on':'',sg);b.textContent=L(k);b.title=L('modeTip');
    b.onclick=()=>{if(editMode===m)return;editMode=m;selK=null;if(m==='phases'&&S.rhythms.length&&!vrhythm())S.rhythms[0].visible=true;render()}});
  const tb=el('div','tbar',body);
  const tbtn=(icon,tip,fn,id,cls)=>{const b=el('button',cls||'',tb);b.innerHTML=icon;b.title=tip;b.setAttribute('aria-label',tip);b.onclick=fn;if(id)b.id=id};
  tbtn(ICON_PLUS,L(editMode==='phases'?'addPhT':'addEvT'),()=>openDlg(null),null,'p');
  tbtn(ICON_UNDO,L('undoTip'),undo,'undoB');tbtn(ICON_REDO,L('redoTip'),redo,'redoB');updUR();
  tbtn(ICON_SAVE,L('saveTip'),()=>xdlg({title:L('saveTitle'),body:`<p>${esc(L('saveBody'))}</p>`,buttons:[{label:L('toMem'),cls:'p',fn:()=>saveTo('mem')},{label:L('toFile'),fn:()=>saveTo('file')},{label:L('toLink'),fn:()=>saveTo('link')},{label:L('cancel'),dismiss:true}]}));
  tbtn(ICON_FOLDER,L('loadTip'),()=>xdlg({title:L('loadTitle'),body:`<p>${esc(L('loadBody'))}</p>`,buttons:[{label:L('toMem'),cls:'p',fn:loadMem},{label:L('toFile'),fn:()=>$('file').click()},{label:L('cancel'),dismiss:true}]}));
  tbtn(ICON_PRINT,L('printTip'),ev=>{const one=()=>focusD!=null?printDay(focusD):printSchedule();   // prints what is on screen
    if(cyc()<2)return one();rowMenu(ev.currentTarget,(m,mi)=>{mi(ICON_PRINT,allWk?L('prView'):L('prThis',{n:curWk}),one);mi(ICON_PRINT,L('prAll'),printAll)})});   // with a cycle: this week or every week (R-CYC-12)
  tbtn(ICON_STATS,L('stTip'),()=>openStats());
  // schedules
  const s1=el('div','sec',body);
  secHead(s1,'schH',S.schedules.length,'schHTip','secSch',()=>{const n=prompt(L('pSch'));if(!n)return;hist();S.schedules.push({id:uid(),name:n,color:PAL[S.schedules.length%PAL.length],opacity:1,locked:false,visible:true});render()},'addSchTip');
  if(!prefs.secSch)S.schedules.forEach(s=>{
    const r=el('div','sch'+(s.visible?'':' off'),s1);gripFor(r,S.schedules,s,S.schedules,'gripSchTip');   // the order: a new event's schedule, lists and printouts (R-SCH-05)
    eyeBtn(r,s.visible,()=>{s.visible=!s.visible;render()});
    iconPicker(r,ICON_CAL,s.color,v=>{hist();s.color=v;render()}).style.opacity=Math.max(.35,s.opacity??1);
    const n=el('input','',r);n.type='text';n.value=s.name;n.setAttribute('aria-label',L('nmSch'));n.onchange=()=>{const v=n.value.trim().slice(0,200)||s.name;if(v!==s.name){hist();s.name=v}render()};
    if(s.locked){const lk=el('span','ic',r);lk.innerHTML=ICON_LOCK;lk.style.color='#e8912d';lk.title=L('lockTip')}
    const mb=el('button','eye',r);mb.innerHTML=ICON_MORE;mb.title=L('moreTip');mb.onclick=()=>schMenu(mb,s);
  });
  // people
  const s2=el('div','sec',body);
  secHead(s2,'pplH',S.people.length,'pplTip','secPpl',()=>{const n=prompt(L('pPer'));if(!n)return;hist();S.people.push({id:uid(),name:n.trim(),color:PAL[S.people.length%PAL.length],visible:true});render()},'addPerTip');
  // external people (R-PPL-04) sit in their own sub-group, collapsed by default (prefs.secExt !== false)
  const ours=ourPeople(),exts=S.people.filter(q=>q.external);
  const pRow=(q,box,grp)=>{
    const r=el('div','sch'+(q.visible?'':' off'),box);gripFor(r,S.people,q,grp);
    eyeBtn(r,q.visible,()=>{q.visible=!q.visible;render()});
    iconPicker(r,ICON_USER,q.color,v=>{hist();q.color=v;render()});
    const n=el('input','',r);n.type='text';n.value=q.name;n.setAttribute('aria-label',L('nmPpl'));n.onchange=()=>{const v=n.value.trim().slice(0,200)||q.name;if(v!==q.name){hist();q.name=v}render()};
    if(q.external){const x=el('span','ic extb',r);x.innerHTML=ICON_EXT;x.title=L('mExt');x.setAttribute('aria-label',L('mExt'))}
    const mb=el('button','eye',r);mb.innerHTML=ICON_MORE;mb.title=L('moreTip');mb.onclick=()=>perMenu(mb,q);
  };
  if(!prefs.secPpl){
    ours.forEach(q=>pRow(q,s2,ours));
    if(exts.length){
      const shut=prefs.secExt!==false,h=el('div','subh',s2),b=el('button','shbtn',h),off=exts.filter(q=>!q.visible).length;
      b.innerHTML=(shut?ICON_CR:ICON_CD)+`<span>${esc(L('extGrp'))}</span><em>${exts.length}</em>`+(shut&&off?`<small>${esc(L('extHid',{n:off}))}</small>`:'');
      b.setAttribute('aria-expanded',String(!shut));b.onclick=()=>{prefs.secExt=!shut;savePrefs();renderSide()};
      const tp=el('span','tip',h);tp.textContent='ⓘ';tp.title=L('extGrpTip');
      if(!shut){const g=el('div','extg',s2);exts.forEach(q=>pRow(q,g,exts))}
    }
  }
  // activity types
  const s5=el('div','sec tysec',body);
  secHead(s5,'tyH',S.types.length,'tyTip','secTyp',()=>{const n=prompt(L('pTy'));if(!n||!n.trim())return;hist();S.types.push({id:uid(),name:n.trim().slice(0,200),color:PAL[S.types.length%PAL.length],icon:'dot',visible:true});render()},'addTyTip');
  if(!prefs.secTyp)S.types.forEach(t=>{
    const r=el('div','sch'+(t.visible!==false?'':' off'),s5);gripFor(r,S.types,t,S.types,'gripTyTip');   // the order is the order of statistics and of the dialog's list (R-TYP-05)
    eyeBtn(r,t.visible!==false,()=>{t.visible=t.visible===false;render()});   // view state: not undoable, not an unsaved change (R-TYP-04)
    const ib=el('span','ic pick',r);ib.style.color=t.color;ib.innerHTML=tIcon(t.icon);ib.title=L('iconTip');ib._ty=t.id;ib.onclick=()=>iconMenu(ib,t);
    const n=el('input','',r);n.type='text';n.value=t.name;n.setAttribute('aria-label',L('tyH'));n.onchange=()=>{const v=n.value.trim().slice(0,200)||t.name;if(v!==t.name){hist();t.name=v}render()};
    const mb=el('button','eye',r);mb.innerHTML=ICON_MORE;mb.title=L('moreTip');mb.onclick=()=>tyMenu(mb,t);
  });
  const s3=el('div','sec',body);
  secHead(s3,'rhH',S.rhythms.length,'rhTip','secRh',()=>{const n=prompt(L('pRh'),L('rhDefault'));if(!n)return;hist();S.rhythms.forEach(x=>x.visible=false);S.rhythms.push({id:uid(),name:n.trim(),visible:true});render()},'addRhTip');
  if(!prefs.secRh){
    S.rhythms.forEach(rh=>{
      const r=el('div','sch'+(rh.visible?'':' off'),s3);gripFor(r,S.rhythms,rh,S.rhythms,'gripRhTip');   // the order: the rhythm Phases mode shows first, lists (R-PHS-09)
      const eb=eyeBtn(r,rh.visible,()=>{if(rh.visible)rh.visible=false;else S.rhythms.forEach(x=>x.visible=x===rh);render()});eb.title=L('rhEye');
      const ic=el('span','ic',r);ic.innerHTML=ICON_RHYTHM;
      const n=el('input','',r);n.type='text';n.value=rh.name;n.setAttribute('aria-label',L('nmRh'));n.onchange=()=>{const v=n.value.trim().slice(0,200)||rh.name;if(v!==rh.name){hist();rh.name=v}render()};
      const ag=el('button','eye',r);ag.innerHTML=ICON_AGENDA;ag.title=L('rhAgTip');ag.onclick=()=>openRhythmAgenda(rh);
      const mb=el('button','eye',r);mb.innerHTML=ICON_MORE;mb.title=L('moreTip');mb.onclick=()=>rowMenu(mb,(m,mi)=>{mi(ICON_WS,L('mTransfer'),()=>openTransfer('rhythm',rh));mi('<span class="ic" style="margin:0">'+ICON_RHYTHM+'</span>',L('mDelete'),()=>delRhythm(rh),'d')});
    });
    const orow=el('div','sch',s3),oi=el('span','ic',orow);oi.innerHTML=ICON_OPAC;oi.title=L('phOp');
    const sl=el('input','op',orow);sl.type='range';sl.min=.05;sl.max=1;sl.step=.05;sl.value=S.phaseOpacity;sl.title=L('phOp');
    sl.oninput=()=>{S.phaseOpacity=+sl.value;skipSide=true;render();skipSide=false};
  }
  // tools (R-UI-11): Live View and temporary ways of looking at the week; per-browser view state
  const s6=el('div','sec tsec',body);
  secHead(s6,'toolsH',null,'toolsTip','secTools');
  if(!prefs.secTools){
    {const r=el('div','lvrow',s6),b=el('button','',r),c=el('button','',r);b.id='lvB';b.type='button';b.onclick=()=>setLive(!live);   // live view (R-GRID-12)
     c.id='lvC';c.type='button';c.innerHTML=ICON_NOW+'<span></span>';c.querySelector('span').textContent=L('lvNow');c.title=L('lvNowTip');c.onclick=liveBack;updLive()}
    const tck=(label,tip,get,set)=>{const l=el('label','zck',s6),c=el('input','',l);c.type='checkbox';c.setAttribute('role','switch');c.checked=get();el('span','',l).textContent=L(label);l.title=L(tip);
      c.onchange=()=>{set(c.checked);savePrefs();render()};return c};
    tck('hlNoTy','hlNoTyTip',()=>prefs.hlNoType,v=>{prefs.hlNoType=v});
    tck('colByT','colByTTip',()=>prefs.colBy==='t',v=>{prefs.colBy=v?'t':''});   // the two colour modes exclude each other
    tck('colByP','colByPTip',()=>prefs.colBy==='p',v=>{prefs.colBy=v?'p':''});
    tck('lanesFix','lanesFixTip',()=>prefs.lanesFix,v=>{prefs.lanesFix=v});   // R-EVT-23
  }
  // zoom (grid scale only; per-browser view state)
  const s4=el('div','sec zsec',body);
  secHead(s4,'zoomH',null,'zoomNote','secZoom');
  if(!prefs.secZoom){
    // each Fit box heads its own slider; while it is on, the slider is disabled and shows the fitted size (updZoomUI)
    const zsl=(label,key,min,max,step,unit,off,cls)=>{const r=el('div','zrow'+(cls?' '+cls:''),s4);el('span','',r).textContent=L(label);
      const i=el('input','',r);i.type='range';i.min=min;i.max=max;i.step=step;i.value=prefs[key];i.dataset.z=key;i.disabled=!!off&&prefs[off];i.setAttribute('aria-label',L(label));i.title=L(i.disabled?(off.startsWith('fitW')?'zoomOffW':'zoomOffH'):key==='txt'?'zoomTxtTip':label);
      const v=el('span','zv',r);v.textContent=prefs[key]+unit;i.oninput=()=>{prefs[key]=+i.value;v.textContent=i.value+unit;savePrefs();zoomRender()}};
    const ck=(label,tip,key,size)=>{const l=el('label','zck',s4),c=el('input','',l);c.type='checkbox';c.setAttribute('role','switch');c.checked=prefs[key];el('span','',l).textContent=L(label);l.title=L(tip);
      c.onchange=()=>{if(!c.checked)prefs[size]=fitted(size);prefs[key]=c.checked;savePrefs();zoomRender();renderSide()}};   // unticking keeps the fitted size, so nothing jumps
    ck('zoomFitW','zoomFitWTip',FWK(),WK());zsl('zoomCol',WK(),70,1000,10,' px',FWK(),'zsub');
    ck('zoomFitH','zoomFitHTip',FH(),RH());zsl('zoomRow',RH(),24,120,4,' px/h',FH(),'zsub');
    el('div','zsep',s4);zsl('zoomTxt','txt',80,160,10,' %');
    const rb=el('button','zreset',s4);rb.type='button';rb.textContent=L('zoomReset');rb.title=L(phone()?'zoomResetTipP':'zoomResetTip');
    rb.onclick=()=>{if(phone()){prefs.rowHP=100;prefs.fitHP=false;prefs.colWP=110;prefs.fitWP=true}else{prefs.rowH=48;prefs.fitH=true;prefs.colW=110;prefs.fitW=true}prefs.txt=100;savePrefs();zoomRender();renderSide()};
    updZoomUI();
  }
  sb.scrollTop=st;
}
function delRhythm(rh){
  const lost=S.phases.filter(p=>p.rhythms.length===1&&p.rhythms[0]===rh.id).length;
  if(!confirm(L('confRh',{n:rh.name})+(lost?L('confRhLost',{k:lost}):'')))return;hist();
  S.rhythms=S.rhythms.filter(x=>x!==rh);
  S.phases.forEach(p=>p.rhythms=p.rhythms.filter(i=>i!==rh.id));
  S.phases=S.phases.filter(p=>p.rhythms.length);
  render();
}
const wkSuf=()=>cyc()>1?' — '+(allWk?L('wkAllT'):wkLabel(curWk)):'';
const wkH1=txt=>{const c=!allWk&&wkCol(curWk);return c?`<h1 class="wkh" style="--wkc:${esc(c)}">${esc(txt)}</h1>`:'<h1>'+esc(txt)+'</h1>'};   // printed titles carry the week's colour (R-CYC-17)   // printed titles name the week of a cycle (R-CYC-12)
function schedPage(){
  const c=withPrintScale(()=>$('grid').cloneNode(true));c.removeAttribute('id');c.querySelectorAll('.now').forEach(n=>n.remove());
  const w=el('div');w.innerHTML=wkH1(L('printTitle')+wkSuf())+metaLine();w.append(c);return w;
}
function printSchedule(){doPrint(schedPage(),allWk)}   // every week side by side prints across the page (R-CYC-19)
// fn drawn with one week shown (w), as when every week is side by side a page or day view is printed (R-CYC-19)
function oneWeek(w,fn){const a=allWk,c=curWk;allWk=false;curWk=w;try{return fn()}finally{allWk=a;curWk=c;render()}}
function printAll(){   // every week of the cycle, one page each (the focused day of each week while focused)
  const w0=curWk,a0=allWk,out=el('div');allWk=false;
  try{for(let w=1;w<=cyc();w++){curWk=w;const pg=focusD!=null?dayPage(focusD):schedPage();if(w>1)pg.className='pgb';out.append(pg)}}finally{curWk=w0;allWk=a0;render()}
  doPrint(out,false);
}
function delPerson(q){
  if(!confirm(L('confPer',{n:q.name})))return;hist();
  S.people=S.people.filter(x=>x!==q);
  S.events.forEach(e=>{e.involved=e.involved.filter(i=>i!==q.id);if(e.owner===q.id)delete e.owner;e.slots.forEach(s=>{if(s.person===q.id)s.person='';if(s.inv)s.inv=s.inv.filter(i=>i!==q.id)})});
  render();
}
function delSchedule(s){
  const lost=S.events.filter(e=>e.schedules.length===1&&e.schedules[0]===s.id).length;
  if(!confirm(L('confSch',{n:s.name})+(lost?L('confLost',{k:lost}):'')))return;hist();
  S.schedules=S.schedules.filter(x=>x!==s);
  S.events.forEach(e=>e.schedules=e.schedules.filter(i=>i!==s.id));
  S.events=S.events.filter(e=>e.schedules.length);
  render();
}
