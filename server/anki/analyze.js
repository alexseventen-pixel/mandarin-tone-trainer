import { randomUUID } from 'node:crypto';
// Anki card pronunciation analysis: WAV (16-bit PCM, sent by the card) -> transcript + pitch + tone verdicts.
import { pinyin } from 'pinyin-pro';

export function parseWav(buf){
  if(buf.toString('ascii',0,4)!=='RIFF'||buf.toString('ascii',8,12)!=='WAVE')throw new Error('Expected WAV audio (16-bit PCM)');
  let off=12,fmt=null,data=null;
  while(off+8<=buf.length){
    const id=buf.toString('ascii',off,off+4),size=buf.readUInt32LE(off+4);
    if(id==='fmt ')fmt={format:buf.readUInt16LE(off+8),channels:buf.readUInt16LE(off+10),rate:buf.readUInt32LE(off+12),bits:buf.readUInt16LE(off+22)};
    if(id==='data'){data=buf.subarray(off+8,Math.min(buf.length,off+8+size));break;}
    off+=8+size+(size&1);
  }
  if(!fmt||!data||fmt.format!==1||fmt.bits!==16)throw new Error('Only 16-bit PCM WAV is supported');
  const n=Math.floor(data.length/2/fmt.channels),out=new Float32Array(n);
  for(let i=0;i<n;i++){let s=0;for(let c=0;c<fmt.channels;c++)s+=data.readInt16LE((i*fmt.channels+c)*2);out[i]=s/fmt.channels/32768;}
  return {samples:out,rate:fmt.rate};
}

// YIN pitch tracker, 10 ms hop
export function trackPitch(x,rate,{minF=70,maxF=500,hop=0.01,win=0.04,thr=0.15}={}){
  const W=Math.round(win*rate),H=Math.round(hop*rate),tMin=Math.floor(rate/maxF),tMax=Math.ceil(rate/minF);
  let peak=0;for(const v of x)peak=Math.max(peak,Math.abs(v));
  const frames=[],d=new Float32Array(tMax+1);
  for(let st=0;st+W+tMax<x.length;st+=H){
    let e=0;for(let i=0;i<W;i++)e+=x[st+i]*x[st+i];
    const rms=Math.sqrt(e/W),t=(st+W/2)/rate;
    if(rms<Math.max(0.003,peak*0.04)){frames.push({t,f0:null,rms});continue;}
    d[0]=1;let run=0,tau=-1;
    for(let k=1;k<=tMax;k++){let s=0;for(let i=0;i<W;i++){const df=x[st+i]-x[st+i+k];s+=df*df;}run+=s;d[k]=run?s*k/run:1;}
    for(let k=tMin;k<=tMax;k++){if(d[k]<thr){while(k+1<=tMax&&d[k+1]<d[k])k++;tau=k;break;}}
    if(tau<0){let mk=-1;for(let k=tMin;k<=tMax;k++)if(mk<0||d[k]<d[mk])mk=k;if(mk>0&&d[mk]<0.35)tau=mk;} // weaker but still periodic (real phone voice)
    if(tau<0){frames.push({t,f0:null,rms});continue;}
    const a=d[tau-1]??d[tau],b=d[tau],c=d[tau+1]??d[tau],den=a-2*b+c,p=den?tau+0.5*(a-c)/den:tau;
    frames.push({t,f0:rate/p,rms});
  }
  // median smoothing + octave-jump cleanup
  const f=frames.map(fr=>fr.f0);
  for(let i=0;i<f.length;i++){if(f[i]==null)continue;const w=f.slice(Math.max(0,i-2),i+3).filter(v=>v!=null).sort((p,q)=>p-q);frames[i].f0=w[w.length>>1];}
  return frames;
}

