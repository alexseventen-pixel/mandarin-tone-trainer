// node tools/seq_eval.mjs : sequential scoring on TTS phrases (normal / slow -40%) and wrong-tone versions (inverted pitch, flat)
import { readFileSync, existsSync } from 'node:fs';
import { analyze } from '../server/anki/analyze.js';
const dir=process.argv[2]||'/workspace/seqtest/tts';const P=JSON.parse(readFileSync(dir+'/phr.json'));
const old=process.argv.includes('--old');const rows=[],acc={};
for(const [k,hz] of Object.entries(P))for(const vo of ['xiaoxiao','yunxi'])for(const v of ['n','s','n_inv','s_inv','n_flat']){
  const f=`${dir}/${k}_${vo}_${v}.wav`;if(!existsSync(f))continue;
  const r=await analyze({wav:readFileSync(f),hanzi:hz,pinyin:'',apiKey:'',tpKey:'',crepeUrl:old?'https://188-253-23-5.sslip.io/crepe/assess':'',spk:{},scoring:'seq',compare:old});
  (acc[v]=acc[v]||[]).push(r.score);if(old)(acc[v+'_old']=acc[v+'_old']||[]).push(r.old?.score??0);
  rows.push({hz,vo,v,new:r.score,old:old?r.old?.score:undefined,exp:r.syllables.map(s=>s.tone).join(''),heard:r.syllables.map(s=>s.tone===5?'·':(s.ok?'✓':'✗')+(s.heard_tone??'?')).join(' ')});
}
if(process.argv.includes('-v'))console.table(rows);
console.table(Object.entries(acc).map(([v,a])=>({variant:v,mean:Math.round(a.reduce((x,y)=>x+y,0)/a.length),min:Math.min(...a),max:Math.max(...a),n:a.length})));
