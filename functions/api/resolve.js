const ALLOWED=new Set(["httc"]);
const DESCRIPTION="Fairwas global web protocol";
function contentType(path){const p=String(path||"").toLowerCase(),ext=p.includes(".")?p.slice(p.lastIndexOf(".")):"";return ({".html":"text/html; charset=utf-8",".htm":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".txt":"text/plain; charset=utf-8",".xml":"application/xml; charset=utf-8",".webmanifest":"application/manifest+json",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".gif":"image/gif",".webp":"image/webp",".avif":"image/avif",".ico":"image/x-icon",".bmp":"image/bmp",".woff":"font/woff",".woff2":"font/woff2",".ttf":"font/ttf",".otf":"font/otf",".eot":"application/vnd.ms-fontobject",".mp3":"audio/mpeg",".wav":"audio/wav",".ogg":"audio/ogg",".mp4":"video/mp4",".webm":"video/webm",".wasm":"application/wasm",".map":"application/json"}[ext]||"application/octet-stream");}
async function ensureServerSchema(env){if(!env.server)return false;await env.server.prepare("CREATE TABLE IF NOT EXISTS servers (id INTEGER PRIMARY KEY AUTOINCREMENT,site_id TEXT,hostname TEXT NOT NULL UNIQUE,protocol TEXT NOT NULL DEFAULT 'httc',origin TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run();await env.server.prepare("CREATE INDEX IF NOT EXISTS idx_servers_protocol_hostname ON servers(protocol,hostname)").run();return true;}
function escRe(value){return String(value).replace(/[.*+?^$()|[\]\\]/g,"\\$&");}
function dataUrl(file){if(file.encoding!=="base64")return null;return "data:"+(file.content_type||contentType(file.path))+";base64,"+file.content;}
async function ensurePagesSchema(env){
 if(!env.pages)return false;
 await env.pages.prepare("CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT,url TEXT NOT NULL,protocol TEXT NOT NULL,visited_at TEXT NOT NULL)").run();
 await env.pages.prepare("CREATE INDEX IF NOT EXISTS idx_visits_id ON visits(id DESC)").run();
 await env.pages.prepare("CREATE TABLE IF NOT EXISTS sites (site_id TEXT PRIMARY KEY,hostname TEXT NOT NULL UNIQUE,protocol TEXT NOT NULL DEFAULT 'httc',title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',logo_url TEXT,framework TEXT,language TEXT,backend TEXT,runtime TEXT,database_type TEXT,status TEXT NOT NULL DEFAULT 'draft',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
 const columns=await env.pages.prepare("PRAGMA table_info(site_files)").all();const names=new Set((columns.results||[]).map(x=>x.name));if(!names.has("encoding"))await env.pages.prepare("ALTER TABLE site_files ADD COLUMN encoding TEXT").run();
 await env.pages.prepare("CREATE TABLE IF NOT EXISTS site_files (id INTEGER PRIMARY KEY AUTOINCREMENT,site_id TEXT NOT NULL,path TEXT NOT NULL,content_type TEXT NOT NULL,content TEXT NOT NULL,encoding TEXT,updated_at TEXT NOT NULL,UNIQUE(site_id,path))").run();
 return true;
}
async function renderSiteHtml(siteId,html,env){
 const rows=await env.pages.prepare("SELECT path,content_type,content,encoding FROM site_files WHERE site_id=?").bind(siteId).all();
 const files=rows.results||[];
 const binaryUrls=new Map();
 for(const asset of files){
  const url=dataUrl(asset);
  if(url)binaryUrls.set(String(asset.path||""),url);
 }
 let output=String(html||"");
 const replaceAssetRefs=(text)=>{
  let result=String(text||"");
  for(const [path,url] of binaryUrls){
   const escaped=escRe(path);
   result=result.replace(new RegExp("(['\\\"])"+escaped+"\\1","g"),"$1"+url+"$1");
   result=result.replace(new RegExp("(['\\\"])\\./"+escaped.replace(/^\\//,"")+"\\1","g"),"$1"+url+"$1");
  }
  return result;
 };
 for(const asset of files){
  const path=String(asset.path||"");
  const type=String(asset.content_type||contentType(path)).split(";")[0];
  let content=String(asset.content||"");
  if(type==="text/css")content=replaceAssetRefs(content);
  if(type==="text/css"){
   const escaped=escRe(path);
   output=output.replace(new RegExp("<link\\\\s+[^>]*href=['\\\"]"+escaped+"['\\\"][^>]*>","i"),"<style data-httc-asset='"+path.replace(/'/g,"&#39;")+"'>"+content+"</style>");
  }else if(type==="text/javascript"||type==="application/javascript"){
   const escaped=escRe(path);
   output=output.replace(new RegExp("<script\\\\s+[^>]*src=['\\\"]"+escaped+"['\\\"][^>]*>\\\\s*</script>","i"),"<script data-httc-asset='"+path.replace(/'/g,"&#39;")+"'>"+content+"</script>");
  }
  const data=binaryUrls.get(path);
  if(data){
   const bare=path.replace(/^\//,"");
   const q=escRe(bare);
   output=output.replace(new RegExp("(['\\\"])(?:\\./)?"+q+"\\1","g"),"$1"+data+"$1");
   output=output.replace(new RegExp("(['\\\"])" + escRe(path) + "\\1","g"),"$1"+data+"$1");
  }
 }
 return output;
}
async function publishedDocument(parsed,env){
 const hostname=(parsed.hostname||"").toLowerCase();
 if(hostname==="home")return{type:"home",title:"Fairwas · HTTC",protocol:"httc",description:DESCRIPTION};
 if(hostname==="createpage.fair"||hostname==="docs.createpage.fair")return{type:"createpage",title:"CreatePage",protocol:"httc",host:hostname,path:parsed.pathname||"/",description:"Create and manage Fairwas sites."};
 if(!env.server||!env.pages)return null;await ensurePagesSchema(env);await ensureServerSchema(env);
 const server=await env.server.prepare("SELECT site_id,hostname,protocol,origin,status FROM servers WHERE hostname=? AND protocol='httc' AND status='active'").bind(hostname).first();if(!server)return null;
 const site=await env.pages.prepare("SELECT site_id,hostname,title,description,logo_url,framework,language,backend,runtime,database_type,status FROM sites WHERE site_id=? AND status='published'").bind(server.site_id).first();if(!site)return null;
 const path=parsed.pathname||"/";const requested=path==="/"||path==="/home"?"/index.html":path;
 let file=await env.pages.prepare("SELECT path,content_type,content,encoding FROM site_files WHERE site_id=? AND path=?").bind(site.site_id,requested).first();
 if(!file&&!requested.includes("."))file=await env.pages.prepare("SELECT path,content_type,content,encoding FROM site_files WHERE site_id=? AND path='/index.html'").bind(site.site_id).first();
 if(!file)return{type:"site",site,server,path,error:"file_not_found"};
 const type=String(file.content_type||contentType(file.path)).split(";")[0];
 return{type:"site",site,server,path,file:{path:file.path,content_type:file.content_type||contentType(file.path),content:file.content},rendered:type==="text/html"?await renderSiteHtml(site.site_id,file.content,env):null};
}
export async function onRequestGet({request,env}){
 const req=new URL(request.url),target=req.searchParams.get("url")||"";let parsed;try{parsed=new URL(target)}catch{return Response.json({ok:false,error:"invalid_url"},{status:400})}
 if(!ALLOWED.has(parsed.protocol.slice(0,-1).toLowerCase()))return Response.json({ok:false,error:"unsupported_protocol"},{status:400});
 const document=await publishedDocument(parsed,env);if(!document)return Response.json({ok:false,error:"site_not_found",host:parsed.hostname},{status:404});
 const assetPathRaw=req.searchParams.get("asset");const assetPath=assetPathRaw?("/"+assetPathRaw.replace(/^\/+/, "").replace(/\\/g,"/")):null;
 if(assetPath&&document.type==="site"){const asset=await env.pages.prepare("SELECT path,content_type,content,encoding FROM site_files WHERE site_id=? AND path=?").bind(document.site.site_id,assetPath).first();if(!asset)return new Response("Not found",{status:404});const type=asset.content_type||contentType(asset.path);if(asset.encoding==="base64")return new Response(Uint8Array.from(atob(asset.content),(c)=>c.charCodeAt(0)),{headers:{"content-type":type,"cache-control":"public,max-age=31536000,immutable"}});return new Response(asset.content,{headers:{"content-type":type,"cache-control":"public,max-age=31536000,immutable"}});
 }
 let persisted=false;try{if(env.pages){await env.pages.prepare("INSERT INTO visits(url,protocol,visited_at) VALUES(?,?,?)").bind(target,"httc",new Date().toISOString()).run();persisted=true}}catch{}
 return Response.json({ok:true,url:target,protocol:"httc",host:parsed.hostname,path:parsed.pathname+(parsed.search||""),persisted,document});
}