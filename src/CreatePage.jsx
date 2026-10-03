import React,{useEffect,useState}from"react";

const routes=[
 ["/","Inicio"],
 ["/my/sites","Mis sitios"],
 ["/my/profile","Mi perfil"],
 ["/my/databases","Mis bases de datos"],
 ["/my/servers","Mis servidores"],
 ["/registry","Registro"],
 ["/landscape","Landscape"],
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
 const host=parsed?.hostname||"web.createpage.fair";
 const path=parsed?.pathname||"/";
 if(host==="docs.createpage.fair")return <DocsPage path={path}/>;
 return <Workspace path={path}/>;
}

function Layout({path,children}){
 const go=p=>{window.dispatchEvent(new CustomEvent("fairwas:navigate",{detail:"httc://web.createpage.fair"+p}))};
 return <section className="cp-shell">
  <aside className="cp-side">
   <div className="cp-brand"><span>CP</span><div><b>CreatePage</b><small>HTTC workspace</small></div></div>
   <nav>{routes.map(([p,label])=><button key={p} className={path===p?"active":""} onClick={()=>go(p)}>{label}</button>)}</nav>
   <div className="cp-side-foot">Connected<br/><b>Pages · Database · Server</b></div>
  </aside>
  <div className="cp-content">{children}</div>
 </section>
}

function Workspace({path}){
 const[sites,setSites]=useState([]),[dbs,setDbs]=useState([]),[servers,setServers]=useState([]),[registry,setRegistry]=useState(null),[workers,setWorkers]=useState([]);
 const[error,setError]=useState("");
 const reload=async()=>{
  try{
   const [s,d,v,r,w]=await Promise.all([api("sites"),api("databases"),api("servers"),api("registry"),api("workers")]);
   setSites(s.items);setDbs(d.items);setServers(v.items);setRegistry(r);setWorkers(w.items);setError("");
  }catch(e){setError(e.message)}
 };
 useEffect(()=>{reload()},[]);
 const page=path==="/" ? <Dashboard sites={sites} dbs={dbs} servers={servers} workers={workers}/>:path==="/init"?<Init onDone={reload}/>:path==="/my/sites"?<Sites sites={sites}/>:path==="/my/databases"?<Databases dbs={dbs}/>:path==="/my/servers"?<Servers servers={servers}/>:path==="/registry"?<Registry data={registry}/>:path==="/landscape"?<Landscape data={registry}/>:path==="/workers"?<Workers workers={workers}/>:path==="/editor"?<Editor/>:path==="/my/profile"?<Profile/>:<NotFound/>;
 return <Layout path={path}>{error&&<div className="cp-error">{error}</div>}{page}</Layout>
}

