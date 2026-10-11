import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile() {
  const path=resolve('.env');
  if(!existsSync(path))return;
  for(const line of readFileSync(path,'utf8').split(/\r?\n/)){
    const trimmed=line.trim();
    if(!trimmed||trimmed.startsWith('#'))continue;
    const at=trimmed.indexOf('=');
    if(at<1)continue;
    const key=trimmed.slice(0,at).trim();
    let value=trimmed.slice(at+1).trim();
    if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
    if(process.env[key]===undefined)process.env[key]=value;
  }
}

loadEnvFile();

export const config={
  port:Number(process.env.PORT||3000),
  tonePerfectKey:process.env.TONEPERFECT_API_KEY||'',
  crepeUrl:process.env.CREPE_URL||'http://127.0.0.1:8001/assess'
};
