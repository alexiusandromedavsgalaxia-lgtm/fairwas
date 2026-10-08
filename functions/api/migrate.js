const MAX_FILES=300;
const MAX_BYTES=15*1024*1024;
const TEXT=/^(?:text\/|application\/(?:json|javascript|x-javascript|xml|svg\+xml|manifest\+json))/i;
const STATIC_EXT=/\.(?:html?|css|js|mjs|cjs|json|svg|xml|txt|webmanifest|png|jpe?g|gif|webp|avif|ico|bmp|woff2?|ttf|otf|eot|mp3|m4a|aac|flac|mid|midi|wav|ogg|mp4|m4v|mov|3gp|webm|pdf|csv|wasm|map)$/i;
export function cleanPath(path){let p=String(path||"/").split("?")[0].split("#")[0].replace(/\\/g,"/");if(!p.startsWith("/"))p="/"+p;p=p.replace(/\/+/g,"/");return p==="/"?"/index.html":p}
function sameOrigin(a,b){return a.protocol===b.protocol&&a.hostname===b.hostname&&a.port===b.port}
export function unsafeHost(host){
 const h=String(host||"").toLowerCase().replace(/^\[|\]$/g,"");
 if(h==="localhost"||h.endsWith(".localhost")||h.endsWith(".local")||h.endsWith(".internal"))return true;
 if(h.includes(":")){
  // Block IPv6 loopback, unspecified, link-local, unique-local and mapped private IPv4.
  if(h==="::"||h==="::1"||/^fe[89ab]/.test(h)||/^f[cd]/.test(h))return true;
  const mapped=h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if(mapped)return unsafeHost(mapped[1]);
  return false;
 }
 const p=h.split(".");
 if(p.length!==4||!p.every(part=>/^\d{1,3}$/.test(part)&&Number(part)<=255))return false;
 const [a,b]=p.map(Number);
 return a===10||a===127||a===0||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)||(a===192&&b===0)||(a===198&&(b===18||b===19))||a>=224;
}
export async function readLimited(response,limit){
 const reader=response.body?.getReader();
 if(!reader)return new Uint8Array();
 const chunks=[];let size=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>limit){await reader.cancel();return null}
   chunks.push(value);
  }
 }catch{try{await reader.cancel()}catch{};return null}
 const output=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.byteLength}
 return output;
}
function b64(bytes){let s="";for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s)}
function isText(type,path){return TEXT.test(type)||/\.(?:html?|css|js|mjs|cjs|json|svg|xml|txt|webmanifest|map)$/i.test(path)}
export function refs(source,base){
 const found=new Set(),text=String(source||"");
 const add=(raw)=>{const value=String(raw||"").trim().replace(/^["']|["']$/g,"");if(!value||value.startsWith("#")||/^(?:data:|javascript:|mailto:|tel:|blob:|https?:\/\/[^/]*$)/i.test(value))return;try{const u=new URL(value,base);if(/^https?:$/.test(u.protocol))found.add(u.href)}catch{}};
 const attrs=/(?:href|src|poster|data-src|action|xlink:href|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
 for(const m of text.matchAll(attrs)){const value=m[1]??m[2]??m[3]??"";if(/srcset/i.test(m[0].slice(0,m[0].indexOf("=")))){for(const candidate of value.split(","))add(candidate.trim().split(/\s+/)[0])}else add(value)}
 const css=/url\(\s*["']?([^"')]+)["']?\s*\)|@import\s+(?:url\()?\s*["']([^"')\s;]+)["']?/gi;
 for(const m of text.matchAll(css))add(m[1]||m[2]);
 const modules=/(?:\bimport\s*(?:[^'"]*?\sfrom\s*)?|\bexport\s+[^'"]*?\sfrom\s*|\bimport\s*\()\s*["']([^"']+)["']/g;
 for(const m of text.matchAll(modules))add(m[1]);
 return [...found];
}
export function localize(source,base,map){
 const local=(raw)=>{try{const u=new URL(raw,base);if(!/^https?:$/.test(u.protocol)||u.hostname!==base.hostname||u.port!==base.port)return null;return map.get(cleanPath(u.pathname))||null}catch{return null}};
 let output=String(source||"");
 output=output.replace(/((?:href|src|poster|data-src|action|xlink:href)\s*=\s*["'])([^"']+)(["'])/gi,(all,prefix,raw,suffix)=>{const path=local(raw);if(!path)return all;try{const u=new URL(raw,base);return prefix+path+(u.search||"")+(u.hash||"")+suffix}catch{return all}});
 output=output.replace(/(srcset\s*=\s*["'])([^"']+)(["'])/gi,(all,prefix,value,suffix)=>{const rewritten=value.split(",").map(candidate=>{const parts=candidate.trim().split(/\s+/);const path=local(parts[0]);if(path){try{const u=new URL(parts[0],base);parts[0]=path+(u.search||"")+(u.hash||"")}catch{}}return parts.join(" ")}).join(", ");return prefix+rewritten+suffix});
 output=output.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi,(all,q,raw)=>{const path=local(raw.trim());if(!path)return all;try{const u=new URL(raw.trim(),base);return "url("+q+path+(u.search||"")+(u.hash||"")+q+")"}catch{return all}});
 output=output.replace(/(@import\s+(?:url\(\s*)?)(["'])([^"']+)\2(\s*\)?)/gi,(all,prefix,q,raw,suffix)=>{const path=local(raw);if(!path)return all;try{const u=new URL(raw,base);return prefix+q+path+(u.search||"")+(u.hash||"")+q+suffix}catch{return all}});
 output=output.replace(/((?:\bimport\s*(?:[^'"]*?\sfrom\s*)?|\bexport\s+[^'"]*?\sfrom\s*|\bimport\s*\()\s*)(["'])([^"']+)\2/g,(all,prefix,q,raw)=>{const path=local(raw);if(!path)return all;try{const u=new URL(raw,base);return prefix+q+path+(u.search||"")+(u.hash||"")+q}catch{return all}});
 return output;
}
export async function onRequestPost({request}){let body;try{body=await request.json()}catch{return Response.json({ok:false,error:"invalid_json"},{status:400})}let root;try{root=new URL(String(body.url||""))}catch{return Response.json({ok:false,error:"invalid_url"},{status:400})}if(!/^https?:$/.test(root.protocol))return Response.json({ok:false,error:"only_http_https_sources_allowed"},{status:400});if(unsafeHost(root.hostname))return Response.json({ok:false,error:"unsafe_source_host"},{status:400});root.hash="";root.search="";const queue=[root.href],seen=new Set(),files=[],total={bytes:0};while(queue.length&&files.length<MAX_FILES&&total.bytes<MAX_BYTES){const href=queue.shift();if(seen.has(href))continue;seen.add(href);let u;try{u=new URL(href)}catch{continue}if(!sameOrigin(u,root)||unsafeHost(u.hostname))continue;let response;try{response=await fetch(u.href,{redirect:"manual",headers:{"user-agent":"Fairwas-Static-Migrator/2.0"}})}catch{continue}if(response.status>=300&&response.status<400){const loc=response.headers.get("location");if(loc)try{const next=new URL(loc,u);if(sameOrigin(next,root))queue.push(next.href)}catch{}continue}if(!response.ok)continue;const finalUrl=new URL(response.url||u.href);if(!sameOrigin(finalUrl,root))continue;const type=(response.headers.get("content-type")||"application/octet-stream").split(";")[0].toLowerCase();const path=cleanPath(finalUrl.pathname);if(!STATIC_EXT.test(path)&&!isText(type,path))continue;let content,encoding=null;const bytes=await readLimited(response,MAX_BYTES-total.bytes);if(!bytes)continue;if(isText(type,path)){content=new TextDecoder().decode(bytes)}else{content=b64(bytes);encoding="base64"}const size=bytes.byteLength;if(total.bytes+size>MAX_BYTES)break;total.bytes+=size;files.push({path,content,content_type:type,encoding});if(type==="text/html"||type==="application/xhtml+xml"||type==="text/css"||type==="text/javascript"||type==="application/javascript"||type==="application/ecmascript"||type==="text/ecmascript"||type==="application/x-javascript"||type==="text/x-javascript")for(const next of refs(content,finalUrl.href)){const nu=new URL(next);if(sameOrigin(nu,root)&&!seen.has(nu.href)&&queue.length<MAX_FILES)queue.push(nu.href)}}const map=new Map(files.map(f=>[f.path,f.path]));for(const file of files)if(file.encoding!=="base64")file.content=localize(file.content,new URL("https://"+root.host+file.path),map);if(!files.some(f=>f.path==="/index.html"))return Response.json({ok:false,error:"no_index_html",files_found:files.length},{status:422});return Response.json({ok:true,source:root.href,title:root.hostname,hostname:root.hostname.toLowerCase().replace(/[^a-z0-9-]/g,"-")+".fair",files,index:true,static:true,limits:{max_files:MAX_FILES,max_bytes:MAX_BYTES}})}