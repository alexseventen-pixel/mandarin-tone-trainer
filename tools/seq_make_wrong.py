import parselmouth,glob
from parselmouth.praat import call
def manip(src,fn,out):
    snd=parselmouth.Sound(src);m=call(snd,"To Manipulation",0.01,75,600);pt=call(m,"Extract pitch tier")
    n=call(pt,"Get number of points");pts=[(call(pt,"Get time from index",i),call(pt,"Get value at index",i)) for i in range(1,n+1)]
    med=sorted(v for _,v in pts)[len(pts)//2];call(pt,"Remove points between",0,snd.duration)
    for t,v in pts: call(pt,"Add point",t,fn(v,med))
    call([pt,m],"Replace pitch tier");call(m,"Get resynthesis (overlap-add)").save(out,'WAV')
for f in glob.glob('tts/*_[ns].wav'):
    manip(f,lambda v,m:m*m/v,f[:-4]+'_inv.wav'); manip(f,lambda v,m:m,f[:-4]+'_flat.wav')
