# Extends variants bundle: 了, 安装了, all radicals; adds Chatterbox wavs from cbx2; re-encrypts.
import json,os,asyncio,base64,glob,sys
sys.path.insert(0,'/workspace/mtt-anki/tools')
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import subprocess,edge_tts
SRC='/workspace/mtt-anki/public/lessons/video-1-li-pei-ru/';ts=json.load(open('/workspace/anki-proto/ts.json'))
POST='silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse,loudnorm=I=-16:TP=-1.5:LRA=11,adelay=80,apad=pad_dur=0.15'
def ff(i,o,pre=[],af=POST): subprocess.run(['ffmpeg','-v','error','-y',*pre,'-i',i,'-af',af,'-ar','44100','-ac','1','-b:a','96k',o],check=True)
V=[('zh-CN-XiaoxiaoNeural','Xiaoxiao (F)'),('zh-CN-XiaoyiNeural','Xiaoyi (F)'),('zh-CN-YunxiNeural','Yunxi (M)'),('zh-CN-YunjianNeural','Yunjian (M)'),('zh-TW-HsiaoChenNeural','HsiaoChen (F, Taiwan)')]
man=json.load(open('variants/manifest.json'))
NEW={'le':('了','了',2,2,2,'bd1_le.mp3'),'anzhuangle':('安装了','安装了',2,0,2,'bd1_x_wr_5b8988c54e86.mp3')}
for k,r in json.load(open('cbx2/radicals.json')).items(): NEW[k]=(r['char'],r['speak'],None,0,0,r['clip'])
for k,(w,sp,s,i0,i1,clip) in NEW.items():
    if 'skipbuild' in sys.argv and k in man: continue
    d=f'variants/{k}';os.makedirs(d,exist_ok=True);L=[]
    if s:
        seg=ts[str(s)];a,b=seg[i0][1],seg[i1][2]
        for pad in (0.08,0.15,0.25):
            o=f'{d}/recut_{int(pad*1000)}.mp3';st=max(0,a-pad);du=b+pad-st
            ff(SRC+f'sentence-{s:02d}.wav',o,['-ss',f'{st:.3f}','-t',f'{du:.3f}'],f'afade=t=in:d=0.03,afade=t=out:st={du-0.05:.3f}:d=0.05,loudnorm=I=-16:TP=-1.5,apad=pad_dur=0.12')
            L.append(dict(id=f'recut_{int(pad*1000)}',group='Re-cut (her voice)',label=f'Re-cut ±{int(pad*1000)} ms + fades',file=o))
    for v,nm in V:
        for r,rl in (('+0%','normal'),('-20%','slow')):
            raw=f'/tmp/{k}_{v}_{rl}.mp3';asyncio.run(edge_tts.Communicate(sp,v,rate=r).save(raw));o=f'{d}/tts_{v.split("-")[2][:-6].lower()}_{rl}.mp3';ff(raw,o)
            L.append(dict(id=os.path.basename(o)[:-4],group='TTS (edge neural, free)',label=f'{nm} · {rl}'+(f' · says “{sp}”' if sp!=w else ''),file=o))
    man[k]=dict(word=w,clip=clip,variants=L);print(k,len(L),flush=True)
# chatterbox
for f in sorted(glob.glob('cbx2/*_[ab].wav')):
    b=os.path.basename(f)[:-4];k,st=b.rsplit('_',1)
    if k not in man: continue
    o=f'variants/{k}/cbx_{st}.mp3';ff(f,o);vid=f'cbx_{st}'
    man[k]['variants']=[x for x in man[k]['variants'] if x['id']!=vid]+[dict(id=vid,group='Voice clone · Chatterbox (open source, free)',label=f'Li Pei Ru clone · Chatterbox {st.upper()}',file=o)]
json.dump(man,open('variants/manifest.json','w'),ensure_ascii=False,indent=1)
key=bytes.fromhex(os.environ['INSPECTOR_DATA_KEY'])
bundle={k:{**m,'variants':[{**x,'b64':base64.b64encode(open(x['file'],'rb').read()).decode()} for x in m['variants'] if os.path.exists(x['file'])]} for k,m in man.items()}
for m in bundle.values():
    for x in m['variants']: x.pop('file',None)
iv=os.urandom(12);ct=AESGCM(key).encrypt(iv,json.dumps(bundle,ensure_ascii=False).encode(),None)
open('/workspace/mtt-anki/inspector-data/bear-p1v2-variants.enc','wb').write(iv+ct[-16:]+ct[:-16]);print('bundle',len(bundle),sum(len(m['variants']) for m in bundle.values()))
