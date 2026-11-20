// Sequential tone scoring (branch tone-seq-scoring).
// Speed-independent: the learner's recording is cut into syllables by its OWN energy / voicing dips
// (never by the native speaker's timing), each syllable's tone is read from its own pitch shape
// (resampled to 5 points, so a slow or a fast syllable looks the same), and the tones are compared
// with the expected sequence in order. Score = share of syllables with the right tone (+ a little for clarity).

const toSt=f=>12*Math.log2(f/100);
const pct=(arr,p)=>{const v=[...arr].sort((a,b)=>a-b);return v[Math.min(v.length-1,Math.max(0,Math.round(p*(v.length-1))))];};
const mean=a=>a.reduce((p,q)=>p+q,0)/a.length;
const resample=(arr,n)=>arr.length===1?Array(n).fill(arr[0]):Array.from({length:n},(_,i)=>{const p=i*(arr.length-1)/(n-1),lo=Math.floor(p),hi=Math.min(arr.length-1,lo+1);return arr[lo]+(arr[hi]-arr[lo])*(p-lo);});

// pitch in semitones with octave-error cleanup and a 5-frame median; null where unvoiced
function cleanPitch(frames){
  const st=frames.map(f=>f.f0&&isFinite(f.f0)&&f.f0>0?toSt(f.f0):null);
  const vals=st.filter(v=>v!=null);if(!vals.length)return st;
  const med=pct(vals,0.5);
  for(let i=0;i<st.length;i++){let v=st[i];if(v==null)continue;while(v-med>11)v-=12;while(med-v>11)v+=12;st[i]=v;}
  const out=st.map((v,i)=>{if(v==null)return null;const w=st.slice(Math.max(0,i-2),i+3).filter(x=>x!=null).sort((a,b)=>a-b);return w[w.length>>1];});
  // drop 1-2 frame islands (clicks, consonant bursts)
  for(let i=0;i<out.length;){if(out[i]==null){i++;continue;}let j=i;while(j<out.length&&out[j]!=null)j++;if(j-i<3)for(let k=i;k<j;k++)out[k]=null;i=j;}
  return out;
}

// Cut the learner's voiced span into n syllables, in order. A cut is preferred at a deep energy dip or an
// unvoiced gap (consonant, pause) and where each piece's pitch can be read as the tone expected in that place
// (like forced alignment). Lengths are compared only with the learner's own average syllable, never with the
// native speaker, so speaking slowly or pausing costs nothing.
export const TRIM0=Number(process.env.SEQ_TRIM0??0.2);
export const W_FIT=Number(process.env.SEQ_W_FIT??1.5),W_PROM=Number(process.env.SEQ_W_PROM??0.3),W_LEN=Number(process.env.SEQ_W_LEN??1);
export function segment(frames,st,n,fitCost){
  const V=st.map(v=>v!=null);
  let a=V.indexOf(true),b=V.lastIndexOf(true);
  if(a<0)return null;b+=1;
  const cum=[0];for(let i=0;i<V.length;i++)cum.push(cum[i]+(V[i]?1:0));
  const total=cum[b]-cum[a],avg=total/n;
  if(n===1)return [[a,b]];
  const db=frames.map(f=>20*Math.log10((f.rms||0)+1e-5));
  const e=db.map((_,i)=>{let s=0,k=0;for(let j=i-2;j<=i+2;j++)if(j>=0&&j<db.length){s+=db[j];k++;}return s/k;});
  const W=Math.max(8,Math.round((b-a)/n*0.8));
  const prom=i=>{let lp=-1e9,rp=-1e9;for(let j=Math.max(a,i-W);j<=i;j++)lp=Math.max(lp,e[j]);for(let j=i;j<Math.min(b,i+W);j++)rp=Math.max(rp,e[j]);
    let pr=Math.max(0,Math.min(lp,rp)-e[i]);if(!V[i]){let g=0;for(let j=i;j<b&&!V[j];j++)g++;pr+=4+Math.min(10,g);}return pr;};
  const step=(b-a)>300?3:2,C=[];for(let i=a+step;i<b-1;i+=step)C.push(i);
  const P=C.map(prom),m=C.length,minLen=Math.max(2,avg*0.25);
  const cost=(k,s,t)=>{const len=cum[t]-cum[s];if(len<minLen)return 1e6;const r=Math.log(len/avg);return W_LEN*r*r+W_FIT*fitCost(k,s,t);};
  const NEG=1e18;let best=C.map((c,j)=>cost(0,a,c)-W_PROM*P[j]),back=[C.map(()=>-1)],all=[best];
  for(let k=1;k<n-1;k++){
    const bk=Array(m).fill(NEG),bb=Array(m).fill(-1),prev=all[k-1];
    for(let j=0;j<m;j++)for(let q=0;q<j;q++){if(prev[q]>=NEG/2)continue;const v=prev[q]+cost(k,C[q],C[j])-W_PROM*P[j];if(v<bk[j]){bk[j]=v;bb[j]=q;}}
    all.push(bk);back.push(bb);
  }
  let bj=-1,bv=NEG;const K=n-2;
  for(let j=0;j<m;j++){if(all[K][j]>=NEG/2)continue;const v=all[K][j]+cost(n-1,C[j],b);if(v<bv){bv=v;bj=j;}}
  let cuts=[];
  if(bj<0){for(let k=1;k<n;k++)cuts.push(Math.round(a+(b-a)*k/n));}
  else{for(let k=K,j=bj;k>=0;k--){cuts.unshift(C[j]);j=back[k][j];}}
  const edges=[a,...cuts,b];
  return edges.slice(0,-1).map((x,i)=>[x,edges[i+1]]);
}

