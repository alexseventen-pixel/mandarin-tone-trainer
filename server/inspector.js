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
export async function handleInspector(req,res,path){
  if(!PASS())return J(res,503,{error:'Inspector is disabled: set INSPECTOR_PASSCODE on the server'});
  if(path==='/api/inspector/login'&&req.method==='POST'){
    if(fails>=10&&Date.now()-failT<600000)return J(res,429,{error:'Too many attempts, wait 10 min'});
    let code='';try{code=JSON.parse(await body(req)).code||'';}catch{}
    if(!eq(code,PASS())){fails++;failT=Date.now();return J(res,401,{error:'Wrong passcode'});}
    fails=0;return J(res,200,{token:tok()});
  }
  if(!eq(req.headers['x-insp-token']||'',tok()))return J(res,401,{error:'Login required'});
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
