import React,{useEffect,useState}from"react";
import{createRoot}from"react-dom/client";
import"./styles.css";
import{protocolFor,toFairwas}from"./protocols";
import{load,save}from"./storage";
import CreatePage from"./CreatePage";

const home="httc://home";
const makeNav=tab=>({...tab,back:tab.back||[],forward:tab.forward||[]});
const makeTab=(url=home,tab={})=>makeNav({id:tab.id||crypto.randomUUID(),url,title:tab.title|| (url===home?"Inicio":hostOf(url)),back:Array.isArray(tab.back)?tab.back:[],forward:Array.isArray(tab.forward)?tab.forward:[]});
const displayDomain=(url)=>{const value=String(url||"").trim();try{const parsed=new URL(value);return parsed.protocol==="httc:"&&parsed.hostname&&parsed.hostname!=="home"?parsed.hostname:value}catch{return value}};
const displayAddress=(url,mobile=false)=>{const value=String(url||"").trim();if(!value)return"";try{const parsed=new URL(value);if(parsed.protocol!=="httc:")return value;const host=parsed.hostname||"";if(!host||host==="home")return value;const path=(parsed.pathname&&parsed.pathname!=="/"?parsed.pathname:"")+(parsed.search||"")+(parsed.hash||"");return mobile?host+path:"httc://"+host+path;}catch{return value}};
const normalizeAddress=(raw)=>{const value=String(raw||"").trim();const match=value.match(/^httc:\/\/web\.([^/?#]+)(\/[^?#]*)?(?:\?([^#]*))?(?:#(.*))?$/i);if(match)return"httc://web."+match[1]+(match[2]||"/")+(match[3]?"?"+match[3]:"")+(match[4]?"#"+match[4]:"");return value;};
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
 const[compactChrome,setCompactChrome]=useState(initial.settings.compactChrome===true);
 const[history,setHistory]=useState(initial.history||[]);
 const[bookmarks,setBookmarks]=useState(initial.bookmarks||[]);
 const[panel,setPanel]=useState(null);const[addressFocused,setAddressFocused]=useState(false);
 const tab=tabs[active]||tabs[0];
 const scheme=protocolFor(tab.url);
 const isCreatePage=(()=>{const host=hostOf(tab.url).toLowerCase();return host==="createpage.fair"||host==="docs.createpage.fair"})();

 useEffect(()=>save({history,bookmarks,settings:{...initial.settings,dark,home,compactChrome},tabs,activeTab:active,currentPage:tab?.url||home,activity:tab?.url===home?"idle":"browsing"}),[history,bookmarks,dark,compactChrome,tabs,active,tab?.url]);
 useEffect(()=>setAddress(displayAddress(tab.url,mobile)),[tab.id,tab.url,mobile]);
 useEffect(()=>{const mq=window.matchMedia("(max-width: 720px)");const onChange=()=>setMobile(mq.matches);onChange();mq.addEventListener?.("change",onChange);return()=>mq.removeEventListener?.("change",onChange)},[]);
 useEffect(()=>{
  const onMessage=e=>{
   const data=e?.data;
   if(data?.type==="fairwas:newtab"&&typeof data.url==="string"&&data.url.startsWith("httc://"))newTab(data.url);
   else if(data?.type==="fairwas:navigate"&&typeof data.url==="string"&&data.url.startsWith("httc://"))navigate(data.url);
  };
  const key=e=>{
   if((e.ctrlKey||e.metaKey)&&e.key==="l"){e.preventDefault();document.querySelector("#address")?.select()}
   if((e.ctrlKey||e.metaKey)&&e.key==="t"){e.preventDefault();newTab()}
   if((e.ctrlKey||e.metaKey)&&e.key==="w"){e.preventDefault();closeTab(active)}
   if((e.ctrlKey||e.metaKey)&&e.key==="d"){e.preventDefault();bookmark()}
   if((e.ctrlKey||e.metaKey)&&e.key==="h"){e.preventDefault();setPanel("history")}
   if((e.ctrlKey||e.metaKey)&&e.key==="b"){e.preventDefault();setPanel("bookmarks")}
  };
  const onCreatePageNavigate=e=>{const url=e?.detail;if(typeof url==="string"&&url.startsWith("httc://createpage.fair"))navigate(url)};
  window.addEventListener("message",onMessage);
  window.addEventListener("keydown",key);
  window.addEventListener("fairwas:navigate",onCreatePageNavigate);
  return()=>{window.removeEventListener("message",onMessage);window.removeEventListener("keydown",key);window.removeEventListener("fairwas:navigate",onCreatePageNavigate)};
 },[active,tabs,tab]);

 function newTab(url=home){
  const next=makeTab(url);
  setTabs(prev=>{
   const nextTabs=[...prev,next];
   setActive(nextTabs.length-1);
   return nextTabs;
  });
  if(url!==home)setHistory(h=>[{url,title:hostOf(url),time:new Date().toISOString()},...h.filter(x=>x.url!==url)].slice(0,100));
}
 function closeTab(i){if(tabs.length===1){setTabs([makeTab()]);setActive(0);return}setTabs(t=>t.filter((_,n)=>n!==i));setActive(a=>{if(i<a)return a-1;if(i===a)return Math.min(a,tabs.length-2);return a})}
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


 return <div className={"app "+(dark?"dark":"light")+" "+(compactChrome?"compact-chrome":"")}>
  <header className="chrome">
   <div className="topbar">
    <div className="traffic-space"><img className="fairwas-logo" src="/fairwas.svg" alt="Fairwas"/></div>
    <div className="tabstrip">
     {tabs.map((t,i)=><button className={"tab "+(i===active?"active":"")} key={t.id} onClick={()=>setActive(i)}><span className="tab-favicon"><img src="/fairwas.svg" alt="" /></span><span className="tabtext">{t.title}</span>{tabs.length>1&&<i onClick={e=>{e.stopPropagation();closeTab(i)}}>×</i>}</button>)}
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
      <input id="address" value={compactChrome&&!addressFocused?displayDomain(tab.url):address} onFocus={e=>{setAddressFocused(true);setAddress(tab.url)}} onBlur={()=>setAddressFocused(false)} onChange={e=>setAddress(e.target.value)} aria-label="Dirección o búsqueda" spellCheck="false"/>
      {tab.url!==home&&<button type="button" className="address-action" onClick={bookmark} aria-label="Añadir a favoritos">☆</button>}
    </form>
    <div className="toolgroup">
     <button onClick={()=>setPanel(panel==="bookmarks"?null:"bookmarks")} aria-label="Barra lateral">☰</button>
     <button onClick={()=>setPanel(panel==="history"?null:"history")} aria-label="Historial">◷</button>
     <button onClick={()=>setPanel(panel==="settings"?null:"settings")} aria-label="Más opciones">•••</button>
     <button className="chrome-mode-toggle" onClick={()=>setCompactChrome(v=>!v)} aria-label={compactChrome?"Salir de barra compacta":"Activar barra compacta"}>{compactChrome?"Salir":"Compactar"}</button>
    </div>
   </div>
  </header>

  {panel&&<aside className="panel">
   {panel==="history"&&<><div className="paneltitle"><b>Historial</b><button onClick={clearHistory}>Borrar historial</button></div>{history.length?<div className="list">{history.map((x,i)=><button className="listitem" key={x.url+i} onClick={()=>openItem(x.url)}><b>{x.title}</b><small>{x.url}</small></button>)}</div>:<p className="empty">No hay historial.</p>}</>}
   {panel==="bookmarks"&&<><div className="paneltitle"><b>Favoritos</b></div>{bookmarks.length?<div className="list">{bookmarks.map(x=><button className="listitem" key={x.url} onClick={()=>openItem(x.url)}><b>{x.title}</b><small>{x.url}</small></button>)}</div>:<p className="empty">No hay favoritos.</p>}</>}
   {panel==="settings"&&<><div className="paneltitle"><b>Ajustes</b></div><label className="setting"><span>Modo oscuro</span><input type="checkbox" checked={dark} onChange={e=>setDark(e.target.checked)}/></label><label className="setting"><span>Barra compacta</span><input type="checkbox" checked={compactChrome} onChange={e=>setCompactChrome(e.target.checked)}/></label><div className="settingblock"><b>Protocolo</b><div className="protocolrow"><span>HTTC</span><small>httc:// · Global</small></div></div></>}
  </aside>}

  <main className="viewport">
   {tabs.map((item,i)=><TabView key={item.id} tab={item} active={i===active} navigate={navigate} history={history} bookmarks={bookmarks}/>)}
  </main>
 </div>
}

function TabView({tab,active,navigate,history,bookmarks}){
 const[resolved,setResolved]=useState(null);
 const[resolveError,setResolveError]=useState(null);
 const scheme=protocolFor(tab.url);
 const isCreatePage=(()=>{const host=hostOf(tab.url).toLowerCase();return host==="createpage.fair"||host==="docs.createpage.fair"})();
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
 if(!active)return null;
 return <div className="tab-view">
  {tab.url===home?<Home navigate={navigate} history={history} bookmarks={bookmarks}/>:isCreatePage?<CreatePage url={tab.url} onNavigate={navigate}/>:active?<ProtocolPage tab={tab} scheme={scheme} resolved={resolved} resolveError={resolveError}/>:null}
 </div>
}

function Home({navigate,history,bookmarks}){
 const[q,setQ]=useState("");
 return <section className="start"><div className="start-brand"><img src="/fairwas.svg" alt="Fairwas"/><div><strong>Fairwas</strong><span>HTTC browser</span></div></div>
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

function fairwasLinkBridge(html){
 const source=String(html||"");
 const bridge="<script>(function(){document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var raw=a.getAttribute('href')||'';try{var u=new URL(raw,location.href);if(u.protocol==='httc:'){e.preventDefault();e.stopPropagation();var target=(a.getAttribute('target')||'').toLowerCase();window.parent.postMessage({type:target==='_blank'?'fairwas:newtab':'fairwas:navigate',url:u.toString()},'*');}}catch(_){}});})();<\\/script>";
 return source.includes("</body>")?source.replace("</body>",bridge+"</body>"):bridge+source;
}

function ProtocolPage({tab,scheme,resolved,resolveError}){
 if(resolved?.document?.type==="site"&&resolved.document.file?.content_type?.split(";")[0]==="text/html"&&resolved.document.file.content){
  return <section className="published-frame"><iframe title={resolved.document.site?.title||tab.title} sandbox="allow-scripts allow-forms" srcDoc={fairwasLinkBridge(resolved.document.rendered||resolved.document.file.content)}/></section>
 }
 return <section className="webpage">
  {resolveError?<div className="not-found"><div className="not-found-icon">⌕</div><h1>No se puede abrir la página</h1><p>{resolveError==="site_not_found"?"El sitio no está registrado en el Server de Fairwas.":resolveError}</p><code>{tab.url}</code></div>:<div className="webpage-inner"><div className="webpage-head"><span className="site-icon">{scheme?.label?.[0]||"F"}</span><div><span className="eyebrow">{scheme?.label||"WEB"}</span><h1>{tab.title}</h1><code>{tab.url}</code></div></div><div className="state"><span className="status-dot"></span><div><b>{resolved?"Página lista":"Cargando página…"}</b><p>{resolved?.document?.description||"Fairwas está resolviendo esta dirección."}</p></div></div></div>}
 </section>
}

createRoot(document.getElementById("root")).render(<App/>);
