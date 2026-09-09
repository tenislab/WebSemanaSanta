-- =============================================================================
--   RESTAURAR LA COPIA DE UNA HERMANDAD, SIN TOCAR A LAS DEMÁS
-- =============================================================================
--
-- ESTE ES EL FICHERO MÁS PELIGROSO DEL PROYECTO. Léelo entero antes de tocarlo.
--
-- -----------------------------------------------------------------------------
-- DE DÓNDE SALE
-- -----------------------------------------------------------------------------
--
-- Gobergo lleva desde el principio un botón de «Descargar copia» que funciona,
-- y una copia automática semanal en el cubo `copias` que también funciona. Lo
-- que no había era manera de VOLVER A METERLA.
--
-- Está dicho con todas las letras en `src/lib/backup.ts`, en `sePuedeRestaurar()`:
-- con la base de datos conectada, restaurar estaba PROHIBIDO. Y con razón: lo
-- que hacía era escribir en el navegador, y el navegador es un espejo — al
-- recargar, cada pantalla volvía a leer de la base y lo machacaba. Salía
-- «Copia restaurada. Recargando…», recargaba, y estaba todo igual que antes.
-- Se prefirió un botón desactivado que dice la verdad a uno que miente.
--
-- Pero eso deja a una hermandad de verdad con copias que no se pueden usar. Y
-- la copia que no se puede restaurar no es una copia: es un archivo.
--
-- Supabase hace copia del PROYECTO ENTERO, con las cincuenta hermandades
-- dentro. Restaurarla para deshacer el error de una sola sería tirar hacia
-- atrás el trabajo de las otras cuarenta y nueve. Nadie va a hacer eso, así que
-- en la práctica esa copia tampoco existe para este caso.
--
-- Esto es lo que faltaba: vaciar UNA hermandad para que la aplicación vuelva a
-- meter sus filas.
--
-- -----------------------------------------------------------------------------
-- LAS CUATRO CERRADURAS
-- -----------------------------------------------------------------------------
--
-- Una función que borra el censo entero de una hermandad no puede llamarse por
-- accidente. Lleva cuatro cerraduras, y las cuatro tienen que abrirse:
--
--   1. SOLO EL TITULAR. Ni el tesorero, ni el secretario, ni un hermano. El
--      titular es quien responde de los datos.
--   2. HAY QUE DECIR A QUIÉN. Se le pasa el identificador de la hermandad y
--      tiene que coincidir con la del que llama. Sin esto, una llamada suelta
--      sin argumentos borraría lo que hubiera al otro lado.
--   3. BORRA POR `hermandad_id = hermandad_actual()`, siempre, en cada tabla.
--      Aunque el argumento viniera mal, no puede alcanzar a otra hermandad.
--   4. QUEDA ESCRITO ANTES DE BORRAR, en `registro_actividad` — que NO está en
--      la lista de tablas que se vacían, así que el apunte sobrevive a la
--      propia restauración. Es la caja negra.
--
-- -----------------------------------------------------------------------------
-- LO QUE ESTO **NO** HACE, Y HAY QUE SABERLO
-- -----------------------------------------------------------------------------
--
-- No mete las filas: solo vacía. Las mete la aplicación después, tabla por
-- tabla, desde el archivo (ver `src/lib/restaurar.ts`). O sea que entre el
-- vaciado y el llenado hay unos segundos en que la hermandad no tiene datos.
--
-- Es una ventana real y no se puede cerrar desde el navegador: haría falta que
-- todo —vaciar y llenar— ocurriera dentro de una sola transacción en el
-- servidor, y para eso habría que mandarle el archivo entero, que pesa megas.
--
-- Lo que sí se hace es lo importante: `src/lib/restaurar.ts` DESCARGA UNA COPIA
-- DE SEGURIDAD DE LO QUE HAY AHORA antes de vaciar nada, y no sigue si esa
-- descarga falla. Si la restauración se corta a la mitad, lo que había está en
-- un archivo en el disco de quien la lanzó.
--
-- Ejecútalo después de `multi-hermandad.sql` y de `registro-actividad.sql`.
-- Volver a ejecutarlo no hace nada.
-- =============================================================================

/**
 * Vacía las tablas de datos de la hermandad de quien llama, para que se pueda
 * volcar encima una copia. Devuelve cuántas filas ha borrado de cada tabla.
 *
 * `security invoker` A PROPÓSITO, y es una decisión, no un descuido: así las
 * políticas de RLS siguen aplicándose sobre el que llama. La cerradura número 3
 * (`where hermandad_id = hermandad_actual()`) y RLS dicen lo mismo, y eso es
 * exactamente lo que se quiere: dos cerraduras independientes que tienen que
 * fallar las dos a la vez para que esto alcance a otra hermandad.
 *
 * Con `security definer` se saltaría RLS y quedaría UNA sola cerradura entre
 * este `delete` y el censo de las otras cuarenta y nueve hermandades. No.
 */
