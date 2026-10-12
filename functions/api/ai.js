import { runTool } from "./mcp.js";

const ACTIONS = [
  { name: "list_sites", description: "Listar los sitios de la cuenta.", input: {} },
  { name: "list_files", description: "Listar archivos de un sitio propio.", input: { site_id: "site-id" } },
  { name: "read_file", description: "Leer un archivo de un sitio propio.", input: { site_id: "site-id", path: "/index.html" } },
  { name: "write_file", description: "Crear o actualizar un archivo.", input: { site_id: "site-id", path: "/index.html", content: "<h1>Hola</h1>" } },
  { name: "publish_site", description: "Publicar o reemplazar los archivos de un sitio.", input: { hostname: "demo.aploscabluchel", title: "Mi sitio", files: [{ path: "/index.html", content: "<h1>Hola</h1>" }] } }
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization,content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS"
    }
  });
}

async function authenticate(request, env) {
  const expected = String(env.FAIRWAS_API_TOKEN || env.MCP_TOKEN || "");
  if (!expected) return { error: json({ ok: false, error: "api_not_configured", detail: "Configura el secreto FAIRWAS_API_TOKEN en Cloudflare Pages." }, 503) };
  const auth = String(request.headers.get("authorization") || "");
  if (!auth.startsWith("Bearer ") || auth.slice(7) !== expected) {
    return { error: json({ ok: false, error: "unauthorized", detail: "Usa Authorization: Bearer TU_API_TOKEN." }, 401) };
  }
  return { ok: true };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization,content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS"
  }});
}

export async function onRequestGet({ request, env }) {
  const auth = await authenticate(request, env);
  if (auth.error) return auth.error;
  return json({
    ok: true,
    name: "Fairwas REST API",
    version: "1.0.0",
    endpoint: new URL(request.url).origin + "/api/ai",
    authentication: "Bearer token",
    usage: "POST JSON { \"action\": \"list_sites\", \"args\": {} }",
    actions: ACTIONS
  });
}

export async function onRequestPost({ request, env }) {
  const auth = await authenticate(request, env);
  if (auth.error) return auth.error;
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 22 * 1024 * 1024) return json({ ok: false, error: "request_too_large" }, 413);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ ok: false, error: "invalid_request" }, 400);
  const action = String(body.action || "");
  if (!ACTIONS.some(item => item.name === action)) return json({ ok: false, error: "unknown_action", available_actions: ACTIONS.map(item => item.name) }, 400);
  try {
    const result = await runTool(action, body.args || {}, env);
    return json({ ok: true, action, result });
  } catch (error) {
    const message = String(error?.message || error);
    const status = message === "developer_not_registered" ? 403 : message.includes("site_not_found") || message === "file_not_found" ? 404 : 400;
    return json({ ok: false, action, error: message }, status);
  }
}
