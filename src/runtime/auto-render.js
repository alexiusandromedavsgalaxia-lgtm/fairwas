import { canParseJavaScript } from "./parsers.js";
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const page = (title, body, extra = "") => '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escapeHtml(title)+'</title><style>html{color-scheme:light dark}body{margin:0;padding:24px;font:16px/1.55 system-ui,sans-serif;background:#f7f8fb;color:#171923}main{max-width:960px;margin:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%}td,th{padding:8px 10px;border:1px solid #ccd1dc;text-align:left}h1,h2{line-height:1.2}'+extra+'</style></head><body><main>'+body+'</main></body></html>';

function markdown(source) {
 const lines=String(source).replace(/\r/g,"").split("\n"), out=[];
 let list=null, inCode=false, code=[];
 const closeList=()=>{if(list){out.push("</"+list+">");list=null}};
 for(const line of lines){
  if(line.trim().startsWith("```")){closeList();if(inCode){out.push("<pre><code>"+escapeHtml(code.join("\n"))+"</code></pre>");code=[];inCode=false}else inCode=true;continue}
  if(inCode){code.push(line);continue}
  const heading=line.match(/^(#{1,6})\s+(.+)$/);
  if(heading){closeList();const n=heading[1].length;out.push("<h"+n+">"+inlineMarkdown(heading[2])+"</h"+n+">");continue}
  if(/^\s*[-*+]\s+/.test(line)||/^\s*\d+\.\s+/.test(line)){
   const type=/^\s*\d+\./.test(line)?"ol":"ul";if(list!==type){closeList();list=type;out.push("<"+type+">")}out.push("<li>"+inlineMarkdown(line.replace(/^\s*(?:[-*+]\s+|\d+\.\s+)/,""))+"</li>");continue;
  }
  closeList();if(!line.trim())continue;
  if(/^\s*>/.test(line))out.push("<blockquote>"+inlineMarkdown(line.replace(/^\s*>\s?/,""))+"</blockquote>");
  else if(/^\s*---+\s*$/.test(line))out.push("<hr>");
  else out.push("<p>"+inlineMarkdown(line)+"</p>");
 }
 closeList();if(inCode)out.push("<pre><code>"+escapeHtml(code.join("\n"))+"</code></pre>");
 return out.join("\n");
}
function inlineMarkdown(value){
 return escapeHtml(value).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\*(.+?)\*/g,"<em>$1</em>").replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" rel="noopener">$1</a>');
}
function jsonView(source){
 let value;try{value=JSON.parse(source)}catch{return null}
 const rows=Array.isArray(value)?value:(value&&typeof value==="object"?Object.entries(value).map(([key,val])=>({key,value:val})):null);
 if(Array.isArray(rows)&&rows.length&&rows.every(item=>item&&typeof item==="object"&&!Array.isArray(item))){
  const keys=[...new Set(rows.flatMap(item=>Object.keys(item)))];
  return "<h1>Datos del proyecto</h1><table><thead><tr>"+keys.map(key=>"<th>"+escapeHtml(key)+"</th>").join("")+"</tr></thead><tbody>"+rows.map(item=>"<tr>"+keys.map(key=>"<td>"+escapeHtml(typeof item[key]==="object"?JSON.stringify(item[key]):item[key]??"")+"</td>").join("")+"</tr>").join("")+"</tbody></table>";
 }
 return "<h1>Datos del proyecto</h1><pre>"+escapeHtml(JSON.stringify(value,null,2))+"</pre>";
}
function csvView(source){
 const rows=String(source).trim().split(/\r?\n/).map(line=>line.split(","));
 if(rows.length<1||rows.every(row=>row.length===1))return null;
 return "<h1>Datos</h1><table>"+rows.map((row,index)=>"<tr>"+row.map(cell=>index===0?"<th>"+escapeHtml(cell.trim())+"</th>":"<td>"+escapeHtml(cell.trim())+"</td>").join("")+"</tr>").join("")+"</table>";
}
function looksLikeJavaScript(source){
 const s=String(source).trim();
 if(!s)return false;
 return /^(?:#!.*\n)?(?:import\s|export\s|(?:async\s+)?function\s|class\s|const\s|let\s|var\s|document\.|window\.|console\.|globalThis\.|module\.|exports\.|require\(|return\s|if\s*\(|for\s*\(|while\s*\(|try\s*\{|\(\s*\(\s*\)\s*=>|\(\s*function)/m.test(s) ||
  /\b(?:document\.(?:createElement|querySelector|querySelectorAll|body|getElementById)|window\.(?:addEventListener|location)|addEventListener|console\.(?:log|warn|error)|=>\s*[{(]|\b(?:function|class)\s+[A-Za-z_$])/m.test(s);
}
function looksLikeCss(source){return /(^|})\s*[^@{}][^{]*\{\s*[^}]+:[^}]+}/.test(String(source)) && !looksLikeJavaScript(source)}
const LANGUAGE_BY_EXTENSION={
 py:"Python",pyw:"Python",pyi:"Python",ts:"TypeScript",tsx:"TSX",jsx:"JSX",mjs:"JavaScript",cjs:"JavaScript",js:"JavaScript",php:"PHP",phtml:"PHP",java:"Java",class:"Java bytecode",kt:"Kotlin",kts:"Kotlin",swift:"Swift",go:"Go",rs:"Rust",rb:"Ruby",rake:"Ruby",cs:"C#",fs:"F#",fsx:"F#",vb:"Visual Basic",c:"C",h:"C/C++",cc:"C++",cpp:"C++",cxx:"C++",hpp:"C++",hh:"C++",sql:"SQL",sh:"Shell",bash:"Bash",zsh:"Shell",ps1:"PowerShell",bat:"Batch",cmd:"Batch",lua:"Lua",r:"R",dart:"Dart",scala:"Scala",sc:"Scala",pl:"Perl",pm:"Perl",ex:"Elixir",exs:"Elixir",erl:"Erlang",hrl:"Erlang",clj:"Clojure",cljs:"ClojureScript",hs:"Haskell",lhs:"Haskell",elm:"Elm",vue:"Vue",svelte:"Svelte",astro:"Astro",graphql:"GraphQL",gql:"GraphQL",proto:"Protocol Buffers",xml:"XML",xsl:"XSLT",yaml:"YAML",yml:"YAML",toml:"TOML",ini:"INI",conf:"Configuration",env:"Environment",json:"JSON",jsonc:"JSONC",md:"Markdown",mdx:"MDX",txt:"Texto",csv:"CSV",css:"CSS",scss:"SCSS",sass:"Sass",less:"Less",html:"HTML",htm:"HTML",svg:"SVG",wasm:"WebAssembly",wat:"WebAssembly Text",sol:"Solidity",vy:"Vyper",move:"Move",tf:"Terraform",hcl:"HCL",make:"Makefile",mk:"Makefile",dockerfile:"Dockerfile"};
function languageFor(path,source){
 const name=String(path||"").split("/").pop().toLowerCase();
 const ext=name.includes(".")?name.split(".").pop():name;
 if(LANGUAGE_BY_EXTENSION[ext])return LANGUAGE_BY_EXTENSION[ext];
 const s=String(source||"").trim();
 if(/^#!.*\bpython\b/m.test(s)||/^\s*(?:def\s+\w+\s*\(|from\s+\w+\s+import\s|import\s+\w+\s*$)/m.test(s))return "Python";
 if(/^\s*(?:package\s+\w+|func\s+\w+\s*\()/m.test(s))return "Go";
 if(/^\s*(?:fn\s+main\s*\(|use\s+std::|let\s+mut\s+)/m.test(s))return "Rust";
 if(/^\s*(?:SELECT\s|CREATE\s+TABLE\s|INSERT\s+INTO\s)/im.test(s))return "SQL";
 if(/^\s*(?:#!.*\b(?:bash|sh)\b|set\s+-e\b)/m.test(s))return "Shell";
 if(looksLikeCss(s))return "CSS";
 return "Código";
}
function universalVisualPreview(source,path,title){
 const language=languageFor(path,source);
 const tokenize=line=>{
  const tokens=[];
  let i=0;
  const isLetter=ch=>/[\p{L}_$@]/u.test(ch);
  const isDigit=ch=>/[0-9]/.test(ch);
  while(i<line.length){
   const ch=line[i];
   if(/\s/u.test(ch)){i++;continue}
   let value="",kind="symbol";
   if(ch==='"'||ch==="'"||ch===String.fromCharCode(96)){
    const quote=ch;value=ch;i++;
    while(i<line.length){
     const next=line[i];value+=next;i++;
     if(next==="\\\\"&&i<line.length){value+=line[i];i++;continue}
     if(next===quote)break;
    }
    kind="text";value=value.length>1?value.slice(1,value.endsWith(quote)?-1:undefined):value;
   }else if(isLetter(ch)){
    const begin=i++;
    while(i<line.length&&(/[\p{L}\p{N}_$@!?-]/u.test(line[i])))i++;
    value=line.slice(begin,i);kind="word";
   }else if(isDigit(ch)){
    const begin=i++;
    while(i<line.length&&/[0-9._]/.test(line[i]))i++;
    value=line.slice(begin,i);kind="number";
   }else{
    value=ch;i++;
    if("=+-*/%<>!&|^~?:.".includes(ch)){
     while(i<line.length&&"=+-*/%<>!&|^~?:.".includes(line[i])){value+=line[i];i++}
    }
   }
   tokens.push('<span class="token token-'+kind+'">'+escapeHtml(value)+'</span>');
  }
  return tokens.join("");
 };
 const lines=String(source).replace(/\r/g,"").split("\n");
 const statements=lines.map((line,index)=>({line,index})).filter(item=>item.line.trim());
 const blocks=statements.map(({line,index},position)=>{
  const tokens=tokenize(line);
  return '<article class="visual-block"><div class="visual-block-meta"><span>ELEMENTO '+String(position+1).padStart(2,"0")+'</span><span>LÍNEA '+(index+1)+'</span></div><div class="visual-block-content">'+(tokens||'<span class="token token-empty">Elemento vacío</span>')+'</div></article>';
 }).join("");
 const body='<header class="visual-hero"><span class="visual-kicker">YOURCODE · REPRESENTACIÓN UNIVERSAL</span><h1>'+escapeHtml(title||"YourCode")+'</h1><p>Contenido convertido en elementos visuales. No se muestra el archivo fuente.</p><div class="visual-stats"><span>'+statements.length+' bloques</span><span>'+String(source).length+' caracteres</span><span>'+escapeHtml(language)+'</span></div></header><section class="visual-canvas">'+(blocks||'<div class="visual-empty">Este archivo todavía no contiene elementos para representar.</div>')+'</section>';
 const styles='.visual-hero{padding:clamp(24px,5vw,52px);border-radius:24px;background:linear-gradient(135deg,#17251e,#17202d);color:#f5f7f4;margin-bottom:20px}.visual-kicker{font-size:10px;letter-spacing:.18em;font-weight:800;color:#a8e66b}.visual-hero h1{font-size:clamp(28px,5vw,48px);margin:12px 0 8px}.visual-hero p{color:#c0c9c4;margin:0}.visual-stats{display:flex;gap:8px;flex-wrap:wrap;margin-top:22px}.visual-stats span{font-size:11px;padding:7px 10px;border-radius:999px;background:#ffffff18;color:#e6eee8}.visual-canvas{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:12px}.visual-block{min-width:0;padding:18px;border:1px solid #dce2e9;border-radius:16px;background:#fff;box-shadow:0 8px 28px #17202d0a}.visual-block-meta{display:flex;justify-content:space-between;gap:8px;color:#8993a1;font-size:9px;letter-spacing:.1em;font-weight:800}.visual-block-content{display:flex;align-items:center;align-content:flex-start;flex-wrap:wrap;gap:8px;margin-top:18px;min-height:32px}.token{display:inline-flex;align-items:center;max-width:100%;overflow-wrap:anywhere;padding:8px 10px;border-radius:9px;font:600 13px/1.35 system-ui,sans-serif}.token-word{background:#edf3e8;color:#28452c}.token-text{background:#e9efff;color:#304b8a}.token-number{background:#fff0dc;color:#875016;font-size:16px}.token-symbol{background:#f0edf5;color:#67537e;min-width:25px;justify-content:center}.token-empty{color:#8993a1;background:#f3f5f7}.visual-empty{padding:32px;border:1px dashed #b9c2cd;border-radius:16px;text-align:center;color:#687386}@media(prefers-color-scheme:dark){.visual-block{background:#171b22;border-color:#343d49}.visual-block-meta{color:#98a4b3}.token-word{background:#243528;color:#c3e8bd}.token-text{background:#263552;color:#c6d7ff}.token-number{background:#4a3421;color:#ffd4a1}.token-symbol{background:#342c40;color:#e0cef4}.visual-empty{color:#aeb8c6;border-color:#505b69}}';
 return {html:page(title,body,'<style>'+styles+'</style>'),language,kind:"universal",executable:false,detail:"Representación visual universal de la estructura. El archivo fuente no se expone como página de código."};
}
function cssPreview(source){
 const selectors=[...String(source).matchAll(/([^{}]+)\{[^{}]*\}/g)].map(match=>match[1].trim()).filter(s=>s&&!s.startsWith("@")).slice(0,12);
 const samples=selectors.map(selector=>{const tag=selector.startsWith("#")?"section":selector.startsWith(".")?"div":/^(?:h[1-6]|p|button|a|article|header|footer|main|section|nav|span|label|input|img)\b/i.test(selector)?selector.split(/[.#\s:]/)[0]:"div";return "<"+tag+(selector.startsWith("#")?' id="'+escapeHtml(selector.slice(1))+'"':selector.startsWith(".")?' class="'+escapeHtml(selector.slice(1))+'"':"")+">"+escapeHtml(selector)+"</"+tag+">"}).join("");
 return page("Vista previa CSS","<h1>Vista previa de estilos</h1>"+(samples||"<p>El archivo contiene reglas CSS, pero no define selectores de elementos visibles.</p>")+"<style>"+String(source).replace(/<\/style/gi,"<\\/style")+"</style>");
}

/**
 * Native browser execution is opt-in by conventional JS filename and successful
 * JavaScript parsing. Unknown or non-JavaScript syntax is preserved as source.
 */
export function autoRenderFile(file,{title="YourCode",hostname="",rewriteImports=value=>value}={}){
 const source=String(file?.content??"");
 const path=String(file?.path||"");
 const trimmed=source.trim();
 if(file?.encoding==="base64")return {kind:"binary",html:null};
 if(/^\s*(?:<!doctype\s+html|<html\b|<head\b|<body\b)/i.test(source))return {kind:"html",html:source};
 if(/^\s*<svg\b/i.test(source))return {kind:"html",html:source};
 if(/^\s*<([A-Za-z][\w:-]*)(?:\s[^>]*)?>[\s\S]*<\/\1>\s*$/i.test(source))return {kind:"html",html:page(title,source)};
 if(/^\s*#\s+|^\s*[-*+]\s+|^\s*\>\s+/m.test(source)||/\.md(?:own)?$/i.test(path))return {kind:"markdown",html:page(title,markdown(source))};
 if(/^\s*[\[{]/.test(source)){const body=jsonView(source);if(body!==null)return {kind:"json",html:page(title,body)}}
 if(/\.csv$/i.test(path)){const body=csvView(source);if(body)return {kind:"csv",html:page(title,body)}}
 if(/^\s*<\?xml[\s\S]*<svg\b/i.test(source))return {kind:"html",html:source.replace(/^\s*<\?xml[^>]*>\s*/i,"")};
 if(looksLikeCss(source)||/\.css$/i.test(path))return {kind:"css",html:cssPreview(source)};
 if(/\.(?:[cm]?js)$/i.test(path)&&canParseJavaScript(source)){
  const executable=rewriteImports(source);
  const safeCode=JSON.stringify(executable).replace(/</g,"\\u003c").replace(/\u2028/g,"\\u2028").replace(/\u2029/g,"\\u2029");
  const isModule=/^\s*(?:import\s|export\s)|\bimport\s*\(/m.test(executable);
  const scriptType=isModule?"module":"text/javascript";
  const bootstrap="<script>(function(){var panel=document.createElement('pre');panel.id='yourcode-runtime-error';panel.style.cssText='display:none;white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;margin:20px 0;border:1px solid #d97757;border-radius:12px;background:#fff0eb;color:#762d1c;font:13px/1.5 ui-monospace,monospace';function report(value){panel.style.display='block';var message=value&&value.message||value||'error desconocido';panel.textContent='Error de ejecución: '+String(message);if(!panel.isConnected)document.body.appendChild(panel)}var output=document.createElement('pre');output.id='yourcode-runtime-output';output.style.cssText='display:none;white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;margin:20px 0;border:1px solid #91b8a0;border-radius:12px;background:#effaf2;color:#173d27;font:13px/1.5 ui-monospace,monospace';function showOutput(level,args){output.style.display='block';var values=Array.from(args).map(function(value){if(typeof value==='string')return value;try{return JSON.stringify(value)}catch{return String(value)}});var row=document.createElement('div');row.textContent=(level==='log'?'': '['+level+'] ')+values.join(' ');output.appendChild(row);if(!output.isConnected)document.body.appendChild(output)}['log','info','warn','error'].forEach(function(level){var original=console[level];console[level]=function(){showOutput(level,arguments);if(original)original.apply(console,arguments)}});window.addEventListener('error',function(e){report(e.error||e.message)});window.addEventListener('unhandledrejection',function(e){report(e.reason)});var source="+safeCode+";var script=document.createElement('script');script.type="+JSON.stringify(scriptType)+";script.textContent=source;script.onerror=function(e){report('No se pudo cargar un módulo o una dependencia del proyecto.')};document.body.appendChild(script)})();</script>";
  return {kind:"javascript",html:page(title,"<div id=\"yourcode-root\"></div>"+bootstrap)};
 }
 if(/^\s*<!?\s*[A-Za-z][\s\S]*>\s*$/.test(source))return {kind:"markup",html:page(title,source)};
 return universalVisualPreview(source,title);
}
