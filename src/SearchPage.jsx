import React,{useEffect,useState}from"react";

const cleanText=value=>String(value||"").replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim();
const toHttc=value=>{try{const u=new URL(value);return "httc://"+u.host+u.pathname+u.search+u.hash}catch{return ""}};
function collectTopics(items,out=[]){for(const item of items||[]){if(item.FirstURL&&item.Text)out.push({url:item.FirstURL,title:cleanText(item.Text.split(" - ")[0]),description:cleanText(item.Text)});if(item.Topics)collectTopics(item.Topics,out)}return out}
export default function SearchPage({url,onNavigate}){
 const params=new URLSearchParams((()=>{try{return new URL(url).search}catch{return ""}})());
 const initial=params.get("q")||"";
 const[q,setQ]=useState(initial),[loading,setLoading]=useState(false),[error,setError]=useState(""),[data,setData]=useState(null);
 useEffect(()=>{setQ(initial);setData(null);setError("");if(initial.trim())runSearch(initial)},[url]);
 async function runSearch(term){
  const query=String(term||"").trim();if(!query)return;
  setQ(query);setLoading(true);setError("");setData(null);
  try{
   const target="httc://html.duckduckgo.com/html/?q="+encodeURIComponent(query);
   const response=await fetch("/api/proxy?url="+encodeURIComponent(target),{cache:"no-store"});
   if(!response.ok)throw new Error("El buscador no ha respondido (HTTP "+response.status+").");
   const html=await response.text();
   const parsed=new DOMParser().parseFromString(html,"text/html");
   const found=[...parsed.querySelectorAll(".result")].map(node=>{
    const link=node.querySelector(".result__a"),snippet=node.querySelector(".result__snippet");
    if(!link)return null;
    let href=link.getAttribute("href")||"";
    try{const wrapped=new URL(href,"https://html.duckduckgo.com");href=wrapped.searchParams.get("uddg")||wrapped.href}catch{}
    return {url:href,title:cleanText(link.textContent),description:cleanText(snippet?.textContent||"")};
   }).filter(item=>item&&/^https?:\\/\\//i.test(item.url));
   if(found.length){setData({results:found});return}
   const instantTarget="httc://api.duckduckgo.com/?q="+encodeURIComponent(query)+"&format=json&no_html=1&skip_disambig=1";
   const instant=await fetch("/api/proxy?url="+encodeURIComponent(instantTarget),{cache:"no-store"});
   if(!instant.ok)throw new Error("No se han podido obtener resultados.");
   setData(await instant.json());
  }catch(e){setError(e.message||"No se han podido cargar los resultados.")}
  finally{setLoading(false)}
 }
 const results=data?(Array.isArray(data.results)?data.results:collectTopics(data.RelatedTopics)):[];
 if(data?.AbstractURL&&data?.AbstractText)results.unshift({url:data.AbstractURL,title:data.Heading||data.AbstractSource||"Resultado principal",description:data.AbstractText});
 return <section style={{minHeight:"100%",padding:"clamp(20px,5vw,56px)",color:"var(--text,#e8eaf0)",background:"var(--surface,#111318)",boxSizing:"border-box"}}>
  <div style={{maxWidth:900,margin:"0 auto"}}>
   <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}><img src="/fairwas.svg" alt="" style={{width:34,height:34}}/><div><b style={{fontSize:21}}>Fairwas Search</b><div style={{opacity:.65,fontSize:12}}>Resultados de búsqueda</div></div></div>
   <form onSubmit={e=>{e.preventDefault();runSearch(q)}} style={{display:"flex",gap:8,marginBottom:28}}>
    <input value={q} onChange={e=>setQ(e.target.value)} placeholder="¿Qué quieres buscar?" aria-label="Buscar" style={{flex:1,minWidth:0,padding:"14px 16px",borderRadius:14,border:"1px solid #5558",background:"var(--card,#20232b)",color:"inherit",fontSize:16}}/>
    <button type="submit" disabled={loading||!q.trim()} style={{padding:"0 22px",border:0,borderRadius:14,background:"#7567ed",color:"white",fontWeight:700}}>{loading?"…":"Buscar"}</button>
   </form>
   {loading&&<p>Buscando «{q}»…</p>}
   {error&&<div role="alert" style={{padding:16,borderRadius:12,background:"#a33a3022",color:"#ffaaa0"}}>{error}<p style={{marginBottom:0}}>Puedes intentarlo de nuevo o abrir la búsqueda en DuckDuckGo.</p><a href={"https://duckduckgo.com/?q="+encodeURIComponent(q)} target="_blank" rel="noreferrer" style={{color:"inherit"}}>Abrir DuckDuckGo ↗</a></div>}
   {!loading&&!error&&data&&<><p style={{opacity:.65,fontSize:13}}>{results.length?"Resultados relacionados para":"No se han encontrado resultados directos para"} «{q}»</p>
    {data.AbstractText&&<article style={{padding:18,margin:"14px 0",borderRadius:16,background:"var(--card,#20232b)"}}><b>{data.Heading}</b><p>{data.AbstractText}</p>{data.AbstractURL&&<a href={data.AbstractURL} onClick={e=>{e.preventDefault();const target=toHttc(data.AbstractURL);if(target)onNavigate(target)}} style={{color:"#a99cff"}}>Leer fuente ↗</a>}</article>}
    {results.map((item,i)=><article key={item.url+i} style={{padding:"16px 2px",borderBottom:"1px solid #7774"}}><a href={item.url} onClick={e=>{e.preventDefault();const target=toHttc(item.url);if(target)onNavigate(target)}} style={{fontSize:17,fontWeight:650,color:"#a99cff",textDecoration:"none"}}>{item.title||item.url}</a><p style={{margin:"7px 0 0",opacity:.78,lineHeight:1.5}}>{item.description}</p><small style={{opacity:.5,overflowWrap:"anywhere"}}>{item.url}</small></article>)}
    {!results.length&&!data.AbstractText&&<p>No hay resultados instantáneos disponibles para esta consulta.</p>}
   </>}
   {!initial&&!data&&!loading&&<p style={{opacity:.65}}>Escribe algo arriba para empezar a buscar.</p>}
   <p style={{fontSize:12,opacity:.45,marginTop:30}}>Búsqueda web mediante DuckDuckGo Instant Answer.</p>
  </div>
 </section>
}
