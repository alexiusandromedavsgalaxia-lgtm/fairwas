const json=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store"}});
const stamp=()=>new Date().toISOString();
const validPath=p=>typeof p==="string"&&p.length<=180&&p.startsWith("/")&&!p.includes("?")&&!p.includes("#")&&!p.includes("//")&&!p.split("/").some(x=>x===".."||x===".");
async function schema(db){
 await db.prepare("CREATE TABLE IF NOT EXISTS fw_api_endpoints (id TEXT PRIMARY KEY,site_id TEXT NOT NULL,hostname TEXT NOT NULL,name TEXT NOT NULL,path TEXT NOT NULL,method TEXT NOT NULL,response_status INTEGER NOT NULL DEFAULT 200,response_json TEXT NOT NULL DEFAULT '{}',enabled INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(site_id,method,path))").run();
 await db.prepare("CREATE INDEX IF NOT EXISTS idx_fw_api_endpoints_route ON fw_api_endpoints(hostname,method,path,enabled)").run();
}
export async function onRequest({request,env}){
 if(!env.database||!env.pages)return json({ok:false,error:"api_binding_missing"},500);
 const url=new URL(request.url),action=url.searchParams.get("action")||"list";
 await schema(env.database);
 if(action==="list"){
  const siteId=String(url.searchParams.get("site_id")||"").trim();
  if(!siteId)return json({ok:false,error:"site_id_required"},400);
  const project=await env.database.prepare("SELECT site_id,hostname,developer_id FROM cp_projects WHERE site_id=? LIMIT 1").bind(siteId).first();
  const developer=await env.database.prepare("SELECT developer_id FROM cp_developers WHERE id=1").first();
  if(!project)return json({ok:false,error:"site_not_found"},404);
  if(!developer||project.developer_id!==developer.developer_id)return json({ok:false,error:"site_not_owned"},403);
  const rows=await env.database.prepare("SELECT id,site_id,hostname,name,path,method,response_status,response_json,enabled,created_at,updated_at FROM fw_api_endpoints WHERE site_id=? ORDER BY created_at DESC").bind(siteId).all();
  return json({ok:true,items:rows.results||[]});
 }
 if(request.method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
 let body;try{body=await request.json()}catch{return json({ok:false,error:"invalid_json"},400)}
 const siteId=String(body.site_id||"").trim(),developer=await env.database.prepare("SELECT developer_id FROM cp_developers WHERE id=1").first();
 const project=await env.database.prepare("SELECT site_id,hostname,developer_id FROM cp_projects WHERE site_id=? LIMIT 1").bind(siteId).first();
 if(!project)return json({ok:false,error:"site_not_found"},404);
 if(!developer||project.developer_id!==developer.developer_id)return json({ok:false,error:"site_not_owned"},403);
 if(action==="create"){
  const name=String(body.name||"").trim().slice(0,80),path=String(body.path||"").trim(),method=String(body.method||"GET").toUpperCase();
  const status=Number(body.response_status||200),raw=typeof body.response_json==="string"?body.response_json:JSON.stringify(body.response_json??{ok:true});
  if(!name)return json({ok:false,error:"endpoint_name_required"},400);
  if(!validPath(path)||path==="/")return json({ok:false,error:"invalid_endpoint_path",detail:"La ruta debe empezar por / y no incluir query, fragmentos ni segmentos .."} ,400);
  if(!["GET","POST","PUT","PATCH","DELETE"].includes(method))return json({ok:false,error:"invalid_method"},400);
  if(!Number.isInteger(status)||status<200||status>599)return json({ok:false,error:"invalid_status"},400);
  if(raw.length>16000)return json({ok:false,error:"response_too_large"},413);
  try{JSON.parse(raw)}catch{return json({ok:false,error:"invalid_response_json"},400)}
  const id=crypto.randomUUID(),time=stamp();
  try{await env.database.prepare("INSERT INTO fw_api_endpoints(id,site_id,hostname,name,path,method,response_status,response_json,enabled,created_at,updated_at) VALUES(?,?,?,?,?,?,?, ?,1,?,?)").bind(id,siteId,project.hostname,name,path,method,status,raw,time,time).run()}
  catch(e){if(/unique/i.test(String(e)))return json({ok:false,error:"endpoint_exists",detail:"Ya existe un endpoint con ese método y ruta."},409);throw e}
  return json({ok:true,endpoint:{id,site_id:siteId,hostname:project.hostname,name,path,method,response_status:status,response_json:raw,enabled:1,created_at:time,updated_at:time}},201);
 }
 if(action==="delete"){
  const id=String(body.id||"");
  const result=await env.database.prepare("DELETE FROM fw_api_endpoints WHERE id=? AND site_id=?").bind(id,siteId).run();
  if(!(result.meta?.changes>0))return json({ok:false,error:"endpoint_not_found"},404);
  return json({ok:true,deleted:id});
 }
 if(action==="toggle"){
  const id=String(body.id||""),enabled=body.enabled?1:0;
  const result=await env.database.prepare("UPDATE fw_api_endpoints SET enabled=?,updated_at=? WHERE id=? AND site_id=?").bind(enabled,stamp(),id,siteId).run();
  if(!(result.meta?.changes>0))return json({ok:false,error:"endpoint_not_found"},404);
  return json({ok:true,id,enabled});
 }
 return json({ok:false,error:"unknown_action"},400);
}
