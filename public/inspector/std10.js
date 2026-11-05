// Card anatomy standard v10 — applied to every exported deck (idempotent).
// 1 blue halo on all big characters (font colour untouched)   2 👁 peek (character + pinyin) inside the tone listener
// 3 rich answer on every card: blurred word photo, English, dictionary lines, tappable piano tiles of every word in it
// 6 tone-listener hardening: stale state from the previous card is cleared, late server replies ignored, trace drawn
//   even when the target curve is missing, canvas re-measured until visible, fewer DOM writes while recording,
//   one sync timer instead of one per reviewed card
(function(){
const WORD_MID='1793305701',PIANO_MID='1793305799',MARK='/*std10*/';
const CSS=`${MARK}
.bighz,.hz,.chunk,.big,.zh,.ptile .h,.pkhz,.rhz{text-shadow:0 0 2px rgba(0,136,255,.95),0 0 8px rgba(0,153,255,.75),0 0 18px rgba(0,190,255,.5)!important}
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
.rp .ptile img{width:100%;height:100%;object-fit:cover}.rp .ptile .b{display:none}.rp .ptile.fl img{display:none}.rp .ptile.fl{background:#eef8ff}
.ptile.fl .b{display:flex!important;flex-direction:column;align-items:center;justify-content:center}.ptile .h{font-size:32px;font-weight:700;line-height:1.2;white-space:nowrap}.ptile .p{color:#7a8794;font-size:14px}
.card:has(.lock:not(.open)) .rich,body:has(.lock:not(.open)) .rich{display:none}`;
const RICH_JS=`<script>(function(){var T=document.querySelectorAll('.rp .ptile'),A=window.__bdRA=window.__bdRA||{};for(var i=0;i<T.length;i++)T[i].onclick=function(){var f=this.getAttribute('data-a');if(this.className.indexOf(' fl')<0){this.className+=' fl';if(f){try{if(A.cur)A.cur.pause();A.cur=new Audio(f);A.cur.play();}catch(e){}}}else this.className=this.className.replace(' fl','');};})();<\/script>`;
const strip=s=>String(s||'').replace(/\[sound:[^\]]*\]/g,'').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').trim();
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const R=(s,a,b,tag)=>{if(!s.includes(a)){console.warn('std10: patch not found',tag);return s}return s.split(a).join(b)};
function patchAI(t){if(t.includes('/*std10ai*/')||!t.includes('var SERVER_URL'))return t;
 t=R(t,"var root=$('ai'); if(!root) return;","var root=$('ai'); if(!root) return; /*std10ai*/ W.gen=(W.gen||0)+1; var GEN=W.gen; try{cancelAnimationFrame(W.raf);cancelAnimationFrame(W.praf);clearTimeout(W.timer);if(W.xhr)W.xhr.abort();if(W.src)W.src.stop();}catch(e){} W.xhr=null; W.dt=0;\nfunction tx(id,v,c){var e=$(id);if(!e)return;if(e.__v!==v){e.__v=v;e.textContent=v;}if(c&&e.__c!==c){e.__c=c;e.style.color=c;}}",'init');
 t=R(t,"$('ai-hint').textContent=loud?'too loud — move the phone away':quiet?'quiet — speak a bit louder':'good level'; $('ai-hint').style.color=col;","tx('ai-hint',loud?'too loud — move the phone away':quiet?'quiet — speak a bit louder':'good level',col);",'hint');
 t=R(t,"$('ai-time').textContent=t.toFixed(1)+' / '+MAXS+' s';","tx('ai-time',t.toFixed(1)+' / '+MAXS+' s');",'time');
 t=R(t,"var x=new XMLHttpRequest(),","var x=W.xhr=new XMLHttpRequest(),",'xhr');
 t=R(t,"x.onload=function(){ clearTimeout(slow);","x.onload=function(){ clearTimeout(slow); if(GEN!==W.gen)return; W.xhr=null;",'gen');
 t=R(t,"function draw(c){\n  var cv=$('ai-cv');","function draw(c){ var cv=$('ai-cv'); if(c&&cv&&!cv.clientWidth&&W.dt<30){W.dt++;cv.style.display='block';requestAnimationFrame(function(){draw(c);});return;} W.dt=0; try{draw0(c);}catch(e){try{st('Could not draw the pitch: '+e.message);}catch(_){}} }\nfunction draw0(c){\n  var cv=$('ai-cv');",'draw');
 t=R(t,"var p=s.target, a=","var p=(s.target&&s.target.length>1)?s.target:[3,3], a=",'target');
 t=R(t,"g.setLineDash([]); g.textAlign='left';","if(!U.some(Boolean)){g.fillStyle='#9aa7b4';g.textAlign='center';g.font='13px -apple-system,sans-serif';g.fillText('your pitch was not caught — say it a bit louder',w/2,Tp+18);} g.setLineDash([]); g.textAlign='left';",'nouser');
 return t}
function patchTmpl(m,t){let a=t.afmt;
 a=patchAI(a);
 if(a.includes('class="aitl"')&&!a.includes('class="peek"')){const dh=(a.match(/data-hanzi="\{\{text:(\w+)\}\}"/)||[])[1];
  const P={Hanzi:['Hanzi','Pinyin','Short'],ExZh:['ExZh','ExPy','ExEn'],Text:['Text','Pinyin','English']}[dh];
  if(P)a=a.replace(/(<div class="aitl">[\s\S]*?<\/span><\/div>)/,`$1<div class="peek"><button class="pkb" onclick="this.parentNode.classList.toggle('on');this.textContent=this.parentNode.classList.contains('on')?'🙈 Hide':'👁 Peek: character + pinyin'">👁 Peek: character + pinyin</button><div class="pkc"><div class="pkhz">{{${P[0]}}}</div><div class="pkpy">{{${P[1]}}}</div><div class="pken">{{${P[2]}}}</div></div></div>`)}
 a=a.replace("var iv=setInterval(push,8000);","if(window.__bdSyncIv)clearInterval(window.__bdSyncIv);var iv=window.__bdSyncIv=setInterval(push,8000);");
 if(a.includes("var HZ={fuqi:'夫妻'")&&!a.includes("le:'了'"))a=a.replace("var HZ={fuqi:'夫妻',","var HZ={le:'了',fuqi:'夫妻',").replace("['D',['anzhuang','yige','men','xiongmen']","['D',['anzhuang','le','yige','men','xiongmen']");
 if(String(m.id)!==PIANO_MID&&!a.includes('{{Rich}}'))a+=`<div class="rich-slot">{{Rich}}</div>`+RICH_JS;
 t.afmt=a;}
function apply(db,MODELS){const M=JSON.parse(JSON.stringify(MODELS));
 for(const m of Object.values(M)){const c0=m.css||'';m.css=(c0.includes(MARK)?c0.slice(0,c0.indexOf(MARK)).replace(/\n$/,''):c0)+'\n'+CSS;
  if(!m.flds.some(f=>f.name==='Rich'))m.flds.push({...m.flds[0],name:'Rich',ord:m.flds.length,sticky:false});
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
  else{if(isWord){text=strip(F.Hanzi);const self=W.find(w=>w.hz===text),parts=text.length>1?seg(text,text):[];words=[self,...(parts.reduce((a,w)=>a+w.hz.length,0)===text.length?parts:[])].filter(Boolean);py=strip(F.Pinyin);en=strip(F.Short)}
   else{text=strip(F.Text||F.Hanzi||F.Answer);py=strip(F.Pinyin);en=strip(F.English);words=seg(text)}
   const bg=(words.find(w=>w.img)||{}).img;
   const head=isWord?`<div class="rsec">English</div><div class="ren">${esc(en)}</div>`:`<div class="rhz">${esc(text)}</div><div class="rpy">${esc(py)}</div><div class="ren">${esc(en)}</div>`;
   const dict=words.length?`<div class="rsec">Dictionary · every word (CC-CEDICT)</div><div class="rdict">${words.map(w=>`<div><b>${esc(w.hz)}</b> ${esc(w.py)} — ${esc(w.en)}</div>`).join('')}</div>`:'';
   const piano=words.length?`<div class="rsec">🎹 ${words.length>1?'Every word in it':'Its piano card'} · tap to flip and hear</div><div class="pw rp">${words.map(tile).join('')}</div>`:'';
   v[names.indexOf('Rich')]=`<div class="rich">${bg?`<div class="rbg"><img src="${esc(bg)}"></div>`:''}${head}${dict}${piano}</div>`;}
  db.run('update notes set flds=?,mod=?,usn=-1 where id=?',[v.join('\x1f'),Math.floor(Date.now()/1000),id]);n++}
 return {models:M,notes:n}}
window.STD10={apply,CSS,version:10};
})();
