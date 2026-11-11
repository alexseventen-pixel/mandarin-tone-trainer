#!/usr/bin/env python3
"""
make_variants.py: one-command pipeline that pre-generates "Replacement variants" for the web
Deck Inspector (inspector-only; nothing here is ever written into an Anki deck).

For every element (word, key/radical sound, phrase chunk) it makes:
  * Re-cut (her voice)          : ±80/150/250 ms re-cuts + fades from Li Pei Ru's original clip (if "recut" given)
  * TTS (edge neural, free)     : Xiaoxiao, Xiaoyi, Yunxi, Yunjian, HsiaoChen (TW), normal + slow (-20%)
  * Native library              : audio-cmn native speaker (CC BY-SA), words only, when the file exists
  * Chatterbox clone (her voice): Chatterbox Multilingual on CPU, prompt cbx/ref10.wav, seed 7,
                                  A = expressive (exag 0.5, cfg 0.5), B = calm (exag 0.35, cfg 0.3, temp 0.6)
  * ASR check                   : faster-whisper small listens to each Chatterbox clip; if it hears something
                                  else (different text AND different toned pinyin) the label gets "⚠ ASR heard …"
All outputs: mono 44.1 kHz 96k mp3, silence trimmed, loudnorm -16 LUFS (same as S1).
Then the entries are MERGED into an encrypted bundle inspector-data/<bundle>.enc (AES-256-GCM,
layout iv|tag|ciphertext, key = INSPECTOR_DATA_KEY). Existing entries of that bundle are kept.
The inspector loads every inspector-data/*-variants.enc and matches an audio file by its "clip" name.

USAGE
  # whole deck from a spec file (see tools/variant_specs/bear-p1v2-s2.json for the format)
  python3 tools/make_variants.py --spec tools/variant_specs/bear-p1v2-s2.json

  # add one or more new words quickly (key, clip file name in the deck, word, optional spoken text)
  python3 tools/make_variants.py --bundle bear-p1v2-s2-variants \
      --item 'key=bd2_xiong,clip=bd2_xiong.mp3,word=熊' \
      --item 'key=bd2_k_chuo4,clip=bd2_k_chuo4.mp3,word=辶,speak=绰'
  #   optional item fields: speak=<text to say>, src=<wav>, a=<start s>, b=<end s>  (src/a/b enable re-cuts)

  then: git add inspector-data/<bundle>.enc && git commit && git push   (Render redeploys)

OPTIONS
  --only KEY[,KEY]   process only these keys of the spec      --force   regenerate files that exist
  --no-cbx / --no-asr / --no-tts / --no-recut                  --dry     build files, do not write the bundle
  --key-file F       env-style file with INSPECTOR_DATA_KEY (used only if the env var is not set;
                     default /workspace/handoff/.inspector_secrets). The key is never printed.
ENV  CBX_PY (python with chatterbox, default /workspace/chatterbox-venv/bin/python)
     ASR_PY (python with faster_whisper, default /workspace/asr-venv/bin/python, then /tmp/fw/bin/python)
     CBX_REF (voice prompt, default /workspace/part1v2/cbx/ref10.wav)
"""
import argparse, asyncio, base64, json, os, re, subprocess, sys, tempfile, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'inspector-data')
VOICES = [('zh-CN-XiaoxiaoNeural', 'Xiaoxiao (F)'), ('zh-CN-XiaoyiNeural', 'Xiaoyi (F)'), ('zh-CN-YunxiNeural', 'Yunxi (M)'),
          ('zh-CN-YunjianNeural', 'Yunjian (M)'), ('zh-TW-HsiaoChenNeural', 'HsiaoChen (F, Taiwan)')]
POST = ('silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,'
        'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse,'
        'loudnorm=I=-16:TP=-1.5:LRA=11,adelay=80,apad=pad_dur=0.15')
CBX = {'a': ('expressive (exag 0.5, cfg 0.5)', dict(exaggeration=0.5, cfg_weight=0.5)),
       'b': ('calm (exag 0.35, cfg 0.3)', dict(exaggeration=0.35, cfg_weight=0.3, temperature=0.6))}
G_RECUT, G_TTS, G_LIB, G_CBX = 'Re-cut (her voice)', 'TTS (edge neural, free)', 'Native library', 'Chatterbox clone (her voice)'


def hz(s):
    return ''.join(re.findall(r'[\u3400-\u9fff]', s))


