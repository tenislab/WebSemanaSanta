-- =============================================================================
--   REDES-SOCIALES.SQL — Que cada hermandad tenga sus propias cuentas
-- =============================================================================
--
-- EL FALLO QUE ARREGLA, y era el módulo entero: la tarjeta «Redes sociales
-- conectadas» decía **0 de 0** y no salía ni una red. Ni conectadas ni sin
-- conectar: ninguna. Con datos de ejemplo salían las cinco, así que se leía
-- como «esto solo funciona en la demostración».
--
-- Son dos cosas, y las dos están aquí:
--
--   1) La tabla nació con `red text primary key`. Esa clave es GLOBAL. Al
--      pasar a varias hermandades se le añadió `hermandad_id` como a todas las
--      demás, pero la clave se quedó igual — a diferencia del DNI del hermano
--      o del número de hermano, que sí se arreglaron en su día.
--
--      O sea que en toda la base de datos solo puede haber UNA fila
--      «Facebook». La primera hermandad que la escribiera se la quedaba, y
--      todas las demás se estrellaban contra la clave primaria al intentar
--      guardar la suya. No es que fuera lento ni que fallara a veces: la
--      segunda hermandad no podía tener redes sociales.
--
--   2) La semilla de `schema.sql` mete las cinco filas SIN hermandad:
--
--          insert into cuentas_sociales (red) values ('Facebook'), ...
--
--      Esa fila tiene `hermandad_id` a null, y la frontera de seguridad dice
--      `hermandad_id = hermandad_actual()`. Comparar cualquier cosa con null
--      nunca es cierto, así que esas cinco filas no las ve NADIE. Están en la
--      tabla, ocupan la clave primaria que las demás necesitan, y son
--      invisibles.
--
--      Ahí está el «0 de 0» exacto: la consulta no falla, devuelve cero filas.
--
-- Se puede ejecutar sobre una base ya en uso. No borra ninguna cuenta de
-- ninguna hermandad: lo único que borra son las filas huérfanas de la semilla,
-- que por definición no son de nadie y nadie podía ver.

-- 1. La columna y su valor por defecto (por si esta base es anterior).
alter table cuentas_sociales add column if not exists hermandad_id uuid references hermandades(id) on delete cascade;
alter table cuentas_sociales alter column hermandad_id set default hermandad_actual();

-- 2. Fuera las cinco filas huérfanas de la semilla. Son las que bloquean la
--    clave primaria, y no tienen dueño: nadie las ha visto nunca.
delete from cuentas_sociales where hermandad_id is null;

-- 3. La clave, por hermandad y no global. Cada una tiene su Facebook.
alter table cuentas_sociales drop constraint if exists cuentas_sociales_pkey;
create unique index if not exists cuentas_sociales_por_hermandad
  on cuentas_sociales (hermandad_id, red);

-- 4. El enlace público, que antes no se guardaba en ninguna parte.
--
--    Hacía falta para dos cosas distintas: para poner los iconos en el pie de
--    la web de la hermandad, y para que el botón de «abrir para publicar»
--    lleve a SU página y no a la portada de Facebook.
alter table cuentas_sociales add column if not exists enlace text;

comment on table cuentas_sociales is
  'Las redes de cada hermandad. La clave es (hermandad_id, red): con la clave '
  'global de antes, solo la primera hermandad podía guardar las suyas. Las filas '
  'sin hermandad_id no las ve nadie (la política las filtra) — no las vuelvas a '
  'sembrar sin hermandad.';

-- -----------------------------------------------------------------------------
-- Comprobación
-- -----------------------------------------------------------------------------
-- Después de ejecutarlo, esto tiene que devolver una fila por cada red que
-- hayas conectado, y ninguna sin hermandad:
--
--   select red, conectada, usuario, enlace, hermandad_id is null as huerfana
--     from cuentas_sociales order by red;
--
-- Si sale vacío, es lo normal: las cinco redes salen igualmente en pantalla
-- (son un catálogo fijo de la aplicación, no datos), y la fila se crea sola la
-- primera vez que conectas una.
