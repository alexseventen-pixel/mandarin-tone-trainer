// Tone-recorder results from Anki cards -> app DB (Postgres via DATABASE_URL). Per-user auth: email + secret link code.
// The link code is shown once at sign-up; only a salted SHA-256 hash is stored. No public read access.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
let pool=null,ready=null;
export function setPool(p){pool=p;ready=null;}
async function db(){
  if(!pool){if(!process.env.DATABASE_URL)return null;const {default:pg}=await import('pg');
    pool=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:/localhost|127\.0\.0\.1|\/tmp/.test(process.env.DATABASE_URL)?false:{rejectUnauthorized:false},max:3});}
  if(!ready)ready=(async()=>{await pool.query(`create table if not exists mtt_accounts(id serial primary key,email text unique not null,salt text not null,code_hash text not null,created_at timestamptz default now())`);
    await pool.query(`create table if not exists mtt_attempts(id bigserial primary key,account_id int not null references mtt_accounts(id),card text not null,t bigint not null,score int,ok boolean,syl jsonb,device text,received_at timestamptz default now(),unique(account_id,card,t))`);})();
  await ready;return pool;}
const H=(salt,code)=>createHash('sha256').update(salt+':'+code).digest('hex');
const normEmail=e=>String(e||'').trim().toLowerCase();
const okEmail=e=>/^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/.test(e);
const newCode=()=>{const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',b=randomBytes(10);let s='';for(const x of b)s+=A[x%A.length];return s.slice(0,5)+'-'+s.slice(5);};
let fails=new Map();
async function auth(p,email,code){email=normEmail(email);code=String(code||'').trim().toUpperCase();
  const f=fails.get(email)||{n:0,t:0};if(f.n>=10&&Date.now()-f.t<600000)return {err:[429,'Too many attempts, wait 10 min']};
  const r=(await p.query('select id,salt,code_hash from mtt_accounts where email=$1',[email])).rows[0];
  const ok=r&&timingSafeEqual(Buffer.from(H(r.salt,code)),Buffer.from(r.code_hash));
  if(!ok){fails.set(email,{n:f.n+1,t:Date.now()});return {err:[401,'Wrong email or link code']};}
  fails.delete(email);return {id:r.id};}
export async function register(body){const p=await db();if(!p)return [503,{error:'Storage is not configured yet (DATABASE_URL missing). Your recordings stay queued on the device.'}];
  const email=normEmail(body.email);if(!okEmail(email))return [400,{error:'Enter a valid email'}];
  const code=newCode(),salt=randomBytes(12).toString('hex');
  try{await p.query('insert into mtt_accounts(email,salt,code_hash) values($1,$2,$3)',[email,salt,H(salt,code)]);}
  catch(e){if(e.code==='23505')return [409,{error:'This email already has an account. Use your link code (it was shown once at sign-up).'}];throw e;}
  return [200,{email,code,note:'Save this link code now: it is shown only once. Enter the same email and this code in the Anki card.'}];}
export async function sync(body){const p=await db();if(!p)return [503,{error:'storage not configured',queued:true}];
  const a=await auth(p,body.email,body.code);if(a.err)return [a.err[0],{error:a.err[1]}];
  const L=Array.isArray(body.attempts)?body.attempts.slice(0,500):[];let n=0;
  for(const x of L){const card=String(x.card||'').slice(0,60),t=Number(x.t);if(!card||!Number.isFinite(t))continue;
    const syl=Array.isArray(x.syl)?JSON.stringify(x.syl.slice(0,60)):null;
    const r=await p.query('insert into mtt_attempts(account_id,card,t,score,ok,syl,device) values($1,$2,$3,$4,$5,$6,$7) on conflict do nothing',[a.id,card,Math.round(t),Number.isFinite(+x.s)?Math.round(+x.s):null,x.ok!==false,syl,String(body.device||'').slice(0,60)]);n+=r.rowCount;}
  return [200,{saved:n,received:L.length}];}
export async function mine(body){const p=await db();if(!p)return [503,{error:'Storage is not configured yet'}];
  const a=await auth(p,body.email,body.code);if(a.err)return [a.err[0],{error:a.err[1]}];
  const r=await p.query('select card,t,score,ok,syl,device from mtt_attempts where account_id=$1 order by t desc limit 2000',[a.id]);
  return [200,{attempts:r.rows.map(x=>({...x,t:Number(x.t)}))}];}
export async function status(){return {configured:!!(pool||process.env.DATABASE_URL)};}
