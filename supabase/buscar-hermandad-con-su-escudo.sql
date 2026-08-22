-- =============================================================================
--   QUE EL HERMANO ENCUENTRE SU HERMANDAD, Y LA RECONOZCA
-- =============================================================================
--
-- Dos cosas que faltaban en la pantalla donde el hermano elige su hermandad:
--
-- 1. LA CIUDAD. La pantalla dice «escribe el nombre o la ciudad», y la ciudad
--    no viajaba: llegaba siempre vacía, así que buscar por ciudad NUNCA
--    encontraba nada. Pedirle a alguien que busque por un dato que no existe es
--    peor que no ofrecerlo.
--
-- 2. Ya viajaba el logo (lo añadió `colores-hermandad.sql`), pero conviene
--    dejarlo aquí junto a lo demás para que se lea de un tirón lo que esta
--    función enseña y lo que no.
--
-- QUÉ **NO** SALE, Y ES A PROPÓSITO. Esta función la puede llamar cualquiera
-- sin haber iniciado sesión —tiene que poder, es la pantalla de entrar—, así
-- que devuelve SOLO lo que es público: cómo se llama la hermandad, de dónde es,
-- sus colores y su escudo. Ni el IBAN, ni el CIF, ni el teléfono, ni el correo,
-- que están en la misma tabla y no son de nadie más.

drop function if exists hermandades_publicas();

create or replace function hermandades_publicas()
returns table (
  id uuid,
  nombre text,
  ciudad text,
  color_primario text,
  color_secundario text,
  logo_data_url text
)
language sql stable security definer set search_path = public as $$
  select
    h.id,
    h.nombre,
    coalesce(s.ciudad, ''),
    -- Los de fábrica si esa hermandad todavía no ha puesto los suyos, para que
    -- la pantalla nunca se quede sin color.
    coalesce(nullif(s.color_primario, ''), '#6A1A23'),
    coalesce(nullif(s.color_secundario, ''), '#C5A059'),
    s.logo_data_url
  from hermandades h
  left join hermandad_settings s on s.hermandad_id = h.id
  where h.activa
  order by h.nombre
$$;

grant execute on function hermandades_publicas() to anon, authenticated;

comment on function hermandades_publicas() is
  'La lista de hermandades para la pantalla de entrar. Solo datos públicos: '
  'nombre, ciudad, colores y escudo. Nunca IBAN, CIF, teléfono ni correo.';