function Head({eyebrow,title,text}){return <header className="cp-head"><div><small>{eyebrow}</small><h1>{title}</h1>{text&&<p>{text}</p>}</div></header>}
function Dashboard({sites,dbs,servers,workers}){return <><Head eyebrow="CREATEPAGE" title="Tu infraestructura web" text="Crea, publica y administra sitios HTTC desde un único espacio."/><div className="cp-grid four"><Stat n={sites.length} t="Sitios publicados"/><Stat n={dbs.length} t="Bases de datos"/><Stat n={servers.length} t="Servidores"/><Stat n={workers.length} t="Workers"/></div><div className="cp-card cp-hero"><div><small>HTTC</small><h2>Publicación conectada</h2><p>Cada sitio se registra en Pages y Server. Las bases SQLite se registran en Database.</p></div><a onClick={()=>window.dispatchEvent(new CustomEvent("fairwas:navigate",{detail:"httc://web.createpage.fair/init"}))}>Crear un sitio →</a></div></>}
function Stat({n,t}){return <div className="cp-card cp-stat"><b>{n}</b><span>{t}</span></div>}
function Sites({sites}){return <><Head eyebrow="MY / SITES" title="Mis sitios" text="Sitios almacenados y publicados en Pages."/><div className="cp-list">{sites.map(s=><div className="cp-card cp-row" key={s.site_id}><div><b>{s.title}</b><small>httc://{s.hostname}</small></div><span className="cp-pill">{s.status}</span></div>)}{!sites.length&&<Empty text="Todavía no hay sitios."/ >}</div></>}
function Databases({dbs}){return <><Head eyebrow="MY / DATABASES" title="Mis bases de datos" text="Recursos de datos registrados en Database."/><div className="cp-list">{dbs.map(d=><div className="cp-card cp-row" key={d.id}><div><b>{d.name}</b><small>{d.engine} · {d.status}</small></div><span className="cp-pill">{d.site_id?"Conectada":"Libre"}</span></div>)}{!dbs.length&&<Empty text="No hay bases de datos."/ >}</div></>}
function Servers({servers}){return <><Head eyebrow="MY / SERVERS" title="Mis servidores" text="Dominios y orígenes registrados en Server."/><div className="cp-list">{servers.map(s=><div className="cp-card cp-row" key={s.id}><div><b>{s.hostname}</b><small>{s.protocol} · {s.origin}</small></div><span className="cp-pill">{s.status}</span></div>)}{!servers.length&&<Empty text="No hay servidores."/ >}</div></>}
function Registry({data}){const[developerId,setDeveloperId]=useState(data?.developer?.developer_id||"");const[displayName,setDisplayName]=useState(data?.developer?.display_name||"");const[ok,setOk]=useState(false);const[error,setError]=useState("");const saveDeveloper=async()=>{setOk(false);setError("");try{await api("developer",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({developer_id:developerId,display_name:displayName})});setOk(true)}catch(e){setError(e.message)}};return <><Head eyebrow="REGISTRY" title="Cuenta de desarrollador" text="Registra tu cuenta para vincular y publicar tus páginas en CreatePage."/><div className="cp-grid two"><div className="cp-card cp-form"><h3>Registro de desarrollador</h3><label>ID de desarrollador<input placeholder="mi-cuenta" value={developerId} onChange={e=>setDeveloperId(e.target.value)}/><small>3–32 caracteres: letras, números y guiones.</small></label><label>Nombre<input placeholder="Mi cuenta" value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label><button onClick={saveDeveloper}>Registrar cuenta</button>{ok&&<small>Cuenta registrada.</small>}{error&&<div className="cp-error">{error}</div>}</div><div className="cp-card"><h3>Páginas vinculadas</h3>{data?.developer&&<p className="cp-line"><b>{data.developer.display_name}</b><span>{data.developer.developer_id}</span></p>}{data?.sites?.map(s=><p className="cp-line" key={s.site_id}><b>{s.hostname}</b><span>{s.status}</span></p>)}{!data?.sites?.length&&<p className="cp-empty">Registra tu cuenta y las nuevas páginas quedarán vinculadas aquí.</p>}</div></div></>}
function Landscape({data}){return <><Head eyebrow="LANDSCAPE" title="Infraestructura" text="El recorrido real de un sitio publicado."/><div className="cp-landscape"><Node t="CreatePage" s="Control"/><i>↓</i><Node t="Pages" s="Sitio + archivos"/><i>↔</i><Node t="Server" s="Dominio + origen"/><i>↓</i><Node t="HTTC" s={data?.sites?.length?data.sites.length+" sitios publicados":"Sin sitios publicados"}/></div></>}
function Node({t,s}){return <div className="cp-node"><b>{t}</b><span>{s}</span></div>}
function Workers({workers}){return <><Head eyebrow="WORKERS" title="Workers" text="Workers asociados al ecosistema CreatePage."/><div className="cp-list">{workers.map(w=><div className="cp-card cp-row" key={w.id}><div><b>{w.name}</b><small>{w.status}</small></div></div>)}{!workers.length&&<Empty text="No hay Workers todavía."/ >}</div></>}
function Profile(){const[name,setName]=useState("Fairwas user");const[ok,setOk]=useState(false);useEffect(()=>{api("profile").then(x=>setName(x.profile.display_name)).catch(()=>{})},[]);return <><Head eyebrow="MY / PROFILE" title="Mi perfil"/><div className="cp-card cp-form"><label>Nombre<input value={name} onChange={e=>setName(e.target.value)}/></label><button onClick={async()=>{await api("profile",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({display_name:name})});setOk(true)}}>Guardar perfil</button>{ok&&<small>Guardado en Database.</small>}</div></>}
function Editor(){const[files,setFiles]=useState([{path:"/index.html",content:"<!doctype html>\\n<html>\\n<head><meta charset=\"utf-8\"><title>Mi sitio</title></head>\\n<body><h1>Hola desde CreatePage</h1></body>\\n</html>"}]);const[selected,setSelected]=useState("/index.html");const[code,setCode]=useState(files[0].content);const[site,setSite]=useState({hostname:"",title:"Mi sitio"});const[status,setStatus]=useState("");const[repoUrl,setRepoUrl]=useState("");const pick=p=>{setSelected(p);setCode(files.find(f=>f.path===p)?.content||"")};const sync=()=>setFiles(fs=>fs.map(f=>f.path===selected?{...f,content:code}:f));const add=()=>{const p=prompt("Ruta del archivo","/app.js");if(!p)return;sync();setFiles(fs=>[...fs,{path:p.startsWith("/")?p:"/"+p,content:""}]);setSelected(p.startsWith("/")?p:"/"+p);setCode("")};const importFiles=e=>{const list=[...e.target.files];if(!list.length)return;Promise.all(list.map(f=>f.text().then(content=>({path:"/"+f.webkitRelativePath||"/"+f.name,content})))).then(items=>{sync();setFiles(fs=>{const map=new Map(fs.map(x=>[x.path,x]));items.forEach(x=>map.set(x.path,x));return[...map.values()]})})};const importRepo=async()=>{setStatus("Importando repositorio…");try{const d=await api("import",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({repo_url:repoUrl})});setFiles(d.files);setSite(s=>({...s,hostname:d.hostname||s.hostname,title:d.title||s.title}));setSelected(d.files[0]?.path||"/index.html");setCode(d.files[0]?.content||"");setStatus("Repositorio importado.")}catch(e){setStatus(e.message)} };const publish=async()=>{sync();setStatus("Publicando…");try{const d=await api("create",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...site,html:files.find(f=>f.path==="/index.html")?.content||code,files})});setStatus("Publicado: "+d.url)}catch(e){setStatus(e.message)}};useEffect(()=>{const f=files.find(x=>x.path===selected);if(f&&f.content!==code)setCode(f.content)},[selected]);return <section className="cp-ide"><div className="cp-ide-top"><div><small>CREATEPAGE IDE</small><h1>Editor del sitio</h1></div><div className="cp-ide-actions"><button onClick={add}>+ Archivo</button><label className="cp-button">Importar archivo/carpeta<input type="file" multiple webkitdirectory="" onChange={importFiles}/></label><button onClick={publish}>Publicar</button></div></div><div className="cp-ide-import"><input placeholder="https://github.com/usuario/repositorio" value={repoUrl} onChange={e=>setRepoUrl(e.target.value)}/><button onClick={importRepo}>Importar repositorio Git</button><input placeholder="dominio.fair" value={site.hostname} onChange={e=>setSite(s=>({...s,hostname:e.target.value}))}/><input placeholder="Nombre del sitio" value={site.title} onChange={e=>setSite(s=>({...s,title:e.target.value}))}</div><div className="cp-ide-body"><aside className="cp-files">{files.map(f=><button className={selected===f.path?"active":""} key={f.path} onClick={()=>pick(f.path)}>{f.path}</button>)}</aside><div className="cp-editor-wrap"><div className="cp-editor-head"><b>{selected}</b><span>{status}</span></div><textarea className="cp-editor" value={code} onChange={e=>setCode(e.target.value)} onBlur={sync} spellCheck="false"/></div></div></section>}

