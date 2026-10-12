const SERVER_INFO={name:"fairwas-mcp",version:"1.0.0"};
const PROTOCOL_VERSION="2025-03-26";
const MAX_FILES=300,MAX_BYTES=15*1024*1024;
const TOOLS=[
 {name:"list_sites",description:"Lista los sitios Fairwas de la cuenta de desarrollador conectada.",inputSchema:{type:"object",properties:{},additionalProperties:false}},
 {name:"list_files",description:"Lista los archivos publicados de un sitio propio.",inputSchema:{type:"object",properties:{site_id:{type:"string",description:"ID del sitio"}},required:["site_id"],additionalProperties:false}},
 {name:"read_file",description:"Lee un archivo de un sitio propio.",inputSchema:{type:"object",properties:{site_id:{type:"string"},path:{type:"string"}},required:["site_id","path"],additionalProperties:false}},
 {name:"write_file",description:"Crea o actualiza un archivo publicado en un sitio propio. Los cambios se guardan en Fairwas.",inputSchema:{type:"object",properties:{site_id:{type:"string"},path:{type:"string"},content:{type:"string"},content_type:{type:"string"},encoding:{type:"string",enum:["utf-8","base64"]}},required:["site_id","path","content"],additionalProperties:false}},
 {name:"publish_site",description:"Publica un sitio nuevo o reemplaza los archivos de un sitio propio. Para crear, indica hostname, title y files. Para actualizar, indica site_id y files.",inputSchema:{type:"object",properties:{site_id:{type:"string"},hostname:{type:"string"},title:{type:"string"},description:{type:"string"},framework:{type:"string"},language:{type:"string"},backend:{type:"string"},runtime:{type:"string"},database_type:{type:"string"},files:{type:"array",minItems:1,maxItems:MAX_FILES,items:{type:"object",properties:{path:{type:"string"},content:{type:"string"},content_type:{type:"string"},encoding:{type:"string",enum:["utf-8","base64"]}},required:["path","content"],additionalProperties:false}}},required:["files"],additionalProperties:false}}
];
function response(body,status=200){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","access-control-allow-origin":"*","access-control-allow-headers":"authorization,content-type,mcp-protocol-version","access-control-allow-methods":"POST,OPTIONS"}})}
function rpcError(id,code,message,data){return{jsonrpc:"2.0",id,error:{code,message,...(data===undefined?{}:{data})}}}
function cleanPath(value){const raw=String(value||"").replace(/\\/g,"/");if(!raw.startsWith("/")||raw.length>1024||/[\u0000-\u001f?#]/.test(raw)||raw.split("/").some(part=>part===".."||part==="."))return null;return raw.replace(/\/{2,}/g,"/")}
function mime(path){const ext=String(path).toLowerCase().split(".").pop();return ({html:"text/html; charset=utf-8",htm:"text/html; charset=utf-8",css:"text/css; charset=utf-8",js:"text/javascript; charset=utf-8",mjs:"text/javascript; charset=utf-8",json:"application/json; charset=utf-8",svg:"image/svg+xml",txt:"text/plain; charset=utf-8",xml:"application/xml; charset=utf-8",csv:"text/csv; charset=utf-8",pdf:"application/pdf",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp",ico:"image/x-icon",woff:"font/woff",woff2:"font/woff2",ttf:"font/ttf",otf:"font/otf",mp3:"audio/mpeg",mp4:"video/mp4",webm:"video/webm"}[ext]||"application/octet-stream")}
function hostnameValid(value){return /^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?(?:\.[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?)+$/.test(value)}
function decodeFileContent(file){const value=String(file.content??"");if(file.encoding!=="base64")return value;try{const binary=atob(value),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return bytes}catch{return null}}
function fileBytes(file){if(file.encoding==="base64"){try{return atob(String(file.content||"")).length}catch{return Infinity}}return new TextEncoder().encode(String(file.content||"")).byteLength}
function normalizeFiles(input){
 if(!Array.isArray(input)||!input.length)return{error:"files_required"};
 if(input.length>MAX_FILES)return{error:"too_many_files"};
 const seen=new Set();let total=0;const files=[];
 for(const item of input){
  if(!item||typeof item!=="object")return{error:"invalid_file"};
  const path=cleanPath(item.path);if(!path)return{error:"invalid_file_path",path:item.path};
  if(seen.has(path))return{error:"duplicate_file_path",path};seen.add(path);
  const encoding=item.encoding==="base64"?"base64":null;
  const content=String(item.content??"");
  if(encoding&&decodeFileContent({...item,content})===null)return{error:"invalid_base64",path};
  total+=fileBytes({...item,content,encoding});
  if(!Number.isFinite(total)||total>MAX_BYTES)return{error:"publish_too_large",max_bytes:MAX_BYTES};
  files.push({path,content,encoding,content_type:String(item.content_type||mime(path))});
 }
 return{files};
}
async function readJson(request){const len=Number(request.headers.get("content-length")||0);if(len>22*1024*1024)return null;try{return await request.json()}catch{return null}}
async function getDeveloper(env){if(!env.database)return null;return await env.database.prepare("SELECT developer_id FROM cp_developers WHERE id=1").first()}
async function ownedProject(env,siteId,developer){if(!siteId||!developer)return null;const project=await env.database.prepare("SELECT * FROM cp_projects WHERE site_id=? LIMIT 1").bind(siteId).first();return project&&project.developer_id===developer.developer_id?project:null}
async function runTool(name,args,env){
 if(!env.database||!env.pages||!env.server)throw new Error("Faltan los bindings D1 database, pages o server.");
 const developer=await getDeveloper(env);if(!developer)throw new Error("developer_not_registered");
 if(name==="list_sites"){
  const rows=await env.database.prepare("SELECT site_id,hostname,title,status,updated_at FROM cp_projects WHERE developer_id=? ORDER BY updated_at DESC").bind(developer.developer_id).all();
  return rows.results||[];
 }
 if(name==="list_files"||name==="read_file"){
  const siteId=String(args.site_id||"").trim(),project=await ownedProject(env,siteId,developer);if(!project)throw new Error("site_not_found_or_not_owned");
  const files=await env.pages.prepare("SELECT path,content_type,content,encoding,updated_at FROM site_files WHERE site_id=? ORDER BY path").bind(siteId).all();
  if(name==="list_files")return(files.results||[]).map(f=>({path:f.path,content_type:f.content_type,encoding:f.encoding||"utf-8",updated_at:f.updated_at}));
  const path=cleanPath(args.path);if(!path)throw new Error("invalid_file_path");
  const file=(files.results||[]).find(f=>f.path===path);if(!file)throw new Error("file_not_found");
  return file;
 }
 if(name==="write_file"){
  const siteId=String(args.site_id||"").trim(),project=await ownedProject(env,siteId,developer);if(!project)throw new Error("site_not_found_or_not_owned");
  const path=cleanPath(args.path);if(!path)throw new Error("invalid_file_path");
  const encoding=args.encoding==="base64"?"base64":null,content=String(args.content??"");
  const normalized=normalizeFiles([{path,content,content_type:args.content_type||mime(path),encoding:encoding||undefined}]);if(normalized.error)throw new Error(normalized.error);
  const f=normalized.files[0],stamp=new Date().toISOString();
  await env.pages.prepare("DELETE FROM site_files WHERE site_id=? AND path=?").bind(siteId,path).run();
  await env.pages.prepare("INSERT INTO site_files(site_id,path,content_type,content,encoding,updated_at) VALUES(?,?,?,?,?,?)").bind(siteId,path,f.content_type,f.content,f.encoding,stamp).run();
  await env.pages.prepare("UPDATE sites SET status='published',updated_at=? WHERE site_id=?").bind(stamp,siteId).run();
  await env.database.prepare("UPDATE cp_projects SET status='published',updated_at=? WHERE site_id=?").bind(stamp,siteId).run();
  await env.database.prepare("INSERT INTO cp_deployments(site_id,version,status,created_at) VALUES(?,?,?,?)").bind(siteId,"mcp-"+Date.now(),"published",stamp).run();
  return{ok:true,site_id:siteId,hostname:project.hostname,path,url:"httc://"+project.hostname+(path==="/index.html"?"/":path),updated_at:stamp};
 }
 if(name==="publish_site"){
  const normalized=normalizeFiles(args.files);if(normalized.error)throw new Error(normalized.error);
  const files=normalized.files,stamp=new Date().toISOString(),siteId=String(args.site_id||"").trim();
  if(siteId){
   const project=await ownedProject(env,siteId,developer);if(!project)throw new Error("site_not_found_or_not_owned");
   const existing=await env.pages.prepare("SELECT * FROM sites WHERE site_id=? LIMIT 1").bind(siteId).first();
   const statements=[env.pages.prepare("DELETE FROM site_files WHERE site_id=?").bind(siteId),...files.map(f=>env.pages.prepare("INSERT INTO site_files(site_id,path,content_type,content,encoding,updated_at) VALUES(?,?,?,?,?,?)").bind(siteId,f.path,f.content_type,f.content,f.encoding,stamp))];
   await env.pages.batch(statements);
   await env.pages.prepare("UPDATE sites SET title=?,description=?,status='published',updated_at=? WHERE site_id=?").bind(String(args.title||project.title),String(args.description||existing?.description||""),stamp,siteId).run();
   await env.database.prepare("UPDATE cp_projects SET title=?,status='published',updated_at=? WHERE site_id=?").bind(String(args.title||project.title),stamp,siteId).run();
   await env.database.prepare("INSERT INTO cp_deployments(site_id,version,status,created_at) VALUES(?,?,?,?)").bind(siteId,"mcp-"+Date.now(),"published",stamp).run();
   return{ok:true,site_id:siteId,hostname:project.hostname,url:"httc://"+project.hostname,status:"published",files:files.length};
  }
  const hostname=String(args.hostname||"").trim().toLowerCase();
  if(!hostnameValid(hostname))throw new Error("invalid_hostname");
  const title=String(args.title||hostname).trim().slice(0,200),description=String(args.description||"").slice(0,2000);
  const duplicate=await env.pages.prepare("SELECT site_id FROM sites WHERE hostname=? AND protocol='httc' LIMIT 1").bind(hostname).first();
  if(duplicate)throw new Error("hostname_already_registered");
  const site_id=crypto.randomUUID(),version="mcp-"+Date.now(),origin="pages://"+hostname;
  await env.pages.batch([
   env.pages.prepare("INSERT INTO sites(site_id,hostname,protocol,title,description,logo_url,framework,language,backend,runtime,database_type,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(site_id,hostname,"httc",title,description,"",String(args.framework||"Custom"),String(args.language||"HTML"),String(args.backend||"None"),String(args.runtime||"Cloudflare Pages"),String(args.database_type||"None"),"published",stamp,stamp),
   ...files.map(f=>env.pages.prepare("INSERT INTO site_files(site_id,path,content_type,content,encoding,updated_at) VALUES(?,?,?,?,?,?)").bind(site_id,f.path,f.content_type,f.content,f.encoding,stamp))
  ]);
  try{
   await env.server.prepare("INSERT INTO servers(site_id,hostname,protocol,origin,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").bind(site_id,hostname,"httc",origin,"active",stamp,stamp).run();
   await env.database.batch([
    env.database.prepare("INSERT INTO cp_projects(site_id,hostname,title,developer_id,status,build_root,build_output,build_command,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(site_id,hostname,title,developer.developer_id,"published","/","/dist","",stamp,stamp),
    env.database.prepare("INSERT INTO cp_deployments(site_id,version,status,created_at) VALUES(?,?,?,?)").bind(site_id,version,"published",stamp)
   ]);
  }catch(error){
   try{await env.pages.prepare("DELETE FROM site_files WHERE site_id=?").bind(site_id).run();await env.pages.prepare("DELETE FROM sites WHERE site_id=?").bind(site_id).run();await env.server.prepare("DELETE FROM servers WHERE site_id=?").bind(site_id).run()}catch{}
   throw error;
  }
  return{ok:true,site_id,hostname,url:"httc://"+hostname,status:"published",files:files.length};
 }
 throw new Error("unknown_tool: "+name);
}
export async function onRequestOptions(){return new Response(null,{status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"authorization,content-type,mcp-protocol-version","access-control-allow-methods":"POST,OPTIONS"}})}
export async function onRequestPost({request,env}){
 const expected=String(env.MCP_TOKEN||"");
 const auth=String(request.headers.get("authorization")||"");
 if(!expected)return response({error:"mcp_not_configured",detail:"Configura el secreto MCP_TOKEN en Cloudflare Pages."},503);
 if(!auth.startsWith("Bearer ")||auth.slice(7)!==expected)return response({error:"unauthorized",detail:"Falta un Bearer token MCP válido."},401);
 const body=await readJson(request);if(!body||body.jsonrpc!=="2.0"||typeof body.method!=="string")return response(rpcError(body?.id??null,-32600,"Invalid Request"),400);
 const id=body.id??null,method=body.method;
 if(method==="notifications/initialized")return new Response(null,{status:202,headers:{"access-control-allow-origin":"*"}});
 if(method==="initialize")return response({jsonrpc:"2.0",id,result:{protocolVersion:PROTOCOL_VERSION,capabilities:{tools:{}},serverInfo:SERVER_INFO,instructions:"Fairwas MCP permite consultar y editar archivos y publicar sitios de la cuenta de desarrollador autenticada. Confirma con el usuario antes de operaciones destructivas."}});
 if(method==="ping")return response({jsonrpc:"2.0",id,result:{}});
 if(method==="tools/list")return response({jsonrpc:"2.0",id,result:{tools:TOOLS}});
 if(method==="tools/call"){
  const params=body.params||{},name=String(params.name||""),tool=TOOLS.find(t=>t.name===name);
  if(!tool)return response(rpcError(id,-32602,"Unknown tool"));
  try{
   const result=await runTool(name,params.arguments||{},env);
   return response({jsonrpc:"2.0",id,result:{content:[{type:"text",text:JSON.stringify(result)}],structuredContent:result,isError:false}});
  }catch(error){return response({jsonrpc:"2.0",id,result:{content:[{type:"text",text:String(error?.message||error)}],isError:true}})}
 }
 return response(rpcError(id,-32601,"Method not found"));
}
