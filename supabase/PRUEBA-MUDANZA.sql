-- =============================================================================
--   PRUEBA: MUDANZA DESDE EL PROYECTO DE UNA SOLA HERMANDAD
-- =============================================================================
--
-- Quien ya usaba Cabildo antes del multi-hermandad tiene dos cosas que la
-- migración podría romper, y las dos en silencio:
--
--   1. Una fila en `titulares` escrita a mano (así se hacía antes). Como la
--      clave primaria es la cuenta, `crear_hermandad()` chocaba con ella al
--      entrar y no se podía pasar del login.
--   2. Datos —hermanos, cuotas, su web— guardados sin decir de quién son,
--      porque entonces no hacía falta. Al repartir por hermandades esas filas
--      se quedan huérfanas, y una fila huérfana no la ve nadie nunca más.
--
-- Esto comprueba las dos, más el caso de una junta con varios titulares: cada
-- uno tiene que entrar en LA MISMA hermandad, no fabricarse la suya.
--
-- Cómo se ejecuta: sobre una base con el esquema ANTIGUO (bloques 1 a 7),
-- luego el bloque 8, y luego esto.
-- =============================================================================
\set ON_ERROR_STOP on
\pset pager off

set role authenticated;
select set_config('test.uid','99999999-9999-9999-9999-999999999999',false);

select case when crear_hermandad('Hdad. de Antes') is not null
  then 'OK  N1  el titular de antes entra sin chocar con su fila escrita a mano'
  else 'FALLO N1  no ha podido entrar' end;
select case when (select count(*) from hermanos) = 2
  then 'OK  N2  sus hermanos de antes siguen ahí y los ve'
  else 'FALLO N2  ve ' || (select count(*) from hermanos) || ' hermanos' end;
select case when (select count(*) from cuotas) = 1 and (select count(*) from tramos) = 1
  then 'OK  N3  sus cuotas y sus tramos también'
  else 'FALLO N3  se han perdido cuotas o tramos' end;
select case when (select nombre_legal from hermandad_settings) = 'Hdad. de Antes'
  then 'OK  N4  sus ajustes de siempre, no una ficha en blanco'
  else 'FALLO N4  los ajustes salen vacíos' end;
select case when (select slug from web_publica) = 'la-de-antes'
  then 'OK  N5  y su web pública, con su misma dirección'
  else 'FALLO N5  la web ha cambiado de dirección o ha desaparecido' end;

-- El compañero de junta, que también estaba en `titulares`.
select set_config('test.uid','88888888-8888-8888-8888-888888888888',false);
select crear_hermandad('Lo que sea');
select case when (select count(*) from hermanos) = 2
  then 'OK  N6  el compañero ve el mismo censo, no una hermandad vacía'
  else 'FALLO N6  el compañero se ha quedado fuera' end;

reset role;
select case when (select count(*) from hermandades) = 1
  then 'OK  N7  se ha creado UNA hermandad, no una por cada titular'
  else 'FALLO N7  hay ' || (select count(*) from hermandades) || ' hermandades' end;
select case when (select count(*) from hermanos where hermandad_id is null) = 0
             and (select count(*) from cuotas  where hermandad_id is null) = 0
             and (select count(*) from tramos  where hermandad_id is null) = 0
  then 'OK  N8  no queda ninguna fila sin dueño'
  else 'FALLO N8  quedan filas huérfanas, que no verá nadie' end;
