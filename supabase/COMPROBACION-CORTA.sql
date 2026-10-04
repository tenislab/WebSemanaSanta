-- GOBERGO — comprobación corta: ¿está la base completa?
--
-- Es la versión de bolsillo de DIAGNOSTICO.sql, para cuando pegar 626 líneas en
-- el editor de Supabase es un problema. Cuenta en vez de listar: dice SI falta
-- algo, no QUÉ. Si alguna línea sale en rojo, entonces sí hay que pegar
-- DIAGNOSTICO.sql entero, que es el que nombra la columna o la función que
-- falta.
select
  'versión del esquema' as "Qué",
  coalesce((select valor::text from esquema_gobergo where clave = 'version'), 'sin sellar') as "Hay",
  '74' as "Debería",
  case when coalesce((select valor::int from esquema_gobergo where clave = 'version'), 0) = 74
       then 'bien' else 'MAL' end as "Cómo va"
union all
select 'tablas de la hermandad',
  count(*)::text, '>= 40',
  case when count(*) >= 40 then 'bien' else 'MAL' end
  from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'
union all
select 'tablas sin RLS (deben ser 0)',
  count(*)::text, '0',
  case when count(*) = 0 then 'bien' else 'MAL' end
  from pg_tables t where t.schemaname = 'public'
   and not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relname = t.tablename and c.relrowsecurity)
union all
select 'funciones que llama la aplicación',
  count(*)::text, '>= 55',
  case when count(*) >= 55 then 'bien' else 'MAL' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
union all
select 'cubos de archivos',
  count(*)::text, '3',
  case when count(*) >= 3 then 'bien' else 'MAL' end
  from storage.buckets
union all
-- LAS TAREAS DE `pg_cron`, Y CON CUIDADO: si la extensión no está instalada,
-- `cron.job` NO EXISTE y Postgres resuelve la consulta ENTERA al planificarla,
-- así que un `select ... from cron.job` tumba todo lo de arriba aunque esté
-- detrás de un `case`. `query_to_xml` se resuelve al ejecutar, no al planificar.
select 'tareas programadas (pg_cron)',
  case when to_regclass('cron.job') is null then 'sin pg_cron'
       else coalesce((xpath('/row/n/text()', query_to_xml(
              'select count(*) as n from cron.job where jobname like ''gobergo-%''',
              false, true, '')))[1]::text, '0') end,
  '5',
  case when to_regclass('cron.job') is null then 'FALTA: enciende la extensión'
       when coalesce((xpath('/row/n/text()', query_to_xml(
              'select count(*) as n from cron.job where jobname like ''gobergo-%''',
              false, true, '')))[1]::text::int, 0) = 5 then 'bien'
       else 'FALTA: pega tareas-programadas.sql' end;
