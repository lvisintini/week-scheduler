// Wiring and startup (runs last). Classic script: shares the global scope with the other files in js/, loaded in the order of index.html (docs/architecture.md).
/* ---------- wiring & startup ---------- */
$('hid').onclick=openSettings;
$('agClose').onclick=()=>$('agDlg').close();
$('agPrint').onclick=()=>{const d=el('div','agenda');d.innerHTML=agFn();doPrint(d,false)};
$('agPrint2').onclick=()=>allWk?oneWeek(agWk,()=>printDay(agDay)):printDay(agDay);
$('file').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  const name=f.name.replace(/\.json$/i,'').replace(/-encrypted$/,''),show=obj=>{try{openImport(parseWorkspace(obj,name),'file')}catch(err){alert(L(errKey(err,'badFile')))}};
  let j;try{j=JSON.parse(await f.text())}catch(_){alert(L('badFile'));return}
  if(j&&j.format==='weekly-schedules-encrypted'){
    const cv=verOf(j);if(!Number.isInteger(cv)||cv<1){alert(L('badFile'));return}
    if(cv>1){alert(L('newer'));return}   // a later container format
    if(!hasCrypto()){alert(L('noCrypto'));return}
    let blob;try{blob=unb64u(String(j.data))}catch(_){alert(L('badFile'));return}
    if(blob[0]>1){alert(L('newer'));return}
    if(!sealedOk(blob)){alert(L('badFile'));return}
    askPassword(blob,show);return;
  }
  show(j);
};
$('rs').onpointerdown=ev=>{
  ev.preventDefault();const x0=ev.clientX,w0=$('sb').offsetWidth;
  const mv=p=>{prefs.w=Math.max(230,Math.min(560,w0+p.clientX-x0));applyPrefs()};
  const up=()=>{document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);savePrefs()};
  document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up);
};
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&selK&&!document.querySelector('dialog[open]')){selK=null;render();return}
  if(e.key==='Escape'&&focusD!=null&&!document.querySelector('dialog[open],.omenu')){if(live)setLive(false);else setFocus(null);return}   // leaves Live View (a phone keeps its day, R-GRID-12) or focus mode (a selection is cleared first)
  if(e.target.closest&&e.target.closest('input,textarea,select'))return;if(document.querySelector('dialog[open]'))return;
  const k=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey)&&k==='z'){e.preventDefault();e.shiftKey?redo():undo()}
  else if((e.ctrlKey||e.metaKey)&&k==='y'){e.preventDefault();redo()}
});
function setLang(l){
  lang=l;DAYS.splice(0,7,...DAYN[l]);document.documentElement.lang=l;document.title=L('appTitle');$('wrap').setAttribute('aria-label',L('gridLbl'));
  rows.forEach((o,i)=>{o.lt.nodeValue=DAYS[i].slice(0,3);rowTexts(o,o);o.more.forEach((x,k)=>rowTexts(x,o,k))});
  render();applyStatic();
}
if(phone())prefs.collapsed=true;   // a phone starts with the drawer closed, whatever was saved (R-UI-13)
$('sbBack').onclick=()=>{prefs.collapsed=true;savePrefs();applyPrefs();renderSide()};
applyPrefs();applyTheme();
if(window.ResizeObserver){let rt;new ResizeObserver(()=>{if(!prefs[FWK()]&&!prefs[FH()])return;clearTimeout(rt);rt=setTimeout(zoomRender,80)}).observe($('wrap'))}
function afterStore(){   // once the workspaces are there: today's week, Live View, a shared link
  curWk=todayWk()||1;   // the page opens on today's week when this browser knows it (R-CYC-05)
  if(prefs.live&&todayWk()!=null){live=true;focusD=today()}   // live view is remembered per browser (R-GRID-12)
  else if(phone())focusD=today();   // a phone opens on today's day view (R-UI-13)
  phoneFit();
  setLang(lang);
  if(prefs.live&&todayWk()==null&&!/data=/.test(location.hash))askLiveWeek(()=>setLive(true),()=>{prefs.live=false;savePrefs()});   // a cycle whose week this browser does not know yet (R-CYC-05)
  handleShareLink();window.addEventListener('hashchange',handleShareLink);
}
{const st=readStore();   // protected browser memory first asks for its passphrase, over an empty grid (R-DATA-11); a newer one is refused (R-DATA-09)
  if(isSealed(st)&&verOf(st)<=FMT){initDefault();setLang(lang);askUnlock(p=>{loadStore(p);afterStore()})}
  else{loadStore(st);afterStore()}}
