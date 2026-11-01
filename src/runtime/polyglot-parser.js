import { Parser } from "web-tree-sitter";
import { fileURLToPath } from "node:url";

const EXTENSIONS = {
  js:"javascript",mjs:"javascript",cjs:"javascript",jsx:"javascript",
  ts:"typescript",tsx:"tsx",py:"python",pyw:"python",rs:"rust",go:"go",
  java:"java",c:"c",h:"c",cc:"cpp",cpp:"cpp",cxx:"cpp",hpp:"cpp",
  cs:"c_sharp",rb:"ruby",php:"php",sh:"bash",bash:"bash",zsh:"bash",
  sql:"sql",html:"html",htm:"html",xhtml:"html",css:"css",
  json:"json",jsonc:"json",yaml:"yaml",yml:"yaml",toml:"toml",
  md:"markdown",markdown:"markdown",lua:"lua",swift:"swift",kt:"kotlin",
  kts:"kotlin",scala:"scala",ex:"elixir",exs:"elixir",hs:"haskell",
  graphql:"graphql",gql:"graphql",vue:"vue",xml:"html",m:"objc",mm:"objc",
  dart:"dart",ml:"ocaml",mli:"ocaml",el:"elisp",ql:"ql",res:"rescript",
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
  ["sql", /^\s*(?:SELECT|CREATE\s+TABLE|INSERT\s+INTO|UPDATE\s+\w+\s+SET)\b/im],
  ["bash", /(?:^|\n)\s*(?:#!.*(?:bash|sh)|(?:if|for|while)\s+\[\[?|\w+\s*\(\s*\)\s*\{)/],
  ["ruby", /(?:^|\n)\s*(?:def\s+\w+|require\s+["']|puts\s+)/],
  ["php", /<\?php|\$\w+\s*=/],
  ["cpp", /#include\s*[<"][^>"]+\.h(?:pp)?[>"]|std::(?:cout|cin)|int\s+main\s*\(/],
  ["javascript", /\b(?:const|let|var|function|import|export)\b|=>|document\.|console\./],
  ["css", /(?:^|\})\s*[^{}]+\{\s*[^{}:]+\s*:/],
  ["json", /^\s*[\[{]/],
  ["yaml", /^\s*[\w.-]+\s*:\s*(?:[^{}[\]]+)?$/m]
];

let initPromise;
const parserCache = new Map();
const languageCache = new Map();

function runtimeLocation(scriptName, assetBase) {
  if (typeof window !== "undefined") return new URL(scriptName, assetBase || "/").toString();
  return fileURLToPath(new URL("../../node_modules/web-tree-sitter/" + scriptName, import.meta.url));
}

function grammarLocation(grammar, assetBase) {
  const filename = "tree-sitter-" + grammar + ".wasm";
  if (typeof window !== "undefined") return new URL(filename, assetBase || "/tree-sitter-languages/").toString();
  return fileURLToPath(new URL("../../node_modules/tree-sitter-wasms/out/" + filename, import.meta.url));
}

async function getParser(grammar, assetBase) {
  if (!initPromise) {
    initPromise = Parser.init({
      locateFile: scriptName => runtimeLocation(scriptName, assetBase)
    });
  }
  await initPromise;
  let language = languageCache.get(grammar);
  if (!language) {
    language = await Parser.Language.load(grammarLocation(grammar, assetBase));
    languageCache.set(grammar, language);
  }
  let parser = parserCache.get(grammar);
  if (!parser) {
    parser = new Parser();
    parser.setLanguage(language);
    parserCache.set(grammar, parser);
  }
  return parser;
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
  const language = GRAMMAR_ALIASES[String(options.language || inferSourceLanguage(path, text) || "").toLowerCase()]
    || String(options.language || inferSourceLanguage(path, text) || "").toLowerCase();
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
  try {
    const parser = await getParser(language, assetBase);
    const tree = parser.parse(text);
    const problems = collectSyntaxProblems(tree.rootNode, text);
    return {
      status: problems.length ? "syntax-errors" : "valid",
      language,
      tree: tree.rootNode.toString(),
      problems,
      hasError: Boolean(tree.rootNode.hasError),
      nodeCount: countNodes(tree.rootNode)
    };
  } catch (error) {
    return {
      status: "grammar-unavailable",
      language,
      tree: null,
      problems: [],
      message: "La gramática " + language + " no está disponible: " + String(error?.message || error)
    };
  }
}

function countNodes(root) {
  let count = 0;
  const visit = node => {
    count += 1;
    for (const child of node.children || []) visit(child);
  };
  visit(root);
  return count;
}

export function supportedParserLanguages() {
  return Object.keys(EXTENSIONS).reduce((result, extension) => {
    const language = EXTENSIONS[extension];
    if (!result.includes(language)) result.push(language);
    return result;
  }, []);
}
