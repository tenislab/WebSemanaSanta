-- =============================================================================
--   QUE LA FAMILIA SE VEA POR LOS DOS LADOS
-- =============================================================================
--
-- Un menor a cargo de su padre es un vínculo entre dos fichas, y hasta ahora
-- solo se veía desde una:
--
--   · EL PADRE, en su área, ve a los suyos. Eso funciona: la política
--     `hermanos_a_cargo_select` le deja leer las fichas cuyo `tutor_id` es él.
--   · EL HIJO, en la suya, no veía nada. Ni una línea diciendo de quién
--     depende. Y no es un olvido de la pantalla: es que NO PUEDE leer la ficha
--     de su padre. La política va en un solo sentido, y está bien que vaya así.
--
-- -----------------------------------------------------------------------------
-- POR QUÉ NO SE ARREGLA CON UNA POLÍTICA MÁS
-- -----------------------------------------------------------------------------
--
-- Lo obvio sería añadir «y también puedes leer la ficha de tu tutor». Sería un
-- error: RLS decide POR FILAS, no por columnas. Dejarle leer esa fila le da el
-- teléfono de su padre, su dirección, SU IBAN y sus notas de salud. Todo, para
-- poder enseñar un nombre.
--
-- Así que va por función, que sí puede elegir columnas: devuelve el nombre y el
-- número de hermano, y nada más. Es exactamente lo que hace falta para escribir
-- «Perteneces a la familia de Juan Pérez (hermano nº 47)».
--
-- Ejecútalo después de `hermano-con-cargo.sql`. Volver a ejecutarlo no hace nada.
-- =============================================================================

/**
 * De quién depende quien está preguntando. Devuelve cero filas si no depende de
 * nadie, que es el caso de casi todos.
 *
 * `security definer` para poder mirar una fila que quien llama no puede leer, y
 * acotada por `hermano_propio_id()`: solo contesta por el tutor DE QUIEN
 * PREGUNTA. No acepta parámetros a propósito — una función así con un `id`
 * suelto sería un buscador de nombres del censo entero.
 */
create or replace function mi_tutor()
returns table (id uuid, nombre text, numero integer)
language sql stable security definer set search_path = public as $$
  select t.id, t.nombre, t.numero
    from hermanos yo
    join hermanos t on t.id = yo.tutor_id
   where yo.id = hermano_propio_id()
$$;

grant execute on function mi_tutor() to authenticated;
