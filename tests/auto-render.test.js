import test from "node:test";
import assert from "node:assert/strict";
import { autoRenderFile } from "../src/runtime/auto-render.js";

test("YourCode detects HTML inside a custom extension", () => {
  const result=autoRenderFile({path:"/home.ez",content:"<main><h1>Hola</h1></main>"});
  assert.equal(result.kind,"html");
  assert.ok(result.html.includes("<h1>Hola</h1>"));
});

test("YourCode renders Markdown and JSON data instead of showing source", () => {
  const markdown=autoRenderFile({path:"/readme.custom",content:"# Hello\nA **page**"});
  assert.equal(markdown.kind,"markdown");
  assert.ok(markdown.html.includes("<h1>Hello</h1>"));
  const json=autoRenderFile({path:"/data.any",content:'{"name":"Fairwas"}'});
  assert.equal(json.kind,"json");
  assert.ok(markdown.html.includes("page"));
  assert.ok(json.html.includes("Fairwas"));
});

test("unknown invented syntax is not faked by keyword matching or token cards", () => {
  const result=autoRenderFile({path:"/page.xyz",content:"MAKE WINDOW WITH BLUE SKY"});
  assert.equal(result.kind,"universal");
  assert.ok(result.html.includes("preview-required"));
  assert.ok(!result.html.includes("yc-window"));
  assert.ok(!result.html.includes("visual-block"));
  assert.ok(!result.html.includes("MAKE WINDOW WITH BLUE SKY"));
});

test("common non-browser languages are rendered as visual structures without execution", () => {
  for (const [path,language] of [["/app.py","Python"],["/main.rs","Rust"],["/query.sql","SQL"],["/Main.java","Java"],["/app.ts","TypeScript"],["/script.sh","Shell"]]) {
    const result=autoRenderFile({path,content:"print(42)"});
    assert.equal(result.kind,"universal");
    assert.equal(result.language,"Código");
    assert.equal(result.executable,false);
    assert.ok(result.html.includes("preview-required"));
    assert.ok(!result.html.includes("print(42)"));
  }
});

test("valid JavaScript files use the browser runtime", () => {
  const classic=autoRenderFile({path:"/logic.js",content:"const node = document.createElement('h1'); node.textContent = 'Hello'; document.body.append(node);"});
  assert.equal(classic.kind,"javascript");
  assert.ok(classic.html.includes('"text/javascript"'));
  const module=autoRenderFile({path:"/logic.mjs",content:"export const answer = 42;"});
  assert.equal(module.kind,"javascript");
  assert.ok(module.html.includes('"module"'));
});

test("invalid JavaScript syntax gets visual rendering instead of a raw code page", () => {
  const source="const app = () => { document.body.textContent = 'ready' } THIS_IS_NOT_JS";
  const result=autoRenderFile({path:"/logic.js",content:source});
  assert.equal(result.kind,"universal");
  assert.equal(result.executable,false);
  assert.ok(result.html.includes("preview-required"));
  assert.ok(!result.html.includes("Vista de código"));
  assert.ok(!result.html.includes("document.body"));
});

test("JavaScript-like syntax in arbitrary extensions is rendered visually and never auto-executed", () => {
  const source="const app = () => { document.body.textContent = 'ready'; }; app();";
  const result=autoRenderFile({path:"/logic.ax",content:source});
  assert.equal(result.kind,"universal");
  assert.equal(result.executable,false);
  assert.ok(result.html.includes("visual-block"));
  assert.ok(!result.html.includes("document.body"));
});


test("JavaScript console output is visible in the rendered page", () => {
  const result=autoRenderFile({path:"/main.js",content:'console.log("Hola mundo");'});
  assert.equal(result.kind,"javascript");
  assert.ok(result.html.includes("yourcode-runtime-output"));
  assert.ok(result.html.includes("showOutput"));
});

test("invented-language snippets require the semantic local interpreter instead of token cards", () => {
  for (const source of ["Hola","print(1 + 1)","CREATE A BLUE WINDOW"]) {
    const result=autoRenderFile({path:"/main.your",content:source});
    assert.equal(result.kind,"universal");
    assert.ok(result.html.includes("preview-required"));
    assert.ok(!result.html.includes("visual-block"));
  }
});
