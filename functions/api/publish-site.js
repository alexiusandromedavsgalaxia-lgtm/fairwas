import { ensureAccountSchema, getAccount, accountSessionHash } from "./_account.js";
const json=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store","access-control-allow-origin":"*","access-control-allow-headers":"authorization,content-type","access-control-allow-methods":"GET,POST,OPTIONS"}});
const now=()=>new Date().toISOString();
const slug=value=>String(value||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,45);
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,"0")).join("");
async function schema(env){
 await ensureAccountSchema(env);
 await env.database.batch([
  env.database.prepare("CREATE TABLE IF NOT EXISTS fw_api_keys (id TEXT PRIMARY KEY,developer_id TEXT NOT NULL,name TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,last_used_at TEXT,revoked_at TEXT)"),
  env.database.prepare("CREATE INDEX IF NOT EXISTS idx_fw_api_keys_owner ON fw_api_keys(developer_id)")
 ]);
 await env.database.prepare("CREATE TABLE IF NOT EXISTS cp_api_manifests (developer_id TEXT PRIMARY KEY,manifest TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
 const accountColumns=await env.database.prepare("PRAGMA table_info(cp_accounts)").all();
 if(!(accountColumns.results||[]).some(column=>column.name==="plan"))await env.database.prepare("ALTER TABLE cp_accounts ADD COLUMN plan TEXT NOT NULL DEFAULT 'Free'").run();
 await env.database.prepare("CREATE TABLE IF NOT EXISTS cp_api_projects (site_id TEXT PRIMARY KEY,developer_id TEXT NOT NULL,hostname TEXT NOT NULL,manifest TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL)").run();
}
export function evaluatePublishManifest(source,requestedDomain,plan="Free"){
 const text=String(source||"");
 if(text.length>12000)return{ok:false,error:"manifest_too_large"};
 if(/<script|<!ENTITY|SYSTEM\s+["']/i.test(text))return{ok:false,error:"manifest_unsafe"};
 const getData=/getData\s*\*\s*UserPlan\s*,?/i.test(text);
 const rule=text.match(/if\s+UserPlan\s*=\s*([A-Za-z0-9_-]+)\s+put\s+domain\s+["']([^"']+)["']/i);
 let domain=String(requestedDomain||"").trim().toLowerCase();
 if(getData&&rule&&String(plan).toLowerCase()===rule[1].toLowerCase()){
  const template=rule[2],name=slug(domain.replace(/\.[^.]+\.[^.]+$/,"").split(".")[0]||domain);
  domain=template.replace(/\(name-web\)/gi,name+"-web").replace(/\(name\)/gi,name).toLowerCase();
 }
 if(!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain))return{ok:false,error:"invalid_domain"};
 if(String(plan).toLowerCase()==="free"&&!domain.endsWith(".aistudio.fair"))return{ok:false,error:"free_plan_domain_required",required_suffix:".aistudio.fair"};
 return{ok:true,domain,plan};
}
async function ownerForKey(request,env){
 const token=(request.headers.get("authorization")||"").match(/^Bearer\s+(fw_live_[a-f0-9]{64})$/i)?.[1];
 if(!token)return null;
 const tokenHash=await hash(token);
 const row=await env.database.prepare("SELECT id,developer_id FROM fw_api_keys WHERE token_hash=? AND revoked_at IS NULL").bind(tokenHash).first();
 if(!row)return null;
 await env.database.prepare("UPDATE fw_api_keys SET last_used_at=? WHERE id=?").bind(now(),row.id).run();
 return row;
}
async function publish(env,owner,body){
 const requested=String(body.domain||"").trim().toLowerCase();
 const account=await env.database.prepare("SELECT plan FROM cp_accounts WHERE developer_id=?").bind(owner.developer_id).first();
 const plan=account?.plan||"Free";
 const saved=await env.database.prepare("SELECT manifest FROM cp_api_manifests WHERE developer_id=?").bind(owner.developer_id).first();
 const manifest=String(body.manifest||saved?.manifest||"");
 const policy=evaluatePublishManifest(manifest,requested,plan);
 if(!policy.ok)return json(policy,400);
 const title=String(body.title||policy.domain).trim().slice(0,120)||policy.domain;
 const files=Array.isArray(body.files)?body.files:[{path:"/index.html",content:String(body.html||"")}];
 if(!files.length||files.length>300)return json({ok:false,error:"invalid_files",max_files:300},400);
 let total=0;const seen=new Set(),normalized=[];
 for(const f of files){
  if(!f||typeof f!=="object")return json({ok:false,error:"invalid_file"},400);
  let path="/"+String(f.path||"/index.html").replace(/\\/g,"/").replace(/^\/+/, "");
  if(path.length>1024||/[\u0000-\u001f?#]/.test(path)||path.split("/").some(p=>p==="."||p==="..")||seen.has(path))return json({ok:false,error:"invalid_file_path",path},400);
  seen.add(path);
  const content=String(f.content??"");total+=new TextEncoder().encode(content).length;
  if(total>15*1024*1024)return json({ok:false,error:"publish_too_large",max_bytes:15728640},413);
  const ext=path.toLowerCase().split(".").pop();
  const types={html:"text/html; charset=utf-8",htm:"text/html; charset=utf-8",css:"text/css; charset=utf-8",js:"text/javascript; charset=utf-8",json:"application/json; charset=utf-8",svg:"image/svg+xml",txt:"text/plain; charset=utf-8",xml:"application/xml; charset=utf-8",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",ico:"image/x-icon",woff2:"font/woff2",mp4:"video/mp4",webm:"video/webm"};
  normalized.push({path,content,content_type:String(f.content_type||types[ext]||"application/octet-stream"),encoding:f.encoding==="base64"?"base64":null});
 }
 if(!normalized.some(f=>f.path==="/index.html"))return json({ok:false,error:"index_html_required"},400);
 const stamp=now(),siteId=crypto.randomUUID(),version="api-"+Date.now();
 const exists=await env.pages.prepare("SELECT site_id FROM sites WHERE hostname=? AND protocol='httc'").bind(policy.domain).first();
 if(exists)return json({ok:false,error:"domain_already_registered"},409);
 const origin="pages://"+policy.domain;
 try{
  await env.pages.batch([
   env.pages.prepare("INSERT INTO sites(site_id,hostname,protocol,title,description,framework,language,backend,runtime,database_type,status,created_at,updated_at) VALUES(?,?,'httc',?,?,?,'API','Fairwas API','Cloudflare Pages','None','published',?,?)").bind(siteId,policy.domain,title,String(body.description||"").slice(0,500),String(body.framework||"External API"),stamp,stamp),
   ...normalized.map(f=>env.pages.prepare("INSERT INTO site_files(site_id,path,content_type,content,encoding,updated_at) VALUES(?,?,?,?,?,?)").bind(siteId,f.path,f.content,f.content_type,f.encoding,stamp))
  ]);
  await env.server.prepare("INSERT INTO servers(site_id,hostname,protocol,origin,status,created_at,updated_at) VALUES(?,?,'httc',?,'active',?,?)").bind(siteId,policy.domain,origin,stamp,stamp).run();
  await env.database.batch([
   env.database.prepare("INSERT INTO cp_projects(site_id,hostname,title,developer_id,status,build_root,build_output,build_command,created_at,updated_at) VALUES(?,?,?,?, 'published','/','/','API publish-site',?,?)").bind(siteId,policy.domain,title,owner.developer_id,stamp,stamp),
   env.database.prepare("INSERT INTO cp_deployments(site_id,version,status,created_at) VALUES(?,?, 'published',?)").bind(siteId,version,stamp),
   env.database.prepare("INSERT INTO cp_api_projects(site_id,developer_id,hostname,manifest,created_at) VALUES(?,?,?,?,?)").bind(siteId,owner.developer_id,policy.domain,manifest,stamp)
  ]);
  return json({ok:true,status:"published",site_id:siteId,domain:policy.domain,url:"httc://"+policy.domain,version,plan,files:normalized.length},201);
 }catch(error){
  try{await env.pages.prepare("DELETE FROM site_files WHERE site_id=?").bind(siteId).run();await env.pages.prepare("DELETE FROM sites WHERE site_id=?").bind(siteId).run();await env.server.prepare("DELETE FROM servers WHERE site_id=?").bind(siteId).run();await env.database.prepare("DELETE FROM cp_projects WHERE site_id=?").bind(siteId).run();await env.database.prepare("DELETE FROM cp_deployments WHERE site_id=?").bind(siteId).run();await env.database.prepare("DELETE FROM cp_api_projects WHERE site_id=?").bind(siteId).run()}catch{}
  return json({ok:false,error:"publish_failed",detail:String(error)},500);
 }
}
export async function handleApiFairRequest(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"authorization,content-type","access-control-allow-methods":"GET,POST,OPTIONS"}});
 try{
  await schema(env);
  if(path==="/api/publish-site"||path.endsWith("/publish-site")){
   if(request.method!=="POST")return json({ok:false,error:"method_not_allowed",docs:"httc://api.fair/docs/publish-site"},405);
   const owner=await ownerForKey(request,env);if(!owner)return json({ok:false,error:"invalid_api_key"},401);
   const size=Number(request.headers.get("content-length")||0);if(size>22*1024*1024)return json({ok:false,error:"request_too_large"},413);
   let body;try{body=await request.json()}catch{return json({ok:false,error:"invalid_json"},400)}
   return await publish(env,owner,body||{});
  }
  if(url.searchParams.get("action")==="keys"){
   const account=await getAccount(request,env);if(!account)return json({ok:false,error:"authentication_required"},401);
   if(request.method==="GET"){const rows=await env.database.prepare("SELECT id,name,created_at,last_used_at,revoked_at FROM fw_api_keys WHERE developer_id=? ORDER BY created_at DESC").bind(account.developer_id).all();return json({ok:true,keys:rows.results||[]})}
   if(request.method==="POST"){
    const body=await request.json().catch(()=>({})),name=String(body.name||"API key").trim().slice(0,80)||"API key",token="fw_live_"+Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join(""),id=crypto.randomUUID(),stamp=now();
    await env.database.prepare("INSERT INTO fw_api_keys(id,developer_id,name,token_hash,created_at) VALUES(?,?,?,?,?)").bind(id,account.developer_id,name,await hash(token),stamp).run();
    return json({ok:true,key:{id,name,created_at:stamp,token}},201);
   }
   return json({ok:false,error:"method_not_allowed"},405);
  }
  if(url.searchParams.get("action")==="revoke-key"&&request.method==="POST"){
   const account=await getAccount(request,env);if(!account)return json({ok:false,error:"authentication_required"},401);
   const body=await request.json().catch(()=>({}));const result=await env.database.prepare("UPDATE fw_api_keys SET revoked_at=? WHERE id=? AND developer_id=? AND revoked_at IS NULL").bind(now(),String(body.id||""),account.developer_id).run();
   return json({ok:true,revoked:Number(result.meta?.changes||0)>0});
  }
  return json({ok:false,error:"not_found",docs:"httc://api.fair/docs/publish-site"},404);
 }catch(error){return json({ok:false,error:"api_error",detail:String(error)},500)}
}

export async function onRequest({request,env}){return handleApiFairRequest(request,env)}
