import React,{useMemo,useState}from"react";
import "./YourCode.css";

const LANGUAGE_KEY="fairwas:yourcode:language:v2";
const PAGE_KEY="fairwas:yourcode:page:v2";
const STARTER_LANGUAGE=`# Cada regla conecta una forma de escribir con un elemento de página.
# A la izquierda eliges qué produce; a la derecha inventas su sintaxis.
site := WEB {name}
background := FONDO {color}
accent := BRILLO {color}
title := TITULO {text}
text := PARRAFO {text}
button := BOTON {label} CON DESTINO {url}
card := FICHA {title} | {text}
image := FOTO {url} | {alt}
footer := FINAL {text}`;
const STARTER_PAGE=`WEB "Mi lenguaje, mis reglas"
FONDO "#10131b"
BRILLO "#b9f36b"
TITULO "He inventado mi propio idioma"
PARRAFO "Fairwas interpreta las reglas que yo he creado."
BOTON "Descubrir Fairwas" CON DESTINO "https://github.com/alexiusandromedavsgalaxia-lgtm/fairwas"
FICHA "Mi sintaxis" | "Puedo inventar palabras y separadores."
FICHA "Mi página" | "El parser convierte mi código en una web."
FINAL "Creado con mi propio lenguaje"`;

const ROLES={
 site:{count:1,help:"nombre de la web"},
 background:{count:1,help:"color de fondo"},
 accent:{count:1,help:"color de acento"},
 title:{count:1,help:"texto del título"},
 text:{count:1,help:"texto de párrafo"},
 button:{count:2,help:"texto del botón y URL"},
 card:{count:2,help:"título y descripción"},
 image:{count:2,help:"URL de imagen y texto alternativo"},
 footer:{count:1,help:"texto del pie"}
};
function read(key,fallback){try{return localStorage.getItem(key)||fallback}catch{return fallback}}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
function safeColor(value,fallback){const color=String(value||"").trim();return /^(#[0-9a-f]{3,8}|(?:rgb|hsl)a?\([0-9\s.,%+-]+\))$/i.test(color)?color:fallback}
function safeLink(value){try{const url=new URL(String(value||""));return["https:","http:"].includes(url.protocol)?url.href:null}catch{return null}}
function patternToRegex(pattern){
 const names=[];
 const pieces=String(pattern).split(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g);
 let source="^";
 for(let i=0;i<pieces.length;i++){
  if(i%2){names.push(pieces[i]);source+='("(?:\\\\.|[^"\\\\])*"|[^\\s]+)'}
  else source+=pieces[i].replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/\s+/g,"\\s+");
 }
 source+="$";
 return{regex:new RegExp(source,"i"),names};
}
function parseLanguage(source){
 const rules=[],errors=[];
 String(source||"").split(/\r?\n/).forEach((raw,index)=>{
  const line=raw.trim();if(!line||line.startsWith("#"))return;
  const match=line.match(/^([a-z]+)\s*:=\s*(.+)$/i);
  if(!match){errors.push({line:index+1,message:"Usa el formato elemento := TU SINTAXIS {variable}."});return}
  const role=match[1].toLowerCase(),pattern=match[2].trim();
  if(!ROLES[role]){errors.push({line:index+1,message:"Elemento desconocido: "+role+". Opciones: "+Object.keys(ROLES).join(", ")+ "."});return}
  if(!/\{[a-zA-Z][a-zA-Z0-9_]*\}/.test(pattern)){errors.push({line:index+1,message:"La sintaxis necesita al menos una variable entre llaves, por ejemplo {text}."});return}
  try{
   const compiled=patternToRegex(pattern);
   if(compiled.names.length!==ROLES[role].count){errors.push({line:index+1,message:role+" necesita "+ROLES[role].count+" variable(s): "+ROLES[role].help+"."});return}
   rules.push({role,pattern,regex:compiled.regex,names:compiled.names,line:index+1});
  }catch{errors.push({line:index+1,message:"No se ha podido interpretar esta regla."})}
 });
 if(!rules.length)errors.push({line:0,message:"Define al menos una regla válida para crear tu lenguaje."});
 return{rules,errors};
}
function decodeCapture(value){
 if(value.startsWith('"')){try{return JSON.parse(value)}catch{return value.slice(1,-1)}}
 return value;
}
function compilePage(languageSource,pageSource){
 const parsed=parseLanguage(languageSource),model={site:"Tu página",background:"#10131b",accent:"#b9f36b",title:"Tu página",blocks:[],footer:"Creado en Fairwas"},errors=[...parsed.errors];
 String(pageSource||"").split(/\r?\n/).forEach((raw,index)=>{
  const line=raw.trim();if(!line||line.startsWith("#"))return;
  let found=false;
  for(const rule of parsed.rules){
   const match=line.match(rule.regex);if(!match)continue;
   found=true;
   const values=match.slice(1).map(decodeCapture);
   switch(rule.role){
    case"site":model.site=values[0];break;
    case"background":model.background=safeColor(values[0],model.background);break;
    case"accent":model.accent=safeColor(values[0],model.accent);break;
    case"title":model.title=values[0];break;
    case"text":model.blocks.push({type:"text",text:values[0]});break;
    case"button":{const href=safeLink(values[1]);if(!href)errors.push({line:index+1,message:"El botón necesita una URL http:// o https:// válida."});else model.blocks.push({type:"button",label:values[0],href});break}
    case"card":model.blocks.push({type:"card",title:values[0],text:values[1]});break;
    case"image":{const src=safeLink(values[0]);if(!src)errors.push({line:index+1,message:"La imagen necesita una URL http:// o https:// válida."});else model.blocks.push({type:"image",src,alt:values[1]});break}
    case"footer":model.footer=values[0];break;
   }
   break;
  }
  if(!found)errors.push({line:index+1,message:"Ninguna regla de tu lenguaje reconoce esta línea."});
 });
 const blocks=model.blocks.map(block=>{
  if(block.type==="text")return'<p class="copy">'+escapeHtml(block.text)+'</p>';
  if(block.type==="button")return'<a class="action" href="'+escapeHtml(block.href)+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(block.label)+'</a>';
  if(block.type==="card")return'<article class="card"><h2>'+escapeHtml(block.title)+'</h2><p>'+escapeHtml(block.text)+'</p></article>';
  return'<img class="hero-image" src="'+escapeHtml(block.src)+'" alt="'+escapeHtml(block.alt)+'" loading="lazy">';
 }).join("\n");
 const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src https: http: data:; style-src \'unsafe-inline\'; form-action \'none\'; base-uri \'none\'"><title>'+escapeHtml(model.site)+'</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:'+model.background+';color:#f5f7fb;font:16px/1.65 system-ui,-apple-system,sans-serif}.wrap{width:min(880px,calc(100% - 40px));margin:0 auto;padding:72px 0}.eyebrow{color:'+model.accent+';font-size:12px;font-weight:750;letter-spacing:.16em;text-transform:uppercase}.hero{padding:42px 0 30px}h1{max-width:760px;margin:12px 0;font-size:clamp(38px,8vw,76px);line-height:1.02;letter-spacing:-.055em}.copy{max-width:680px;color:#c2c8d1;font-size:18px}.action{display:inline-flex;margin:18px 0;padding:12px 18px;border-radius:12px;background:'+model.accent+';color:#151a12;text-decoration:none;font-weight:750}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin:26px 0}.card{padding:22px;border:1px solid #ffffff20;border-radius:17px;background:#ffffff09}.card h2{margin:0 0 8px;font-size:19px}.card p{margin:0;color:#c2c8d1}.hero-image{display:block;width:100%;max-height:420px;object-fit:cover;border-radius:18px;margin:20px 0}.foot{margin-top:64px;padding-top:20px;border-top:1px solid #ffffff20;color:#929aa6;font-size:13px}@media(max-width:560px){.wrap{padding:38px 0}.hero{padding-top:26px}}</style></head><body><main class="wrap"><div class="eyebrow">'+escapeHtml(model.site)+'</div><header class="hero"><h1>'+escapeHtml(model.title)+'</h1></header><section>'+blocks+'</section><footer class="foot">'+escapeHtml(model.footer)+'</footer></main></body></html>';
 return{html,errors,ruleCount:parsed.rules.length};
}
export default function YourCode({onNavigate}){
 const[language,setLanguage]=useState(()=>read(LANGUAGE_KEY,STARTER_LANGUAGE));
 const[page,setPage]=useState(()=>read(PAGE_KEY,STARTER_PAGE));
 const[saved,setSaved]=useState(false);
 const compiled=useMemo(()=>compilePage(language,page),[language,page]);
 const save=()=>{try{localStorage.setItem(LANGUAGE_KEY,language);localStorage.setItem(PAGE_KEY,page);setSaved(true)}catch{setSaved(false)}};
 const navigate=url=>{if(typeof onNavigate==="function")onNavigate(url);else window.dispatchEvent(new CustomEvent("fairwas:navigate",{detail:url}))};
 const languageErrors=useMemo(()=>parseLanguage(language).errors,[language]);
 return <section className="cp-shell yc-shell">
  <aside className="cp-side">
   <div className="cp-brand"><span>YC</span><div><b>YourCode</b><small>Language creator</small></div></div>
   <nav><button className="active">Crear lenguaje</button><button onClick={()=>navigate("httc://createpage.fair")}>← CreatePage original</button></nav>
   <div className="cp-side-foot">YOURCODE · LANGUAGE LAB<br/><b>Invent · Parse · Render</b></div>
  </aside>
  <div className="cp-content yc-content">
   <header className="yc-heading"><div><small>FAIRWAS · YOURCODE</small><h1>Inventa tu propio lenguaje.</h1><p>Define la sintaxis. Escribe con ella. Fairwas la interpreta.</p></div><div className="yc-actions"><button className="cp-secondary" onClick={()=>{setLanguage(STARTER_LANGUAGE);setPage(STARTER_PAGE);setSaved(false)}}>Restablecer ejemplo</button><button className="cp-primary" onClick={save}>Guardar proyecto</button></div></header>
   <div className="yc-toolbar"><span><i/> LANGUAGE WORKSPACE</span><span>{compiled.ruleCount} reglas · {compiled.errors.length} errores</span></div>
   <div className="yc-workspace">
    <section className="yc-pane"><div className="yc-pane-head"><b>01 · language.fair</b><span>Diseña tu gramática</span></div><textarea aria-label="Definición del lenguaje" spellCheck="false" autoCapitalize="off" autoCorrect="off" value={language} onChange={event=>{setLanguage(event.target.value);setSaved(false)}}/><div className="yc-help"><b>Roles disponibles:</b> site, background, accent, title, text, button, card, image, footer. Crea reglas con <code>:=</code> y variables entre llaves.</div></section>
    <section className="yc-pane"><div className="yc-pane-head"><b>02 · index.your</b><span>Escribe con tu sintaxis</span></div><textarea aria-label="Código de la página" spellCheck="false" autoCapitalize="off" autoCorrect="off" value={page} onChange={event=>{setPage(event.target.value);setSaved(false)}}/><div className="yc-help"><b>Consejo:</b> los valores con espacios van entre comillas. Puedes inventar las palabras y los separadores.</div></section>
    <section className="yc-pane yc-preview"><div className="yc-pane-head"><b>03 · Render</b><span>Vista en directo</span></div><iframe title="Vista previa del lenguaje personalizado" sandbox="allow-popups" srcDoc={compiled.html}/></section>
   </div>
   <div className="yc-status"><span>{saved?"Proyecto guardado en este dispositivo":"Render actualizado automáticamente"}</span><span>{compiled.errors.length?"Hay elementos que revisar":"Sintaxis reconocida"}</span></div>
   {(compiled.errors.length>0||languageErrors.length>0)&&<section className="yc-errors"><b>Diagnóstico del parser</b>{compiled.errors.map((error,index)=><p key={"p"+index}>{error.line?"Página, línea "+error.line: "Lenguaje"}: {error.message}</p>)}</section>}
   <details className="yc-reference"><summary>Cómo inventar tu lenguaje</summary><p>Escribe una regla por línea: <code>rol := TU SINTAXIS {"{variable}"}</code>. El rol determina qué elemento seguro genera Fairwas. Las variables se rellenan con valores entre comillas. Puedes crear varias formas de escribir el mismo rol.</p><pre>{STARTER_LANGUAGE}</pre><p>Ejemplo de página:</p><pre>{STARTER_PAGE}</pre></details>
  </div>
 </section>;
}
