const $ = id => document.getElementById(id);
const input = $('pinyin'), status = $('status'), button = $('record'), chart = $('chart'), ctx = chart.getContext('2d');
const accents = {ā:['a',1],á:['a',2],ǎ:['a',3],à:['a',4],ē:['e',1],é:['e',2],ě:['e',3],è:['e',4],ī:['i',1],í:['i',2],ǐ:['i',3],ì:['i',4],ō:['o',1],ó:['o',2],ǒ:['o',3],ò:['o',4],ū:['u',1],ú:['u',2],ǔ:['u',3],ù:['u',4],ǖ:['ü',1],ǘ:['ü',2],ǚ:['ü',3],ǜ:['ü',4]};
const tones = ['neutral','1st · level','2nd · rising','3rd · low','4th · falling'];
const spellings = new Set(`a ai an ang ao e ei en eng er o ou ba bai ban bang bao bei ben beng bi bian biao bie bin bing bo bu pa pai pan pang pao pei pen peng pi pian piao pie pin ping po pou pu ma mai man mang mao mei men meng mi mian miao mie min ming miu mo mou mu fa fan fang fei fen feng fo fou fu da dai dan dang dao de dei den deng di dian diao die ding diu dong dou du duan dui dun duo ta tai tan tang tao te teng ti tian tiao tie ting tong tou tu tuan tui tun tuo na nai nan nang nao ne nei nen neng ni nian niang niao nie nin ning niu nong nou nu nuan nuo nü nüe la lai lan lang lao le lei leng li lia lian liang liao lie lin ling liu long lou lu luan lun luo lü lüe ga gai gan gang gao ge gei gen geng gong gou gu gua guai guan guang gui gun guo ka kai kan kang kao ke kei ken keng kong kou ku kua kuai kuan kuang kui kun kuo ha hai han hang hao he hei hen heng hong hou hu hua huai huan huang hui hun huo ji jia jian jiang jiao jie jin jing jiong jiu ju juan jue jun qi qia qian qiang qiao qie qin qing qiong qiu qu quan que qun xi xia xian xiang xiao xie xin xing xiong xiu xu xuan xue xun zha zhai zhan zhang zhao zhe zhei zhen zheng zhi zhong zhou zhu zhua zhuai zhuan zhuang zhui zhun zhuo cha chai chan chang chao che chen cheng chi chong chou chu chua chuai chuan chuang chui chun chuo sha shai shan shang shao she shei shen sheng shi shou shu shua shuai shuan shuang shui shun shuo re ren reng ri rong rou ru ruan rui run ruo za zai zan zang zao ze zei zen zeng zi zong zou zu zuan zui zun zuo ca cai can cang cao ce cen ceng ci cong cou cu cuan cui cun cuo sa sai san sang sao se sen seng si song sou su suan sui sun suo ya yan yang yao ye yi yin ying yong you yu yuan yue yun wa wai wan wang wei wen weng wo wu`.split(' '));
let syllables = [], selected = 0, results = [], stream, audioContext, source, processor, chunks = [], recording = false, recognition, recognized = '';
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
  $('detail').textContent=!result?'Record the phrase, then select a syllable to compare.':result.source==='ai'?`TonePerfect: expected tone ${result.expected ?? '—'}, heard ${result.predicted ?? '—'}. ${result.state==='uncertain'?'The model is uncertain about this correction.':''}`:result.state==='neutral'?'Neutral tone depends on context and is not scored here.':result.state==='uncertain'?'The syllable boundary or pitch was unclear. Check the graph and try again.':`${part.reason?part.reason+'. ':''}Syllable timing in connected speech is approximate; use the graph together with the score.`;
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
  syllables=parsed.map((part,i)=>({...part,hanzi:hanzi[i]}));results=[];selected=0;renderSyllables();$('transcript').hidden=true;$('ai-result').hidden=true;
  status.textContent=`Ready: ${syllables.length} syllables. Say the complete phrase.`;return true;
}
$('form').onsubmit=e=>{e.preventDefault();updatePhrase()};window.onresize=()=>draw(results[selected]?.contour);
function pitch(frame,rate) {
  let energy=0;for(const v of frame)energy+=v*v;if(Math.sqrt(energy/frame.length)<.01)return null;
  const min=Math.floor(rate/520),max=Math.min(Math.floor(rate/75),frame.length/2);let best=0,bestLag=0;
  for(let lag=min;lag<=max;lag++){let dot=0,a=0,b=0;for(let j=0;j<frame.length-lag;j++){const x=frame[j],y=frame[j+lag];dot+=x*y;a+=x*x;b+=y*y;}const corr=dot/Math.sqrt(a*b||1);if(corr>best){best=corr;bestLag=lag;}}
  return best>.77?rate/bestLag:null;
}
function median(v){const a=[...v].sort((x,y)=>x-y);return a[Math.floor(a.length/2)];}
function classify(frames,expected) {
  if(!expected)return{state:'neutral',contour:null};
  const voiced=frames.filter(f=>f.pitch).map(f=>f.pitch);if(voiced.length<5||voiced.length/frames.length<.45)return{state:'uncertain',contour:null};
  const mid=median(voiced),hz=frames.map(f=>f.pitch&&Math.abs(12*Math.log2(f.pitch/mid))<9?f.pitch:null),valid=hz.filter(Boolean);if(valid.length<5)return{state:'uncertain',contour:null};
  const filled=hz.map((x,i)=>x||hz.slice(0,i).reverse().find(Boolean)||hz.slice(i).find(Boolean));
  const smooth=filled.map((_,i)=>median(filled.slice(Math.max(0,i-2),i+3))),semi=smooth.map(x=>12*Math.log2(x)),low=Math.min(...semi),high=Math.max(...semi),range=high-low;
  const normalized=semi.map(x=>.18+.64*(x-low)/Math.max(range,2.5)),contour=Array.from({length:60},(_,i)=>normalized[Math.round(i*(normalized.length-1)/59)]);
  const candidates=[1,2,3,4].map(t=>({tone:t,error:Math.min(...(t===3?[target,(_,x)=>halfThird(x)]:[target]).map(shape=>contour.reduce((sum,v,i)=>{const d=(v-contour[0])-(shape(t,i/59)-shape(t,0));return sum+d*d;},0)/60))})).sort((a,b)=>a.error-b.error);
  const predicted=candidates[0].tone,clear=candidates[1].error-candidates[0].error>.012;
  return{state:!clear||(range<1.5&&expected!==1)?'uncertain':predicted===expected?'good':'bad',predicted,contour};
}
function analyze() {
  const samples=Float32Array.from(chunks.flatMap(x=>Array.from(x))),rate=audioContext.sampleRate,step=Math.floor(rate*.025),size=Math.floor(rate*.045),frames=[];
  for(let i=0;i+size<samples.length;i+=step){const slice=samples.subarray(i,i+size);let sum=0;for(const v of slice)sum+=v*v;frames.push({energy:Math.sqrt(sum/slice.length),pitch:pitch(slice,rate)});}
  const peak=Math.max(...frames.map(f=>f.energy)),threshold=Math.max(.008,peak*.12),first=frames.findIndex(f=>f.energy>threshold),last=frames.findLastIndex(f=>f.energy>threshold);
  if(first<0||last-first<syllables.length*4){showError('The recording is too short for this phrase. Say it completely and a little more slowly.');return;}
  const active=frames.slice(first,last+1),n=syllables.length,width=active.length/n,cuts=[0];
  for(let i=1;i<n;i++){const center=Math.round(i*width),radius=Math.max(1,Math.round(width*.3));let best=center,min=Infinity;for(let j=Math.max(cuts.at(-1)+3,center-radius);j<=Math.min(active.length-(n-i)*3,center+radius);j++){const energy=(active[j-1]?.energy||0)+active[j].energy+(active[j+1]?.energy||0),cost=energy/Math.max(peak,.001)+.08*Math.abs(j-center)/radius;if(cost<min){min=cost;best=j;}}cuts.push(best);}cuts.push(active.length);
  results=syllables.map((part,i)=>classify(active.slice(cuts[i],cuts[i+1]),part.expected));renderSyllables();
  const good=results.filter(x=>x.state==='good').length,uncertain=results.filter(x=>x.state==='uncertain').length;
  status.textContent=`Tone matched: ${good} of ${results.filter(x=>x.state!=='neutral').length}. Unclear: ${uncertain}. Select a syllable for details.`;
  if(recognized){$('transcript').hidden=false;$('transcript').textContent=`Browser transcript: ${recognized}. The transcript does not affect the tone score.`;}
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
  $('ai-model').textContent=data.model_version?`Model: ${data.model_version}`:'';
  const labels={overall:'Overall',pronunciation:'Pronunciation',initial:'Initials',final:'Finals',tone:'Tones',fluency:'Fluency',rhythm:'Rhythm',completeness:'Completeness'};
  const scores=$('ai-scores');scores.replaceChildren();
  for(const [name,value] of Object.entries(data.scores||{})) {const card=node('div','score-card');card.append(node('span','',labels[name]||name),node('strong','',displayValue(value)));scores.append(card);}
  const meta=$('ai-meta');meta.replaceChildren();
  const metadata=[['Status',data.status],['Mode',data.task],['Language',data.locale||data.language],['Reason',data.reason],['Request',data.id],['Credits used',data.billing?.credits],['Credits remaining',data.billing?.balance_credits],['Replayed response',data.replayed===undefined?null:data.replayed?'yes':'no']];
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
    if(phones.childElementCount)card.append(phones);words.append(card);
  }
  if(!words.childElementCount)words.append(node('p','detail','No syllable-level data was returned. The complete response is available below.'));
  $('ai-raw').textContent=JSON.stringify(data,null,2);
}
async function evaluateWithAi() {
  status.textContent='AI is assessing your pronunciation…';
  try {
    const response=await fetch('/api/assess',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      audioBase64:await blobToBase64(makeWav()),
      text:$('hanzi').value.trim(),
      pinyin:syllables.map(s=>s.base+(s.tone||5)).join(' ')
    })});
    const data=await response.json();
    if(!response.ok)throw new Error(typeof data.error==='string'?data.error:data.error?.message||'The service did not respond');
    if(data.assessable===false)throw new Error('The recording could not be assessed. Make sure you said the displayed phrase.');
    renderAiResult(data);
    const units=data.words||[];
    if(units.length!==syllables.length){status.textContent=`TonePerfect assessed the recording. Tone score: ${data.scores?.tone??'—'}. The syllable alignment did not match the text.`;return;}
    results=units.map((word,i)=>{const tone=word.phones?.find(p=>p.dimension==='tone');const decision=tone?.decision;return {source:'ai',state:!tone||decision==='uncertain'?'uncertain':decision==='review'?'bad':'good',expected:tone?.expected,predicted:tone?.heard,contour:results[i]?.contour||null};});
    renderSyllables();
    const flagged=results.filter(r=>r.state==='bad').length;
    status.textContent=`TonePerfect tone score: ${data.scores?.tone??'—'}/100. Syllables to repeat: ${flagged}. Select a syllable.`;
  } catch(error) {status.textContent=`TonePerfect: ${error.message}. ${results.length?'The local pitch estimate is shown.':'No score was received; record the phrase again.'}`;}
}
async function start() {
  if(!updatePhrase())return;if(!navigator.mediaDevices?.getUserMedia){showError('Microphone access requires HTTPS and a supported browser.');return;}
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    audioContext=new AudioContext();source=audioContext.createMediaStreamSource(stream);processor=audioContext.createScriptProcessor(2048,1,1);chunks=[];
    processor.onaudioprocess=e=>{if(recording)chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));};source.connect(processor);processor.connect(audioContext.destination);recording=true;
    button.classList.add('active');$('record-label').textContent='Stop recording';status.textContent='Listening to the complete phrase…';recognized='';
    const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(SpeechRecognition){try{recognition=new SpeechRecognition();recognition.lang='zh-CN';recognition.continuous=true;recognition.onresult=e=>{recognized=Array.from(e.results).map(r=>r[0].transcript).join('');if(results.length){$('transcript').hidden=false;$('transcript').textContent=`Browser transcript: ${recognized}. The transcript does not affect the tone score.`;}};recognition.start();}catch{}}
  }catch{showError('Microphone access was denied. Allow recording in your browser settings.');}
}
async function stop(){
  recording=false;
  button.classList.remove('active');
  $('record-label').textContent='Start recording';
  status.textContent='Analysing the phrase…';
  try{recognition?.stop();}catch{}
  source?.disconnect();processor?.disconnect();stream?.getTracks().forEach(t=>t.stop());
  try{
    if(chunks.length>2){
      analyze();
      await evaluateWithAi();
    }else showError('The recording is too short. Say the complete phrase.');
  }finally{await audioContext?.close();}
}
button.onclick=()=>recording?stop():start();updatePhrase();
