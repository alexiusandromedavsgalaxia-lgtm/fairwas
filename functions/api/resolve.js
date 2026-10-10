import { rewriteCssUrls, rewriteJavaScriptImports, rewriteJavaScriptLocationRedirects, transformHtmlDocument } from "../../src/runtime/parsers.js";
const ALLOWED=new Set(["httc"]);
const DESCRIPTION="Fairwas global web protocol";
function contentType(path){const p=String(path||"").toLowerCase(),ext=p.includes(".")?p.slice(p.lastIndexOf(".")):"";return ({".html":"text/html; charset=utf-8",".htm":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".cjs":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".csv":"text/csv; charset=utf-8",".pdf":"application/pdf",".svg":"image/svg+xml",".txt":"text/plain; charset=utf-8",".xml":"application/xml; charset=utf-8",".webmanifest":"application/manifest+json",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".gif":"image/gif",".webp":"image/webp",".avif":"image/avif",".ico":"image/x-icon",".bmp":"image/bmp",".woff":"font/woff",".woff2":"font/woff2",".ttf":"font/ttf",".otf":"font/otf",".eot":"application/vnd.ms-fontobject",".mp3":"audio/mpeg",".m4a":"audio/mp4",".aac":"audio/aac",".flac":"audio/flac",".mid":"audio/midi",".midi":"audio/midi",".wav":"audio/wav",".ogg":"audio/ogg",".mp4":"video/mp4",".m4v":"video/x-m4v",".mov":"video/quicktime",".3gp":"video/3gpp",".webm":"video/webm",".wasm":"application/wasm",".map":"application/json"}[ext]||"application/octet-stream");}
async function ensureServerSchema(env){if(!env.server)return false;await env.server.prepare("CREATE TABLE IF NOT EXISTS servers (id INTEGER PRIMARY KEY AUTOINCREMENT,site_id TEXT,hostname TEXT NOT NULL UNIQUE,protocol TEXT NOT NULL DEFAULT 'httc',origin TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run();await env.server.prepare("CREATE INDEX IF NOT EXISTS idx_servers_protocol_hostname ON servers(protocol,hostname)").run();return true;}
function escRe(value){return String(value).replace(/[.*+?^$()|[\]\\]/g,"\\$&");}
function dataUrl(file){if(file.encoding!=="base64")return null;return "data:"+(file.content_type||contentType(file.path))+";base64,"+file.content;}
async function ensurePagesSchema(env){
 if(!env.pages)return false;
 await env.pages.prepare("CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT,url TEXT NOT NULL,protocol TEXT NOT NULL,visited_at TEXT NOT NULL)").run();
 await env.pages.prepare("CREATE INDEX IF NOT EXISTS idx_visits_id ON visits(id DESC)").run();
 await env.pages.prepare("CREATE TABLE IF NOT EXISTS sites (site_id TEXT PRIMARY KEY,hostname TEXT NOT NULL UNIQUE,protocol TEXT NOT NULL DEFAULT 'httc',title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',logo_url TEXT,framework TEXT,language TEXT,backend TEXT,runtime TEXT,database_type TEXT,status TEXT NOT NULL DEFAULT 'draft',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
 await env.pages.prepare("CREATE TABLE IF NOT EXISTS site_files (id INTEGER PRIMARY KEY AUTOINCREMENT,site_id TEXT NOT NULL,path TEXT NOT NULL,content_type TEXT NOT NULL,content TEXT NOT NULL,encoding TEXT,updated_at TEXT NOT NULL,UNIQUE(site_id,path))").run();
 const columns=await env.pages.prepare("PRAGMA table_info(site_files)").all();const names=new Set((columns.results||[]).map(x=>x.name));if(!names.has("encoding"))await env.pages.prepare("ALTER TABLE site_files ADD COLUMN encoding TEXT").run();
 return true;
}
export function assetEndpoint(hostname,path,search=""){
 const cleanPath=String(path||"/").startsWith("/")?String(path||"/"):"/"+String(path||"/");
 const query=String(search||"").startsWith("?")?String(search||""):(search?"?"+search:"");
 return "/api/resolve?url="+encodeURIComponent("httc://"+hostname+cleanPath+query)+"&asset="+encodeURIComponent(cleanPath);
}
export function moduleAssetUrl(hostname,raw,basePath){
 if(!/^(?:\.\.?\/|\/(?!\/))/.test(String(raw||"")))return null;
 try{
  const url=new URL(raw,"https://fairwas.invalid"+(basePath.startsWith("/")?basePath:"/"+basePath));
  if(url.origin!=="https://fairwas.invalid")return null;
  return assetEndpoint(hostname,url.pathname,url.search);
 }catch{return null}
}
export function rewriteSrcset(value,rewrite){
 const input=String(value||"");let i=0;const output=[];
 while(i<input.length){
  while(i<input.length&&(input[i]===","||/\s/.test(input[i])))i++;
  if(i>=input.length)break;
  const start=i;while(i<input.length&&!/\s/.test(input[i]))i++;
  let url=input.slice(start,i),endedWithComma=false;
  while(url.endsWith(",")){endedWithComma=true;url=url.slice(0,-1)}
  let descriptor="";
  if(!endedWithComma){
   while(i<input.length&&/\s/.test(input[i]))i++;
   const descriptorStart=i;while(i<input.length&&input[i]!==",")i++;
   descriptor=input.slice(descriptorStart,i).trim();
   if(i<input.length)i++;
  }
  if(!url)continue;
  const rewritten=typeof rewrite==="function"?rewrite(url):null;
  output.push((rewritten||url)+(descriptor?" "+descriptor:""));
 }
 return output.join(", ");
}
export function rewriteModuleImports(source,hostname,basePath){
 return rewriteJavaScriptImports(source,raw=>moduleAssetUrl(hostname,raw,basePath));
}
async function renderSiteHtml(siteId,html,env,htmlPath="/index.html",hostname=""){
 const rows=await env.pages.prepare("SELECT path,content_type,content,encoding FROM site_files WHERE site_id=?").bind(siteId).all();
 const files=rows.results||[];
 const fileByPath=new Map(files.map(file=>[String(file.path||""),file]));
 const binaryUrls=new Map();
 for(const asset of files){const url=dataUrl(asset);if(url)binaryUrls.set(String(asset.path||""),url)}
 const baseUrl=(basePath)=>/^https?:\/\//i.test(String(basePath||""))?String(basePath):"https://fairwas.invalid"+(String(basePath||"/").startsWith("/")?String(basePath||"/"):"/"+String(basePath||"/"));
 const normalizeAsset=(raw,basePath)=>{
  try{const url=new URL(String(raw||""),baseUrl(basePath));if(url.origin!=="https://fairwas.invalid")return null;return url.pathname}catch{return null}
 };
 const assetUrl=(raw,basePath)=>{
  const path=normalizeAsset(raw,basePath);
  if(!path||!fileByPath.has(path))return null;
  const binary=binaryUrls.get(path);
  if(binary)return binary;
  let search="";try{search=new URL(String(raw||""),baseUrl(basePath)).search}catch{}
  return assetEndpoint(hostname,path,search);
 };
 const replaceResourceRefs=(text,basePath)=>{
  if(/\.css(?:$|[?#])/i.test(String(basePath||"")))return rewriteCssUrls(text,raw=>{
   if(/^(?:data:|blob:|https?:|\/\/|#)/i.test(String(raw||"").trim()))return null;
   return assetUrl(String(raw||"").trim(),basePath);
  });
  let result=String(text||"");
  result=result.replace(/((?:src|poster|data-src|xlink:href|data|cite|background)\s*=\s*["'])([^"']+)(["'])/gi,(all,prefix,raw,suffix)=>{
   if(/^(?:data:|blob:|javascript:|https?:|\/\/|#)/i.test(raw.trim()))return all;
   const value=assetUrl(raw,basePath);return value?prefix+value+suffix:all;
  });
  result=result.replace(/(srcset\s*=\s*["'])([^"']+)(["'])/gi,(all,prefix,value,suffix)=>{
   const rewritten=rewriteSrcset(value,raw=>/^(?:data:|blob:|https?:|\/\/|#)/i.test(raw)?null:assetUrl(raw,basePath));
   return prefix+rewritten+suffix;
  });
  result=result.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi,(all,q,raw)=>{
   if(/^(?:data:|blob:|https?:|\/\/|#)/i.test(raw.trim()))return all;
   const value=assetUrl(raw.trim(),basePath);return value?"url("+q+value+q+")":all;
  });
  result=result.replace(/(@import\s+(?:url\(\s*)?)(["'])([^"']+)\2(\s*\)?)/gi,(all,prefix,q,raw,suffix)=>{
   if(/^(?:data:|https?:|\/\/|#)/i.test(raw.trim()))return all;
   const value=assetUrl(raw.trim(),basePath);return value?prefix+q+value+q+suffix:all;
  });
  return result;
 };
 let output=String(html||"");
 let resourceBasePath=htmlPath;
 const baseTag=output.match(/<base\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/i);
 if(baseTag&&baseTag[1]){try{resourceBasePath=new URL(baseTag[1],baseUrl(htmlPath)).href}catch{}}
 for(const asset of files){
  const path=String(asset.path||"");
  const type=String(asset.content_type||contentType(path)).split(";")[0].trim().toLowerCase();
  if(asset.encoding==="base64")continue;
  if(type==="text/css"){
   output=output.replace(/<link\b[^>]*>/gi,tag=>{
    const rel=(tag.match(/\brel\s*=\s*["']([^"']+)["']/i)||[])[1]||"";
    const href=(tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)||[])[1]||"";
    if(!/\bstylesheet\b/i.test(rel)||normalizeAsset(href,resourceBasePath)!==path)return tag;
    const resource=assetUrl(href,resourceBasePath);
    return resource?tag.replace(href,resource):tag;
   });
  }else if(["text/javascript","application/javascript","text/ecmascript","application/ecmascript","application/x-javascript","text/x-javascript"].includes(type)){
   output=output.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,(tag,attrs,body)=>{
    const src=(attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)||[])[1]||"";
    if(!src||normalizeAsset(src,resourceBasePath)!==path)return tag;
    const resource=assetUrl(src,resourceBasePath)||assetEndpoint(hostname,path);
    return tag.replace(/\bsrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i,'src="'+resource+'"');
   });
  }
 }
 output=output.replace(/<link\b[^>]*>/gi,tag=>{
  const rel=(tag.match(/\brel\s*=\s*["']([^"']+)["']/i)||[])[1]||"";
  const href=(tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)||[])[1]||"";
  if(/\bstylesheet\b/i.test(rel)||!href||/^(?:data:|https?:|\/\/|#)/i.test(href))return tag;
  const url=assetUrl(href,resourceBasePath);
  return url?tag.replace(href,url):tag;
 });
 output=output.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,(all,attrs,body)=>{
  const type=(attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)||[])[1]||"";
  if(type&&!/(?:java|ecma)script|module/i.test(type))return all;
  return "<script"+attrs+">"+rewriteLocationRedirects(body)+"</script>";
 });
 output=transformHtmlDocument(output,{
  rewriteCss:css=>rewriteCssUrls(css,raw=>{
   if(/^(?:data:|blob:|https?:|\/\/|#)/i.test(String(raw||"").trim()))return null;
   return assetUrl(String(raw||"").trim(),resourceBasePath);
  }),
  rewriteJavaScript:source=>rewriteLocationRedirects(rewriteModuleImports(source,hostname,htmlPath)),
  rewriteResource:(raw,tag,name)=>{
   const value=String(raw||"").trim();
   if(!value||/^(?:data:|blob:|https?:|\/\/|#)/i.test(value))return null;
   return assetUrl(value,resourceBasePath);
  },
  rewriteSrcset:value=>rewriteSrcset(value,raw=>/^(?:data:|blob:|https?:|\/\/|#)/i.test(raw)?null:assetUrl(raw,resourceBasePath))
 });
 return output;
}
function extractHtmlRedirect(html){
 const source=String(html||"");
 const metas=source.match(/<meta\b[^>]*>/gi)||[];
 for(const tag of metas){
  const equiv=tag.match(/http-equiv\s*=\s*["']?refresh["']?/i);
  const content=tag.match(/content\s*=\s*["']([^"']+)["']/i)||tag.match(/content\s*=\s*([^\s>]+)/i);
  if(equiv&&content&&content[1]){
   const value=content[1].match(/(?:^|;)\s*\d*\s*;?\s*url\s*=\s*["']?(.+?)["']?\s*$/i);
   if(value&&value[1])return value[1].trim();
  }
 }
 const patterns=[
  /(?:window\s*\.\s*)?location\s*\.\s*(?:assign|replace)\s*\(\s*["']([^"']+)["']\s*\)/i,
  /(?:window\s*\.\s*)?location(?:\s*\.\s*href)?\s*=\s*["']([^"']+)["']/i
 ];
 for(const pattern of patterns){const match=source.match(pattern);if(match&&match[1])return match[1].trim()}
 return null;
}
function resolveHtmlRedirect(target,base){
 if(!target)return null;
 try{return new URL(target,base).toString()}catch{return null}
}
const STATIC_FILE_SUFFIX=/\.(?:html?|xhtml|css|js|mjs|cjs|json|map|xml|txt|csv|pdf|svg|png|jpe?g|gif|webp|avif|ico|bmp|woff2?|ttf|otf|eot|mp3|m4a|aac|flac|mid|midi|wav|ogg|mp4|m4v|mov|3gp|webm|wasm|webmanifest)$/i;
export function documentPathCandidates(path){
 const raw=String(path||"/");
 const clean=raw.startsWith("/")?raw:"/"+raw;
 const pathname=clean.replace(/\/{2,}/g,"/");
 if(pathname==="/")return ["/index.html","/index.htm"];
 if(STATIC_FILE_SUFFIX.test(pathname))return [pathname];
 const trailing=pathname.endsWith("/");
 const stem=pathname.replace(/\/+$/,"");
 const directory=stem+"/";
 const exact=trailing?null:stem;
 const candidates=[exact,directory+"index.html",directory+"index.htm",directory+"index.xhtml",stem+".html",stem+".htm"];
 return [...new Set(candidates.filter(Boolean))];
}
export function shouldFallbackToAppShell(path){
 return !STATIC_FILE_SUFFIX.test(String(path||"/"));
}
export function rewriteLocationRedirects(source){
 return rewriteJavaScriptLocationRedirects(source);
}
async function publishedDocument(parsed,env){
 const hostname=(parsed.hostname||"").toLowerCase();
 if(hostname==="home")return{type:"home",title:"Fairwas · HTTC",protocol:"httc",description:DESCRIPTION};
 if(hostname==="createpage.fair"||hostname==="docs.createpage.fair")return{type:"createpage",title:"CreatePage",protocol:"httc",host:hostname,path:parsed.pathname||"/",description:"Create and manage Fairwas sites."};
 if(!env.server||!env.pages)return null;await ensurePagesSchema(env);await ensureServerSchema(env);
 const server=await env.server.prepare("SELECT site_id,hostname,protocol,origin,status FROM servers WHERE hostname=? AND protocol='httc' AND status='active'").bind(hostname).first();if(!server)return null;
 const site=await env.pages.prepare("SELECT site_id,hostname,title,description,logo_url,framework,language,backend,runtime,database_type,status FROM sites WHERE site_id=? AND status='published'").bind(server.site_id).first();if(!site)return null;
 const path=parsed.pathname||"/";
 const requested=path==="/home"?"/":path;
 let file=null;
 // Resolve each published IDE route to its own HTML document.
 const routeName=requested.split("/").filter(Boolean).join("/");
 const routeCandidates=requested==="/"
  ?["/routes/mainpage/index.html","/routes/mainpage/index.htm","/index.html","/index.htm"]
  :(!STATIC_FILE_SUFFIX.test(requested)
   ?[
     "/routes/"+routeName+"/index.html",
     "/routes/"+routeName+"/index.htm",
     "/routes/"+routeName+".html",
     "/routes/"+routeName+".htm"
    ]
   :((requested==="/index.html"||requested==="/index.htm")
    ?["/routes/mainpage/index.html","/routes/mainpage/index.htm"]
    :[]));
 // Resolve the requested HTML first, while treating /index.html as an alias
 // for the main-page file when the project stores its homepage under /routes.
 for(const candidate of [...routeCandidates,...documentPathCandidates(requested)]){
  file=await env.pages.prepare("SELECT path,content_type,content,encoding FROM site_files WHERE site_id=? AND path=?").bind(site.site_id,candidate).first();
  if(file)break;
 }
 if(!file)return{type:"site",site,server,path,error:"file_not_found"};
 const type=String(file.content_type||contentType(file.path)).split(";")[0].trim().toLowerCase();
 const pathLooksHtml=/\.(?:html?|xhtml)$/i.test(String(file.path||""));
 const bodyLooksHtml=/^\s*(?:<!doctype\s+html|<html(?:\s|>)|<head(?:\s|>)|<body(?:\s|>))/i.test(String(file.content||""));
 const isHtml=/^(?:text\/html|application\/xhtml\+xml)$/i.test(type)||pathLooksHtml||bodyLooksHtml;
 const rendered=isHtml?await renderSiteHtml(site.site_id,file.content,env,file.path,parsed.hostname):null;
 const redirect=rendered?resolveHtmlRedirect(extractHtmlRedirect(rendered),parsed.href):null;
 return{type:"site",site,server,path,file:{path:file.path,content_type:file.content_type||contentType(file.path),content:file.content},rendered,redirect};
}

function apiCors(){return {"access-control-allow-origin":"*","access-control-allow-methods":"GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS","access-control-allow-headers":"content-type, authorization","access-control-max-age":"86400"}}
function routeMatch(pattern,path){
 const a=String(pattern).split("/").filter(Boolean),b=String(path).split("/").filter(Boolean);
 if(a.length!==b.length)return null;
 const out={};
 for(let i=0;i<a.length;i++){
  if(a[i].startsWith(":")){if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(a[i].slice(1)))return null;try{out[a[i].slice(1)]=decodeURIComponent(b[i])}catch{return null}}
  else if(a[i]!==b[i])return null;
 }
 return out;
}
function expandApiTemplate(value,ctx){
 if(typeof value==="string")return value.replace(/\{\{\s*(params|query|body)\.([A-Za-z0-9_]+)\s*\}\}/g,(all,source,key)=>ctx[source]?.[key]==null?"":String(ctx[source][key]));
 if(Array.isArray(value))return value.map(v=>expandApiTemplate(v,ctx));
 if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,expandApiTemplate(v,ctx)]));
 return value;
}
function apiResponseFromConfig(value,{status=200,requestMethod="GET",cors={},defaultHeaders={}}={}){
 const envelope=value&&typeof value==="object"&&!Array.isArray(value)?(value.__response||value.$response||null):null;
 if(!envelope)return Response.json(value,{status,headers:{"cache-control":"no-store",...cors,...defaultHeaders}});
 const type=String(envelope.type||"json").toLowerCase();
 const body=envelope.body??(type==="json"?{}:"");
 const headers={...cors,...defaultHeaders};
 const allowedHeader=/^(content-type|content-disposition|content-language|cache-control|access-control-allow-origin|access-control-allow-headers|access-control-allow-methods|access-control-expose-headers|x-content-type-options|x-robots-tag|vary)$/i;
 if(envelope.headers&&typeof envelope.headers==="object"&&!Array.isArray(envelope.headers)){
  for(const [key,val] of Object.entries(envelope.headers)){if(allowedHeader.test(key)&&typeof val==="string"&&val.length<=2000&&!/[\r\n]/.test(val))headers[key.toLowerCase()]=val}
 }
 const types={json:"application/json; charset=utf-8",text:"text/plain; charset=utf-8",html:"text/html; charset=utf-8",xml:"application/xml; charset=utf-8",svg:"image/svg+xml",css:"text/css; charset=utf-8",javascript:"text/javascript; charset=utf-8",csv:"text/csv; charset=utf-8",binary:"application/octet-stream",base64:"application/octet-stream"};
 if(envelope.content_type&&typeof envelope.content_type==="string"&&envelope.content_type.length<=160&&!/[\r\n]/.test(envelope.content_type))headers["content-type"]=envelope.content_type;
 else headers["content-type"]=types[type]||"application/octet-stream";
 headers["cache-control"]=headers["cache-control"]||"no-store";
 if(type==="redirect"){
  const target=String(envelope.location||body||"").trim();
  if(!target||/[\r\n]/.test(target))return Response.json({ok:false,error:"invalid_redirect_target"},{status:500,headers:cors});
  headers.location=target;
  return new Response(null,{status:[301,302,303,307,308].includes(status)?status:302,headers});
 }
 if([204,205,304].includes(status))return new Response(null,{status,headers});
 let payload;
 if(type==="json"){
  return Response.json(body,{status,headers});
 }else if(type==="base64"||type==="binary"){
  try{const encoded=String(body).replace(/^data:[^,]*;base64,/i,"").replace(/\s/g,"");const raw=atob(encoded);const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);payload=bytes}
  catch{return Response.json({ok:false,error:"invalid_base64_response"},{status:500,headers:cors})}
 }else{
  payload=typeof body==="string"?body:JSON.stringify(body);
 }
 return new Response(requestMethod==="HEAD"?null:payload,{status,headers});
}
function binaryRangeResponse(request,bytes,type,extraHeaders={}){
 const headers={"content-type":type,"accept-ranges":"bytes","cache-control":"public, max-age=300, stale-while-revalidate=60","x-content-type-options":"nosniff",...extraHeaders};
 const range=request.headers.get("range");
 if(range){
  const match=range.match(/^bytes=(\d*)-(\d*)$/);
  if(!match)return new Response(null,{status:416,headers:{...headers,"content-range":"bytes */"+bytes.length}});
  let start=match[1]?Number(match[1]):null,end=match[2]?Number(match[2]):null;
  if(start===null){const suffix=end||0;start=Math.max(0,bytes.length-suffix);end=bytes.length-1}
  else if(end===null)end=bytes.length-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||start>=bytes.length)return new Response(null,{status:416,headers:{...headers,"content-range":"bytes */"+bytes.length}});
  end=Math.min(end,bytes.length-1);
  headers["content-range"]="bytes "+start+"-"+end+"/"+bytes.length;
  headers["content-length"]=String(end-start+1);
  return new Response(request.method==="HEAD"?null:bytes.slice(start,end+1),{status:206,headers});
 }
 headers["content-length"]=String(bytes.length);
 return new Response(request.method==="HEAD"?null:bytes,{status:200,headers});
}
const platformEncoder=new TextEncoder();
async function platformDigest(value){const result=await crypto.subtle.digest("SHA-256",platformEncoder.encode(String(value)));return Array.from(new Uint8Array(result),b=>b.toString(16).padStart(2,"0")).join("")}
function platformToken(bytes=32){return Array.from(crypto.getRandomValues(new Uint8Array(bytes)),b=>b.toString(16).padStart(2,"0")).join("")}
async function platformPasswordHash(password,salt){const key=await crypto.subtle.importKey("raw",platformEncoder.encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:platformEncoder.encode(salt),iterations:310000,hash:"SHA-256"},key,256);return Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,"0")).join("")}
async function platformIdentitySchema(db){
 await db.batch([
  db.prepare("CREATE TABLE IF NOT EXISTS fw_platform_identity_accounts(id TEXT PRIMARY KEY,service_id TEXT NOT NULL,email TEXT NOT NULL,display_name TEXT NOT NULL,password_hash TEXT NOT NULL,password_salt TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(service_id,email))"),
  db.prepare("CREATE INDEX IF NOT EXISTS idx_fw_platform_identity_accounts ON fw_platform_identity_accounts(service_id,email)"),
  db.prepare("CREATE TABLE IF NOT EXISTS fw_platform_identity_sessions(token_hash TEXT PRIMARY KEY,service_id TEXT NOT NULL,user_id TEXT NOT NULL,expires_at TEXT NOT NULL,created_at TEXT NOT NULL)"),
  db.prepare("CREATE INDEX IF NOT EXISTS idx_fw_platform_identity_sessions ON fw_platform_identity_sessions(service_id,user_id)")
 ]);
}
async function handlePlatformIdentity(request,parsed,env,serviceId){
 const path=parsed.pathname.replace(/\/+$/,"")||"/",method=request.method.toUpperCase();
 if(!["/auth/register","/auth/login","/auth/me","/auth/logout","/register","/login","/me","/logout"].includes(path))return null;
 const action=path.split("/").pop();
 await platformIdentitySchema(env.database);
 if(action==="register"||action==="login"){
  if(method!=="POST")return Response.json({ok:false,error:"method_not_allowed"},{status:405,headers:apiCors()});
  let body;try{body=await request.json()}catch{return Response.json({ok:false,error:"invalid_json"},{status:400,headers:apiCors()})}
  const email=String(body.email||"").trim().toLowerCase(),password=String(body.password||""),displayName=String(body.display_name||body.name||"").trim().slice(0,80);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return Response.json({ok:false,error:"invalid_email"},{status:400,headers:apiCors()});
  if(password.length<10||password.length>128)return Response.json({ok:false,error:"password_length",detail:"La contraseña debe tener entre 10 y 128 caracteres."},{status:400,headers:apiCors()});
  const ip=String(request.headers.get("cf-connecting-ip")||"unknown"),ipKey=await platformDigest(serviceId+"|"+ip),emailKey=await platformDigest(email);
  await env.database.prepare("CREATE TABLE IF NOT EXISTS fw_platform_identity_attempts(id INTEGER PRIMARY KEY AUTOINCREMENT,service_id TEXT NOT NULL,ip_key TEXT NOT NULL,email_key TEXT NOT NULL,created_at TEXT NOT NULL)").run();
  const cutoff=new Date(Date.now()-15*60*1000).toISOString();
  const previous=await env.database.prepare("SELECT COUNT(*) AS total FROM fw_platform_identity_attempts WHERE service_id=? AND created_at>? AND (ip_key=? OR email_key=?)").bind(serviceId,cutoff,ipKey,emailKey).first();
  await env.database.prepare("DELETE FROM fw_platform_identity_attempts WHERE created_at<?").bind(new Date(Date.now()-24*60*60*1000).toISOString()).run();
  await env.database.prepare("INSERT INTO fw_platform_identity_attempts(service_id,ip_key,email_key,created_at) VALUES(?,?,?,?)").bind(serviceId,ipKey,emailKey,new Date().toISOString()).run();
  if(Number(previous?.total||0)>=12)return Response.json({ok:false,error:"rate_limited"},{status:429,headers:apiCors()});
  if(action==="register"){
   if(displayName.length<1)return Response.json({ok:false,error:"display_name_required"},{status:400,headers:apiCors()});
   const exists=await env.database.prepare("SELECT id FROM fw_platform_identity_accounts WHERE service_id=? AND email=? LIMIT 1").bind(serviceId,email).first();
   if(exists)return Response.json({ok:false,error:"account_exists"},{status:409,headers:apiCors()});
   const id=crypto.randomUUID(),salt=platformToken(16),password_hash=await platformPasswordHash(password,salt),created_at=new Date().toISOString();
   try{await env.database.prepare("INSERT INTO fw_platform_identity_accounts(id,service_id,email,display_name,password_hash,password_salt,created_at) VALUES(?,?,?,?,?,?,?)").bind(id,serviceId,email,displayName,password_hash,salt,created_at).run()}catch{return Response.json({ok:false,error:"account_create_failed"},{status:409,headers:apiCors()})}
   const token=platformToken(),expires_at=new Date(Date.now()+30*24*60*60*1000).toISOString();
   await env.database.prepare("INSERT INTO fw_platform_identity_sessions(token_hash,service_id,user_id,expires_at,created_at) VALUES(?,?,?,?,?)").bind(await platformDigest(token),serviceId,id,expires_at,created_at).run();
   return Response.json({ok:true,user:{id,email,display_name:displayName,created_at},token,expires_at},{status:201,headers:{"cache-control":"no-store",...apiCors()}});
  }
  const account=await env.database.prepare("SELECT * FROM fw_platform_identity_accounts WHERE service_id=? AND email=? LIMIT 1").bind(serviceId,email).first();
  const hash=await platformPasswordHash(password,account?.password_salt||platformToken(16));
  if(!account||hash!==account.password_hash)return Response.json({ok:false,error:"invalid_credentials"},{status:401,headers:apiCors()});
  const token=platformToken(),created_at=new Date().toISOString(),expires_at=new Date(Date.now()+30*24*60*60*1000).toISOString();
  await env.database.prepare("INSERT INTO fw_platform_identity_sessions(token_hash,service_id,user_id,expires_at,created_at) VALUES(?,?,?,?,?)").bind(await platformDigest(token),serviceId,account.id,expires_at,created_at).run();
  return Response.json({ok:true,user:{id:account.id,email:account.email,display_name:account.display_name,created_at:account.created_at},token,expires_at},{headers:{"cache-control":"no-store",...apiCors()}});
 }
 const authorization=String(request.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1]||"";
 if(!authorization)return Response.json({ok:false,error:"session_required"},{status:401,headers:apiCors()});
 const tokenHash=await platformDigest(authorization),session=await env.database.prepare("SELECT s.token_hash,s.expires_at,a.id,a.email,a.display_name,a.created_at FROM fw_platform_identity_sessions s JOIN fw_platform_identity_accounts a ON a.id=s.user_id AND a.service_id=s.service_id WHERE s.service_id=? AND s.token_hash=? LIMIT 1").bind(serviceId,tokenHash).first();
 if(!session||session.expires_at<=new Date().toISOString()){if(session)await env.database.prepare("DELETE FROM fw_platform_identity_sessions WHERE token_hash=?").bind(tokenHash).run();return Response.json({ok:false,error:"invalid_session"},{status:401,headers:apiCors()})}
 if(action==="logout"){
  if(method!=="POST")return Response.json({ok:false,error:"method_not_allowed"},{status:405,headers:apiCors()});
  await env.database.prepare("DELETE FROM fw_platform_identity_sessions WHERE token_hash=?").bind(tokenHash).run();
  return Response.json({ok:true},{headers:{"cache-control":"no-store",...apiCors()}});
 }
 if(method!=="GET"&&method!=="POST")return Response.json({ok:false,error:"method_not_allowed"},{status:405,headers:apiCors()});
 return Response.json({ok:true,user:{id:session.id,email:session.email,display_name:session.display_name,created_at:session.created_at,expires_at:session.expires_at}},{headers:{"cache-control":"no-store",...apiCors()}});
}
async function handlePlatformServiceApi(request,parsed,env){
 if(!env.database)return null;
 let domain;
 try{domain=await env.database.prepare("SELECT d.service_id,d.kind,s.status,s.service_type FROM fw_platform_domains d JOIN fw_platform_services s ON s.id=d.service_id WHERE d.hostname=? LIMIT 1").bind(parsed.hostname.toLowerCase()).first()}catch{return null}
 if(!domain)return null;
 const cors=apiCors(),method=request.method.toUpperCase(),path=parsed.pathname||"/";
 if(domain.status!=="active")return Response.json({ok:false,error:"service_paused"},{status:503,headers:cors});
 if(domain.kind==="auth"||domain.service_type==="identity"){const identityResponse=await handlePlatformIdentity(request,parsed,env,domain.service_id);if(identityResponse)return identityResponse}
 const redirect=await env.database.prepare("SELECT target_uri,status_code FROM fw_platform_redirects WHERE service_id=? AND source_uri=? LIMIT 1").bind(domain.service_id,path).first();
 if(redirect)return new Response(null,{status:Number(redirect.status_code)||302,headers:{...cors,location:redirect.target_uri,"cache-control":"no-store"}});
 if(method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 let rows;try{rows=await env.database.prepare("SELECT id,method,path,status_code,response_json,auth_required FROM fw_platform_routes WHERE service_id=? AND method=? ORDER BY path").bind(domain.service_id,method).all()}catch{return Response.json({ok:false,error:"service_not_ready"},{status:503,headers:cors})}
 let route=null,params={};
 for(const row of rows.results||[]){const matched=routeMatch(row.path,path);if(matched){route=row;params=matched;break}}
 if(!route)return Response.json({ok:false,error:"route_not_found",path,method},{status:404,headers:cors});
 if(route.auth_required){
  const bearer=String(request.headers.get("authorization")||"").match(/^Bearer\\s+(.+)$/i)?.[1]||"";
  if(!bearer)return Response.json({ok:false,error:"api_key_required"},{status:401,headers:cors});
  const keyHash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(bearer));
  const keyHex=Array.from(new Uint8Array(keyHash),b=>b.toString(16).padStart(2,"0")).join("");
  const key=await env.database.prepare("SELECT id FROM fw_platform_keys WHERE service_id=? AND key_hash=? AND revoked_at IS NULL LIMIT 1").bind(domain.service_id,keyHex).first();
  if(!key)return Response.json({ok:false,error:"invalid_api_key"},{status:403,headers:cors});
 }
 let body={};
 if(!["GET","HEAD"].includes(method)){
  const raw=await request.text();if(raw.length>1024*1024)return Response.json({ok:false,error:"request_too_large"},{status:413,headers:cors});
  if(raw){try{body=JSON.parse(raw)}catch{return Response.json({ok:false,error:"invalid_json_body"},{status:400,headers:cors})}}
 }
 const query=Object.fromEntries(parsed.searchParams.entries());
 let template;try{template=JSON.parse(route.response_json)}catch{return Response.json({ok:false,error:"invalid_route_configuration"},{status:500,headers:cors})}
 const output=expandApiTemplate(template,{params,query,body}),status=Number(route.status_code)||200;
 return apiResponseFromConfig(output,{status,requestMethod:method,cors});
}
async function handleSiteApi(request,parsed,env){
 const method=request.method.toUpperCase(),lookupMethod=method==="HEAD"?"GET":method;
 const serviceResponse=await handlePlatformServiceApi(request,parsed,env);if(serviceResponse)return serviceResponse;
 if(!parsed.pathname.startsWith("/api/"))return null;
 if(method==="OPTIONS")return new Response(null,{status:204,headers:apiCors()});
 if(!["GET","HEAD","POST","PUT","PATCH","DELETE"].includes(method))return Response.json({ok:false,error:"method_not_allowed"},{status:405,headers:apiCors()});
 if(!env.database||!env.pages)return Response.json({ok:false,error:"api_binding_missing"},{status:500,headers:apiCors()});
 const hostname=parsed.hostname.toLowerCase();
 const site=await env.pages.prepare("SELECT site_id FROM sites WHERE hostname=? AND protocol='httc' AND status='published' LIMIT 1").bind(hostname).first();
 if(!site)return null;
 let rows;
 try{
  rows=await env.database.prepare("SELECT id,path,method,response_status,response_json FROM fw_api_endpoints WHERE site_id=? AND hostname=? AND enabled=1 AND method=?").bind(site.site_id,hostname,lookupMethod).all();
 }catch{return null}
 let endpoint=null,params={};
 for(const row of rows.results||[]){const matched=routeMatch(row.path,parsed.pathname);if(matched){endpoint=row;params=matched;break}}
 if(!endpoint)return Response.json({ok:false,error:"endpoint_not_found",path:parsed.pathname,method},{status:404,headers:apiCors()});
 let body={};
 if(!["GET","HEAD"].includes(method)){
  const raw=await request.text();
  if(raw.length>1024*1024)return Response.json({ok:false,error:"request_too_large"},{status:413,headers:apiCors()});
  if(raw){try{body=JSON.parse(raw)}catch{return Response.json({ok:false,error:"invalid_json_body"},{status:400,headers:apiCors()})}}
 }
 const query=Object.fromEntries(parsed.searchParams.entries());
 let template;try{template=JSON.parse(endpoint.response_json)}catch{return Response.json({ok:false,error:"invalid_endpoint_configuration"},{status:500,headers:apiCors()})}
 const output=expandApiTemplate(template,{params,query,body});
 const status=Number(endpoint.response_status)||200;
 return apiResponseFromConfig(output,{status,requestMethod:method,cors:apiCors()});
}
async function onSiteApiMethod({request,env}){
 let target;try{target=new URL(request.url).searchParams.get("url")||""}catch{}
 let parsed;try{parsed=new URL(target)}catch{return Response.json({ok:false,error:"invalid_url"},{status:400})}
 if(parsed.protocol!=="httc:")return Response.json({ok:false,error:"unsupported_protocol"},{status:400});
 const response=await handleSiteApi(request,parsed,env);
 return response||Response.json({ok:false,error:"endpoint_not_found",path:parsed.pathname,method:request.method},{status:404,headers:apiCors()});
}
export async function onRequestPost(context){return onSiteApiMethod(context)}
export async function onRequestPut(context){return onSiteApiMethod(context)}
export async function onRequestPatch(context){return onSiteApiMethod(context)}
export async function onRequestDelete(context){return onSiteApiMethod(context)}
export async function onRequestOptions(context){return onSiteApiMethod(context)}

export async function onRequestGet({request,env}){
 const req=new URL(request.url),target=req.searchParams.get("url")||"";let parsed;try{parsed=new URL(target)}catch{return Response.json({ok:false,error:"invalid_url"},{status:400})}
 if(!ALLOWED.has(parsed.protocol.slice(0,-1).toLowerCase()))return Response.json({ok:false,error:"unsupported_protocol"},{status:400});
 const apiResponse=await handleSiteApi(request,parsed,env);if(apiResponse)return apiResponse;
 const document=await publishedDocument(parsed,env);if(!document)return Response.json({ok:false,error:"site_not_found",host:parsed.hostname},{status:404});
 const assetPathRaw=req.searchParams.get("asset");const assetPath=assetPathRaw?("/"+assetPathRaw.replace(/^\/+/, "").replace(/\\/g,"/")):null;
 if(assetPath&&document.type==="site"){const asset=await env.pages.prepare("SELECT path,content_type,content,encoding FROM site_files WHERE site_id=? AND path=?").bind(document.site.site_id,assetPath).first();if(!asset)return new Response("Not found",{status:404});const type=String(asset.content_type||contentType(asset.path)).split(";")[0].trim().toLowerCase();if(asset.encoding==="base64"){let bytes;try{const raw=atob(asset.content);bytes=Uint8Array.from(raw,ch=>ch.charCodeAt(0))}catch{return new Response("Invalid binary asset",{status:500})}return binaryRangeResponse(request,bytes,type,{"access-control-allow-origin":"*"});}let assetContent=asset.content;if(type==="text/css")assetContent=rewriteCssUrls(assetContent,raw=>{const value=String(raw||"").trim();if(!value||/^(?:data:|blob:|https?:|\/\/|#)/i.test(value))return null;try{const u=new URL(value,"https://fairwas.invalid"+(String(asset.path||"/").startsWith("/")?asset.path:"/"+asset.path));if(u.origin!=="https://fairwas.invalid")return null;return assetEndpoint(document.server.hostname,u.pathname,u.search)}catch{return null}});if(type==="text/javascript"||type==="application/javascript"||type==="text/ecmascript"||type==="application/ecmascript"||type==="application/x-javascript"||type==="text/x-javascript"){assetContent=rewriteModuleImports(assetContent,document.server.hostname,asset.path);assetContent=rewriteLocationRedirects(assetContent);}return new Response(assetContent,{headers:{"content-type":type,"cache-control":"public,max-age=300,stale-while-revalidate=60","access-control-allow-origin":"*"}});
 }
 if(req.searchParams.get("raw")==="1"&&document.type==="site"){
  if(document.error||(document.path!=="/"&&document.path!==document.file?.path))return new Response("Not found",{status:404,headers:{"cache-control":"no-store"}});
  const rawFile=await env.pages.prepare("SELECT path,content_type,content,encoding FROM site_files WHERE site_id=? AND path=?").bind(document.site.site_id,document.file.path).first();
  if(!rawFile)return new Response("Not found",{status:404});
  const rawMime=rawFile.content_type||contentType(rawFile.path);
  const rawType=String(rawMime).split(";")[0].trim().toLowerCase();
  const rawHeaders={"content-type":rawMime,"cache-control":"no-store","access-control-allow-origin":"*","x-content-type-options":"nosniff"};
  if(rawFile.encoding==="base64"){let bytes;try{const raw=atob(rawFile.content);bytes=Uint8Array.from(raw,ch=>ch.charCodeAt(0))}catch{return new Response("Invalid binary asset",{status:500})}return binaryRangeResponse(request,bytes,rawMime,rawHeaders);}
  let rawContent=String(rawFile.content||"");
  if(/(?:javascript|ecmascript)/i.test(rawType)){rawContent=rewriteModuleImports(rawContent,document.server.hostname,rawFile.path);rawContent=rewriteLocationRedirects(rawContent)}
  return new Response(rawContent,{headers:rawHeaders});
 }
 if(document.redirect){return Response.json({ok:true,url:target,protocol:"httc",redirect:document.redirect,document},{status:200,headers:{"cache-control":"no-store"}});}
 let persisted=false;try{if(env.pages){await env.pages.prepare("INSERT INTO visits(url,protocol,visited_at) VALUES(?,?,?)").bind(target,"httc",new Date().toISOString()).run();persisted=true}}catch{}
 return Response.json({ok:true,url:target,protocol:"httc",host:parsed.hostname,path:parsed.pathname+(parsed.search||""),persisted,document});
}
