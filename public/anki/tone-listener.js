/* Tone Listener for the Anki cards — loaded by a small loader in each recorder card. v1 (2026-11-05). Edit here + deploy: all cards update, no deck re-import. */
(function(){
/*v13rec*//*v13b*/var SERVER_URL="https://mandarin-tone-trainer.onrender.com";
var W=window.__bdAI=window.__bdAI||{};
var $=function(id){return document.getElementById(id);};
var root=$('ai'); if(!root) return; /*std10ai*/ W.gen=(W.gen||0)+1; var GEN=W.gen; try{cancelAnimationFrame(W.raf);cancelAnimationFrame(W.praf);clearTimeout(W.timer);if(W.xhr)W.xhr.abort();if(W.src)W.src.stop();}catch(e){} W.xhr=null; W.dt=0;
function tx(id,v,c){var e=$(id);if(!e)return;if(e.__v!==v){e.__v=v;e.textContent=v;}if(c&&e.__c!==c){e.__c=c;e.style.color=c;}}
var HANZI=root.getAttribute('data-hanzi'), CARD=root.getAttribute('data-card'), HER=root.getAttribute('data-her');
var NCH=(HANZI.match(/[\u4e00-\u9fff]/g)||[]).length, MAXS=Math.max(5,Math.min(14,Math.ceil(NCH*0.55)+3));
function st(t){$('ai-st').textContent=t;}
function ctx(){ if(W.ac&&W.ac.state==='closed')W.ac=null; if(!W.ac){var C=window.AudioContext||window.webkitAudioContext; W.ac=new C();} if(W.ac.state!=='running'){try{W.ac.resume();}catch(e){}} return W.ac;}
function stopStream(){ if(W.stream){W.stream.getTracks().forEach(function(t){t.stop();}); W.stream=null;} }
function decode(buf){ var ac=ctx(); return new Promise(function(ok,no){ var p=ac.decodeAudioData(buf,ok,no); if(p&&p.then)p.then(ok,no); }); }
function to16k(ab){ return Promise.resolve(lin(ab)); }
function to16kOld(ab){ var O=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  return new Promise(function(ok){ try{ if(!O)throw 0; var len=Math.ceil(ab.duration*16000), oc=new O(1,len,16000), s=oc.createBufferSource(); s.buffer=ab; s.connect(oc.destination); s.start(0);
    var p=oc.startRendering(); oc.oncomplete=function(e){ok(e.renderedBuffer.getChannelData(0));}; if(p&&p.then)p.then(function(r){ok(r.getChannelData(0));},function(){ok(lin(ab));}); }catch(e){ok(lin(ab));} }); }
function lin(ab){ var n=ab.numberOfChannels, m=new Float32Array(ab.length); for(var c=0;c<n;c++){var d=ab.getChannelData(c); for(var i=0;i<d.length;i++)m[i]+=d[i]/n;}
  var r=ab.sampleRate/16000, L=Math.floor(m.length/r), o=new Float32Array(L); for(var j=0;j<L;j++){var p=j*r,k=Math.floor(p),f=p-k; var s0=0,c0=0,h0=Math.max(0,Math.floor(r/2)); for(var q=k-h0;q<=k+h0;q++){if(q>=0&&q<m.length){s0+=m[q];c0++;}} o[j]=c0?s0/c0:0;} return o; }
function wav(x){ var sr=16000, len=x.length, v=new DataView(new ArrayBuffer(44+len*2));
  function s(o,t){for(var i=0;i<t.length;i++)v.setUint8(o+i,t.charCodeAt(i));}
  s(0,'RIFF');v.setUint32(4,36+len*2,true);s(8,'WAVE');s(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);s(36,'data');v.setUint32(40,len*2,true);
  for(var j=0;j<len;j++){var y=Math.max(-1,Math.min(1,x[j])); v.setInt16(44+j*2,y*32767,true);}
  return new Blob([v],{type:'audio/wav'}); }
function play(){ if(!W.buf||W.recording)return; var ac=ctx(); if(W.src){try{W.src.stop();}catch(e){}} var s=ac.createBufferSource(); s.buffer=W.buf; s.connect(ac.destination); s.start(0); W.src=s; W.playT0=ac.currentTime; cancelAnimationFrame(W.praf); s.onended=function(){ if(W.src===s){W.playT0=null; cancelAnimationFrame(W.praf); wfStatic(null);} }; playAnim(); }
function her(){ var a=$('ai-her-a'); if(!a)return; try{a.currentTime=0;}catch(e){} var p=a.play(); if(p&&p.catch)p.catch(function(){st('Could not play her recording');}); }
function setRecUI(on){ $('ai-rec').textContent=on?'⏹ Stop':(W.buf?'🎤 Again':'🎤 Record'); $('ai-rec').className=on?'aib stop':'aib'; $('ai-live').style.display=(on||W.buf)?'block':'none'; $('ai-info').style.display=on?'':'none'; }
var BW=3,BG=2;
function rr(g,x,y,w,h,r){ r=Math.min(r,w/2,h/2); g.beginPath(); g.moveTo(x+r,y); g.lineTo(x+w-r,y); g.quadraticCurveTo(x+w,y,x+w,y+r); g.lineTo(x+w,y+h-r); g.quadraticCurveTo(x+w,y+h,x+w-r,y+h); g.lineTo(x+r,y+h); g.quadraticCurveTo(x,y+h,x,y+h-r); g.lineTo(x,y+r); g.quadraticCurveTo(x,y,x+r,y); g.fill(); }
function amp2h(a){ var db=20*Math.log(a+1e-9)/Math.LN10; return Math.max(0.04,Math.min(1,(db+60)/54)); }
function prep(cv,h){ var dpr=window.devicePixelRatio||1, w=cv.clientWidth||320; if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);} var g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,w,h); return {g:g,w:w}; }
function bars(g,arr,x0,top,h,colFn){ var mid=top+h/2; for(var i=0;i<arr.length;i++){ var bh=Math.max(BW,arr[i]*h); g.fillStyle=colFn(i); rr(g,x0+i*(BW+BG),mid-bh/2,BW,bh,BW/2); } }
function meter(){ if(!W.recording)return; var an=W.an, cv=$('ai-meter'), H=64, P=prep(cv,H), g=P.g, w=P.w;
  var t=(Date.now()-W.t0)/1000, now=Date.now();
  if(an){ var d=W.td||(W.td=new Float32Array(an.fftSize)); if(an.getFloatTimeDomainData)an.getFloatTimeDomainData(d); else {var b=new Uint8Array(an.fftSize); an.getByteTimeDomainData(b); for(var i=0;i<b.length;i++)d[i]=(b[i]-128)/128;}
    var pk=0,sq=0; for(var i=0;i<d.length;i++){var a=d[i]<0?-d[i]:d[i]; if(a>pk)pk=a; sq+=d[i]*d[i];} var rms=Math.sqrt(sq/d.length), db=20*Math.log(rms+1e-9)/Math.LN10;
    var tgt=Math.max(0,Math.min(1,(db+60)/50)); W.lvl=tgt>W.lvl?W.lvl+(tgt-W.lvl)*0.6:W.lvl+(tgt-W.lvl)*0.08; W.dbs=db>W.dbs?db:W.dbs+(db-W.dbs)*0.08;
    if(pk>0.97||db>-6)W.clip=now; W.acc=Math.max(W.acc||0,rms); if(now-(W.lastBar||0)>=50){ W.wf.push(amp2h(W.acc)); W.acc=0; W.lastBar=now; } }
  var loud=now-(W.clip||0)<600, quiet=W.dbs<-45, col=loud?'#dc2626':quiet?'#9ca3af':'#16a34a';
  g.fillStyle='#e2e8ed'; rr(g,0,0,w,8,4); if(W.lvl>0.01){g.fillStyle=col; rr(g,0,0,Math.max(8,w*W.lvl),8,4);}
  tx('ai-hint',loud?'too loud — move the phone away':quiet?'quiet — speak a bit louder':'good level',col);
  var maxN=Math.floor(w/(BW+BG)), arr=W.wf.slice(-maxN), x0=w-arr.length*(BW+BG);
  bars(g,arr,x0,14,H-16,function(i){ return i>=arr.length-3?'#00cfff':'#1676d2'; });
  tx('ai-time',t.toFixed(1)+' / '+MAXS+' s'); W.raf=requestAnimationFrame(meter); }
