# adds dictionary (CC-CEDICT) entries and alternative pictures (Round 1 deck art) to the encrypted variants bundle
import json,os,base64,re
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
man=json.load(open('variants/manifest.json'))
ced={}
for l in open('/workspace/anki-proto/cedict_ts.u8',encoding='utf8'):
  if l.startswith('#'):continue
  m=re.match(r'(\S+) (\S+) \[([^\]]+)\] /(.*)/',l)
  if m: ced.setdefault(m.group(2),[]).append(dict(py=m.group(3),defs=[d for d in m.group(4).split('/') if d]))
ALT={'xiong':1,'men':2,'yuanzi':3,'li':4,'weilan':5,'fuqi':6,'pa':7,'pohuai':17,'anzhuang':18,'yidui':29,'yige':30}
key=bytes.fromhex(os.environ['INSPECTOR_DATA_KEY'])
b={}
for k,m in man.items():
  e=dict(m);e['variants']=[{**x,'b64':base64.b64encode(open(x['file'],'rb').read()).decode()} for x in m['variants']]
  e['dict']=ced.get(m['word'],[]) or [dict(py='',defs=['(not in CC-CEDICT) '+'; '.join(d for c in m['word'] for x in ced.get(c,[])[:1] for d in x['defs'][:2])])]
  e['pictures']=[]
  if k in ALT:
    p=f'/workspace/anki-proto/r1media/lprbd_w{ALT[k]:02d}.jpg'
    if os.path.exists(p): e['pictures'].append(dict(id='r1',label='Round 1 picture',name=f'bd1_{k}_r1.jpg',b64=base64.b64encode(open(p,'rb').read()).decode()))
  b[k]=e;print(k,len(e['dict']),len(e['pictures']))
iv=os.urandom(12);ct=AESGCM(key).encrypt(iv,json.dumps(b,ensure_ascii=False).encode(),None)
open('/workspace/mtt-anki/inspector-data/bear-p1v2-variants.enc','wb').write(iv+ct[-16:]+ct[:-16])
