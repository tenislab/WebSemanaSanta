# Actualización Cabildo — mora, CMS premium, PDF en modelos (+ más)

Descomprime en la **raíz del repo** (respetando `src/...`) y sobrescribe.

## ⚠️ IMPORTANTE: hay una dependencia nueva
Esta entrega usa `pdfjs-dist` (para convertir PDF a imagen). Va incluida en
`package.json`. Tras descomprimir, **ejecuta una vez**:

    npm install

(GitHub Desktop hará el commit; Vercel ejecuta `npm install` solo al desplegar,
así que en producción no hay que hacer nada más.)

## Novedades
- **Modelo de papeleta y de recibo: admite PDF** — al subir un PDF se convierte
  su primera página en imagen y colocas los datos encima igual que con una foto.
  Ideal para usar el PDF de la imprenta.
- **Mora configurable** — en Cuotas → Ajustes, la hermandad decide si basta un
  cargo o hacen falta dos (proponer + confirmar).
- **Web pública**: botón **«Copiar enlace»** destacado.
- **CMS más premium**: pestañas tipo segmento y vista previa con marco de móvil.
- Arreglos de la revisión (interfaz de la mora; `schema.sql` con estado «En
  mora», `metodo_cobro` y datos de la propuesta para el modo Supabase real).

## Comprobado
- Subir PDF al modelo → se convierte a imagen y el editor funciona encima ✓
- 14 páginas + portal con 0 errores JS ✓ · typecheck y build limpios ✓

## Pendiente (para el final)
- Web pública en Supabase (que sea pública real y salga en Google).
- Emails reales (Brevo/Resend), cobro Stripe, publicación real en redes.
