// Card anatomy standard v10 — applied to every exported deck (idempotent).
// 1 blue halo on all big characters (font colour untouched)   2 👁 peek (character + pinyin) inside the tone listener
// 3 rich answer on every card: blurred word photo, English, dictionary lines, tappable piano tiles of every word in it
// 6 tone-listener hardening: stale state from the previous card is cleared, late server replies ignored, trace drawn
//   even when the target curve is missing, canvas re-measured until visible, fewer DOM writes while recording,
//   one sync timer instead of one per reviewed card
(function(){
const WORD_MID='1793305701',PIANO_MID='1793305799',MARK='/*std10*/';
const CSS=`${MARK}
.card,.nightMode.card,.night_mode.card,.nightMode .card,.night_mode .card{font-family:"PingFang SC","Noto Sans CJK SC","Source Han Sans SC","Hiragino Sans GB","Heiti SC",-apple-system,"Helvetica Neue",Arial,sans-serif!important}
.nightMode.card,.night_mode.card,.nightMode .card,.night_mode .card,body.nightMode,body.night_mode,html body.card.nightMode,html body.card.night_mode,html .nightMode .card{background:#f4f8fb!important;color:#08003f!important}
.bighz,.hz,.chunk,.big,.zh,.ptile .h,.pkhz,.rhz{color:#08003f!important;text-shadow:0 4px 18px rgba(0,207,255,.30)!important}
.lock .veil{filter:blur(7px);transition:opacity .35s;transform:translateZ(0)}.lock.open .veil{filter:none}
.peek{margin:4px 0 6px}.peek .pkb{border:1px solid #bfe0f7;background:#eef8ff;color:#1676d2;border-radius:10px;padding:5px 12px;font-size:14px}
.peek .pkc{display:none;margin-top:6px}.peek.on .pkc{display:block}.pkhz{font-size:44px;font-weight:600;line-height:1.15}.pkpy{font-size:18px;color:#1676d2}.pken{font-size:14px;color:#7a8794}
.rich{position:relative;margin:16px 0 8px;border-radius:18px;overflow:hidden;padding:14px 10px 12px;text-align:center;background:rgba(255,255,255,.35)}
.rich .rbg{position:absolute;inset:-40px;z-index:0;pointer-events:none}.rich .rbg img{width:100%;height:100%;object-fit:cover;filter:blur(18px) saturate(1.2);opacity:.45}
.rich>*:not(.rbg){position:relative;z-index:1}
.rhz{font-size:44px;font-weight:600;line-height:1.15}.rpy{font-size:18px;color:#1676d2}.ren{font-size:17px;margin:4px 0 6px}
.rsec{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#7a8794;margin:10px 0 4px}
.rdict{font-size:14px;text-align:left;background:rgba(255,255,255,.75);border-radius:12px;padding:8px 10px;color:#08003f}.rdict div{margin:3px 0}.rdict b{font-size:16px}
.rp{display:grid;grid-template-columns:repeat(2,minmax(0,140px));gap:10px;justify-content:center;padding:4px}
.rp .ptile{position:relative;height:150px;border-radius:14px;background:#fff;box-shadow:0 4px 14px rgba(8,0,63,.12);overflow:hidden;display:flex;align-items:center;justify-content:center;cursor:pointer}
.rp .ptile img{width:100%;height:100%;object-fit:cover}.rp .ptile .b{display:none}.rp .ptile.fl img{display:none}.rp .ptile.fl{background:#eef8ff}.rp .ptile.on{box-shadow:0 0 0 3px #00cfff}
.ptile.fl .b{display:flex!important;flex-direction:column;align-items:center;justify-content:center}.ptile .h{font-size:32px;font-weight:700;line-height:1.2;white-space:nowrap}.ptile .p{color:#7a8794;font-size:14px}
.rpall{border:none;border-radius:12px;padding:9px 16px;background:#1676d2;color:#fff;font-size:15px;margin:8px 0 2px}
.card:has(.lock:not(.open)) .rich,body:has(.lock:not(.open)) .rich{display:none}
.hw div,#hwrow .mzg,#hwrow>div{touch-action:none;-webkit-user-select:none;user-select:none}
.wgd{margin:14px auto 6px;max-width:340px;display:flex;align-items:center;justify-content:center;gap:10px;font-size:15px;color:#4a5668};cursor:pointer
.wsw{position:relative;width:62px;height:34px;flex:none}.wsw input{opacity:0;width:0;height:0}.wsw .sl{position:absolute;inset:0;background:#cbd5e1;border-radius:34px;transition:.2s}
.wsw .sl:before{content:"";position:absolute;width:28px;height:28px;left:3px;top:3px;background:#fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.25);transition:.2s}.wsw input:checked+.sl{background:#16a34a}.wsw input:checked+.sl:before{transform:translateX(28px)}
.wans{display:none;margin:8px auto;max-width:340px;background:#fff;border-radius:16px;padding:12px;box-shadow:0 6px 22px rgba(8,0,63,.08)}.wans.on{display:block}.wans .big{font-size:56px;font-weight:600}
@keyframes wshake{0%,100%{transform:none}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}.wshake{animation:wshake .18s 2}.ptile,.rpall,.pb{touch-action:manipulation;-webkit-user-select:none;user-select:none}
.wprog{font-size:13px;color:#7a8794;margin-top:4px}`;
const RICH_JS=`<script>(function(){if(window.__bdWG&&window.__bdWG.off){var sw=document.getElementById("wsw"),hw=document.getElementById("hw")||document.getElementById("hwrow");if(!hw||!sw||sw.checked)window.__bdWG.off();}var T=document.querySelectorAll(".rp .ptile");function snd(f,cb){if(window.__bdAudio)return window.__bdAudio.play(f,cb);if(!f){if(cb)setTimeout(cb,150);return;}try{var a=new Audio(f);if(cb){a.onended=function(){setTimeout(cb,120)};a.onerror=cb;}a.play();}catch(e){if(cb)cb();}}function bind(el,fn){if(!el||el.__bdTap)return;el.__bdTap=1;var last=0;function go(e){if(e&&e.type==="pointerup"&&e.button)return;var n=Date.now();if(n-last<400)return;last=n;if(window.__bdAudio)window.__bdAudio.unlock();fn.call(el,e);}el.addEventListener("click",go);el.addEventListener("touchend",go);}for(var i=0;i<T.length;i++)bind(T[i],function(){this.classList.toggle("fl");snd(this.getAttribute("data-a"));});var b=document.querySelector(".rpall");if(b)bind(b,function(){var k=0;(function nx(){for(var j=0;j<T.length;j++)T[j].classList.remove("on");if(k>=T.length)return;var t=T[k++];t.classList.add("fl","on");snd(t.getAttribute("data-a"),nx);})();});})();<\/script>`;
const strip=s=>String(s||'').replace(/\[sound:[^\]]*\]/g,'').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').trim();
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const R=(s,a,b,tag)=>{if(!s.includes(a)){console.warn('std10: patch not found',tag);return s}return s.split(a).join(b)};
function patchAI(t){if(!t.includes('var SERVER_URL'))return t;if(t.includes('/*std10ai*/'))return t.split("px -apple-system,sans-serif").join("px PingFang SC,Noto Sans CJK SC,-apple-system,sans-serif");
 t=R(t,"var root=$('ai'); if(!root) return;","var root=$('ai'); if(!root) return; /*std10ai*/ W.gen=(W.gen||0)+1; var GEN=W.gen; try{cancelAnimationFrame(W.raf);cancelAnimationFrame(W.praf);clearTimeout(W.timer);if(W.xhr)W.xhr.abort();if(W.src)W.src.stop();}catch(e){} W.xhr=null; W.dt=0;\nfunction tx(id,v,c){var e=$(id);if(!e)return;if(e.__v!==v){e.__v=v;e.textContent=v;}if(c&&e.__c!==c){e.__c=c;e.style.color=c;}}",'init');
 t=R(t,"$('ai-hint').textContent=loud?'too loud — move the phone away':quiet?'quiet — speak a bit louder':'good level'; $('ai-hint').style.color=col;","tx('ai-hint',loud?'too loud — move the phone away':quiet?'quiet — speak a bit louder':'good level',col);",'hint');
 t=R(t,"$('ai-time').textContent=t.toFixed(1)+' / '+MAXS+' s';","tx('ai-time',t.toFixed(1)+' / '+MAXS+' s');",'time');
 t=R(t,"var x=new XMLHttpRequest(),","var x=W.xhr=new XMLHttpRequest(),",'xhr');
 t=R(t,"x.onload=function(){ clearTimeout(slow);","x.onload=function(){ clearTimeout(slow); if(GEN!==W.gen)return; W.xhr=null;",'gen');
 t=R(t,"function draw(c){\n  var cv=$('ai-cv');","function draw(c){ var cv=$('ai-cv'); if(c&&cv&&!cv.clientWidth&&W.dt<30){W.dt++;cv.style.display='block';requestAnimationFrame(function(){draw(c);});return;} W.dt=0; try{draw0(c);}catch(e){try{st('Could not draw the pitch: '+e.message);}catch(_){}} }\nfunction draw0(c){\n  var cv=$('ai-cv');",'draw');
 t=R(t,"var p=s.target, a=","var p=(s.target&&s.target.length>1)?s.target:[3,3], a=",'target');
 t=R(t,"g.setLineDash([]); g.textAlign='left';","if(!U.some(Boolean)){g.fillStyle='#9aa7b4';g.textAlign='center';g.font='13px -apple-system,sans-serif';g.fillText('your pitch was not caught — say it a bit louder',w/2,Tp+18);} g.setLineDash([]); g.textAlign='left';",'nouser');
 t=t.split("px -apple-system,sans-serif").join("px PingFang SC,Noto Sans CJK SC,-apple-system,sans-serif");
 return t}
const WG_JS=`<script>(function(){if(window.__bdWG&&window.__bdWG.off)window.__bdWG.off();var hw=document.getElementById("hw")||document.getElementById("hwrow");var sw=document.getElementById("wsw");var ans=document.getElementById("wans");if(!hw||!sw)return;var active=true,fromHw=false;function canVib(){try{return typeof navigator.vibrate==="function"&&navigator.vibrate(0)===true;}catch(e){return false;}}var V=canVib();function shake(el){if(!el)el=hw;el.classList.remove("wshake");void el.offsetWidth;el.classList.add("wshake");}function buzz(el){if(V){try{navigator.vibrate(25);return;}catch(e){}}shake(el||hw);}function off(){if(!active){if(window.__bdWG&&window.__bdWG.off===off)window.__bdWG=null;return;}active=false;document.removeEventListener("touchstart",onStart,true);document.removeEventListener("pointerdown",onStart,true);document.removeEventListener("mousedown",onStart,true);document.removeEventListener("touchend",onEnd,true);document.removeEventListener("click",onClick,true);if(window.__bdWG&&window.__bdWG.off===off)window.__bdWG=null;}function alive(){var h=document.getElementById("hw")||document.getElementById("hwrow");var s=document.getElementById("wsw");if(!h||!s||s.checked){off();return false;}return true;}function inHw(t){return !!(t&&t.closest&&t.closest("#hw,#hwrow,.hw,.mzg"));}function allowed(t){return !!(t&&t.closest&&t.closest("#hw,#hwrow,.hw,.mzg,.wgd,.wsw,.wans,button,a,label,input,.btn,audio,.ptile,.rp,.rpall,.pw,.pb,#pall,.tapau,.replay-button,.soundLink"));}function onStart(e){if(!alive())return;fromHw=inHw(e.target);}function onEnd(e){if(!alive())return;if(fromHw||inHw(e.target)){try{e.preventDefault();}catch(err){}fromHw=false;return;}if(allowed(e.target))return;e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();buzz(document.querySelector(".wrap")||hw);}function onClick(e){if(!alive())return;if(fromHw||inHw(e.target)){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();fromHw=false;return;}if(allowed(e.target))return;e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();if(!("ontouchend" in window))buzz(document.querySelector(".wrap")||hw);}function done(){try{if(sw)sw.checked=true;}catch(e){}if(ans)ans.classList.add("on");off();}document.addEventListener("touchstart",onStart,true);document.addEventListener("pointerdown",onStart,true);document.addEventListener("mousedown",onStart,true);document.addEventListener("touchend",onEnd,true);document.addEventListener("click",onClick,true);sw.onchange=function(){if(ans)ans.classList.toggle("on",sw.checked);if(sw.checked)off();};window.__bdWG={off:off,miss:function(){buzz(hw);},done:done};})();<\/script>`;
function patchWrite(q,m){if(!q.includes('HanziWriter=function'))return q;
 q=q.split('✓ Done — tap to see the answer').join('✓ Done. Flip the switch to see the answer');
 q=q.split('✓ Done — flip the switch to see the answer').join('✓ Done. Flip the switch to see the answer');
 q=q.split('✓ All "+ws.length+" characters written — tap Show Answer').join('✓ All "+ws.length+" characters written. Flip the switch to see the answer');
 q=q.split('✓ All "+ws.length+" characters written — flip the switch to see the answer').join('✓ All "+ws.length+" characters written. Flip the switch to see the answer');
 q=q.replace('if(i>=ws.length){msg.textContent="✓ Done. Flip the switch to see the answer";return;}','if(i>=ws.length){msg.textContent="✓ Done";if(window.__bdWG&&window.__bdWG.done)window.__bdWG.done();return;}');
 q=q.replace('if(i>=ws.length){msg.textContent="✓ All "+ws.length+" characters written. Flip the switch to see the answer";return;}','if(i>=ws.length){msg.textContent="✓ All "+ws.length+" characters written";if(window.__bdWG&&window.__bdWG.done)window.__bdWG.done();return;}');
 if(q.includes('drawingWidth:14,highlightColor')&&!q.includes('showHintAfterMisses:2'))q=q.replace('drawingWidth:14,highlightColor','drawingWidth:14,showHintAfterMisses:2,highlightColor');
 if(!q.includes('__bdWG.miss')){q=q.replace('ws[i].quiz({onComplete:function(){quiz(i+1)}});','ws[i].quiz({onMistake:function(){if(window.__bdWG&&window.__bdWG.miss)window.__bdWG.miss();},onComplete:function(){quiz(i+1)}});');
  q=q.replace('ws[i].quiz({onCorrectStroke:function(d){next=d.strokeNum+1},onComplete:function(){setTimeout(function(){quiz(i+1)},350)}});','ws[i].quiz({onMistake:function(){if(window.__bdWG&&window.__bdWG.miss)window.__bdWG.miss();},onCorrectStroke:function(d){next=d.strokeNum+1},onComplete:function(){setTimeout(function(){quiz(i+1)},350)}});');}
 const oldWgd='<div class="wgd"><label class="wsw"><input type="checkbox" id="wsw"><span class="sl"></span></label><span>Answer switch · only this opens the answer</span></div>';
 const newWgd='<label class="wgd"><span class="wsw"><input type="checkbox" id="wsw"><span class="sl"></span></span><span>Answer switch · only this opens the answer</span></label>';
 if(q.includes(oldWgd))q=q.split(oldWgd).join(newWgd);
const wgRe=/<script>\(function\(\)\{(?:var V=!!\(navigator\.vibrate\)|if\(window\.__bdWG)[\s\S]*?<\/script>/;
 if(wgRe.test(q))q=q.replace(wgRe,WG_JS);
 else if(!q.includes('id="wsw"')){const en=m.flds.some(f=>f.name==='Short')?'Short':'English';
  q=q+newWgd+`<div class="wans" id="wans"><div class="big">{{Hanzi}}</div><div class="py">{{Pinyin}}</div><div>{{${en}}}</div></div>`+WG_JS;}
 return q}
function rp(t,a,b){if(!t.includes(a))throw new Error('std13 patch anchor missing: '+a.slice(0,50));return t.split(a).join(b)}
function patchV13(t){if(!t.includes('var SERVER_URL')||t.includes('/*v13rec*/'))return t;
 const ex=/id="ai-her-a" src="\{\{ExAudioFile\}\}"/.test(t),nf=ex?'ExNative':'Native';
 t=t.replace(/(<audio id="ai-her-a"[^>]*><\/audio>)/,`$1<div id="ai-nat" style="display:none">{{${nf}}}</div>`);
 t=t.split('▶ Her voice').join('▶ Hear native');
 t=rp(t,"var SERVER_URL=","/*v13rec*/var SERVER_URL=");
 // one AudioContext for every attempt; revive it if iOS suspended / interrupted / closed it
 t=rp(t,"function ctx(){ if(!W.ac){","function ctx(){ if(W.ac&&W.ac.state==='closed')W.ac=null; if(!W.ac){");
 t=rp(t,"if(W.ac.state==='suspended')W.ac.resume(); return W.ac;}","if(W.ac.state!=='running'){try{W.ac.resume();}catch(e){}} return W.ac;}");
 // no OfflineAudioContext per attempt (iOS caps live audio contexts): resample in JS with a small averaging low-pass
 t=rp(t,"function to16k(ab){","function to16k(ab){ return Promise.resolve(lin(ab)); }\nfunction to16kOld(ab){");
 t=rp(t,"o[j]=m[k]+((m[k+1]||0)-m[k])*f;}","var s0=0,c0=0,h0=Math.max(0,Math.floor(r/2)); for(var q=k-h0;q<=k+h0;q++){if(q>=0&&q<m.length){s0+=m[q];c0++;}} o[j]=c0?s0/c0:0;}");
 // every attempt starts from a clean state: old timer, old mic stream and nodes are released first
 t=rp(t,"function start(){\n  if(W.src){try{W.src.stop();}catch(e){}}","function start(){\n  if(W.recording||$('ai-rec').disabled)return; clearTimeout(W.timer); cancelAnimationFrame(W.raf); cleanup(); W.rec=null; W.chunks=[];\n  if(W.src){try{W.src.stop();}catch(e){}}");
 t=rp(t,"x.ontimeout=function(){","x.onabort=function(){ clearTimeout(slow); $('ai-rec').disabled=false; };\n  x.ontimeout=function(){");
 // native slots go to the server; the native line is drawn from data stored in the card
 t=rp(t,"fd.append('card','bd1:'+CARD);","fd.append('card','bd1:'+CARD); var NT=nat(); if(NT&&NT.sl&&NT.d){fd.append('nslots',JSON.stringify(NT.sl)); fd.append('ndur',NT.d);}");
 t=rp(t,"function draw0(c){","function nat(){ if(W.natG===GEN)return W.nat; W.natG=GEN; W.nat=null; try{var e=$('ai-nat'),s=e?e.textContent.trim():''; if(s)W.nat=JSON.parse(s);}catch(e){} return W.nat; }\nfunction draw0(c){");
 t=rp(t,"g.fillText(s.hanzi,(x0+x1)/2,h-22);","g.fillText(s.hanzi,(x0+x1)/2,h-22); if(s.voiced===0){g.save();g.fillStyle='#9aa7b4';g.font='11px PingFang SC,Noto Sans CJK SC,-apple-system,sans-serif';g.fillText(x1-x0>66?'not voiced':'—',(x0+x1)/2,Tp+14);g.restore();g.fillStyle=col;}");
 t=rp(t,"g.lineCap='round'; g.lineJoin='round'; var U=","var NT=nat(); if(NT&&NT.p&&NT.p.length&&isFinite(c.onset)){ g.save(); g.strokeStyle='rgba(75,85,99,.7)'; g.lineWidth=2.5; g.lineCap='round'; var pv=null; NT.p.forEach(function(q){ if(!q){pv=null;return;} var xx=X(c.onset+q[0]), yy=Y(q[1]); if(xx>w-R)return; if(pv){g.beginPath();g.moveTo(pv[0],pv[1]);g.lineTo(xx,yy);g.stroke();} pv=[xx,yy]; }); g.restore(); }\n  g.lineCap='round'; g.lineJoin='round'; var U=");
 t=rp(t,"g.fillText('your voice',L+128,11);","g.fillText('your voice',L+128,11); if(nat()&&nat().p&&nat().p.length){ g.fillStyle='rgba(75,85,99,.7)'; g.fillRect(L+204,9,18,4); g.fillStyle=fg; g.fillText('native',L+228,11); }");
 return t}
function patchV13b(t){if(!t.includes('/*v13rec*/')||t.includes('/*v13b*/'))return t;
 t=rp(t,"▶ Hear native</button>","▶ Hear native</button><label class=\"natsw\" style=\"display:inline-flex;align-items:center;gap:4px;font-size:13px;color:#4a5668;margin-left:4px\"><input type=\"checkbox\" id=\"ai-natsw\" style=\"width:18px;height:18px\"> Native line</label>");
 t=rp(t,"/*v13rec*/","/*v13rec*//*v13b*/");
 t=rp(t,"function nat(){","function natOn(){ try{return localStorage.getItem('aiNatLine')!=='0';}catch(e){return true;} }\nfunction nat(){");
 t=rp(t,"var NT=nat(); if(NT&&NT.p&&NT.p.length&&isFinite(c.onset)){","var NT=nat(); if(natOn()&&NT&&NT.p&&NT.p.length&&isFinite(c.onset)){");
 t=rp(t,"if(nat()&&nat().p&&nat().p.length){ g.fillStyle='rgba(75,85,99,.7)'","if(natOn()&&nat()&&nat().p&&nat().p.length){ g.fillStyle='rgba(75,85,99,.7)'");
 t=rp(t,"W.show=show;","W.show=show; (function(){ var sw=$('ai-natsw'); if(!sw)return; if(!(nat()&&nat().p&&nat().p.length)){sw.parentNode.style.display='none';return;} sw.checked=natOn(); sw.onchange=function(){ try{localStorage.setItem('aiNatLine',sw.checked?'1':'0');}catch(e){} if(W.last)draw(W.last.contour); }; })();");
 return t}
const TL_LOADER=`<script>(function(){var s=document.createElement('script');s.src='https://mandarin-tone-trainer.onrender.com/anki/tone-listener.js?v=1&t='+Math.floor(Date.now()/300000);s.onerror=function(){var e=document.getElementById('ai-st');if(e)e.textContent='📡 The tone listener needs the internet — connect and open the card again. (You can still hear the native audio.)';var b=document.getElementById('ai-rec');if(b)b.disabled=true;var h=document.getElementById('ai-her'),a=document.getElementById('ai-her-a');if(h&&a)h.onclick=function(){try{a.currentTime=0;a.play();}catch(x){}};};document.body.appendChild(s);})();<\/script>`;
// recorder UI code lives on the server (/anki/tone-listener.js); the card keeps only its HTML + data and this loader
function patchRemote(t){const i=t.indexOf('var SERVER_URL');if(i<0||!t.includes('/*v13b*/'))return t;const a=t.lastIndexOf('<script>',i),b=t.indexOf('</script>',i);if(a<0||b<0)return t;return t.slice(0,a)+'<!--tl-remote-->'+TL_LOADER+t.slice(b+9)}
const PIANO_CARD_JS=`<script>(function(){/*__bdPiano*/if(window.__bdWG&&window.__bdWG.off){var sw=document.getElementById("wsw"),hw=document.getElementById("hw")||document.getElementById("hwrow");if(!hw||!sw||sw.checked)window.__bdWG.off();}var T=document.querySelectorAll(".pw .ptile"),A=window.__bdRA=window.__bdRA||{};if(!T.length)T=document.querySelectorAll(".ptile");function snd(f,cb){if(window.__bdAudio)return window.__bdAudio.play(f,cb);if(!f){if(cb)setTimeout(cb,150);return;}try{if(A.cur)A.cur.pause();A.cur=new Audio(f);if(cb){A.cur.onended=function(){setTimeout(cb,120)};A.cur.onerror=cb;}A.cur.play();}catch(e){if(cb)cb();}}function bind(el,fn){if(!el||el.__bdTap)return;el.__bdTap=1;var last=0;function go(e){if(e&&e.type==="pointerup"&&e.button)return;var n=Date.now();if(n-last<400)return;last=n;if(window.__bdAudio)window.__bdAudio.unlock();fn.call(el,e);}el.addEventListener("click",go);el.addEventListener("touchend",go);}for(var i=0;i<T.length;i++)bind(T[i],function(){this.classList.toggle("fl");snd(this.getAttribute("data-a"));});var p=document.getElementById("pall");if(p)bind(p,function(){var i=0;(function nx(){if(i>=T.length)return;var t=T[i++];t.classList.add("fl");snd(t.getAttribute("data-a"),nx);})();});})();<\/script>`;
function patchPiano(q){if(!q.includes('id="pall"')||!q.includes('.ptile'))return q;const neu=/<script>\(function\(\)\{\/\*__bdPiano\*\/[\s\S]*?<\/script>/;const old=/<script>\(function\(\)\{var T=document\.querySelectorAll\('\.ptile'\);var A=\{\};[\s\S]*?<\/script>/;if(neu.test(q))return q.replace(neu,PIANO_CARD_JS);if(old.test(q))return q.replace(old,PIANO_CARD_JS);return q}
const AUDIO_JS=`<script>(function(){/*__bdAudio*/function fileOf(x){if(!x)return "";x=String(x).trim();var m=x.match(/\\[sound:([^\\]]+)\\]/); if(m)return m[1];m=x.match(/(?:src|href)=["']([^"']+)["']/i); if(m)x=m[1];m=x.match(/(?:sound:|playsound:)([^"'\\s>]+)/i); if(m)return m[1];x=x.split("?")[0].split("#")[0];m=x.match(/([^\\/\\\\'"]+\\.(?:mp3|m4a|ogg|wav|aac))$/i); if(m)return m[1];return x;}function urlOf(f){f=fileOf(f); if(!f)return "";if(/^(https?:|data:|blob:|anki:|file:)/i.test(f))return f;try{return encodeURI(f)}catch(e){return f}}var A=window.__bdRA=window.__bdRA||{};function unlock(){try{var AC=window.AudioContext||window.webkitAudioContext;if(AC){A.ctx=A.ctx||new AC(); if(A.ctx.state!=="running") A.ctx.resume();}}catch(e){}if(!A.el){A.el=document.createElement("audio");A.el.setAttribute("playsinline","");A.el.setAttribute("webkit-playsinline","");A.el.preload="auto";A.el.style.display="none";(document.body||document.documentElement).appendChild(A.el);}try{A.el.muted=false;A.el.volume=1;}catch(e){}return A.el;}function nativePlay(f){var files=[f];if(f.charAt(0)==="_") files.push(f.slice(1)); else files.push("_"+f);for(var i=0;i<files.length;i++){try{if(typeof pycmd==="function"){pycmd("play:"+files[i]);return files[i];}}catch(e){}try{if(typeof AnkiDroidJS!=="undefined"&&AnkiDroidJS.ankiPlayMedia){AnkiDroidJS.ankiPlayMedia(files[i]);return files[i];}}catch(e){}}return "";}function htmlPlay(f,cb){var el=unlock();try{el.pause();}catch(e){}var files=[f];if(f.charAt(0)==="_") files.push(f.slice(1)); else files.push("_"+f);var ix=0;function tryOne(){var cur=files[ix];el.onended=cb?function(){setTimeout(cb,120)}:null;el.onerror=function(){if(ix<files.length-1){ix++;tryOne();return;}if(cb)cb();};try{el.src=urlOf(cur);}catch(e){el.src=cur;}var p;try{p=el.play();}catch(e){if(ix<files.length-1){ix++;tryOne();return;} if(cb)cb();return;}if(p&&p.catch)p.catch(function(){if(ix<files.length-1){ix++;tryOne();return;}if(cb)cb();});}tryOne();}function waitDur(f,cb){if(!cb)return;var el=unlock(),done=0;function finish(ms){if(done)return;done=1;setTimeout(cb,Math.max(400,ms||800));}try{el.src=urlOf(f);el.onloadedmetadata=function(){finish((el.duration||1)*1000+150);};el.onerror=function(){finish(900);};}catch(e){finish(900);return;}setTimeout(function(){finish((el.duration&&isFinite(el.duration)?el.duration*1000+150:1600));},2500);}function play(f,cb){f=fileOf(f);if(!f){if(cb)setTimeout(cb,150);return;}unlock();var used=nativePlay(f);if(used){waitDur(used,cb);return;}htmlPlay(f,cb);}window.__bdAudio={play:play,unlock:unlock,fileOf:fileOf};})();<\/script>`;
function ensureAudio(t){if(!t)return t;const re=/<script>\(function\(\)\{\/\*__bdAudio\*\/[\s\S]*?<\/script>/;if(re.test(t))return t.replace(re,AUDIO_JS);return t+AUDIO_JS}
function patchTmpl(m,t){t.qfmt=patchPiano(patchWrite(t.qfmt,m));t.qfmt=patchRemote(patchV13b(patchV13(t.qfmt)));t.afmt=patchRemote(patchV13b(patchV13(t.afmt)));t.qfmt=t.qfmt.split("px -apple-system,sans-serif").join("px PingFang SC,Noto Sans CJK SC,-apple-system,sans-serif");let a=t.afmt;
 a=patchAI(a);
 if(a.includes('class="aitl"')&&!a.includes('class="peek"')){const dh=(a.match(/data-hanzi="\{\{text:(\w+)\}\}"/)||[])[1];
  const P={Hanzi:['Hanzi','Pinyin','Short'],ExZh:['ExZh','ExPy','ExEn'],Text:['Text','Pinyin','English']}[dh];
  if(P)a=a.replace(/(<div class="aitl">[\s\S]*?<\/span><\/div>)/,`$1<div class="peek"><button class="pkb" onclick="this.parentNode.classList.toggle('on');this.textContent=this.parentNode.classList.contains('on')?'🙈 Hide':'👁 Peek: character + pinyin'">👁 Peek: character + pinyin</button><div class="pkc"><div class="pkhz">{{${P[0]}}}</div><div class="pkpy">{{${P[1]}}}</div><div class="pken">{{${P[2]}}}</div></div></div>`)}
 a=a.replace("var iv=setInterval(push,8000);","if(window.__bdSyncIv)clearInterval(window.__bdSyncIv);var iv=window.__bdSyncIv=setInterval(push,8000);");
 if(a.includes("var HZ={fuqi:'夫妻'")&&!a.includes("le:'了'"))a=a.replace("var HZ={fuqi:'夫妻',","var HZ={le:'了',fuqi:'夫妻',").replace("['D',['anzhuang','yige','men','xiongmen']","['D',['anzhuang','le','yige','men','xiongmen']");
 const SL='<div class="rich-slot">{{Rich}}</div>';if(a.includes(SL)){const k=a.indexOf(SL),e=a.indexOf('</script>',k);a=a.slice(0,k)+(e>0?a.slice(e+9):a.slice(k+SL.length));}
 if(String(m.id)!==PIANO_MID)a+=`<div class="rich-slot">{{Rich}}</div>`+RICH_JS;
 t.qfmt=ensureAudio(t.qfmt);t.afmt=ensureAudio(a);}
const NATF={'1793305701':[['Native','AudioFile','Hanzi'],['ExNative','ExAudioFile','ExZh']],'1793305702':[['Native','AudioFile','Text']]};const NAT={};
// before export: compute the native contour of every recorder card's own clip once (cached by file name; reused if the note already has it)
async function prep(db,MODELS,getBytes,api){const rows=(db.exec('select mid,flds from notes')[0]||{values:[]}).values;const jobs=[];
 for(const [mid,f] of rows){const L=NATF[String(mid)];if(!L)continue;const names=MODELS[mid].flds.map(x=>x.name),v=f.split('\x1f'),F={};names.forEach((k,i)=>F[k]=v[i]||'');
  for(const [nf,af,hf] of L){const an=F[af];if(!an||NAT[an])continue;try{const old=JSON.parse(F[nf]||'null');if(old&&old.a===an&&old.v===2){NAT[an]=old;continue}}catch(e){}
   const hz=strip(F[hf]).replace(/[^\u3400-\u9fff]/g,'');if(!hz)continue;NAT[an]={pending:1};jobs.push([an,hz]);}}
 const AC=new (window.OfflineAudioContext||window.webkitOfflineAudioContext)(1,1,16000);let done=0;
 for(const [an,hz] of jobs){try{const by=getBytes(an);if(!by)throw new Error('no audio');const ab=await AC.decodeAudioData(by.slice().buffer);
   const len=Math.ceil(ab.duration*16000),oc=new OfflineAudioContext(1,len,16000),s=oc.createBufferSource();s.buffer=ab;s.connect(oc.destination);s.start();const x=(await oc.startRendering()).getChannelData(0);
   const dv=new DataView(new ArrayBuffer(44+x.length*2)),w=(o,t)=>{for(let i=0;i<t.length;i++)dv.setUint8(o+i,t.charCodeAt(i))};w(0,'RIFF');dv.setUint32(4,36+x.length*2,true);w(8,'WAVE');w(12,'fmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,1,true);dv.setUint32(24,16000,true);dv.setUint32(28,32000,true);dv.setUint16(32,2,true);dv.setUint16(34,16,true);w(36,'data');dv.setUint32(40,x.length*2,true);for(let i=0;i<x.length;i++)dv.setInt16(44+i*2,Math.max(-1,Math.min(1,x[i]))*32767,true);
   const r=await api('/api/inspector/native?h='+encodeURIComponent(hz),{method:'POST',headers:{'Content-Type':'audio/wav'},body:dv.buffer});NAT[an]=await r.json();}catch(e){NAT[an]={error:String(e.message||e)}}done++;}
 return {computed:jobs.length,errors:jobs.filter(([a])=>NAT[a].error).length}}
function apply(db,MODELS){const M=JSON.parse(JSON.stringify(MODELS));
 for(const m of Object.values(M)){const c0=m.css||'';m.css=(c0.includes(MARK)?c0.slice(0,c0.indexOf(MARK)).replace(/\n$/,''):c0)+'\n'+CSS;
  if(!m.flds.some(f=>f.name==='Rich'))m.flds.push({...m.flds[0],name:'Rich',ord:m.flds.length,sticky:false});
  for(const nf of NATF[String(m.id)]||[])if(!m.flds.some(f=>f.name===nf[0]))m.flds.push({...m.flds[0],name:nf[0],ord:m.flds.length,sticky:false});
  for(const t of m.tmpls||[])patchTmpl(m,t);}
 const rows=(db.exec('select id,mid,flds from notes')[0]||{values:[]}).values,nm=mid=>M[mid].flds.map(f=>f.name);
 const W=[];for(const [id,mid,f] of rows)if(String(mid)===WORD_MID){const F={},v=f.split('\x1f');nm(mid).forEach((n,i)=>F[n]=v[i]||'');
  W.push({hz:strip(F.Hanzi),py:strip(F.Pinyin),en:strip(F.Short),img:(F.Picture.match(/src="([^"]+)"/)||[])[1]||'',a:F.AudioFile||((F.Audio.match(/\[sound:([^\]]+)\]/)||[])[1])||''})}
 const byLen=[...W].sort((x,y)=>y.hz.length-x.hz.length);
 const seg=(s,skip)=>{s=s.replace(/[^\u3400-\u9fff]/g,'');const o=[];let i=0;while(i<s.length){const w=byLen.find(w=>w.hz&&w.hz!==skip&&s.startsWith(w.hz,i));if(w){o.push(w);i+=w.hz.length}else i++}return o};
 const tile=w=>`<div class="ptile" data-a="${esc(w.a)}">${w.img?`<img src="${esc(w.img)}">`:''}<div class="b"><div class="h">${esc(w.hz)}</div><div class="p">${esc(w.py)}</div></div></div>`;
 let n=0;for(const [id,mid,f] of rows){const names=nm(mid),v=f.split('\x1f');while(v.length<names.length)v.push('');const F={};names.forEach((k,i)=>F[k]=v[i]);
  let text,py,en,words,isWord=String(mid)===WORD_MID;
  if(String(mid)===PIANO_MID){v[names.indexOf('Rich')]='';}
  else{if(isWord){text=strip(F.Hanzi);const self=W.find(w=>w.hz===text),parts=text.length>1?seg(text,text):[];words=(parts.length>1&&parts.reduce((a,w)=>a+w.hz.length,0)===text.length)?parts:[self].filter(Boolean);py=strip(F.Pinyin);en=strip(F.Short)}
   else{text=strip(F.Text||F.Hanzi||F.Answer);py=strip(F.Pinyin);en=strip(F.English);words=seg(text)}
   const bg=(words.find(w=>w.img)||{}).img;
   const head=isWord?`<div class="rsec">English</div><div class="ren">${esc(en)}</div>`:`<div class="rhz">${esc(text)}</div><div class="rpy">${esc(py)}</div><div class="ren">${esc(en)}</div>`;
   const dict=words.length?`<div class="rsec">Dictionary · every word (CC-CEDICT)</div><div class="rdict">${words.map(w=>`<div><b>${esc(w.hz)}</b> ${esc(w.py)} — ${esc(w.en)}</div>`).join('')}</div>`:'';
   const piano=words.length?`<div class="rsec">🎹 ${words.length>1?'Every word in it':'Its piano card'} · tap to flip and hear</div><div class="pw rp">${words.map(tile).join('')}</div>${words.length>1?'<button class="rpall">▶ Play all</button>':''}`:'';
   v[names.indexOf('Rich')]=`<div class="rich">${bg?`<div class="rbg"><img src="${esc(bg)}"></div>`:''}${head}${dict}${piano}</div>`;}
  for(const [nf,af,hf] of NATF[String(mid)]||[]){const an=F[af]||'',r=NAT[an];if(r&&!r.error)v[names.indexOf(nf)]=JSON.stringify({...r,a:an});else if(!an)v[names.indexOf(nf)]='';}
  db.run('update notes set flds=?,mod=?,usn=-1 where id=?',[v.join('\x1f'),Math.floor(Date.now()/1000),id]);n++}
 return {models:M,notes:n}}
window.STD10={apply,prep,NAT,patchV13,CSS,AUDIO_JS,WG_JS,RICH_JS,PIANO_CARD_JS,version:16};
})();
