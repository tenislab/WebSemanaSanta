-- =============================================================================
--   CLAVE-DE-CATALOGOS.SQL — Que cada hermandad tenga sus propios catálogos
-- =============================================================================
--
-- EL MISMO FALLO QUE `redes-sociales.sql`, en la otra tabla que se quedó
-- fuera. Y aquí es peor, porque `catalogos` se toca mucho más.
--
-- La tabla nació con `primary key (clave, valor)`. Esa clave es GLOBAL. Al
-- pasar a varias hermandades se le añadió `hermandad_id` como a todas las
-- demás, pero la clave se quedó igual — a diferencia del DNI del hermano, del
-- número de hermano, de los ajustes, de la web y de las redes, que sí se
-- arreglaron en su día.
--
-- LO QUE HAY EN ESA TABLA son las listas que configura cada hermandad en
-- Configuración: las categorías de ingreso y de gasto, las cuentas de
-- tesorería, los tipos de incidencia, las categorías del inventario, los
-- canales y los segmentos de los comunicados.
--
-- Y son las MENOS DISTINTIVAS QUE HAY. «Cera», «Flores», «Limosnas»,
-- «Caja», «Bueno», «Restaurado»: las escribe igual todo el mundo, porque son
-- las palabras de siempre de una hermandad. O sea que la SEGUNDA hermandad que
-- entrara no podía guardar prácticamente ninguna de las suyas: la fila ya
-- existía, de otra gente, y el guardado se estrellaba contra una clave
-- duplicada.
--
-- No es un caso raro que aparezca con el tiempo. Aparece con la hermandad
-- número dos y con el primer valor obvio que escriba.
--
-- Y encima no se ve venir: por la frontera de seguridad
-- (`hermandad_id = hermandad_actual()`), la fila que estorba es de otra
-- hermandad y por tanto INVISIBLE. En pantalla no hay nada repetido, y aun así
-- no se puede guardar.
--
-- Se puede ejecutar sobre una base ya en uso. No borra ningún catálogo de
-- ninguna hermandad.

-- 1. La columna y su valor por defecto (por si esta base es anterior).
alter table catalogos add column if not exists hermandad_id uuid references hermandades(id) on delete cascade;
alter table catalogos alter column hermandad_id set default hermandad_actual();

-- 2. La clave, por hermandad y no global.
--
--    En dos pasos y con aviso en vez de romper: una clave primaria no admite
--    nulos, así que primero se le busca dueño a lo que hubiera suelto de antes
--    de multi-hermandad —se le da a la primera hermandad, que es de quien era—
--    y solo si no queda nada huérfano se cambia la clave. Si quedara algo, se
--    deja como estaba y se avisa: es preferible eso a que la instalación se
--    pare a la mitad y todo lo que va detrás no llegue a crearse.
do $$
declare v_huerfanos int;
begin
  update catalogos set hermandad_id = (select id from hermandades order by creada_en limit 1)
   where hermandad_id is null;

  select count(*) into v_huerfanos from catalogos where hermandad_id is null;
  if v_huerfanos > 0 then
    -- Pasa si la base no tiene ninguna hermandad todavía. Entonces tampoco hay
    -- catálogos de nadie que arreglar, y esto se vuelve a ejecutar solo con
    -- correr el archivo otra vez después de crear la primera.
    raise warning 'catalogos: quedan % filas sin hermandad; la clave primaria se deja como estaba', v_huerfanos;
    return;
  end if;

  alter table catalogos alter column hermandad_id set not null;
  alter table catalogos drop constraint if exists catalogos_pkey;
  alter table catalogos add constraint catalogos_pkey primary key (hermandad_id, clave, valor);
end $$;

comment on table catalogos is
  'Las listas que configura cada hermandad (categorías, cuentas, tipos…). La '
  'clave es (hermandad_id, clave, valor): con la clave global de antes, la '
  'segunda hermandad no podía guardar ni «Cera», porque la fila ya era de otra '
  'y encima no la veía.';

-- -----------------------------------------------------------------------------
-- Comprobación
-- -----------------------------------------------------------------------------
-- Después de ejecutarlo, esto tiene que decir «hermandad_id, clave, valor»:
--
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'catalogos'::regclass and contype = 'p';
--
-- Si sigue diciendo solo «clave, valor», es que quedaban filas sin hermandad:
-- míralas con
--
--   select * from catalogos where hermandad_id is null;
--
-- y vuelve a ejecutar este archivo cuando estén asignadas.
