const ALLOWED=new Set(["httc"]);
const DESCRIPTION="Fairwas global web protocol";

async function ensureServerSchema(env){
 if(!env.server)return false;
 await env.server.prepare("CREATE TABLE IF NOT EXISTS servers (id INTEGER PRIMARY KEY AUTOINCREMENT,site_id TEXT,hostname TEXT NOT NULL UNIQUE,protocol TEXT NOT NULL DEFAULT 'httc',origin TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
 await env.server.prepare("CREATE INDEX IF NOT EXISTS idx_servers_protocol_hostname ON servers(protocol,hostname)").run();
 return true;
}

async function publishedDocument(parsed,env){
 const hostname=(parsed.hostname||"").toLowerCase();
 if(hostname==="home")return{type:"home",title:"Fairwas · HTTC",protocol:"httc",description:DESCRIPTION};
 if(hostname==="createpage.fair"||hostname==="docs.createpage.fair"){
  return{type:"createpage",title:"CreatePage",protocol:"httc",host:hostname,path:parsed.pathname||"/",description:"Create and manage Fairwas sites."};
 }
 if(!env.server||!env.pages)return null;
 await ensureServerSchema(env);
 const server=await env.server.prepare("SELECT site_id,hostname,protocol,origin,status FROM servers WHERE hostname=? AND protocol='httc' AND status='active'").bind(hostname).first();
 if(!server)return null;
 const site=await env.pages.prepare("SELECT site_id,hostname,title,description,logo_url,framework,language,backend,runtime,database_type,status FROM sites WHERE site_id=? AND status='published'").bind(server.site_id).first();
 if(!site)return null;
 const path=parsed.pathname||"/";
 const filePath=path==="/"||path==="/home"?"/index.html":path;
 const file=await env.pages.prepare("SELECT path,content_type,content FROM site_files WHERE site_id=? AND path=?").bind(site.site_id,filePath).first();
 if(!file)return{type:"site",site,server,path,error:"file_not_found"};
 return{type:"site",site,server,path,file:{path:file.path,content_type:file.content_type,content:file.content}};
}

export async function onRequestGet({request,env}){
 const target=new URL(request.url).searchParams.get("url")||"";
 let parsed;
 try{parsed=new URL(target)}catch{return Response.json({ok:false,error:"invalid_url"},{status:400})}
 const protocol=parsed.protocol.slice(0,-1).toLowerCase();
 if(!ALLOWED.has(protocol))return Response.json({ok:false,error:"unsupported_protocol"},{status:400});
 const document=await publishedDocument(parsed,env);
 if(!document)return Response.json({ok:false,error:"site_not_found",host:parsed.hostname},{status:404});
 let persisted=false;
 if(env.pages){try{await env.pages.prepare("INSERT INTO visits(url,protocol,visited_at) VALUES(?,?,?)").bind(target,"httc",new Date().toISOString()).run();persisted=true}catch{}}
 return Response.json({ok:true,url:target,protocol:"httc",host:parsed.hostname,path:parsed.pathname+(parsed.search||""),persisted,document});
}
