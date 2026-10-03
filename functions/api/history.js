export async function onRequestGet({env}){
 if(!env.pages)return Response.json({items:[]});
 const {results}=await env.pages.prepare("SELECT id,url,protocol,visited_at FROM visits ORDER BY id DESC LIMIT 100").all();
 return Response.json({items:results});
}