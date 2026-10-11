// Your local model should accept:
// { audioBase64: string, text: string, pinyin: string, language: "zh-CN" }
// and return the same JSON shape that the browser renders.
// Replace this function if your model uses another request format.
export async function assessWithLocalAi({audio,text,pinyin},config) {
  const response=await fetch(config.localAiUrl,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      audioBase64:audio.toString('base64'),
      text,
      pinyin,
      language:'zh-CN'
    })
  });
  const data=await response.json();
  if(!response.ok)throw new Error(data?.error?.message||data?.message||`Local AI returned ${response.status}`);
  return data;
}
