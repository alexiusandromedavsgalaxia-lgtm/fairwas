const MODEL_PREFERENCES = [
  "Qwen3.5-0.8B-q4f16_1-MLC",
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
  "Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC"
];

let runtimePromise = null;
let enginePromise = null;
let activeModelId = "";
let completionQueue = Promise.resolve();

async function getRuntime() {
  if (!runtimePromise) {
    runtimePromise = import("@mlc-ai/web-llm").catch(error => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}

async function chooseModel(runtime) {
  const models = runtime.prebuiltAppConfig.model_list || [];
  const available = new Set(models.map(model => model.model_id));
  return MODEL_PREFERENCES.find(model => available.has(model))
    || models.find(model => model.model_type !== "embedding")?.model_id;
}

export function getYourCodeModelName() {
  return activeModelId || MODEL_PREFERENCES[0];
}

async function getLoadedEngine(runtime, modelId, onProgress) {
  if (!enginePromise || activeModelId !== modelId) {
    activeModelId = modelId;
    const pending = runtime.CreateMLCEngine(modelId, {
      initProgressCallback: report => {
        if (typeof onProgress === "function") onProgress(report);
      }
    });
    const wrapped = pending.catch(error => {
      if (enginePromise === wrapped) {
        enginePromise = null;
        activeModelId = "";
      }
      throw error;
    });
    enginePromise = wrapped;
      throw error;
    });
  }
  return enginePromise;
}

function isModelNotLoaded(error) {
  return /model not loaded|ModelNotLoadedError/i.test(String(error?.message || error));
}

async function completeWithLoadedModel(engine, modelId, messages) {
  try {
    return await engine.chat.completions.create({
      model: modelId,
      messages,
      temperature: 0.25,
      max_tokens: 2400
    });
  } catch (error) {
    // A stale WebLLM engine can survive a browser tab restore while its
    // internal model registry has been cleared. Reload it before retrying.
    if (!isModelNotLoaded(error) || typeof engine.reload !== "function") throw error;
    await engine.reload(modelId);
    return engine.chat.completions.create({
      model: modelId,
      messages,
      temperature: 0.25,
      max_tokens: 2400
    });
  }
}

export async function renderYourCodeLocally(source, { title = "YourCode", onProgress } = {}) {
  if (typeof navigator === "undefined" || !navigator.gpu) {
    throw new Error("Este navegador no tiene WebGPU disponible. Prueba con un navegador compatible y una GPU compatible.");
  }

  const runtime = await getRuntime();
  const modelId = await chooseModel(runtime);
  if (!modelId) throw new Error("WebLLM no ha encontrado un modelo compatible en su catálogo.");

  const engine = await getLoadedEngine(runtime, modelId, onProgress);
  const messages = [
    {
      role: "system",
      content: "Eres el intérprete visual de YourCode. YourCode acepta lenguajes inventados libremente: no hay gramática fija, palabras reservadas, sintaxis obligatoria ni idioma base. Interpreta cada programa completo por su contexto, símbolos, relaciones, nombres y estructura. Deduce una intención visual razonable y genera una página web real, completa, adaptable y funcional. Devuelve solo HTML completo con CSS incluido y JavaScript si hace falta. Nunca muestres el código original como texto, ni lo conviertas en tarjetas, tokens, AST o visor. No inventes reglas fijas para el lenguaje. Si hay ambigüedad, elige una interpretación coherente."
    },
    {
      role: "user",
      content: "Nombre del proyecto: " + String(title) + "\n\nCódigo YourCode original completo:\n" + String(source)
    }
  ];

  // WebLLM's model registry is shared by the engine. Serialize requests so a
  // live preview and a simultaneous publish cannot race model state.
  const task = completionQueue.then(() => completeWithLoadedModel(engine, modelId, messages));
  completionQueue = task.catch(() => undefined);
  const result = await task;

  const text = String(result?.choices?.[0]?.message?.content || "").trim();
  const html = text.replace(/^\`\`\`(?:html)?\s*/i, "").replace(/\s*\`\`\`$/, "");
  if (!/^<!doctype html|^<html\b/i.test(html)) {
    throw new Error("El modelo local no ha generado un documento HTML válido. Prueba a simplificar el código o vuelve a interpretarlo.");
  }
  return html;
}
