import { Parser, Language } from "web-tree-sitter";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

const EXTENSIONS = {
  js:"javascript",mjs:"javascript",cjs:"javascript",jsx:"javascript",
  ts:"typescript",tsx:"tsx",py:"python",pyw:"python",rs:"rust",go:"go",
  java:"java",c:"c",h:"c",cc:"cpp",cpp:"cpp",cxx:"cpp",hpp:"cpp",
  cs:"c_sharp",rb:"ruby",php:"php",sh:"bash",bash:"bash",zsh:"bash",
  html:"html",htm:"html",xhtml:"html",css:"css",
  json:"json",jsonc:"json",yml:"yaml",yaml:"yaml",toml:"toml",
  lua:"lua",swift:"swift",kt:"kotlin",
  kts:"kotlin",scala:"scala",ex:"elixir",exs:"elixir",
  vue:"vue",m:"objc",mm:"objc",
  dart:"dart",zig:"zig",ml:"ocaml",mli:"ocaml",el:"elisp",res:"rescript",
  rdl:"systemrdl",tla:"tlaplus",sol:"solidity",ejs:"embedded_template",
  erb:"embedded_template"
};

const GRAMMAR_ALIASES = {
  csharp:"c_sharp", "c#":"c_sharp", "c++":"cpp", "objective-c":"objc",
  typescript:"typescript", javascript:"javascript", python:"python"
};

