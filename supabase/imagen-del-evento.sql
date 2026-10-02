-- ============================================================================
-- Gobergo — que un acto pueda llevar su cartel
-- ============================================================================
--
-- Un evento tenía título, fecha, lugar y descripción, y ninguna imagen. Para
-- anunciar un triduo o una salida extraordinaria en la web pública, lo único
-- que se podía poner era texto; el cartel —que es lo que la gente mira—
-- no tenía dónde guardarse.
--
-- Guarda una DIRECCIÓN, no la imagen: el fichero sube al almacén de la
-- hermandad (`imagenes.sql`, cubo `imagenes`) y aquí queda su enlace. Es el
-- mismo trato que el escudo y las fotos de la web, y por el mismo motivo: esta
-- tabla se lee entera para pintar el calendario, y una imagen en base64
-- dentro de una fila se paga en cada carga de la pantalla.
--
-- Cabe también un enlace a una imagen de fuera, para la hermandad que ya tenga
-- sus carteles en su propia web y no quiera volver a subirlos.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

alter table eventos add column if not exists imagen text;

comment on column eventos.imagen is
  'Dirección del cartel o foto del acto: el enlace en el almacén de imágenes de '
  'la hermandad, o una dirección de fuera. Nunca la imagen en base64: esta tabla '
  'se lee entera para pintar el calendario.';
