import React,{useEffect,useState}from"react";

function parseFairwasUrl(value){
 const raw=String(value||"").trim();
 const match=raw.match(/^([a-z][a-z0-9+.-]*):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/i);
 if(!match)return null;
 return{protocol:match[1].toLowerCase(),hostname:match[2].toLowerCase(),pathname:match[3]||"/",search:match[4]||"",hash:match[5]||""};
}

function navigate(path){window.dispatchEvent(new CustomEvent("fairwas:navigate",{detail:"httc://createpage.fair"+path}))}

const publicRoutes=[
 ["/","Inicio"],
 ["/registry","Registro"],
 ["/landscape","Landscape"]
];
const privateRoutes=[
 ["/my/sites","Mis sitios"],
 ["/my/profile","Mi perfil"],
 ["/my/databases","Mis bases de datos"],
 ["/my/servers","Mis servidores"],
 ["/init","Crear sitio"],
 ["/editor","Editor"],
 ["/workers","Workers"]
];

async function api(action,options){
 const r=await fetch("/api/createpage?action="+encodeURIComponent(action),options);
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.ok)throw new Error(d.detail||d.error||"request_failed");
 return d;
}

export default function CreatePage({url}){
 let parsed;try{parsed=new URL(url)}catch{parsed=null}
 const host=parsed?.hostname||"createpage.fair";
 const path=parsed?.pathname||"/";
 if(host==="docs.createpage.fair")return <DocsPage path={path}/>;
 return <Workspace path={path}/>;
}

function Layout({path,children,hasAccount}){
 const go=p=>{window.dispatchEvent(new CustomEvent("fairwas:navigate",{detail:"httc://createpage.fair"+p}))};
 const routes=hasAccount?[...publicRoutes,...privateRoutes]:publicRoutes;
 return <section className="cp-shell">
  <aside className="cp-side">
   <div className="cp-brand"><span>CP</span><div><b>CreatePage</b><small>HTTC workspace</small></div></div>
   <nav>{routes.map(([p,label])=><button key={p} className={path===p?"active":""} onClick={()=>go(p)}>{label}</button>)}</nav>
   <div className="cp-side-foot">{hasAccount?"Cuenta de desarrollador registrada":"Sin cuenta de desarrollador"}<br/><b>HTTC · Pages · Server · Database</b></div>
  </aside>
  <div className="cp-content">{children}</div>
 </section>
}

function Workspace({path}){
 const[sites,setSites]=useState([]),[dbs,setDbs]=useState([]),[servers,setServers]=useState([]),[registry,setRegistry]=useState(null),[workers,setWorkers]=useState([]);
 const[error,setError]=useState("");
 const[loading,setLoading]=useState(true);
 const hasAccount=Boolean(registry?.developer?.developer_id);
 const reload=async()=>{
  setLoading(true);
  try{
   const r=await api("registry");
   setRegistry(r);
   if(r.developer){
    const [s,d,v,w]=await Promise.all([api("sites"),api("databases"),api("servers"),api("workers")]);
    setSites(s.items||[]);setDbs(d.items||[]);setServers(v.items||[]);setWorkers(w.items||[]);
   }else{
    setSites([]);setDbs([]);setServers([]);setWorkers([]);
   }
   setError("");
  }catch(e){setError(e.message)}
  finally{setLoading(false)}
 };
 useEffect(()=>{reload();const handler=()=>reload();window.addEventListener("fairwas:createpage-reload",handler);return()=>window.removeEventListener("fairwas:createpage-reload",handler)},[]);
 const privatePath=privateRoutes.some(([p])=>p===path);
 const effectivePath=privatePath&&!hasAccount?"/registry":path;
 const page=loading?<div className="cp-card cp-empty">Comprobando tu cuenta de desarrollador…</div>:
  effectivePath==="/" ? <Dashboard sites={sites} dbs={dbs} servers={servers} workers={workers}/>:
  effectivePath==="/init"?<Init onDone={reload}/>:
  effectivePath==="/my/sites"?<Sites sites={sites}/>:
  effectivePath==="/my/databases"?<Databases dbs={dbs}/>:
  effectivePath==="/my/servers"?<Servers servers={servers}/>:
  effectivePath==="/registry"?<Registry data={registry}/>:
  effectivePath==="/landscape"?<Landscape data={registry}/>:
  effectivePath==="/workers"?<Workers workers={workers}/>:
  effectivePath==="/editor"?<Editor/>:
  effectivePath==="/my/profile"?<Profile/>:<NotFound/>;
 return <Layout path={effectivePath} hasAccount={hasAccount}>{error&&<div className="cp-error">{error}</div>}{page}</Layout>
}