const LANGUAGE_HINTS = [
  ["python", /(?:^|\n)\s*(?:def\s+\w+\s*\(|from\s+\w+\s+import\b|import\s+\w+|class\s+\w+.*:)/],
  ["rust", /(?:^|\n)\s*(?:fn\s+main\s*\(|use\s+std::|let\s+mut\s+\w+|impl\s+\w+)/],
  ["go", /(?:^|\n)\s*(?:package\s+\w+|func\s+(?:main|\w+)\s*\()/],
  ["java", /(?:public|private|protected)\s+(?:static\s+)?(?:class|interface|enum)\s+\w+/],
  ["bash", /(?:^|\n)\s*(?:#!.*(?:bash|sh)|(?:if|for|while)\s+\[\[?|\w+\s*\(\s*\)\s*\{)/],
  ["ruby", /(?:^|\n)\s*(?:def\s+\w+|require\s+["']|puts\s+)/],
  ["php", /<\?php|\$\w+\s*=/],
  ["cpp", /#include\s*[<"][^>"]+\.h(?:pp)?[>"]|std::(?:cout|cin)|int\s+main\s*\(/],
  ["javascript", /\b(?:const|let|var|function|import|export)\b|=>|document\.|console\./],
  ["css", /(?:^|\})\s*[^{}]+\{\s*[^{}:]+\s*:/],
  ["json", /^\s*[\[{]/],
  ["kotlin", /(?:^|\n)\s*(?:fun\s+main\s*\(|val\s+\w+\s*=|data\s+class\s+)/],
  ["swift", /(?:^|\n)\s*(?:import\s+Foundation|func\s+main\s*\(|let\s+\w+\s*=)/],
  ["dart", /(?:^|\n)\s*(?:void\s+main\s*\(|class\s+\w+\s+extends\s+StatelessWidget)/],
  ["scala", /(?:^|\n)\s*(?:object\s+\w+|def\s+main\s*\()/],
  ["elixir", /(?:^|\n)\s*(?:defmodule\s+\w+|defp?\s+\w+)/],
  ["ocaml", /(?:^|\n)\s*(?:let\s+rec\s+\w+|type\s+\w+\s*=)/],
  ["solidity", /pragma\s+solidity|contract\s+\w+\s*\{/],
  ["zig", /(?:^|\n)\s*(?:const\s+std\s*=\s*@import|pub\s+fn\s+main\s*\()/],
];

let initPromise;
const parserCache = new Map();
const languageCache = new Map();

function runtimeLocation(scriptName) {
  if (typeof window !== "undefined") return "/tree-sitter.wasm";
  return fileURLToPath(new URL("../../node_modules/web-tree-sitter/" + scriptName, import.meta.url));
}

function grammarLocation(grammar, assetBase) {
  const filename = "tree-sitter-" + grammar + ".wasm";
  if (typeof window !== "undefined") {
    const base = String(assetBase || "/tree-sitter-languages/");
    return (base.endsWith("/") ? base : base + "/") + filename;
  }
  return fileURLToPath(new URL("../../node_modules/tree-sitter-wasms/out/" + filename, import.meta.url));
}

async function getParser(grammar, assetBase) {
  if (!initPromise) {
    initPromise = Parser.init({
      locateFile: scriptName => runtimeLocation(scriptName)
    }).catch(error => {
      initPromise = null;
      throw error;
    });
  }
  await initPromise;

  let parserPromise = parserCache.get(grammar);
  if (!parserPromise) {
    parserPromise = (async () => {
      let languagePromise = languageCache.get(grammar);
      if (!languagePromise) {
        languagePromise = Language.load(grammarLocation(grammar, assetBase));
        languageCache.set(grammar, languagePromise);
        languagePromise.catch(() => languageCache.delete(grammar));
      }
      const language = await languagePromise;
      const parser = new Parser();
      parser.setLanguage(language);
      return parser;
    })().catch(error => {
      parserCache.delete(grammar);
      throw error;
    });
    parserCache.set(grammar, parserPromise);
  }
  return parserPromise;
}

export function inferSourceLanguage(path, source) {
  const name = String(path || "").split("/").pop().toLowerCase();
  const extension = name.includes(".") ? name.split(".").pop() : name;
  if (EXTENSIONS[extension]) return EXTENSIONS[extension];
  const text = String(source || "");
  for (const [language, pattern] of LANGUAGE_HINTS) {
    if (pattern.test(text)) return language;
  }
  return null;
}

function collectSyntaxProblems(rootNode, source, limit = 30) {
  const problems = [];
  const visit = node => {
    if (problems.length >= limit) return;
    if (node.isError || node.isMissing) {
      const start = node.startPosition || { row: 0, column: 0 };
      const end = node.endPosition || start;
      const token = String(node.text || source.slice(node.startIndex, node.endIndex) || "").slice(0, 48);
      problems.push({
        type: node.isMissing ? "missing" : "unexpected",
        node: node.type,
        token,
        line: start.row + 1,
        column: start.column + 1,
        endLine: end.row + 1,
        endColumn: end.column + 1,
        message: node.isMissing
          ? "Falta una parte de la expresión en esta posición."
          : "Esta parte del código no coincide con la gramática del lenguaje."
      });
    }
    for (const child of node.children || []) visit(child);
  };
  visit(rootNode);
  return problems;
}

function serializeYamlNode(node) {
  if (node === null || node === undefined) return null;
  if (Array.isArray(node)) return node.map(serializeYamlNode);
  if (typeof node !== "object") return node;
  const type = node.constructor?.name || "YAMLNode";
  if (Object.prototype.hasOwnProperty.call(node, "key") && Object.prototype.hasOwnProperty.call(node, "value")) {
    return { type: "Pair", key: serializeYamlNode(node.key), value: serializeYamlNode(node.value) };
  }
  if (Array.isArray(node.items)) {
    return { type, items: node.items.map(serializeYamlNode) };
  }
  const result = { type };
  if (Object.prototype.hasOwnProperty.call(node, "value")) result.value = node.value;
  if (node.tag) result.tag = node.tag;
  return result;
}

function countYamlNodes(node) {
  if (node === null || node === undefined || typeof node !== "object") return 0;
  if (Array.isArray(node)) return node.reduce((total, item) => total + countYamlNodes(item), 0);
  return 1 + Object.values(node).reduce((total, value) => total + countYamlNodes(value), 0);
}

function parseYamlSource(source) {
  const document = parseDocument(source, { prettyErrors: false, uniqueKeys: true });
  const problems = document.errors.map(error => {
    const position = error.linePos?.[0] || { line: 1, col: 1 };
    return {
      type: "unexpected",
      node: "yaml",
      token: "",
      line: position.line,
      column: position.col,
      endLine: error.linePos?.[1]?.line || position.line,
      endColumn: error.linePos?.[1]?.col || position.col,
      message: String(error.message || "Error de sintaxis YAML.")
    };
  });
  const tree = serializeYamlNode(document.contents);
  return {
    status: problems.length ? "syntax-errors" : "valid",
    language: "yaml",
    tree: JSON.stringify(tree, null, 2),
    problems,
    hasError: problems.length > 0,
    nodeCount: countYamlNodes(tree)
  };
}

const OPEN_TO_CLOSE = { "(": ")", "[": "]", "{": "}" };
const CLOSE_TO_OPEN = { ")": "(", "]": "[", "}": "{" };
const MULTI_OPERATORS = ["...", "===", "!==", ">>>", "<<=", ">>=", "=>", "->", "::", ":=", "==", "!=", "<=", ">=", "&&", "||", "??", "?.", "**", "++", "--", "+=", "-=", "*=", "/=", "%=", "<<", ">>", "|>", "<|", "&&=", "||=", "??="];

function universalParse(source) {
  const text = String(source ?? "");
  const root = { type: "Document", children: [] };
  const containers = [{ node: root, close: null, statement: { type: "Statement", children: [] } }];
  const problems = [];
  let i = 0, row = 0, column = 0;
  const position = () => ({ row: row + 1, column: column + 1 });
  const advance = value => {
    for (const char of value) { if (char === "\n") { row++; column = 0; } else column++; }
    i += value.length;
  };
  const current = () => containers[containers.length - 1];
  const push = node => current().statement.children.push(node);
  const flush = () => {
    const entry = current(), statement = entry.statement;
    if (!statement.children.length) return;
    statement.start = statement.children[0].start;
    statement.end = statement.children[statement.children.length - 1].end;
    entry.node.children.push(statement);
    entry.statement = { type: "Statement", children: [] };
  };
  const token = (type, value, start) => ({ type, value, start, end: position() });
  const readQuoted = (quote, triple = false) => {
    const start = position(), marker = quote.repeat(triple ? 3 : 1);
    advance(marker);
    let value = marker, closed = false;
    while (i < text.length) {
      const ch = text[i];
      if (ch === "\\") { const part = text.slice(i, Math.min(text.length, i + 2)); value += part; advance(part); continue; }
      if (text.startsWith(marker, i)) { value += marker; advance(marker); closed = true; break; }
      value += ch; advance(ch);
    }
    if (!closed) problems.push({ type: "unclosed-string", line: start.row, column: start.column, message: "Cadena sin cerrar." });
    return token("String", value, start);
  };
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\r") { advance(ch); continue; }
    if (ch === "\n" || ch === ";") {
      const start = position(); advance(ch); flush();
      if (ch === ";") current().node.children.push(token("Terminator", ";", start));
      continue;
    }
    if (/\s/u.test(ch)) { advance(ch); continue; }
    const start = position();
    if (ch === "\"" || ch === "'" || ch === String.fromCharCode(96)) {
      push(readQuoted(ch, text.startsWith(ch.repeat(3), i))); continue;
    }
    // In free mode comment markers are not reserved: they remain ordinary symbols.
    // A language-neutral reader must not decide that //, # or /* always mean comments.
    if (OPEN_TO_CLOSE[ch]) {
      const node = { type: "Group", delimiter: ch + OPEN_TO_CLOSE[ch], children: [], start };
      push(node); advance(ch);
      containers.push({ node, close: OPEN_TO_CLOSE[ch], statement: { type: "Statement", children: [] } });
      continue;
    }
    if (CLOSE_TO_OPEN[ch]) {
      advance(ch);
      if (containers.length > 1 && current().close === ch) {
        flush(); current().node.end = position(); containers.pop();
      } else {
        problems.push({ type: "unexpected-closer", line: start.row, column: start.column, token: ch, message: "Cierre sin apertura compatible; se conserva como token." });
        push(token("UnknownPunctuation", ch, start));
      }
      continue;
    }
    const rest = text.slice(i);
    const word = rest.match(/^[\p{L}_$@][\p{L}\p{N}_$@!?-]*/u);
    if (word) { push(token("Identifier", word[0], start)); advance(word[0]); continue; }
    const number = rest.match(/^(?:0[xX][\da-fA-F_]+|0[bB][01_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?)/);
    if (number) { push(token("Number", number[0], start)); advance(number[0]); continue; }
    const operator = MULTI_OPERATORS.find(value => rest.startsWith(value));
    if (operator) { push(token("Operator", operator, start)); advance(operator); continue; }
    const operatorRun = rest.match(/^[^\p{L}\p{N}_\s()[\]{}"'\x60;,]+/u);
    if (operatorRun) { push(token("Operator", operatorRun[0], start)); advance(operatorRun[0]); continue; }
    if (/[^\p{L}\p{N}_\s]/u.test(ch)) { push(token("Operator", ch, start)); advance(ch); continue; }
    push(token("Character", ch, start)); advance(ch);
  }
  while (containers.length > 1) {
    flush();
    const open = containers.pop();
    problems.push({ type: "unclosed-group", line: open.node.start.row, column: open.node.start.column, token: open.node.delimiter[0], message: "Grupo abierto sin cierre correspondiente." });
  }
  flush();
  const count = node => 1 + (node.children || []).reduce((sum, child) => sum + count(child), 0);
  const stats = { tokens: 0, statements: 0, groups: 0, identifiers: 0, operators: 0, strings: 0, numbers: 0 };
  const measure = node => {
    if (node.type === "Statement") stats.statements++;
    else if (node.type === "Group") stats.groups++;
    else if (node.type === "Identifier") stats.identifiers++;
    else if (node.type === "Operator" || node.type === "UnknownPunctuation") stats.operators++;
    else if (node.type === "String") stats.strings++;
    else if (node.type === "Number") stats.numbers++;
    if (["Identifier", "Operator", "UnknownPunctuation", "String", "Number", "Terminator", "Character"].includes(node.type)) stats.tokens++;
    for (const child of node.children || []) measure(child);
  };
  measure(root);
  return {
    status: problems.length ? "syntax-errors" : "valid",
    language: "universal",
    tree: JSON.stringify(root, null, 2),
    treeData: root,
    stats,
    sourceLength: text.length,
    lineCount: text ? text.split(/\r\n|\r|\n/).length : 0,
    problems,
    hasError: problems.length > 0,
    nodeCount: count(root),
    message: "Análisis estructural universal. Se conservan tokens y grupos sin exigir una gramática conocida."
  };
}

export async function parseSource(source, options = {}) {
  const text = String(source ?? "");
  const path = String(options.path || "");
  if (options.mode === "free") return universalParse(text);
  const requestedLanguage = String(options.language || inferSourceLanguage(path, text) || "").toLowerCase();
  const language = GRAMMAR_ALIASES[requestedLanguage] || requestedLanguage;
  if (!language || language === "universal" || language === "unknown") return universalParse(text);

  if (language === "yaml") return parseYamlSource(text);

  const assetBase = options.assetBase || (typeof window !== "undefined" ? "/tree-sitter-languages/" : undefined);
  let tree;
  try {
    const parser = await getParser(language, assetBase);
    tree = parser.parse(text);
    if (!tree) throw new Error("El motor de parsing no ha devuelto un árbol sintáctico.");
    const root = tree.rootNode;
    const hasError = Boolean(root.hasError);
    const problems = collectSyntaxProblems(root, text);
    if (hasError && problems.length === 0) {
      const position = root.startPosition || { row: 0, column: 0 };
      problems.push({
        type: "unexpected",
        node: root.type,
        token: "",
        line: position.row + 1,
        column: position.column + 1,
        endLine: position.row + 1,
        endColumn: position.column + 1,
        message: "El árbol sintáctico contiene errores que la gramática no ha podido localizar con más precisión."
      });
    }
    return {
      status: hasError || problems.length ? "syntax-errors" : "valid",
      language,
      tree: root.toString(),
      problems,
      hasError,
      nodeCount: countNodes(root)
    };
  } catch (error) {
    return {
      status: "grammar-unavailable",
      language,
      tree: null,
      problems: [],
      message: "No se ha podido cargar o ejecutar la gramática " + language + ": " + String(error?.message || error)
    };
  } finally {
    tree?.delete();
  }
}

function countNodes(root) {
  let count = 0;
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    count += 1;
    for (const child of node.children || []) stack.push(child);
  }
  return count;
}

export function supportedParserLanguages() {
  return ["universal", ...new Set(Object.values(EXTENSIONS))];
}
