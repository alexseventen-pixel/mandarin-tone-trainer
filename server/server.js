import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, normalize } from 'node:path';
import { config } from './config.js';
import { assessWithTonePerfect } from './providers/toneperfect.js';
import { assessWithLocalAi } from './providers/local.js';

const publicDir=new URL('../public/',import.meta.url);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};

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
    if(typeof body.audioBase64!=='string'||typeof body.text!=='string'||typeof body.pinyin!=='string')return sendJson(response,400,{error:'Invalid recording payload'});
    const input={audio:Buffer.from(body.audioBase64,'base64'),text:body.text,pinyin:body.pinyin};
    if(!input.audio.length||input.audio.length>10_000_000||input.text.length>200||input.pinyin.length>500)return sendJson(response,400,{error:'Check the recording and text'});
    const data=config.provider==='local'
      ? await assessWithLocalAi(input,config)
      : await assessWithTonePerfect(input,config);
    sendJson(response,200,data);
  }catch(error){
    sendJson(response,502,{error:error.message||'Assessment failed'});
  }
}

async function serveFile(request,response){
  const url=new URL(request.url,'http://localhost');
  const requested=url.pathname==='/'?'index.html':url.pathname.slice(1);
  const safe=normalize(requested).replace(/^(\.\.(\/|\\|$))+/,'');
  const fileUrl=new URL(safe,publicDir);
  try{
    const data=await readFile(fileUrl);
    response.writeHead(200,{'Content-Type':types[extname(safe)]||'application/octet-stream','Cache-Control':'no-store'});
    response.end(data);
  }catch{
    response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});
    response.end('Not found');
  }
}

createServer(async(request,response)=>{
  if(request.method==='POST'&&request.url==='/api/assess')return handleAssessment(request,response);
  if(request.method==='GET')return serveFile(request,response);
  response.writeHead(405);response.end('Method not allowed');
}).listen(config.port,'127.0.0.1',()=>{
  console.log(`Mandarin Tone Trainer: http://localhost:${config.port}`);
  console.log(`AI provider: ${config.provider}`);
});
