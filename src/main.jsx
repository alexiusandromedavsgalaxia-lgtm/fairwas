import React,{useEffect,useMemo,useState}from"react";
import{createRoot}from"react-dom/client";
import"./styles.css";
import{PROTOCOLS,protocolFor,toFairwas}from"./protocols";
import{load,save}from"./storage";

const home="httc://home";
const makeNav=tab=>({...tab,back:tab.back||[],forward:tab.forward||[]});
const makeTab=(url=home)=>makeNav({id:crypto.randomUUID(),url,title:url===home?"Fairwas":hostOf(url)});
const hostOf=(url)=>{try{return new URL(url).hostname||url.split("/")[2]||url}catch{return url}};
const initial=load();

function App(){
 const[tabs,setTabs]=useState([makeTab(initial.settings.home||home)]);
 const[active,setActive]=useState(0);
 const[address,setAddress]=useState(initial.settings.home||home);
 const[dark,setDark]=useState(initial.settings.dark!==false);
 const[history,setHistory]=useState(initial.history||[]);
 const[bookmarks,setBookmarks]=useState(initial.bookmarks||[]);
 const[panel,setPanel]=useState(null);
 const[resolved,setResolved]=useState(null);
 const[resolveError,setResolveError]=useState(null);
 const tab=tabs[active]||tabs[0];
 const scheme=protocolFor(tab.url);

 useEffect(()=>save({history,bookmarks,settings:{...initial.settings,dark,home}}),[history,bookmarks,dark]);
 useEffect(()=>setAddress(tab.url),[tab.id,tab.url]);
 useEffect(()=>{
  let cancelled=false;
  setResolved(null);setResolveError(null);
  if(tab.url===home||!protocolFor(tab.url))return;
  fetch("/api/resolve?url="+encodeURIComponent(tab.url))
   .then(r=>r.json().then(data=>({ok:r.ok,data})))
   .then(({ok,data})=>{if(cancelled)return;if(!ok||!data.ok)throw new Error(data.error||"resolve_failed");setResolved(data)})
   .catch(e=>{if(!cancelled)setResolveError(e.message||"resolve_failed")});
  return()=>{cancelled=true};
 },[tab.id,tab.url]);

 useEffect(()=>{
  const key=e=>{
   if((e.ctrlKey||e.metaKey)&&e.key==="l"){e.preventDefault();document.querySelector("#address")?.select()}
   if((e.ctrlKey||e.metaKey)&&e.key==="t"){e.preventDefault();newTab()}
   if((e.ctrlKey||e.metaKey)&&e.key==="w"){e.preventDefault();closeTab(active)}
   if((e.ctrlKey||e.metaKey)&&e.key==="d"){e.preventDefault();bookmark()}
   if((e.ctrlKey||e.metaKey)&&e.key==="h"){e.preventDefault();setPanel("history")}
   if((e.ctrlKey||e.metaKey)&&e.key==="b"){e.preventDefault();setPanel("bookmarks")}
  };
  addEventListener("keydown",key);return()=>removeEventListener("keydown",key)
 },[active,tabs,tab,history,bookmarks]);

 function newTab(){setTabs(t=>[...t,makeTab()]);setActive(tabs.length)}
 function closeTab(i){if(tabs.length===1){setTabs([makeTab()]);setActive(0);return}setTabs(t=>t.filter((_,n)=>n!==i));setActive(a=>Math.min(a,tabs.length-2))}
 async function navigate(raw=address){
  const url=toFairwas(raw);
  setTabs(t=>t.map((x,i)=>{
   if(i!==active||url===x.url)return x;
   return {...x,url,title:url===home?"Fairwas":hostOf(url),back:[...x.back,x.url],forward:[]};
  }));
  if(url!==home)setHistory(h=>[{url,title:hostOf(url),time:new Date().toISOString()},...h.filter(x=>x.url!==url)].slice(0,100));
  setPanel(null);
 }
 function bookmark(){
  if(tab.url===home||bookmarks.some(x=>x.url===tab.url))return;
  setBookmarks(b=>[{url:tab.url,title:tab.title,time:new Date().toISOString()},...b])
 }
 function openItem(url){navigate(url)}
 function goBack(){setTabs(t=>t.map((x,i)=>{if(i!==active||!x.back.length)return x;const back=[...x.back];const url=back.pop();return {...x,url,title:url===home?"Fairwas":hostOf(url),back,forward:[x.url,...x.forward]}}))}
 function goForward(){setTabs(t=>t.map((x,i)=>{if(i!==active||!x.forward.length)return x;const [url,...forward]=x.forward;return {...x,url,title:url===home?"Fairwas":hostOf(url),back:[...x.back,x.url],forward}}))}
 function clearHistory(){setHistory([])}
 const protocolList=useMemo(()=>Object.values(PROTOCOLS),[]);

 return <div className={"app "+(dark?"dark":"light")}>
  <header className="chrome">
   <div className="brand"><span className="logo">F</span><b>Fairwas</b><span className="tag">protocol-first</span></div>
   <div className="tabs">
    {tabs.map((t,i)=><button className={"tab "+(i===active?"active":"")} key={t.id} onClick={()=>setActive(i)}><span className="tabdot">{i===active?"●":"○"}</span><span className="tabtext">{t.title}</span>{tabs.length>1&&<i onClick={e=>{e.stopPropagation();closeTab(i)}}>×</i>}</button>)}
    <button className="newtab" onClick={newTab}>+</button>
   </div>
   <div className="toolbar">
    <button onClick={goBack} disabled={!tab.back.length} aria-label="Atrás">←</button>
    <button onClick={goForward} disabled={!tab.forward.length} aria-label="Adelante">→</button>
    <button onClick={()=>location.reload()} aria-label="Recargar">↻</button>
    <form className="addressbar" onSubmit={e=>{e.preventDefault();navigate()}}>
      <span className={scheme?"scheme-dot":""}>{scheme?scheme.label:"⌕"}</span>
      <input id="address" value={address} onChange={e=>setAddress(e.target.value)} aria-label="Dirección o búsqueda"/>
      <button type="button" className="mini" onClick={bookmark}>☆</button>
    </form>
    <button onClick={()=>setPanel(panel==="bookmarks"?null:"bookmarks")}>★</button>
    <button onClick={()=>setPanel(panel==="history"?null:"history")}>◷</button>
    <button onClick={()=>setPanel(panel==="settings"?null:"settings")}>☰</button>
   </div>
  </header>

  {panel&&<aside className="panel">
   {panel==="history"&&<><div className="paneltitle"><b>Historial</b><button onClick={clearHistory}>Borrar</button></div>{history.length?<div className="list">{history.map((x,i)=><button className="listitem" key={x.url+i} onClick={()=>openItem(x.url)}><b>{x.title}</b><small>{x.url}</small></button>)}</div>:<p className="empty">Todavía no hay páginas visitadas.</p>}</>}
   {panel==="bookmarks"&&<><div className="paneltitle"><b>Favoritos</b></div>{bookmarks.length?<div className="list">{bookmarks.map(x=><button className="listitem" key={x.url} onClick={()=>openItem(x.url)}><b>{x.title}</b><small>{x.url}</small></button>)}</div>:<p className="empty">Guarda una página con ☆.</p>}</>}
   {panel==="settings"&&<><div className="paneltitle"><b>Ajustes</b></div><label className="setting"><span>Modo oscuro</span><input type="checkbox" checked={dark} onChange={e=>setDark(e.target.checked)}/></label><div className="settingblock"><b>Protocolos</b>{protocolList.map(p=><div className="protocolrow" key={p.scheme}><span>{p.label}</span><small>{p.scheme}:// · {p.region}</small></div>)}</div></>}
  </aside>}

  <main className="viewport">
   {tab.url===home?<Home navigate={navigate} protocols={protocolList} history={history} bookmarks={bookmarks}/>:<ProtocolPage tab={tab} scheme={scheme} resolved={resolved} resolveError={resolveError}/>}
  </main>
 </div>
}

function Home({navigate,protocols,history,bookmarks}){
 const[q,setQ]=useState("");
 return <section className="home">
  <div className="hero"><div className="biglogo">F</div><h1>Fairwas</h1><p>la web, con sus propios protocolos.</p>
   <form onSubmit={e=>{e.preventDefault();navigate(q)}}><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Busca o escribe una dirección"/><button>Ir</button></form>
  </div>
  <div className="protocol-grid">{protocols.map(p=><button key={p.scheme} onClick={()=>navigate(p.scheme+"://home")}><strong>{p.label}</strong><code>{p.scheme}://</code><small>{p.description}</small></button>)}</div>
  <div className="quick"><div><b>Protocolos</b><span>HTTC · AMWP · EUWP · ASWP · AFWP · OCWP</span></div><div><b>Estado</b><span>interfaz lista · resolución preparada</span></div><div><b>Datos</b><span>{history.length} visitas · {bookmarks.length} favoritos</span></div></div>
 </section>
}

function ProtocolPage({tab,scheme,resolved,resolveError}){
 return <section className="protocol-page">
  <div className="page-icon">{scheme?.label?.[0]||"F"}</div>
  <span className="eyebrow">{scheme?.label||"PROTOCOLO"}</span>
  <h1>{tab.title}</h1><code className="fullurl">{tab.url}</code>
  <div className="state"><span className="pulse"></span><b>Dirección aceptada por Fairwas</b><p>{scheme?scheme.description:"Esquema externo"}</p></div>
  <div className={"transport "+(resolveError?"error":"")}><b>{resolveError?"Error de resolución":"Capa de transporte"}</b><span>{resolveError?resolveError:resolved?"resuelta por /api/resolve":"resolviendo…"}</span><small>{resolved?.document?.type==="home"?"Documento interno del protocolo listo para renderizar.":resolved?.document?.type==="resource"?"Recurso reconocido por el backend; todavía no se descarga contenido externo.":"El backend valida el esquema, registra la visita y devuelve un documento estructurado."}</small></div>
 </section>
}

createRoot(document.getElementById("root")).render(<App/>);