import React,{useMemo,useState}from"react";
import "./YourCode.css";

const STORAGE_KEY="fairwas:yourcode:draft:v1";
const STARTER=`site "Mi primera página"
background "#10131b"
accent "#b9f36b"
title "Hola, Fairwas"
text "Esta página está escrita en YourCode, un lenguaje creado para Fairwas."
button "Descubrir Fairwas" "https://github.com/alexiusandromedavsgalaxia-lgtm/fairwas"
card "Código propio" "Escribe instrucciones sencillas y YourCode las convierte en una página."
card "Vista en directo" "Cada cambio se renderiza automáticamente en la vista previa."
footer "Creado con YourCode · Fairwas"`;

function readDraft(){
 try{return localStorage.getItem(STORAGE_KEY)||STARTER}catch{return STARTER}
}
function escapeHtml(value){
 return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
function argsOf(source){
 const values=[];const pattern=/"((?:\\.|[^"\\])*)"/g;let match;
 while((match=pattern.exec(source)))try{values.push(JSON.parse('"'+match[1]+'"'))}catch{values.push(match[1])}
 return values;
}
function safeColor(value,fallback){
 const color=String(value||"").trim();
 return /^(#[0-9a-f]{3,8}|(?:rgb|hsl)a?\([0-9\s.,%+-]+\))$/i.test(color)?color:fallback;
}
function safeLink(value){
 try{const url=new URL(String(value||""));return["https:","http:"].includes(url.protocol)?url.href:null}catch{return null}
}
function compileYourCode(source){
 const model={site:"YourCode page",background:"#10131b",accent:"#b9f36b",title:"Tu página",blocks:[],footer:"Creado con YourCode"};
 const errors=[];
 const lines=String(source||"").split(/\r?\n/);
 lines.forEach((raw,index)=>{
  const line=raw.trim();if(!line||line.startsWith("#"))return;
  const split=line.search(/\s/);const command=(split<0?line:line.slice(0,split)).toLowerCase();
  const args=argsOf(split<0?"":line.slice(split+1));
  const required={site:1,background:1,accent:1,title:1,text:1,button:2,card:2,image:2,footer:1};
  if(!(command in required)){errors.push({line:index+1,message:"Instrucción desconocida: "+command});return}
  if(args.length<required[command]){errors.push({line:index+1,message:command+" necesita "+required[command]+" texto(s) entre comillas."});return}
  switch(command){
   case "site":model.site=args[0];break;
   case "background":model.background=safeColor(args[0],model.background);break;
   case "accent":model.accent=safeColor(args[0],model.accent);break;
   case "title":model.title=args[0];break;
   case "text":model.blocks.push({type:"text",text:args[0]});break;
   case "button":{
    const href=safeLink(args[1]);if(!href)errors.push({line:index+1,message:"button necesita una dirección http:// o https:// válida."});
    else model.blocks.push({type:"button",label:args[0],href});break;
   }
   case "card":model.blocks.push({type:"card",title:args[0],text:args[1]});break;
   case "image":{
    const src=safeLink(args[0]);if(!src)errors.push({line:index+1,message:"image necesita una dirección http:// o https:// válida."});
    else model.blocks.push({type:"image",src,alt:args[1]});break;
   }
   case "footer":model.footer=args[0];break;
  }
 });
 const blocks=model.blocks.map(block=>{
  if(block.type==="text")return '<p class="copy">'+escapeHtml(block.text)+'</p>';
  if(block.type==="button")return '<a class="action" href="'+escapeHtml(block.href)+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(block.label)+'</a>';
  if(block.type==="card")return '<article class="card"><h2>'+escapeHtml(block.title)+'</h2><p>'+escapeHtml(block.text)+'</p></article>';
  return '<img class="hero-image" src="'+escapeHtml(block.src)+'" alt="'+escapeHtml(block.alt)+'" loading="lazy">';
 }).join("\n");
 const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src https: http: data:; style-src \'unsafe-inline\'; form-action \'none\'; base-uri \'none\'"><title>'+escapeHtml(model.site)+'</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:'+model.background+';color:#f5f7fb;font:16px/1.65 system-ui,-apple-system,sans-serif}.wrap{width:min(880px,calc(100% - 40px));margin:0 auto;padding:72px 0}.eyebrow{color:'+model.accent+';font-size:12px;font-weight:750;letter-spacing:.16em;text-transform:uppercase}.hero{padding:42px 0 30px}h1{max-width:760px;margin:12px 0;font-size:clamp(38px,8vw,76px);line-height:1.02;letter-spacing:-.055em}.copy{max-width:680px;color:#c2c8d1;font-size:18px}.action{display:inline-flex;margin:18px 0;padding:12px 18px;border-radius:12px;background:'+model.accent+';color:#151a12;text-decoration:none;font-weight:750}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin:26px 0}.card{padding:22px;border:1px solid #ffffff20;border-radius:17px;background:#ffffff09}.card h2{margin:0 0 8px;font-size:19px}.card p{margin:0;color:#c2c8d1}.hero-image{display:block;width:100%;max-height:420px;object-fit:cover;border-radius:18px;margin:20px 0}.foot{margin-top:64px;padding-top:20px;border-top:1px solid #ffffff20;color:#929aa6;font-size:13px}@media(max-width:560px){.wrap{padding:38px 0}.hero{padding-top:26px}}</style></head><body><main class="wrap"><div class="eyebrow">'+escapeHtml(model.site)+'</div><header class="hero"><h1>'+escapeHtml(model.title)+'</h1></header><section>'+blocks+'</section><footer class="foot">'+escapeHtml(model.footer)+'</footer></main></body></html>';
 return{html,errors,model};
}

export default function YourCode({onNavigate}){
 const[code,setCode]=useState(readDraft);
 const[saved,setSaved]=useState(false);
 const compiled=useMemo(()=>compileYourCode(code),[code]);
 const save=()=>{
  try{localStorage.setItem(STORAGE_KEY,code);setSaved(true)}catch{setSaved(false)}
 };
 const navigate=url=>{if(typeof onNavigate==="function")onNavigate(url);else window.dispatchEvent(new CustomEvent("fairwas:navigate",{detail:url}))};
 return <section className="cp-shell yc-shell">
  <aside className="cp-side">
   <div className="cp-brand"><span>YC</span><div><b>YourCode</b><small>Fairwas language studio</small></div></div>
   <nav>
    <button className="active">Editor visual</button>
    <button onClick={()=>navigate("httc://createpage.fair")}>← CreatePage original</button>
   </nav>
   <div className="cp-side-foot">YOURCODE · .ycode<br/><b>Write · Render · Create</b></div>
  </aside>
  <div className="cp-content yc-content">
   <header className="yc-heading"><div><small>FAIRWAS · YOURCODE</small><h1>Tu código. Tu página.</h1><p>Un lenguaje propio, sencillo y renderizado al instante.</p></div><div className="yc-actions"><button className="cp-secondary" onClick={()=>setCode(STARTER)}>Ejemplo</button><button className="cp-primary" onClick={save}>Guardar código</button></div></header>
   <div className="yc-toolbar"><span><i/> YOURCODE EDITOR</span><span>{code.split(/\r?\n/).length} líneas · {compiled.errors.length} avisos</span></div>
   <div className="yc-workspace">
    <section className="yc-pane">
     <div className="yc-pane-head"><b>index.ycode</b><span>Lenguaje YourCode</span></div>
     <textarea aria-label="Código YourCode" spellCheck="false" autoCapitalize="off" autoCorrect="off" value={code} onChange={event=>{setCode(event.target.value);setSaved(false)}}/>
     <div className="yc-help"><b>Comandos:</b> site, background, accent, title, text, button, card, image, footer. Usa textos entre comillas.</div>
    </section>
    <section className="yc-pane yc-preview">
     <div className="yc-pane-head"><b>Vista previa</b><span>Render en directo</span></div>
     <iframe title="Vista previa de YourCode" sandbox="allow-popups" srcDoc={compiled.html}/>
    </section>
   </div>
   <div className="yc-status"><span>{saved?"Borrador guardado en este dispositivo":"Vista previa actualizada automáticamente"}</span><span>{compiled.errors.length?"Revisa las instrucciones marcadas":"Sin errores de sintaxis"}</span></div>
   {compiled.errors.length>0&&<section className="yc-errors"><b>Problemas del código</b>{compiled.errors.map((error,index)=><p key={index}>Línea {error.line}: {error.message}</p>)}</section>}
   <details className="yc-reference"><summary>Cómo funciona el lenguaje YourCode</summary><pre>{'site "Nombre de tu web"\nbackground "#10131b"\naccent "#b9f36b"\ntitle "Un título"\ntext "Un párrafo"\nbutton "Abrir" "https://example.com"\ncard "Tarjeta" "Descripción"\nimage "https://example.com/foto.jpg" "Texto alternativo"\nfooter "Pie de página"'}</pre></details>
  </div>
 </section>;
}