def ff(i, o, pre=(), af=POST):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *pre, '-i', i, '-af', af, '-ar', '44100', '-ac', '1', '-b:a', '96k', o], check=True)


def need(path, force):
    return force or not os.path.exists(path) or os.path.getsize(path) == 0


def load_key(key_file):
    k = os.environ.get('INSPECTOR_DATA_KEY', '')
    if not k and key_file and os.path.exists(key_file):
        for line in open(key_file):
            if line.strip().startswith('INSPECTOR_DATA_KEY='):
                k = line.strip().split('=', 1)[1].strip().strip('"\'')
    if not k:
        sys.exit('INSPECTOR_DATA_KEY not set (env or --key-file)')
    return bytes.fromhex(k)


def dec(path, key):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    b = open(path, 'rb').read()
    return json.loads(AESGCM(key).decrypt(b[:12], b[28:] + b[12:28], None))


def enc(obj, path, key):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    iv = os.urandom(12)
    ct = AESGCM(key).encrypt(iv, json.dumps(obj, ensure_ascii=False).encode(), None)
    tmp = path + '.tmp'
    open(tmp, 'wb').write(iv + ct[-16:] + ct[:-16])
    os.replace(tmp, path)


def recuts(it, d, force):
    out = []
    r = it.get('recut')
    if not r:
        return out
    for pad in (0.08, 0.15, 0.25):
        o = f'{d}/recut_{int(pad*1000)}.mp3'
        st = max(0, r['a'] - pad); du = r['b'] + pad - st
        if need(o, force):
            ff(r['src'], o, ['-ss', f'{st:.3f}', '-t', f'{du:.3f}'],
               f'afade=t=in:d=0.03,afade=t=out:st={du-0.05:.3f}:d=0.05,loudnorm=I=-16:TP=-1.5,apad=pad_dur=0.12')
        out.append(dict(id=f'recut_{int(pad*1000)}', group=G_RECUT, label=f'Re-cut ±{int(pad*1000)} ms + fades', file=o))
    return out


def tts(it, d, force):
    import edge_tts
    out, sp, w = [], it['speak'], it['word']
    for v, nm in VOICES:
        for rate, rl in (('+0%', 'normal'), ('-20%', 'slow')):
            o = f'{d}/tts_{v.split("-")[2][:-6].lower()}_{rl}.mp3'
            if need(o, force):
                with tempfile.NamedTemporaryFile(suffix='.mp3') as t:
                    for tries in range(3):
                        try:
                            asyncio.run(edge_tts.Communicate(sp, v, rate=rate).save(t.name)); break
                        except Exception:
                            if tries == 2: raise
                    ff(t.name, o)
            out.append(dict(id=os.path.basename(o)[:-4], group=G_TTS,
                            label=f'{nm} · {rl}' + (f' · says “{sp}”' if hz(sp) != hz(w) else ''), file=o))
    return out


def audiocmn(it, d, force):
    if not it.get('audiocmn', True) or not re.fullmatch(r'[\u3400-\u9fff]{1,4}', it['word']):
        return []
    o = f'{d}/audiocmn.mp3'
    if need(o, force):
        try:
            with tempfile.NamedTemporaryFile(suffix='.mp3') as t:
                urllib.request.urlretrieve('https://raw.githubusercontent.com/hugolpz/audio-cmn/master/96k/hsk/' +
                                           urllib.parse.quote(f'cmn-{it["word"]}.mp3'), t.name)
                ff(t.name, o)
        except Exception:
            return []
    return [dict(id='audiocmn', group=G_LIB, label='audio-cmn native speaker (CC BY-SA)', file=o)]


CBX_WORKER = r'''
import sys,json,torch,torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
jobs=json.load(open(sys.argv[1]));S=json.loads(sys.argv[2]);ref=sys.argv[3]
m=ChatterboxMultilingualTTS.from_pretrained(device='cpu')
for text,s,out,limit in jobs:
    best=None
    for seed in (7,11,23,42):   # seed 7 like S1; retry when the clone babbles on far past the text
        torch.manual_seed(seed);w=m.generate(text if text[-1] in '。！？' else text+'。',language_id='zh',audio_prompt_path=ref,**S[s])
        d=w.shape[-1]/m.sr
        if best is None or d<best[1]: best=(w,d,seed)
        if d<=limit: break
    ta.save(out,best[0],m.sr);open(out+'.seed','w').write(str(best[2]));print('cbx',out,round(best[1],2),'s seed',best[2],flush=True)
'''

