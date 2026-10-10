# APIs y endpoints de Fairwas

CreatePage incluye un gestor inicial de endpoints REST por sitio. Un endpoint responde a una combinación de método HTTP y ruta, y devuelve JSON.

## Crear y llamar a un endpoint

Por ejemplo, configura el método `GET`, la ruta `/api/saludo/:nombre` y la respuesta:

```json
{
  "ok": true,
  "mensaje": "Hola {{params.nombre}}",
  "idioma": "{{query.idioma}}"
}
```

Luego una página publicada puede llamar:

```js
const response = await fetch("httc://miweb.fair/api/saludo/Axel?idioma=es");
const data = await response.json();
```

Desde un sitio ejecutado en el navegador Fairwas, usa la dirección HTTC correspondiente. El navegador adapta las llamadas de red de páginas publicadas a la infraestructura del sitio.

En el gestor puedes elegir GET, POST, PUT, PATCH o DELETE, un código HTTP de respuesta y un objeto JSON. Los parámetros de ruta usan `:nombre`; las plantillas admiten `{{params.nombre}}`, `{{query.clave}}` y `{{body.clave}}`. El cuerpo de las peticiones que no sean GET/HEAD debe ser JSON.

## Alcance y seguridad

- Las rutas y sus respuestas se configuran por separado para cada sitio.
- Los endpoints públicos responden con JSON y permiten CORS.
- Este primer gestor no ejecuta JavaScript arbitrario, no llama servicios externos y no proporciona todavía roles, secretos de API, webhooks, colas, tareas programadas ni lógica personalizada de negocio.
- No uses estos endpoints para exponer datos privados. Añade autenticación y autorización a las operaciones sensibles.
- Las URLs públicas siguen el formato `/api/site/<hostname>/<ruta>`; en el navegador Fairwas puedes usar URLs HTTC del dominio de tu sitio.
