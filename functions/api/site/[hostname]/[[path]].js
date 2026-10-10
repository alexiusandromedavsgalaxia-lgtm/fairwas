const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{"cache-control":"no-store",...headers}});
const METHODS=new Set(["GET","HEAD","POST","PUT","PATCH","DELETE","OPTIONS"]);
function cors(){return {"access-control-allow-origin":"*","access-control-allow-methods":"GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS","access-control-allow-headers":"content-type, authorization","access-control-max-age":"86400"}}
function matchRoute(pattern,path){
 const a=pattern.split("/").filter(Boolean),b=path.split("/").filter(Boolean);
 if(a.length!==b.length)return null;
 const params={};
 for(let i=0;i<a.length;i++){
  if(a[i].startsWith(":")){if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(a[i].slice(1)))return null;try{params[a[i].slice(1)]=decodeURIComponent(b[i])}catch{return null}}
  else if(a[i]!==b[i])return null;
 }
 return params;
}
function expand(value,context){
 if(typeof value==="string")return value.replace(/\{\{\s*(params|query|body)\.([A-Za-z0-9_]+)\s*\}\}/g,(all,source,key)=>{const v=context[source]?.[key];return v==null?"":String(v)});
 if(Array.isArray(value))return value.map(v=>expand(v,context));
 if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,expand(v,context)]));
 return value;
}
export async function onRequest({request,env,params}){
 const corsHeaders=cors();
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders});
 if(!METHODS.has(request.method))return json({ok:false,error:"method_not_allowed"},405,corsHeaders);
 if(!env.database||!env.pages)return json({ok:false,error:"api_binding_missing"},500,corsHeaders);
 const hostname=String(params.hostname||"").toLowerCase();
 const path="/"+String(params.path||"").replace(/^\/+|\/+$/g,"");
 const site=await env.pages.prepare("SELECT site_id FROM sites WHERE hostname=? AND protocol='httc' AND status='published' LIMIT 1").bind(hostname).first();
 if(!site)return json({ok:false,error:"site_not_found"},404,corsHeaders);
 const rows=await env.database.prepare("SELECT id,path,method,response_status,response_json FROM fw_api_endpoints WHERE site_id=? AND hostname=? AND enabled=1 AND method=?").bind(site.site_id,hostname,request.method).all();
 let endpoint=null,routeParams=null;
 for(const row of rows.results||[]){const matched=matchRoute(row.path,path);if(matched){endpoint=row;routeParams=matched;break}}
 if(!endpoint)return json({ok:false,error:"endpoint_not_found",path,method:request.method},404,corsHeaders);
 let body={};
 if(!["GET","HEAD"].includes(request.method)){
  const length=Number(request.headers.get("content-length")||0);
  if(length>1024*1024)return json({ok:false,error:"request_too_large"},413,corsHeaders);
  const raw=await request.text();
  if(raw.length>1024*1024)return json({ok:false,error:"request_too_large"},413,corsHeaders);
  if(raw){try{body=JSON.parse(raw)}catch{return json({ok:false,error:"invalid_json_body"},400,corsHeaders)}}
 }
 const query=Object.fromEntries(new URL(request.url).searchParams.entries());
 let template;try{template=JSON.parse(endpoint.response_json)}catch{return json({ok:false,error:"invalid_endpoint_configuration"},500,corsHeaders)}
 const output=expand(template,{params:routeParams||{},query,body});
 return json(output,Number(endpoint.response_status)||200,corsHeaders);
}
