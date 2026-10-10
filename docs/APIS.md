# APIs y endpoints de Fairwas

El backend de cada sitio puede definir rutas HTTP sin montar un servidor aparte. Las rutas pueden devolver JSON, texto, HTML, XML, SVG, CSS, JavaScript, CSV, binario codificado en base64 o una redirección.

## Rutas y parámetros

Ejemplo: método `GET`, ruta `/api/saludo/:nombre` y respuesta JSON:

```json
{
  "ok": true,
  "mensaje": "Hola {{params.nombre}}",
  "idioma": "{{query.idioma}}"
}
```

También se admiten parámetros opcionales (`/api/users/:id?`) y comodines al final (`/api/files/*` o `/api/files/*resto`). Los comodines se exponen como `{{params.wildcard}}` o el nombre indicado después de `*`.

## Tipos de respuesta

Para respuestas distintas de JSON, la configuración interna de la respuesta usa un sobre `__response`. Por ejemplo:

```json
{
  "__response": {
    "type": "html",
    "body": "<!doctype html><html><body><h1>Hola {{params.nombre}}</h1></body></html>"
  }
}
```

Tipos admitidos: `json`, `text`, `html`, `xml`, `svg`, `css`, `javascript`, `csv`, `base64` / `binary` y `redirect`. Se puede indicar `content_type` para especificar el MIME, por ejemplo `video/mp4`, `image/png` o `application/pdf`. En una redirección, `body` es la URI de destino. Se admiten cabeceras de respuesta seguras como `content-disposition`, `cache-control` y `content-language`.

## Cuerpos de petición

Las rutas pueden leer cuerpos JSON, `application/x-www-form-urlencoded`, `multipart/form-data`, texto y binario. Las plantillas usan `{{params.clave}}`, `{{query.clave}}` y `{{body.clave}}`. En cuerpos de texto, usa `{{body.text}}`; en binarios, el cuerpo expone `{{body.base64}}`, `{{body.byteLength}}` y `{{body.content_type}}`. El límite actual de entrada es 1 MiB y las configuraciones de respuesta se limitan a 900 KB.

## Vídeos, imágenes y archivos

Para archivos grandes, súbelos al proyecto como archivos estáticos en lugar de incrustarlos en la configuración de una API. Fairwas reconoce tipos como MP4, WebM, MP3, PNG, WebP, PDF y otros. Los archivos binarios estáticos y las respuestas binarios base64 con estado 200 admiten solicitudes HTTP `Range`, que los reproductores usan para buscar posiciones dentro del medio.

## Métodos y llamadas

Se admiten `GET`, `HEAD`, `POST`, `PUT`, `PATCH` y `DELETE`. `OPTIONS` se usa para CORS/preflight. Desde una página publicada, llama a la URI HTTC de tu dominio mediante el runtime de Fairwas. En navegadores externos, HTTC no es un protocolo HTTP público estándar: hace falta el transporte compatible de Fairwas.

## Límites actuales

Este backend se ejecuta en Cloudflare Pages Functions con compatibilidad Node.js, no como un proceso Node.js independiente con un servidor persistente. Las rutas configuradas devuelven respuestas basadas en plantillas; todavía no ejecutan código JavaScript arbitrario por ruta ni equivalen a un servidor Express completo. Para operaciones sensibles, configura autenticación y autorización y evita devolver datos privados en endpoints públicos.
