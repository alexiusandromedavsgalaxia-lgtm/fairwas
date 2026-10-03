import React,{useEffect,useMemo,useState}from"react";
import{createRoot}from"react-dom/client";
import"./styles.css";
import{protocolFor,toFairwas}from"./protocols";
import{load,save}from"./storage";
import CreatePage from"./CreatePage";

const home="httc://home";
const makeNav=tab=>({...tab,back:tab.back||[],forward:tab.forward||[]});
const makeTab=(url=home,tab={})=>makeNav({id:tab.id||crypto.randomUUID(),url,title:tab.title|| (url===home?"Inicio":hostOf(url)),back:Array.isArray(tab.back)?tab.back:[],forward:Array.isArray(tab.forward)?tab.forward:[]});
const displayAddress=(url,mobile=false)=>{const value=String(url||"").trim();if(!value)return"";try{const parsed=new URL(value);if(parsed.protocol!=="httc:")return value;const host=parsed.hostname||"";if(!host||host==="home")return value;const path=(parsed.pathname&&parsed.pathname!=="/"?parsed.pathname:"")+(parsed.search||"")+(parsed.hash||"");return mobile?host+path:"httc://web."+host+path;}catch{return value}};
const normalizeAddress=(raw)=>{const value=String(raw||"").trim();const match=value.match(/^httc:\/\/web\.([^/?#]+)(\/[^?#]*)?(?:\?([^#]*))?(?:#(.*))?$/i);if(match)return"httc://"+match[1]+(match[2]||"/")+(match[3]?"?"+match[3]:"")+(match[4]?"#"+match[4]:"");return value;};
const hostOf=(url)=>{const value=String(url||"").trim();try{return new URL(value).hostname||value.split("/")[2]||value}catch{const match=value.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i);return match?.[1]||value}};
const initial=load();
const savedTabs=Array.isArray(initial.tabs)&&initial.tabs.length?initial.tabs.map(t=>makeTab(t.url||home,t)):[makeTab(initial.settings.home||home)];
const savedActive=Number.isInteger(initial.activeTab)?Math.max(0,Math.min(initial.activeTab,savedTabs.length-1)):0;

function App(){
 const[tabs,setTabs]=useState(savedTabs);
 const[active,setActive]=useState(savedActive);
 const[address,setAddress]=useState(initial.settings.home||home);
 const[mobile,setMobile]=useState(()=>typeof window!=="undefined"&&window.matchMedia("(max-width: 720px)").matches);
 const[dark,setDark]=useState(initial.settings.dark!==false);
 const[history,setHistory]=useState(initial.history||[]);
 const[bookmarks,setBookmarks]=useState(initial.bookmarks||[]);
 const[panel,setPanel]=useState(null);
 const[resolved,setResolved]=useState(null);
 const[resolveError,setResolveError]=useState(null);
 const tab=tabs[active]||tabs[0];
 const scheme=protocolFor(tab.url);
 const isCreatePage=(()=>{const host=hostOf(tab.url).toLowerCase();return host==="createpage.fair"||host==="docs.createpage.fair"})();

 useEffect(()=>save({history,bookmarks,settings:{...initial.settings,dark,home},tabs,activeTab:active,currentPage:tab?.url||home,activity:tab?.url===home?"idle":"browsing"}),[history,bookmarks,dark,tabs,active,tab?.url]);
 useEffect(()=>setAddress(displayAddress(tab.url,mobile)),[tab.id,tab.url,mobile]);
 useEffect(()=>{const mq=window.matchMedia("(max-width: 720px)");const onChange=()=>setMobile(mq.matches);onChange();mq.addEventListener?.("change",onChange);return()=>mq.removeEventListener?.("change",onChange)},[]);
 useEffect(()=>{
  let cancelled=false;
  setResolved(null);setResolveError(null);
  if(tab.url===home||!protocolFor(tab.url))return;
  fetch("/api/resolve?url="+encodeURIComponent(tab.url))
   .then(async r=>{const data=await r.json();if(!r.ok||!data.ok)throw new Error(data.error||"resolve_failed");return data})
   .then(data=>{if(!cancelled)setResolved(data)})
   .catch(e=>{if(!cancelled)setResolveError(e.message||"resolve_failed")});
  return()=>{cancelled=true};
 },[tab.id,tab.url]);

 useEffect(()=>{
  const onFairwasNavigate=e=>navigate(e.detail);
  addEventListener("fairwas:navigate",onFairwasNavigate);
  const key=e=>{
   if((e.ctrlKey||e.metaKey)&&e.key==="l"){e.preventDefault();document.querySelector("#address")?.select()}
   if((e.ctrlKey||e.metaKey)&&e.key==="t"){e.preventDefault();newTab()}
   if((e.ctrlKey||e.metaKey)&&e.key==="w"){e.preventDefault();closeTab(active)}
   if((e.ctrlKey||e.metaKey)&&e.key==="d"){e.preventDefault();bookmark()}
   if((e.ctrlKey||e.metaKey)&&e.key==="h"){e.preventDefault();setPanel("history")}
   if((e.ctrlKey||e.metaKey)&&e.key==="b"){e.preventDefault();setPanel("bookmarks")}
  };
  addEventListener("keydown",key);return()=>{removeEventListener("keydown",key);removeEventListener("fairwas:navigate",onFairwasNavigate)}
 },[active,tabs,tab]);

 function newTab(){const next=makeTab();setTabs(t=>[...t,next]);setActive(tabs.length)}
 function closeTab(i){if(tabs.length===1){setTabs([makeTab()]);setActive(0);return}setTabs(t=>t.filter((_,n)=>n!==i));setActive(a=>Math.min(a,tabs.length-2))}
 function navigate(raw=address){
  const url=toFairwas(normalizeAddress(raw));
  setTabs(t=>t.map((x,i)=>i!==active||url===x.url?x:{...x,url,title:url===home?"Inicio":hostOf(url),back:[...x.back,x.url],forward:[]}));
  if(url!==home)setHistory(h=>[{url,title:hostOf(url),time:new Date().toISOString()},...h.filter(x=>x.url!==url)].slice(0,100));
  setPanel(null);
 }
 function bookmark(){if(tab.url===home||bookmarks.some(x=>x.url===tab.url))return;setBookmarks(b=>[{url:tab.url,title:tab.title,time:new Date().toISOString()},...b])}
 function openItem(url){navigate(url)}
 function goBack(){setTabs(t=>t.map((x,i)=>{if(i!==active||!x.back.length)return x;const back=[...x.back];const url=back.pop();return{...x,url,title:url===home?"Inicio":hostOf(url),back,forward:[x.url,...x.forward]}}))}
 function goForward(){setTabs(t=>t.map((x,i)=>{if(i!==active||!x.forward.length)return x;const[url,...forward]=x.forward;return{...x,url,title:url===home?"Inicio":hostOf(url),back:[...x.back,x.url],forward}}))}
 function clearHistory(){setHistory([])}


 return <div className={"app "+(dark?"dark":"light")}>
  <header className="chrome">
   <div className="topbar">
    <div className="traffic-space"><span></span><span></span><span></span></div>
    <div className="tabstrip">
     {tabs.map((t,i)=><button className={"tab "+(i===active?"active":"")} key={t.id} onClick={()=>setActive(i)}><span className="tab-favicon">{t.url===home?"":t.title?.[0]}</span><span className="tabtext">{t.title}</span>{tabs.length>1&&<i onClick={e=>{e.stopPropagation();closeTab(i)}}>×</i>}</button>)}
     <button className="newtab" onClick={newTab} aria-label="Nueva pestaña">+</button>
    </div>
   </div>
   <div className="toolbar">
    <div className="navgroup">
     <button onClick={goBack} disabled={!tab.back.length} aria-label="Atrás">‹</button>
     <button onClick={goForward} disabled={!tab.forward.length} aria-label="Adelante">›</button>
    </div>
    <form className="addressbar" onSubmit={e=>{e.preventDefault();navigate()}}>
      <span className="site-control">⌄</span>
      <input id="address" value={address} onChange={e=>setAddress(e.target.value)} aria-label="Dirección o búsqueda" spellCheck="false"/>
      {tab.url!==home&&<button type="button" className="address-action" onClick={bookmark} aria-label="Añadir a favoritos">☆</button>}
    </form>
    <div className="toolgroup">
     <button onClick={()=>setPanel(panel==="bookmarks"?null:"bookmarks")} aria-label="Barra lateral">☰</button>
     <button onClick={()=>setPanel(panel==="history"?null:"history")} aria-label="Historial">◷</button>
     <button onClick={()=>setPanel(panel==="settings"?null:"settings")} aria-label="Más opciones">•••</button>
    </div>
   </div>
  </header>

  {panel&&<aside className="panel">
   {panel==="history"&&<><div className="paneltitle"><b>Historial</b><button onClick={clearHistory}>Borrar historial</button></div>{history.length?<div className="list">{history.map((x,i)=><button className="listitem" key={x.url+i} onClick={()=>openItem(x.url)}><b>{x.title}</b><small>{x.url}</small></button>)}</div>:<p className="empty">No hay historial.</p>}</>}
   {panel==="bookmarks"&&<><div className="paneltitle"><b>Favoritos</b></div>{bookmarks.length?<div className="list">{bookmarks.map(x=><button className="listitem" key={x.url} onClick={()=>openItem(x.url)}><b>{x.title}</b><small>{x.url}</small></button>)}</div>:<p className="empty">No hay favoritos.</p>}</>}
   {panel==="settings"&&<><div className="paneltitle"><b>Ajustes</b></div><label className="setting"><span>Modo oscuro</span><input type="checkbox" checked={dark} onChange={e=>setDark(e.target.checked)}/></label><div className="settingblock"><b>Protocolo</b><div className="protocolrow"><span>HTTC</span><small>httc:// · Global</small></div></div></>}
  </aside>}

  <main className="viewport">
   {tab.url===home?<Home navigate={navigate} history={history} bookmarks={bookmarks}/>:isCreatePage?<CreatePage url={tab.url}/>:<ProtocolPage tab={tab} scheme={scheme} resolved={resolved} resolveError={resolveError}/>}
  </main>
 </div>
}

function Home({navigate,history,bookmarks}){
 const[q,setQ]=useState("");
 return <section className="start">
  <div className="start-top"><button>☰</button><button>Editar</button></div>
  <div className="start-content">
   <form onSubmit={e=>{e.preventDefault();navigate(q)}} className="start-search"><span>⌕</span><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar o introducir dirección"/><button aria-label="Buscar">⌕</button></form>
   <div className="favorites-title">Favoritos</div>
   <div className="favorite-grid">
    {bookmarks.slice(0,8).map(x=><button className="favorite" key={x.url} onClick={()=>navigate(x.url)}><span>{x.title?.[0]||"F"}</span><b>{x.title}</b></button>)}
    {!bookmarks.length&&<div className="empty-favorites">Tus favoritos aparecerán aquí.</div>}
   </div>
   <div className="start-stats"><span>{history.length} visitas</span><span>·</span><span>{bookmarks.length} favoritos</span></div>
  </div>
 </section>
}

function ProtocolPage({tab,scheme,resolved,resolveError}){
 if(resolved?.document?.type==="site"&&resolved.document.file?.content_type==="text/html"&&resolved.document.file.content){
  return <section className="published-frame"><iframe title={resolved.document.site?.title||tab.title} sandbox="allow-scripts allow-forms" srcDoc={resolved.document.file.content}/></section>
 }
 return <section className="webpage">
  {resolveError?<div className="not-found"><div className="not-found-icon">⌕</div><h1>No se puede abrir la página</h1><p>{resolveError==="site_not_found"?"El sitio no está registrado en el Server de Fairwas.":resolveError}</p><code>{tab.url}</code></div>:<div className="webpage-inner"><div className="webpage-head"><span className="site-icon">{scheme?.label?.[0]||"F"}</span><div><span className="eyebrow">{scheme?.label||"WEB"}</span><h1>{tab.title}</h1><code>{tab.url}</code></div></div><div className="state"><span className="status-dot"></span><div><b>{resolved?"Página lista":"Cargando página…"}</b><p>{resolved?.document?.description||"Fairwas está resolviendo esta dirección."}</p></div></div></div>}
 </section>
}

createRoot(document.getElementById("root")).render(<App/>);
