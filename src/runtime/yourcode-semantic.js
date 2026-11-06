const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const COLORS={blue:"#3998ef",azul:"#3998ef",violet:"#8b5cf6",purple:"#8b5cf6",morado:"#8b5cf6",violeta:"#8b5cf6",red:"#ef4444",rojo:"#ef4444",green:"#22a06b",verde:"#22a06b",yellow:"#facc15",amarillo:"#facc15",orange:"#f97316",naranja:"#f97316",pink:"#ec4899",rosa:"#ec4899",black:"#111827",negro:"#111827",white:"#fff",blanco:"#fff",cyan:"#06b6d4",turquoise:"#14b8a6",turquesa:"#14b8a6"};
const words=source=>String(source||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
function colorFrom(source){const s=words(source);for(const [name,value] of Object.entries(COLORS)){if(new RegExp("(^|[^\\p{L}])"+name+"([^\\p{L}]|$)","u").test(s))return value}const hex=s.match(/#(?:[0-9a-f]{3}|[0-9a-f]{6})\\b/i);return hex?.[0]||null}
function renderScene(source,title){
 const s=words(source),has=(...terms)=>terms.some(term=>s.includes(term));
 const background=colorFrom(source)||"#edf3ff";
 const hasWindow=has("window","ventana","screen","pantalla","frame","marco");
 const hasSky=has("sky","cielo");
 const hasButton=has("button","boton","botón");
 const hasText=has("text","texto","write","escribe","message","mensaje");
 const hasHeading=has("heading","title","titulo","título","headline","encabezado");
 const hasCircle=has("circle","circulo","círculo","orb","sphere","esfera");
 const hasCard=has("card","tarjeta","panel","box","caja");
 const hasImage=has("image","imagen","photo","foto","picture");
 const make=has("make","create","build","draw","render","show","display","crear","crea","construye","dibuja","muestra","renderiza","pinta");
 const titleMatch=String(source).match(/(?:title|titulo|título|heading|text|texto|message|mensaje)\\s*(?:[:=]|\\bis\\b)\\s*["']?([^\\n"']+)/i);
 const quoted=[...String(source).matchAll(/["']([^"'\\n]{2,100})["']/g)].map(x=>x[1]);
 const label=titleMatch?.[1]?.trim()||quoted[0]||"";
 const parts=[];
 if(hasWindow||make)parts.push('<section class="yc-window"><div class="yc-bar"><i></i><i></i><i></i><span>'+escapeHtml(title||"YourCode")+'</span></div><div class="yc-scene">'+(hasSky?'<div class="yc-sky"><span class="yc-sun"></span><span class="yc-cloud c1"></span><span class="yc-cloud c2"></span><div class="yc-hills"></div></div>':'<div class="yc-surface"></div>')+'</div></section>');
 if(hasHeading)parts.push('<h1>'+escapeHtml(label||"YourCode")+'</h1>');
 if(hasText&&!hasHeading)parts.push('<p class="yc-text">'+escapeHtml(label||"Contenido creado con YourCode")+'</p>');
 if(hasButton)parts.push('<button class="yc-button">'+escapeHtml(label||"Continuar")+'</button>');
 if(hasCircle)parts.push('<div class="yc-orb" style="background:'+background+'"></div>');
 if(hasCard)parts.push('<article class="yc-card">'+escapeHtml(label||"Nuevo elemento")+'</article>');
 if(hasImage)parts.push('<div class="yc-image" style="background:linear-gradient(135deg,'+background+',#f4f7ff)"><span>✦</span></div>');
 if(!parts.length){
  const phrase=String(source).trim().replace(/\\s+/g," ");
  const violet=/render\\s*\\[\\s*["']?violet/i.test(s);
  const accent=violet?"#8b5cf6":background;
  const content=label||quoted[0]||phrase.slice(0,90)||"YourCode";
  parts.push('<section class="yc-generated" style="--yc-accent:'+accent+'"><div class="yc-generated-mark">✦</div><h1>'+escapeHtml(content)+'</h1><div class="yc-generated-line"></div><p>Elemento visual interpretado</p></section>');
 }
 const css='*{box-sizing:border-box}.yc-stage{min-height:100vh;padding:clamp(20px,5vw,64px);display:grid;place-items:center;background:radial-gradient(circle at 20% 0%,#fff 0,#f4f6fb 50%,#e9edf5 100%);font-family:Inter,system-ui,sans-serif;color:#182235}.yc-content{width:min(900px,100%);display:grid;gap:24px;justify-items:center}.yc-window{width:min(760px,100%);overflow:hidden;border-radius:22px;background:#fff;box-shadow:0 24px 80px #1c2d4a26;border:1px solid #dce3ee}.yc-bar{height:48px;display:flex;align-items:center;gap:7px;padding:0 16px;background:#f8f9fc;border-bottom:1px solid #e6eaf1}.yc-bar i{width:9px;height:9px;border-radius:50%;background:#c2c9d4}.yc-bar span{margin:auto;font-size:12px;color:#657187}.yc-scene{height:clamp(250px,48vw,440px);overflow:hidden}.yc-sky{height:100%;position:relative;overflow:hidden;background:linear-gradient(#258fe5 0%,#83d4ff 68%,#c6edff 100%)}.yc-sun{position:absolute;width:76px;height:76px;right:12%;top:12%;border-radius:50%;background:#ffe9a6;box-shadow:0 0 65px #fff3b0}.yc-cloud{position:absolute;width:140px;height:38px;border-radius:50px;background:#fff;top:34%;filter:drop-shadow(0 7px 8px #145c9130)}.yc-cloud:before,.yc-cloud:after{content:"";position:absolute;bottom:8px;border-radius:50%;background:#fff}.yc-cloud:before{width:58px;height:58px;left:22px}.yc-cloud:after{width:42px;height:42px;right:20px}.yc-cloud.c1{left:13%}.yc-cloud.c2{right:22%;top:53%;transform:scale(.72)}.yc-hills{position:absolute;bottom:-30%;left:-8%;width:116%;height:58%;border-radius:50% 50% 0 0;background:linear-gradient(140deg,#5eae79,#287c62)}.yc-surface{height:100%;background:linear-gradient(145deg,#fff,'+background+')} .yc-content h1{margin:0;font-size:clamp(28px,6vw,54px);text-align:center}.yc-text{font-size:18px;color:#536178}.yc-button{border:0;border-radius:12px;padding:14px 24px;background:'+background+';color:#fff;font-weight:700;font-size:15px}.yc-orb{width:130px;height:130px;border-radius:50%;box-shadow:0 18px 45px #18223525}.yc-card{padding:32px;border-radius:20px;background:#fff;box-shadow:0 18px 50px #18223516}.yc-image{width:min(360px,100%);height:210px;border-radius:20px;display:grid;place-items:center;font-size:60px;color:white}.yc-generated{width:min(640px,100%);padding:clamp(28px,6vw,64px);border-radius:28px;background:#fff;box-shadow:0 24px 70px #18223518;text-align:center;border-top:7px solid var(--yc-accent)}.yc-generated-mark{font-size:40px;color:var(--yc-accent)}.yc-generated h1{margin:18px 0;font-size:clamp(28px,6vw,48px)}.yc-generated-line{height:5px;width:76px;margin:20px auto;border-radius:9px;background:var(--yc-accent)}.yc-generated p{color:#788397}';
 return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escapeHtml(title||"YourCode")+'</title><style>'+css+'</style></head><body><main class="yc-stage"><div class="yc-content">'+parts.join("")+'</div></main></body></html>';
}
export function interpretInventedCode(source,{title="YourCode"}={}){
 const text=String(source??"");
 if(!text.trim())return{kind:"invented",html:renderScene("","YourCode"),interpreted:false,source:text};
 return{kind:"invented",html:renderScene(text,title),interpreted:true,source:text};
}
