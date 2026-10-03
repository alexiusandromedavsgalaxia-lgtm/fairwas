const ALLOWED=new Set(["httc"]);

const DESCRIPTION="Fairwas global web protocol";

function documentFor(parsed){
 const path=parsed.pathname||"/";
 if(path==="/"||path==="/home"){
  return {type:"home",title:"Fairwas · HTTC",protocol:"httc",description:DESCRIPTION};
 }
 if(path==="/search"){
  return {type:"search",title:"Fairwas search",protocol:"httc",query:parsed.searchParams.get("q")||"",results:[]};
 }
 return {type:"resource",title:parsed.hostname||"HTTC",protocol:"httc",host:parsed.hostname,path:parsed.pathname+(parsed.search||"")};
}

export async function onRequestGet({request,env}){
 const target=new URL(request.url).searchParams.get("url")||"";
 let parsed;
 try{parsed=new URL(target)}catch{
  return Response.json({ok:false,error:"invalid_url"},{status:400});
 }
 const protocol=parsed.protocol.slice(0,-1).toLowerCase();
 if(!ALLOWED.has(protocol)){
  return Response.json({ok:false,error:"unsupported_protocol"},{status:400});
 }
 let persisted=false;
 if(env.pages){
  try{
   await env.pages.prepare("INSERT INTO visits(url,protocol,visited_at) VALUES(?,?,?)").bind(target,"httc",new Date().toISOString()).run();
   persisted=true;
  }catch{}
 }
 return Response.json({ok:true,url:target,protocol:"httc",host:parsed.hostname,path:parsed.pathname+(parsed.search||""),persisted,document:documentFor(parsed)});
}