ASR_WORKER = r'''
import sys,json,subprocess,numpy as np
from faster_whisper import WhisperModel
L=lambda f:np.frombuffer(subprocess.run(['ffmpeg','-v','quiet','-i',f,'-ac','1','-ar','16000','-f','f32le','-'],capture_output=True).stdout,np.float32)
m=WhisperModel('small',device='cpu',compute_type='int8');res={}
for f in json.load(open(sys.argv[1])):
    s,_=m.transcribe(L(f),language='zh',beam_size=5,initial_prompt='以下是普通话词语。');res[f]=''.join(x.text for x in s)
json.dump(res,open(sys.argv[2],'w'),ensure_ascii=False)
'''


def dur(f):
    try:
        return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f],
                                    capture_output=True, text=True).stdout.strip())
    except ValueError:
        return 0.0


def max_len(text):
    # plausible length of a Chatterbox clip (s): ~0.5 s per syllable + lead-in/out
    return 0.5 * len(re.findall(r'[\u3400-\u9fff]', text)) + 1.6


def first_py(*cands):
    for c in cands:
        if c and os.path.exists(c):
            return c
    return None


def run_cbx(items, outdir, force):
    py = first_py(os.environ.get('CBX_PY'), '/workspace/chatterbox-venv/bin/python')
    if not py:
        print('!! no chatterbox python (set CBX_PY); skipping clones'); return
    ref = os.environ.get('CBX_REF', '/workspace/part1v2/cbx/ref10.wav')
    jobs = []
    for it in items:
        lim = max_len(it['speak'])
        for s in CBX:
            w = f'{outdir}/{it["key"]}/cbx_{s}.wav'
            # (re)generate when missing, forced, or too long and not yet retried with other seeds
            if need(w, force) or (dur(w) > lim and not os.path.exists(w + '.seed')):
                jobs.append((it['speak'], s, w, lim))
    if not jobs:
        return
    print(f'chatterbox: {len(jobs)} clips (CPU, ~5-30 s each)', flush=True)
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as jf, \
         tempfile.NamedTemporaryFile('w', suffix='.py', delete=False) as wf:
        json.dump(jobs, jf, ensure_ascii=False); wf.write(CBX_WORKER)
    subprocess.run([py, wf.name, jf.name, json.dumps({k: v[1] for k, v in CBX.items()}), ref], check=True,
                   stderr=subprocess.DEVNULL)


def run_asr(files, cache_path):
    cache = json.load(open(cache_path)) if os.path.exists(cache_path) else {}
    sig = lambda f: f'{f}|{os.path.getmtime(f):.0f}'
    todo = [f for f in files if sig(f) not in cache]
    if todo:
        cache.update({sig(f): h for f, h in _asr(todo).items()})
        json.dump(cache, open(cache_path, 'w'), ensure_ascii=False, indent=0)
    return {f: cache[sig(f)] for f in files if sig(f) in cache}


def _asr(files):
    py = first_py(os.environ.get('ASR_PY'), '/workspace/asr-venv/bin/python', '/tmp/fw/bin/python')
    if not py or not files:
        print('!! ASR skipped (no faster_whisper python, set ASR_PY)' if not py else ''); return {}
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as jf, \
         tempfile.NamedTemporaryFile('w', suffix='.py', delete=False) as wf:
        json.dump(files, jf); wf.write(ASR_WORKER)
    out = jf.name + '.out'
    subprocess.run([py, wf.name, jf.name, out], check=True, stderr=subprocess.DEVNULL)
    return json.load(open(out))


def asr_ok(expected, heard):
    digits = str.maketrans('0123456789', '零一二三四五六七八九')
    cj = lambda s: ''.join(re.findall(r'[\u3400-\u9fff]', s.translate(digits)))
    e, h = cj(expected), cj(heard)
    if e == h:
        return True
    try:
        from pypinyin import lazy_pinyin, Style
        return bool(h) and lazy_pinyin(e, style=Style.TONE3) == lazy_pinyin(h, style=Style.TONE3)
    except ImportError:
        return False


