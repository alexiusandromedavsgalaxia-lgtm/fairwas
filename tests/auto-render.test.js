import test from "node:test";
import assert from "node:assert/strict";
import { autoRenderFile } from "../src/runtime/auto-render.js";

test("YourCode detects HTML inside a custom extension", () => {
  const result=autoRenderFile({path:"/home.ez",content:"<main><h1>Hola</h1></main>"});
  assert.equal(result.kind,"html");
  assert.match(result.html,/<h1>Hola<\/h1>/);
});

test("YourCode renders JavaScript from a custom extension as an executable page", () => {
  const result=autoRenderFile({path:"/logic.faircode",content:"document.body.innerHTML = '<h1>Rendered</h1>'"});
  assert.equal(result.kind,"javascript");
  assert.match(result.html,/type="module"/);
  assert.match(result.html,/Rendered/);
});

test("YourCode renders Markdown and JSON data instead of showing source", () => {
  const markdown=autoRenderFile({path:"/readme.custom",content:"# Hello\nA **page**"});
  assert.equal(markdown.kind,"markdown");
  assert.match(markdown.html,/<h1>Hello<\/h1>/);
  const json=autoRenderFile({path:"/data.any",content:'{"name":"Fairwas"}'});
  assert.equal(json.kind,"json");
  assert.match(json.html,/Fairwas/);
});

test("unknown custom grammars are not misrepresented as rendered pages", () => {
  const result=autoRenderFile({path:"/page.xyz",content:"MAKE WINDOW WITH BLUE SKY"});
  assert.equal(result.kind,"unsupported");
  assert.equal(result.html,null);
});
