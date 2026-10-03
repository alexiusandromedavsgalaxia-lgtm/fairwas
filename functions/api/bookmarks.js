export async function onRequestGet({env}){
 if(!env.pages)return Response.json({items:[]});
 const {results}=await env.pages.prepare("SELECT id,url,title,created_at FROM bookmarks ORDER BY id DESC").all();
 return Response.json({items:results});
}
export async function onRequestPost({request,env}){
 const body=await request.json().catch(()=>null);
 if(!body?.url)return Response.json({ok:false,error:"url_required"},{status:400});
 if(!env.pages)return Response.json({ok:true,local:true});
 await env.pages.prepare("INSERT OR IGNORE INTO bookmarks(url,title,created_at) VALUES(?,?,?)").bind(body.url,body.title||body.url,new Date().toISOString()).run();
 return Response.json({ok:true});
}