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

## Seguridad de CreatePage

La API de CreatePage requiere el secreto `FAIRWAS_ADMIN_TOKEN`. No lo guardes en Git ni lo incluyas en el código del cliente.

1. En Cloudflare, abre el proyecto Pages de Fairwas y entra en **Settings → Variables and Secrets**.
2. Añade un secreto llamado `FAIRWAS_ADMIN_TOKEN` con una clave larga y aleatoria.
3. Vuelve a desplegar el proyecto para que las Functions reciban el secreto.
4. Al abrir CreatePage, introduce esa clave cuando el navegador la solicite. Se conserva solo en `sessionStorage` de esa pestaña/sesión.
5. Para revocarla, cambia el secreto en Cloudflare y vuelve a desplegar. Las sesiones que tengan la clave antigua dejarán de autorizarse.

Si el secreto no está configurado, la API falla de forma cerrada y devuelve `admin_auth_not_configured`. La migración estática tiene su endpoint independiente y también debe protegerse con controles de acceso y límites si se expone públicamente.
