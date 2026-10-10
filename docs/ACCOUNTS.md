# Cuentas de usuario en Fairwas

Las páginas publicadas pueden usar el cliente `window.fairwasAuth` que inyecta el navegador Fairwas. Las cuentas están separadas por sitio publicado: cada hostname tiene su propio espacio de usuarios.

## Registrar una cuenta

```js
const result = await window.fairwasAuth.register(
  "axel@example.com",
  "una contraseña larga",
  "Axel"
);
console.log(result.user);
```

La contraseña debe tener entre 10 y 128 caracteres. El registro crea la sesión automáticamente.

## Iniciar sesión

```js
const result = await window.fairwasAuth.login(
  "axel@example.com",
  "una contraseña larga"
);
console.log("Sesión iniciada", result.user);
```

## Consultar la sesión y cerrar sesión

```js
const session = await window.fairwasAuth.me();
console.log(session.user);

await window.fairwasAuth.logout();
```

Las funciones devuelven promesas. Usa `try/catch` para mostrar los errores de registro o inicio de sesión:

```js
try {
  const result = await window.fairwasAuth.login(email, password);
  showWelcome(result.user.display_name);
} catch (error) {
  showError(error.message);
}
```

## Seguridad y límites

- Las contraseñas se derivan con PBKDF2-SHA-256 y una sal individual; no se guardan en texto plano.
- Las sesiones usan tokens aleatorios con vencimiento de 30 días y se guardan como hashes en la base de datos.
- Los intentos de registro e inicio de sesión tienen un límite básico por sitio, dirección de red y correo.
- Cada sitio publicado tiene cuentas separadas del resto.
- Este es un primer sistema de autenticación: antes de usarlo para cuentas sensibles o un servicio público, añade verificación de correo, recuperación de cuenta, supervisión de abuso y una política de privacidad. Evita guardar datos sensibles en el almacenamiento del navegador.
- El cliente `window.fairwasAuth` está disponible en el navegador Fairwas; no se garantiza en navegadores externos.
