// Encrypts the preload decks (AES-256-GCM) into inspector-data/. Key comes from env INSPECTOR_DATA_KEY (never committed).
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { createCipheriv, randomBytes } from 'node:crypto';
const key=Buffer.from(process.env.INSPECTOR_DATA_KEY||'','hex');if(key.length!==32)throw new Error('INSPECTOR_DATA_KEY missing');
const L=[
['bear-p1v2','Bear Door · Part 1 v2 · Sentence 1','Bear Door','/workspace/part1v2/BearDoor_Part1_S1.apkg'],
['bear-r1','Bear Door · Round 1 · Words','Bear Door','/workspace/anki-proto/BearDoor_Round1_Words.apkg'],
['congming','Card 1 · 聪明 (prototype)','Bear Door','/workspace/anki-proto/Card1_congming.apkg'],
['jackie-audio','Jackie Chang Chinese (audio)','Jackie Chang','/workspace/chinese-jackie/Jackie_Chang_Chinese_audio.apkg'],
['jackie','Jackie Chang Chinese','Jackie Chang','/workspace/chinese-jackie/Jackie_Chang_Chinese.apkg'],
['jackie-ai','Jackie · AI pronunciation test','Jackie Chang','/workspace/chinese-jackie/ai_test/ai_test.apkg'],
['jackie-tone10','Jackie · Tone Test 10','Jackie Chang','/workspace/chinese-jackie/tonecards/Tone_Test_10.apkg'],
['jackie-mic','Jackie · mic test','Jackie Chang','/workspace/chinese-jackie/mic_test/mic_test.apkg'],
['n8n-v2','n8n v2 sample lesson','n8n cards','/workspace/n8n-cards/v2/v2_sample_lesson.apkg'],
['n8n-v2-fixed','n8n v2 sample lesson (fixed)','n8n cards','/workspace/n8n-cards/v2/v2_sample_lesson_fixed.apkg'],
['n8n-v2-fixed2','n8n v2 sample lesson (fixed 2)','n8n cards','/workspace/n8n-cards/v2/v2_sample_lesson_fixed2.apkg'],
['deckupd-orig','Deck update · original','Other','/workspace/deck_upd/orig.apkg'],
['deckupd-check','Deck update · with check','Other','/workspace/deck_upd/01M61N7QN15PCS75DQY5MR5WF2_with_check.apkg'],
['games-demo','Anki Games Demo','Other','/workspace/anki-games-demo/Anki_Games_Demo.apkg'],
];
const dir=new URL('../inspector-data/',import.meta.url);await rm(dir,{recursive:true,force:true});await mkdir(dir);const idx=[];
for(const[id,name,group,p] of L){const b=await readFile(p),iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv),e=Buffer.concat([c.update(b),c.final()]);
 await writeFile(new URL(id+'.enc',dir),Buffer.concat([iv,c.getAuthTag(),e]));idx.push({id,name,group,size:b.length});}
{const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv),e=Buffer.concat([c.update(JSON.stringify(idx)),c.final()]);await writeFile(new URL('index.enc',dir),Buffer.concat([iv,c.getAuthTag(),e]));}console.log(idx.length,'decks');
