// Calendar export (R-SHARE-09): Save… → Calendar file, an iCalendar (.ics) file for Google Calendar, Apple Calendar or Outlook. An export
// only: it never opens in the app again and is never a backup. Classic script: shares the global scope with the other files in js/, loaded in
// the order of index.html (docs/architecture.md); only definitions here, so it may use what later files define.
/* Dates are local calendar days counted from 1 Jan 1970 (a Thursday), like ymd/dnum: the export runs from a chosen day (From) and, if given,
   until another (Until). Times are floating (no time zone): 07:30 stays 07:30 wherever the calendar is. Each event becomes one weekly series
   per group of days that share times, people and timing (BYDAY), every n weeks for the weeks of a cycle. */
const icsDay=dn=>new Date(dn*864e5).toISOString().slice(0,10);   // 'YYYY-MM-DD'
const icsDt=(dn,m)=>icsDay(dn+Math.floor(m/1440)).replace(/-/g,'')+'T'+pad(Math.floor(m%1440/60))+pad(m%60)+'00';   // floating local time
const icsEsc=t=>String(t).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
function icsFold(line){   // at most 75 octets a line, continuation lines start with a space; a UTF-8 character is never split
  const te=new TextEncoder(),out=[];let cur='',n=0;
  for(const ch of line){const b=te.encode(ch).length;if(n+b>(out.length?74:75)){out.push(cur);cur='';n=0}cur+=ch;n+=b}
  out.push(cur);return out.join('\r\n ');
}
const ICS_DAYS=['MO','TU','WE','TH','FR','SA','SU'];
/* f: the workspace record to export (shareOf: everything or a part, perhaps anonymised); o: {from, until (day numbers; until may be null),
   rem (minutes before, 0 = no reminder), wk (day number -> week of the cycle), now (Date)}. Returns the file's text, or null when it holds
   no event. */