function Head({eyebrow,title,text}){return <header className="cp-head"><div><small>{eyebrow}</small><h1>{title}</h1>{text&&<p>{text}</p>}</div></header>}
function Dashboard({sites,dbs,servers,workers}){return <><Head eyebrow="CREATEPAGE" title="Tu infraestructura web" text="Crea, publica y administra sitios HTTC desde un único espacio."/><div className="cp-grid four"><Stat n={sites.length} t="Sitios publicados"/><Stat n={dbs.length} t="Bases de datos"/><Stat n={servers.length} t="Servidores"/><Stat n={workers.length} t="Workers"/></div><div className="cp-card cp-hero"><div><small>HTTC</small><h2>Publicación conectada</h2><p>Cada sitio se registra en Pages y Server. Las bases SQLite se registran en Database.</p></div><button type="button" onClick={()=>navigate("/init")}>Crear un sitio →</button></div></>}
function Stat({n,t}){return <div className="cp-card cp-stat"><b>{n}</b><span>{t}</span></div>}
function Sites({sites}){return <><Head eyebrow="MY / SITES" title="Mis sitios" text="Sitios almacenados y publicados en Pages."/><div className="cp-list">{sites.map(s=><div className="cp-card cp-row" key={s.site_id}><div><b>{s.title}</b><small>httc://{s.hostname}</small></div><span className="cp-pill">{s.status}</span></div>)}{!sites.length&&<Empty text="Todavía no hay sitios."/>}</div></>}
function Databases({dbs}){return <><Head eyebrow="MY / DATABASES" title="Mis bases de datos" text="Recursos de datos registrados en Database."/><div className="cp-list">{dbs.map(d=><div className="cp-card cp-row" key={d.id}><div><b>{d.name}</b><small>{d.engine} · {d.status}</small></div><span className="cp-pill">{d.site_id?"Conectada":"Libre"}</span></div>)}{!dbs.length&&<Empty text="No hay bases de datos."/>}</div></>}
function Servers({servers}){return <><Head eyebrow="MY / SERVERS" title="Mis servidores" text="Dominios y orígenes registrados en Server."/><div className="cp-list">{servers.map(s=><div className="cp-card cp-row" key={s.id}><div><b>{s.hostname}</b><small>{s.protocol} · {s.origin}</small></div><span className="cp-pill">{s.status}</span></div>)}{!servers.length&&<Empty text="No hay servidores."/>}</div></>}
function Registry({data}){const[displayName,setDisplayName]=useState(data?.developer?.display_name||"");const[email,setEmail]=useState(data?.developer?.email||"");const[ok,setOk]=useState(false);const[error,setError]=useState("");useEffect(()=>{setDisplayName(data?.developer?.display_name||"");setEmail(data?.developer?.email||"")},[data?.developer?.display_name,data?.developer?.email]);const saveDeveloper=async()=>{setOk(false);setError("");try{await api("developer",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({display_name:displayName,email})});setOk(true);window.dispatchEvent(new CustomEvent("fairwas:createpage-reload"))}catch(e){setError(e.message)}};return <><Head eyebrow="REGISTRY" title="Cuenta de desarrollador" text="Registra tu cuenta para vincular y publicar tus páginas en CreatePage."/><div className="cp-grid two"><div className="cp-card cp-form"><h3>Registro de desarrollador</h3><label>Nombre<input placeholder="Mi cuenta" value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label><label>Email<input type="email" placeholder="tu@email.com" value={email} onChange={e=>setEmail(e.target.value)}/></label><button onClick={saveDeveloper}>Registrar cuenta</button>{ok&&<small>Cuenta registrada. El ID de desarrollador se genera automáticamente.</small>}{error&&<div className="cp-error">{error}</div>}</div><div className="cp-card"><h3>Páginas vinculadas</h3>{data?.developer&&<><p className="cp-line"><b>{data.developer.display_name}</b><span>{data.developer.developer_id}</span></p><p className="cp-line"><b>Email</b><span>{data.developer.email||"Sin email"}</span></p><small>El ID de desarrollador es permanente para esta cuenta.</small></>}{data?.sites?.map(s=><p className="cp-line" key={s.site_id}><b>{s.hostname}</b><span>{s.status}</span></p>)}{!data?.sites?.length&&<p className="cp-empty">Registra tu cuenta y las nuevas páginas quedarán vinculadas aquí.</p>}</div></div></>}
function Landscape({data}){return <><Head eyebrow="LANDSCAPE" title="Infraestructura" text="El recorrido real de un sitio publicado."/><div className="cp-landscape"><Node t="CreatePage" s="Control"/><i>↓</i><Node t="Pages" s="Sitio + archivos"/><i>↔</i><Node t="Server" s="Dominio + origen"/><i>↓</i><Node t="HTTC" s={data?.sites?.length?data.sites.length+" sitios publicados":"Sin sitios publicados"}/></div></>}
function Node({t,s}){return <div className="cp-node"><b>{t}</b><span>{s}</span></div>}
function Workers({workers}){return <><Head eyebrow="WORKERS" title="Workers" text="Workers asociados al ecosistema CreatePage."/><div className="cp-list">{workers.map(w=><div className="cp-card cp-row" key={w.id}><div><b>{w.name}</b><small>{w.status}</small></div></div>)}{!workers.length&&<Empty text="No hay Workers todavía."/>}</div></>}
function Profile(){const[name,setName]=useState("Fairwas user");const[ok,setOk]=useState(false);useEffect(()=>{api("profile").then(x=>setName(x.profile.display_name)).catch(()=>{})},[]);return <><Head eyebrow="MY / PROFILE" title="Mi perfil"/><div className="cp-card cp-form"><label>Nombre<input value={name} onChange={e=>setName(e.target.value)}/></label><button onClick={async()=>{await api("profile",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({display_name:name})});setOk(true)}}>Guardar perfil</button>{ok&&<small>Guardado en Database.</small>}</div></>}
function Editor(){
 const[files,setFiles]=useState([{path:"/index.html",content:"<!doctype html>\n<html>\n<head><meta charset=\"utf-8\"><title>Mi sitio</title></head>\n<body><h1>Hola desde CreatePage</h1></body>\n</html>"}]);
 const[selected,setSelected]=useState("/index.html");
 const[code,setCode]=useState(files[0].content);
 const[site,setSite]=useState({hostname:"",title:"Mi sitio"});
 const[build,setBuild]=useState({root:"/",output:"/dist",command:"npm run build"});
 const[status,setStatus]=useState("");
 const[repoUrl,setRepoUrl]=useState("");
 const currentFiles=()=>files.map(file=>file.path===selected?{...file,content:code}:file);
 const normalizePath=raw=>{let path=String(raw||"").trim().replace(/\\/g,"/");if(!path.startsWith("/"))path="/"+path;path=path.replace(/\/+/g,"/");return path.length>1?path.replace(/\/$/,""):path};
 const pick=path=>{const file=files.find(item=>item.path===path);if(!file)return;setSelected(path);setCode(file.content)};
 const addFile=()=>{const raw=window.prompt("Ruta del archivo","/src/app.js");if(!raw)return;const path=normalizePath(raw);if(path.endsWith("/")){setStatus("Usa + Carpeta para crear directorios.");return}if(files.some(file=>file.path===path)){setStatus("Ese archivo ya existe.");return}const next=[...currentFiles(),{path,content:""}];setFiles(next);setSelected(path);setCode("");setStatus("Archivo creado.")};
 const addFolder=()=>{const raw=window.prompt("Ruta de la carpeta","/src/components");if(!raw)return;const path=normalizePath(raw).replace(/\/$/,"");if(files.some(file=>file.path.startsWith(path+"/"))){setStatus("Esa carpeta ya existe.");return}const marker=path+"/.gitkeep";const next=[...currentFiles(),{path:marker,content:""}];setFiles(next);setSelected(marker);setCode("");setStatus("Carpeta creada.")};
 const remove=()=>{if(!selected)return;const file=files.find(item=>item.path===selected);if(!file)return;if(!window.confirm("¿Eliminar "+file.path+"?"))return;const next=files.filter(item=>item.path!==selected);if(!next.length){setStatus("El proyecto necesita al menos un archivo.");return}setFiles(next);const target=next[0];setSelected(target.path);setCode(target.content);setStatus("Archivo eliminado.")};
 const rename=()=>{if(!selected)return;const raw=window.prompt("Nueva ruta",selected);if(!raw)return;const path=normalizePath(raw);if(path===selected)return;if(files.some(file=>file.path===path)){setStatus("Ya existe un archivo con esa ruta.");return}const next=currentFiles().map(file=>file.path===selected?{...file,path}:file);setFiles(next);setSelected(path);setCode(next.find(file=>file.path===path)?.content||"");setStatus("Archivo renombrado.")};
 const importFiles=event=>{const list=Array.from(event.target.files||[]);if(!list.length)return;Promise.all(list.map(file=>file.text().then(content=>({path:"/"+(file.webkitRelativePath||file.name).replace(/^\/+/, ""),content})))).then(items=>{setFiles(current=>{const map=new Map(currentFiles().map(file=>[file.path,file]));items.forEach(file=>map.set(file.path,file));return[...map.values()]});setStatus(items.length+" archivo"+(items.length===1?"":"s")+" importado"+(items.length===1?"":"s")+".")}).catch(error=>setStatus(error instanceof Error?error.message:"No se pudieron importar los archivos."))};
 const importRepo=async()=>{if(!repoUrl.trim()){setStatus("Introduce la URL del repositorio.");return}setStatus("Importando repositorio…");try{const data=await api("import",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({repo_url:repoUrl.trim()})});const imported=(data.files||[]).map(file=>({...file,path:normalizePath(file.path)}));if(!imported.length){setStatus("No se pudieron leer los archivos del repositorio.");return}setFiles(imported);setSite(current=>({...current,hostname:data.hostname||current.hostname,title:data.title||current.title}));setSelected(imported[0].path);setCode(imported[0].content||"");setStatus("Repositorio importado.")}catch(error){setStatus(error instanceof Error?error.message:"No se pudo importar el repositorio.")}};
 const publish=async()=>{const next=currentFiles();const index=next.find(file=>file.path==="/index.html");if(!index){setStatus("El proyecto importado no tiene un punto de entrada index.html en sus archivos publicados.");return}if(!site.hostname.trim()){setStatus("Introduce un dominio antes de publicar.");return}setStatus("Publicando…");try{const data=await api("create",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...site,hostname:site.hostname.trim().toLowerCase(),html:index.content,files:next,build_root:build.root,build_output:build.output,build_command:build.command})});setFiles(next);setStatus("Publicado: "+data.url)}catch(error){setStatus(error instanceof Error?error.message:"No se pudo publicar.")}};
 const tree=files.map(file=>file.path).sort((x,y)=>x.localeCompare(y)).map(path=>({path,depth:Math.max(0,path.split("/").length-2)}));
 return <section className="cp-ide">
  <div className="cp-ide-top"><div><small>CREATEPAGE IDE</small><h1>Editor del sitio</h1></div><div className="cp-ide-actions"><button type="button" onClick={addFile}>+ Archivo</button><button type="button" onClick={addFolder}>+ Carpeta</button><button type="button" onClick={rename}>Renombrar</button><button type="button" onClick={remove}>Eliminar</button><label className="cp-button">Importar carpeta<input type="file" multiple webkitdirectory="" onChange={importFiles}/></label><button type="button" onClick={publish}>Publicar</button></div></div>
  <div className="cp-ide-import"><input placeholder="https://github.com/usuario/repositorio" value={repoUrl} onChange={e=>setRepoUrl(e.target.value)}/><button type="button" onClick={importRepo}>Importar Git</button><input placeholder="dominio.fair" value={site.hostname} onChange={e=>setSite(s=>({...s,hostname:e.target.value}))}/><input placeholder="Nombre del sitio" value={site.title} onChange={e=>setSite(s=>({...s,title:e.target.value}))}/><input placeholder="Raíz del proyecto /" value={build.root} onChange={e=>setBuild(x=>({...x,root:e.target.value}))}/><input placeholder="Salida /dist" value={build.output} onChange={e=>setBuild(x=>({...x,output:e.target.value}))}/><input placeholder="Comando de compilación" value={build.command} onChange={e=>setBuild(x=>({...x,command:e.target.value}))}/></div>
  <div className="cp-ide-body"><aside className="cp-files" aria-label="Explorador de archivos"><div className="cp-files-title">EXPLORADOR</div>{tree.map(item=><button type="button" className={selected===item.path?"active":""} style={{paddingLeft:10+item.depth*14}} key={item.path} onClick={()=>pick(item.path)}>{item.path.split("/").pop()||"/"}<small>{item.path}</small></button>)}</aside><div className="cp-editor-wrap"><div className="cp-editor-head"><b>{selected}</b><span aria-live="polite">{status}</span></div><textarea className="cp-editor" value={code} onChange={e=>setCode(e.target.value)} spellCheck="false" aria-label={"Editor de "+selected}/></div></div>
 </section>;
}
function Init({onDone}){const[f,setF]=useState({hostname:"",title:"",description:"",framework:"React + Vite",language:"JavaScript",backend:"Cloudflare Pages Functions",runtime:"Cloudflare",database_type:"SQLite",database_name:"",html:""});const[busy,setBusy]=useState(false);const[done,setDone]=useState(null);const set=(k,v)=>setF(x=>({...x,[k]:v}));const submit=async e=>{e.preventDefault();setBusy(true);try{const r=await api("create",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(f)});setDone(r);onDone()}catch(e){setDone({error:e.message})}finally{setBusy(false)}};return <><Head eyebrow="INIT" title="Crear un sitio" text="Un único flujo registra el sitio, el dominio y la publicación real."/><form className="cp-card cp-form" onSubmit={submit}><div className="cp-grid two"><label>Dominio<input required placeholder="miweb.fair" value={f.hostname} onChange={e=>set("hostname",e.target.value)}/><small>Se publicará como httc://miweb.fair</small></label><label>Nombre<input required placeholder="Mi web" value={f.title} onChange={e=>set("title",e.target.value)}/></label><label>Framework<select value={f.framework} onChange={e=>set("framework",e.target.value)}><option>React + Vite</option><option>Vanilla</option><option>Custom</option></select></label><label>Lenguaje<select value={f.language} onChange={e=>set("language",e.target.value)}><option>JavaScript</option><option>TypeScript</option><option>HTML</option></select></label><label>Backend<input value={f.backend} onChange={e=>set("backend",e.target.value)}/></label><label>Runtime<input value={f.runtime} onChange={e=>set("runtime",e.target.value)}/></label><label>Base de datos<input placeholder="UserData" value={f.database_name} onChange={e=>set("database_name",e.target.value)}/><small>Motor: SQLite</small></label><label>Logo URL<input value={f.logo_url||""} onChange={e=>set("logo_url",e.target.value)}/></label></div><label>Descripción<textarea value={f.description} onChange={e=>set("description",e.target.value)} /></label><label>index.html<textarea className="codebox" value={f.html} onChange={e=>set("html",e.target.value)} /></label><div className="cp-publishbar"><span>Protocolo <b>HTTC</b> · destino Pages + Server</span><button disabled={busy}>{busy?"Publicando…":"Crear y publicar"}</button></div>{done?.error&&<div className="cp-error">{done.error}</div>}{done?.status==="published"&&<div className="cp-success">Publicado: <b>{done.url}</b> · {done.version}</div>}</form></>}
function DocsPage({path}){return <section className="cp-docs"><small>CREATEPAGE DOCS</small><h1>Documentación</h1><p>HTTC, publicación, Pages, Database y Server.</p><div className="cp-card"><h2>{path}</h2><p>La documentación de CreatePage se sirve bajo <b>docs.createpage.fair</b>.</p></div></section>}
function Empty({text}){return <div className="cp-card cp-empty">{text}</div>}
function NotFound(){return <><Head eyebrow="404" title="Ruta no encontrada"/><Empty text="Esta dirección de CreatePage no existe."/></>}
