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
