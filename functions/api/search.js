function json(data,status=200){return Response.json(data,{status,headers:{"cache-control":"no-store"}})}
export async function onRequest({request}){
 const incoming=new URL(request.url);
 const query=(incoming.searchParams.get("q")||"").trim();
 if(!query)return json({ok:false,error:"query_required"},400);
 if(query.length>300)return json({ok:false,error:"query_too_long"},400);
 const target="https://html.duckduckgo.com/html/?q="+encodeURIComponent(query);
 let response;
 try{response=await fetch(target,{headers:{"accept":"text/html","user-agent":"Mozilla/5.0 (compatible; FairwasSearch/1.0)"},redirect:"follow"})}
 catch{return json({ok:false,error:"search_provider_unreachable"},502)}
 if(!response.ok)return json({ok:false,error:"search_provider_error",status:response.status},502);
 const html=await response.text();
 return new Response(html,{status:200,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","access-control-allow-origin":"*"}});
}
