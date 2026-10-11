const $ = id => document.getElementById(id);
const input = $('pinyin'), status = $('status'), button = $('record'), chart = $('chart'), ctx = chart.getContext('2d'), provider = $('provider'), liveChart=$('live-chart'), liveCtx=liveChart.getContext('2d'), pace=$('pace');
const providerInfo={
  tonemirror:'Runs entirely in this browser. Pitch is normalized and compared with Mandarin tone contours using DTW.',
  toneperfect:'Uploads the recording to TonePerfect for cloud pronunciation assessment. Requires TONEPERFECT_API_KEY in .env.',
  crepe:'Uses the local CREPE neural pitch service. Start it separately on the URL configured in .env.'
};
const accents = {ā:['a',1],á:['a',2],ǎ:['a',3],à:['a',4],ē:['e',1],é:['e',2],ě:['e',3],è:['e',4],ī:['i',1],í:['i',2],ǐ:['i',3],ì:['i',4],ō:['o',1],ó:['o',2],ǒ:['o',3],ò:['o',4],ū:['u',1],ú:['u',2],ǔ:['u',3],ù:['u',4],ǖ:['ü',1],ǘ:['ü',2],ǚ:['ü',3],ǜ:['ü',4]};
const tones = ['neutral','1st · level','2nd · rising','3rd · low','4th · falling'];
const spellings = new Set(`a ai an ang ao e ei en eng er o ou ba bai ban bang bao bei ben beng bi bian biao bie bin bing bo bu pa pai pan pang pao pei pen peng pi pian piao pie pin ping po pou pu ma mai man mang mao mei men meng mi mian miao mie min ming miu mo mou mu fa fan fang fei fen feng fo fou fu da dai dan dang dao de dei den deng di dian diao die ding diu dong dou du duan dui dun duo ta tai tan tang tao te teng ti tian tiao tie ting tong tou tu tuan tui tun tuo na nai nan nang nao ne nei nen neng ni nian niang niao nie nin ning niu nong nou nu nuan nuo nü nüe la lai lan lang lao le lei leng li lia lian liang liao lie lin ling liu long lou lu luan lun luo lü lüe ga gai gan gang gao ge gei gen geng gong gou gu gua guai guan guang gui gun guo ka kai kan kang kao ke kei ken keng kong kou ku kua kuai kuan kuang kui kun kuo ha hai han hang hao he hei hen heng hong hou hu hua huai huan huang hui hun huo ji jia jian jiang jiao jie jin jing jiong jiu ju juan jue jun qi qia qian qiang qiao qie qin qing qiong qiu qu quan que qun xi xia xian xiang xiao xie xin xing xiong xiu xu xuan xue xun zha zhai zhan zhang zhao zhe zhei zhen zheng zhi zhong zhou zhu zhua zhuai zhuan zhuang zhui zhun zhuo cha chai chan chang chao che chen cheng chi chong chou chu chua chuai chuan chuang chui chun chuo sha shai shan shang shao she shei shen sheng shi shou shu shua shuai shuan shuang shui shun shuo re ren reng ri rong rou ru ruan rui run ruo za zai zan zang zao ze zei zen zeng zi zong zou zu zuan zui zun zuo ca cai can cang cao ce cen ceng ci cong cou cu cuan cui cun cuo sa sai san sang sao se sen seng si song sou su suan sui sun suo ya yan yang yao ye yi yin ying yong you yu yuan yue yun wa wai wan wang wei wen weng wo wu`.split(' '));
let syllables = [], selected = 0, results = [], stream, audioContext, source, processor, chunks = [], recording = false, recognition, recognized = '';
let liveState={startedAt:0,elapsed:0,active:0,points:[],bases:[],lastPitch:null,lastFeedback:'waiting'};
provider.onchange=()=>{$('provider-help').textContent=providerInfo[provider.value];results=[];renderSyllables();$('ai-result').hidden=true;status.textContent=`${provider.options[provider.selectedIndex].text} selected. Record the complete phrase.`;};
pace.oninput=()=>{$('pace-value').textContent=`${Number(pace.value).toFixed(2)} s`;if(!recording)drawLiveCoach();};
function readPart(raw) {
  let base = '', tone = 0, marks = 0;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (accents[c]) { base += accents[c][0]; tone = accents[c][1]; marks++; }
    else if (/[a-zü]/.test(c)) base += c;
    else if (/[1-5]/.test(c) && i === raw.length - 1) { tone = Number(c) % 5; marks++; }
    else return null;
  }
  return marks < 2 && spellings.has(base) ? {label:raw,base,tone,marked:!!marks} : null;
}
function splitWord(word) {
  const memo = new Map();
  function solve(at) {
    if (at === word.length) return {cost:0,parts:[]};
    if (memo.has(at)) return memo.get(at);
    let best = null;
    for (let end = at + 1; end <= Math.min(word.length,at+8); end++) {
      const part = readPart(word.slice(at,end)); if (!part) continue;
      const rest = solve(end); if (!rest) continue;
      const cost = rest.cost + 1 + (part.marked ? 0 : 2);
      if (!best || cost < best.cost) best = {cost,parts:[part,...rest.parts]};
    }
    memo.set(at,best); return best;
  }
  return solve(0)?.parts || null;
}
function parsePhrase(value) {
  const words = value.toLowerCase().trim().replace(/[，。！？,.!?;:]+/g,' ').split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const parts = [];
  for (const word of words) { const found = splitWord(word); if (!found) return null; parts.push(...found); }
  if (parts.length > 40) return null;
  return parts.map((part,i) => {
    const next = parts[i+1]; let expected = part.tone, reason = '';
    if (part.base === 'yi' && part.tone === 1 && next?.tone === 4) { expected = 2; reason = 'yī usually becomes a 2nd tone before a 4th tone'; }
    else if (part.base === 'yi' && part.tone === 1 && next?.tone > 0) { expected = 4; reason = 'yī usually becomes a 4th tone in this context'; }
    else if (part.base === 'bu' && part.tone === 4 && next?.tone === 4) { expected = 2; reason = 'bù usually becomes a 2nd tone before a 4th tone'; }
    else if (part.tone === 3 && next?.tone === 3) { expected = 2; reason = 'A 3rd tone becomes a 2nd tone before another 3rd tone'; }
    return {...part,expected,reason};
  });
}
function readHanzi(value) {
  return [...value].filter(char => /\p{Script=Han}/u.test(char));
}
function target(t,x) { return t===1?.75:t===2?.22+.58*x:t===3?(x<.55?.55-.38*x/.55:.17+.45*(x-.55)/.45):.78-.6*x; }
function halfThird(x) { return .55 - .32*x; }
function liveTarget(part,x){if(!part?.expected)return 0;return (target(part.expected,x)-target(part.expected,0))*10;}
function resetLiveCoach(active=false){
  liveState={startedAt:active?audioContext.currentTime:0,elapsed:0,active:0,points:[],bases:syllables.map(()=>[]),lastPitch:null,lastFeedback:'waiting'};
  $('live-syllable').textContent=active&&syllables[0]?`${syllables[0].hanzi} ${syllables[0].label} · ${tones[syllables[0].expected]}`:'Press Start recording';
  $('live-feedback').textContent=active?'Find the first tone':'Your live correction will appear here';$('live-feedback').className='feedback waiting';$('live-pitch').textContent='— Hz';drawLiveCoach();
}
function drawLiveCoach(){
  const ratio=devicePixelRatio||1,w=liveChart.clientWidth,h=liveChart.clientHeight,padX=26,padTop=42,padBottom=28,usableW=w-padX*2,usableH=h-padTop-padBottom,count=Math.max(1,syllables.length),slot=usableW/count;
  liveChart.width=w*ratio;liveChart.height=h*ratio;liveCtx.setTransform(ratio,0,0,ratio,0,0);liveCtx.clearRect(0,0,w,h);
  liveCtx.fillStyle='#0b1628';liveCtx.fillRect(0,0,w,h);
  for(let row=0;row<5;row++){const y=padTop+usableH*row/4;liveCtx.strokeStyle='#243a54';liveCtx.lineWidth=1;liveCtx.beginPath();liveCtx.moveTo(padX,y);liveCtx.lineTo(w-padX,y);liveCtx.stroke();}
  syllables.forEach((part,index)=>{
    const left=padX+index*slot;
    if(index===liveState.active&&recording){liveCtx.fillStyle='#58ded10d';liveCtx.fillRect(left,padTop,slot,usableH);}
    if(index){liveCtx.strokeStyle='#2f4660';liveCtx.beginPath();liveCtx.moveTo(left,padTop);liveCtx.lineTo(left,h-padBottom);liveCtx.stroke();}
    liveCtx.fillStyle=index===liveState.active&&recording?'#8ff4eb':'#8199b6';liveCtx.font=`${slot<48?10:12}px system-ui`;liveCtx.textAlign='center';if(slot>32||index%2===0)liveCtx.fillText(part.label,left+slot/2,23);
    liveCtx.strokeStyle='#6893ff';liveCtx.lineWidth=index===liveState.active&&recording?3:2;liveCtx.beginPath();
    for(let point=0;point<24;point++){const x=point/23,relative=.5+liveTarget(part,x)/12,y=padTop+(1-Math.max(.04,Math.min(.96,relative)))*usableH,px=left+x*slot;point?liveCtx.lineTo(px,y):liveCtx.moveTo(px,y);}liveCtx.stroke();
  });
  if(liveState.points.length>1){liveCtx.strokeStyle='#58ded1';liveCtx.lineWidth=3;liveCtx.beginPath();let drawing=false;for(const point of liveState.points){if(point.value===null){drawing=false;continue;}const px=padX+(point.elapsed/(Number(pace.value)*count))*usableW,py=padTop+(1-point.value)*usableH;if(px>w-padX)continue;if(!drawing){liveCtx.moveTo(px,py);drawing=true;}else liveCtx.lineTo(px,py);}liveCtx.stroke();}
  if(recording){const progress=Math.min(1,liveState.elapsed/(Number(pace.value)*count)),x=padX+progress*usableW;liveCtx.strokeStyle='#ffffff';liveCtx.lineWidth=2;liveCtx.beginPath();liveCtx.moveTo(x,padTop-7);liveCtx.lineTo(x,h-padBottom+7);liveCtx.stroke();}
}
function processLiveFrame(frame){
  if(!recording||!syllables.length)return;
  const elapsed=audioContext.currentTime-liveState.startedAt,seconds=Number(pace.value),index=Math.floor(elapsed/seconds);
  liveState.elapsed=elapsed;
  if(index>=syllables.length){liveState.active=syllables.length-1;$('live-syllable').textContent='Phrase complete · stop recording';$('live-feedback').textContent='Complete';$('live-feedback').className='feedback good';drawLiveCoach();return;}
  liveState.active=index;const part=syllables[index],within=(elapsed-index*seconds)/seconds,frequency=pitch(frame,audioContext.sampleRate);
  if(!frequency){liveState.points.push({elapsed,value:null});$('live-feedback').textContent='Keep speaking';$('live-feedback').className='feedback waiting';drawLiveCoach();return;}
  const bases=liveState.bases[index];if(within<.18&&bases.length<6)bases.push(frequency);if(!bases.length)bases.push(frequency);
  const base=median(bases),actualSemitones=12*Math.log2(frequency/base),expectedSemitones=liveTarget(part,within),gap=actualSemitones-expectedSemitones,value=Math.max(.04,Math.min(.96,.5+actualSemitones/12));
  liveState.lastPitch=frequency;liveState.points.push({elapsed,value,hz:+frequency.toFixed(2),syllable:index,position:+within.toFixed(3),actual_semitones:+actualSemitones.toFixed(2),target_semitones:+expectedSemitones.toFixed(2),gap_semitones:+gap.toFixed(2)});if(liveState.points.length>5000)liveState.points.shift();
  $('live-syllable').textContent=`${part.hanzi} ${part.label} · ${tones[part.expected]}`;$('live-pitch').textContent=`${Math.round(frequency)} Hz`;
  const feedback=$('live-feedback');if(Math.abs(gap)<=.8){feedback.textContent='On target';feedback.className='feedback good';liveState.lastFeedback='good';}else if(gap<0){feedback.textContent=`Higher ↑ ${Math.abs(gap).toFixed(1)} st`;feedback.className='feedback raise';liveState.lastFeedback='raise';}else{feedback.textContent=`Lower ↓ ${Math.abs(gap).toFixed(1)} st`;feedback.className='feedback lower';liveState.lastFeedback='lower';}
  drawLiveCoach();
}
function liveCoachReport(){
  return {
    mode:'relative_pitch_guidance',
    pace_seconds_per_syllable:Number(pace.value),
    target:'speaker-relative Mandarin tone contour',
    final_feedback:liveState.lastFeedback,
    captured_points:liveState.points.filter(point=>point.value!==null)
  };
}
function draw(contour) {
  const ratio=devicePixelRatio||1,w=chart.clientWidth,h=chart.clientHeight,p=28;
  chart.width=w*ratio;chart.height=h*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);
  ctx.strokeStyle='#263a55';ctx.lineWidth=1;
  for(let i=1;i<4;i++){const y=p+(h-2*p)*i/4;ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(w-p,y);ctx.stroke();}
  function line(values,color,dash){ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=3;ctx.setLineDash(dash?[7,6]:[]);values.forEach((v,i)=>{const x=p+(w-2*p)*i/(values.length-1),y=h-p-v*(h-2*p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();ctx.setLineDash([]);}
  line(Array.from({length:60},(_,i)=>target(syllables[selected]?.expected||1,i/59)),'#6893ff',true);
  if(contour?.length>1)line(contour,'#58ded1',false);
}
function showSelected() {
  const part=syllables[selected],result=results[selected];if(!part)return;
  document.querySelectorAll('.syllable').forEach((e,i)=>e.classList.toggle('selected',i===selected));
  $('tone-name').textContent=part.reason||tones[part.tone];
  $('verdict').textContent=!result?`${part.hanzi} ${part.label}`:result.state==='good'?`${part.hanzi} ${part.label}: tone matched`:result.state==='bad'?`${part.hanzi} ${part.label}: check the tone`:`${part.hanzi} ${part.label}: unclear`;
  $('confidence').textContent=!result?'—':result.state==='good'?'Matched':result.state==='bad'?`Sounds like tone ${result.predicted}`:'Uncertain';
  const engine=result?.source==='toneperfect'?'TonePerfect':result?.source==='crepe'?'CREPE':'ToneMirror DTW';
  $('detail').textContent=!result?'Record the phrase, then select a syllable to compare.':result.state==='neutral'?'Neutral tone depends on context and is not scored here.':`${engine}: expected tone ${result.expected ?? part.expected ?? '—'}, heard ${result.predicted ?? '—'}, score ${result.score ?? '—'}/100. ${result.state==='uncertain'?'The result is uncertain. ':''}${part.reason||''}`;
  draw(result?.contour);
}
function renderSyllables() {
  const box=$('syllables');box.replaceChildren();
  syllables.forEach((part,i)=>{const chip=document.createElement('button');chip.type='button';chip.className=`syllable ${results[i]?.state||''}`;chip.textContent=`${part.hanzi} ${part.label}`;chip.setAttribute('aria-label',`${part.hanzi} ${part.label}, ${part.expected?tones[part.expected]:'neutral tone'}`);chip.onclick=()=>{selected=i;showSelected()};box.append(chip);});
  showSelected();
}
function updatePhrase() {
  const parsed=parsePhrase(input.value),hanzi=readHanzi($('hanzi').value);
  if(!parsed){status.textContent='Check the pinyin: use up to 40 valid syllables.';input.focus();return false;}
  if(hanzi.length!==parsed.length){status.textContent=`There are ${hanzi.length} characters and ${parsed.length} syllables. The counts must match.`;$('hanzi').focus();return false;}
  syllables=parsed.map((part,i)=>({...part,hanzi:hanzi[i]}));results=[];selected=0;renderSyllables();resetLiveCoach(false);$('transcript').hidden=true;$('ai-result').hidden=true;
  status.textContent=`Ready: ${syllables.length} syllables. Say the complete phrase.`;return true;
}
$('form').onsubmit=e=>{e.preventDefault();updatePhrase()};window.onresize=()=>{draw(results[selected]?.contour);drawLiveCoach();};
function pitch(frame,rate) {
  let energy=0;for(const value of frame)energy+=value*value;
  if(Math.sqrt(energy/frame.length)<.008)return null;
  const minLag=Math.floor(rate/520),maxLag=Math.min(Math.floor(rate/70),Math.floor(frame.length/2));
  const difference=new Float32Array(maxLag+1);
  for(let lag=1;lag<=maxLag;lag++){let sum=0;for(let i=0;i<frame.length-lag;i++){const delta=frame[i]-frame[i+lag];sum+=delta*delta;}difference[lag]=sum;}
  const cmnd=new Float32Array(maxLag+1);cmnd[0]=1;let running=0;
  for(let lag=1;lag<=maxLag;lag++){running+=difference[lag];cmnd[lag]=difference[lag]*lag/(running||1);}
  let chosen=0;
  for(let lag=minLag;lag<=maxLag;lag++){if(cmnd[lag]<.14){while(lag+1<=maxLag&&cmnd[lag+1]<cmnd[lag])lag++;chosen=lag;break;}}
  if(!chosen)return null;
  const left=cmnd[chosen-1]??cmnd[chosen],right=cmnd[chosen+1]??cmnd[chosen],denominator=2*(2*cmnd[chosen]-right-left);
  const refined=denominator?chosen+(right-left)/denominator:chosen;
  return rate/refined;
}
function median(v){const a=[...v].sort((x,y)=>x-y);return a[Math.floor(a.length/2)];}
function resample(values,count=60){return Array.from({length:count},(_,i)=>{const at=i*(values.length-1)/(count-1),left=Math.floor(at),mix=at-left;return values[left]*(1-mix)+(values[Math.min(values.length-1,left+1)]||values[left])*mix;});}
function dtw(a,b){const previous=new Float64Array(b.length+1).fill(Infinity),current=new Float64Array(b.length+1);previous[0]=0;for(let i=1;i<=a.length;i++){current.fill(Infinity);for(let j=1;j<=b.length;j++){const cost=(a[i-1]-b[j-1])**2;current[j]=cost+Math.min(current[j-1],previous[j],previous[j-1]);}previous.set(current);}return Math.sqrt(previous[b.length]/(a.length+b.length));}
function classify(frames,expected) {
  if(!expected)return{state:'neutral',contour:null,score:null,diagnostics:{voiced_ratio:0}};
  const raw=frames.map(f=>f.pitch),voiced=raw.filter(Boolean),voicedRatio=voiced.length/Math.max(1,frames.length);
  if(voiced.length<5||voicedRatio<.35)return{state:'uncertain',contour:null,score:0,diagnostics:{voiced_ratio:+voicedRatio.toFixed(3),voiced_frames:voiced.length,total_frames:frames.length}};
  const mid=median(voiced),hz=raw.map(f=>f&&Math.abs(12*Math.log2(f/mid))<10?f:null);
  const filled=hz.map((value,i)=>value||hz.slice(0,i).reverse().find(Boolean)||hz.slice(i).find(Boolean));
  const smooth=filled.map((_,i)=>median(filled.slice(Math.max(0,i-2),i+3))),semitones=smooth.map(value=>12*Math.log2(value/mid));
  const low=Math.min(...semitones),high=Math.max(...semitones),range=high-low;
  const normalized=resample(semitones.map(value=>.18+.64*(value-low)/Math.max(range,2.5)));
  const shifted=normalized.map(value=>value-normalized[0]);
  const candidates=[1,2,3,4].map(tone=>{const shapes=[Array.from({length:60},(_,i)=>target(tone,i/59))];if(tone===3)shapes.push(Array.from({length:60},(_,i)=>halfThird(i/59)));return{tone,distance:Math.min(...shapes.map(shape=>dtw(shifted,shape.map(value=>value-shape[0]))))};}).sort((a,b)=>a.distance-b.distance);
  const predicted=candidates[0].tone,expectedDistance=candidates.find(item=>item.tone===expected)?.distance??1,score=Math.max(0,Math.round(100-expectedDistance*185));
  const margin=candidates[1].distance-candidates[0].distance,uncertain=margin<.025||(range<1.2&&expected!==1);
  return{state:uncertain?'uncertain':predicted===expected&&score>=60?'good':'bad',predicted,expected,score,contour:normalized,diagnostics:{voiced_ratio:+voicedRatio.toFixed(3),voiced_frames:voiced.length,total_frames:frames.length,median_hz:+mid.toFixed(2),min_hz:+Math.min(...voiced).toFixed(2),max_hz:+Math.max(...voiced).toFixed(2),range_semitones:+range.toFixed(2),dtw_distance:+expectedDistance.toFixed(4),classification_margin:+margin.toFixed(4),candidate_distances:candidates.map(item=>({tone:item.tone,distance:+item.distance.toFixed(4)})),pitch_hz:voiced.map(value=>+value.toFixed(2))}};
}
function analyzeToneMirror() {
  const samples=Float32Array.from(chunks.flatMap(x=>Array.from(x))),rate=audioContext.sampleRate,step=Math.floor(rate*.025),size=Math.floor(rate*.045),frames=[];
  for(let i=0;i+size<samples.length;i+=step){const slice=samples.subarray(i,i+size);let sum=0;for(const v of slice)sum+=v*v;frames.push({energy:Math.sqrt(sum/slice.length),pitch:pitch(slice,rate)});}
  const peak=Math.max(...frames.map(f=>f.energy)),threshold=Math.max(.008,peak*.12),first=frames.findIndex(f=>f.energy>threshold),last=frames.findLastIndex(f=>f.energy>threshold);
  if(first<0||last-first<syllables.length*4){showError('The recording is too short for this phrase. Say it completely and a little more slowly.');return null;}
  const active=frames.slice(first,last+1),n=syllables.length,width=active.length/n,cuts=[0];
  for(let i=1;i<n;i++){const center=Math.round(i*width),radius=Math.max(1,Math.round(width*.3));let best=center,min=Infinity;for(let j=Math.max(cuts.at(-1)+3,center-radius);j<=Math.min(active.length-(n-i)*3,center+radius);j++){const energy=(active[j-1]?.energy||0)+active[j].energy+(active[j+1]?.energy||0),cost=energy/Math.max(peak,.001)+.08*Math.abs(j-center)/radius;if(cost<min){min=cost;best=j;}}cuts.push(best);}cuts.push(active.length);
  results=syllables.map((part,i)=>({...classify(active.slice(cuts[i],cuts[i+1]),part.expected),source:'tonemirror',start_ms:Math.round((first+cuts[i])*step/rate*1000),end_ms:Math.round((first+cuts[i+1])*step/rate*1000)}));renderSyllables();
  const scored=results.filter(item=>item.state!=='neutral'),good=scored.filter(item=>item.state==='good').length,uncertain=scored.filter(item=>item.state==='uncertain').length,toneScore=scored.length?Math.round(scored.reduce((sum,item)=>sum+(item.score||0),0)/scored.length):0;
  const report={provider:'tonemirror',status:'completed',task:'connected_speech_pitch_dtw',language:'zh-CN',model_version:'browser-yin-dtw-1.0',scores:{overall:toneScore,tone:toneScore,matched:good,uncertain},audio:{sample_rate_hz:rate,duration_ms:Math.round(samples.length/rate*1000),analysis_hop_ms:25,analysis_window_ms:45,active_frames:active.length,peak_energy:+peak.toFixed(6)},live_coach:liveCoachReport(),words:syllables.map((part,i)=>({word:part.hanzi,pinyin:part.label,score:results[i].score,start_ms:results[i].start_ms,end_ms:results[i].end_ms,decision:results[i].state==='good'?'no_correction':results[i].state==='bad'?'review':'uncertain',phones:[{dimension:'tone',expected:part.expected||5,heard:results[i].predicted??null,score:results[i].score,decision:results[i].state==='good'?'no_correction':results[i].state==='bad'?'review':'uncertain'}],analysis:results[i].diagnostics,normalized_contour:results[i].contour}))};
  status.textContent=`ToneMirror DTW score: ${toneScore}/100. Matched: ${good}. Unclear: ${uncertain}. Select a syllable.`;
  if(recognized){$('transcript').hidden=false;$('transcript').textContent=`Browser transcript: ${recognized}. The transcript does not affect the tone score.`;}
  renderAiResult(report);
  return report;
}
function showError(message){$('verdict').textContent='Could not assess';$('confidence').textContent='—';$('detail').textContent=message;status.textContent='Try again';}
function makeWav() {
  const original=Float32Array.from(chunks.flatMap(x=>Array.from(x))),sourceRate=audioContext.sampleRate,targetRate=16000,count=Math.floor(original.length*targetRate/sourceRate);
  const buffer=new ArrayBuffer(44+count*2),view=new DataView(buffer);
  const write=(at,text)=>{for(let i=0;i<text.length;i++)view.setUint8(at+i,text.charCodeAt(i));};
  write(0,'RIFF');view.setUint32(4,36+count*2,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,targetRate,true);view.setUint32(28,targetRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,count*2,true);
  for(let i=0;i<count;i++){const position=i*sourceRate/targetRate,start=Math.floor(position),fraction=position-start,sample=(original[start]||0)*(1-fraction)+(original[start+1]||0)*fraction;view.setInt16(44+i*2,Math.max(-1,Math.min(1,sample))*32767,true);}
  return new Blob([buffer],{type:'audio/wav'});
}
function blobToBase64(blob) {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result).split(',')[1]);
    reader.onerror=()=>reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
function node(tag,className,text) {const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined&&text!==null)element.textContent=String(text);return element;}
function displayValue(value) {return value===null||value===undefined||value===''?'—':typeof value==='object'?JSON.stringify(value):String(value);}
function renderAiResult(data) {
  $('ai-result').hidden=false;
  const engine=data.provider==='toneperfect'?'TonePerfect':data.provider==='crepe'?'CREPE neural pitch':data.provider==='tonemirror'?'ToneMirror DTW':data.provider||'Assessment';
  $('report-kicker').textContent=`${engine.toUpperCase()} · DETAILED REPORT`;
  $('ai-model').textContent=data.model_version?`Model: ${data.model_version}`:'';
  const labels={overall:'Overall',pronunciation:'Pronunciation',initial:'Initials',final:'Finals',tone:'Tones',fluency:'Fluency',rhythm:'Rhythm',completeness:'Completeness'};
  const scores=$('ai-scores');scores.replaceChildren();
  for(const [name,value] of Object.entries(data.scores||{})) {const card=node('div','score-card');card.append(node('span','',labels[name]||name),node('strong','',displayValue(value)));scores.append(card);}
  const meta=$('ai-meta');meta.replaceChildren();
  const metadata=[['Provider',engine],['Status',data.status],['Mode',data.task],['Language',data.locale||data.language],['Reason',data.reason],['Request',data.id],['Credits used',data.billing?.credits],['Credits remaining',data.billing?.balance_credits],['Duration',data.audio?.duration_ms?data.audio.duration_ms+' ms':null],['Sample rate',data.audio?.sample_rate_hz?data.audio.sample_rate_hz+' Hz':null],['Replayed response',data.replayed===undefined?null:data.replayed?'yes':'no']];
  for(const [label,value] of metadata)if(value!==null&&value!==undefined&&value!=='')meta.append(node('span','',`${label}: ${displayValue(value)}`));
  const words=$('ai-words');words.replaceChildren();
  for(const word of data.words||[]) {
    const card=node('article','ai-word'),head=node('div','ai-word-head');
    head.append(node('strong','',displayValue(word.word)),node('span','roman',displayValue(word.pinyin)),node('span','word-score',`${displayValue(word.score)}/100`));
    if(Number.isFinite(word.start_ms)&&Number.isFinite(word.end_ms))head.append(node('span','word-time',`${(word.start_ms/1000).toFixed(2)}–${(word.end_ms/1000).toFixed(2)} s`));
    card.append(head);
    if(word.decision)card.append(node('div','detail',`Syllable decision: ${word.decision}`));
    const phones=node('div','phones');
    for(const phone of word.phones||[]) {
      const p=node('div',`phone ${phone.decision||''}`),kind={initial:'Initial',final:'Final',tone:'Tone'}[phone.dimension]||phone.dimension||'Sound';
      p.append(node('span','kind',kind),node('span','values',`Expected: ${displayValue(phone.expected)} · Heard: ${displayValue(phone.heard)}`),node('span','phone-score',`Score: ${displayValue(phone.score)}`));
      if(phone.decision)p.append(node('span','decision',phone.decision==='review'?'Repeat':phone.decision==='no_correction'?'Good':phone.decision==='uncertain'?'Uncertain':phone.decision));
      phones.append(p);
    }
    if(word.analysis){const diagnostics=node('div','diagnostics');for(const [key,value] of Object.entries(word.analysis)){if(Array.isArray(value))continue;diagnostics.append(node('span','',`${key.replaceAll('_',' ')}: ${displayValue(value)}`));}if(diagnostics.childElementCount)card.append(diagnostics);}
    if(phones.childElementCount)card.append(phones);words.append(card);
  }
  if(!words.childElementCount)words.append(node('p','detail','No syllable-level data was returned. The complete response is available below.'));
  $('ai-raw').textContent=JSON.stringify(data,null,2);
}
async function evaluateRemote(engine) {
  status.textContent=`${engine==='crepe'?'CREPE':'TonePerfect'} is assessing your pronunciation…`;
  try {
    const response=await fetch('/api/assess',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      audioBase64:await blobToBase64(makeWav()),
      text:$('hanzi').value.trim(),
      pinyin:syllables.map(s=>s.base+(s.tone||5)).join(' '),
      provider:engine
    })});
    const data=await response.json();
    if(!response.ok)throw new Error(typeof data.error==='string'?data.error:data.error?.message||'The service did not respond');
    if(data.assessable===false)throw new Error('The recording could not be assessed. Make sure you said the displayed phrase.');
    data.provider=data.provider||engine;
    data.live_coach=liveCoachReport();
    renderAiResult(data);
    const units=data.words||[];
    const engineName=engine==='crepe'?'CREPE':'TonePerfect';
    if(units.length!==syllables.length){status.textContent=`${engineName} assessed the recording. Tone score: ${data.scores?.tone??'—'}. The syllable alignment did not match the text.`;return;}
    results=units.map((word,i)=>{const tone=word.phones?.find(p=>p.dimension==='tone'),decision=tone?.decision;return {source:engine,state:!tone||decision==='uncertain'?'uncertain':decision==='review'?'bad':'good',expected:tone?.expected,predicted:tone?.heard,score:tone?.score??word.score,contour:word.normalized_contour||results[i]?.contour||null,diagnostics:word.analysis||null};});
    renderSyllables();
    const flagged=results.filter(r=>r.state==='bad').length;
    status.textContent=`${engineName} tone score: ${data.scores?.tone??'—'}/100. Syllables to repeat: ${flagged}. Select a syllable.`;
  } catch(error) {status.textContent=`${engine==='crepe'?'CREPE':'TonePerfect'}: ${error.message}. No remote score was received.`;}
}
async function start() {
  if(!updatePhrase())return;if(!navigator.mediaDevices?.getUserMedia){showError('Microphone access requires HTTPS and a supported browser.');return;}
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    audioContext=new AudioContext();source=audioContext.createMediaStreamSource(stream);processor=audioContext.createScriptProcessor(4096,1,1);chunks=[];
    processor.onaudioprocess=e=>{if(!recording)return;const frame=new Float32Array(e.inputBuffer.getChannelData(0));chunks.push(frame);processLiveFrame(frame);};source.connect(processor);processor.connect(audioContext.destination);recording=true;pace.disabled=true;resetLiveCoach(true);
    button.classList.add('active');$('record-label').textContent='Stop recording';status.textContent='Listening to the complete phrase…';recognized='';
    const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(SpeechRecognition){try{recognition=new SpeechRecognition();recognition.lang='zh-CN';recognition.continuous=true;recognition.onresult=e=>{recognized=Array.from(e.results).map(r=>r[0].transcript).join('');if(results.length){$('transcript').hidden=false;$('transcript').textContent=`Browser transcript: ${recognized}. The transcript does not affect the tone score.`;}};recognition.start();}catch{}}
  }catch{pace.disabled=false;showError('Microphone access was denied. Allow recording in your browser settings.');}
}
async function stop(){
  recording=false;
  pace.disabled=false;
  drawLiveCoach();
  button.classList.remove('active');
  $('record-label').textContent='Start recording';
  status.textContent='Analysing the phrase…';
  try{recognition?.stop();}catch{}
  source?.disconnect();processor?.disconnect();stream?.getTracks().forEach(t=>t.stop());
  try{
    if(chunks.length>2){
      if(provider.value==='tonemirror')analyzeToneMirror();
      else {analyzeToneMirror();await evaluateRemote(provider.value);}
    }else showError('The recording is too short. Say the complete phrase.');
  }finally{await audioContext?.close();}
}
button.onclick=()=>recording?stop():start();updatePhrase();