// Target contours (Chao 5-level scale, mapped to semitones-ish around speaker's range), 0..1 time
const TEMPLATES={1:[5,5,5,5,5],2:[3,3.4,4,4.6,5],3:[2.1,1.5,1.1,1.4,2.2],4:[5,4.4,3.5,2.4,1],5:[3,2.9,2.8,2.7,2.6]};
const TONE_RU={1:'1-й (ровный высокий)',2:'2-й (восходящий)',3:'3-й (низкий, провал)',4:'4-й (резко нисходящий)',5:'нейтральный'};
const toSt=f=>12*Math.log2(f/100);
const resample=(arr,n)=>Array.from({length:n},(_,i)=>{const p=i*(arr.length-1)/(n-1),lo=Math.floor(p),hi=Math.min(arr.length-1,lo+1);return arr[lo]+(arr[hi]-arr[lo])*(p-lo);});

function classify(seg,multi){ // seg: 5 points, semitones relative to speaker median
  const mean=v=>v.reduce((p,q)=>p+q,0)/v.length;
  const level=mean(seg),slope=seg[4]-seg[0],mid=Math.min(seg[1],seg[2],seg[3]),dip=Math.min(seg[0],seg[4])-mid;
  const shape=seg.map(v=>v-level),scores={};
  for(const t of [1,2,3,4]){
    const tpl=TEMPLATES[t].map(v=>(v-3)*1.6),tm=mean(tpl);
    let s=0;for(let i=0;i<5;i++)s+=(shape[i]-(tpl[i]-tm))**2;
    scores[t]=Math.sqrt(s/5)+(multi?0.35*Math.abs(level-tm):0);
  }
  if(dip>1.2)scores[3]-=1;
  if(multi&&level<-2&&Math.abs(slope)<2)scores[3]-=0.8; // half-third: low and flat
  const best=Object.entries(scores).sort((a,b)=>a[1]-b[1])[0];
  return {tone:Number(best[0]),slope:+slope.toFixed(2),level:+level.toFixed(2),dip:+dip.toFixed(2)};
}

function tonesFromPinyin(py){ // 'méi guānxi' -> [2,1,5]; uses pinyin-pro to split joined syllables
  if(!py)return null;const out=[];
  for(const word of py.trim().split(/\s+/)){
    const plain=word.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ü/g,'v').toLowerCase();
    const parts=plain.match(/(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(iang|iong|uang|ang|eng|ing|ong|ian|iao|uai|uan|van|ai|ei|ao|ou|an|en|in|un|vn|ia|ie|iu|ua|uo|ui|ve|ue|er|a|o|e|i|u|v)(?![aeiouv])|(?:r)/g)||[];
    let pos=0;const nfd=word.normalize('NFD');
    for(const part of parts){
      // find tone mark within this syllable's span in the NFD string
      let len=0,seg='';for(;pos<nfd.length&&len<part.length;pos++){seg+=nfd[pos];if(!/[\u0300-\u036f]/.test(nfd[pos]))len++;}
      while(pos<nfd.length&&/[\u0300-\u036f]/.test(nfd[pos]))seg+=nfd[pos++];
      out.push(/\u0304/.test(seg)?1:/\u0301/.test(seg)?2:/\u030c/.test(seg)?3:/\u0300/.test(seg)?4:5);
    }
  }
  return out;
}

function targetSyllables(text,py){
  // display = dictionary (lexical) pinyin as on the card; tone = surface tone actually spoken (sandhi applied)
  const chars=[...text].filter(c=>/\p{Script=Han}/u.test(c)),joined=chars.join('');
  const sb={yi:true,bu:true,thirdTone:true};
  const lexMark=pinyin(joined,{toneType:'symbol',type:'array',toneSandhi:false});
  const lexNum=pinyin(joined,{toneType:'num',type:'array',toneSandhi:false});
  const surfNum=pinyin(joined,{toneType:'num',type:'array',toneSandhi:sb});
  const surfMark=pinyin(joined,{toneType:'symbol',type:'array',toneSandhi:sb});
  const card=tonesFromPinyin(py),useCard=card&&card.length===chars.length;
  const toneOf=p=>Number(String(p||'').match(/[0-5]$/)?.[0]||5)||5;
  const strip=p=>p.normalize('NFD').replace(/[\u0300-\u036f]/g,'').normalize();
  return chars.map((c,i)=>{
    let lex=useCard?card[i]:toneOf(lexNum[i]);
    if(!useCard&&i>0&&chars[i-1]===c&&chars.length===2)lex=5; // reduplication 谢谢/妈妈
    const neutral=lex===5,surf=neutral?5:toneOf(surfNum[i]);
    const disp=neutral?strip(lexMark[i]):lexMark[i];
    return {hanzi:c,pinyin:disp,lexical_tone:lex,tone:surf,sandhi:surf!==lex?{tone:surf,pinyin:surfMark[i]}:null};
  });
}

