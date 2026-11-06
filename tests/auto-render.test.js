import test from "node:test";
import assert from "node:assert/strict";
import { autoRenderFile } from "../src/runtime/auto-render.js";

test("YourCode detects HTML inside a custom extension", () => {
  const result=autoRenderFile({path:"/home.ez",content:"<main><h1>Hola</h1></main>"});
  assert.equal(result.kind,"html");
  assert.match(result.html,/<h1>Hola<\/h1>/);
});

test("YourCode does not guess JavaScript from code in an unknown extension", () => {
  const source="document.body.innerHTML = '<h1>Rendered</h1>'";
  const result=autoRenderFile({path:"/logic.faircode",content:source});
  assert.equal(result.kind,"code");
  assert.equal(result.executable,false);
  assert.match(result.html,/document\.body/);
  assert.match(result.html,/No se ha supuesto una gramática/);
});

test("YourCode renders Markdown and JSON data instead of showing source", () => {
  const markdown=autoRenderFile({path:"/readme.custom",content:"# Hello\nA **page**"});
  assert.equal(markdown.kind,"markdown");
  assert.match(markdown.html,/<h1>Hello<\/h1>/);
  const json=autoRenderFile({path:"/data.any",content:'{"name":"Fairwas"}'});
  assert.equal(json.kind,"json");
  assert.match(json.html,/Fairwas/);
});

test("unknown custom grammars render visual blocks instead of a source-code page", () => {
  const result=autoRenderFile({path:"/page.xyz",content:"MAKE WINDOW WITH BLUE SKY"});
  assert.equal(result.kind,"universal");
  assert.equal(result.language,"Código");
  assert.match(result.html,/MAKE/);
  assert.match(result.html,/WINDOW/);
  assert.match(result.html,/visual-block/);
  assert.doesNotMatch(result.html,/Vista de código/);
  assert.doesNotMatch(result.html,/<pre[^>]*><code>/);
});

test("YourCode recognises common non-browser languages by extension without trying to execute them", () => {
  for (const [path,language] of [["/app.py","Python"],["/main.rs","Rust"],["/query.sql","SQL"],["/Main.java","Java"],["/app.ts","TypeScript"],["/script.sh","Shell"]]) {
    const result=autoRenderFile({path,content:"print(42)"});
    assert.equal(result.kind,"code");
    assert.equal(result.language,language);
    assert.match(result.html,/print\(42\)/);
  }
});

test("valid JavaScript files use the browser runtime", () => {
  const classic=autoRenderFile({path:"/logic.js",content:"const node = document.createElement('h1'); node.textContent = 'Hello'; document.body.append(node);"});
  assert.equal(classic.kind,"javascript");
  assert.match(classic.html,/"text\/javascript"/);
  const module=autoRenderFile({path:"/logic.mjs",content:"export const answer = 42;"});
  assert.equal(module.kind,"javascript");
  assert.match(module.html,/"module"/);
});

test("invalid JavaScript syntax gets a visual structure instead of a raw code page", () => {
  const source="const app = () => { document.body.textContent = 'ready' } THIS_IS_NOT_JS";
  const result=autoRenderFile({path:"/logic.js",content:source});
  assert.equal(result.kind,"universal");
  assert.equal(result.executable,false);
  assert.match(result.html,/visual-block/);
  assert.doesNotMatch(result.html,/Vista de código/);
  assert.doesNotMatch(result.html,/document\\.body/);
});

test("JavaScript-like syntax in arbitrary extensions is not automatically executed", () => {
  const source="const app = () => { document.body.textContent = 'ready'; }; app();";
  const result=autoRenderFile({path:"/logic.ax",content:source});
  assert.equal(result.kind,"code");
  assert.equal(result.executable,false);
  assert.match(result.html,/document\.body/);
});
