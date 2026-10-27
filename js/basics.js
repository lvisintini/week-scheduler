// Basics: DOM helpers, icons, colour utilities and the colour popover. ES module (docs/architecture.md).
import {state} from './state.js';
import {L} from './i18n.js';
/* ---------- basics & icons ---------- */
export const SNAP=15,PAL=['#3b6df0','#e5484d','#2fa66a','#e8912d','#8e4ec6','#12a5b5','#d6409f'];
const SWATCHES=[...PAL,'#6b7385','#1d2330','#f5c518','#7bc043','#ff7f50','#a0522d','#00897b','#5c6bc0','#ec407a'];
export const uid=()=>Math.random().toString(36).slice(2,10);
export const $=id=>document.getElementById(id);
export const el=(t,c,p)=>{const e=document.createElement(t);if(c)e.className=c;if(p)p.append(e);return e};
export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const I=p=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>';
export const ICON_USER='<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4.5"/><path d="M3.5 21c0-4.7 3.8-8 8.5-8s8.5 3.3 8.5 8z"/></svg>';
export const ICON_CAL=I('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>');
export const ICON_OPAC=I('<rect x="3" y="3" width="18" height="18" rx="2"/><path fill="currentColor" stroke="none" d="M3 3h6v6H3zM15 3h6v6h-6zM9 9h6v6H9zM3 15h6v6H3zM15 15h6v6h-6z"/>');
const EYEP='<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"';
export const ICON_EYE=I(EYEP+'/><circle cx="12" cy="12" r="3" fill="currentColor"/>');
export const ICON_EYE_OFF=I(EYEP+' stroke-dasharray="3 3.2"/>');
export const ICON_UNDO=I('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>');
export const ICON_REDO=I('<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>');
export const ICON_CL=I('<path d="M15 5l-7 7 7 7"/>'),ICON_CR=I('<path d="M9 5l7 7-7 7"/>');
export const ICON_CAM=I('<rect x="2.5" y="6.5" width="13" height="11" rx="2"/><path d="M15.5 10.5l6-3.5v10l-6-3.5"/>'),ICON_STOP=I('<rect x="6" y="6" width="12" height="12" rx="1.5"/>'),ICON_NOW=I('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>');
export const ICON_FOCUS=I('<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/><circle cx="12" cy="12" r="2.5"/>'),ICON_WEEK=I('<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M9 5v15M15 5v15"/>');
export const ICON_AGENDA=I('<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>');
export const ICON_REPEAT=I('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>');
export const ICON_LOCK=I('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>');
export const ICON_UNLOCK=I('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>');
export const ICON_GEAR=I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>');
export const ICON_PLUS=I('<path d="M12 5v14M5 12h14"/>'),ICON_CD=I('<path d="M5 9l7 7 7-7"/>'),ICON_MORE=I('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>');
export const ICON_SAVE=I('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>');
export const ICON_FOLDER=I('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>');
export const ICON_PRINT=I('<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>');
export const ICON_EDIT=I('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),ICON_DUP=I('<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>');
export const ICON_TRASH=I('<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>');
export const ICON_RESET=I('<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/>');   // reset (not undo): a circle back to its start
export const ICON_HELP=I('<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>');
const ICON_SUN_P='<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
/* built-in icons for activity types (inline SVG only: the CSP allows no outside images); names for tooltips in TYN */
export const TICONS={dot:'<circle cx="12" cy="12" r="4"/>',moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',bed:'<path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="2"/>',sun:ICON_SUN_P,
meal:'<path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2 1.5-3 4-3 7v3h3"/>',coffee:'<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 2v3M12 2v3"/>',cook:'<path d="M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M2 10h20M9 6c0-1 1-1.5 1-2.5M14 6c0-1 1-1.5 1-2.5"/>',
work:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',school:'<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/>',book:'<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3"/>',
pencil:'<path d="M16 3.5l4.5 4.5L8 20.5H3.5V16z"/><path d="M13.5 6l4.5 4.5"/>',laptop:'<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',broom:'<path d="M20 3l-7.5 7.5"/><path d="M11 9l4 4-2 7c-4-1-7.5-4-9-8z"/><path d="M7.5 15.5l2.5-2.5"/>',shirt:'<path d="M8 3L3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c0 1.7-1.3 3-3 3s-3-1.3-3-3z"/>',
cart:'<path d="M3 4h2l2.5 11h11l2-8H6.5"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>',tool:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',home:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10M10 20v-6h4v6"/>',
drop:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',smile:'<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1.8 2 5.2 2 7 0M9 9.5h.01M15 9.5h.01"/>',heart:'<path d="M12 20s-7.5-4.6-9-9.5A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 9 4.5C19.5 15.4 12 20 12 20z"/>',
health:'<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>',pill:'<rect x="2.6" y="8.5" width="18.8" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M9.5 9.5l5 5"/>',dumbbell:'<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
ball:'<circle cx="12" cy="12" r="9"/><path d="M3.5 9.5c3 1 6 4 6.5 11M20.5 14.5c-3-1-6-4-6.5-11"/>',bike:'<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h6l2 7M10 9l2 7h6M14 6h3"/>',car:'<path d="M4 16v-4l2.5-5h11l2.5 5v4z"/><path d="M4 12h16M6 16v3M18 16v3"/>',
bus:'<rect x="5" y="3" width="14" height="15" rx="2"/><path d="M5 11h14M8 18v3M16 18v3M8.5 14.5h.01M15.5 14.5h.01"/>',plane:'<path d="M2 13l20-8-6 16-4-6z"/><path d="M12 15l4-6"/>',people:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .7 3.5 2.8 3.5 6"/>',
chat:'<path d="M21 12a8 8 0 0 1-11.8 7L4 20.5l1.5-4.6A8 8 0 1 1 21 12z"/>',phone:'<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/>',tv:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8M8 2l4 4 4-4"/>',
game:'<rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M15.5 12h.01M18 13.5h.01"/>',music:'<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',palette:'<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.4-1.3-1.6-1.3-2.8 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
camera:'<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',paw:'<circle cx="6.5" cy="10.5" r="1.8"/><circle cx="10.5" cy="6.5" r="1.8"/><circle cx="15.5" cy="7" r="1.8"/><circle cx="19" cy="11.5" r="1.8"/><path d="M8.5 18.5c0-3 2.2-6 4.5-6s4.5 3 4 5.5c-.4 2-3 1.5-4.3 1.5s-4.2 1.5-4.2-1z"/>',leaf:'<path d="M12 21v-9"/><path d="M12 12C12 7 8 4 4 4c0 5 3.5 8 8 8zM12 14c0-4 3-7 8-7 0 4-3 7-8 7z"/>',
tree:'<path d="M12 22v-6"/><path d="M12 2l6 9h-3l4 5H5l4-5H6z"/>',star:'<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
coin:'<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1.3 1.6 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2"/>',gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8c-1.5-3-5-4-5-1.5S10 8 12 8zM12 8c1.5-3 5-4 5-1.5S14 8 12 8z"/>'};
export const tIcon=k=>I(TICONS[k]||TICONS.dot);
const TYN={en:{dot:'Dot',moon:'Moon',bed:'Bed',sun:'Sun',meal:'Cutlery',coffee:'Cup',cook:'Pot',work:'Briefcase',school:'School',book:'Book',pencil:'Pencil',laptop:'Computer',target:'Target',clock:'Clock',broom:'Broom',shirt:'Clothes',cart:'Shopping',tool:'Tools',home:'Home',drop:'Water',smile:'Smile',heart:'Heart',health:'Health',pill:'Medicine',dumbbell:'Exercise',ball:'Ball',bike:'Bicycle',car:'Car',bus:'Bus',plane:'Trip',people:'People',chat:'Talk',phone:'Phone',tv:'TV',game:'Games',music:'Music',palette:'Art',camera:'Photo',paw:'Pets',leaf:'Plant',tree:'Outdoors',star:'Star',flag:'Goal',coin:'Money',gift:'Gift'},
es:{dot:'Punto',moon:'Luna',bed:'Cama',sun:'Sol',meal:'Cubiertos',coffee:'Taza',cook:'Olla',work:'Maletín',school:'Escuela',book:'Libro',pencil:'Lápiz',laptop:'Ordenador',target:'Diana',clock:'Reloj',broom:'Escoba',shirt:'Ropa',cart:'Compras',tool:'Herramientas',home:'Casa',drop:'Agua',smile:'Sonrisa',heart:'Corazón',health:'Salud',pill:'Medicina',dumbbell:'Ejercicio',ball:'Pelota',bike:'Bicicleta',car:'Coche',bus:'Autobús',plane:'Viaje',people:'Personas',chat:'Conversación',phone:'Teléfono',tv:'Televisión',game:'Juegos',music:'Música',palette:'Arte',camera:'Foto',paw:'Mascotas',leaf:'Planta',tree:'Aire libre',star:'Estrella',flag:'Meta',coin:'Dinero',gift:'Regalo'}};
export const iconName=k=>(TYN[state.lang]||TYN.en)[k]||k;
export const ICON_WARN=I('<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>');
export const ICON_RHYTHM=I('<rect x="4" y="4" width="16" height="4" rx="1"/><rect x="4" y="10" width="16" height="4" rx="1"/><rect x="4" y="16" width="16" height="4" rx="1"/>');
export const ICON_WS=I('<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>'),ICON_CHECK=I('<path d="M5 12l5 5 9-10"/>');
export const ICON_EXT=I('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>');
export const ICON_STATS=I('<path d="M3 21h18M6 17v-5M11 17V6M16 17v-8M21 17v-3"/>');
export const ICON_GRIP='<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';
export const FAV=document.querySelector('link[rel=icon]').href;
export const tyOf=e=>e.type?state.S.types.find(t=>t.id===e.type):null;
export const tyTag=t=>`<span class="ic" style="color:${esc(t.color)}">${tIcon(t.icon)}</span>${esc(t.name)}`;
export const pIcon=q=>`<span class="ic" style="color:${esc(q.color)}">${ICON_USER}</span>`;
export const pTag=id=>{const q=state.S.people.find(x=>x.id===id);return q?pIcon(q)+esc(q.name):''};
export const pIc=id=>{const q=state.S.people.find(x=>x.id===id);return q?pIcon(q):''};
export const sTag=s=>`<span class="ic" style="color:${esc(s.color)}">${ICON_CAL}</span>${esc(s.name)}`;
/* ---------- colour utilities ---------- */
export function normHex(h){h=String(h).trim().replace(/^#/,'');if(/^[0-9a-f]{3}$/i.test(h))h=h.replace(/./g,'$&$&');return /^[0-9a-f]{6}$/i.test(h)?'#'+h.toLowerCase():null}
function hexToHsl(hex){
  const n=parseInt(normHex(hex).slice(1),16),r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;const l=(mx+mn)/2,s=d?d/(1-Math.abs(2*l-1)):0;
  if(d){h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;if(h<0)h+=360}
  return [h,s,l];
}
function hslToHex(h,s,l){
  const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;
  const [R,G,B]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return '#'+[R,G,B].map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('');
}
export function shiftColor(hex,used){
  const [h,s,l]=hexToHsl(hex),me=normHex(hex);
  const first=l>=.5?[-.18,.18,-.3,.3]:[.18,-.18,.3,-.3];
  const cands=first.map(dl=>hslToHex(h,s,Math.min(.78,Math.max(.22,l+dl))));
  return cands.find(c=>c!==me&&!used.includes(c))||cands.find(c=>c!==me)||hex;
}
export function randomColor(used){let c;for(let i=0;i<30;i++){c=hslToHex(Math.random()*360,.55+Math.random()*.25,.42+Math.random()*.12);if(!used.includes(c))break}return c}
/* colour popover with Apply / Cancel */
export function pickColor(anchor,init,cb){
  document.querySelectorAll('.cpop').forEach(x=>x.remove());
  const pop=el('div','cpop',anchor.closest('dialog')||document.body);
  let [h,s,l]=hexToHsl(normHex(init)||'#3b6df0');
  const sw=el('div','sws',pop);
  SWATCHES.forEach(c=>{const b=el('button','sw',sw);b.type='button';b.style.background=c;b.onclick=()=>{[h,s,l]=hexToHsl(c);sync()}});
  const mk=(min,max,step,fn)=>{const r=el('input','',pop);r.type='range';r.min=min;r.max=max;r.step=step;r.oninput=()=>{fn(+r.value);sync(r)};return r};
  const hs=mk(0,359,1,v=>h=v),ss=mk(0,100,1,v=>s=v/100),ls=mk(8,92,1,v=>l=v/100);
  const row=el('div','cpr',pop),pv=el('div','pv',row),hx=el('input','',row);hx.type='text';hx.maxLength=7;
  const cur=()=>hslToHex(h,s,l);
  function sync(src){const c=cur();pv.style.background=c;if(src!==hx)hx.value=c;if(src!==hs)hs.value=h;if(src!==ss)ss.value=s*100;if(src!==ls)ls.value=l*100}
  const close=()=>{pop.remove();document.removeEventListener('pointerdown',outside,true)};
  const apply=()=>{const c=cur();close();cb(c)};
  const outside=e=>{if(!pop.contains(e.target))close()};
  hx.oninput=()=>{const n=normHex(hx.value);if(n){[h,s,l]=hexToHsl(n);sync(hx)}};
  hx.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();apply()}};
  pop.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}};
  const bt=el('div','btns',pop);
  const c1=el('button','',bt);c1.type='button';c1.textContent=L('pcCancel');c1.onclick=close;
  const c2=el('button','p',bt);c2.type='button';c2.textContent=L('pcApply');c2.onclick=apply;
  sync();
  const r=anchor.getBoundingClientRect();
  pop.style.left=Math.max(6,Math.min(r.left,innerWidth-250))+'px';
  pop.style.top=Math.max(6,Math.min(r.bottom+6,innerHeight-pop.offsetHeight-6))+'px';
  setTimeout(()=>document.addEventListener('pointerdown',outside,true));
  hx.focus();
}
export function iconPicker(parent,svg,color,onchange){
  const l=el('span','ic pick',parent);l.style.color=color;l.title=L('colorTip');l.innerHTML=svg;
  l.onclick=()=>pickColor(l,color,onchange);
  return l;
}
