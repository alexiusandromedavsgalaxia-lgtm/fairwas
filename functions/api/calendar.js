import { getAccount } from "./_account.js";

const json=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store","access-control-allow-origin":"*","access-control-allow-headers":"authorization,content-type,x-calendar-admin-key","access-control-allow-methods":"GET,POST,OPTIONS"}});
const stamp=()=>new Date().toISOString();
const id=()=>crypto.randomUUID();
const TZ="Europe/Madrid";
const kinds=[
 ["Diseño visual","Diseña una identidad visual y una portada coherente.",2],
 ["Reto responsive","Adapta una página a móvil, tablet y escritorio.",2],
 ["Accesibilidad web","Mejora contraste, navegación y etiquetas semánticas.",3],
 ["Laboratorio HTML","Construye una experiencia con HTML semántico.",2],
 ["CSS creativo","Experimenta con layouts, animaciones y tipografía.",2],
 ["JavaScript práctico","Añade interacciones útiles sin dependencias.",3],
 ["SEO esencial","Optimiza títulos, metadatos y estructura.",2],
 ["Landing express","Crea una landing clara con llamada a la acción.",3],
 ["Auditoría de rendimiento","Reduce recursos y mejora tiempos de carga.",3],
 ["Portfolio en una hora","Presenta proyectos con una estructura profesional.",2],
 ["Microinteracciones","Añade estados, feedback y detalles de interfaz.",2],
 ["Publica y presenta","Prepara una web y comparte su resultado.",4]
];
const variants=["Reto abierto","Taller guiado","Sprint creativo","Clínica de proyectos","Sesión práctica","Desafío comunitario"];
function localDate(date=new Date()){
 const p=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
 const v=Object.fromEntries(p.map(x=>[x.type,x.value]));return v.year+"-"+v.month+"-"+v.day;
}
function plusDays(date,days){const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+"T12:00:00Z"))}
function isAdmin(request,env){const key=String(env.CALENDAR_ADMIN_KEY||"");return Boolean(key&&request.headers.get("x-calendar-admin-key")===key)}
async function schema(env){
 if(!env.calendar)throw new Error("calendar_binding_missing");
 await env.calendar.batch([
  env.calendar.prepare("CREATE TABLE IF NOT EXISTS ais_events (event_id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',category TEXT NOT NULL DEFAULT 'Community',event_date TEXT NOT NULL,start_time TEXT NOT NULL,duration_minutes INTEGER NOT NULL DEFAULT 30,credits INTEGER NOT NULL DEFAULT 0,capacity INTEGER NOT NULL DEFAULT 30,status TEXT NOT NULL DEFAULT 'scheduled',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)"),
  env.calendar.prepare("CREATE INDEX IF NOT EXISTS idx_ais_events_slot ON ais_events(event_date,start_time,status)"),
  env.calendar.prepare("CREATE TABLE IF NOT EXISTS ais_event_registrations (registration_id TEXT PRIMARY KEY,event_id TEXT NOT NULL,developer_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'registered',registered_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(event_id,developer_id))"),
  env.calendar.prepare("CREATE INDEX IF NOT EXISTS idx_ais_reg_user ON ais_event_registrations(developer_id,status)"),
  env.calendar.prepare("CREATE TABLE IF NOT EXISTS ais_credit_ledger (ledger_id TEXT PRIMARY KEY,developer_id TEXT NOT NULL,event_id TEXT NOT NULL,amount INTEGER NOT NULL,reason TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(developer_id,event_id))"),
  env.calendar.prepare("CREATE INDEX IF NOT EXISTS idx_ais_credits_user ON ais_credit_ledger(developer_id,created_at)")
 ]);
 const count=await env.calendar.prepare("SELECT COUNT(*) AS n FROM ais_events").first();
 if(Number(count?.n||0)===0){
  const today=localDate(),created=stamp(),rows=[];
  for(let day=0;day<4;day++)for(let slot=0;slot<8;slot++)for(let n=0;n<6;n++){
   const kind=kinds[(slot*3+n+day)%kinds.length],timeMinutes=16*60+slot*30;
   const time=String(Math.floor(timeMinutes/60)).padStart(2,"0")+":"+String(timeMinutes%60).padStart(2,"0");
   rows.push(env.calendar.prepare("INSERT INTO ais_events(event_id,title,description,category,event_date,start_time,duration_minutes,credits,capacity,status,created_at,updated_at) VALUES(?,?,?,?,?,?,30,?,30,'scheduled',?,?)").bind(id(),kind[0]+" · "+variants[n],kind[1],"AI Studio",plusDays(today,day),time,kind[2],created,created));
  }
  for(let i=0;i<rows.length;i+=50)await env.calendar.batch(rows.slice(i,i+50));
 }
}
async function eventList(env,account,query){
 const date=String(query.get("date")||"");
 const where=date&&validDate(date)?"WHERE e.event_date=?":"";
 const stmt=env.calendar.prepare("SELECT e.event_id,e.title,e.description,e.category,e.event_date,e.start_time,e.duration_minutes,e.credits,e.capacity,e.status,COUNT(CASE WHEN r.status='registered' THEN 1 END) AS registered_count,MAX(CASE WHEN r.developer_id=? AND r.status='registered' THEN 1 ELSE 0 END) AS is_registered FROM ais_events e LEFT JOIN ais_event_registrations r ON r.event_id=e.event_id "+where+" GROUP BY e.event_id ORDER BY e.event_date,e.start_time,e.title");
 const result=where?await stmt.bind(account?.developer_id||"",date).all():await stmt.bind(account?.developer_id||"").all();
 return (result.results||[]).map(x=>({...x,is_registered:Boolean(x.is_registered)}));
}
export async function onRequestOptions(){return new Response(null,{status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"authorization,content-type,x-calendar-admin-key","access-control-allow-methods":"GET,POST,OPTIONS"}})}
export async function onRequestGet({request,env}){
 try{
  await schema(env);
  const u=new URL(request.url),action=u.searchParams.get("action")||"events",account=await getAccount(request,env);
  if(action==="events")return json({ok:true,timezone:TZ,events:await eventList(env,account,u.searchParams),total:192});
  if(action==="credits"){
   if(!account)return json({ok:false,error:"authentication_required"},401);
   const [balance,ledger]=await Promise.all([
    env.calendar.prepare("SELECT COALESCE(SUM(amount),0) AS balance FROM ais_credit_ledger WHERE developer_id=?").bind(account.developer_id).first(),
    env.calendar.prepare("SELECT ledger_id,event_id,amount,reason,created_at FROM ais_credit_ledger WHERE developer_id=? ORDER BY created_at DESC LIMIT 100").bind(account.developer_id).all()
   ]);
   return json({ok:true,balance:Number(balance?.balance||0),ledger:ledger.results||[]});
  }
  if(action==="my-events"){
   if(!account)return json({ok:false,error:"authentication_required"},401);
   const rows=await env.calendar.prepare("SELECT e.event_id,e.title,e.event_date,e.start_time,e.duration_minutes,e.credits,r.status,r.registered_at FROM ais_event_registrations r JOIN ais_events e ON e.event_id=r.event_id WHERE r.developer_id=? AND r.status!='cancelled' ORDER BY e.event_date,e.start_time").bind(account.developer_id).all();
   return json({ok:true,events:rows.results||[]});
  }
  return json({ok:false,error:"unknown_action"},404);
 }catch(e){return json({ok:false,error:"calendar_error",detail:String(e).slice(0,500)},500)}
}
export async function onRequestPost({request,env}){
 try{
  await schema(env);
  const u=new URL(request.url),action=u.searchParams.get("action")||"",account=await getAccount(request,env);
  let body={};try{body=await request.json()}catch{return json({ok:false,error:"invalid_json"},400)}
  if(action==="register"){
   if(!account)return json({ok:false,error:"authentication_required"},401);
   const eventId=String(body.event_id||"");
   const event=await env.calendar.prepare("SELECT * FROM ais_events WHERE event_id=? AND status='scheduled'").bind(eventId).first();
   if(!event)return json({ok:false,error:"event_not_found"},404);
   if(event.event_date<localDate())return json({ok:false,error:"event_closed"},409);
   const slotCount=await env.calendar.prepare("SELECT COUNT(*) AS n FROM ais_events WHERE event_date=? AND start_time=? AND status='scheduled'").bind(event.event_date,event.start_time).first();
   if(Number(slotCount?.n||0)>6)return json({ok:false,error:"slot_limit_exceeded"},409);
   const registered=await env.calendar.prepare("SELECT COUNT(*) AS n FROM ais_event_registrations WHERE event_id=? AND status='registered'").bind(eventId).first();
   if(Number(registered?.n||0)>=Number(event.capacity||30))return json({ok:false,error:"event_full"},409);
   const now=stamp();
   await env.calendar.prepare("INSERT INTO ais_event_registrations(registration_id,event_id,developer_id,status,registered_at,updated_at) VALUES(?,?,?,'registered',?,?) ON CONFLICT(event_id,developer_id) DO UPDATE SET status='registered',updated_at=excluded.updated_at").bind(id(),eventId,account.developer_id,now,now).run();
   return json({ok:true,registered:true,event_id:eventId});
  }
  if(action==="cancel"){
   if(!account)return json({ok:false,error:"authentication_required"},401);
   const eventId=String(body.event_id||"");
   const result=await env.calendar.prepare("UPDATE ais_event_registrations SET status='cancelled',updated_at=? WHERE event_id=? AND developer_id=? AND status='registered'").bind(stamp(),eventId,account.developer_id).run();
   if(!result.meta?.changes)return json({ok:false,error:"registration_not_found"},404);
   return json({ok:true,cancelled:true,event_id:eventId});
  }
  if(action==="create"){
   if(!isAdmin(request,env))return json({ok:false,error:"admin_authorization_required"},403);
   const title=String(body.title||"").trim().slice(0,120),description=String(body.description||"").trim().slice(0,1000),category=String(body.category||"Community").trim().slice(0,60),date=String(body.event_date||""),time=String(body.start_time||""),duration=Number(body.duration_minutes||30),credits=Number(body.credits||0);
   if(!title||!validDate(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||duration!==30||!Number.isInteger(credits)||credits<0||credits>100)return json({ok:false,error:"invalid_event"},400);
   const count=await env.calendar.prepare("SELECT COUNT(*) AS n FROM ais_events WHERE event_date=? AND start_time=? AND status='scheduled'").bind(date,time).first();
   if(Number(count?.n||0)>=6)return json({ok:false,error:"slot_full",detail:"Esta franja ya tiene seis eventos."},409);
   const eventId=id(),now=stamp();
   await env.calendar.prepare("INSERT INTO ais_events(event_id,title,description,category,event_date,start_time,duration_minutes,credits,capacity,status,created_at,updated_at) VALUES(?,?,?,?,?,?,30,?,30,'scheduled',?,?)").bind(eventId,title,description,category,date,time,credits,now,now).run();
   return json({ok:true,event_id:eventId});
  }
  if(action==="verify-attendance"){
   if(!isAdmin(request,env))return json({ok:false,error:"admin_authorization_required"},403);
   const eventId=String(body.event_id||""),developerId=String(body.developer_id||"");
   const registration=await env.calendar.prepare("SELECT r.status,e.credits,e.title FROM ais_event_registrations r JOIN ais_events e ON e.event_id=r.event_id WHERE r.event_id=? AND r.developer_id=?").bind(eventId,developerId).first();
   if(!registration||registration.status!=="registered")return json({ok:false,error:"active_registration_required"},409);
   const now=stamp(),ledgerId=id();
   await env.calendar.batch([
    env.calendar.prepare("UPDATE ais_event_registrations SET status='attended',updated_at=? WHERE event_id=? AND developer_id=?").bind(now,eventId,developerId),
    env.calendar.prepare("INSERT OR IGNORE INTO ais_credit_ledger(ledger_id,developer_id,event_id,amount,reason,created_at) VALUES(?,?,?,?,?,?)").bind(ledgerId,developerId,eventId,Number(registration.credits||0),"Attendance verified: "+registration.title,now)
   ]);
   const balance=await env.calendar.prepare("SELECT COALESCE(SUM(amount),0) AS balance FROM ais_credit_ledger WHERE developer_id=?").bind(developerId).first();
   return json({ok:true,verified:true,credits_awarded:Number(registration.credits||0),balance:Number(balance?.balance||0)});
  }
  return json({ok:false,error:"unknown_action"},404);
 }catch(e){return json({ok:false,error:"calendar_error",detail:String(e).slice(0,500)},500)}
}
