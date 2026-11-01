import test from "node:test";
import assert from "node:assert/strict";
import { inferSourceLanguage, parseSource, supportedParserLanguages } from "../src/runtime/polyglot-parser.js";

test("polyglot parser exposes a broad grammar registry", () => {
  const languages = supportedParserLanguages();
  for (const language of ["javascript", "typescript", "python", "rust", "go", "java", "cpp", "sql", "html", "css", "json", "yaml"]) {
    assert.ok(languages.includes(language), "missing parser for " + language);
  }
});

test("custom extensions are detected from source syntax and parsed into a real tree", async () => {
  const source = "def greet(name):\n    return f\"Hello {name}\"\n";
  assert.equal(inferSourceLanguage("/src/main.faircode", source), "python");
  const result = await parseSource(source, { path: "/src/main.faircode" });
  assert.equal(result.status, "valid");
  assert.equal(result.language, "python");
  assert.match(result.tree, /function_definition/);
  assert.ok(result.nodeCount > 3);
});

test("JavaScript and Rust are parsed into syntax trees", async () => {
  const js = await parseSource("const answer = (value) => value + 42;", { path: "/main.js" });
  assert.equal(js.status, "valid");
  assert.match(js.tree, /lexical_declaration/);
  const rust = await parseSource("fn main() { let answer: i32 = 42; }", { path: "/main.rs" });
  assert.equal(rust.status, "valid");
  assert.match(rust.tree, /function_item/);
});

test("syntax errors produce source positions instead of parser Expected-token messages", async () => {
  const result = await parseSource("def broken(:\n    return 1\n", { path: "/broken.py" });
  assert.equal(result.status, "syntax-errors");
  assert.ok(result.problems.length > 0);
  assert.ok(result.problems[0].line >= 1);
  assert.doesNotMatch(JSON.stringify(result.problems), /expected token/i);
});

test("unknown custom grammars are reported honestly", async () => {
  const result = await parseSource("MAKE WINDOW WITH BLUE SKY", { path: "/page.xyz" });
  assert.equal(result.status, "unknown-language");
  assert.equal(result.tree, null);
});
