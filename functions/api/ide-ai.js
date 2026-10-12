const MAX_BODY = 2 * 1024 * 1024;
const MAX_FILES = 40;
const MAX_FILE_CHARS = 45000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "POST,OPTIONS"
    }
  });
}

function normalizeEndpoint(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.length > 2048) throw new Error("Indica un endpoint válido.");
  let url;
  try { url = new URL(raw); } catch { throw new Error("El endpoint no es una URL válida."); }
  if (url.protocol !== "https:") throw new Error("Por seguridad, el endpoint debe usar HTTPS.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      host === "127.0.0.1" || host === "::1" || host.startsWith("10.") ||
      host.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host === "169.254.169.254" || host === "metadata.google.internal") {
    throw new Error("No se permiten endpoints locales ni direcciones privadas.");
  }
  url.hash = "";
  if (/\/chat\/completions\/?$/i.test(url.pathname)) return url.toString();
  url.pathname = url.pathname.replace(/\/+$/, "");
  if (/\/v1$/i.test(url.pathname)) url.pathname += "/chat/completions";
  else url.pathname += "/v1/chat/completions";
  return url.toString();
}

function makeSystemMessage(project, files) {
  const safeFiles = files.slice(0, MAX_FILES).map(file => ({
    path: String(file.path || "").slice(0, 1024),
    content: String(file.content || "").slice(0, MAX_FILE_CHARS),
    content_type: String(file.content_type || "")
  }));
  return [
    "Eres el asistente de programación integrado en el IDE de Fairwas. El usuario te pedirá cambios en su proyecto.",
    "Devuelve SIEMPRE un único objeto JSON válido, sin Markdown ni bloques de código, con este esquema: {\"reply\":\"explicación breve en el idioma del usuario\",\"edits\":[{\"path\":\"/ruta/archivo\",\"content\":\"contenido COMPLETO del archivo\"}]}",
    "Incluye en edits únicamente archivos que debas crear o modificar. Para modificar un archivo, devuelve su contenido completo, no un parche. No incluyas rutas relativas que escapen del proyecto, rutas que no empiecen por / ni archivos secretos. Si solo hace falta explicar algo, devuelve edits: [].",
    "Conserva los archivos existentes que no necesiten cambios. Si añades archivos nuevos, usa rutas absolutas del proyecto que empiecen por /. No afirmes que has ejecutado, probado, guardado en servidor o publicado el código. Los cambios se aplicarán al borrador local del IDE y el usuario decidirá cuándo guardar/publicar.",
    "Respeta la estructura y tecnologías del proyecto que ves. Para HTML/CSS/JS crea soluciones funcionales y adaptables. Para cambios grandes divide el trabajo de forma coherente y devuelve los archivos completos afectados.",
    "Proyecto: " + JSON.stringify({ title: project?.title || "", hostname: project?.hostname || "", site_id: project?.site_id || "" }),
    "Archivos actuales (el contenido puede estar truncado en archivos muy largos): " + JSON.stringify(safeFiles)
  ].join("\n\n");
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "POST,OPTIONS"
  }});
}

export async function onRequestPost({ request }) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY) return json({ ok: false, error: "request_too_large", detail: "La petición supera el límite permitido." }, 413);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "invalid_json", detail: "El cuerpo debe ser JSON válido." }, 400); }
  const apiKey = String(body?.api_key || "").trim();
  const model = String(body?.model || "").trim();
  if (!apiKey) return json({ ok: false, error: "api_key_required", detail: "Pega tu API key en la configuración del chat." }, 400);
  if (!model || model.length > 200) return json({ ok: false, error: "model_required", detail: "Indica el nombre del modelo." }, 400);
  if (!Array.isArray(body?.messages) || !body.messages.length) return json({ ok: false, error: "messages_required", detail: "Escribe una petición para la IA." }, 400);
  if (!Array.isArray(body?.files) || body.files.length > MAX_FILES) return json({ ok: false, error: "invalid_files", detail: "El proyecto puede incluir hasta " + MAX_FILES + " archivos en una petición." }, 400);

  let endpoint;
  try { endpoint = normalizeEndpoint(body.endpoint); } catch (error) {
    return json({ ok: false, error: "invalid_endpoint", detail: error.message }, 400);
  }

  const messages = [
    { role: "system", content: makeSystemMessage(body.project || {}, body.files) },
    ...body.messages.slice(-12).map(message => ({
      role: message?.role === "assistant" ? "assistant" : "user",
      content: String(message?.content || "").slice(0, 12000)
    }))
  ];

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "authorization": "Bearer " + apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({ model, messages, temperature: 0.2 })
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const detail = String(data?.error?.message || data?.message || ("El proveedor respondió HTTP " + upstream.status)).slice(0, 1200);
      return json({ ok: false, error: "provider_error", detail, provider_status: upstream.status }, 502);
    }
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return json({ ok: false, error: "empty_model_response", detail: "El proveedor no devolvió texto. Comprueba que el endpoint sea compatible con chat completions." }, 502);
    }
    return json({ ok: true, content, model: data?.model || model });
  } catch (error) {
    return json({ ok: false, error: "provider_connection_failed", detail: String(error?.message || error).slice(0, 1000) }, 502);
  }
}
