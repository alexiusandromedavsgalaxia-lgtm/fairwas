import { prebuiltAppConfig, CreateMLCEngine } from "@mlc-ai/web-llm";

const MODEL_PREFERENCES = [
  "Qwen3.5-0.8B-q4f16_1-MLC",
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
  "Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC"
];
let enginePromise = null;
let activeModelId = "";

function chooseModel() {
  const available = new Set((prebuiltAppConfig.model_list || []).map(model => model.model_id));
  return MODEL_PREFERENCES.find(model => available.has(model)) || (prebuiltAppConfig.model_list || []).find(model => model.model_type !== "embedding")?.model_id;
}

export function getYourCodeModelName() {
  return chooseModel() || MODEL_PREFERENCES[0];
}

export async function renderYourCodeLocally(source, { title = "YourCode", onProgress } = {}) {
  if (typeof navigator === "undefined" || !navigator.gpu) {
    throw new Error("Este navegador no tiene WebGPU disponible. Prueba con un navegador compatible y una GPU compatible.");
  }
  const modelId = chooseModel();
  if (!modelId) throw new Error("WebLLM no ha encontrado un modelo compatible en su catálogo.");
  if (!enginePromise || activeModelId !== modelId) {
    activeModelId = modelId;
    enginePromise = CreateMLCEngine(modelId, {
      initProgressCallback: report => {
        if (typeof onProgress === "function") onProgress(report);
      }
    }).catch(error => { enginePromise = null; activeModelId = ""; throw error; });
  }
  const engine = await enginePromise;
  const result = await engine.chat.completions.create({
    messages: [
      { role: "system", content: "Eres el intérprete visual de YourCode. YourCode acepta lenguajes inventados libremente: no hay gramática fija, palabras reservadas, sintaxis obligatoria ni idioma base. Interpreta cada programa completo por su contexto, símbolos, relaciones, nombres y estructura. Deduce una intención visual razonable y genera una página web real, completa, adaptable y funcional. Devuelve solo HTML completo con CSS incluido y JavaScript si hace falta. Nunca muestres el código original como texto, ni lo conviertas en tarjetas, tokens, AST o visor. No inventes reglas fijas para el lenguaje. Si hay ambigüedad, elige una interpretación coherente." },
      { role: "user", content: "Nombre del proyecto: " + String(title) + "\n\nCódigo YourCode original completo:\n" + String(source) }
    ],
    temperature: 0.25,
    max_tokens: 2400,
  });
  const text = String(result?.choices?.[0]?.message?.content || "").trim();
  const html = text.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/, "");
  if (!/^<!doctype html|^<html\b/i.test(html)) {
    throw new Error("El modelo local no ha generado un documento HTML válido. Prueba a simplificar el código o vuelve a interpretarlo.");
  }
  return html;
}
