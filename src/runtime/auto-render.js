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
function cssPreview(source){
 const selectors=[...String(source).matchAll(/([^{}]+)\{[^{}]*\}/g)].map(match=>match[1].trim()).filter(s=>s&&!s.startsWith("@")).slice(0,12);
 const samples=selectors.map(selector=>{const tag=selector.startsWith("#")?"section":selector.startsWith(".")?"div":/^(?:h[1-6]|p|button|a|article|header|footer|main|section|nav|span|label|input|img)\b/i.test(selector)?selector.split(/[.#\s:]/)[0]:"div";return "<"+tag+(selector.startsWith("#")?' id="'+escapeHtml(selector.slice(1))+'"':selector.startsWith(".")?' class="'+escapeHtml(selector.slice(1))+'"':"")+">"+escapeHtml(selector)+"</"+tag+">"}).join("");
 return page("Vista previa CSS","<h1>Vista previa de estilos</h1>"+(samples||"<p>El archivo contiene reglas CSS, pero no define selectores de elementos visibles.</p>")+"<style>"+String(source).replace(/<\/style/gi,"<\\/style")+"</style>");
}

/**
 * Detects a file's language from its contents first, then its extension.
 * The extension is a hint only: custom extensions can contain recognised syntax.
 * Unknown grammars are reported instead of being displayed as source code.
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
 if(looksLikeJavaScript(source)||/\.(?:[cm]?js|jsx)$/i.test(path)){
  const executable=rewriteImports(source);
  const safeCode=JSON.stringify(executable).replace(/</g,"\\u003c").replace(/\u2028/g,"\\u2028").replace(/\u2029/g,"\\u2029");
  const isModule=/^\s*(?:import\s|export\s)|\bimport\s*\(/m.test(executable);
  const scriptType=isModule?"module":"text/javascript";
  const bootstrap="<script>(function(){var panel=document.createElement('pre');panel.id='yourcode-runtime-error';panel.style.cssText='display:none;white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;margin:20px 0;border:1px solid #d97757;border-radius:12px;background:#fff0eb;color:#762d1c;font:13px/1.5 ui-monospace,monospace';function report(value){panel.style.display='block';panel.textContent='YourCode no pudo ejecutar este archivo: '+String(value&&value.message||value||'error desconocido');if(!panel.isConnected)document.body.appendChild(panel)}window.addEventListener('error',function(e){report(e.error||e.message)});window.addEventListener('unhandledrejection',function(e){report(e.reason)});var source="+safeCode+";var script=document.createElement('script');script.type="+JSON.stringify(scriptType)+";script.textContent=source;script.onerror=function(e){report('No se pudo cargar un módulo o una dependencia del proyecto.')};document.body.appendChild(script)})();</script>";
  return {kind:"javascript",html:page(title,"<div id=\"yourcode-root\"></div>"+bootstrap)};
 }
 if(/^\s*<!?\s*[A-Za-z][\s\S]*>\s*$/.test(source))return {kind:"markup",html:page(title,source)};
 return {kind:"unsupported",html:null,detail:"Fairwas ha detectado el archivo, pero no reconoce la gramática de su contenido. No se mostrará el código fuente como si fuera una página."};
}