def parse_item(s):
    d = dict(p.split('=', 1) for p in s.split(','))
    it = dict(key=d['key'], clip=d['clip'], word=d['word'], speak=d.get('speak', d['word']))
    if 'src' in d:
        it['recut'] = dict(src=d['src'], a=float(d['a']), b=float(d['b']))
    return it


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--spec'); ap.add_argument('--item', action='append', default=[])
    ap.add_argument('--bundle'); ap.add_argument('--out-dir'); ap.add_argument('--only')
    ap.add_argument('--force', action='store_true'); ap.add_argument('--dry', action='store_true')
    for f in ('cbx', 'asr', 'tts', 'recut'):
        ap.add_argument(f'--no-{f}', action='store_true')
    ap.add_argument('--key-file', default='/workspace/handoff/.inspector_secrets')
    a = ap.parse_args()
    spec = json.load(open(a.spec)) if a.spec else {}
    items = spec.get('items', []) + [parse_item(s) for s in a.item]
    bundle = a.bundle or spec.get('bundle') or sys.exit('--bundle (or "bundle" in the spec) is required')
    if not bundle.endswith('-variants'):
        sys.exit('bundle id must end with "-variants" so the inspector picks it up')
    outdir = a.out_dir or spec.get('out_dir') or f'/workspace/variants/{bundle}'
    if a.only:
        keep = set(a.only.split(',')); items = [i for i in items if i['key'] in keep]
    for it in items:
        it.setdefault('speak', it['word'])
    if not items:
        sys.exit('no items')
    key = None if a.dry else load_key(a.key_file)  # check the key before the long run
    man = {}
    for it in items:
        d = f'{outdir}/{it["key"]}'; os.makedirs(d, exist_ok=True)
        V = ([] if a.no_recut else recuts(it, d, a.force)) + ([] if a.no_tts else tts(it, d, a.force)) + audiocmn(it, d, a.force)
        man[it['key']] = dict(word=it['word'], clip=it['clip'], variants=V)
        print(it['key'], it['word'], len(V), 'variants (before clones)', flush=True)
    flags = {}
    if not a.no_cbx:
        run_cbx(items, outdir, a.force)
        mp3s = []
        for it in items:
            for s in CBX:
                w = f'{outdir}/{it["key"]}/cbx_{s}.wav'; o = w[:-4] + '.mp3'
                if os.path.exists(w):
                    if need(o, a.force) or os.path.getmtime(o) < os.path.getmtime(w):
                        ff(w, o)
                    mp3s.append(o)
        heard = {} if a.no_asr else run_asr(mp3s, f'{outdir}/asr_cache.json')
        for it in items:
            for s, (lab, _) in CBX.items():
                o = f'{outdir}/{it["key"]}/cbx_{s}.mp3'
                if o not in mp3s:
                    continue
                h = heard.get(o)
                warn = '' if h is None or asr_ok(it['speak'], h) or asr_ok(it['word'], h) else f' ⚠ ASR heard {h.strip() or "(nothing)"}'
                if dur(o) > max_len(it['speak']) + 0.4:
                    warn += f' ⚠ long ({dur(o):.1f} s, may ramble)'
                if warn:
                    flags[f'{it["key"]}_{s}'] = warn.strip()
                man[it['key']]['variants'].append(dict(id=f'cbx_{s}', group=G_CBX, label=f'Chatterbox · {lab}{warn}', file=o))
    # manifest (file paths, no audio) next to the clips
    mpath = f'{outdir}/manifest.json'
    old = json.load(open(mpath)) if os.path.exists(mpath) else {}
    old.update(man); json.dump(old, open(mpath, 'w'), ensure_ascii=False, indent=1)
    json.dump(dict(bundle=bundle, asr_flags=flags, counts={k: len(m['variants']) for k, m in man.items()}),
              open(f'{outdir}/report_{bundle}.json', 'w'), ensure_ascii=False, indent=1)
    print('ASR flags:', json.dumps(flags, ensure_ascii=False))
    if a.dry:
        return
    path = os.path.join(DATA, bundle + '.enc')
    B = dec(path, key) if os.path.exists(path) else {}
    clips = {m['clip']: k for k, m in B.items()}
    for k, m in man.items():
        if m['clip'] in clips and clips[m['clip']] != k:
            print(f'!! clip {m["clip"]} already used by key {clips[m["clip"]]} in this bundle; replacing it'); B.pop(clips[m['clip']], None)
        B[k] = dict(word=m['word'], clip=m['clip'], variants=[
            {x2: y for x2, y in x.items() if x2 != 'file'} | {'b64': base64.b64encode(open(x['file'], 'rb').read()).decode()}
            for x in m['variants'] if os.path.exists(x['file'])])
    enc(B, path, key)
    print(f'bundle {bundle}: {len(B)} entries, {sum(len(m["variants"]) for m in B.values())} variants, '
          f'{os.path.getsize(path)/1e6:.1f} MB -> {path}')


if __name__ == '__main__':
    main()
