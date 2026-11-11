// Deck Inspector API: passcode-gated. Preloaded decks are stored AES-256-GCM encrypted in inspector-data/;
// the key lives only in the Render env (INSPECTOR_DATA_KEY). Disabled unless INSPECTOR_PASSCODE is set.
import { readFile, readdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { pinyin as toPinyin } from 'pinyin-pro';
import { nativeContour } from './anki/analyze.js';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { createHmac, createDecipheriv, timingSafeEqual } from 'node:crypto';
const dataDir=new URL('../inspector-data/',import.meta.url);
const PASS=()=>process.env.INSPECTOR_PASSCODE||'', KEY=()=>process.env.INSPECTOR_DATA_KEY||'';
// Optional second key (INSPECTOR_DATA_KEY2) for decks added later (index2.enc + their .enc files).
const KEY2=()=>process.env.INSPECTOR_DATA_KEY2||'';
const tok=()=>createHmac('sha256',PASS()).update('deck-inspector-v1').digest('hex');
const eq=(a,b)=>{a=Buffer.from(String(a));b=Buffer.from(String(b));return a.length===b.length&&timingSafeEqual(a,b);};
const J=(res,s,d)=>{res.writeHead(s,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(d));};
async function body(req){const c=[];let n=0;for await(const x of req){n+=x.length;if(n>10000)throw new Error('too big');c.push(x);}return Buffer.concat(c).toString();}
function dec1(b,k){const d=createDecipheriv('aes-256-gcm',Buffer.from(k,'hex'),b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]);}
function dec(b){try{return dec1(b,KEY());}catch(e){if(KEY2())return dec1(b,KEY2());throw e;}}
let fails=0,failT=0;
// ---- CC-CEDICT lookup (CC BY-SA) + free edge neural TTS for new cards ----
let CED=null;
async function cedict(){if(CED)return CED;CED=new Map();const t=gunzipSync(await readFile(new URL('./data/cedict_ts.u8.gz',import.meta.url))).toString('utf8');
  for(const l of t.split('\n')){if(l[0]==='#')continue;const m=l.match(/^(\S+) (\S+) \[([^\]]+)\] \/(.*)\/\s*$/);if(!m)continue;
    const e={py:m[3],defs:m[4].split('/').filter(Boolean),s:m[2]};for(const k of new Set([m[2],m[1]])){if(!CED.has(k))CED.set(k,[]);CED.get(k).push(e);}}
  return CED;}
// pinyin (no tones needed) -> hanzi via CC-CEDICT, preferring words the deck already knows
let PYX=null;const plain=x=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/u:/g,'v').replace(/ü/g,'v').replace(/[^a-z]/g,'');
async function pyIndex(){if(PYX)return PYX;const d=await cedict();PYX=new Map();for(const [w,E] of d){if(!/^[\u3400-\u9fff]+$/.test(w))continue;for(const e of E){if(e.s!==w)continue;const k=plain(e.py.replace(/\d/g,''));if(!k)continue;const bad=/^(surname|variant of|old variant|used in|see )/i.test(e.defs[0]||'');if(!PYX.has(k))PYX.set(k,[]);const L=PYX.get(k);if(!L.some(x=>x.w===w))L.push({w,bad,n:e.defs.length,def:(e.defs||[]).slice(0,2).join('; ')});}}
 for(const L of PYX.values())L.sort((a,b)=>(a.bad-b.bad)||(b.n-a.n));return PYX;}
async function py2hz(q,known){const X=await pyIndex(),K=new Map();for(const w of known){const k=plain(toPinyin(w,{toneType:'none'}).replace(/\s/g,''));if(k)(K.get(k)||K.set(k,[]).get(k)).push(w)}
 const s=plain(q.replace(/\s+/g,''));if(!s||s.length>60)return null;const best=new Array(s.length+1).fill(null);best[0]={cost:0,segs:[]};
 for(let i=0;i<s.length;i++){if(!best[i])continue;for(let j=i+1;j<=Math.min(s.length,i+24);j++){const k=s.slice(i,j),opts=[...(K.get(k)||[]).map(w=>({w,known:1})),...(X.get(k)||[]).filter(x=>!(K.get(k)||[]).includes(x.w))];if(!opts.length)continue;
  const c=best[i].cost+(K.has(k)?0.4:1);if(!best[j]||c<best[j].cost)best[j]={cost:c,segs:[...best[i].segs,{py:k,opts:opts.slice(0,8)}]};}}
 const r=best[s.length];if(!r)return null;return{zh:r.segs.map(g=>g.opts[0].w).join(''),segs:r.segs.map(g=>({py:g.py,opts:g.opts.map(o=>({w:o.w,known:!!o.known,def:o.def||''}))}))};}
