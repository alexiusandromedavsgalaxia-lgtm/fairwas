# Fairwas

Fairwas es un navegador web **protocol-first** construido alrededor de un único protocolo: **HTTC**.

## Protocolo

- **HTTC** — `httc://` — protocolo web global de Fairwas

Todos los procesos de navegación, resolución, publicación y comunicación de sitios de Fairwas se unifican bajo HTTC. Los protocolos regionales anteriores se han eliminado del producto.

## Stack

React + Vite, Cloudflare Pages Functions y Cloudflare D1.

Bindings de D1:
- **`pages`** → base `workers-pages`
- **`server`** → base `server`

## Incluido

- pestañas
- barra de direcciones
- atajos de teclado
- historial
- favoritos
- ajustes
- modo oscuro
- resolución HTTC
- registro de visitas en D1
- registro de servidores
- manifest PWA
- configuración de Cloudflare Pages

## Desarrollo

```bash
npm install
npm run dev
npm run build
```

## CreatePage

CreatePage y la migración estática no solicitan una clave de administración. La API conserva límites de tamaño, cantidad de archivos y validación de rutas al publicar.

## Cloud y servicios

La plataforma de servicios, dominios HTTC, rutas API, claves, almacenamiento y servicios de identidad está documentada en [`docs/PLATFORM.md`](docs/PLATFORM.md).

## Integración con IAs (MCP)

Fairwas incluye un servidor MCP en `/api/mcp` y una API REST alternativa en `/api/ai` para asistentes que no admiten MCP. Ambas permiten listar sitios, leer y editar archivos y publicar proyectos con autenticación Bearer. Configura `MCP_TOKEN` para MCP o `FAIRWAS_API_TOKEN` para REST en Cloudflare. Consulta la [guía MCP](docs/MCP.md) y la [guía REST para IA](docs/API.md).
## YourCode · análisis sintáctico

YourCode incorpora un motor Tree-sitter en WebAssembly. El editor analiza el contenido del archivo, genera un árbol sintáctico y muestra errores con posiciones de línea y columna. La gramática se selecciona por extensión o por firmas del código; también se puede elegir manualmente en el editor.

Las gramáticas disponibles se copian desde `tree-sitter-wasms` durante `npm install`. El proceso de instalación comprueba que cada lenguaje anunciado tenga un archivo WASM real y genera `public/tree-sitter-languages/manifest.json`. El runtime se sirve desde `/tree-sitter.wasm`.

La compatibilidad es amplia, pero no universal: solo se analizan sintácticamente los lenguajes para los que hay una gramática instalada. Un lenguaje o DSL propio necesita su propia gramática; no se presenta una simple vista del texto como si fuera parsing.

