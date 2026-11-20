import json,numpy as np
R=[r for r in json.load(open('feat2.json'))]
pid=lambda r:r['id'].replace('xiaoxiao','').replace('yunxi','')
def X(r):
    c=np.array(r['c']);s=np.array(r['semi'])
    return np.concatenate([c-c.mean(),[c.mean()],s,[1.0 if r['i']==r['n']-1 else 0.0]])
def fit(rows,reg):
    Xs=np.array([X(r) for r in rows]);y=np.array([r['tone'] for r in rows])
    mu={t:Xs[y==t].mean(0) for t in (1,2,3,4)}
    S=sum(((Xs[y==t]-mu[t]).T@(Xs[y==t]-mu[t])) for t in (1,2,3,4))/len(y)
    S=S+reg*np.eye(S.shape[0])*np.trace(S)/S.shape[0]
    return mu,np.linalg.inv(S)
def post(m,r):
    mu,Si=m;x=X(r);ll=np.array([-0.5*(x-mu[t])@Si@(x-mu[t]) for t in (1,2,3,4)]);p=np.exp(ll-ll.max());return p/p.sum()
good=('tts_n','tts_s','nat','nat_slow')
for reg in [0.1,0.3,1.0]:
  for th in [0.15,0.25,0.35]:
    sc={}
    for P in sorted(set(map(pid,R))):
        m=fit([r for r in R if r['src'] in good and r.get('c') and r['tone']<5 and pid(r)!=P],reg)
        utt={}
        for r in R:
            if pid(r)!=P:continue
            key=(r['src'],r['id']);
            if r['tone']==5: cr=1
            elif not r.get('c'): cr=0
            else: p=post(m,r);cr=1 if (p.argmax()==r['tone']-1 or p[r['tone']-1]>=th) else 0
            utt.setdefault(key,[]).append(cr)
        for (src,_),v in utt.items(): sc.setdefault(src,[]).append(100*np.mean(v))
    print(reg,th,' '.join(f'{k}={np.mean(v):.0f}' for k,v in sorted(sc.items())))

def gate(r,g2=0.5,g4=0.5,g3l=2.6,g3d=0.8):
    t=r['tone'];s=np.array(r['semi']);c=np.array(r['c']);Ss=(s[3]+s[4])/2-(s[0]+s[1])/2;L=c.mean();short=r['nv']<8
    if t==2:return Ss>=g2
    if t==4:return short or Ss<=-g4
    if t==3:return L<=g3l or (s[:2].mean()-s.min())>=g3d
    if t==1:return abs(Ss)<2.5 and L>=2.4
    return True
print('--- with gates')
for reg in [1.0]:
  for th in [0.1,0.15,0.2,0.25]:
   for g in [0.3,0.5,0.8]:
    sc={}
    for P in sorted(set(map(pid,R))):
        m=fit([r for r in R if r['src'] in good and r.get('c') and r['tone']<5 and pid(r)!=P],reg)
        utt={}
        for r in R:
            if pid(r)!=P:continue
            if r['tone']==5: cr=1
            elif not r.get('c'): cr=0
            else: p=post(m,r);cr=1 if ((p.argmax()==r['tone']-1 or p[r['tone']-1]>=th) and gate(r,g,g)) else 0
            utt.setdefault((r['src'],r['id']),[]).append(cr)
        for (src,_),v in utt.items(): sc.setdefault(src,[]).append(100*np.mean(v))
    print(reg,th,g,' '.join(f'{k}={np.mean(v):.0f}' for k,v in sorted(sc.items())))
