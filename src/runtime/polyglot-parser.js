import { Parser, Language } from "web-tree-sitter";
import { fileURLToPath } from "node:url";

const EXTENSIONS = {
  js:"javascript",mjs:"javascript",cjs:"javascript",jsx:"javascript",
  ts:"typescript",tsx:"tsx",py:"python",pyw:"python",rs:"rust",go:"go",
  java:"java",c:"c",h:"c",cc:"cpp",cpp:"cpp",cxx:"cpp",hpp:"cpp",
  cs:"c_sharp",rb:"ruby",php:"php",sh:"bash",bash:"bash",zsh:"bash",
  html:"html",htm:"html",xhtml:"html",css:"css",
  json:"json",jsonc:"json",yaml:"yaml",yml:"yaml",toml:"toml",
  lua:"lua",swift:"swift",kt:"kotlin",
  kts:"kotlin",scala:"scala",ex:"elixir",exs:"elixir",
  vue:"vue",m:"objc",mm:"objc",
  dart:"dart",elm:"elm",r:"r",zig:"zig",ml:"ocaml",mli:"ocaml",el:"elisp",ql:"ql",res:"rescript",
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
  ["yaml", /^\s*[\w.-]+\s*:\s*(?:[^{}[\]]+)?$/m],
  ["kotlin", /(?:^|\n)\s*(?:fun\s+main\s*\(|val\s+\w+\s*=|data\s+class\s+)/],
  ["swift", /(?:^|\n)\s*(?:import\s+Foundation|func\s+main\s*\(|let\s+\w+\s*=)/],
  ["dart", /(?:^|\n)\s*(?:void\s+main\s*\(|class\s+\w+\s+extends\s+StatelessWidget)/],
  ["scala", /(?:^|\n)\s*(?:object\s+\w+|def\s+main\s*\()/],
  ["elixir", /(?:^|\n)\s*(?:defmodule\s+\w+|defp?\s+\w+)/],
  ["ocaml", /(?:^|\n)\s*(?:let\s+rec\s+\w+|type\s+\w+\s*=)/],
  ["solidity", /pragma\s+solidity|contract\s+\w+\s*\{/]
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

export async function parseSource(source, options = {}) {
  const text = String(source ?? "");
  const path = String(options.path || "");
  const requestedLanguage = String(options.language || inferSourceLanguage(path, text) || "").toLowerCase();
  const language = GRAMMAR_ALIASES[requestedLanguage] || requestedLanguage;
  if (!language) {
    return {
      status: "unknown-language",
      language: null,
      tree: null,
      problems: [],
      message: "No se ha podido inferir un lenguaje. Selecciona uno o añade una gramática."
    };
  }

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
  return Object.keys(EXTENSIONS).reduce((result, extension) => {
    const language = EXTENSIONS[extension];
    if (!result.includes(language)) result.push(language);
    return result;
  }, []);
}