const TONES=[1,2,3,4];
// Each tone gets a "distance" from simple, speed-free shape features (lower = fits better).
// Connected speech compresses tones, so the rules ask only for the right direction and height, not a full textbook curve.
export function features(c,semi){const L=mean(c);return {L,S:(c[3]+c[4])/2-(c[0]+c[1])/2,Ss:(semi[3]+semi[4])/2-(semi[0]+semi[1])/2,start:(c[0]+c[1])/2,end:(c[3]+c[4])/2,dip:Math.min(c[0],c[4])-Math.min(c[1],c[2],c[3])};}
function classifySeg(c,i,n,semi,short){ // c: 5 points on the Chao 1..5 scale; semi: same 5 points in semitones
  const Ss=(semi[3]+semi[4])/2-(semi[0]+semi[1])/2; // real movement in semitones (a monotone voice has ~0)
  const L=mean(c),S=(c[3]+c[4])/2-(c[0]+c[1])/2,start=(c[0]+c[1])/2,dip=Math.min(c[0],c[4])-Math.min(c[1],c[2],c[3]);
  const final=i===n-1;
  return {
    1:0.8*Math.abs(S)+0.6*Math.max(0,3.2-L),
    2:0.9*Math.max(0,0.4-S)+0.3*Math.max(0,start-4.2)+0.5*Math.max(0,0.7-Ss),
    3:0.8*Math.max(0,L-2.6)+((final&&dip>0.3)?0:0.7*Math.max(0,S-0.4)),
    4:0.9*Math.max(0,S+0.4)+0.5*Math.max(0,3.4-start)+(short?0:0.5*Math.max(0,0.7+Ss)),
  };
}