function tipFor(exp,got,feat){
  if(exp===got)return null;
  const m={
    '1':'Держи голос ровно и высоко, без подъёма и спада — как долгое «ммм» на одной ноте.',
    '2':'Голос должен уверенно подниматься снизу вверх, как вопрос «да?».',
    '3':'Начни ниже обычного и опустись ещё ниже (в связной речи часто хватает низкого «провала» без подъёма).',
    '4':'Резко и коротко сверху вниз, как команда «Стоп!».',
    '5':'Произнеси коротко и легко, без собственного тона.'};
  return `Ожидался ${TONE_RU[exp]}, а прозвучало похоже на ${TONE_RU[got]}. ${m[exp]}`;
}

export async function transcribe(wavBuf,apiKey,prompt){
  if(!apiKey)return null;
  const form=new FormData();
  form.append('file',new Blob([wavBuf],{type:'audio/wav'}),'rec.wav');
  form.append('model',process.env.ANKI_TRANSCRIBE_MODEL||'gpt-4o-transcribe');
  form.append('language','zh');
  const r=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`},body:form});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j?.error?.message||`OpenAI ${r.status}`);
  return (j.text||'').trim();
}

// TonePerfect: per-syllable initial/final/tone assessment (sandhi-aware)
const DIM_RU={initial:'начальный согласный',final:'гласная/финаль'};
export async function assessTonePerfect(wav,chars,cardTones,key){
  if(!key)throw new Error('TONEPERFECT_API_KEY not set');
  const base=pinyin(chars.join(''),{toneType:'num',type:'array'}); // no sandhi: TonePerfect applies it
  const py=base.map((p,i)=>{const t=cardTones&&cardTones.length===chars.length?cardTones[i]:Number(p.slice(-1))||5;return p.replace(/[0-5]$/,'').replace(/ü/g,'v')+t;}).join(' ');
  const form=new FormData();
  form.append('audio',new Blob([wav],{type:'audio/wav'}),'rec.wav');
  form.append('text',chars.join(''));form.append('pinyin',py);form.append('language','zh-CN');
  form.append('task',process.env.TP_TASK||'connected_speech'); // TonePerfect: correction decisions (review/uncertain) are calibrated only for connected_speech
  const ctl=new AbortController();const to=setTimeout(()=>ctl.abort(),30000);
  try{
    const r=await fetch('https://api.toneperfect.app/v1/assess',{method:'POST',signal:ctl.signal,headers:{Authorization:`Bearer ${key}`,'Idempotency-Key':`anki-${randomUUID()}`},body:form});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(`${r.status} ${j?.error?.code||''}: ${j?.error?.message||'TonePerfect error'}`);
    return {...j,sent_pinyin:py};
  }finally{clearTimeout(to);}
}

// ---- clean contour: octave fix, median filter, gap interpolation, smoothing, Chao 1..5 normalisation ----
const pct=(arr,p)=>{const v=[...arr].sort((a,b)=>a-b);return v[Math.min(v.length-1,Math.max(0,Math.round(p*(v.length-1))))];};
function chaoTarget(tone,i,n,prev){
  if(tone===3)return (n>1&&i<n-1)?[2,1.6,1.2,1.1,1.2]:[2,1.4,1,1.8,3.6]; // half-third inside a word, full 214 at the end
  if(tone===5){const lv={1:2.2,2:3,3:3.8,4:1.6}[prev]||2.5;return [lv,lv,lv-0.2,lv-0.3,lv-0.4];}
  return {1:[5,5,5,5,5],2:[3,3.3,3.9,4.5,5],4:[5,4.4,3.4,2.2,1]}[tone];
}
export function buildContour(frames,spans,target,oks,spk){
  const hop=0.01,st=frames.map(f=>f.f0&&isFinite(f.f0)&&f.f0>0?toSt(f.f0):null);
  const vals=st.filter(v=>v!=null);
  const med=vals.length?pct(vals,0.5):12;
  for(let i=0;i<st.length;i++){let v=st[i];if(v==null)continue;while(v-med>7.5)v-=12;while(med-v>9)v+=12;st[i]=Math.abs(v-med)>10?null:v;} // octave errors
  const clean=(medW,minIsland,avgW)=>{
  const mf=st.map((v,i)=>{if(v==null)return null;if(!medW)return v;const w=st.slice(Math.max(0,i-medW),i+medW+1).filter(x=>x!=null).sort((a,b)=>a-b);return w.length>=Math.min(3,medW+1)?w[w.length>>1]:v;});
  for(let i=0;i<mf.length;){if(mf[i]==null){i++;continue;}let j=i;while(j<mf.length&&mf[j]!=null)j++;if(j-i<minIsland)for(let k=i;k<j;k++)mf[k]=null;i=j;}
  const interp=mf.map(()=>false);
  for(let i=0;i<mf.length;){if(mf[i]!=null){i++;continue;}let j=i;while(j<mf.length&&mf[j]==null)j++;
    if(i>0&&j<mf.length&&j-i<=15){const a=mf[i-1],b=mf[j];for(let k=i;k<j;k++){mf[k]=a+(b-a)*(k-i+1)/(j-i+1);interp[k]=true;}}i=j;}
  const sm=mf.map((v,i)=>{if(v==null)return null;let s=0,n=0;for(let k=i-avgW;k<=i+avgW;k++)if(mf[k]!=null){s+=mf[k];n++;}return s/n;});
  return {sm,interp};};
  // heavy cleaning first; if it eats the voice (sparse real-mic pitch), fall back to lighter / raw — never drop the line
  const need=Math.max(3,Math.round(vals.length*0.5));let level='heavy';
  let {sm,interp}=clean(3,4,2);
  if(sm.filter(v=>v!=null).length<need){({sm,interp}=clean(1,2,1));level='light';}
  if(sm.filter(v=>v!=null).length<Math.min(need,vals.length)){sm=st.slice();interp=st.map(()=>false);level='raw';}
  const good=sm.filter(v=>v!=null&&isFinite(v));let lo=good.length?pct(good,0.05):med-3.5,hi=good.length?pct(good,0.95):med+3.5;
  if(spk&&isFinite(spk.lo)&&isFinite(spk.hi)&&spk.hi-spk.lo>=5&&spk.hi-spk.lo<=18){lo=Math.min(lo,spk.lo);hi=Math.max(hi,spk.hi);}
  if(hi-lo<7){ // narrow recording (flat word): place it on a 7-st range so its mean height matches the expected tones' mean height
    let acc=0,n=0;target.forEach((s,i)=>{const seg=sm.filter((v,k)=>v!=null&&frames[k].t>=spans[i][0]&&frames[k].t<spans[i][1]);if(!seg.length)return;
      const u=seg.reduce((a,b)=>a+b,0)/seg.length,tg=chaoTarget(s.tone,i,target.length,i?target[i-1].tone:0),tm=tg.reduce((a,b)=>a+b,0)/tg.length;acc+=u-(tm-1)*7/4;n++;});
    const m=(hi+lo)/2;lo=n?Math.max(m-6,Math.min(m-1,acc/n)):m-3.5;hi=lo+7;}
  const toC=v=>!isFinite(v)?3:Math.max(0.6,Math.min(5.4,1+4*(v-lo)/(hi-lo)));
  const user=[];sm.forEach((v,i)=>{if(v!=null&&isFinite(v))user.push({t:+frames[i].t.toFixed(3),c:+toC(v).toFixed(2),...(interp[i]?{g:1}:{})});else if(user.length&&user[user.length-1]!==null)user.push(null);});
  while(user.length&&user[user.length-1]===null)user.pop();
  const syl=target.map((s,i)=>({hanzi:s.hanzi,pinyin:s.pinyin,tone:s.tone,ok:oks?oks[i]:null,start:+spans[i][0].toFixed(3),end:+spans[i][1].toFixed(3),
    target:chaoTarget(s.tone,i,target.length,i?target[i-1].tone:0)}));
  const t0=Math.max(0,Math.min(syl[0]?.start??0,user.find(p=>p)?.t??0)-0.05),t1=Math.max(syl[syl.length-1]?.end??0,[...user].reverse().find(p=>p)?.t??0)+0.05;
  return {unit:'chao',t0:+t0.toFixed(3),t1:+t1.toFixed(3),user,syllables:syl,range:{lo:+lo.toFixed(2),hi:+hi.toFixed(2),obs_lo:good.length?+pct(good,0.05).toFixed(2):null,obs_hi:good.length?+pct(good,0.95).toFixed(2):null},voiced_frames:vals.length,clean_level:level,points:user.filter(Boolean).length};
}

function spansFrom(tp,frames,n){
  const w=tp?.words||[],sy=tp?.syllables||[];
  const sp=Array.from({length:n},(_,i)=>{
    const a=w[i]?.start_ms??sy[i]?.span_ms?.[0],b=w[i]?.end_ms??sy[i]?.span_ms?.[1];
    return a!=null&&b!=null&&b>a?[a/1000,b/1000]:null;});
  if(sp.every(Boolean))return {spans:sp,source:'toneperfect'};
  const v=frames.filter(f=>f.f0);const t0=v[0]?.t??0,t1=v[v.length-1]?.t??0.5,d=Math.max(0.1,t1-t0);
  return {spans:Array.from({length:n},(_,i)=>[t0+d*i/n,t0+d*(i+1)/n]),source:'even'};
}

// CREPE (neural pitch, Veesp VPS): second-opinion tone check, numbered surface-tone pinyin, 20 s timeout
export async function assessCrepe(wav,target,url){
  if(!url)throw new Error('CREPE_URL not set');
  const py=pinyin(target.map(s=>s.hanzi).join(''),{toneType:'none',type:'array'}).map((p,i)=>p.replace(/ü/g,'v')+target[i].tone).join(' ');
  const ctl=new AbortController();const to=setTimeout(()=>ctl.abort(),Number(process.env.CREPE_TIMEOUT_MS||20000));
  try{
    const r=await fetch(url,{method:'POST',signal:ctl.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({audioBase64:wav.toString('base64'),text:target.map(s=>s.hanzi).join(''),pinyin:py,language:'zh-CN'})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j?.error?.message||j?.error||`CREPE ${r.status}`);
    const words=j.words||[];
    return {used:true,model_version:j.model_version||null,scores:j.scores||null,sent_pinyin:py,mean_confidence:j.audio?.mean_crepe_confidence??null,
      syllables:target.map((s,i)=>{const w=words[i]||{},t=(w.phones||[]).find(p=>p.dimension==='tone')||{};
        return {hanzi:s.hanzi,expected:s.tone,heard_tone:t.heard??null,score:w.score??null,decision:t.decision||w.decision||null,confidence:w.analysis?.mean_crepe_confidence??null,start_ms:w.start_ms??null,end_ms:w.end_ms??null};})};
  }catch(e){return {used:false,error:e.name==='AbortError'?'CREPE timeout':e.message};}
  finally{clearTimeout(to);}
}
const crepeNote=c=>c?.used?c.syllables:null;

export async function analyze({wav,hanzi,pinyin:py,apiKey,tpKey,crepeUrl,spk}){
  const T0=Date.now(),timings={};
  const {samples,rate}=parseWav(wav);
  if(samples.length<rate*0.2)throw new Error('Запись слишком короткая');
  if(samples.length>rate*12)throw new Error('Запись слишком длинная (макс. 12 с)');
  const target=targetSyllables(hanzi,py);
  if(!target.length)throw new Error('No Chinese characters in expected text');
  const chars=target.map(s=>s.hanzi);
  // TonePerfect runs in parallel with local pitch tracking; OpenAI transcription only as fallback
  const tpP=(async()=>{const t=Date.now();try{return await assessTonePerfect(wav,chars,target.map(s=>s.lexical_tone),tpKey);}catch(e){return {error:e.message};}finally{timings.toneperfect_ms=Date.now()-t;}})();
  const crP=(async()=>{const t=Date.now();try{return await assessCrepe(wav,target,crepeUrl);}finally{timings.crepe_ms=Date.now()-t;}})();
  let t=Date.now();const frames=trackPitch(samples,rate);timings.pitch_ms=Date.now()-t;
  const [tp,crepe]=await Promise.all([tpP,crP]);
  const pitch_source=crepe.used?'yin+crepe':'yin';
  const addCrepe=syls=>syls.map((s,i)=>{const c=crepe.used?crepe.syllables[i]:null;return c?{...s,crepe_tone:c.heard_tone,crepe_score:c.score,crepe_decision:c.decision}:s;});
  if(tp.error){
    t=Date.now();const res=await analyzeHeuristic({wav,hanzi,pinyin:py,apiKey});timings.fallback_ms=Date.now()-t;
    if(crepe.used&&res.syllables?.length===target.length){
      res.syllables=res.syllables.map((s,i)=>{const c=crepe.syllables[i];if(!c||c.heard_tone==null||c.decision==='uncertain')return s;
        const ok=c.decision!=='review';return {...s,heard_tone:Number(c.heard_tone),ok,verdict:ok?'верно':`похоже на ${c.heard_tone}-й`,tone_source:'crepe'};});
    }
    const {spans}=spansFrom(null,frames,target.length);
    return {...res,syllables:addCrepe(res.syllables||[]),provider:'fallback',provider_error:tp.error,crepe,pitch_source,contour:buildContour(frames,spans,target,res.syllables.map(s=>s.ok),spk),timings:{...timings,server_ms:Date.now()-T0}};
  }
  const {spans,source}=spansFrom(tp,frames,target.length);
  const base={expected:{hanzi:chars.join(''),pinyin:target.map(s=>s.pinyin).join(' ')},
    heard:{text:null,pinyin:Array.isArray(tp.heard?.syllables)?tp.heard.syllables.map(h=>typeof h==='string'?h:`${h.initial||''}${h.final||''}${h.tone??''}`):null},provider:'toneperfect',task:tp.task,model_version:tp.model_version,billing:tp.billing||null,tp_request:tp.id,span_source:source,crepe,pitch_source};
  if(!tp.assessable){
    const why={no_speech:'Голос не слышен — говори громче и ближе к микрофону.',no_audio:'Голос не слышен — говори громче.',too_short:'Слишком коротко — произнеси слово целиком.',different_content:'Похоже, прозвучало другое слово — попробуй ещё раз.'}[tp.reason]||'Запись не удалось оценить — попробуй ещё раз.';
    const syllables=target.map(s=>({...s,ok:false,verdict:'не оценено'}));
    return {...base,score:0,assessable:false,reason:tp.reason,tips:[why],syllables,contour:buildContour(frames,spans,target,null,spk),timings:{...timings,server_ms:Date.now()-T0}};
  }
  const tips=[];
  const syllables=target.map((s,i)=>{
    const w=(tp.words||[])[i]||{},comp=(tp.syllables||[])[i]?.components||{};
    const ph=d=>(w.phones||[]).find(p=>p.dimension===d)||null;
    const t=ph('tone'),ini=ph('initial'),fin=ph('final');
    const bad=[t,ini,fin].filter(p=>p&&p.decision==='review');
    const ok=!bad.length;
    const heardTone=t&&t.heard!=null?Number(t.heard):null;
    const expTone=t&&t.expected!=null?Number(t.expected):s.tone;
    const parts=[];
    if(t&&t.decision==='review'){parts.push(`тон ${heardTone} вместо ${expTone}`);const tip=tipFor(expTone,heardTone);if(tip)tips.push(`${s.hanzi} (${s.pinyin}): ${tip}`);}
    for(const p of [ini,fin])if(p&&p.decision==='review'){parts.push(`${DIM_RU[p.dimension]} «${p.heard||'—'}» вместо «${p.expected}»`);tips.push(`${s.hanzi} (${s.pinyin}): ${DIM_RU[p.dimension]} — прозвучало «${p.heard||'—'}», нужно «${p.expected}».`);}
    const unsure=[t,ini,fin].some(p=>p&&p.decision==='uncertain');
    const alt=(comp.tone?.alternatives||[]).map(a=>({tone:Number(a.label),p:+(+a.probability).toFixed(2)})).sort((x,y)=>y.p-x.p).slice(0,3);
    return {...s,heard_tone:heardTone,ok,unsure,verdict:ok?(unsure?'скорее верно':'верно'):parts.join(', '),
      score:w.score??null,tone_score:t?.score??null,tone_alternatives:alt.length?alt:null,start_ms:w.start_ms??null,end_ms:w.end_ms??null,
      initial:ini?{expected:ini.expected,heard:ini.heard,score:ini.score,decision:ini.decision}:null,
      final:fin?{expected:fin.expected,heard:fin.heard,score:fin.score,decision:fin.decision}:null,tone_decision:t?.decision||null};
  });
  const score=Math.round(tp.scores?.overall??0);
  if(!tips.length)tips.push(score>=85?'Отлично! Тоны и звуки на месте.':syllables.some(s=>s.unsure)?'Явных ошибок нет, но в некоторых слогах ИИ не уверен — произнеси чётче.':'Ошибок не найдено, но можно произнести чётче и увереннее.');
  t=Date.now();const contour=buildContour(frames,spans,target,syllables.map(s=>s.ok),spk);timings.contour_ms=Date.now()-t;
  timings.server_ms=Date.now()-T0;
  return {...base,assessable:true,score,syllables:addCrepe(syllables),tips,
    scores:{overall:tp.scores?.overall??null,initial:tp.scores?.initial??null,final:tp.scores?.final??null,tone:tp.scores?.tone??null},
    contour,timings,note:'Scores and verdicts: TonePerfect (errors only when decision=review). Second-opinion tone per syllable: CREPE (crepe_tone/crepe_score). Contour: YIN pitch, cleaned, Chao 1-5, segmented by TonePerfect syllable timings.'};
}

async function analyzeHeuristic({wav,hanzi,pinyin:py,apiKey}){
  const {samples,rate}=parseWav(wav);
  if(samples.length<rate*0.25)throw new Error('Запись слишком короткая');
  if(samples.length>rate*12)throw new Error('Запись слишком длинная (макс. 12 с)');
  const target=targetSyllables(hanzi,py);
  if(!target.length)throw new Error('No Chinese characters in expected text');
  const [heard,frames]=await Promise.all([transcribe(wav,apiKey).catch(e=>({error:e.message})),Promise.resolve(trackPitch(samples,rate))]);
  const voiced=frames.filter(f=>f.f0);
  const tips=[];let syllables=[],userContour=[],targetContour=[];
  if(voiced.length<5){
    tips.push('Голос почти не слышен — говори громче и ближе к микрофону.');
  }else{
    const sts=voiced.map(f=>toSt(f.f0)).sort((a,b)=>a-b);
    const centre=sts[sts.length>>1];
    const t0=voiced[0].t,t1=voiced[voiced.length-1].t,dur=Math.max(0.05,t1-t0);
    userContour=frames.filter(f=>f.t>=t0&&f.t<=t1).map(f=>({t:+((f.t-t0)/dur).toFixed(3),st:f.f0?+(toSt(f.f0)-centre).toFixed(2):null}));
    const n=target.length;
    target.forEach((s,i)=>{
      const a=t0+dur*i/n,b=t0+dur*(i+1)/n;
      const seg=voiced.filter(f=>f.t>=a&&f.t<b).map(f=>toSt(f.f0)-centre);
      const tpl=TEMPLATES[s.tone].map(v=>(v-3)*1.6);
      tpl.forEach((v,k)=>targetContour.push({t:+((i+k/4*0.9+0.05)/n).toFixed(3),st:+v.toFixed(2),syl:i}));
      if(seg.length<3){syllables.push({...s,heard_tone:null,ok:false,verdict:'не слышно'});return;}
      const trim=seg.slice(Math.floor(seg.length*0.1),Math.ceil(seg.length*0.9));
      const c=classify(resample(trim.length>=2?trim:seg,5),n>1);
      let ok=c.tone===s.tone||(s.tone===5)||(s.tone===3&&n>1&&i<n-1&&c.tone!==1&&c.tone!==2&&false);
      if(s.tone===3&&c.tone===3)ok=true;
      if(s.tone===3&&i===n-1&&n>1&&c.level<0)ok=true; // final half-third
      syllables.push({...s,heard_tone:c.tone,ok,verdict:ok?'верно':`похоже на ${c.tone}-й`,features:c});
      const tip=ok?null:tipFor(s.tone,c.tone,c);if(tip)tips.push(`${s.hanzi} (${s.pinyin}): ${tip}`);
    });
  }
  const heardText=typeof heard==='string'?heard:null;
  const heardHan=heardText?[...heardText].filter(c=>/\p{Script=Han}/u.test(c)).join(''):'';
  let textScore=null;
  if(heardText!==null){
    // compare toneless pinyin, so traditional characters / homophones still count as correct sounds
    const plain=t=>pinyin(t,{toneType:'none',type:'array',nonZh:'removed'});
    const exp=plain(target.map(s=>s.hanzi).join(''));let hit=0;const pool=heardHan?plain(heardHan):(heardText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z]+/g)||[]);
    for(const c of exp){const k=pool.indexOf(c);if(k>=0){hit++;pool.splice(k,1);}}
    textScore=hit/exp.length;
    if(textScore<1)tips.unshift(heardHan?`Распознано как «${heardHan}» вместо «${target.map(s=>s.hanzi).join('')}» — проговори чётче.`:'Слова не распознаны — попробуй ещё раз, чётче.');
  }
  const toneScore=syllables.length?syllables.filter(s=>s.ok).length/syllables.length:0;
  const score=Math.round(100*(textScore===null?toneScore:0.4*textScore+0.6*toneScore));
  if(!tips.length)tips.push(score>=90?'Отлично! Тоны и звуки на месте.':'Неплохо, попробуй ещё раз чуть выразительнее.');
  return {
    score,expected:{hanzi:target.map(s=>s.hanzi).join(''),pinyin:target.map(s=>s.pinyin).join(' ')},
    heard:{text:heardText,pinyin:heardHan?pinyin(heardHan,{toneType:'symbol'}):null,error:heard&&heard.error||undefined},
    syllables,contour:{user:userContour,target:targetContour,unit:'semitones relative to speaker median'},tips,
    note:'Tone check is heuristic (YIN pitch + template matching); syllables are split evenly over the voiced span.'
  };
}
