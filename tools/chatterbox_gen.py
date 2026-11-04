import sys,torch,torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
m=ChatterboxMultilingualTTS.from_pretrained(device='cpu')
W=dict(fuqi='夫妻',yidui='一对',pa='怕',xiong='熊',pohuai='破坏',yuanzi='院子',li='里',de='的',weilan='围栏',anzhuang='安装',yige='一个',men='门',xiongmen='熊门')
ks=sys.argv[1].split(',') if len(sys.argv)>1 else list(W)
S={'a':dict(exaggeration=0.5,cfg_weight=0.5),'b':dict(exaggeration=0.35,cfg_weight=0.3,temperature=0.6)}
for k in ks:
  for s,kw in S.items():
    torch.manual_seed(7);w=m.generate(W[k]+'。',language_id='zh',audio_prompt_path='cbx/ref10.wav',**kw)
    ta.save(f'cbx/{k}_{s}.wav',w,m.sr);print(k,s,flush=True)
