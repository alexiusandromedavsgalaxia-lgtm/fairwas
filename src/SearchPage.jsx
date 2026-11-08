import React,{useEffect,useMemo,useState}from"react";
const toHttc=value=>{try{const u=new URL(value);return "httc://"+u.host+u.pathname+u.search+u.hash}catch{return ""}};
const engineFor=url=>{try{return new URL(url).hostname.toLowerCase()==="guglu.com"?"google":"duckduckgo"}catch{return "duckduckgo"}};
const hostFor=engine=>engine==="google"?"guglu.com":"duckduckgo.com";
const makeUrl=(engine,q,page=0)=>"httc://"+hostFor(engine)+"/?q="+encodeURIComponent(q)+(page?"&page="+page:"");
function Logo({google}){return google?<b style={{fontSize:34,letterSpacing:-2}}><i style={{color:"#4285f4",fontStyle:"normal"}}>G</i><i style={{color:"#ea4335",fontStyle:"normal"}}>u</i><i style={{color:"#fbbc05",fontStyle:"normal"}}>g</i><i style={{color:"#4285f4",fontStyle:"normal"}}>l</i><i style={{color:"#34a853",fontStyle:"normal"}}>u</i></b>:<b style={{fontSize:27,letterSpacing:-.8}}>🦆 DuckDuckGo</b>}
function buttonStyle(c){return {padding:"10px 16px",border:"1px solid "+c.line,borderRadius:22,background:"transparent",color:c.text,cursor:"pointer",fontWeight:600}}
export default function SearchPage({url,onNavigate}){
 const engine=engineFor(url),params=useMemo(()=>{try{return new URL(url).searchParams}catch{return new URLSearchParams()}},[url]);
 const initial=params.get("q")||"",initialPage=Math.max(0,Number(params.get("page")||0)||0);
 const[q,setQ]=useState(initial),[loading,setLoading]=useState(false),[error,setError]=useState(""),[data,setData]=useState(null),[safe,setSafe]=useState(true);
 useEffect(()=>{setQ(initial);setData(null);setError("");if(initial.trim())runSearch(initial,initialPage,engine,safe)},[url]);
 async function runSearch(term,page=0,selected=engine,safeSearch=safe){
  const query=String(term||"").trim();if(!query)return;
  setQ(query);setLoading(true);setError("");setData(null);
  try{
   const response=await fetch("/api/search?q="+encodeURIComponent(query)+"&engine="+selected+"&page="+page+"&safe="+(safeSearch?"1":"0"),{cache:"no-store"});
   const payload=await response.json().catch(()=>null);
   if(!response.ok||!payload?.ok)throw new Error(payload?.error==="search_provider_blocked"?"El proveedor ha bloqueado temporalmente la búsqueda.":payload?.error==="search_provider_unreachable"?"No se ha podido conectar con el buscador.":"Error al cargar resultados (HTTP "+response.status+").");
   setData(payload);
   if(typeof window!=="undefined")window.history.replaceState(null,"",location.pathname+"?q="+encodeURIComponent(query)+(page?"&page="+page:""));
  }catch(e){setError(e.message||"No se han podido cargar los resultados.")}
  finally{setLoading(false)}
 }
 const submit=e=>{e?.preventDefault?.();runSearch(q,0,engine,safe)};
 const colors=engine==="google"?{accent:"#1a73e8",line:"#dadce0",text:"#202124",sub:"#5f6368"}:{accent:"#de5833",line:"#343943",text:"#e8eaed",sub:"#aeb4bf"};
 const open=item=>{const target=toHttc(item.url);if(target)onNavigate?.(target)};
 const switchEngine=next=>onNavigate?.(q.trim()?makeUrl(next,q):"httc://"+hostFor(next));
 const goPage=page=>onNavigate?.(makeUrl(engine,data.query,page));
 const google=engine==="google";
 return <main style={{minHeight:"100%",background:google?"#fff":"#171a20",color:colors.text,fontFamily:"Arial,Helvetica,sans-serif",boxSizing:"border-box"}}>
  <header style={{padding:"22px clamp(18px,5vw,52px) 0",borderBottom:"1px solid "+(google?"#eee":"#30343c")}}>
   <div style={{display:"flex",alignItems:"center",gap:18,flexWrap:"wrap"}}>
    <Logo google={google}/>
    <form onSubmit={submit} style={{display:"flex",alignItems:"center",gap:8,flex:1,maxWidth:760,minWidth:230}}>
     <div style={{display:"flex",alignItems:"center",flex:1,minWidth:0,border:"1px solid "+(google?"#dfe1e5":"#444b56"),borderRadius:30,padding:"0 15px",height:46,boxShadow:google?"0 1px 5px #0001":"none",background:google?"#fff":"#22262e"}}>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar en la web" aria-label="Buscar" style={{width:"100%",minWidth:0,border:0,outline:0,background:"transparent",color:colors.text,fontSize:16}}/>
      {q&&<button type="button" onClick={()=>setQ("")} aria-label="Borrar" style={{border:0,background:"transparent",color:colors.sub,fontSize:22}}>×</button>}
      <span style={{color:colors.accent,fontSize:22,paddingLeft:8}}>⌕</span>
     </div>
     <button type="submit" disabled={loading||!q.trim()} style={{height:44,padding:"0 18px",border:0,borderRadius:24,background:google?"#f8f9fa":"#de5833",color:google?"#3c4043":"white",fontWeight:650}}>{loading?"…":"Buscar"}</button>
    </form>
   </div>
   <nav style={{display:"flex",gap:24,marginTop:22,overflowX:"auto",paddingBottom:12,fontSize:14,color:colors.sub}}>
    {["Todo","Imágenes","Vídeos","Noticias","Mapas"].map((tab,i)=><button key={tab} type="button" onClick={()=>i&&q.trim()&&runSearch(q+" "+tab.toLowerCase(),0)} style={{whiteSpace:"nowrap",border:0,borderBottom:i===0?"3px solid "+colors.accent:"3px solid transparent",padding:"0 0 10px",background:"transparent",color:i===0?colors.text:"inherit",fontWeight:i===0?650:400}}>{tab}</button>)}
    <label style={{marginLeft:"auto",whiteSpace:"nowrap",cursor:"pointer"}}><input type="checkbox" checked={safe} onChange={e=>{setSafe(e.target.checked);if(q.trim())runSearch(q,0,engine,e.target.checked)}}/> Búsqueda segura</label>
   </nav>
  </header>
  <div style={{maxWidth:1120,margin:"0 auto",padding:"18px clamp(18px,5vw,52px) 56px"}}>
   {loading&&<p style={{color:colors.sub}}>Buscando «{q}»…</p>}
   {error&&<section role="alert" style={{padding:18,border:"1px solid "+colors.line,borderRadius:12}}><b>No se han podido mostrar los resultados</b><p style={{color:colors.sub}}>{error}</p><button onClick={()=>runSearch(q,0)} style={buttonStyle(colors)}>Reintentar</button></section>}
   {!loading&&!error&&data&&<>
    <p style={{fontSize:12,color:colors.sub,margin:"2px 0 22px"}}>{data.totalLabel} · página {data.page+1}</p>
    <div style={{display:"grid",gridTemplateColumns:"minmax(0, min(680px, 100%)) minmax(0, 280px)",gap:44,alignItems:"start"}}>
     <section>
      {(data.results||[]).map((item,i)=><article key={item.url+i} style={{marginBottom:26}}>
       <div style={{fontSize:12,color:colors.sub,overflowWrap:"anywhere",marginBottom:5}}>{item.displayUrl||item.url}</div>
       <a href={item.url} onClick={e=>{e.preventDefault();open(item)}} style={{fontSize:20,color:google?"#1a0dab":"#9ebcff",textDecoration:"none",lineHeight:1.35}}>{item.title||item.url}</a>
       {item.description&&<p style={{fontSize:14,lineHeight:1.58,color:colors.sub,margin:"5px 0 0"}}>{item.description}</p>}
      </article>)}
      {!data.results?.length&&<p style={{color:colors.sub}}>No se han encontrado resultados para «{data.query}».</p>}
      {data.hasMore&&<div style={{display:"flex",gap:10,marginTop:28}}>{data.page>0&&<button onClick={()=>goPage(data.page-1)} style={buttonStyle(colors)}>← Anterior</button>}<button onClick={()=>goPage(data.page+1)} style={buttonStyle(colors)}>Siguiente →</button></div>}
     </section>
     <aside style={{borderLeft:typeof window!=="undefined"&&window.innerWidth>900?"1px solid "+colors.line:"0",borderTop:typeof window!=="undefined"&&window.innerWidth<=900?"1px solid "+colors.line:"0",paddingLeft:typeof window!=="undefined"&&window.innerWidth>900?22:0,paddingTop:typeof window!=="undefined"&&window.innerWidth<=900?18:0,color:colors.sub,fontSize:13}}>
      <b style={{color:colors.text,fontSize:15}}>{google?"Guglu":"DuckDuckGo"} Search</b>
      <p>Resultados web para <b style={{color:colors.text}}>{data.query}</b>.</p>
      <p>Proveedor: {google?"Google":"DuckDuckGo"} · página {data.page+1}</p>
      <button onClick={()=>switchEngine(google?"duckduckgo":"google")} style={buttonStyle(colors)}>Probar {google?"DuckDuckGo":"Guglu"} también</button>
     </aside>
    </div>
   </>}
   {!initial&&!data&&!loading&&!error&&<div style={{textAlign:"center",padding:"clamp(48px,12vh,120px) 0"}}><Logo google={google}/><p style={{color:colors.sub}}>Busca páginas, información y respuestas en la web.</p></div>}
  </div>
  <footer style={{borderTop:"1px solid "+colors.line,padding:"18px clamp(18px,5vw,52px)",fontSize:12,color:colors.sub,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12}}><span>{google?"Guglu":"DuckDuckGo"} · Buscador integrado en Fairwas</span><span>Resultados de búsquedas web reales.</span></footer>
 </main>
}