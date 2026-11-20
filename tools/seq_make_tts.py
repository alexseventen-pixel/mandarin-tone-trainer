import asyncio, edge_tts, subprocess, json
P={'yuanbendanxin':'原本担心','danxinmeiyouyong':'担心没有用','meiyouyong':'没有用','meixiangdaozhezhixiong':'没想到这只熊','zhezhixiong':'这只熊','feichangdecongming':'非常的聪明','zhijiejizou':'直接就走','zouleguoqu':'走了过去','zheyangyilai':'这样一来','weilanbuhuihuaile':'围栏不会坏了'}
V={'xiaoxiao':'zh-CN-XiaoxiaoNeural','yunxi':'zh-CN-YunxiNeural'}
async def main():
  for k,t in P.items():
    for vn,v in V.items():
      for rn,r in [('n','+0%'),('s','-40%')]:
        mp=f'tts/{k}_{vn}_{rn}.mp3'
        await edge_tts.Communicate(t,v,rate=r).save(mp)
        subprocess.run(['ffmpeg','-loglevel','error','-y','-i',mp,'-ac','1','-ar','16000',mp[:-4]+'.wav'],check=True)
asyncio.run(main()); json.dump(P,open('tts/phr.json','w'),ensure_ascii=False)
