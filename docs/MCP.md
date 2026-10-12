# Fairwas MCP

Fairwas expone un servidor **Model Context Protocol (MCP)** en:

`https://TU-DOMINIO/api/mcp`

Permite a clientes compatibles con MCP listar tus sitios, consultar archivos, leerlos, escribir archivos y publicar sitios. El servidor solo permite modificar proyectos que pertenezcan a la cuenta de desarrollador registrada.

## Activación segura

1. En Cloudflare, abre el proyecto **fairwas** y entra en **Settings → Variables and Secrets → Add**.
2. Crea un **secret** llamado `MCP_TOKEN` con un valor aleatorio largo. No lo pongas en el repositorio, en el navegador ni en el código de la web.
3. Despliega la versión que incluye `/api/mcp`.
4. En un cliente de IA que admita servidores MCP remotos, añade `https://TU-DOMINIO/api/mcp` como servidor HTTP y configura el encabezado `Authorization: Bearer TU_MCP_TOKEN`.

No compartas ese token en conversaciones públicas. Quien lo tenga puede editar y publicar los sitios de la cuenta. Para revocarlo, cambia o elimina el secret `MCP_TOKEN`.

## Herramientas

- `list_sites`: lista sitios propios.
- `list_files`: lista las rutas de archivos de un sitio.
- `read_file`: lee un archivo.
- `write_file`: crea o modifica un archivo y guarda el cambio publicado.
- `publish_site`: publica un sitio nuevo o reemplaza los archivos de uno existente.

Las publicaciones se limitan a 300 archivos y 15 MiB por operación. La API no ejecuta comandos de shell ni concede acceso al sistema de archivos del repositorio GitHub. El servidor usa JSON-RPC 2.0 sobre HTTP y requiere un Bearer token.

## Prueba rápida

Con el encabezado `Authorization: Bearer …`, envía un `POST` a `/api/mcp` con este cuerpo:

```json
{"jsonrpc":"2.0","id":1,"method":"tools/list"}
```
