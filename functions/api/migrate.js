const MAX_FILES=300;
const MAX_BYTES=15*1024*1024;
const STATIC_EXT=/\.(html?|css|js|mjs|json|svg|xml|txt|webmanifest|png|jpe?g|gif|webp|avif|ico|bmp|woff2?|ttf|otf|eot|mp3|wav|ogg|mp4|webm|wasm|map)$/i;
const textType=/^(text\/|application\/(json|javascript|xml|svg\+xml|manifest\+json))/i;
function cleanPath(path){
 let p=String(path||"/").replace(/\\/g,"/");
 if(!p.startsWith("/"))p="/"+p;
 p=p.replace(/\/+/g,"/");
 return p;
}
function binaryBase64(bytes){
 let out="";
 for(let i=0;i<bytes.length;i+=0x8000)out+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
 return btoa(out);
}
function assetUrls(html,base){
 const out=new Set();
 const source=String(html||"");
 const re=/(?:href|src|poster|data-src)\\s*=\\s*["']([^"']+)["']/gi;
 for(const m of source.matchAll(re)){
  const raw=m[1].trim();
  if(!raw||raw.startsWith("#")||/^(?:data:|javascript:|mailto:|tel:)/i.test(raw))continue;
  try{const u=new URL(raw,base);if(u.protocol==="http:"||u.protocol==="https:")out.add(u.href)}catch{}
 }
 const cssRe=/url\\(\\s*["']?([^"')]+)["']?\\s*\\)/gi;
 for(const m of source.matchAll(cssRe)){
  try{const u=new URL(m[1].trim(),base);if(u.protocol==="http:"||u.protocol==="https:")out.add(u.href)}catch{}
 }
 return [...out];
}
function sameOrigin(u,root){return u.protocol===root.protocol&&u.hostname===root.hostname&&u.port===root.port}
export async function onRequestPost({request}){
 let body;try{body=await request.json()}catch{return Response.json({ok:false,error:"invalid_json"},{status:400})}
 let root;try{root=new URL(String(body.url||""))}catch{return Response.json({ok:false,error:"invalid_url"},{status:400})}
 if(!/^https?:$/.test(root.protocol))return Response.json({ok:false,error:"only_http_https_sources_allowed"},{status:400});
 root.hash="";
 const queue=[root.href],seen=new Set(),files=[],total={bytes:0};
 while(queue.length&&files.length<MAX_FILES&&total.bytes<MAX_BYTES){
  const href=queue.shift();
  if(seen.has(href))continue;
  seen.add(href);
  let u;try{u=new URL(href)}catch{continue}
  if(!sameOrigin(u,root))continue;
  let response;try{response=await fetch(u.href,{redirect:"follow",headers:{"user-agent":"Fairwas-Static-Migrator/1.0"}})}catch{continue}
  if(!response.ok)continue;
  const finalUrl=new URL(response.url||u.href);
  if(!sameOrigin(finalUrl,root))continue;
  const type=(response.headers.get("content-type")||"application/octet-stream").split(";")[0].toLowerCase();
  const path=cleanPath(finalUrl.pathname==="/"?"/index.html":finalUrl.pathname);
  if(!STATIC_EXT.test(path)&&!typeText(type))continue;
  let content,encoding=null,size=0;
  if(textType.test(type)){
   content=await response.text();size=new TextEncoder().encode(content).byteLength;
  }else{
   const bytes=new Uint8Array(await response.arrayBuffer());size=bytes.byteLength;content=binaryBase64(bytes);encoding="base64";
  }
  if(total.bytes+size>MAX_BYTES)break;
  total.bytes+=size;
  files.push({path,content,content_type:type||"application/octet-stream",encoding});
  if(type==="text/html"||type==="application/xhtml+xml"){
   for(const next of assetUrls(content,finalUrl.href)){
    const nu=new URL(next);
    if(sameOrigin(nu,root)&&!seen.has(nu.href)&&queue.length<MAX_FILES*3)queue.push(nu.href);
   }
  }else if(type==="text/css"){
   for(const next of assetUrls(content,finalUrl.href)){
    const nu=new URL(next);
    if(sameOrigin(nu,root)&&!seen.has(nu.href)&&queue.length<MAX_FILES*3)queue.push(nu.href);
   }
  }
 }
 const index=files.find(f=>f.path==="/index.html");
 return Response.json({ok:true,source:root.href,title:root.hostname,hostname:root.hostname.toLowerCase().replace(/[^a-z0-9-]/g,"-")+".fair",files,index:!!index,static:true,limits:{max_files:MAX_FILES,max_bytes:MAX_BYTES}});
}
function typeText(type){return textType.test(type)||type==="application/xhtml+xml"}
