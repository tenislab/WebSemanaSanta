-- =============================================================================
--   ARREGLO RÁPIDO: el disparador que impide guardar
-- =============================================================================
--
-- SI TE SALE ESTO al guardar una papeleta, una cuota o un apunte:
--
--     record "old" has no field "nombre"
--
-- es esto. El disparador que apunta los cambios buscaba una columna `nombre`
-- que solo tiene la tabla de hermanos. En papeletas, cuotas y movimientos no
-- existe, y Postgres corta la operación entera.
--
-- Pégalo en Supabase → SQL Editor → RUN. Son diez segundos y no borra nada:
-- solo sustituye esa función por la buena.
--
-- Va incluido en `TODO-EN-UNO.sql`, así que si prefieres pasar ese entero, no
-- hace falta ejecutar este.
--
-- =============================================================================

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

  insert into registro_actividad
    (hermandad_id, autor_id, autor_nombre, accion, sobre_tipo, sobre_id, sobre_nombre, detalle, origen)
  values (
    coalesce((fila->>'hermandad_id')::uuid, hermandad_actual()),
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
