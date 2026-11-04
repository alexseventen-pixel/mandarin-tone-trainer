# Builds replacement variants for Part 1 word clips -> variants/<key>/*.mp3 + encrypted bundle inspector-data/bear-p1v2-variants.enc
import json,subprocess,os,asyncio,base64,urllib.request,urllib.parse,edge_tts
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
SRC='/workspace/mtt-anki/public/lessons/video-1-li-pei-ru/'
ts=json.load(open('/workspace/anki-proto/ts.json'))
# key: word, sentence, token index range in ts
W={'fuqi':('夫妻',1,2,3),'yidui':('一对',1,0,1),'pa':('怕',1,4,4),'xiong':('熊',1,5,5),'pohuai':('破坏',1,6,7),'yuanzi':('院子',1,8,9),
 'li':('里',1,10,10),'de':('的',1,11,11),'weilan':('围栏',1,12,13),'anzhuang':('安装',2,0,1),'yige':('一个',2,3,3),'men':('门',2,5,5),'xiongmen':('熊门',2,4,5)}
V=[('zh-CN-XiaoxiaoNeural','Xiaoxiao (F)'),('zh-CN-XiaoyiNeural','Xiaoyi (F)'),('zh-CN-YunxiNeural','Yunxi (M)'),('zh-CN-YunjianNeural','Yunjian (M)'),('zh-TW-HsiaoChenNeural','HsiaoChen (F, Taiwan)')]
POST='silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse,loudnorm=I=-16:TP=-1.5:LRA=11,adelay=80,apad=pad_dur=0.15'
def ff(i,o,pre=[],af=POST): subprocess.run(['ffmpeg','-v','error','-y',*pre,'-i',i,'-af',af,'-ar','44100','-ac','1','-b:a','96k',o],check=True)
async def tts(t,v,r,o): await edge_tts.Communicate(t,v,rate=r).save(o)
man={}
for k,(w,s,i0,i1) in W.items():
    d=f'variants/{k}';os.makedirs(d,exist_ok=True);L=[];seg=ts[str(s)];a,b=seg[i0][1],seg[i1][2]
    for pad in (0.08,0.15):
        o=f'{d}/recut_{int(pad*1000)}.mp3';st=max(0,a-pad);du=b+pad-st
        ff(SRC+f'sentence-{s:02d}.wav',o,['-ss',f'{st:.3f}','-t',f'{du:.3f}'],f'afade=t=in:d=0.03,afade=t=out:st={du-0.05:.3f}:d=0.05,loudnorm=I=-16:TP=-1.5,apad=pad_dur=0.12')
        L.append(dict(id=f'recut_{int(pad*1000)}',group='Re-cut (her voice)',label=f'Re-cut ±{int(pad*1000)} ms + fades',file=o))
    for v,nm in V:
        for r,rl in (('+0%','normal'),('-20%','slow')):
            raw=f'/tmp/{k}_{v}_{rl}.mp3';asyncio.run(tts(w,v,r,raw));o=f'{d}/tts_{v.split("-")[2][:-6].lower()}_{rl}.mp3';ff(raw,o)
            L.append(dict(id=os.path.basename(o)[:-4],group='TTS (edge neural, free)',label=f'{nm} · {rl}',file=o))
    try:
        raw=f'/tmp/cmn_{k}.mp3';urllib.request.urlretrieve('https://raw.githubusercontent.com/hugolpz/audio-cmn/master/96k/hsk/'+urllib.parse.quote(f'cmn-{w}.mp3'),raw)
        o=f'{d}/audiocmn.mp3';ff(raw,o);L.append(dict(id='audiocmn',group='Native library',label='audio-cmn native speaker (CC BY-SA)',file=o))
    except Exception as e: print(k,'no audio-cmn',e)
    man[k]=dict(word=w,clip=f'bd1_{k}.mp3',variants=L);print(k,len(L))
json.dump(man,open('variants/manifest.json','w'),ensure_ascii=False,indent=1)
key=bytes.fromhex(os.environ['INSPECTOR_DATA_KEY"])
bundle={k:{**m,'variants':[{**x,'b64':base64.b64encode(open(x['file'],'rb').read()).decode()} for x in m['variants']]} for k,m in man.items()}
iv=os.urandom(12);ct=AESGCM(key).encrypt(iv,json.dumps(bundle,ensure_ascii=False).encode(),None)
open('/workspace/mtt-anki/inspector-data/bear-p1v2-variants.enc','wb').write(iv+ct[-16:]+ct[:-16])
