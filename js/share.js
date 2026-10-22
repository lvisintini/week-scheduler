// Sharing: links, encryption, saving to and loading from files and browser memory. Classic script: shares the global scope with the other files in js/, loaded in the order of index.html (docs/architecture.md).
/* ---------- shareable link: data lives in the URL fragment (#data=...), compressed when the browser supports it ---------- */
const b64u=u8=>{let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const unb64u=str=>{str=str.replace(/-/g,'+').replace(/_/g,'/');while(str.length%4)str+='=';const s=atob(str),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u};
async function inflate(bytes){
  const ds=new DecompressionStream('deflate-raw'),wr=ds.writable.getWriter();wr.write(bytes).catch(()=>{});wr.close().catch(()=>{});
  const rd=ds.readable.getReader(),chunks=[];let n=0;
  for(;;){const {done,value}=await rd.read();if(done)break;n+=value.length;if(n>2e6)throw new Error('too big');chunks.push(value)}
  const out=new Uint8Array(n);let o=0;chunks.forEach(c=>{out.set(c,o);o+=c.length});return out;
}
/* ---------- encryption (Web Crypto): PBKDF2-SHA256 -> AES-256-GCM. Links and exported files are always password-protected ---------- */
const hasCrypto=()=>!!(window.crypto&&crypto.subtle);
const PBKDF2_ITER=600000,ALPHA='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
function genPassword(){   // 25 random characters (~145 bits) in 5 groups, no look-alike characters, unbiased
  const out=[],buf=new Uint8Array(64);
  while(out.length<25){crypto.getRandomValues(buf);for(const v of buf)if(v<224&&out.length<25)out.push(ALPHA[v%56])}
  return out.join('').match(/.{5}/g).join('-');
}
async function deriveKey(pw,salt,iter){
  const km=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw.normalize('NFKC')),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:iter,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function encryptBytes(plain,pw){   // blob = [1][iterations u32][salt 16][iv 12][ciphertext+tag]; the header is authenticated too
  const head=new Uint8Array(33),salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  head[0]=1;new DataView(head.buffer).setUint32(1,PBKDF2_ITER);head.set(salt,5);head.set(iv,21);
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:head},await deriveKey(pw,salt,PBKDF2_ITER),plain));
  const out=new Uint8Array(33+ct.length);out.set(head);out.set(ct,33);return out;
}
async function decryptBytes(blob,pw){
  if(blob[0]>1)throw new Error('newer');   // a later encryption layout
  if(blob.length<50||blob[0]!==1)throw new Error('format');
  const iter=new DataView(blob.buffer,blob.byteOffset).getUint32(1);
  if(iter<100000||iter>2000000)throw new Error('format');   // refuse absurd work factors from crafted data
  const head=blob.slice(0,33),key=await deriveKey(pw,blob.slice(5,21),iter);
  try{return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:blob.slice(21,33),additionalData:head},key,blob.slice(33)))}catch(e){throw new Error('password')}
}
async function deflate(bytes){const cs=new CompressionStream('deflate-raw'),wr=cs.writable.getWriter();wr.write(bytes).catch(()=>{});wr.close().catch(()=>{});return new Uint8Array(await new Response(cs.readable).arrayBuffer())}
async function seal(obj,pw){   // JSON -> (deflate) -> encrypt
  const json=new TextEncoder().encode(JSON.stringify(obj));let flag=0,data=json;
  if(typeof CompressionStream!=='undefined'){flag=1;data=await deflate(json)}
  const inner=new Uint8Array(1+data.length);inner[0]=flag;inner.set(data,1);return encryptBytes(inner,pw);
}
async function unseal(blob,pw){
  const inner=await decryptBytes(blob,pw);let data=inner.slice(1);
  if(inner[0]===1)data=await inflate(data);else if(inner[0]>1)throw new Error('newer');else if(inner[0]!==0)throw new Error('format');
  if(data.length>2e6)throw new Error('big');
  return JSON.parse(new TextDecoder().decode(data));
}
const anonymised=f=>{const c=JSON.parse(JSON.stringify(f));c.people.forEach((q,i)=>{q.name=L('anonPerson')+' '+(i+1)});c.events.forEach(e=>{e.desc=''});c.phases.forEach(x=>{x.desc=''});(c.weekInfo||[]).forEach(w=>{delete w.desc});return c};   // week names stay, like titles (R-CYC-17)
function askPassword(blob,onOpen,onCancel){   // ask for the password of an encrypted file/link, retry on mistakes
  const body=el('div');el('p','',body).textContent=L('pwAsk');
  const pw=el('input','',body);pw.type='password';pw.autocomplete='off';pw.style.cssText='width:100%;margin-top:8px';
  const sl=el('label','sopt',body),sc=el('input','',sl);sc.type='checkbox';sl.append(' '+L('pwShow'));sc.onchange=()=>{pw.type=sc.checked?'text':'password'};
  const msg=el('div','err',body);
  const go=async()=>{
    msg.textContent=L('pwWorking');
    try{const obj=await unseal(blob,pw.value.trim());$('xDlg').close();setTimeout(()=>onOpen(obj),0)}
    catch(e){msg.textContent=L(e&&e.message==='password'?'pwWrong':e&&e.message==='big'?'tooBig':errKey(e,'badFile'))}
  };
  pw.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();go()}};
  xdlg({title:L('pwTitle'),body,buttons:[{label:L('pwOpen'),cls:'p',fn:()=>{go();return false}},{label:L('cancel'),dismiss:true}],onDismiss:onCancel});
  setTimeout(()=>pw.focus(),0);
}
function openProtect(kind){   // options + password for a link or file; files may also be saved unencrypted (links never)
  const cry=hasCrypto();if(!cry&&kind==='link'){alert(L('noCrypto'));return}
  let plain=!cry;
  const body=el('div'),intro=el('p','note',body);intro.textContent=L(kind==='link'?'protBodyLink':'protBodyFile');
  const pwBox=el('div'),plainBox=el('div','plainwarn',body);let upd=()=>{};
  if(kind==='file'){
    const sg=el('div','seg encsel',body);body.insertBefore(sg,plainBox);
    [[false,'encOn'],[true,'encOff']].forEach(([v,k])=>{const b=el('button','',sg);b.type='button';b.textContent=L(k);if(!v&&!cry){b.disabled=true;b.title=L('noCrypto')}b.onclick=()=>{plain=v;upd()}});
    upd=()=>{[...sg.children].forEach((b,i)=>b.classList.toggle('on',(i===1)===plain));pwBox.hidden=plain;plainBox.hidden=!plain;intro.textContent=L(plain?'plainBody':'protBodyFile')};
  }
  el('p','',plainBox).textContent=L('plainWarn');
  const al=el('label','sopt',body),ac=el('input','',al),asp=el('span','',al);ac.type='checkbox';asp.innerHTML=`<b>${esc(L('anonTitle'))}</b><small>${esc(L('anonTip'))}</small>`;
  body.append(pwBox);el('label','',pwBox).textContent=L('protPw');
  const row=el('div','row',pwBox),pw=el('input','',row),nb=el('button','',row);
  pw.type='text';pw.value=genPassword();pw.spellcheck=false;pw.autocomplete='off';pw.setAttribute('aria-label',L('protPw'));   // its label above is not tied to it
  pw.style.cssText='flex:1;font-family:monospace';
  nb.type='button';nb.textContent=L('protNew');const msg=el('div','err',pwBox);nb.onclick=()=>{pw.value=genPassword();msg.textContent=''};
  el('p','note',pwBox).textContent=L('protWarn');
  upd();if(kind==='link')plainBox.hidden=true;
  xdlg({title:L(kind==='link'?'shareTitle':'saveFileTitle'),body,buttons:[{label:L(kind==='link'?'protMakeLink':'protSaveFile'),cls:'p',fn:()=>{
    const anon=ac.checked;if(plain){setTimeout(()=>saveFile(null,anon),0);return}
    const p=pw.value.trim();if(p.length<20){msg.textContent=L('protShort');return false}
    setTimeout(()=>kind==='link'?openShare(p,anon):saveFile(p,anon),0)}},{label:L('cancel'),dismiss:true}]});
}
async function openShare(pw,anon){
  let link;
  try{const f=buildFile();link=location.href.split('#')[0]+'#data=e1.'+b64u(await seal(anon?anonymised(f):f,pw))}catch(e){toast(L('shareFail'));return}
  const body=el('div');el('p','note',body).textContent=L('shareBody');
  const ta=el('textarea','',body);ta.readOnly=true;ta.rows=5;ta.value=link;ta.style.cssText='width:100%;margin-top:8px;font-size:11px;word-break:break-all';ta.onfocus=()=>ta.select();
  const pr=el('p','',body);pr.append(L('sharePw')+' ');const code=el('b','',pr);code.textContent=pw;code.style.cssText='font-family:monospace;user-select:all';
  const info=[L('shareLen',{n:link.length}),L('protWarn')];if(location.protocol==='file:')info.push(L('shareFile'));if(link.length>8000)info.push(L('shareLong'));
  el('p','note',body).textContent=info.join(' ');
  const copy=(txt,i)=>{const b=$('xDlg').querySelectorAll('.btns button')[i],done=()=>{if(b)b.textContent=L('shareCopied')};
    const fb=()=>{const t=el('textarea','',body);t.value=txt;t.select();try{document.execCommand('copy');done()}catch(e){}t.remove()};
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(done,fb);else fb()};
  xdlg({title:L('shareTitle'),body,buttons:[{label:L('shareCopy'),cls:'p',fn:()=>{copy(link,0);return false}},{label:L('shareCopyPw'),fn:()=>{copy(pw,1);return false}},{label:L('closeB'),dismiss:true}]});
  setTimeout(()=>ta.select(),0);
}
async function handleShareLink(){
  if(!location.hash.startsWith('#data='))return;
  const raw=location.hash.slice(6),clean=()=>{try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}};
  const m=/^e(\d+)\./.exec(raw);
  if(m&&+m[1]>1){clean();toast(L('newer'));return}   // a link format of a later version
  if(!m||m[1]!=='1'||!hasCrypto()){clean();toast(L(hasCrypto()?'linkBad':'noCrypto'));return}
  let blob;try{blob=unb64u(raw.slice(3))}catch(e){clean();toast(L('linkBad'));return}
  if(blob[0]>1){clean();toast(L('newer'));return}
  askPassword(blob,obj=>{
    clean();let w;try{w=parseWorkspace(obj,L('wsShared'))}catch(e){toast(L(errKey(e,'linkBad')));return}
    if(!memGet()&&WS.length===1&&!isDirty()){adoptWs(w,'link');toast(L('linkLoaded'));return}
    openImport(w,'link');
  },clean);
}
async function saveFile(pw,anon){   // pw null = unencrypted (readable) file, chosen explicitly by the user
  let text;try{const f=anon?anonymised(buildFile()):buildFile();text=pw==null?JSON.stringify(f,null,1):JSON.stringify({format:'weekly-schedules-encrypted',version:1,data:b64u(await seal(f,pw))})}catch(e){toast(L('shareFail'));return}
  const a=el('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download='weekly-schedules-'+new Date().toISOString().slice(0,10)+(pw==null?'':'-encrypted')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  if(!anon)cw().lf=keyOf(S);   // an anonymised copy is not a backup of this workspace
  toast(L('savedFile'));renderSide();
}
function loadMem(){  // reverts the current workspace to its saved copy in browser memory
  const st=readStore();if(st&&verOf(st)>FMT){alert(L('memNewer'));return}
  const e=st&&Array.isArray(st.workspaces)&&st.workspaces.find(x=>x.id===curId);
  if(!e){toast(L('noMem'));return}
  try{const d=parseData(migrate(e,verOf(st)));hist();S=d;cw().lb=keyOf(d);render();toast(L('loadedMem'))}catch(_){alert(L('badFile'))}
}
function restart(){
  if(anyDirty()&&!confirm(L('confRestart')))return;
  loadStore();selK=null;editMode='events';render();toast(L('restarted'));
}
function clearMem(){
  if(!confirm(L('confClear')))return;
  try{localStorage.removeItem(WKEY)}catch(e){}
  prefs.lvAnchor=Object.create(null);savePrefs();initDefault();selK=null;editMode='events';render();toast(L('clearedMem'));
}
window.addEventListener('beforeunload',e=>{if(anyDirty()){e.preventDefault();e.returnValue=''}});
// Settings have no version (none = 1): a key never changes its meaning, unknown or missing values fall back to the defaults (R-DATA-08)
