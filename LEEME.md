# Actualización Cabildo — etiquetas, cuotas y web pública (+ arreglos)

Descomprime en la **raíz de tu repositorio** (respetando `src/...`), sobrescribe,
y en **GitHub Desktop** verás los cambios para commit y push.

## Novedades

1. **Etiquetas de hermano + avisos segmentados** (Comunicados por etiqueta).
2. **Cuotas**: mensual (12 recibos), método de cobro (Domiciliación/Transferencia/
   Efectivo/Bizum), «En mora» manual, y **modelo de recibo** personalizado.
3. **Web pública MUCHO más personalizable**:
   - 3 plantillas, publicar/ocultar, URL `/w/tu-slug`.
   - **Diseño**: color principal y secundario, tema **claro/oscuro**, 3 tipografías,
     logo propio.
   - **Portada**: foto, altura (compacta/media/completa), oscurecido regulable,
     texto del botón.
   - **Secciones activables y reordenables**: Historia, **Titulares** (con foto),
     Cultos, **Galería**, **Actualidad** (últimos comunicados), Contacto.
   - **Redes sociales**, enlace a mapa y pie de página.
   - Botón **«Entrar» → portal del hermano** (`/hermano`).

## Arreglos (tras revisión de código)
- Cuotas mensuales en día 29–31 ya no caen en el mes equivocado.
- El spinner de carga ya no parpadea al refrescarse la sesión.
- Subir imágenes que no caben en el navegador ahora **avisa** en vez de fallar en silencio.

## Comprobado
- Las 14 páginas del panel + portal del hermano cargan con **0 errores de JavaScript**.
- Typecheck limpio y build correcto.
- Revisión de código pasada; los 3 bugs encontrados, corregidos.

## Para desplegar en modo local (sin base de datos)
En Vercel, **no** definas `VITE_SUPABASE_URL` ni `VITE_SUPABASE_ANON_KEY`.

## Pendiente (siguiente entrega)
- Suscripción de la hermandad (20 €/mes · 300 €/año, sin cobro real).
- Ajuste de mora (uno o dos cargos).
- Emails reales (Brevo/Resend) y, para web pública real multi-hermandad, guardarla
  en Supabase.
