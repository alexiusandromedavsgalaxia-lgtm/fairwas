# Plataforma de servicios de Fairwas

El panel **Cloud y servicios** crea recursos de plataforma bajo el protocolo HTTC. No es una cuenta de proveedor externo ni un clon de OAuth: son servicios que viven en el espacio de nombres de Fairwas.

## Recursos que puedes crear

- Servicios de tipo API, cloud/backend, identidad, almacenamiento y gateway.
- Hostnames de servicio, por ejemplo `httc://api.mi-servicio.aploscabluchel`.
- Rutas HTTP GET, POST, PUT, PATCH y DELETE con respuestas JSON y variables `{{params.id}}`, `{{query.search}}` y `{{body.name}}`.
- Claves API secretas, guardadas como hash y revocables. La clave completa se muestra solo al generarla.
- Rutas protegidas que requieren `Authorization: Bearer <clave>`.
- Almacenamiento clave/valor JSON persistente en D1.
- Registros de conexión entre servicios y redirecciones URI HTTC.

## Ejemplo de llamada

Una vez que registras el dominio y la ruta `GET /api/status`, una aplicación dentro de Fairwas puede usar:

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

## API de administración

La interfaz utiliza `/api/platform` con `action=list` por GET y acciones POST como `create`, `domain-create`, `key-create`, `route-create`, `redirect-create`, `connection-create` y `storage-set/get/delete`. Las acciones de administración requieren la cuenta de desarrollador de CreatePage.

## Límites importantes

- Los hostnames `.aploscabluchel` son nombres dentro del espacio HTTC de Fairwas. No crean por sí solos registros DNS públicos ni hacen que esos nombres abran en navegadores ajenos a Fairwas.
- La ejecución de rutas configuradas devuelve JSON; no ejecuta código arbitrario ni despliega contenedores/VMs.
- Los registros de conexión describen relaciones entre servicios, pero no sustituyen un SDK de identidad ni conceden permisos implícitos a otro servicio.
- El almacenamiento es una capa clave/valor experimental sobre D1, no almacenamiento de objetos ni un centro de datos físico.
- Antes de usarlo con usuarios reales, hacen falta pruebas de despliegue, cuotas, auditoría, permisos granulares, rotación de claves y controles contra abuso. No lo uses para datos sensibles sin esas protecciones.
