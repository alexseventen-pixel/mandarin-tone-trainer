import os,json,zipfile,io,sqlite3,base64,subprocess,time,re,shutil
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
K=bytes.fromhex(os.environ['INSPECTOR_DATA_KEY'])
def dec(p):b=open(p,'rb').read();return AESGCM(K).decrypt(b[:12],b[28:]+b[12:28],None)
R='/workspace/mtt-anki/inspector-data/'
deck=zipfile.ZipFile(io.BytesIO(dec(R+'bear-p1v2.enc')));var=json.loads(dec(R+'bear-p1v2-variants.enc'))
ed=json.load(open('/workspace/part1v2/edits_oleg_1104.json'))['edits']
mm=json.loads(deck.read('media'));inv={v:k for k,v in mm.items()}
cf='collection.anki21' if 'collection.anki21' in deck.namelist() else 'collection.anki2'
W='/tmp/v3/w';shutil.rmtree(W,True);os.makedirs(W)
open(W+'/col','wb').write(deck.read(cf));db=sqlite3.connect(W+'/col')
stamp=format(int(time.time()*1000),'x')[-5:];new={};ren={}
def ff(args,inp):
    src=W+'/in';open(src,'wb').write(inp);out=W+'/out.mp3'
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',src]+args+['-ac','1','-ar','44100','-b:a','128k',out],check=True);return open(out,'rb').read()
for a,e in ed.items():
    orig=deck.read(inv[a])
    if e['op']=='trim':
        open(W+'/p','wb').write(orig);dur=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',W+'/p'],capture_output=True,text=True).stdout);end=min(e['end'],dur);d=end-e['start'];e=dict(e,end=end);data=ff(['-af',f"atrim={e['start']}:{e['end']},asetpts=N/SR/TB,afade=t=in:d=0.008,areverse,afade=t=in:d=0.008,areverse"],orig)
    else:
        key=next(k for k,v in var.items() if v.get('clip')==a or k==a or k==a[4:-4])
        v=next(x for x in var[key]['variants'] if x['id']==e['variant']);data=ff(['-af','afade=t=in:d=0.008,areverse,afade=t=in:d=0.008,areverse'],base64.b64decode(v['b64']))
    ren[a]=a[:-4]+'_fix'+stamp+'.mp3';new[inv[a]]=data
now=int(time.time())
for nid,f in db.execute('select id,flds from notes').fetchall():
    g=f
    for a,b in ren.items():g=g.replace('[sound:'+a+']','[sound:'+b+']');g='\x1f'.join(b if x==a else x for x in g.split('\x1f'))
    if g!=f:db.execute('update notes set flds=?,mod=?,usn=-1 where id=?',(g,now,nid))
db.commit();db.close()
out='/workspace/part1v2/BearDoor_Part1_S1_v3.apkg';z=zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED);nm={}
for n in deck.namelist():
    if n in('media',cf):continue
    z.writestr(n,new.get(n,deck.read(n)));nm[n]=ren.get(mm.get(n),mm.get(n))
z.write(W+'/col',cf);z.writestr('media',json.dumps(nm));z.close();print(out,stamp,cf)