function Init({onDone}){const[f,setF]=useState({hostname:"",title:"",description:"",framework:"React + Vite",language:"JavaScript",backend:"Cloudflare Pages Functions",runtime:"Cloudflare",database_type:"SQLite",database_name:"",html:""});const[busy,setBusy]=useState(false);const[done,setDone]=useState(null);const set=(k,v)=>setF(x=>({...x,[k]:v}));const submit=async e=>{e.preventDefault();setBusy(true);try{const r=await api("create",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(f)});setDone(r);onDone()}catch(e){setDone({error:e.message})}finally{setBusy(false)}};return <><Head eyebrow="INIT" title="Crear un sitio" text="Un único flujo registra el sitio, el dominio y la publicación real."/><form className="cp-card cp-form" onSubmit={submit}><div className="cp-grid two"><label>Dominio<input required placeholder="miweb.fair" value={f.hostname} onChange={e=>set("hostname",e.target.value)}/><small>Se publicará como httc://miweb.fair</small></label><label>Nombre<input required placeholder="Mi web" value={f.title} onChange={e=>set("title",e.target.value)}/></label><label>Framework<select value={f.framework} onChange={e=>set("framework",e.target.value)}><option>React + Vite</option><option>Vanilla</option><option>Custom</option></select></label><label>Lenguaje<select value={f.language} onChange={e=>set("language",e.target.value)}><option>JavaScript</option><option>TypeScript</option><option>HTML</option></select></label><label>Backend<input value={f.backend} onChange={e=>set("backend",e.target.value)}/></label><label>Runtime<input value={f.runtime} onChange={e=>set("runtime",e.target.value)}/></label><label>Base de datos<input placeholder="UserData" value={f.database_name} onChange={e=>set("database_name",e.target.value)}/><small>Motor: SQLite</small></label><label>Logo URL<input value={f.logo_url||""} onChange={e=>set("logo_url",e.target.value)}/></label></div><label>Descripción<textarea value={f.description} onChange={e=>set("description",e.target.value)} /></label><label>index.html<textarea className="codebox" value={f.html} onChange={e=>set("html",e.target.value)} placeholder="<!doctype html>..." /></label><div className="cp-publishbar"><span>Protocolo <b>HTTC</b> · destino Pages + Server</span><button disabled={busy}>{busy?"Publicando…":"Crear y publicar"}</button></div>{done?.error&&<div className="cp-error">{done.error}</div>}{done?.status==="published"&&<div className="cp-success">Publicado: <b>{done.url}</b> · {done.version}</div>}</form></>}
function DocsPage({path}){return <section className="cp-docs"><small>CREATEPAGE DOCS</small><h1>Documentación</h1><p>HTTC, publicación, Pages, Database y Server.</p><div className="cp-card"><h2>{path}</h2><p>La documentación de CreatePage se sirve bajo <b>docs.createpage.fair</b>.</p></div></section>}
function Empty({text}){return <div className="cp-card cp-empty">{text}</div>}
function NotFound(){return <><Head eyebrow="404" title="Ruta no encontrada"/><Empty text="Esta dirección de CreatePage no existe."/></>}
