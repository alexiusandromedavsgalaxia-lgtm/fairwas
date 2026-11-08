# Recuperación de contraseña de CreatePage

La recuperación se realiza íntegramente en la web, sin correo electrónico ni servicios externos de pago.

## Funcionamiento

1. En «He olvidado mi contraseña», se introduce el correo asociado a la cuenta.
2. CreatePage presenta seis opciones de proyectos: tres pertenecen a la cuenta y tres son opciones ficticias.
3. La persona selecciona exactamente los tres proyectos reales.
4. Si la comprobación es correcta, puede establecer una contraseña nueva directamente en la web.

## Protección

- Los desafíos se generan en el servidor y se almacenan mediante un hash del token.
- Cada desafío caduca a los 10 minutos y permite como máximo tres intentos.
- Solo se guardan los identificadores de las respuestas correctas, no se confía en las respuestas enviadas por el navegador.
- El permiso para cambiar la contraseña es un token aleatorio de un solo uso que caduca a los 10 minutos.
- Al cambiar la contraseña se invalidan las sesiones anteriores y se crea una sesión nueva.
- La API no revela si el correo está registrado: las opciones falsas también se muestran cuando no existe una cuenta recuperable.
- No requiere Resend, claves API de correo ni variables de configuración de correo.

**Nota:** para utilizar este método, la cuenta debe tener al menos tres proyectos registrados en CreatePage.