// Tone classifier: linear discriminant (shared covariance) over the syllable's own 5-point shape (Chao scale and
// semitones, both time-normalised) + its height. Trained on Bear Door native phrase cuts (normal and 0.6x slowed)
// and Edge TTS careful speech (normal and -40% rate), tones 1-4. tools/seq_fit.py rebuilds it.
const LDA={"mu":[[-0.0566,-0.0337,0.0198,0.0497,0.0207,3.8038,-0.1701,-0.0875,0.0584,0.1341,0.0646,0.087],[-0.4089,-0.2972,-0.0097,0.2818,0.434,2.8773,-1.0546,-0.7598,0.0028,0.7185,1.0939,0.1837],[0.6341,0.2588,-0.1304,-0.3349,-0.4276,2.0846,1.4353,0.5628,-0.2851,-0.7113,-1.0021,0.1064],[0.2334,0.1831,0.0492,-0.1432,-0.3225,3.4087,0.6021,0.454,0.1177,-0.3436,-0.8318,0.2075]],"Si":[[1.949,-0.0246,0.057,0.0888,0.0737,0.0011,-0.3902,-0.0136,0.1337,0.1756,0.0948,-0.0114],[-0.0246,2.0268,-0.0171,0.0711,0.0878,-0.0042,0.0058,-0.237,-0.0404,0.1373,0.1342,-0.005],[0.057,-0.0171,2.056,-0.0079,0.0559,-0.0039,0.146,-0.0238,-0.1993,-0.0324,0.1097,-0.0054],[0.0888,0.0711,-0.0079,2.0408,-0.0489,-0.0098,0.1392,0.1224,-0.0229,-0.2137,-0.0249,0.0205],[0.0737,0.0878,0.0559,-0.0489,1.9754,0.0168,0.0992,0.1519,0.129,-0.0669,-0.3138,0.0014],[0.0011,-0.0042,-0.0039,-0.0098,0.0168,0.6334,0.0614,0.0073,-0.0353,-0.0483,0.015,0.1443],[-0.3902,0.0058,0.146,0.1392,0.0992,0.0614,1.0928,-0.0438,0.3681,0.3928,0.3341,-0.0184],[-0.0136,-0.237,-0.0238,0.1224,0.1519,0.0073,-0.0438,1.5406,-0.0557,0.3044,0.3982,-0.0087],[0.1337,-0.0404,-0.1993,-0.0229,0.129,-0.0353,0.3681,-0.0557,1.6416,-0.126,0.3162,-0.0086],[0.1756,0.1373,-0.0324,-0.2137,-0.0669,-0.0483,0.3928,0.3044,-0.126,1.5835,-0.0102,0.0382],[0.0948,0.1342,0.1097,-0.0249,-0.3138,0.015,0.3341,0.3982,0.3162,-0.0102,1.1046,-0.003],[-0.0114,-0.005,-0.0054,0.0205,0.0014,0.1443,-0.0184,-0.0087,-0.0086,0.0382,-0.003,1.7139]]};
function ldaPost(c,semi,final){
  const mc=mean(c),ms=mean(semi),x=[...c.map(v=>v-mc),mc,...semi.map(v=>v-ms),final?1:0];
  const ll=LDA.mu.map(mu=>{const d=x.map((v,k)=>v-mu[k]);let q=0;for(let i=0;i<d.length;i++){let r=0;for(let j=0;j<d.length;j++)r+=LDA.Si[i][j]*d[j];q+=d[i]*r;}return -0.5*q;});
  const mx=Math.max(...ll),e=ll.map(v=>Math.exp(v-mx)),S=e.reduce((a,b)=>a+b,0);return e.map(v=>v/S);
}
// minimum evidence that the voice really moves the way the expected tone needs (catches a monotone voice)
function gate(t,c,semi,short){
  const Ss=(semi[3]+semi[4])/2-(semi[0]+semi[1])/2,L=mean(c);
  if(t===2)return Ss>=0.3;
  if(t===4)return short||Ss<=-0.3;
  if(t===3)return L<=2.6||((semi[0]+semi[1])/2-Math.min(...semi))>=0.8;
  if(t===1)return Math.abs(Ss)<2.5&&L>=2.4;
  return true;
}
export const P_OK=Number(process.env.SEQ_P_OK??0.15);

