import test from "node:test";
import assert from "node:assert/strict";
import { inferSourceLanguage, parseSource, supportedParserLanguages } from "../src/runtime/polyglot-parser.js";

test("every language advertised by YourCode has a real, loadable WASM grammar", async () => {
  const languages = supportedParserLanguages();
  assert.ok(languages.length >= 30, "the grammar registry unexpectedly shrank");
  for (const language of languages) {
    const result = await parseSource("", { language });
    assert.notEqual(
      result.status,
      "grammar-unavailable",
      language + " is advertised but its grammar failed to load: " + result.message
    );
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

test("JavaScript, Rust, Elm and Zig are parsed into syntax trees", async () => {
  const examples = [
    ["javascript", "const answer = (value) => value + 42;", /lexical_declaration/],
    ["rust", "fn main() { let answer: i32 = 42; }", /function_item/],
    ["elm", "module Main exposing (main)\n\nmain = 42", /function_declaration/],
    ["zig", "pub fn main() void {}", /FnProto|fn_proto/]
  ];
  for (const [language, source, expectedNode] of examples) {
    const result = await parseSource(source, { language });
    assert.equal(result.status, "valid", language + ": " + JSON.stringify(result.problems));
    assert.match(result.tree, expectedNode, language + " did not produce the expected syntax tree");
  }
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
