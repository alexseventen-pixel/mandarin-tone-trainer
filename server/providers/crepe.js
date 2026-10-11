export async function assessWithCrepe({audio,text,pinyin},config) {
  const response=await fetch(config.crepeUrl,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({audioBase64:audio.toString('base64'),text,pinyin,language:'zh-CN'})
  });
  const data=await response.json();
  if(!response.ok)throw new Error(data?.error?.message||data?.error||data?.message||`CREPE service returned ${response.status}`);
  return {...data,provider:'crepe'};
}