export function sequentialAnalyze({frames,target,spk}){
  const n=target.length,st=cleanPitch(frames);
  const vals=st.filter(v=>v!=null);
  if(vals.length<8)return {assessable:false,reason:'no_speech'};
  const med=pct(vals,0.5);
  let lo=pct(vals,0.05),hi=pct(vals,0.95);
  if(spk&&isFinite(spk.lo)&&isFinite(spk.hi)&&spk.hi-spk.lo>=5&&spk.hi-spk.lo<=18){lo=Math.min(lo,spk.lo);hi=Math.max(hi,spk.hi);}
  if(hi-lo<7){const m=(hi+lo)/2;lo=m-3.5;hi=m+3.5;} // flat recording: do not blow a monotone up into tones
  const toC=v=>Math.max(0.6,Math.min(5.4,1+4*(v-lo)/(hi-lo)));
  const shape=(fa,fb)=>{const vs=[];for(let k=fa;k<fb;k++)if(st[k]!=null)vs.push(st[k]);if(vs.length<4)return {vs,c:null,semi:null};
    const c0=Math.min(Math.floor(vs.length*TRIM0),5),c1=Math.min(Math.floor(vs.length*0.1),3),core=vs.length-c0-c1>=4?vs.slice(c0,vs.length-c1):vs;const semi=resample(core,5);return {vs,semi,c:semi.map(toC)};};
  const fitCost=(k,fa,fb)=>{const t=target[k].tone;if(t===5)return 0;const {vs,c,semi}=shape(fa,fb);if(!c)return 0.8;return Math.min(2,classifySeg(c,k,n,semi,vs.length<8)[t]);};
  const segs=segment(frames,st,n,fitCost);
  const syllables=target.map((s,i)=>{
    const [fa,fb]=segs[i],t0=frames[fa].t,t1=frames[Math.min(frames.length-1,fb-1)].t+0.01;
    const {vs,c,semi}=shape(fa,fb);
    const base={...s,start_ms:Math.round(t0*1000),end_ms:Math.round(t1*1000),voiced_frames:vs.length};
    if(vs.length<4){
      if(s.tone===5)return {...base,heard_tone:null,ok:true,unsure:true,verdict:'нейтральный, коротко'};
      return {...base,heard_tone:null,ok:false,unsure:true,verdict:'не слышно'};
    }
    const short=vs.length<8,p=ldaPost(c,semi,i===n-1);
    const rank=TONES.slice().sort((x,y)=>p[y-1]-p[x-1]),heard=rank[0];
    let ok,unsure=false;
    if(s.tone===5){ok=true;unsure=true;}
    else{
      const pe=p[s.tone-1];
      ok=(heard===s.tone||pe>=(short?P_OK*0.6:P_OK))&&gate(s.tone,c,semi,short);
      unsure=ok&&(heard!==s.tone||pe<0.5);
    }
    const margin=p[rank[0]-1]-p[rank[1]-1];
    return {...base,heard_tone:heard,ok,unsure,verdict:ok?(unsure?'скорее верно':'верно'):`похоже на ${heard}-й`,
      seq:{semi:semi.map(v=>+(v-mean(semi)).toFixed(2)),features:Object.fromEntries(Object.entries(features(c,semi)).map(([k,v])=>[k,+v.toFixed(3)])),contour:c.map(v=>+v.toFixed(2)),p:Object.fromEntries(TONES.map(t=>[t,+p[t-1].toFixed(3)])),margin:+margin.toFixed(3)}};
  });
  const credit=syllables.map(s=>!s.ok?0:s.unsure?0.85:1);
  const clarity=syllables.filter(s=>s.voiced_frames>=6||s.tone===5).length/n;
  const score=Math.round(100*(0.9*mean(credit)+0.1*clarity));
  const spans=segs.map(([fa,fb])=>[frames[fa].t,frames[Math.min(frames.length-1,fb-1)].t+0.01]);
  return {assessable:true,score,syllables,spans,range:{lo,hi,median:med}};
}
