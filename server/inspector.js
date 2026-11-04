// Deck Inspector API: passcode-gated. Preloaded decks are stored AES-256-GCM encrypted in inspector-data/;
// the key lives only in the Render env (INSPECTOR_DATA_KEY). Disabled unless INSPECTOR_PASSCODE is set.
import { readFile } from 'node:fs/promises';
import { createHmac, createDecipheriv, timingSafeEqual } from 'node:crypto';
const dataDir=new URL('../inspector-data/',import.meta.url);
const PASS=()=>process.env.INSPECTOR_PASSCODE||'', KEY=()=>process.env.INSPECTOR_DATA_KEY||'';
const tok=()=>createHmac('sha256',PASS()).update('deck-inspector-v1').digest('hex');
const eq=(a,b)=>{a=Buffer.from(String(a));b=Buffer.from(String(b));return a.length===b.length&&timingSafeEqual(a,b);};
const J=(res,s,d)=>{res.writeHead(s,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(d));};
async function body(req){const c=[];let n=0;for await(const x of req){n+=x.length;if(n>10000)throw new Error('too big');c.push(x);}return Buffer.concat(c).toString();}
function dec(b){const d=createDecipheriv('aes-256-gcm',Buffer.from(KEY(),'hex'),b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]);}
let fails=0,failT=0;
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
export async function handleInspector(req,res,path){
  if(!PASS())return J(res,503,{error:'Inspector is disabled: set INSPECTOR_PASSCODE on the server'});
  if(path==='/api/inspector/login'&&req.method==='POST'){
    if(fails>=10&&Date.now()-failT<600000)return J(res,429,{error:'Too many attempts, wait 10 min'});
    let code='';try{code=JSON.parse(await body(req)).code||'';}catch{}
    if(!eq(code,PASS())){fails++;failT=Date.now();return J(res,401,{error:'Wrong passcode'});}
    fails=0;return J(res,200,{token:tok()});
  }
  if(!eq(req.headers['x-insp-token']||'',tok()))return J(res,401,{error:'Login required'});
  if(path==='/api/inspector/clone/status')return J(res,200,{enabled:!!MM(),voice:!!voiceId});
  if(path==='/api/inspector/clone/tts'&&req.method==='POST'){
    if(!MM())return J(res,503,{error:'MINIMAX_API_KEY not set on the server'});
    let q={};try{q=JSON.parse(await body(req));}catch{}
    const text=String(q.text||'').slice(0,40),speed=Math.min(1.2,Math.max(0.6,Number(q.speed)||1));
    if(!/^[\u3000-\u9fff\uff00-\uffef]+$/.test(text))return J(res,400,{error:'Chinese text only (max 40 chars)'});
    try{const mp3=await cloneTts(text,speed);res.writeHead(200,{'Content-Type':'audio/mpeg','Content-Length':mp3.length,'Cache-Control':'no-store'});return res.end(mp3);}
    catch(e){return J(res,502,{error:'MiniMax: '+String(e.message).slice(0,200)});}
  }
  if(path==='/api/inspector/decks'){
    let idx=[];try{idx=JSON.parse(dec(await readFile(new URL('index.enc',dataDir))).toString());}catch{}
    return J(res,200,{decks:idx.map(({id,name,group,size})=>({id,name,group,size})),encrypted:!!KEY()});
  }
  if(path==='/api/inspector/deck'){
    const id=new URL(req.url,'http://x').searchParams.get('id')||'';
    if(!/^[a-z0-9_-]{1,64}$/i.test(id))return J(res,400,{error:'bad id'});
    if(!KEY())return J(res,503,{error:'INSPECTOR_DATA_KEY not set'});
    try{const out=dec(await readFile(new URL(id+'.enc',dataDir)));
      res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':out.length,'Cache-Control':'no-store'});return res.end(out);}
    catch(e){return J(res,404,{error:'deck not available'});}
  }
  return J(res,404,{error:'not found'});
}
