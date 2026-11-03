// Builds public/bear/catalog.json: Bear Door drill cards + reference pitch contours of Li Pei Ru's original audio.
// Usage: ffmpeg each public/bear/*.mp3 to /tmp/<name>.wav (16 kHz mono s16), then: node tools/build_bear_refs.mjs
import {readFileSync,writeFileSync} from 'node:fs';
import {parseWav,trackPitch,buildContour,targetSyllables} from '../server/anki/analyze.js';
const cards=JSON.parse(readFileSync(new URL('./bear_cards.json',import.meta.url)));
for(const c of cards){
  const {samples,rate}=parseWav(readFileSync('/tmp/'+c.audio.replace('.mp3','.wav')));
  let frames=trackPitch(samples,rate,{minF:120,maxF:500});
  if(frames.filter(f=>f.f0).length<8)frames=trackPitch(samples,rate,{minF:90,maxF:550,thr:0.3,win:0.03});
  const target=targetSyllables(c.text,'');
  const v=frames.filter(f=>f.f0);const t0=v[0]?.t??0,t1=v[v.length-1]?.t??0.5,d=Math.max(0.1,t1-t0),n=target.length;
  const spans=target.map((_,i)=>[t0+d*i/n,t0+d*(i+1)/n]);
  const ct=buildContour(frames,spans,target,null,null);
  c.ref={t0:ct.t0,t1:ct.t1,user:ct.user,syllables:ct.syllables.map(s=>({hanzi:s.hanzi,pinyin:s.pinyin,tone:s.tone,start:s.start,end:s.end,target:s.target}))};
}
writeFileSync(new URL('../public/bear/catalog.json',import.meta.url),JSON.stringify({deck:'Li Pei Ru · Bear Door · Part 1 · Sentence 1',cards}));
console.log(cards.length,'cards');
