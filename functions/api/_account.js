const json=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store"}});
const encoder=new TextEncoder();
const bytesToHex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
const randomHex=(length=32)=>{const bytes=new Uint8Array(length);crypto.getRandomValues(bytes);return bytesToHex(bytes)};
export async function ensureAccountSchema(env){
 await env.database.batch([
  env.database.prepare("CREATE TABLE IF NOT EXISTS cp_accounts (developer_id TEXT PRIMARY KEY,email TEXT NOT NULL COLLATE NOCASE UNIQUE,display_name TEXT NOT NULL,password_salt TEXT NOT NULL,password_hash TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)"),
  env.database.prepare("CREATE TABLE IF NOT EXISTS cp_sessions (token_hash TEXT PRIMARY KEY,developer_id TEXT NOT NULL,expires_at TEXT NOT NULL,created_at TEXT NOT NULL)"),
  env.database.prepare("CREATE INDEX IF NOT EXISTS idx_cp_sessions_developer ON cp_sessions(developer_id)")
 ]);
 await env.database.prepare("CREATE TABLE IF NOT EXISTS cp_account_profiles (developer_id TEXT PRIMARY KEY,display_name TEXT NOT NULL DEFAULT 'Fairwas user',updated_at TEXT NOT NULL)").run();
}
export async function hashAccountPassword(password,saltHex=randomHex(16)){
 const salt=Uint8Array.from(saltHex.match(/.{2}/g)||[],x=>parseInt(x,16));
 const key=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]);
 const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:100000,hash:"SHA-256"},key,256);
 return{salt:saltHex,hash:bytesToHex(new Uint8Array(bits))};
}
export async function verifyAccountPassword(password,salt,expected){
 const result=await hashAccountPassword(password,salt);
 if(result.hash.length!==expected.length)return false;
 let diff=0;for(let i=0;i<result.hash.length;i++)diff|=result.hash.charCodeAt(i)^expected.charCodeAt(i);
 return diff===0;
}
export async function createAccountSession(env,developerId){
 const token=randomHex(32),tokenHash=bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(token))));
 const stamp=new Date().toISOString(),expiresAt=new Date(Date.now()+30*24*60*60*1000).toISOString();
 await env.database.prepare("INSERT INTO cp_sessions(token_hash,developer_id,expires_at,created_at) VALUES(?,?,?,?)").bind(tokenHash,developerId,expiresAt,stamp).run();
 return{token,expires_at:expiresAt};
}
export async function getAccount(request,env){
 const header=request.headers.get("authorization")||"";
 const token=header.match(/^Bearer\s+([a-f0-9]{64})$/i)?.[1];
 if(!token)return null;
 const tokenHash=bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(token))));
 const session=await env.database.prepare("SELECT developer_id,expires_at FROM cp_sessions WHERE token_hash=? LIMIT 1").bind(tokenHash).first();
 if(!session||Date.parse(session.expires_at)<=Date.now()){
  if(session)await env.database.prepare("DELETE FROM cp_sessions WHERE token_hash=?").bind(tokenHash).run();
  return null;
 }
 return await env.database.prepare("SELECT developer_id,email,display_name,status,created_at,updated_at FROM cp_accounts WHERE developer_id=? AND status='active' LIMIT 1").bind(session.developer_id).first();
}
export function accountJson(account){return account?{developer_id:account.developer_id,email:account.email,display_name:account.display_name,status:account.status,created_at:account.created_at,updated_at:account.updated_at}:null}
export async function accountSessionHash(token){return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(token))))}
export {json as accountJsonResponse};
