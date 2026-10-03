-- ============================================================================
-- Gobergo — hasta dónde sale cada documento del archivo
-- ============================================================================
--
-- EL PROBLEMA, QUE ERA UNA PROMESA SIN CUMPLIR.
--
-- Al subir un documento, el formulario preguntaba «Quién puede verlo: Todos
-- los hermanos / Restringido a cargos concretos». Y el propio tipo de datos lo
-- decía con todas las letras: «null = visible para cualquier hermano
-- autenticado».
--
-- No era verdad. `cargos_con_acceso` solo filtra lo que se ve DENTRO del
-- panel, entre cargos de la junta: la política de la tabla lleva
-- `not auth_es_hermano()`, y la del cubo de archivos también. O sea que un
-- hermano no podía abrir las reglas de su hermandad por ningún camino — ni las
-- reglas, ni un boletín, ni nada—, y la pantalla donde se sube decía que sí.
--
-- LO QUE AÑADE ESTO: una columna que dice HASTA DÓNDE sale el documento, que
-- es una pregunta distinta de la de los cargos y hasta ahora iban mezcladas.
--
--   'junta'     — solo el panel. Es lo de siempre y el valor por defecto: un
--                 documento que ya está subido no cambia de sitio al
--                 actualizar, que es lo último que se quiere de una
--                 actualización que toca permisos.
--   'hermanos'  — además, el hermano lo ve en su área, entrando con su clave.
--   'web'       — además, cualquiera lo ve en la web pública, sin entrar.
--
-- Las tres son acumulativas: lo que está en la web lo ve también el hermano, y
-- la junta ve todo. Un solo valor y no tres interruptores, porque con tres
-- caben combinaciones que no significan nada («en la web pero no para los
-- hermanos») y alguien las marcaría.
--
-- EL FRENO QUE IMPORTA. Un documento restringido a cargos concretos NO puede
-- salir de la junta. Si no, un acta reservada al Hermano Mayor y al Fiscal
-- acabaría en internet por marcar un desplegable, y esas dos decisiones se
-- toman en momentos distintos y a veces por personas distintas. Lo frena un
-- `check` de la tabla, no la pantalla: una regla de negocio que protege datos
-- no se deja en el navegador.
--
-- POR QUÉ LA WEB PÚBLICA VA POR FUNCIÓN Y NO POR POLÍTICA.
--
-- Se copia el patrón de `hermandad_de_la_web`: una función `security definer`
-- que devuelve LAS COLUMNAS UNA A UNA y solo si la web está publicada. Abrir
-- `documentos` a `anon` con una política sería una puerta más ancha: el día que
-- a esta tabla se le añada una columna con algo delicado, se colaría sola. Así
-- hay que volver aquí a mano para que salga.
--
-- EL ARCHIVO SÍ NECESITA POLÍTICA, y no hay vuelta: `storage.objects` no se lee
-- por función. Las dos nuevas van atadas a la fila del documento, así que un
-- fichero solo se descarga si SU documento lo permite — y la del visitante
-- exige además que la web esté publicada.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

alter table documentos add column if not exists publicacion text not null default 'junta';

comment on column documentos.publicacion is
  'Hasta dónde sale el documento: junta (solo el panel), hermanos (además, el '
  'área del hermano) o web (además, la web pública, sin entrar). Acumulativas. '
  'Por defecto junta: actualizar no mueve de sitio nada de lo que ya está.';

do $$
begin
  -- Idempotente a mano: `add constraint if not exists` no existe en Postgres.
  if not exists (
    select 1 from pg_constraint where conname = 'documentos_publicacion_valida'
  ) then
    alter table documentos add constraint documentos_publicacion_valida
      check (publicacion in ('junta', 'hermanos', 'web'));
  end if;

  /*
   * LO RESTRINGIDO NO SALE. Va en la tabla y no en la pantalla porque es lo
   * que separa «se me ha ido el ratón» de «un acta reservada al Fiscal está en
   * Google». Y se comprueba en los dos sentidos: ni se puede publicar lo
   * restringido, ni se puede restringir lo ya publicado.
   */
  if not exists (
    select 1 from pg_constraint where conname = 'documentos_restringido_no_sale'
  ) then
    alter table documentos add constraint documentos_restringido_no_sale
      check (
        publicacion = 'junta'
        or cargos_con_acceso is null
        or array_length(cargos_con_acceso, 1) is null
      );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- EL HERMANO, EN SU ÁREA
-- ----------------------------------------------------------------------------
--
-- Ve los documentos de SU hermandad marcados para hermanos o para la web, y
-- nada más. No ve los de la junta, no ve los restringidos (no pueden estar
-- marcados, por el `check` de arriba) y no ve los de otra hermandad: la
-- frontera de siempre, `hermandad_actual()`, que para un hermano resuelve a la
-- suya.
drop policy if exists "documentos_hermano_select" on documentos;
create policy "documentos_hermano_select" on documentos for select to authenticated
  using (
    auth_es_hermano()
    and hermandad_id = hermandad_actual()
    and publicacion in ('hermanos', 'web')
  );

