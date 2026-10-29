import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, normalize } from 'node:path';
import { config } from './config.js';
import { assessWithTonePerfect } from './providers/toneperfect.js';
import { assessWithCrepe } from './providers/crepe.js';
import { pinyin } from 'pinyin-pro';
import { analyze as analyzeAnki } from './anki/analyze.js';
import { answer as answerAnki } from './anki/answer.js';

const publicDir=new URL('../public/',import.meta.url);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.wav':'audio/wav','.m4a':'audio/mp4','.mp4':'video/mp4'};

function sendJson(response,status,data){
  response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  response.end(JSON.stringify(data));
}

async function readJson(request){
  const chunks=[];let size=0;
  for await(const chunk of request){
    size+=chunk.length;
    if(size>15_000_000)throw new Error('Recording is too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function handleAssessment(request,response){
  try{
    const body=await readJson(request);
    if(typeof body.audioBase64!=='string'||typeof body.text!=='string'||typeof body.pinyin!=='string'||!['toneperfect','crepe'].includes(body.provider))return sendJson(response,400,{error:'Invalid recording payload or provider'});
    const input={audio:Buffer.from(body.audioBase64,'base64'),text:body.text,pinyin:body.pinyin};
    if(!input.audio.length||input.audio.length>10_000_000||input.text.length>200||input.pinyin.length>500)return sendJson(response,400,{error:'Check the recording and text'});
    const data=body.provider==='crepe'?await assessWithCrepe(input,config):await assessWithTonePerfect(input,config);
    sendJson(response,200,data);
  }catch(error){
    sendJson(response,502,{error:error.message||'Assessment failed'});
  }
}

async function handlePrepare(request,response){
  try{
    const {text}=await readJson(request);
    if(typeof text!=='string'||text.length>200)return sendJson(response,400,{error:'Enter a short Chinese sentence'});
    const characters=[...text].filter(char=>/\p{Script=Han}/u.test(char));
    if(!characters.length)return sendJson(response,400,{error:'No Chinese characters found'});
    const citation=pinyin(text,{toneType:'num',type:'array',nonZh:'removed',toneSandhi:false});
    const spoken=pinyin(text,{toneType:'num',type:'array',nonZh:'removed',toneSandhi:{yi:true,bu:true,thirdTone:true}});
    const marked=pinyin(text,{toneType:'symbol',type:'array',nonZh:'removed',toneSandhi:{yi:true,bu:true,thirdTone:true}});
    if(citation.length!==characters.length||spoken.length!==characters.length)return sendJson(response,422,{error:'Could not align every character with pinyin'});
    const syllables=characters.map((character,index)=>{
      const base=citation[index].replace(/[0-5]$/,'');
      const lexical=Number(citation[index].match(/[0-5]$/)?.[0]||5)||5;
      const surface=Number(spoken[index].match(/[0-5]$/)?.[0]||5)||5;
      let rule=null;
      if(lexical!==surface){
        if(character==='一')rule=`一 changes from tone ${lexical} to tone ${surface} in this context`;
        else if(character==='不')rule=`不 changes from tone ${lexical} to tone ${surface} before a fourth tone`;
        else if(lexical===3&&surface===2)rule='Third-tone sandhi: 3 + 3 is pronounced 2 + 3';
        else rule=`Context changes tone ${lexical} to tone ${surface}`;
      }
      return {character,pinyin:marked[index],numbered:`${base}${surface}`,lexical_tone:lexical,surface_tone:surface,rule};
    });
    sendJson(response,200,{text,display_pinyin:marked.join(' '),numbered_pinyin:spoken.map(value=>value.replace(/0$/,'5')).join(' '),syllables,rules:syllables.filter(item=>item.rule).map(item=>item.rule)});
  }catch(error){sendJson(response,400,{error:error.message||'Could not prepare the sentence'});}
}

const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Anki-Token','Access-Control-Max-Age':'86400'};
// POST /api/anki/analyze  multipart: audio (WAV 16-bit PCM, decoded on the card), hanzi, pinyin(optional)
async function handleAnkiAnalyze(request,response){
  const send=(status,data)=>{response.writeHead(status,{...CORS,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});response.end(JSON.stringify(data));};
  try{
    if(config.ankiToken&&request.headers['x-anki-token']!==config.ankiToken)return send(401,{error:'Bad token'});
    const tStart=Date.now();const chunks=[];let size=0;
    for await(const chunk of request){size+=chunk.length;if(size>8_000_000)return send(413,{error:'Recording is too large'});chunks.push(chunk);}
    const tUp=Date.now()-tStart;
    const form=await new Request('http://local/',{method:'POST',headers:{'content-type':request.headers['content-type']||''},body:Buffer.concat(chunks)}).formData();
    const audio=form.get('audio'),hanzi=String(form.get('hanzi')||'');
    if(!audio||typeof audio==='string'||!hanzi||hanzi.length>40)return send(400,{error:'Need audio file and hanzi'});
    const data=await analyzeAnki({wav:Buffer.from(await audio.arrayBuffer()),hanzi,pinyin:String(form.get('pinyin')||'').slice(0,200),apiKey:config.openaiKey,tpKey:config.tonePerfectKey,crepeUrl:config.crepeUrl,spk:{lo:Number(form.get('spk_lo')),hi:Number(form.get('spk_hi'))}});
    data.timings={...(data.timings||{}),upload_read_ms:tUp};
    send(200,data);
  }catch(error){send(422,{error:error.message||'Analysis failed'});}
}

// POST /api/anki/answer  multipart: audio (WAV), expected (hanzi; "a|b" = several words), mode (free|ordered), tones (0|1)
async function handleAnkiAnswer(request,response){
  const send=(status,data)=>{response.writeHead(status,{...CORS,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});response.end(JSON.stringify(data));};
  try{
    if(config.ankiToken&&request.headers['x-anki-token']!==config.ankiToken)return send(401,{error:'Bad token'});
    const chunks=[];let size=0;
    for await(const chunk of request){size+=chunk.length;if(size>8_000_000)return send(413,{error:'Recording is too large'});chunks.push(chunk);}
    const form=await new Request('http://local/',{method:'POST',headers:{'content-type':request.headers['content-type']||''},body:Buffer.concat(chunks)}).formData();
    const audio=form.get('audio'),expected=String(form.get('expected')||form.get('hanzi')||'');
    if(!audio||typeof audio==='string'||!expected||expected.length>600)return send(400,{error:'Need audio file and expected'});
    const data=await answerAnki({wav:Buffer.from(await audio.arrayBuffer()),expected,mode:String(form.get('mode')||'free'),tones:String(form.get('tones')??'1')!=='0',apiKey:config.openaiKey,tpKey:config.tonePerfectKey,crepeUrl:config.crepeUrl});
    send(200,data);
  }catch(error){send(422,{error:error.message||'Answer check failed'});}
}

async function serveFile(request,response){
  const url=new URL(request.url,'http://localhost');
  const requested=url.pathname==='/'?'index.html':url.pathname.slice(1);
  const safe=normalize(requested).replace(/^(\.\.(\/|\\|$))+/,'');
  const fileUrl=new URL(safe,publicDir);
  try{
    const data=await readFile(fileUrl);
    const contentType=types[extname(safe)]||'application/octet-stream';
    const range=request.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
    if(range){
      const start=range[1]?Number(range[1]):0;
      const end=range[2]?Math.min(Number(range[2]),data.length-1):data.length-1;
      if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<start||start>=data.length){
        response.writeHead(416,{'Content-Range':`bytes */${data.length}`});
        return response.end();
      }
      const chunk=data.subarray(start,end+1);
      response.writeHead(206,{'Content-Type':contentType,'Content-Length':chunk.length,'Content-Range':`bytes ${start}-${end}/${data.length}`,'Accept-Ranges':'bytes','Cache-Control':'no-store'});
      return request.method==='HEAD'?response.end():response.end(chunk);
    }
    response.writeHead(200,{'Content-Type':contentType,'Content-Length':data.length,'Accept-Ranges':'bytes','Cache-Control':'no-store'});
    request.method==='HEAD'?response.end():response.end(data);
  }catch{
    response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});
    response.end('Not found');
  }
}

createServer(async(request,response)=>{
  if(request.method==='GET'&&request.url==='/health')return sendJson(response,200,{status:'ok'});
  if(request.url==='/api/anki/analyze'&&request.method==='OPTIONS'){response.writeHead(204,CORS);return response.end();}
  if(request.method==='POST'&&request.url==='/api/anki/analyze')return handleAnkiAnalyze(request,response);
  if(request.url==='/api/anki/answer'&&request.method==='OPTIONS'){response.writeHead(204,CORS);return response.end();}
  if(request.method==='POST'&&request.url==='/api/anki/answer')return handleAnkiAnswer(request,response);
  if(request.method==='POST'&&request.url==='/api/prepare')return handlePrepare(request,response);
  if(request.method==='POST'&&request.url==='/api/assess')return handleAssessment(request,response);
  if(request.method==='GET'||request.method==='HEAD')return serveFile(request,response);
  response.writeHead(405);response.end('Method not allowed');
}).listen(config.port,'0.0.0.0',()=>{
  console.log(`Mandarin Tone Trainer: http://localhost:${config.port}`);
  console.log('Assessment engines: ToneMirror DTW, TonePerfect, CREPE');
});
