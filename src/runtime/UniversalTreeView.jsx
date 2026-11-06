import React from "react";

const COLORS = { Document:"#a8e66b", Statement:"#7db7ff", Group:"#c69cff", Identifier:"#e6d28a", Number:"#85d6c5", String:"#e8a6bc", Operator:"#e7a56f" };
function NodeRow({ node, depth = 0 }) {
  const children = Array.isArray(node.children) ? node.children : [];
  const label = node.value !== undefined ? String(node.value) : node.delimiter || node.type || "Nodo";
  const color = COLORS[node.type] || "#b5becb";
  const position = node.start ? "L" + node.start.row + ":C" + node.start.column : "";
  return <div style={{marginLeft:depth?13:0,borderLeft:depth?"1px solid #ffffff18":0,paddingLeft:depth?9:0}}>
    <div style={{display:"flex",alignItems:"baseline",gap:7,minWidth:0,padding:"3px 0",font:"12px/1.5 ui-monospace,monospace"}}>
      <span style={{color:"#778292"}}>{children.length?"▾":"·"}</span>
      <b style={{color,flex:"0 0 auto"}}>{node.type||"Node"}</b>
      <span title={label} style={{color:"#e0e5ec",overflowWrap:"anywhere",minWidth:0}}>{label}</span>
      <span style={{color:"#727d8c",fontSize:10,marginLeft:"auto",flex:"0 0 auto"}}>{position}</span>
    </div>
    {children.map((child,index)=><NodeRow key={child.start?child.start.row+":"+child.start.column+":"+child.type:index} node={child} depth={depth+1}/>)}
  </div>;
}
export default function UniversalTreeView({result}) {
  let tree=result?.treeData||null;
  if(!tree&&result?.tree){try{tree=JSON.parse(result.tree)}catch{tree=null}}
  if(!tree)return null;
  return <section style={{marginTop:12,border:"1px solid #ffffff18",borderRadius:10,overflow:"hidden",background:"#0b0e12"}}>
    <div style={{padding:"10px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,borderBottom:"1px solid #ffffff14",flexWrap:"wrap"}}>
      <b style={{color:"#e6ebf1",fontSize:12}}>Representación estructural</b>
      <span style={{color:"#9aa5b4",fontSize:10}}>{result.nodeCount||0} nodos · {result.stats?.statements||0} bloques · {result.stats?.tokens||0} tokens</span>
    </div>
    <div style={{padding:"9px 12px",maxHeight:440,overflow:"auto"}}><NodeRow node={tree}/></div>
  </section>;
}
