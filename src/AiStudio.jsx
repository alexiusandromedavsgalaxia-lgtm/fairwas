import React,{useState}from"react";
import "./AiStudio.css";
const models=[["llama-3.3-70b-versatile","Llama 3.3 · Quality"],["openai/gpt-oss-120b","GPT OSS 120B · Advanced"],["llama-3.1-8b-instant","Llama 3.1 · Fast"]];
const starter="Create a modern website for a creative studio. Use a bold editorial layout, a dark background, electric violet accents, a striking hero section, services, selected projects, testimonials and a contact section.";
export default function AiStudio(){
 const[prompt,setPrompt]=useState("");
 const[model,setModel]=useState(models[0][0]);
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState("");
 const[result,setResult]=useState(null);
 const[tab,setTab]=useState("preview");
 async function generate(){
  if(!prompt.trim())return;
  setBusy(true);setError("");setResult(null);
  try{
   const response=await fetch("/api/ai-studio",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({prompt:prompt.trim(),model})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok||!data.ok)throw new Error(data.detail||data.error||"Could not generate the page.");
   setResult(data);setTab("preview");
  }catch(e){setError(e.message||"Something went wrong.");}
  finally{setBusy(false)}
 }
 function download(){if(!result)return;const blob=new Blob([result.html],{type:"text/html;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=(result.title||"fairwas-page").toLowerCase().replace(/[^a-z0-9]+/g,"-")+".html";a.click();URL.revokeObjectURL(url)}
 async function copy(){if(result)try{await navigator.clipboard.writeText(result.html)}catch{setError("Clipboard access is unavailable in this browser.")}}
 return <main className="ais-shell">
  <header className="ais-top"><a className="ais-brand" href="httc://home"><span>F</span> Fairwas <i>AI STUDIO</i></a><div className="ais-topnote"><span></span> GROQ POWERED</div></header>
  <section className="ais-hero"><div className="ais-kicker">YOUR IDEA, BUILT BY AI</div><h1>From a thought<br/>to a <em>whole website.</em></h1><p>Describe what you want. Fairwas AI Studio designs and builds the page for you.</p></section>
  <section className="ais-workspace">
   <div className="ais-prompt"><label htmlFor="ais-prompt">What should we create?</label><textarea id="ais-prompt" value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder={starter} maxLength={12000}/><div className="ais-controls"><label>AI model<select value={model} onChange={e=>setModel(e.target.value)}>{models.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button disabled={busy||!prompt.trim()} onClick={generate}>{busy?<><span className="ais-spinner"/> Building…</>:<>✦ Generate page</>}</button></div>{error&&<div className="ais-error">{error}</div>}</div>
   <div className="ais-output"><div className="ais-output-head"><div><span className="ais-live-dot"/>{result?"YOUR GENERATED PAGE":"LIVE WORKSPACE"}</div>{result&&<div className="ais-actions"><button onClick={copy}>Copy HTML</button><button onClick={download}>Download .html</button></div>}</div>
    {result?<><div className="ais-result-title"><strong>{result.title}</strong><span>{result.model}</span></div><div className="ais-tabs"><button className={tab==="preview"?"active":""} onClick={()=>setTab("preview")}>Preview</button><button className={tab==="code"?"active":""} onClick={()=>setTab("code")}>HTML code</button></div>{tab==="preview"?<iframe className="ais-preview" title="Generated website preview" sandbox="allow-scripts allow-forms" srcDoc={result.html}/>:<pre className="ais-code">{result.html}</pre>}</>:<div className="ais-empty"><div className="ais-empty-icon">✳</div><strong>Your next website starts here.</strong><p>Write a brief on the left and let the AI turn it into a complete, responsive page.</p><button onClick={()=>setPrompt(starter)}>Try an example brief ↗</button></div>}
   </div>
  </section>
  <footer className="ais-footer"><span>FAIRWAS AI STUDIO</span><span>Imagine it. Build it.</span></footer>
 </main>
}