# CIAA Operarios

App para que los operarios de la granja del CIAA (UNAG) registren desde el teléfono:

- **Producción del día:** huevos (cartones y sueltos), sucios, quebrados, eliminados, mortalidad, alimento y peso del huevo.
- **Uniformidad:** pesos de la muestra de aves; calcula el peso promedio y el % de aves dentro de ±10 % del promedio.
- **Ventas:** cliente, producto, cantidad, precio, forma de pago y recibo.
- **Mis envíos:** estado de cada registro (en revisión, aprobado o rechazado con motivo) y corrección de los pendientes.

Publicada en **https://gardon-hub.github.io/ciaa-operarios/**. Se puede instalar en el teléfono («Agregar a la pantalla de inicio») y funciona sin señal: los registros se guardan en el teléfono y se envían al volver la conexión.

## Cómo se enlaza con CIAA Digital

Usa la misma base de datos que [CIAA Digital](https://github.com/gardon-hub/ciaa-agro-smart). Nada de lo que envía un operario entra a CIAA Digital hasta que un técnico, coordinador o administrador lo aprueba en **CIAA Digital → Revisión → Operarios**. Las ventas solo las aprueban administradores y coordinadores.

Las cuentas de los operarios se crean en **CIAA Digital → Revisión → Cuentas**. Una cuenta de operario solo puede enviar registros y ver los suyos; la base de datos no le devuelve ningún otro dato de CIAA Digital.

## Desarrollo

```bash
npm install
npm test
npm run dev
```

## Publicación

La página se sirve desde la rama `gh-pages`, que contiene la app compilada:

```bash
npm test && npm run build
npx gh-pages -d dist   # o subir el contenido de dist/ a la rama gh-pages
```
