const TOKEN = /\s*(?:(\d+(?:\.\d+)?)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|([\p{L}_$][\p{L}\p{N}_$]*)|(==|!=|<=|>=|&&|\|\||[+*/%<>=!(),{}-]))/uy;
class Lexer {
  constructor(source) { this.source=String(source||""); this.offset=0; this.tokens=[]; this.scan(); this.index=0; }
  scan() {
    while(this.offset<this.source.length) {
      TOKEN.lastIndex=this.offset; const m=TOKEN.exec(this.source);
      if(!m) { if(/^\s+$/.test(this.source.slice(this.offset))) { this.offset=this.source.length; break; } throw new Error("Carácter no reconocido en posición "+(this.offset+1)+": "+this.source[this.offset]); }
      this.offset=TOKEN.lastIndex;
      if(m[1]) this.tokens.push({type:"number",value:Number(m[1])});
      else if(m[2]) this.tokens.push({type:"string",value:m[2].slice(1,-1).replace(/\\(["'\\nrt])/g,(_,c)=>({"n":"\n","r":"\r","t":"\t"}[c]||c))});
      else if(m[3]) this.tokens.push({type:"word",value:m[3]});
      else if(m[4]) this.tokens.push({type:"symbol",value:m[4]});
    }
    this.tokens.push({type:"eof",value:"<fin>"});
  }
  peek(){return this.tokens[this.index];}
  take(value){const t=this.peek();if(value!==undefined&&t.value!==value)return null;this.index++;return t;}
  expect(value){const t=this.take(value);if(!t)throw new Error("Se esperaba «"+value+"» y se encontró «"+this.peek().value+"».");return t;}
}
const PRECEDENCE={"||":1,"&&":2,"==":3,"!=":3,"<":4,">":4,"<=":4,">=":4,"+":5,"-":5,"*":6,"/":6,"%":6};
function expression(p,min=0){
  let t=p.take(),left;
  if(t.value==="!"||t.value==="-")left={type:"Unary",op:t.value,value:expression(p,7)};
  else if(t.value==="("){left=expression(p);p.expect(")");}
  else if(t.type==="number"||t.type==="string")left={type:"Literal",value:t.value};
  else if(t.type==="word")left={type:"Name",name:t.value};
  else throw new Error("Expresión incompleta cerca de «"+t.value+"».");
  while(true){const op=p.peek().value,prec=PRECEDENCE[op]||0;if(prec<min||!prec)break;p.take();left={type:"Binary",op,left,right:expression(p,prec+1)};}
  return left;
}
function block(p){p.expect("{");const body=[];while(p.peek().value!=="}"&&p.peek().type!=="eof")body.push(statement(p));p.expect("}");return body;}
function statement(p){
  const t=p.take();if(t.type!=="word")throw new Error("Se esperaba una instrucción, no «"+t.value+"».");
  if(t.value==="let"||t.value==="var"){const name=p.take();if(name.type!=="word")throw new Error("Nombre de variable no válido.");p.expect("=");return{type:"Let",name:name.value,value:expression(p)};}
  if(["print","show","heading","text","button","html","title","background","color"].includes(t.value))return{type:t.value[0].toUpperCase()+t.value.slice(1),value:expression(p)};
  if(t.value==="if"){const test=expression(p),yes=block(p);let no=[];if(p.peek().value==="else"){p.take();no=block(p);}return{type:"If",test,yes,no};}
  if(t.value==="repeat"){const count=expression(p);return{type:"Repeat",count,body:block(p)};}
  throw new Error("Instrucción desconocida: «"+t.value+"».");
}
function evaluate(node,env){
  if(node.type==="Literal")return node.value;
  if(node.type==="Name"){if(node.name==="true")return true;if(node.name==="false")return false;if(node.name==="null")return null;if(!(node.name in env))throw new Error("La variable «"+node.name+"» no existe.");return env[node.name];}
  if(node.type==="Unary"){const v=evaluate(node.value,env);return node.op==="!"?!v:-Number(v);}
  const a=evaluate(node.left,env),b=evaluate(node.right,env);
  switch(node.op){case"+":return typeof a==="string"||typeof b==="string"?String(a)+String(b):Number(a)+Number(b);case"-":return Number(a)-Number(b);case"*":return Number(a)*Number(b);case"/":if(Number(b)===0)throw new Error("División entre cero.");return Number(a)/Number(b);case"%":return Number(a)%Number(b);case"==":return a===b;case"!=":return a!==b;case"<":return a<b;case">":return a>b;case"<=":return a<=b;case">=":return a>=b;case"&&":return a&&b;case"||":return a||b;default:throw new Error("Operador no admitido: "+node.op);}
}
export function parseYourCode(source){const p=new Lexer(source),body=[];while(p.peek().type!=="eof")body.push(statement(p));return{type:"Program",body};}
export function runYourCode(source){
  const ast=parseYourCode(source),env=Object.create(null),output=[],markup=[];
  const esc=value=>String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const emit=(type,value)=>{const v=String(value??"");if(type==="Print")output.push(v);else if(type==="Heading")markup.push("<h1>"+esc(v)+"</h1>");else if(type==="Text")markup.push("<p>"+esc(v)+"</p>");else if(type==="Button")markup.push("<button type=\"button\">"+esc(v)+"</button>");else if(type==="Html")markup.push(v);else if(type==="Title")markup.push("<h2>"+esc(v)+"</h2>");else if(type==="Background")markup.push("<style>body{background:"+esc(v)+"}</style>");else if(type==="Color")markup.push("<style>body{color:"+esc(v)+"}</style>");};
  let steps=0;
  const execute=body=>{for(const node of body){if(++steps>10000)throw new Error("Límite de ejecución alcanzado (10.000 instrucciones).");if(node.type==="Let")env[node.name]=evaluate(node.value,env);else if(node.type==="If")execute(evaluate(node.test,env)?node.yes:node.no);else if(node.type==="Repeat"){const n=Number(evaluate(node.count,env));if(!Number.isInteger(n)||n<0||n>1000)throw new Error("repeat necesita un número entero entre 0 y 1000.");for(let i=0;i<n;i++)execute(node.body);}else emit(node.type,evaluate(node.value,env));}};
  execute(ast.body);
  const html='<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>YourCode</title><style>body{font:16px system-ui;margin:0;padding:28px;background:#101318;color:#f4f6fa}main{max-width:850px;margin:auto}h1{font-size:clamp(30px,6vw,56px)}p{line-height:1.7;color:#c2c9d4}button{padding:11px 17px;border:0;border-radius:9px;background:#a9ef70;color:#15200e;font-weight:700}</style><main>'+markup.join("\n")+'</main></html>';
  return{ast,output,html,variables:{...env},steps};
}
