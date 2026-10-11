import { randomUUID } from 'node:crypto';

export async function assessWithTonePerfect({audio,text,pinyin},config) {
  if(!config.tonePerfectKey)throw new Error('TONEPERFECT_API_KEY is missing in .env');
  const form=new FormData();
  form.append('audio',new Blob([audio],{type:'audio/wav'}),'phrase.wav');
  form.append('text',text);
  form.append('pinyin',pinyin);
  form.append('language','zh-CN');
  form.append('task','connected_speech');
  const response=await fetch('https://api.toneperfect.app/v1/assess',{
    method:'POST',
    headers:{Authorization:`Bearer ${config.tonePerfectKey}`,'Idempotency-Key':randomUUID()},
    body:form
  });
  const data=await response.json();
  if(!response.ok)throw new Error(data?.error?.message||data?.message||`TonePerfect returned ${response.status}`);
  return {...data,provider:'toneperfect'};
}
