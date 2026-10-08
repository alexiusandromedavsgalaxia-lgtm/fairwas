import test from "node:test";
import assert from "node:assert/strict";
import { validatePublishFiles } from "../functions/api/createpage.js";

test("publish validation requires index.html and rejects unsafe paths", () => {
  assert.equal(validatePublishFiles([{path:"/app.js",content:"ok"}]).error, "index_html_required");
  assert.equal(validatePublishFiles([{path:"/index.html",content:"ok"},{path:"/../secret",content:"x"}]).error, "invalid_file_path");
});

test("publish validation rejects duplicate paths and excessive file counts", () => {
  assert.equal(validatePublishFiles([{path:"/index.html",content:"a"},{path:"/index.html",content:"b"}]).error, "duplicate_file_path");
  assert.equal(validatePublishFiles(Array.from({length:301},(_,i)=>({path:i===0?"/index.html":"/f"+i,content:""}))).error, "too_many_files");
});

test("publish validation enforces total bytes and accepts valid files", () => {
  const valid=validatePublishFiles([{path:"/index.html",content:"hello"},{path:"/app.js",content:"world"}]);
  assert.equal(valid.ok,true);
  assert.equal(valid.totalBytes,10);
  assert.equal(validatePublishFiles([{path:"/index.html",content:"x".repeat(16*1024*1024)}]).error,"publish_too_large");
});
