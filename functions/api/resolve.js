const ALLOWED=new Set(["httc","amwp","euwp","aswp","afwp","ocwp"]);

const DESCRIPTIONS={
 httc:"Fairwas global web transport",
 amwp:"American Web Protocol",
 euwp:"European Web Protocol",
 aswp:"Asian Web Protocol",
 afwp:"African Web Protocol",
 ocwp:"Oceanian Web Protocol"
};

function documentFor(parsed,protocol){
 const path=parsed.pathname||"/";
 const query=parsed.searchParams;
 if(path==="/"||path==="/home"){
  return {type:"home",title:"Fairwas · "+protocol.toUpperCase(),protocol,description:DESCRIPTIONS[protocol]};
 }
 if(path==="/search"){
  return {type:"search",title:"Fairwas search",protocol,query:query.get("q")||"",results:[]};
 }
 return {type:"resource",title:parsed.hostname||protocol.toUpperCase(),protocol,host:parsed.hostname,path:parsed.pathname+(parsed.search||"")};
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
 let persisted=true;
 if(env.pages){
  try{
   await env.pages.prepare("INSERT INTO visits(url,protocol,visited_at) VALUES(?,?,?)").bind(target,protocol,new Date().toISOString()).run();
  }catch{
   persisted=false;
  }
 }
 return Response.json({ok:true,url:target,protocol,host:parsed.hostname,path:parsed.pathname+(parsed.search||""),persisted,document:documentFor(parsed,protocol)});
}
