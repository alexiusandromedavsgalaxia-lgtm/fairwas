function json(data,status=200){return Response.json(data,{status,headers:{"cache-control":"no-store"}})}
const now=()=>new Date().toISOString();
const id=()=>crypto.randomUUID();
async function ensureServerSchema(env){
 if(!env.server)throw new Error("server_binding_missing");
 await env.server.prepare("CREATE TABLE IF NOT EXISTS servers (id INTEGER PRIMARY KEY AUTOINCREMENT,site_id TEXT,hostname TEXT NOT NULL UNIQUE,protocol TEXT NOT NULL DEFAULT 'httc',origin TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
 await env.server.prepare("CREATE INDEX IF NOT EXISTS idx_servers_protocol_hostname ON servers(protocol,hostname)").run();
}


export async function onRequest({request,env}){
 const u=new URL(request.url);
 const action=u.searchParams.get("action")||"sites";
 const method=request.method;
 if(!env.database||!env.pages||!env.server||!env.users)return json({ok:false,error:"d1_binding_missing",detail:"CreatePage requiere pages, server, database y users."},500);

 try{
  await ensureServerSchema(env);
  await Promise.all([
   env.database.batch([
    env.database.prepare("CREATE TABLE IF NOT EXISTS cp_developers (id INTEGER PRIMARY KEY CHECK(id=1),developer_id TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)"),
    env.database.prepare("CREATE TABLE IF NOT EXISTS cp_projects (site_id TEXT PRIMARY KEY,hostname TEXT NOT NULL UNIQUE,title TEXT NOT NULL,developer_id TEXT,status TEXT NOT NULL DEFAULT 'draft',build_root TEXT NOT NULL DEFAULT '/',build_output TEXT NOT NULL DEFAULT '/dist',build_command TEXT NOT NULL DEFAULT 'npm run build',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)"),
    env.database.prepare("CREATE TABLE IF NOT EXISTS cp_deployments (id INTEGER PRIMARY KEY AUTOINCREMENT,site_id TEXT NOT NULL,version TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL)"),
    env.database.prepare("CREATE TABLE IF NOT EXISTS cp_databases (id INTEGER PRIMARY KEY AUTOINCREMENT,site_id TEXT,name TEXT NOT NULL UNIQUE,engine TEXT NOT NULL DEFAULT 'SQLite',status TEXT NOT NULL DEFAULT 'registered',created_at TEXT NOT NULL)"),
    env.database.prepare("CREATE TABLE IF NOT EXISTS cp_profiles (id INTEGER PRIMARY KEY CHECK(id=1),display_name TEXT NOT NULL DEFAULT 'Fairwas user',updated_at TEXT NOT NULL)"),
    env.database.prepare("CREATE TABLE IF NOT EXISTS cp_workers (id INTEGER PRIMARY KEY AUTOINCREMENT,site_id TEXT,name TEXT NOT NULL,script TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'draft',updated_at TEXT NOT NULL)"),
    env.database.prepare("CREATE TABLE IF NOT EXISTS cp_docs (id TEXT PRIMARY KEY,title TEXT NOT NULL,content TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL)")
   ]),
   env.users.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,developer_id TEXT UNIQUE,display_name TEXT NOT NULL,email TEXT,status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)"),
   env.pages.batch([
    env.pages.prepare("CREATE TABLE IF NOT EXISTS sites (site_id TEXT PRIMARY KEY,hostname TEXT NOT NULL UNIQUE,protocol TEXT NOT NULL DEFAULT 'httc',title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',logo_url TEXT,framework TEXT,language TEXT,backend TEXT,runtime TEXT,database_type TEXT,status TEXT NOT NULL DEFAULT 'draft',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)"),
    env.pages.prepare("CREATE TABLE IF NOT EXISTS site_files (id INTEGER PRIMARY KEY AUTOINCREMENT,site_id TEXT NOT NULL,path TEXT NOT NULL,content_type TEXT NOT NULL,content TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(site_id,path))")
   ]),
   env.server.prepare("CREATE TABLE IF NOT EXISTS servers (id INTEGER PRIMARY KEY AUTOINCREMENT,site_id TEXT,hostname TEXT NOT NULL UNIQUE,protocol TEXT NOT NULL DEFAULT 'httc',origin TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)"),
    env.server.prepare("CREATE INDEX IF NOT EXISTS idx_servers_protocol_hostname ON servers(protocol,hostname)")
  ]);
  if(action==="profile"){
   if(method==="POST"){
    const b=await request.json();
    await env.database.prepare("INSERT INTO cp_profiles(id,display_name,updated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,updated_at=excluded.updated_at").bind(b.display_name||"Fairwas user",now()).run();
   }
   const r=await env.database.prepare("SELECT * FROM cp_profiles WHERE id=1").first();
   return json({ok:true,profile:r||{id:1,display_name:"Fairwas user"}});
  }

  if(action==="sites"){
   const r=await env.pages.prepare("SELECT site_id,hostname,protocol,title,description,framework,language,backend,runtime,database_type,status,created_at,updated_at FROM sites ORDER BY created_at DESC").all();
   const projects=await env.database.prepare("SELECT site_id,developer_id FROM cp_projects").all();
   const developers=new Map((projects.results||[]).map(p=>[p.site_id,p.developer_id]));
   const items=(r.results||[]).map(site=>({...site,developer_id:developers.get(site.site_id)||null}));
   return json({ok:true,items});
  }

  if(action==="databases"){
   const r=await env.database.prepare("SELECT * FROM cp_databases ORDER BY id DESC").all();
   return json({ok:true,items:r.results||[]});
  }

  if(action==="servers"){
   const r=await env.server.prepare("SELECT * FROM servers ORDER BY id DESC").all();
   return json({ok:true,items:r.results||[]});
  }

  if(action==="registry"){
   const developer=await env.database.prepare("SELECT * FROM cp_developers WHERE id=1").first();
   const linked=developer?await env.database.prepare("SELECT site_id,hostname,title,status FROM cp_projects WHERE developer_id=? ORDER BY hostname").bind(developer.developer_id).all():{results:[]};
   return json({ok:true,developer:developer||null,sites:linked.results||[]});
  }

  if(action==="developer"){
   if(method==="POST"){
    const b=await request.json();
    const displayName=String(b.display_name||"").trim();
    const email=String(b.email||"").trim();
    if(!displayName)return json({ok:false,error:"display_name_required"},400);
    if(!email)return json({ok:false,error:"email_required"},400);
    const stamp=now();
    const currentDeveloper=await env.database.prepare("SELECT developer_id FROM cp_developers WHERE id=1").first();
    let developerId=String(currentDeveloper?.developer_id||"").trim().toLowerCase();
    if(!developerId){
     do{
      developerId="dev-"+crypto.randomUUID().replace(/-/g,"").slice(0,16);
     }while(await env.users.prepare("SELECT id FROM users WHERE developer_id=? LIMIT 1").bind(developerId).first());
    }
    const existingUser=await env.users.prepare("SELECT id FROM users WHERE developer_id=? LIMIT 1").bind(developerId).first();
    if(existingUser){
     await env.users.prepare("UPDATE users SET display_name=?,email=?,status='active',updated_at=? WHERE id=?").bind(displayName,email,stamp,existingUser.id).run();
    }else{
     await env.users.prepare("INSERT INTO users(id,developer_id,display_name,email,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").bind(developerId,developerId,displayName,email,"active",stamp,stamp).run();
    }
    await env.database.prepare("INSERT INTO cp_developers(id,developer_id,display_name,created_at,updated_at) VALUES(1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET developer_id=excluded.developer_id,display_name=excluded.display_name,updated_at=excluded.updated_at").bind(developerId,displayName,stamp,stamp).run();
   }
   const developer=await env.database.prepare("SELECT * FROM cp_developers WHERE id=1").first();
   return json({ok:true,developer:developer||null});
  }

  if(action==="workers"){
   const r=await env.database.prepare("SELECT * FROM cp_workers ORDER BY id DESC").all();
   return json({ok:true,items:r.results||[]});
  }

  if(action==="docs"){
   const r=await env.database.prepare("SELECT id,title,updated_at FROM cp_docs ORDER BY updated_at DESC").all();
   return json({ok:true,items:r.results||[]});
  }

  if(action==="import"){
   if(method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
   const b=await request.json();
   let parsed;try{parsed=new URL(String(b.repo_url||""))}catch{return json({ok:false,error:"invalid_repo_url"},400)}
   if(parsed.hostname!=="github.com")return json({ok:false,error:"only_github_supported"},400);
   const parts=parsed.pathname.split("/").filter(Boolean);if(parts.length<2)return json({ok:false,error:"invalid_repo_url"},400);
   const owner=parts[0],repoName=parts[1].replace(/\.git$/,"");
   const tree=await fetch("https://api.github.com/repos/"+encodeURIComponent(owner)+"/"+encodeURIComponent(repoName)+"/git/trees/HEAD?recursive=1",{headers:{"accept":"application/vnd.github+json","user-agent":"Fairwas-CreatePage"}});
   if(!tree.ok)return json({ok:false,error:"repo_fetch_failed",detail:"GitHub returned "+tree.status},502);
   const data=await tree.json();const blobs=(data.tree||[]).filter(x=>x.type==="blob").filter(x=>/\\.(html?|css|js|jsx|ts|tsx|json|md|svg|txt)$/i.test(x.path)).slice(0,200);
   const files=[];for(const item of blobs){const raw=await fetch("https://raw.githubusercontent.com/"+encodeURIComponent(owner)+"/"+encodeURIComponent(repoName)+"/HEAD/"+item.path);if(raw.ok)files.push({path:"/"+item.path,content:await raw.text()})}
   const title=repoName.replace(/[-_]+/g," ").replace(/\\b\\w/g,m=>m.toUpperCase());
   return json({ok:true,title,hostname:repoName.toLowerCase().replace(/[^a-z0-9-]/g,"-")+".fair",files});
  }

  if(action==="create"){
   if(method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
   const b=await request.json();
   const hostname=String(b.hostname||"").trim().toLowerCase();
   const title=String(b.title||"").trim()||hostname;
   if(!hostname)return json({ok:false,error:"hostname_required"},400);
   if(!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(hostname))return json({ok:false,error:"invalid_hostname"},400);
   const developer=await env.database.prepare("SELECT * FROM cp_developers WHERE id=1").first();
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
    const normalizedIncoming=incoming.map(f=>({...f,path:String(f.path||"/index.html").replace(/\\/g,"/").replace(/^\/+/,"/")}));\n    const fileStatements=normalizedIncoming.map(f=>env.pages.prepare("INSERT INTO site_files(site_id,path,content_type,content,updated_at) VALUES(?,?,?,?,?)").bind(site_id,String(f.path||"/index.html"),String(f.path||"").endsWith(".css")?"text/css":String(f.path||"").endsWith(".js")?"text/javascript":"text/html",String(f.content||""),stamp));
    await env.pages.batch([
     env.pages.prepare("INSERT INTO sites(site_id,hostname,protocol,title,description,logo_url,framework,language,backend,runtime,database_type,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(site_id,hostname,"httc",title,b.description||"",b.logo_url||"",b.framework||"Custom",b.language||"HTML",b.backend||"None",b.runtime||"Cloudflare Pages",b.database_type||"None","publishing",stamp,stamp),
     ...fileStatements
    ]);
    await env.server.prepare("INSERT INTO servers(site_id,hostname,protocol,origin,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").bind(site_id,hostname,"httc",origin,"active",stamp,stamp).run();
    await env.database.batch([
     env.database.prepare("INSERT INTO cp_projects(site_id,hostname,title,developer_id,status,build_root,build_output,build_command,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(site_id,hostname,title,developer.developer_id,"published",String(b.build_root||"/"),String(b.build_output||"/dist"),String(b.build_command||"npm run build"),stamp,stamp),
     env.database.prepare("INSERT INTO cp_deployments(site_id,version,status,created_at) VALUES(?,?,?,?)").bind(site_id,version,"published",stamp)
    ]);
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
