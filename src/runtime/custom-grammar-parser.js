/**
 * EBNF-driven parser for user-invented languages.
 * Grammar example:
 *   Program   = Statement* ;
 *   Statement = "crear" Identifier "con" Value ;
 *   Value     = Number | String | Identifier ;
 *
 * Supports alternatives, sequences, grouping and ?, * and + repetition.
 * Terminals are quoted strings or regular expressions /.../.
 */
function grammarTokens(input) {
  const out=[]; let i=0,line=1,column=1;
  const advance=s=>{for(const c of s){if(c==="\n"){line++;column=1}else column++}i+=s.length};
  while(i<input.length){
    const c=input[i]; if(/\s/.test(c)){advance(c);continue}
    const pos={line,column};
    if(c==="'"||c==='"'){let value="";advance(c);let closed=false;while(i<input.length){if(input[i]==="\\"){const pair=input.slice(i,i+2);value+=pair.length>1?pair[1]:"";advance(pair);continue}if(input[i]===c){advance(c);closed=true;break}value+=input[i];advance(input[i])}if(!closed)throw Object.assign(new Error("Literal sin cerrar en la gramática"),pos);out.push({type:"literal",value,pos});continue}
    if(c==="/"){advance(c);let value="",closed=false,inClass=false;while(i<input.length){if(input[i]==="\\"){const pair=input.slice(i,i+2);value+=pair;advance(pair);continue}if(input[i]==="[")inClass=true;if(input[i]==="]")inClass=false;if(input[i]==="/"&&!inClass){advance("/");closed=true;break}value+=input[i];advance(input[i])}if(!closed)throw Object.assign(new Error("Expresión regular sin cerrar"),pos);let flags="";while(/[gimsuy]/.test(input[i]||"")){flags+=input[i];advance(input[i])}out.push({type:"regex",value,flags,pos});continue}
    if(/[\p{L}_][\p{L}\p{N}_]*/u.test(c)){let value="";while(i<input.length&&/[\p{L}\p{N}_]/u.test(input[i])){value+=input[i];advance(input[i])}out.push({type:"name",value,pos});continue}
    if("=;|()?*+".includes(c)){out.push({type:c,value:c,pos});advance(c);continue}
    throw Object.assign(new Error("Símbolo no válido en la gramática: "+c),pos);
  }
  out.push({type:"eof",value:"",pos:{line,column}});return out;
}
function compileGrammar(source){
  const tokens=grammarTokens(String(source||""));let i=0;const rules=new Map();
  const peek=()=>tokens[i],take=type=>{if(peek().type!==type)throw Object.assign(new Error("Se esperaba "+type+" y se encontró "+(peek().value||"fin")),peek().pos);return tokens[i++]};
  const expression=()=>{const choices=[sequence()];while(peek().type==="|"){take("|");choices.push(sequence())}return choices.length===1?choices[0]:{type:"choice",items:choices}};
  const sequence=()=>{const items=[];while(!["|",")",";","eof"].includes(peek().type)){let item=atom();if(["?","*","+"].includes(peek().type)){const op=take(peek().type).type;item={type:"repeat",mode:op,item}}items.push(item)}if(!items.length)throw Object.assign(new Error("Alternativa vacía. Define al menos un símbolo."),peek().pos);return items.length===1?items[0]:{type:"sequence",items}};
  const atom=()=>{const t=peek();if(t.type==="name"){take("name");return {type:"ref",name:t.value}}if(t.type==="literal"){take("literal");return {type:"literal",value:t.value}}if(t.type==="regex"){take("regex");return {type:"regex",value:t.value,flags:t.flags}}if(t.type==="("){take("(");const node=expression();take(")");return node}throw Object.assign(new Error("Se esperaba una regla, literal, regex o grupo"),t.pos)};
  while(peek().type!=="eof"){const name=take("name").value;take("=");if(rules.has(name))throw Object.assign(new Error("Regla duplicada: "+name),peek().pos);rules.set(name,expression());take(";")}
  if(!rules.size)throw new Error("La gramática no contiene reglas.");
  for(const [name,node] of rules){const refs=[];const visit=n=>{if(n.type==="ref")refs.push(n.name);if(n.item)visit(n.item);for(const child of n.items||[])visit(child)};visit(node);for(const ref of refs)if(!rules.has(ref)&&!["Identifier","Number","String","Any"].includes(ref))throw new Error("La regla "+name+" utiliza una regla inexistente: "+ref)}
  return {rules,start:rules.keys().next().value};
}
function lexSource(source){
  const tokens=[];let i=0,line=1,column=1;
  const advance=s=>{for(const c of s){if(c==="\n"){line++;column=1}else column++}i+=s.length};
  while(i<source.length){const c=source[i];if(/\s/u.test(c)){advance(c);continue}const pos={line,column},start=i;
    if(c==='"'||c==="'"||c==="\x60"){const q=c;advance(c);let closed=false;while(i<source.length){if(source[i]==="\\"){advance(source.slice(i,Math.min(i+2,source.length)));continue}if(source[i]===q){advance(q);closed=true;break}advance(source[i])}tokens.push({type:"String",value:source.slice(start,i),pos});if(!closed)tokens[tokens.length-1].unclosed=true;continue}
    const word=source.slice(i).match(/^[\p{L}_$@][\p{L}\p{N}_$@!?-]*/u);if(word){advance(word[0]);tokens.push({type:"Identifier",value:word[0],pos});continue}
    const number=source.slice(i).match(/^(?:0[xX][\da-fA-F_]+|\d[\d_]*(?:\.[\d_]+)?)/);if(number){advance(number[0]);tokens.push({type:"Number",value:number[0],pos});continue}
    const op=source.slice(i).match(/^(?:===|!==|=>|->|==|!=|<=|>=|&&|\|\||:=|\+\+|--|\*\*|[^\p{L}\p{N}\s])/u)?.[0]||c;advance(op);tokens.push({type:"Symbol",value:op,pos});
  }return tokens;
}
function parseWithGrammar(source,grammarSource){
  let grammar;try{grammar=compileGrammar(grammarSource)}catch(error){return {status:"grammar-errors",language:"custom",tree:null,problems:[{line:error.line||1,column:error.column||1,message:error.message}],hasError:true,nodeCount:0}}
  const tokens=lexSource(String(source??""));let furthest=0;const memo=new Map();
  const match=(node,index,depth=0)=>{
    if(depth>200)return [];
    furthest=Math.max(furthest,index);
    if(node.type==="literal"){const t=tokens[index];return t&&t.value===node.value?[[{type:"Literal",value:t.value,line:t.pos.line,column:t.pos.column},index+1]]:[]}
    if(node.type==="regex"){const t=tokens[index];if(!t)return[];try{return new RegExp("^(?:"+node.value+")$",node.flags.replace(/[gy]/g,"")).test(t.value)?[[{type:"Pattern",value:t.value,line:t.pos.line,column:t.pos.column},index+1]]:[]}catch{return[]}}
    if(node.type==="ref"){const rule=grammar.rules.get(node.name);if(rule){const key=node.name+":"+index;if(memo.has(key))return memo.get(key);const results=match(rule,index,depth+1).map(([child,next])=>[{type:node.name,children:[child],line:child.line,column:child.column},next]);memo.set(key,results);return results}
      const t=tokens[index];if(!t)return[];const ok=node.name==="Any"||node.name==="Identifier"&&t.type==="Identifier"||node.name==="Number"&&t.type==="Number"||node.name==="String"&&t.type==="String";return ok?[[{type:node.name,value:t.value,line:t.pos.line,column:t.pos.column},index+1]]:[]}
    if(node.type==="choice")return node.items.flatMap(item=>match(item,index,depth+1));
    if(node.type==="sequence"){let states=[{children:[],index}];for(const item of node.items){const next=[];for(const state of states)for(const [child,end] of match(item,state.index,depth+1))next.push({children:[...state.children,child],index:end});states=next;if(!states.length)break}return states.map(s=>[{type:"Sequence",children:s.children},s.index])}
    if(node.type==="repeat"){const min=node.mode==="+"?1:0,max=node.mode==="?"?1:tokens.length+1;let states=[{children:[],index}];for(let count=0;count<max;count++){const next=[];for(const state of states)for(const [child,end] of match(node.item,state.index,depth+1))if(end>state.index)next.push({children:[...state.children,child],index:end});if(!next.length)break;states.push(...next);states=states.slice(-500)}return states.filter(s=>s.children.length>=min).map(s=>[{type:"Repetition",children:s.children},s.index])}
    return[];
  };
  const results=match({type:"ref",name:grammar.start},0);const complete=results.find(([,index])=>index===tokens.length);
  if(complete){const tree=complete[0];const count=n=>1+(n.children||[]).reduce((sum,c)=>sum+count(c),0);return {status:"valid",language:"custom",grammar:grammar.start,tree:JSON.stringify(tree,null,2),problems:[],hasError:false,nodeCount:count(tree)}}
  const pos=tokens[Math.min(furthest,tokens.length-1)]?.pos||{line:1,column:1};return {status:"syntax-errors",language:"custom",grammar:grammar.start,tree:null,problems:[{line:pos.line,column:pos.column,token:tokens[furthest]?.value||"",message:"El código no coincide con la gramática definida. Se esperaba completar la regla "+grammar.start+"."}],hasError:true,nodeCount:0};
}
export { compileGrammar, parseWithGrammar };
