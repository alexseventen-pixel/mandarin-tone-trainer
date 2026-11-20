// Builds public/tone-test/samples.json + copies native audio for the speed-free scoring test page.
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { nativeContour } from '../server/anki/analyze.js';
const S=[
 ['bd2_x_zhezhixiong','这只熊','zhè zhī xióng','this bear','/workspace/part1v2/s2/media'],
 ['bd2_x_meiyouyong','没有用','méiyǒu yòng','it was no use','/workspace/part1v2/s2/media'],
 ['bd2_x_yuanbendanxin','原本担心','yuánběn dānxīn','at first (I) worried','/workspace/part1v2/s2/media'],
 ['bd2_x_danxinmeiyouyong','担心没有用','dānxīn méiyǒu yòng','worrying was no use','/workspace/part1v2/s2/media'],
 ['bd2_x_meixiangdaozhezhixiong','没想到这只熊','méi xiǎngdào zhè zhī xióng','unexpectedly, this bear','/workspace/part1v2/s2/media'],
 ['bd2_x_feichangdecongming','非常的聪明','fēicháng de cōngmíng','is very clever','/workspace/part1v2/s2/media'],
 ['bd3_x_zhijiejizou','直接就走','zhíjiē jiù zǒu','just walked straight','/workspace/deck_review/s3/media'],
 ['bd3_x_zouleguoqu','走了过去','zǒule guòqù','walked over','/workspace/deck_review/s3/media'],
 ['bd4_x_zheyangyilai','这样一来','zhèyàng yìlái','this way','/workspace/deck_review/s4/media'],
 ['bd4_x_buhuihuaile','不会坏了','bú huì huài le','won\u2019t break','/workspace/deck_review/s4/media'],
];
const out=[];
for(const [id,hz,py,en,dir] of S){
  copyFileSync(`${dir}/${id}.mp3`,`public/tone-test/${id}.mp3`);
  const wav=execFileSync('ffmpeg',['-loglevel','error','-i',`${dir}/${id}.mp3`,'-ac','1','-ar','16000','-f','wav','-'],{maxBuffer:5e7});
  const nat=nativeContour(wav,hz);out.push({id,hanzi:hz,pinyin:py,en,audio:`${id}.mp3`,nat:{...nat,a:`${id}.mp3`}});
}
writeFileSync('public/tone-test/samples.json',JSON.stringify(out));console.log(out.length,'samples');
