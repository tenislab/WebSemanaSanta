-- =============================================================================
--
--   GOBERGO — ¿QUÉ PUEDE HACER CADA CUENTA?
--
-- =============================================================================
--
-- PARA CUÁNDO ES: para el error que dice
--
--     new row violates row-level security policy for table "hermanos"
--
-- y para sus hermanos («…for table papeletas», «…cuotas»). Ese mensaje lo
-- escribe Postgres y no dice lo único que hace falta saber: QUÉ le falta a la
-- cuenta con la que estás entrando.
--
-- Y detrás de ese rechazo suelen ir varias cosas que parecen fallos distintos:
-- el censo importado del Excel que «desaparece» al recargar, las altas que no
-- se pueden aceptar, el hermano que no se deja crear. Es el mismo rechazo: la
-- fila no entra, pero la pantalla ya la tenía pintada.
--
-- LO QUE PASA POR DEBAJO. Crear un hermano exige DOS cosas a la vez:
--
--     not auth_es_hermano()             -- que la sesión no sea de un hermano
--     and modulo_permitido('hermanos')  -- y que el cargo llegue a ese módulo
--
-- Y aquí está la trampa que lo hace parecer un fallo del programa: LEER el
-- censo se permite con CUALQUIERA de siete módulos (hermanos, cuotas,
-- papeletas, cortejo, informes, comunicados, personal), pero CREAR exige el de
-- «hermanos» en concreto.
--
-- O sea que un cargo que no lleve «hermanos» ve el censo entero, la pantalla
-- se pinta con todos los datos, el botón de «Nuevo hermano» está ahí… y al
-- guardar, rechazo.
--
-- CÓMO SE USA
--
--   Supabase → SQL Editor → New query → pega esto entero → RUN.
--
-- NO HAY NADA QUE EDITAR. Salen todas las cuentas de este proyecto con lo que
-- puede hacer cada una. Busca la tuya y mira la columna «veredicto».
--
-- Esto NO cambia nada. Solo mira y responde.
--
-- =============================================================================

with cuentas as (
  select
    u.id,
    u.email,
    u.raw_user_meta_data ->> 'tipo' as tipo,
    u.last_sign_in_at
  from auth.users u
),

/* Las tres vías por las que se puede gestionar, que es lo que suma
   `modulo_permitido()`: el titular lo puede todo; el personal activo, lo de su
   cargo; y el hermano con cargo en su ficha, lo de su cargo. */
enriquecidas as (
  select
    c.*,
    exists (select 1 from titulares t where t.auth_user_id = c.id) as es_titular,
    coalesce(
      (select p.cargo from personal p where p.auth_user_id = c.id and p.activo limit 1),
      (select h.cargo from hermanos h
        where h.auth_user_id = c.id
          and h.cargo is not null and h.cargo <> 'Hermano de a pie'
          and h.estado <> 'Baja'
        limit 1)
    ) as cargo,
    exists (select 1 from hermanos h where h.auth_user_id = c.id) as tiene_ficha
  from cuentas c
),

conclusion as (
  select
    e.*,
    coalesce((
      select string_agg(pc.modulo_id, ', ' order by pc.modulo_id)
      from permisos_cargo pc where pc.cargo = e.cargo
    ), '(ninguno)') as modulos,
    coalesce((
      select bool_or(pc.modulo_id = 'hermanos')
      from permisos_cargo pc where pc.cargo = e.cargo
    ), false) as cargo_abre_hermanos
  from enriquecidas e
)

select
  email as "cuenta",

  case
    when tipo = 'hermano' then 'hermano'
    when es_titular then 'TITULAR'
    when cargo is not null then cargo
    else '(sin cargo)'
  end as "qué es",

  case
    -- Las dos condiciones de la política, en el mismo orden en que las mira
    -- Postgres. La primera que falle es la que manda.
    when tipo = 'hermano'
      then '⛔ NO — la sesión figura como de hermano'
    when es_titular
      then '✅ SÍ — el titular lo puede todo'
    when cargo_abre_hermanos
      then '✅ SÍ'
    else '⛔ NO — su cargo no incluye el módulo «hermanos»'
  end as "¿puede crear hermanos?",

  modulos as "módulos que abre su cargo",

  case
    when tipo = 'hermano'
      then 'Entra por el acceso de GESTIÓN con la cuenta de la junta, no por el área del hermano.'
    when es_titular or cargo_abre_hermanos
      then 'Si con esta cuenta aún falla, el problema no son los permisos: manda el error entero.'
    when cargo is null
      then 'Esta cuenta no es titular ni tiene cargo: no gestiona nada. Usa la cuenta con la que creaste la hermandad.'
    else 'Ve a Personal y permisos y dale a «' || cargo || '» el módulo «hermanos». '
         || 'O entra con la cuenta titular, que lo puede todo.'
  end as "qué hacer",

  case when tiene_ficha then 'sí' else 'no' end as "tiene ficha en el censo",
  last_sign_in_at as "última vez que entró"

from conclusion
-- La que ha entrado más recientemente primero: casi siempre es la que estabas
-- usando cuando saltó el error.
order by last_sign_in_at desc nulls last;
