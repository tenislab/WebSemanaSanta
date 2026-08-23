-- ============================================================================
-- EL ALMACÉN DE IMÁGENES
--
-- Hasta ahora las fotos de la web viajaban DENTRO del contenido, escritas como
-- texto (`data:image/webp;base64,...`). Funciona, pero tiene tres techos:
--
--   1. La web entera es una sola fila de la tabla `web_publica`. Veinte fotos
--      de una salida y esa fila pesa quince megas: cada guardado los sube
--      enteros otra vez, y cada visita los descarga enteros aunque no cambie
--      ni una coma.
--   2. El navegador no puede guardar en caché una foto que va dentro del HTML.
--      La misma imagen se descarga en cada página.
--   3. Y lo que bloqueaba de verdad: WhatsApp, Facebook y X NO leen una
--      imagen en `data:`. Por eso al pegar el enlace de la hermandad salía la
--      tarjeta sin foto. Para que salga tiene que haber una dirección de
--      verdad, y para eso hace falta esto.
--
-- Ejecútalo UNA VEZ en el SQL Editor de tu proyecto, después de
-- `multi-hermandad.sql` (de ahí sale `hermandad_actual()`).
--
-- CADA HERMANDAD, EN SU CARPETA. Todas comparten el mismo cubo, así que lo
-- primero de la ruta es el id de la hermandad:
--
--     imagenes/6f3a…-e21b/web/9c1d…-4a7f.webp
--
-- No es orden: es la seguridad. Las políticas de abajo miran esa primera
-- carpeta para decidir quién puede escribir. Una foto subida fuera de ella la
-- rechaza el propio Storage.
--
-- POR QUÉ EL CUBO ES PÚBLICO. Lo que hay dentro son las fotos de la web de la
-- hermandad: están puestas para que las vea todo el mundo, y la tarjeta de
-- WhatsApp no funciona de otra manera. Las fotos del CENSO también viven aquí,
-- bajo `hermanos/`, con un nombre aleatorio de 128 bits que no aparece en
-- ninguna página pública. La alternativa —cubo privado y direcciones firmadas—
-- obligaría a resolver cada foto con una llamada al servidor antes de
-- pintarla, caduca a las horas y rompe el carné impreso. Si algún día una
-- hermandad necesita lo otro, el sitio donde se cambia es este archivo y
-- `src/lib/almacenImagenes.ts`, no las cincuenta pantallas que enseñan fotos.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('imagenes', 'imagenes', true)
on conflict (id) do update set public = true;

-- LEER: cualquiera. Es una web pública; el cubo lo sirve sin pasar por aquí,
-- pero la política se deja escrita para que no dependa de una casilla del
-- panel de Supabase que alguien puede desmarcar sin querer.
drop policy if exists "imagenes_leer" on storage.objects;
create policy "imagenes_leer" on storage.objects
  for select
  to public
  using (bucket_id = 'imagenes');

-- ESCRIBIR: solo con sesión iniciada, y solo dentro de la carpeta de tu
-- hermandad. Es lo que impide que una hermandad pise las fotos de otra.
drop policy if exists "imagenes_subir" on storage.objects;
create policy "imagenes_subir" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'imagenes'
    and (storage.foldername(name))[1] = hermandad_actual()::text
  );

drop policy if exists "imagenes_actualizar" on storage.objects;
create policy "imagenes_actualizar" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'imagenes'
    and (storage.foldername(name))[1] = hermandad_actual()::text
  )
  with check (
    bucket_id = 'imagenes'
    and (storage.foldername(name))[1] = hermandad_actual()::text
  );

drop policy if exists "imagenes_borrar" on storage.objects;
create policy "imagenes_borrar" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'imagenes'
    and (storage.foldername(name))[1] = hermandad_actual()::text
  );
