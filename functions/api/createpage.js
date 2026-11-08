import { ensureAccountSchema, getAccount, accountJson, hashAccountPassword, createAccountSession, verifyAccountPassword, accountSessionHash } from "./_account.js";
function json(data,status=200){return Response.json(data,{status,headers:{"cache-control":"no-store"}})}
const now=()=>new Date().toISOString();
const MAX_PUBLISH_FILES=300;
const MAX_PUBLISH_BYTES=15*1024*1024;
const MAX_REQUEST_BYTES=22*1024*1024;
let createPageSchemaPromise=null;
async function readJsonLimited(request){
 const declared=Number(request.headers.get("content-length")||0);
 if(declared>MAX_REQUEST_BYTES)return{ok:false,status:413,error:"request_too_large"};
 if(!request.body){try{return{ok:true,value:await request.json()}}catch{return{ok:false,status:400,error:"invalid_json"}}}
 const reader=request.body.getReader(),chunks=[];let size=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;
   if(size>MAX_REQUEST_BYTES){try{await reader.cancel()}catch{};return{ok:false,status:413,error:"request_too_large"}}
   chunks.push(value);
  }
 }catch{return{ok:false,status:400,error:"invalid_json"}}
 const bytes=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 try{return{ok:true,value:JSON.parse(new TextDecoder().decode(bytes))}}catch{return{ok:false,status:400,error:"invalid_json"}}
}
export function validatePublishFiles(input){
 if(!Array.isArray(input)||input.length===0)return{ok:false,error:"files_required"};
 if(input.length>MAX_PUBLISH_FILES)return{ok:false,error:"too_many_files",max_files:MAX_PUBLISH_FILES};
 const paths=new Set();let totalBytes=0;const files=[];
 for(const item of input){
  if(!item||typeof item!=="object")return{ok:false,error:"invalid_file"};
  const raw=String(item.path||"/index.html").replace(/\\/g,"/");
  const path="/"+raw.replace(/^\/+/, "");
  if(path.length>1024||/[\u0000-\u001f?#]/.test(path)||path.split("/").some(part=>part===".."||part==="."))return{ok:false,error:"invalid_file_path",path};
  if(paths.has(path))return{ok:false,error:"duplicate_file_path",path};
  paths.add(path);
  const encoding=item.encoding==null||item.encoding===""?null:String(item.encoding);
  if(encoding!==null&&encoding!=="base64")return{ok:false,error:"invalid_file_encoding",path};
  const content=String(item.content??"");
  const bytes=encoding==="base64"?Math.max(0,Math.floor(content.length*3/4)-((content.endsWith("=="))?2:content.endsWith("=")?1:0)):new TextEncoder().encode(content).byteLength;
  totalBytes+=bytes;
  if(totalBytes>MAX_PUBLISH_BYTES)return{ok:false,error:"publish_too_large",max_bytes:MAX_PUBLISH_BYTES};
  files.push({...item,path,content,encoding,content_type:String(item.content_type||contentType(path))});
 }
 return{ok:true,files,totalBytes};
}

const id=()=>crypto.randomUUID();
function contentType(path){
 const p=String(path||"").toLowerCase();
 const ext=p.includes(".")?p.slice(p.lastIndexOf(".")):"";
 return ({".html":"text/html; charset=utf-8",".htm":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".txt":"text/plain; charset=utf-8",".xml":"application/xml; charset=utf-8",".webmanifest":"application/manifest+json",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".gif":"image/gif",".webp":"image/webp",".avif":"image/avif",".ico":"image/x-icon",".bmp":"image/bmp",".woff":"font/woff",".woff2":"font/woff2",".ttf":"font/ttf",".otf":"font/otf",".eot":"application/vnd.ms-fontobject",".mp3":"audio/mpeg",".wav":"audio/wav",".ogg":"audio/ogg",".mp4":"video/mp4",".webm":"video/webm",".wasm":"application/wasm",".map":"application/json"}[ext]||"application/octet-stream");
}

async function ensureServerSchema(env){
 if(!env.server)throw new Error("server_binding_missing");
 await env.server.prepare("CREATE TABLE IF NOT EXISTS servers (id INTEGER PRIMARY KEY AUTOINCREMENT,site_id TEXT,hostname TEXT NOT NULL UNIQUE,protocol TEXT NOT NULL DEFAULT 'httc',origin TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
 await env.server.prepare("CREATE INDEX IF NOT EXISTS idx_servers_protocol_hostname ON servers(protocol,hostname)").run();
}

async function ensureProjectSchema(env){
 await env.database.batch([
  env.database.prepare("CREATE TABLE IF NOT EXISTS cp_developers (id INTEGER PRIMARY KEY CHECK(id=1),developer_id TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)"),
  env.database.prepare("CREATE TABLE IF NOT EXISTS cp_projects (site_id TEXT PRIMARY KEY,hostname TEXT NOT NULL UNIQUE,title TEXT NOT NULL,developer_id TEXT,status TEXT NOT NULL DEFAULT 'draft',build_root TEXT NOT NULL DEFAULT '/',build_output TEXT NOT NULL DEFAULT '/dist',build_command TEXT NOT NULL DEFAULT 'npm run build',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)"),
  env.database.prepare("CREATE TABLE IF NOT EXISTS cp_deployments (id INTEGER PRIMARY KEY AUTOINCREMENT,site_id TEXT NOT NULL,version TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL)"),
  env.database.prepare("CREATE TABLE IF NOT EXISTS cp_databases (id INTEGER PRIMARY KEY AUTOINCREMENT,site_id TEXT,name TEXT NOT NULL UNIQUE,engine TEXT NOT NULL DEFAULT 'SQLite',status TEXT NOT NULL DEFAULT 'registered',created_at TEXT NOT NULL)"),
  env.database.prepare("CREATE TABLE IF NOT EXISTS cp_page_databases (id TEXT PRIMARY KEY,site_id TEXT NOT NULL,name TEXT NOT NULL,engine TEXT NOT NULL DEFAULT 'SQLite',status TEXT NOT NULL DEFAULT 'ready',created_at TEXT NOT NULL,UNIQUE(site_id,name))"),
  env.database.prepare("CREATE TABLE IF NOT EXISTS cp_profiles (id INTEGER PRIMARY KEY CHECK(id=1),display_name TEXT NOT NULL DEFAULT 'Fairwas user',updated_at TEXT NOT NULL)"),
  env.database.prepare("CREATE TABLE IF NOT EXISTS cp_workers (id INTEGER PRIMARY KEY AUTOINCREMENT,site_id TEXT,name TEXT NOT NULL,script TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'draft',updated_at TEXT NOT NULL)"),
  env.database.prepare("CREATE TABLE IF NOT EXISTS cp_docs (id TEXT PRIMARY KEY,title TEXT NOT NULL,content TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL,developer_id TEXT)")
 ]);
 await env.users.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,developer_id TEXT UNIQUE,display_name TEXT NOT NULL,email TEXT,status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
 const docColumns=await env.database.prepare("PRAGMA table_info(cp_docs)").all();
 if(!(docColumns.results||[]).some(column=>column.name==="developer_id"))await env.database.prepare("ALTER TABLE cp_docs ADD COLUMN developer_id TEXT").run();
 const legacyOwner=await env.database.prepare("SELECT developer_id FROM cp_developers WHERE id=1").first();
 if(legacyOwner)await env.database.prepare("UPDATE cp_docs SET developer_id=? WHERE developer_id IS NULL").bind(legacyOwner.developer_id).run();
 await env.pages.batch([
  env.pages.prepare("CREATE TABLE IF NOT EXISTS sites (site_id TEXT PRIMARY KEY,hostname TEXT NOT NULL UNIQUE,protocol TEXT NOT NULL DEFAULT 'httc',title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',logo_url TEXT,framework TEXT,language TEXT,backend TEXT,runtime TEXT,database_type TEXT,status TEXT NOT NULL DEFAULT 'draft',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)"),
  env.pages.prepare("CREATE TABLE IF NOT EXISTS site_files (id INTEGER PRIMARY KEY AUTOINCREMENT,site_id TEXT NOT NULL,path TEXT NOT NULL,content_type TEXT NOT NULL,content TEXT NOT NULL,encoding TEXT,updated_at TEXT NOT NULL,UNIQUE(site_id,path))")
 ]);
}
async function ensureSiteFilesEncoding(env){
 const table=await env.pages.prepare("PRAGMA table_info(site_files)").all();
 const names=new Set((table.results||[]).map(x=>x.name));
 if(!names.has("encoding"))await env.pages.prepare("ALTER TABLE site_files ADD COLUMN encoding TEXT").run();
}

export async function onRequest({request,env}){
 const u=new URL(request.url);
 const action=u.searchParams.get("action")||"sites";
 const method=request.method;
 if(!env.database||!env.pages||!env.server||!env.users)return json({ok:false,error:"d1_binding_missing",detail:"CreatePage requiere pages, server, database y users."},500);

 try{
  // Run schema setup and legacy migrations once per Worker isolate, not on
  // every API request. Repeating PRAGMA/SELECT/DDL on every login, page load,
  // and API call was needlessly consuming Cloudflare D1 operations.
  if(!createPageSchemaPromise){
   createPageSchemaPromise=(async()=>{
    await ensureProjectSchema(env);
    await ensureSiteFilesEncoding(env);
    await ensureServerSchema(env);
    await ensureAccountSchema(env);
    await env.database.prepare("CREATE TABLE IF NOT EXISTS cp_api_manifests (developer_id TEXT PRIMARY KEY,manifest TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
    const accountColumns=await env.database.prepare("PRAGMA table_info(cp_accounts)").all();
    if(!(accountColumns.results||[]).some(column=>column.name==="plan"))await env.database.prepare("ALTER TABLE cp_accounts ADD COLUMN plan TEXT NOT NULL DEFAULT 'Free'").run();
    await env.database.prepare("CREATE TABLE IF NOT EXISTS cp_recovery_challenges (challenge_hash TEXT PRIMARY KEY,developer_id TEXT,correct_ids TEXT NOT NULL,expires_at TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,used_at TEXT)").run();
    await env.database.prepare("CREATE TABLE IF NOT EXISTS cp_password_resets (token_hash TEXT PRIMARY KEY,developer_id TEXT NOT NULL,expires_at TEXT NOT NULL,created_at TEXT NOT NULL,used_at TEXT)").run();
   })().catch(error=>{createPageSchemaPromise=null;throw error});
  }
  await createPageSchemaPromise;
  if(action==="recovery-challenge"){
   if(method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
   const parsed=await readJsonLimited(request);if(!parsed.ok)return json({ok:false,error:parsed.error},parsed.status);
   const email=String(parsed.value.email||"").trim().toLowerCase();
   if(!email||email.length>254||!email.includes("@"))return json({ok:false,error:"invalid_email"},400);
   const account=await env.database.prepare("SELECT developer_id FROM cp_accounts WHERE email=? COLLATE NOCASE AND status='active' LIMIT 1").bind(email).first();
   const stamp=now(),expires=new Date(Date.now()+10*60*1000).toISOString();
   const challengeToken=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");
   const challengeHash=await accountSessionHash(challengeToken);
   let correct=[],options=[];
   if(!account)return json({ok:false,error:"recovery_projects_unavailable",detail:"No se ha podido preparar la comprobación para esa cuenta. Comprueba el correo o contacta con soporte de Fairwas."},404);
   // Resolve the account email to its developer_id, then read only published
   // sites linked to that developer in Cloudflare D1.
   const ownedRows=await env.database.prepare("SELECT site_id FROM cp_projects WHERE developer_id=? ORDER BY created_at DESC").bind(account.developer_id).all();
   const ownedSites=[];
   for(const project of ownedRows.results||[]){
    const site=await env.pages.prepare("SELECT site_id,hostname,title,status FROM sites WHERE site_id=? AND status='published' LIMIT 1").bind(project.site_id).first();
    if(site&&site.site_id&&site.hostname)ownedSites.push(site);
   }
   if(ownedSites.length<3)return json({ok:false,error:"recovery_projects_unavailable",detail:"Esta cuenta no tiene tres sitios publicados asociados a ella en Cloudflare. No se puede crear una comprobación válida."},400);
   const real=ownedSites.slice().sort(()=>Math.random()-.5).slice(0,3);
   correct=real.map(x=>({id:crypto.randomUUID(),label:String(x.title||x.hostname)+" · "+String(x.hostname)}));
   options=[...correct];
   // Create plausible-looking decoy domains, but verify that none exists
   // in either Cloudflare's published-sites database or Fairwas projects.
   const nameA=["nexora","veltrix","lumora","novexa","arqon","virelia","zenbyte","orvian","klyra","montera","aventra","solvix"];
   const nameB=["studio","digital","labs","media","works","cloud","systems","creative","network","web"];
   const tlds=[".com",".es",".net",".dev"];
   const usedNames=new Set();
   for(let i=0;i<3;i++){
    let fakeHost="";
    for(let attempt=0;attempt<40&&!fakeHost;attempt++){
     const a=nameA[Math.floor(Math.random()*nameA.length)];
     const b=nameB[Math.floor(Math.random()*nameB.length)];
     const suffix=Array.from(crypto.getRandomValues(new Uint8Array(2)),x=>x.toString(16).padStart(2,"0")).join("");
     const tld=tlds[Math.floor(Math.random()*tlds.length)];
     const candidate=a+b+suffix+tld;
     if(usedNames.has(candidate))continue;
     const published=await env.pages.prepare("SELECT site_id FROM sites WHERE hostname=? COLLATE NOCASE LIMIT 1").bind(candidate).first();
     const project=await env.database.prepare("SELECT site_id FROM cp_projects WHERE hostname=? COLLATE NOCASE LIMIT 1").bind(candidate).first();
     if(!published&&!project){fakeHost=candidate;usedNames.add(candidate);}
    }
    if(!fakeHost)return json({ok:false,error:"recovery_decoys_unavailable",detail:"No se han podido generar opciones falsas seguras. Inténtalo de nuevo."},503);
    options.push({id:crypto.randomUUID(),label:"Proyecto web · "+fakeHost});
   }
   for(let i=options.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[options[i],options[j]]=[options[j],options[i]]}
   await env.database.prepare("INSERT INTO cp_recovery_challenges(challenge_hash,developer_id,correct_ids,expires_at,created_at) VALUES(?,?,?,?,?)").bind(challengeHash,account?.developer_id||null,JSON.stringify(correct.map(x=>x.id)),expires,stamp).run();
   return json({ok:true,challenge_token:challengeToken,options:options.map(({id,label})=>({id,label})),required_count:3,expires_at:expires});
  }
  if(action==="verify-recovery"){
   if(method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
   const parsed=await readJsonLimited(request);if(!parsed.ok)return json({ok:false,error:parsed.error},parsed.status);
   const token=String(parsed.value.challenge_token||"");
   const selected=Array.isArray(parsed.value.selected_ids)?parsed.value.selected_ids.map(x=>String(x)).slice(0,10):[];
   if(!/^[a-f0-9]{64}$/i.test(token)||selected.length<1||selected.length>3||new Set(selected).size!==selected.length)return json({ok:false,error:"recovery_answers_incorrect",detail:"Selecciona el número indicado de proyectos."},400);
   const challengeHash=await accountSessionHash(token);
   const challenge=await env.database.prepare("SELECT developer_id,correct_ids,expires_at,attempts,used_at FROM cp_recovery_challenges WHERE challenge_hash=? LIMIT 1").bind(challengeHash).first();
   if(!challenge||challenge.used_at||Date.parse(challenge.expires_at)<=Date.now()||Number(challenge.attempts)>=3)return json({ok:false,error:"recovery_challenge_expired",detail:"La comprobación ha caducado. Vuelve a empezar."},400);
   const expected=JSON.parse(challenge.correct_ids||"[]");
   const matches=Boolean(challenge.developer_id)&&expected.length>=1&&expected.length<=3&&expected.length===selected.length&&expected.every(id=>selected.includes(id))&&selected.every(id=>expected.includes(id));
   await env.database.prepare("UPDATE cp_recovery_challenges SET attempts=attempts+1,used_at=CASE WHEN ? THEN ? ELSE used_at END WHERE challenge_hash=?").bind(matches?1:0,now(),challengeHash).run();
   if(!matches)return json({ok:false,error:"recovery_answers_incorrect",detail:"Las respuestas no coinciden. Comprueba los proyectos e inténtalo de nuevo."},400);
   const resetToken=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");
   const resetHash=await accountSessionHash(resetToken),stamp=now(),resetExpiry=new Date(Date.now()+10*60*1000).toISOString();
   await env.database.prepare("INSERT INTO cp_password_resets(token_hash,developer_id,expires_at,created_at) VALUES(?,?,?,?)").bind(resetHash,challenge.developer_id,resetExpiry,stamp).run();
   return json({ok:true,reset_token:resetToken,expires_at:resetExpiry});
  }
  if(action==="reset-password"){
   if(method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
   const parsed=await readJsonLimited(request);if(!parsed.ok)return json({ok:false,error:parsed.error},parsed.status);
   const token=String(parsed.value.token||""),password=String(parsed.value.password||"");
   if(!/^[a-f0-9]{64}$/i.test(token))return json({ok:false,error:"invalid_or_expired_reset_link",detail:"La comprobación no es válida o ha caducado. Vuelve a empezar."},400);
   if(password.length<10||password.length>200)return json({ok:false,error:"weak_password",detail:"La contraseña debe tener entre 10 y 200 caracteres."},400);
   const tokenHash=await accountSessionHash(token),reset=await env.database.prepare("SELECT developer_id,expires_at,used_at FROM cp_password_resets WHERE token_hash=? LIMIT 1").bind(tokenHash).first();
   if(!reset||reset.used_at||Date.parse(reset.expires_at)<=Date.now())return json({ok:false,error:"invalid_or_expired_reset_link",detail:"La comprobación no es válida o ha caducado. Vuelve a empezar."},400);
   const credentials=await hashAccountPassword(password),stamp=now();
   await env.database.batch([
    env.database.prepare("UPDATE cp_accounts SET password_salt=?,password_hash=?,updated_at=? WHERE developer_id=?").bind(credentials.salt,credentials.hash,stamp,reset.developer_id),
    env.database.prepare("UPDATE cp_password_resets SET used_at=? WHERE token_hash=? AND used_at IS NULL").bind(stamp,tokenHash),
    env.database.prepare("DELETE FROM cp_sessions WHERE developer_id=?").bind(reset.developer_id)
   ]);
   const session=await createAccountSession(env,reset.developer_id);
   return json({ok:true,token:session.token,expires_at:session.expires_at});
  }
  if(action==="auth-status")return json({ok:true,account:accountJson(await getAccount(request,env))});
  if(action==="register"){
   if(method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
   const parsed=await readJsonLimited(request);if(!parsed.ok)return json({ok:false,error:parsed.error},parsed.status);
   const b=parsed.value,email=String(b.email||"").trim().toLowerCase(),displayName=String(b.display_name||"").trim(),password=String(b.password||"");
   if(!email.includes("@")||!email.includes("."))return json({ok:false,error:"invalid_email"},400);
   if(displayName.length<2||displayName.length>80)return json({ok:false,error:"invalid_display_name"},400);
   if(password.length<10||password.length>200)return json({ok:false,error:"weak_password",detail:"La contraseña debe tener al menos 10 caracteres."},400);
   if(await env.database.prepare("SELECT developer_id FROM cp_accounts WHERE email=? COLLATE NOCASE LIMIT 1").bind(email).first())return json({ok:false,error:"email_already_registered"},409);
   let developerId=null;
   const legacy=await env.database.prepare("SELECT developer_id FROM cp_developers WHERE id=1").first();
   if(legacy){const legacyUser=await env.users.prepare("SELECT email FROM users WHERE developer_id=? LIMIT 1").bind(legacy.developer_id).first();if(String(legacyUser?.email||"").trim().toLowerCase()===email)developerId=legacy.developer_id;}
   if(!developerId)developerId="dev-"+crypto.randomUUID().replace(/-/g,"").slice(0,20);
   if(await env.database.prepare("SELECT developer_id FROM cp_accounts WHERE developer_id=? LIMIT 1").bind(developerId).first())return json({ok:false,error:"legacy_account_already_claimed"},409);
   const credentials=await hashAccountPassword(password),stamp=now();
   await env.database.prepare("INSERT INTO cp_accounts(developer_id,email,display_name,password_salt,password_hash,status,created_at,updated_at) VALUES(?,?,?,?,?,'active',?,?)").bind(developerId,email,displayName,credentials.salt,credentials.hash,stamp,stamp).run();
   await env.database.prepare("INSERT INTO cp_account_profiles(developer_id,display_name,updated_at) VALUES(?,?,?) ON CONFLICT(developer_id) DO UPDATE SET display_name=excluded.display_name,updated_at=excluded.updated_at").bind(developerId,displayName,stamp).run();
   const session=await createAccountSession(env,developerId);
   return json({ok:true,account:{developer_id:developerId,email,display_name:displayName,status:"active",created_at:stamp,updated_at:stamp},token:session.token,expires_at:session.expires_at},201);
  }
  if(action==="login"){
   if(method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
   const parsed=await readJsonLimited(request);if(!parsed.ok)return json({ok:false,error:parsed.error},parsed.status);
   const email=String(parsed.value.email||"").trim().toLowerCase(),password=String(parsed.value.password||"");
   const row=await env.database.prepare("SELECT * FROM cp_accounts WHERE email=? COLLATE NOCASE AND status='active' LIMIT 1").bind(email).first();
   if(!row||!await verifyAccountPassword(password,row.password_salt,row.password_hash))return json({ok:false,error:"invalid_credentials",detail:"El correo o la contraseña no son correctos."},401);
   const session=await createAccountSession(env,row.developer_id);
   return json({ok:true,account:accountJson(row),token:session.token,expires_at:session.expires_at});
  }
  if(action==="logout"){
   const token=(request.headers.get("authorization")||"").replace(/^Bearer +/i,"");
   if(token)await env.database.prepare("DELETE FROM cp_sessions WHERE token_hash=?").bind(await accountSessionHash(token)).run();
   return json({ok:true});
  }
  const account=await getAccount(request,env);
  if(!account)return json({ok:false,error:"authentication_required",detail:"Inicia sesión o crea una cuenta para continuar."},401);
  if(action==="workspace"){
   const projectsResult=await env.database.prepare("SELECT site_id,hostname,title,status FROM cp_projects WHERE developer_id=? ORDER BY hostname").bind(account.developer_id).all();
   const projects=projectsResult.results||[];
   const siteIds=projects.map(x=>String(x.site_id||"")).filter(Boolean);
   let sites=[],servers=[],databases=[],pageDatabases=[],workers=[];
   if(siteIds.length){
    const marks=siteIds.map(()=>"?").join(",");
    const [siteRows,serverRows,databaseRows,pageDatabaseRows,workerRows]=await Promise.all([
     env.pages.prepare("SELECT site_id,hostname,protocol,title,description,framework,language,backend,runtime,database_type,status,created_at,updated_at FROM sites WHERE site_id IN ("+marks+")").bind(...siteIds).all(),
     env.server.prepare("SELECT * FROM servers WHERE site_id IN ("+marks+") ORDER BY id DESC").bind(...siteIds).all(),
     env.database.prepare("SELECT * FROM cp_databases WHERE site_id IN ("+marks+") ORDER BY id DESC").bind(...siteIds).all(),
     env.database.prepare("SELECT * FROM cp_page_databases WHERE site_id IN ("+marks+") ORDER BY created_at DESC").bind(...siteIds).all(),
     env.database.prepare("SELECT * FROM cp_workers WHERE site_id IN ("+marks+") ORDER BY id DESC").bind(...siteIds).all()
    ]);
    sites=siteRows.results||[];
    servers=serverRows.results||[];
    databases=[...(pageDatabaseRows.results||[]),...(databaseRows.results||[])];
    workers=workerRows.results||[];
   }
   return json({ok:true,developer:accountJson(account),projects,sites,servers,databases,workers});
  }
  if(action==="profile"){
   if(method==="POST"){
    const parsed=await readJsonLimited(request);if(!parsed.ok)return json({ok:false,error:parsed.error},parsed.status);
    const displayName=String(parsed.value.display_name||"").trim();
    if(displayName.length<2||displayName.length>80)return json({ok:false,error:"invalid_display_name"},400);
    const stamp=now();
    await env.database.prepare("UPDATE cp_accounts SET display_name=?,updated_at=? WHERE developer_id=?").bind(displayName,stamp,account.developer_id).run();
    await env.database.prepare("INSERT INTO cp_account_profiles(developer_id,display_name,updated_at) VALUES(?,?,?) ON CONFLICT(developer_id) DO UPDATE SET display_name=excluded.display_name,updated_at=excluded.updated_at").bind(account.developer_id,displayName,stamp).run();
   }
   const r=await env.database.prepare("SELECT developer_id AS id,display_name,updated_at FROM cp_account_profiles WHERE developer_id=?").bind(account.developer_id).first();
   return json({ok:true,profile:r||{id:account.developer_id,display_name:account.display_name}});
  }

  if(action==="sites"){
   const projects=await env.database.prepare("SELECT site_id FROM cp_projects WHERE developer_id=? ORDER BY created_at DESC").bind(account.developer_id).all();
   const items=[];
   for(const project of projects.results||[]){const site=await env.pages.prepare("SELECT site_id,hostname,protocol,title,description,framework,language,backend,runtime,database_type,status,created_at,updated_at FROM sites WHERE site_id=? LIMIT 1").bind(project.site_id).first();if(site)items.push({...site,developer_id:account.developer_id});}
   return json({ok:true,items});
  }

  if(action==="databases"){
   const owned="SELECT site_id FROM cp_projects WHERE developer_id=?";
   const r=await env.database.prepare("SELECT * FROM cp_databases WHERE site_id IN ("+owned+") ORDER BY id DESC").bind(account.developer_id).all();
   const pageDbs=await env.database.prepare("SELECT * FROM cp_page_databases WHERE site_id IN ("+owned+") ORDER BY created_at DESC").bind(account.developer_id).all();
   return json({ok:true,items:[...(pageDbs.results||[]),...(r.results||[])]});
  }

  if(action==="db-list"){
   const siteId=String(u.searchParams.get("site_id")||"").trim();
   const hostname=String(u.searchParams.get("hostname")||"").trim().toLowerCase();
   const developer=account;
   const project=siteId?await env.database.prepare("SELECT * FROM cp_projects WHERE site_id=? LIMIT 1").bind(siteId).first():await env.database.prepare("SELECT * FROM cp_projects WHERE hostname=? LIMIT 1").bind(hostname).first();
   if(!project)return json({ok:false,error:"site_not_found"},404);
   if(!developer||project.developer_id!==developer.developer_id)return json({ok:false,error:"site_not_owned"},403);
   const r=await env.database.prepare("SELECT id,site_id,name,engine,status,created_at FROM cp_page_databases WHERE site_id=? ORDER BY created_at,name").bind(project.site_id).all();
   const items=[];
   for(const db of r.results||[]){
    const prefix="fwdb_"+project.site_id.replace(/[^a-zA-Z0-9]/g,"")+"_"+db.id.replace(/[^a-zA-Z0-9]/g,"")+"_";
    const t=await env.database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND substr(name,1,?)=? ORDER BY name").bind(prefix.length,prefix).all();
    items.push({...db,tables:(t.results||[]).map(x=>x.name.slice(prefix.length))});
   }
   return json({ok:true,items});
  }

  if(action==="db-create"){
   if(method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
   const parsedBody=await readJsonLimited(request);if(!parsedBody.ok)return json({ok:false,error:parsedBody.error},parsedBody.status);const b=parsedBody.value;
   const siteId=String(b.site_id||"").trim(),name=String(b.name||"").trim();
   if(!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(name))return json({ok:false,error:"invalid_database_name",detail:"Usa letras, números, guion o guion bajo (máximo 40 caracteres)."},400);
   const developer=account;
   const project=await env.database.prepare("SELECT * FROM cp_projects WHERE site_id=? LIMIT 1").bind(siteId).first();
   if(!project)return json({ok:false,error:"site_not_found"},404);
   if(!developer||project.developer_id!==developer.developer_id)return json({ok:false,error:"site_not_owned"},403);
   const published=await env.pages.prepare("SELECT status FROM sites WHERE site_id=? AND protocol='httc' LIMIT 1").bind(siteId).first();
   if(!published||published.status!=="published")return json({ok:false,error:"site_not_published",detail:"Publica el sitio antes de crear una base de datos."},409);
   const count=await env.database.prepare("SELECT COUNT(*) AS total FROM cp_page_databases WHERE site_id=?").bind(siteId).first();
   if(Number(count?.total||0)>=20)return json({ok:false,error:"database_limit_reached",detail:"Cada sitio admite un máximo de 20 bases de datos."},409);
   const stamp=now(),databaseId=id();
   try{await env.database.prepare("INSERT INTO cp_page_databases(id,site_id,name,engine,status,created_at) VALUES(?,?,?,'SQLite','ready',?)").bind(databaseId,siteId,name,stamp).run()}
   catch(e){if(/unique/i.test(String(e)))return json({ok:false,error:"database_name_exists"},409);throw e}
   return json({ok:true,database:{id:databaseId,site_id:siteId,name,engine:"SQLite",status:"ready",created_at:stamp,tables:[]}});
  }

  if(action==="db-delete"){
   if(method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
   const parsedBody=await readJsonLimited(request);if(!parsedBody.ok)return json({ok:false,error:parsedBody.error},parsedBody.status);const b=parsedBody.value;
   const databaseId=String(b.database_id||"").trim(),siteId=String(b.site_id||"").trim();
   const developer=account;
   const project=await env.database.prepare("SELECT * FROM cp_projects WHERE site_id=? LIMIT 1").bind(siteId).first();
   if(!project)return json({ok:false,error:"site_not_found"},404);
   if(!developer||project.developer_id!==developer.developer_id)return json({ok:false,error:"site_not_owned"},403);
   const db=await env.database.prepare("SELECT * FROM cp_page_databases WHERE id=? AND site_id=?").bind(databaseId,siteId).first();
   if(!db)return json({ok:false,error:"database_not_found"},404);
   const prefix="fwdb_"+siteId.replace(/[^a-zA-Z0-9]/g,"")+"_"+databaseId.replace(/[^a-zA-Z0-9]/g,"")+"_";
   const tables=await env.database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND substr(name,1,?)=?").bind(prefix+"%").all();
   if((tables.results||[]).length)await env.database.batch(tables.results.map(t=>env.database.prepare('DROP TABLE IF EXISTS "'+t.name.replace(/"/g,'""')+'"')));
   await env.database.prepare("DELETE FROM cp_page_databases WHERE id=? AND site_id=?").bind(databaseId,siteId).run();
   return json({ok:true,deleted:databaseId});
  }

  if(action==="db-query"){
   if(method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
   const parsedBody=await readJsonLimited(request);if(!parsedBody.ok)return json({ok:false,error:parsedBody.error},parsedBody.status);const b=parsedBody.value;
   const hostname=String(b.hostname||"").trim().toLowerCase(),databaseName=String(b.database||"").trim();
   let sql=String(b.sql||"").trim();
   const params=Array.isArray(b.params)?b.params:[];
   if(!hostname||!databaseName||!sql)return json({ok:false,error:"hostname_database_sql_required"},400);
   if(sql.length>12000||params.length>100)return json({ok:false,error:"query_too_large"},413);
   sql=sql.replace(/;\s*$/,"").trim();
   if(!sql||/;|--|\/\*|\*\//.test(sql)||/\b(?:PRAGMA|ATTACH|DETACH|VACUUM|REINDEX|ANALYZE|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|EXPLAIN|sqlite_master|sqlite_schema|load_extension)\b/i.test(sql))return json({ok:false,error:"sql_not_allowed",detail:"Se admite una sola consulta SQLite por petición. Puedes terminarla con punto y coma, pero no encadenar consultas ni usar comentarios o instrucciones administrativas."},400);
   const site=await env.pages.prepare("SELECT site_id FROM sites WHERE hostname=? AND protocol='httc' AND status='published' LIMIT 1").bind(hostname).first();
   if(!site)return json({ok:false,error:"site_not_found"},404);
   const db=await env.database.prepare("SELECT * FROM cp_page_databases WHERE site_id=? AND name=? AND status='ready' LIMIT 1").bind(site.site_id,databaseName).first();
   if(!db)return json({ok:false,error:"database_not_found"},404);
   const prefix="fwdb_"+site.site_id.replace(/[^a-zA-Z0-9]/g,"")+"_"+db.id.replace(/[^a-zA-Z0-9]/g,"")+"_";
   const verb=(sql.match(/^([A-Za-z]+)/)||[])[1]?.toUpperCase();
   if(!["SELECT","INSERT","UPDATE","DELETE","CREATE","DROP","ALTER"].includes(verb))return json({ok:false,error:"sql_not_allowed",detail:"Usa SQLite: SELECT, INSERT, UPDATE, DELETE, CREATE TABLE, DROP TABLE o ALTER TABLE."},400);
   if(/\bFROM\s+[A-Za-z_][A-Za-z0-9_]*(?:\s+(?:AS\s+)?[A-Za-z_][A-Za-z0-9_]*)?\s*,/i.test(sql))return json({ok:false,error:"comma_joins_not_supported",detail:"Usa JOIN explícitos para mantener aisladas las tablas de cada base de datos."},400);
   const refs=[];
   const refPattern=/\b(?:FROM|JOIN|INTO|UPDATE|TABLE|DELETE\s+FROM)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)/gi;
   let match;
   while((match=refPattern.exec(sql))!==null){
    const table=match[1];
    if(["SELECT","SET","WHERE","VALUES","ON","AS"].includes(table.toUpperCase()))continue;
    if(/^fwdb_/i.test(table)||/^sqlite_/i.test(table))return json({ok:false,error:"invalid_table_name"},400);
    refs.push({name:table,start:match.index+match[0].lastIndexOf(table)});
   }
   if(!refs.length)return json({ok:false,error:"table_required",detail:"La consulta debe operar sobre una tabla de esta base de datos."},400);
   for(const ref of refs.slice().sort((a,b)=>b.start-a.start))sql=sql.slice(0,ref.start)+prefix+ref.name+sql.slice(ref.start+ref.name.length);
   try{
    const statement=env.database.prepare(sql);
    const result=verb==="SELECT"?await statement.bind(...params).all():await statement.bind(...params).run();
    return json({ok:true,engine:"SQLite",results:result.results||[],meta:result.meta||null,changes:result.meta?.changes||0});
   }catch(e){return json({ok:false,error:"sql_error",detail:String(e)},400)}
  }

  if(action==="servers"){
   const owned=await env.database.prepare("SELECT site_id FROM cp_projects WHERE developer_id=?").bind(account.developer_id).all();
   const items=[];for(const p of owned.results||[]){const rows=await env.server.prepare("SELECT * FROM servers WHERE site_id=? ORDER BY id DESC").bind(p.site_id).all();items.push(...(rows.results||[]));}
   return json({ok:true,items});
  }

  if(action==="registry"){
   const linked=await env.database.prepare("SELECT site_id,hostname,title,status FROM cp_projects WHERE developer_id=? ORDER BY hostname").bind(account.developer_id).all();
   return json({ok:true,developer:accountJson(account),sites:linked.results||[]});
  }
  if(action==="developer"){
   if(method!=="POST")return json({ok:true,developer:accountJson(account)});
   const parsed=await readJsonLimited(request);if(!parsed.ok)return json({ok:false,error:parsed.error},parsed.status);
   const displayName=String(parsed.value.display_name||account.display_name).trim(),email=String(parsed.value.email||account.email).trim().toLowerCase();
   if(displayName.length<2||displayName.length>80||!email.includes("@")||!email.includes("."))return json({ok:false,error:"invalid_account_details"},400);
   try{await env.database.prepare("UPDATE cp_accounts SET display_name=?,email=?,updated_at=? WHERE developer_id=?").bind(displayName,email,now(),account.developer_id).run()}catch{return json({ok:false,error:"email_already_registered"},409)}
   return json({ok:true,developer:{...account,display_name:displayName,email}});
  }

  if(action==="workers"){
   const r=await env.database.prepare("SELECT * FROM cp_workers WHERE site_id IN (SELECT site_id FROM cp_projects WHERE developer_id=?) ORDER BY id DESC").bind(account.developer_id).all();
   return json({ok:true,items:r.results||[]});
  }

  if(action==="docs"){
   const r=await env.database.prepare("SELECT id,title,updated_at FROM cp_docs WHERE developer_id=? ORDER BY updated_at DESC").bind(account.developer_id).all();
   return json({ok:true,items:r.results||[]});
  }

  if(action==="import"){
   if(method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
   const parsedBody=await readJsonLimited(request);if(!parsedBody.ok)return json({ok:false,error:parsedBody.error},parsedBody.status);const b=parsedBody.value;
   let parsed;try{parsed=new URL(String(b.repo_url||""))}catch{return json({ok:false,error:"invalid_repo_url"},400)}
   if(parsed.hostname!=="github.com")return json({ok:false,error:"only_github_supported"},400);
   const parts=parsed.pathname.split("/").filter(Boolean);if(parts.length<2)return json({ok:false,error:"invalid_repo_url"},400);
   const owner=parts[0],repoName=parts[1].replace(/\.git$/,"");
   const tree=await fetch("https://api.github.com/repos/"+encodeURIComponent(owner)+"/"+encodeURIComponent(repoName)+"/git/trees/HEAD?recursive=1",{headers:{"accept":"application/vnd.github+json","user-agent":"Fairwas-CreatePage"}});
   if(!tree.ok)return json({ok:false,error:"repo_fetch_failed",detail:"GitHub returned "+tree.status},502);
   const data=await tree.json();
   const blobs=(data.tree||[]).filter(x=>x.type==="blob");
   const hasDist=blobs.some(x=>/^dist\//i.test(x.path)&&/\/index\.html$/i.test("/"+x.path));
   const hasBuild=blobs.some(x=>/^build\//i.test(x.path)&&/\/index\.html$/i.test("/"+x.path));
   const sourcePattern=/\.(html?|css|js|mjs|jsx|ts|tsx|json|md|svg|txt|webmanifest|png|jpe?g|gif|webp|avif|ico|bmp|woff2?|ttf|otf|eot|mp3|wav|ogg|mp4|webm|wasm|map)$/i;
   const selected=hasDist?blobs.filter(x=>/^dist\//i.test(x.path)):hasBuild?blobs.filter(x=>/^build\//i.test(x.path)):blobs.filter(x=>sourcePattern.test(x.path));
   const files=[];let importedBytes=0;
   for(const item of selected.slice(0,300)){
    if(!sourcePattern.test(item.path))continue;
    const raw=await fetch("https://raw.githubusercontent.com/"+encodeURIComponent(owner)+"/"+encodeURIComponent(repoName)+"/HEAD/"+item.path);
    if(!raw.ok)continue;
    let path="/"+item.path;
    if(hasDist)path="/"+item.path.replace(/^dist\//i,"");
    else if(hasBuild)path="/"+item.path.replace(/^build\//i,"");
    const type=raw.headers.get("content-type")||contentType(path);
    if(type.startsWith("text/")||/json|javascript|svg|xml/.test(type)){
     const content=await raw.text();importedBytes+=new TextEncoder().encode(content).byteLength;if(importedBytes>15*1024*1024)return json({ok:false,error:"import_too_large",max_bytes:15*1024*1024},413);files.push({path,content,content_type:contentType(path)});
    }else{
     const bytes=new Uint8Array(await raw.arrayBuffer());
     let binary="";
     for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
     importedBytes+=bytes.byteLength;if(importedBytes>15*1024*1024)return json({ok:false,error:"import_too_large",max_bytes:15*1024*1024},413);files.push({path,content:btoa(binary),content_type:contentType(path),encoding:"base64"});
    }
   }
   const title=repoName.replace(/[-_]+/g," ").replace(/\b\w/g,m=>m.toUpperCase());
   return json({ok:true,title,hostname:repoName.toLowerCase().replace(/[^a-z0-9-]/g,"-")+".fair",files,source_files:!hasDist&&!hasBuild,prebuilt:Boolean(hasDist||hasBuild)});
  }

  if(action==="site"){
   const siteId=String(u.searchParams.get("site_id")||"").trim();
   const hostname=String(u.searchParams.get("hostname")||"").trim().toLowerCase();
   const developer=account;
   if(!developer)return json({ok:false,error:"developer_not_registered"},403);
   const project=siteId?await env.database.prepare("SELECT * FROM cp_projects WHERE site_id=? LIMIT 1").bind(siteId).first():await env.database.prepare("SELECT * FROM cp_projects WHERE hostname=? LIMIT 1").bind(hostname).first();
   if(!project)return json({ok:false,error:"site_not_found"},404);
   if(project.developer_id!==developer.developer_id)return json({ok:false,error:"site_not_owned"},403);
   const site=await env.pages.prepare("SELECT * FROM sites WHERE site_id=? LIMIT 1").bind(project.site_id).first();
   const files=await env.pages.prepare("SELECT path,content_type,content,encoding FROM site_files WHERE site_id=? ORDER BY path").bind(project.site_id).all();
   return json({ok:true,site:site||project,project,files:files.results||[]});
  }

  if(action==="visits"){
   const siteId=String(u.searchParams.get("site_id")||"").trim();
   const developer=account;
   const project=siteId?await env.database.prepare("SELECT * FROM cp_projects WHERE site_id=? LIMIT 1").bind(siteId).first():null;
   if(!project)return json({ok:false,error:"site_not_found"},404);
   if(!developer||project.developer_id!==developer.developer_id)return json({ok:false,error:"site_not_owned"},403);
   await env.pages.prepare("CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT,url TEXT NOT NULL,protocol TEXT NOT NULL,visited_at TEXT NOT NULL)").run();
   await env.pages.prepare("CREATE INDEX IF NOT EXISTS idx_visits_id ON visits(id DESC)").run();
   const prefix="httc://"+project.hostname;
   const rows=await env.pages.prepare("SELECT id,url,visited_at FROM visits WHERE substr(url,1,?)=? ORDER BY id DESC").bind(prefix.length,prefix).all();
   const matched=(rows.results||[]).filter(v=>{try{const parsed=new URL(v.url);return parsed.hostname.toLowerCase()===project.hostname.toLowerCase()&&parsed.protocol==="httc:"}catch{return false}});
   const cutoff=Date.now()-30*24*60*60*1000;
   const recent=matched.filter(v=>Date.parse(v.visited_at)>=cutoff);
   return json({ok:true,hostname:project.hostname,total:matched.length,last30Days:recent.length,lastVisit:matched[0]?.visited_at||null,items:matched.slice(0,50).map(v=>({url:v.url,visited_at:v.visited_at}))});
  }

  if(action==="unpublish"){
   if(method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
   const parsedBody=await readJsonLimited(request);if(!parsedBody.ok)return json({ok:false,error:parsedBody.error},parsedBody.status);const b=parsedBody.value;
   const siteId=String(b.site_id||"").trim();
   const developer=account;
   const project=await env.database.prepare("SELECT * FROM cp_projects WHERE site_id=? LIMIT 1").bind(siteId).first();
   if(!project)return json({ok:false,error:"site_not_found"},404);
   if(!developer||project.developer_id!==developer.developer_id)return json({ok:false,error:"site_not_owned"},403);
   const stamp=now();
   await env.pages.prepare("UPDATE sites SET status='unpublished',updated_at=? WHERE site_id=?").bind(stamp,siteId).run();
   await env.server.prepare("UPDATE servers SET status='inactive',updated_at=? WHERE site_id=?").bind(stamp,siteId).run();
   await env.database.prepare("UPDATE cp_projects SET status='unpublished',updated_at=? WHERE site_id=?").bind(stamp,siteId).run();
   await env.database.prepare("INSERT INTO cp_deployments(site_id,version,status,created_at) VALUES(?,?,?,?)").bind(siteId,"unpublish-"+Date.now(),"unpublished",stamp).run();
   return json({ok:true,site_id:siteId,hostname:project.hostname,status:"unpublished"});
  }

  if(action==="delete-site"){
   if(method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
   const parsedBody=await readJsonLimited(request);if(!parsedBody.ok)return json({ok:false,error:parsedBody.error},parsedBody.status);const b=parsedBody.value;
   const siteId=String(b.site_id||"").trim();
   const developer=account;
   const project=await env.database.prepare("SELECT * FROM cp_projects WHERE site_id=? LIMIT 1").bind(siteId).first();
   if(!project)return json({ok:false,error:"site_not_found"},404);
   if(!developer||project.developer_id!==developer.developer_id)return json({ok:false,error:"site_not_owned"},403);
   const databases=await env.database.prepare("SELECT id FROM cp_page_databases WHERE site_id=?").bind(siteId).all();
   for(const db of databases.results||[]){
    const prefix="fwdb_"+siteId.replace(/[^a-zA-Z0-9]/g,"")+"_"+String(db.id).replace(/[^a-zA-Z0-9]/g,"")+"_";
    const tables=await env.database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND substr(name,1,?)=?").bind(prefix.length,prefix).all();
    if((tables.results||[]).length)await env.database.batch(tables.results.map(t=>env.database.prepare('DROP TABLE IF EXISTS "'+String(t.name).replace(/"/g,'""')+'"')));
   }
   await env.database.batch([
    env.database.prepare("DELETE FROM cp_page_databases WHERE site_id=?").bind(siteId),
    env.database.prepare("DELETE FROM cp_databases WHERE site_id=?").bind(siteId),
    env.database.prepare("DELETE FROM cp_workers WHERE site_id=?").bind(siteId),
    env.database.prepare("DELETE FROM cp_deployments WHERE site_id=?").bind(siteId),
    env.database.prepare("DELETE FROM cp_projects WHERE site_id=?").bind(siteId)
   ]);
   await env.pages.prepare("CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT,url TEXT NOT NULL,protocol TEXT NOT NULL,visited_at TEXT NOT NULL)").run();
   await env.pages.batch([
    env.pages.prepare("DELETE FROM site_files WHERE site_id=?").bind(siteId),
    env.pages.prepare("DELETE FROM sites WHERE site_id=?").bind(siteId),
    env.pages.prepare("DELETE FROM visits WHERE substr(url,1,?)=? AND (length(url)=? OR substr(url,?,1) IN ('/','?','#'))").bind(("httc://"+project.hostname).length,"httc://"+project.hostname,("httc://"+project.hostname).length,("httc://"+project.hostname).length+1)
   ]);
   await env.server.prepare("DELETE FROM servers WHERE site_id=?").bind(siteId).run();
   return json({ok:true,site_id:siteId,hostname:project.hostname,deleted:true});
  }

  if(action==="update"){
   if(method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
   const parsedBody=await readJsonLimited(request);if(!parsedBody.ok)return json({ok:false,error:parsedBody.error},parsedBody.status);const b=parsedBody.value;
   const siteId=String(b.site_id||"").trim();
   let hostname=String(b.hostname||"").trim().toLowerCase();
   const publishManifest=String(b.manifest||"");
   const planRow=await env.database.prepare("SELECT plan FROM cp_accounts WHERE developer_id=?").bind(account.developer_id).first();
   const plan=planRow?.plan||"Free";
   const manifestRule=publishManifest.match(/if\s+UserPlan\s*=\s*([A-Za-z0-9_-]+)\s+put\s+domain\s+["']([^"']+)["']/i);
   if(/getData\s*\*\s*UserPlan/i.test(publishManifest)&&manifestRule&&plan.toLowerCase()===manifestRule[1].toLowerCase()){
    const name=hostname.split(".")[0].normalize("NFKD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,45);
    hostname=manifestRule[2].replace(/\(name-web\)/gi,name+"-web").replace(/\(name\)/gi,name).toLowerCase();
   }
   const developer=account;
   if(!developer)return json({ok:false,error:"developer_not_registered"},403);
   const project=siteId?await env.database.prepare("SELECT * FROM cp_projects WHERE site_id=? LIMIT 1").bind(siteId).first():await env.database.prepare("SELECT * FROM cp_projects WHERE hostname=? LIMIT 1").bind(hostname).first();
   if(!project)return json({ok:false,error:"site_not_found"},404);
   if(project.developer_id!==developer.developer_id)return json({ok:false,error:"site_not_owned"},403);
   const resolvedId=project.site_id;
   const nextHostname=String(b.hostname||project.hostname).trim().toLowerCase();
   const nextTitle=String(b.title||project.title).trim()||project.title;
   if(!/^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?(?:\.[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?)+$/.test(nextHostname))return json({ok:false,error:"invalid_hostname"},400);
   const duplicate=await env.pages.prepare("SELECT site_id FROM sites WHERE hostname=? AND protocol='httc' AND site_id<>? LIMIT 1").bind(nextHostname,resolvedId).first();
   if(duplicate)return json({ok:false,error:"hostname_already_registered"},409);
   const incoming=Array.isArray(b.files)&&b.files.length?b.files:[{path:"/index.html",content:String(b.html||"")}];
   const stamp=now(),version="v"+Date.now();
   const validation=validatePublishFiles(incoming);if(!validation.ok)return json({ok:false,...validation},400);const normalized=validation.files;
   const oldFiles=await env.pages.prepare("SELECT path,content_type,content,encoding,updated_at FROM site_files WHERE site_id=?").bind(resolvedId).all();
   const oldSite=await env.pages.prepare("SELECT * FROM sites WHERE site_id=?").bind(resolvedId).first();
   const oldServer=await env.server.prepare("SELECT * FROM servers WHERE site_id=?").bind(resolvedId).first();
   try{
    await env.pages.batch([
     env.pages.prepare("DELETE FROM site_files WHERE site_id=?").bind(resolvedId),
     ...normalized.map(f=>env.pages.prepare("INSERT INTO site_files(site_id,path,content_type,content,encoding,updated_at) VALUES(?,?,?,?,?,?)").bind(resolvedId,f.path,f.content_type,String(f.content||""),f.encoding||null,stamp))
    ]);
    await env.pages.prepare("UPDATE sites SET hostname=?,title=?,status='published',updated_at=? WHERE site_id=?").bind(nextHostname,nextTitle,stamp,resolvedId).run();
    await env.server.prepare("UPDATE servers SET hostname=?,origin=?,status='active',updated_at=? WHERE site_id=?").bind(nextHostname,"pages://"+nextHostname,stamp,resolvedId).run();
    await env.database.batch([
     env.database.prepare("UPDATE cp_projects SET hostname=?,title=?,status='published',build_root=?,build_output=?,build_command=?,updated_at=? WHERE site_id=?").bind(nextHostname,nextTitle,String(b.build_root||project.build_root||"/"),String(b.build_output||project.build_output||"/dist"),String(b.build_command||project.build_command||"npm run build"),stamp,resolvedId),
     env.database.prepare("INSERT INTO cp_deployments(site_id,version,status,created_at) VALUES(?,?,?,?)").bind(resolvedId,version,"published",stamp)
    ]);
   }catch(e){
    try{
     await env.pages.prepare("DELETE FROM site_files WHERE site_id=?").bind(resolvedId).run();
     if(oldFiles.results?.length)await env.pages.batch(oldFiles.results.map(f=>env.pages.prepare("INSERT INTO site_files(site_id,path,content_type,content,encoding,updated_at) VALUES(?,?,?,?,?,?)").bind(resolvedId,f.path,f.content_type,f.content,f.encoding||null,f.updated_at)));
     if(oldSite)await env.pages.prepare("UPDATE sites SET hostname=?,title=?,status=?,updated_at=? WHERE site_id=?").bind(oldSite.hostname,oldSite.title,oldSite.status,oldSite.updated_at,resolvedId).run();
     if(oldServer)await env.server.prepare("UPDATE servers SET hostname=?,origin=?,status=?,updated_at=? WHERE site_id=?").bind(oldServer.hostname,oldServer.origin,oldServer.status,oldServer.updated_at,resolvedId).run();
     await env.database.prepare("UPDATE cp_projects SET hostname=?,title=?,status=?,build_root=?,build_output=?,build_command=?,updated_at=? WHERE site_id=?").bind(project.hostname,project.title,project.status,project.build_root,project.build_output,project.build_command,project.updated_at,resolvedId).run();
     await env.database.prepare("DELETE FROM cp_deployments WHERE site_id=? AND version=?").bind(resolvedId,version).run();
    }catch{}
    return json({ok:false,error:"update_failed",detail:String(e)},500);
   }
   return json({ok:true,site_id:resolvedId,hostname:nextHostname,url:"httc://"+nextHostname,version,status:"published"});
  }

  if(action==="create"){
   if(method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
   const parsedBody=await readJsonLimited(request);if(!parsedBody.ok)return json({ok:false,error:parsedBody.error},parsedBody.status);const b=parsedBody.value;
   let hostname=String(b.hostname||"").trim().toLowerCase();
   const publishManifest=String(b.manifest||"");
   const planRow=await env.database.prepare("SELECT plan FROM cp_accounts WHERE developer_id=?").bind(account.developer_id).first();
   const plan=planRow?.plan||"Free";
   const manifestRule=publishManifest.match(/if\s+UserPlan\s*=\s*([A-Za-z0-9_-]+)\s+put\s+domain\s+["']([^"']+)["']/i);
   if(/getData\s*\*\s*UserPlan/i.test(publishManifest)&&manifestRule&&plan.toLowerCase()===manifestRule[1].toLowerCase()){
    const name=hostname.split(".")[0].normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,45);
    hostname=manifestRule[2].replace(/\(name-web\)/gi,name+"-web").replace(/\(name\)/gi,name).toLowerCase();
   }
   const title=String(b.title||"").trim()||hostname;
   if(!hostname)return json({ok:false,error:"hostname_required"},400);
   if(!/^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?(?:\.[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?)+$/.test(hostname))return json({ok:false,error:"invalid_hostname"},400);
   const developer=account;
   if(!developer)return json({ok:false,error:"developer_not_registered",detail:"Registra primero tu cuenta en /registry."},403);

   const existingPage=await env.pages.prepare("SELECT site_id,status FROM sites WHERE hostname=? AND protocol='httc'").bind(hostname).first();
   if(existingPage)return json({ok:false,error:"hostname_already_registered",detail:"Ese dominio ya está registrado en Pages."},409);
   const existingServer=await env.server.prepare("SELECT site_id,status FROM servers WHERE hostname=? AND protocol='httc'").bind(hostname).first();
   if(existingServer)return json({ok:false,error:"hostname_already_registered",detail:"Ese dominio ya está registrado en Server."},409);

   const site_id=id(), stamp=now(), version="v1-"+Date.now();
   const html=String(b.html||"<!doctype html><html><head><meta charset=\"utf-8\"><title>"+title+"</title></head><body><main><h1>"+title+"</h1></main></body></html>");
   const origin="pages://"+hostname;
   try{
    const incoming=Array.isArray(b.build_files)&&b.build_files.length?b.build_files:(Array.isArray(b.files)&&b.files.length?b.files:[{path:"/index.html",content:html}]);
    const validation=validatePublishFiles(incoming);if(!validation.ok)return json({ok:false,...validation},400);const normalizedIncoming=validation.files;
    const fileStatements=normalizedIncoming.map(f=>env.pages.prepare("INSERT INTO site_files(site_id,path,content_type,content,encoding,updated_at) VALUES(?,?,?,?,?,?)").bind(site_id,String(f.path||"/index.html"),f.content_type||contentType(f.path),String(f.content||""),f.encoding||null,stamp));
    await env.pages.batch([
     env.pages.prepare("INSERT INTO sites(site_id,hostname,protocol,title,description,logo_url,framework,language,backend,runtime,database_type,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(site_id,hostname,"httc",title,b.description||"",b.logo_url||"",b.framework||"Custom",b.language||"HTML",b.backend||"None",b.runtime||"Cloudflare Pages",b.database_type||"None","publishing",stamp,stamp),
     ...fileStatements
    ]);
    await env.server.prepare("INSERT INTO servers(site_id,hostname,protocol,origin,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").bind(site_id,hostname,"httc",origin,"active",stamp,stamp).run();
    await env.database.batch([
     env.database.prepare("INSERT INTO cp_projects(site_id,hostname,title,developer_id,status,build_root,build_output,build_command,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(site_id,hostname,title,developer.developer_id,"published",String(b.build_root||"/"),String(b.build_output||"/dist"),String(b.build_command||"npm run build"),stamp,stamp),
     env.database.prepare("INSERT INTO cp_deployments(site_id,version,status,created_at) VALUES(?,?,?,?)").bind(site_id,version,"published",stamp)
    ]);
    if(typeof b.manifest==="string"&&b.manifest.trim()){
     await env.database.prepare("INSERT INTO cp_api_manifests(developer_id,manifest,updated_at) VALUES(?,?,?) ON CONFLICT(developer_id) DO UPDATE SET manifest=excluded.manifest,updated_at=excluded.updated_at").bind(developer.developer_id,b.manifest.slice(0,12000),now()).run();
    }
    if(b.database_name){
     await env.database.prepare("INSERT INTO cp_databases(site_id,name,engine,status,created_at) VALUES(?,?,?,?,?)").bind(site_id,b.database_name,"SQLite","registered",stamp).run();
    }
    await env.pages.prepare("UPDATE sites SET status='published',updated_at=? WHERE site_id=?").bind(now(),site_id).run();
    return json({ok:true,site_id,hostname,url:"httc://"+hostname,version,status:"published"});
   }catch(e){
    const detail=String(e);
    try{await env.pages.prepare("DELETE FROM site_files WHERE site_id=?").bind(site_id).run()}catch{}
    try{await env.pages.prepare("DELETE FROM sites WHERE site_id=?").bind(site_id).run()}catch{}
    try{await env.server.prepare("DELETE FROM servers WHERE site_id=?").bind(site_id).run()}catch{}
    try{await env.database.prepare("DELETE FROM cp_deployments WHERE site_id=?").bind(site_id).run()}catch{}
    try{await env.database.prepare("DELETE FROM cp_databases WHERE site_id=?").bind(site_id).run()}catch{}
    try{await env.database.prepare("DELETE FROM cp_projects WHERE site_id=?").bind(site_id).run()}catch{}
    return json({ok:false,error:"publish_failed",detail},500);
   }
  }

  return json({ok:false,error:"unknown_action"},404);
 }catch(e){const detail=String(e);return json({ok:false,error:"request_failed",detail:detail,code:/D1|SQLITE|no such table|constraint/i.test(detail)?"d1_error":"runtime_error"},500)}
}