function wfStatic(prog){ var ab=W.buf; if(!ab)return; var cv=$('ai-meter'), H=64, P=prep(cv,H), g=P.g, w=P.w, n=Math.floor(w/(BW+BG));
  if(!W.swf||W.swf.n!==n){ var d=ab.getChannelData(0), step=Math.max(1,Math.floor(d.length/n)), arr=[], mx=0;
    for(var i=0;i<n;i++){ var s=0,c=0; for(var k=i*step;k<Math.min(d.length,(i+1)*step);k+=4){s+=d[k]*d[k];c++;} var r=c?Math.sqrt(s/c):0; arr.push(r); if(r>mx)mx=r; }
    W.swf={n:n,a:arr.map(function(r){return mx?Math.max(0.04,Math.pow(r/mx,0.7)):0.04;})}; }
  var arr=W.swf.a, cut=prog==null?-1:prog*arr.length;
  bars(g,arr,0,6,H-10,function(i){ return cut<0?'#1676d2':(i<cut?'#08003f':'#cfe3f1'); }); }
function playAnim(){ if(!W.src||W.playT0==null)return; var p=(W.ac.currentTime-W.playT0)/W.buf.duration; if(p>=1){wfStatic(null);W.playT0=null;return;} wfStatic(p); W.praf=requestAnimationFrame(playAnim); }
function normalize(x){ var pk=0; for(var i=0;i<x.length;i++){var a=x[i]<0?-x[i]:x[i]; if(a>pk)pk=a;} if(pk<1e-4)return x; var gn=Math.min(8,0.708/pk); if(gn<=1)return x; var y=new Float32Array(x.length); for(var j=0;j<x.length;j++)y[j]=x[j]*gn; return y; }
function finish(chunks,sr){ W.recording=false; cancelAnimationFrame(W.raf); clearTimeout(W.timer); setRecUI(false);
  var n=0; chunks.forEach(function(c){n+=c.length;}); if(!n){st('Empty recording');return;}
  var ac=ctx(), ab=ac.createBuffer(1,n,sr), d=ab.getChannelData(0), o=0; chunks.forEach(function(c){d.set(c,o);o+=c.length;});
  for(var i=0;i<Math.min(n,sr/100);i++){var g=i/(sr/100); d[i]*=g; d[n-1-i]*=g;} gotBuf(ab); }
