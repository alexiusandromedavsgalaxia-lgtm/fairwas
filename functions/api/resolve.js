const ALLOWED=new Set(["httc","amwp","euwp","aswp","afwp","ocwp"]);
export async function onRequestGet({request,env}){
 const target=new URL(request.url).searchParams.get("url")||"";
 let parsed;
 try{parsed=new URL(target)}catch{return Response.json({ok:false,error:"invalid_url"},{status:400})}
 const protocol=parsed.protocol.slice(0,-1);
 if(!ALLOWED.has(protocol))return Response.json({ok:false,error:"unsupported_protocol"},{status:400});
 if(env.pages)await env.pages.prepare("INSERT INTO visits(url,protocol,visited_at) VALUES(?,?,?)").bind(target,protocol,new Date().toISOString()).run();
 return Response.json({ok:true,url:target,protocol,host:parsed.hostname,path:parsed.pathname+parsed.search});
}