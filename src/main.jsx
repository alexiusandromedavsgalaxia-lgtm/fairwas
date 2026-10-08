import React,{useEffect,useState}from"react";
import{createRoot}from"react-dom/client";
import"./styles.css";
import{protocolFor,resolveAddressInput}from"./protocols";
import{load,save}from"./storage";
import CreatePage from"./CreatePage";

const home="httc://home";
const makeNav=tab=>({...tab,back:tab.back||[],forward:tab.forward||[]});
const makeTab=(url=home,tab={})=>makeNav({id:tab.id||(globalThis.crypto?.randomUUID?.()||("tab-"+Date.now()+"-"+Math.random().toString(36).slice(2))),url,title:tab.title|| (url===home?"Inicio":hostOf(url)),back:Array.isArray(tab.back)?tab.back:[],forward:Array.isArray(tab.forward)?tab.forward:[]});
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
 const tab=tabs[active]||tabs[tabs.length-1]||makeTab();
 const scheme=protocolFor(tab.url);
 const isCreatePage=(()=>{const host=hostOf(tab.url).toLowerCase();return host==="createpage.fair"||host==="docs.createpage.fair"})();

 useEffect(()=>save({history,bookmarks,settings:{...initial.settings,dark,home,compactChrome},tabs,activeTab:active,currentPage:tab?.url||home,activity:tab?.url===home?"idle":"browsing"}),[history,bookmarks,dark,compactChrome,tabs,active,tab?.url]);
 useEffect(()=>setAddress(displayAddress(tab.url,mobile)),[tab.id,tab.url,mobile]);
 useEffect(()=>{const mq=window.matchMedia("(max-width: 720px)");const onChange=()=>setMobile(mq.matches);onChange();mq.addEventListener?.("change",onChange);return()=>mq.removeEventListener?.("change",onChange)},[]);
 useEffect(()=>{
  const onMessage=e=>{
   const data=e?.data;
   const frame=document.querySelector(".published-frame iframe");
   if(!frame||e.source!==frame.contentWindow)return;
   let currentHost="";
   try{currentHost=new URL(tab.url).hostname.toLowerCase()}catch{}
   if(data?.type==="fairwas:newtab"&&typeof data.url==="string"&&data.url.startsWith("httc://"))newTab(data.url);
   else if(data?.type==="fairwas:navigate"&&typeof data.url==="string"&&data.url.startsWith("httc://"))navigate(data.url);
   else if(data?.type==="fairwas:storage"&&typeof data.host==="string"&&data.host.toLowerCase()===currentHost&&data.data&&typeof data.data==="object"&&!Array.isArray(data.data)){
    try{window.localStorage.setItem("__fairwas_localStorage:"+currentHost,JSON.stringify(data.data))}catch{}
   }
   else if(data?.type==="fairwas:reload"&&typeof data.url==="string"&&data.url===tab.url){
    setTabs(t=>t.map((x,i)=>i===active&&x.url===data.url?{...x,reloadToken:(x.reloadToken||0)+1}:x));
   }
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
  setTabs(prev=>[...prev,next]);
  setActive(prev=>prev+1);
  if(url!==home)setHistory(h=>[{url,title:hostOf(url),time:new Date().toISOString()},...h.filter(x=>x.url!==url)].slice(0,100));
}
 function closeTab(i){if(tabs.length===1){setTabs([makeTab()]);setActive(0);return}setTabs(t=>t.filter((_,n)=>n!==i));setActive(a=>{if(i<a)return a-1;if(i===a)return Math.min(a,tabs.length-2);return a})}
 function navigate(raw=address){
  const url=resolveAddressInput(normalizeAddress(raw),tab?.url||home);
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
     <button className="newtab" type="button" onClick={e=>{e.preventDefault();e.stopPropagation();newTab()}} aria-label="Nueva pestaña">+</button>
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
 },[tab.id,tab.url,tab.reloadToken]);
 if(!active)return null;
 return <div className="tab-view">
  {tab.url===home?<Home navigate={navigate} history={history} bookmarks={bookmarks}/>:isCreatePage?<CreatePage url={tab.url} onNavigate={navigate}/>:active?<ProtocolPage tab={tab} scheme={scheme} resolved={resolved} resolveError={resolveError} navigate={navigate}/>:null}
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

function fairwasLinkBridge(html,baseUrl){
 const source=String(html||"").replace(/<meta\b[^>]*>/gi,tag=>/\bhttp-equiv\s*=\s*["']?content-security-policy["']?/i.test(tag)?"":tag);
 let host="home";
 try{host=new URL(baseUrl||"httc://home").hostname||"home"}catch{}
 let saved={};
 try{saved=JSON.parse(window.localStorage.getItem("__fairwas_localStorage:"+host)||"{}");if(!saved||typeof saved!=="object"||Array.isArray(saved))saved={}}catch{}
 const safeBase=JSON.stringify(String(baseUrl||"httc://home")).replace(/<\//g,"<\\/");
 const safeHost=JSON.stringify(host);
 const safeStorage=JSON.stringify(saved).replace(/</g,"\\u003c");
 const script="<script>(function(){var BASE="+safeBase+",HOST="+safeHost+",seed="+safeStorage+";function persist(){try{window.parent.postMessage({type:'fairwas:storage',host:HOST,data:data},'*')}catch(_){}}var data={};Object.keys(seed||{}).forEach(function(k){if(typeof seed[k]==='string')data[k]=seed[k]});var storage={get length(){return Object.keys(data).length},key:function(i){return Object.keys(data)[i]||null},getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(data,k)?data[k]:null},setItem:function(k,v){k=String(k);v=String(v);var old=this.getItem(k);data[k]=v;persist();try{window.dispatchEvent(new StorageEvent('storage',{key:k,oldValue:old,newValue:v,storageArea:storage,url:BASE}))}catch(_){}},removeItem:function(k){k=String(k);if(!Object.prototype.hasOwnProperty.call(data,k))return;var old=data[k];delete data[k];persist();try{window.dispatchEvent(new StorageEvent('storage',{key:k,oldValue:old,newValue:null,storageArea:storage,url:BASE}))}catch(_){}},clear:function(){var old=data;data={};persist();try{window.dispatchEvent(new StorageEvent('storage',{key:null,oldValue:null,newValue:null,storageArea:storage,url:BASE}))}catch(_){}}};try{Object.defineProperty(window,'localStorage',{configurable:true,value:storage})}catch(_){try{window.localStorage=storage}catch(_){}}var sessionData={};var sessionStore={get length(){return Object.keys(sessionData).length},key:function(i){return Object.keys(sessionData)[i]||null},getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(sessionData,k)?sessionData[k]:null},setItem:function(k,v){sessionData[String(k)]=String(v)},removeItem:function(k){delete sessionData[String(k)]},clear:function(){sessionData={}}};try{Object.defineProperty(window,'sessionStorage',{configurable:true,value:sessionStore})}catch(_){try{window.sessionStorage=sessionStore}catch(_){}}function reload(){persist();window.parent.postMessage({type:'fairwas:reload',url:BASE},'*')}try{Object.defineProperty(window.location,'reload',{configurable:true,value:reload})}catch(_){}function fair(raw){try{var value=String(raw||'').trim();if(!value||value==='#'||/^(?:javascript:|data:|blob:)/i.test(value))return null;var u=new URL(value,BASE);if(u.protocol==='http:'||u.protocol==='https:')u=new URL('httc://'+u.host+u.pathname+u.search+u.hash);return u.protocol==='httc:'?u.toString():null}catch(_){return null}}function send(raw,blank){var url=fair(raw);if(!url)return false;window.parent.postMessage({type:blank?'fairwas:newtab':'fairwas:navigate',url:url},'*');return true}window.__fairwasNavigate=function(raw){return send(raw,false)};function bridgeHistory(method,args){var raw=args&&args.length>2?args[2]:null;if(typeof raw==='string'&&raw&&raw.charAt(0)!=='#'){try{var target=new URL(raw,BASE),base=new URL(BASE);if(target.protocol==='http:'||target.protocol==='https:')target=new URL('httc://'+target.host+target.pathname+target.search+target.hash);if(target.protocol==='httc:'&&(target.pathname!==base.pathname||target.search!==base.search)){send(target.toString(),false);return}}catch(_){}}return method.apply(history,args)};var nativePush=history.pushState,nativeReplace=history.replaceState;history.pushState=function(){return bridgeHistory(nativePush,arguments)};history.replaceState=function(){return bridgeHistory(nativeReplace,arguments)};document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(a&&send(a.getAttribute('href'),(a.getAttribute('target')||'').toLowerCase()==='_blank')){e.preventDefault();e.stopPropagation()}},true);document.addEventListener('submit',function(e){var f=e.target,m=(f.getAttribute('method')||'get').toLowerCase();if(m!=='get')return;try{var u=new URL(f.getAttribute('action')||BASE,BASE),p=new URLSearchParams(new FormData(f));p.forEach(function(v,k){u.searchParams.append(k,v)});if(send(u.toString(),(f.getAttribute('target')||'').toLowerCase()==='_blank'))e.preventDefault()}catch(_){}},true);var oldOpen=window.open;window.open=function(url,target){if(send(url,String(target||'').toLowerCase()==='_blank'))return null;return oldOpen.apply(window,arguments)};function runtimeUrl(raw){try{var original=new URL(String(raw||''),BASE);if((original.protocol==='http:'||original.protocol==='https:')&&original.hostname.toLowerCase()!==HOST.toLowerCase())return original.toString()}catch(_){}return fair(raw)}function localResource(url,method){try{return new URL(url).hostname.toLowerCase()===HOST.toLowerCase()&&/^(GET|HEAD)$/i.test(String(method||'GET'))}catch(_){return false}}function runtimeEndpoint(url,method){return localResource(url,method)?'/api/resolve?raw=1&url='+encodeURIComponent(url):'/api/proxy?url='+encodeURIComponent(url)}var oldFetch=window.fetch.bind(window);window.fetch=function(input,init){var raw=typeof input==='string'?input:(input&&input.url)||'';var method=(init&&init.method)||(input&&input.method)||'GET';var u=runtimeUrl(raw);if(!u)return oldFetch(input,init);if(/^https?:/i.test(u))return oldFetch(input,init);var endpoint=runtimeEndpoint(u,method);if(typeof Request!=='undefined'&&input instanceof Request){var cloned=input.clone();return cloned.arrayBuffer().then(function(body){var options={method:method,headers:cloned.headers,credentials:cloned.credentials};if(!/^(GET|HEAD)$/i.test(method))options.body=body;if(init)Object.keys(init).forEach(function(k){options[k]=init[k]});return oldFetch(endpoint,options)})}return oldFetch(endpoint,init)};var XO=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url){var u=runtimeUrl(url);return XO.call(this,method,u?( /^https?:/i.test(u)?u:runtimeEndpoint(u,method)):url,...Array.prototype.slice.call(arguments,2))}})();<\/script>";
 const head=/<head\b[^>]*>/i;
 return head.test(source)?source.replace(head,match=>match+script):script+source;
}
function RedirectPage({target,navigate,baseUrl}){
 useEffect(()=>{
  if(typeof target!=="string"||!target.trim())return;
  let destination=target.trim();
  try{
   const u=new URL(destination,baseUrl);
   if(u.protocol==="http:"||u.protocol==="https:")destination="httc://"+u.host+u.pathname+u.search+u.hash;
   else destination=u.toString();
  }catch{}
  if(destination.startsWith("httc://"))navigate(destination);
 },[target,navigate,baseUrl]);
 return <section className="webpage"><div className="webpage-inner"><div className="state"><span className="status-dot"></span><div><b>Redirigiendo…</b><p>{target}</p></div></div></div></section>;
}

function ProtocolPage({tab,scheme,resolved,resolveError,navigate}){
 if(resolved?.document?.type==="site"&&resolved.document.file?.content&&( /^(text\/html|application\/xhtml\+xml)$/i.test(String(resolved.document.file.content_type||"").split(";")[0].trim()) || /\.(html?|xhtml)$/i.test(String(resolved.document.file.path||"")) || /^\s*(<!doctype\s+html|<html(\s|>)|<head(\s|>)|<body(\s|>))/i.test(String(resolved.document.file.content)))){
  if(resolved.document.redirect)return <RedirectPage target={resolved.document.redirect} navigate={navigate} baseUrl={tab.url}/>;
  return <section className="published-frame"><iframe key={tab.reloadToken||0} title={resolved.document.site?.title||tab.title} sandbox="allow-scripts allow-forms allow-modals allow-downloads allow-popups" srcDoc={fairwasLinkBridge(resolved.document.rendered||resolved.document.file.content,tab.url)}/></section>
 }
 return <section className="webpage">
  {resolveError?<div className="not-found"><div className="not-found-icon">⌕</div><h1>No se puede abrir la página</h1><p>{resolveError==="site_not_found"?"El sitio no está registrado en el Server de Fairwas.":resolveError}</p><code>{tab.url}</code></div>:<div className="webpage-inner"><div className="webpage-head"><span className="site-icon">{scheme?.label?.[0]||"F"}</span><div><span className="eyebrow">{scheme?.label||"WEB"}</span><h1>{tab.title}</h1><code>{tab.url}</code></div></div><div className="state"><span className="status-dot"></span><div><b>{resolved?"Página lista":"Cargando página…"}</b><p>{resolved?.document?.description||"Fairwas está resolviendo esta dirección."}</p></div></div></div>}
 </section>
}
createRoot(document.getElementById("root")).render(<App/>);
