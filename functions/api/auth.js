const json=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store"}});
const now=()=>new Date().toISOString();
const encoder=new TextEncoder();
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_MS=30*24*60*60*1000;
async function digest(value){
 const bytes=await crypto.subtle.digest("SHA-256",encoder.encode(String(value)));
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");
}
async function passwordHash(password,salt){
 const key=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]);
 const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:Uint8Array.from(atob(salt),c=>c.charCodeAt(0)),iterations:310000,hash:"SHA-256"},key,256);
 return Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,"0")).join("");
}
function randomToken(bytes=32){
 const data=crypto.getRandomValues(new Uint8Array(bytes));
 return btoa(String.fromCharCode(...data)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
async function schema(db){
 await db.batch([
  db.prepare("CREATE TABLE IF NOT EXISTS fw_auth_accounts (id TEXT PRIMARY KEY, site_id TEXT NOT NULL, email TEXT NOT NULL, display_name TEXT NOT NULL, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(site_id,email))"),
  db.prepare("CREATE INDEX IF NOT EXISTS idx_fw_auth_accounts_site ON fw_auth_accounts(site_id,email)"),
  db.prepare("CREATE TABLE IF NOT EXISTS fw_auth_sessions (token_hash TEXT PRIMARY KEY, site_id TEXT NOT NULL, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)"),
  db.prepare("CREATE INDEX IF NOT EXISTS idx_fw_auth_sessions_user ON fw_auth_sessions(site_id,user_id)")
 ]);
}
async function rateLimit(db,siteId,ipKey,email,action){
 await db.prepare("CREATE TABLE IF NOT EXISTS fw_auth_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, site_id TEXT NOT NULL, ip_key TEXT NOT NULL, email_key TEXT NOT NULL DEFAULT '', action TEXT NOT NULL, created_at TEXT NOT NULL)").run();
 await db.prepare("DELETE FROM fw_auth_attempts WHERE created_at < ?").bind(new Date(Date.now()-24*60*60*1000).toISOString()).run();
 const cutoff=new Date(Date.now()-15*60*1000).toISOString();
 const row=await db.prepare("SELECT COUNT(*) AS total FROM fw_auth_attempts WHERE site_id=? AND created_at>? AND (ip_key=? OR (?<>'' AND email_key=?))").bind(siteId,cutoff,ipKey,email,email).first();
 await db.prepare("INSERT INTO fw_auth_attempts(site_id,ip_key,email_key,action,created_at) VALUES(?,?,?,?,?)").bind(siteId,ipKey,email,action,now()).run();
 return Number(row?.total||0)<12;
}
async function createSession(db,siteId,userId){
 const token=randomToken(),stamp=now(),expires=new Date(Date.now()+SESSION_MS).toISOString();
 await db.prepare("INSERT INTO fw_auth_sessions(token_hash,site_id,user_id,expires_at,created_at) VALUES(?,?,?,?,?)").bind(await digest(token),siteId,userId,expires,stamp).run();
 return {token,expires_at:expires};
}
async function currentUser(db,siteId,token){
 if(!token)return null;
 const row=await db.prepare("SELECT a.id,a.email,a.display_name,a.created_at,s.token_hash,s.expires_at FROM fw_auth_sessions s JOIN fw_auth_accounts a ON a.id=s.user_id AND a.site_id=s.site_id WHERE s.site_id=? AND s.token_hash=? LIMIT 1").bind(siteId,await digest(token)).first();
 if(!row)return null;
 if(row.expires_at<=now()){await db.prepare("DELETE FROM fw_auth_sessions WHERE token_hash=?").bind(row.token_hash).run();return null}
 return {id:row.id,email:row.email,display_name:row.display_name,created_at:row.created_at,expires_at:row.expires_at,token_hash:row.token_hash};
}
export async function onRequest({request,env}){
 if(request.method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
 if(!env.database||!env.pages)return json({ok:false,error:"auth_binding_missing",detail:"La autenticación necesita los bindings database y pages."},500);
 let body;try{body=await request.json()}catch{return json({ok:false,error:"invalid_json"},400)}
 const url=new URL(request.url),hostname=String(url.searchParams.get("hostname")||"").trim().toLowerCase();
 if(!hostname||hostname.length>253)return json({ok:false,error:"hostname_required"},400);
 const site=await env.pages.prepare("SELECT site_id FROM sites WHERE hostname=? AND protocol='httc' AND status='published' LIMIT 1").bind(hostname).first();
 if(!site)return json({ok:false,error:"site_not_found"},404);
 const siteId=site.site_id,action=String(body.action||""),email=String(body.email||"").trim().toLowerCase();
 const password=String(body.password||""),name=String(body.display_name||"").trim().slice(0,80);
 const ip=String(request.headers.get("cf-connecting-ip")||"unknown");
 const ipKey=await digest(ip+"|"+siteId);
 await schema(env.database);
 if(["register","login"].includes(action)){
  if(!EMAIL_RE.test(email)||email.length>254)return json({ok:false,error:"invalid_email"},400);
  if(password.length<10||password.length>128)return json({ok:false,error:"password_length",detail:"La contraseña debe tener entre 10 y 128 caracteres."},400);
  if(!await rateLimit(env.database,siteId,ipKey,await digest(email),action))return json({ok:false,error:"rate_limited",detail:"Demasiados intentos. Espera 15 minutos."},429);
 }
 if(action==="register"){
  if(name.length<1)return json({ok:false,error:"display_name_required"},400);
  const existing=await env.database.prepare("SELECT id FROM fw_auth_accounts WHERE site_id=? AND email=? LIMIT 1").bind(siteId,email).first();
  if(existing)return json({ok:false,error:"account_exists"},409);
  const id=crypto.randomUUID(),salt=randomToken(16),hash=await passwordHash(password,salt),stamp=now();
  try{await env.database.prepare("INSERT INTO fw_auth_accounts(id,site_id,email,display_name,password_hash,password_salt,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").bind(id,siteId,email,name,hash,salt,stamp,stamp).run()}
  catch{return json({ok:false,error:"account_create_failed"},409)}
  const session=await createSession(env.database,siteId,id);
  return json({ok:true,user:{id,email,display_name:name,created_at:stamp},...session},201);
 }
 if(action==="login"){
  const account=await env.database.prepare("SELECT * FROM fw_auth_accounts WHERE site_id=? AND email=? LIMIT 1").bind(siteId,email).first();
  const salt=account?.password_salt||randomToken(16);
  const hash=await passwordHash(password,salt);
  if(!account||hash!==account.password_hash)return json({ok:false,error:"invalid_credentials"},401);
  const session=await createSession(env.database,siteId,account.id);
  return json({ok:true,user:{id:account.id,email:account.email,display_name:account.display_name,created_at:account.created_at},...session});
 }
 const token=String(body.token||"");
 if(action==="me"){
  const user=await currentUser(env.database,siteId,token);
  if(!user)return json({ok:false,error:"not_authenticated"},401);
  const {token_hash,...safeUser}=user;return json({ok:true,user:safeUser});
 }
 if(action==="logout"){
  if(token)await env.database.prepare("DELETE FROM fw_auth_sessions WHERE site_id=? AND token_hash=?").bind(siteId,await digest(token)).run();
  return json({ok:true});
 }
 return json({ok:false,error:"unknown_action"},400);
}
