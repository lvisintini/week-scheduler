// Wiring and startup: the entry point, the one file index.html loads (its imports bring in the rest); runs after every other file. ES module (docs/architecture.md).
import {state} from './state.js';
import {DAYN,DAYS,L,applyStatic} from './i18n.js';
import {$,el} from './basics.js';
import {FMT,errKey,initDefault,isSealed,loadStore,openImport,parseWorkspace,readStore,redo,undo,verOf} from './data.js';
import {askPassword,askUnlock,handleShareLink,hasCrypto,sealedOk,unb64u} from './share.js';
import {FH,FWK,applyPrefs,applyTheme,askLiveWeek,initLive,loadPrefs,openSettings,phone,phoneFit,savePrefs,setFocus,setLive,today,todayWk} from './model.js';
import {agDay,agFn,agWk,doPrint,printDay} from './stats.js';
import {oneWeek,renderSide} from './sidebar.js';
import {render,zoomRender} from './grid.js';
import {initDialog,rowTexts,rows} from './dialog.js';
/* ---------- wiring & startup ---------- */
loadPrefs();initLive();initDialog();   // the code that runs once at startup lives here, not at the top level of the other files (docs/architecture.md)
$('hid').onclick=openSettings;
$('agClose').onclick=()=>$('agDlg').close();
$('agPrint').onclick=()=>{const d=el('div','agenda');d.innerHTML=agFn();doPrint(d,false)};
$('agPrint2').onclick=()=>state.allWk?oneWeek(agWk,()=>printDay(agDay)):printDay(agDay);
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
  const mv=p=>{state.prefs.w=Math.max(230,Math.min(560,w0+p.clientX-x0));applyPrefs()};
  const up=()=>{document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);savePrefs()};
  document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up);
};
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&state.selK&&!document.querySelector('dialog[open]')){state.selK=null;render();return}
  if(e.key==='Escape'&&state.focusD!=null&&!document.querySelector('dialog[open],.omenu')){if(state.live)setLive(false);else setFocus(null);return}   // leaves Live View (a phone keeps its day, R-GRID-12) or focus mode (a selection is cleared first)
  if(e.target.closest&&e.target.closest('input,textarea,select'))return;if(document.querySelector('dialog[open]'))return;
  const k=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey)&&k==='z'){e.preventDefault();e.shiftKey?redo():undo()}
  else if((e.ctrlKey||e.metaKey)&&k==='y'){e.preventDefault();redo()}
});
export function setLang(l){
  state.lang=l;DAYS.splice(0,7,...DAYN[l]);document.documentElement.lang=l;document.title=L('appTitle');$('wrap').setAttribute('aria-label',L('gridLbl'));
  rows.forEach((o,i)=>{o.lt.nodeValue=DAYS[i].slice(0,3);rowTexts(o,o);o.more.forEach((x,k)=>rowTexts(x,o,k))});
  render();applyStatic();
}
if(phone())state.prefs.collapsed=true;   // a phone starts with the drawer closed, whatever was saved (R-UI-13)
$('sbBack').onclick=()=>{state.prefs.collapsed=true;savePrefs();applyPrefs();renderSide()};
applyPrefs();applyTheme();
if(window.ResizeObserver){let rt;new ResizeObserver(()=>{if(!state.prefs[FWK()]&&!state.prefs[FH()])return;clearTimeout(rt);rt=setTimeout(zoomRender,80)}).observe($('wrap'))}
function afterStore(){   // once the workspaces are there: today's week, Live View, a shared link
  state.curWk=todayWk()||1;   // the page opens on today's week when this browser knows it (R-CYC-05)
  if(state.prefs.live&&todayWk()!=null){state.live=true;state.focusD=today()}   // live view is remembered per browser (R-GRID-12)
  else if(phone())state.focusD=today();   // a phone opens on today's day view (R-UI-13)
  phoneFit();
  setLang(state.lang);
  if(state.prefs.live&&todayWk()==null&&!/data=/.test(location.hash))askLiveWeek(()=>setLive(true),()=>{state.prefs.live=false;savePrefs()});   // a cycle whose week this browser does not know yet (R-CYC-05)
  handleShareLink();window.addEventListener('hashchange',handleShareLink);
}
{const st=readStore();   // protected browser memory first asks for its passphrase, over an empty grid (R-DATA-11); a newer one is refused (R-DATA-09)
  if(isSealed(st)&&verOf(st)<=FMT){initDefault();setLang(state.lang);askUnlock(p=>{loadStore(p);afterStore()})}
  else{loadStore(st);afterStore()}}
