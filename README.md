# Fairwas

Fairwas es un navegador web protocol-first.

## Protocolos

- HTTC — protocolo global
- AMWP — American Web Protocol
- EUWP — European Web Protocol
- ASWP — Asian Web Protocol
- AFWP — African Web Protocol
- OCWP — Oceanian Web Protocol

La interfaz inicial ya entiende los esquemas propios y mantiene la navegación organizada alrededor de ellos.

## Desarrollo

```bash
npm install
npm run dev
```

La capa de resolución/transporte queda separada de la interfaz para poder implementarla después sin volver a rehacer el navegador.