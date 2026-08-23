-- ============================================================================
-- Gobergo — que el área del hermano se vista con los colores de SU hermandad
-- ============================================================================
--
-- El área del hermano salía siempre con el mismo dorado, hubiera elegido la
-- hermandad que hubiera elegido. Y cada hermandad tiene sus colores: son los
-- de su escudo, los de su túnica, los que su gente reconoce.
--
-- Los colores de marca no son un dato reservado —están en su web pública, en
-- su cartel y en su escudo— así que se pueden dar sin sesión, igual que el
-- nombre. Lo que NO sale de aquí es nada más: ni correo, ni IBAN, ni CIF.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

-- `drop` antes de `create`: cambia el tipo de la tabla que devuelve, y Postgres
-- no deja hacer eso con un simple `create or replace`.
drop function if exists hermandades_publicas();

create or replace function hermandades_publicas()
returns table (id uuid, nombre text, color_primario text, color_secundario text, logo_data_url text)
language sql stable security definer set search_path = public as $$
  select
    h.id,
    h.nombre,
    -- Los de fábrica si esa hermandad todavía no ha puesto los suyos, para que
    -- el área nunca se quede sin color.
    coalesce(nullif(s.color_primario, ''), '#6A1A23'),
    coalesce(nullif(s.color_secundario, ''), '#C5A059'),
    s.logo_data_url
  from hermandades h
  left join hermandad_settings s on s.hermandad_id = h.id
  where h.activa
  order by h.nombre
$$;
grant execute on function hermandades_publicas() to anon, authenticated;
