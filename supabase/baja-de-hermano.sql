-- ============================================================================
--   LA BAJA DE UN HERMANO, EN UN SOLO PASO Y SIN ROMPER EL ESCALAFÓN
-- ============================================================================
--
-- QUÉ PASABA. Al tramitar una baja saltaba esto, veinte veces seguidas:
--
--   guardar 660b6973-…: duplicate key value violates unique constraint
--   "hermanos_numero_por_hermandad"
--
-- Y la baja NO se guardaba. En la pantalla salía tramitada; en la base seguía
-- todo igual. Los dos lados diciendo cosas distintas sobre el censo, que es de
-- lo peor que puede pasar aquí.
--
-- ----------------------------------------------------------------------------
-- POR QUÉ
-- ----------------------------------------------------------------------------
--
-- Dar de baja no toca una ficha: toca TODO EL ESCALAFÓN. El que se va sale de
-- la numeración (número 0) y todos los de detrás suben un puesto, que es como
-- funciona un escalafón — el hueco se cierra.
--
-- En una hermandad de mil, dar de baja al nº 8 son novecientas noventa y dos
-- fichas cambiadas. La aplicación las mandaba de seis en seis Y EN PARALELO, y
-- ahí está el fallo: el nº 9 intenta ponerse el 8 mientras el 8 todavía es el
-- 8, porque su petición va en el mismo lote y nadie garantiza el orden. El
-- índice único `(hermandad_id, numero)` lo rechaza, y lo rechaza casi todo.
--
-- No se arregla mandándolas de una en una y en orden: son cientos de viajes, y
-- si se corta a la mitad —se cierra el portátil, se cae la conexión— queda un
-- escalafón con la mitad corrida y la otra mitad no. Eso no hay quien lo
-- deshaga después.
--
-- ----------------------------------------------------------------------------
-- CÓMO SE ARREGLA
-- ----------------------------------------------------------------------------
--
-- Aquí, en una sola llamada y dentro de una transacción: o se hace entero o no
-- se hace nada.
--
-- Y el hueco se cierra EN DOS PASOS, con las fichas pasando por números
-- negativos. No es un truco caprichoso: el índice único es PARCIAL, solo mira
-- `where numero > 0`. En negativo las fichas quedan FUERA del índice, así que
-- se pueden mover todas sin que ninguna choque con ninguna; y al volver a
-- positivo, los huecos ya están libres.
--
-- Un solo `update numero = numero - 1` no valdría: Postgres comprueba la
-- unicidad fila a fila, no al final de la instrucción, así que la primera que
-- se mueve ya choca con la siguiente.
--
-- SECURITY INVOKER a propósito: la baja la tiene que poder hacer quien tenga
-- permiso para tocar el censo, y no más. Con DEFINER, cualquiera con la clave
-- pública podría dar de baja a quien quisiera.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Es seguro repetirlo: no borra ni sobrescribe datos.
-- ============================================================================

create or replace function dar_de_baja_hermano(p_hermano uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_hermandad uuid;
  v_numero int;
begin
  select hermandad_id, numero into v_hermandad, v_numero
    from hermanos where id = p_hermano;

  -- Sin ficha (o sin permiso para verla) no hay nada que hacer. No se lanza
  -- error: quien no la ve tampoco tiene por qué enterarse de que existe.
  if v_hermandad is null then return; end if;

  /*
   * LA BAJA QUITA EL CARGO, y no es limpieza.
   *
   * La única forma que tiene la base de revocarle los permisos a alguien es su
   * `estado`: `auth_es_hermano()` y `modulo_permitido()` preguntan por
   * `estado <> 'Baja'`. Dejarle el cargo escrito al tesorero destituido es
   * dejar la puerta apoyada: basta con que su estado vuelva a «Activo» —un
   * error de secretaría, una reincorporación— para que recupere Tesorería sin
   * que nadie lo haya decidido.
   */
  update hermanos
     set estado = 'Baja',
         numero = 0,
         cargo = null,
         baja_solicitada = false
   where id = p_hermano;

  -- Quien no ocupaba sitio no deja hueco al irse: el hermano civil y la ficha
  -- recién importada llevan número 0 a propósito.
  if v_numero > 0 then
    update hermanos
       set numero = -numero
     where hermandad_id = v_hermandad and numero > v_numero;

    update hermanos
       set numero = (-numero) - 1
     where hermandad_id = v_hermandad and numero < 0;
  end if;
end $$;

comment on function dar_de_baja_hermano(uuid) is
  'Da de baja a un hermano y cierra el hueco que deja en el escalafón, entero y de una vez. '
  'Los de detrás suben un puesto pasando por números negativos, que quedan fuera del índice '
  'único parcial (numero > 0) y por eso no chocan entre ellos. Hacerlo desde el navegador, '
  'ficha a ficha, chocaba con ese índice y dejaba la baja sin guardar.';

grant execute on function dar_de_baja_hermano(uuid) to authenticated;
