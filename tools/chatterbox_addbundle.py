import json,os,base64,shutil
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
man=json.load(open('variants/manifest.json'))
ASR={'de_a':'到','de_b':'得','li_a':'(nothing)','li_b':'离','pa_a':'啪','weilan_a':'伟兰','weilan_b':'为蓝','yidui_b':'遗对'}
LAB={'a':'expressive (exag 0.5, cfg 0.5)','b':'calm (exag 0.35, cfg 0.3)'}
for k,m in man.items():
  m['variants']=[x for x in m['variants'] if not x['id'].startswith('cbx_')]
  for s in 'ab':
    o=f'variants/{k}/cbx_{s}.mp3';shutil.copy(f'cbx/{k}_{s}.mp3',o)
    w=f' ⚠ ASR heard {ASR[k+"_"+s]}' if k+'_'+s in ASR else ''
    m['variants'].append(dict(id=f'cbx_{s}',group='Chatterbox clone (her voice)',label='Chatterbox · '+LAB[s]+w,file=o))
json.dump(man,open('variants/manifest.json','w'),ensure_ascii=False,indent=1)
key=bytes.fromhex(os.environ['INSPECTOR_DATA_KEY'])
b={k:{**m,'variants':[{**x,'b64':base64.b64encode(open(x['file'],'rb').read()).decode()} for x in m['variants']]} for k,m in man.items()}
iv=os.urandom(12);ct=AESGCM(key).encrypt(iv,json.dumps(b,ensure_ascii=False).encode(),None)
open('/workspace/mtt-anki/inspector-data/bear-p1v2-variants.enc','wb').write(iv+ct[-16:]+ct[:-16])
print({k:len(m['variants']) for k,m in man.items()})
