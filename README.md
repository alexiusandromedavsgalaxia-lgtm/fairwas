# Fairwas

Fairwas es un navegador web **protocol-first** construido desde cero.

## Protocolos propios

- **HTTC** — `httc://` — Global Web
- **AMWP** — `amwp://` — American Web Protocol
- **EUWP** — `euwp://` — European Web Protocol
- **ASWP** — `aswp://` — Asian Web Protocol
- **AFWP** — `afwp://` — African Web Protocol
- **OCWP** — `ocwp://` — Oceanian Web Protocol

## Stack

React + Vite, Cloudflare Pages Functions y Cloudflare D1.

El binding de D1 es **`pages`**, la base es **`workers-pages`** y el servidor usa **`env.pages`**.

## Incluido

- pestañas
- barra de direcciones
- atajos de teclado
- historial
- favoritos
- ajustes
- modo oscuro
- registro de visitas en D1
- API de resolución de protocolos
- arquitectura separada entre UI, protocolos y transporte
- manifest PWA
- configuración de Cloudflare Pages

## Desarrollo

```bash
npm install
npm run dev
npm run build
```

La implementación del transporte real de HTTC/AMWP/EUWP/ASWP/AFWP/OCWP queda detrás de la API para que no haya que rehacer la interfaz cuando se conecte la infraestructura real.