/*
 * DROP ANTES DEL CREATE: «create or replace» NO PUEDE CAMBIAR EL TIPO QUE
 * DEVUELVE. El día que a esta función se le añada una columna al `returns
 * table`, Postgres corta con «cannot change return type of existing function»
 * — y no aquí, donde se instala desde cero y no existe todavía, sino en la
 * base de una hermandad que ya tiene la versión vieja. O sea, en producción y
 * a mitad de ACTUALIZAR.sql. Ha pasado dos veces.
 */
drop function if exists vaciar_hermandad_para_restaurar(uuid);
create or replace function vaciar_hermandad_para_restaurar(confirmacion uuid)
returns table (tabla text, borradas bigint)
language plpgsql security invoker set search_path = public as $$
declare
  mia uuid;
  quien text;
  t text;
  n bigint;
  /*
   * LAS MISMAS TABLAS QUE ENTRAN EN LA COPIA, y en el mismo orden que
   * `TABLAS_COPIA` en `src/lib/backup.ts`. Si tocas una lista, toca la otra:
   * hay una prueba que las compara (`pruebas/restaurar.prueba.mjs`), porque
   * una tabla que se copia y no se vacía se queda con las filas viejas
   * MEZCLADAS con las de la copia, y eso no da ningún error — da un censo con
   * hermanos duplicados que nadie sabe de dónde salen.
   *
   * Se vacía en ORDEN INVERSO por si algún día alguna clave ajena deja de ser
   * `on delete cascade`. Hoy lo son todas y daría igual; el día que no, esto
   * ya está bien puesto.
   */
  tablas text[] := array[
    'hermanos', 'tramos', 'cuotas', 'papeletas', 'movimientos', 'incidencias',
    'enseres', 'documentos', 'comunicados', 'cuentas_sociales', 'permisos_cargo',
    'solicitudes_alta', 'conceptos_cuota', 'opciones_papeleta', 'catalogos',
    'eventos', 'personal', 'hermandad_settings', 'web_publica', 'mensajes_web'
  ];
begin
  mia := hermandad_actual();
  if mia is null then
    raise exception 'No se sabe de qué hermandad eres.';
  end if;

  -- Cerradura 2: hay que decir a quién, y tiene que ser la tuya.
  if confirmacion is distinct from mia then
    raise exception 'El identificador de confirmación no es el de tu hermandad.';
  end if;

  -- Cerradura 1: solo el titular.
  if not exists (select 1 from titulares x
                  where x.auth_user_id = auth.uid() and x.hermandad_id = mia) then
    raise exception 'Solo quien figura como titular de la hermandad puede restaurar una copia.';
  end if;

  -- Cerradura 4: la caja negra, ANTES de tocar nada.
  select coalesce(email, '') into quien from auth.users where id = auth.uid();
  insert into registro_actividad (hermandad_id, autor_id, autor_nombre, accion, sobre_tipo, detalle)
  values (mia, auth.uid(), quien, 'restaurar_copia', 'hermandad',
          'Se han vaciado los datos de la hermandad para volcar encima una copia de seguridad.');

  for i in reverse array_length(tablas, 1) .. 1 loop
    t := tablas[i];
    -- Una tabla que todavía no existe en esta base (base atrasada) se salta en
    -- vez de reventar la restauración entera a la mitad.
    continue when to_regclass('public.' || t) is null;
    continue when not exists (
      select 1 from information_schema.columns c
       where c.table_schema = 'public' and c.table_name = t and c.column_name = 'hermandad_id');

    -- Cerradura 3. `mia` y no `hermandad_actual()` dentro del bucle: se resuelve
    -- una vez, así no puede cambiar a media faena.
    execute format('delete from %I where hermandad_id = $1', t) using mia;
    get diagnostics n = row_count;
    tabla := t; borradas := n; return next;
  end loop;
end $$;

grant execute on function vaciar_hermandad_para_restaurar(uuid) to authenticated;

/**
 * Con qué hermandad estoy trabajando ahora mismo. La aplicación la necesita
 * para poder pasar la confirmación de arriba: sin esto tendría que adivinar su
 * propio identificador, y adivinar es justo lo que no queremos aquí.
 */
create or replace function mi_hermandad_id() returns uuid
language sql stable security definer set search_path = public as $$
  select hermandad_actual()
$$;
grant execute on function mi_hermandad_id() to authenticated;
