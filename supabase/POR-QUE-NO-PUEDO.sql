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
--     not auth_es_hermano()             -- que la sesión no sea SOLO de hermano
--     and modulo_permitido('hermanos')  -- y que el cargo llegue a ese módulo
--
-- Y «solo de hermano» no es lo que parece. NO es «se registró por el área del
-- hermano»: es tener ficha en el censo Y NO ser titular, NI personal activo,
-- NI llevar cargo en la propia ficha. Hay TRES formas de gestionar y basta con
-- una. El Hermano Mayor tiene ficha como cualquiera y gestiona igual.
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
    exists (select 1 from personal p where p.auth_user_id = c.id and p.activo) as es_personal,
    exists (
      select 1 from hermanos h
      where h.auth_user_id = c.id
        and h.cargo is not null and h.cargo <> 'Hermano de a pie'
        and h.estado <> 'Baja'
    ) as lleva_cargo_en_su_ficha,
    coalesce(
      (select p.cargo from personal p where p.auth_user_id = c.id and p.activo limit 1),
      (select h.cargo from hermanos h
        where h.auth_user_id = c.id
          and h.cargo is not null and h.cargo <> 'Hermano de a pie'
          and h.estado <> 'Baja'
        limit 1)
    ) as cargo,
    /*
     * DE QUÉ HERMANDAD ES ESTA CUENTA.
     *
     * Hace falta porque los permisos por cargo son DE CADA HERMANDAD: la clave
     * de `permisos_cargo` es (hermandad_id, cargo, modulo_id). En una base con
     * dos hermandades, «Tesorero/a» son dos filas distintas por cada módulo.
     *
     * Sin esto, la lista de módulos salía con todo repetido —«cuotas, cuotas,
     * informes, informes»— porque sumaba los de TODAS las hermandades. Y no es
     * solo feo: enseñaba como permisos de esta cuenta los que otra hermandad le
     * ha dado a un cargo que se llama igual.
     */
    coalesce(
      (select t.hermandad_id from titulares t where t.auth_user_id = c.id limit 1),
      (select p.hermandad_id from personal p where p.auth_user_id = c.id and p.activo limit 1),
      (select h.hermandad_id from hermanos h where h.auth_user_id = c.id limit 1)
    ) as hermandad_id,
    exists (select 1 from hermanos h where h.auth_user_id = c.id) as tiene_ficha
  from cuentas c
),

conclusion as (
  select
    e.*,
    /*
     * «SOLO DE HERMANO», copiado LETRA POR LETRA de `auth_es_hermano()`.
     *
     * ESTO ESTABA MAL Y ES LO QUE HACÍA MENTIR AL DIAGNÓSTICO. Miraba
     * `raw_user_meta_data ->> 'tipo' = 'hermano'`, que es la marca que se pone
     * al registrarse por el área del hermano. Esa fue la definición ORIGINAL
     * de `auth_es_hermano()`, pero se cambió tres veces desde entonces
     * (`hermano-y-gestion.sql`, `hermano-con-cargo.sql`), y hoy la función no
     * mira esa marca para nada.
     *
     * Resultado: a un Hermano Mayor que se registró por el área del hermano
     * —lo normal, es hermano— este diagnóstico le decía «⛔ NO, la sesión
     * figura como de hermano» cuando la base de datos le deja hacerlo todo. Y
     * al revés: el veredicto iba ANTES de mirar si era titular, así que ni
     * siquiera eso lo salvaba.
     *
     * Un diagnóstico que se equivoca es peor que no tenerlo: manda a arreglar
     * lo que no está roto.
     */
    e.tiene_ficha
      and not e.es_titular
      and not e.es_personal
      and not e.lleva_cargo_en_su_ficha as solo_hermano,
    -- Los de SU hermandad, no los de todas. Y `distinct` como red: si algún
    -- día la clave vuelve a permitir repetidos, la lista no miente.
    coalesce((
      select string_agg(distinct pc.modulo_id, ', ' order by pc.modulo_id)
      from permisos_cargo pc
      where pc.cargo = e.cargo and pc.hermandad_id = e.hermandad_id
    ), '(ninguno)') as modulos,
    coalesce((
      select bool_or(pc.modulo_id = 'hermanos')
      from permisos_cargo pc
      where pc.cargo = e.cargo and pc.hermandad_id = e.hermandad_id
    ), false) as cargo_abre_hermanos,
    (select h.nombre from hermandades h where h.id = e.hermandad_id) as hermandad
  from enriquecidas e
)

select
  email as "cuenta",

  case
    when es_titular then 'TITULAR'
    when cargo is not null then cargo
    when solo_hermano then 'hermano'
    else '(sin cargo)'
  end as "qué es",

  case
    -- Las dos condiciones de la política, en el mismo orden en que las mira
    -- Postgres. La primera que falle es la que manda.
    when solo_hermano
      then '⛔ NO — esta cuenta solo es hermano: sin cargo, ni titular, ni personal'
    when es_titular
      then '✅ SÍ — el titular lo puede todo'
    when cargo_abre_hermanos
      then '✅ SÍ'
    when cargo is not null
      then '⛔ NO — su cargo no incluye el módulo «hermanos»'
    else '⛔ NO — esta cuenta no gestiona nada'
  end as "¿puede crear hermanos?",

  modulos as "módulos que abre su cargo",

  case
    when es_titular or cargo_abre_hermanos
      then 'Si con esta cuenta aún falla, el problema no son los permisos: manda el error entero.'
    when solo_hermano
      then 'Ponle un cargo en su ficha del censo (Hermanos → su ficha → Cargo), o entra con la '
         || 'cuenta titular. Registrarse por el área del hermano no quita nada: lo que cuenta es el cargo.'
    when cargo is null
      then 'Esta cuenta no es titular, ni tiene cargo, ni ficha en el censo: no gestiona nada. '
         || 'Usa la cuenta con la que creaste la hermandad.'
    else 'Ve a Personal y permisos y dale a «' || cargo || '» el módulo «hermanos». '
         || 'O entra con la cuenta titular, que lo puede todo.'
  end as "qué hacer",

  -- De qué hermandad. Con dos hermandades en la misma base, sin esta columna no
  -- se sabe a cuál pertenece cada cuenta ni por qué dos «Tesorero/a» distintos
  -- pueden cosas distintas.
  coalesce(hermandad, '(sin hermandad)') as "hermandad",
  case when tiene_ficha then 'sí' else 'no' end as "tiene ficha en el censo",
  -- Informativo, ya NO decide: dice por dónde se registró, que no es lo mismo
  -- que lo que puede hacer.
  coalesce(tipo, 'gestión') as "por dónde se registró",
  last_sign_in_at as "última vez que entró"

from conclusion
-- La que ha entrado más recientemente primero: casi siempre es la que estabas
-- usando cuando saltó el error.
order by last_sign_in_at desc nulls last;
