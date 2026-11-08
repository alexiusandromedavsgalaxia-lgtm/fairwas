const json=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store","access-control-allow-origin":"*","access-control-allow-headers":"authorization,content-type","access-control-allow-methods":"GET,POST,OPTIONS"}});
const stamp=()=>new Date().toISOString();
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");
async function digest(value){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,"0")).join("")}
async function schema(db){await db.prepare("CREATE TABLE IF NOT EXISTS macrospot_workspaces(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL,state_json TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run()}
async function authorize(db,id,request){const bearer=String(request.headers.get("authorization")||"");if(!bearer.startsWith("Bearer "))return false;const row=await db.prepare("SELECT token_hash FROM macrospot_workspaces WHERE id=? LIMIT 1").bind(id).first();if(!row)return false;return await digest(bearer.slice(7))===row.token_hash}
export async function onRequestOptions(){return new Response(null,{status:204,headers:{"access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"authorization,content-type"}})}
export async function onRequest({request,env}){
 if(!env.database)return json({ok:false,error:"cloud_database_unavailable"},503);
 await schema(env.database);
 const url=new URL(request.url);
 if(request.method==="GET"){
  const id=String(url.searchParams.get("id")||"").slice(0,80);
  if(!id||!await authorize(env.database,id,request))return json({ok:false,error:"unauthorized"},401);
  const row=await env.database.prepare("SELECT state_json,updated_at FROM macrospot_workspaces WHERE id=?").bind(id).first();
  let state;try{state=JSON.parse(row.state_json)}catch{return json({ok:false,error:"workspace_corrupt"},500)}
  return json({ok:true,id,state,updated_at:row.updated_at});
 }
 if(request.method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
 let body;try{body=await request.json()}catch{return json({ok:false,error:"invalid_json"},400)}
 if(body.action==="create"){
  const id=crypto.randomUUID(),secret=token(),now=stamp();
  const state={version:1,workspaceName:"Mi espacio Macrospot",messages:[],channels:[{id:"general",name:"General",description:"Conversación del equipo"}],emails:[{id:"welcome",from:"equipo@macrospot.com",subject:"Te damos la bienvenida a Macrospot",preview:"Tu espacio de trabajo ya está listo.",body:"Este es tu nuevo espacio de trabajo Macrospot. Explora las aplicaciones y personaliza tu entorno.",unread:true,date:now}],events:[],files:[],documents:[],tasks:[],workflows:[],activity:[],domains:[],apiKeys:[],members:[{id:"owner",name:"Administrador",email:"admin@macrospot.local",role:"Propietario",status:"Activo"}],settings:{theme:"dark",language:"es-ES",notifications:true}};
  await env.database.prepare("INSERT INTO macrospot_workspaces(id,token_hash,state_json,created_at,updated_at) VALUES(?,?,?,?,?)").bind(id,await digest(secret),JSON.stringify(state),now,now).run();
  return json({ok:true,id,token:secret,state,updated_at:now},201);
 }
 if(body.action==="save"){
  const id=String(body.id||"").slice(0,80),raw=JSON.stringify(body.state);
  if(!id||!body.state||typeof body.state!=="object"||Array.isArray(body.state))return json({ok:false,error:"invalid_workspace_state"},400);
  if(raw.length>900000)return json({ok:false,error:"workspace_too_large"},413);
  if(!await authorize(env.database,id,request))return json({ok:false,error:"unauthorized"},401);
  const now=stamp();
  await env.database.prepare("UPDATE macrospot_workspaces SET state_json=?,updated_at=? WHERE id=?").bind(raw,now,id).run();
  return json({ok:true,id,updated_at:now});
 }
 return json({ok:false,error:"unknown_action"},400);
}