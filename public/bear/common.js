// Shared helpers for Bear Door drill + stats (attempts live in this browser's localStorage)
const BD={KEY:'bd1.attempts',
  load(){try{return JSON.parse(localStorage.getItem(this.KEY)||'{}')}catch{return{}}},
  save(all){localStorage.setItem(this.KEY,JSON.stringify(all))},
  async catalog(){const r=await fetch('/bear/catalog.json');return (await r.json()).cards},
  sylHtml(syls,small){return '<div class="syls'+(small?' small':'')+'">'+syls.map(s=>`<div class="syl t${s.tone}"><div class="h">${s.hanzi}</div><div class="p">${s.pinyin}</div></div>`).join('')+'</div>'},
  col(v){return v==null?'#e2e8ed':v>=85?'#2aa84a':v>=65?'#e8a200':'#e5484d'},
  best(a){return a&&a.length?Math.max(...a.map(x=>x.score??0)):null}};
