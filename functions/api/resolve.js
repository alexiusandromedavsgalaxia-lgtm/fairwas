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
 output=replaceResourceRefs(output,resourceBasePath);
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
 for(const candidate of documentPathCandidates(requested)){
  file=await env.pages.prepare("SELECT path,content_type,content,encoding FROM site_files WHERE site_id=? AND path=?").bind(site.site_id,candidate).first();
  if(file)break;
 }
 // Fall back to the app shell only when no concrete extensionless route exists.
 if(!file&&shouldFallbackToAppShell(requested))file=await env.pages.prepare("SELECT path,content_type,content,encoding FROM site_files WHERE site_id=? AND path='/index.html'").bind(site.site_id).first();
 if(!file)return{type:"site",site,server,path,error:"file_not_found"};
 const type=String(file.content_type||contentType(file.path)).split(";")[0].trim().toLowerCase();
 const pathLooksHtml=/\.(?:html?|xhtml)$/i.test(String(file.path||""));
 const bodyLooksHtml=/^\s*(?:<!doctype\s+html|<html(?:\s|>)|<head(?:\s|>)|<body(?:\s|>))/i.test(String(file.content||""));
 const isHtml=/^(?:text\/html|application\/xhtml\+xml)$/i.test(type)||pathLooksHtml||bodyLooksHtml;
 const rendered=isHtml?await renderSiteHtml(site.site_id,file.content,env,file.path,parsed.hostname):null;
 const redirect=rendered?resolveHtmlRedirect(extractHtmlRedirect(rendered),parsed.href):null;
 return{type:"site",site,server,path,file:{path:file.path,content_type:file.content_type||contentType(file.path),content:file.content},rendered,redirect};
}
export async function onRequestGet({request,env}){
 const req=new URL(request.url),target=req.searchParams.get("url")||"";let parsed;try{parsed=new URL(target)}catch{return Response.json({ok:false,error:"invalid_url"},{status:400})}
 if(!ALLOWED.has(parsed.protocol.slice(0,-1).toLowerCase()))return Response.json({ok:false,error:"unsupported_protocol"},{status:400});
 const document=await publishedDocument(parsed,env);if(!document)return Response.json({ok:false,error:"site_not_found",host:parsed.hostname},{status:404});
 const assetPathRaw=req.searchParams.get("asset");const assetPath=assetPathRaw?("/"+assetPathRaw.replace(/^\/+/, "").replace(/\\/g,"/")):null;
 if(assetPath&&document.type==="site"){const asset=await env.pages.prepare("SELECT path,content_type,content,encoding FROM site_files WHERE site_id=? AND path=?").bind(document.site.site_id,assetPath).first();if(!asset)return new Response("Not found",{status:404});const type=String(asset.content_type||contentType(asset.path)).split(";")[0].trim().toLowerCase();if(asset.encoding==="base64")return new Response(Uint8Array.from(atob(asset.content),(c)=>c.charCodeAt(0)),{headers:{"content-type":type,"cache-control":"public,max-age=300,stale-while-revalidate=60"}});let assetContent=asset.content;if(type==="text/css")assetContent=rewriteCssUrls(assetContent,raw=>{const value=String(raw||"").trim();if(!value||/^(?:data:|blob:|https?:|\/\/|#)/i.test(value))return null;try{const u=new URL(value,"https://fairwas.invalid"+(String(asset.path||"/").startsWith("/")?asset.path:"/"+asset.path));if(u.origin!=="https://fairwas.invalid")return null;return assetEndpoint(document.server.hostname,u.pathname,u.search)}catch{return null}});if(type==="text/javascript"||type==="application/javascript"||type==="text/ecmascript"||type==="application/ecmascript"||type==="application/x-javascript"||type==="text/x-javascript"){assetContent=rewriteModuleImports(assetContent,document.server.hostname,asset.path);assetContent=rewriteLocationRedirects(assetContent);}return new Response(assetContent,{headers:{"content-type":type,"cache-control":"public,max-age=300,stale-while-revalidate=60","access-control-allow-origin":"*"}});
 }
 if(req.searchParams.get("raw")==="1"&&document.type==="site"){
  if(document.error||(document.path!=="/"&&document.path!==document.file?.path))return new Response("Not found",{status:404,headers:{"cache-control":"no-store"}});
  const rawFile=await env.pages.prepare("SELECT path,content_type,content,encoding FROM site_files WHERE site_id=? AND path=?").bind(document.site.site_id,document.file.path).first();
  if(!rawFile)return new Response("Not found",{status:404});
  const rawType=rawFile.content_type||contentType(rawFile.path);
  const rawHeaders={"content-type":rawType,"cache-control":"no-store","access-control-allow-origin":"*","x-content-type-options":"nosniff"};
  if(rawFile.encoding==="base64")return new Response(Uint8Array.from(atob(rawFile.content),(ch)=>ch.charCodeAt(0)),{headers:rawHeaders});
  let rawContent=String(rawFile.content||"");
  if(/(?:javascript|ecmascript)/i.test(rawType))rawContent=rewriteModuleImports(rawContent,document.server.hostname,rawFile.path);
  return new Response(rawContent,{headers:rawHeaders});
 }
 if(document.redirect){return Response.json({ok:true,url:target,protocol:"httc",redirect:document.redirect,document},{status:200,headers:{"cache-control":"no-store"}});}
 let persisted=false;try{if(env.pages){await env.pages.prepare("INSERT INTO visits(url,protocol,visited_at) VALUES(?,?,?)").bind(target,"httc",new Date().toISOString()).run();persisted=true}}catch{}
 return Response.json({ok:true,url:target,protocol:"httc",host:parsed.hostname,path:parsed.pathname+(parsed.search||""),persisted,document});
}
