-- ============================================================================
--   UNA HERMANDAD NO SE PODÍA BORRAR
-- ============================================================================
--
-- `delete from hermandades where id = ...` fallaba entero y no borraba nada:
--
--   ERROR:  insert or update on table "registro_actividad" violates foreign
--           key constraint "registro_actividad_hermandad_id_fkey"
--   DETAIL: Key (hermandad_id)=(…) is not present in table "hermandades".
--   CONTEXT: PL/pgSQL function apuntar_cambio() line 32
--
-- LA CADENA. Borrar la hermandad arrastra en cascada su censo, sus cuotas, sus
-- papeletas y sus apuntes. Cada una de esas bajas dispara `apuntar_cambio()`
-- —el registro de «quién hizo qué», que existe por el artículo 32 del RGPD—, y
-- ese disparador intenta escribir una fila de registro CON EL ID DE LA
-- HERMANDAD. Que ya no está. La clave ajena lo rechaza y se cae el borrado
-- completo.
--
-- DÓNDE MUERDE. En `BORRAR-PRUEBAS.sql`, que es justo el archivo que se ejecuta
-- para quitar las hermandades de prueba cuando entra la primera de verdad. Se
-- lanza, da un error largo de clave ajena que no dice nada de esto, y las
-- hermandades de prueba siguen ahí.
--
-- EL ARREGLO. Si la hermandad ya no existe, no se apunta nada y se sigue.
-- No es que se pierda el rastro: es que el rastro de una hermandad que se ha
-- ido no tiene dónde vivir —la propia tabla de registro se borra con ella— y
-- lo que hay que conservar de un borrado así es la copia de seguridad, no una
-- línea de registro huérfana.
--
-- Se toca SOLO el disparador. La cascada, las claves ajenas y el registro se
-- quedan como estaban.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada.
-- ============================================================================

create or replace function apuntar_cambio() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  que text;
  sobre text;
  quien uuid;
  -- La fila, en JSON. Es la clave de que esto funcione en las cuatro tablas.
  --
  -- Escrito como `new.nombre`, PL/pgSQL revienta en las tablas que no tienen
  -- esa columna —papeletas, cuotas, movimientos— con «record "new" has no
  -- field "nombre"». Y no revienta al crear el disparador, sino al guardar la
  -- primera fila: el SQL se instala sin una queja y lo que deja de funcionar
  -- es emitir papeletas, cobrar cuotas y apuntar en tesorería.
  --
  -- Con `->>` no hay tal cosa: la columna que no existe vale NULL y ya está.
  fila jsonb;
  v_hermandad uuid;
begin
  quien := auth.uid();
  -- Sin sesión es el editor SQL o una función interna. Se apunta igual, pero
  -- sin autor: es información, no una acusación.
  que := lower(tg_argv[0]) || '_' || lower(tg_op);
  fila := to_jsonb(case tg_op when 'DELETE' then old else new end);
  -- Cómo se llama la fila, según lo que tenga cada tabla: el censo tiene
  -- `nombre`; una cuota o un apunte, `concepto`; una papeleta, su número.
  sobre := coalesce(
    fila->>'nombre',
    fila->>'concepto',
    fila->>'titulo',
    nullif(fila->>'numero', ''),
    ''
  );

  v_hermandad := coalesce((fila->>'hermandad_id')::uuid, hermandad_actual());

  /*
   * SI LA HERMANDAD YA NO ESTÁ, NO SE APUNTA NADA.
   *
   * Es el caso de borrar una hermandad entera: la cascada va bajando sus
   * hermanos, cuotas y papeletas, cada baja dispara esto, y esto intentaba
   * escribir una fila de registro con el id de una hermandad que acaba de
   * desaparecer. La clave ajena lo rechazaba y se caía el borrado completo,
   * dejando la hermandad donde estaba y un error que no explicaba nada.
   *
   * No se pierde ningún rastro que hiciera falta: la tabla de registro también
   * se borra con la hermandad, así que esa fila no habría durado ni un
   * instante. Lo que conserva un borrado de estos es la copia de seguridad.
   *
   * Y el caso normal —una baja suelta, un recibo anulado— no cambia: ahí la
   * hermandad existe y se apunta igual que siempre.
   */
  if v_hermandad is null or not exists (select 1 from hermandades where id = v_hermandad) then
    return case tg_op when 'DELETE' then old else new end;
  end if;

  insert into registro_actividad
    (hermandad_id, autor_id, autor_nombre, accion, sobre_tipo, sobre_id, sobre_nombre, detalle, origen)
  values (
    v_hermandad,
    quien,
    quien_soy_ahora(),
    que,
    tg_argv[0],
    fila->>'id',
    sobre,
    case tg_op
      when 'INSERT' then 'Creado desde la base de datos'
      when 'DELETE' then 'Borrado'
      else 'Modificado'
    end,
    'base'
  );

  return case tg_op when 'DELETE' then old else new end;
end $$;

comment on function apuntar_cambio() is
  'Escribe el registro de «quién hizo qué» (RGPD art. 32) al crear, cambiar o borrar '
  'una fila. Si la hermandad ya no existe —se está borrando entera— no apunta nada: '
  'antes intentaba escribir una fila huérfana y la clave ajena tiraba el borrado completo.';
