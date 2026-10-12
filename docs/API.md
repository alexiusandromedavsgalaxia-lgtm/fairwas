# Fairwas REST API para asistentes de IA

Si tu asistente no admite MCP, puede conectarse por HTTP normal a:

`https://TU-DOMINIO/api/ai`

La API usa JSON y funciona con cualquier cliente capaz de enviar peticiones HTTP. Permite listar sitios, consultar archivos, leer y escribir archivos y publicar sitios. Solo modifica proyectos pertenecientes a la cuenta de desarrollador configurada en Fairwas.

## 1. Configurar la clave

En Cloudflare abre el proyecto Fairwas → **Settings → Variables and Secrets** y crea un secreto llamado `FAIRWAS_API_TOKEN` con un valor aleatorio largo. No lo incluyas en el frontend, repositorios públicos ni conversaciones. Si ya tienes `MCP_TOKEN`, el endpoint también lo acepta como alternativa, pero es preferible una clave independiente.

## 2. Descubrir las acciones

Envía un `GET` a `/api/ai` con el encabezado:

```http
Authorization: Bearer TU_API_TOKEN
```

La respuesta enumera las acciones disponibles y sus argumentos.

## 3. Llamar a una acción

Todas las acciones se envían con `POST` y JSON. Ejemplo para listar los sitios:

```http
POST /api/ai
Authorization: Bearer TU_API_TOKEN
Content-Type: application/json

{
  "action": "list_sites",
  "args": {}
}
```

Leer un archivo:

```json
{
  "action": "read_file",
  "args": { "site_id": "ID_DEL_SITIO", "path": "/index.html" }
}
```

Escribir un archivo:

```json
{
  "action": "write_file",
  "args": {
    "site_id": "ID_DEL_SITIO",
    "path": "/index.html",
    "content": "<h1>Actualizado por IA</h1>"
  }
}
```

Publicar un sitio nuevo:

```json
{
  "action": "publish_site",
  "args": {
    "hostname": "demo.aploscabluchel",
    "title": "Demo",
    "files": [{ "path": "/index.html", "content": "<h1>Hola</h1>" }]
  }
}
```

Para actualizar un sitio existente, pasa `site_id` y `files`. Las rutas de archivos deben empezar por `/`; no se permiten rutas que escapen del sitio. Máximo 300 archivos y 15 MiB por publicación.

## Acciones

- `list_sites`
- `list_files` con `site_id`
- `read_file` con `site_id` y `path`
- `write_file` con `site_id`, `path` y `content`
- `publish_site` con `files` y, para un sitio nuevo, `hostname`

Las respuestas son JSON con `ok: true` y `result`, o `ok: false` y `error`. La API no ejecuta comandos de shell ni da acceso al sistema de archivos de GitHub. Usa una clave con permisos mínimos y revócala rotando el secreto si se filtra.
