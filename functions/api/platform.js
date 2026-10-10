const json=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store"}});
const now=()=>new Date().toISOString();
const clean=(v,n=120)=>String(v??"").trim().slice(0,n);
const slugOk=v=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(v);
const hostOk=v=>v.length<=253&&v.includes(".")&&v.split(".").every(x=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(x));
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");
async function hash(v){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,"0")).join("")}
async function schema(db){
 await db.batch([
  db.prepare("CREATE TABLE IF NOT EXISTS fw_platform_services(id TEXT PRIMARY KEY,developer_id TEXT NOT NULL,name TEXT NOT NULL,slug TEXT NOT NULL,service_type TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(developer_id,slug))"),
  db.prepare("CREATE TABLE IF NOT EXISTS fw_platform_domains(id TEXT PRIMARY KEY,service_id TEXT NOT NULL,hostname TEXT NOT NULL UNIQUE,kind TEXT NOT NULL DEFAULT 'api',created_at TEXT NOT NULL)"),
  db.prepare("CREATE INDEX IF NOT EXISTS idx_fw_platform_domains_service ON fw_platform_domains(service_id,hostname)"),
  db.prepare("CREATE TABLE IF NOT EXISTS fw_platform_keys(id TEXT PRIMARY KEY,service_id TEXT NOT NULL,label TEXT NOT NULL,key_prefix TEXT NOT NULL,key_hash TEXT NOT NULL,scopes_json TEXT NOT NULL DEFAULT '[]',created_at TEXT NOT NULL,revoked_at TEXT)"),
  db.prepare("CREATE INDEX IF NOT EXISTS idx_fw_platform_keys_service ON fw_platform_keys(service_id,created_at)"),
  db.prepare("CREATE TABLE IF NOT EXISTS fw_platform_routes(id TEXT PRIMARY KEY,service_id TEXT NOT NULL,method TEXT NOT NULL,path TEXT NOT NULL,status_code INTEGER NOT NULL DEFAULT 200,response_json TEXT NOT NULL DEFAULT '{}',auth_required INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(service_id,method,path))"),
  db.prepare("CREATE TABLE IF NOT EXISTS fw_platform_redirects(id TEXT PRIMARY KEY,service_id TEXT NOT NULL,source_uri TEXT NOT NULL,target_uri TEXT NOT NULL,status_code INTEGER NOT NULL DEFAULT 302,created_at TEXT NOT NULL,UNIQUE(service_id,source_uri))"),
  db.prepare("CREATE TABLE IF NOT EXISTS fw_platform_connections(id TEXT PRIMARY KEY,service_id TEXT NOT NULL,target_service_id TEXT NOT NULL,label TEXT NOT NULL,scopes_json TEXT NOT NULL DEFAULT '[]',status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL,UNIQUE(service_id,target_service_id))"),
  db.prepare("CREATE TABLE IF NOT EXISTS fw_platform_kv(service_id TEXT NOT NULL,key TEXT NOT NULL,value_json TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(service_id,key))")
 ]);
}
async function owner(db,serviceId,developerId){
 const row=await db.prepare("SELECT id,developer_id,name,slug,service_type,description,status,created_at,updated_at FROM fw_platform_services WHERE id=? AND developer_id=? LIMIT 1").bind(serviceId,developerId).first();
 return row||null;
}
export async function onRequest({request,env}){
 if(!env.database)return json({ok:false,error:"database_binding_missing"},500);
 await schema(env.database);
 const dev=await env.database.prepare("SELECT developer_id FROM cp_developers WHERE id=1").first();
 if(!dev)return json({ok:false,error:"developer_account_required",detail:"Registra primero tu cuenta de desarrollador en CreatePage."},403);
 const url=new URL(request.url),action=clean(url.searchParams.get("action"),40);
 if(action==="public-route")return json({ok:false,error:"use_runtime_router"},400);
 if(request.method==="GET"){
  if(action==="list"){
   const rows=await env.database.prepare("SELECT * FROM fw_platform_services WHERE developer_id=? ORDER BY created_at DESC").bind(dev.developer_id).all();
   const items=[];
   for(const s of rows.results||[]){
    const domains=await env.database.prepare("SELECT id,hostname,kind,created_at FROM fw_platform_domains WHERE service_id=? ORDER BY hostname").bind(s.id).all();
    const keys=await env.database.prepare("SELECT id,label,key_prefix,scopes_json,created_at,revoked_at FROM fw_platform_keys WHERE service_id=? ORDER BY created_at DESC").bind(s.id).all();
    const routes=await env.database.prepare("SELECT id,method,path,status_code,auth_required,created_at FROM fw_platform_routes WHERE service_id=? ORDER BY path,method").bind(s.id).all();
    const redirects=await env.database.prepare("SELECT id,source_uri,target_uri,status_code,created_at FROM fw_platform_redirects WHERE service_id=? ORDER BY source_uri").bind(s.id).all();
    const connections=await env.database.prepare("SELECT id,target_service_id,label,scopes_json,status,created_at FROM fw_platform_connections WHERE service_id=? ORDER BY created_at DESC").bind(s.id).all();
    items.push({...s,domains:domains.results||[],keys:keys.results||[],routes:routes.results||[],redirects:redirects.results||[],connections:connections.results||[]});
   }
   return json({ok:true,items});
  }
  return json({ok:false,error:"unknown_action"},400);
 }
 if(request.method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
 let b;try{b=await request.json()}catch{return json({ok:false,error:"invalid_json"},400)}
 const stamp=now(),serviceId=clean(b.service_id,80);
 if(action==="create"){
  const name=clean(b.name,80),slug=clean(b.slug||name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),64),type=clean(b.service_type,20),description=clean(b.description,500);
  if(!name||!slugOk(slug))return json({ok:false,error:"invalid_service",detail:"Pon un nombre y un identificador corto válido."},400);
  if(!["api","cloud","identity","storage","gateway"].includes(type))return json({ok:false,error:"invalid_service_type"},400);
  const id=crypto.randomUUID();
  try{await env.database.prepare("INSERT INTO fw_platform_services(id,developer_id,name,slug,service_type,description,status,created_at,updated_at) VALUES(?,?,?,?,?,?,'active',?,?)").bind(id,dev.developer_id,name,slug,type,description,stamp,stamp).run()}
  catch{return json({ok:false,error:"service_slug_exists",detail:"Ya existe un servicio con ese identificador."},409)}
  return json({ok:true,service:{id,developer_id:dev.developer_id,name,slug,service_type:type,description,status:"active",created_at:stamp,updated_at:stamp}},201);
 }
 const service=await owner(env.database,serviceId,dev.developer_id);
 if(!service)return json({ok:false,error:"service_not_found"},404);
 if(action==="delete"){
  await env.database.batch([
   env.database.prepare("DELETE FROM fw_platform_domains WHERE service_id=?").bind(serviceId),
   env.database.prepare("DELETE FROM fw_platform_keys WHERE service_id=?").bind(serviceId),
   env.database.prepare("DELETE FROM fw_platform_routes WHERE service_id=?").bind(serviceId),
   env.database.prepare("DELETE FROM fw_platform_redirects WHERE service_id=?").bind(serviceId),
   env.database.prepare("DELETE FROM fw_platform_connections WHERE service_id=? OR target_service_id=?").bind(serviceId,serviceId),
   env.database.prepare("DELETE FROM fw_platform_kv WHERE service_id=?").bind(serviceId),
   env.database.prepare("DELETE FROM fw_platform_services WHERE id=? AND developer_id=?").bind(serviceId,dev.developer_id)
  ]);
  return json({ok:true,deleted:serviceId});
 }
 if(action==="domain-create"){
  const hostname=clean(b.hostname,253).toLowerCase(),kind=clean(b.kind||"api",20);
  if(!hostOk(hostname)||!["api","auth","storage","app","custom"].includes(kind))return json({ok:false,error:"invalid_domain",detail:"Usa un hostname como api.mi-servicio.aploscabluchel."},400);
  const existing=await env.database.prepare("SELECT id FROM fw_platform_domains WHERE hostname=? LIMIT 1").bind(hostname).first();
  if(existing)return json({ok:false,error:"domain_taken"},409);
  const id=crypto.randomUUID();
  await env.database.prepare("INSERT INTO fw_platform_domains(id,service_id,hostname,kind,created_at) VALUES(?,?,?,?,?)").bind(id,serviceId,hostname,kind,stamp).run();
  return json({ok:true,domain:{id,service_id:serviceId,hostname,kind,created_at:stamp}},201);
 }
 if(action==="domain-delete"){
  const result=await env.database.prepare("DELETE FROM fw_platform_domains WHERE id=? AND service_id=?").bind(clean(b.id,80),serviceId).run();
  return result.meta?.changes?json({ok:true}):json({ok:false,error:"domain_not_found"},404);
 }
 if(action==="key-create"){
  const label=clean(b.label||"API key",80),scopes=Array.isArray(b.scopes)?b.scopes.map(x=>clean(x,40)).filter(Boolean).slice(0,30):["api:read"];
  const secret="fw_"+token(),id=crypto.randomUUID(),prefix=secret.slice(0,15);
  await env.database.prepare("INSERT INTO fw_platform_keys(id,service_id,label,key_prefix,key_hash,scopes_json,created_at) VALUES(?,?,?,?,?,?,?)").bind(id,serviceId,label,prefix,await hash(secret),JSON.stringify(scopes),stamp).run();
  return json({ok:true,key:{id,label,key_prefix:prefix,scopes,created_at:stamp,secret}},201);
 }
 if(action==="key-revoke"){
  const result=await env.database.prepare("UPDATE fw_platform_keys SET revoked_at=? WHERE id=? AND service_id=? AND revoked_at IS NULL").bind(stamp,clean(b.id,80),serviceId).run();
  return result.meta?.changes?json({ok:true}):json({ok:false,error:"key_not_found_or_revoked"},404);
 }
 if(action==="route-create"){
  const method=clean(b.method||"GET",10).toUpperCase(),path=clean(b.path,180),status=Number(b.status_code||200),raw=typeof b.response_json==="string"?b.response_json:JSON.stringify(b.response_json??{ok:true});
  if(!["GET","POST","PUT","PATCH","DELETE"].includes(method)||!path.startsWith("/")||path.length<2||path.includes("?")||path.includes("#")||path.includes("//")||path.split("/").some(x=>x===".."||x===".")||raw.length>16000||!Number.isInteger(status)||status<200||status>599)return json({ok:false,error:"invalid_route",detail:"Revisa método, ruta, código y JSON de respuesta."},400);
  try{JSON.parse(raw)}catch{return json({ok:false,error:"invalid_response_json"},400)}
  const id=crypto.randomUUID();
  try{await env.database.prepare("INSERT INTO fw_platform_routes(id,service_id,method,path,status_code,response_json,auth_required,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(id,serviceId,method,path,status,raw,b.auth_required?1:0,stamp,stamp).run()}
  catch{return json({ok:false,error:"route_exists"},409)}
  return json({ok:true,route:{id,service_id:serviceId,method,path,status_code:status,response_json:raw,auth_required:Boolean(b.auth_required),created_at:stamp}},201);
 }
 if(action==="route-delete"){
  const result=await env.database.prepare("DELETE FROM fw_platform_routes WHERE id=? AND service_id=?").bind(clean(b.id,80),serviceId).run();
  return result.meta?.changes?json({ok:true}):json({ok:false,error:"route_not_found"},404);
 }
 if(action==="redirect-create"){
  const source=clean(b.source_uri,300),target=clean(b.target_uri,1000),status=Number(b.status_code||302);
  if(!source.startsWith("/")||source.startsWith("//")||source.includes("#")||!/^httc:\/\//i.test(target)||![301,302,307,308].includes(status))return json({ok:false,error:"invalid_redirect",detail:"La ruta origen debe empezar por / y el destino debe ser una URI httc://."},400);
  const id=crypto.randomUUID();
  try{await env.database.prepare("INSERT INTO fw_platform_redirects(id,service_id,source_uri,target_uri,status_code,created_at) VALUES(?,?,?,?,?,?)").bind(id,serviceId,source,target,status,stamp).run()}
  catch{return json({ok:false,error:"redirect_exists"},409)}
  return json({ok:true,redirect:{id,service_id:serviceId,source_uri:source,target_uri:target,status_code:status,created_at:stamp}},201);
 }
 if(action==="redirect-delete"){
  const result=await env.database.prepare("DELETE FROM fw_platform_redirects WHERE id=? AND service_id=?").bind(clean(b.id,80),serviceId).run();
  return result.meta?.changes?json({ok:true}):json({ok:false,error:"redirect_not_found"},404);
 }
 if(action==="connection-create"){
  const targetId=clean(b.target_service_id,80),label=clean(b.label||"Service connection",80),scopes=Array.isArray(b.scopes)?b.scopes.map(x=>clean(x,40)).filter(Boolean).slice(0,30):[];
  if(targetId===serviceId||!await owner(env.database,targetId,dev.developer_id))return json({ok:false,error:"target_service_not_found",detail:"Las conexiones entre servicios disponibles deben pertenecer a tu espacio de desarrollador."},400);
  const id=crypto.randomUUID();
  try{await env.database.prepare("INSERT INTO fw_platform_connections(id,service_id,target_service_id,label,scopes_json,status,created_at) VALUES(?,?,?,?,?,'active',?)").bind(id,serviceId,targetId,label,JSON.stringify(scopes),stamp).run()}
  catch{return json({ok:false,error:"connection_exists"},409)}
  return json({ok:true,connection:{id,service_id:serviceId,target_service_id:targetId,label,scopes,status:"active",created_at:stamp}},201);
 }
 if(action==="connection-delete"){
  const result=await env.database.prepare("DELETE FROM fw_platform_connections WHERE id=? AND service_id=?").bind(clean(b.id,80),serviceId).run();
  return result.meta?.changes?json({ok:true}):json({ok:false,error:"connection_not_found"},404);
 }
 if(action==="storage-set"){
  const key=clean(b.key,180);
  if(!key||key.includes("..")||key.startsWith("_system/"))return json({ok:false,error:"invalid_storage_key"},400);
  const raw=JSON.stringify(b.value);
  if(raw.length>256000)return json({ok:false,error:"value_too_large"},413);
  await env.database.prepare("INSERT INTO fw_platform_kv(service_id,key,value_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(service_id,key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at").bind(serviceId,key,raw,stamp).run();
  return json({ok:true,key,updated_at:stamp});
 }
 if(action==="storage-get"){
  const key=clean(b.key,180);
  const row=await env.database.prepare("SELECT value_json,updated_at FROM fw_platform_kv WHERE service_id=? AND key=?").bind(serviceId,key).first();
  if(!row)return json({ok:false,error:"key_not_found"},404);
  let value;try{value=JSON.parse(row.value_json)}catch{value=null}
  return json({ok:true,key,value,updated_at:row.updated_at});
 }
 if(action==="storage-delete"){
  const result=await env.database.prepare("DELETE FROM fw_platform_kv WHERE service_id=? AND key=?").bind(serviceId,clean(b.key,180)).run();
  return result.meta?.changes?json({ok:true}):json({ok:false,error:"key_not_found"},404);
 }
 if(action==="service-status"){
  const status=b.status==="paused"?"paused":b.status==="active"?"active":null;
  if(!status)return json({ok:false,error:"invalid_status"},400);
  await env.database.prepare("UPDATE fw_platform_services SET status=?,updated_at=? WHERE id=? AND developer_id=?").bind(status,stamp,serviceId,dev.developer_id).run();
  return json({ok:true,status});
 }
 return json({ok:false,error:"unknown_action"},400);
}
