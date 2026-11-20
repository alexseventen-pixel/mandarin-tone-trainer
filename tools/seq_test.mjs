// node tools/seq_test.mjs <dir>  : old (classic local fallback: YIN + CREPE) vs new (sequential) on generated variants
import { readFileSync, readdirSync } from 'node:fs';
import { analyze, nativeContour } from '../server/anki/analyze.js';
const dir=process.argv[2]||'/workspace/seqtest';
const PH={yuanbendanxin:'原本担心',danxinmeiyouyong:'担心没有用',meiyouyong:'没有用',meixiangdaozhezhixiong:'没想到这只熊',zhezhixiong:'这只熊',feichangdecongming:'非常的聪明'};
const VAR=(process.argv[3]||'native,slow0.8,slow0.6,lowslow0.6,inverted,invslow0.6,flat').split(',');
const crepeUrl=process.env.CREPE_URL??'https://188-253-23-5.sslip.io/crepe/assess';
const rows=[];
for(const [k,hz] of Object.entries(PH)){
  const nat=nativeContour(readFileSync(`${dir}/bd2_x_${k}__native.wav`),hz);
  for(const v of VAR){
    const wav=readFileSync(`${dir}/bd2_x_${k}__${v}.wav`);
    const r=await analyze({wav,hanzi:hz,pinyin:'',apiKey:'',tpKey:'',crepeUrl,spk:{},nat:{sl:nat.sl,d:nat.d},scoring:'seq',compare:true});
    const fmt=a=>(a||[]).map(s=>s.tone===5?'·':(s.ok?'✓':'✗')+(s.heard_tone??'?')).join(' ');
    rows.push({phrase:hz,variant:v,old:r.old?.score??null,new:r.score,exp:r.syllables.map(s=>s.tone).join(''),new_heard:fmt(r.syllables),old_heard:fmt(r.old?.syllables)});
  }
}
console.table(rows);
const avg=v=>{const x=rows.filter(r=>r.variant===v);return {variant:v,old:Math.round(x.reduce((a,r)=>a+(r.old||0),0)/x.length),new:Math.round(x.reduce((a,r)=>a+r.new,0)/x.length)};};
console.table(VAR.map(avg));