const VOICES=['zh-CN-XiaoxiaoNeural','zh-CN-XiaoyiNeural','zh-CN-YunxiNeural','zh-CN-YunjianNeural','zh-TW-HsiaoChenNeural'];
async function edgeTts(text,voice,rate){const t=new MsEdgeTTS();await t.setMetadata(voice,OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  try{const {audioStream}=t.toStream(text,{rate});const c=[];for await(const x of audioStream)c.push(x);return Buffer.concat(c);}finally{try{t.close()}catch{}}}
// ---- MiniMax voice clone (paid, Oleg's key). Key read only from env, never logged. ----
const MM=()=>process.env.MINIMAX_API_KEY||'',MMG=()=>process.env.MINIMAX_GROUP_ID||'',MMB='https://api.minimax.io';
let voiceId=process.env.MINIMAX_VOICE_ID||'',cloning=null;
const mmUrl=p=>MMB+p+(MMG()?'?GroupId='+encodeURIComponent(MMG()):'');
const mmOk=j=>j&&j.base_resp&&j.base_resp.status_code===0;
async function ensureVoice(){
  if(voiceId)return voiceId;
  if(cloning)return cloning;
  cloning=(async()=>{
    const wav=await readFile(new URL('../public/lessons/video-1-li-pei-ru/reference.wav',import.meta.url));
    const fd=new FormData();fd.append('purpose','voice_clone');fd.append('file',new Blob([wav],{type:'audio/wav'}),'lipeiru_ref.wav');
    const up=await (await fetch(mmUrl('/v1/files/upload'),{method:'POST',headers:{Authorization:'Bearer '+MM()},body:fd})).json();
    if(!mmOk(up))throw new Error('upload failed: '+(up.base_resp?.status_msg||'unknown'));
    const vid='LiPeiRu_insp_'+Date.now().toString(36);
    const cl=await (await fetch(mmUrl('/v1/voice_clone'),{method:'POST',headers:{Authorization:'Bearer '+MM(),'Content-Type':'application/json'},
      body:JSON.stringify({file_id:up.file.file_id,voice_id:vid,need_noise_reduction:true,need_volume_normalization:true,language_boost:'Chinese'})})).json();
    if(!mmOk(cl))throw new Error('clone failed: '+(cl.base_resp?.status_msg||'unknown'));
    voiceId=vid;return vid;})();
  try{return await cloning}finally{cloning=null}
}
async function cloneTts(text,speed){
  const vid=await ensureVoice();
  const r=await (await fetch(mmUrl('/v1/t2a_v2'),{method:'POST',headers:{Authorization:'Bearer '+MM(),'Content-Type':'application/json'},
    body:JSON.stringify({model:'speech-02-hd',text,stream:false,language_boost:'Chinese',voice_setting:{voice_id:vid,speed,vol:1,pitch:0},audio_setting:{sample_rate:44100,bitrate:128000,format:'mp3',channel:1}})})).json();
  if(!mmOk(r)||!r.data?.audio)throw new Error('tts failed: '+(r.base_resp?.status_msg||'unknown'));
  return Buffer.from(r.data.audio,'hex');
}
// Hanzi Writer stroke data (hanzi-writer-data, Arphic PL / derived from Make Me a Hanzi) + AnimCJK SVG (Arphic PL). Fetched once, cached.
const CH=new Map();
async function charData(c){if(CH.has(c))return CH.get(c);const cp=c.codePointAt(0);
  const [hw,svg]=await Promise.all([fetch('https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/'+encodeURIComponent(c)+'.json').then(r=>r.ok?r.json():null),
    fetch('https://raw.githubusercontent.com/parsimonhi/animCJK/master/svgsZhHans/'+cp+'.svg').then(r=>r.ok?r.text():null)]);
  const v={hw,svg};if(hw||svg)CH.set(c,v);return v;}
// Make Me a Hanzi dictionary (decomposition, etymology; Arphic PL / LGPL) and Wikimedia Commons pronunciation search (Lingua Libre / audio-cmn, CC licences)
const UA='mandarin-tone-trainer/1.0 (deck inspector)';let MMH=null;
async function mmh(){if(MMH)return MMH;const t=await (await fetch('https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt')).text();const m=new Map();for(const l of t.split('\n')){if(!l)continue;try{const e=JSON.parse(l);m.set(e.character,e)}catch{}}return MMH=m}
async function commonsAudio(w){const out=[];for(const q of ['intitle:"(cmn)" intitle:"'+w+'"','intitle:"Cmn-'+w+'"']){
  const u='https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&format=json&srlimit=20&srsearch='+encodeURIComponent(q);
  const j=await (await fetch(u,{headers:{'User-Agent':UA}})).json();for(const x of (j.query||{}).search||[]){const t=x.title;if(!/\.(wav|ogg|mp3|flac)$/i.test(t))continue;
   const exact=new RegExp('[-\u2013]'+w+'[.](wav|ogg|mp3|flac)$').test(t);if(exact&&!out.some(o=>o.title===t))out.push({title:t,source:/^File:LL-/.test(t)?'Lingua Libre':'audio-cmn',speaker:(t.match(/\(cmn\)-([^-]+)-/)||[])[1]||''})}}return out}
export async function handleInspector(req,res,path){
  if(!PASS())return J(res,503,{error:'Inspector is disabled: set INSPECTOR_PASSCODE on the server'});
  if(path==='/api/inspector/login'&&req.method==='POST'){
    if(fails>=10&&Date.now()-failT<600000)return J(res,429,{error:'Too many attempts, wait 10 min'});
    let code='';try{code=JSON.parse(await body(req)).code||'';}catch{}
    if(!eq(code,PASS())){fails++;failT=Date.now();return J(res,401,{error:'Wrong passcode'});}
    fails=0;return J(res,200,{token:tok()});
  }
  if(!eq(req.headers['x-insp-token']||'',tok()))return J(res,401,{error:'Login required'});
  if(path==='/api/inspector/dict'){
    const w=(new URL(req.url,'http://x').searchParams.get('w')||'').trim().slice(0,20);
    if(!/^[\u3400-\u9fff]+$/.test(w))return J(res,400,{error:'Chinese characters only'});
    const d=await cedict();const ent=d.get(w)||[];
    return J(res,200,{word:w,pinyin:toPinyin(w),entries:ent,chars:ent.length?[]:[...w].map(c=>({c,pinyin:toPinyin(c),entries:(d.get(c)||[]).slice(0,2)}))});
  }
  if(path==='/api/inspector/native'&&req.method==='POST'){
    // deck build: native pitch contour + syllable slots of a card's own audio (16-bit WAV body), stored in the card so the phone needs no extra server time
    const h=(new URL(req.url,'http://x').searchParams.get('h')||'').slice(0,60);const c=[];let n=0;for await(const x of req){n+=x.length;if(n>6e6)return J(res,413,{error:'too big'});c.push(x)}
    try{return J(res,200,nativeContour(Buffer.concat(c),h))}catch(e){return J(res,400,{error:String(e.message).slice(0,120)})}
  }
  if(path==='/api/inspector/zh'){
    // any text box: pinyin or English -> Chinese suggestions (no Chinese keyboard needed)
    const u=new URL(req.url,'http://x').searchParams,q=(u.get('q')||'').trim().slice(0,80),known=(u.get('k')||'').split(',').filter(x=>/^[\u3400-\u9fff]{1,8}$/.test(x)).slice(0,300);
    if(!q)return J(res,200,{options:[]});const p=await py2hz(q,known),out=[];
    if(p){out.push({zh:p.zh,how:'pinyin'});p.segs.forEach((g,i)=>g.opts.slice(1,4).forEach(o=>out.push({zh:p.segs.map((h,j)=>j===i?o.w:h.opts[0].w).join(''),how:'pinyin alt'})));}
    if(!p||/\s/.test(q)&&q.split(/\s+/).length>=2&&!p){try{const j=await (await fetch('https://api.mymemory.translated.net/get?q='+encodeURIComponent(q)+'&langpair=en|zh-CN')).json();const z=String((j.responseData||{}).translatedText||'').replace(/[a-zA-Z]/g,'').trim();if(z)out.push({zh:z,how:'English → Chinese (machine translation)'})}catch{}}
    return J(res,200,{options:out.filter((o,i)=>out.findIndex(x=>x.zh===o.zh)===i).slice(0,8),segs:p?p.segs:[]});
  }
  if(path==='/api/inspector/sentence'){
    // English / pinyin / 中文 -> Chinese + pinyin + English + word split (CC-CEDICT). Translation: free MyMemory API.
    let t=(new URL(req.url,'http://x').searchParams.get('t')||'').trim().slice(0,120);if(!t)return J(res,400,{error:'Type a sentence'});
    const tr=async(q,lp)=>{try{const j=await (await fetch('https://api.mymemory.translated.net/get?q='+encodeURIComponent(q)+'&langpair='+lp)).json();return String((j.responseData||{}).translatedText||'')}catch{return ''}};
    const isZh=/[\u3400-\u9fff]/.test(t),known=(new URL(req.url,'http://x').searchParams.get('k')||'').split(',').filter(x=>/^[\u3400-\u9fff]{1,8}$/.test(x));let zh=t,en='',src='zh';
    if(!isZh){const p=await py2hz(t,known);if(p){zh=p.zh;src='pinyin';en=await tr(zh,'zh-CN|en');}else{src='en';zh=(await tr(t,'en|zh-CN')).replace(/[a-zA-Z]/g,'').trim();en=t;}}
    else en=await tr(t.replace(/[。！？，]/g,''),'zh-CN|en');
    if(zh&&!/[。！？]$/.test(zh))zh+='。';
    const d=await cedict(),core=[...zh],words=[];for(let i=0;i<core.length;){if(!/[\u3400-\u9fff]/.test(core[i])){i++;continue}let L=Math.min(6,core.length-i);for(;L>1;L--)if(d.has(core.slice(i,i+L).join('')))break;const w=core.slice(i,i+L).join('');const E=d.get(w)||[],e=E.find(x=>!/^surname/i.test((x.defs||[''])[0]))||E[0]||{};words.push({w,py:toPinyin(w),def:(e.defs||[]).slice(0,2).join('; ')});i+=L}
    return J(res,200,{source:src,zh,pinyin:toPinyin(zh.replace(/[。！？，]/g,'')),en:en?en[0].toUpperCase()+en.slice(1):'',words,note:src==='en'?'Machine translation (MyMemory, free) — check the Chinese before saving.':src==='pinyin'?'Pinyin → Chinese via CC-CEDICT — check the characters.':''});
  }
  if(path==='/api/inspector/tts'&&req.method==='POST'){
    let q={};try{q=JSON.parse(await body(req));}catch{}
    const text=String(q.text||'').slice(0,60),voice=VOICES.includes(q.voice)?q.voice:VOICES[0],rate=/^[+-]\d{1,2}%$/.test(q.rate||'')?q.rate:'+0%';
    if(!/^[\u3000-\u9fff\uff00-\uffef\s]+$/.test(text))return J(res,400,{error:'Chinese text only (max 60 chars)'});
    try{const mp3=await edgeTts(text,voice,rate);res.writeHead(200,{'Content-Type':'audio/mpeg','Content-Length':mp3.length,'Cache-Control':'no-store'});return res.end(mp3);}
    catch(e){return J(res,502,{error:'TTS failed: '+String(e.message).slice(0,120)});}
  }
  if(path==='/api/inspector/charpack'){
    const cs=[...new Set([...(new URL(req.url,'http://x').searchParams.get('c')||'')].filter(c=>/[\u3400-\u9fff]/.test(c)))].slice(0,12);
    const out={};for(const c of cs){try{out[c]=await charData(c)}catch(e){out[c]={error:String(e.message).slice(0,80)}}}return J(res,200,{chars:out});
  }
  if(path==='/api/inspector/wordkit'){
    const w=(new URL(req.url,'http://x').searchParams.get('w')||'').trim().slice(0,8);
    if(!/^[\u3400-\u9fff]+$/.test(w))return J(res,400,{error:'Chinese characters only'});
    const d=await cedict(),M=await mmh().catch(()=>new Map());
    const chars=[...w].map(c=>{const e=M.get(c)||{},et=e.etymology||{};const comps=[...(e.decomposition||'')].filter(x=>/[\u2e80-\u9fff]/.test(x)&&x!==c&&!/[\u2ff0-\u2fff]/.test(x));
      return {c,pinyin:e.pinyin||[toPinyin(c)],definition:e.definition||'',radical:e.radical||'',etym:et,comps:comps.map(k=>{const m=M.get(k)||{};const ce=(d.get(k)||[])[0];
        return {c:k,py:(m.pinyin||[])[0]||(ce?ce.py:''),meaning:((ce?ce.defs.filter(x=>!/variant of|surname/i.test(x)).slice(0,2).join('; '):'')||m.definition||'').split(/[;,]/).slice(0,2).join(';').trim(),role:k===et.semantic?'meaning':k===et.phonetic?'sound':''}})}});
    let audio=[];try{audio=await commonsAudio(w)}catch{}
    return J(res,200,{word:w,pinyin:toPinyin(w),entries:d.get(w)||[],chars,audio});
  }
  if(path==='/api/inspector/commonsfile'){
    const t=new URL(req.url,'http://x').searchParams.get('t')||'';if(!/^File:LL-Q9192 \(cmn\)|^File:Cmn-|^File:Zh-/.test(t))return J(res,400,{error:'only Mandarin pronunciation files'});
    const r=await fetch('https://commons.wikimedia.org/wiki/Special:FilePath/'+encodeURIComponent(t.slice(5)),{headers:{'User-Agent':UA}});if(!r.ok)return J(res,502,{error:'Commons '+r.status});
    const b=Buffer.from(await r.arrayBuffer());res.writeHead(200,{'Content-Type':r.headers.get('content-type')||'audio/wav','Content-Length':b.length});return res.end(b);
  }
  if(path==='/api/inspector/image'){
    // free public generator (Pollinations, no key, no payment); upload stays available as the fallback
    const q=(new URL(req.url,'http://x').searchParams.get('p')||'').slice(0,400),seed=Math.floor(Math.random()*1e6);if(!q)return J(res,400,{error:'prompt required'});
    try{const r=await fetch('https://image.pollinations.ai/prompt/'+encodeURIComponent(q)+'?width=768&height=576&nologo=true&seed='+seed,{signal:AbortSignal.timeout(90000)});if(!r.ok)throw new Error('HTTP '+r.status);
      const b=Buffer.from(await r.arrayBuffer());res.writeHead(200,{'Content-Type':r.headers.get('content-type')||'image/jpeg','Content-Length':b.length});return res.end(b);}
    catch(e){return J(res,502,{error:'Image generator unavailable ('+String(e.message).slice(0,80)+') — upload a picture instead'})}
  }
  if(path==='/api/inspector/clone/status')return J(res,200,{enabled:!!MM(),voice:!!voiceId});
  if(path==='/api/inspector/clone/tts'&&req.method==='POST'){
    if(!MM())return J(res,503,{error:'MINIMAX_API_KEY not set on the server'});
    let q={};try{q=JSON.parse(await body(req));}catch{}
    const text=String(q.text||'').slice(0,40),speed=Math.min(1.2,Math.max(0.6,Number(q.speed)||1));
    if(!/^[\u3000-\u9fff\uff00-\uffef]+$/.test(text))return J(res,400,{error:'Chinese text only (max 40 chars)'});
    try{const mp3=await cloneTts(text,speed);res.writeHead(200,{'Content-Type':'audio/mpeg','Content-Length':mp3.length,'Cache-Control':'no-store'});return res.end(mp3);}
    catch(e){return J(res,502,{error:'MiniMax: '+String(e.message).slice(0,200)});}
  }
  if(path==='/api/inspector/variant-bundles'){
    // every inspector-data/*-variants.enc is a pre-generated "Replacement variants" bundle (made by tools/make_variants.py)
    let ids=[];try{ids=(await readdir(dataDir)).filter(f=>/^[a-z0-9_-]{1,64}-variants\.enc$/i.test(f)).map(f=>f.slice(0,-4)).sort();}catch{}
    return J(res,200,{bundles:ids});
  }
  if(path==='/api/inspector/decks'){
    let idx=[];try{idx=JSON.parse(dec(await readFile(new URL('index.enc',dataDir))).toString());}catch{}
    try{const i2=JSON.parse(dec(await readFile(new URL('index2.enc',dataDir))).toString());for(const d of i2){if(idx.some(x=>x.id===d.id))continue;let at=idx.findIndex(x=>x.id===d.after)+1;if(!at){for(let i=0;i<idx.length;i++)if(idx[i].group===d.group)at=i+1;}if(!at)at=idx.length;idx.splice(at,0,d);}}catch{}
    return J(res,200,{decks:idx.map(({id,name,group,size})=>({id,name,group,size})),encrypted:!!(KEY()||KEY2())});
  }
  if(path==='/api/inspector/deck'){
    const id=new URL(req.url,'http://x').searchParams.get('id')||'';
    if(!/^[a-z0-9_-]{1,64}$/i.test(id))return J(res,400,{error:'bad id'});
    if(!KEY()&&!KEY2())return J(res,503,{error:'INSPECTOR_DATA_KEY not set'});
    try{const out=dec(await readFile(new URL(id+'.enc',dataDir)));
      res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':out.length,'Cache-Control':'no-store'});return res.end(out);}
    catch(e){return J(res,404,{error:'deck not available'});}
  }
  return J(res,404,{error:'not found'});
}
