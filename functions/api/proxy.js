const HOP_BY_HOP=new Set(["connection","keep-alive","proxy-authenticate","proxy-authorization","te","trailer","transfer-encoding","upgrade","host","content-length"]);
const ALLOWED_METHODS=new Set(["GET","HEAD","POST","PUT","PATCH","DELETE","OPTIONS"]);
function json(data,status=200){return Response.json(data,{status,headers:{"cache-control":"no-store"}})}
async function siteOrigin(env,hostname){
 if(!env.server)return null;
 const row=await env.server.prepare("SELECT origin FROM servers WHERE hostname=? AND protocol='httc' AND status='active'").bind(hostname.toLowerCase()).first();
 return row?.origin||null;
}
function headersForProxy(request){
 const h=new Headers();
 for(const [k,v] of request.headers){if(!HOP_BY_HOP.has(k.toLowerCase()))h.set(k,v)}
 h.delete("origin");h.delete("referer");h.delete("cookie");
 return h;
}
function rewriteLocation(value,base){
 if(!value)return value;
 try{
  const u=new URL(value,base);
  if(u.protocol==="http:"||u.protocol==="https:"){
   const target="httc://"+u.host+u.pathname+u.search+u.hash;
   return "/api/proxy?url="+encodeURIComponent(target);
  }
 }catch{}
 return value;
}
function corsHeaders(request){
 const h=new Headers();
 h.set("access-control-allow-origin","*");
 h.set("access-control-allow-methods","GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS");
 const requested=request.headers.get("access-control-request-headers");
 if(requested)h.set("access-control-allow-headers",requested);
 h.set("access-control-max-age","86400");
 h.set("access-control-expose-headers","content-type, content-length, etag, last-modified, location");
 h.append("vary","Origin");
 return h;
}
export async function onRequest({request,env}){
 if(!ALLOWED_METHODS.has(request.method))return json({ok:false,error:"method_not_allowed"},405);
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders(request)});
 const incoming=new URL(request.url);
 const target=incoming.searchParams.get("url");
 if(!target)return json({ok:false,error:"url_required"},400);
 let httc;try{httc=new URL(target)}catch{return json({ok:false,error:"invalid_url"},400)}
 if(httc.protocol!=="httc:"||!httc.hostname)return json({ok:false,error:"unsupported_protocol"},400);
 const origin=await siteOrigin(env,httc.hostname);
 if(!origin)return json({ok:false,error:"site_not_found"},404);
 let upstream;
 try{
  upstream=new URL(origin);
  if(upstream.protocol!=="http:"&&upstream.protocol!=="https:")throw new Error("bad_origin");
  upstream.pathname=httc.pathname||"/";
  upstream.search=httc.search;
 }catch{return json({ok:false,error:"invalid_site_origin"},502)}
 const init={method:request.method,headers:headersForProxy(request),redirect:"manual"};
 if(request.method!=="GET"&&request.method!=="HEAD")init.body=await request.arrayBuffer();
 let response;
 try{response=await fetch(upstream.toString(),init)}
 catch{return json({ok:false,error:"upstream_unreachable",host:httc.hostname},502)}
 const out=new Headers();
 for(const [k,v] of response.headers){
  const lower=k.toLowerCase();
  if(HOP_BY_HOP.has(lower)||lower==="set-cookie"||lower==="set-cookie2")continue;
  out.set(k,v);
 }
 for(const [k,v] of corsHeaders(request))if(k.toLowerCase()!=="vary")out.set(k,v);
 const location=response.headers.get("location");
 if(location)out.set("location",rewriteLocation(location,upstream.toString()));
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers:out});
}