function icsText(f,o){
  const n=f.cycle||1,nm=id=>(f.people.find(q=>q.id===id)||{}).name||'',fromS=icsDay(o.from).replace(/-/g,''),out=[],seen=new Map();
  const stamp=o.now.toISOString().replace(/[-:]/g,'').replace(/\.\d+/,''),wkName=k=>L('wkName',{n:k})+(((f.weekInfo||[])[k-1]||{}).name?' · '+f.weekInfo[k-1].name:'');
  f.events.forEach(e=>{
    if(e.bg)return;   // In the background: never part of anyone's calendar
    const groups=new Map();   // one series per week (0 = every week) and per times, performer, With list and timing
    e.slots.forEach(s=>{const ws=n>1&&(s.wk?[s.wk]:e.weeks)||[0];
      ws.forEach(k=>{const key=[k,s.start,s.end,s.person||'',invOf(e,s).join(','),s.flex?1:0,s.fs||0,s.fe||0].join('|');
        if(!groups.has(key))groups.set(key,{k,s,days:new Set()});groups.get(key).days.add(s.day)})});
    groups.forEach(({k,s,days})=>{
      let d0=null;for(let d=o.from;d<o.from+7*n&&d0==null;d++)if(days.has((d+3)%7)&&(!k||o.wk(d)===k))d0=d;   // the first occurrence on or after From
      if(d0==null||(o.until!=null&&d0>o.until))return;
      const free=!!e.away||!!s.flex,who=s.person?nm(s.person):'',inv=invOf(e,s).filter(p=>p!==s.person).map(nm).filter(Boolean);
      const base=`${e.id}-w${k}-${s.start}-${s.end}-${fromS}`,c=(seen.get(base)||0)+1;seen.set(base,c);
      const ty=e.type&&f.types.find(t=>t.id===e.type);
      const desc=[e.desc,e.owner&&e.owner!==s.person&&nm(e.owner)&&L('ownl')+' '+nm(e.owner),inv.length&&L(e.oncall?'oncl':'withl')+' '+inv.join(', '),s.flex?L('tmAround'):edgeNote(s),n>1&&k&&wkName(k)].filter(Boolean).join('\n');
      const title=(e.away?L('awNote')+': ':'')+e.title+(who?' · '+who:'');
      out.push('BEGIN:VEVENT','UID:'+base+(c>1?'-'+c:'')+'@weekly-schedules','DTSTAMP:'+stamp,'DTSTART:'+icsDt(d0,s.start),'DTEND:'+icsDt(d0,s.end),
        'RRULE:FREQ=WEEKLY;WKST=MO'+(k?';INTERVAL='+n:'')+';BYDAY='+[...days].sort().map(x=>ICS_DAYS[x]).join(',')+(o.until!=null?';UNTIL='+icsDt(o.until,1439).slice(0,-2)+'59':''),
        'SUMMARY:'+icsEsc(title),...(desc?['DESCRIPTION:'+icsEsc(desc)]:[]),...(ty?['CATEGORIES:'+icsEsc(ty.name)]:[]),'TRANSP:'+(free?'TRANSPARENT':'OPAQUE'),
        ...(o.rem&&!free?['BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:-PT'+o.rem+'M','DESCRIPTION:'+icsEsc(title),'END:VALARM']:[]),'END:VEVENT');
    });
  });
  if(!out.length)return null;
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Weekly Schedules//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+icsEsc(f.name),...out,'END:VCALENDAR'].map(icsFold).join('\r\n')+'\r\n';
}
const icsShow=t=>new Date(dnum(t)*864e5).toLocaleDateString(lang,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});   // a 'YYYY-MM-DD' for people
function openIcs(){
  if(cyc()>1&&todayWk()==null){askLiveWeek(()=>setTimeout(openIcs,0),null,{body:'icsWkBody',btn:'icsWkGo'});return}   // the dates follow today's week (R-CYC-05)
  const body=el('div'),tday=ymd(new Date()),last=prefs.icsLast[curId];
  el('p','note',body).textContent=L('icsBody');
  const hh=el('div','parth',body);hh.textContent=L('icsHow');const ht=el('span','tip',hh);ht.textContent=' ⓘ';ht.title=ht.__t=L('icsHowTip');
  const ol=el('ol','icsteps',body);['icsS1','icsS2','icsS3','icsS4'].forEach(k=>{el('li','',ol).textContent=L(k)});
  if(last){const p=el('p','note icslast',body);p.textContent=L('icsLast',{a:icsShow(last.from),b:last.until?icsShow(last.until):L('icsNoEnd')})+(last.until?'':' '+L('icsOpen'));const t=el('span','tip',p);t.textContent=' ⓘ';t.title=t.__t=L('icsLastTip')}
  const row=el('div','icsrow',body),dIn=(k,v)=>{const l=el('label','pwl',row);el('span','',l).textContent=L(k);const i=el('input','',l);i.type='date';i.value=v;return i};
  const fromIn=dIn('icsFrom',icsDay(last&&last.until?Math.max(tday,dnum(last.until)+1):tday)),untilIn=dIn('icsUntil','');
  const wkTx=el('p','note icswk',body),updWk=()=>{const k=cyc()>1&&/^\d{4}-\d{2}-\d{2}$/.test(fromIn.value)&&wkAt(dnum(fromIn.value));wkTx.textContent=k?L('icsFromWk',{w:wkLabel(k)}):'';wkTx.hidden=!k};
  fromIn.oninput=updWk;updWk();
  const rl=el('label','pwl',body);el('span','',rl).textContent=L('icsRem');const rem=el('select','',rl);fillSel(rem,[[0,L('icsRemNone')],...[5,10,15,30,60].map(m=>[m,L('icsRemMin',{m})])]);
  const al=el('label','sopt',body),ac=el('input','',al),asp=el('span','',al);ac.type='checkbox';asp.innerHTML=`<b>${esc(L('anonTitle'))}</b><small>${esc(L('anonTip'))}</small>`;
  const ip=incPicker(body,true);
  el('p','',el('div','plainwarn',body)).textContent=L('icsWarn');
  const msg=el('div','err',body);msg.setAttribute('role','alert');
  xdlg({title:L('icsTitle'),full:true,body,buttons:[{label:L('icsGo'),cls:'p',fn:()=>{
    const ok=v=>/^\d{4}-\d{2}-\d{2}$/.test(v);if(!ok(fromIn.value)){msg.textContent=L('icsNoFrom');return false}
    const from=dnum(fromIn.value),until=ok(untilIn.value)?dnum(untilIn.value):null;if(until!=null&&until<from){msg.textContent=L('icsBadUntil');return false}
    let text;try{text=icsText(shareOf(ip.inc(),ac.checked),{from,until,rem:+rem.value,wk:wkAt,now:new Date()})}catch(e){msg.textContent=L('shareFail');return false}
    if(!text){msg.textContent=L('icsNone');return false}
    saveIcs(text);prefs.icsLast[curId]=until!=null?{from:icsDay(from),until:icsDay(until)}:{from:icsDay(from)};savePrefs();
  }},{label:L('cancel'),dismiss:true}]});
}
function saveIcs(text){   // never a backup: the workspace stays unsaved
  const a=el('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/calendar'}));a.download='weekly-schedules-'+fileDay()+'.ics';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast(L('icsDone'));
}
