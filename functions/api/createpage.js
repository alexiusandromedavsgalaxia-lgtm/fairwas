function json(data,status=200){return Response.json(data,{status,headers:{"cache-control":"no-store"}})}
const now=()=>new Date().toISOString();
const id=()=>crypto.randomUUID();

export async function onRequest({request,env}){
 const u=new URL(request.url);
 const action=u.searchParams.get("action")||"sites";
 const method=request.method;
 if(!env.database)return json({ok:false,error:"database_binding_missing"},500);

 try{
  if(action==="profile"){
   if(method==="POST"){
    const b=await request.json();
    await env.database.prepare("INSERT INTO cp_profiles(id,display_name,updated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,updated_at=excluded.updated_at").bind(b.display_name||"Fairwas user",now()).run();
   }
   const r=await env.database.prepare("SELECT * FROM cp_profiles WHERE id=1").first();
   return json({ok:true,profile:r||{id:1,display_name:"Fairwas user"}});
  }

  if(action==="sites"){
   const r=await env.pages.prepare("SELECT s.site_id,s.hostname,s.protocol,s.title,s.description,s.framework,s.language,s.backend,s.runtime,s.database_type,s.status,s.created_at,s.updated_at,p.developer_id FROM sites s LEFT JOIN cp_projects p ON p.site_id=s.site_id ORDER BY s.created_at DESC").all();
   return json({ok:true,items:r.results||[]});
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
    const developerId=String(b.developer_id||"").trim().toLowerCase();
    const displayName=String(b.display_name||"").trim();
    if(!/^[a-z0-9][a-z0-9-]{2,31}$/.test(developerId))return json({ok:false,error:"invalid_developer_id"},400);
    if(!displayName)return json({ok:false,error:"display_name_required"},400);
    await env.database.prepare("INSERT INTO cp_developers(id,developer_id,display_name,created_at,updated_at) VALUES(1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET developer_id=excluded.developer_id,display_name=excluded.display_name,updated_at=excluded.updated_at").bind(developerId,displayName,now()).run();
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
   if(!developer)return json({ok:false,error:"developer_not_registered"},403);
   const site_id=id(), stamp=now(), version="v1-"+Date.now();
   const html=String(b.html||"<!doctype html><html><head><meta charset=\"utf-8\"><title>"+title+"</title></head><body><main><h1>"+title+"</h1></main></body></html>");
   const origin="pages://"+hostname;
   try{
    const incoming=Array.isArray(b.files)&&b.files.length?b.files:[{path:"/index.html",content:html}];
    const fileStatements=incoming.map(f=>env.pages.prepare("INSERT INTO site_files(site_id,path,content_type,content,updated_at) VALUES(?,?,?,?,?)").bind(site_id,String(f.path||"/index.html"),String(f.path||"").endsWith(".css")?"text/css":String(f.path||"").endsWith(".js")?"text/javascript":"text/html",String(f.content||""),stamp));
    await env.pages.batch([
     env.pages.prepare("INSERT INTO sites(site_id,hostname,protocol,title,description,logo_url,framework,language,backend,runtime,database_type,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(site_id,hostname,"httc",title,b.description||"",b.logo_url||"",b.framework||"Custom",b.language||"HTML",b.backend||"None",b.runtime||"Cloudflare Pages",b.database_type||"None","publishing",stamp,stamp),
     ...fileStatements
    ]);
    await env.server.prepare("INSERT INTO servers(site_id,hostname,protocol,origin,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").bind(site_id,hostname,"httc",origin,"active",stamp,stamp).run();
    await env.database.batch([
     env.database.prepare("INSERT INTO cp_projects(site_id,hostname,title,developer_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").bind(site_id,hostname,title,developer.developer_id,"published",stamp,stamp),
     env.database.prepare("INSERT INTO cp_deployments(site_id,version,status,created_at) VALUES(?,?,?,?)").bind(site_id,version,"published",stamp)
    ]);
    if(b.database_name){
     await env.database.prepare("INSERT INTO cp_databases(site_id,name,engine,status,created_at) VALUES(?,?,?,?,?)").bind(site_id,b.database_name,"SQLite","registered",stamp).run();
    }
    await env.pages.prepare("UPDATE sites SET status='published',updated_at=? WHERE site_id=?").bind(now(),site_id).run();
    return json({ok:true,site_id,hostname,url:"httc://"+hostname,version,status:"published"});
   }catch(e){
    try{await env.pages.prepare("UPDATE sites SET status='failed',updated_at=? WHERE site_id=?").bind(now(),site_id).run()}catch{}
    return json({ok:false,error:"publish_failed",detail:String(e)},500);
   }
  }

  return json({ok:false,error:"unknown_action"},404);
 }catch(e){return json({ok:false,error:"request_failed",detail:String(e)},500)}
}