-- ----------------------------------------------------------------------------
-- EL VISITANTE DE LA WEB, POR FUNCIÓN
-- ----------------------------------------------------------------------------
--
-- Las columnas, una a una. NO salen `archivado_por` (es el nombre de quien lo
-- archivó, que es una persona y no hace falta para descargar un PDF),
-- `cargos_con_acceso`, `proveedor`, `vigencia_hasta` ni `estado_expediente`:
-- son de la gestión interna. Si mañana hace falta alguna, se añade aquí a
-- mano, y eso es justamente la gracia.
--
-- DROP ANTES DEL CREATE: `create or replace` no puede cambiar el tipo que
-- devuelve, y el día que a esta función se le añada una columna, Postgres
-- cortaría en la base de una hermandad que ya tiene la versión vieja — o sea,
-- en producción y a mitad de ACTUALIZAR.sql. Ya ha pasado dos veces en este
-- proyecto.
drop function if exists documentos_de_la_web(text);
create or replace function documentos_de_la_web(p_slug text)
returns table (
  id uuid, nombre text, categoria text, fecha text, descripcion text,
  archivo_nombre text, archivo_tipo text, archivo_tamano bigint
)
language sql stable security definer set search_path = public as $$
  select d.id, d.nombre, d.categoria, d.fecha, d.descripcion,
         d.archivo_nombre, d.archivo_tipo, d.archivo_tamano
  from documentos d
  join web_publica w on w.hermandad_id = d.hermandad_id
  where w.slug = p_slug
    and w.publicada
    and d.publicacion = 'web'
  order by d.fecha desc, d.numero desc
$$;
grant execute on function documentos_de_la_web(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- EL ARCHIVO ADJUNTO
-- ----------------------------------------------------------------------------
--
-- El fichero vive en `documentos/<hermandad_id>/<documento_id>`, así que la
-- segunda carpeta del nombre es el id del documento y por ahí se ata cada
-- objeto a su fila. La política de la junta no se toca: sigue siendo la suya.
--
-- SOLO LECTURA las dos. Un hermano no sube nada al archivo documental y un
-- visitante menos: `for select`, no `for all`.

-- El hermano descarga lo que puede ver.
drop policy if exists "documentos_archivo_hermano" on storage.objects;
create policy "documentos_archivo_hermano" on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos'
    and auth_es_hermano()
    and split_part(name, '/', 1) = hermandad_actual()::text
    and exists (
      select 1 from documentos d
      where d.id::text = split_part(storage.objects.name, '/', 2)
        and d.hermandad_id = hermandad_actual()
        and d.publicacion in ('hermanos', 'web')
    )
  );

-- Y el visitante, lo que está en una web publicada.
--
-- Sin `hermandad_actual()` aquí: un visitante no tiene sesión, así que la
-- hermandad sale de la propia fila del documento. Y por eso se exige
-- `w.publicada`: una hermandad que está preparando su web no reparte sus PDF
-- todavía.
drop policy if exists "documentos_archivo_publico" on storage.objects;
create policy "documentos_archivo_publico" on storage.objects for select to anon
  using (
    bucket_id = 'documentos'
    and exists (
      select 1 from documentos d
      join web_publica w on w.hermandad_id = d.hermandad_id
      where d.id::text = split_part(storage.objects.name, '/', 2)
        and d.publicacion = 'web'
        and w.publicada
    )
  );

-- ----------------------------------------------------------------------------
-- DÓNDE ESTÁ EL FICHERO DE UN DOCUMENTO PÚBLICO
-- ----------------------------------------------------------------------------
--
-- El adjunto vive en `documentos/<hermandad_id>/<documento_id>`, y quien pasa
-- por la web NO conoce el id de la hermandad: solo tiene el slug que hay en la
-- barra de direcciones. Sin esto, el navegador tendría que adivinar la carpeta
-- —o habría que mandarle el id de la hermandad, que es justo lo que no hace
-- falta que sepa— y el enlace de descarga no funcionaría.
--
-- Solo contesta por un documento que de verdad está en una web publicada: es
-- la misma condición que la política del cubo, escrita dos veces a propósito.
-- Si alguien prueba con el id de un acta, esto devuelve vacío y la descarga no
-- llega ni a intentarse.
drop function if exists ruta_del_documento(text, uuid);
create or replace function ruta_del_documento(p_slug text, p_documento uuid)
returns text
language sql stable security definer set search_path = public as $$
  select d.hermandad_id::text || '/' || d.id::text
  from documentos d
  join web_publica w on w.hermandad_id = d.hermandad_id
  where w.slug = p_slug
    and w.publicada
    and d.id = p_documento
    and d.publicacion = 'web'
  limit 1
$$;
grant execute on function ruta_del_documento(text, uuid) to anon, authenticated;
