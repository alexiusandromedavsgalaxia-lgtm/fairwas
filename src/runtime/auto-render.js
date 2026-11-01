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
function codePreview(source,path,title){
 const language=languageFor(path,source);
 return page(title,'<section style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px"><h1 style="margin:0">Vista de código</h1><span style="padding:5px 10px;border-radius:999px;background:#e5e7eb;color:#20232b;font:600 12px system-ui">'+escapeHtml(language)+'</span></section><p style="color:#667085">Archivo reconocido. Se conserva el contenido original. No se ha supuesto una gramática ni un intérprete para este archivo.</p><pre style="padding:18px;border-radius:12px;background:#111827;color:#e5e7eb;overflow:auto;tab-size:2"><code>'+escapeHtml(source)+'</code></pre>');
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
  const bootstrap="<script>(function(){var panel=document.createElement('pre');panel.id='yourcode-runtime-error';panel.style.cssText='display:none;white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;margin:20px 0;border:1px solid #d97757;border-radius:12px;background:#fff0eb;color:#762d1c;font:13px/1.5 ui-monospace,monospace';function report(value){panel.style.display='block';var message=value&&value.message||value||'error desconocido';var syntax=value instanceof SyntaxError||value&&value.name==='SyntaxError';panel.textContent=syntax?'YourCode no ha podido interpretar la sintaxis de este archivo. Revisa el lenguaje y la compatibilidad del código.':'YourCode no pudo ejecutar este archivo: '+String(message).replace(/expected\s+(?:token|expression|identifier|\'[^\']+\')/ig,'sintaxis no reconocida').replace(/unexpected\s+token/ig,'elemento no reconocido');if(!panel.isConnected)document.body.appendChild(panel)}window.addEventListener('error',function(e){report(e.error||e.message)});window.addEventListener('unhandledrejection',function(e){report(e.reason)});var source="+safeCode+";var script=document.createElement('script');script.type="+JSON.stringify(scriptType)+";script.textContent=source;script.onerror=function(e){report('No se pudo cargar un módulo o una dependencia del proyecto.')};document.body.appendChild(script)})();</script>";
  return {kind:"javascript",html:page(title,"<div id=\"yourcode-root\"></div>"+bootstrap)};
 }
 if(/^\s*<!?\s*[A-Za-z][\s\S]*>\s*$/.test(source))return {kind:"markup",html:page(title,source)};
 return {kind:"code",html:codePreview(source,path,title),language:languageFor(path,source),executable:false,detail:"El archivo se ha reconocido como código y se muestra en una vista segura. Para ejecutarlo hace falta un runtime compatible con su lenguaje."};
}
