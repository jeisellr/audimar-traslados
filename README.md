# Audimar Traslados

App web de reservas de traslados (personas y cargas pequeñas) en Antofagasta.

**Modo actual: GitHub Pages (sin servidor).** El precio se calcula en el navegador y la reserva se envía por WhatsApp.
Para pasar a Vercel con panel y reservas guardadas, cambiar `CON_SERVIDOR` a `true` en `index.html`.

- `index.html`: formulario de reserva para clientes, con precio estimado automático.
- `admin.html`: panel privado de reservas (requiere la variable `ADMIN_KEY`).
- `api/reservas.js`: guarda y lista reservas en Vercel Blob (privado).
- `api/cotizar.js`: sugerencias de direcciones y cálculo de precio.
- `lib/tarifas.js`: **aquí se cambian las tarifas** (por km, mínima, recargo nocturno, espera).

Variables de entorno en Vercel: `ADMIN_KEY` y `BLOB_READ_WRITE_TOKEN` (la crea Vercel al conectar el Blob store).
