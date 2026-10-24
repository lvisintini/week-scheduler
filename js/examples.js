// The Examples workspace (R-DATA-12): a sample week built in the current language, opened on demand from Help and the workspace menu. ES module (docs/architecture.md).
import {state} from './state.js';
import {L} from './i18n.js';
import {defaultData,newWs,parseData,switchWs,uniqueName} from './data.js';
import {savePrefs} from './model.js';
export const EX_ID='examples';   // one Examples workspace: opening it again switches to it
// Each event shows one thing and says so in its description (R-DATA-12); a family that also runs a small shop (R-I18N-02).
export function exampleData(){
  const d=defaultData(),T={};['sleep','meal','work','focus','chore','free','social','care','travel'].forEach((k,i)=>{T[k]=d.types[i].id});   // the order of defaultTypes()
  const h=(x,m=0)=>x*60+m,S=(day,a,b,person,o)=>({day,start:a,end:b,person:person||'',...o}),on=(days,a,b,p,o)=>days.map(x=>S(x,a,b,p,o));
  const E=(k,dk,color,type,slots,o)=>({id:k,title:L(k),desc:L(dk),color,...(type?{type:T[type]}:{}),schedules:['exH'],involved:[],slots,...o});
  const A='exA',Sm='exS',O='exO',R='exR',Dn='exD',WD=[0,1,2,3,4],ALL=[0,1,2,3,4,5,6];
  d.schedules=[{id:'exH',name:L('exHome'),color:'#3b6df0',opacity:1,locked:false,visible:true},{id:'exW',name:L('exShop'),color:'#2fa66a',opacity:1,locked:false,visible:true}];
  d.people=[{id:A,name:'Alex',color:'#3b6df0',visible:true},{id:Sm,name:'Sam',color:'#e8912d',visible:true},{id:O,name:'Olivia',color:'#d6409f',visible:true},
    {id:R,name:'Rosa',color:'#12a5b5',visible:true,external:true},{id:Dn,name:'Dan',color:'#607d8b',visible:true,external:true}];
  d.events=[
    E('exRun','exRunD','#607d8b','travel',WD.map(x=>x===3?S(x,h(8,15),h(8,45),Sm):S(x,h(8,15),h(8,45),A,{fo:true})),{owner:A,involved:[O]}),   // owner vs. who does it (R-EVT-20)
    E('exSchool','exSchoolD','#8e4ec6','work',on(WD,h(9),h(15),O)),
    E('exShift','exShiftD','#2fa66a','work',[0,1,2,3,4,5].map(x=>S(x,h(9),h(17),x%2?Sm:A,{col:'p'})),{schedules:['exW']}),   // a rota (R-CYC-18), coloured by performer (R-EVT-22)
    E('exDeliv','exDelivD','#607d8b','work',[S(1,h(10),h(11),Dn,{fs:30})],{schedules:['exW'],involved:[Sm],oncall:true}),
    E('exDent','exDentD','#d6409f','care',[S(2,h(16),h(17),Sm)],{involved:[O]}),
    E('exFoot','exFootD','#e5484d','free',[S(2,h(16,15),h(17),O)]),
    E('exGym','exGymD','#e8912d','care',[S(0,h(18),h(19),Sm)]),
    E('exCook','exCookD','#a1662f','chore',ALL.map(x=>S(x,h(18,45),h(19,30),A,x===6?{inv:[O]}:{}))),   // Sunday's own With (R-EVT-21)
    E('exDin','exDinD','#e8912d','meal',on(ALL,h(19,30),h(20,15),'')),   // nobody responsible: concerns everyone (R-EVT-10)
    E('exStock','exStockD','#2fa66a','work',[S(1,h(19,45),h(20,45),A)],{schedules:['exW']}),
    E('exHw','exHwD','#8e4ec6','focus',on([0,1,2,3],h(17),h(18),O,{flex:true})),
    E('exLaun','exLaunD','#12a5b5','chore',[S(0,h(15),h(17),Sm,{fe:60})]),
    E('exScr','exScrD','#d6409f','free',on(WD,h(18),h(20),O),{bg:true}),
    E('exClean','exCleanD','#12a5b5','chore',[S(3,h(10),h(13),R)],{bg:true}),
    E('exGran','exGranD','#d6409f','social',[S(5,h(10),h(17),O)],{away:true}),
    E('exSwim','exSwimD','#12a5b5','free',[S(5,h(11),h(12),O)]),
    E('exDog','exDogD','#a1662f','chore',[S(5,h(10),h(11,30),A),S(6,h(10),h(11),A)]),
    E('exBread','exBreadD','#e8912d','chore',[S(5,h(10,30),h(11),A),S(2,h(8,45),h(9),A)],{nest:true}),
    E('exPlant','exPlantD','#2fa66a',null,[S(6,h(9),h(9,30),Sm)]),
    E('exLie','exLieD','#3f51b5','sleep',[S(6,h(7),h(9),A)],{involved:[Sm]}),
  ];
  d.color='#2fa66a';d.desc=L('exWsD');
  return parseData(d);
}
export function openExamples(){
  const w0=state.WS.find(x=>x.id===EX_ID);if(w0){switchWs(EX_ID);return}
  const w=newWs(uniqueName(L('exWs'),state.WS.map(x=>x.name)),exampleData(),true);w.id=EX_ID;state.WS.push(w);   // not an unsaved change, and only in browser memory once saved
  state.prefs.desc[EX_ID]=true;state.prefs.hours[EX_ID]=[7,22];savePrefs();   // its descriptions are the point (R-EVT-25); its week lies within 07:00–22:00
  switchWs(EX_ID);
}
