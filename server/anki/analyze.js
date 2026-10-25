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
    if(rms<Math.max(0.01,peak*0.05)){frames.push({t,f0:null,rms});continue;}
    d[0]=1;let run=0,tau=-1;
    for(let k=1;k<=tMax;k++){let s=0;for(let i=0;i<W;i++){const df=x[st+i]-x[st+i+k];s+=df*df;}run+=s;d[k]=run?s*k/run:1;}
    for(let k=tMin;k<=tMax;k++){if(d[k]<thr){while(k+1<=tMax&&d[k+1]<d[k])k++;tau=k;break;}}
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
  const chars=[...text].filter(c=>/\p{Script=Han}/u.test(c));
  const num=pinyin(chars.join(''),{toneType:'num',type:'array',toneSandhi:{yi:true,bu:true,thirdTone:true}});
  const mark=pinyin(chars.join(''),{toneType:'symbol',type:'array',toneSandhi:{yi:true,bu:true,thirdTone:true}});
  const card=tonesFromPinyin(py);
  if(card&&card.length===chars.length)return chars.map((c,i)=>({hanzi:c,pinyin:mark[i].normalize('NFD').replace(/[\u0300-\u036f]/g,'')===mark[i]?mark[i]:(card[i]===5?mark[i].normalize('NFD').replace(/[\u0300-\u036f]/g,'').normalize():mark[i]),tone:card[i]===5?5:(Number((num[i]||'').match(/[0-5]$/)?.[0]||card[i])||card[i])})); // card gives neutral tones, pinyin-pro gives sandhi
  return chars.map((c,i)=>({hanzi:c,pinyin:mark[i],tone:(i>0&&chars[i-1]===c&&chars.length===2)?5:(Number((num[i]||'').match(/[0-5]$/)?.[0]||5)||5)})); // reduplication (谢谢, 妈妈) -> neutral
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

export async function analyze({wav,hanzi,pinyin:py,apiKey}){
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
