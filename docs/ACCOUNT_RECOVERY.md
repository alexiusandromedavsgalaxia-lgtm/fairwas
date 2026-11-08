# Recuperación de contraseña de CreatePage

CreatePage permite solicitar un enlace de recuperación desde «He olvidado mi contraseña» en el formulario de inicio de sesión.

## Configuración necesaria en Cloudflare Pages

El backend envía los mensajes mediante la API de Resend. Configura estos secretos/variables en el proyecto de Cloudflare Pages para cada entorno que vaya a enviar correos:

- `RESEND_API_KEY`: API key privada de Resend. Guárdala como **secret**, nunca en el frontend ni en Git.
- `MAIL_FROM`: remitente verificado en Resend, por ejemplo `CreatePage <cuentas@tu-dominio-verificado.example>`. Sustituye el ejemplo por una dirección de un dominio que hayas verificado en Resend.

No compartas la API key en el repositorio ni en conversaciones. Tras guardar los secretos, vuelve a desplegar Pages para que las Functions reciban las variables.

## Funcionamiento y seguridad

- Los enlaces se generan con 256 bits aleatorios y solo se almacena su hash en D1.
- Cada enlace caduca a los 30 minutos y solo puede utilizarse una vez.
- Al cambiar la contraseña se invalidan las sesiones anteriores y se crea una sesión nueva.
- Se limita la emisión a tres solicitudes por cuenta cada 15 minutos.
- La respuesta de solicitud no confirma si una dirección está registrada.
- Si falta la configuración de correo o Resend rechaza el envío, la API devuelve un error de configuración/entrega; no cambia la contraseña.

La URL de retorno es `https://createpage.fair/registry?reset_token=...`.
