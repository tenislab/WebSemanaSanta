-- =============================================================================
--   LO QUE TIENE QUE PASAR SOLO, A SU HORA  (pg_cron)
-- =============================================================================
--
-- Hasta ahora en Gobergo no había NADA programado. Todo lo que tenía que
-- ocurrir «cada cierto tiempo» ocurría cuando alguien entraba en el panel — o
-- con trucos, como la limpieza de las visitas, que se lanzaba una de cada mil
-- veces que alguien abría una página de la web.
--
-- Eso funciona hasta que deja de funcionar: en agosto no entra nadie en un mes.
--
-- ANTES DE EJECUTAR ESTO hay que encender la extensión, que es una casilla:
--
--     Supabase → Database → Extensions → buscar «pg_cron» → activar
--
-- Está disponible también en el plan gratuito. Si no la enciendes, este fichero
-- falla en la primera línea y no hace nada a medias.
--
-- LO QUE NO ESTÁ AQUÍ, Y POR QUÉ:
--
--   · MANDAR CORREOS (recordar la cuota, avisar de la remesa). Para escribir un
--     correo desde la base de datos hay que guardar en ella la clave del
--     servicio de envío, y una clave dentro de la base es una clave que se lleva
--     cualquiera que consiga leerla. Los correos los manda la aplicación, que es
--     donde están las claves. Cuando haga falta programarlos, se hace con una
--     Edge Function y su secreto, no con esto.
--
--   · PONER CUOTAS «EN MORA» AL VENCER. Es a propósito y está escrito en
--     `data/cuotas.ts`: la mora la decide una persona, no el calendario. Un
--     hermano que se ha quedado sin trabajo y habló con el tesorero no puede
--     amanecer marcado como moroso porque pasó una fecha.
--
-- Es seguro repetirlo: cada tarea se borra y se vuelve a crear.
-- =============================================================================

create extension if not exists pg_cron;

/*
 * Las tareas se crean en el esquema `cron` y las ejecuta el propio Postgres,
 * sin sesión de nadie: por eso todo lo que llaman es `security definer` y no
 * depende de `auth.uid()`.
 */

-- ---------------------------------------------------------------------------
-- 1. LAS VISITAS VIEJAS, UNA VEZ POR SEMANA
-- ---------------------------------------------------------------------------
--
-- Se guardan dos años, que es lo que hace falta para comparar una Semana Santa
-- con la anterior. Antes esto se lanzaba «una de cada mil visitas», que es un
-- truco que funciona con tráfico y no funciona sin él: la web que menos visitas
-- tiene es justo la que nunca limpia.
select cron.unschedule('gobergo-limpiar-visitas')
  where exists (select 1 from cron.job where jobname = 'gobergo-limpiar-visitas');

select cron.schedule(
  'gobergo-limpiar-visitas',
  -- Domingos a las 4:10. De madrugada porque no molesta a nadie, y a y diez
  -- para no coincidir con las tareas en punto de todo el mundo.
  '10 4 * * 0',
  $$ select limpiar_visitas_viejas() $$
);

-- ---------------------------------------------------------------------------
-- 2. LOS SUSCRIPTORES QUE NUNCA CONFIRMARON
-- ---------------------------------------------------------------------------
--
-- Alguien puso su correo en la web, no abrió el enlace y ahí se quedó. Al mes
-- se borra, y no es por limpieza: es que ese correo NO se puede usar —sin
-- confirmar no se le escribe— así que guardarlo es tener un dato personal de
-- alguien para nada, que es justo lo que el RGPD llama conservación indebida.
--
-- Y hay un caso peor que ese: el correo que apuntó OTRA persona. Esa dirección
-- no debería estar en ninguna lista, y su dueño ni siquiera sabe que está.
create or replace function limpiar_suscriptores_sin_confirmar() returns void
language sql security definer set search_path = public as $$
  delete from suscriptores_web
   where not confirmado
     and alta_en < now() - interval '30 days'
$$;
revoke execute on function limpiar_suscriptores_sin_confirmar() from public, anon, authenticated;

select cron.unschedule('gobergo-suscriptores-sin-confirmar')
  where exists (select 1 from cron.job where jobname = 'gobergo-suscriptores-sin-confirmar');

select cron.schedule(
  'gobergo-suscriptores-sin-confirmar',
  -- Todos los días: es un borrado de datos personales, y cuanto antes mejor.
  '25 4 * * *',
  $$ select limpiar_suscriptores_sin_confirmar() $$
);

-- ---------------------------------------------------------------------------
-- 3. QUÉ TAREAS HAY, PARA PODER MIRARLO
-- ---------------------------------------------------------------------------
--
-- Una tarea programada que falla lo hace en silencio y de madrugada. Con esto
-- se ve de un vistazo cuáles hay, cuándo corren y cómo acabó la última.
--
--     select * from tareas_programadas();
create or replace function tareas_programadas()
returns table (tarea text, cuando text, activa boolean, ultima timestamptz, como text)
language sql security definer set search_path = public, cron as $$
  select
    j.jobname::text,
    j.schedule::text,
    j.active,
    d.end_time,
    d.status::text
  from cron.job j
  left join lateral (
    select end_time, status
      from cron.job_run_details r
     where r.jobid = j.jobid
     order by r.end_time desc nulls last
     limit 1
  ) d on true
  where j.jobname like 'gobergo-%'
  order by j.jobname
$$;
-- La puede mirar quien lleva la hermandad, no un hermano.
revoke execute on function tareas_programadas() from public, anon;
grant execute on function tareas_programadas() to authenticated;
