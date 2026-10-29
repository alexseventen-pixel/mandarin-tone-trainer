// Anki spoken-answer check: WAV -> transcript (OpenAI) -> fuzzy compare with expected hanzi -> correct/incorrect (+ tone analysis when short enough).
import { pinyin } from 'pinyin-pro';
import { parseWav, transcribe, analyze } from './analyze.js';

const onlyHan=s=>(String(s||'').match(/\p{Script=Han}/gu)||[]).join('');
const toneless=s=>s?pinyin(s,{toneType:'none',type:'array'}).join(' '):'';
function lev(a,b){a=[...a];b=[...b];const d=Array.from({length:a.length+1},(_,i)=>[i]);for(let j=1;j<=b.length;j++)d[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length][b.length];}
const sim=(a,b)=>{const m=Math.max([...a].length,[...b].length);return m?1-lev(a,b)/m:0;};
// best similarity of expected against any same-length window of heard (so extra words around it are tolerated)
function windowSim(exp,heard,fn){if(!exp)return 0;let best=fn(exp,heard);const H=[...heard],L=[...exp].length;
  for(let i=0;i+L<=H.length;i++)best=Math.max(best,fn(exp,H.slice(i,i+L).join('')));return best;}
const pySim=(e,h)=>sim(toneless(e).split(' ').join(''),toneless(h).split(' ').join(''));

export function judge(expectedParts,heardText,{mode='free',threshold}={}){
  const heard=onlyHan(heardText);
  const parts=expectedParts.map(onlyHan).filter(Boolean);
  const thr=threshold??(parts.join('').length<=2?0.99:0.75);
  const items=parts.map(p=>{const s=Math.max(windowSim(p,heard,sim),windowSim(p,heard,pySim));return {expected:p,similarity:+s.toFixed(3),ok:s>=thr,pos:heard.indexOf(p)};});
  let order_ok=true;
  if(mode==='ordered'&&items.length>1){const pos=items.map(i=>i.pos);order_ok=pos.every(p=>p>=0)&&pos.every((p,i)=>!i||p>pos[i-1]);}
  const correct=items.length>0&&items.every(i=>i.ok)&&(mode!=='ordered'||order_ok||items.some(i=>i.pos<0)&&items.every(i=>i.ok));
  return {heard:heardText,heard_hanzi:heard,threshold:thr,items,order_ok,correct,score:Math.round(100*(items.reduce((a,i)=>a+i.similarity,0)/(items.length||1)))};
}

export async function answer({wav,expected,mode,apiKey,tpKey,crepeUrl,tones=true}){
  const T0=Date.now();
  const {samples,rate}=parseWav(wav);
  const dur=samples.length/rate;
  if(dur<0.2)throw new Error('Recording too short');
  if(dur>60)throw new Error('Recording too long (max 60 s)');
  const parts=String(expected).split('|').map(s=>s.trim()).filter(Boolean);
  if(!parts.length)throw new Error('Need expected text');
  const full=parts.join('');
  const heard=await transcribe(wav,apiKey,full).catch(e=>{throw new Error('Transcription failed: '+e.message);});
  if(heard==null)throw new Error('Server has no OpenAI key');
  const verdict=judge(parts,heard,{mode});
  let tone=null;const hz=onlyHan(full);
  if(tones&&hz.length&&hz.length<=40&&dur<=12){try{tone=await analyze({wav,hanzi:hz,pinyin:'',apiKey,tpKey,crepeUrl,spk:{}});}catch(e){tone={error:e.message};}}
  return {...verdict,mode,expected:parts,duration_s:+dur.toFixed(2),tone,timings:{total_ms:Date.now()-T0}};
}
