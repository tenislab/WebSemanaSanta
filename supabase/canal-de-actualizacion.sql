-- =============================================================================
--   SACAR UNA NOVEDAD A UNA HERMANDAD ANTES QUE A TODAS
-- =============================================================================
--
-- Gobergo es una sola página que se despliega de golpe: subes el paquete y a
-- los cinco minutos TODAS las hermandades tienen la versión nueva. No hay
-- vuelta atrás gradual, no hay «solo el 5 %», no hay nada.
--
-- Eso significa que un despliegue malo rompe a todo el mundo a la vez. En
-- octubre eso es un mal día. En Semana Santa es una catástrofe: es la semana en
-- que se imprimen las papeletas y se monta el cortejo, y no hay margen para
-- «lo miramos el lunes».
--
-- -----------------------------------------------------------------------------
-- QUÉ HACE ESTO, Y QUÉ NO
-- -----------------------------------------------------------------------------
--
-- NO hace despliegue gradual del paquete: eso se arregla en el alojamiento, no
-- aquí, y la nota de cómo hacerlo está en `docs/DESPLIEGUE.md`.
--
-- Lo que hace es lo otro, que es lo que de verdad se necesita el 90 % de las
-- veces: que el CÓDIGO NUEVO SE DESPLIEGUE A TODOS PERO SOLO SE ENCIENDA PARA
-- QUIEN TÚ DIGAS.
--
--   1. Escribes la función nueva detrás de una bandera.
--   2. La despliegas. Todo el mundo tiene el código; nadie lo ve.
--   3. La enciendes para el canal «piloto», que son una o dos hermandades
--      tuyas de confianza.
--   4. Pasa una semana. Si no ha explotado, la enciendes para «estable».
--   5. Si explota, la apagas. SIN DESPLEGAR NADA: es una línea de SQL, tarda
--      diez segundos, y no depende de que el alojamiento reconstruya el
--      paquete.
--
-- Ese punto 5 es todo el valor. Hoy la única marcha atrás es volver a
-- desplegar la versión anterior, con lo que se lleva por delante todo lo demás
-- que hubiera entrado en medio.
--
-- -----------------------------------------------------------------------------
-- CÓMO SE USA
-- -----------------------------------------------------------------------------
--
--   -- Poner a una hermandad de piloto:
--   update hermandades set canal = 'piloto' where nombre ilike '%Nazareno%';
--
--   -- Encender una novedad solo para los pilotos:
--   insert into novedades (clave, descripcion, desde_canal)
--   values ('cuotas-ventana', 'Cuotas solo trae los dos últimos ejercicios', 'piloto');
--
--   -- Y una semana después, para todas:
--   update novedades set desde_canal = 'estable' where clave = 'cuotas-ventana';
--
--   -- O apagarla del todo, si ha salido mal:
--   update novedades set desde_canal = 'apagado' where clave = 'cuotas-ventana';
--
-- -----------------------------------------------------------------------------
-- LA REGLA QUE NO SE PUEDE SALTAR
-- -----------------------------------------------------------------------------
--
-- UNA BANDERA QUE NO ESTÁ EN LA TABLA ESTÁ **APAGADA**, no encendida. Es lo
-- contrario de lo que parece cómodo y es lo único seguro: si la consulta falla,
-- si la base está atrasada, si alguien borra la fila sin querer, la aplicación
-- se comporta como se comportaba antes de existir la novedad. El camino que
-- lleva años funcionando es el que gana cuando hay dudas.
--
-- Y de ahí sale la otra regla, la que de verdad hay que respetar al programar:
-- LA BANDERA SOLO PUEDE ENVOLVER CÓDIGO NUEVO, nunca sustituir el viejo. El
-- camino de siempre tiene que seguir ahí, entero, funcionando. Ver
-- `src/lib/novedades.ts`.
--
-- Ejecútalo después de `multi-hermandad.sql`. Volver a ejecutarlo no hace nada.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EL CANAL DE CADA HERMANDAD
-- -----------------------------------------------------------------------------

/*
 * Por defecto TODAS son 'estable'. Ser piloto se pide, no se sortea: una
 * hermandad que no sabe que está probando cosas no está probando, está
 * sufriéndolas.
 */
alter table hermandades add column if not exists canal text not null default 'estable';

do $$
begin
  alter table hermandades add constraint hermandades_canal_valido
    check (canal in ('estable', 'piloto'));
exception
  when duplicate_object then null;
end $$;

-- -----------------------------------------------------------------------------
-- 2. LAS NOVEDADES
-- -----------------------------------------------------------------------------

create table if not exists novedades (
  /* Cómo la nombra el código. Ver `NOVEDADES` en `src/lib/novedades.ts`. */
  clave text primary key,
  /* Para acordarte dentro de seis meses de qué era esto. */
  descripcion text not null default '',
  /*
   * DESDE QUÉ CANAL ESTÁ ENCENDIDA:
   *
   *   'apagado' — nadie. Es el valor para dar marcha atrás.
   *   'piloto'  — solo las hermandades marcadas como piloto.
   *   'estable' — todas.
   *
   * Va como escalera y no como tres banderas sueltas porque el camino real es
   * siempre el mismo: apagado → piloto → estable. Y hacia atrás.
   */
  desde_canal text not null default 'apagado'
    check (desde_canal in ('apagado', 'piloto', 'estable')),
  cambiada_el timestamptz not null default now()
);

alter table novedades enable row level security;

/*
 * La lista la lee cualquiera que haya entrado. No es dato de nadie: son los
 * nombres de las funciones que están en pruebas.
 *
 * ESCRIBIRLA NO PUEDE NADIE desde la aplicación —sin política de insert ni de
 * update, RLS deniega—. Se cambia desde el SQL Editor. Una bandera que la
 * hermandad pudiera encenderse sola no es un despliegue por fases, es un menú
 * de opciones a medio hacer.
 */
drop policy if exists "novedades_leer" on novedades;
create policy "novedades_leer" on novedades
  for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- 3. QUÉ LE TOCA A QUIEN PREGUNTA
-- -----------------------------------------------------------------------------

/**
 * Las novedades encendidas para la hermandad de quien pregunta. Una sola
 * llamada, una sola lista de claves: la aplicación no tiene que saber nada de
 * canales ni de escaleras.
 *
 * Que la cuenta sirva la lógica y no el navegador importa: el día que se añada
 * un tercer canal, o un porcentaje, o una fecha de caducidad, se cambia aquí y
 * las hermandades que no hayan recargado siguen funcionando.
 */
create or replace function mis_novedades() returns setof text
language sql stable security definer set search_path = public as $$
  select n.clave from novedades n
   where n.desde_canal = 'estable'
      or (n.desde_canal = 'piloto'
          and exists (select 1 from hermandades h
                       where h.id = hermandad_actual() and h.canal = 'piloto'))
$$;
grant execute on function mis_novedades() to authenticated;
