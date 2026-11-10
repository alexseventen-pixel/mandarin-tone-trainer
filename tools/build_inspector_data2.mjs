// Encrypts decks added after the first batch (AES-256-GCM) into inspector-data/ with env INSPECTOR_DATA_KEY2 (never committed).
// Writes only index2.enc and the listed <id>.enc files; leaves the first batch untouched.
import { readFile, writeFile } from 'node:fs/promises';
import { createCipheriv, randomBytes } from 'node:crypto';
const key=Buffer.from(process.env.INSPECTOR_DATA_KEY2||'','hex');if(key.length!==32)throw new Error('INSPECTOR_DATA_KEY2 missing');
const L=[
['bear-p1v2-s2','Bear Door · Part 1 v2 · Sentence 2','Bear Door','/workspace/part1v2/s2/BearDoor_Part1_S2.apkg','bear-p1v2'],
];
const dir=new URL('../inspector-data/',import.meta.url);const idx=[];
const enc=b=>{const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv),e=Buffer.concat([c.update(b),c.final()]);return Buffer.concat([iv,c.getAuthTag(),e]);};
for(const[id,name,group,p,after] of L){const b=await readFile(p);await writeFile(new URL(id+'.enc',dir),enc(b));idx.push({id,name,group,size:b.length,after});}
await writeFile(new URL('index2.enc',dir),enc(Buffer.from(JSON.stringify(idx))));console.log(idx.length,'decks (batch 2)');
