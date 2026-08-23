-- =============================================================================
--   LAS COPIAS DE SEGURIDAD, GUARDADAS SOLAS
-- =============================================================================
--
-- Hasta ahora la copia había que descargarla a mano. Funciona el día que
-- alguien se acuerda, y el problema es que nadie se acuerda: se pulsa el botón
-- la semana que se monta todo y no se vuelve a pulsar en dos años.
--
-- Y el censo de una hermandad es EL dato que no se puede volver a escribir.
-- Cuatrocientas fichas con su antigüedad, su cuota y su sitio en el cortejo no
-- se reconstruyen: o están, o se han perdido.
--
-- Esto es un cubo donde la aplicación deja una copia cada semana, sola.
--
-- POR QUÉ UN CUBO PRIVADO Y NO EL DE LAS IMÁGENES. Porque una copia lleva el
-- censo entero: nombres, DNI, teléfonos, direcciones, IBAN y datos de salud.
-- Es lo más sensible que hay en toda la aplicación. El cubo de las imágenes es
-- público —tiene que serlo, para que WhatsApp lea las fotos— y aquí eso sería
-- publicar el censo de la hermandad en internet.
--
-- Ejecútalo una vez en el SQL Editor, después de `multi-hermandad.sql`.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('copias', 'copias', false)
on conflict (id) do update set public = false;

/*
 * CADA HERMANDAD, EN SU CARPETA, y solo la suya.
 *
 * Es la misma regla que el archivo documental, pero aquí importa más: quien
 * pudiera leer la carpeta de otra hermandad se llevaría su censo completo de
 * una sola descarga.
 *
 * Y NO LO VE UN HERMANO. `auth_es_hermano()` fuera: el hermano entra en su área
 * a ver SU ficha, no el censo de los demás en un archivo.
 */
drop policy if exists "copias_leer" on storage.objects;
create policy "copias_leer" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'copias'
    and (storage.foldername(name))[1] = hermandad_actual()::text
    and not auth_es_hermano()
  );

drop policy if exists "copias_guardar" on storage.objects;
create policy "copias_guardar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'copias'
    and (storage.foldername(name))[1] = hermandad_actual()::text
    and not auth_es_hermano()
  );

/*
 * BORRAR SÍ, y hace falta: las copias viejas se van tirando para que el cubo no
 * crezca sin fin. Lo que NO se puede es sobrescribir una copia existente — no
 * hay política de update a propósito. Una copia que se puede pisar no es una
 * copia de seguridad.
 */
drop policy if exists "copias_borrar" on storage.objects;
create policy "copias_borrar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'copias'
    and (storage.foldername(name))[1] = hermandad_actual()::text
    and not auth_es_hermano()
  );