function trim(x){ var F=160,n=Math.floor(x.length/F),e=[],mx=0; for(var i=0;i<n;i++){var s=0;for(var k=0;k<F;k++){var v=x[i*F+k];s+=v*v;} s=Math.sqrt(s/F); e.push(s); if(s>mx)mx=s;}
  var th=Math.max(0.006,mx*0.08),a=0,b=n-1; while(a<n&&e[a]<th)a++; while(b>a&&e[b]<th)b--; if(a>=b)return x;
  a=Math.max(0,a-15); b=Math.min(n,b+20); return x.subarray(a*F,b*F); }
function gotBuf(ab){ W.buf=ab; W.swf=null; $('ai-play').disabled=false; setRecUI(false); wfStatic(null); st('Preparing the recording…'); to16k(ab).then(function(x){ send(wav(normalize(trim(x)))); }); }
function cleanup(){ try{W.proc&&W.proc.disconnect();}catch(e){} try{W.srcNode&&W.srcNode.disconnect();}catch(e){} try{W.mute&&W.mute.disconnect();}catch(e){} W.proc=W.srcNode=W.mute=W.an=null; stopStream(); }
function stopRec(){ if(!W.recording)return; if(W.mode==='pcm'){ var ch=W.chunks, sr=W.ac.sampleRate; cleanup(); finish(ch,sr); } else if(W.rec&&W.rec.state==='recording')W.rec.stop(); }
function start(){
  if(W.recording||$('ai-rec').disabled)return; clearTimeout(W.timer); cancelAnimationFrame(W.raf); cleanup(); W.rec=null; W.chunks=[];
  if(W.src){try{W.src.stop();}catch(e){}}
  var ac=ctx();
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){st('Microphone is not available in this app');return;}
  var cons={audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:1}};
  navigator.mediaDevices.getUserMedia(cons).catch(function(){return navigator.mediaDevices.getUserMedia({audio:true});}).then(function(stream){
    W.stream=stream; W.wf=[]; W.acc=0; W.lastBar=0; W.dbs=-90; W.lvl=0; W.clip=0; W.t0=Date.now(); W.recording=true; setRecUI(true); st('Speak now…');
    var srcN=W.srcNode=ac.createMediaStreamSource(stream), an=W.an=ac.createAnalyser(); an.fftSize=2048; srcN.connect(an);
    if(ac.createScriptProcessor){ W.mode='pcm'; W.chunks=[]; var p=W.proc=ac.createScriptProcessor(4096,1,1), mute=W.mute=ac.createGain(); mute.gain.value=0;
      p.onaudioprocess=function(e){ if(W.recording&&W.mode==='pcm')W.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
      srcN.connect(p); p.connect(mute); mute.connect(ac.destination);
    } else { W.mode='mr'; var mime=(window.MediaRecorder&&MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported('audio/mp4'))?'audio/mp4':'';
      var rec=W.rec=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream), chunks=[];
      rec.ondataavailable=function(e){if(e.data&&e.data.size)chunks.push(e.data);};
      rec.onstop=function(){ cleanup(); W.recording=false; cancelAnimationFrame(W.raf); clearTimeout(W.timer); setRecUI(false);
        new Blob(chunks,{type:rec.mimeType||'audio/mp4'}).arrayBuffer().then(decode).then(gotBuf).catch(function(e){st('Could not decode the recording: '+(e&&e.message||e));}); };
      rec.start(); }
    meter(); W.timer=setTimeout(stopRec,MAXS*1000);
  }).catch(function(e){st('No microphone access: '+e.name);});
}
function spk(){ try{var r=JSON.parse(localStorage.getItem('aiSpk')||'null'); if(r&&isFinite(r.lo)&&isFinite(r.hi)&&r.hi-r.lo>=5&&r.hi-r.lo<=18)return r; localStorage.removeItem('aiSpk');}catch(e){} return null; }
function send(w){
  $('ai-rec').disabled=true; var T=Date.now(), kb=Math.round(w.size/1024); st('📤 Sending ('+kb+' KB)…');
  var fd=new FormData(); fd.append('audio',w,'rec.wav'); fd.append('hanzi',HANZI); fd.append('card','bd1:'+CARD); var NT=nat(); if(NT&&NT.sl&&NT.d){fd.append('nslots',JSON.stringify(NT.sl)); fd.append('ndur',NT.d);}
  var r0=spk(); if(r0){fd.append('spk_lo',r0.lo); fd.append('spk_hi',r0.hi);}
  var x=W.xhr=new XMLHttpRequest(), tU=0, slow=setTimeout(function(){ if(!tU)st('⏳ Server is waking up (up to ~1 min)…'); },6000);
  x.open('POST',SERVER_URL+'/api/anki/analyze'); x.timeout=70000;
  x.upload.onload=function(){ tU=Date.now()-T; st('🧠 Analysing tones…'); };
  x.onload=function(){ clearTimeout(slow); if(GEN!==W.gen)return; W.xhr=null; $('ai-rec').disabled=false; var d; try{d=JSON.parse(x.responseText);}catch(e){st('Bad server response');return;}
    if(d.error){st('Error: '+d.error);return;}
    var c=d.contour&&d.contour.range; if(c&&d.assessable!==false&&isFinite(c.obs_lo)&&isFinite(c.obs_hi)&&c.obs_hi-c.obs_lo>=5){ var o=spk()||{lo:c.obs_lo,hi:c.obs_hi}; o.lo=o.lo*0.7+c.obs_lo*0.3; o.hi=o.hi*0.7+c.obs_hi*0.3; try{localStorage.setItem('aiSpk',JSON.stringify(o));}catch(e){} }
    show(d); var tm=d.timings||{}; st('⏱ '+((Date.now()-T)/1000).toFixed(1)+' s (upload '+(tU/1000).toFixed(1)+' · TonePerfect '+((tm.toneperfect_ms||0)/1000).toFixed(1)+' s)'); };
  x.onerror=function(){ clearTimeout(slow); $('ai-rec').disabled=false; st('Network error — check the internet and try again'); };
  x.onabort=function(){ clearTimeout(slow); $('ai-rec').disabled=false; };
  x.ontimeout=function(){ clearTimeout(slow); $('ai-rec').disabled=false; st('No answer from the server (it can take ~1 min to wake up) — try again'); };
  x.send(fd);
}
function esc(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
var TN={1:'tone 1 (high and level)',2:'tone 2 (rising)',3:'tone 3 (low, dipping)',4:'tone 4 (sharp fall)',5:'neutral tone'};
var ADV={1:'Keep your voice high and flat, no rise or fall — like a long “mmm” on one note.',2:'Let your voice rise clearly from low to high, like a question “yes?”.',3:'Start lower than normal and go even lower (in fast speech a low dip is enough, no rise).',4:'Fall sharply and briefly from high to low, like a firm “Stop!”.',5:'Say it short and light, without its own tone.'};
var DIM={initial:'initial consonant',final:'vowel / final'};
var WHY={no_speech:'Your voice is not audible — speak louder and closer to the mic.',no_audio:'Your voice is not audible — speak louder.',too_short:'Too short — say the whole thing.',different_content:'It sounds like different words — try again.'};
function tipsEn(d){ var t=[];
  if(d.assessable===false){ t.push(WHY[d.reason]||'The recording could not be assessed — try again.'); return t; }
  (d.syllables||[]).forEach(function(s){ var exp=s.tone, h=s.hanzi+' ('+s.pinyin+')';
    if(!s.ok&&s.heard_tone&&s.heard_tone!=exp) t.push(h+': expected '+TN[exp]+', it sounded like '+TN[s.heard_tone]+'. '+(ADV[exp]||''));
    [['initial',s.initial],['final',s.final]].forEach(function(p){ if(p[1]&&p[1].decision==='review') t.push(h+': '+DIM[p[0]]+' — heard “'+(p[1].heard||'—')+'”, needed “'+p[1].expected+'”.'); }); });
  if(!t.length) t.push(d.score>=85?'Excellent! Tones and sounds are in place.':(d.syllables||[]).some(function(s){return s.unsure;})?'No clear mistakes, but the AI is unsure about some syllables — say them more clearly.':'No mistakes found, but you can say it more clearly and confidently.');
  return t; }
// --- history (localStorage in the card) ---
var HK='bd1.anki.hist';
function hist(){ try{return JSON.parse(localStorage.getItem(HK)||'{}');}catch(e){return {};} }
function save(d){ var H=hist(), a=H[CARD]||(H[CARD]=[]);
  a.push({t:Date.now(),s:d.score|0,ok:d.assessable!==false,syl:(d.syllables||[]).map(function(s){return [s.hanzi,s.tone,s.heard_tone||0,s.ok?1:0];})});
  if(a.length>50)a.splice(0,a.length-50); try{localStorage.setItem(HK,JSON.stringify(H));}catch(e){} return a; }
function histUI(a){ a=a||hist()[CARD]||[]; var el=$('ai-hist'); if(!el)return; if(!a.length){el.innerHTML='';return;}
  var best=0; a.forEach(function(x){if(x.s>best)best=x.s;}); var last=a.slice(-20);
  el.innerHTML='<div class="aih">This card · '+a.length+' attempt'+(a.length>1?'s':'')+' · best <b>'+best+'</b> · last <b>'+a[a.length-1].s+'</b></div><div class="aibars">'+last.map(function(x){var c=x.s>=80?'#16a34a':x.s>=50?'#f59e0b':'#ef4444';return '<i style="height:'+Math.max(4,x.s*0.44)+'px;background:'+c+'"></i>';}).join('')+'</div>'; }
function show(d){
  $('ai-res').style.display='block';
  var sc=$('ai-score'); sc.textContent=d.score+' / 100'; sc.style.color=d.score>=80?'#16a34a':d.score>=50?'#d97706':'#dc2626';
  var hp=d.heard&&d.heard.pinyin; $('ai-heard').textContent=hp?('Heard: '+(Array.isArray(hp)?hp.join(' '):hp)):(d.heard&&d.heard.text?'Heard: '+d.heard.text:'');
  $('ai-syl').innerHTML=(d.syllables||[]).map(function(s){ var sd=s.sandhi?' <small>(→'+esc(s.sandhi.pinyin)+')</small>':'';
    return '<span class="chip '+(s.ok?(s.unsure?'mid':'ok'):'bad')+'">'+esc(s.hanzi)+' '+esc(s.pinyin)+sd+' '+(s.ok?'✓':'✗ '+(s.heard_tone?'tone '+s.heard_tone:'?'))+'</span>';}).join('');
  $('ai-tips').innerHTML=tipsEn(d).map(function(t){return '• '+esc(t);}).join('<br>');
  W.last=d; draw(d.contour); histUI(save(d)); if(window.__bdStats)window.__bdStats();
  var l=root.closest?root.closest('.lock'):null; if(l&&l.className.indexOf('open')<0)l.className+=' open';
}
function draw(c){ var cv=$('ai-cv'); if(c&&cv&&!cv.clientWidth&&W.dt<30){W.dt++;cv.style.display='block';requestAnimationFrame(function(){draw(c);});return;} W.dt=0; try{draw0(c);}catch(e){try{st('Could not draw the pitch: '+e.message);}catch(_){}} }
function natOn(){ try{return localStorage.getItem('aiNatLine')!=='0';}catch(e){return true;} }
function nat(){ if(W.natG===GEN)return W.nat; W.natG=GEN; W.nat=null; try{var e=$('ai-nat'),s=e?e.textContent.trim():''; if(s)W.nat=JSON.parse(s);}catch(e){} return W.nat; }
function draw0(c){
  var cv=$('ai-cv'); if(!c){cv.style.display='none';return;} cv.style.display='block';
  var dpr=Math.max(2,window.devicePixelRatio||1), w=cv.clientWidth||320, h=Math.round(Math.min(280,Math.max(210,w*0.6)));
  cv.style.height=h+'px'; cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr);
  var g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,w,h);
  var fg='#4a5668', grid='#e7eef3';
  var L=24,R=6,Tp=22,B=40, t0=isFinite(c.t0)?c.t0:0, t1=Math.max(isFinite(c.t1)?c.t1:0,t0+0.2);
  var X=function(t){return L+(t-t0)/(t1-t0)*(w-L-R);}, Y=function(v){return Tp+(5.4-v)/(5.4-0.6)*(h-Tp-B);};
  g.font='11px PingFang SC,Noto Sans CJK SC,-apple-system,sans-serif'; g.textAlign='right'; g.textBaseline='middle';
  for(var k=1;k<=5;k++){ g.strokeStyle=grid; g.lineWidth=1; g.beginPath(); g.moveTo(L,Y(k)); g.lineTo(w-R,Y(k)); g.stroke(); g.fillStyle='#9aa7b4'; g.fillText(k,L-6,Y(k)); }
  var S=c.syllables||[], n=S.length, fs=n>12?11:n>7?13:16, fp=n>12?0:n>7?10:12;
  S.forEach(function(s,i){ var x0=X(s.start), x1=X(s.end), col=s.ok===false?'#dc2626':s.ok?'#16a34a':'#6b7280';
    g.fillStyle=s.ok===false?'rgba(220,38,38,.06)':'rgba(22,163,74,.045)'; g.fillRect(x0,Tp,x1-x0,h-Tp-B);
    if(i>0){g.lineWidth=1; g.strokeStyle='#d5e2ec'; g.setLineDash([4,4]); g.beginPath(); g.moveTo(x0,Tp); g.lineTo(x0,h-B); g.stroke(); g.setLineDash([]);}
    var p=(s.target&&s.target.length>1)?s.target:[3,3], a=x0+(x1-x0)*0.1, b=x1-(x1-x0)*0.1; g.strokeStyle='rgba(0,207,255,.35)'; g.lineWidth=n>12?7:11; g.lineCap='round'; g.lineJoin='round';
    g.beginPath(); for(var j=0;j<=24;j++){ var u=j/24*(p.length-1), lo=Math.floor(u), hi=Math.min(p.length-1,lo+1), f=u-lo, P0=p[Math.max(0,lo-1)], P1=p[lo], P2=p[hi], P3=p[Math.min(p.length-1,hi+1)], v=0.5*((2*P1)+(-P0+P2)*f+(2*P0-5*P1+4*P2-P3)*f*f+(-P0+3*P1-3*P2+P3)*f*f*f), xx=a+(b-a)*j/24; j?g.lineTo(xx,Y(v)):g.moveTo(xx,Y(v)); } g.stroke();
    g.textAlign='center'; g.textBaseline='alphabetic'; g.fillStyle=col; g.font='600 '+fs+'px PingFang SC,Noto Sans CJK SC,-apple-system,sans-serif';
    g.fillText(s.hanzi,(x0+x1)/2,h-22); if(s.voiced===0){g.save();g.fillStyle='#9aa7b4';g.font='11px PingFang SC,Noto Sans CJK SC,-apple-system,sans-serif';g.fillText(x1-x0>66?'not voiced':'—',(x0+x1)/2,Tp+14);g.restore();g.fillStyle=col;} if(fp){g.font=fp+'px PingFang SC,Noto Sans CJK SC,-apple-system,sans-serif'; g.fillText(s.pinyin,(x0+x1)/2,h-7);} });
  var NT=nat(); if(natOn()&&NT&&NT.p&&NT.p.length&&isFinite(c.onset)){ g.save(); g.strokeStyle='rgba(75,85,99,.7)'; g.lineWidth=2.5; g.lineCap='round'; var pv=null; NT.p.forEach(function(q){ if(!q){pv=null;return;} var xx=X(c.onset+q[0]), yy=Y(q[1]); if(xx>w-R)return; if(pv){g.beginPath();g.moveTo(pv[0],pv[1]);g.lineTo(xx,yy);g.stroke();} pv=[xx,yy]; }); g.restore(); }
  g.lineCap='round'; g.lineJoin='round'; var U=(c.user||[]).map(function(q){return q&&isFinite(q.t)&&isFinite(q.c)?q:null;}), prev=null;
  for(var i=0;i<U.length;i++){ var q=U[i]; if(!q){prev=null;continue;}
    if(!prev&&!U[i+1]){ g.fillStyle='#1676d2'; g.beginPath(); g.arc(X(q.t),Y(q.c),3.5,0,7); g.fill(); }
    if(prev){ g.strokeStyle='#1676d2'; g.lineWidth=(q.g||prev.g)?2:3.5; g.setLineDash((q.g||prev.g)?[3,4]:[]); g.beginPath(); g.moveTo(X(prev.t),Y(prev.c)); g.lineTo(X(q.t),Y(q.c)); g.stroke(); } prev=q; }
  if(!U.some(Boolean)){g.fillStyle='#9aa7b4';g.textAlign='center';g.font='13px PingFang SC,Noto Sans CJK SC,-apple-system,sans-serif';g.fillText('your pitch was not caught — say it a bit louder',w/2,Tp+18);} g.setLineDash([]); g.textAlign='left'; g.textBaseline='middle'; g.font='12px PingFang SC,Noto Sans CJK SC,-apple-system,sans-serif';
  g.fillStyle='rgba(0,207,255,.55)'; g.fillRect(L,8,18,6); g.fillStyle=fg; g.fillText('target tone',L+24,11);
  g.fillStyle='#1676d2'; g.fillRect(L+104,9,18,4); g.fillStyle=fg; g.fillText('your voice',L+128,11); if(natOn()&&nat()&&nat().p&&nat().p.length){ g.fillStyle='rgba(75,85,99,.7)'; g.fillRect(L+204,9,18,4); g.fillStyle=fg; g.fillText('native',L+228,11); }
}
$('ai-rec').onclick=function(){ if(W.recording)stopRec(); else start(); };
$('ai-play').onclick=play; if($('ai-her'))$('ai-her').onclick=her;
if($('ai-skip'))$('ai-skip').onclick=function(){ var l=root.closest?root.closest('.lock'):null; if(l&&l.className.indexOf('open')<0)l.className+=' open'; };
W.show=show; (function(){ var sw=$('ai-natsw'); if(!sw)return; if(!(nat()&&nat().p&&nat().p.length)){sw.parentNode.style.display='none';return;} sw.checked=natOn(); sw.onchange=function(){ try{localStorage.setItem('aiNatLine',sw.checked?'1':'0');}catch(e){} if(W.last)draw(W.last.contour); }; })(); W.buf=null; W.recording=false; W.last=null; cleanup(); histUI(); window.onresize=function(){ if(W.last)draw(W.last.contour); };
})();
