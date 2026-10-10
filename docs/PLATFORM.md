# Plataforma de servicios de Fairwas

La infraestructura se configura **dentro del IDE de cada página**. Abre una página en CreatePage, pulsa **APIs / Backend** y crea el backend vinculado a ese proyecto. Cada página administra sus propios servicios, subdominios, rutas, claves, cuentas y almacenamiento. No es un panel global independiente ni un clon de OAuth de Google.

## Recursos que puedes crear

- Servicios de tipo API, cloud/backend, identidad, almacenamiento y gateway.
- Hostnames de servicio, por ejemplo `httc://api.mi-servicio.aploscabluchel`.
- Rutas HTTP GET, POST, PUT, PATCH y DELETE con respuestas JSON y variables `{{params.id}}`, `{{query.search}}` y `{{body.name}}`.
- Claves API secretas, guardadas como hash y revocables. La clave completa se muestra solo al generarla.
- Rutas protegidas que requieren `Authorization: Bearer <clave>`.
- Almacenamiento clave/valor JSON persistente en D1.
- Registros de conexión entre servicios y redirecciones URI HTTC.

## Ejemplo de llamada

Una vez que creas el backend del proyecto, registras el subdominio `api.miempresa.aploscabluchel` y defines la ruta `GET /api/status`, otra aplicación dentro de Fairwas puede usar:

```js
const response = await fetch("httc://api.mi-servicio.aploscabluchel/api/status");
const data = await response.json();
```

Para una ruta protegida, usa una clave solo desde un backend que controles:

```js
const response = await fetch("httc://api.mi-servicio.aploscabluchel/api/private", {
  headers: { Authorization: "Bearer " + serverSideApiKey }
});
```

No incluyas claves secretas en HTML, JavaScript enviado al navegador, repositorios públicos ni almacenamiento local del cliente.

## Servicio de identidad propio

Dentro del IDE de la página, crea un backend de tipo **Identidad y cuentas** y asígnale un subdominio de esa misma página, por ejemplo `cuentas.miempresa.aploscabluchel`. Ese dominio ofrece rutas independientes por servicio:

- `POST /auth/register` con `{ "email", "password", "display_name" }`
- `POST /auth/login` con `{ "email", "password" }`
- `GET /auth/me` con `Authorization: Bearer <token>`
- `POST /auth/logout` con `Authorization: Bearer <token>`

Ejemplo de registro desde otra aplicación Fairwas:

```js
const result = await fetch("httc://cuentas.mi-servicio.aploscabluchel/auth/register", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    email: "usuario@example.com",
    password: "una contraseña larga",
    display_name: "Usuario"
  })
}).then(r => r.json());
```

Cada servicio de identidad tiene su propia tabla de usuarios. Las contraseñas se derivan con PBKDF2-SHA-256 y sal individual; los tokens de sesión se guardan como hashes, caducan a los 30 días y existe un límite básico de intentos. El token devuelto es un secreto: no lo expongas en logs ni lo compartas entre aplicaciones sin consentimiento.

## API de administración

El panel integrado del IDE utiliza `/api/platform` para administrar el backend asociado al `site_id` del proyecto, con `action=list` por GET y acciones POST como `create`, `domain-create`, `key-create`, `route-create`, `redirect-create`, `connection-create` y `storage-set/get/delete`. Las acciones de administración requieren la cuenta de desarrollador de CreatePage.

## Límites importantes

- Los hostnames `.aploscabluchel` son nombres dentro del espacio HTTC de Fairwas. No crean por sí solos registros DNS públicos ni hacen que esos nombres abran en navegadores ajenos a Fairwas.
- La ejecución de rutas configuradas devuelve JSON; no ejecuta código arbitrario ni despliega contenedores/VMs.
- Los registros de conexión describen relaciones entre servicios, pero no sustituyen un SDK de identidad ni conceden permisos implícitos a otro servicio.
- El almacenamiento es una capa clave/valor experimental sobre D1, no almacenamiento de objetos ni un centro de datos físico.
- Antes de usarlo con usuarios reales, hacen falta pruebas de despliegue, cuotas, auditoría, permisos granulares, rotación de claves y controles contra abuso. No lo uses para datos sensibles sin esas protecciones.
