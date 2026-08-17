# Actualización Cabildo — suscripción + CMS de la web

Descomprime en la **raíz del repo** (respetando `src/...`), sobrescribe y sube por
GitHub Desktop.

## Novedades de esta entrega

### Suscripción (bloquea el panel)
- Sin suscripción activa, el panel muestra un **muro** con los planes (20 €/mes o
  300 €/año, sin prueba gratis). «Suscribirse» activa la cuenta (cobro simulado
  hasta conectar Stripe).

### Web pública rehecha como CMS por pestañas (como el panel de Amargura)
- Pestañas: **Diseño y secciones · Fotos de portada · Actualidad · Cultos ·
  Páginas y textos · Boletines · Contacto**.
- **Fotos de portada**: varias, se alternan de fondo.
- **Actualidad**: noticias con foto, fecha y estado publicada/oculta.
- **Páginas y textos**: antetítulo, título, entradilla, párrafos y fotos.
- **Boletines**: lista con título/subtítulo (el PDF, al conectar almacenamiento).
- **Mini-previsualización en vivo** a la derecha, se refresca al editar.

## Cómo ver la web
1. En el panel: **Web pública** → pestaña **«Diseño y secciones»** → marca
   **«Web publicada»** y pon un enlace (slug), p. ej. `mi-hermandad`.
2. La **vista previa** aparece a la derecha del editor (se actualiza sola).
3. Para verla a pantalla completa: botón **«Ver mi web»** (arriba) o abre en el
   navegador `TU-DOMINIO/w/tu-slug` (en local: `localhost:PUERTO/w/tu-slug`).

> Importante: por ahora la web vive en el navegador donde se edita (modo local).
> Para que sea **pública de verdad** para cualquiera y desde cualquier
> dispositivo, falta guardarla en Supabase (lo dejamos para el final).

## Pendiente
- Mora configurable (uno o dos cargos).
- Emails reales (Brevo/Resend) y web pública en Supabase — para el final.
